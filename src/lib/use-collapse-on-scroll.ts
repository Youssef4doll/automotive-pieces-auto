"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Whether a secondary strip should currently be shown, given how the page is
 * being scrolled.
 *
 * The point is calm behaviour, not cleverness. A naive "hide on scroll down"
 * reacts to every one-pixel wobble and produces a header that flickers while
 * you read — worse than one that never moves. So:
 *
 *  - near the top the strip is always shown; there is nothing to reclaim yet
 *  - direction only counts once movement accumulates past `threshold`, which
 *    is the hysteresis: a thumb resting on the screen changes nothing
 *  - reversing direction resets the accumulator, so a deliberate flick up
 *    brings it straight back
 *
 * Reads are batched into a rAF and the listener is passive, so this never
 * blocks or janks the scroll itself.
 */
export function useCollapseOnScroll({
  /** Distance from the top below which the strip always stays visible. */
  revealAbove = 96,
  /** Accumulated movement in one direction before the state may flip. */
  threshold = 28,
  /** Quiet period after a flip, long enough to outlast the CSS transition. */
  settleMs = 320,
} = {}) {
  const [visible, setVisible] = useState(true);

  // Refs, not state: these change on every scroll frame and must not re-render.
  const lastY = useRef(0);
  const accum = useRef(0);
  const ticking = useRef(false);
  /**
   * Collapsing the strip removes ~46px from a sticky block, which shortens the
   * document and makes the browser adjust scrollY. That adjustment arrives as
   * a scroll event in the opposite direction, trips the threshold, and expands
   * the strip again — which lengthens the document, and so on: a strip that
   * flickers forever at a fixed scroll position. Ignoring scroll for one
   * transition's worth of time after each flip breaks the loop, and doubles as
   * a guard against flapping on a fast flick.
   */
  const lockedUntil = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;

    const evaluate = () => {
      ticking.current = false;
      const y = window.scrollY;
      const delta = y - lastY.current;
      lastY.current = y;

      // Still settling from the last flip: track position, decide nothing.
      if (performance.now() < lockedUntil.current) {
        accum.current = 0;
        return;
      }

      if (y <= revealAbove) {
        accum.current = 0;
        setVisible(true);
        return;
      }

      // A change of direction starts the count again, so the threshold always
      // measures deliberate movement rather than total distance travelled.
      if ((delta > 0 && accum.current < 0) || (delta < 0 && accum.current > 0)) {
        accum.current = 0;
      }
      accum.current += delta;

      if (accum.current > threshold) {
        setVisible(false);
        accum.current = 0;
        lockedUntil.current = performance.now() + settleMs;
      } else if (accum.current < -threshold) {
        setVisible(true);
        accum.current = 0;
        lockedUntil.current = performance.now() + settleMs;
      }
    };

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(evaluate);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [revealAbove, threshold, settleMs]);

  return visible;
}
