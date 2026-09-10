"use client";

import { useState } from "react";
import { submitReview } from "@/app/actions/reviews";

/**
 * The form a customer writes a review in.
 *
 * Only rendered for somebody who has taken delivery of this exact part — the
 * page checks that before it renders this, and `submitReview` checks it again
 * on the server, because a component deciding who may post is a decision made
 * in the browser.
 *
 * Says plainly that the review is read before it appears. A customer who
 * writes something and then cannot find it assumes the site swallowed it, and
 * the honest version of that costs one sentence.
 */
export default function ReviewForm({ productId }: { productId: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Choisissez une note.");
      return;
    }
    setState("sending");
    setError(null);
    const result = await submitReview({ productId, rating, comment });
    if (result.ok) {
      setState("sent");
    } else {
      setState("idle");
      setError(result.error);
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-xl border border-green-300 bg-green-50 p-4">
        <p className="text-sm font-semibold text-green-900">Merci — votre avis est enregistré.</p>
        <p className="text-sm text-green-800 mt-1">
          Il apparaîtra sur cette page une fois relu par la boutique.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="font-heading font-extrabold uppercase tracking-tight text-navy-950">
        Vous avez acheté cette pièce
      </p>
      <p className="text-sm text-slate-500 mt-0.5 mb-3">
        Votre avis aide les autres clients à choisir. Il est relu avant publication.
      </p>

      {/* Radios rather than clickable stars: a star widget built from divs is
          invisible to a keyboard and to a screen reader, and this is the one
          control on the page a customer must be able to operate. The visual
          star is the label; the input underneath it is real. */}
      <fieldset className="mb-3">
        <legend className="text-xs font-display font-bold uppercase tracking-wide text-slate-500 mb-1.5">
          Votre note
        </legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className="cursor-pointer"
              title={`${n} sur 5`}
            >
              <input
                type="radio"
                name="rating"
                value={n}
                checked={rating === n}
                onChange={() => setRating(n)}
                className="sr-only peer"
              />
              <span
                className={`grid place-items-center w-11 h-11 rounded-lg text-xl transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-navy-900 ${
                  n <= rating ? "text-gold-500" : "text-slate-300 hover:text-gold-400"
                }`}
              >
                ★<span className="sr-only">{n} sur 5</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-xs font-display font-bold uppercase tracking-wide text-slate-500">
          Votre avis
        </span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={1500}
          required
          minLength={10}
          placeholder="Montage, qualité, durée de vie — ce qui vous aurait été utile avant d'acheter."
          // 16px so iOS does not zoom the page when it takes focus.
          className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-300 text-base outline-none focus:border-navy-700"
        />
      </label>

      {error && <p className="text-sm text-red-700 mt-2">{error}</p>}

      <button
        type="submit"
        disabled={state === "sending"}
        className="mt-3 inline-flex items-center min-h-tap px-5 rounded-xl bg-navy-900 enabled:hover:bg-navy-800 disabled:opacity-60 text-white font-display font-bold uppercase text-xs tracking-wide transition-colors"
      >
        {state === "sending" ? "Envoi…" : "Publier mon avis"}
      </button>
    </form>
  );
}
