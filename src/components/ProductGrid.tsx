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
  layout = "grid",
  delivery,
  priceNote,
}: {
  products: CardProduct[];
  scrollOnPhone?: boolean;
  /** A list of rows instead of a grid of cards — the catalogue's toggle,
   *  offered on every screen size. */
  layout?: "grid" | "list";
  /** The shop's delivery window, printed on each card. */
  delivery?: string | null;
  /** What the price includes — "TVA 19 % incluse" — or null when the shop is
   *  not VAT registered and there is nothing true to say. */
  priceNote?: string | null;
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
        {/* Six products, so six columns is the row this section is for: one
            line of the shop's best, rather than four and an orphan two.
            That used to wait for 3xl (1800px) — a second monitor — and every
            laptop got the orphan row. It now lands at 90rem, measured rather
            than guessed: the shell is 85vw, so a six-up card is 183px at
            1440 and 197px at 1536, either side of the 180px the phone row
            already ships and proves readable. At 1280 the same rule would
            give 162px, narrower than anything on the site, so four columns
            keep that width. */}
        <div className="flex gap-3 w-max sm:w-auto sm:grid sm:grid-cols-3 lg:grid-cols-4 wide:grid-cols-6 sm:gap-4">
          {ordered.map((p) => (
            // A fixed width, not a vw one. vw resolves against the layout
            // viewport, and on a phone the layout viewport grows to fit
            // content that overflows — so a card sized in vw inside a row
            // that is wider than the screen feeds its own width back into
            // itself. The page zoomed out to 1122px before this was px.
            <div key={p.id} className="w-[180px] sm:w-auto shrink-0">
              <ProductCard product={p} delivery={delivery} priceNote={priceNote} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (layout === "list") {
    return (
      <div className="flex flex-col gap-3">
        {ordered.map((p) => (
          <ProductCard key={p.id} product={p} layout="list" delivery={delivery} priceNote={priceNote} />
        ))}
      </div>
    );
  }

  // Columns step where the card would otherwise get cramped, not where the
  // viewport happens to cross a round number. The shell follows the screen
  // (see .shell-w) and the sidebar takes a fixed 280px off this grid, so at a
  // 1280px laptop four columns were 172px cards — the width of a two-up phone
  // card, on a desktop. Three there, four from 1536, five from 1800: about
  // 230px at every desktop width, and never narrower as the screen grows.
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 gap-3 sm:gap-4">
      {ordered.map((p) => (
        <ProductCard key={p.id} product={p} delivery={delivery} priceNote={priceNote} />
      ))}
    </div>
  );
}
