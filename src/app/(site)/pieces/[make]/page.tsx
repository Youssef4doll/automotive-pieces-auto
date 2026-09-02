import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { listVehiclePages } from "@/lib/data/vehicles";
import Breadcrumbs from "@/components/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import { pageMeta, clampDescription } from "@/lib/seo";
import { breadcrumbSchema, itemListSchema } from "@/lib/schema";

/**
 * The models of one make that the shop can supply.
 *
 * Exists mostly to make the tree navigable and the breadcrumb honest — a
 * crumb that links nowhere is worse than no crumb — but it also answers
 * "pièces Renault" on its own. Like the pages below it, it lists only models
 * with real parts behind them.
 */

type Params = Promise<{ make: string }>;

async function load(params: Params) {
  const { make } = await params;
  const brand = await prisma.vehicleMake.findUnique({ where: { slug: make } });
  if (!brand) return null;
  // Alphabetical, not by stock depth. The list is read by somebody hunting
  // for one specific model name, and "sorted by how many parts we happen to
  // carry" is an order only the shop understands.
  const models = (await listVehiclePages())
    .filter((v) => v.makeSlug === make)
    .sort((a, b) => a.modelName.localeCompare(b.modelName, "fr", { numeric: true }));
  if (models.length === 0) return null;
  return { brand, models, path: `/pieces/${make}` };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const data = await load(params);
  if (!data) return { title: "Marque introuvable" };
  const { brand, models } = data;

  return pageMeta({
    title: `Pièces auto ${brand.name} — ${models.length} modèle${models.length > 1 ? "s" : ""}`,
    description: clampDescription(
      `Pièces détachées ${brand.name} : ${models.slice(0, 5).map((m) => m.modelName).join(", ")}. ` +
        `Compatibilité vérifiée par motorisation, livraison 24h Grand Tunis, paiement à la livraison.`,
    ),
    path: data.path,
  });
}

export default async function MakePage({ params }: { params: Params }) {
  const data = await load(params);
  if (!data) notFound();
  const { brand, models, path } = data;

  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: brand.name, path },
  ];

  return (
    <div className="w-full min-w-0 mx-auto max-w-7xl px-4 py-6">
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <JsonLd
        data={itemListSchema(
          models.map((m) => ({ name: `${brand.name} ${m.modelName}`, path: `${path}/${m.modelSlug}` })),
        )}
      />

      <div className="mb-3">
        <Breadcrumbs items={crumbs} />
      </div>

      <h1 className="text-xl sm:text-2xl font-heading font-extrabold uppercase text-navy-950 tracking-tight">
        Pièces auto {brand.name}
      </h1>
      <p className="text-sm text-gray-600 mt-1 mb-5">
        {models.length} modèle{models.length > 1 ? "s" : ""} couvert{models.length > 1 ? "s" : ""} par notre
        catalogue. Choisissez le vôtre pour ne voir que les pièces compatibles.
      </p>

      {/* A list, not a grid of chips. Somebody looking for their car is
          scanning for two things — the model name and whether the years match
          the car on their drive — and a list reads down a column far faster
          than boxes read across a grid. The years come from the vehicle
          record; a model whose years nobody has entered simply shows none,
          rather than a guessed range. */}
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
        {models.map((m) => {
          const years = m.yearFrom ? `${m.yearFrom} – ${m.yearTo ?? "auj."}` : null;
          return (
            <li key={m.modelSlug} className="border-b border-gray-200">
              <Link
                href={`${path}/${m.modelSlug}`}
                className="flex items-baseline gap-3 min-h-tap py-2 group"
              >
                <span className="w-24 shrink-0 text-xs text-gray-600 tabular-nums">
                  {years ?? ""}
                </span>
                <span className="flex-1 min-w-0 text-sm font-semibold text-navy-700 group-hover:text-red-600 group-hover:underline underline-offset-2 truncate">
                  {brand.name} {m.modelName}
                </span>
                <span className="shrink-0 text-xs text-gray-600 tabular-nums">{m.productCount}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
