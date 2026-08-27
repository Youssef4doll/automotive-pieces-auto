import Link from "next/link";
import { getDashboardData } from "@/lib/data/admin";
import { formatTND, toNumber } from "@/lib/money";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";

export default async function AdminDashboard() {
  const data = await getDashboardData();
  const maxRevenue = Math.max(1, ...data.last7Days.map((d) => d.revenue));

  const kpis = [
    { label: "Commandes", value: data.orderCount.toString(), sub: `${data.pendingCount} en attente` },
    { label: "Revenu total", value: formatTND(data.revenue), sub: "toutes commandes" },
    { label: "Panier moyen", value: formatTND(data.avgBasket), sub: "" },
    { label: "Clients", value: data.customerCount.toString(), sub: "comptes créés" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="p-4 rounded-xl bg-white border border-gray-200 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase">{k.label}</p>
            <p className="text-2xl font-extrabold text-navy-950 mt-1">{k.value}</p>
            {k.sub && <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 p-5 rounded-xl bg-white border border-gray-200 shadow-sm">
          <h2 className="font-bold text-navy-950 mb-4">Revenu — 7 derniers jours</h2>
          <div className="flex items-end gap-2 h-40">
            {data.last7Days.map((d) => (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full flex items-end h-32">
                  <div
                    className="w-full bg-red-500 rounded-t-md min-h-[2px]"
                    style={{ height: `${(d.revenue / maxRevenue) * 100}%` }}
                    title={formatTND(d.revenue)}
                  />
                </div>
                <span className="text-[10px] text-gray-400 capitalize">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm">
          <h2 className="font-bold text-navy-950 mb-4">Top produits</h2>
          <div className="flex flex-col gap-3">
            {data.topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.qty} vendus</p>
                </div>
                <span className="text-sm font-bold text-navy-900">{formatTND(p.revenue)}</span>
              </div>
            ))}
            {data.topProducts.length === 0 && <p className="text-sm text-gray-400">Aucune vente pour le moment</p>}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-navy-950">Commandes récentes</h2>
            <Link href="/admin/commandes" className="text-xs text-navy-700 font-semibold underline">Tout voir</Link>
          </div>
          <div className="flex flex-col divide-y">
            {data.recentOrders.map((o) => (
              <Link key={o.id} href={`/admin/commandes/${o.id}`} className="flex items-center justify-between py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded">
                <div>
                  <p className="text-sm font-mono font-bold">{o.ref}</p>
                  <p className="text-xs text-gray-400">{o.customerName}</p>
                </div>
                <div className="text-end">
                  <p className="text-sm font-bold">{formatTND(toNumber(o.total))}</p>
                  <p className="text-xs text-gray-400">{ORDER_STATUS_LABEL[o.status]}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-navy-950">Stock faible</h2>
            <Link href="/admin/stock" className="text-xs text-navy-700 font-semibold underline">Gérer le stock</Link>
          </div>
          <div className="flex flex-col divide-y">
            {data.lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.category.name}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded ${p.stockQty === 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                  {p.stockQty} en stock
                </span>
              </div>
            ))}
            {data.lowStock.length === 0 && <p className="text-sm text-gray-400">Aucune alerte de stock</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
