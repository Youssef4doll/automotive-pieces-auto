"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

export type GalleryImage = { src: string; alt: string };

/**
 * The part, shown.
 *
 * What this replaces and why, because every line of it is a correction:
 *
 * **It cropped.** The main image was `object-cover` inside a square, so a part
 * photographed in landscape — which most of them are — lost its ends. On a
 * brake disc that is cosmetic; on a hose or a wiper blade the shape *is* the
 * product, and the shopper was being shown a rectangle cut out of the middle
 * of it. `object-contain` shows the whole part, always.
 *
 * **It was a grey box.** A neutral card with a grey fill and a grey border,
 * which is what "generic catalogue entry" looks like. The plate is white now —
 * so photographs with white backgrounds, which is what suppliers ship, sit on
 * it invisibly instead of inside a second frame — with the site's navy at the
 * edge and a gold rule under the active thumbnail. Mixed backgrounds still
 * read as one catalogue because the plate around them never changes.
 *
 * **It was too big.** A full-width square is 356px of a 390px phone — a third
 * of the first screen, and with it that size the buy button could not reach
 * the fold however tight everything else was. Capped at 240px on a phone,
 * square from `sm` up where there is room for it. Because nothing crops any
 * more, capping the box letterboxes the picture rather than cutting it.
 *
 * **It did not swipe.** Thumbnails only, which is a desktop gesture. The
 * images are a scroll-snap track now: swipe on a phone, click a thumbnail on a
 * desktop — one mechanism, so the two can never disagree about which image is
 * showing. No zoom, no lightbox, nothing to dismiss.
 */
export default function ProductGallery({
  images,
  name,
  discount,
  badge,
}: {
  images: GalleryImage[];
  name: string;
  discount: number | null;
  /** "Top vente" and the like — the shop's own flag, never invented here. */
  badge?: string | null;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // Which slide is in view, read from the track rather than held separately:
  // a swipe and a thumbnail click then cannot end up disagreeing about it.
  const onScroll = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setActive(Math.max(0, Math.min(images.length - 1, i)));
  }, [images.length]);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  const show = (i: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    setActive(i);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-navy-900/10">
        {/* The corner tint is the only colour on the plate: enough that the
            picture sits on something that belongs to this site, not enough to
            compete with the part. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(10,25,60,0.05),transparent_60%)]"
        />

        <div
          ref={track}
          className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar"
          // A track of images is a list of pictures, not a widget: arrow keys
          // scroll it natively and the thumbnails below are the real control.
          role="group"
          aria-label={`Photos de ${name}`}
        >
          {images.map((img, i) => (
            <div
              key={img.src}
              // Capped rather than square on a phone. A full-width square is
              // 356px of a 390px screen, and with the picture that big the buy
              // button could not fit above the fold however tight everything
              // else was. object-contain means capping the box letterboxes the
              // picture instead of cropping it, so nothing is lost.
              className="relative h-60 w-full shrink-0 snap-center sm:aspect-square sm:h-auto"
            >
              <Image
                src={img.src}
                alt={i === 0 ? img.alt || name : `${name} — photo ${i + 1}`}
                fill
                sizes="(max-width: 767px) 100vw, 45vw"
                // contain, never cover: the whole part, whatever shape it is.
                className="object-contain p-3 sm:p-8"
                priority={i === 0}
              />
            </div>
          ))}
        </div>

        {badge && (
          <span className="absolute start-3 top-3 rounded-lg bg-navy-900 px-2.5 py-1.5 font-display text-[11px] font-bold uppercase tracking-wide text-gold-500">
            {badge}
          </span>
        )}
        {discount && (
          <span className="absolute end-3 top-3 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white">
            -{discount}%
          </span>
        )}

        {/* Where you are in the strip, on the picture, where a thumb is. Only
            when there is more than one, and never a control — the track is
            swiped, this reports. */}
        {images.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5 sm:hidden">
            {images.map((img, i) => (
              <span
                key={img.src}
                className={`h-1.5 rounded-full transition-all ${
                  i === active ? "w-5 bg-navy-900" : "w-1.5 bg-navy-900/25"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* One photo needs no picker — the strip only appears when there is a
          real choice to make. */}
      {images.length > 1 && (
        <div className="-mx-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
          <div className="flex w-max gap-2">
            {images.map((img, i) => (
              <button
                key={img.src}
                type="button"
                onClick={() => show(i)}
                aria-label={`Photo ${i + 1} sur ${images.length}`}
                aria-current={i === active}
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white ring-1 transition ${
                  i === active ? "ring-2 ring-navy-900" : "ring-navy-900/10 hover:ring-gold-500"
                }`}
              >
                <Image src={img.src} alt="" fill sizes="64px" className="object-contain p-1.5" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
