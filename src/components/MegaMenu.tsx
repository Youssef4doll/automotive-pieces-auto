"use client";

import { useState } from "react";
import Link from "next/link";
import CategoryThumb from "./CategoryThumb";
import SubcategoryTile from "./SubcategoryTile";

export type MegaMenuChild = {
  id: string;
  name: string;
  slug: string;
  count: number;
  /** Uploaded from /admin/catalogue; null falls back to the family drawing. */
  imageUrl: string | null;
};

export type MegaMenuFamily = {
  id: string;
  name: string;
  slug: string;
  /** Parts behind this family — its own plus every subcategory's. */
  count: number;
  imageUrl: string | null;
  children: MegaMenuChild[];
};

/** Two-pane hover flyout: a fixed-width list of families on the start side,
 * and the currently-hovered family's subcategories on the end side — same
 * structure as the reference design's desktop mega-menu (not a flat grid
 * dumping every family's subcategories at once).
 *
 * Both panes carry pictures, for the reason in CategoryThumb: sixteen family
 * names in a column is a wall of text, and the shape of a brake disc is read
 * faster than the word "Freinage". */
export default function MegaMenu({
  families,
  onNavigate,
}: {
  families: MegaMenuFamily[];
  onNavigate?: () => void;
}) {
  const [active, setActive] = useState(0);
  const activeFamily = families[active] ?? families[0];

  return (
    <div className="absolute top-full inset-x-0 z-40">
      {/* The rail is wider than it was: a picture went into every row, and at
          264px "Direction et trains roulants" lost three more words to the
          ellipsis than it could afford. */}
      <div className="mx-auto max-w-7xl bg-white text-navy-950 shadow-2xl border-b-[3px] border-gold-500 grid grid-cols-[316px_1fr] h-[min(460px,70vh)]">
        <div className="border-e border-gray-200 bg-[#fafbfd] overflow-y-auto py-2.5">
          {families.map((family, i) => (
            <Link
              key={family.id}
              href={`/catalogue/${family.slug}`}
              onClick={onNavigate}
              onMouseEnter={() => setActive(i)}
              className={`flex items-center gap-2.5 ps-3.5 pe-4 py-1.5 font-heading font-bold uppercase text-[13.5px] tracking-wide border-s-[3px] hover:text-red-600 ${
                i === active ? "bg-white border-red-500" : "border-transparent"
              }`}
            >
              <CategoryThumb slug={family.slug} imageUrl={family.imageUrl} size={30} />
              <span className="flex-1 min-w-0 truncate">{family.name}</span>
              <span className="shrink-0 flex items-baseline gap-1.5">
                {/* Parts, not subcategories — the same number the subcategory
                    links below carry, and the one that tells the shopper
                    whether the family is worth opening. */}
                <span className="text-[12px] font-normal tabular-nums text-gray-600">
                  {family.count}
                </span>
                <span className="text-[10px] opacity-50 rtl:rotate-180">▶</span>
              </span>
            </Link>
          ))}
        </div>
        <div className="p-6 sm:p-8 overflow-y-auto">
          {activeFamily && (
            <>
              <Link
                href={`/catalogue/${activeFamily.slug}`}
                onClick={onNavigate}
                className="inline-block font-heading font-extrabold uppercase text-[16px] tracking-wide border-b-2 border-gold-500 pb-1.5 hover:text-red-600"
              >
                {activeFamily.name}
              </Link>
              {/* Picture-led tiles, not a list — see SubcategoryTile for why.
                  auto-fill rather than auto-fit: a family with only two or
                  three subcategories should leave the rest of the row empty,
                  not stretch two tiles into two enormous ones. */}
              <div
                className="mt-4 grid gap-1"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
              >
                {activeFamily.children.map((sub) => (
                  <SubcategoryTile
                    key={sub.id}
                    href={`/catalogue/${activeFamily.slug}/${sub.slug}`}
                    onClick={onNavigate}
                    slug={sub.slug}
                    imageUrl={sub.imageUrl}
                    name={sub.name}
                    size={76}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
