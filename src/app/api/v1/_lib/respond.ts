import { NextResponse } from "next/server";

/**
 * The shared shape of every /api/v1 response.
 *
 * This exists because the storefront and the phone app are now two front
 * doors onto one database, and the app cannot read a Server Component. The
 * version in the path is the promise: /api/v1 may gain fields, and it may
 * never change the meaning of one that is already there. When that has to
 * happen it becomes /api/v2 and v1 keeps working until the last phone still
 * running it has updated — which, for an app shipped through a store, is
 * months after the website has moved on.
 *
 * Three rules this file enforces so no route has to remember them:
 *
 *   Every success is `{ data: … }` and every failure is `{ error: <code> }`.
 *   A client that has to guess whether a bare array means success or a
 *   truncated body is a client that will guess wrong on a bad connection.
 *
 *   The error is a stable machine code, not a sentence. The app writes its
 *   own French, English and Arabic; a message baked in here would arrive in
 *   the wrong language on two thirds of the phones and could not be
 *   translated without shipping a new build.
 *
 *   Nothing is ever cached by accident. Every route states its own policy.
 */

/** What the app is allowed to assume it is talking to. */
export const API_VERSION = "1";

export type ApiError =
  | "bad_request"
  | "not_found"
  | "rate_limited"
  | "unauthorized"
  | "server_error";

const STATUS: Record<ApiError, number> = {
  bad_request: 400,
  unauthorized: 401,
  not_found: 404,
  rate_limited: 429,
  server_error: 500,
};

/**
 * Cache policies, named rather than spelled out at each call site.
 *
 * `catalogue` is for anything derived from the parts and vehicle tables: it
 * is the same answer for every caller, it changes a few times a day, and it
 * is the traffic worth keeping off a database in another country. Thirty
 * seconds of staleness means a newly added engine appears in the picker half
 * a minute late; nobody has ever noticed that, and every shopper opening the
 * garage otherwise costs a query.
 *
 * `private` is for anything that depends on who is asking — an order, an
 * account. It must never land in a shared cache, and `no-store` rather than
 * `no-cache` because the second one still permits a stored copy.
 */
export const Cache = {
  catalogue: "public, max-age=30, s-maxage=300, stale-while-revalidate=3600",
  private: "no-store",
} as const;

/**
 * Cross-origin access, and why only half the API gets it.
 *
 * A native build has no origin and no CORS: iOS and Android just make the
 * request. A browser does not, and `expo start --web` is how this app is
 * developed and screenshotted — Metro serves the app from :8081 and the API
 * answers on :3000, which is cross-origin. Without this header the web build
 * of the app cannot read its own shop.
 *
 * `*` is safe here and only here. These endpoints are the catalogue: the same
 * public answer for every caller, no cookie read, no session, nothing that
 * varies by who is asking — exactly what the storefront already renders to
 * anonymous visitors. Putting `*` on an endpoint that DOES read a session or
 * an order token would be the other thing entirely: it would let any web page
 * the customer visits make authenticated requests on their behalf. So this is
 * opt-in per route and the orders and account routes must never take it.
 */
const PUBLIC_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

type Options = {
  /** Cache-Control. Defaults to `no-store`; a route opts in to caching. */
  cache?: string;
  /** Allow any origin to read this. Public catalogue data only — see above. */
  cors?: boolean;
};

function headersFor({ cache = Cache.private, cors = false }: Options) {
  return {
    "Cache-Control": cache,
    "X-API-Version": API_VERSION,
    ...(cors ? PUBLIC_CORS : {}),
  };
}

export function ok<T>(data: T, options: Options = {}) {
  return NextResponse.json({ data }, { headers: headersFor(options) });
}

export function fail(error: ApiError, options: Options = {}, extra?: Record<string, string>) {
  return NextResponse.json(
    { error },
    // The failure carries the same CORS headers as the success. A browser
    // that cannot read the 404 reports it to the app as a network error, and
    // "pas de connexion" is the wrong thing to tell someone whose real
    // problem is that the shop has no data for that car.
    { status: STATUS[error], headers: { ...headersFor({ ...options, cache: Cache.private }), ...extra } },
  );
}

/** The preflight answer for a public read-only route. */
export function preflight() {
  return new Response(null, { status: 204, headers: headersFor({ cors: true }) });
}

/**
 * The last line of defence around a handler.
 *
 * A route that throws in Next returns an HTML error page with a 500, which an
 * app parsing JSON reports to the customer as something unintelligible. This
 * turns any escape into the same `{ error: "server_error" }` every other
 * failure uses, and logs the real cause server-side where it belongs — never
 * in the body, which would hand a stack trace to anyone with curl.
 */
export async function guard(handler: () => Promise<Response>, label: string, options: Options = {}) {
  try {
    return await handler();
  } catch (err) {
    console.error(`api/v1 ${label} failed`, err);
    return fail("server_error", options);
  }
}
