"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { track } from "./track";

export type CartItem = {
  productId: string;
  name: string;
  sku: string;
  slug: string;
  imageUrl: string;
  unitPrice: number;
  qty: number;
  stockQty: number;
};

type CartState = {
  items: CartItem[];
  isOpen: boolean;
  /**
   * The item just added, shown as a lightweight confirmation toast. Adding a
   * product deliberately does NOT open the cart any more: on a phone that
   * meant a full-screen takeover on every add, which threw the shopper out
   * of the page they were browsing. The toast confirms and gets out of the
   * way; opening the cart is now an explicit choice.
   */
  justAdded: CartItem | null;
  dismissJustAdded: () => void;
  open: () => void;
  close: () => void;
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
  /**
   * True once zustand has rehydrated from localStorage. The server sync waits
   * for this: pulling before rehydration would race the local cart and could
   * wipe a basket the shopper can see on screen.
   */
  hydrated: boolean;
  /** Used by the server sync to merge the two baskets in one atomic update. */
  replaceAll: (fn: (items: CartItem[]) => CartItem[]) => void;
  setHydrated: () => void;
};

/**
 * No line may ask for more than the shelf holds.
 *
 * Every setter goes through this rather than each one remembering the rule —
 * `add` and `setQty` each carried their own `Math.min` and the two paths that
 * did not, `replaceAll` and the rehydrate, were exactly the two that let a
 * basket hold 13 of something with 8 in stock. Nothing was ever oversold,
 * because placeOrder claims stock atomically, but the refusal arrived after
 * the shopper had typed their name, phone and address.
 *
 * A zero shelf is not a zero cap: a part with `stockQty: 0` is "sur commande",
 * which the shop orders in, so it is capped at a sane basket size instead.
 */
const OPEN_ORDER_CAP = 99;

export function clampToStock(items: CartItem[]): CartItem[] {
  return items.map((i) => {
    const cap = i.stockQty > 0 ? i.stockQty : OPEN_ORDER_CAP;
    return i.qty > cap ? { ...i, qty: cap } : i;
  });
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      hydrated: false,
      justAdded: null,
      replaceAll: (fn) => set({ items: clampToStock(fn(get().items)) }),
      dismissJustAdded: () => set({ justAdded: null }),
      open: () => set({ isOpen: true, justAdded: null }),
      close: () => set({ isOpen: false }),
      add: (item, qty = 1) => {
        const items = [...get().items];
        const idx = items.findIndex((i) => i.productId === item.productId);
        if (idx >= 0) {
          // The incoming stock figure is the fresher of the two: it was read
          // when this page rendered, while the line in the basket may have
          // been sitting in localStorage since last week.
          items[idx] = { ...items[idx], stockQty: item.stockQty, qty: items[idx].qty + qty };
        } else {
          items.push({ ...item, qty });
        }
        const clamped = clampToStock(items);
        const added = clamped[idx >= 0 ? idx : clamped.length - 1];
        set({ items: clamped, justAdded: added });
        track("add_to_cart", { productId: item.productId, sku: item.sku, qty, unitPrice: item.unitPrice });
      },
      remove: (productId) =>
        set({ items: get().items.filter((i) => i.productId !== productId) }),
      // Clamped at both ends, not just the bottom. `add` already capped at
      // stockQty, but the "+" on the cart page and in the drawer go through
      // here, so a shopper could walk 6 units in stock up to any number they
      // liked. Nothing was ever oversold — placeOrder claims stock atomically
      // — but the refusal arrived after they had typed their name, phone and
      // address, which is the worst possible moment to hear it. The cap is the
      // store's job because both steppers share it.
      setQty: (productId, qty) =>
        set({
          items: clampToStock(
            get().items.map((i) => (i.productId === productId ? { ...i, qty: Math.max(1, qty) } : i)),
          ),
        }),
      clear: () => set({ items: [] }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "apa-cart",
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        // A basket restored from localStorage is the one case nothing else
        // covers: it was written when the shelf held more, and until the
        // shopper touches a stepper no setter runs. That is how a line could
        // read "13" under a label saying "8 en stock", and how pressing "−"
        // appeared to jump from 13 to 8 — the clamp had simply never had a
        // chance to run. It runs on the way in now.
        state?.replaceAll((items) => items);
        state?.setHydrated();
      },
    }
  )
);

export function cartSubtotal(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
}

export function cartCount(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.qty, 0);
}
