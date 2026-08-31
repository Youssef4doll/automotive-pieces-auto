"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hit, callerKey, LIMITS } from "@/lib/rate-limit";
import { checkForm } from "@/lib/bot-check";

const emailSchema = z.email();

export type NewsletterState = { ok?: boolean; error?: string } | undefined;

export async function subscribeNewsletter(
  _prev: NewsletterState,
  formData: FormData
): Promise<NewsletterState> {
  // Reported as success: a spam script that learns it was blocked adapts, and
  // the subscriber list is the thing being protected, not the message.
  if (!checkForm(formData, { useTiming: true }).human) return { ok: true };

  const gate = hit(await callerKey("newsletter"), LIMITS.newsletter.limit, LIMITS.newsletter.windowMs);
  if (!gate.ok) return { error: "Trop de tentatives. Réessayez plus tard." };

  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { error: "Email invalide" };
  }
  await prisma.newsletterSubscriber.upsert({
    where: { email: parsed.data },
    update: {},
    create: { email: parsed.data },
  });
  return { ok: true };
}
