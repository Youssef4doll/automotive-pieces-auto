"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * What every sheet on this site has to get right, in one place.
 *
 * Three behaviours, none of them optional and all of them easy to half-do:
 *
 *  - **The page behind stays where it was.** `position: fixed` collapses the
 *    document's scroll to 0, so the offset is stashed and restored. Opening a
 *    sheet and closing it again must land the shopper on the exact row they
 *    were reading, not at the top of a 60-product catalogue.
 *  - **The device back button closes the sheet**, rather than leaving the
 *    page. A history entry is pushed on open and rewound on close — unless
 *    the sheet is closing *because* we are navigating somewhere, in which case
 *    rewinding it would undo the navigation. That is what the returned
 *    `leaving` callback is for: call it just before following a link out.
 *  - **Escape closes it**, for anyone on a keyboard.
 *
 * The cart sheet had all three; the catalogue's filter sheet needed the same
 * three, and two copies of this would have drifted the first time one of them
 * was fixed.
 */
export function useSheet(isOpen: boolean, close: () => void, historyKey: string) {
  const navigatingAway = useRef(false);

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
      // "instant", not the document's default smooth behaviour: restoring a
      // position should be invisible, not an animated jump back.
      window.scrollTo({ top: y, behavior: "instant" });
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onPop = () => close();
    window.history.pushState({ [historyKey]: true }, "");
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!navigatingAway.current && (window.history.state as Record<string, unknown> | null)?.[historyKey]) {
        window.history.back();
      }
    };
  }, [isOpen, close, historyKey]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  /** Call this before a link inside the sheet takes the shopper elsewhere,
   *  so closing does not rewind the history entry that navigation just made. */
  return useCallback(() => {
    navigatingAway.current = true;
  }, []);
}
