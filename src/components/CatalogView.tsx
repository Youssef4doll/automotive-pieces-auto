"use client";

// Client because the vehicle filter is driven by the shopper's saved
// vehicle, which lives in their browser, and the "my car / everything"
// toggle has to be instant rather than a round trip.
import Link from "next/link";
import ProductGrid from "./ProductGrid";
import CatalogControls from "./CatalogControls";
import TrackEvent from "./TrackEvent";
import type { CardProduct } from "./ProductCard";
import { contactLink } from "@/lib/contact-link";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useState } from "react";
import { useVehicle } from "@/lib/vehicle-store";
import VehicleFilterBar, { groupByFit } from "@/components/VehicleFilterBar";

type Sibling = { id: string; name: string; slug: string; productCount?: number };
type BrandFacet = { name: string; slug: string; count: number };

export default function CatalogView({
  family,
  subfamily,
  siblings,
  products,
  brands,
  activeBrandSlug,
  activeSort,
  whatsapp,
}: {
  family: { name: string; slug: string };
  subfamily?: { name: string; slug: string } | null;
  siblings: Sibling[];
  products: CardProduct[];
  brands: BrandFacet[];
  activeBrandSlug?: string;
  activeSort?: string;
  whatsapp: string | null;
}) {
  // The sidebar and chips list sibling categories; ones with nothing in them
  // are dead ends, so they are filtered out here too rather than only in the
  // header menu. They come back automatically once they hold stock.
  const stocked = siblings.filter((s) => s.productCount === undefined || s.productCount > 0);

  // Filtering happens here rather than on the server because the shopper's
  // vehicle lives in their browser, and every card already carries its
  // fitments — so switching between "my car" and "everything" is instant and
  // costs no request.
  const vehicle = useVehicle((v) => v.vehicle);
  const [showAll, setShowAll] = useState(false);
  const groups = groupByFit(products, vehicle?.engineId ?? null);
  const shown = !vehicle || showAll ? products : groups.fits;
  const title = subfamily ? subfamily.name : family.name;
  const basePath = subfamily ? `/catalogue/${family.slug}/${subfamily.slug}` : `/catalogue/${family.slug}`;

  // w-full + min-w-0 on the page container: <main> is a column flex container,
  // so this container is a flex item and defaults to min-width:auto — it would
  // inflate to the min-content width of the horizontally scrolling filter chips
  // below and push the whole page sideways. It has to opt out explicitly.
  return (
    <div className="w-full min-w-0 mx-auto max-w-7xl px-4 py-6">
      <TrackEvent
        name="category_viewed"
        properties={{ family: family.slug, subfamily: subfamily?.slug ?? null, resultCount: products.length }}
      />
      <div className="mb-3">
        <Breadcrumbs
          items={[
            { name: "Accueil", path: "/" },
            { name: family.name, path: `/catalogue/${family.slug}` },
            ...(subfamily
              ? [{ name: subfamily.name, path: `/catalogue/${family.slug}/${subfamily.slug}` }]
              : []),
          ]}
        />
      </div>

      <h1 className="text-xl sm:text-2xl font-heading font-extrabold uppercase text-navy-950 mb-1 tracking-tight">{title}</h1>
      <p className="text-sm text-gray-500 mb-4">
        {/* The count of what is on screen, not of the whole category — the
            filter bar below states the total, and two different numbers on one
            page reads as a bug. */}
        {shown.length} référence{shown.length > 1 ? "s" : ""} · 24h Grand Tunis, 48–72h régions
      </p>

      {/* On phones the sidebar used to render first and fill the whole screen
          with a bare list of ten subcategory links, so the shopper scrolled
          past every filter before seeing a single product. The filters are
          the same links, laid out as one scrollable row each, which puts the
          products back above the fold. The desktop sidebar is unchanged. */}
      <div className="lg:hidden flex flex-col gap-2 mb-4">
        {stocked.length > 0 && (
          <div className="-mx-4 px-4 overflow-x-auto no-scrollbar">
            <div className="flex gap-2 w-max">
              {stocked.map((s) => {
                const active = subfamily?.slug === s.slug;
                return (
                  <Link
                    key={s.id}
                    href={active ? `/catalogue/${family.slug}` : `/catalogue/${family.slug}/${s.slug}`}
                    className={`inline-flex items-center whitespace-nowrap px-3 min-h-tap-compact rounded-full border text-sm ${
                      active
                        ? "bg-navy-900 border-navy-900 text-white font-semibold"
                        : "bg-white border-gray-300 text-gray-700"
                    }`}
                  >
                    {s.name}
                    {active && <span className="ms-1.5">✕</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
        {brands.length > 0 && (
          <div className="-mx-4 px-4 overflow-x-auto no-scrollbar">
            <div className="flex gap-2 w-max">
              {brands.map((b) => {
                const active = activeBrandSlug === b.slug;
                return (
                  <Link
                    key={b.slug}
                    href={`${basePath}?brand=${active ? "" : b.slug}${activeSort ? `&sort=${activeSort}` : ""}`}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap px-3 min-h-tap-compact rounded-full border text-sm ${
                      active
                        ? "bg-gold-500 border-gold-500 text-navy-950 font-semibold"
                        : "bg-white border-gray-300 text-gray-700"
                    }`}
                  >
                    {b.name}
                    <span className={active ? "text-navy-900/70" : "text-gray-400"}>{b.count}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="hidden lg:flex lg:w-56 shrink-0 flex-col gap-6">
          {stocked.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Type de pièce</h3>
              <ul className="space-y-1">
                {stocked.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/catalogue/${family.slug}/${s.slug}`}
                      className={`block px-2 rounded-lg text-sm min-h-tap flex items-center ${
                        subfamily?.slug === s.slug
                          ? "bg-navy-900 text-white font-semibold"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {brands.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Marque</h3>
              <ul className="space-y-1">
                {brands.map((b) => (
                  <li key={b.slug}>
                    <Link
                      href={`${basePath}?brand=${activeBrandSlug === b.slug ? "" : b.slug}${activeSort ? `&sort=${activeSort}` : ""}`}
                      className={`flex items-center justify-between px-2 rounded-lg text-sm min-h-tap ${
                        activeBrandSlug === b.slug ? "bg-gold-500/20 text-navy-900 font-semibold" : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <span>{b.name}</span>
                      <span className="text-xs text-gray-400">{b.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <div className="flex-1 min-w-0">
          <CatalogControls basePath={basePath} activeBrandSlug={activeBrandSlug} activeSort={activeSort} />

          {products.length > 0 && (
            <VehicleFilterBar
              total={products.length}
              fitCount={groups.fits.length}
              unverifiedCount={groups.unverified.length}
              showAll={showAll}
              onToggle={setShowAll}
            />
          )}

          {products.length === 0 ? (
            <EmptyState whatsapp={whatsapp} />
          ) : shown.length === 0 ? (
            <NoFitState make={vehicle?.makeName ?? ""} onShowAll={() => setShowAll(true)} whatsapp={whatsapp} />
          ) : (
            <ProductGrid products={shown} />
          )}

          {/* Parts the catalogue has no fitment data for. Kept out of the
              filtered list — they are not verified as fitting — but offered
              rather than dropped, because "not checked yet" is not the same
              as "does not fit". */}
          {vehicle && !showAll && groups.unverified.length > 0 && (
            <section className="mt-8 pt-6 border-t border-gray-200">
              <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950 text-lg">
                Compatibilité non vérifiée
              </h2>
              <p className="text-sm text-gray-600 mt-1 mb-4 max-w-prose">
                Nous n&apos;avons pas encore les données de compatibilité de ces {groups.unverified.length} référence
                {groups.unverified.length > 1 ? "s" : ""}. Elles ne sont pas déclarées incompatibles avec votre{" "}
                {vehicle.makeName} — simplement non vérifiées. Envoyez-nous votre référence et nous confirmons.
              </p>
              <ProductGrid products={groups.unverified} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/** No part in this category is confirmed to fit the saved vehicle. */
function NoFitState({
  make,
  onShowAll,
  whatsapp,
}: {
  make: string;
  onShowAll: () => void;
  whatsapp: string | null;
}) {
  return (
    <div className="text-center py-12 px-4 border border-dashed border-gray-300 rounded-xl">
      <p className="text-navy-950 font-semibold mb-1">Aucune pièce de cette catégorie n&apos;est vérifiée pour votre {make}</p>
      <p className="text-sm text-gray-600 mb-5 max-w-md mx-auto">
        Cela ne veut pas dire qu&apos;il n&apos;en existe pas — seulement que nous n&apos;avons pas encore la donnée.
        Donnez-nous votre référence ou votre carte grise et nous vérifions.
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        <button
          type="button"
          onClick={onShowAll}
          className="inline-flex items-center min-h-tap px-5 rounded-lg bg-navy-950 hover:bg-navy-800 text-white font-display font-bold uppercase text-xs tracking-wide transition-colors"
        >
          Voir toutes les références
        </button>
        <a
          href={contactLink({ whatsapp, email: null })}
          {...(whatsapp ? { target: "_blank", rel: "noreferrer" } : {})}
          className="inline-flex items-center min-h-tap px-5 rounded-lg border border-gray-300 text-navy-900 font-semibold text-sm hover:border-navy-700 transition-colors"
        >
          Nous demander
        </a>
      </div>
    </div>
  );
}

function EmptyState({ whatsapp }: { whatsapp: string | null }) {
  return (
    <div className="text-center py-16 px-4 border border-dashed border-gray-300 rounded-xl">
      <p className="text-3xl mb-3">🔧</p>
      <p className="text-gray-600 font-medium mb-4">Aucune référence en ligne pour cette catégorie</p>
      <a
        href={contactLink({ whatsapp, email: null })}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold"
      >
        Envoyez-la sur WhatsApp, on la retrouve
      </a>
    </div>
  );
}
