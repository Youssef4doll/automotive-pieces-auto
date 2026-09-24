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
  /** One named field failed validation; the body carries `field`. */
  | "invalid_field"
  | "not_found"
  | "rate_limited"
  | "unauthorized"
  /** Signed in correctly, as somebody who may not do this — a customer at the staff door. */
  | "forbidden"
  /**
   * The request was fine and the shop cannot do it: a part in the basket was
   * withdrawn or can no longer be sourced. The body carries `productId`, so
   * the app can point at the line rather than at the whole basket.
   */
  | "unavailable"
  | "server_error";

const STATUS: Record<ApiError, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  unavailable: 409,
  invalid_field: 422,
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
 * The CDN keeps it for the same thirty seconds. It used to keep it five
 * minutes and serve a stale copy for an hour after that, and on the phone that
 * read as a price or a promotion the owner had changed that would not update.
 *
 * `private` is for anything that depends on who is asking — an order, an
 * account. It must never land in a shared cache, and `no-store` rather than
 * `no-cache` because the second one still permits a stored copy.
 */
export const Cache = {
  catalogue: "public, max-age=30, s-maxage=30, stale-while-revalidate=300",
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

/**
 * The orders routes, and why they can take `*` after all.
 *
 * The rule above is about AMBIENT credentials. What makes `*` dangerous on an
 * account or order route is a cookie: the browser attaches it to a request
 * any page can trigger, so the page acts as the customer without knowing who
 * they are. The /api/v1 orders routes read no cookie. They authenticate with
 * a bearer token the app holds in the device keychain and sends in the
 * `Authorization` header — which a hostile page cannot attach, because it
 * does not have it. There is nothing ambient to ride on, so there is nothing
 * for `*` to leak. (Browsers also refuse to pair `*` with credentialed
 * requests at all, which is a second lock on the same door.)
 *
 * That argument holds for exactly as long as the route never reads a cookie.
 * A route that takes `cors: "write"` must not call `cookies()` or
 * `getCurrentUser()` — the day the app gains sign-in, the account routes get
 * their own bearer session, not the website's cookie.
 */
const WRITE_CORS = {
  ...PUBLIC_CORS,
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

type Options = {
  /** Cache-Control. Defaults to `no-store`; a route opts in to caching. */
  cache?: string;
  /**
   * `true`: any origin may read this — public catalogue data only.
   * `"write"`: any origin may also POST and send `Authorization` — only on a
   * route that reads no cookie; see WRITE_CORS.
   */
  cors?: boolean | "write";
};

function headersFor({ cache = Cache.private, cors = false }: Options) {
  return {
    "Cache-Control": cache,
    "X-API-Version": API_VERSION,
    ...(cors === "write" ? WRITE_CORS : cors ? PUBLIC_CORS : {}),
  };
}

export function ok<T>(data: T, options: Options = {}) {
  return NextResponse.json({ data }, { headers: headersFor(options) });
}

export function fail(
  error: ApiError,
  options: Options = {},
  extra?: Record<string, string>,
  /** Machine-readable detail beside the code — a field name, a product id. Never a sentence. */
  detail?: Record<string, string>,
) {
  return NextResponse.json(
    { error, ...detail },
    // The failure carries the same CORS headers as the success. A browser
    // that cannot read the 404 reports it to the app as a network error, and
    // "pas de connexion" is the wrong thing to tell someone whose real
    // problem is that the shop has no data for that car.
    { status: STATUS[error], headers: { ...headersFor({ ...options, cache: Cache.private }), ...extra } },
  );
}

/**
 * The preflight answers. Two functions rather than one with a flag, because
 * each is exported directly as a route's `OPTIONS` handler and Next calls it
 * with the request as the first argument — a flag parameter would silently
 * receive a Request object.
 */
export function preflight() {
  return new Response(null, { status: 204, headers: headersFor({ cors: true }) });
}

/** For a route that takes POST or `Authorization` — see WRITE_CORS. */
export function preflightWrite() {
  return new Response(null, { status: 204, headers: headersFor({ cors: "write" }) });
}

/**
 * A JSON body, bounded.
 *
 * `request.json()` reads whatever it is sent. A basket is a few hundred
 * bytes; refusing anything over 32 KB before parsing keeps one malformed
 * client from being a way to make the server allocate.
 */
export async function readJson(request: Request, maxBytes = 32_768): Promise<unknown | undefined> {
  const text = await request.text();
  if (text.length > maxBytes) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
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
