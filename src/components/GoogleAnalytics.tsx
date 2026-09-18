import { headers } from "next/headers";
import Script from "next/script";

/**
 * Google Analytics 4, and nothing else.
 *
 * The shop had no third-party measurement at all — no GA, no pixel, no
 * dataLayer — so not one funnel step was observable outside our own tables and
 * a launch would have been blind. You get one chance at a baseline.
 *
 * **Not to be confused with `Analytics.tsx`**, which is the shop's own
 * page-view recorder feeding `/admin/analytics`. The two are unrelated and
 * both are wanted: ours survives ad blockers and answers "what did people
 * search for and not find", Google's answers "where did they come from and
 * where did they drop". This file was very nearly called `Analytics.tsx` and
 * overwrote that one for a while, which silently switched off the internal
 * counter and made /confidentialite's "mesure d'audience interne" untrue.
 *
 * **It only exists when it is configured.** No `NEXT_PUBLIC_GA_ID`, no script
 * and — the part that matters — no widening of the Content-Security-Policy.
 * A shop that has not turned analytics on keeps a policy that permits no
 * third-party script at all, which is the stricter and better default. The
 * same flag is read in `proxy.ts`, so the policy and the page can never
 * disagree about whether Google is allowed to load.
 *
 * Mounted in the storefront layout, not the root one: the admin is staff
 * using the tool, and counting them as visitors would poison every number the
 * shop is about to start making decisions with.
 *
 * The nonce is required, not optional: the CSP is nonce-based, so an inline
 * script without the current request's nonce is refused by the browser. The
 * remote gtag.js then loads under `'strict-dynamic'` — which is why the policy
 * needs no host allowlist for scripts, only for the beacons in `connect-src`.
 *
 * Configured deliberately narrow:
 *
 * - `anonymize_ip` — the shop needs to know which pages convert, not which
 *   household is reading them.
 * - `allow_google_signals: false` and `allow_ad_personalization_signals:
 *   false` — this turns off cross-site advertising features, so GA measures
 *   the funnel rather than feeding an ad profile. It is also what lets
 *   /confidentialite keep saying, truthfully, that the site carries no
 *   advertising tracker.
 *
 * NOTE for whoever turns this on: GA still sets cookies, and whether that
 * needs a consent banner in your jurisdiction is a question for a lawyer, not
 * for this file. The privacy page names Google Analytics and says what it
 * does; it does not claim the question has been answered.
 */
export default async function GoogleAnalytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID?.trim();
  if (!id) return null;

  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <>
      <Script
        id="ga-src"
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`}
        strategy="afterInteractive"
        nonce={nonce}
      />
      <Script id="ga-init" strategy="afterInteractive" nonce={nonce}>
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(
          id,
        )},{anonymize_ip:true,allow_google_signals:false,allow_ad_personalization_signals:false});`}
      </Script>
    </>
  );
}
