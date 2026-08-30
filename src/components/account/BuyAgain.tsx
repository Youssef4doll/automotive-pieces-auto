"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/lib/cart-store";
import Price from "@/components/Price";

export type BuyAgainItem = {
  productId: string;
  name: string;
  sku: string;
  slug: string;
  imageUrl: string;
  unitPrice: number;
  stockQty: number;
  lastBought: string;
  timesBought: number;
};

/**
 * Parts wear out on a schedule, so the thing a returning customer most often
 * wants is the thing they bought last time. Making that one tap — from the
 * page they land on — is the highest-leverage repeat-purchase mechanic this
 * shop has, and it needs no new data: it is their own order history.
 */
export default function BuyAgain({ items }: { items: BuyAgainItem[] }) {
  const add = useCart((s) => s.add);
  const [added, setAdded] = useState<Record<string, boolean>>({});

  if (items.length === 0) return null;

  function addOne(item: BuyAgainItem) {
    add({
      productId: item.productId,
      name: item.name,
      sku: item.sku,
      slug: item.slug,
      imageUrl: item.imageUrl,
      unitPrice: item.unitPrice,
      stockQty: item.stockQty,
    });
    setAdded((s) => ({ ...s, [item.productId]: true }));
  }

  return (
    <section aria-labelledby="buy-again" className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <h2 id="buy-again" className="font-heading font-extrabold uppercase text-navy-950 tracking-tight">
          Racheter
        </h2>
        <p className="text-xs text-gray-500">Vos pièces déjà commandées</p>
      </div>

      {/* A horizontal rail on a phone keeps this to one screen-height; a grid
          on wider screens uses the space instead of stretching four cards. */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar sm:overflow-visible">
        <ul className="flex gap-3 w-max sm:w-auto sm:grid sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const out = item.stockQty <= 0;
            const justAdded = added[item.productId];
            return (
              <li
                key={item.productId}
                className="w-[230px] sm:w-auto shrink-0 border border-gray-200 rounded-lg p-3 flex gap-3"
              >
                <Link href={`/produit/${item.slug}`} className="shrink-0">
                  <Image
                    src={item.imageUrl}
                    alt=""
                    width={56}
                    height={56}
                    className="w-14 h-14 rounded-md object-cover bg-gray-50 border border-gray-100"
                  />
                </Link>
                <div className="flex-1 min-w-0 flex flex-col">
                  <Link
                    href={`/produit/${item.slug}`}
                    className="flex items-start min-h-tap-compact text-sm font-medium text-navy-950 leading-snug line-clamp-2 hover:text-red-600"
                  >
                    {item.name}
                  </Link>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {item.timesBought > 1 ? `${item.timesBought} achats · ` : ""}
                    {item.lastBought}
                  </p>
                  <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                    <Price value={item.unitPrice} className="text-sm font-bold text-navy-950 whitespace-nowrap" />
                    <button
                      onClick={() => addOne(item)}
                      disabled={out}
                      aria-label={`Ajouter ${item.name} au panier`}
                      className={`min-h-tap-compact px-3 rounded-lg text-xs font-display font-bold uppercase tracking-wide shrink-0 ${
                        out
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : justAdded
                            ? "bg-green-600 text-white"
                            : "bg-gold-500 hover:bg-gold-400 text-navy-950"
                      }`}
                    >
                      {out ? "Rupture" : justAdded ? "✓ Ajouté" : "Ajouter"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
