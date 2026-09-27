"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { normalizeCode, promoFormProblem, type PromoKind } from "@/lib/promo-rules";

export type PromoCodeFormState = { error?: string; ok?: string } | undefined;

async function assertAdmin() {
  const admin = await requireAdmin();
  if (!admin) throw new Error("Non autorisé");
  return admin;
}

/** "" → null, "12,5" → 12.5; anything else unreadable → NaN, which the checks refuse. */
function num(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim().replace(",", ".");
  return s === "" ? null : Number(s);
}

/** A date input's "2026-10-01", read as the start (or end) of that day in Tunis. */
function day(v: FormDataEntryValue | null, end: boolean): Date | null {
  const s = String(v ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T${end ? "23:59:59" : "00:00:00"}+01:00`);
}

/**
 * A new code. Checked by the same rules the admin sees in the form's hints
 * (lib/promo-rules), and never edited afterwards except on/off: an order
 * records the code it used, and a code whose value changed under past orders
 * would make those orders unreadable.
 */
export async function createPromoCode(_prev: PromoCodeFormState, formData: FormData): Promise<PromoCodeFormState> {
  await assertAdmin();
  const kind = String(formData.get("kind")) === "AMOUNT" ? "AMOUNT" : ("PERCENT" as PromoKind);
  const input = {
    code: normalizeCode(String(formData.get("code") ?? "")),
    kind,
    value: num(formData.get("value")) ?? 0,
    minSubtotal: num(formData.get("minSubtotal")),
    startsAt: day(formData.get("startsAt"), false),
    endsAt: day(formData.get("endsAt"), true),
    maxUses: num(formData.get("maxUses")),
  };
  if (input.minSubtotal != null && !Number.isFinite(input.minSubtotal)) return { error: "Le montant minimum n'est pas un nombre." };
  const problem = promoFormProblem(input);
  if (problem) return { error: problem };
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || null;
  try {
    await prisma.promoCode.create({ data: { ...input, note } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: `Le code ${input.code} existe déjà.` };
    throw e;
  }
  revalidatePath("/admin/codes-promo");
  return { ok: `Code ${input.code} créé.` };
}

export async function setPromoCodeActive(id: string, active: boolean) {
  await assertAdmin();
  await prisma.promoCode.update({ where: { id }, data: { active } });
  revalidatePath("/admin/codes-promo");
}

/** Only a code no order has used: past orders keep pointing at the ones that were. */
export async function deletePromoCode(id: string): Promise<{ error?: string }> {
  await assertAdmin();
  const used = await prisma.order.count({ where: { promoCodeId: id } });
  if (used > 0) return { error: "Ce code a servi sur des commandes : désactivez-le plutôt." };
  await prisma.promoCode.delete({ where: { id } });
  revalidatePath("/admin/codes-promo");
  return {};
}
