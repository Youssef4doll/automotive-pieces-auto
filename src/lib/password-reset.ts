import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

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
