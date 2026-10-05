import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";
import { sendMail } from "@/lib/email";
import { loadShopForEmail } from "@/lib/order-emails";
import { newReturnAlertMail, returnRequestedMail, returnStatusMail, type ReturnForEmail } from "@/lib/email-templates";
import { pushReturnStatus } from "@/lib/push";
import { adjustProductStock } from "@/lib/admin/products";
import {
  LIVE_RETURN,
  MAX_RETURN_PHOTOS,
  RETURN_NEXT,
  RETURN_REASONS,
  RETURN_WISHES,
  returnOptions,
  returnProblem,
  returnValue,
  returnableQty,
  type ReturnCover,
  type ReturnProblem,
  type ReturnStatus,
} from "@/lib/returns-rules";
import { afterResponse } from "@/lib/defer";

/**
 * Return requests: filed by the customer on a delivered order (the app's
 * API and the website's order page both land here), answered by the shop
 * (the admin and the staff app both land here). One module, so there is one
 * set of rules and one place every move notifies from.
 */

/** When the order was delivered: the last DELIVERED step in its history. */
async function deliveredAt(orderId: string): Promise<Date | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      updatedAt: true,
      history: { where: { status: "DELIVERED" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });
  if (order?.status !== "DELIVERED") return null;
  // An order marked delivered before the history table existed has no step;
  // its last update is the closest true date there is.
  return order.history[0]?.createdAt ?? order.updatedAt;
}

const requestSelect = {
  id: true,
  ref: true,
  status: true,
  reason: true,
  wish: true,
  note: true,
  unmounted: true,
  cover: true,
  method: true,
  shopNote: true,
  outcome: true,
  refundAmount: true,
  restocked: true,
  createdAt: true,
  decidedAt: true,
  receivedAt: true,
  resolvedAt: true,
  cancelledAt: true,
  items: { select: { orderItemId: true, qty: true, orderItem: { select: { name: true, sku: true, unitPrice: true, productId: true } } } },
  _count: { select: { photos: true } },
} as const;

type RequestRow = NonNullable<Awaited<ReturnType<typeof loadRequest>>>;
function loadRequest(id: string) {
  return prisma.returnRequest.findUnique({ where: { id }, select: requestSelect });
}

/** A request as its customer sees it: everything the shop told them, and what they sent. */
function customerView(r: RequestRow) {
  return {
    ref: r.ref,
    status: r.status,
    reason: r.reason,
    wish: r.wish,
    note: r.note,
    unmounted: r.unmounted,
    cover: r.cover as ReturnCover,
    method: r.method,
    shopNote: r.shopNote,
    outcome: r.outcome,
    refundAmount: r.refundAmount === null ? null : toNumber(r.refundAmount),
    photoCount: r._count.photos,
    items: r.items.map((i) => ({ orderItemId: i.orderItemId, name: i.orderItem.name, sku: i.orderItem.sku, qty: i.qty })),
    createdAt: r.createdAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString() ?? null,
    receivedAt: r.receivedAt?.toISOString() ?? null,
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
  };
}
export type CustomerReturn = ReturnType<typeof customerView>;

/**
 * Everything the order screen needs about returns: the requests already made,
 * and — for a delivered order — what can still be asked for, reason by
 * reason, with the deadlines worked out here rather than on the phone.
 */
export async function returnsForOrder(orderId: string) {
  const [rows, when, order] = await Promise.all([
    prisma.returnRequest.findMany({ where: { orderId }, orderBy: { createdAt: "desc" }, select: requestSelect }),
    deliveredAt(orderId),
    prisma.order.findUnique({ where: { id: orderId }, select: { vehicleLabel: true, items: { select: { id: true, qty: true } } } }),
  ]);
  const requests = rows.map(customerView);
  if (!when || !order) return { requests, options: null };
  const claimed = rows.filter((r) => LIVE_RETURN.includes(r.status)).flatMap((r) => r.items);
  const free = returnableQty(order.items, claimed);
  return {
    requests,
    options: {
      deliveredAt: when.toISOString(),
      reasons: returnOptions(when, Boolean(order.vehicleLabel)),
      items: order.items.map((i) => ({ orderItemId: i.id, returnable: free.get(i.id) ?? 0 })),
    },
  };
}

