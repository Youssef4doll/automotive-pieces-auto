import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Account, cart, checkout and admin are private or per-session; search
        // result pages would generate unlimited near-duplicate URLs.
        disallow: ["/admin", "/compte", "/panier", "/commande", "/api/", "/recherche"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
