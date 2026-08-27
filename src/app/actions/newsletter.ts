"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";

const emailSchema = z.email();

export type NewsletterState = { ok?: boolean; error?: string } | undefined;

export async function subscribeNewsletter(
  _prev: NewsletterState,
  formData: FormData
): Promise<NewsletterState> {
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
