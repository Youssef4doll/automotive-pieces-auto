"use client";

import { useLocale } from "@/i18n/LocaleProvider";

export default function WhyUs() {
  const { t } = useLocale();

  const checks = [t("why.check1"), t("why.check2"), t("why.check3"), t("why.check4")];
  const stats = [
    { value: t("why.valueRefs"), label: t("why.statRefs") },
    { value: t("why.valueDelay"), label: t("why.statDelay") },
    // Not an average customer rating: the site has no review system, so any
    // score printed here would be a number nobody measured.
    { value: t("why.valueWarranty"), label: t("why.statWarranty") },
    { value: t("why.valueYears"), label: t("why.statYears") },
  ];

  return (
    <section className="bg-navy-900 text-white py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 grid lg:grid-cols-2 gap-10 items-center">
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
