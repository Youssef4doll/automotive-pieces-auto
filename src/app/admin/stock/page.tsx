import Link from "next/link";
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
    include: { category: true, brand: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-extrabold">Stock</h1>
        <Link href="/admin/stock/nouveau" className="px-4 py-2.5 rounded-lg bg-navy-900 text-white text-sm font-semibold">
          + Nouveau produit
        </Link>
      </div>

      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Nom ou référence…" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <button className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-semibold">Rechercher</button>
      </form>

      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-start px-4 py-3">Produit</th>
              <th className="text-start px-4 py-3">Catégorie</th>
              <th className="text-end px-4 py-3">Achat</th>
              <th className="text-end px-4 py-3">Vente</th>
              <th className="text-end px-4 py-3">Marge</th>
              <th className="text-end px-4 py-3">Stock</th>
              <th className="text-end px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.map((p) => {
              const buy = toNumber(p.priceBuy);
              const sell = toNumber(p.priceSell);
              const marginPct = buy > 0 ? Math.round(((sell - buy) / buy) * 100) : 0;
              const low = p.stockQty <= p.lowStockThreshold;
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.sku} {p.brand ? `· ${p.brand.name}` : ""}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.category.name}</td>
                  <td className="px-4 py-3 text-end">{formatTND(buy)}</td>
                  <td className="px-4 py-3 text-end font-semibold">{formatTND(sell)}</td>
                  <td className="px-4 py-3 text-end text-green-700">{marginPct}%</td>
                  <td className="px-4 py-3 text-end">
                    <span className={`font-bold ${low ? "text-red-600" : ""}`}>{p.stockQty}</span>
                  </td>
                  <td className="px-4 py-3 text-end whitespace-nowrap">
                    <Link href={`/admin/stock/${p.id}`} className="text-xs font-semibold text-navy-700 hover:underline me-3">
                      Modifier
                    </Link>
                    <DeleteProductButton productId={p.id} />
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">Aucun produit</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
