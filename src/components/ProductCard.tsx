"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useLocale } from "@/i18n/LocaleProvider";
import { useCart } from "@/lib/cart-store";
import { useVehicle, vehicleLabel } from "@/lib/vehicle-store";
import { positionLabels } from "@/lib/position";
import Price from "./Price";

export type CardProduct = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  description: string;
  imageUrl: string;
  priceSell: number;
  compareAtPrice: number | null;
  stockQty: number;
  lowStockThreshold: number;
  isTopSeller: boolean;
  /** The logo is the brand's own, uploaded in /admin/catalogue/marques. Null
   *  until somebody uploads one, and then the name stands in — never a
   *  generic icon pretending to be a maker's mark. */
  brand: { name: string; logoUrl?: string | null } | null;
  fitments: { engineId: string }[];
  /** Free-form key/value bag filled in from the admin. Empty until somebody
   *  fills it in, and then the list row prints the first few. */
  specs?: unknown;
  /** Manufacturer numbers this part answers to. */
  oemRefs?: string[];
  axle?: string | null;
  side?: string | null;
};

/**
 * One part in a listing.
 *
 * It answers, in this order: whose is it, what is it, does it fit my car, how
 * much, can I have it, when. Nothing on it is decorative, and nothing on it
 * is asserted without data behind it — the "Compatible" pill comes from the
 * fitment table against the saved vehicle, the stock line from the stock
 * count, the delivery line from the shop's settings, the spec rows from the
 * product's own `specs`. A row with nothing behind it is not rendered at all.
 *
 * Two layouts from one component so a grid card and a list row can never say
 * different things about the same part:
 *
 *  - **grid** — the browsing layout. Every row has a reserved height so a row
 *    of cards lines up across; what does not fit is dropped, not squeezed.
 *  - **list** — the comparing layout, built like the specialist parts shops
 *    build theirs: maker's mark, name, labels, the reference, what it is, and
 *    a price block on the right with the quantity beside the button. Rows are
 *    stacked rather than aligned side by side, so nothing here reserves
 *    height it is not using.
 */
