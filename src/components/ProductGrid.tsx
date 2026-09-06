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

export default function ProductGrid({
  products,
  /**
   * Swipe instead of stack, below sm.
   *
   * For a strip on a page that is about something else — the home page's "most
   * ordered", say. Six cards two-up is three rows and about 1,400px of a phone
   * page that was already ten screens long, spent on a row the visitor did not
   * come for. Swiping shows the same six and costs one screen. A catalogue
   * listing is the opposite case and keeps the grid: there, the products are
   * the page, and hiding half of them behind a gesture would be wrong.
   */
  scrollOnPhone = false,
}: {
  products: CardProduct[];
  scrollOnPhone?: boolean;
}) {
  const vehicle = useVehicle((s) => s.vehicle);

  const ordered = useMemo(() => {
    if (!vehicle) return products;
    return products
      .map((p, i) => ({ p, i }))
      .sort((a, b) => compatRank(a.p, vehicle.engineId) - compatRank(b.p, vehicle.engineId) || a.i - b.i)
      .map(({ p }) => p);
  }, [products, vehicle]);

  if (scrollOnPhone) {
    return (
      // Bleeds to the screen edges so the row reads as scrollable rather than
      // as a grid that has been cut off, the same way "Racheter en un clic"
      // does in the account.
      <div className="w-full min-w-0 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar sm:overflow-visible">
        <div className="flex gap-3 w-max sm:w-auto sm:grid sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
          {ordered.map((p) => (
            // A fixed width, not a vw one. vw resolves against the layout
            // viewport, and on a phone the layout viewport grows to fit
            // content that overflows — so a card sized in vw inside a row
            // that is wider than the screen feeds its own width back into
            // itself. The page zoomed out to 1122px before this was px.
            <div key={p.id} className="w-[180px] sm:w-auto shrink-0">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {ordered.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
