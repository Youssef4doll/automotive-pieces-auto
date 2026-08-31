/**
 * The locale list and its metadata, kept apart from the translations.
 *
 * `dictionaries.ts` holds every string in all three languages — about 44KB of
 * source. A client component that imports anything from that module pulls the
 * whole thing into the browser bundle, so a French shopper downloads the Arabic
 * and English copies too. This module exists so the switcher and the provider
 * can name the locales without dragging the translations along; the active
 * dictionary is handed to them from the server instead.
 */
export type Locale = "fr" | "ar" | "en";

export const locales: Locale[] = ["fr", "ar", "en"];

export const localeMeta: Record<Locale, { label: string; dir: "ltr" | "rtl" }> = {
  fr: { label: "Français", dir: "ltr" },
  ar: { label: "العربية", dir: "rtl" },
  en: { label: "English", dir: "ltr" },
};
