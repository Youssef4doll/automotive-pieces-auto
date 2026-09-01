"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { togglePromotion, deletePromotion, movePromotion } from "@/app/actions/admin";
import PromotionForm, { type EditablePromotion } from "./PromotionForm";

const KIND_LABEL: Record<NonNullable<EditablePromotion["kind"]>, string> = {
  SEASONAL: "Campagne de saison",
  NEW_ARRIVALS: "Nouveautés",
  DEAL: "Bon plan",
};

/**
 * One banner in the admin list: what it looks like, where it shows, and every
 * action that can be taken on it.
 *
 * Editing happens in place rather than on a separate page — replacing the
 * artwork of a live campaign is the most common job here, and it should not
 * cost a navigation or force the shop to delete and rebuild the banner.
 */
export default function PromotionCard({
  promo,
  isFirst,
  isLast,
}: {
  promo: EditablePromotion;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  return (
    <div data-promo={promo.id} className="rounded-xl border border-navy-900/10 bg-white shadow-sm">
      <div className="p-3 flex items-center gap-4">
        <div className="relative w-32 h-16 shrink-0 rounded-lg overflow-hidden bg-gray-100">
          <Image src={promo.imageUrl} alt="" fill sizes="128px" className="object-cover" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-navy-950 truncate">{promo.title}</p>
          <p className="text-xs text-navy-900/45 truncate">
            {promo.kind ? KIND_LABEL[promo.kind] : "Bandeau du haut"} · {promo.href || "sans lien"}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            disabled={pending || isFirst}
            onClick={() => startTransition(() => void movePromotion(promo.id, "up"))}
            aria-label="Monter"
            className="w-tap h-tap flex items-center justify-center rounded-lg border border-navy-900/10 text-navy-900/50 hover:text-navy-950 disabled:opacity-25"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M6 15l6-6 6 6" />
            </svg>
          </button>
          <button
            disabled={pending || isLast}
            onClick={() => startTransition(() => void movePromotion(promo.id, "down"))}
            aria-label="Descendre"
            className="w-tap h-tap flex items-center justify-center rounded-lg border border-navy-900/10 text-navy-900/50 hover:text-navy-950 disabled:opacity-25"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          <button
            disabled={pending}
            onClick={() => startTransition(() => void togglePromotion(promo.id, !promo.active))}
            className={`min-h-tap px-3 rounded-lg text-xs font-display font-bold uppercase tracking-wide disabled:opacity-50 ${
              promo.active
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-gray-100 text-gray-500 border border-gray-200"
            }`}
          >
            {promo.active ? "Active" : "Inactive"}
          </button>

          <button
            onClick={() => setEditing((v) => !v)}
            aria-expanded={editing}
            className="min-h-tap px-3 rounded-lg text-xs font-display font-bold uppercase tracking-wide border border-navy-900/15 text-navy-900/70 hover:text-navy-950"
          >
            {editing ? "Fermer" : "Modifier"}
          </button>

          <button
            disabled={pending}
            onClick={() => {
              if (confirm("Supprimer cette bannière ?")) {
                startTransition(() => void deletePromotion(promo.id));
              }
            }}
            aria-label="Supprimer"
            className="w-tap h-tap flex items-center justify-center rounded-lg border border-navy-900/10 text-gray-600 hover:text-red-600 hover:border-red-200 disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
            </svg>
          </button>
        </div>
      </div>

      {editing && (
        <div className="border-t border-navy-900/10 p-4 bg-gray-50/60">
          <PromotionForm promo={promo} onSaved={() => setEditing(false)} />
        </div>
      )}
    </div>
  );
}
