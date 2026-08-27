"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/i18n/LocaleProvider";
import MyVehicleChip from "./MyVehicleChip";

const POPULAR = [
  { label: "Plaquettes de frein", href: "/catalogue/freinage/freinage-kit-de-plaquettes-de-frein" },
  { label: "Filtre à air", href: "/catalogue/filtres/filtres-filtre-a-air" },
  { label: "Amortisseurs", href: "/catalogue/suspension/suspension-amortisseur" },
  { label: "Huile moteur", href: "/catalogue/lubrifiant/lubrifiant-huile-moteur" },
];

export default function Hero() {
  const { t } = useLocale();
  const router = useRouter();
  const [q, setQ] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/recherche?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <section className="bg-navy-900 text-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:py-14 flex flex-col items-center text-center gap-5">
        <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight max-w-3xl">{t("hero.title")}</h1>
        <p className="text-white/70 text-sm sm:text-base max-w-xl">{t("hero.subtitle")}</p>

        <form onSubmit={submit} className="w-full max-w-2xl flex rounded-xl overflow-hidden shadow-lg mt-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            type="search"
            placeholder={t("hero.searchPlaceholder")}
            className="flex-1 min-w-0 px-4 py-3.5 sm:py-4 text-navy-950 outline-none text-sm sm:text-base"
          />
          <button type="submit" className="px-5 sm:px-8 bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold text-sm sm:text-base">
            {t("hero.searchCta")}
          </button>
        </form>

        <div className="flex flex-wrap gap-2 justify-center">
          {POPULAR.map((p) => (
            <a
              key={p.href}
              href={p.href}
              className="px-3 py-2 min-h-10 flex items-center rounded-full border border-white/25 text-xs sm:text-sm text-white/80 hover:bg-white/10"
            >
              {p.label}
            </a>
          ))}
        </div>

        <div className="mt-2">
          <MyVehicleChip />
        </div>
      </div>
    </section>
  );
}
