"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A hairline progress bar for navigations that are actually slow.
 *
 * The gap this closes is small but it is the one that makes a site feel
 * broken: you tap a part, nothing changes, and you cannot tell whether the tap
 * registered. Prefetched navigations here commit in well under 100ms and need
 * no indicator at all — showing one would be a flash of noise on every tap —
 * so the bar only appears after `DELAY_MS` of genuine waiting, which on a good
 * connection means never.
 *
 * Implemented by listening for link clicks rather than by wrapping every
 * `<Link>` in `useLinkStatus`: the alternative would mean touching every
 * product card, category tile and breadcrumb in the app to solve a problem
 * that belongs to the shell.
 *
 * Deliberately not a route-level `loading.tsx`. A loading boundary above a
 * route makes Next flush the response shell before the page runs, which turns
 * `notFound()` into a 200 — the exact regression fixed earlier for order
 * pages, and it would silently return 200 for every unknown product URL.
 */

/** Long enough that a fast navigation never flashes the bar. */
const DELAY_MS = 180;

export default function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Any completed navigation clears the bar, however it was triggered —
  // link, back button, or a redirect.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    setActive(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Let the browser handle anything that is not a plain left-click
      // same-tab navigation to another page on this site.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      if (!href.startsWith("/") || href.startsWith("//")) return;

      // Same page, or a jump to an anchor on it: nothing is loading.
      const url = new URL(href, location.href);
      if (url.pathname === location.pathname && url.search === location.search) return;

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setActive(true), DELAY_MS);
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!active) return null;

  return (
    <div
      role="status"
      aria-label="Chargement de la page"
      className="fixed inset-x-0 top-0 z-[100] h-0.5 pointer-events-none"
    >
      <div className="h-full w-2/5 bg-gold-500 animate-[nav-progress_1.1s_ease-in-out_infinite] motion-reduce:w-full motion-reduce:animate-none" />
    </div>
  );
}
