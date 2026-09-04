"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/i18n/LocaleProvider";
import type { DictKey } from "@/i18n/dictionaries";
import { track } from "@/lib/track";

export type Campaign = {
  id: string;
  title: string;
  imageUrl: string;
  href: string | null;
  kind: "SEASONAL" | "NEW_ARRIVALS" | "DEAL" | null;
};

const KIND_KEY: Record<NonNullable<Campaign["kind"]>, DictKey> = {
  SEASONAL: "campaign.seasonal",
  NEW_ARRIVALS: "campaign.new",
  DEAL: "campaign.deal",
};

const AUTOPLAY_MS = 6000;

/**
 * The campaign band: seasonal pushes, new arrivals and deals, one wide image
 * at a time, changed by the shop from /admin/promotions without a deploy.
 *
 * Built on native scroll-snap rather than transforms. Swipe, momentum,
 * keyboard scrolling and RTL all come from the browser, the arrows are just
 * `scrollTo`, and the active dot is read back from the scroll position — so
 * there is no internal index that can disagree with what is on screen after a
 * flick. Auto-advance stops for a shopper who is hovering, focused inside, on
 * another tab, or who has asked for reduced motion.
 */
export default function PromoCarousel({
  promos,
  manageHref,
}: {
  promos: Campaign[];
  /** Set only for a signed-in admin: an empty band is otherwise invisible. */
  manageHref?: string | null;
}) {
  const { t } = useLocale();
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback((i: number, smooth = true) => {
    const el = trackRef.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    // In RTL the scroll origin is on the right, and browsers express that as a
    // negative offset — mirroring the target keeps one code path for both.
    el.scrollTo({ left: i * el.clientWidth * (rtl ? -1 : 1), behavior: smooth ? "smooth" : "auto" });
  }, []);

  // The scroll position is the source of truth for which slide is showing.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (el.clientWidth === 0) return;
        setIndex(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (promos.length < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const el = trackRef.current;
      if (!el || el.clientWidth === 0) return;
      const current = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
      goTo((current + 1) % promos.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [promos.length, paused, goTo]);

  if (promos.length === 0) {
    if (!manageHref) return null;
    // Admin-only: shoppers see nothing rather than an empty frame or, worse,
    // a placeholder campaign the shop never actually ran.
    return (
      <section className="w-full mx-auto max-w-7xl px-gutter py-7 sm:py-10">
        <Link
          href={manageHref}
          className="flex items-center justify-center min-h-[120px] sm:min-h-[160px] rounded-lg border-2 border-dashed border-navy-900/15 text-sm font-semibold text-navy-900/50 hover:border-navy-900/35 hover:text-navy-900 transition-colors text-center px-4"
        >
          {t("campaign.empty")}
        </Link>
      </section>
    );
  }

  return (
    <section
      aria-roledescription="carrousel"
      aria-label={t("campaign.region")}
      className="w-full mx-auto max-w-7xl px-gutter py-7 sm:py-10"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="relative">
        <div
          ref={trackRef}
          className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar rounded-lg"
        >
          {promos.map((p, i) => {
            // The kind is spoken, not drawn. Nothing is painted over the
            // artwork: the shop designed the whole rectangle, and a chip in
            // the corner would land on top of whatever it put there.
            const position = `${i + 1} / ${promos.length}`;
            const label = p.kind ? `${t(KIND_KEY[p.kind])} — ${position}` : position;
            const art = (
              <div className="relative w-full aspect-[16/7] sm:aspect-[21/7] bg-gray-100">
                <Image
                  src={p.imageUrl}
                  alt={p.title}
                  fill
                  sizes="(max-width: 1280px) 100vw, 1280px"
                  className="object-cover"
                />
              </div>
            );
            return (
              <div
                key={p.id}
                role="group"
                aria-roledescription="diapositive"
                aria-label={label}
                // Slides that scrolled past stay in the tab order otherwise,
                // so a keyboard user tabs into artwork they cannot see.
                inert={i !== index ? true : undefined}
                className="w-full shrink-0 snap-center"
              >
                {p.href ? (
                  <Link
                    href={p.href}
                    className="block w-full"
                    onClick={() => track("promo_clicked", { id: p.id, title: p.title })}
                  >
                    {art}
                  </Link>
                ) : (
                  art
                )}
              </div>
            );
          })}
        </div>

        {promos.length > 1 && (
          <>
            <CarouselArrow
              side="start"
              label={t("campaign.prev")}
              onClick={() => goTo((index - 1 + promos.length) % promos.length)}
            />
            <CarouselArrow
              side="end"
              label={t("campaign.next")}
              onClick={() => goTo((index + 1) % promos.length)}
            />
          </>
        )}
      </div>

      {promos.length > 1 && (
        <div className="flex justify-center items-center gap-0.5 mt-3">
          {promos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={t("campaign.goTo", { n: i + 1 })}
              aria-current={i === index ? "true" : undefined}
              className="flex items-center justify-center min-w-[28px] min-h-[28px]"
            >
              <span
                className={`block h-2 rounded-full transition-all ${
                  i === index ? "w-6 bg-navy-900" : "w-2 bg-navy-900/25"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function CarouselArrow({
  side,
  label,
  onClick,
}: {
  side: "start" | "end";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      // Shown at every width. Swiping is the natural gesture on a phone and
      // still works, but an arrow is the only affordance that says "there is
      // more than one of these" to somebody who never thinks to swipe — and a
      // carousel whose other slides are undiscoverable is just a slow banner.
      // Smaller and tighter to the edge on a phone so it clears the artwork.
      className={`flex absolute top-1/2 -translate-y-1/2 ${
        side === "start" ? "start-1.5 sm:start-3" : "end-1.5 sm:end-3"
      } w-8 h-8 sm:w-10 sm:h-10 items-center justify-center rounded-full bg-white/90 hover:bg-white shadow-md text-navy-950 transition-colors`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="rtl:rotate-180"
      >
        <path d={side === "start" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
      </svg>
    </button>
  );
}
