import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatTND, toNumber } from "@/lib/money";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";

export default async function AdminClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await prisma.user.findUnique({
    where: { id },
    include: { orders: { include: { items: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!customer) notFound();

  const ltv = customer.orders.filter((o) => o.status !== "CANCELLED").reduce((s, o) => s + toNumber(o.total), 0);

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <Link href="/admin/clients" className="text-sm text-navy-700 underline">← Clients</Link>

      <div className="p-5 rounded-xl bg-white border border-gray-200 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold">{customer.name}</h1>
          <p className="text-sm text-gray-500">{customer.email}</p>
          {customer.phone && <p className="text-sm text-gray-500" dir="ltr">{customer.phone}</p>}
        </div>
        <div className="text-end">
          <p className="text-xs font-bold text-gray-400 uppercase">Valeur totale</p>
          <p className="text-xl font-extrabold text-navy-900">{formatTND(ltv)}</p>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100">{customer.segment}</span>
        </div>
      </div>

      <div className="p-5 rounded-xl bg-white border border-gray-200">
        <h2 className="font-bold mb-3">Historique des commandes</h2>
        <div className="flex flex-col divide-y">
          {customer.orders.map((o) => (
            <Link key={o.id} href={`/admin/commandes/${o.id}`} className="flex items-center justify-between py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded">
              <div>
                <p className="font-mono font-bold text-sm">{o.ref}</p>
                <p className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleDateString("fr-FR")}</p>
              </div>
              <div className="text-end">
                <p className="font-semibold text-sm">{formatTND(toNumber(o.total))}</p>
                <p className="text-xs text-gray-400">{ORDER_STATUS_LABEL[o.status]}</p>
              </div>
            </Link>
          ))}
          {customer.orders.length === 0 && <p className="text-sm text-gray-400 py-4">Aucune commande</p>}
        </div>
      </div>
    </div>
  );
}
