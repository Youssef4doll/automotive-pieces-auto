import "server-only";
import { cookies } from "next/headers";

/**
 * Who may read an order's confirmation page.
 *
 * Order references are sequential and printed on the page — `CMD-1042`,
 * `CMD-1043` — so a reference is not a secret and cannot be the access check.
 * Checkout is open to guests, so a login cannot be the check either.
 *
 * What is left is the browser that placed the order. On success the order's
 * id, a cuid nobody can guess, is appended to an httpOnly cookie; the
 * confirmation page then serves the order only to a caller who either signed
 * in as its owner or is holding that id. Forging the cookie requires already
 * knowing the id, which is the thing being protected.
 */

const COOKIE = "apa_orders";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
/** Keep the cookie small: only the most recent orders are ever revisited. */
const KEEP = 12;

export async function rememberOrder(orderId: string) {
  const jar = await cookies();
  const existing = (jar.get(COOKIE)?.value ?? "").split(".").filter(Boolean);
  const next = [orderId, ...existing.filter((id) => id !== orderId)].slice(0, KEEP);

  jar.set(COOKIE, next.join("."), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function placedInThisBrowser(orderId: string) {
  const jar = await cookies();
  return (jar.get(COOKIE)?.value ?? "").split(".").includes(orderId);
}
