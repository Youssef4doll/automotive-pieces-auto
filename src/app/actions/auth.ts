"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/session";
import { hit, callerKey, LIMITS } from "@/lib/rate-limit";
import { checkCredentials } from "@/lib/credentials";
import { checkForm } from "@/lib/bot-check";
import { personName, phoneNumber } from "@/lib/validation";
import { claimOrdersForUser } from "./orders";

const signupSchema = z.object({
  // Shared with the checkout — see lib/validation. Both used to be `min(2)`,
  // which is how an account came to be called `ttttt@gmail.com`.
  name: personName,
  email: z.email("Cette adresse e-mail n'est pas valide."),
  phone: phoneNumber,
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères."),
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
  // Ordering first and registering afterwards is an ordinary thing to do on a
  // shop that does not require an account — and the order used to stay a guest
  // order for ever, so "Mes commandes" was empty for somebody who had just
  // bought something. Said out loud on the next page rather than done
  // quietly: the proof is the browser's cookie, and browsers get shared.
  const claimed = await claimOrdersForUser(user.id);
  redirect(claimed > 0 ? `/compte?rattachees=${claimed}` : "/compte");
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

  // The password check, its lockout and its timing are shared with the app's
  // staff sign-in — see lib/credentials — so the two doors spend one budget.
  const checked = await checkCredentials(email, password);
  if (!checked.ok) {
    if (checked.reason === "rate_limited") {
      return { error: `Trop de tentatives de connexion. Réessayez dans ${Math.ceil(checked.retryAfter / 60)} minute(s).` };
    }
    return { error: "Email ou mot de passe incorrect" };
  }
  const user = checked.user;

  // The checkbox is on by default in the form; a form without the field at
  // all (there is none today) would get the short session, which is the safe
  // way round.
  await createSession({ userId: user.id, role: user.role }, { remember: formData.get("remember") === "on" });
  // Signing in counts too, not only registering: somebody who already had an
  // account, checked out without noticing they were signed out, and then
  // signed in is the same situation.
  const claimed = await claimOrdersForUser(user.id);
  if (user.role === "ADMIN") redirect("/admin");
  redirect(claimed > 0 ? `/compte?rattachees=${claimed}` : "/compte");
}

export async function logout() {
  await destroySession();
  redirect("/");
}
