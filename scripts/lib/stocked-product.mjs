/**
 * Something to buy, found rather than assumed.
 *
 * Suites that need an order used to walk to a hard-coded category and click
 * the first "Ajouter au panier" on it. That worked until the battery had
 * bought that category out: twenty-odd real orders run through these suites
 * every pass, stock is really decremented, and nothing puts it back. The
 * "Filtres" family reached zero across a day of runs, and two suites started
 * crashing on a disabled button — a failure about stock, reported as a
 * failure about e-mail.
 *
 * This asks the database what is actually buyable and drives that product's
 * own page, which needs no assumption about which family it is in or how the
 * listing happens to be sorted.
 */

/**
 * The most-stocked buyable product, or null if the shop is genuinely empty.
 *
 * `catalogPath` is the listing page it appears on, so a suite that needs to
 * test a *card* rather than a product page has somewhere to go that is
 * guaranteed to hold something buyable.
 */
export async function findStockedProduct(prisma, minQty = 1) {
  const product = await prisma.product.findFirst({
    where: { active: true, stockQty: { gte: minQty }, sku: { not: { startsWith: "PACK-" } } },
    orderBy: { stockQty: "desc" },
    select: {
      id: true, slug: true, name: true, sku: true, stockQty: true,
      category: { select: { slug: true, parent: { select: { slug: true } } } },
    },
  });
  if (!product) return null;
  const { category } = product;
  return {
    ...product,
    catalogPath: category.parent
      ? `/catalogue/${category.parent.slug}/${category.slug}`
      : `/catalogue/${category.slug}`,
  };
}

/**
 * Put one in the basket, from the product's own page.
 *
 * Returns the product used, so a caller can say in its output what it bought
 * — a suite that fails should name the part it was working with.
 */
export async function addStockedToCart(page, prisma, BASE) {
  const product = await findStockedProduct(prisma);
  if (!product) return null;
  await page.goto(`${BASE}/produit/${product.slug}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /Ajouter au panier/i }).first().click();
  await page.waitForTimeout(700);
  return product;
}
