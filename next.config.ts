import type { NextConfig } from "next";

/**
 * Headers that are the same on every response. The Content-Security-Policy is
 * not here — it carries a per-request nonce, so it is set in `src/proxy.ts`.
 */
const securityHeaders = [
  // Two years, subdomains included, and preload-eligible. Only ever sent over
  // HTTPS, so it is inert in local development.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Stops a browser from second-guessing a Content-Type — the reason an
  // uploaded "image" can otherwise be served back as script.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Referrers stay full-fidelity within the site and shrink to the origin when
  // leaving it, so an order reference never rides along to a third party.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // frame-ancestors in the CSP is the real control; this covers older browsers.
  { key: "X-Frame-Options", value: "DENY" },
  // Nothing here needs a camera, a microphone or a location.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  // Explicit rather than implied: browser source maps must not ship to
  // production, where they would hand a reader the unminified source.
  productionBrowserSourceMaps: false,

  // The build already fails on type errors; spelling it out stops a future
  // "just ship it" flag from being added quietly. (Next 16 dropped the `eslint`
  // key — linting is its own step now.)
  typescript: { ignoreBuildErrors: false },

  // Drops the `X-Powered-By: Next.js` version banner.
  poweredByHeader: false,

  experimental: {
    serverActions: {
      // Admin uploads — product photos and banner artwork — travel through
      // Server Actions, and the default cap is 1MB: a single phone photo of a
      // brake disc blows past that, and the failure surfaces as an opaque
      // error rather than the action's own message. 12MB covers a banner or a
      // small batch of photos at the 4MB-per-file limit the actions enforce,
      // with room for multipart overhead. The forms check the total before
      // sending so the shop never uploads into a rejection.
      bodySizeLimit: "12mb",
    },
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
