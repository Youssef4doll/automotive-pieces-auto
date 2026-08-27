import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatTND, toNumber } from "@/lib/money";

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
      <h1 className="text-2xl font-extrabold">Clients</h1>

      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Nom ou email…" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <button className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-semibold">Rechercher</button>
      </form>

      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-start px-4 py-3">Client</th>
              <th className="text-start px-4 py-3">Segment</th>
              <th className="text-end px-4 py-3">Commandes</th>
              <th className="text-end px-4 py-3">Valeur totale</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {customers.map((c) => {
              const ltv = c.orders.filter((o) => o.status !== "CANCELLED").reduce((s, o) => s + toNumber(o.total), 0);
              return (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/clients/${c.id}`} className="font-medium text-navy-900 hover:underline">{c.name}</Link>
                    <p className="text-xs text-gray-400">{c.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100">{c.segment}</span>
                  </td>
                  <td className="px-4 py-3 text-end">{c.orders.length}</td>
                  <td className="px-4 py-3 text-end font-semibold">{formatTND(ltv)}</td>
                </tr>
              );
            })}
            {customers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">Aucun client</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
