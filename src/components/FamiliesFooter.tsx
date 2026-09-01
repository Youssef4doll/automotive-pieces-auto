"use client";

import { useLocale } from "@/i18n/LocaleProvider";
import { track } from "@/lib/track";
import { contactLink } from "@/lib/contact-link";

export function FamiliesFooter({ whatsapp }: { whatsapp: string | null }) {
  const { t } = useLocale();
  return (
    <div className="mt-6 pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <p className="text-sm text-gray-500">{t("families.noQuestion")}</p>
      <a
        href={contactLink({ whatsapp, email: null }, t("families.describe"))}
        target="_blank"
        rel="noreferrer"
        onClick={() => track("whatsapp_clicked", { source: "families_footer" })}
        className="inline-flex items-center gap-2 px-4 min-h-tap rounded-lg bg-green-700 hover:bg-green-800 text-white text-sm font-display font-bold uppercase tracking-wide shrink-0"
      >
        {t("families.describe")}
      </a>
    </div>
  );
}
