import "server-only";
import type { Prisma, SupplyMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { availabilityOf } from "@/lib/availability";
import { toNumber } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { didYouMean, fold, parseQuery, rankProducts, recordSearchMiss } from "@/lib/search";
import { groupOeReferences, type OeGroup } from "@/lib/reference";
import { cartDeliveryQuote, shippingFeeFor, type DeliveryMethod } from "@/lib/shipping";
import { taxPolicy } from "@/lib/tax";

// ---------------------------------------------------------------------------
// The catalogue, shaped for the phone app.
//
// The storefront renders these rows in Server Components; the app cannot, so
// it gets them over /api/v1 as JSON. Everything in this file follows the
// three rules `listAppProducts` set when the first app endpoint was written:
//
//   availability is derived here, through lib/availability, and sent as a
//   CODE — the rule has one home and the app writes its own three languages;
//
//   the fitment verdict is computed here against the engine the customer
//   chose, because doing it on the phone would mean shipping it the fitment
//   table;
//
//   a photograph is only a photograph the shop uploaded. The seeded stand-in
//   is a picture of three unrelated parts, so the app draws the family
//   instead, and the family slug travels with every row for that reason.
//
// One mapper, `toAppProduct`, turns a row into that shape for every endpoint —
// listings, search, the product page, the basket. They were about to become
// four copies of the same fifteen lines, and a fitment rule that drifted
// between the search results and the basket would tell one customer two
// different things about the same brake pad.
// ---------------------------------------------------------------------------

export type FitmentVerdict = "FITS" | "UNKNOWN" | "DOES_NOT_FIT";

export type AppProduct = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  brand: string | null;
  categorySlug: string;
  familySlug: string;
  price: number;
  /** Struck-through reference price, when the shop has actually set one. */
  compareAtPrice: number | null;
  availability: "IN_STOCK" | "ON_ORDER" | "UNAVAILABLE";
  /** Only when the shop set a low-stock threshold and stock is at or under it. */
  lowStockQty: number | null;
  /** A real photograph, or null — which is most of the catalogue. */
  imageUrl: string | null;
  /**
   * How this part relates to the engine the customer chose. Null when no
   * engine was supplied: "we have not been told your car" is a different
   * statement from "we do not know whether this fits it".
   */
  fitment: FitmentVerdict | null;
};

/** The columns `toAppProduct` reads, and nothing else. */
export function appProductSelect(engineId?: string) {
  return {
    id: true,
    name: true,
    slug: true,
    sku: true,
    priceSell: true,
    compareAtPrice: true,
    stockQty: true,
    lowStockThreshold: true,
    supply: true,
    brand: { select: { name: true } },
    category: { select: { slug: true, parent: { select: { slug: true } } } },
    images: { orderBy: { order: "asc" as const }, take: 1, select: { id: true } },
    _count: { select: { fitments: true } },
    // Only the rows matching THIS engine come back, so the verdict is "some
    // row matched" without fetching the part's whole fitment list.
    ...(engineId ? { fitments: { where: { engineId }, take: 1, select: { id: true } } } : {}),
  } satisfies Prisma.ProductSelect;
}

type AppProductRow = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  priceSell: unknown;
  compareAtPrice: unknown;
  stockQty: number;
  lowStockThreshold: number;
  supply: SupplyMode;
  brand: { name: string } | null;
  category: { slug: string; parent: { slug: string } | null };
  images: { id: string }[];
  _count: { fitments: number };
  fitments?: { id: string }[];
};

