"use client";

import Image from "next/image";
import { useLocale } from "@/i18n/LocaleProvider";
import { useCart } from "@/lib/cart-store";
import Price from "./Price";

export type Pack = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  description: string;
  imageUrl: string;
  priceSell: number;
  compareAtPrice: number | null;
  stockQty: number;
  contents: { name: string; price: number }[];
};

export default function PackCard({ pack }: { pack: Pack }) {
  const { t } = useLocale();
  const add = useCart((s) => s.add);

  const savings =
    pack.compareAtPrice && pack.compareAtPrice > pack.priceSell
      ? Math.round(pack.compareAtPrice - pack.priceSell)
      : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col">
      <div className="relative aspect-[16/9] bg-gray-50">
        <Image
          src={pack.imageUrl}
          alt={pack.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover"
        />
        {savings > 0 && (
          <span className="absolute top-3 start-3 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded">
            -{savings} DT
          </span>
        )}
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-heading font-extrabold uppercase text-navy-950 text-lg">{pack.name}</h3>
        <p className="text-sm text-gray-500 mt-1.5">{pack.description}</p>

        <p className="text-xs font-bold text-gray-400 uppercase mt-4 mb-2">{t("packs.contents")}</p>
        <ul className="flex flex-col gap-1.5 mb-4">
          {pack.contents.map((item) => (
            <li key={item.name} className="flex justify-between items-center text-sm">
              <span className="flex items-center gap-2 text-gray-700">
                <span className="w-1.5 h-1.5 rounded-full bg-gold-500 shrink-0" />
                {item.name}
              </span>
              <Price value={item.price} className="text-gray-400" />
            </li>
          ))}
        </ul>

        <div className="mt-auto flex items-baseline gap-2 mb-4">
          {pack.compareAtPrice && pack.compareAtPrice > pack.priceSell && (
            <Price value={pack.compareAtPrice} className="text-sm text-gray-400 line-through" />
          )}
          <Price value={pack.priceSell} className="text-2xl font-heading font-extrabold text-navy-950" />
        </div>

        <button
          disabled={pack.stockQty <= 0}
          onClick={() =>
            add({
              productId: pack.id,
              name: pack.name,
              sku: pack.sku,
              slug: pack.slug,
              imageUrl: pack.imageUrl,
              unitPrice: pack.priceSell,
              stockQty: pack.stockQty,
            })
          }
          className="w-full py-3 rounded-lg bg-gold-500 hover:bg-gold-400 disabled:bg-gray-200 text-navy-950 font-display font-bold uppercase tracking-wide text-sm"
        >
          {t("packs.add")}
        </button>
      </div>
    </div>
  );
}
