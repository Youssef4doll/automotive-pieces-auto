"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

/**
 * Marking a contact message dealt with, from the shop's inbox.
 *
 * There is no "replied" state and no reply box here on purpose: the answer
 * goes out by e-mail or WhatsApp, outside this table, and a status the shop
 * cannot keep true is worse than one it can. HANDLED means somebody in the
 * shop has read it and done whatever it needed.
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
