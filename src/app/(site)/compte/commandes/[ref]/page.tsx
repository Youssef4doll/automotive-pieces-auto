import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { toNumber, formatTNDfr } from "@/lib/money";
import { contactFrom, getOrderCounts } from "@/lib/data/account";
import AccountShell from "@/components/account/AccountShell";
import { initialsOf } from "@/lib/initials";
import OrderTracker from "@/components/account/OrderTracker";
import ReorderButton, { type ReorderItem } from "@/components/ReorderButton";
import { StatusBadge, NEXT_STEP, HelpPanel } from "@/components/account/OrderBits";
import { IconArrowRight, IconTruck } from "@/components/account/icons";

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref } = await params;
  return { title: `Commande ${ref}` };
}

const PAYMENT_LABEL: Record<string, string> = {
  COD: "Paiement à la livraison",
  CARD: "Carte bancaire",
};

export default async function OrderDetailPage({ params }: { params: Promise<{ ref: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/compte");

  const { ref } = await params;
  const order = await prisma.order.findUnique({
    where: { ref },
    select: {
      id: true, ref: true, status: true, total: true, subtotal: true, shippingFee: true,
      createdAt: true, governorate: true, address: true, deliveryMethod: true,
      paymentMethod: true, notes: true, userId: true,
      history: { orderBy: { createdAt: "asc" }, select: { status: true, createdAt: true } },
      items: {
        select: { id: true, name: true, sku: true, qty: true, unitPrice: true, lineTotal: true, imageUrl: true, productId: true },
      },
    },
  });

  // An order belongs to exactly one account; anything else is not found, not
  // "forbidden" — we do not confirm that a reference exists to someone else.
  if (!order || order.userId !== user.id) notFound();

  const [settings, counts, live] = await Promise.all([
    getSettings(),
    getOrderCounts(user.id),
    prisma.product.findMany({
      where: { id: { in: order.items.map((i) => i.productId).filter(Boolean) as string[] } },
      select: { id: true, slug: true, stockQty: true, active: true },
    }),
  ]);
  const liveById = new Map(live.map((p) => [p.id, p]));
  const contact = contactFrom(settings);

  const reorderItems: ReorderItem[] = order.items
    .filter((i) => i.productId && liveById.get(i.productId)?.active)
    .map((i) => {
      const p = liveById.get(i.productId!)!;
      return {
        productId: p.id, name: i.name, sku: i.sku, slug: p.slug,
        imageUrl: i.imageUrl, unitPrice: toNumber(i.unitPrice), stockQty: p.stockQty, qty: i.qty,
      };
    });

  return (
    <AccountShell
      title={`Commande ${order.ref}`}
      subtitle={new Date(order.createdAt).toLocaleDateString("fr-FR", {
        day: "numeric", month: "long", year: "numeric",
      })}
      initials={initialsOf(user.name)}
      orderCount={counts.total}
      activeOrders={counts.active}
      whatsapp={contact.whatsapp}
      action={
        <Link
          href="/compte/commandes"
          className="hidden sm:inline-flex items-center min-h-tap px-4 rounded-xl border border-slate-300 text-navy-900 text-sm font-semibold hover:border-navy-700 transition-colors"
        >
          Toutes mes commandes
        </Link>
      }
    >
      <div className="flex flex-col gap-4 lg:gap-5">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-4 sm:px-6 border-b border-slate-100 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-slate-400">Total</p>
              <p className="text-2xl font-heading font-extrabold text-navy-950 mt-1 tabular-nums">
                {formatTNDfr(toNumber(order.total))}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {order.deliveryMethod === "PICKUP" ? "Retrait en magasin" : `Livraison ${order.governorate}`}
              </p>
            </div>
            <StatusBadge status={order.status} />
          </div>

          <div className="px-5 py-5 sm:px-6">
            <h2 className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-slate-400 mb-3">Statut</h2>
            <OrderTracker
              status={order.status}
              placedAt={order.createdAt.toISOString()}
              events={order.history.map((h) => ({ status: h.status, at: h.createdAt.toISOString() }))}
            />
            <p className="text-sm text-slate-600 mt-4">{NEXT_STEP[order.status]}</p>
          </div>
        </section>

        <section aria-labelledby="products" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 id="products" className="font-heading font-extrabold uppercase text-navy-950 tracking-tight mb-3">
            Produits
          </h2>
          <ul className="flex flex-col divide-y divide-slate-100">
            {order.items.map((item) => {
              const p = item.productId ? liveById.get(item.productId) : null;
              const inner = (
                <div className="flex items-center gap-3 py-3">
                  <Image
                    src={item.imageUrl}
                    alt=""
                    width={56}
                    height={56}
                    loading="lazy"
                    className="w-14 h-14 rounded-lg object-cover bg-slate-50 border border-slate-100 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-navy-950 leading-snug">{item.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">{item.sku}</p>
                    <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                      {item.qty} × {formatTNDfr(toNumber(item.unitPrice))}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-navy-950 tabular-nums shrink-0">
                    {formatTNDfr(toNumber(item.lineTotal))}
                  </span>
                </div>
              );
              return (
                <li key={item.id}>
                  {p?.active ? (
                    <Link href={`/produit/${p.slug}`} className="block -mx-2 px-2 rounded-lg hover:bg-slate-50">
                      {inner}
                    </Link>
                  ) : (
                    <div className="-mx-2 px-2">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>

          <dl className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Sous-total</dt>
              <dd className="tabular-nums text-navy-950">{formatTNDfr(toNumber(order.subtotal))}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Livraison</dt>
              <dd className="tabular-nums text-navy-950">
                {toNumber(order.shippingFee) === 0 ? "Offerte" : formatTNDfr(toNumber(order.shippingFee))}
              </dd>
            </div>
            <div className="flex justify-between pt-2 mt-1 border-t border-slate-100">
              <dt className="font-semibold text-navy-950">Total</dt>
              <dd className="font-heading font-extrabold text-lg text-navy-950 tabular-nums">
                {formatTNDfr(toNumber(order.total))}
              </dd>
            </div>
          </dl>

          <div className="mt-4">
            <ReorderButton items={reorderItems} />
          </div>
        </section>

        <div className="grid sm:grid-cols-2 gap-4 [&>*]:min-w-0">
          <section aria-labelledby="delivery" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h2
              id="delivery"
              className="flex items-center gap-2 font-heading font-extrabold uppercase text-navy-950 tracking-tight mb-3"
            >
              <IconTruck className="text-slate-400" /> Livraison
            </h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div>
                <dt className="text-xs text-slate-400 uppercase font-bold">Mode</dt>
                <dd className="text-navy-950">
                  {order.deliveryMethod === "PICKUP" ? "Retrait en magasin" : "Livraison à domicile"}
                </dd>
              </div>
              {order.deliveryMethod !== "PICKUP" && (
                <div>
                  <dt className="text-xs text-slate-400 uppercase font-bold">Destination</dt>
                  <dd className="text-navy-950">{order.governorate}</dd>
                  {/* Address only when one was actually captured. */}
                  {order.address && <dd className="text-slate-500 text-xs mt-0.5">{order.address}</dd>}
                </div>
              )}
              {order.notes && (
                <div>
                  <dt className="text-xs text-slate-400 uppercase font-bold">Votre note</dt>
                  <dd className="text-slate-600 text-xs">{order.notes}</dd>
                </div>
              )}
            </dl>
          </section>

          <section aria-labelledby="payment" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h2 id="payment" className="font-heading font-extrabold uppercase text-navy-950 tracking-tight mb-3">
              Paiement
            </h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div>
                <dt className="text-xs text-slate-400 uppercase font-bold">Mode</dt>
                <dd className="text-navy-950">{PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400 uppercase font-bold">Montant</dt>
                <dd className="text-navy-950 tabular-nums font-semibold">{formatTNDfr(toNumber(order.total))}</dd>
              </div>
            </dl>
          </section>
        </div>

        <HelpPanel contact={contact} orderRef={order.ref} />

        <Link
          href="/compte/commandes"
          className="sm:hidden inline-flex items-center justify-center gap-1.5 min-h-tap rounded-xl border border-slate-300 text-navy-900 text-sm font-semibold"
        >
          Toutes mes commandes <IconArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </AccountShell>
  );
}
