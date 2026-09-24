"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { hit, callerKey, LIMITS } from "@/lib/rate-limit";
import { checkForm } from "@/lib/bot-check";
import { findValidResetToken, startPasswordReset } from "@/lib/password-reset";

/**
 * "Mot de passe oublié ?" — the two halves of it.
 *
 * The request half answers the same way whether or not the address has an
 * account. Saying "no account with that e-mail" would let anybody type
 * addresses into the form to learn who shops here, and a parts shop's
 * customer list is nobody's business.
 */

export type ResetRequestState = { sent?: boolean; error?: string } | undefined;

export async function requestPasswordReset(_prev: ResetRequestState, formData: FormData): Promise<ResetRequestState> {
  // A bot gets the success screen and nothing else. Telling it what it
  // tripped only teaches it what to change.
  if (!checkForm(formData).human) return { sent: true };

  const gate = hit(await callerKey("pwreset"), LIMITS.passwordReset.limit, LIMITS.passwordReset.windowMs);
  if (!gate.ok) {
    return { error: `Trop de demandes. Réessayez dans ${Math.ceil(gate.retryAfter / 60)} minute(s).` };
  }

  const parsed = z.email().safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Adresse e-mail invalide" };

  await startPasswordReset(parsed.data);
  return { sent: true };
}

const resetSchema = z
  .object({
    token: z.string().min(20),
    password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Les deux mots de passe ne correspondent pas", path: ["confirm"] });

export type ResetState = { error?: string } | undefined;

export async function resetPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Champs invalides" };

  const row = await findValidResetToken(parsed.data.token);
  if (!row) return { error: "Ce lien n'est plus valable. Demandez-en un nouveau." };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    // A reset is what somebody does when they think the password is known to
    // someone else. Every phone signed in with the old one is signed out.
    prisma.customerSession.deleteMany({ where: { userId: row.userId } }),
    prisma.adminSession.deleteMany({ where: { userId: row.userId } }),
  ]);

  // Signed in on this device only: somebody resetting a password from a
  // borrowed phone should not leave a thirty-day session on it.
  await createSession({ userId: row.user.id, role: row.user.role }, { remember: false });
  redirect(row.user.role === "ADMIN" ? "/admin" : "/compte");
}
