"use client";

import { Fragment, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/i18n/LocaleProvider";
import type { DictKey } from "@/i18n/dictionaries";
import T from "./T";

type Family = {
  slug: string;
  name: string;
  /** Uploaded from /admin/catalogue. Absent on a family nobody has photographed yet. */
  imageUrl?: string | null;
  children: { slug: string; name: string; count: number }[];
};

/**
 * The family card's picture slot.
 *
 * Always the same size whether or not a photo exists, so the grid stays even
 * as the shop fills in pictures family by family — a card with a photo should
 * not sit taller or narrower than the one next to it that doesn't have one
 * yet.
 */
function FamilyThumb({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  if (imageUrl) {
    return (
      <span className="relative shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-white">
        <Image src={imageUrl} alt="" fill sizes="40px" className="object-cover" />
      </span>
    );
  }
  return (
    <span className="shrink-0 w-10 h-10 rounded-lg bg-white/70 text-navy-900/25 font-display font-extrabold text-lg flex items-center justify-center">
      {name[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

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
  // One family open at a time. Expanding every card at once turns a scannable
  // grid of sixteen into a wall of eighty links, which is the thing the grid
  // exists to avoid.
  const [openFamily, setOpenFamily] = useState<string | null>(null);

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
        // One column through the whole phone range: a thumbnail, a name and
        // the chevron badge don't fit two-up on a phone without truncating
        // every family name to five or six letters, which defeats the point
        // of a browsable list. Two columns waits for `sm` (tablet width and
        // up, the same breakpoint the rest of the site's grids use), where
        // there is enough room to keep names readable.
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {families.map((f) => {
            const open = openFamily === f.slug;
            return (
              <Fragment key={f.slug}>
                {/* A button, not a link: the first tap opens the family's
                    subcategories in place so the shopper can pick the exact
                    part type without a page load and a trip back. The family
                    page is still one tap away from inside the panel. */}
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`subs-${f.slug}`}
                  onClick={() => setOpenFamily(open ? null : f.slug)}
                  className={`flex items-center gap-3 p-4 rounded-xl border text-start transition min-h-[76px] ${
                    open
                      ? "border-gold-500 bg-[#fffdf4]"
                      : "border-navy-900/10 bg-gray-50 hover:border-gold-500 hover:bg-[#fffdf4] hover:-translate-y-0.5"
                  }`}
                >
                  <FamilyThumb name={f.name} imageUrl={f.imageUrl} />
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    {/* truncate, not wrap: a two-column card at 320px leaves so
                        little room next to the thumbnail and the chevron that
                        an unbreakable name ("Préchauffage") could force the
                        row wider than the card — an ellipsis degrades safely,
                        a forced-wide row does not. */}
                    <span className="truncate font-display font-bold uppercase tracking-wide text-[15px] text-navy-950 leading-tight">
                      {f.name}
                    </span>
                    <span className="truncate text-xs text-navy-900/50">
                      {f.children.length} <T k="families.subcats" />
                    </span>
                  </div>
                  <span
                    className={`shrink-0 w-7 h-7 rounded-full border border-navy-900/10 flex items-center justify-center text-red-500 transition-transform duration-200 motion-reduce:transition-none ${
                      open ? "rotate-90 border-gold-500" : ""
                    }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M8 5l8 7-8 7" />
                    </svg>
                  </span>
                </button>

                {/* col-span-full puts the panel on its own row directly under
                    the card that opened it, so the grid keeps its shape. */}
                {open && (
                  <div
                    id={`subs-${f.slug}`}
                    className="col-span-full -mt-0.5 mb-1 p-3 rounded-xl border border-gold-500/60 bg-[#fffdf4]"
                  >
                    <ul className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                      {f.children.map((c) => (
                        <li key={c.slug}>
                          <Link
                            href={`/catalogue/${f.slug}/${c.slug}`}
                            className="flex items-center gap-2 h-full min-h-tap px-3 py-2.5 rounded-lg border border-navy-900/10 bg-white hover:border-navy-900 transition-colors"
                          >
                            <span className="flex-1 min-w-0">
                              <span className="block text-[13.5px] font-semibold text-navy-950 leading-tight">
                                {c.name}
                              </span>
                              <span className="block text-[12px] text-navy-900/45">
                                {c.count} <T k="families.refs" />
                              </span>
                            </span>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="shrink-0 text-red-500">
                              <path d="M8 5l8 7-8 7" />
                            </svg>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`/catalogue/${f.slug}`}
                      className="inline-flex items-center gap-1.5 min-h-tap-compact mt-2 text-[13px] font-semibold text-navy-900 hover:text-red-600"
                    >
                      <T k="families.seeAll" /> {f.name}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M8 5l8 7-8 7" />
                      </svg>
                    </Link>
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
          {SYMPTOM_LINKS.map((sy) => {
            const fam = families[sy.g];
            const sub = fam?.children[sy.s];
            const href = fam && sub ? `/catalogue/${fam.slug}/${sub.slug}` : "/recherche";
            return (
              <Link
                key={sy.key}
                href={href}
                className="flex items-center gap-3 p-4 rounded-xl border border-navy-900/10 bg-white hover:border-red-500 hover:bg-[#fff8f8] hover:-translate-y-0.5 transition min-h-[76px]"
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
