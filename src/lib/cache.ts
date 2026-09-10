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
