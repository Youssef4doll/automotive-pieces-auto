"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { withdrawReturn } from "@/app/actions/returns";

/** Withdraw a request the shop has not answered yet — asked twice, it cannot be undone. */
export default function WithdrawReturnButton({ orderRef, returnRef }: { orderRef: string; returnRef: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sure, setSure] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!sure) return setSure(true);
          start(async () => {
            const done = await withdrawReturn(orderRef, returnRef);
            setFailed(!done);
            setSure(false);
            router.refresh();
          });
        }}
        className="min-h-tap px-4 rounded-xl border border-slate-300 text-sm font-semibold text-navy-900 hover:border-navy-700 disabled:opacity-50"
      >
        {sure ? "Confirmer l'annulation de la demande" : "Annuler la demande"}
      </button>
      {failed && <span role="alert" className="text-sm text-red-600">La boutique a déjà répondu : la demande ne peut plus être annulée.</span>}
    </div>
  );
}
