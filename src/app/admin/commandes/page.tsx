import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatTND, toNumber } from "@/lib/money";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import StatusBadge from "@/components/admin/StatusBadge";
import type { OrderStatus } from "@prisma/client";

const STATUSES: OrderStatus[] = ["PENDING", "CONFIRMED", "PREPARED", "SHIPPED", "DELIVERED", "CANCELLED"];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;

  const orders = await prisma.order.findMany({
    where: {
      ...(status ? { status: status as OrderStatus } : {}),
      ...(q
        ? {
            OR: [
              { ref: { contains: q, mode: "insensitive" } },
              { customerName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">Commandes</h1>

      <form className="flex flex-wrap gap-2 items-center">
        <input
          name="q"
          defaultValue={q}
          placeholder="Réf, client, téléphone…"
          className="px-3 py-2 border border-navy-900/15 rounded-lg text-sm outline-none focus:border-gold-500"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="px-3 py-2 border border-navy-900/15 rounded-lg text-sm outline-none focus:border-gold-500"
        >
          <option value="">Tous les statuts</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>
          ))}
        </select>
        <button className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-sm font-display font-bold uppercase tracking-wide">
          Filtrer
        </button>
      </form>

      <div className="rounded-xl border border-navy-900/10 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-navy-950 text-white/70">
            <tr>
              <th className="text-start px-4 py-3 font-display font-bold uppercase text-[11px] tracking-wider">Réf.</th>
              <th className="text-start px-4 py-3 font-display font-bold uppercase text-[11px] tracking-wider">Client</th>
              <th className="text-start px-4 py-3 font-display font-bold uppercase text-[11px] tracking-wider">Date</th>
              <th className="text-start px-4 py-3 font-display font-bold uppercase text-[11px] tracking-wider">Statut</th>
              <th className="text-end px-4 py-3 font-display font-bold uppercase text-[11px] tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-900/8">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/commandes/${o.id}`} className="font-mono font-bold text-navy-900">{o.ref}</Link>
                </td>
                <td className="px-4 py-3">{o.customerName}</td>
                <td className="px-4 py-3 text-navy-900/50">{new Date(o.createdAt).toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.status} />
                </td>
                <td className="px-4 py-3 text-end font-semibold">{formatTND(toNumber(o.total))}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-navy-900/40">Aucune commande</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
