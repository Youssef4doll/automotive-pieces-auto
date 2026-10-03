import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email";
import { passwordResetMail } from "@/lib/email-templates";
import { loadShopForEmail } from "@/lib/order-emails";
import { siteUrl } from "@/lib/site";
import { findUserByEmail } from "@/lib/accounts";
import { hit, LIMITS } from "@/lib/rate-limit";

/** How long a "forgot my password" link works. Long enough to find the
 *  e-mail; short enough that one found in an old inbox is useless. */
export const RESET_TOKEN_TTL_MS = 60 * 60_000;

/** The token goes in the e-mail; only its hash goes in the database. */
export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newResetToken() {
  return randomBytes(32).toString("base64url");
}

/**
 * The row for a token if it can still be spent: exists, unused, unexpired.
 * Null for anything else — the page shows the same "no longer valid" for a
 * typo, a spent link and a stale one, since telling them apart helps nobody
 * but a guesser.
 */
export async function findValidResetToken(token: string) {
  if (!token || token.length < 20) return null;
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    include: { user: { select: { id: true, role: true, email: true } } },
  });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

/**
 * Send a reset link to this address if it has an account; do nothing if it
 * has not. The caller answers the same either way — see the website's form
 * and `POST /api/v1/auth/password-reset`, which both come through here.
 */
export async function startPasswordReset(email: string) {
  const user = await findUserByEmail(email, { id: true, name: true, email: true });
  if (!user) return;
  const perAccount = LIMITS.passwordResetPerAccount;
  if (!hit(`pwreset:acct:${user.id}`, perAccount.limit, perAccount.windowMs).ok) return;

  const token = newResetToken();
  await prisma.$transaction([
    // One live link per account. A second request replaces the first rather
    // than leaving two working links in two inboxes.
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    }),
  ]);

  // Found by its e-mail, so it has one; the check is for the type.
  if (!user.email) return;
  const shop = await loadShopForEmail();
  const mail = passwordResetMail({ ...user, email: user.email }, `${siteUrl()}/compte/reinitialiser/${token}`, shop);
  // sendMail never throws and logs its own failures with the subject, which
  // carries no token.
  await sendMail(mail);
}
