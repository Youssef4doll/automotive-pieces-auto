import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getVehicleModel, getFamiliesForModel, getProductsForModel } from "@/lib/data/vehicles";
import ProductGrid from "@/components/ProductGrid";
import Breadcrumbs from "@/components/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import TrackEvent from "@/components/TrackEvent";
import AdoptVehicle from "@/components/AdoptVehicle";
import { pageMeta, clampDescription } from "@/lib/seo";
import { breadcrumbSchema, itemListSchema } from "@/lib/schema";

/**
 * Everything the shop stocks for one car.
 *
 * This is the page for "pièces Renault Clio IV" — a search that used to land
 * on a generic category or on nothing at all. It exists only for models the
 * catalogue actually covers: getVehicleModel finding the car is not enough,
 * there have to be parts behind it, or this is a thin page that wastes a tap
 * and teaches a crawler the site is empty.
 */

type Params = Promise<{ make: string; model: string }>;

async function load(params: Params) {
  const { make, model } = await params;
  const vehicle = await getVehicleModel(make, model);
  if (!vehicle) return null;
  const [families, products] = await Promise.all([
    getFamiliesForModel(vehicle.id),
    getProductsForModel(vehicle.id, undefined, 12),
  ]);
  if (products.length === 0) return null;
  return { vehicle, families, products, path: `/pieces/${make}/${model}` };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const data = await load(params);
  if (!data) return { title: "Véhicule introuvable" };
  const { vehicle, families, products } = data;
  const name = `${vehicle.make.name} ${vehicle.name}`;

  return pageMeta({
    // No shop name here: the root layout's title template appends it, and
    // spelling it out again produced "… | Automotive Pièces Auto · Automotive
    // Pièces Auto" in the tab and in every search result.
    title: `Pièces auto ${name} — ${products.length >= 12 ? "catalogue" : `${products.length} références`}`,
    description: clampDescription(
      `Pièces détachées pour ${name} : ${families
        .slice(0, 4)
        .map((f) => f.name.toLowerCase())
        .join(", ")}. Compatibilité vérifiée sur la motorisation, livraison 24h Grand Tunis, paiement à la livraison.`,
    ),
    path: data.path,
  });
}

export default async function VehiclePage({ params }: { params: Params }) {
  const data = await load(params);
  if (!data) notFound();
  const { vehicle, families, products, path } = data;
  const name = `${vehicle.make.name} ${vehicle.name}`;
  const years = vehicle.yearFrom ? `${vehicle.yearFrom}–${vehicle.yearTo ?? "aujourd'hui"}` : null;

  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: vehicle.make.name, path: `/pieces/${vehicle.make.slug}` },
    { name: vehicle.name, path },
  ];

  return (
    <div className="w-full min-w-0 mx-auto max-w-7xl px-4 py-6">
      <TrackEvent name="vehicle_page_viewed" properties={{ make: vehicle.make.slug, model: vehicle.slug }} />
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <JsonLd
        data={itemListSchema(
          families.map((f) => ({ name: `${f.name} ${name}`, path: `${path}/${f.slug}` })),
        )}
      />

      <div className="mb-3">
        <Breadcrumbs items={crumbs} />
      </div>

      <h1 className="text-xl sm:text-2xl font-heading font-extrabold uppercase text-navy-950 tracking-tight">
        Pièces auto {name}
      </h1>
      <p className="text-sm text-gray-600 mt-1 mb-1">
        {products.length >= 12 ? "Plus de 12" : products.length} référence
        {products.length > 1 ? "s" : ""} compatibles
        {years && ` · ${years}`}
        {vehicle.engines.length > 0 && ` · ${vehicle.engines.length} motorisation${vehicle.engines.length > 1 ? "s" : ""}`}
      </p>
      <p className="text-sm text-gray-500 mb-5 max-w-prose">
        Chaque référence listée ici est déclarée compatible avec une motorisation de cette{" "}
        {vehicle.make.name}. Indiquez la vôtre pour filtrer au moteur exact.
      </p>

      {/* The whole point of arriving here from a search engine: one tap turns
          an SEO landing page into a shopping session that knows the car. */}
      <AdoptVehicle
        makeId={vehicle.makeId}
        makeName={vehicle.make.name}
        modelId={vehicle.id}
        modelName={vehicle.name}
        engines={vehicle.engines.map((e) => ({
          id: e.id,
          name: e.name,
          fuel: e.fuel,
          powerHp: e.powerHp,
        }))}
      />

      {families.length > 0 && (
        <section className="mt-8">
          <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950 text-lg mb-3">
            Par famille de pièce
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {families.map((f) => (
              <Link
                key={f.id}
                href={`${path}/${f.slug}`}
                className="flex items-center justify-between gap-2 min-h-tap px-3.5 rounded-xl border border-navy-900/12 bg-white hover:border-navy-900/35 transition-colors"
              >
                <span className="text-sm font-semibold text-navy-950 truncate">{f.name}</span>
                <span className="text-xs text-gray-600 shrink-0">{f.productCount}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        {/* Not "the most requested": the order comes from what the shop
            stocks and flags, not from measured demand. */}
        <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950 text-lg mb-3">
          En stock pour cette {vehicle.make.name}
        </h2>
        <ProductGrid products={products} />
      </section>

      {vehicle.engines.length > 0 && (
        <section className="mt-8 pt-6 border-t border-gray-200">
          <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950 text-lg mb-3">
            Motorisations couvertes
          </h2>
          <ul className="flex flex-wrap gap-2">
            {vehicle.engines.map((e) => (
              <li
                key={e.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-300 bg-white text-sm text-gray-700"
              >
                {e.name}
                {e.powerHp && <span className="text-gray-600">{e.powerHp} ch</span>}
                {e.engineCode && <span className="font-mono text-xs text-gray-600">{e.engineCode}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
