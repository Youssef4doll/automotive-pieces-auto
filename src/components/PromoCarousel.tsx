"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { track } from "@/lib/track";

export type Promo = {
  id: string;
  title: string;
  imageUrl: string;
  href: string | null;
};

const AUTO_MS = 6000;

/**
 * The homepage deals strip. Built on native scroll-snap rather than a JS
 * slider: swiping is the browser's own gesture, so it feels native on a
 * phone, needs no library, and keeps working if JS is slow to hydrate.
 * Auto-advance is a convenience only — it stops permanently the moment the
 * shopper interacts, and never runs under prefers-reduced-motion.
 */
export default function PromoCarousel({ promos }: { promos: Promo[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [userEngaged, setUserEngaged] = useState(false);

  const goTo = useCallback((i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const slide = el.children[i] as HTMLElement | undefined;
    if (slide) el.scrollTo({ left: slide.offsetLeft, behavior: "smooth" });
  }, []);

  // Track which slide is centred, from real scroll position — so the dots
  // stay correct whether the shopper swiped or tapped.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = Math.round(el.scrollLeft / el.clientWidth);
        setIndex(Math.max(0, Math.min(promos.length - 1, i)));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [promos.length]);

  useEffect(() => {
    if (userEngaged || promos.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      const el = trackRef.current;
      if (!el || document.hidden) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % promos.length;
      goTo(next);
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [userEngaged, promos.length, goTo]);

  if (promos.length === 0) return null;

  const stop = () => setUserEngaged(true);

  return (
    // w-full matters here: <main> is a column flex container, and `mx-auto`
    // on a flex item cancels cross-axis stretch, so the section shrink-wraps
    // to its content's min-content width — which for an overflow-x-auto
    // track is 0. Sibling sections survive without it only because their
    // content has intrinsic width.
    <section
      aria-roledescription="carousel"
      aria-label="Promotions"
      className="w-full mx-auto max-w-7xl px-gutter pt-4"
    >
      <div className="relative">
        <div
          ref={trackRef}
          onPointerDown={stop}
          onWheel={stop}
          className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar rounded-xl scroll-smooth"
        >
          {promos.map((p, i) => {
            const img = (
              <Image
                src={p.imageUrl}
                alt={p.title}
                fill
                sizes="(max-width: 1280px) 100vw, 1280px"
                className="object-cover"
                priority={i === 0}
              />
            );
            const inner = (
              <div className="relative w-full aspect-[16/7] sm:aspect-[21/7] bg-gray-100 overflow-hidden rounded-xl">
                {img}
              </div>
            );
            return (
              <div
                key={p.id}
                className="w-full shrink-0 snap-center"
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} / ${promos.length}: ${p.title}`}
              >
                {p.href ? (
                  // `block` is required: an inline <a> gives the aspect-ratio
                  // child no width to resolve against, collapsing the slide
                  // to 0×0 even though the image itself loads fine.
                  <Link
                    href={p.href}
                    className="block w-full"
                    onClick={() => track("promo_clicked", { id: p.id, title: p.title })}
                  >
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </div>
            );
          })}
        </div>

        {promos.length > 1 && (
          <>
            {/* Arrows are a desktop affordance; on a phone the swipe is the
                interaction and the arrows would just cover the artwork. */}
            <button
              onClick={() => { stop(); goTo(Math.max(0, index - 1)); }}
              aria-label="Précédent"
              className="hidden sm:flex absolute start-2 top-1/2 -translate-y-1/2 w-tap h-tap items-center justify-center rounded-full bg-white/85 hover:bg-white text-navy-900 shadow-md disabled:opacity-0"
              disabled={index === 0}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="rtl-flip">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <button
              onClick={() => { stop(); goTo(Math.min(promos.length - 1, index + 1)); }}
              aria-label="Suivant"
              className="hidden sm:flex absolute end-2 top-1/2 -translate-y-1/2 w-tap h-tap items-center justify-center rounded-full bg-white/85 hover:bg-white text-navy-900 shadow-md disabled:opacity-0"
              disabled={index === promos.length - 1}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="rtl-flip">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </>
        )}
      </div>

      {promos.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2.5">
          {promos.map((p, i) => (
            <button
              key={p.id}
              onClick={() => { stop(); goTo(i); }}
              aria-label={`${p.title}`}
              aria-current={i === index}
              className="h-tap-compact px-1 flex items-center"
            >
              <span
                className={`block h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-navy-900" : "w-1.5 bg-navy-900/25"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
