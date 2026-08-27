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
      <Link href="/admin/clients" className="text-sm font-display font-bold uppercase text-xs tracking-wide text-red-500 self-start">
        ← Clients
      </Link>

      <div className="p-5 rounded-xl bg-white border border-navy-900/10 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-heading font-extrabold text-navy-950">{customer.name}</h1>
          <p className="text-sm text-gray-500">{customer.email}</p>
          {customer.phone && <p className="text-sm text-gray-500" dir="ltr">{customer.phone}</p>}
        </div>
        <div className="text-end">
          <p className="text-xs font-display font-bold text-navy-900/45 uppercase tracking-wide">Valeur totale</p>
          <p className="text-xl font-heading font-extrabold text-navy-900">{formatTND(ltv)}</p>
          <span className="text-xs font-display font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-gold-500/20 text-navy-900">
            {customer.segment}
          </span>
        </div>
      </div>

      <div className="p-5 rounded-xl bg-white border border-navy-900/10 shadow-sm">
        <h2 className="font-display font-bold uppercase tracking-wide text-sm text-navy-950 mb-3">Historique des commandes</h2>
        <div className="flex flex-col divide-y divide-navy-900/8">
          {customer.orders.map((o) => (
            <Link key={o.id} href={`/admin/commandes/${o.id}`} className="flex items-center justify-between py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded">
              <div>
                <p className="font-mono font-bold text-sm">{o.ref}</p>
                <p className="text-xs text-navy-900/40">{new Date(o.createdAt).toLocaleDateString("fr-FR")}</p>
              </div>
              <div className="text-end">
                <p className="font-semibold text-sm">{formatTND(toNumber(o.total))}</p>
                <p className="text-xs text-navy-900/40">{ORDER_STATUS_LABEL[o.status]}</p>
              </div>
            </Link>
          ))}
          {customer.orders.length === 0 && <p className="text-sm text-navy-900/40 py-4">Aucune commande</p>}
        </div>
      </div>
    </div>
  );
}
