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

  const compatible = vehicle ? product.fitments.some((f) => f.engineId === vehicle.engineId) : null;
  const outOfStock = product.stockQty <= 0;
  const lowStock = !outOfStock && product.stockQty <= product.lowStockThreshold;
  const discount =
    product.compareAtPrice && product.compareAtPrice > product.priceSell
      ? Math.round((1 - product.priceSell / product.compareAtPrice) * 100)
      : null;

  return (
    <div className="group bg-white rounded-xl border border-gray-200 hover:border-navy-300 hover:shadow-lg transition overflow-hidden flex flex-col">
      <Link href={`/produit/${product.slug}`} className="relative block aspect-square bg-gray-50 overflow-hidden">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 50vw, 25vw"
        />
        {product.isTopSeller && (
          <span className="absolute top-2 start-2 bg-navy-900 text-white text-[10px] font-bold px-2 py-1 rounded">
            TOP VENTE
          </span>
        )}
        {discount && (
          <span className="absolute top-2 end-2 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded">
            -{discount}%
          </span>
        )}
      </Link>

      <div className="p-3 flex flex-col gap-1.5 flex-1">
        {product.brand && (
          <span className="text-[10px] font-semibold text-gray-400 uppercase">{product.brand.name}</span>
        )}
        <Link href={`/produit/${product.slug}`} className="text-sm font-medium text-navy-900 line-clamp-2 hover:text-red-600 min-h-10">
          {product.name}
        </Link>

        {compatible === true && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700">
            ✓ {t("compat.compatible")}
          </span>
        )}
        {compatible === false && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
            ? {t("compat.check")}
          </span>
        )}

        <div className="flex items-center gap-2 text-[11px]">
          {outOfStock ? (
            <span className="text-red-600 font-medium">{t("product.outOfStock")}</span>
          ) : lowStock ? (
            <span className="text-amber-600 font-medium">⚠ {t("product.lowStock")}</span>
          ) : (
            <span className="text-green-700 font-medium">● {t("product.inStock")}</span>
          )}
          <span className="text-gray-300">·</span>
          <span className="text-gray-500">{t("trust.cod")}</span>
        </div>

        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          <div className="flex flex-col">
            {product.compareAtPrice && product.compareAtPrice > product.priceSell && (
              <Price value={product.compareAtPrice} className="text-[11px] text-gray-400 line-through" />
            )}
            <Price value={product.priceSell} className="font-bold text-navy-900" />
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
            className="w-10 h-10 shrink-0 rounded-lg bg-navy-900 hover:bg-navy-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white flex items-center justify-center"
            aria-label={t("product.addToCart")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
