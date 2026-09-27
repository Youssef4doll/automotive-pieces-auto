"use client";

import { useState, useTransition } from "react";
import { addProductLink, removeProductLink } from "@/app/actions/product-links";

type Linked = { id: string; name: string; sku: string; active: boolean };

/**
 * "Souvent achetés ensemble" for one part: a disc with its pads, an oil with
 * its filter. The product page shows these first; parts actually bought
 * together in two or more orders follow on their own.
 */
export default function ProductLinksEditor({ productId, links }: { productId: string; links: Linked[] }) {
  const [sku, setSku] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ error?: string; ok?: string } | undefined>) =>
    start(async () => {
      const res = await fn();
      setMessage(res?.error ? { tone: "error", text: res.error } : res?.ok ? { tone: "ok", text: res.ok } : null);
      if (!res?.error) setSku("");
    });

  return (
    <section aria-labelledby="links" className="flex flex-col gap-3">
      <h2 id="links" className="text-xs font-display font-bold uppercase tracking-wide text-navy-900/45">
        Souvent achetés ensemble
      </h2>
      <p className="text-sm text-gray-600">
        Les pièces à proposer avec celle-ci (plaquettes avec un disque, filtre avec une huile). Les achats réels
        communs, dès deux commandes, s&apos;ajoutent d&apos;eux-mêmes.
      </p>
      {links.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {links.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 rounded-lg border border-navy-900/10 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-semibold text-navy-950">{l.name}</span>{" "}
                <span className="font-mono text-xs text-navy-900/50">{l.sku}</span>
                {!l.active && <span className="ms-2 text-xs text-amber-700">hors ligne</span>}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => removeProductLink(productId, l.id))}
                className="shrink-0 text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addProductLink(productId, sku));
        }}
      >
        <input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="Référence (SKU) de la pièce à lier"
          aria-label="Référence de la pièce à lier"
          className="min-h-tap-compact flex-1 rounded-lg border border-gray-300 px-3 text-sm"
        />
        <button
          type="submit"
          disabled={pending || !sku.trim()}
          className="min-h-tap-compact rounded-lg bg-navy-900 px-4 text-xs font-display font-bold uppercase tracking-wide text-white disabled:opacity-50"
        >
          Lier
        </button>
      </form>
      {message && <p className={`text-sm ${message.tone === "error" ? "text-red-600" : "text-green-700"}`}>{message.text}</p>}
    </section>
  );
}
