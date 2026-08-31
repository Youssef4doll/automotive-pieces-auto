import type { Metadata } from "next";
import { Barlow, Barlow_Semi_Condensed, Archivo, Cairo } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { localeMeta, type Locale } from "@/i18n/locales";
import Analytics from "@/components/Analytics";
import JsonLd from "@/components/JsonLd";
import { siteUrl } from "@/lib/site";
import { SITE_NAME } from "@/lib/seo";
import { organisationSchema, websiteSchema, localBusinessSchema } from "@/lib/schema";
import { getSettings, publicContact } from "@/lib/settings";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Only the weights the design actually uses. 800 was declared and never
// applied to a .font-display element, so it was a file downloaded on every
// page to render nothing.
const barlowCondensed = Barlow_Semi_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700"],
});

// Same again: .font-heading is only ever bold or extrabold.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["700", "800"],
});

// Barlow/Archivo have no Arabic glyphs — Cairo covers Arabic mode instead
// (see globals.css, which swaps the font stack under [dir="rtl"]).
//
// `preload: false` plus the conditional variable below matter more than they
// look: Cairo's Arabic subsets are the three largest files the site serves,
// and preloading them on every French page spent about 90KB before a single
// glyph was needed. They now load only for a reader who is actually in Arabic.
const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700", "800"],
  preload: false,
  display: "swap",
});

export const metadata: Metadata = {
  // Makes every relative canonical, Open Graph URL and share image in the app
  // resolve against the real origin instead of being emitted as a bare path.
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Automotive Pièces Auto — Pièces détachées vérifiées en Tunisie",
    template: "%s · Automotive Pièces Auto",
  },
  description:
    "Pièces auto vérifiées et compatibles avec votre véhicule, livrées en 24–48h partout en Tunisie. Paiement à la livraison, garantie 12 mois.",
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "fr_TN",
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const settings = await getSettings();
  const contact = publicContact(settings);
  const locale = (cookieStore.get("apa_locale")?.value as Locale) || "fr";
  const dir = localeMeta[locale]?.dir ?? "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${barlow.variable} ${barlowCondensed.variable} ${archivo.variable}${
        locale === "ar" ? ` ${cairo.variable}` : ""
      } h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* Site-wide identity, declared once rather than on every page. */}
        <JsonLd data={organisationSchema(contact)} />
        <JsonLd data={websiteSchema()} />
        <JsonLd data={localBusinessSchema(contact)} />
        <Analytics />
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
