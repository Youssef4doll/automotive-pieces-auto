"use client";

import { useLocale } from "@/i18n/LocaleProvider";
import type { DictKey } from "@/i18n/dictionaries";

/** Renders a translated string as plain text — safe to embed inside any
 * existing element (span, p, h2…) without adding invalid nested block tags. */
export default function T({ k, vars }: { k: DictKey; vars?: Record<string, string | number> }) {
  const { t } = useLocale();
  return <>{t(k, vars)}</>;
}
