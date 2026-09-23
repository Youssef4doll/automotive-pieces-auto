import "server-only";
import { headers } from "next/headers";

/**
 * A fixed-window rate limiter held in process memory.
 *
 * Honest about what it is: one Node process, one map. On a single instance —
 * which is what this shop runs on — it stops password guessing and form
 * flooding outright. Across several instances each one keeps its own count, so
 * the effective limit multiplies by the instance count; that is still a hard
 * ceiling, just a looser one. Moving to Redis means replacing `hit()` and
 * nothing else, because every caller goes through it.
 *
 * Not a substitute for the checks themselves: it limits how fast an attacker
 * may ask, while authentication and ownership decide the answer.
 */

type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

/** Bounded so a flood of unique keys cannot grow the map without limit. */
const MAX_KEYS = 20_000;

function sweep(now: number) {
  for (const [key, w] of buckets) {
    if (w.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  /** Seconds until the window resets — for the message shown to the user. */
  retryAfter: number;
  remaining: number;
};

export function hit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) sweep(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0, remaining: limit - 1 };
  }

  existing.count += 1;
  const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  if (existing.count > limit) return { ok: false, retryAfter, remaining: 0 };
  return { ok: true, retryAfter, remaining: limit - existing.count };
}

/**
 * Read a window without spending from it.
 *
 * Lets a caller refuse an over-budget request while only charging for the
 * outcome it cares about — failed logins, say, rather than every login. A
 * customer who signs in correctly should never move closer to a lockout.
 */
export function peek(key: string, limit: number): RateLimitResult {
  const now = Date.now();
  const w = buckets.get(key);
  if (!w || w.resetAt <= now) return { ok: true, retryAfter: 0, remaining: limit };
  const retryAfter = Math.max(1, Math.ceil((w.resetAt - now) / 1000));
  if (w.count >= limit) return { ok: false, retryAfter, remaining: 0 };
  return { ok: true, retryAfter, remaining: limit - w.count };
}

/** Forget a window — called when an attempt succeeds. */
export function clear(key: string) {
  buckets.delete(key);
}

/**
 * Whether a Cloudflare proxy sits in front of this deployment.
 *
 * Off unless the operator says so, and that is the whole point. `CF-Connecting-IP`
 * is only meaningful when Cloudflare wrote it; on a deployment reachable
 * directly, anyone may send it, and a limiter that trusted it would hand every
 * request a fresh bucket — turning the rate limiter off while it still looks
 * switched on. So it is read only where the origin is genuinely unreachable
 * except through Cloudflare, which is a fact about the infrastructure that
 * this process cannot discover for itself.
 */
const TRUST_CLOUDFLARE_IP = process.env.TRUST_CLOUDFLARE_IP === "1";

/**
 * The caller's address, as far as it can be trusted.
 *
 * Only the first entry of `x-forwarded-for` is read, and only the leftmost hop
 * — the rest is client-supplied and trivially spoofed. Behind a proxy that
 * does not rewrite the header this degrades to a shared bucket, which fails
 * closed (stricter), not open.
 *
 * That last sentence is why the Cloudflare branch exists. Put a second proxy
 * in front of Vercel and the leftmost hop may become Cloudflare's edge rather
 * than the shopper, at which point every visitor in the country shares one
 * bucket — 40 checkouts per ten minutes for the whole shop, refused as if one
 * person were flooding it. See HANDOVER.md; the flag must be set in the same
 * change that turns the proxy on, not afterwards.
 */
export async function callerKey(prefix: string) {
  const h = await headers();
  if (TRUST_CLOUDFLARE_IP) {
    const cf = h.get("cf-connecting-ip")?.trim();
    if (cf) return `${prefix}:${cf}`;
  }
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || h.get("x-real-ip") || "unknown";
  return `${prefix}:${ip}`;
}

/**
 * Windows used across the app, named so the numbers are reviewable in one place.
 *
 * The per-address numbers are deliberately loose. Tunisian mobile carriers put
 * large numbers of subscribers behind carrier-grade NAT, so one address is not
 * one person — it can be a whole city block of real customers. A tight per-IP
 * limit does not stop a determined attacker (who can rotate addresses) but it
 * does lock out everyone sharing a carrier at the busiest time of day.
 *
 * So the shape is: limit the thing actually under attack by its own identity,
 * and keep the per-address number as a flood ceiling only.
 */
export const LIMITS = {
  /** Password guessing against one account. This is the real brute-force gate. */
  loginPerAccount: { limit: 8, windowMs: 10 * 60_000 },
  /** Flood ceiling for login across a shared address. */
  loginPerIp: { limit: 60, windowMs: 10 * 60_000 },
  /** Account creation, which costs a bcrypt hash each time. */
  signup: { limit: 20, windowMs: 60 * 60_000 },
  /** "Forgot my password": each request sends an e-mail, and the form would
   *  otherwise let anyone flood a customer's inbox from our address. */
  passwordReset: { limit: 5, windowMs: 15 * 60_000 },
  /** Order placement — a shared address may carry many genuine shoppers. */
  checkout: { limit: 40, windowMs: 10 * 60_000 },
  /** Guest order lookup. The tightest window on this list, because it is the
   *  one endpoint where a wrong answer still tells the caller something: order
   *  references are sequential, so the only thing standing between a guesser
   *  and somebody else's delivery address is the phone number on the order.
   *  A genuine customer needs two or three tries; anything walking the number
   *  space needs thousands. */
  orderLookup: { limit: 10, windowMs: 15 * 60_000 },
  /** The phone app reading an order it holds a token for. The token is 256
   *  random bits, so this is a flood ceiling, not a guessing gate — the app
   *  refreshes a tracking screen and a list of orders, and should not be
   *  locked out of its own customer's parcel for doing so. */
  orderRead: { limit: 120, windowMs: 60_000 },
  /** Newsletter, the classic spam target; the honeypot does the real work. */
  newsletter: { limit: 15, windowMs: 60 * 60_000 },
  /** The contact form. Every message is a row in the shop's inbox and an
   *  e-mail in the owner's, so the ceiling is lower than the newsletter's —
   *  but not so low that a household on one carrier address cannot write
   *  twice about two different orders. */
  contact: { limit: 8, windowMs: 30 * 60_000 },
  /** Reference lookup, the one endpoint that can be walked for the catalogue. */
  reference: { limit: 60, windowMs: 60_000 },
  /** Type-ahead fires per keystroke (debounced), so the ceiling is higher. */
  suggest: { limit: 200, windowMs: 60_000 },
} as const;
