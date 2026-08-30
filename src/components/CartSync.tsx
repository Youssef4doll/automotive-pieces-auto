"use client";

import { useEffect, useRef, useState } from "react";
import { useCart } from "@/lib/cart-store";
import { syncCart, loadServerCart } from "@/app/actions/cart";

/**
 * Keeps the browser cart and the server cart in step.
 *
 * On mount it pulls the server cart once — that is what makes a basket started
 * on a phone appear on a laptop. After that it pushes changes up, debounced,
 * so a shopper adjusting quantities does not fire a write per keystroke.
 *
 * Everything here is best-effort: a failed sync must never stop someone
 * shopping, so nothing in this component surfaces an error to the customer.
 */
export default function CartSync() {
  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const replaceAll = useCart((s) => s.replaceAll);
  const pullStarted = useRef(false);
  /**
   * Pushing is gated on the pull having *finished*, not started. Gating on the
   * start let the debounced push fire with the still-empty local cart and
   * delete the server cart a moment before the pull returned it — which is
   * exactly the cross-device basket this component exists to preserve.
   */
  const [pullDone, setPullDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Whether this browser has ever held a basket. Until it has, an empty cart
   * means "nothing loaded here yet", not "the shopper emptied it" — and only
   * the latter may clear the server cart.
   */
  const hadItems = useRef(false);

  // Pull once, after zustand has rehydrated from localStorage — pulling before
  // that would race the local cart and could wipe it.
  useEffect(() => {
    if (!hydrated || pullStarted.current) return;
    pullStarted.current = true;
    let cancelled = false;
    (async () => {
      try {
        const server = await loadServerCart();
        if (cancelled || server.length === 0) return;
        replaceAll((local) => {
          // Union by product, keeping the larger quantity: neither device's
          // basket should silently lose a line the other one has.
          const byId = new Map(local.map((i) => [i.productId, i]));
          for (const s of server) {
            const existing = byId.get(s.productId);
            byId.set(s.productId, existing ? { ...s, qty: Math.max(existing.qty, s.qty) } : s);
          }
          return [...byId.values()];
        });
      } catch {
        /* offline or signed out — the local cart still works */
      } finally {
        if (!cancelled) setPullDone(true);
      }
    })();
    return () => { cancelled = true; };
  }, [hydrated, replaceAll]);

  // Push, debounced.
  useEffect(() => {
    if (!hydrated || !pullDone) return;
    if (timer.current) clearTimeout(timer.current);
    if (items.length > 0) hadItems.current = true;
    const emptiedByShopper = items.length === 0 && hadItems.current;
    if (items.length === 0 && !emptiedByShopper) return;
    timer.current = setTimeout(() => {
      syncCart(items.map((i) => ({ productId: i.productId, qty: i.qty })), { emptiedByShopper })
        .catch(() => {});
    }, 800);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // pullDone is a dependency, not a ref read: when the pull returns an empty
    // server cart the items never change, and a ref would leave an existing
    // local basket unsynced until the shopper happened to modify it.
  }, [items, hydrated, pullDone]);

  return null;
}
