"use client";

import { useLocale } from "@/i18n/LocaleProvider";

export default function B2BCta({ contactUrl }: { contactUrl: string }) {
  const { t } = useLocale();
  return (
    <a
      href={contactUrl}
      {...(contactUrl.startsWith("/") ? {} : { target: "_blank", rel: "noreferrer" })}
      className="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 font-display font-bold uppercase text-sm tracking-wide shrink-0"
    >
      {t("b2b.cta")}
    </a>
  );
}
