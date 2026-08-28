"use client";

import { useTransition } from "react";
import { togglePromotion, deletePromotion } from "@/app/actions/admin";

export default function PromotionRow({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        disabled={pending}
        onClick={() => startTransition(() => void togglePromotion(id, !active))}
        className={`min-h-tap px-3 rounded-lg text-xs font-display font-bold uppercase tracking-wide disabled:opacity-50 ${
          active ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-100 text-gray-500 border border-gray-200"
        }`}
      >
        {active ? "Active" : "Inactive"}
      </button>
      <button
        disabled={pending}
        onClick={() => {
          if (confirm("Supprimer cette bannière ?")) {
            startTransition(() => void deletePromotion(id));
          }
        }}
        aria-label="Supprimer"
        className="w-tap h-tap flex items-center justify-center rounded-lg border border-navy-900/10 text-gray-400 hover:text-red-600 hover:border-red-200 disabled:opacity-50"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
        </svg>
      </button>
    </div>
  );
}
