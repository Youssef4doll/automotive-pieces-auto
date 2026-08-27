"use client";

import { useActionState } from "react";
import { useLocale } from "@/i18n/LocaleProvider";
import { subscribeNewsletter, type NewsletterState } from "@/app/actions/newsletter";

export default function NewsletterForm() {
  const { t } = useLocale();
  const [state, action, pending] = useActionState<NewsletterState, FormData>(subscribeNewsletter, undefined);

  if (state?.ok) {
    return <p className="text-sm text-gold-500 font-medium">{t("footer.newsletterThanks")}</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex rounded-md overflow-hidden bg-white">
        <input
          name="email"
          type="email"
          required
          placeholder={t("footer.newsletterPlaceholder")}
          className="flex-1 min-w-0 px-3 py-2.5 bg-white text-sm text-navy-900 outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="px-4 bg-gold-500 hover:bg-gold-400 disabled:opacity-60 text-navy-950 font-display font-bold uppercase text-sm"
        >
          {t("footer.newsletterOk")}
        </button>
      </div>
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}
