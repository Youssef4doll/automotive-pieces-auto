import type { Metadata, Viewport } from "next";
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
  // No 500. It was a 15.6KB file on every page in the service of "slightly
  // heavier than body text" — and counted across twelve storefront routes,
  // five elements on the whole site were drawn in it. Every one of them was
  // emphasis against something lighter beside it (a cart line's name against
  // its reference, a spec value against its label, a price against its row),
  // never against a 600, so the thirty-nine `font-medium` classes became
  // `font-semibold` and the distinction they were drawing survives at a weight
  // the browser already has.
  weight: ["400", "600", "700"],
});

// Only the weights the design actually renders in.
//
// `next/font` preloads every weight declared here, on every page, whether or
// not a glyph is ever drawn in it — so a weight that is merely *available* is
// a file the shop pays for on every visit. Across eight routes the browser
// reported loading six faces: Barlow 400/500/600/700, Barlow Semi Condensed
// 700, Archivo 800. The other two were downloaded and never used.
//
// So the handful of `font-display font-bold` and `font-heading font-extrabold`
// elements — all in the admin and the desktop header — were moved up to the
// weight beside them rather than keeping a whole file alive for each. 32KB
// off every page on the site.
const barlowCondensed = Barlow_Semi_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["700"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["800"],
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

/**
 * Phone browser chrome.
 *
 * `themeColor` is what Chrome on Android paints its address bar with and what
 * iOS tints the status bar area with — without it the header's navy stops dead
 * at the top of the page against the browser's own grey. It is navy-900, the
 * same value the header is painted in, so the two read as one surface.
 *
 * The viewport line itself is Next's default spelled out: `width=device-width,
 * initial-scale=1` and nothing else. No `maximum-scale`, no `user-scalable=no`
 * — pinch-zoom stays available, which a shopper reading a part reference on a
 * phone will use.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f2352",
};

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
