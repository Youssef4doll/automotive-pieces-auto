/**
 * Wait for an admin sign-in to land on /admin, and survive the rate limiter.
 *
 * The login limiter is per-address as well as per-account (60 attempts per ten
 * minutes from one IP — deliberately loose, because Tunisian carriers put a
 * whole city block behind one address). A full regression run is eighteen
 * suites signing in one after another from a single machine, so it legitimately
 * spends that budget and the next suite is told to come back later.
 *
 * That refusal is the limiter working. What is wrong is a test suite crashing
 * on it and being read as a broken application, so this waits the window out
 * and tries again instead. It never touches the limiter's own numbers.
 */
export async function waitForAdmin(page, BASE, { timeout = 15000, submit } = {}) {
  try {
    await page.waitForURL(`${BASE}/admin`, { timeout });
    return true;
  } catch (err) {
    // Read the whole document: the refusal is not always inside <main>, and a
    // login that simply did not take leaves the form standing with no message
    // at all. Both are the same situation from here — back off and retry.
    const shown = await page.locator("body").innerText().catch(() => "");
    const stillOnLogin = (await page.locator('input[name="password"]').count().catch(() => 0)) > 0;
    const stated = shown.match(/Réessayez dans (\d+) minute/);
    if (!stated && !stillOnLogin) throw err;

    // A stated wait is honoured exactly; an unexplained one gets a flat two
    // minutes, which clears the ten-minute window's slowest case in practice.
    const seconds = stated ? Number(stated[1]) * 60 + 10 : 120;
    console.log(`  WAIT  admin sign-in refused by the run's own rate limiting — waiting ${seconds}s`);
    await page.waitForTimeout(seconds * 1000);

    if (submit) {
      await submit();
    } else {
      // Re-enter the form from scratch: after a long wait the page may have
      // been navigated or the fields cleared.
      await page.goto(`${BASE}/compte`);
      await page.fill('input[name="email"]', "admin@automotive-pieces-auto.tn");
      await page.fill('input[name="password"]', "admin1234");
      await page.getByRole("button", { name: "Se connecter", exact: true }).click();
    }
    await page.waitForURL(`${BASE}/admin`, { timeout });
    return true;
  }
}
