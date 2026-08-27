import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getMyOrders } from "@/app/actions/orders";
import { toNumber } from "@/lib/money";
import OrderStatusTimeline from "@/components/OrderStatusTimeline";
import Price from "@/components/Price";

export const metadata = { title: "Mes commandes" };

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

  const orders = await getMyOrders();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl sm:text-2xl font-heading font-extrabold uppercase text-navy-950 tracking-tight">Mes commandes</h1>
        <Link href="/compte" className="text-sm text-navy-900 underline">← Mon compte</Link>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-300 rounded-xl">
          <p className="text-gray-500 mb-4">Aucune commande pour le moment</p>
          <Link href="/" className="px-4 py-2.5 rounded-lg bg-navy-900 text-white text-sm font-semibold">
            Découvrir le catalogue
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {orders.map((order) => (
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
                <OrderStatusTimeline status={order.status} />
              </div>

              <div className="border-t pt-3 flex flex-col gap-1 mb-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.qty}× {item.name}</span>
                    <Price value={toNumber(item.lineTotal)} className="font-medium" />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm text-gray-500">
                  {order.deliveryMethod === "PICKUP" ? "Retrait en magasin" : `Livraison · ${order.governorate}`}
                </span>
                <Price value={toNumber(order.total)} className="font-bold text-navy-900" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
