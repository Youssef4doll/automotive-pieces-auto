import { NextRequest, NextResponse } from "next/server";
import { callerIp, hit } from "@/lib/rate-limit-core";
import { fail } from "@/app/api/v1/_lib/respond";

/** Loopback and `*.local` — a TLS redirect there is a redirect to nothing. */
function isLocalHost(host: string) {
  return (
    /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/.test(host) ||
    host.replace(/:\d+$/, "").endsWith(".local")
  );
}

/**
 * The app API's outer wall: how often one address may ask, and how much it
 * may send. Every /api/v1 request passes here before its route runs.
 *
 * Flood ceilings, not the real gates. The real ones are per route and per
 * identity (lib/rate-limit's LIMITS: eight wrong passwords per account, ten
 * order lookups…); these only stop one address hammering the whole API —
 * a scraper walking the catalogue, a script replaying a request in a loop —
 * before it costs a database round trip. Loose on purpose: a Tunisian mobile
 * carrier puts a neighbourhood behind one address, and a customer browsing
 * quickly makes a few dozen reads a minute. Reads and writes are counted
 * apart, so a flood of reads never blocks somebody's checkout.
 *
 * The size check reads Content-Length only; a body that lies about it, or
 * has none, still meets each route's own bounded reader (readJson).
 */
export const API_FLOOD = {
  read: { limit: 600, windowMs: 60_000 },
  write: { limit: 120, windowMs: 60_000 },
} as const;

/** Photo uploads: four phone photos at the 4 MB each the routes accept, plus multipart overhead. */
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
/** Everything else is JSON, and the largest a route accepts is 32 KB. */
const MAX_JSON_BYTES = 256 * 1024;
const UPLOAD_ROUTES = [
  /^\/api\/v1\/orders\/[^/]+\/returns$/,
  /^\/api\/v1\/expert-requests$/,
  /^\/api\/v1\/questions$/,
  /^\/api\/v1\/admin\/products\/[^/]+\/images$/,
  /^\/api\/v1\/admin\/categories\/[^/]+\/image$/,
];

function apiGate(request: NextRequest) {
  const method = request.method.toUpperCase();
  // A preflight carries no body and costs nothing; refusing it would only
  // turn a 429 into a CORS error the app cannot read.
  if (method === "OPTIONS") return NextResponse.next();
  const write = method !== "GET" && method !== "HEAD";
  const policy = { cors: "write" as const };
  const cap = write ? API_FLOOD.write : API_FLOOD.read;
  const gate = hit(`api:${write ? "w" : "r"}:${callerIp(request.headers)}`, cap.limit, cap.windowMs);
  if (!gate.ok) return fail("rate_limited", policy, { "Retry-After": String(gate.retryAfter) });

  if (write) {
    const path = request.nextUrl.pathname;
    const max = UPLOAD_ROUTES.some((r) => r.test(path)) ? MAX_UPLOAD_BYTES : MAX_JSON_BYTES;
    const length = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(length) && length > max) return fail("payload_too_large", policy);
  }
  // JSON answers carry no HTML, so no nonce and no CSP.
  return NextResponse.next();
}

/**
 * Per-request Content Security Policy, and the HTTPS redirect.
 *
 * The policy is nonce-based rather than `'unsafe-inline'`: Next reads the
 * nonce out of the CSP header we set on the request and stamps it onto its own
 * framework and page scripts, so injected markup cannot execute even if a
 * catalogue field ever ends up rendered as HTML. That requires a fresh nonce
 * per request, which is why this runs on every HTML route.
 *
 * (In Next 16 this file is `proxy.ts`, not `middleware.ts`.)
 */
export function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== "production";

  // Behind a proxy (Vercel, Fly, nginx) TLS terminates upstream, so the
  // original scheme only survives in this header. Redirect before anything
  // else so a session cookie is never sent in the clear.
  //
  // Next sets `x-forwarded-proto: http` itself when it is serving plain HTTP,
  // so the host is checked too — otherwise `next start` on a laptop redirects
  // every request to an https port that is not listening.
  const proto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("host") ?? "";
  if (!isDev && proto === "http" && !isLocalHost(host)) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  if (request.nextUrl.pathname.startsWith("/api/v1/")) return apiGate(request);

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const gaEnabled = !!process.env.NEXT_PUBLIC_GA_ID?.trim();

  const csp = [
    "default-src 'self'",
    // 'strict-dynamic' lets the nonced bootstrap load the chunks it needs
    // without listing every hashed filename. 'unsafe-eval' is development
    // only — React uses eval there to rebuild server stacks in the browser.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    // React writes dynamic widths as style attributes (progress bars, chart
    // bars). Attribute styles cannot execute, so they are allowed here while
    // <style> blocks still require the nonce above.
    "style-src-attr 'unsafe-inline'",
    // blob: and data: cover next/image's own placeholder output. GA falls back
    // to a pixel where beacons are unavailable, so its host is listed with the
    // same switch.
    gaEnabled
      ? "img-src 'self' blob: data: https://*.google-analytics.com https://*.googletagmanager.com"
      : "img-src 'self' blob: data:",
    "font-src 'self'",
    // Google Analytics beacons, and only when the shop has actually set a
    // measurement id. `'strict-dynamic'` above means script-src needs no host
    // for gtag.js — the nonced loader pulls it — but the measurement requests
    // are fetch/beacon calls and those are governed here.
    //
    // Read from the same variable the component reads, so the policy and the
    // page cannot disagree about whether Google is allowed to load: without it
    // this stays `connect-src 'self'` and no third-party request is possible
    // at all.
    gaEnabled
      ? "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com"
      : "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Static assets, the image optimiser and the uploaded-image route serve
      // no HTML, so they need no nonce; prefetches are skipped so a prefetched
      // document does not carry a nonce that will be stale by the time it is
      // used.
      //
      // api/images is excluded for a second reason: next/image optimises it by
      // replaying the request through this pipeline with a mocked, header-less
      // request. Anything this file did with `host` or `x-forwarded-proto` on
      // that request produced a non-image response, and the optimiser answered
      // 400 — every uploaded photo rendered as a broken image.
      // api/part-icon is here for both reasons: it serves an SVG, not HTML,
      // so it needs no nonce — and it sets its own, stricter policy, which
      // the site-wide one below would otherwise overwrite.
      source: "/((?!_next/static|_next/image|api/images/|api/part-icon/|favicon.ico|icon.png|images/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
