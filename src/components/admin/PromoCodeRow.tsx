"use client";

import { useState, useTransition } from "react";
import { deletePromoCode, setPromoCodeActive } from "@/app/actions/promo-codes";

/** On/off and delete for one code; the figures beside them are the server page's. */
export default function PromoCodeActions({ id, active, used }: { id: string; active: boolean; used: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => setPromoCodeActive(id, !active))}
          className="text-xs font-semibold underline underline-offset-2 disabled:opacity-50"
        >
          {active ? "Désactiver" : "Réactiver"}
        </button>
        {used === 0 && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                if (!confirm("Supprimer ce code ?")) return;
                const r = await deletePromoCode(id);
                setError(r.error ?? null);
              })
            }
            className="text-xs font-semibold text-red-600 underline underline-offset-2 disabled:opacity-50"
          >
            Supprimer
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
