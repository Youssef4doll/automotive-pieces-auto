"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/i18n/LocaleProvider";

export type BoardBrand = { id: string; name: string; logoUrl: string | null };

/** How many tiles a phone shows before the shopper asks for the rest. */
const PHONE_PREVIEW = 9;

/**
 * The brand tiles, and the control that reaches the ones a phone folds away.
 *
 * The board shows every brand from 640px up and nine below it, because
 * nineteen tiles three across is seven rows on a home page that is already
 * nine screens long. What was missing was the way back: the heading counted
 * every brand the shop carries — twenty-six of them, now — and a phone could
 * reach nine of them, with nothing on screen to say the other seventeen
 * existed or how to see them. "Do you carry Valeo?" had no answer below the
 * letter F.
 *
 * So the fold stays and gets a door. One button under the grid, naming the
 * real number, expanding the same grid in place.
 *
 * **Not a horizontal carousel**, which is the other obvious answer and the
 * wrong one here. This board is scanned, not paged: a shopper looking for
 * their own brand wants to sweep twenty-six marks with their eyes, and a
 * strip shows three at a time and asks them to swipe nine times to find out
 * whether the shop stocks Valeo. A grid answers that in one glance. The
 * arrows a carousel needs are also the least reliable tap target on a phone,
 * where the gesture is a swipe and the arrow is decoration.
 */
export default function BrandGrid({ brands }: { brands: BoardBrand[] }) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    // Collapsing from the bottom of a long board would otherwise leave the
    // shopper somewhere in the middle of the next section, looking at content
    // they never scrolled to. Put them back at the top of this one.
    if (!next && wrap.current && wrap.current.getBoundingClientRect().top < 0) {
      wrap.current.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }

  return (
    <div ref={wrap}>
      <ul
        id="brand-board"
        className="grid grid-cols-2 gap-2 min-[360px]:grid-cols-3 sm:grid-cols-4 sm:gap-2.5 lg:grid-cols-6 3xl:grid-cols-8"
      >
        {brands.map((b, i) => (
          <li key={b.id} className={expanded || i < PHONE_PREVIEW ? "" : "hidden sm:block"}>
            {/* Search rather than a brand page: the index carries the brand
                on every product, so this lands on everything the shop holds
                from that maker without a route that would otherwise have to
                be kept in step with the catalogue. */}
            <Link
              href={`/recherche?q=${encodeURIComponent(b.name)}`}
              className="flex h-[74px] items-center justify-center rounded-lg border border-navy-900/10 bg-white px-3 transition hover:-translate-y-0.5 hover:border-gold-500 hover:shadow-sm sm:h-[82px]"
            >
              {b.logoUrl ? (
                <span className="relative block h-10 w-full">
                  {/* The slot, not the biggest slot. This said `160px` — the
                      width the tile reaches on a wide screen — at every
                      breakpoint, and the box on a 390px phone is 88px: a 3×
                      screen was being served a 640px-wide rendition of a
                      logo, seven times the pixels it draws. Declared per
                      breakpoint it asks for 384 there instead, and none of
                      these are `vw` values, so Next keeps its full candidate
                      list rather than flooring it. */}
                  <Image
                    src={b.logoUrl}
                    alt={b.name}
                    fill
                    sizes="(max-width: 359px) 120px, (max-width: 639px) 96px, (max-width: 1023px) 128px, 160px"
                    className="object-contain"
                  />
                </span>
              ) : (
                <span className="text-center font-display text-sm font-bold uppercase leading-tight text-navy-900/70">
                  {b.name}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {/* Only where there is something folded away, and only where the fold
          happens: from 640px the board is already whole and the button would
          be a control that does nothing. */}
      {brands.length > PHONE_PREVIEW && (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          aria-controls="brand-board"
          className="mt-2.5 flex min-h-tap w-full items-center justify-center gap-2 rounded-lg border border-navy-900/15 bg-white text-sm font-semibold text-navy-900 transition hover:border-gold-500 hover:bg-gold-500/5 sm:hidden"
        >
          {expanded ? t("home.brandsShowLess") : t("home.brandsShowAll", { count: brands.length })}
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="3" aria-hidden="true"
            className={`transition-transform duration-200 motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
          >
            <path d="m5 8 7 8 7-8" />
          </svg>
        </button>
      )}
    </div>
  );
}
