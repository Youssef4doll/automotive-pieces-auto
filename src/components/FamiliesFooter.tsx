"use client";

import { useLocale } from "@/i18n/LocaleProvider";
import { track } from "@/lib/track";
import { contactLink, contactLinkProps } from "@/lib/contact-link";

export function FamiliesFooter({ whatsapp }: { whatsapp: string | null }) {
  const { t } = useLocale();
  // The copy names WhatsApp, so it may only be shown when there is a WhatsApp
  // number to send the shopper to. Until the shop fills one in,
  // contactLink falls back to the store section — correctly, but under a
  // sentence promising a channel that is not there, and behind a green button
  // that opened this same site in a new tab because the target was hardcoded.
  const href = contactLink({ whatsapp, email: null }, t("families.describe"));
  return (
    <div className="mt-6 pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <p className="text-sm text-gray-500">
        {t(whatsapp ? "families.noQuestion" : "families.noQuestionNoWa")}
      </p>
      <a
        href={href}
        {...contactLinkProps(href)}
        onClick={() => track("whatsapp_clicked", { source: "families_footer" })}
        className="inline-flex items-center gap-2 px-4 min-h-tap rounded-lg bg-green-700 hover:bg-green-800 text-white text-sm font-display font-bold uppercase tracking-wide shrink-0"
      >
        {t(whatsapp ? "families.describe" : "families.describeNoWa")}
      </a>
    </div>
  );
}
