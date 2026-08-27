import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatTND, toNumber } from "@/lib/money";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
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
      <h1 className="text-2xl font-extrabold">Commandes</h1>

      <form className="flex flex-wrap gap-2 items-center">
        <input
          name="q"
          defaultValue={q}
          placeholder="Réf, client, téléphone…"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        <select name="status" defaultValue={status ?? ""} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">Tous les statuts</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>
          ))}
        </select>
        <button className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-semibold">Filtrer</button>
      </form>

      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-start px-4 py-3">Réf.</th>
              <th className="text-start px-4 py-3">Client</th>
              <th className="text-start px-4 py-3">Date</th>
              <th className="text-start px-4 py-3">Statut</th>
              <th className="text-end px-4 py-3">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/commandes/${o.id}`} className="font-mono font-bold text-navy-900">{o.ref}</Link>
                </td>
                <td className="px-4 py-3">{o.customerName}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(o.createdAt).toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100">{ORDER_STATUS_LABEL[o.status]}</span>
                </td>
                <td className="px-4 py-3 text-end font-semibold">{formatTND(toNumber(o.total))}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">Aucune commande</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
