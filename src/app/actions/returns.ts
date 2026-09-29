"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getCurrentUser } from "@/lib/session";
import { placedInThisBrowser } from "@/lib/order-access";
import { callerKey, hit, LIMITS, peek } from "@/lib/rate-limit";
import { MAX_IMAGE_BYTES, sniffMime } from "@/lib/image-upload";
import { cancelReturn, createReturn, moveReturn, returnInput, returnMove, type ReturnMove } from "@/lib/returns";
import { MAX_RETURN_PHOTOS } from "@/lib/returns-rules";

/**
 * Returns from the website: the customer's side on their order page, the
 * shop's side in /admin/retours. Every export here is an endpoint in its own
 * right ("use server"), so each one checks who is calling before it reads
 * anything — the page that renders the form is not the guard.
 */

/** The order this browser may act on: its owner signed in, or the browser that placed or looked it up. */
async function orderForBrowser(ref: string): Promise<string | null> {
  const order = await prisma.order.findUnique({ where: { ref }, select: { id: true, userId: true } });
  if (!order) return null;
  const user = await getCurrentUser();
  if (user && order.userId === user.id) return order.id;
  if (await placedInThisBrowser(order.id)) return order.id;
  return null;
}

export type FileReturnResult = { ok: true; returnRef: string } | { ok: false; error: string };

const PROBLEM_TEXT: Record<string, string> = {
  closed: "Le délai pour ce motif est passé.",
  no_items: "Choisissez au moins une pièce à retourner.",
  qty: "Cette quantité n'est plus disponible pour un retour.",
  photo_required: "Ajoutez au moins une photo de la pièce : elle est demandée pour ce motif.",
  unmounted_required: "Confirmez que la pièce n'a pas été montée et qu'elle est dans son emballage.",
  too_many_photos: `${MAX_RETURN_PHOTOS} photos au plus.`,
  not_delivered: "Un retour se demande une fois la commande livrée.",
};

/** The customer's request, from the website's order page. */
export async function fileReturn(orderRef: string, form: FormData): Promise<FileReturnResult> {
  // Only filed requests count toward the hourly ceiling; attempts have a flood gate of their own.
  const caller = await callerKey("return-request");
  const flood = hit(`${caller}:attempt`, LIMITS.returnAttempt.limit, LIMITS.returnAttempt.windowMs);
  if (!flood.ok || !peek(caller, LIMITS.returnRequest.limit).ok) return { ok: false, error: "Trop de demandes envoyées. Réessayez plus tard." };
  const orderId = await orderForBrowser(orderRef);
  if (!orderId) return { ok: false, error: "Commande introuvable." };

  let json: unknown;
  try {
    json = JSON.parse(String(form.get("request") ?? ""));
  } catch {
    return { ok: false, error: "Formulaire invalide." };
  }
  const parsed = returnInput.safeParse(json);
  if (!parsed.success) return { ok: false, error: "Formulaire invalide." };

  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_RETURN_PHOTOS) return { ok: false, error: PROBLEM_TEXT.too_many_photos };
  const photos: { data: Uint8Array<ArrayBuffer>; mime: string }[] = [];
  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "Une photo dépasse 4 Mo." };
    const data = new Uint8Array(await file.arrayBuffer());
    const mime = sniffMime(data);
    if (!mime || mime === "image/avif") return { ok: false, error: "Photo au format JPEG, PNG ou WebP." };
    photos.push({ data, mime });
  }

  const result = await createReturn(orderId, parsed.data, photos);
  if (!result.ok) return { ok: false, error: PROBLEM_TEXT[result.problem] ?? "La demande n'a pas pu être envoyée." };
  hit(caller, LIMITS.returnRequest.limit, LIMITS.returnRequest.windowMs);
  revalidatePath(`/compte/commandes/${orderRef}`);
  return { ok: true, returnRef: result.ref };
}

/** The customer withdraws a request the shop has not answered. */
export async function withdrawReturn(orderRef: string, returnRef: string): Promise<boolean> {
  const orderId = await orderForBrowser(orderRef);
  if (!orderId) return false;
  const done = await cancelReturn(orderId, returnRef);
  if (done) revalidatePath(`/compte/commandes/${orderRef}`);
  return done;
}

const MOVE_ERROR = {
  not_found: "Demande introuvable.",
  transition: "Cette demande a déjà changé d'état : rechargez la page.",
  refund_amount: "Indiquez le montant remboursé.",
} as const;

/** The shop answers a request, from /admin/retours/[id]. */
export async function adminMoveReturn(id: string, move: ReturnMove): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "Accès refusé." };
  const parsed = returnMove.safeParse(move);
  if (!parsed.success) return { ok: false, error: move?.to === "REFUSED" ? "Écrivez au client pourquoi vous refusez." : "Champs invalides." };
  const result = await moveReturn(id, parsed.data);
  if (!result.ok) return { ok: false, error: MOVE_ERROR[result.problem] };
  revalidatePath(`/admin/retours/${id}`);
  revalidatePath("/admin/retours");
  return { ok: true };
}
