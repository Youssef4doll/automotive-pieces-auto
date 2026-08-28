"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/i18n/LocaleProvider";
import { useCart, cartSubtotal, cartCount } from "@/lib/cart-store";
import Price from "./Price";

/**
 * Mobile and desktop use deliberately different presentations:
 *  - phone  → a bottom sheet that takes only the height it needs (capped at
 *             85vh) and slides up. Tapping the cart icon must not destroy the
 *             page the shopper was reading, so the page stays visible behind
 *             a light scrim.
 *  - ≥640px → the familiar right-hand drawer, where horizontal space is free.
 * Breakpoint, not device sniffing — a small tablet window gets the sheet.
 */
export default function CartDrawer({ freeShippingThreshold }: { freeShippingThreshold: number }) {
  const { t } = useLocale();
  const isOpen = useCart((s) => s.isOpen);
  const close = useCart((s) => s.close);
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);

  const subtotal = cartSubtotal(items);
  const count = cartCount(items);
  const remaining = Math.max(0, freeShippingThreshold - subtotal);
  const progress = Math.min(100, (subtotal / freeShippingThreshold) * 100);

  // Set when the shopper is leaving for checkout, so the history entry we
  // pushed isn't rewound underneath the navigation.
  const navigatingAway = useRef(false);

  // Lock the page behind the sheet WITHOUT losing the shopper's place.
  // position:fixed collapses scroll to 0, so stash it and restore on close —
  // reopening/closing the cart must land you exactly where you were.
  useEffect(() => {
    if (!isOpen) return;
    const y = window.scrollY;
    const body = document.body;
    const prev = { position: body.style.position, top: body.style.top, width: body.style.width };
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.width = "100%";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      // "instant", not the document's default smooth behaviour: restoring
      // position should be invisible, not an animated jump back.
      window.scrollTo({ top: y, behavior: "instant" });
    };
  }, [isOpen]);

  // The device back button should close the sheet first, not leave the page.
  useEffect(() => {
    if (!isOpen) return;
    const onPop = () => close();
    window.history.pushState({ apaCart: true }, "");
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!navigatingAway.current && window.history.state?.apaCart) window.history.back();
    };
  }, [isOpen, close]);

  // Escape closes it too (desktop keyboard users).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end sm:block" role="dialog" aria-modal="true" aria-label={t("cart.title")}>
      {/* Light scrim: the page behind must stay recognisable, so the shopper
          knows exactly what they'll return to. */}
      <div
        className="absolute inset-0 bg-navy-950/35 motion-safe:animate-[fade-in_180ms_ease-out]"
        onClick={close}
      />

      <div
        className="
          relative w-full max-h-[85vh] rounded-t-2xl bg-white flex flex-col shadow-2xl
          motion-safe:animate-[sheet-up_240ms_cubic-bezier(0.32,0.72,0,1)]
          sm:absolute sm:inset-y-0 sm:end-0 sm:w-[420px] sm:max-h-none sm:rounded-none
          sm:motion-safe:animate-[slide-in-end_240ms_cubic-bezier(0.32,0.72,0,1)]
        "
      >
        {/* Grab handle — reads as a sheet on mobile, hidden on desktop. */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <span className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 sm:py-3.5 border-b shrink-0 sm:bg-navy-900 sm:text-white">
          <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950 sm:text-white">
            {t("cart.title")}
            {count > 0 && <span className="ms-2 font-sans font-normal text-sm text-gray-500 sm:text-white/60">({count})</span>}
          </h2>
          <button
            onClick={close}
            className="w-tap h-tap -me-2 flex items-center justify-center text-gray-400 sm:text-white/80"
            aria-label={t("cart.dismiss")}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-10 text-center sm:flex-1">
            <p className="text-gray-500">{t("cart.empty")}</p>
            <button
              onClick={close}
              className="px-5 min-h-tap rounded-lg bg-navy-900 text-white text-sm font-display font-bold uppercase tracking-wide"
            >
              {t("cart.discoverProducts")}
            </button>
          </div>
        ) : (
          <>
            <div className="px-4 py-2.5 bg-gold-500/10 border-b shrink-0">
              {remaining > 0 ? (
                <p className="text-xs font-medium text-navy-900 mb-1.5">
                  {t("cart.freeShipProgress", { amount: remaining.toFixed(2) })}
                </p>
              ) : (
                <p className="text-xs font-bold text-green-700 mb-1.5">✓ {t("cart.freeShipReached")}</p>
              )}
              <div className="h-1.5 rounded-full bg-white overflow-hidden">
                <div className="h-full bg-gold-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain divide-y min-h-0">
              {items.map((item) => (
                <div key={item.productId} className="flex gap-3 p-3 sm:p-4">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-lg bg-gray-100 overflow-hidden relative">
                    <Image src={item.imageUrl} alt="" fill sizes="64px" className="object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-navy-900 line-clamp-2 leading-snug">{item.name}</p>
                    <div className="flex items-center justify-between gap-2 flex-wrap mt-2">
                      <div className="flex items-center border rounded-lg">
                        <button
                          className="w-tap h-tap text-base font-bold"
                          aria-label={t("cart.decrease")}
                          onClick={() => setQty(item.productId, item.qty - 1)}
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-semibold">{item.qty}</span>
                        <button
                          className="w-tap h-tap text-base font-bold"
                          aria-label={t("cart.increase")}
                          onClick={() => setQty(item.productId, item.qty + 1)}
                        >
                          +
                        </button>
                      </div>
                      <span className="font-bold text-sm text-navy-900">
                        <Price value={item.unitPrice * item.qty} />
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => remove(item.productId)}
                    className="self-start shrink-0 w-tap h-tap -me-2 -mt-1 flex items-center justify-center text-gray-300 hover:text-red-600"
                    aria-label={t("cart.remove")}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Hierarchy: subtotal reads as information, checkout is the one
                dominant action, "keep shopping" stays available but quiet. */}
            <div className="border-t p-3 sm:p-4 shrink-0 bg-white pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-4">
              <div className="flex justify-between items-baseline mb-2.5">
                <span className="text-sm text-gray-600">{t("cart.subtotal")}</span>
                <Price value={subtotal} className="text-lg font-heading font-extrabold text-navy-950" />
              </div>
              <Link
                href="/commande"
                onClick={() => {
                  navigatingAway.current = true;
                  close();
                }}
                className="flex items-center justify-center w-full min-h-tap-primary rounded-lg bg-red-600 hover:bg-red-700 text-white font-display font-bold uppercase tracking-wide"
              >
                {t("cart.checkout")}
              </Link>
              <button
                onClick={close}
                className="flex items-center justify-center w-full min-h-tap text-sm text-gray-500 font-medium mt-1"
              >
                {t("cart.keepShopping")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
