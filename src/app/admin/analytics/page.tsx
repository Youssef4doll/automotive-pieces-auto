import { getAnalyticsData } from "@/lib/data/admin";

export const metadata = { title: "Analytics" };

const EVENT_LABELS: Record<string, string> = {
  page_view: "Pages vues",
  product_viewed: "Produits consultés",
  category_viewed: "Catégories consultées",
  add_to_cart: "Ajouts au panier",
  vehicle_selected: "Véhicules identifiés",
  search_started: "Recherches",
  checkout_started: "Commandes démarrées",
  checkout_completed: "Commandes confirmées",
  checkout_failed: "Échecs de commande",
  whatsapp_clicked: "Clics WhatsApp",
};

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();

  const kpis = [
    { label: "Événements (30j)", value: data.totalEvents.toLocaleString("fr-TN") },
    { label: "Visiteurs uniques (30j)", value: data.uniqueSessions.toLocaleString("fr-TN") },
    { label: "Clics WhatsApp (30j)", value: data.whatsappClicks.toLocaleString("fr-TN") },
    {
      label: "Taux de conversion",
      value:
        data.funnel[0].count > 0
          ? `${Math.round((data.funnel[3].count / data.funnel[0].count) * 100)}%`
          : "—",
      sub: "vue produit → commande",
    },
  ];

  const maxFunnel = Math.max(1, data.funnel[0].count);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">Analytics</h1>
        <p className="text-sm text-navy-900/50 mt-1">
          Données de première partie — aucun service tiers, aucune clé requise. 30 derniers jours.
        </p>
      </div>

      {data.totalEvents === 0 ? (
        <div className="p-8 rounded-xl bg-white border border-navy-900/10 text-center">
          <p className="text-sm text-navy-900/50">
            Aucun événement enregistré pour l&rsquo;instant — naviguez sur le site pour générer des données.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 [&>*]:min-w-0">
            {kpis.map((k) => (
              <div key={k.label} className="p-4 rounded-xl bg-white border border-navy-900/10 border-l-4 border-l-gold-500 shadow-sm">
                <p className="text-xs font-display font-bold text-navy-900/45 uppercase tracking-wide">{k.label}</p>
                <p className="text-2xl font-heading font-extrabold text-navy-950 mt-1">{k.value}</p>
                {k.sub && <p className="text-xs text-navy-900/40 mt-0.5">{k.sub}</p>}
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-4 [&>*]:min-w-0">
            <div className="lg:col-span-2 p-5 rounded-xl bg-white border border-navy-900/10 shadow-sm">
              <h2 className="font-display font-bold uppercase tracking-wide text-sm text-navy-950 mb-4">
                Entonnoir d&rsquo;achat
              </h2>
              <div className="flex flex-col gap-3">
                {data.funnel.map((f, i) => {
                  const prev = i > 0 ? data.funnel[i - 1].count : null;
                  const dropOff = prev && prev > 0 ? Math.round((1 - f.count / prev) * 100) : null;
                  return (
                    <div key={f.key}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-navy-900">{f.step}</span>
                        <span className="text-navy-900/50">
                          {f.count.toLocaleString("fr-TN")}
                          {dropOff !== null && dropOff > 0 && (
                            <span className="text-red-500 ms-2">−{dropOff}%</span>
                          )}
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full bg-gold-500 rounded-full"
                          style={{ width: `${Math.max(2, (f.count / maxFunnel) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white border border-navy-900/10 shadow-sm">
              <h2 className="font-display font-bold uppercase tracking-wide text-sm text-navy-950 mb-4">
                Événements par type
              </h2>
              <div className="flex flex-col divide-y divide-navy-900/8">
                {data.byName.map((e) => (
                  <div key={e.name} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-navy-900/70">{EVENT_LABELS[e.name] ?? e.name}</span>
                    <span className="font-bold text-navy-900">{e.count.toLocaleString("fr-TN")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-4 [&>*]:min-w-0">
            <TopList title="Recherches les plus fréquentes" empty="Aucune recherche enregistrée" rows={data.topSearches} />
            <TopList title="Produits les plus consultés" empty="Aucune vue produit enregistrée" rows={data.topProductsViewed} mono />
            <TopList title="Catégories les plus consultées" empty="Aucune vue catégorie enregistrée" rows={data.topCategoriesViewed} />
          </div>
        </>
      )}
    </div>
  );
}

function TopList({
  title,
  rows,
  empty,
  mono = false,
}: {
  title: string;
  rows: { value: string; count: number }[];
  empty: string;
  mono?: boolean;
}) {
  return (
    <div className="p-5 rounded-xl bg-white border border-navy-900/10 shadow-sm">
      <h2 className="font-display font-bold uppercase tracking-wide text-sm text-navy-950 mb-4">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-navy-900/40">{empty}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((r, i) => (
            <div key={r.value} className="flex items-center gap-3">
              <span className="text-xs font-bold text-navy-900/35 w-4 shrink-0">{i + 1}</span>
              <span className={`flex-1 min-w-0 text-sm truncate ${mono ? "font-mono text-xs" : ""}`}>{r.value}</span>
              <span className="text-sm font-bold text-navy-900 shrink-0">{r.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
