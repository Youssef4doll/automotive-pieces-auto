"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/i18n/LocaleProvider";

export type BoardBrand = { id: string; name: string; logoUrl: string | null };

/**
 * The brand tiles, as a board that pages sideways.
 *
 * Every brand the shop carries is here at every screen size — the board used
 * to show nine on a phone and fold the rest away behind a "see all" button,
 * and before that it simply hid them with no way back at all.
 *
 * **One grid, not one carousel per breakpoint.** The track is a CSS grid with
 * `grid-auto-flow: column` and a fixed number of rows, so tiles fill downwards
 * and then start a new column, and the columns are sized to divide the
 * container exactly: `--cols` of them fit across, whatever `--cols` is at this
 * breakpoint. Nothing is chunked into pages in the markup, which is what makes
 * the same HTML read as four-by-three on a phone and eight-by-three on a
 * desktop without the server having to know which one it is rendering for.
 *
 * A page is therefore just "one container width", which is what the arrows
 * scroll by and what the dots count. Snapping is per column rather than per
 * page, because a column is exactly 1/cols of the width — a page scroll still
 * lands on a boundary, and a half-swipe settles on the nearest column instead
 * of sliding back.
 *
 * The height is now the same whether the shop carries nineteen brands or
 * sixty: rows × tile, and the rest is sideways. That is the part the fold was
 * really for.
 */
export default function BrandGrid({ brands }: { brands: BoardBrand[] }) {
  const { t } = useLocale();
  const track = useRef<HTMLUListElement>(null);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  /**
   * Where we are, read off the element rather than counted in state — a swipe,
   * a keyboard arrow, a trackpad and our own buttons all move the same
   * scroller, and only the scroller knows where it ended up.
   *
   * `scrollLeft` goes negative once the page is in Arabic: in RTL the origin
   * is the right edge and browsers report the offset as a negative number, so
   * everything here works on its magnitude.
   */
  const measure = useCallback(() => {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    const pos = Math.abs(el.scrollLeft);
    const max = el.scrollWidth - el.clientWidth;
    const count = Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth - 0.02));
    setPages(count);
    // Which dot, as a fraction of the distance travelled rather than
    // `pos / clientWidth` — the last page is usually a partial one. At 1024px
    // the track overflows by 167px against a 992px page, so a full page scroll
    // clamps to the end at 167 and the naive sum rounds that to page zero: the
    // board was at its last column with the first dot still lit.
    setPage(max > 0 ? Math.round((pos / max) * (count - 1)) : 0);
    setAtStart(pos <= 1);
    setAtEnd(pos >= max - 1);
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    measure();
    // The column count changes at four breakpoints, and with it the page
    // count — so this watches the box, not just the window.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  function step(forward: boolean) {
    const el = track.current;
    if (!el) return;
    // In RTL "forward" is leftwards, and a negative delta is what moves the
    // scroller that way.
    const rtl = getComputedStyle(el).direction === "rtl";
    const sign = forward === rtl ? -1 : 1;
    // No `behavior` here on purpose. Left unset it defers to the element's
    // own `scroll-behavior`, which is the `scroll-smooth` class — and which
    // globals.css already forces back to `auto` under
    // `prefers-reduced-motion`. Naming "smooth" in the call would override the
    // CSS and take the animation past that setting.
    el.scrollBy({ left: sign * el.clientWidth });
  }

  const arrow = (forward: boolean) => (
    <button
      type="button"
      onClick={() => step(forward)}
      disabled={forward ? atEnd : atStart}
      aria-label={t(forward ? "home.brandsNext" : "home.brandsPrev")}
      aria-controls="brand-board"
      className={`absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-navy-900/12 bg-white text-navy-900 shadow-md transition hover:border-gold-500 hover:text-red-600 disabled:pointer-events-none disabled:opacity-0 sm:grid ${
        forward ? "-end-3" : "-start-3"
      }`}
    >
      {/* Two drawn paths rather than one path and a rotate: `rtl-flip` is the
          site's own utility for "this glyph points at an edge, so mirror it in
          Arabic", and it works by setting `transform` — which a rotate utility
          would then be fighting over. */}
      <svg
        width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="3" aria-hidden="true" className="rtl-flip"
      >
        <path d={forward ? "M8 5l8 7-8 7" : "M16 5l-8 7 8 7"} />
      </svg>
    </button>
  );

  return (
    <div className="relative">
      {arrow(false)}
      {arrow(true)}

      <ul
        id="brand-board"
        ref={track}
        onScroll={measure}
        tabIndex={0}
        role="region"
        aria-label={t("home.brands")}
        // `--cols` is the only thing that changes across breakpoints. The
        // column width divides the container by it, minus the gaps between,
        // so exactly that many columns land inside one page — which is what
        // makes "scroll by clientWidth" a clean page turn at every width.
        //
        // Four rows on a phone and three from 640px, matching how much
        // vertical room the board can fairly take on each.
        className="no-scrollbar grid grid-flow-col grid-rows-4 gap-2 overflow-x-auto overscroll-x-contain scroll-smooth [--cols:3] [--gap:0.5rem] [grid-auto-columns:calc((100%-(var(--cols)-1)*var(--gap))/var(--cols))] [scroll-snap-type:x_mandatory] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 sm:grid-rows-3 sm:gap-2.5 sm:[--cols:4] sm:[--gap:0.625rem] lg:[--cols:6] 3xl:[--cols:8]"
      >
        {brands.map((b) => (
          <li key={b.id} className="[scroll-snap-align:start]">
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

      {/* Where you are, not a control. The gesture on a phone is the swipe and
          on a desktop the arrow; a row of 8px targets would be neither, so
          these stay out of the accessibility tree and the scroller itself
          carries the label and the keyboard focus. */}
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true">
          {Array.from({ length: pages }, (_, i) => (
            <span
              key={i}
              className={`h-[3px] rounded-full transition-all duration-200 motion-reduce:transition-none ${
                i === page ? "w-6 bg-navy-900" : "w-3 bg-navy-900/18"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
