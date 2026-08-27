import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatTND, toNumber } from "@/lib/money";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import OrderStatusButtons from "@/components/admin/OrderStatusButtons";

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
        <Link href="/admin/commandes" className="text-navy-700 underline">Commandes</Link>
        <span>›</span>
        <span className="font-mono font-bold">{order.ref}</span>
      </div>

      <div className="p-5 rounded-xl bg-white border border-gray-200 flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-extrabold font-mono">{order.ref}</h1>
            <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleString("fr-FR")}</p>
          </div>
          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-gray-100">{ORDER_STATUS_LABEL[order.status]}</span>
        </div>

        <div>
          <h2 className="text-xs font-bold text-gray-400 uppercase mb-2">Mettre à jour le statut</h2>
          <OrderStatusButtons orderId={order.id} status={order.status} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-sm border-t pt-4">
          <div>
            <h2 className="text-xs font-bold text-gray-400 uppercase mb-1">Client</h2>
            <p className="font-medium">{order.customerName}</p>
            <p dir="ltr" className="text-start text-gray-600">{order.phone}</p>
            {order.email && <p className="text-gray-600">{order.email}</p>}
            {order.user && <p className="text-xs text-gray-400 mt-1">Compte : {order.user.email}</p>}
          </div>
          <div>
            <h2 className="text-xs font-bold text-gray-400 uppercase mb-1">Livraison</h2>
            <p>{order.deliveryMethod === "PICKUP" ? "Retrait en magasin" : "Livraison à domicile"}</p>
            <p className="text-gray-600">{order.governorate}</p>
            {order.address && <p className="text-gray-600">{order.address}</p>}
            <p className="text-xs text-gray-400 mt-1">
              Paiement : {order.paymentMethod === "COD" ? "À la livraison" : "Carte bancaire"}
            </p>
          </div>
        </div>

        {order.notes && (
          <div className="border-t pt-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase mb-1">Note client</h2>
            <p className="text-sm text-gray-700">{order.notes}</p>
          </div>
        )}

        <div className="border-t pt-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase mb-2">Articles</h2>
          <div className="flex flex-col divide-y">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between py-2 text-sm">
                <span>{item.qty}× {item.name} <span className="text-gray-400">({item.sku})</span></span>
                <span className="font-medium">{formatTND(toNumber(item.lineTotal))}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1 border-t mt-2 pt-2 text-sm">
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

        <div className="border-t pt-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase mb-2">Historique</h2>
          <div className="flex flex-col gap-1.5">
            {order.history.map((h) => (
              <div key={h.id} className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-1.5 h-1.5 rounded-full bg-navy-700" />
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
          className="self-start px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold"
        >
          Contacter sur WhatsApp
        </a>
      </div>
    </div>
  );
}
