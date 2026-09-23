import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * The phone app's proof that it may read an order.
 *
 * The website's proof is an httpOnly cookie of order ids (lib/order-access);
 * a phone has no cookie jar, so the app API issues one of these instead and
 * the app keeps it in the Keychain / Android Keystore. The decision and its
 * reasoning are in the app repository's ARCHITECTURE.md §10.
 *
 * 32 bytes from the OS CSPRNG, sent as base64url (43 characters). Stored as
 * SHA-256 only: with 256 bits of entropy there is nothing to brute-force, so
 * a slow password hash would buy nothing, but a database dump must not be a
 * set of working keys to strangers' names, phones and delivery addresses.
 */

const TOKEN_BYTES = 32;
/** base64url of 32 bytes is exactly 43 characters; anything else is not ours. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Mint a token for an order. Returns the raw token — the only time it exists. */
export async function issueOrderToken(orderId: string, tx: Prisma.TransactionClient = prisma) {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  await tx.orderAccessToken.create({ data: { orderId, tokenHash: hashToken(token) } });
  return token;
}

/**
 * The order this token opens, if it opens the order with this reference.
 *
 * Both have to agree. A token is looked up by its hash — a unique index, so
 * one query and no comparison loop to time — and then the order it belongs
 * to must be the one named in the URL. A valid token for CMD-1042 presented
 * at CMD-1043 is refused exactly like a forged one.
 */
export async function orderIdForToken(ref: string, token: string | null | undefined) {
  if (!token || !TOKEN_SHAPE.test(token)) return null;
  const row = await prisma.orderAccessToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, orderId: true, order: { select: { ref: true } } },
  });
  if (!row || row.order.ref !== ref) return null;
  // Best-effort bookkeeping for pruning; never worth failing a read over.
  prisma.orderAccessToken
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);
  return row.orderId;
}

/** `Authorization: Bearer <token>`, or null. */
export function bearerToken(header: string | null) {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}
