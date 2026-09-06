/**
 * Choose a value in an admin SearchableSelect.
 *
 * The category and brand pickers on the product form used to be native
 * <select>s, driven in these suites with `selectOption`. They are comboboxes
 * now — a text input that filters, backed by a hidden field carrying the id —
 * because a native select over a hundred and forty categories can only be
 * searched by its first letter. `selectOption` has nothing to select against,
 * so every suite that files a product goes through here instead.
 *
 * Typing is deliberate rather than writing the hidden field directly: what
 * these suites assert is that an admin can still file a part, and reaching
 * past the control they would actually use would assert nothing.
 *
 * @returns the id the form will post.
 */
export async function pickOption(page, name, label) {
  const box = comboFor(page, name);
  await box.waitFor({ state: "visible", timeout: 15_000 });
  await box.click();
  await box.fill(label);
  await page.waitForTimeout(350);

  const option = page.locator('[role="option"]', { hasText: label }).first();
  await option.waitFor({ state: "visible", timeout: 10_000 });
  await option.click();
  await page.waitForTimeout(250);

  return page.locator(`input[type="hidden"][name="${name}"]`).inputValue();
}

/** The labels a SearchableSelect currently offers, for asserting on them. */
export async function optionLabels(page, name, query = "") {
  const box = comboFor(page, name);
  await box.click();
  if (query) await box.fill(query);
  await page.waitForTimeout(350);
  const labels = await page.locator('[role="option"]').allInnerTexts();
  await box.press("Escape");
  return labels;
}

/** The typing box that belongs to the hidden field of this name. */
const comboFor = (page, name) =>
  page.locator(`div:has(> input[type="hidden"][name="${name}"]) > [role="combobox"]`).first();
