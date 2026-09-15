import Link from "next/link";
import { getDeepAnalytics, getUnmetTotals } from "@/lib/data/deep-analytics";
import { StatTile, TrendChart, FunnelBars, BarList, StatusChip, Panel } from "@/components/admin/charts";
import { fmtTND, fmtInt, fmtPct } from "@/lib/format-analytics";
import UnmetDemandPaged from "@/components/admin/UnmetDemandPaged";

export const metadata = { title: "Analyse approfondie" };

/**
 * The page you open to decide something.
 *
 * /admin/analytics answers "what happened": events, a funnel, a few top-tens.
 * That page stays. This one is for the questions that have a purchase order or
 * a budget at the end of them — what will next fortnight look like, what to
 * re-order and what to stop buying, which channel actually paid for itself,
 * which cars the shop really serves, and which orders are about to come back.
 *
 * Every panel leads with the decision rather than the metric, because a number
 * with no verb attached is why dashboards go unread.
 *
 * **It is cached for ten minutes and everything it needs is one read.** The
 * admin and the storefront share a database and a connection pool; a page of
 * aggregates recomputed on every refresh is capacity taken from people trying
 * to buy something. See lib/data/deep-analytics for the three rules that keeps
 * to, and e2e-analytics for the budget that holds it there.
 */
