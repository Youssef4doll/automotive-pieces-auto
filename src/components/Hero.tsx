"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/i18n/LocaleProvider";
import { useVehicle, vehicleLabel } from "@/lib/vehicle-store";
import VehiclePicker from "./VehiclePicker";

const POPULAR = [
  { label: "Plaquettes de frein", href: "/catalogue/freinage/freinage-kit-de-plaquettes-de-frein" },
  { label: "Huile 5W-30", href: "/catalogue/lubrifiant/lubrifiant-huile-moteur" },
  { label: "Filtre à air", href: "/catalogue/filtres/filtres-filtre-a-air" },
];

export type HeroFamily = { id: string; slug: string; name: string; partCount: number };

export default function Hero({ families }: { families: HeroFamily[] }) {
  const { t } = useLocale();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const vehicle = useVehicle((s) => s.vehicle);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/recherche?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <section className="bg-navy-900 text-white overflow-hidden">
      <div className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
        {!vehicle ? (
          <div key="no-vehicle" className="text-center motion-safe:animate-[hero-reveal_450ms_ease-out]">
            <h1 className="font-heading font-extrabold uppercase text-[clamp(2.25rem,7vw,4rem)] leading-[0.98] tracking-[-0.02em]">
              {t("hero.findTitle")}
            </h1>
            <p className="mt-5 text-white/70 text-base sm:text-lg max-w-xl mx-auto text-balance">
              {t("hero.findSubtitle")}
            </p>

            <button
              onClick={() => setPickerOpen(true)}
              className="mt-8 inline-flex items-center gap-2.5 px-8 sm:px-10 py-4 sm:py-5 rounded-xl bg-gold-500 hover:bg-gold-400 active:scale-[0.98] text-navy-950 font-display font-bold uppercase text-base sm:text-lg tracking-wide shadow-xl transition-transform"
            >
              {t("hero.identifyCta")}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="rtl-flip">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>

            <div className="mt-10 pt-8 border-t border-white/10 max-w-lg mx-auto">
              <p className="text-xs text-white/45 uppercase tracking-[.08em] mb-3">{t("hero.orSearch")}</p>
              <form onSubmit={submit} className="flex rounded-lg overflow-hidden bg-white/10 border border-white/15">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  type="search"
                  placeholder={t("hero.searchPlaceholder")}
                  className="flex-1 min-w-0 px-4 py-3.5 bg-transparent text-white placeholder-white/45 outline-none text-sm"
                />
                <button
                  type="submit"
                  className="flex items-center justify-center px-5 text-gold-500 font-display font-bold uppercase text-xs tracking-wide"
                >
                  {t("hero.searchCta")}
                </button>
              </form>
              <div className="mt-3 flex flex-wrap gap-2 justify-center">
                {POPULAR.map((p) => (
                  <a
                    key={p.href}
                    href={p.href}
                    className="px-3 py-1.5 min-h-10 flex items-center rounded-full border border-white/15 text-xs text-white/60 hover:text-white hover:border-white/30"
                  >
                    {p.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div key="with-vehicle" className="motion-safe:animate-[hero-reveal_450ms_ease-out]">
            <div className="text-center">
              <p className="text-[11px] font-bold uppercase tracking-[.12em] text-gold-500">{t("hero.yourVehicle")}</p>
              <div className="mt-2 flex items-center justify-center gap-3 flex-wrap">
                <h1 className="font-heading font-extrabold uppercase text-[clamp(1.75rem,5.5vw,3rem)] leading-[1.02] tracking-[-0.015em]">
                  {vehicle.makeName} {vehicle.modelName}
                </h1>
              </div>
              <p className="mt-1 text-white/60 text-sm sm:text-base">{vehicle.engineName}</p>
              <button
                onClick={() => setPickerOpen(true)}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-white/50 hover:text-gold-500 underline underline-offset-2 py-2"
              >
                {t("hero.changeVehicle")}
              </button>
            </div>

            <div className="mt-10 pt-9 border-t border-white/10 text-center">
              <h2 className="font-heading font-extrabold uppercase text-[clamp(1.375rem,4vw,2rem)] leading-tight tracking-[-0.01em]">
                {t("hero.whatNeeds")}
              </h2>
              <p className="mt-1.5 text-white/55 text-sm">{t("hero.whatNeedsSub")}</p>

              <div className="mt-7 grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
                {families.map((f) => (
                  <Link
                    key={f.id}
                    href={`/catalogue/${f.slug}`}
                    className="group flex flex-col items-center justify-center gap-1 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 hover:border-gold-500/50 px-3 py-5 min-h-[92px] transition-colors"
                  >
                    <span className="font-heading font-bold uppercase text-sm sm:text-[15px] text-white group-hover:text-gold-500 transition-colors">
                      {f.name}
                    </span>
                    <span className="text-[11px] text-white/40">{f.partCount} réf.</span>
                  </Link>
                ))}
              </div>

              <Link href="/catalogue" className="inline-flex items-center gap-1.5 mt-6 text-sm font-semibold text-white/60 hover:text-white py-2">
                {t("hero.viewAllParts")}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="rtl-flip">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="relative h-40 sm:h-56 opacity-90">
        <Image
          src="/images/parts-lineup.png"
          alt="Pièces automobiles Automotive"
          fill
          sizes="100vw"
          className="object-contain object-bottom"
          priority
        />
      </div>

      {pickerOpen && <VehiclePicker onClose={() => setPickerOpen(false)} />}
    </section>
  );
}
