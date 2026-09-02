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
 * A fixed square that reserves its space whether or not a photo exists, so the
 * grid stays even as the shop fills these in family by family — a card with a
 * photo should not sit taller than the one next to it that doesn't have one
 * yet, and the row should not reflow as the images decode.
 *
 * object-contain, not cover: these are part photographs shot on white, and
 * cropping a brake disc to fill a square is how you end up showing a grey
 * rectangle.
 */
function FamilyThumb({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  return (
    <span className="relative block w-full aspect-square rounded-lg overflow-hidden">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 40vw, (max-width: 1024px) 22vw, 150px"
          className="object-contain"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center bg-gray-50 text-navy-900/20 font-display font-extrabold text-3xl">
          {name[0]?.toUpperCase() ?? "?"}
        </span>
      )}
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
        // Picture-led tiles: the photo is what a shopper recognises when they
        // don't know the French name for the part they are holding. Two up on
        // the narrowest phones and six across on a wide screen, so sixteen
        // families read as one browsable board rather than a long list.
        //
        // grid-cols-N compiles to repeat(N, minmax(0, 1fr)) — the zero floor is
        // what keeps a long unbroken name from widening its own track and, with
        // it, the page.
        <div className="grid grid-cols-2 min-[380px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-2.5">
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
                  className={`group relative flex flex-col items-center gap-2 p-2.5 sm:p-3 rounded-xl border bg-white text-center transition ${
                    open
                      ? "border-gold-500 bg-[#fffdf4] ring-1 ring-gold-500"
                      : "border-navy-900/10 hover:border-gold-500 hover:shadow-sm hover:-translate-y-0.5"
                  }`}
                >
                  <FamilyThumb name={f.name} imageUrl={f.imageUrl} />

                  {/* The names run long ("Transmission et embrayage") and the
                      tile is narrow, so they wrap and are clamped to two lines
                      rather than truncated at the first word. `anywhere` is the
                      backstop for the single words that are wider than the tile
                      on a 320px screen. */}
                  <span className="w-full min-w-0 line-clamp-2 [overflow-wrap:anywhere] font-display font-bold uppercase tracking-wide text-[12px] sm:text-[13px] text-navy-950 leading-tight">
                    {f.name}
                  </span>
                  <span className="text-[12px] text-navy-900/50 leading-none">
                    {f.children.length} <T k="families.subcats" />
                  </span>

                  {/* Corner badge rather than a row item: the tile is a column
                      now, and a chevron under the name would read as another
                      line of text instead of "this opens". */}
                  <span
                    className={`absolute top-1.5 end-1.5 w-5 h-5 rounded-full border border-navy-900/10 bg-white flex items-center justify-center text-red-500 transition-transform duration-200 motion-reduce:transition-none ${
                      open ? "rotate-90 border-gold-500" : ""
                    }`}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
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
