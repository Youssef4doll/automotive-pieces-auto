"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useLocale } from "@/i18n/LocaleProvider";
import { track } from "@/lib/track";

const POPULAR = [
  { label: "Plaquettes de frein", href: "/catalogue/freinage/freinage-kit-de-plaquettes-de-frein" },
  { label: "Huile 5W-30", href: "/catalogue/lubrifiant/lubrifiant-huile-moteur" },
  { label: "Filtre à air", href: "/catalogue/filtres/filtres-filtre-a-air" },
];

export default function Hero() {
  const { t } = useLocale();
  const router = useRouter();
  const [q, setQ] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    track("search_started", { query: q.trim(), source: "hero" });
    router.push(`/recherche?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <section className="bg-navy-900 text-white overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 py-7 sm:py-16 grid lg:grid-cols-2 gap-6 sm:gap-10 items-center">
        <div className="text-center lg:text-start">
          <h1 className="font-display font-bold uppercase text-[28px] sm:text-6xl leading-[1.02] sm:leading-[0.95] tracking-tight">
            <span className="block text-white">{t("hero.titleLine1")}</span>
            <span className="block text-gold-500">{t("hero.titleLine2")}</span>
          </h1>
          <div className="mt-4 w-24 h-1.5 bg-red-500 rounded-full mx-auto lg:mx-0" />
          <p className="mt-5 text-white/70 text-base sm:text-lg">{t("hero.subtitle")}</p>

          <form onSubmit={submit} className="mt-6 flex rounded-lg overflow-hidden shadow-lg bg-white">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              type="search"
              placeholder={t("hero.searchPlaceholder")}
              className="flex-1 min-w-0 px-4 py-3.5 sm:py-4 bg-white text-navy-950 outline-none text-sm sm:text-base"
            />
            <button type="submit" className="px-5 sm:px-8 bg-gold-500 hover:bg-gold-400 text-navy-950 font-display font-bold uppercase text-sm sm:text-base tracking-wide">
              {t("hero.searchCta")}
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2 justify-center lg:justify-start">
            <span className="text-xs text-white/50 self-center me-1">{t("hero.popular")}</span>
            {POPULAR.map((p) => (
              <a
                key={p.href}
                href={p.href}
                className="px-4 min-h-tap flex items-center rounded-full border border-white/25 text-xs sm:text-sm text-white/85 hover:bg-white/10"
              >
                {p.label}
              </a>
            ))}
          </div>
        </div>

        <div className="relative h-32 sm:h-72 lg:h-96">
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
