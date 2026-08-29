/**
 * The public origin, used for canonical URLs, the sitemap and structured data.
 * Set NEXT_PUBLIC_SITE_URL in production; the fallback keeps local builds and
 * previews working without pretending to be the live domain.
 */
export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