export const returnInput = z.object({
  reason: z.enum(RETURN_REASONS),
  wish: z.enum(RETURN_WISHES),
  note: z.string().trim().max(1000).optional(),
  unmounted: z.boolean().default(false),
  items: z
    .array(z.object({ orderItemId: z.string().min(1).max(40), qty: z.number().int().min(0).max(999) }))
    .min(1)
    .max(50),
});
export type ReturnInput = z.infer<typeof returnInput>;

type Photo = { data: Uint8Array<ArrayBuffer>; mime: string };

/**
 * File a request. The order row is locked while its quantities are checked
 * and claimed, so two taps — or the phone and the website at once — cannot
 * both return the last filter of a line.
 */
export async function createReturn(
  orderId: string,
  input: ReturnInput,
  photos: Photo[],
): Promise<{ ok: true; id: string; ref: string } | { ok: false; problem: ReturnProblem | "not_delivered" | "too_many_photos" }> {
  if (photos.length > MAX_RETURN_PHOTOS) return { ok: false, problem: "too_many_photos" };
  const when = await deliveredAt(orderId);
  if (!when) return { ok: false, problem: "not_delivered" };

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { vehicleLabel: true, items: { select: { id: true, qty: true } } },
    });
    if (!order) return { ok: false as const, problem: "not_delivered" as const };
    const claimed = await tx.returnItem.findMany({
      where: { request: { orderId, status: { in: LIVE_RETURN } } },
      select: { orderItemId: true, qty: true },
    });
    const options = returnOptions(when, Boolean(order.vehicleLabel));
    const free = returnableQty(order.items, claimed);
    const problem = returnProblem({ ...input, photos: photos.length }, options, free);
    if (problem) return { ok: false as const, problem };

    const rule = options.find((o) => o.reason === input.reason)!;
    const [{ max }] = await tx.$queryRaw<{ max: number }[]>`
      SELECT COALESCE(MAX(CAST(SUBSTRING(ref FROM '[0-9]+$') AS INTEGER)), 1000) AS max FROM "ReturnRequest"
    `;
    const created = await tx.returnRequest.create({
      data: {
        ref: `RET-${Number(max) + 1}`,
        orderId,
        reason: input.reason,
        wish: input.wish,
        note: input.note || null,
        unmounted: rule.unmounted ? input.unmounted : false,
        cover: rule.cover,
        items: { create: input.items.filter((i) => i.qty > 0).map((i) => ({ orderItemId: i.orderItemId, qty: i.qty })) },
        photos: { create: photos.map((p) => ({ data: p.data, mime: p.mime })) },
      },
      select: { id: true, ref: true },
    });
    return { ok: true as const, ...created };
  });

  if (result.ok) afterResponse(() => notify(result.id, "REQUESTED"));
  return result;
}

