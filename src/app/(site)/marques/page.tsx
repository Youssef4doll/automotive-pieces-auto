import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Breadcrumbs from "@/components/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import BrandMark from "@/components/product/BrandMark";
import { breadcrumbSchema } from "@/lib/schema";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Toutes les marques",
  description:
    "Les marques de pièces au catalogue, avec le nombre de références disponibles pour chacune.",
  path: "/marques",
});

const CRUMBS = [
  { name: "Accueil", path: "/" },
  { name: "Marques", path: "/marques" },
];

/**
 * The index the header has been pointing at all along.
 *
 * "Marques" in the navigation went to `/#marques` — a scroll anchor on the
 * home page — so the brand wall had no page of its own, no address a customer
 * could return to and nothing for a search engine to hold. Each tile now leads
 * to that maker's own page.
 *
 * Counted in Postgres, and a brand with nothing active behind it is not
 * listed: a tile that opens an empty aisle is worse than no tile.
 */
export default async function BrandsPage() {
  const rows = await prisma.$queryRaw<{ name: string; slug: string; logoUrl: string | null; n: bigint }[]>`
    SELECT b.name, b.slug, b."logoUrl", COUNT(p.id) AS n
    FROM "Brand" b
    JOIN "Product" p ON p."brandId" = b.id AND p.active
    WHERE b."isPartsBrand"
    GROUP BY b.id, b.name, b.slug, b."logoUrl"
    ORDER BY n DESC, b.name ASC
  `;
  const brands = rows.map((r) => ({ ...r, count: Number(r.n) }));

  return (
    <div className="mx-auto shell-w px-4 py-6">
      <JsonLd data={breadcrumbSchema(CRUMBS)} />
      <Breadcrumbs items={CRUMBS} />

      <h1 className="mt-3 font-heading text-2xl font-extrabold uppercase tracking-tight text-navy-950 sm:text-3xl">
        Nos marques de pièces
      </h1>
      <p className="mt-2 max-w-prose text-sm text-gray-600">
        {brands.length} marque{brands.length > 1 ? "s" : ""} au catalogue. Chacune ouvre sur ses
        références, les familles qu&apos;elle couvre et les véhicules concernés.
      </p>

      {brands.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">Aucune marque n&apos;a encore de référence active.</p>
      ) : (
        <ul className="mt-6 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4">
          {brands.map((b) => (
            <li key={b.slug}>
              <Link
                href={`/marque/${b.slug}`}
                className="flex h-full flex-col items-start justify-between gap-3 rounded-xl border border-navy-900/10 bg-white p-4 transition hover:-translate-y-0.5 hover:border-gold-500 hover:shadow-sm"
              >
                <BrandMark name={b.name} logoUrl={b.logoUrl} />
                <span className="text-xs font-semibold text-navy-900/50">
                  {b.count} référence{b.count > 1 ? "s" : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
