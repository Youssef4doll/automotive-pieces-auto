"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

/**
 * Drop this into any server component to fire a one-shot event on mount —
 * e.g. `<TrackEvent name="product_viewed" properties={{ slug }} />` on a
 * product page. Renders nothing.
 */
export default function TrackEvent({
  name,
  properties,
}: {
  name: string;
  properties?: Record<string, unknown>;
}) {
  const key = properties ? JSON.stringify(properties) : "";

  useEffect(() => {
    track(name, properties);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, key]);

  return null;
}
