"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/i18n/LocaleProvider";
import { useCart } from "@/lib/cart-store";
import { useVehicle } from "@/lib/vehicle-store";
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

export default function ProductCard({ product }: { product: CardProduct }) {
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

  return (
    <div className="group bg-white rounded-xl border border-gray-200 hover:border-navy-300 hover:shadow-lg transition overflow-hidden flex flex-col">
      <Link href={`/produit/${product.slug}`} className="relative block aspect-square bg-gray-50 overflow-hidden">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
        {badge === "discount" && (
          <span className="absolute top-2 start-2 bg-red-600 text-white text-[12px] font-display font-bold uppercase px-2 py-1 rounded">
            -{discount}%
          </span>
        )}
        {badge === "topSeller" && (
          <span className="absolute top-2 start-2 bg-navy-900 text-white text-[12px] font-display font-bold uppercase px-2 py-1 rounded">
            {t("product.topSeller")}
          </span>
        )}
        {badge === "lowStock" && (
          <span className="absolute top-2 start-2 bg-red-600 text-white text-[12px] font-display font-bold uppercase px-2 py-1 rounded">
            {t("product.lowStock")}
          </span>
        )}
      </Link>

      <div className="p-4 flex flex-col gap-1.5 flex-1">
        <Link
          href={`/produit/${product.slug}`}
          // Reads as a link, because it is one. Uppercase navy looked like a
          // heading, so the most useful target on the card — the part's name —
          // was the one thing that did not invite a click. Sentence case keeps
          // long reference-heavy names readable at a glance.
          className="font-semibold text-[15px] leading-snug text-navy-600 hover:text-red-600 hover:underline underline-offset-2 decoration-1 min-h-tap-compact flex items-center"
        >
          {product.name}
        </Link>
        {/* The description line and the two "voir la page / aperçu rapide"
            links were removed: both links pointed at the same product page
            the image and title already link to, so they added three tappable
            things per card that all did the same thing. A card only has to
            answer: what is it, does it fit, is it available, how much. */}
        {fit === "yes" && (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-green-700">
            ✓ {t("compat.compatible")}
          </span>
        )}
        {fit === "no" && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-gray-500">
            {t("compat.doesntMatch")}
          </span>
        )}
        {fit === "unverified" && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-amber-600">
            ? {t("compat.unverified")}
          </span>
        )}

        {/* One availability line, not two — "Expédié aujourd'hui" was
            printed twice on every card. */}
        <div className="text-xs">
          {outOfStock ? (
            <span className="text-red-600 font-semibold">{t("product.outOfStock")}</span>
          ) : (
            <span className="text-green-700 font-semibold">● {t("product.inStock")} — {t("product.shippedToday")}</span>
          )}
        </div>

        {/* nowrap on each price: in the 2-column mobile grid the amount and its
            currency were breaking across lines ("89.00" / "DT"), which reads
            as a broken layout. They wrap as whole units instead. */}
        <div className="mt-auto pt-2 flex items-baseline gap-x-2 gap-y-0.5 flex-wrap">
          {product.compareAtPrice && product.compareAtPrice > product.priceSell && (
            <Price value={product.compareAtPrice} className="text-xs text-gray-400 line-through whitespace-nowrap" />
          )}
          <Price value={product.priceSell} className="text-xl font-heading font-extrabold text-navy-950 whitespace-nowrap" />
        </div>

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
          className="mt-2 w-full min-h-tap rounded-lg bg-gold-500 hover:bg-gold-400 active:scale-[0.98] transition-transform disabled:bg-gray-200 disabled:cursor-not-allowed text-navy-950 font-display font-bold uppercase text-xs sm:text-sm tracking-wide"
        >
          {t("product.addToCart")}
        </button>
      </div>
    </div>
  );
}
