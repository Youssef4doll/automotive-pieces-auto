"use client";

import Image from "next/image";
import Link from "next/link";
import { track } from "@/lib/track";

export type Promo = {
  id: string;
  title: string;
  imageUrl: string;
  href: string | null;
};

/**
 * The deals strip, laid out the way the reference storefront does it: the
 * first banner runs full width, the rest sit in a plain two-column grid.
 *
 * Deliberately NOT a carousel. A grid shows every deal at once, needs no
 * motion, no dots, no auto-advance and no swipe discovery — the shopper
 * scans instead of waiting. The artwork carries the message, so there is no
 * card chrome around it: no border, no shadow, no heading. The images are
 * the content.
 */
export default function PromoGrid({ promos }: { promos: Promo[] }) {
  if (promos.length === 0) return null;

  const [featured, ...rest] = promos;

  const Tile = ({ promo, wide }: { promo: Promo; wide: boolean }) => {
    const inner = (
      <div
        className={`relative w-full overflow-hidden rounded-lg bg-gray-100 ${
          wide ? "aspect-[16/7] sm:aspect-[21/7]" : "aspect-[4/3]"
        }`}
      >
        <Image
          src={promo.imageUrl}
          alt={promo.title}
          fill
          sizes={wide ? "(max-width: 1280px) 100vw, 1280px" : "(max-width: 640px) 50vw, 33vw"}
          className="object-cover"
          priority={wide}
        />
      </div>
    );
    return promo.href ? (
      <Link
        href={promo.href}
        className="block w-full"
        onClick={() => track("promo_clicked", { id: promo.id, title: promo.title })}
      >
        {inner}
      </Link>
    ) : (
      inner
    );
  };

  return (
    // w-full: <main> is a column flex container, and mx-auto on a flex item
    // cancels cross-axis stretch, which would collapse this section.
    <section aria-label="Promotions" className="w-full mx-auto max-w-7xl px-gutter pt-3">
      <Tile promo={featured} wide />
      {rest.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 mt-2.5">
          {rest.map((p) => (
            <Tile key={p.id} promo={p} wide={false} />
          ))}
        </div>
      )}
    </section>
  );
}
