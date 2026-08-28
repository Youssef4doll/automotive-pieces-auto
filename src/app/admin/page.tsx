import Link from "next/link";
import { getDashboardData } from "@/lib/data/admin";
import { formatTND, toNumber } from "@/lib/money";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import StatusBadge from "@/components/admin/StatusBadge";

export default async function AdminDashboard() {
  const data = await getDashboardData();
  const maxRevenue = Math.max(1, ...data.last7Days.map((d) => d.revenue));

  const kpis = [
    { label: "Commandes", value: data.orderCount.toString(), sub: `${data.pendingCount} en attente` },
    { label: "Revenu total", value: formatTND(data.revenue), sub: "toutes commandes" },
    { label: "Panier moyen", value: formatTND(data.avgBasket), sub: "" },
    { label: "Clients", value: data.customerCount.toString(), sub: "comptes créés" },
  ];

  const ALERT_STYLE: Record<string, string> = {
    critical: "bg-red-50 border-red-200 text-red-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    opportunity: "bg-blue-50 border-blue-200 text-blue-800",
    success: "bg-green-50 border-green-200 text-green-800",
  };
  const ALERT_ICON: Record<string, string> = { critical: "🔴", warning: "🟠", opportunity: "🔵", success: "🟢" };

  const periodTiles = [
    { label: "Aujourd'hui", revenue: data.periods.today.revenue, orders: data.periods.today.orders },
    { label: "Cette semaine", revenue: data.periods.week.revenue, orders: data.periods.week.orders },
    { label: "Ce mois", revenue: data.periods.month.revenue, orders: data.periods.month.orders },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">Dashboard</h1>

      {data.alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {data.alerts.map((a, i) => (
            <div key={i} className={`px-4 py-2.5 rounded-lg border text-sm font-medium flex items-center gap-2 ${ALERT_STYLE[a.level]}`}>
              <span>{ALERT_ICON[a.level]}</span>
              {a.text}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {periodTiles.map((p) => (
          <div key={p.label} className="p-4 rounded-xl bg-white border border-navy-900/10 shadow-sm">
            <p className="text-xs font-display font-bold text-navy-900/45 uppercase tracking-wide">{p.label}</p>
            <p className="text-xl font-heading font-extrabold text-navy-950 mt-1">{formatTND(p.revenue)}</p>
            <p className="text-xs text-navy-900/40 mt-0.5">{p.orders} commande{p.orders > 1 ? "s" : ""}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="p-4 rounded-xl bg-white border border-navy-900/10 border-l-4 border-l-gold-500 shadow-sm">
            <p className="text-xs font-display font-bold text-navy-900/45 uppercase tracking-wide">{k.label}</p>
            <p className="text-2xl font-heading font-extrabold text-navy-950 mt-1">{k.value}</p>
            {k.sub && <p className="text-xs text-navy-900/40 mt-0.5">{k.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 p-5 rounded-xl bg-white border border-navy-900/10 shadow-sm">
          <h2 className="font-display font-bold uppercase tracking-wide text-sm text-navy-950 mb-4">Revenu — 7 derniers jours</h2>
          <div className="flex items-end gap-2 h-40">
            {data.last7Days.map((d) => (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full flex items-end h-32">
                  <div
                    className="w-full bg-gold-500 rounded-t-md min-h-[2px]"
                    style={{ height: `${(d.revenue / maxRevenue) * 100}%` }}
                    title={formatTND(d.revenue)}
                  />
                </div>
                <span className="text-[10px] text-navy-900/40 capitalize">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-navy-900/10 shadow-sm">
          <h2 className="font-display font-bold uppercase tracking-wide text-sm text-navy-950 mb-4">Top produits</h2>
          <div className="flex flex-col gap-3">
            {data.topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3">
                <span className="text-xs font-bold text-navy-900/35 w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-navy-900/40">{p.qty} vendus</p>
                </div>
                <span className="text-sm font-bold text-navy-900">{formatTND(p.revenue)}</span>
              </div>
            ))}
            {data.topProducts.length === 0 && <p className="text-sm text-navy-900/40">Aucune vente pour le moment</p>}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-white border border-navy-900/10 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold uppercase tracking-wide text-sm text-navy-950">Commandes récentes</h2>
            <Link href="/admin/commandes" className="text-xs font-display font-bold uppercase tracking-wide text-red-500">
              Tout voir
            </Link>
          </div>
          <div className="flex flex-col divide-y divide-navy-900/8">
            {data.recentOrders.map((o) => (
              <Link key={o.id} href={`/admin/commandes/${o.id}`} className="flex items-center justify-between py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded">
                <div>
                  <p className="text-sm font-mono font-bold">{o.ref}</p>
                  <p className="text-xs text-navy-900/40">{o.customerName}</p>
                </div>
                <div className="text-end">
                  <p className="text-sm font-bold">{formatTND(toNumber(o.total))}</p>
                  <p className="text-xs text-navy-900/40">{ORDER_STATUS_LABEL[o.status]}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-navy-900/10 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold uppercase tracking-wide text-sm text-navy-950">Stock faible</h2>
            <Link href="/admin/stock" className="text-xs font-display font-bold uppercase tracking-wide text-red-500">
              Gérer le stock
            </Link>
          </div>
          <div className="flex flex-col divide-y divide-navy-900/8">
            {data.lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-navy-900/40">{p.category.name}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded ${p.stockQty === 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                  {p.stockQty} en stock
                </span>
              </div>
            ))}
            {data.lowStock.length === 0 && <p className="text-sm text-navy-900/40">Aucune alerte de stock</p>}
          </div>
        </div>
      </div>

      <div className="p-5 rounded-xl bg-white border border-navy-900/10 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold uppercase tracking-wide text-sm text-navy-950">Revenu par source d&rsquo;acquisition</h2>
          <Link href="/admin/analytics" className="text-xs font-display font-bold uppercase tracking-wide text-red-500">
            Voir analytics
          </Link>
        </div>
        {data.revenueBySource.length === 0 ? (
          <p className="text-sm text-navy-900/40">Aucune commande pour le moment</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {data.revenueBySource.map((s) => {
              const pct = data.revenue > 0 ? Math.round((s.revenue / data.revenue) * 100) : 0;
              return (
                <div key={s.source} className="flex items-center gap-3">
                  <span className="text-sm text-navy-900/70 w-32 shrink-0 truncate capitalize">{s.source}</span>
                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full bg-gold-500 rounded-full" style={{ width: `${Math.max(2, pct)}%` }} />
                  </div>
                  <span className="text-xs text-navy-900/40 w-10 text-end shrink-0">{pct}%</span>
                  <span className="text-sm font-bold text-navy-900 w-20 text-end shrink-0">{formatTND(s.revenue)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
