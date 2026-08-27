"use client";

import { useLocale } from "@/i18n/LocaleProvider";
import type { DictKey } from "@/i18n/dictionaries";
import LanguageSwitcher from "./LanguageSwitcher";

export function About() {
  const { t } = useLocale();
  return <p className="text-sm">{t("footer.about")}</p>;
}

export function Heading({ k }: { k: DictKey }) {
  const { t } = useLocale();
  return <h3 className="text-sm font-bold text-white uppercase tracking-wide">{t(k)}</h3>;
}

export function Rights() {
  const { t } = useLocale();
  return <>{t("footer.rights")}</>;
}

export function LangRow() {
  const { t } = useLocale();
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/40">{t("footer.language")}:</span>
      <LanguageSwitcher />
    </div>
  );
}
