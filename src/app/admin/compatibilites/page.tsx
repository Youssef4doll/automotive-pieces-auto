import Link from "next/link";
import { prisma } from "@/lib/prisma";
import FitmentQueueActions from "@/components/admin/FitmentQueueActions";

export const metadata = { title: "Compatibilités à confirmer" };

const AXLE: Record<string, string> = { AVANT: "Avant", ARRIERE: "Arrière" };
/** Cars shown at once; the rest follow as the queue empties. */
const CARS = 10;

/** The start of the window the queue ranks cars by. */
function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60_000);
}

/**
 * The fitment confirmation queue.
 *
 * Every DERIVED row is a lead the app shows as "Probablement compatible — à
 * confirmer". Here the shop turns leads into answers, car by car, starting
 * with the cars its customers actually drive: the engines named on orders
 * and saved in the app's garages over the last 90 days. One tap confirms
 * (VERIFIED, "Compatible" everywhere) or removes the row.
 */
export default async function FitmentQueuePage() {
  const since = daysAgo(90);
  const [orderCars, garageCars, leads] = await Promise.all([
    prisma.order.groupBy({ by: ["vehicleEngineId"], where: { vehicleEngineId: { not: null }, createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.$queryRaw<{ engineId: string; n: bigint }[]>`
      SELECT properties->>'engineId' AS "engineId", COUNT(DISTINCT "sessionId") AS n
      FROM "AnalyticsEvent"
      WHERE name = 'vehicle_added' AND "createdAt" >= ${since} AND properties->>'engineId' IS NOT NULL
      GROUP BY 1
    `,
    prisma.productFitment.groupBy({ by: ["engineId"], where: { confidence: "DERIVED", product: { active: true } }, _count: { _all: true } }),
  ]);

  const demand = new Map<string, number>();
  for (const o of orderCars) if (o.vehicleEngineId) demand.set(o.vehicleEngineId, (demand.get(o.vehicleEngineId) ?? 0) + o._count._all);
  for (const g of garageCars) demand.set(g.engineId, (demand.get(g.engineId) ?? 0) + Number(g.n));

  // Cars with leads, most-driven first; ties by the size of their queue.
  const ranked = leads
    .map((l) => ({ engineId: l.engineId, leads: l._count._all, demand: demand.get(l.engineId) ?? 0 }))
    .sort((a, b) => b.demand - a.demand || b.leads - a.leads);
  const shown = ranked.slice(0, CARS);
  const totalLeads = ranked.reduce((n, r) => n + r.leads, 0);

  const engines = await prisma.vehicleEngine.findMany({
    where: { id: { in: shown.map((s) => s.engineId) } },
    select: {
      id: true,
      name: true,
      fuel: true,
      engineCode: true,
      model: { select: { name: true, make: { select: { name: true } } } },
      _count: { select: { fitments: { where: { confidence: "VERIFIED" } } } },
      fitments: {
        where: { confidence: "DERIVED", product: { active: true } },
        orderBy: { product: { name: "asc" } },
        take: 30,
        select: {
          productId: true,
          note: true,
          source: true,
          product: { select: { name: true, sku: true, axle: true, brand: { select: { name: true } }, category: { select: { name: true } } } },
        },
      },
    },
  });
  const byId = new Map(engines.map((e) => [e.id, e]));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">Compatibilités à confirmer</h1>
        <p className="text-sm text-gray-500 mt-1">
          {totalLeads} pièce(s) déduite(s) sur {ranked.length} motorisation(s). L&apos;application les montre comme
          « Probablement compatible — à confirmer ». Vérifiez la référence d&apos;origine, puis confirmez ou retirez :
          les voitures de vos clients d&apos;abord (commandes et garages des 90 derniers jours).
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-navy-900">Rien à confirmer : aucune compatibilité déduite en attente.</p>
      ) : (
        shown.map((s) => {
          const e = byId.get(s.engineId);
          if (!e) return null;
          return (
            <section key={s.engineId} className="rounded-xl border border-gray-200 bg-white">
              <header className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 border-b border-gray-100">
                <h2 className="font-heading font-bold text-navy-950">
                  {e.model.make.name} {e.model.name} · {e.name}
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    {[e.fuel, e.engineCode].filter(Boolean).join(" · ")}
                  </span>
                </h2>
                <p className="text-xs text-gray-500">
                  {s.demand > 0 ? `${s.demand} client(s) · ` : ""}
                  {e._count.fitments} confirmée(s) · {s.leads} à confirmer
                </p>
              </header>
              <ul className="divide-y divide-gray-100">
                {e.fitments.map((f) => (
                  <li key={f.productId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
                    <div className="min-w-0">
                      <Link href={`/admin/stock/${f.productId}`} className="text-sm font-semibold text-navy-950 hover:underline">
                        {f.product.name}
                      </Link>
                      <p className="text-xs text-gray-500">
                        {[f.product.brand?.name, `Réf. ${f.product.sku}`, f.product.category.name, f.product.axle ? AXLE[f.product.axle] : null, f.source, f.note]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <FitmentQueueActions productId={f.productId} engineId={s.engineId} />
                  </li>
                ))}
              </ul>
              {s.leads > e.fitments.length ? (
                <p className="px-4 py-2 text-xs text-gray-500">+ {s.leads - e.fitments.length} autre(s) après celles-ci.</p>
              ) : null}
            </section>
          );
        })
      )}
    </div>
  );
}
