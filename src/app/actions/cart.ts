"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

const SESSION_COOKIE = "apa-cart-session";

export type ServerCartItem = { productId: string; qty: number };

/**
 * Every shopper gets a durable cart identity, signed-in or not. The cookie is
 * httpOnly so the id cannot be read or spoofed from the page, and lax so it
 * survives the return trip from an external link.
 */
async function cartIdentity() {
  const user = await getCurrentUser();
  const jar = await cookies();
  let sessionId = jar.get(SESSION_COOKIE)?.value ?? null;
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    jar.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 120,
      path: "/",
    });
  }
  return { userId: user?.id ?? null, sessionId };
}

/**
 * Find the shopper's live cart, merging the anonymous one into their account
 * the first time they sign in — otherwise a customer who fills a basket and
 * then logs in to check out watches it vanish.
 */
async function resolveCart(userId: string | null, sessionId: string) {
  if (userId) {
    const userCart = await prisma.cart.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      include: { items: true },
    });
    const anonCart = await prisma.cart.findFirst({
      where: { sessionId, userId: null, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      include: { items: true },
    });

    if (anonCart && !userCart) {
      return prisma.cart.update({
        where: { id: anonCart.id },
        data: { userId },
        include: { items: true },
      });
    }
    if (anonCart && userCart) {
      // Both exist: fold the anonymous lines in, keeping the larger quantity,
      // then retire the anonymous cart rather than deleting evidence of it.
      for (const item of anonCart.items) {
        const existing = userCart.items.find((i) => i.productId === item.productId);
        await prisma.cartItem.upsert({
          where: { cartId_productId: { cartId: userCart.id, productId: item.productId } },
          create: { cartId: userCart.id, productId: item.productId, qty: item.qty },
          update: { qty: Math.max(existing?.qty ?? 0, item.qty) },
        });
      }
      await prisma.cart.update({ where: { id: anonCart.id }, data: { status: "ABANDONED" } });
      return prisma.cart.findUnique({ where: { id: userCart.id }, include: { items: true } });
    }
    if (userCart) return userCart;
    return prisma.cart.create({ data: { userId, sessionId }, include: { items: true } });
  }

  const anon = await prisma.cart.findFirst({
    where: { sessionId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    include: { items: true },
  });
  return anon ?? prisma.cart.create({ data: { sessionId }, include: { items: true } });
}

/**
 * Push the browser's cart to the server. The client stays the source of truth
 * for what the shopper sees — this makes the basket visible to the business so
 * it can be recovered, and lets it follow the shopper to another device.
 */
export async function syncCart(
  items: ServerCartItem[],
  opts: { emptiedByShopper?: boolean } = {},
): Promise<{ ok: true } | { error: string }> {
  try {
    const { userId, sessionId } = await cartIdentity();

    // An empty payload is ambiguous: it means either "the shopper emptied
    // their basket" or "this device has not loaded one yet". Treating the
    // second as the first destroyed real carts — a shopper who opened the site
    // signed out and then logged in had their saved basket deleted by the very
    // sync meant to preserve it. Clearing therefore has to be explicit.
    if (items.length === 0 && !opts.emptiedByShopper) return { ok: true };

    const cart = await resolveCart(userId, sessionId);
    if (!cart) return { error: "Panier introuvable" };

    // Ignore anything that is not a real, sellable product: the payload comes
    // from the browser and a stale localStorage cart can carry deleted ids.
    const wanted = items.filter((i) => i.qty > 0).slice(0, 100);
    const valid = wanted.length
      ? await prisma.product.findMany({
          where: { id: { in: wanted.map((i) => i.productId) }, active: true },
          select: { id: true },
        })
      : [];
    const validIds = new Set(valid.map((v) => v.id));
    const keep = wanted.filter((i) => validIds.has(i.productId));

    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id, productId: { notIn: keep.map((k) => k.productId) } },
    });
    for (const item of keep) {
      await prisma.cartItem.upsert({
        where: { cartId_productId: { cartId: cart.id, productId: item.productId } },
        create: { cartId: cart.id, productId: item.productId, qty: Math.min(item.qty, 99) },
        update: { qty: Math.min(item.qty, 99) },
      });
    }
    await prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });
    return { ok: true };
  } catch {
    // A cart that fails to sync must never block shopping.
    return { error: "sync failed" };
  }
}

/**
 * Read the cart back — this is what makes a basket started on a phone show up
 * on a laptop. Prices and stock come from the database, never from whatever
 * the other device happened to store.
 */
export async function loadServerCart() {
  try {
    const { userId, sessionId } = await cartIdentity();
    if (!userId) {
      // Anonymous shoppers already have their cart in localStorage on this
      // device; there is nothing to restore that they do not already have.
      const anon = await prisma.cart.findFirst({
        where: { sessionId, status: "ACTIVE" },
        include: { items: { include: { product: true } } },
      });
      if (!anon) return [];
      return anon.items
        .filter((i) => i.product.active)
        .map((i) => toClientItem(i.product, i.qty));
    }

    const cart = await resolveCart(userId, sessionId);
    if (!cart) return [];
    const full = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: { items: { include: { product: { include: { images: { orderBy: { order: "asc" }, take: 1, select: { id: true } } } } } } },
    });
    return (full?.items ?? [])
      .filter((i) => i.product.active)
      .map((i) => toClientItem(i.product, i.qty));
  } catch {
    return [];
  }
}

type ProductLike = {
  id: string; name: string; sku: string; slug: string; imageUrl: string;
  priceSell: unknown; stockQty: number; images?: { id: string }[];
};

function toClientItem(p: ProductLike, qty: number) {
  return {
    productId: p.id,
    name: p.name,
    sku: p.sku,
    slug: p.slug,
    imageUrl: p.images?.[0] ? `/api/images/${p.images[0].id}` : p.imageUrl,
    unitPrice: Number(p.priceSell),
    stockQty: p.stockQty,
    qty,
  };
}

/** Called once an order is placed, so the basket stops looking abandoned. */
export async function markCartConverted(orderId: string, phone?: string) {
  try {
    const { userId, sessionId } = await cartIdentity();
    const cart = await prisma.cart.findFirst({
      where: { status: "ACTIVE", OR: [userId ? { userId } : {}, { sessionId }].filter((o) => Object.keys(o).length) },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (!cart) return;
    await prisma.cart.update({
      where: { id: cart.id },
      data: { status: "CONVERTED", orderId, phone: phone ?? undefined },
    });
  } catch {
    // Losing this bookkeeping must never fail an order that already succeeded.
  }
}
