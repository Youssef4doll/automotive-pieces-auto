/**
 * The public origin, used for canonical URLs, the sitemap, structured data —
 * and for every link and picture in the emails the shop sends, which is where
 * getting it wrong is visible: a customer clicks "Suivre ma commande" and
 * lands somewhere, and their mail client fetches the logo from somewhere.
 *
 * Set NEXT_PUBLIC_SITE_URL in production. Failing that, Vercel's own variables
 * are used, most stable first: VERCEL_PROJECT_PRODUCTION_URL is the project's
 * production domain, the same on every deploy; VERCEL_URL is the address of
 * this one deployment (…-git-main-….vercel.app), which changes every time and
 * may sit behind deployment protection, where a mail client asking for the
 * logo gets a sign-in page instead. The localhost fallback keeps local builds
 * working without pretending to be the live domain.
 */
export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
