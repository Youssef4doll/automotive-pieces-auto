import "server-only";
import { revalidateTag } from "next/cache";

/**
 * The category tree, cached across requests — and how it is thrown away.
 *
 * The site is rendered on demand for every request: the Content-Security-Policy
 * carries a per-request nonce, so there is no page-level cache to fall back on.
 * That means the header's category menu — sixteen families, their
 * subcategories, and a part count for each — is read again for every visitor,
 * on every navigation, from a database in another country. It is also the
 * heaviest read on most pages and the one that changes least: a shop adds a
 * category a few times a month.
 *
 * So it is cached and invalidated explicitly. The rule for anyone adding a
 * mutation is the one the codebase already follows: wherever you write
 * `revalidatePath("/", "layout")` because a change reaches the storefront,
 * call `revalidateCatalog()` beside it.
 *
 * `CATALOG_TTL` is a backstop, not the mechanism. If an invalidation is ever
 * missed, the shop sees its own change late by two minutes rather than never —
 * which is the failure mode to have, since the person who will notice is the
 * one who made the change.
 *
 * The shop's settings are deliberately NOT here. They are one query against
 * twenty rows, and caching them across requests bought a few milliseconds in
 * exchange for a window in which a change made outside `updateSettings` — a
 * seed, a migration, a fix-up in psql — was invisible. The end-to-end suite
 * caught exactly that, which is a good enough argument on its own.
 */

export const CATALOG_TAG = "catalog";

/** Cache lifetime in seconds — a backstop, not the mechanism. */
export const CATALOG_TTL = 120;

/**
 * Call after anything that changes what the category menu shows: a category
 * created, renamed, reordered or deleted, or a product added, removed or
 * switched on or off — the menu carries per-family part counts.
 *
 * `{ expire: 0 }` rather than the "max" profile the docs recommend for
 * catalogues: "max" keeps serving stale content for up to a year while it
 * refreshes in the background, which is right for a blog and wrong here. The
 * person who just renamed the category is the one about to reload the page.
 */
export function revalidateCatalog() {
  revalidateTag(CATALOG_TAG, { expire: 0 });
}

/**
 * The deep-analysis page's read, cached across requests.
 *
 * Its own tag and its own lifetime because it is a different bargain from the
 * catalogue's. The catalogue is invalidated the moment the shop changes it,
 * because the person who made the change is the one reloading the page. An
 * analytics window is never "wrong" in that sense — it is a summary of the
 * last ninety days, and a summary that is ten minutes old is the same summary.
 *
 * What the TTL is actually protecting is the storefront. The admin runs on the
 * same database and the same connection pool as every shopper, and a panel of
 * aggregates re-computed on every refresh of an admin tab is capacity taken
 * away from people trying to buy something. Ten minutes means a shop that
 * leaves the page open all morning pays for six reads an hour rather than one
 * per keystroke of F5.
 *
 * No `revalidateAnalytics()` on purpose: nothing should invalidate this. An
 * order placed thirty seconds ago appearing in a ninety-day trend line is not
 * worth a cache bust, and a mutation that tried would be one more thing to
 * keep in step for no gain.
 */
export const ANALYTICS_TAG = "analytics";

/** Ten minutes. See above — this is a capacity guard, not a freshness one. */
export const ANALYTICS_TTL = 600;
