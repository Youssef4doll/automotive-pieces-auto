"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/i18n/LocaleProvider";
import { useCart } from "@/lib/cart-store";
import Price from "./Price";

const AUTO_DISMISS_MS = 5000;

/**
 * The confirmation shown after "add to cart". It replaces the old behaviour
 * of force-opening the whole cart drawer, which on a phone was a full-screen
 * takeover that threw the shopper out of the page they were reading.
 *
 * Deliberately small: it sits above the sticky cart bar, never covers the
 * product image/title/price, and disappears on its own. The shopper keeps
 * their place and their scroll position — nothing navigates.
 */
export default function AddedToast() {
  const { t } = useLocale();
  const justAdded = useCart((s) => s.justAdded);
  const dismiss = useCart((s) => s.dismissJustAdded);
  const open = useCart((s) => s.open);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!justAdded) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [justAdded, dismiss]);

  if (!justAdded) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[55] px-gutter pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pointer-events-none sm:inset-x-auto sm:end-4 sm:bottom-4 sm:max-w-sm sm:px-0"
    >
      <div className="pointer-events-auto mx-auto max-w-lg sm:mx-0 rounded-xl bg-white border border-gray-200 shadow-[0_8px_28px_rgba(8,22,51,0.18)] p-3 motion-safe:animate-[toast-in_220ms_ease-out]">
        <div className="flex items-center gap-3">
          <span className="shrink-0 w-6 h-6 rounded-full bg-green-700 text-white flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <p className="flex-1 min-w-0 text-sm font-bold text-navy-950">{t("cart.addedTitle")}</p>
          <button
            onClick={dismiss}
            aria-label={t("cart.dismiss")}
            className="shrink-0 w-tap h-tap -me-2 -my-2 flex items-center justify-center text-gray-600 hover:text-navy-900"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-3 mt-2.5">
          <div className="w-12 h-12 shrink-0 rounded-lg bg-gray-100 overflow-hidden relative">
            <Image src={justAdded.imageUrl} alt="" fill sizes="48px" className="object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-navy-900 line-clamp-2 leading-snug">{justAdded.name}</p>
            <p className="text-sm font-bold text-navy-950 mt-0.5">
              <Price value={justAdded.unitPrice * justAdded.qty} />
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={dismiss}
            className="flex-1 min-h-tap rounded-lg border border-gray-300 text-navy-900 text-xs font-display font-bold uppercase tracking-wide"
          >
            {t("cart.keepShopping")}
          </button>
          <button
            onClick={open}
            className="flex-1 min-h-tap rounded-lg bg-navy-900 hover:bg-navy-800 text-white text-xs font-display font-bold uppercase tracking-wide"
          >
            {t("cart.viewCart")}
          </button>
        </div>
      </div>
    </div>
  );
}
