import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { formatTND, toNumber } from "@/lib/money";
import DeleteProductButton from "@/components/admin/DeleteProductButton";

export default async function AdminStockPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const products = await prisma.product.findMany({
    where: q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] }
      : undefined,
    include: {
      category: true,
      brand: true,
      images: { orderBy: { order: "asc" }, take: 1, select: { id: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">Stock</h1>
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
        <button className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-sm font-display font-bold uppercase tracking-wide">
          Rechercher
        </button>
      </form>

      <div className="rounded-xl border border-navy-900/10 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-navy-950 text-white/70">
            <tr>
              <th className="text-start px-4 py-3 font-display font-bold uppercase text-[11px] tracking-wider">Produit</th>
              <th className="text-start px-4 py-3 font-display font-bold uppercase text-[11px] tracking-wider">Catégorie</th>
              <th className="text-end px-4 py-3 font-display font-bold uppercase text-[11px] tracking-wider">Achat</th>
              <th className="text-end px-4 py-3 font-display font-bold uppercase text-[11px] tracking-wider">Vente</th>
              <th className="text-end px-4 py-3 font-display font-bold uppercase text-[11px] tracking-wider">Marge</th>
              <th className="text-end px-4 py-3 font-display font-bold uppercase text-[11px] tracking-wider">Stock</th>
              <th className="text-end px-4 py-3 font-display font-bold uppercase text-[11px] tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-900/8">
            {products.map((p) => {
              const buy = toNumber(p.priceBuy);
              const sell = toNumber(p.priceSell);
              const marginPct = buy > 0 ? Math.round(((sell - buy) / buy) * 100) : 0;
              const low = p.stockQty <= p.lowStockThreshold;
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {/* The thumbnail is the fastest way to spot a product that
                        still has no photo of its own — those show the generic
                        catalogue picture and are flagged underneath. */}
                    <div className="flex items-center gap-3">
                      <Image
                        src={p.images[0] ? `/api/images/${p.images[0].id}` : p.imageUrl}
                        alt=""
                        width={44}
                        height={44}
                        className="w-11 h-11 rounded-md object-cover bg-gray-50 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-navy-900/40">
                          {p.sku} {p.brand ? `· ${p.brand.name}` : ""}
                          {p.images.length === 0 && <span className="text-amber-600"> · sans photo</span>}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-navy-900/50">{p.category.name}</td>
                  <td className="px-4 py-3 text-end">{formatTND(buy)}</td>
                  <td className="px-4 py-3 text-end font-semibold">{formatTND(sell)}</td>
                  <td className="px-4 py-3 text-end text-green-700">{marginPct}%</td>
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
            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-navy-900/40">Aucun produit</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
