import type { Metadata } from "next";
import { Barlow, Barlow_Semi_Condensed, Archivo, Cairo } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { localeMeta, type Locale } from "@/i18n/dictionaries";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const barlowCondensed = Barlow_Semi_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

// Barlow/Archivo have no Arabic glyphs — Cairo covers Arabic mode instead
// (see globals.css, which swaps the font stack under [dir="rtl"]).
const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Automotive Pièces Auto — Pièces détachées vérifiées en Tunisie",
    template: "%s · Automotive Pièces Auto",
  },
  description:
    "Pièces auto vérifiées et compatibles avec votre véhicule, livrées en 24–48h partout en Tunisie. Paiement à la livraison, garantie 12 mois.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("apa_locale")?.value as Locale) || "fr";
  const dir = localeMeta[locale]?.dir ?? "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${barlow.variable} ${barlowCondensed.variable} ${archivo.variable} ${cairo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
