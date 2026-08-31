"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { localeMeta, type Locale } from "./locales";
import { type DictKey, getDictionary } from "./dictionaries";

type Ctx = {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (l: Locale) => void;
  t: (key: DictKey, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<Ctx | null>(null);

const COOKIE_NAME = "apa_locale";

/**
 * Holds the active language for the client tree.
 *
 * All three dictionaries ship in this bundle, which is deliberate. Sending only
 * the active one from the server was measured and was worse: it costs ~4.5KB
 * gzipped in every page response, against ~11KB saved once from a bundle the
 * browser then caches — so any shopper who looks at three pages pays more. The
 * strings also ended up serialised into every HTML document, which made the
 * payload noisier for no benefit.
 */
export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = localeMeta[locale].dir;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    document.cookie = `${COOKIE_NAME}=${l}; path=/; max-age=${60 * 60 * 24 * 365}`;
  }, []);

  const dict = useMemo(() => getDictionary(locale), [locale]);

  const t = useCallback(
    (key: DictKey, vars?: Record<string, string | number>) => {
      let str: string = dict[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(`{${k}}`, String(v));
        }
      }
      return str;
    },
    [dict]
  );

  const value = useMemo(
    () => ({ locale, dir: localeMeta[locale].dir, setLocale, t }),
    [locale, setLocale, t]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
