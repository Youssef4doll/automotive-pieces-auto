"use client";

import { useMemo, useState } from "react";
import { IconSearch, IconWhatsApp } from "./icons";

export type Faq = { q: string; a: string; cat: string };

/**
 * A help centre rather than a list: the search filters questions as you type,
 * and the categories narrow the same set. Answers stay collapsed until asked
 * for, so the page opens as six choices instead of a wall of text.
 */
export default function HelpCenter({ faqs, whatsapp, orderRef }: { faqs: Faq[]; whatsapp: string; orderRef?: string }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("");

  const cats = useMemo(() => [...new Set(faqs.map((f) => f.cat))], [faqs]);

  const shown = useMemo(() => {
    const q = query
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    return faqs.filter((f) => {
      if (cat && f.cat !== cat) return false;
      if (!q) return true;
      const hay = `${f.q} ${f.a} ${f.cat}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
      return hay.includes(q);
    });
  }, [faqs, query, cat]);

  const message = orderRef
    ? `Bonjour, j'ai besoin d'aide concernant ma commande ${orderRef}.`
    : "Bonjour, je n'ai pas trouvé la réponse à ma question.";

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <label className="relative block">
          <span className="sr-only">Rechercher une question</span>
          <IconSearch className="absolute start-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une question…"
            className="w-full min-h-tap ps-12 pe-4 rounded-xl border border-slate-300 bg-slate-50 text-sm outline-none focus:border-navy-700 focus:bg-white transition-colors"
          />
        </label>

        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 mt-3 overflow-x-auto no-scrollbar">
          <div className="flex gap-2 w-max">
            <Chip active={cat === ""} onClick={() => setCat("")}>
              Tout
            </Chip>
            {cats.map((c) => (
              <Chip key={c} active={cat === c} onClick={() => setCat(cat === c ? "" : c)}>
                {c}
              </Chip>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-2 sm:p-3">
        {shown.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-slate-500">
            Aucune question ne correspond à « {query} ». Écrivez-nous, on vous répond directement.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {shown.map((f) => (
              <li key={f.q}>
                <details className="group">
                  <summary className="flex items-start justify-between gap-3 cursor-pointer list-none px-3 min-h-tap py-3 text-sm font-semibold text-navy-950 rounded-lg hover:bg-slate-50">
                    <span>
                      {f.q}
                      <span className="block text-[11px] font-normal uppercase tracking-wide text-slate-400 mt-0.5">
                        {f.cat}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="shrink-0 mt-0.5 w-6 h-6 grid place-items-center rounded-full border border-slate-200 text-slate-400 transition-transform duration-200 group-open:rotate-45 group-open:border-navy-900 group-open:text-navy-900"
                    >
                      +
                    </span>
                  </summary>
                  {/* grid-rows trick: animates open/closed without measuring height */}
                  <div className="grid grid-rows-[0fr] group-open:grid-rows-[1fr] transition-[grid-template-rows] duration-200 motion-reduce:transition-none">
                    <div className="overflow-hidden">
                      <p className="px-3 pb-4 text-sm text-slate-600 leading-relaxed">{f.a}</p>
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 text-center">
        <h2 className="font-heading font-extrabold uppercase tracking-tight text-lg text-navy-950">
          Vous n&apos;avez pas trouvé la réponse ?
        </h2>
        <p className="text-sm text-slate-500 mt-1 mb-4">Une vraie personne vous répond.</p>
        <a
          href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 min-h-tap px-6 rounded-xl bg-green-600 hover:bg-green-500 text-white font-display font-bold uppercase text-xs tracking-wide transition-colors"
        >
          <IconWhatsApp /> Écrire sur WhatsApp
        </a>
      </section>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center whitespace-nowrap px-4 min-h-tap-compact rounded-full border text-sm transition-colors ${
        active
          ? "bg-navy-950 border-navy-950 text-white font-semibold"
          : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"
      }`}
    >
      {children}
    </button>
  );
}
