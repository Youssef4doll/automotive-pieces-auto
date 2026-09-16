"use client";

import { useEffect, useRef, useState } from "react";
import { useCart } from "@/lib/cart-store";
import { useLocale } from "@/i18n/LocaleProvider";
import Price from "@/components/Price";
import { IconCheck } from "@/components/icons";

/**
 * The buy button, brought back when it scrolls away.
 *
 * Measured on a phone before this existed: "Ajouter au panier" sat at y=896 on
 * a 3,388px product page, so it was on screen for about a fifth of the scroll.
 * Everything that persuades somebody to press it — the description, what is in
 * the pack, the compatibility list, the OE numbers, "une question sur cette
 * pièce ?" — is *below* it. A shopper who read all of that and decided yes had
 * to scroll back up to act on it, with nothing on screen saying so.
 *
 * Phones only (`md:hidden`): a desktop keeps the whole purchase block in view
 * beside the picture, and a bar across the bottom of a wide screen would be
 * covering something for no reason.
 *
 * The label is deliberately *not* "Ajouter au panier". That phrase belongs to
 * exactly one control on this page; two elements carrying it would be two
 * matches for every selector that looks for it — including the end-to-end
 * suite's, which clicks it by text.
 */
export default function StickyBuyBar({
  product,
  label,
}: {
  product: {
    id: string;
    slug: string;
    sku: string;
    name: string;
    imageUrl: string;
    priceSell: number;
    stockQty: number;
  };
  /** The availability word, so the bar cannot claim more than the page does. */
  label: string;
}) {
  const { t } = useLocale();
  const add = useCart((s) => s.add);
  const [shown, setShown] = useState(false);
  const [added, setAdded] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  // Tied to the real button's position rather than to a scroll threshold: a
  // number of pixels would be wrong the moment the page above it changes
  // length, which it does per product — a pack with six lines in it is not the
  // same page as a wiper blade.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setShown(!entry.isIntersecting), {
      // Only once it is properly gone, so the bar does not flicker in and out
      // while the button is half on screen.
      rootMargin: "-16px 0px 0px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      {/* Sits where the real button is; the bar appears when this leaves. */}
      <div ref={sentinel} aria-hidden="true" className="h-px w-full" />

      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-navy-900/10 bg-white/95 px-4 pb-[env(safe-area-inset-bottom)] backdrop-blur transition-transform duration-200 md:hidden ${
          shown ? "translate-y-0" : "translate-y-full"
        }`}
        // Hidden from everything, not just from sight: a bar translated off
        // screen is still focusable and still read aloud.
        aria-hidden={!shown}
        inert={!shown}
      >
        <div className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-navy-950">{product.name}</p>
            <p className="flex items-center gap-2 text-xs text-gray-500">
              <Price value={product.priceSell} className="font-bold text-navy-900" />
              <span>· {label}</span>
            </p>
          </div>
          <button
            onClick={() => {
              add({
                productId: product.id,
                name: product.name,
                sku: product.sku,
                slug: product.slug,
                imageUrl: product.imageUrl,
                unitPrice: product.priceSell,
                stockQty: product.stockQty,
              });
              setAdded(true);
              setTimeout(() => setAdded(false), 1500);
            }}
            className="inline-flex min-h-tap-primary shrink-0 items-center gap-2 rounded-lg bg-gold-500 px-5 font-display text-sm font-bold uppercase tracking-wide text-navy-950 transition-transform active:scale-[0.98]"
          >
            {added ? (
              <>
                <IconCheck className="h-4 w-4" />
                {t("product.added")}
              </>
            ) : (
              "Ajouter"
            )}
          </button>
        </div>
      </div>
    </>
  );
}
