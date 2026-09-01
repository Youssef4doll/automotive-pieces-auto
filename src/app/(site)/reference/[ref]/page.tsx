import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { serializeProduct, primaryImageSelect } from "@/lib/data/catalog";
import { normalizeReference } from "@/lib/reference";
import { referenceMatches } from "@/lib/search";
import { getModelsForProduct } from "@/lib/data/vehicles";
import ProductGrid from "@/components/ProductGrid";
import Breadcrumbs from "@/components/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import TrackEvent from "@/components/TrackEvent";
import { pageMeta, clampDescription } from "@/lib/seo";
import { breadcrumbSchema } from "@/lib/schema";

/**
 * A page per part number the shop can actually supply.
 *
 * Somebody with the old part in their hand types its number into Google. That
 * is the highest-intent query in this business and it has one correct answer,
 * so it gets a stable URL of its own rather than a search result page that
 * changes with ranking and cannot be linked to.
 *
 * The number is matched in its normalised form, so /reference/gdb1330,
 * /reference/GDB-1330 and /reference/gdb%201330 all resolve — and all
 * canonicalise to the same address, because three URLs for one part is how a
 * catalogue teaches a crawler it is full of duplicates.
 */

type Params = Promise<{ ref: string }>;

async function load(params: Params) {
  const { ref } = await params;
  const raw = decodeURIComponent(ref);
  const normalized = normalizeReference(raw);
  if (normalized.length < 3) return null;

  // The same indexed, normalised lookup the search box uses, so a number that
  // works when typed also works when linked to.
  const ids = await referenceMatches(raw);
  if (ids.length === 0) return null;

  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: { brand: true, category: true, fitments: { select: { engineId: true } }, ...primaryImageSelect },
  });

  return { normalized, raw, products: products.map(serializeProduct) };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const data = await load(params);
  if (!data) return { title: "Référence introuvable" };
  const first = data.products[0];
  const brand = first.brand?.name ? `${first.brand.name} ` : "";

  return pageMeta({
    title: `${data.normalized} — ${brand}${first.name}`,
    description: clampDescription(
      `Référence ${data.normalized} : ${brand}${first.name}, ${first.priceSell} DT. ` +
        `Compatibilité vérifiée, livraison 24h Grand Tunis, paiement à la livraison.`,
    ),
    // Canonical on the normalised form, so every spelling of the number folds
    // into one indexed page.
    path: `/reference/${data.normalized}`,
  });
}

export default async function ReferencePage({ params }: { params: Params }) {
  const data = await load(params);
  if (!data) notFound();
  const { normalized, raw, products } = data;

  const models = await getModelsForProduct(products[0].id);
  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: `Référence ${normalized}`, path: `/reference/${normalized}` },
  ];

  return (
    <div className="w-full min-w-0 mx-auto max-w-7xl px-4 py-6">
      <TrackEvent name="reference_page_viewed" properties={{ reference: normalized, resultCount: products.length }} />
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <div className="mb-3">
        <Breadcrumbs items={crumbs} />
      </div>

      <h1 className="text-xl sm:text-2xl font-heading font-extrabold uppercase text-navy-950 tracking-tight">
        Référence {normalized}
      </h1>
      <p className="text-sm text-gray-600 mt-1 mb-5 max-w-prose">
        {products.length === 1
          ? "Une référence correspond exactement à ce numéro."
          : `${products.length} références correspondent à ce numéro.`}{" "}
        {raw.toUpperCase() !== normalized && (
          <span className="text-gray-400">Recherché : « {raw} ».</span>
        )}
      </p>

      <ProductGrid products={products} />

      {models.length > 0 && (
        <section className="mt-10 pt-6 border-t border-gray-200">
          <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950 text-lg mb-1">
            Véhicules compatibles
          </h2>
          <p className="text-sm text-gray-500 mb-3">
            D&apos;après nos données de compatibilité. Vérifiez la motorisation avant de commander.
          </p>
          <div className="flex flex-wrap gap-2">
            {models.map((m) => (
              <Link
                key={`${m.makeSlug}/${m.modelSlug}`}
                href={`/pieces/${m.makeSlug}/${m.modelSlug}`}
                className="inline-flex items-center gap-2 min-h-tap-compact px-3 rounded-full border border-gray-300 bg-white text-sm text-gray-700 hover:border-navy-300"
              >
                {m.makeName} {m.modelName}
                <span className="text-xs text-gray-400">{m.engines.slice(0, 2).join(", ")}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
