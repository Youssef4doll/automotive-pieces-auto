import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { formatTND, toNumber } from "@/lib/money";
import DeleteProductButton from "@/components/admin/DeleteProductButton";

/**
 * The stock screen, organised the way the shop is.
 *
 * A flat alphabetical list of every reference answers "where is this part?"
 * and nothing else. Grouping by family answers the questions actually asked at
 * a counter — what have we got in braking, what came in this week, what is
 * about to run out — so the list is grouped by family with a per-family
 * summary, and can be re-sorted by arrival for the "what is new" pass.
 */

type SortKey = "recent" | "name" | "stock" | "margin";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Ajout récent" },
  { key: "name", label: "Nom" },
  { key: "stock", label: "Stock" },
  { key: "margin", label: "Marge" },
];

const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Tous" },
  { key: "rupture", label: "En rupture" },
  { key: "bas", label: "Stock bas" },
  { key: "sansphoto", label: "Sans photo" },
  { key: "inactif", label: "Hors ligne" },
];

function dayMonth(d: Date) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
}

export default async function AdminStockPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tri?: string; f?: string; famille?: string }>;
}) {
  const { q, tri = "recent", f = "", famille = "" } = await searchParams;
  const sort = (SORTS.find((s) => s.key === tri)?.key ?? "recent") as SortKey;

  const products = await prisma.product.findMany({
    where: {
      ...(q
        ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { sku: { contains: q, mode: "insensitive" as const } }] }
        : {}),
      ...(famille ? { category: { OR: [{ slug: famille }, { parent: { slug: famille } }] } } : {}),
      ...(f === "rupture" ? { stockQty: { lte: 0 } } : {}),
      ...(f === "inactif" ? { active: false } : {}),
      ...(f === "sansphoto" ? { images: { none: {} } } : {}),
    },
    include: {
      category: { include: { parent: true } },
      brand: true,
      images: { orderBy: { order: "asc" }, take: 1, select: { id: true } },
      _count: { select: { fitments: true } },
    },
    orderBy:
      sort === "name" ? { name: "asc" } : sort === "stock" ? { stockQty: "asc" } : { createdAt: "desc" },
  });

  // "Stock bas" is relative to each product's own threshold, so it cannot be a
  // SQL filter without comparing two columns; and margin depends on two
  // Decimals. Both are decided here, over the rows already fetched.
  const rows = products
    .filter((p) => (f === "bas" ? p.stockQty > 0 && p.stockQty <= p.lowStockThreshold : true))
    .map((p) => {
      const buy = toNumber(p.priceBuy);
      const sell = toNumber(p.priceSell);
      return { ...p, buy, sell, marginPct: buy > 0 ? Math.round(((sell - buy) / buy) * 100) : 0 };
    });
  if (sort === "margin") rows.sort((a, b) => a.marginPct - b.marginPct);

  // The family is the top of the tree — a subcategory's parent, or the
  // category itself when it has none.
  const families = new Map<string, { name: string; slug: string; items: typeof rows }>();
  for (const p of rows) {
    const fam = p.category.parent ?? p.category;
    const entry = families.get(fam.id) ?? { name: fam.name, slug: fam.slug, items: [] as typeof rows };
    entry.items.push(p);
    families.set(fam.id, entry);
  }
  const grouped = [...families.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const allFamilies = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { name: "asc" },
    select: { name: true, slug: true },
  });

  const keep = (over: Record<string, string>) => {
    const sp = new URLSearchParams({ ...(q ? { q } : {}), tri: sort, ...(f ? { f } : {}), ...(famille ? { famille } : {}), ...over });
    for (const [k, v] of [...sp.entries()]) if (!v) sp.delete(k);
    return `/admin/stock?${sp.toString()}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">Stock</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {rows.length} référence(s) · {grouped.length} famille(s)
          </p>
        </div>
        <Link
          href="/admin/stock/nouveau"
          className="px-4 py-2.5 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 text-sm font-display font-bold uppercase tracking-wide"
        >
          + Nouveau produit
        </Link>
      </div>

      {/* min-w-0 on the field: without it the input keeps its default
          intrinsic width and pushes the row past a 320px screen. */}
      <form className="flex gap-2 flex-wrap">
        <input
          name="q"
          defaultValue={q}
          placeholder="Nom ou référence…"
          className="flex-1 min-w-0 px-3 min-h-tap border border-navy-900/15 rounded-lg text-sm outline-none focus:border-gold-500"
        />
        <input type="hidden" name="tri" value={sort} />
        {f && <input type="hidden" name="f" value={f} />}
        {famille && <input type="hidden" name="famille" value={famille} />}
        <button className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-sm font-display font-bold uppercase tracking-wide">
          Rechercher
        </button>
      </form>

      <div className="flex flex-col gap-2">
        <Row label="Trier">
          {SORTS.map((s) => (
            <Chip key={s.key} href={keep({ tri: s.key })} active={sort === s.key}>{s.label}</Chip>
          ))}
        </Row>
        <Row label="Filtrer">
          {FILTERS.map((x) => (
            <Chip key={x.key} href={keep({ f: x.key })} active={f === x.key}>{x.label}</Chip>
          ))}
        </Row>
        <Row label="Famille">
          <Chip href={keep({ famille: "" })} active={!famille}>Toutes</Chip>
          {allFamilies.map((c) => (
            <Chip key={c.slug} href={keep({ famille: c.slug })} active={famille === c.slug}>{c.name}</Chip>
          ))}
        </Row>
      </div>

      {grouped.length === 0 && (
        <div className="rounded-xl border border-navy-900/10 bg-white px-4 py-10 text-center text-navy-900/45">
          Aucun produit ne correspond.
        </div>
      )}

      {grouped.map((fam) => {
        const value = fam.items.reduce((sum, p) => sum + p.buy * p.stockQty, 0);
        const short = fam.items.filter((p) => p.stockQty <= p.lowStockThreshold).length;
        return (
          <section key={fam.slug} className="rounded-xl border border-navy-900/10 bg-white shadow-sm overflow-hidden">
            <header className="flex items-center gap-3 flex-wrap px-4 py-3 bg-gray-50 border-b border-navy-900/10">
              <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950">{fam.name}</h2>
              <span className="text-xs text-gray-600">{fam.items.length} référence(s)</span>
              {short > 0 && (
                <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                  {short} à réapprovisionner
                </span>
              )}
              <span className="ms-auto text-xs text-gray-600">
                Valeur du stock&nbsp;: <span className="font-semibold text-navy-950">{formatTND(value)}</span>
              </span>
            </header>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-navy-950 text-white/70">
                  <tr>
                    <th className="text-start px-4 py-2.5 font-display font-bold uppercase text-[11px] tracking-wider">Produit</th>
                    <th className="text-start px-4 py-2.5 font-display font-bold uppercase text-[11px] tracking-wider">Sous-catégorie</th>
                    <th className="text-start px-4 py-2.5 font-display font-bold uppercase text-[11px] tracking-wider">Ajouté</th>
                    <th className="text-end px-4 py-2.5 font-display font-bold uppercase text-[11px] tracking-wider">Achat</th>
                    <th className="text-end px-4 py-2.5 font-display font-bold uppercase text-[11px] tracking-wider">Vente</th>
                    <th className="text-end px-4 py-2.5 font-display font-bold uppercase text-[11px] tracking-wider">Marge</th>
                    <th className="text-end px-4 py-2.5 font-display font-bold uppercase text-[11px] tracking-wider">Stock</th>
                    <th className="text-end px-4 py-2.5 font-display font-bold uppercase text-[11px] tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/8">
                  {fam.items.map((p) => {
                    const low = p.stockQty <= p.lowStockThreshold;
                    return (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          {/* The thumbnail is the fastest way to spot a product
                              that still has no photo of its own — those show the
                              generic catalogue picture and are flagged under. */}
                          <div className="flex items-center gap-3">
                            <Image
                              src={p.images[0] ? `/api/images/${p.images[0].id}` : p.imageUrl}
                              alt=""
                              width={44}
                              height={44}
                              className="w-11 h-11 rounded-md object-cover bg-gray-50 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-medium">
                                {p.name}
                                {!p.active && <span className="ms-2 text-[11px] font-bold uppercase text-gray-500">hors ligne</span>}
                              </p>
                              <p className="text-xs text-navy-900/40">
                                {p.sku} {p.brand ? `· ${p.brand.name}` : ""}
                                {p.images.length === 0 && <span className="text-amber-600"> · sans photo</span>}
                                {p._count.fitments === 0 && <span className="text-amber-600"> · sans compatibilité</span>}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-navy-900/50">{p.category.name}</td>
                        <td className="px-4 py-3 text-navy-900/50 whitespace-nowrap">{dayMonth(p.createdAt)}</td>
                        <td className="px-4 py-3 text-end">{formatTND(p.buy)}</td>
                        <td className="px-4 py-3 text-end font-semibold">{formatTND(p.sell)}</td>
                        <td className="px-4 py-3 text-end text-green-700">{p.marginPct}%</td>
                        <td className="px-4 py-3 text-end">
                          <span className={`font-bold ${low ? "text-red-600" : ""}`}>{p.stockQty}</span>
                        </td>
                        <td className="px-4 py-3 text-end whitespace-nowrap">
                          <Link href={`/admin/stock/${p.id}`} className="text-xs font-display font-bold uppercase tracking-wide text-red-500 hover:underline me-3">
                            Modifier
                          </Link>
                          <DeleteProductButton productId={p.id} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] font-display font-bold uppercase tracking-wide text-navy-900/40 w-14 shrink-0">
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center min-h-tap-compact px-3 rounded-full border text-xs font-semibold transition-colors ${
        active
          ? "bg-navy-900 border-navy-900 text-white"
          : "bg-white border-gray-200 text-gray-700 hover:border-navy-900/40"
      }`}
    >
      {children}
    </Link>
  );
}
