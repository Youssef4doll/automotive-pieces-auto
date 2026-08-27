"use client";

import { useLocale } from "@/i18n/LocaleProvider";

export default function WhyUs() {
  const { t } = useLocale();

  const stats = [
    { value: "9+", label: t("why.years") },
    { value: "12 000+", label: t("why.clients") },
    { value: "4.8/5", label: t("why.rating") },
  ];

  return (
    <section className="bg-navy-950 text-white py-12">
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="text-xl sm:text-2xl font-extrabold text-center mb-8">{t("why.title")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl sm:text-4xl font-extrabold text-gold-500">{s.value}</p>
              <p className="text-sm text-white/70 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { icon: "✓", label: t("compat.verified") },
            { icon: "💳", label: t("trust.cod") },
            { icon: "🔄", label: t("trust.exchange") },
            { icon: "🛡", label: t("trust.warranty") },
          ].map((f) => (
            <div key={f.label} className="p-3 rounded-xl bg-white/5 flex flex-col items-center gap-1.5">
              <span className="text-xl">{f.icon}</span>
              <span className="text-xs text-white/80">{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
