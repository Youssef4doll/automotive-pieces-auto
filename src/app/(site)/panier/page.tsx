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
      <h1 className="text-xl sm:text-2xl font-extrabold text-navy-950 mb-6">{t("cart.title")}</h1>
      <div className="flex flex-col gap-3 mb-6">
        {items.map((item) => (
          <div key={item.productId} className="flex gap-4 p-4 rounded-xl border border-gray-200 bg-white">
            <div className="w-20 h-20 shrink-0 rounded-lg bg-gray-100 overflow-hidden relative">
              <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-navy-900">{item.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t("product.reference")} {item.sku}</p>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center border rounded-lg">
                  <button className="w-8 h-8 font-bold" onClick={() => setQty(item.productId, item.qty - 1)}>−</button>
                  <span className="w-8 text-center text-sm">{item.qty}</span>
                  <button className="w-8 h-8 font-bold" onClick={() => setQty(item.productId, item.qty + 1)}>+</button>
                </div>
                <Price value={item.unitPrice * item.qty} className="font-bold text-navy-900" />
              </div>
            </div>
            <button onClick={() => remove(item.productId)} className="self-start text-gray-300 hover:text-red-600 p-1" aria-label={t("cart.remove")}>
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
        <Link href="/" className="block text-center text-sm text-gray-500 font-medium">
          {t("cart.continue")}
        </Link>
      </div>
    </div>
  );
}
