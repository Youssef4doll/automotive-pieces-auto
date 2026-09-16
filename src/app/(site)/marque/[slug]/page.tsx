import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBrandPage } from "@/lib/data/catalog";
import ProductGrid from "@/components/ProductGrid";
import Breadcrumbs from "@/components/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import ManufacturerInfo from "@/components/product/ManufacturerInfo";
import { hasManufacturerInfo } from "@/lib/manufacturer";
import { breadcrumbSchema } from "@/lib/schema";
import { pageMeta } from "@/lib/seo";
import BrandMark from "@/components/product/BrandMark";
import { IconCar, IconPackage } from "@/components/icons";

/**
 * A maker's own page.
 *
 * There was none: the logo wall on the home page linked to
 * `/recherche?q=Bosch`, which finds the parts and loses everything else — the
 * logo, who actually makes them, which families the brand covers, which cars
 * it fits, and any page a search engine could rank for "pièces Bosch Tunisie".
 * Somebody who already trusts a brand is one of the strongest signals a parts
 * shop gets, and that signal was being spent on a query string.
 *
 * Everything here is counted from the catalogue. A brand with no parts has no
 * page, and the manufacturer panel appears only once the shop has entered the
 * company's details — never filled in from memory.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getBrandPage(slug);
  if (!data) return { title: "Marque introuvable" };

  const families = data.families.slice(0, 4).map((f) => f.name.toLowerCase());
  const covers = families.length ? ` — ${families.join(", ")}` : "";
  return pageMeta({
    title: `Pièces ${data.brand.name}`,
    description:
      `${data.total} référence${data.total > 1 ? "s" : ""} ${data.brand.name} au catalogue${covers}. ` +
      `Livraison 24h Grand Tunis, paiement à la livraison.`,
    path: `/marque/${data.brand.slug}`,
  });
}

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getBrandPage(slug);
  // A brand row with nothing active behind it is not a page: it would be an
  // empty aisle with a logo on it.
  if (!data || data.total === 0) notFound();

  const { brand, products, total, families, makes } = data;
  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: "Marques", path: "/marques" },
    { name: brand.name, path: `/marque/${brand.slug}` },
  ];

  return (
    <div className="mx-auto shell-w px-4 py-6">
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <Breadcrumbs items={crumbs} />

      {/* The maker, stated the way the maker states itself: its own logo when
          the shop has uploaded one, and its name set in the site's own
          lettering when it has not. Never a logo we drew ourselves. */}
      <header className="mt-3 flex flex-col gap-4 rounded-2xl border border-navy-900/10 bg-white p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-7">
        <BrandMark name={brand.name} logoUrl={brand.logoUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-2xl font-extrabold uppercase tracking-tight text-navy-950 sm:text-3xl">
            Pièces {brand.name}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
            <span className="inline-flex items-center gap-1.5">
              <IconPackage className="h-4 w-4 text-gold-500" />
              {total} référence{total > 1 ? "s" : ""} au catalogue
            </span>
            {makes.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <IconCar className="h-4 w-4 text-gold-500" />
                {makes.length} marque{makes.length > 1 ? "s" : ""} de véhicules couverte
                {makes.length > 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
      </header>

      {families.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-xs font-bold uppercase tracking-wide text-navy-900/45">
            Familles couvertes
          </h2>
          <ul className="mt-2.5 flex list-none flex-wrap gap-2 p-0">
            {families.map((f) => (
              <li key={f.slug}>
                <Link
                  href={`/catalogue/${f.slug}?brand=${encodeURIComponent(brand.slug)}`}
                  className="inline-flex min-h-tap items-center gap-2 rounded-full border border-navy-900/15 bg-white px-4 text-[13px] font-semibold text-navy-900 transition hover:border-gold-500"
                >
                  {f.name}
                  <span className="text-navy-900/40">{f.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Which cars this maker's parts are listed for. Counted from the
          fitment table, so a brand the shop has recorded nothing for shows no
          list rather than an empty promise of universal fitment. */}
      {makes.length > 0 && (
        <section className="mt-5">
          <h2 className="font-display text-xs font-bold uppercase tracking-wide text-navy-900/45">
            Véhicules compatibles
          </h2>
          <ul className="mt-2.5 flex list-none flex-wrap gap-2 p-0">
            {makes.map((m) => (
              <li key={m.slug}>
                <Link
                  href={`/pieces/${m.slug}`}
                  className="inline-flex min-h-tap-compact items-center gap-2 rounded-lg border border-navy-900/10 bg-white px-3 text-[13px] font-semibold text-navy-800 transition hover:border-gold-500"
                >
                  {m.name}
                  <span className="text-navy-900/35">{m.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 font-heading font-extrabold uppercase tracking-tight text-navy-950">
          Toutes les pièces {brand.name}
        </h2>
        <ProductGrid products={products} />
        {total > products.length && (
          <p className="mt-4 text-sm text-gray-600">
            {products.length} sur {total} —{" "}
            <Link
              href={`/recherche?q=${encodeURIComponent(brand.name)}`}
              className="font-semibold text-navy-900 underline underline-offset-2 hover:text-red-600"
            >
              voir le reste
            </Link>
          </p>
        )}
      </section>

      {hasManufacturerInfo(brand) && (
        <div className="mt-10 max-w-3xl">
          <ManufacturerInfo name={brand.name} info={brand} />
        </div>
      )}
    </div>
  );
}
