import { NextRequest, NextResponse } from "next/server";

/** Loopback and `*.local` — a TLS redirect there is a redirect to nothing. */
function isLocalHost(host: string) {
  return (
    /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/.test(host) ||
    host.replace(/:\d+$/, "").endsWith(".local")
  );
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

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

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
    // blob: and data: cover next/image's own placeholder output.
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
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
      // Static assets and the image optimiser serve no HTML, so they need no
      // nonce; prefetches are skipped so a prefetched document does not carry
      // a nonce that will be stale by the time it is used.
      source: "/((?!_next/static|_next/image|favicon.ico|icon.png|images/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