export function toAppProduct(p: AppProductRow, engineId?: string): AppProduct {
  const state = availabilityOf({ stockQty: p.stockQty, supply: p.supply });

  let fitment: FitmentVerdict | null = null;
  if (engineId) {
    // No fitment rows at all is UNKNOWN, never "fits everything". That
    // distinction is the whole compatibility feature: most of this catalogue
    // has no fitment data, and saying so is the honest answer.
    if (p._count.fitments === 0) fitment = "UNKNOWN";
    else fitment = p.fitments?.length ? "FITS" : "DOES_NOT_FIT";
  }

  const uploaded = p.images[0]?.id;

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    brand: p.brand?.name ?? null,
    categorySlug: p.category.slug,
    familySlug: p.category.parent?.slug ?? p.category.slug,
    price: toNumber(p.priceSell),
    compareAtPrice: p.compareAtPrice ? toNumber(p.compareAtPrice) : null,
    availability: state,
    lowStockQty: state === "IN_STOCK" && p.stockQty <= p.lowStockThreshold ? p.stockQty : null,
    imageUrl: uploaded ? `/api/images/${uploaded}` : null,
    fitment,
  };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export type AppSearchMatch = "reference" | "text" | "fuzzy";

export type AppSearchResult = {
  query: string;
  products: (AppProduct & { match: AppSearchMatch })[];
  /** Families and subcategories whose name the query reads as. */
  families: { name: string; slug: string; familySlug: string; parentName: string | null }[];
  brands: { name: string; productCount: number }[];
  /** A correction to OFFER — the query is never silently rewritten. */
  didYouMean: string | null;
};

const MATCH: Record<number, AppSearchMatch> = { 0: "reference", 1: "text", 2: "fuzzy" };

/**
 * The shop's search, for the app.
 *
 * One function for the type-ahead and the results page, on purpose. The
 * website's suggestion route says it best: a suggestion that leads somewhere
 * different from the search it came from is worse than no suggestion. So the
 * list under the box and the page after Enter are the same ranking —
 * `rankProducts`, with its reference tier, its every-word tier and its
 * misspelling rescue — asked for a different number of rows.
 *
 * `submitted` separates the two for exactly one purpose: a query that finds
 * nothing is written to the shop's demand log only when the customer
 * actually asked it, not on every keystroke on the way to asking it. The log
 * counts wants, and "p", "pl", "pla" are not wants.
 */
export async function searchForApp(
  raw: string,
  options: { engineId?: string; take?: number; submitted?: boolean } = {},
): Promise<AppSearchResult> {
  const parsed = parseQuery(raw);
  const empty: AppSearchResult = { query: raw, products: [], families: [], brands: [], didYouMean: null };
  if (!parsed.folded) return empty;

  const take = Math.min(Math.max(options.take ?? 20, 1), 40);
  // Families are matched on the expanded query too, so "kit distri" offers
  // the Distribution family and not only the parts in it.
  const haystacks = [parsed.folded, ...parsed.canonical, ...parsed.tokens].filter((h) => h.length >= 2);

  const [hits, categories, brands] = await Promise.all([
    rankProducts(parsed, take),
    haystacks.length
      ? prisma.category.findMany({
          where: {
            OR: haystacks.map((h) => ({ name: { contains: h, mode: "insensitive" as const } })),
            // Never offer a family with nothing in it.
            AND: {
              OR: [
                { products: { some: { active: true } } },
                { children: { some: { products: { some: { active: true } } } } },
              ],
            },
          },
          select: { name: true, slug: true, parent: { select: { slug: true, name: true } } },
          take: 4,
        })
      : Promise.resolve([]),
    prisma.brand.findMany({
      where: { name: { contains: raw.trim(), mode: "insensitive" }, products: { some: { active: true } } },
      select: { name: true, _count: { select: { products: { where: { active: true } } } } },
      take: 3,
    }),
  ]);

  const rows = hits.length
    ? await prisma.product.findMany({
        where: { id: { in: hits.map((h) => h.id) } },
        select: appProductSelect(options.engineId),
      })
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));

  // Back into rank order, which Postgres cannot preserve through an `in`.
  const products = hits
    .map((h) => {
      const row = byId.get(h.id);
      return row ? { ...toAppProduct(row, options.engineId), match: MATCH[h.tier] ?? "text" } : null;
    })
    .filter((p): p is AppProduct & { match: AppSearchMatch } => p !== null);

  const typed = fold(raw).slice(0, 3);

  const result: AppSearchResult = {
    query: raw,
    products,
    families: categories.map((c) => ({
      name: c.name,
      slug: c.slug,
      familySlug: c.parent?.slug ?? c.slug,
      parentName: c.parent?.name ?? null,
    })),
    // Only when the customer is plausibly typing the brand's name, not
    // because a synonym happened to brush against it.
    brands: brands
      .filter((b) => fold(b.name).startsWith(typed))
      .map((b) => ({ name: b.name, productCount: b._count.products })),
    didYouMean: null,
  };

  // A correction is offered only when the literal reading came back thin —
  // offering one above a page that already answered is second-guessing a
  // customer who was right.
  const literal = products.filter((p) => p.match !== "fuzzy").length;
  if (literal === 0) {
    const suggestion = await didYouMean(parsed);
    result.didYouMean = suggestion?.term ?? null;
  }

  if (options.submitted && products.length === 0) await recordSearchMiss(parsed);

  return result;
}

