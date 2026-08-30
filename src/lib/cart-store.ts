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

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      hydrated: false,
      justAdded: null,
      replaceAll: (fn) => set({ items: fn(get().items) }),
      dismissJustAdded: () => set({ justAdded: null }),
      open: () => set({ isOpen: true, justAdded: null }),
      close: () => set({ isOpen: false }),
      add: (item, qty = 1) => {
        const items = [...get().items];
        const idx = items.findIndex((i) => i.productId === item.productId);
        if (idx >= 0) {
          items[idx] = {
            ...items[idx],
            qty: Math.min(items[idx].qty + qty, item.stockQty || 99),
          };
        } else {
          items.push({ ...item, qty: Math.min(qty, item.stockQty || 99) });
        }
        const added = items[idx >= 0 ? idx : items.length - 1];
        set({ items, justAdded: added });
        track("add_to_cart", { productId: item.productId, sku: item.sku, qty, unitPrice: item.unitPrice });
      },
      remove: (productId) =>
        set({ items: get().items.filter((i) => i.productId !== productId) }),
      setQty: (productId, qty) =>
        set({
          items: get().items.map((i) =>
            i.productId === productId ? { ...i, qty: Math.max(1, qty) } : i
          ),
        }),
      clear: () => set({ items: [] }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "apa-cart",
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
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
