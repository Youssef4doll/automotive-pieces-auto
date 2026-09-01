import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getVehicleModel, getFamiliesForModel, getProductsForModel } from "@/lib/data/vehicles";
import ProductGrid from "@/components/ProductGrid";
import Breadcrumbs from "@/components/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import TrackEvent from "@/components/TrackEvent";
import AdoptVehicle from "@/components/AdoptVehicle";
import { pageMeta, clampDescription } from "@/lib/seo";
import { breadcrumbSchema, itemListSchema } from "@/lib/schema";

/**
 * One family of parts for one car — "plaquettes de frein Renault Clio IV".
 *
 * The deepest page in the programmatic set, and the highest-intent: somebody
 * typing that phrase knows the car, knows the part, and is ready to buy. It
 * is generated only where the shop has parts of that family verified against
 * that model, so it can always answer the question it was found for.
 */

type Params = Promise<{ make: string; model: string; family: string }>;

async function load(params: Params) {
  const { make, model, family } = await params;
  const [vehicle, category] = await Promise.all([
    getVehicleModel(make, model),
    prisma.category.findUnique({ where: { slug: family }, select: { id: true, name: true, slug: true } }),
  ]);
  if (!vehicle || !category) return null;

  const products = await getProductsForModel(vehicle.id, family, 48);
  if (products.length === 0) return null;

  const siblings = (await getFamiliesForModel(vehicle.id)).filter((f) => f.slug !== family);
  return {
    vehicle,
    category,
    products,
    siblings,
    path: `/pieces/${make}/${model}/${family}`,
    modelPath: `/pieces/${make}/${model}`,
  };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const data = await load(params);
  if (!data) return { title: "Page introuvable" };
  const { vehicle, category, products } = data;
  const car = `${vehicle.make.name} ${vehicle.name}`;
  const cheapest = Math.min(...products.map((p) => p.priceSell));

  return pageMeta({
    title: `${category.name} ${car} — ${products.length} référence${products.length > 1 ? "s" : ""}`,
    description: clampDescription(
      `${category.name} pour ${car}, compatibilité vérifiée par motorisation. ` +
        `${products.length} référence${products.length > 1 ? "s" : ""} à partir de ${cheapest} DT. ` +
        `Livraison 24h Grand Tunis, paiement à la livraison.`,
    ),
    path: data.path,
  });
}

export default async function VehicleFamilyPage({ params }: { params: Params }) {
  const data = await load(params);
  if (!data) notFound();
  const { vehicle, category, products, siblings, path, modelPath } = data;
  const car = `${vehicle.make.name} ${vehicle.name}`;

  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: car, path: modelPath },
    { name: category.name, path },
  ];

  return (
    <div className="w-full min-w-0 mx-auto max-w-7xl px-4 py-6">
      <TrackEvent
        name="vehicle_category_viewed"
        properties={{ make: vehicle.make.slug, model: vehicle.slug, family: category.slug, resultCount: products.length }}
      />
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <JsonLd data={itemListSchema(products.map((p) => ({ name: p.name, path: `/produit/${p.slug}` })))} />

      <div className="mb-3">
        <Breadcrumbs items={crumbs} />
      </div>

      <h1 className="text-xl sm:text-2xl font-heading font-extrabold uppercase text-navy-950 tracking-tight">
        {category.name} pour {car}
      </h1>
      <p className="text-sm text-gray-600 mt-1 mb-4">
        {products.length} référence{products.length > 1 ? "s" : ""} déclarée
        {products.length > 1 ? "s" : ""} compatible{products.length > 1 ? "s" : ""} · 24h Grand Tunis, 48–72h régions
      </p>

      <AdoptVehicle
        makeId={vehicle.makeId}
        makeName={vehicle.make.name}
        modelId={vehicle.id}
        modelName={vehicle.name}
        engines={vehicle.engines.map((e) => ({ id: e.id, name: e.name, fuel: e.fuel, powerHp: e.powerHp }))}
      />

      <div className="mt-6">
        <ProductGrid products={products} />
      </div>

      {siblings.length > 0 && (
        <section className="mt-10 pt-6 border-t border-gray-200">
          <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950 text-lg mb-3">
            Autres pièces pour votre {car}
          </h2>
          <div className="flex flex-wrap gap-2">
            {siblings.map((f) => (
              <Link
                key={f.id}
                href={`${modelPath}/${f.slug}`}
                className="inline-flex items-center gap-2 min-h-tap-compact px-3 rounded-full border border-gray-300 bg-white text-sm text-gray-700 hover:border-navy-300"
              >
                {f.name}
                <span className="text-xs text-gray-400">{f.productCount}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