// ---------------------------------------------------------------------------
// One product
// ---------------------------------------------------------------------------

export type AppCompatibleVehicle = {
  make: string;
  model: string;
  engine: string;
  engineId: string;
  fuel: string | null;
  powerHp: number | null;
  engineCode: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  /**
   * The row was inferred by the import from a sibling engine rather than
   * stated by a supplier. The website prints it differently; so does the app.
   */
  derived: boolean;
};

export type AppProductDetail = AppProduct & {
  description: string;
  /** Every uploaded photograph, in the shop's order. Empty for most parts. */
  gallery: string[];
  category: { name: string; slug: string };
  family: { name: string; slug: string };
  axle: "AVANT" | "ARRIERE" | null;
  side: "GAUCHE" | "DROITE" | null;
  /**
   * The shop's free-form specification rows, as the shop typed them.
   *
   * The labels are the owner's own words and arrive in French whatever the
   * phone's language — they are data, like a product name, not interface.
   * Translating them here would mean guessing at what "Ø" or "Épaisseur mini"
   * was meant to say.
   */
  specs: { label: string; value: string }[];
  oeGroups: OeGroup[];
  aftermarketRefs: { type: string; brand: string; raw: string }[];
  packContents: { name: string; slug: string; price: number }[];
  compatibility: {
    /** Every engine this part is listed for. The list below may be shorter. */
    total: number;
    vehicles: AppCompatibleVehicle[];
  };
  manufacturer: {
    name: string;
    legalName: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
  } | null;
  /** `supplier_lead_time`, only when the shop has filled it in. */
  leadTime: string | null;
};

/** Enough engines to answer "is mine there?" on a phone, not a catalogue dump. */
const COMPATIBILITY_SHOWN = 60;

