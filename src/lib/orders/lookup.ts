import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Recovering a guest order with its reference and the phone number on it.
 *
 * Shared by the website's "retrouver ma commande" form and the phone app's
 * equivalent, because the matching rule is the security of both. The
 * reference is sequential and printed on every confirmation, so it cannot be
 * the key on its own; the second factor is the phone number, the one detail
 * the customer certainly knows and a guesser would have to walk eight digits
 * to find. Both callers put their tightest rate limit in front of it.
 *
 * Returns the order or null, and nothing in between. Saying "that reference
 * exists but the number is wrong" would turn this into an oracle for which
 * references are real, so every failure is the same null.
 */
export async function matchGuestOrder(ref: string, phone: string) {
  const cleanRef = ref.trim().toUpperCase().slice(0, 32);
  const digits = phone.replace(/\D/g, "");
  if (cleanRef.length < 3 || digits.length < 6) return null;

  const order = await prisma.order.findUnique({
    where: { ref: cleanRef },
    select: { id: true, ref: true, phone: true, userId: true },
  });
  if (!order || !phonesMatch(order.phone, digits)) return null;
  return { id: order.id, ref: order.ref, userId: order.userId };
}

/**
 * The stored number may carry spaces, a +216, or neither. Compared on the last
 * eight digits, so a customer who typed "+216 20 445 566" at checkout and
 * "20445566" here is the same person.
 */
export function phonesMatch(stored: string, typed: string) {
  const a = stored.replace(/\D/g, "");
  const b = typed.replace(/\D/g, "");
  if (a.length < 6 || b.length < 6) return false;
  return a.slice(-8) === b.slice(-8);
}
