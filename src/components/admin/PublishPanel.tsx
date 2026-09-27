"use client";

import { useState, useTransition } from "react";
import { setPublished } from "@/app/actions/admin";
import type { PublishCheck } from "@/lib/publish-checks";

/**
 * Before a part goes on sale: what customers will see, and what is wrong
 * with it. The preview is the storefront card as it will render — photo or
 * the family's illustration, brand, name, price — so the admin looks at the
 * product, not at a form, before publishing.
 */
export default function PublishPanel({
  productId,
  active,
  checks,
  preview,
  fresh,
}: {
  productId: string;
  active: boolean;
  checks: PublishCheck[];
  preview: { name: string; brand: string | null; price: string; imageUrl: string; illustration: boolean; sku: string };
  fresh: boolean;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const blocking = checks.filter((c) => c.blocking);
  const soft = checks.filter((c) => !c.blocking);

  const toggle = (on: boolean) =>
    start(async () => {
      const res = await setPublished(productId, on);
      setMessage(res.error ? { tone: "error", text: res.error } : { tone: "ok", text: res.ok ?? "" });
    });

  return (
    <section id="publication" aria-labelledby="publication-title" className="flex flex-col gap-4 sm:flex-row">
      <div className="w-full max-w-[220px] shrink-0 overflow-hidden rounded-xl border border-navy-900/10 bg-white shadow-sm">
        <div className="relative flex h-40 items-center justify-center bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element -- an admin preview of exactly the stored image */}
          <img src={preview.imageUrl} alt="" className="max-h-36 max-w-[90%] object-contain" />
          {preview.illustration && (
            <span className="absolute bottom-2 end-2 rounded bg-navy-900/70 px-1.5 py-0.5 text-[10px] text-white">Illustration</span>
          )}
        </div>
        <div className="p-3">
          {preview.brand && <p className="text-[11px] font-bold uppercase tracking-wide text-red-600">{preview.brand}</p>}
          <p className="line-clamp-2 text-sm font-semibold text-navy-950">{preview.name}</p>
          <p className="mt-1 font-heading text-lg font-extrabold text-navy-950">{preview.price}</p>
          <p className="font-mono text-[11px] text-navy-900/40">{preview.sku}</p>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <h2 id="publication-title" className="text-xs font-display font-bold uppercase tracking-wide text-navy-900/45">
          Aperçu et mise en vente
        </h2>
        {fresh && !active && (
          <p className="text-sm text-navy-900/70">Le produit est enregistré hors ligne. Vérifiez l&apos;aperçu, puis publiez-le.</p>
        )}
        <p className={`text-sm font-semibold ${active ? "text-green-700" : "text-amber-700"}`}>
          {active ? "En vente — visible des clients." : "Hors ligne — invisible des clients."}
        </p>
        {blocking.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm text-red-700">
            {blocking.map((c) => (
              <li key={c.key}>✕ {c.message}</li>
            ))}
          </ul>
        )}
        {soft.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm text-amber-800">
            {soft.map((c) => (
              <li key={c.key}>! {c.message}</li>
            ))}
          </ul>
        )}
        {checks.length === 0 && <p className="text-sm text-green-700">✓ Prix, marque et photo en ordre.</p>}
        <div className="flex flex-wrap gap-2">
          {active ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => toggle(false)}
              className="min-h-tap-compact rounded-lg border border-navy-900/20 px-4 text-xs font-display font-bold uppercase tracking-wide text-navy-900 disabled:opacity-50"
            >
              Retirer de la vente
            </button>
          ) : (
            <button
              type="button"
              disabled={pending || blocking.length > 0}
              onClick={() => toggle(true)}
              className="min-h-tap-compact rounded-lg bg-gold-500 px-4 text-xs font-display font-bold uppercase tracking-wide text-navy-950 disabled:opacity-50"
            >
              {soft.some((c) => c.key === "photo") ? "Publier sans photo" : "Publier"}
            </button>
          )}
        </div>
        {message && <p className={`text-sm ${message.tone === "error" ? "text-red-600" : "text-green-700"}`}>{message.text}</p>}
      </div>
    </section>
  );
}
