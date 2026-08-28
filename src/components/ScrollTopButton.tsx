"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/i18n/LocaleProvider";

/**
 * The only element allowed to float over the page. It appears after a couple
 * of screens of scrolling and disappears at the top, so on the first view
 * nothing overlays the content at all.
 */
export default function ScrollTopButton() {
  const { t } = useLocale();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 1200);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={t("nav.backToTop")}
      className="fixed end-3 bottom-safe z-40 w-tap h-tap rounded-full bg-gold-500 hover:bg-gold-400 text-navy-950 shadow-lg flex items-center justify-center"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
