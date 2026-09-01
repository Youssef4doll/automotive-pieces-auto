"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/lib/cart-store";

export type ReorderItem = {
  productId: string;
  name: string;
  sku: string;
  slug: string;
  imageUrl: string;
  unitPrice: number;
  stockQty: number;
  qty: number;
};

/**
 * Buying the same part again is the most common thing a returning customer
 * does on a parts shop, and doing it by hand meant finding each line in the
 * catalogue again. Lines whose product has since been deleted or gone out of
 * stock are skipped and reported rather than silently dropped.
 */
export default function ReorderButton({ items }: { items: ReorderItem[] }) {
  const add = useCart((s) => s.add);
  const open = useCart((s) => s.open);
  const router = useRouter();
  const [skipped, setSkipped] = useState<string[]>([]);

  const available = items.filter((i) => i.stockQty > 0);
  if (items.length === 0) return null;

  function reorder() {
    const missed: string[] = [];
    for (const i of items) {
      if (i.stockQty <= 0) {
        missed.push(i.name);
        continue;
      }
      for (let n = 0; n < Math.min(i.qty, i.stockQty); n++) {
        add({
          productId: i.productId,
          name: i.name,
          sku: i.sku,
          slug: i.slug,
          imageUrl: i.imageUrl,
          unitPrice: i.unitPrice,
          stockQty: i.stockQty,
        });
      }
    }
    setSkipped(missed);
    if (missed.length < items.length) {
      open();
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-1.5 items-start">
      <button
        onClick={reorder}
        disabled={available.length === 0}
        className="inline-flex items-center gap-1.5 min-h-tap px-4 rounded-lg bg-navy-900 hover:bg-navy-800 disabled:bg-gray-200 disabled:text-gray-600 text-white font-display font-bold uppercase text-xs tracking-wide"
      >
        Commander à nouveau
      </button>
      {available.length === 0 && (
        <span className="text-xs text-gray-500">Ces pièces ne sont plus disponibles</span>
      )}
      {skipped.length > 0 && (
        <span className="text-xs text-amber-600">Non ajouté (rupture) : {skipped.join(", ")}</span>
      )}
    </div>
  );
}
