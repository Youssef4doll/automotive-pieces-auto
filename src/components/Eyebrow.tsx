"use client";

import { useLocale } from "@/i18n/LocaleProvider";
import type { DictKey } from "@/i18n/dictionaries";

export default function Eyebrow({ k, className }: { k: DictKey; className?: string }) {
  const { t } = useLocale();
  return (
    <p className={className ?? "text-xs font-display font-bold uppercase tracking-wide text-red-500 mb-1.5"}>
      {t(k)}
    </p>
  );
}
