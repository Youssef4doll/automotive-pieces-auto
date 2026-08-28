"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/i18n/LocaleProvider";
import { useCart, cartSubtotal } from "@/lib/cart-store";
import Price from "./Price";

export default function CartDrawer({ freeShippingThreshold }: { freeShippingThreshold: number }) {
  const { t } = useLocale();
  const isOpen = useCart((s) => s.isOpen);
  const close = useCart((s) => s.close);
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);

  const subtotal = cartSubtotal(items);
  const remaining = Math.max(0, freeShippingThreshold - subtotal);
  const progress = Math.min(100, (subtotal / freeShippingThreshold) * 100);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/50" onClick={close} />
      <div className="absolute inset-y-0 end-0 w-full sm:w-[420px] bg-white flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3.5 border-b bg-navy-900 text-white">
          <h2 className="font-bold">{t("cart.title")}</h2>
          <button onClick={close} className="p-1" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="text-gray-500">{t("cart.empty")}</p>
            <button
              onClick={close}
              className="px-5 py-2.5 rounded-lg bg-navy-900 text-white text-sm font-semibold"
            >
              {t("cart.continue")}
            </button>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 bg-gold-500/10 border-b">
              {remaining > 0 ? (
                <p className="text-xs font-medium text-navy-900 mb-1.5">
                  {t("cart.freeShipProgress", { amount: remaining.toFixed(2) })}
                </p>
              ) : (
                <p className="text-xs font-bold text-green-700 mb-1.5">✓ {t("cart.freeShipReached")}</p>
              )}
              <div className="h-1.5 rounded-full bg-white overflow-hidden">
                <div
                  className="h-full bg-gold-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y">
              {items.map((item) => (
                <div key={item.productId} className="flex gap-3 p-4">
                  <div className="w-16 h-16 shrink-0 rounded-lg bg-gray-100 overflow-hidden relative">
                    <Image src={item.imageUrl} alt={item.name} fill sizes="64px" className="object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-navy-900 line-clamp-2">{item.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t("product.reference")} {item.sku}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border rounded-lg">
                        <button
                          className="w-8 h-8 text-sm font-bold"
                          onClick={() => setQty(item.productId, item.qty - 1)}
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm">{item.qty}</span>
                        <button
                          className="w-8 h-8 text-sm font-bold"
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
                    className="self-start text-gray-300 hover:text-red-600 p-2 -m-1"
                    aria-label={t("cart.remove")}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t p-4 space-y-2 bg-white">
              <div className="flex justify-between text-sm text-gray-600">
                <span>{t("cart.subtotal")}</span>
                <Price value={subtotal} />
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>{t("cart.shipping")}</span>
                <span>{remaining > 0 ? "—" : t("cart.free")}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-navy-900 pt-1">
                <span>{t("cart.total")}</span>
                <Price value={subtotal} />
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500 py-1">
                <span>💳 {t("trust.cod")}</span>
                <span>🔄 {t("trust.exchange")}</span>
                <span>🛡 {t("trust.warranty")}</span>
              </div>
              <Link
                href="/commande"
                onClick={close}
                className="block text-center w-full py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                {t("cart.checkout")}
              </Link>
              <button
                onClick={close}
                className="block text-center w-full py-3 text-sm text-gray-500 font-medium"
              >
                {t("cart.continue")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
