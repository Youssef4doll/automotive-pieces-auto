"use client";

import { useLocale } from "@/i18n/LocaleProvider";
import { locales, localeMeta } from "@/i18n/locales";

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useLocale();

  return (
    <div className={`flex items-center gap-1 ${compact ? "" : "flex-wrap"}`}>
      {locales.map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={`inline-flex items-center justify-center min-h-tap px-3 rounded-md text-xs font-semibold transition ${
            locale === l
              ? "bg-gold-500 text-navy-950"
              : compact
                ? "text-white/70 hover:text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {localeMeta[l].label}
        </button>
      ))}
    </div>
  );
}
