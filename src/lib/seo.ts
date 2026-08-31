import type { Metadata } from "next";
import { siteUrl } from "@/lib/site";

export const SITE_NAME = "Automotive Pièces Auto";

/**
 * One place that builds a page's title, description, canonical and share card.
 *
 * Canonicals matter more here than on most sites: catalogue pages carry
 * `?marque=` and `?tri=` filters that produce many URLs for one set of parts,
 * and a search page produces a new URL for every query anyone ever types. Left
 * alone, that is how a small catalogue teaches a crawler it is mostly
 * duplicates. Every page therefore declares the one URL it wants to be.
 */
export function pageMeta({
  title,
  description,
  path,
  images,
  noIndex = false,
  type = "website",
}: {
  title: string;
  description: string;
  /** Canonical path, without query string — e.g. `/catalogue/freinage`. */
  path: string;
  images?: { url: string; alt: string }[];
  noIndex?: boolean;
  type?: "website" | "article";
}): Metadata {
  const base = siteUrl();
  const url = `${base}${path}`;
  const shareImages = images ?? [{ url: `${base}/opengraph-image`, alt: SITE_NAME }];

  return {
    title,
    description,
    alternates: { canonical: url },
    // Private and transactional pages are useful to a customer and useless to
    // a crawler; some (an order confirmation) must never be indexed at all.
    robots: noIndex
      ? { index: false, follow: false, googleBot: { index: false, follow: false } }
      : undefined,
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "fr_TN",
      type,
      images: shareImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: shareImages.map((i) => i.url),
    },
  };
}

/** Clamp a description to the length a search result actually shows. */
export function clampDescription(text: string, max = 155) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 60 ? lastSpace : max)}…`;
}
