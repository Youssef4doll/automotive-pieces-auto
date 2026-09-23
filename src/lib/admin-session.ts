import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { bearerToken } from "@/lib/order-token";

/**
 * The phone app's staff sign-in. Why it is a table and not the website's
 * cookie is on the AdminSession model; the token itself is made and stored
 * exactly as an order token is (lib/order-token): 32 bytes from the OS CSPRNG,
 * base64url on the wire, SHA-256 at rest.
 */

const TOKEN_BYTES = 32;
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;
/** Thirty days, as the website's "se souvenir de moi" — then sign in again. */
const LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
/** `lastUsedAt` is bookkeeping; writing it on every request would be a write per read. */
const TOUCH_EVERY_MS = 5 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Mint a session for a user already proven to be an admin. Returns the raw token — the only time it exists. */
export async function issueAdminSession(userId: string) {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  await prisma.adminSession.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + LIFETIME_MS) },
  });
  return token;
}

export type AppAdmin = { id: string; name: string; email: string };

/**
 * The admin this request speaks for, or null.
 *
 * The role is read from User on every call rather than remembered in the
 * session: an account demoted on the website stops working in the app on its
 * very next request. A session that has expired, or whose user is no longer
 * an admin, is deleted on the way out so it cannot come back.
 */
export async function adminForRequest(request: Request): Promise<AppAdmin | null> {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token || !TOKEN_SHAPE.test(token)) return null;
  const row = await prisma.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      lastUsedAt: true,
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });
  if (!row) return null;
  const now = Date.now();
  if (row.expiresAt.getTime() <= now || row.user.role !== "ADMIN") {
    await prisma.adminSession.deleteMany({ where: { id: row.id } });
    return null;
  }
  if (!row.lastUsedAt || now - row.lastUsedAt.getTime() > TOUCH_EVERY_MS) {
    prisma.adminSession
      .update({ where: { id: row.id }, data: { lastUsedAt: new Date(now) } })
      .catch(() => undefined);
  }
  return { id: row.user.id, name: row.user.name, email: row.user.email };
}

/** Sign out: the token stops working everywhere, at once. */
export async function revokeAdminSession(request: Request) {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token || !TOKEN_SHAPE.test(token)) return;
  await prisma.adminSession.deleteMany({ where: { tokenHash: hashToken(token) } });
}
