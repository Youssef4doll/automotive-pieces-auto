"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useSheet } from "@/lib/use-sheet";
import { useLocale } from "@/i18n/LocaleProvider";

/**
 * The filters, on a phone: a labelled button above the grid, a tab pinned to
 * the edge of the screen, and one sheet that either of them opens.
 *
 * The button alone is what this used to be, and by the time a shopper has
 * scrolled far enough to *want* to narrow a list, a control at the top of the
 * page is not a control at all — so most people simply kept scrolling. A tab
 * alone fixes that and loses the word "Filtres", which is what tells a
 * first-time visitor the filters are there. Keeping both costs one fixed 44px
 * strip and settles the argument.
 *
 * The panel inside is the desktop sidebar's, passed in rather than rebuilt, so
 * the two can never offer different filters. Below the panel sits the one
 * thing a sheet needs that a sidebar does not: a way to say "done" that also
 * tells you what you are going back to.
 *
 * Phones only — from `lg` up the sidebar is on screen permanently and a tab
 * over it would be a second way to do a thing already visible.
 */
export default function FilterSheet({
  children,
  activeCount,
  resultCount,
}: {
  children: ReactNode;
  /** How many filters are on, for the badge — 0 hides it. */
  activeCount: number;
  /** What is on screen behind the sheet, so "done" can name it. */
  resultCount: number;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  // Stable across renders: useSheet holds it in an effect dependency list, and
  // a fresh closure every render would tear the listener down and re-add it.
  const close = useCallback(() => setOpen(false), []);
  useSheet(open, close, "apaFilters");

  return (
    <>
      {/* Two ways in, because they answer different questions.

          The button, in the flow above the grid where the old one was, is the
          one that *teaches*: it is labelled, it is where a shopper who has
          never used this site looks, and it reads as part of the page.

          The tab is the one that *stays*. It is fixed, so it is still there
          four screens down where the button is long gone — and it is
          icon-only and 44px wide, because a permanent opaque strip over the
          catalogue has to earn every pixel. Written out at a readable size
          the word "Filtres" makes that strip 68px, a sixth of a phone screen,
          sitting on top of parts; shrunk to fit, it is unreadable, which is
          no label at all. The button upstream is what carries the word. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex min-h-tap items-center gap-2 self-start rounded-lg border border-navy-900/15 bg-white px-4 text-sm font-semibold text-navy-950 lg:hidden"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        {t("cat.filters")}
        {activeCount > 0 && (
          <span className="rounded-full bg-gold-500 px-1.5 text-xs font-bold text-navy-950">{activeCount}</span>
        )}
      </button>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t("cat.filters")}
        className="fixed end-0 top-1/2 z-40 grid h-12 w-11 -translate-y-1/2 place-items-center rounded-s-xl bg-navy-950 text-white shadow-lg lg:hidden"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        {activeCount > 0 && (
          <span className="absolute -start-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-gold-500 text-[12px] font-bold text-navy-950 shadow">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label={t("cat.filters")}>
          {/* Light scrim, as on the cart: the shopper has to be able to see
              the list they are narrowing. */}
          <div className="absolute inset-0 bg-navy-950/35 motion-safe:animate-[fade-in_180ms_ease-out]" onClick={close} />

          <div className="absolute inset-y-0 end-0 flex w-[86%] max-w-sm flex-col bg-white shadow-2xl sheet-end">
            <div className="flex items-center justify-between border-b border-navy-900/10 px-4 py-3">
              <h2 className="font-heading text-lg font-extrabold text-navy-950">{t("cat.filters")}</h2>
              <button
                type="button"
                onClick={close}
                aria-label={t("cart.dismiss")}
                className="grid h-10 w-10 place-items-center rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>

            {/* Every filter here is a link that navigates, so this button
                closes rather than applies — and it says what closing returns
                to, which is the number the shopper was trying to change. */}
            <div className="border-t border-navy-900/10 p-3">
              <button
                type="button"
                onClick={close}
                className="inline-flex min-h-tap w-full items-center justify-center rounded-lg bg-gold-500 font-display text-sm font-bold uppercase tracking-wide text-navy-950"
              >
                {t("cat.showResults").replace("{count}", String(resultCount))}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
