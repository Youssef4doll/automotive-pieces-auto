"use client";

import { useLocale } from "@/i18n/LocaleProvider";

/** Grouped the way the rest of the site writes prices, and the same in all
 *  three languages — the tile is already wrapped in dir="ltr". */
const nf = (n: number) => n.toLocaleString("fr-FR");

/**
 * Every figure in this block is either counted or entered by the shop.
 *
 * It used to read "12 000+ références en stock" and "9 ans au service des
 * garages", both typed into the dictionary. The catalogue holds a fraction of
 * that, and a visitor who reads 12 000 and then opens a family of eleven parts
 * has caught the site lying on the first screen. The counts arrive as props
 * from the database; the years come from a setting and the tile is a real fact
 * about the catalogue when the shop has not filled it in.
 */
export default function WhyUs({
  products,
  brands,
  years,
  deliveryGrandTunis,
}: {
  products: number;
  brands: number;
  years: number | null;
  deliveryGrandTunis: string;
}) {
  const { t } = useLocale();

  const checks = [t("why.check1"), t("why.check2"), t("why.check3"), t("why.check4")];
  const stats = [
    { value: nf(products), label: t("why.statRefs") },
    { value: deliveryGrandTunis, label: t("why.statDelay") },
    // Not an average customer rating: the site has no review system, so any
    // score printed here would be a number nobody measured.
    { value: t("why.valueWarranty"), label: t("why.statWarranty") },
    years === null
      ? { value: nf(brands), label: t("why.statBrands") }
      : { value: t("why.valueYears", { n: years }), label: t("why.statYears") },
  ];

  return (
    <section className="bg-navy-900 text-white py-12 sm:py-16">
      <div className="mx-auto shell-w px-4 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <p className="text-xs font-display font-bold uppercase tracking-wide text-gold-500 mb-1.5">
            {t("why.eyebrow")}
          </p>
          <h2 className="font-heading font-extrabold uppercase text-2xl sm:text-4xl tracking-tight mb-3 sm:mb-4">
            {t("why.headline")}
          </h2>
          <p className="text-white/70 mb-6">{t("why.body")}</p>
          <ul className="flex flex-col gap-3">
            {checks.map((c) => (
              <li key={c} className="flex items-start gap-3 text-sm text-white/85">
                <span className="mt-0.5 shrink-0 w-5 h-5 rounded-md bg-gold-500 text-navy-950 flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
                {c}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl bg-white/5 p-6">
              <p dir="ltr" className="text-2xl sm:text-4xl font-heading font-extrabold text-gold-500">{s.value}</p>
              <p className="text-sm text-white/60 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
