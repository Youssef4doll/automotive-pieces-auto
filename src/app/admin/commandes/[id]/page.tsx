import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatTND, toNumber } from "@/lib/money";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import OrderStatusButtons from "@/components/admin/OrderStatusButtons";
import StatusBadge from "@/components/admin/StatusBadge";

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, history: { orderBy: { createdAt: "asc" } }, user: true },
  });
  if (!order) notFound();

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/admin/commandes" className="font-display font-bold uppercase text-xs tracking-wide text-red-500">
          Commandes
        </Link>
        <span className="text-navy-900/30">›</span>
        <span className="font-mono font-bold">{order.ref}</span>
      </div>

      <div className="p-5 rounded-xl bg-white border border-navy-900/10 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-heading font-extrabold font-mono">{order.ref}</h1>
            <p className="text-xs text-navy-900/40">{new Date(order.createdAt).toLocaleString("fr-FR")}</p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <div>
          <h2 className="text-xs font-display font-bold text-navy-900/45 uppercase tracking-wide mb-2">Mettre à jour le statut</h2>
          <OrderStatusButtons orderId={order.id} status={order.status} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-sm border-t border-navy-900/8 pt-4">
          <div>
            <h2 className="text-xs font-display font-bold text-navy-900/45 uppercase tracking-wide mb-1">Client</h2>
            <p className="font-medium">{order.customerName}</p>
            <p dir="ltr" className="text-start text-gray-600">{order.phone}</p>
            {order.email && <p className="text-gray-600">{order.email}</p>}
            {order.user && <p className="text-xs text-navy-900/40 mt-1">Compte : {order.user.email}</p>}
          </div>
          <div>
            <h2 className="text-xs font-display font-bold text-navy-900/45 uppercase tracking-wide mb-1">Livraison</h2>
            <p>{order.deliveryMethod === "PICKUP" ? "Retrait en magasin" : "Livraison à domicile"}</p>
            <p className="text-gray-600">{order.governorate}</p>
            {order.address && <p className="text-gray-600">{order.address}</p>}
            <p className="text-xs text-navy-900/40 mt-1">
              Paiement : {order.paymentMethod === "COD" ? "À la livraison" : "Carte bancaire"}
            </p>
          </div>
        </div>

        {order.notes && (
          <div className="border-t border-navy-900/8 pt-3">
            <h2 className="text-xs font-display font-bold text-navy-900/45 uppercase tracking-wide mb-1">Note client</h2>
            <p className="text-sm text-gray-700">{order.notes}</p>
          </div>
        )}

        <div className="border-t border-navy-900/8 pt-4">
          <h2 className="text-xs font-display font-bold text-navy-900/45 uppercase tracking-wide mb-2">Articles</h2>
          <div className="flex flex-col divide-y divide-navy-900/8">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between py-2 text-sm">
                <span>{item.qty}× {item.name} <span className="text-navy-900/40">({item.sku})</span></span>
                <span className="font-medium">{formatTND(toNumber(item.lineTotal))}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1 border-t border-navy-900/8 mt-2 pt-2 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Sous-total</span>
              <span>{formatTND(toNumber(order.subtotal))}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Livraison</span>
              <span>{toNumber(order.shippingFee) === 0 ? "Gratuite" : formatTND(toNumber(order.shippingFee))}</span>
            </div>
            <div className="flex justify-between font-bold text-navy-900 text-base">
              <span>Total</span>
              <span>{formatTND(toNumber(order.total))}</span>
            </div>
          </div>
        </div>

        <div className="border-t border-navy-900/8 pt-4">
          <h2 className="text-xs font-display font-bold text-navy-900/45 uppercase tracking-wide mb-2">Historique</h2>
          <div className="flex flex-col gap-1.5">
            {order.history.map((h) => (
              <div key={h.id} className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-1.5 h-1.5 rounded-full bg-gold-500" />
                <span className="font-semibold text-navy-900">{ORDER_STATUS_LABEL[h.status]}</span>
                <span>· {new Date(h.createdAt).toLocaleString("fr-FR")}</span>
              </div>
            ))}
          </div>
        </div>

        <a
          href={`https://wa.me/${order.phone.replace(/[^0-9]/g, "")}`}
          target="_blank"
          rel="noreferrer"
          className="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-700 hover:bg-green-800 text-white text-sm font-display font-bold uppercase tracking-wide"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5 14c-.4 1-2 1.7-3 1.4-1.6-.4-4-1.6-5.7-4.3-1-1.6-1.1-3-.6-3.8.3-.5 1-.9 1.5-.8.3 0 .6.7.9 1.4.2.5 0 .8-.3 1.1-.3.4-.3.5-.1.9.5.9 1.6 2 2.7 2.4.4.2.6.1.9-.2.3-.4.6-1 1-.9.7.3 1.5.8 1.6 1.1.1.3 0 1-.9 1.7Z" />
          </svg>
          Contacter sur WhatsApp
        </a>
      </div>
    </div>
  );
}
