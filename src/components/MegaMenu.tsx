"use client";

import { useState } from "react";
import Link from "next/link";

export type MegaMenuFamily = {
  id: string;
  name: string;
  slug: string;
  children: { id: string; name: string; slug: string; count: number }[];
};

/** Two-pane hover flyout: a fixed-width list of families on the start side,
 * and the currently-hovered family's subcategories on the end side — same
 * structure as the reference design's desktop mega-menu (not a flat grid
 * dumping every family's subcategories at once). */
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
      <div className="mx-auto max-w-7xl bg-white text-navy-950 shadow-2xl border-b-[3px] border-gold-500 grid grid-cols-[264px_1fr] h-[min(460px,70vh)]">
        <div className="border-e border-gray-200 bg-[#fafbfd] overflow-y-auto py-2.5">
          {families.map((family, i) => (
            <Link
              key={family.id}
              href={`/catalogue/${family.slug}`}
              onClick={onNavigate}
              onMouseEnter={() => setActive(i)}
              className={`flex items-center justify-between gap-2.5 px-5 py-2.5 font-heading font-bold uppercase text-[12.5px] tracking-wide border-s-[3px] hover:text-red-600 ${
                i === active ? "bg-white border-red-500" : "border-transparent"
              }`}
            >
              <span className="truncate">{family.name}</span>
              <span className="shrink-0 flex items-baseline gap-1.5">
                <span className="text-[11px] font-normal tabular-nums text-gray-600">
                  {family.children.length}
                </span>
                <span className="text-[9px] opacity-50 rtl:rotate-180">▶</span>
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
                className="inline-block font-heading font-extrabold uppercase text-[15px] tracking-wide border-b-2 border-gold-500 pb-1.5 hover:text-red-600"
              >
                {activeFamily.name}
              </Link>
              <div
                className="mt-4.5 grid gap-x-7 gap-y-2.5"
                style={{ gridTemplateColumns: "repeat(auto-fit, minmax(168px, 1fr))" }}
              >
                {activeFamily.children.map((sub) => (
                  <Link
                    key={sub.id}
                    href={`/catalogue/${activeFamily.slug}/${sub.slug}`}
                    onClick={onNavigate}
                    className="group flex items-baseline gap-1.5 py-1 text-[13.5px] text-navy-600 hover:text-red-600"
                  >
                    <span className="truncate group-hover:underline underline-offset-2">{sub.name}</span>
                    {/* Beside the name, not pushed to the far edge: these
                        columns are wide, and justify-between stranded the
                        number 400px from the label it belongs to. */}
                    <span className="shrink-0 text-[12px] tabular-nums text-gray-600">({sub.count})</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
