import "server-only";
import type { NextRequest } from "next/server";
import { bearerToken, orderIdForToken } from "@/lib/order-token";
import { customerForRequest } from "@/lib/customer-session";
import { prisma } from "@/lib/prisma";

/**
 * Which order this request may act on: the one its bearer token opens, or —
 * when the bearer is an account session instead — the order with this
 * reference on that account. The same two keys that read an order; never an
 * e-mail or a phone number, which are not proof of anything.
 *
 * `null` for no key at all (answer 401), `undefined` for a key that opens
 * nothing here (answer 404, so a guessed reference is not confirmed).
 */
export async function orderIdForRequest(request: NextRequest, ref: string): Promise<string | null | undefined> {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return null;
  const byToken = await orderIdForToken(ref, token);
  if (byToken) return byToken;
  const customer = await customerForRequest(request);
  if (!customer) return undefined;
  const owned = await prisma.order.findFirst({ where: { ref, userId: customer.id }, select: { id: true } });
  return owned?.id ?? undefined;
}
