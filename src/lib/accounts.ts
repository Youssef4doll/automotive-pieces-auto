import "server-only";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * bcrypt work factor. 12 is the current sensible floor — ~250ms per hash on
 * commodity hardware, which is invisible on a login and expensive in bulk for
 * anyone who ever gets hold of the table.
 */
export const BCRYPT_COST = 12;

/**
 * The account behind an e-mail address, whatever its letter case.
 *
 * Addresses are stored lower-cased now (lib/validation, `emailAddress`), so
 * the unique index answers almost every lookup. Accounts made before that
 * may hold "Sami@…"; the case-insensitive read finds them, oldest first, so
 * the answer is the same account every time.
 */
export async function findUserByEmail<S extends Prisma.UserSelect>(email: string, select: S) {
  const wanted = email.trim().toLowerCase();
  return (
    (await prisma.user.findUnique({ where: { email: wanted }, select })) ??
    (await prisma.user.findFirst({
      where: { email: { equals: wanted, mode: "insensitive" } },
      orderBy: { createdAt: "asc" },
      select,
    }))
  );
}

/**
 * A new password, and everything signed in with the old one signed out.
 *
 * A password is changed because somebody else might know it, so every
 * session that proves knowledge of the old one goes: the phones' customer
 * sessions, the staff sessions, and — through `passwordChangedAt`, which
 * lib/session compares with each cookie's issue time — every website cookie,
 * including one on a computer the owner no longer has.
 *
 * `keepAppSession` is the phone the change was made from: signing it out
 * too would only punish the person who just proved who they are. The website
 * re-issues its own cookie for the same reason (actions/account).
 */
export async function setPassword(userId: string, password: string, opts: { keepAppSession?: string } = {}) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash, passwordChangedAt: new Date() } }),
    prisma.customerSession.deleteMany({
      where: { userId, ...(opts.keepAppSession ? { id: { not: opts.keepAppSession } } : {}) },
    }),
    prisma.adminSession.deleteMany({ where: { userId } }),
  ]);
}

/** A device name as the phone sent it, made safe to store and show: one line, 60 characters. */
export function deviceLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return clean || null;
}