/** The customer withdraws a request the shop has not answered yet. */
export async function cancelReturn(orderId: string, ref: string): Promise<boolean> {
  const done = await prisma.returnRequest.updateMany({
    where: { orderId, ref, status: "REQUESTED" },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  return done.count === 1;
}

/* ------------------------------------------------------------ the shop ---- */

export const returnMove = z.discriminatedUnion("to", [
  z.object({ to: z.literal("APPROVED"), method: z.enum(["DROP_OFF", "PICKUP"]), shopNote: z.string().trim().max(1000).optional() }),
  z.object({ to: z.literal("REFUSED"), shopNote: z.string().trim().min(3).max(1000) }),
  z.object({ to: z.literal("RECEIVED"), restock: z.boolean().default(false) }),
  z.object({
    to: z.literal("RESOLVED"),
    outcome: z.enum(["EXCHANGED", "REFUNDED"]),
    refundAmount: z.number().min(0).max(1_000_000).optional(),
    shopNote: z.string().trim().max(1000).optional(),
  }),
]);
export type ReturnMove = z.infer<typeof returnMove>;

/**
 * The shop moves a request on, one allowed step at a time (RETURN_NEXT).
 * Written only if the request is still where the shop saw it, so two people
 * answering at once cannot both win. Received parts go back on the shelf
 * when the shop says they are fit to sell again — never on their own.
 */
export async function moveReturn(id: string, move: ReturnMove): Promise<{ ok: true } | { ok: false; problem: "not_found" | "transition" | "refund_amount" }> {
  const current = await loadRequest(id);
  if (!current) return { ok: false, problem: "not_found" };
  if (!RETURN_NEXT[current.status as ReturnStatus].includes(move.to)) return { ok: false, problem: "transition" };
  if (move.to === "RESOLVED" && move.outcome === "REFUNDED" && move.refundAmount === undefined) return { ok: false, problem: "refund_amount" };

  const now = new Date();
  const data =
    move.to === "APPROVED"
      ? { status: move.to, method: move.method, shopNote: move.shopNote || null, decidedAt: now }
      : move.to === "REFUSED"
        ? { status: move.to, shopNote: move.shopNote, decidedAt: current.decidedAt ?? now }
        : move.to === "RECEIVED"
          ? { status: move.to, receivedAt: now, restocked: move.restock }
          : {
              status: move.to,
              outcome: move.outcome,
              refundAmount: move.outcome === "REFUNDED" ? move.refundAmount : null,
              shopNote: move.shopNote || current.shopNote,
              resolvedAt: now,
            };
  const written = await prisma.returnRequest.updateMany({ where: { id, status: current.status }, data });
  if (written.count !== 1) return { ok: false, problem: "transition" };

  if (move.to === "RECEIVED" && move.restock) {
    for (const line of current.items) {
      if (line.orderItem.productId) await adjustProductStock(line.orderItem.productId, line.qty, `Retour ${current.ref}`);
    }
  }
  afterResponse(() => notify(id, move.to));
  return { ok: true };
}

/** Push and e-mail for a move. Best effort, like every notification here. */
async function notify(id: string, status: "REQUESTED" | ReturnMove["to"]) {
  try {
    const r = await forEmail(id);
    if (!r) return;
    const shop = await loadShopForEmail();
    const mails = status === "REQUESTED" ? [returnRequestedMail(r, shop), newReturnAlertMail(r, shop)] : [returnStatusMail(r, status, shop)];
    await Promise.allSettled(mails.filter((m) => m !== null).map((m) => sendMail(m!)));
    if (status !== "REQUESTED") await pushReturnStatus(id, status);
  } catch (e) {
    console.error(`[returns] ${id}: could not notify —`, e);
  }
}

async function forEmail(id: string): Promise<ReturnForEmail | null> {
  const r = await prisma.returnRequest.findUnique({
    where: { id },
    select: {
      ...requestSelect,
      order: { select: { ref: true, userId: true, customerName: true, phone: true, email: true, vehicleLabel: true } },
    },
  });
  if (!r) return null;
  return {
    id: r.id,
    ref: r.ref,
    orderRef: r.order.ref,
    orderUserId: r.order.userId,
    customerName: r.order.customerName,
    phone: r.order.phone,
    email: r.order.email,
    vehicleLabel: r.order.vehicleLabel,
    reason: r.reason,
    wish: r.wish,
    cover: r.cover as ReturnCover,
    note: r.note,
    unmounted: r.unmounted,
    method: r.method,
    shopNote: r.shopNote,
    outcome: r.outcome,
    refundAmount: r.refundAmount === null ? null : toNumber(r.refundAmount),
    photoCount: r._count.photos,
    createdAt: r.createdAt,
    items: r.items.map((i) => ({ name: i.orderItem.name, sku: i.orderItem.sku, qty: i.qty })),
  };
}

/** The admin's list, newest first; open ones by default. */
export async function listReturns(filter: "open" | "all" | ReturnStatus = "open") {
  const where =
    filter === "all" ? {} : filter === "open" ? { status: { in: ["REQUESTED", "APPROVED", "RECEIVED"] as ReturnStatus[] } } : { status: filter };
  const rows = await prisma.returnRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      ref: true,
      status: true,
      reason: true,
      wish: true,
      cover: true,
      createdAt: true,
      order: { select: { id: true, ref: true, customerName: true, phone: true } },
      items: { select: { qty: true, orderItem: { select: { name: true } } } },
      _count: { select: { photos: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    ref: r.ref,
    status: r.status,
    reason: r.reason,
    wish: r.wish,
    cover: r.cover as ReturnCover,
    createdAt: r.createdAt.toISOString(),
    orderId: r.order.id,
    orderRef: r.order.ref,
    customerName: r.order.customerName,
    phone: r.order.phone,
    parts: r.items.map((i) => `${i.orderItem.name}${i.qty > 1 ? ` × ${i.qty}` : ""}`),
    photoCount: r._count.photos,
  }));
}

/** How many wait on the shop: to answer, and to receive. */
export async function openReturnCounts() {
  const rows = await prisma.returnRequest.groupBy({
    by: ["status"],
    where: { status: { in: ["REQUESTED", "APPROVED", "RECEIVED"] } },
    _count: { _all: true },
  });
  const n = (s: ReturnStatus) => rows.find((r) => r.status === s)?._count._all ?? 0;
  return { requested: n("REQUESTED"), approved: n("APPROVED"), received: n("RECEIVED") };
}

/** One request with everything the shop needs to decide. */
export async function adminReturnDetail(id: string) {
  const r = await prisma.returnRequest.findUnique({
    where: { id },
    select: {
      ...requestSelect,
      photos: { orderBy: { createdAt: "asc" }, select: { id: true } },
      items: {
        select: {
          orderItemId: true,
          qty: true,
          orderItem: { select: { name: true, sku: true, unitPrice: true, productId: true, fit: true, qty: true } },
        },
      },
      order: {
        select: {
          id: true,
          ref: true,
          customerName: true,
          phone: true,
          email: true,
          vehicleLabel: true,
          deliveryMethod: true,
          governorate: true,
          address: true,
          createdAt: true,
        },
      },
    },
  });
  if (!r) return null;
  const delivered = await deliveredAt(r.order.id);
  return {
    ...customerView(r as unknown as RequestRow),
    id: r.id,
    restocked: r.restocked,
    photoIds: r.photos.map((p) => p.id),
    deliveredAt: delivered?.toISOString() ?? null,
    next: RETURN_NEXT[r.status as ReturnStatus],
    order: { ...r.order, createdAt: r.order.createdAt.toISOString() },
    lines: r.items.map((i) => ({
      orderItemId: i.orderItemId,
      name: i.orderItem.name,
      sku: i.orderItem.sku,
      qty: i.qty,
      ordered: i.orderItem.qty,
      unitPrice: toNumber(i.orderItem.unitPrice),
      fit: i.orderItem.fit,
      productId: i.orderItem.productId,
    })),
    /** At the prices charged — a starting figure for a refund, which the shop sets. */
    value: returnValue(r.items.map((i) => ({ qty: i.qty, unitPrice: toNumber(i.orderItem.unitPrice) }))),
  };
}
export type AdminReturnDetail = NonNullable<Awaited<ReturnType<typeof adminReturnDetail>>>;

/** The returns of one order, for its admin page. */
export async function returnsOfOrder(orderId: string) {
  const rows = await prisma.returnRequest.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
    select: { id: true, ref: true, status: true, reason: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

/** A customer's photo, for the shop only. */
export function returnPhoto(id: string) {
  return prisma.returnPhoto.findUnique({ where: { id }, select: { data: true, mime: true } });
}
