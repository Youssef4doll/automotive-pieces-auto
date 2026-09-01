"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/lib/cart-store";
import { useVehicle } from "@/lib/vehicle-store";
import { formatTNDfr } from "@/lib/money";
import { IconRepeat, IconCheck, IconArrowRight } from "./icons";

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
  /** Engines this part is listed for, so compatibility can be stated honestly. */
  fitmentEngineIds: string[];
};

/**
 * Parts wear out on a schedule, so what a returning customer most often wants
 * is what they bought last time. This is that, in one tap, from the page they
 * land on — and it needs no new data: it is their own history.
 */
export default function BuyAgain({
  items,
  title = "Racheter en un clic",
  showLink = true,
}: {
  items: BuyAgainItem[];
  title?: string;
  showLink?: boolean;
}) {
  const add = useCart((s) => s.add);
  const vehicle = useVehicle((s) => s.vehicle);
  const [added, setAdded] = useState<Record<string, boolean>>({});

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="buy-again" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <h2 id="buy-again" className="font-heading font-extrabold uppercase text-navy-950 tracking-tight">
            {title}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Vos pièces déjà commandées, prêtes à être ajoutées au panier.
          </p>
        </div>
        {showLink && (
          <Link
            href="/compte/pieces"
            className="inline-flex items-center gap-1 min-h-tap-compact text-xs font-semibold text-navy-900 hover:text-red-600"
          >
            Tout voir <IconArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar sm:overflow-visible">
        <ul className="flex gap-3 w-max sm:w-auto sm:grid sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const out = item.stockQty <= 0;
            const justAdded = added[item.productId];
            // Only claimed when the fitment table actually says so.
            const fits = vehicle ? item.fitmentEngineIds.includes(vehicle.engineId) : false;
            return (
              <li
                key={item.productId}
                className="w-[268px] sm:w-auto shrink-0 rounded-xl border border-slate-200 p-3 flex flex-col hover:border-slate-300 hover:shadow-sm transition-all"
              >
                <div className="flex gap-3">
                  <Link href={`/produit/${item.slug}`} className="shrink-0">
                    <Image
                      src={item.imageUrl}
                      alt=""
                      width={64}
                      height={64}
                      loading="lazy"
                      className="w-16 h-16 rounded-lg object-cover bg-slate-50 border border-slate-100"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/produit/${item.slug}`}
                      className="flex items-start min-h-tap-compact text-sm font-semibold text-navy-950 leading-snug line-clamp-2 hover:text-red-600"
                    >
                      {item.name}
                    </Link>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Acheté le {item.lastBought}
                      {item.timesBought > 1 ? ` · ${item.timesBought} fois` : ""}
                    </p>
                  </div>
                </div>

                {fits && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-100 rounded-md px-2 py-1 self-start">
                    <IconCheck className="w-3.5 h-3.5" /> Compatible avec votre {vehicle!.makeName} {vehicle!.modelName}
                  </p>
                )}

                <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                  <span className="text-base font-heading font-extrabold text-navy-950 tabular-nums whitespace-nowrap">
                    {formatTNDfr(item.unitPrice)}
                  </span>
                  <button
                    onClick={() => {
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
                    }}
                    disabled={out}
                    aria-label={`Racheter ${item.name}`}
                    className={`inline-flex items-center gap-1.5 min-h-tap-compact px-3 rounded-lg text-xs font-display font-bold uppercase tracking-wide shrink-0 transition-colors active:scale-[0.98] ${
                      out
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : justAdded
                          ? "bg-green-700 text-white"
                          : "bg-gold-500 hover:bg-gold-400 text-navy-950"
                    }`}
                  >
                    {out ? (
                      "Rupture"
                    ) : justAdded ? (
                      <>
                        <IconCheck className="w-3.5 h-3.5" /> Ajouté
                      </>
                    ) : (
                      <>
                        <IconRepeat className="w-3.5 h-3.5" /> Racheter
                      </>
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
