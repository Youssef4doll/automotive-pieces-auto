"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setReviewPublished, deleteReview } from "@/app/actions/reviews";

/**
 * Publish, unpublish, delete.
 *
 * Delete asks first, and says what it means: an unpublished review is still
 * in the database and can be put back, a deleted one is gone. The two are one
 * click apart on the same row, so the difference has to be stated rather than
 * implied by the button colour.
 */
export default function ReviewModeration({ id, published }: { id: string; published: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => setReviewPublished(id, !published))}
        className={`px-3 py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wide border disabled:opacity-50 ${
          published
            ? "border-navy-900/15 text-navy-900/60 hover:border-navy-900/40"
            : "bg-navy-900 text-white border-navy-900 hover:bg-navy-800"
        }`}
      >
        {published ? "Retirer de la fiche" : "Publier"}
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          // A shop deleting reviews it merely dislikes ends up with a rating
          // that means nothing, which is the thing reviews exist to avoid.
          // The wording is the guard.
          if (confirm("Supprimer définitivement cet avis ? Pour le masquer sans le perdre, utilisez « Retirer de la fiche ».")) {
            run(() => deleteReview(id));
          }
        }}
        className="px-3 py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wide border border-red-200 text-red-600 hover:border-red-500 disabled:opacity-50"
      >
        Supprimer
      </button>
    </div>
  );
}
