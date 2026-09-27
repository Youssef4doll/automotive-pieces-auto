import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { scoreProduct, qualityBand, SELLABLE_THRESHOLD } from "@/lib/quality";
import { brandInNameMismatch, suspiciousCategoryName } from "@/lib/catalog-anomalies";

export const metadata = { title: "Qualité catalogue" };

const FILTERS = [
  { key: "", label: "Tous" },
  { key: "reference", label: "Sans référence" },
  { key: "photo", label: "Sans photo" },
  { key: "fitment", label: "Sans compatibilité" },
  { key: "priceBuy", label: "Sans prix d'achat" },
  { key: "position", label: "Position manquante" },
] as const;

export default async function QualityPage({
  searchParams,
}: {
  searchParams: Promise<{ missing?: string }>;
}) {
  const { missing = "" } = await searchParams;

  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, sku: true, description: true,
      priceSell: true, priceBuy: true, stockQty: true,
      categoryId: true, brandId: true, axle: true, side: true,
      _count: { select: { images: true, references: true, fitments: true } },
      brand: { select: { name: true } },
    },
  });
  const anomalies = await findAnomalies(products);

  const scored = products
    .map((p) => ({ product: p, ...scoreProduct(p) }))
    .sort((a, b) => a.score - b.score);

  const shown = missing ? scored.filter((s) => s.missing.some((m) => m.key === missing)) : scored;

  const total = scored.length || 1;
  const avg = Math.round(scored.reduce((s, x) => s + x.score, 0) / total);
  const notSellable = scored.filter((s) => s.score < SELLABLE_THRESHOLD).length;

  // The counts are the actual worklist: how many products each gap affects.
  const gapCounts = FILTERS.slice(1).map((f) => ({
    ...f,
    count: scored.filter((s) => s.missing.some((m) => m.key === f.key)).length,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">Qualité catalogue</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ce qui manque, produit par produit, classé par impact commercial. Un catalogue incomplet n&apos;est pas un
          défaut du site — c&apos;est une liste de travail.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 [&>*]:min-w-0">
        <Tile label="Produits" value={String(scored.length)} />
        <Tile label="Score moyen" value={`${avg}%`} tone={avg >= 85 ? "ok" : avg >= SELLABLE_THRESHOLD ? "warn" : "bad"} />
        <Tile label="Non vendables" value={String(notSellable)} tone={notSellable ? "bad" : "ok"} hint={`score < ${SELLABLE_THRESHOLD}%`} />
        <Tile label="Prêts" value={String(scored.filter((s) => s.score >= 85).length)} tone="ok" />
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => {
          const count = f.key ? gapCounts.find((g) => g.key === f.key)?.count ?? 0 : scored.length;
          const active = missing === f.key;
          return (
            <Link
              key={f.key || "all"}
              href={f.key ? `/admin/qualite?missing=${f.key}` : "/admin/qualite"}
              className={`inline-flex items-center gap-1.5 min-h-tap-compact px-3 rounded-full border text-sm ${
                active ? "bg-navy-900 border-navy-900 text-white font-semibold" : "bg-white border-gray-300 text-gray-700"
              }`}
            >
              {f.label}
              <span className={active ? "text-white/60" : "text-gray-600"}>{count}</span>
            </Link>
          );
        })}
      </div>

      <Anomalies items={anomalies} />

      <div className="rounded-xl border border-navy-900/10 bg-white overflow-x-auto">
        <table className="w-full text-sm table-fixed min-w-[680px]">
          <thead className="bg-navy-950 text-white/70">
            <tr>
              <th className="text-start px-4 py-3 font-display font-bold uppercase text-[11px] tracking-wider">Produit</th>
              <th className="text-start px-3 py-3 font-display font-bold uppercase text-[11px] tracking-wider w-24">Score</th>
              <th className="text-start px-4 py-3 font-display font-bold uppercase text-[11px] tracking-wider">Ce qui manque</th>
              <th className="text-end px-4 py-3 font-display font-bold uppercase text-[11px] tracking-wider w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-900/8">
            {shown.map(({ product, score, missing: gaps }) => {
              const band = qualityBand(score);
              return (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold truncate">{product.name}</p>
                    <p className="text-xs text-navy-900/40 font-mono">{product.sku}</p>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-1.5 rounded-full bg-gray-200 shrink-0">
                        <div
                          className={`h-1.5 rounded-full ${
                            band.tone === "ok" ? "bg-green-600" : band.tone === "warn" ? "bg-amber-500" : "bg-red-500"
                          }`}
                          style={{ width: `${Math.max(4, score)}%` }}
                        />
                      </div>
                      <span className="tabular-nums text-xs font-semibold">{score}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {gaps.length === 0 ? (
                      <span className="text-xs text-green-700 font-semibold">Complet</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {gaps.slice(0, 4).map((g) => (
                          <span
                            key={g.key}
                            title={g.why}
                            className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600"
                          >
                            {g.label}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Link
                      href={`/admin/stock/${product.id}`}
                      className="inline-flex items-center justify-end min-h-tap-compact text-xs font-display font-bold uppercase tracking-wide text-red-500 hover:underline"
                    >
                      Compléter
                    </Link>
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-navy-900/40">Rien à corriger ici</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ label, value, tone, hint }: { label: string; value: string; tone?: "ok" | "warn" | "bad"; hint?: string }) {
  const color = tone === "ok" ? "text-green-700" : tone === "warn" ? "text-amber-600" : tone === "bad" ? "text-red-600" : "text-navy-950";
  return (
    <div className="p-4 rounded-xl bg-white border border-navy-900/10 shadow-sm">
      <p className="text-xs font-display font-bold text-navy-900/45 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-heading font-extrabold mt-1 tabular-nums ${color}`}>{value}</p>
      {hint && <p className="text-xs text-navy-900/40 mt-0.5">{hint}</p>}
    </div>
  );
}

type Anomaly = { key: string; kind: string; what: string; href: string | null };

/**
 * Mistakes a customer would see, found by rule rather than by eye: a product
 * named after another brand, a test-looking category, a fitment demoted for
 * contradicting the engine's fuel, a make or model the picker cannot finish,
 * an engine suddenly "fitting" many parts of one kind (worth a second look).
 */
async function findAnomalies(products: { id: string; name: string; brand: { name: string } | null }[]): Promise<Anomaly[]> {
  const [brands, categories, fuelRows, deadMakes, deadModels, crowded] = await Promise.all([
    prisma.brand.findMany({ select: { name: true } }),
    prisma.category.findMany({ select: { id: true, name: true, parent: { select: { name: true } } } }),
    prisma.productFitment.findMany({
      where: { note: { contains: "carburant incompatible" } },
      take: 50,
      select: { productId: true, product: { select: { name: true } }, engine: { select: { name: true, fuel: true, model: { select: { name: true, make: { select: { name: true } } } } } } },
    }),
    prisma.vehicleMake.findMany({ where: { models: { none: { engines: { some: {} } } } }, select: { name: true } }),
    prisma.vehicleModel.findMany({ where: { engines: { none: {} } }, select: { name: true, make: { select: { name: true } } } }),
    prisma.$queryRaw<{ engine: string; model: string; category: string; n: bigint }[]>`
      SELECT e.name AS engine, md.name AS model, c.name AS category, COUNT(*) AS n
      FROM "ProductFitment" f
      JOIN "VehicleEngine" e ON e.id = f."engineId"
      JOIN "VehicleModel" md ON md.id = e."modelId"
      JOIN "Product" p ON p.id = f."productId" AND p.active
      JOIN "Category" c ON c.id = p."categoryId"
      WHERE f.confidence = 'VERIFIED'
      GROUP BY e.id, e.name, md.name, c.id, c.name
      HAVING COUNT(*) > 3
      ORDER BY n DESC
      LIMIT 20
    `,
  ]);
  const names = brands.map((b) => b.name);
  const out: Anomaly[] = [];
  for (const p of products) {
    const other = brandInNameMismatch(p.name, p.brand?.name ?? null, names);
    if (other) out.push({ key: `b-${p.id}`, kind: "Marque", what: `« ${p.name} » est rangé sous ${p.brand?.name} mais nomme ${other}.`, href: `/admin/stock/${p.id}` });
  }
  for (const c of categories) {
    if (suspiciousCategoryName(c.name)) out.push({ key: `c-${c.id}`, kind: "Catégorie", what: `« ${c.name} »${c.parent ? ` (dans ${c.parent.name})` : ""} ressemble à un essai ou une faute de frappe.`, href: "/admin/catalogue" });
  }
  for (const f of fuelRows) {
    out.push({ key: `f-${f.productId}-${f.engine.name}`, kind: "Carburant", what: `« ${f.product.name} » était indiqué pour ${f.engine.model.make.name} ${f.engine.model.name} ${f.engine.name} (${f.engine.fuel ?? "?"}) — impossible, rétrogradé « à vérifier ».`, href: `/admin/stock/${f.productId}` });
  }
  for (const m of deadMakes) out.push({ key: `m-${m.name}`, kind: "Véhicules", what: `${m.name} n'a aucun modèle avec motorisation : masqué du sélecteur.`, href: "/admin/catalogue/vehicules" });
  for (const m of deadModels) out.push({ key: `mo-${m.make.name}-${m.name}`, kind: "Véhicules", what: `${m.make.name} ${m.name} n'a aucune motorisation : masqué du sélecteur.`, href: "/admin/catalogue/vehicules" });
  for (const c of crowded) out.push({ key: `x-${c.model}-${c.engine}-${c.category}`, kind: "À revoir", what: `${Number(c.n)} « ${c.category} » différents confirmés pour ${c.model} ${c.engine} — est-ce plausible ?`, href: null });
  return out;
}

function Anomalies({ items }: { items: Anomaly[] }) {
  if (items.length === 0) return null;
  return (
    <section className="rounded-xl border border-amber-500/40 bg-amber-50/60 p-4">
      <h2 className="font-display text-sm font-bold uppercase tracking-wide text-navy-950">Anomalies à corriger ({items.length})</h2>
      <p className="mt-1 text-xs text-gray-600">Trouvées automatiquement. Chacune est visible par un client tant qu&apos;elle n&apos;est pas corrigée.</p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {items.slice(0, 60).map((a) => (
          <li key={a.key} className="flex items-baseline gap-2 text-sm">
            <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold text-navy-900">{a.kind}</span>
            {a.href ? (
              <Link href={a.href} className="text-gray-800 hover:underline">{a.what}</Link>
            ) : (
              <span className="text-gray-800">{a.what}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
