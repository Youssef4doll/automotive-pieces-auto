import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getMyOrders } from "@/app/actions/orders";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";
import OrderStatusTimeline from "@/components/OrderStatusTimeline";
import Price from "@/components/Price";
import SupportCard from "@/components/SupportCard";
import ReorderButton, { type ReorderItem } from "@/components/ReorderButton";
import AccountShell from "@/components/account/AccountShell";

export const metadata = { title: "Mes commandes" };

const NEXT_STEP: Record<string, string> = {
  PENDING: "Nous confirmons votre commande, en général sous quelques heures.",
  CONFIRMED: "Nous préparons vos pièces.",
  PREPARED: "Prête — elle part à la livraison très prochainement.",
  SHIPPED: "En route. Le livreur vous appelle avant de passer.",
  DELIVERED: "Livrée. Un souci avec une pièce ? Écrivez-nous, on s'en occupe.",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  PREPARED: "Préparée",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
};

export default async function OrdersTrackingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/compte");

  const [orders, settings] = await Promise.all([getMyOrders(), getSettings()]);

  // Order lines are snapshots, so they cannot say whether the part is still
  // buyable today. One lookup gives every line its live slug and stock, which
  // is what "commander à nouveau" needs to be honest.
  const productIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.productId).filter(Boolean)))] as string[];
  const live = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, slug: true, stockQty: true, active: true },
      })
    : [];
  const liveById = new Map(live.map((p) => [p.id, p]));

  const contact = {
    whatsapp: settings.shop_whatsapp,
    phone: settings.shop_phone,
    email: settings.shop_email,
    hours: settings.shop_hours,
  };

  return (
    <AccountShell
      title="Mes commandes"
      subtitle={orders.length > 0 ? "Suivi, contenu et rachat en un geste." : undefined}
      count={orders.length}
    >

      {orders.length === 0 ? (
        <div className="flex flex-col gap-4">
          <div className="text-center py-12 border border-dashed border-gray-300 rounded-xl px-4">
            <p className="text-3xl mb-3">📦</p>
            <p className="text-gray-600 font-medium mb-1">Aucune commande pour le moment</p>
            <p className="text-sm text-gray-500 mb-4">
              Dites-nous votre voiture et on ne vous montrera que les pièces qui vont dessus.
            </p>
            <Link href="/" className="inline-flex items-center min-h-tap px-5 rounded-lg bg-navy-900 text-white text-sm font-semibold">
              Découvrir le catalogue
            </Link>
          </div>
          <SupportCard contact={contact} />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {orders.map((order) => {
            const reorderItems: ReorderItem[] = order.items
              .filter((i) => i.productId && liveById.get(i.productId)?.active)
              .map((i) => {
                const p = liveById.get(i.productId!)!;
                return {
                  productId: p.id,
                  name: i.name,
                  sku: i.sku,
                  slug: p.slug,
                  imageUrl: i.imageUrl,
                  unitPrice: toNumber(i.unitPrice),
                  stockQty: p.stockQty,
                  qty: i.qty,
                };
              });

            return (
              <div key={order.id} className="p-4 sm:p-5 rounded-xl border border-gray-200 bg-white">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <p className="font-mono font-bold text-navy-950" dir="ltr">{order.ref}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(order.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                      order.status === "DELIVERED"
                        ? "bg-green-100 text-green-700"
                        : order.status === "CANCELLED"
                          ? "bg-red-100 text-red-700"
                          : "bg-gold-500/20 text-navy-900"
                    }`}
                  >
                    {STATUS_LABEL[order.status]}
                  </span>
                </div>

                <div className="mb-4">
                  <OrderStatusTimeline
                    status={order.status}
                    events={order.history.map((h) => ({ status: h.status, at: h.createdAt.toISOString() }))}
                  />
                </div>

                {/* Say what happens next, not just where it got to — the two
                    together are what stop a customer having to ask. */}
                {NEXT_STEP[order.status] && (
                  <p className="text-xs text-gray-500 mb-3 -mt-1">{NEXT_STEP[order.status]}</p>
                )}

                {/* Photos, not just names: a shopper recognises the part they
                    bought far faster than they read a reference number. */}
                <div className="border-t pt-3 flex flex-col gap-2.5 mb-3">
                  {order.items.map((item) => {
                    const p = item.productId ? liveById.get(item.productId) : null;
                    const row = (
                      <div className="flex items-center gap-3">
                        <Image
                          src={item.imageUrl}
                          alt=""
                          width={48}
                          height={48}
                          className="w-12 h-12 rounded-md object-cover bg-gray-50 shrink-0 border border-gray-100"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-navy-950 font-medium leading-snug">{item.name}</p>
                          <p className="text-xs text-gray-400">
                            {item.qty} × <Price value={toNumber(item.unitPrice)} className="inline" />
                          </p>
                        </div>
                        <Price value={toNumber(item.lineTotal)} className="text-sm font-semibold shrink-0" />
                      </div>
                    );
                    return p?.active ? (
                      <Link key={item.id} href={`/produit/${p.slug}`} className="hover:bg-gray-50 -mx-2 px-2 py-1 rounded-lg">
                        {row}
                      </Link>
                    ) : (
                      <div key={item.id} className="-mx-2 px-2 py-1">{row}</div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between border-t pt-3 gap-3 flex-wrap">
                  <span className="text-sm text-gray-500">
                    {order.deliveryMethod === "PICKUP" ? "Retrait en magasin" : `Livraison · ${order.governorate}`}
                  </span>
                  <Price value={toNumber(order.total)} className="font-bold text-navy-900" />
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap mt-3 pt-3 border-t">
                  <ReorderButton items={reorderItems} />
                  <SupportCard contact={contact} orderRef={order.ref} compact />
                </div>
              </div>
            );
          })}

          <SupportCard contact={contact} />
        </div>
      )}
    </AccountShell>
  );
}
