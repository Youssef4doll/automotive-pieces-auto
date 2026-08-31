"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/session";
import { hit, peek, clear, callerKey, LIMITS } from "@/lib/rate-limit";
import { checkForm } from "@/lib/bot-check";

const signupSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.email("Email invalide"),
  phone: z.string().min(6, "Numéro de téléphone invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

/**
 * bcrypt work factor. 12 is the current sensible floor — ~250ms per hash on
 * commodity hardware, which is invisible on a login and expensive in bulk for
 * anyone who ever gets hold of the table.
 */
const BCRYPT_COST = 12;

export type AuthState = { error?: string } | undefined;

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  // Silent success for bots: telling a script it was detected only teaches it
  // what to change. A real person cannot reach this branch.
  if (!checkForm(formData).human) return { error: "Une erreur est survenue. Réessayez." };

  const gate = hit(await callerKey("signup"), LIMITS.signup.limit, LIMITS.signup.windowMs);
  if (!gate.ok) {
    return { error: `Trop de tentatives. Réessayez dans ${Math.ceil(gate.retryAfter / 60)} minute(s).` };
  }

  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }
  const { name, email, phone, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Un compte existe déjà avec cet email" };
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const user = await prisma.user.create({
    data: { name, email, phone, passwordHash, role: "CUSTOMER" },
  });

  await createSession({ userId: user.id, role: user.role });
  redirect("/compte");
}

const loginSchema = z.object({
  email: z.email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }
  const { email, password } = parsed.data;

  // Two gates, because they defend different things. The per-account one is
  // the brute-force gate: guessing one password is what it stops, and it is
  // unaffected by how many people share the attacker's address. The per-address
  // one is only a flood ceiling, set high enough that a carrier-NAT full of
  // real customers never reaches it. Both run before bcrypt, which is the
  // expensive part of serving an attempt.
  // Only failures are charged. Checked before bcrypt runs, since serving an
  // attempt is the expensive part.
  const accountKey = `login:acct:${email.toLowerCase()}`;
  const ipKey = await callerKey("login");
  const accountGate = peek(accountKey, LIMITS.loginPerAccount.limit);
  const ipGate = peek(ipKey, LIMITS.loginPerIp.limit);
  if (!accountGate.ok || !ipGate.ok) {
    const wait = Math.ceil(Math.max(accountGate.retryAfter, ipGate.retryAfter) / 60);
    return { error: `Trop de tentatives de connexion. Réessayez dans ${wait} minute(s).` };
  }

  const fail = () => {
    hit(accountKey, LIMITS.loginPerAccount.limit, LIMITS.loginPerAccount.windowMs);
    hit(ipKey, LIMITS.loginPerIp.limit, LIMITS.loginPerIp.windowMs);
    // Identical message either way: naming which half was wrong tells an
    // attacker which emails have accounts.
    return { error: "Email ou mot de passe incorrect" };
  };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return fail();

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return fail();

  // A correct password clears the account's budget: a customer who fumbled
  // their password twice and then got it right starts clean.
  clear(accountKey);
  await createSession({ userId: user.id, role: user.role });
  redirect(user.role === "ADMIN" ? "/admin" : "/compte");
}

export async function logout() {
  await destroySession();
  redirect("/");
}
