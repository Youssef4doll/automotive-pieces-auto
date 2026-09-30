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

export { clear, hit, peek, callerIp, type RateLimitResult } from "./rate-limit-core";
import { callerIp } from "./rate-limit-core";

/** The caller's address (lib/rate-limit-core, `callerIp`) under a prefix. */
export async function callerKey(prefix: string) {
  return `${prefix}:${callerIp(await headers())}`;
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
  /** Reset e-mails to ONE account, whatever address asks. Past it the request
   *  still answers "sent" (the answer never says whether an account exists)
   *  and nothing is sent — a rotating attacker cannot fill somebody's inbox. */
  passwordResetPerAccount: { limit: 3, windowMs: 60 * 60_000 },
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
  /** Photo requests from the app: a few photos a person, not a gallery upload. */
  expertRequest: { limit: 6, windowMs: 30 * 60_000 },
  /** Reference lookup, the one endpoint that can be walked for the catalogue. */
  reference: { limit: 60, windowMs: 60_000 },
  /** The app's analytics batches — one every few seconds from an active phone. */
  events: { limit: 120, windowMs: 60_000 },
  /** Promo codes that do not exist. Only misses are charged, so a customer
   *  re-pricing a basket with a good code never gets near it, and guessing
   *  "ETE10", "ETE15", "ETE20"… stops after a handful. */
  promoMiss: { limit: 10, windowMs: 15 * 60_000 },
  /** Return requests FILED: each is a row the shop answers and two e-mails.
   *  A customer with a bad batch files a few; nobody needs dozens an hour.
   *  Only filings count (peek before, hit after), so a customer correcting a
   *  refused form is never locked out by their own mistakes. */
  returnRequest: { limit: 8, windowMs: 60 * 60_000 },
  /** Attempts at all, filed or refused — the flood ceiling in front of the
   *  photo parsing and the locked transaction. */
  returnAttempt: { limit: 40, windowMs: 10 * 60_000 },
  /** A phone asking to be told about an order or a part: a few per visit. */
  pushRegister: { limit: 30, windowMs: 10 * 60_000 },
  /** Type-ahead fires per keystroke (debounced), so the ceiling is higher. */
  suggest: { limit: 200, windowMs: 60_000 },
} as const;
