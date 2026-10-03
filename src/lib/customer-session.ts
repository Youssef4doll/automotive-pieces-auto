import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { bearerToken } from "@/lib/order-token";

/**
 * The phone app's customer sign-in — the CustomerSession model explains why
 * it is a bearer token in a table and not the website's cookie.
 *
 * Made and stored like every other token the app holds (lib/order-token,
 * lib/admin-session): 32 bytes from the OS CSPRNG, base64url on the wire,
 * SHA-256 at rest. A customer token is looked up in its own table, so it
 * cannot open the staff door even on an admin's account.
 */

const TOKEN_BYTES = 32;
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;
/**
 * Thirty days from the last time the phone used it — a customer who opens
 * the app every week stays signed in — but never more than six months from
 * the sign-in itself, so a token copied off a phone does not live for ever.
 * (It was thirty days flat: a regular customer was signed out every month.)
 */
const LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
/** `lastUsedAt` is bookkeeping, not worth a write on every read. */
const TOUCH_EVERY_MS = 5 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Mint a session for a user whose password has just been checked. Returns the raw token — the only time it exists. */
export async function issueCustomerSession(userId: string, device: string | null = null) {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  await prisma.customerSession.create({
    data: { userId, device, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + LIFETIME_MS) },
  });
  return token;
}

/** What the app may know about the person signed in. Never the password hash. */
export type AppCustomer = {
  id: string;
  name: string;
  /** Null for an account opened with a phone code. */
  email: string | null;
  phone: string | null;
  /** The number it proved by code, if any. */
  verifiedPhone: string | null;
  /** Whether it can sign in with a password at all (not the hash itself). */
  hasPassword: boolean;
  role: "CUSTOMER" | "ADMIN";
  createdAt: Date;
  /** The session this request came in on — "this phone" in the device list. */
  sessionId: string;
};

/**
 * The customer this request speaks for, or null.
 *
 * The user row is read on every call, so an account deleted or changed on
 * the website is seen by the app on its very next request. An expired
 * session is deleted on the way out.
 */
export async function customerForRequest(request: Request): Promise<AppCustomer | null> {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token || !TOKEN_SHAPE.test(token)) return null;
  const row = await prisma.customerSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
      lastUsedAt: true,
      user: { select: { id: true, name: true, email: true, phone: true, verifiedPhone: true, passwordHash: true, role: true, createdAt: true } },
    },
  });
  if (!row) return null;
  const now = Date.now();
  if (row.expiresAt.getTime() <= now) {
    await prisma.customerSession.deleteMany({ where: { id: row.id } });
    return null;
  }
  // Each use slides the end thirty days on, up to the six-month cap.
  if (!row.lastUsedAt || now - row.lastUsedAt.getTime() > TOUCH_EVERY_MS) {
    const expiresAt = new Date(Math.min(now + LIFETIME_MS, row.createdAt.getTime() + MAX_AGE_MS));
    prisma.customerSession
      .update({ where: { id: row.id }, data: { lastUsedAt: new Date(now), expiresAt } })
      .catch(() => undefined);
  }
  const { passwordHash, ...user } = row.user;
  return { ...user, hasPassword: Boolean(passwordHash), sessionId: row.id };
}

/** Sign out this phone. */
export async function revokeCustomerSession(request: Request) {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token || !TOKEN_SHAPE.test(token)) return;
  await prisma.customerSession.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/**
 * Sign every phone out of an account — after a password change or reset.
 * A stolen phone must not outlive the password its owner just replaced.
 */
export async function revokeAllCustomerSessions(userId: string) {
  await prisma.customerSession.deleteMany({ where: { userId } });
}

/** The phones signed in to this account, most recently used first. */
export async function listCustomerSessions(userId: string, currentId: string) {
  const rows = await prisma.customerSession.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: [{ lastUsedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    select: { id: true, device: true, createdAt: true, lastUsedAt: true },
    take: 50,
  });
  return rows.map((r) => ({
    id: r.id,
    device: r.device,
    signedInAt: r.createdAt.toISOString(),
    lastUsedAt: (r.lastUsedAt ?? r.createdAt).toISOString(),
    current: r.id === currentId,
  }));
}

/** Sign out one phone, or every phone but this one. Only ever this account's own sessions. */
export async function revokeOtherCustomerSessions(userId: string, keepId: string, onlyId?: string) {
  const { count } = await prisma.customerSession.deleteMany({
    where: { userId, id: onlyId ? { equals: onlyId, not: keepId } : { not: keepId } },
  });
  return count;
}
