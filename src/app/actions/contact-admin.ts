"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { MAX_REPLY, replyToQuestion } from "@/lib/questions";

/**
 * Marking a contact message dealt with, from the shop's inbox.
 *
 * A message from the website's contact form is answered by e-mail or
 * WhatsApp, outside this table; HANDLED means somebody in the shop has read
 * it and done whatever it needed. A question asked from the app can also be
 * answered in writing (`replyToMessage`), because the app shows the answer
 * to the asker — there the reply is the record, so it is kept true.
 */
export async function setMessageHandled(id: string, handled: boolean) {
  // Guarded here as well as in the layout: a Server Action is a public
  // endpoint, and the page it happens to be rendered on is not a permission.
  const admin = await requireAdmin();
  if (!admin) return { ok: false as const, error: "Non autorisé" };

  await prisma.contactMessage.update({
    where: { id },
    data: { status: handled ? "HANDLED" : "NEW", handledAt: handled ? new Date() : null },
  });
  revalidatePath("/admin/messages");
  return { ok: true as const };
}

/** A written answer to a question asked from the app (lib/questions). */
export async function replyToMessage(id: string, reply: string) {
  const admin = await requireAdmin();
  if (!admin) return { ok: false as const, error: "Non autorisé" };
  if (!reply.trim()) return { ok: false as const, error: "La réponse est vide." };
  if (reply.length > MAX_REPLY) return { ok: false as const, error: `${MAX_REPLY} caractères au plus.` };
  const done = await replyToQuestion(id, reply);
  if (!done.ok) {
    return {
      ok: false as const,
      error: done.error === "not_in_app" ? "Ce message ne vient pas de l'application : répondez par e-mail ou WhatsApp." : "Message introuvable.",
    };
  }
  revalidatePath("/admin/messages");
  return { ok: true as const };
}
