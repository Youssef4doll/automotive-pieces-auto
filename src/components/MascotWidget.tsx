"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCart, cartCount } from "@/lib/cart-store";
import { useLocale } from "@/i18n/LocaleProvider";

export default function MascotWidget({ whatsapp }: { whatsapp: string }) {
  const { t } = useLocale();
  const pathname = usePathname();
  const count = cartCount(useCart((s) => s.items));
  const liftedByCart = count > 0 && !pathname?.startsWith("/commande") && !pathname?.startsWith("/admin");

  if (pathname?.startsWith("/admin")) return null;

  return (
    <a
      href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(t("product.whatsappHelp"))}`}
      target="_blank"
      rel="noreferrer"
      className="fixed z-40 start-4 flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-xl bg-green-600 hover:bg-green-700 transition-all"
      style={{ bottom: liftedByCart ? "5.5rem" : "1.25rem" }}
      aria-label="WhatsApp"
    >
      <span className="absolute inset-0 rounded-full overflow-hidden ring-2 ring-white">
        <Image src="/images/mascot-3d.png" alt="" fill sizes="64px" className="object-cover object-top" />
      </span>
    </a>
  );
}
