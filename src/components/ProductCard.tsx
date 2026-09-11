"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/i18n/LocaleProvider";
import { useCart } from "@/lib/cart-store";
import { useVehicle, vehicleLabel } from "@/lib/vehicle-store";
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
  brand: { name: string } | null;
  fitments: { engineId: string }[];
};

/**
 * One part in a listing.
 *
 * It answers, in this order: whose is it, what is it, does it fit my car, how
 * much, can I have it, when. Nothing on it is decorative, and nothing on it
 * is asserted without data behind it — the "Compatible" pill comes from the
 * fitment table against the saved vehicle, the stock line from the stock
 * count, the delivery line from the shop's settings.
 *
 * Two layouts from one component so a grid card and a list row can never say
 * different things about the same part.
 */
export default function ProductCard({
  product,
  layout = "grid",
  delivery,
}: {
  product: CardProduct;
  layout?: "grid" | "list";
  /** The shop's delivery window, from settings. Absent where the card is not
   *  about buying today (a "you also bought" strip, say). */
  delivery?: string | null;
}) {
  const { t } = useLocale();
  const add = useCart((s) => s.add);
  const vehicle = useVehicle((s) => s.vehicle);

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

  const picture = (
    <Link
      href={`/produit/${product.slug}`}
      className={`group/img relative block overflow-hidden bg-white ${
        list
          ? "w-28 sm:w-40 shrink-0 self-stretch min-h-[7.5rem] border-e border-navy-900/6"
          : "aspect-square @[13rem]:aspect-[4/3] border-b border-navy-900/6"
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
      {fit === "yes" && (
        <span className="absolute top-2 start-2 inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-bold text-green-700">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m4 12.5 5 5L20 6.5" />
          </svg>
          {t("compat.badge")}
        </span>
      )}
      {badge === "discount" && (
        <span className="absolute top-2 end-2 rounded bg-red-600 px-2 py-1 text-[12px] font-display font-bold uppercase text-white">
          -{discount}%
        </span>
      )}
      {badge === "topSeller" && (
        <span className="absolute top-2 end-2 rounded bg-navy-900 px-2 py-1 text-[12px] font-display font-bold uppercase text-white">
          {t("product.topSeller")}
        </span>
      )}
      {badge === "lowStock" && (
        <span className="absolute top-2 end-2 rounded bg-red-600 px-2 py-1 text-[12px] font-display font-bold uppercase text-white">
          {t("product.lowStock")}
        </span>
      )}
    </Link>
  );

  const addButton = (
    <button
      disabled={outOfStock}
      onClick={() =>
        add({
          productId: product.id,
          name: product.name,
          sku: product.sku,
          slug: product.slug,
          imageUrl: product.imageUrl,
          unitPrice: product.priceSell,
          stockQty: product.stockQty,
        })
      }
      className="inline-flex w-full min-h-tap items-center justify-center gap-2 rounded-lg bg-gold-500 text-navy-950 font-display text-xs font-bold uppercase tracking-wide transition-transform hover:bg-gold-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-gray-200 sm:text-[13px]"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
      </svg>
      {t("product.addToCart")}
    </button>
  );

  return (
    <div
      // A container, so the compare price below can decide by how much room
      // this card actually has rather than by how wide the window is — the
      // same card is 180px in the home page's swipe strip and 280px in a
      // catalogue grid at the same viewport.
      className={`group @container flex overflow-hidden rounded-2xl border border-navy-900/10 bg-white transition hover:border-navy-900/25 hover:shadow-md ${
        list ? "flex-row" : "flex-col"
      }`}
    >
      {picture}

      <div className={`flex min-w-0 flex-1 flex-col gap-1 p-3.5 sm:p-4 ${list ? "sm:flex-row sm:items-center sm:gap-6" : ""}`}>
        {/* Every row below carries its own reserved height, so the price,
            the stock line and the button land at the same offset on every
            card in a row whatever the part is called and whether or not it
            has a struck-through price.

            The heights are the line boxes of the sizes they hold, and there
            is one place to change each. Stretching the cards to a common
            height was not enough on its own: it equalised the outsides and
            left the insides staggered, which is what the shopper's eye
            actually follows down a grid. */}
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          {/* Rendered even for a part with no brand on it, so the title below
              starts at the same height either way. */}
          <span className="min-h-4 text-xs font-bold uppercase leading-4 tracking-wide text-navy-900/60">
            {product.brand?.name ?? " "}
          </span>
          <Link
            href={`/produit/${product.slug}`}
            // Reads as a link, because it is one: the part's name is the most
            // useful target on the card, and in heading-navy it was the one
            // thing on it that did not invite a click (e2e-loop guards this).
            // Sentence case keeps long reference-heavy names readable.
            //
            // Two lines, always: clamped so a long name cannot push the price
            // down, and floored so a short one cannot pull it up.
            className="line-clamp-3 min-h-[63px] @[13rem]:line-clamp-2 @[13rem]:min-h-[42px] text-[15px] font-semibold leading-snug text-navy-700 underline-offset-2 decoration-1 hover:text-red-600 hover:underline"
          >
            {product.name}
          </Link>

          {/* One line, present on every card once a vehicle is chosen — the
              three states are mutually exclusive and all say something. */}
          {fit && (
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
          )}
        </div>

        <div className={`flex flex-col gap-1.5 ${list ? "sm:w-48 sm:shrink-0 sm:items-end sm:text-end" : "mt-auto pt-2"}`}>
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
          <div className={`flex min-h-7 items-baseline gap-x-2 ${list ? "sm:justify-end" : ""}`}>
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
          <div className={`flex flex-col gap-0.5 text-xs ${list ? "sm:items-end" : ""}`}>
            {outOfStock ? (
              <span className="min-h-4 font-semibold leading-4 text-red-600">{t("product.outOfStock")}</span>
            ) : (
              <span className="inline-flex min-h-4 items-center gap-1.5 font-semibold leading-4 text-green-700">
                <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
                {t("product.inStock")}
              </span>
            )}
            {delivery && (
              <span
                className={`hidden min-h-8 items-start gap-1.5 leading-4 text-gray-600 @[13rem]:inline-flex ${outOfStock ? "invisible" : ""}`}
                aria-hidden={outOfStock || undefined}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0" aria-hidden="true">
                  <path d="M1 3h13v13H1zM14 8h4l4 4v4h-8z" /><circle cx="5.5" cy="18.5" r="2" /><circle cx="18.5" cy="18.5" r="2" />
                </svg>
                <span className="line-clamp-2 min-w-0">{t("cat.delivery")} {delivery}</span>
              </span>
            )}
          </div>

          <div className={list ? "mt-1 w-full sm:w-44" : "mt-1.5"}>{addButton}</div>
        </div>
      </div>
    </div>
  );
}
