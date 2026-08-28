"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCart, cartCount } from "@/lib/cart-store";
import { useLocale } from "@/i18n/LocaleProvider";
import { track } from "@/lib/track";

export default function MascotWidget({ whatsapp }: { whatsapp: string }) {
  const { t } = useLocale();
  const pathname = usePathname();
  const count = cartCount(useCart((s) => s.items));
  const liftedByCart = count > 0 && !pathname?.startsWith("/commande") && !pathname?.startsWith("/admin");

  if (pathname?.startsWith("/admin")) return null;

  return (
    <a
      href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(t("mascot.title"))}`}
      target="_blank"
      rel="noreferrer"
      onClick={() => track("whatsapp_clicked", { source: "mascot_widget" })}
      className="fixed z-40 start-3 sm:start-4 flex items-center gap-3 rounded-full bg-navy-950 shadow-xl pe-4 sm:pe-5 py-2 hover:bg-navy-900 transition-colors max-w-[calc(100vw-1.5rem)]"
      style={{ bottom: liftedByCart ? "5.5rem" : "1.25rem" }}
    >
      <span className="relative shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden ring-2 ring-green-500 bg-navy-900">
        <Image src="/images/mascot-3d.png" alt="" fill sizes="48px" className="object-cover object-top" />
        <span className="absolute -bottom-0.5 -end-0.5 w-4 h-4 rounded-full bg-green-500 ring-2 ring-navy-950 flex items-center justify-center">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.07L2 22l5.06-1.33A9.94 9.94 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" />
          </svg>
        </span>
      </span>
      <span className="leading-tight py-1 flex flex-col min-w-0">
        <span className="text-white text-xs sm:text-sm font-display font-bold uppercase tracking-wide">
          {t("mascot.title")}
        </span>
        <span className="text-white/60 text-[11px] sm:text-xs">{t("mascot.subtitle")}</span>
      </span>
    </a>
  );
}
