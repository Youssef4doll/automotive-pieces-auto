"use client";

import { useLocale } from "@/i18n/LocaleProvider";

export default function NotFoundBand({
  contactUrl,
  phone,
}: {
  contactUrl: string;
  /** null until the owner enters one; the button then carries its label alone. */
  phone: string | null;
}) {
  const { t } = useLocale();

  return (
    <section className="bg-gold-500">
      <div className="mx-auto max-w-7xl px-4 py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div>
          <h2 className="font-heading font-extrabold uppercase text-xl sm:text-3xl text-navy-950 tracking-tight">
            {t("notfound.title")}
          </h2>
          <p className="text-navy-900/80 text-sm mt-1">{t("notfound.subtitle")}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          <a
            href={contactUrl}
            {...(contactUrl.startsWith("/") ? {} : { target: "_blank", rel: "noreferrer" })}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-navy-900 hover:bg-navy-800 text-white font-display font-bold uppercase text-sm tracking-wide"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.07L2 22l5.06-1.33A9.94 9.94 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.65 0-3.19-.47-4.5-1.28l-.32-.19-3.01.79.8-2.93-.21-.31A7.94 7.94 0 0 1 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z" />
            </svg>
            <span dir="ltr">{phone ?? t("nav.contact")}</span>
          </a>
          <a
            href={contactUrl}
            {...(contactUrl.startsWith("/") ? {} : { target: "_blank", rel: "noreferrer" })}
            className="inline-flex items-center justify-center px-5 py-3 rounded-lg border-2 border-navy-900 hover:bg-navy-900 hover:text-white text-navy-900 font-display font-bold uppercase text-sm tracking-wide transition"
          >
            {t("notfound.callBack")}
          </a>
        </div>
      </div>
    </section>
  );
}