export async function getAppProduct(slug: string, engineId?: string): Promise<AppProductDetail | null> {
  const [row, settings] = await Promise.all([
    prisma.product.findFirst({
      // `active` matters as much as the price does: deactivating a part is how
      // the shop withdraws it, and a stale link must not keep selling it.
      where: { slug, active: true },
      select: {
        ...appProductSelect(engineId),
        description: true,
        specs: true,
        oemRefs: true,
        axle: true,
        side: true,
        category: {
          select: { slug: true, name: true, parent: { select: { slug: true, name: true } } },
        },
        images: { orderBy: { order: "asc" }, select: { id: true } },
        brand: {
          select: {
            name: true,
            legalName: true,
            street: true,
            postalCode: true,
            city: true,
            country: true,
            phone: true,
            email: true,
            website: true,
          },
        },
        references: {
          select: { type: true, brand: true, raw: true, normalized: true },
          orderBy: [{ brand: "asc" }, { raw: "asc" }],
        },
      },
    }),
    getSettings(),
  ]);
  if (!row) return null;

  const [fitments, packContents] = await Promise.all([
    prisma.productFitment.findMany({
      where: { productId: row.id },
      select: {
        engineId: true,
        confidence: true,
        engine: {
          select: {
            name: true,
            fuel: true,
            powerHp: true,
            engineCode: true,
            yearFrom: true,
            yearTo: true,
            model: { select: { name: true, make: { select: { name: true } } } },
          },
        },
      },
      orderBy: [
        { engine: { model: { make: { name: "asc" } } } },
        { engine: { model: { name: "asc" } } },
        { engine: { name: "asc" } },
      ],
    }),
    resolvePackContents(row.specs),
  ]);

  const vehicles: AppCompatibleVehicle[] = fitments.map((f) => ({
    make: f.engine.model.make.name,
    model: f.engine.model.name,
    engine: f.engine.name,
    engineId: f.engineId,
    fuel: f.engine.fuel,
    powerHp: f.engine.powerHp,
    engineCode: f.engine.engineCode,
    yearFrom: f.engine.yearFrom,
    yearTo: f.engine.yearTo,
    derived: f.confidence === "DERIVED",
  }));
  // The customer's own engine first when it is in the list: it is the one
  // row they opened the section to find.
  if (engineId) vehicles.sort((a, b) => Number(b.engineId === engineId) - Number(a.engineId === engineId));

  const specBag = (row.specs as Record<string, unknown> | null) ?? {};
  const specs = Object.entries(specBag)
    // A structured field rendered as its own section, not a human-readable row.
    .filter(([key, value]) => key !== "packContents" && value !== null && String(value).trim() !== "")
    .map(([label, value]) => ({ label, value: String(value) }));

  const b = row.brand;
  const text = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
  const address = b
    ? [text(b.street), [text(b.postalCode), text(b.city)].filter(Boolean).join(" "), text(b.country)]
        .filter((part) => part && part.length > 0)
        .join(", ") || null
    : null;
  const manufacturer =
    b && (text(b.legalName) || address || text(b.phone) || text(b.email) || text(b.website))
      ? {
          name: b.name,
          legalName: text(b.legalName),
          address,
          phone: text(b.phone),
          email: text(b.email),
          website: text(b.website),
        }
      : null;

  const base = toAppProduct(
    {
      ...row,
      brand: b ? { name: b.name } : null,
      images: row.images.slice(0, 1),
    },
    engineId,
  );

  return {
    ...base,
    description: row.description.trim(),
    gallery: row.images.map((i) => `/api/images/${i.id}`),
    category: { name: row.category.name, slug: row.category.slug },
    family: row.category.parent
      ? { name: row.category.parent.name, slug: row.category.parent.slug }
      : { name: row.category.name, slug: row.category.slug },
    axle: row.axle,
    side: row.side,
    specs,
    oeGroups: groupOeReferences(
      row.references.filter((r) => r.type === "OEM"),
      row.oemRefs,
    ),
    aftermarketRefs: row.references
      .filter((r) => r.type !== "OEM")
      .map((r) => ({ type: r.type, brand: r.brand, raw: r.raw })),
    packContents,
    compatibility: { total: vehicles.length, vehicles: vehicles.slice(0, COMPATIBILITY_SHOWN) },
    manufacturer,
    leadTime: settings.supplier_lead_time?.trim() || null,
  };
}

/** A pack's contents by SKU, in the order the pack declares them. */
async function resolvePackContents(specs: unknown) {
  const skus = (specs as { packContents?: string[] } | null)?.packContents;
  if (!Array.isArray(skus) || skus.length === 0) return [];
  const parts = await prisma.product.findMany({
    where: { sku: { in: skus }, active: true },
    select: { sku: true, name: true, slug: true, priceSell: true },
  });
  const bySku = new Map(parts.map((p) => [p.sku, p]));
  return skus
    .map((sku) => bySku.get(sku))
    .filter((p): p is (typeof parts)[number] => !!p)
    .map((p) => ({ name: p.name, slug: p.slug, price: toNumber(p.priceSell) }));
}

