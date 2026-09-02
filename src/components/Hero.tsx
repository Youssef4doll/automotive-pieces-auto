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
      <div className="mx-auto max-w-7xl px-4 py-7 sm:py-16 grid lg:grid-cols-2 gap-6 sm:gap-10 items-center">
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
          <form onSubmit={submit} className="mt-6 relative">
            <div className="flex rounded-lg overflow-hidden shadow-lg bg-white">
              <label className="relative shrink-0 border-e border-gray-200">
                <span className="sr-only">{t("hero.scopeLabel")}</span>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as Scope)}
                  className="h-full ps-3 pe-7 bg-white text-navy-950 text-sm font-semibold outline-none appearance-none cursor-pointer"
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
        <div className="relative hidden sm:block sm:h-72 lg:h-96">
          <Image
            src="/images/parts-lineup.png"
            alt="Pièces automobiles Automotive"
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-contain"
            priority
          />
        </div>
      </div>
    </section>
  );
}
