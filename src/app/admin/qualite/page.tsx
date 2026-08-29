import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { scoreProduct, qualityBand, SELLABLE_THRESHOLD } from "@/lib/quality";

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
    },
  });

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
              <span className={active ? "text-white/60" : "text-gray-400"}>{count}</span>
            </Link>
          );
        })}
      </div>

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
                    <p className="font-medium truncate">{product.name}</p>
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
                      className="text-xs font-display font-bold uppercase tracking-wide text-red-500 hover:underline"
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
