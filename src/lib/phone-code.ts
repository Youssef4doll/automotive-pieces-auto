import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { tunisianDigits } from "@/lib/validation";

/**
 * Codes sent by SMS: signing in with a phone number, adding a number to an
 * account, and confirming something serious on an account that has no
 * password to re-enter (deleting it).
 *
 * The rules, all here so they can be read together:
 *   - six digits from the OS CSPRNG, alive ten minutes;
 *   - five wrong answers and that code is dead (a new one must be sent);
 *   - a new code for the same number and purpose kills the previous one, so
 *     there is never more than one live code to guess at;
 *   - only an HMAC of the code is stored, keyed with the session secret, so
 *     a copy of the database cannot be read back into codes;
 *   - a right code is spent at once, atomically: two phones racing with the
 *     same code cannot both get in.
 * How often a code may be SENT, per number and per caller, is the routes'
 * job (rate-limit LIMITS.phoneCode*), because it is about the SMS bill and
 * the customer's phone as much as about guessing.
 */

export type CodePurpose = "login" | "link" | "confirm";

export const CODE_TTL_MS = 10 * 60_000;
export const MAX_ATTEMPTS = 5;
const TICKET_TTL_MS = 15 * 60_000;
const TICKET_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/** "+216" and the eight digits, from however the customer typed it; or null. */
export function e164(raw: string): string | null {
  const d = tunisianDigits(raw);
  return d ? `+216${d}` : null;
}

function key() {
  const secret = process.env.SESSION_SECRET || "dev-only-insecure-secret";
  return createHash("sha256").update(`phone-code:${secret}`).digest();
}

function hashCode(phone: string, code: string) {
  return createHmac("sha256", key()).update(`${phone}:${code}`).digest("hex");
}

function hashTicket(ticket: string) {
  return createHash("sha256").update(ticket, "utf8").digest("hex");
}

/** Mint and store a code. Returns it — the only time it exists in clear. */
export async function issueCode(phone: string, purpose: CodePurpose, userId: string | null = null) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = new Date();
  await prisma.$transaction([
    // The previous live code for this number and purpose stops working.
    prisma.phoneCode.updateMany({ where: { phone, purpose, consumedAt: null }, data: { consumedAt: now } }),
    prisma.phoneCode.create({
      data: { phone, purpose, userId, codeHash: hashCode(phone, code), expiresAt: new Date(now.getTime() + CODE_TTL_MS) },
    }),
  ]);
  return code;
}

export type CodeCheck = { ok: true; id: string } | { ok: false; reason: "wrong" | "expired" | "too_many" };

/**
 * Is this the live code for this number (and, for "link" and "confirm",
 * this account)? A right answer spends it.
 */
export async function checkCode(phone: string, purpose: CodePurpose, code: string, userId: string | null = null): Promise<CodeCheck> {
  const row = await prisma.phoneCode.findFirst({
    where: { phone, purpose, consumedAt: null, ...(userId ? { userId } : {}) },
    orderBy: { createdAt: "desc" },
    select: { id: true, codeHash: true, attempts: true, expiresAt: true },
  });
  if (!row || row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many" };

  // Counted before comparing, and only while under the ceiling: parallel
  // guesses each take a slot, so five is five however fast they come.
  const counted = await prisma.phoneCode.updateMany({
    where: { id: row.id, attempts: { lt: MAX_ATTEMPTS }, consumedAt: null },
    data: { attempts: { increment: 1 } },
  });
  if (counted.count === 0) return { ok: false, reason: "too_many" };

  const given = Buffer.from(hashCode(phone, /^\d{6}$/.test(code) ? code : "x"), "hex");
  const stored = Buffer.from(row.codeHash, "hex");
  if (given.length !== stored.length || !timingSafeEqual(given, stored)) {
    return { ok: false, reason: row.attempts + 1 >= MAX_ATTEMPTS ? "too_many" : "wrong" };
  }

  const spent = await prisma.phoneCode.updateMany({ where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() } });
  return spent.count === 1 ? { ok: true, id: row.id } : { ok: false, reason: "expired" };
}

/**
 * A right "login" code for a number with no account: a one-use proof that
 * this phone holds that number, good for fifteen minutes — what opening an
 * account on it costs.
 */
export async function issueTicket(codeId: string) {
  const ticket = randomBytes(32).toString("base64url");
  await prisma.phoneCode.update({
    where: { id: codeId },
    data: { ticketHash: hashTicket(ticket), ticketExpiresAt: new Date(Date.now() + TICKET_TTL_MS) },
  });
  return ticket;
}

/** The number a ticket proves, spending the ticket; null if it proves nothing. */
export async function spendTicket(ticket: string): Promise<string | null> {
  if (!TICKET_SHAPE.test(ticket)) return null;
  const tokenHash = hashTicket(ticket);
  const row = await prisma.phoneCode.findUnique({ where: { ticketHash: tokenHash }, select: { id: true, phone: true, ticketExpiresAt: true } });
  if (!row || !row.ticketExpiresAt || row.ticketExpiresAt.getTime() <= Date.now()) return null;
  const spent = await prisma.phoneCode.updateMany({ where: { id: row.id, ticketHash: tokenHash }, data: { ticketHash: null, ticketExpiresAt: null } });
  return spent.count === 1 ? row.phone : null;
}

/** The SMS itself, in the app's language. The code leads, for the lock screen. */
export function codeMessage(code: string, locale: string, purpose: CodePurpose) {
  const minutes = CODE_TTL_MS / 60_000;
  if (locale === "ar") {
    return purpose === "confirm"
      ? `${code} هو رمز تأكيد حذف حسابك في Automotive Pièces Auto. صالح ${minutes} دقائق. لا تشاركه مع أحد.`
      : `${code} هو رمز الدخول إلى Automotive Pièces Auto. صالح ${minutes} دقائق. لا تشاركه مع أحد.`;
  }
  if (locale === "en") {
    return purpose === "confirm"
      ? `${code} is your code to confirm deleting your Automotive Pièces Auto account. Valid ${minutes} minutes. Never share it.`
      : `${code} is your Automotive Pièces Auto sign-in code. Valid ${minutes} minutes. Never share it.`;
  }
  return purpose === "confirm"
    ? `${code} est votre code pour confirmer la suppression de votre compte Automotive Pièces Auto. Valable ${minutes} minutes. Ne le communiquez à personne.`
    : `${code} est votre code de connexion Automotive Pièces Auto. Valable ${minutes} minutes. Ne le communiquez à personne.`;
}

/** "+216 98 765 432" → "•• ••• 432": enough to recognise, not to copy. */
export function maskPhone(phone: string) {
  return `•• ••• ${phone.slice(-3)}`;
}
