import { siteUrl } from "@/lib/site";
import { SITE_NAME } from "@/lib/seo";
import type { PublicContact } from "@/lib/settings";

/**
 * schema.org objects, built from data that exists.
 *
 * The rule throughout is that a field is omitted rather than guessed. An
 * `aggregateRating` with no reviews, an `address` the owner has not entered, an
 * `openingHours` invented to look complete — each is a claim to Google that the
 * shop cannot back, and structured data that misrepresents a page is a manual
 * action waiting to happen. `prune` drops anything undefined so callers can
 * pass optional values straight through.
 */
function prune<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  ) as T;
}

export function organisationSchema(contact: PublicContact) {
  const base = siteUrl();
  return prune({
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${base}/#organization`,
    name: SITE_NAME,
    url: base,
    logo: `${base}/images/logo-white.png`,
    email: contact.email ?? undefined,
    telephone: contact.phone ?? undefined,
  });
}

export function websiteSchema() {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${base}/#website`,
    name: SITE_NAME,
    url: base,
    inLanguage: "fr-TN",
    publisher: { "@id": `${base}/#organization` },
    // Declares the site's own search so a result can offer a search box.
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${base}/recherche?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * The shop as a physical place.
 *
 * `AutoPartsStore` is the specific type for this trade. Address and telephone
 * appear only once entered in /admin/parametres — a LocalBusiness whose address
 * is "⚠ à compléter" is worse than none, and inventing a street would put a
 * wrong pin on a map a customer might actually drive to.
 */
export function localBusinessSchema(contact: PublicContact) {
  const base = siteUrl();
  const hasPlace = Boolean(contact.address);

  return prune({
    "@context": "https://schema.org",
    "@type": "AutoPartsStore",
    "@id": `${base}/#store`,
    name: contact.name || SITE_NAME,
    url: base,
    image: `${base}/images/storefront.png`,
    telephone: contact.phone ?? undefined,
    email: contact.email ?? undefined,
    priceRange: "TND",
    address: hasPlace
      ? { "@type": "PostalAddress", streetAddress: contact.address, addressCountry: "TN" }
      : undefined,
    // Free text, because the shop states its hours as a sentence rather than
    // as a machine-readable range. Better honest prose than a fabricated
    // openingHoursSpecification.
    openingHours: contact.hours ?? undefined,
    areaServed: { "@type": "Country", name: "Tunisie" },
  });
}

export function breadcrumbSchema(crumbs: { name: string; path: string }[]) {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${base}${c.path}`,
    })),
  };
}

export function productSchema(p: {
  name: string;
  slug: string;
  sku: string;
  description: string;
  brandName?: string | null;
  price: number;
  inStock: boolean;
  images: string[];
  oemRefs?: string[];
  reviewCount?: number;
  ratingAverage?: number | null;
}) {
  const base = siteUrl();
  const url = `${base}/produit/${p.slug}`;

  return prune({
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.sku,
    // The references stamped on the part it replaces. `mpn` is the part's own
    // number; the OE numbers are alternates a shopper may search by.
    mpn: p.sku,
    ...(p.oemRefs?.length ? { alternateName: p.oemRefs } : {}),
    description: p.description || undefined,
    image: p.images.length ? p.images.map((i) => (i.startsWith("http") ? i : `${base}${i}`)) : undefined,
    brand: p.brandName ? { "@type": "Brand", name: p.brandName } : undefined,
    url,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "TND",
      price: p.price.toFixed(2),
      availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@id": `${base}/#organization` },
    },
    // Only when reviews actually exist. Google penalises a rating that the
    // page cannot show.
    aggregateRating:
      p.reviewCount && p.reviewCount > 0 && p.ratingAverage
        ? {
            "@type": "AggregateRating",
            ratingValue: p.ratingAverage.toFixed(1),
            reviewCount: p.reviewCount,
          }
        : undefined,
  });
}

export function itemListSchema(items: { name: string; path: string }[]) {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: `${base}${it.path}`,
    })),
  };
}
