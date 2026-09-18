"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { lookupGuestOrder } from "@/app/actions/orders";
import { IconAlert } from "@/components/icons";

/**
 * Order number plus the phone that was given at checkout.
 *
 * The reference alone cannot open an order — they are sequential and printed
 * on the confirmation page, which is why `order-access.ts` exists at all. The
 * phone is the part a guesser would have to work for.
 *
 * On success the server has already written this browser's order cookie, so
 * the ordinary confirmation page takes over from here: the tracker, the
 * totals and the printable document all work exactly as they do straight
 * after checkout.
 *
 * The failure message is the same whatever went wrong. A form that said "that
 * reference exists, but the number is wrong" would be a way to discover which
 * references are real, one request at a time.
 */
export default function GuestOrderLookup() {
  const router = useRouter();
  const [ref, setRef] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await lookupGuestOrder(ref, phone);
    if (result.ok) {
      router.push(`/commande/confirmation/${result.ref}`);
      return;
    }
    setError(result.error);
    setBusy(false);
  }

  const FIELD =
    "w-full min-h-tap rounded-xl border border-gray-300 bg-white px-3.5 text-base text-navy-950 outline-none focus:border-navy-900";

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5">
      <label className="flex flex-col gap-1.5">
        <span className="font-display text-[12px] font-bold uppercase tracking-wide text-gray-600">
          Numéro de commande
        </span>
        <input
          name="ref"
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          required
          autoComplete="off"
          spellCheck={false}
          dir="ltr"
          placeholder="CMD-1042"
          className={`${FIELD} font-mono uppercase`}
        />
        <span className="text-xs text-gray-500">
          Il est sur votre page de confirmation et dans l&apos;e-mail si vous nous en avez donné un.
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-display text-[12px] font-bold uppercase tracking-wide text-gray-600">
          Téléphone donné à la commande
        </span>
        {/* `tel` so a phone offers its number pad, and 16px so iOS does not
            zoom the page when it is tapped. */}
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          dir="ltr"
          placeholder="20 445 566"
          className={FIELD}
        />
      </label>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      <button
        disabled={busy}
        className="min-h-tap-primary rounded-xl bg-gold-500 px-5 font-display font-bold uppercase tracking-wide text-navy-950 transition-colors hover:bg-gold-400 disabled:opacity-60"
      >
        {busy ? "Recherche…" : "Voir ma commande"}
      </button>
    </form>
  );
}
