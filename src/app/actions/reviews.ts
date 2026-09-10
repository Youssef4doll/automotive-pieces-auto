"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireAdmin } from "@/lib/session";
import { hit, callerKey, LIMITS } from "@/lib/rate-limit";

/**
 * Reviews, from people who actually bought the part.
 *
 * The shop has none, and the way most shops get their first ones is by
 * letting anybody type into a box — which is how you end up moderating spam
 * for a living and how a star rating stops meaning anything. Two gates
 * instead:
 *
 *  1. **You must have bought it.** Not "have an account", not "clicked a
 *     link in an email" — there has to be a DELIVERED order on this account
 *     containing this product. That is checked against the order history on
 *     the server every time, and it is what sets `verified`. A shopper who
 *     has not bought the part is never shown the form in the first place, and
 *     posting to this action directly still fails.
 *  2. **A person reads it before the public does.** `published` defaults to
 *     false; /admin/avis is the queue. An unattended queue costs the shop
 *     reviews nobody sees, which is recoverable. The other way round is not.
 *
 * Every export in a "use server" file is its own endpoint, so both checks live
 * here rather than in the component that renders the form.
 */

const reviewSchema = z.object({
  productId: z.string().min(1).max(64),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(10).max(1500),
});

export type ReviewResult = { ok: true } | { ok: false; error: string };

/** Has this account taken delivery of this product? The answer decides both
 *  whether a review may be written and whether it is marked verified. */
export async function hasPurchased(userId: string, productId: string): Promise<boolean> {
  const item = await prisma.orderItem.findFirst({
    where: { productId, order: { userId, status: "DELIVERED" } },
    select: { id: true },
  });
  return item !== null;
}

export async function submitReview(input: unknown): Promise<ReviewResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Connectez-vous pour laisser un avis." };

  // A signed-in customer is not a reason to skip the limiter: an account is
  // cheap to make and this writes a row the public eventually reads.
  const gate = hit(await callerKey("review"), LIMITS.checkout.limit, LIMITS.checkout.windowMs);
  if (!gate.ok) {
    return { ok: false, error: "Trop d'avis envoyés coup sur coup. Réessayez plus tard." };
  }

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error:
        issue?.path[0] === "comment"
          ? "Votre avis doit faire au moins 10 caractères."
          : "Note invalide.",
    };
  }
  const { productId, rating, comment } = parsed.data;

  if (!(await hasPurchased(user.id, productId))) {
    // Deliberately the same wording whether the product does not exist, was
    // never ordered, or has not been delivered yet: this endpoint should not
    // become a way to ask what somebody else's order contains.
    return { ok: false, error: "Seuls les clients ayant reçu cette pièce peuvent la noter." };
  }

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { slug: true } });
  if (!product) return { ok: false, error: "Cette pièce n'existe plus." };

  try {
    await prisma.review.create({
      data: {
        productId,
        userId: user.id,
        authorName: user.name,
        rating,
        comment,
        // Earned, not claimed: hasPurchased above is the only thing that can
        // set this, and the form cannot send it.
        verified: true,
        published: false,
      },
    });
  } catch (e) {
    // The unique index is the real guard against a doubled submit; catching
    // it here turns a 500 into a sentence.
    if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002") {
      return { ok: false, error: "Vous avez déjà laissé un avis sur cette pièce." };
    }
    throw e;
  }

  revalidatePath(`/produit/${product.slug}`);
  return { ok: true };
}

/* --------------------------------------------------------------- admin --- */

async function assertAdmin() {
  const admin = await requireAdmin();
  if (!admin) throw new Error("Non autorisé");
  return admin;
}

/** Publish a review, or take a published one back down. */
export async function setReviewPublished(reviewId: string, published: boolean) {
  await assertAdmin();
  const review = await prisma.review.update({
    where: { id: reviewId },
    data: { published },
    select: { product: { select: { slug: true } } },
  });
  revalidatePath("/admin/avis");
  revalidatePath(`/produit/${review.product.slug}`);
}

/** Remove one outright — for the genuinely abusive, not for the merely
 *  critical. A shop that deletes its bad reviews has a rating that means
 *  nothing, which is the thing reviews were added to avoid. */
export async function deleteReview(reviewId: string) {
  await assertAdmin();
  const review = await prisma.review.delete({
    where: { id: reviewId },
    select: { product: { select: { slug: true } } },
  });
  revalidatePath("/admin/avis");
  revalidatePath(`/produit/${review.product.slug}`);
}
