import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hit, peek, clear, callerKey, LIMITS } from "@/lib/rate-limit";

/**
 * "Is this the right password for this e-mail?" — asked by the website's
 * sign-in form and by the app's staff sign-in, answered once, here.
 *
 * Two front doors that each kept their own copy would each keep their own
 * failure budget, and a password guesser would simply use both. The keys
 * below are the ones the website form always charged, so eight wrong guesses
 * lock the account out of both doors together.
 *
 * Two gates, because they defend different things. The per-account one is
 * the brute-force gate: guessing one password is what it stops, and it is
 * unaffected by how many people share the attacker's address. The per-address
 * one is only a flood ceiling, set high enough that a carrier-NAT full of
 * real customers never reaches it. Both are read before bcrypt, which is the
 * expensive part of serving an attempt, and only failures are charged: a
 * customer who fumbles twice and then gets it right starts clean.
 */

export type CredentialCheck =
  | { ok: true; user: { id: string; name: string; email: string; role: "CUSTOMER" | "ADMIN" } }
  | { ok: false; reason: "rate_limited"; retryAfter: number }
  | { ok: false; reason: "invalid" };

/**
 * Compared against when the e-mail has no account, so that "no such account"
 * takes as long as "wrong password". Without it the answer comes back ~250 ms
 * sooner for an unknown address, and the difference lists who shops here.
 * Generated once per process from random bytes: it matches nothing.
 */
let decoy: Promise<string> | null = null;
function decoyHash() {
  decoy ??= bcrypt.hash(crypto.randomUUID(), 12);
  return decoy;
}

export async function checkCredentials(email: string, password: string): Promise<CredentialCheck> {
  const accountKey = `login:acct:${email.toLowerCase()}`;
  const ipKey = await callerKey("login");
  const accountGate = peek(accountKey, LIMITS.loginPerAccount.limit);
  const ipGate = peek(ipKey, LIMITS.loginPerIp.limit);
  if (!accountGate.ok || !ipGate.ok) {
    return { ok: false, reason: "rate_limited", retryAfter: Math.max(accountGate.retryAfter, ipGate.retryAfter) };
  }

  const charge = (): CredentialCheck => {
    hit(accountKey, LIMITS.loginPerAccount.limit, LIMITS.loginPerAccount.windowMs);
    hit(ipKey, LIMITS.loginPerIp.limit, LIMITS.loginPerIp.windowMs);
    // One answer for both halves: naming which one was wrong tells an
    // attacker which e-mails have accounts.
    return { ok: false, reason: "invalid" };
  };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, passwordHash: true },
  });
  if (!user) {
    await bcrypt.compare(password, await decoyHash());
    return charge();
  }
  if (!(await bcrypt.compare(password, user.passwordHash))) return charge();

  clear(accountKey);
  return { ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}
