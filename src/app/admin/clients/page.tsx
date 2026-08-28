import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatTND, toNumber } from "@/lib/money";
import { computeSegment } from "@/lib/segment";

const SEGMENT_STYLE: Record<string, string> = {
  VIP: "bg-gold-500/25 text-navy-900",
  REGULAR: "bg-navy-900/10 text-navy-900",
  NEW: "bg-gray-100 text-gray-500",
};

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const customers = await prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      ...(q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }
        : {}),
    },
    include: { orders: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">Clients</h1>

      <form className="flex gap-2 flex-wrap">
        <input
          name="q"
          defaultValue={q}
          placeholder="Nom ou email…"
          className="flex-1 min-w-0 px-3 min-h-tap border border-navy-900/15 rounded-lg text-sm outline-none focus:border-gold-500"
        />
        <button className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-sm font-display font-bold uppercase tracking-wide">
          Rechercher
        </button>
      </form>

      <div className="rounded-xl border border-navy-900/10 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-navy-950 text-white/70">
            <tr>
              <th className="text-start px-4 py-3 font-display font-bold uppercase text-[11px] tracking-wider">Client</th>
              <th className="text-start px-4 py-3 font-display font-bold uppercase text-[11px] tracking-wider">Segment</th>
              <th className="text-end px-4 py-3 font-display font-bold uppercase text-[11px] tracking-wider">Commandes</th>
              <th className="text-end px-4 py-3 font-display font-bold uppercase text-[11px] tracking-wider">Valeur totale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-900/8">
            {customers.map((c) => {
              const completedOrders = c.orders.filter((o) => o.status !== "CANCELLED");
              const ltv = completedOrders.reduce((s, o) => s + toNumber(o.total), 0);
              const segment = computeSegment(completedOrders.length, ltv);
              return (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/clients/${c.id}`} className="font-medium text-navy-900 hover:underline">{c.name}</Link>
                    <p className="text-xs text-navy-900/40">{c.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-display font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${SEGMENT_STYLE[segment]}`}>
                      {segment}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end">{c.orders.length}</td>
                  <td className="px-4 py-3 text-end font-semibold">{formatTND(ltv)}</td>
                </tr>
              );
            })}
            {customers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-navy-900/40">Aucun client</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
