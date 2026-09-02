"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/i18n/LocaleProvider";
import { useCart, cartSubtotal } from "@/lib/cart-store";
import Price from "@/components/Price";

export default function CartPage() {
  const { t } = useLocale();
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const subtotal = cartSubtotal(items);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-4xl mb-4">🛒</p>
        <p className="text-gray-600 font-medium mb-6">{t("cart.empty")}</p>
        <Link href="/" className="px-5 py-3 rounded-lg bg-navy-900 text-white font-semibold">
          {t("cart.continue")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-xl sm:text-2xl font-heading font-extrabold uppercase text-navy-950 mb-6 tracking-tight">{t("cart.title")}</h1>
      {/* Tighter thumbnail + gaps below sm: the 44px quantity stepper is
          non-negotiable for thumbs, so the space comes from chrome instead —
          otherwise this row's minimum width exceeds a 320px screen. */}
      <div className="flex flex-col gap-3 mb-6">
        {items.map((item) => (
          <div key={item.productId} className="flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-gray-200 bg-white">
            <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-lg bg-gray-100 overflow-hidden relative">
              <Image src={item.imageUrl} alt={item.name} fill sizes="(max-width: 640px) 64px, 80px" className="object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-navy-900">{item.name}</p>
              <p className="text-xs text-gray-600 mt-0.5">{t("product.reference")} {item.sku}</p>
              {/* flex-wrap: the 44px tap targets on the stepper make this row's
                  minimum width exceed a 320px screen, so let the price drop to
                  its own line there rather than forcing the page to scroll. */}
              <div className="flex items-center justify-between gap-2 flex-wrap mt-3">
                <div className="flex items-center border rounded-lg">
                  <button
                    className="w-tap h-tap font-bold text-lg"
                    aria-label={t("cart.decrease")}
                    onClick={() => setQty(item.productId, item.qty - 1)}
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-semibold">{item.qty}</span>
                  {/* Disabled at the shelf's limit rather than swallowing the
                      tap: a "+" that does nothing reads as a broken button. */}
                  <button
                    className="w-tap h-tap font-bold text-lg disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label={t("cart.increase")}
                    disabled={item.qty >= item.stockQty}
                    onClick={() => setQty(item.productId, item.qty + 1)}
                  >
                    +
                  </button>
                </div>
                <Price value={item.unitPrice * item.qty} className="font-bold text-navy-900" />
              </div>
              {item.qty >= item.stockQty && (
                <p className="text-xs text-gray-600 mt-1.5">
                  {item.stockQty} en stock — c&apos;est tout ce que nous avons pour le moment.
                </p>
              )}
            </div>
            <button
              onClick={() => remove(item.productId)}
              className="self-start shrink-0 w-tap h-tap -me-2 -mt-2 flex items-center justify-center text-gray-300 hover:text-red-600"
              aria-label={t("cart.remove")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-xl border border-gray-200 bg-white flex flex-col gap-3 sm:w-80 sm:ms-auto">
        <div className="flex justify-between text-sm text-gray-600">
          <span>{t("cart.subtotal")}</span>
          <Price value={subtotal} />
        </div>
        <div className="flex justify-between font-bold text-navy-900 text-lg">
          <span>{t("cart.total")}</span>
          <Price value={subtotal} />
        </div>
        <Link href="/commande" className="block text-center py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold">
          {t("cart.checkout")}
        </Link>
        <Link href="/" className="flex items-center justify-center text-center text-sm text-gray-500 font-medium min-h-tap">
          {t("cart.continue")}
        </Link>
      </div>
    </div>
  );
}
