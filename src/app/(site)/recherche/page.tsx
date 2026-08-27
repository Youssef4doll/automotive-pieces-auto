import { searchProducts } from "@/lib/data/catalog";
import { getSettings } from "@/lib/settings";
import ProductGrid from "@/components/ProductGrid";

export const metadata = { title: "Résultats de recherche" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const [products, settings] = await Promise.all([searchProducts(q), getSettings()]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-xl font-heading font-extrabold uppercase text-navy-950 mb-1 tracking-tight">Résultats pour « {q} »</h1>
      <p className="text-sm text-gray-500 mb-6">{products.length} résultat(s)</p>
      {products.length === 0 ? (
        <div className="text-center py-16 px-4 border border-dashed border-gray-300 rounded-xl">
          <p className="text-3xl mb-3">🔍</p>
          <p className="text-gray-600 font-medium mb-4">Aucun résultat pour cette recherche</p>
          <a
            href={`https://wa.me/${settings.shop_whatsapp}?text=${encodeURIComponent(q)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold"
          >
            Envoyez-la sur WhatsApp, on la retrouve
          </a>
        </div>
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}
