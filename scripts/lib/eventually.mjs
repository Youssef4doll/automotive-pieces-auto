/**
 * Wait for the storefront to catch up with a write made behind its back.
 *
 * The navigation, the category tree and the family board are all served from
 * one tagged cache entry with a 120-second backstop (see lib/cache.ts). The
 * app invalidates it properly — every admin action that can change the tree
 * calls `revalidateCatalog()` — but a test that writes with `prisma.update`
 * goes around that, and then asserts on the nav after a fixed `waitForTimeout`.
 *
 * That is a race, and it is the one these suites actually lose: it passes
 * against a cold server and fails when an earlier suite has warmed the entry,
 * which reads as "the navigation is broken" when the navigation is doing
 * exactly what it was built to do. Polling states the real condition —
 * *eventually* the page shows it — instead of guessing at a number.
 *
 * Bounded, so a genuine failure still fails rather than hanging the battery.
 */
export async function eventually(fn, { timeout = 12_000, interval = 500 } = {}) {
  const deadline = Date.now() + timeout;
  for (;;) {
    if (await fn()) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, interval));
  }
}

/** Reload the page until `test(html)` holds, or the window closes. */
export async function reloadUntil(page, url, test, opts) {
  let last = "";
  const ok = await eventually(async () => {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    last = await page.content();
    return test(last);
  }, opts);
  return { ok, html: last };
}
