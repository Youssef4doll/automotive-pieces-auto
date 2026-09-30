/**
 * The rate limiter's windows, with no Next.js imports — so `src/proxy.ts`,
 * which runs in front of every route, can use the same code as the routes.
 * The reasoning is in lib/rate-limit.ts, which re-exports all of this.
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
export function callerIp(h: Headers) {
  if (TRUST_CLOUDFLARE_IP) {
    const cf = h.get("cf-connecting-ip")?.trim();
    if (cf) return cf;
  }
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}
