"use client";

import { useState, useTransition } from "react";
import { setFitment } from "@/app/actions/vehicles";

/**
 * One lead in the confirmation queue: the shop checks the reference and
 * says yes (the row becomes VERIFIED — "Compatible" in the app) or no (the
 * row goes). Either way it leaves the queue for good.
 */
export default function FitmentQueueActions({ productId, engineId }: { productId: string; engineId: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = (fits: boolean) =>
    start(async () => {
      setError(null);
      const r = await setFitment(productId, engineId, fits);
      if (r?.error) setError(r.error);
      else setDone(fits ? "Confirmée" : "Retirée");
    });

  if (done) return <span className="text-xs font-semibold text-navy-900/60">{done}</span>;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => decide(true)}
          className="min-h-tap px-3 rounded-lg bg-green-700 text-white text-xs font-bold uppercase tracking-wide disabled:opacity-50"
        >
          Confirmer
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => decide(false)}
          className="min-h-tap px-3 rounded-lg border border-gray-300 text-navy-900 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
        >
          Ne va pas
        </button>
      </div>
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </div>
  );
}
