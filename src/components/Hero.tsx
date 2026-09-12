"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useLocale } from "@/i18n/LocaleProvider";
import { track } from "@/lib/track";
import { useRef } from "react";
import SearchSuggest from "@/components/SearchSuggest";

export type Shortcut = { label: string; href: string };

/** What the box is being asked: a part name, or a reference off the old part. */
type Scope = "name" | "ref";

export default function Hero({ shortcuts = [] }: { shortcuts?: Shortcut[] }) {
  const { t } = useLocale();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<Scope>("name");
  const heroInputRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = q.trim();
    if (!value) return;
    track("search_started", { query: value, source: "hero", scope });

    if (scope === "ref") {
      // Straight to the part when the reference is one we stock. When it is
      // not, fall through to the ordinary search rather than dead-ending —
      // that page understands references too and offers the shop's own
      // channel when it also comes up empty.
      try {
        const res = await fetch(`/api/reference?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        if (data.found) {
          router.push(`/produit/${data.slug}`);
          return;
        }
      } catch {
        /* offline or refused: the search page is still a good answer */
      }
    }
    router.push(`/recherche?q=${encodeURIComponent(value)}`);
  }

  return (
    // No overflow-hidden here. It was clipping the search suggestions at the
    // hero's bottom edge — the list appeared, then got sliced in half by the
    // brands band underneath it. The parts artwork it was guarding is
    // object-contain inside a fixed-height box and does not overflow anyway.
    <section className="bg-navy-900 text-white">
      {/* The artwork gets the larger half on a desktop.

          It used to be an even split, and the reference's picture is wider
          than half — the only ways to reach that size inside an even split
          were to bleed it off the edge of the page, which put a horizontal
          scrollbar on the two commonest desktop widths, or to bleed it
          inwards, which laid the brake caliper across the subtitle. Moving
          the split is what actually makes room for it. The text column keeps
          a comfortable measure; nothing above lg changes. */}
      <div className="mx-auto shell-w px-4 py-7 sm:py-16 grid lg:grid-cols-[1fr_1.35fr] gap-6 sm:gap-10 items-center">
        {/* min-w-0: this is a grid item, and a grid item's default min-width
            is auto — its own content's intrinsic width, not the track's. The
            search button's unbreakable label ("Rechercher") was enough to
            hold that floor above 320px, quietly forcing the whole hero (and
            the page) wider than the phone screen underneath it. */}
        <div className="min-w-0 text-center lg:text-start">
          <h1 className="font-display font-bold uppercase text-[28px] sm:text-6xl leading-[1.02] sm:leading-[0.95] tracking-tight">
            <span className="block text-white">{t("hero.titleLine1")}</span>
            <span className="block text-gold-500">{t("hero.titleLine2")}</span>
          </h1>
          <div className="mt-4 w-24 h-1.5 bg-red-500 rounded-full mx-auto lg:mx-0" />
          <p className="mt-5 text-white/70 text-base sm:text-lg">{t("hero.subtitle")}</p>

          {/* Scope selector glued to the box, the way the big European parts
              catalogues do it. A part number and a part name are different
              questions: "GDB1330" typed into a name search competes with every
              product whose description happens to contain a number, while the
              reference lookup goes straight to the part. Defaulting to name
              keeps it invisible for the majority who type words. */}
          {/* The scope drops to its own line on a phone.

              All three sat in one row at every width, and on a 390px screen
              "Par nom" and "Rechercher" left about sixty pixels between them:
              the placeholder rendered as "Recherc" and the box read as broken.
              Wrapping the selector above gives the input the width of the
              screen minus the button, which is what it needs to look like
              somewhere you can type a part name. */}
          <form onSubmit={submit} className="mt-6 relative">
            <div className="flex flex-wrap sm:flex-nowrap rounded-lg overflow-hidden shadow-lg bg-white">
              <label className="relative w-full sm:w-auto shrink-0 border-b sm:border-b-0 sm:border-e border-gray-200">
                <span className="sr-only">{t("hero.scopeLabel")}</span>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as Scope)}
                  className="w-full sm:w-auto h-full min-h-tap ps-3 pe-7 bg-white text-navy-950 text-sm font-semibold outline-none appearance-none cursor-pointer"
                >
                  <option value="name">{t("hero.scopeName")}</option>
                  <option value="ref">{t("hero.scopeRef")}</option>
                </select>
                <svg
                  width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="3" aria-hidden="true"
                  className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-navy-900/45"
                >
                  <path d="m5 8 7 8 7-8" />
                </svg>
              </label>
              <input
                ref={heroInputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                type="search"
                autoComplete="off"
                dir={scope === "ref" ? "ltr" : undefined}
                placeholder={scope === "ref" ? "GDB1330 · 7701234567" : t("hero.searchPlaceholder")}
                className={`flex-1 min-w-0 px-4 py-3.5 sm:py-4 bg-white text-navy-950 outline-none text-sm sm:text-base ${
                  scope === "ref" ? "font-mono" : ""
                }`}
              />
              <button type="submit" className="px-5 sm:px-8 bg-gold-500 hover:bg-gold-400 text-navy-950 font-display font-bold uppercase text-sm sm:text-base tracking-wide">
                {t("hero.searchCta")}
              </button>
            </div>
            {/* Suggestions are for names. In reference mode the answer is a
                single part or nothing, and a dropdown of near-misses would
                just be noise over an exact lookup. */}
            {scope === "name" && <SearchSuggest query={q} inputRef={heroInputRef} />}
          </form>

          {/* Real subcategories, biggest first, passed in from the server —
              not a hand-written list. Three hard-coded paths broke silently
              whenever the taxonomy moved, and calling them "popular" claimed
              a demand figure nobody had measured. */}
          {shortcuts.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 justify-center lg:justify-start">
              <span className="text-xs text-white/50 self-center me-1">{t("hero.popular")}</span>
              {shortcuts.map((p) => (
                <a
                  key={p.href}
                  href={p.href}
                  className="px-4 min-h-tap flex items-center rounded-full border border-white/25 text-xs sm:text-sm text-white/85 hover:bg-white/10"
                >
                  {p.label}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Hidden on phones. It is decoration — a lineup of parts, not
            information — and at 128px plus the grid gap it was pushing "Que
            cherchez-vous ?" and every route to find a part completely off the
            first screen. Nothing about the type scale changes; this is 152px
            of picture traded for the thing the visitor came to do. */}
        {/* Two things taken from the reference design and nothing else: how
            big the artwork sits on a desktop, and the shadow under it.

            The size comes from the grid above rather than from a negative
            margin here, so the picture reaches the reference's width without
            ever leaving its own column — no page scrollbar, nothing laid over
            the text. The picture is 3:1 in a box taller than it is wide at
            this breakpoint, so the fit is decided by the width: a wider track
            is what makes the parts bigger. */}
        <div className="relative hidden sm:block sm:h-72 lg:h-96">
          <Image
            src="/images/parts-lineup.png"
            alt="Pièces automobiles Automotive"
            fill
            sizes="(max-width: 1024px) 100vw, 60vw"
            className="object-contain"
            // Two stacked drop-shadows, straight from the reference. They
            // trace the parts themselves rather than a box, because
            // drop-shadow follows the PNG's alpha — which is the whole point
            // of using it here instead of box-shadow. Tailwind can express
            // one of these; stacking two is clearer written out.
            style={{
              filter:
                "drop-shadow(0 34px 40px rgba(0,0,0,.6)) drop-shadow(0 8px 16px rgba(0,0,0,.4))",
            }}
            priority
          />
        </div>
      </div>
    </section>
  );
}
