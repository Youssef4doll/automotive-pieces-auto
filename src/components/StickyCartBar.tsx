"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/i18n/LocaleProvider";
import { useCart, cartCount, cartSubtotal } from "@/lib/cart-store";
import Price from "./Price";

export default function StickyCartBar() {
  const { t } = useLocale();
  const pathname = usePathname();
  const items = useCart((s) => s.items);
  const isOpen = useCart((s) => s.isOpen);
  const count = cartCount(items);

  if (count === 0 || isOpen) return null;
  if (pathname?.startsWith("/commande") || pathname?.startsWith("/admin")) return null;

  return (
    // pb-safe: without the safe-area inset the iPhone home indicator sits on
    // top of the checkout CTA — the one control this bar exists to offer.
    <div className="fixed bottom-0 inset-x-0 z-30 bg-navy-900 text-white shadow-[0_-4px_16px_rgba(0,0,0,0.2)] pb-safe">
      <Link
        href="/commande"
        className="mx-auto max-w-7xl flex items-center justify-between px-gutter py-2.5 gap-3 min-h-tap-primary"
      >
        <span className="text-sm font-medium min-w-0 truncate">
          {count} {t("nav.cart")} · <span className="font-bold"><Price value={cartSubtotal(items)} /></span>
        </span>
        <span className="flex items-center px-4 min-h-tap rounded-lg bg-red-600 font-bold text-sm whitespace-nowrap shrink-0">
          {t("cart.checkout")}
        </span>
      </Link>
    </div>
  );
}