// ---------------------------------------------------------------------------
// The basket, priced by the shop
// ---------------------------------------------------------------------------

export type AppCartLine = {
  productId: string;
  qty: number;
  /** Null when the part has been withdrawn or deleted since it was added. */
  product: AppProduct | null;
  /** Current price × qty. Zero for a line that cannot be bought. */
  lineTotal: number;
  /** False for a withdrawn part, or one the shop can no longer source. */
  buyable: boolean;
  /** More than is on the shelf: the shop orders the difference in. */
  backorder: boolean;
};

export type AppCartQuote = {
  lines: AppCartLine[];
  subtotal: number;
  deliveryMethod: DeliveryMethod;
  deliveryFee: number;
  stampDuty: number;
  total: number;
  freeShippingThreshold: number;
  /** How much more would earn free delivery; 0 once it is earned. */
  remainingForFree: number;
  /** True when at least one line has to come out before checkout. */
  blocked: boolean;
};

/**
 * What this basket costs, according to the shop.
 *
 * The app keeps the basket — which parts, how many — and never the price.
 * A price stored on the phone is a price from whenever the part was added,
 * and the brief's rule is that nothing the client sends is believed about
 * money. So every time the basket is looked at, it is sent here as ids and
 * quantities and comes back priced by the same functions checkout charges
 * with: `shippingFeeFor`, `taxPolicy`, the live `priceSell`. The number on
 * the basket screen and the number on the order are then one computation,
 * not two that happen to agree.
 *
 * Lines are refused the way checkout refuses them — a withdrawn part, or one
 * at zero that the shop cannot source — and they stay in the answer marked
 * unbuyable rather than silently disappearing, because a customer whose
 * brake pads vanished from their basket without a word has no way to know
 * what happened.
 */
export async function quoteAppCart(input: {
  items: { productId: string; qty: number }[];
  engineId?: string;
  deliveryMethod?: DeliveryMethod;
}): Promise<AppCartQuote> {
  const method = input.deliveryMethod ?? "DELIVERY";
  const ids = [...new Set(input.items.map((i) => i.productId))];

  const [rows, settings] = await Promise.all([
    ids.length
      ? prisma.product.findMany({
          where: { id: { in: ids }, active: true },
          select: appProductSelect(input.engineId),
        })
      : Promise.resolve([]),
    getSettings(),
  ]);
  const byId = new Map(rows.map((r) => [r.id, r]));

  const lines: AppCartLine[] = input.items.map((item) => {
    const row = byId.get(item.productId);
    if (!row) return { productId: item.productId, qty: item.qty, product: null, lineTotal: 0, buyable: false, backorder: false };
    const product = toAppProduct(row, input.engineId);
    const buyable = product.availability !== "UNAVAILABLE";
    return {
      productId: item.productId,
      qty: item.qty,
      product,
      lineTotal: buyable ? product.price * item.qty : 0,
      buyable,
      backorder: buyable && row.stockQty < item.qty,
    };
  });

  const subtotal = round(lines.reduce((s, l) => s + l.lineTotal, 0));
  const freeShippingThreshold = Number(settings.free_shipping_threshold) || 150;
  const { stampDuty } = taxPolicy(settings);
  const deliveryFee = shippingFeeFor(subtotal, freeShippingThreshold, method);
  // The delivery-case quote is what decides how far off free delivery is,
  // whichever method is chosen — pickup is free anyway.
  const { remainingForFree } = cartDeliveryQuote(subtotal, freeShippingThreshold, stampDuty);

  return {
    lines,
    subtotal,
    deliveryMethod: method,
    deliveryFee,
    stampDuty,
    total: round(subtotal + deliveryFee + stampDuty),
    freeShippingThreshold,
    remainingForFree: round(remainingForFree),
    blocked: lines.some((l) => !l.buyable),
  };
}

/** Money to the millime, so 0.1 + 0.2 never reaches a customer. */
function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
