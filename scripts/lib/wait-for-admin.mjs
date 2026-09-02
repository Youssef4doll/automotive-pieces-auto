/**
 * Wait for an admin sign-in to land on /admin, and survive the rate limiter.
 *
 * The login limiter is per-address as well as per-account (60 attempts per ten
 * minutes from one IP — deliberately loose, because Tunisian carriers put a
 * whole city block behind one address). A full regression run is seventeen
 * suites signing in one after another from a single machine, so it legitimately
 * spends that budget and the next suite is told to come back later.
 *
 * That refusal is the limiter working. What is wrong is a test suite crashing
 * on it and being read as a broken application, so this waits the window out
 * and tries once more instead. It never touches the limiter's own numbers.
 */
export async function waitForAdmin(page, BASE, { timeout = 15000, submit } = {}) {
  try {
    await page.waitForURL(`${BASE}/admin`, { timeout });
    return true;
  } catch (err) {
    const shown = await page.locator("main").innerText().catch(() => "");
    const m = shown.match(/Réessayez dans (\d+) minute/);
    if (!m) throw err;

    const seconds = Number(m[1]) * 60 + 10;
    console.log(`  WAIT  login rate limit hit by the run itself — waiting ${seconds}s`);
    await page.waitForTimeout(seconds * 1000);

    if (submit) await submit();
    else await page.getByRole("button", { name: "Se connecter", exact: true }).click();
    await page.waitForURL(`${BASE}/admin`, { timeout });
    return true;
  }
}
