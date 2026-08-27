import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { localeMeta, type Locale } from "@/i18n/dictionaries";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
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
    <html lang={locale} dir={dir} className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
