"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

async function assertAdmin() {
  const admin = await requireAdmin();
  if (!admin) throw new Error("Non autorisé");
  return admin;
}

export type CustomerState =
  | { ok?: string; error?: string; values?: Record<string, string> }
  | undefined;

const schema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères").max(80),
  email: z.email("Email invalide"),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v === "" || v.length >= 6, "Numéro de téléphone invalide"),
});

/**
 * The shop correcting a customer's details.
 *
 * Half of this shop's customers give their name over the phone, so the name on
 * the account is as often the shop's typo as the customer's. What it must not
 * do is quietly rewrite the past: an order stores the name it was placed
 * under, and every edit here is filed in UserProfileChange with the admin who
 * made it. The record shows both what the account says now and what it said
 * when each order was taken.
 *
 * The password is deliberately absent. An admin who can set a customer's
 * password can sign in as them, and nothing about correcting a phone number
 * needs that.
 */
export async function adminUpdateCustomer(_prev: CustomerState, formData: FormData): Promise<CustomerState> {
  const admin = await assertAdmin();

  const parsed = schema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Champs invalides",
      values: Object.fromEntries(
        [...formData.entries()].filter(([k, v]) => typeof v === "string" && !k.startsWith("$")),
      ) as Record<string, string>,
    };
  }
  const { id, name, email, phone } = parsed.data;

  const before = await prisma.user.findUnique({
    where: { id },
    select: { name: true, email: true, phone: true, role: true },
  });
  if (!before) return { error: "Client introuvable." };
  if (before.role === "ADMIN") {
    return { error: "Un compte administrateur se modifie depuis son propre profil." };
  }

  if (email !== before.email) {
    const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (taken && taken.id !== id) return { error: "Un autre compte utilise déjà cet email." };
  }

  const changes = [
    { field: "name", oldValue: before.name, newValue: name },
    { field: "email", oldValue: before.email, newValue: email },
    { field: "phone", oldValue: before.phone ?? "", newValue: phone },
  ].filter((c) => c.oldValue !== c.newValue);

  if (changes.length === 0) return { ok: "Rien à modifier." };

  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { name, email, phone: phone === "" ? null : phone },
    }),
    ...changes.map((c) =>
      prisma.userProfileChange.create({
        data: { ...c, userId: id, changedBy: "ADMIN", actorId: admin.id },
      }),
    ),
  ]);

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${id}`);
  return { ok: `${changes.length} champ(s) mis à jour.` };
}

/**
 * Deleting a customer.
 *
 * Refused while they have orders. Their orders are the shop's accounting, and
 * the customer row is what those orders point at — removing it would either
 * cascade the sales away or leave them dangling. A customer who has never
 * ordered is just an abandoned signup and can go.
 */
export async function adminDeleteCustomer(userId: string): Promise<CustomerState> {
  await assertAdmin();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, role: true, _count: { select: { orders: true } } },
  });
  if (!user) return { error: "Client introuvable." };
  if (user.role === "ADMIN") return { error: "Un compte administrateur ne se supprime pas ici." };
  if (user._count.orders > 0) {
    return {
      error: `${user.name} a ${user._count.orders} commande(s). Le compte ne peut pas être supprimé sans effacer cet historique de ventes.`,
    };
  }

  await prisma.cart.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });

  revalidatePath("/admin/clients");
  return { ok: `${user.name} supprimé` };
}
