"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The catalogue's price band: two thumbs on one track.
 *
 * The ends are the cheapest and dearest part in the whole category, so the
 * scale is the same whatever else is ticked. Dragging updates the labels at
 * once and commits to the URL a moment after the thumb stops — every pixel of
 * a drag would otherwise be a navigation.
 *
 * Two native `<input type="range">`s rather than a widget made of divs: they
 * come with keyboard control, touch handling and a screen-reader value for
 * free, and the styling that makes them look like one control is a few lines
 * of CSS (see .dual-range in globals.css).
 */
export default function PriceRange({
  floor,
  ceil,
  lo,
  hi,
  onCommit,
}: {
  floor: number;
  ceil: number;
  lo: number;
  hi: number;
  onCommit: (lo: number, hi: number) => void;
}) {
  // Local while dragging; the parent keys this component on the committed
  // band, so a navigation (back button, a shared link) remounts it at the
  // new position rather than leaving a stale one.
  const [range, setRange] = useState<[number, number]>([lo, hi]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function update(next: [number, number]) {
    setRange(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onCommit(next[0], next[1]), 450);
  }

  const span = Math.max(1, ceil - floor);
  const left = ((range[0] - floor) / span) * 100;
  const right = ((range[1] - floor) / span) * 100;

  return (
    <div>
      <div className="relative h-5">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-gray-200" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-gold-500"
          style={{ left: `${left}%`, right: `${100 - right}%` }}
        />
        <input
          type="range"
          className="dual-range absolute inset-x-0 top-0 w-full h-5 m-0"
          min={floor}
          max={ceil}
          step={1}
          value={range[0]}
          aria-label="Prix minimum"
          onChange={(e) => update([Math.min(Number(e.target.value), range[1]), range[1]])}
        />
        <input
          type="range"
          className="dual-range absolute inset-x-0 top-0 w-full h-5 m-0"
          min={floor}
          max={ceil}
          step={1}
          value={range[1]}
          aria-label="Prix maximum"
          // When both thumbs sit at the far left the upper one must be on top,
          // or the lower one swallows the drag and the band can never open.
          style={{ zIndex: range[0] === range[1] && range[1] === floor ? 2 : undefined }}
          onChange={(e) => update([range[0], Math.max(Number(e.target.value), range[0])])}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-gray-600 tabular-nums">
        <span>{range[0]} DT</span>
        <span>{range[1]} DT</span>
      </div>
    </div>
  );
}
