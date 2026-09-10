"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { hit, callerKey, LIMITS } from "@/lib/rate-limit";
import { checkForm } from "@/lib/bot-check";
import { sendMail } from "@/lib/email";
import { passwordResetMail } from "@/lib/email-templates";
import { loadShopForEmail } from "@/lib/order-emails";
import { siteUrl } from "@/lib/site";
import { findValidResetToken, hashResetToken, newResetToken, RESET_TOKEN_TTL_MS } from "@/lib/password-reset";

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

  const user = await prisma.user.findUnique({
    where: { email: parsed.data },
    select: { id: true, name: true, email: true },
  });
  if (!user) return { sent: true };

  const token = newResetToken();
  await prisma.$transaction([
    // One live link per account. A second request replaces the first rather
    // than leaving two working links in two inboxes.
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    }),
  ]);

  const shop = await loadShopForEmail();
  const mail = passwordResetMail(user, `${siteUrl()}/compte/reinitialiser/${token}`, shop);
  // sendMail never throws and logs its own failures with the subject, which
  // carries no token. Whatever happened, the customer sees the same screen.
  await sendMail(mail);
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
  ]);

  // Signed in on this device only: somebody resetting a password from a
  // borrowed phone should not leave a thirty-day session on it.
  await createSession({ userId: row.user.id, role: row.user.role }, { remember: false });
  redirect(row.user.role === "ADMIN" ? "/admin" : "/compte");
}