export default function ProductCard({
  product,
  layout = "grid",
  delivery,
  priceNote,
}: {
  product: CardProduct;
  layout?: "grid" | "list";
  /** The shop's delivery window, from settings. Absent where the card is not
   *  about buying today (a "you also bought" strip, say). */
  delivery?: string | null;
  /** What the price includes — "TVA 19 % incluse", from the shop's tax
   *  position. Null unless the shop is VAT registered; see lib/tax. */
  priceNote?: string | null;
}) {
  const { t } = useLocale();
  const add = useCart((s) => s.add);
  const vehicle = useVehicle((s) => s.vehicle);
  const [qty, setQty] = useState(1);

  // Three states, not two. `.some()` on an empty fitment list returns false,
  // which previously made "we have not checked this part yet" render as the
  // same warning as "this part is for a different car". They are different
  // facts and a parts shop must not blur them.
  const fit: "yes" | "no" | "unverified" | null = !vehicle
    ? null
    : product.fitments.length === 0
      ? "unverified"
      : product.fitments.some((f) => f.engineId === vehicle.engineId)
        ? "yes"
        : "no";
  const outOfStock = product.stockQty <= 0;
  const lowStock = !outOfStock && product.stockQty <= product.lowStockThreshold;
  const discount =
    product.compareAtPrice && product.compareAtPrice > product.priceSell
      ? Math.round((1 - product.priceSell / product.compareAtPrice) * 100)
      : null;
  const badge = product.isTopSeller ? "topSeller" : lowStock ? "lowStock" : discount ? "discount" : null;
  const list = layout === "list";
  const href = `/produit/${product.slug}`;

  // The reference is worth a line of its own only when it is not already
  // inside the name. Most of this catalogue is named "Filtre à air KAMOKA
  // F235701", and printing F235701 again underneath teaches the shopper to
  // stop reading that line.
  const showRef = !product.name.toLowerCase().includes(product.sku.toLowerCase());

  // What the shop actually knows about this part, in the order a mechanic
  // asks for it. `packContents` is a list of SKUs the product page renders as
  // its own section, not a human-readable spec — printing raw JSON here would
  // be worse than printing nothing.
  const specBag = (product.specs ?? {}) as Record<string, unknown>;
  const position = positionLabels(product.axle, product.side);
  //
  // Order matters, because only the first few are shown: where it goes, then
  // the manufacturer's numbers, then the shop's own measurements. A
  // cross-reference is what a mechanic matches a part by; a height in
  // millimetres is what they check afterwards, and it must not push the
  // number that identifies the part off the card.
  const facts: { label: string; value: string }[] = [
    ...(position.length > 0 ? [{ label: t("product.position"), value: position.join(" · ") }] : []),
    ...((product.oemRefs ?? []).length > 0
      ? [{ label: t("product.oemRefs"), value: (product.oemRefs ?? []).slice(0, 3).join(", ") }]
      : []),
    ...Object.entries(specBag)
      .filter(([key, value]) => key !== "packContents" && value !== null && value !== undefined && `${value}`.trim() !== "")
      .map(([label, value]) => ({ label, value: `${value}` })),
  ];
  const SHOWN_FACTS = 4;

  // A part can be two things at once — it fits your car AND it is the one
  // people buy. Both used to be pinned to opposite corners of the picture,
  // which is fine on a 280px card and collided into an unreadable stack of
  // pills on a 170px one. They live in one wrapping row now: side by side
  // where there is room, stacked where there is not, never on top of each
  // other.
  //
  // Wrapping, rather than shrinking the type, is what makes that work. 11px
  // fitted two on one line at 170px and broke the site's own legibility
  // floor to do it — a label nobody can read is not a label. The padding
  // gives way instead; the type does not.
  const pill =
    "inline-flex items-center rounded px-1.5 py-0.5 text-[12px] font-display font-bold uppercase leading-4 tracking-wide @[13rem]:px-2";

  /**
   * @param overlay laid over the picture (grid) rather than set in the text
   *   column (list). Over a picture the status pill goes to the far corner;
   *   inline it sits next to the compatibility pill, because a 112px
   *   thumbnail is no place to stack two labels.
   */
  const badgeRow = (overlay: boolean) =>
    fit !== "yes" && !badge ? null : (
      <span
        className={
          overlay
            ? "pointer-events-none absolute inset-x-1.5 top-1.5 flex flex-wrap items-start justify-between gap-1 @[13rem]:inset-x-2 @[13rem]:top-2"
            : "flex flex-wrap items-center gap-1.5"
        }
      >
        {fit === "yes" && (
          <span className={`${pill} gap-1 rounded-full border border-green-200 bg-green-50 normal-case text-green-700`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m4 12.5 5 5L20 6.5" />
            </svg>
            {t("compat.badge")}
          </span>
        )}
        {badge && (
          <span
            className={`${pill} ${overlay ? "ms-auto" : ""} ${
              badge === "topSeller" ? "bg-navy-900 text-white" : "bg-red-600 text-white"
            }`}
          >
            {badge === "discount" ? `-${discount}%` : badge === "topSeller" ? t("product.topSeller") : t("product.lowStock")}
          </span>
        )}
      </span>
    );

  /** The maker's mark: the brand's own logo, or its name set in type. Never a
   *  stand-in drawing — an invented logo is a claim about a manufacturer. */
  const brandMark = (
    <span className="flex min-h-5 items-center">
      {product.brand?.logoUrl ? (
        <span className={`relative block h-5 ${list ? "w-full" : "w-24"}`}>
          <Image src={product.brand.logoUrl} alt={product.brand.name} fill sizes="96px" className="object-contain object-left" />
        </span>
      ) : (
        <span className="truncate text-xs font-bold uppercase leading-4 tracking-wide text-navy-900/60">
          {product.brand?.name ?? " "}
        </span>
      )}
    </span>
  );

  const picture = (
    <Link
      href={href}
      className={`group/img relative block overflow-hidden bg-white ${
        list ? "aspect-square w-full rounded-lg bg-gray-50/60" : "aspect-square @[13rem]:aspect-[4/3] border-b border-navy-900/6"
      }`}
    >
      {/* object-contain, not cover: a part is photographed on white, or drawn
          to its own edges, and cropping either to fill a box is how a brake
          disc becomes half a brake disc. */}
      <Image
        src={product.imageUrl}
        alt={product.name}
        fill
        className="object-contain p-2 @[13rem]:p-3 transition-transform duration-300 group-hover/img:scale-[1.04]"
        sizes={list ? "160px" : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"}
      />
      {!list && badgeRow(true)}
    </Link>
  );

  const title = (
    <Link
      href={href}
      // Reads as a link, because it is one: the part's name is the most
      // useful target on the card, and in heading-navy it was the one thing
      // on it that did not invite a click (e2e-loop guards this).
      //
      // In the grid: two lines, always — clamped so a long name cannot push
      // the price down, floored so a short one cannot pull it up, because a
      // row of cards has to read across. In a list that floor is dead space.
      className={`font-semibold leading-snug text-navy-700 underline-offset-2 decoration-1 hover:text-red-600 hover:underline ${
        list
          ? "line-clamp-2 text-[15px] sm:text-base"
          : "line-clamp-3 min-h-[63px] text-[15px] @[13rem]:line-clamp-2 @[13rem]:min-h-[42px]"
      }`}
    >
      {product.name}
    </Link>
  );

  const addToCart = () =>
    add({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      slug: product.slug,
      imageUrl: product.imageUrl,
      unitPrice: product.priceSell,
      stockQty: product.stockQty,
    }, qty);

  const addButton = (
    <button
      disabled={outOfStock}
      onClick={addToCart}
      className="inline-flex w-full min-h-tap items-center justify-center gap-2 rounded-lg bg-gold-500 text-navy-950 font-display text-xs font-bold uppercase tracking-wide transition-transform hover:bg-gold-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-gray-200 sm:text-[13px]"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
      </svg>
      {t("product.addToCart")}
    </button>
  );

  const stockLine = outOfStock ? (
    <span className="min-h-4 text-xs font-semibold leading-4 text-red-600">{t("product.outOfStock")}</span>
  ) : (
    <span className="inline-flex min-h-4 items-center gap-1.5 text-xs font-semibold leading-4 text-green-700">
      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
      {t("product.inStock")}
    </span>
  );

  const deliveryLine = delivery ? (
    <span
      className={`inline-flex items-start gap-1.5 text-xs leading-4 text-gray-600 ${outOfStock ? "invisible" : ""}`}
      aria-hidden={outOfStock || undefined}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0" aria-hidden="true">
        <path d="M1 3h13v13H1zM14 8h4l4 4v4h-8z" /><circle cx="5.5" cy="18.5" r="2" /><circle cx="18.5" cy="18.5" r="2" />
      </svg>
      <span className="line-clamp-2 min-w-0">{t("cat.delivery")} {delivery}</span>
    </span>
  ) : null;

  const fitLine = fit ? (
    <span
      className={`min-h-4 truncate text-[12px] leading-4 ${
        fit === "unverified" ? "font-medium text-amber-600" : fit === "no" ? "font-medium text-gray-500" : "text-gray-500"
      }`}
    >
      {fit === "yes" && vehicle
        ? `${t("cat.forYourCar")} ${vehicleLabel(vehicle)}`
        : fit === "no"
          ? t("compat.doesntMatch")
          : `? ${t("compat.unverified")}`}
    </span>
  ) : null;

  const shell =
    "group @container overflow-hidden rounded-2xl border border-navy-900/10 bg-white transition hover:border-navy-900/25 hover:shadow-md";

  /* --------------------------------------------------------------- list --- */

  if (list) {
    return (
      <div className={`${shell} flex flex-row`}>
        {/* The maker's mark sits above the picture rather than in the text
            column, the way the specialist catalogues arrange it: brand first,
            then the part, so a shopper scanning for "the Bosch one" reads
            down a single column instead of across every row. */}
        <div className="flex w-28 shrink-0 flex-col gap-2 border-e border-navy-900/6 p-2.5 sm:w-44 sm:p-3">
          {brandMark}
          {picture}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2 p-3.5 sm:flex-row sm:gap-6 sm:p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {title}

            {/* Labels and the reference on one line, as the parts catalogues
                do it — what it is compatible with, whether it moves, and the
                number to quote, all readable without opening the part. */}
            <div className="flex flex-wrap items-center gap-1.5">
              {badgeRow(false)}
              {showRef && (
                <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 font-mono text-[12px] leading-4 text-gray-600" dir="ltr">
                  {t("product.ref")} {product.sku}
                </span>
              )}
            </div>

            {/* Only what the shop has actually filled in. An empty specs bag
                prints nothing rather than a row of blank labels. */}
            {facts.length > 0 && (
              <dl className="mt-0.5 flex flex-col gap-0.5 text-[13px] leading-5">
                {facts.slice(0, SHOWN_FACTS).map((f) => (
                  <div key={f.label} className="flex min-w-0 gap-2">
                    <dt className="shrink-0 text-gray-500">{f.label} :</dt>
                    <dd className="min-w-0 truncate font-medium text-navy-900">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {facts.length === 0 && product.description && (
              <p className="line-clamp-2 text-[13px] leading-5 text-gray-600">{product.description}</p>
            )}

            {fitLine}

            <Link href={href} className="mt-0.5 inline-flex w-fit items-center gap-1 text-[13px] font-semibold text-navy-900 underline underline-offset-2 hover:text-red-600">
              {facts.length > SHOWN_FACTS ? t("product.showAll") : t("product.seeDetails")}
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          {/* The price block, as the specialists build it: the amount, what it
              replaces and by how much, what it includes, whether it is here,
              and only then the way to buy it. */}
          <div className="flex shrink-0 flex-col gap-1.5 sm:w-52 sm:items-end sm:text-end">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 sm:justify-end">
              <Price value={product.priceSell} className="whitespace-nowrap font-heading text-2xl font-extrabold text-navy-950" />
              {product.compareAtPrice && product.compareAtPrice > product.priceSell && (
                <>
                  <Price value={product.compareAtPrice} className="whitespace-nowrap text-[13px] text-gray-500 line-through" />
                  <span className="inline-flex items-center rounded bg-red-600 px-1.5 py-0.5 text-[12px] font-display font-bold leading-4 text-white">
                    -{discount}%
                  </span>
                </>
              )}
            </div>

            {/* What the price includes, from the shop's own tax position —
                absent, not guessed, when the shop is not VAT registered. */}
            {priceNote && <span className="text-xs text-gray-500">{priceNote}</span>}

            <div className="flex flex-col gap-0.5 sm:items-end">
              {stockLine}
              {/* Dropped rather than hidden here. The grid reserves this space
                  so out-of-stock cards keep their buttons in line with their
                  neighbours'; a list row has no neighbour to line up with, so
                  reserving it just puts a gap under "Rupture de stock". */}
              {!outOfStock && deliveryLine}
            </div>

            {/* Quantity beside the button, not on the page after it. Buying
                four brake pads is the normal case in this shop, and the cart
                already carries a quantity — this is the one place it was
                being thrown away. Capped by what is actually in stock. */}
            <div className="mt-1 flex w-full items-center gap-2 sm:w-48">
              <label className="sr-only" htmlFor={`qty-${product.id}`}>
                {t("product.quantity")}
              </label>
              <select
                id={`qty-${product.id}`}
                value={qty}
                disabled={outOfStock}
                onChange={(e) => setQty(Number(e.target.value))}
                className="min-h-tap rounded-lg border border-gray-300 bg-white px-2 text-sm font-semibold text-navy-950 outline-none focus:border-gold-500 disabled:bg-gray-100"
              >
                {Array.from({ length: Math.max(1, Math.min(10, product.stockQty || 1)) }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <div className="min-w-0 flex-1">{addButton}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* --------------------------------------------------------------- grid --- */

  return (
    <div
      // A container, so the compare price below can decide by how much room
      // this card actually has rather than by how wide the window is — the
      // same card is 180px in the home page's swipe strip and 280px in a
      // catalogue grid at the same viewport.
      className={`${shell} flex flex-col`}
    >
      {picture}

      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3.5 sm:p-4">
        {/* Every row below carries its own reserved height, so the price, the
            stock line and the button land at the same offset on every card in
            a row whatever the part is called and whether or not it has a
            struck-through price.

            The heights are the line boxes of the sizes they hold, and there is
            one place to change each. Stretching the cards to a common height
            was not enough on its own: it equalised the outsides and left the
            insides staggered, which is what the shopper's eye actually
            follows down a grid. */}
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          {brandMark}
          {title}
          {fitLine}
        </div>

        <div className="mt-auto flex flex-col gap-1.5 pt-2">
          {/* nowrap on each price: in the 2-column mobile grid the amount and
              its currency were breaking across lines ("89.00" / "DT"), which
              reads as a broken layout. They wrap as whole units instead.
              min-h holds exactly one line box, and nothing here may wrap out
              of it — a card whose price ran to two lines pushed its own stock
              line and button 18px below its neighbours'.

              The struck-through price is therefore shown only on a card with
              room for it beside the real one. On a narrow card it is dropped
              rather than wrapped, and nothing is lost: the discount is already
              stated on the picture, as "-15%". */}
          <div className="flex min-h-7 items-baseline gap-x-2">
            <Price value={product.priceSell} className="whitespace-nowrap font-heading text-xl font-extrabold text-navy-950" />
            {product.compareAtPrice && product.compareAtPrice > product.priceSell && (
              <Price
                value={product.compareAtPrice}
                className="hidden whitespace-nowrap text-xs text-gray-500 line-through @[13rem]:inline"
              />
            )}
          </div>

          {/* One availability line, then one delivery line — both facts. The
              delivery line is only true of something that can be delivered,
              so an out-of-stock card keeps the space and says nothing in it
              rather than making a promise it cannot keep. */}
          <div className="flex flex-col gap-0.5">
            {stockLine}
            {delivery && (
              <span
                className={`hidden min-h-8 items-start gap-1.5 text-xs leading-4 text-gray-600 @[13rem]:inline-flex ${outOfStock ? "invisible" : ""}`}
                aria-hidden={outOfStock || undefined}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0" aria-hidden="true">
                  <path d="M1 3h13v13H1zM14 8h4l4 4v4h-8z" /><circle cx="5.5" cy="18.5" r="2" /><circle cx="18.5" cy="18.5" r="2" />
                </svg>
                <span className="line-clamp-2 min-w-0">{t("cat.delivery")} {delivery}</span>
              </span>
            )}
          </div>

          <div className="mt-1.5">{addButton}</div>
        </div>
      </div>
    </div>
  );
}