export default async function DeepAnalysisPage() {
  // Two reads, on purpose. The cached one is the ninety-day picture; the
  // unmet totals are read fresh because clearing a line is something the shop
  // does on this very page, and a header that stayed wrong for ten minutes
  // afterwards would read as broken. See getUnmetTotals.
  const [d, unmet] = await Promise.all([getDeepAnalytics(), getUnmetTotals()]);

  const conversion = d.funnel[0].count > 0 ? d.funnel[3].count / d.funnel[0].count : null;
  // The biggest fall between two stages, named. "Conversion 3%" is a fact;
  // "you lose 71% between the basket and the checkout" is a thing to fix.
  const leaks = d.funnel.slice(1).map((s, i) => ({
    from: d.funnel[i].step,
    to: s.step,
    drop: d.funnel[i].count > 0 ? 1 - s.count / d.funnel[i].count : 0,
  }));
  const worstLeak = leaks.reduce((a, b) => (b.drop > a.drop ? b : a), leaks[0] ?? null);

  const reorder = d.sold
    .filter((p) => p.daysOfCover != null && p.daysOfCover < 30)
    .sort((a, b) => (a.daysOfCover ?? 0) - (b.daysOfCover ?? 0));

  const totalPaid = d.customers.guests + d.customers.firstTime + d.customers.returning;
  const repeatRate = totalPaid > 0 ? d.customers.returning / totalPaid : 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-heading text-2xl font-extrabold uppercase tracking-tight text-navy-950">
            Analyse approfondie
          </h1>
          <Link href="/admin/analytics" className="text-xs font-display font-bold uppercase tracking-wide text-red-500">
            ← Analytics
          </Link>
        </div>
        <p className="mt-1 text-sm text-navy-900/50">
          Commandes sur {d.windows.trendDays} jours, comportement sur {d.windows.eventDays}. Données de première
          partie, recalculées au plus toutes les 10 minutes — la boutique et le site partagent la même base.
        </p>
      </div>

      {/* ------------------------------------------------------------ KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 [&>*]:min-w-0">
        <StatTile label="Chiffre d'affaires (30 j)" value={fmtTND(d.kpis.revenue30)} delta={d.kpis.revenueDelta} />
        <StatTile label="Commandes (30 j)" value={fmtInt(d.kpis.orders30)} delta={d.kpis.ordersDelta} />
        <StatTile label="Panier moyen" value={fmtTND(d.kpis.aov)} sub={`sur ${fmtInt(d.kpis.orders30)} commande(s)`} />
        <StatTile
          label="Conversion"
          value={conversion == null ? "—" : fmtPct(conversion)}
          sub="vue produit → commande"
        />
      </div>

      {/* -------------------------------------------------------- forecast */}
      <Panel
        title="Tendance et projection"
        hint="Le chiffre d'affaires réalisé jour par jour, et ce que la tendance donnerait si rien ne changeait. Une projection n'est pas une prévision de ventes : c'est cette droite-là, prolongée."
        aside={
          d.forecast.available ? (
            <span className="text-xs tabular-nums text-navy-900/60">
              {d.windows.horizonDays} prochains jours : <strong className="text-navy-950">{fmtTND(d.forecast.total)}</strong>{" "}
              <span className="text-navy-900/40">
                ({fmtTND(d.forecast.low)} – {fmtTND(d.forecast.high)})
              </span>
            </span>
          ) : null
        }
      >
        <TrendChart
          points={d.daily}
          fitToday={d.forecast.available ? d.forecast.fitToday : null}
          fitEnd={d.forecast.available ? d.forecast.fitEnd : 0}
          dailySd={d.forecast.available ? d.forecast.dailySd : 0}
          horizonDays={d.windows.horizonDays}
        />
        <p className="mt-2 text-xs text-navy-900/45">
          {d.forecast.available ? d.forecast.method : d.forecast.reason}
        </p>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        {/* ---------------------------------------------------- the funnel */}
        <Panel
          title="Où les visiteurs s'arrêtent"
          hint="Le pourcentage à droite est la perte à cette étape. C'est celui-là qu'on répare, pas le taux global."
        >
          <FunnelBars steps={d.funnel} />
          {worstLeak && worstLeak.drop > 0 && (
            <p className="mt-3.5 border-t border-navy-900/8 pt-3 text-xs text-navy-900/60">
              La plus grosse perte est entre <strong className="text-navy-950">{worstLeak.from}</strong> et{" "}
              <strong className="text-navy-950">{worstLeak.to}</strong> : {fmtPct(worstLeak.drop)} des visiteurs
              s&apos;arrêtent là.
            </p>
          )}
        </Panel>

        {/* ------------------------------------------------- what to order */}
        <Panel
          title="À réapprovisionner"
          hint="Jours de stock au rythme réellement constaté sur la période : stock ÷ (unités vendues ÷ jours). Seules les pièces qui se vendent apparaissent — une pièce qui ne part pas n'a pas de rupture à craindre."
        >
          {reorder.length === 0 ? (
            <p className="text-sm text-navy-900/40">
              Aucune pièce sous 30 jours de couverture. Rien d&apos;urgent à commander.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col divide-y divide-navy-900/8 p-0">
              {reorder.map((p) => (
                <li key={p.sku} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-navy-950">{p.name}</span>
                    <span className="block font-mono text-[12px] text-navy-900/40">{p.sku}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs tabular-nums text-navy-900/50">{p.stock} en stock</span>
                    <StatusChip tone={(p.daysOfCover ?? 0) < 10 ? "critical" : "warning"}>
                      {p.daysOfCover} j
                    </StatusChip>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* ------------------------------------------------------ products */}
        <Panel
          title="Ce qui fait le chiffre"
          hint="Classé par chiffre d'affaires, pas par unités : sinon le lave-glace passe devant les disques de frein. La marge est calculée sur le prix d'achat saisi en fiche produit."
        >
          <BarList
            empty="Aucune vente sur la période."
            rows={d.sold.map((p) => ({
              key: p.sku,
              label: p.name,
              sub: `${fmtInt(p.units)} u · marge ${fmtTND(p.margin)}`,
              value: p.revenue,
              display: fmtTND(p.revenue),
            }))}
          />
        </Panel>

        {/* --------------------------------------------------- dead stock */}
        <Panel
          title="Stock dormant"
          hint={`Actif, en stock, et pas une seule vente sur ${d.windows.trendDays} jours. Classé par argent immobilisé (stock × prix d'achat) — c'est ce qu'il y a à récupérer.`}
        >
          <BarList
            empty="Rien ne dort : toutes les pièces en stock se sont vendues au moins une fois."
            rows={d.slowMovers.map((p) => ({
              key: p.sku,
              label: p.name,
              sub: `${p.stock} en stock`,
              value: p.tied,
              display: fmtTND(p.tied),
            }))}
          />
        </Panel>

        {/* ---------------------------------------------------- acquisition */}
        <Panel
          title="D'où viennent les commandes"
          hint="Attribution au premier contact, portée depuis la première page vue jusqu'à la commande. Le panier moyen par canal dit lequel mérite un budget, pas le nombre de clics."
        >
          <BarList
            empty="Aucune commande attribuée sur la période."
            rows={d.acquisition.map((a) => ({
              key: `${a.source}|${a.medium}|${a.campaign}`,
              label: [a.source ?? "direct", a.medium, a.campaign].filter(Boolean).join(" · "),
              sub: `${fmtInt(a.orders)} cmd · panier ${fmtTND(a.revenue / Math.max(1, a.orders))}`,
              value: a.revenue,
              display: fmtTND(a.revenue),
            }))}
          />
        </Panel>

        {/* -------------------------------------------------------- vehicles */}
        <Panel
          title="Les voitures qu'on sert vraiment"
          hint="Relevé sur les commandes qui portent un véhicule. C'est la liste sur laquelle caler les achats de pièces et la couverture du catalogue."
        >
          <BarList
            empty="Aucune commande ne porte encore de véhicule — la sélection est facultative au checkout."
            rows={d.vehicles.map((v) => ({
              key: v.vehicle,
              label: v.vehicle,
              sub: `${fmtTND(v.revenue)}`,
              value: v.orders,
              display: `${fmtInt(v.orders)} cmd`,
            }))}
          />
        </Panel>
      </div>

      {/* ------------------------------------------------------- fit risk */}
      <Panel
        title="Commandes à vérifier avant expédition"
        hint="Commandes en cours contenant une pièce pour laquelle nous n'avons aucune compatibilité enregistrée sur la voiture du client. Chacune est un retour possible — et un trou à combler dans la table de compatibilité."
        aside={
          d.fitRisk.length > 0 ? (
            <StatusChip tone="warning">{d.fitRisk.length} à vérifier</StatusChip>
          ) : (
            <StatusChip tone="good">rien en attente</StatusChip>
          )
        }
      >
        {d.fitRisk.length === 0 ? (
          <p className="text-sm text-navy-900/40">
            Aucune commande en cours ne contient de pièce non répertoriée sur la voiture indiquée.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col divide-y divide-navy-900/8 p-0">
            {d.fitRisk.map((o) => (
              <li key={o.ref} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="font-mono text-sm font-semibold text-navy-950">{o.ref}</span>
                  <span className="ms-2 text-sm text-navy-900/60">{o.label}</span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusChip tone="warning">
                    {o.unlisted} ligne{o.unlisted > 1 ? "s" : ""} non répertoriée{o.unlisted > 1 ? "s" : ""}
                  </StatusChip>
                  <Link
                    href={`/admin/commandes?q=${encodeURIComponent(o.ref)}`}
                    className="inline-flex min-h-tap-compact items-center rounded-lg border border-navy-900/15 px-3 font-display text-xs font-bold uppercase tracking-wide text-navy-900 hover:border-navy-900/40"
                  >
                    Ouvrir
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* --------------------------------------------------- unmet demand */}
      <UnmetDemandPaged totalLines={unmet.lines} totalSearches={unmet.searches} />

      <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        {/* -------------------------------------------------------- loyalty */}
        <Panel
          title="Nouveaux et fidèles"
          hint="Une commande est « fidèle » quand le compte qui l'a passée en avait déjà une. Les commandes sans compte sont comptées à part : elles ne peuvent être ni l'un ni l'autre."
        >
          <div className="mb-3 flex items-baseline gap-2">
            <span className="font-heading text-3xl font-extrabold tabular-nums text-navy-950">{fmtPct(repeatRate)}</span>
            <span className="text-sm text-navy-900/50">des commandes viennent d&apos;un client déjà venu</span>
          </div>
          <BarList
            empty="Aucune commande sur la période."
            rows={[
              { key: "ret", label: "Clients fidèles", value: d.customers.returning, display: fmtInt(d.customers.returning) },
              { key: "new", label: "Première commande", value: d.customers.firstTime, display: fmtInt(d.customers.firstTime) },
              { key: "guest", label: "Sans compte", value: d.customers.guests, display: fmtInt(d.customers.guests) },
            ]}
          />
        </Panel>

        {/* ------------------------------------------------------ geography */}
        <Panel
          title="Où on livre"
          hint="Par gouvernorat, sur la période. Le panier moyen par région est ce qui dit où une livraison gratuite se rentabilise."
        >
          <BarList
            empty="Aucune commande sur la période."
            rows={d.governorates.map((g) => ({
              key: g.governorate,
              label: g.governorate,
              sub: `panier ${fmtTND(g.revenue / Math.max(1, g.orders))}`,
              value: g.orders,
              display: `${fmtInt(g.orders)} cmd`,
            }))}
          />
        </Panel>
      </div>
    </div>
  );
}
