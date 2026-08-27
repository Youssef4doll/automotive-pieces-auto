"use client";

import { useLocale } from "@/i18n/LocaleProvider";
import type { DictKey } from "@/i18n/dictionaries";

export default function SectionHeading({ k, className }: { k: DictKey; className?: string }) {
  const { t } = useLocale();
  return (
    <h2 className={className ?? "text-xl sm:text-2xl font-extrabold text-navy-950 mb-5"}>{t(k)}</h2>
  );
}
