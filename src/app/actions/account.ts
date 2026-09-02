"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { hit, clear, callerKey, LIMITS } from "@/lib/rate-limit";

export type AccountState = { ok?: boolean; error?: string; message?: string } | undefined;

/** Same cost factor the signup path uses — see src/app/actions/auth.ts. */
const BCRYPT_COST = 12;

const profileSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères").max(80),
  email: z.email("Email invalide"),
  // Optional because the column is: an account created before the phone field
  // was required should not be blocked from editing its name.
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v === "" || v.length >= 6, "Numéro de téléphone invalide"),
});

/**
 * Self-service edit of the three fields the User row actually stores.
 *
 * Everything else on the profile page (the delivery address, the vehicles) is
 * owned by another table and is edited where it lives, so it is not offered
 * here — a form that pretends to save a field nobody persists is worse than no
 * form at all.
 */
export async function updateProfile(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Session expirée. Reconnectez-vous." };

  // "Un compte existe déjà avec cet email" is a truthful answer to a real
  // customer and an oracle to anyone scripting it: submit an address, learn
  // whether it has an account here. Signup answers the same question, so the
  // fix is a budget rather than a vaguer message — nobody edits their profile
  // twenty times an hour, and a script cannot walk a mailing list through it.
  const gate = hit(await callerKey(`profile:${user.id}`), 20, 60 * 60_000);
  if (!gate.ok) {
    return { error: `Trop de modifications. Réessayez dans ${Math.ceil(gate.retryAfter / 60)} minute(s).` };
  }

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Champs invalides" };

  const { name, email, phone } = parsed.data;

  // The email is the login identifier and is unique in the schema. Checking
  // first turns a 500 into a sentence the customer can act on.
  if (email !== user.email) {
    const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (taken && taken.id !== user.id) return { error: "Un compte existe déjà avec cet email" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name, email, phone: phone === "" ? null : phone },
  });

  revalidatePath("/compte/profil");
  revalidatePath("/compte");
  return { ok: true, message: "Informations enregistrées." };
}

const passwordSchema = z.object({
  current: z.string().min(1, "Entrez votre mot de passe actuel"),
  next: z.string().min(6, "Le nouveau mot de passe doit contenir au moins 6 caractères"),
  confirm: z.string(),
});

/**
 * Changing the password requires the current one. Without that check, anyone
 * who finds an unlocked phone with a live session can lock the real owner out
 * of their own account.
 */
export async function changePassword(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Session expirée. Reconnectez-vous." };

  // Reuses the login budget deliberately: this form verifies a password, so it
  // is a password-guessing surface like the login form is.
  const key = await callerKey(`pwchange:${user.id}`);
  const gate = hit(key, LIMITS.loginPerAccount.limit, LIMITS.loginPerAccount.windowMs);
  if (!gate.ok) {
    return { error: `Trop de tentatives. Réessayez dans ${Math.ceil(gate.retryAfter / 60)} minute(s).` };
  }

  const parsed = passwordSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  const { current, next, confirm } = parsed.data;

  if (next !== confirm) return { error: "Les deux mots de passe ne correspondent pas" };

  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row) return { error: "Session expirée. Reconnectez-vous." };
  if (!(await bcrypt.compare(current, row.passwordHash))) {
    return { error: "Mot de passe actuel incorrect" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, BCRYPT_COST) },
  });
  clear(key);

  return { ok: true, message: "Mot de passe modifié." };
}
