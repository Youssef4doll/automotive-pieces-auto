"use client";

import { useMemo } from "react";
import ProductCard, { type CardProduct } from "./ProductCard";
import { useVehicle } from "@/lib/vehicle-store";

// Amazon-style relevance: once a vehicle is set, float what actually fits
// (and universal parts) to the top instead of making the shopper scan past
// mismatches — without hiding anything or disturbing the chosen sort within
// each bucket.
function compatRank(p: CardProduct, engineId: string) {
  if (p.fitments.length === 0) return 1; // universal / unspecified
  return p.fitments.some((f) => f.engineId === engineId) ? 0 : 2;
}

export default function ProductGrid({ products }: { products: CardProduct[] }) {
  const vehicle = useVehicle((s) => s.vehicle);

  const ordered = useMemo(() => {
    if (!vehicle) return products;
    return products
      .map((p, i) => ({ p, i }))
      .sort((a, b) => compatRank(a.p, vehicle.engineId) - compatRank(b.p, vehicle.engineId) || a.i - b.i)
      .map(({ p }) => p);
  }, [products, vehicle]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {ordered.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
