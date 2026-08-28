"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/i18n/LocaleProvider";
import type { DictKey } from "@/i18n/dictionaries";
import T from "./T";

type Family = {
  slug: string;
  name: string;
  children: { slug: string; name: string }[];
};

// Same family-index/subcategory-index pairs as the reference design's SYMPTOMS
// list — our category taxonomy was seeded in the identical order, so these
// indices resolve to the same real subcategories.
const SYMPTOM_LINKS: { key: DictKey; g: number; s: number }[] = [
  { key: "sym.1", g: 1, s: 8 },
  { key: "sym.2", g: 1, s: 1 },
  { key: "sym.3", g: 9, s: 0 },
  { key: "sym.4", g: 9, s: 1 },
  { key: "sym.5", g: 12, s: 1 },
  { key: "sym.6", g: 12, s: 5 },
  { key: "sym.7", g: 4, s: 2 },
  { key: "sym.8", g: 5, s: 11 },
  { key: "sym.9", g: 6, s: 5 },
  { key: "sym.10", g: 3, s: 0 },
  { key: "sym.11", g: 0, s: 1 },
  { key: "sym.12", g: 14, s: 0 },
  { key: "sym.13", g: 0, s: 4 },
  { key: "sym.14", g: 11, s: 0 },
  { key: "sym.15", g: 1, s: 9 },
  { key: "sym.16", g: 15, s: 1 },
];

export default function FamiliesTabs({ families }: { families: Family[] }) {
  const { t } = useLocale();
  const [tab, setTab] = useState<"fam" | "sym">("fam");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <button
          onClick={() => setTab("fam")}
          className={`px-4.5 min-h-tap inline-flex items-center rounded-full border text-xs font-display font-bold uppercase tracking-wide ${
            tab === "fam" ? "bg-navy-900 text-white border-navy-900" : "bg-white text-navy-900/70 border-gray-200"
          }`}
        >
          {t("families.tab")}
        </button>
        <button
          onClick={() => setTab("sym")}
          className={`px-4.5 min-h-tap inline-flex items-center rounded-full border text-xs font-display font-bold uppercase tracking-wide ${
            tab === "sym" ? "bg-navy-900 text-white border-navy-900" : "bg-white text-navy-900/70 border-gray-200"
          }`}
        >
          {t("families.tabSym")}
        </button>
      </div>

      {tab === "fam" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {families.map((f) => (
            <Link
              key={f.slug}
              href={`/catalogue/${f.slug}`}
              className="flex items-center gap-3 p-4 rounded-xl border border-navy-900/10 bg-gray-50 hover:border-gold-500 hover:bg-[#fffdf4] hover:-translate-y-0.5 transition min-h-[92px]"
            >
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="font-display font-bold uppercase tracking-wide text-[15px] text-navy-950 leading-tight">
                  {f.name}
                </span>
                <span className="text-xs text-navy-900/50">
                  {f.children.length} <T k="families.subcats" />
                </span>
              </div>
              <span className="shrink-0 w-7 h-7 rounded-full border border-navy-900/10 flex items-center justify-center text-red-500">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M8 5l8 7-8 7" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {SYMPTOM_LINKS.map((sy) => {
            const fam = families[sy.g];
            const sub = fam?.children[sy.s];
            const href = fam && sub ? `/catalogue/${fam.slug}/${sub.slug}` : "/recherche";
            return (
              <Link
                key={sy.key}
                href={href}
                className="flex items-center gap-3 p-4 rounded-xl border border-navy-900/10 bg-white hover:border-red-500 hover:bg-[#fff8f8] hover:-translate-y-0.5 transition min-h-[92px]"
              >
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <span className="font-bold text-[14.5px] text-navy-950 leading-tight">{t(sy.key)}</span>
                  <span className="text-xs text-navy-900/50">{fam?.name ?? ""}</span>
                </div>
                <span className="shrink-0 w-7 h-7 rounded-full border border-navy-900/10 flex items-center justify-center text-red-500">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M8 5l8 7-8 7" />
                  </svg>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
