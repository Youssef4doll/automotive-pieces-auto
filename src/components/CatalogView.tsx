"use client";

// Client because the vehicle filter is driven by the shopper's saved
// vehicle, which lives in their browser, and the "my car / everything"
// toggle has to be instant rather than a round trip.
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import ProductGrid from "./ProductGrid";
import CatalogControls from "./CatalogControls";
import TrackEvent from "./TrackEvent";
import PriceRange from "./PriceRange";
import Checkbox from "./Checkbox";
import CategoryVehicleBar from "./CategoryVehicleBar";
import type { CardProduct } from "./ProductCard";
import Breadcrumbs from "@/components/Breadcrumbs";
import VehicleFilterBar, { groupByFit } from "@/components/VehicleFilterBar";
import { contactLink, contactLinkProps } from "@/lib/contact-link";
import { useVehicle } from "@/lib/vehicle-store";
import { useLocale } from "@/i18n/LocaleProvider";
import type { DictKey } from "@/i18n/dictionaries";
import { activeFilterCount, filterHref, toggleBrand, type CatalogFilters } from "@/lib/catalog-filters";
import type { CategoryFacets } from "@/lib/data/catalog";

type Sibling = { id: string; name: string; slug: string; productCount?: number };
type BrandFacet = { name: string; slug: string; count: number };
type Translate = (k: DictKey) => string;

export default function CatalogView({
  family,
  subfamily,
  siblings,
  products,
  brands,
  filters,
  facets,
  art,
  delivery,
  whatsapp,
}: {
  family: { name: string; slug: string };
  subfamily?: { name: string; slug: string } | null;
  siblings: Sibling[];
  products: CardProduct[];
  brands: BrandFacet[];
  filters: CatalogFilters;
  facets: CategoryFacets;
  /** The category's own picture, uploaded from /admin/catalogue — or null, and
   *  the family's line drawing stands in. */
  art: { slug: string; imageUrl: string | null };
  /** The shop's delivery windows, from settings. Never typed into a component. */
  delivery: { grandTunis: string; regions: string };
  whatsapp: string | null;
}) {
  const { t } = useLocale();
  const router = useRouter();

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
  const [view, setView] = useState<"grid" | "list">("grid");
  const [mobileFilters, setMobileFilters] = useState(false);
  const groups = groupByFit(products, vehicle?.engineId ?? null);
  const shown = !vehicle || showAll ? products : groups.fits;
  const title = subfamily ? subfamily.name : family.name;
  const basePath = subfamily ? `/catalogue/${family.slug}/${subfamily.slug}` : `/catalogue/${family.slug}`;
  const deliveryLine = `${delivery.grandTunis} Grand Tunis · ${delivery.regions} régions`;
  const href = (next: Partial<CatalogFilters>) => filterHref(basePath, { ...filters, ...next });
  const nFilters = activeFilterCount(filters);

  // What is under the title: counted from the catalogue, never a blurb. The
  // number of parts is deliberately not here — the bar above the grid states
  // it, and two different numbers on one page reads as a bug once the
  // vehicle filter narrows the list.
  const intro = [
    !subfamily && stocked.length > 0 ? `${stocked.length} type${stocked.length > 1 ? "s" : ""} de pièces` : null,
    brands.length > 0 ? `${brands.length} marque${brands.length > 1 ? "s" : ""}` : null,
    subfamily ? family.name : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const panel = (
    <FilterPanel
      t={t}
      family={family}
      subfamily={subfamily}
      stocked={stocked}
      brands={brands}
      filters={filters}
      facets={facets}
      href={href}
      onPrice={(lo, hi) =>
        router.push(
          href({
            // The ends of the scale mean "no bound", so a slider pushed back to
            // its ends leaves a clean URL rather than ?min=12&max=350.
            min: lo <= facets.priceMin ? undefined : lo,
            max: hi >= facets.priceMax ? undefined : hi,
          })
        )
      }
    />
  );

  return (
    <div className="w-full min-w-0">
      <TrackEvent
        name="category_viewed"
        properties={{ family: family.slug, subfamily: subfamily?.slug ?? null, resultCount: products.length }}
      />

      {/* The header band: what this aisle is, what the shop promises about
          buying from it, and which car the shopper is buying for. Full-bleed
          so it reads as the top of a page rather than a box in one. */}
      <section className="w-full border-b border-navy-900/6 bg-[linear-gradient(180deg,#f2f5fa_0%,#ffffff_100%)]">
        <div className="mx-auto w-full max-w-[90rem] px-4 pt-3 pb-5 lg:pt-4 lg:pb-7">
          <Breadcrumbs
            items={[
              { name: "Accueil", path: "/" },
              { name: family.name, path: `/catalogue/${family.slug}` },
              ...(subfamily ? [{ name: subfamily.name, path: `/catalogue/${family.slug}/${subfamily.slug}` }] : []),
            ]}
          />

          <div className="mt-3 flex flex-col gap-4 lg:mt-4 lg:flex-row lg:items-start lg:gap-8">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-3.5 sm:gap-5">
                {/* The category's picture in a disc: the uploaded photo, or
                    the family's line drawing. Both are drawn on white, so the
                    disc is white with a navy ring rather than navy — the
                    drawing carries its own pale background and would not
                    survive being recoloured. */}
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-white shadow-md ring-[3px] ring-navy-900 sm:h-[76px] sm:w-[76px]">
                  <Image
                    src={art.imageUrl ?? `/api/part-icon/${art.slug}.svg`}
                    alt=""
                    fill
                    sizes="76px"
                    className={art.imageUrl ? "object-contain p-2" : "object-contain p-2 scale-110"}
                  />
                </span>
                <div className="min-w-0">
                  <h1 className="font-heading text-[1.7rem] font-extrabold leading-[1.1] tracking-tight text-navy-950 sm:text-3xl lg:text-[2.25rem]">
                    {title}
                  </h1>
                  {intro && <p className="mt-1.5 text-sm text-gray-600 sm:text-[15px]">{intro}</p>}
                </div>
              </div>

              {/* Three facts, each true for every part on the page. */}
              <ul className="mt-5 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-5">
                <Fact icon="fit" title={t("cat.factFit")} sub={t("cat.factFitSub")} />
                <Fact icon="truck" title={t("cat.factDelivery")} sub={deliveryLine} />
                <Fact icon="cash" title={t("cat.factCod")} sub={t("cat.factCodSub")} />
              </ul>
            </div>

            <div className="flex items-start gap-5 lg:shrink-0">
              {art.imageUrl && (
                <span className="relative hidden h-[150px] w-[220px] shrink-0 xl:block">
                  <Image src={art.imageUrl} alt="" fill sizes="220px" className="object-contain drop-shadow-lg" />
                </span>
              )}
              <div className="w-full lg:w-[320px]">
                <CategoryVehicleBar />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* w-full + min-w-0: <main> is a column flex container, so this is a
          flex item and defaults to min-width:auto — it would inflate to the
          min-content width of the horizontally scrolling filter chips below
          and push the whole page sideways. It has to opt out explicitly. */}
      <div className="mx-auto w-full min-w-0 max-w-[90rem] px-4 py-5 lg:py-7">
        {/* On phones the filters are one scrollable row each, so the products
            stay above the fold, plus a button that unfolds the full panel for
            the price band and the stock tick. */}
        <div className="mb-4 flex flex-col gap-2 lg:hidden">
          {stocked.length > 0 && (
            <div className="-mx-4 overflow-x-auto px-4 no-scrollbar">
              <div className="flex w-max gap-2">
                {stocked.map((s) => {
                  const active = subfamily?.slug === s.slug;
                  return (
                    <Link
                      key={s.id}
                      href={active ? `/catalogue/${family.slug}` : `/catalogue/${family.slug}/${s.slug}`}
                      className={`inline-flex min-h-tap-compact items-center whitespace-nowrap rounded-full border px-3 text-sm ${
                        active ? "border-navy-900 bg-navy-900 font-semibold text-white" : "border-gray-300 bg-white text-gray-700"
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
            <div className="-mx-4 overflow-x-auto px-4 no-scrollbar">
              <div className="flex w-max gap-2">
                {brands.map((b) => {
                  const active = filters.brands.includes(b.slug);
                  return (
                    <Link
                      key={b.slug}
                      href={href({ brands: toggleBrand(filters.brands, b.slug) })}
                      aria-pressed={active}
                      className={`inline-flex min-h-tap-compact items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm ${
                        active ? "border-gold-500 bg-gold-500 font-semibold text-navy-950" : "border-gray-300 bg-white text-gray-700"
                      }`}
                    >
                      {b.name}
                      <span className={active ? "text-navy-900/70" : "text-gray-600"}>{b.count}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setMobileFilters((v) => !v)}
            aria-expanded={mobileFilters}
            className="inline-flex min-h-tap items-center gap-2 self-start rounded-lg border border-navy-900/15 bg-white px-4 text-sm font-semibold text-navy-950"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            {t("cat.filters")}
            {nFilters > 0 && <span className="rounded-full bg-gold-500 px-1.5 text-xs font-bold text-navy-950">{nFilters}</span>}
          </button>
          {mobileFilters && <div className="rounded-2xl border border-navy-900/10 bg-white p-4">{panel}</div>}
        </div>

        <div className="flex flex-col gap-6 lg:flex-row xl:gap-8">
          <aside className="hidden w-64 shrink-0 self-start lg:sticky lg:top-24 lg:block xl:w-72">
            <div className="rounded-2xl border border-navy-900/10 bg-white p-5">
              <h2 className="mb-3 font-heading text-lg font-extrabold text-navy-950">{t("cat.filters")}</h2>
              {panel}
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <CatalogControls
              basePath={basePath}
              brands={brands}
              filters={filters}
              facets={facets}
              count={shown.length}
              view={view}
              onView={setView}
            />

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
              <ProductGrid products={shown} layout={view} delivery={deliveryLine} />
            )}

            {/* Parts the catalogue has no fitment data for. Kept out of the
                filtered list — they are not verified as fitting — but offered
                rather than dropped, because "not checked yet" is not the same
                as "does not fit". */}
            {vehicle && !showAll && groups.unverified.length > 0 && (
              <section className="mt-8 border-t border-gray-200 pt-6">
                <h2 className="font-heading text-lg font-extrabold uppercase tracking-tight text-navy-950">
                  Compatibilité non vérifiée
                </h2>
                <p className="mb-4 mt-1 max-w-prose text-sm text-gray-600">
                  Nous n&apos;avons pas encore les données de compatibilité de ces {groups.unverified.length} référence
                  {groups.unverified.length > 1 ? "s" : ""}. Elles ne sont pas déclarées incompatibles avec votre{" "}
                  {vehicle.makeName} — simplement non vérifiées. Envoyez-nous votre référence et nous confirmons.
                </p>
                <ProductGrid products={groups.unverified} layout={view} delivery={deliveryLine} />
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ filters ---- */

/**
 * The sidebar's contents, shared by the desktop card and the phone's unfolding
 * panel so the two can never offer different filters.
 *
 * Every row is a plain link to the URL that state produces (see
 * lib/catalog-filters) — a shopper with JavaScript off can still filter. Only
 * the price slider needs script, and it degrades to nothing rather than to a
 * broken control.
 */
function FilterPanel({
  t,
  family,
  subfamily,
  stocked,
  brands,
  filters,
  facets,
  href,
  onPrice,
}: {
  t: Translate;
  family: { name: string; slug: string };
  subfamily?: { name: string; slug: string } | null;
  stocked: Sibling[];
  brands: BrandFacet[];
  filters: CatalogFilters;
  facets: CategoryFacets;
  href: (next: Partial<CatalogFilters>) => string;
  onPrice: (lo: number, hi: number) => void;
}) {
  const [allBrands, setAllBrands] = useState(false);
  const SHOW = 6;
  // A ticked brand is always visible, wherever it sits in the list — a filter
  // the shopper cannot see is a filter they cannot remove.
  const visibleBrands = allBrands ? brands : brands.filter((b, i) => i < SHOW || filters.brands.includes(b.slug));
  const rowClass = (active: boolean) =>
    `flex min-h-tap items-center gap-2.5 rounded-lg px-2 text-sm ${
      active ? "font-semibold text-navy-950" : "text-gray-700 hover:bg-gray-100"
    }`;

  return (
    <div className="flex flex-col divide-y divide-navy-900/8">
      {facets.priceMax > facets.priceMin && (
        <Section title={t("cat.price")}>
          <div className="px-1 pt-1">
            <PriceRange
              key={`${filters.min ?? "min"}-${filters.max ?? "max"}`}
              floor={facets.priceMin}
              ceil={facets.priceMax}
              lo={filters.min ?? facets.priceMin}
              hi={filters.max ?? facets.priceMax}
              onCommit={onPrice}
            />
          </div>
        </Section>
      )}

      {brands.length > 0 && (
        <Section title={`${t("cat.brand")}${filters.brands.length > 0 ? ` (${filters.brands.length})` : ""}`}>
          {/* Checkboxes, not a single toggle: a shopper who trusts both Bosch
              and Valeo used to have to pick one and reload to try the other.
              The count beside each name is the whole category's, not
              recomputed for the current selection — unticking a box should
              never make the others' numbers shift under the shopper's finger. */}
          <ul className="-mx-2 space-y-0.5">
            {visibleBrands.map((b) => {
              const checked = filters.brands.includes(b.slug);
              return (
                <li key={b.slug}>
                  <Link href={href({ brands: toggleBrand(filters.brands, b.slug) })} aria-pressed={checked} className={rowClass(checked)}>
                    <Checkbox checked={checked} />
                    <span className="min-w-0 flex-1 truncate">{b.name}</span>
                    <span className="text-xs text-gray-500 tabular-nums">{b.count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {brands.length > SHOW && (
            <button
              type="button"
              onClick={() => setAllBrands((v) => !v)}
              className="mt-1 inline-flex min-h-tap-compact items-center text-xs font-semibold text-navy-900 underline underline-offset-2 hover:text-red-600"
            >
              {allBrands ? t("cat.seeLess") : `${t("cat.seeMore")} (${brands.length - visibleBrands.length})`}
            </button>
          )}
        </Section>
      )}

      <Section title={t("cat.availability")}>
        <ul className="-mx-2">
          <li>
            <Link href={href({ stock: filters.stock ? undefined : true })} aria-pressed={!!filters.stock} className={rowClass(!!filters.stock)}>
              <Checkbox checked={!!filters.stock} />
              <span className="min-w-0 flex-1">{t("cat.inStockOnly")}</span>
              <span className="text-xs text-gray-500 tabular-nums">{facets.inStock}</span>
            </Link>
          </li>
        </ul>
      </Section>

      {stocked.length > 0 && (
        <Section title={t("cat.type")}>
          <ul className="-mx-2 space-y-0.5">
            {stocked.map((s) => {
              const active = subfamily?.slug === s.slug;
              return (
                <li key={s.id}>
                  <Link
                    href={active ? `/catalogue/${family.slug}` : `/catalogue/${family.slug}/${s.slug}`}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-tap items-center gap-2.5 rounded-lg px-2 text-sm ${
                      active ? "bg-navy-900 font-semibold text-white" : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 ${
                        active ? "border-white" : "border-gray-300"
                      }`}
                    >
                      {active && <span className="h-2 w-2 rounded-full bg-gold-500" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    {typeof s.productCount === "number" && (
                      <span className={`text-xs tabular-nums ${active ? "text-white/70" : "text-gray-500"}`}>{s.productCount}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </div>
  );
}

/** A titled, collapsible group. Native details/summary: open by default, no
 *  script needed to fold it, and the state survives a filter navigation
 *  because the page re-renders it open. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details open className="group py-3.5 first:pt-0 last:pb-0">
      <summary className="flex min-h-tap-compact cursor-pointer select-none list-none items-center justify-between text-[13px] font-bold text-navy-950 [&::-webkit-details-marker]:hidden">
        {title}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 transition-transform group-open:rotate-180" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="pt-2">{children}</div>
    </details>
  );
}

/* --------------------------------------------------------------- hero ---- */

function Fact({ icon, title, sub }: { icon: "fit" | "truck" | "cash"; title: string; sub: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-500/15 text-navy-900">
        {icon === "fit" && (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" />
            <path d="m8.5 12 2.5 2.5 4.5-5" />
          </svg>
        )}
        {icon === "truck" && (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 3h13v13H1zM14 8h4l4 4v4h-8z" />
            <circle cx="5.5" cy="18.5" r="2" />
            <circle cx="18.5" cy="18.5" r="2" />
          </svg>
        )}
        {icon === "cash" && (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <circle cx="12" cy="12" r="2.5" />
            <path d="M6 12h.01M18 12h.01" />
          </svg>
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-navy-950">{title}</span>
        <span className="block text-xs text-gray-500">{sub}</span>
      </span>
    </li>
  );
}

/* ------------------------------------------------------------- states ---- */

/** No part in this category is confirmed to fit the saved vehicle. */
function NoFitState({ make, onShowAll, whatsapp }: { make: string; onShowAll: () => void; whatsapp: string | null }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 px-4 py-12 text-center">
      <p className="mb-1 font-semibold text-navy-950">Aucune pièce de cette catégorie n&apos;est vérifiée pour votre {make}</p>
      <p className="mx-auto mb-5 max-w-md text-sm text-gray-600">
        Cela ne veut pas dire qu&apos;il n&apos;en existe pas — seulement que nous n&apos;avons pas encore la donnée.
        Donnez-nous votre référence ou votre carte grise et nous vérifions.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onShowAll}
          className="inline-flex min-h-tap items-center rounded-lg bg-navy-950 px-5 font-display text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-navy-800"
        >
          Voir toutes les références
        </button>
        <a
          href={contactLink({ whatsapp, email: null })}
          {...(whatsapp ? { target: "_blank", rel: "noreferrer" } : {})}
          className="inline-flex min-h-tap items-center rounded-lg border border-gray-300 px-5 text-sm font-semibold text-navy-900 transition-colors hover:border-navy-700"
        >
          Nous demander
        </a>
      </div>
    </div>
  );
}

function EmptyState({ whatsapp }: { whatsapp: string | null }) {
  const emptyHref = contactLink({ whatsapp, email: null });
  return (
    <div className="rounded-xl border border-dashed border-gray-300 px-4 py-16 text-center">
      <p className="mb-3 text-3xl">🔧</p>
      <p className="mb-4 font-medium text-gray-600">Aucune référence en ligne pour cette catégorie</p>
      {/* Same fix as FamiliesFooter and HelpCenter: the target was hardcoded,
          so with no WhatsApp number set this opened the site's own store
          section in a new tab, under a label naming WhatsApp. */}
      <a
        href={emptyHref}
        {...contactLinkProps(emptyHref)}
        className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white"
      >
        {whatsapp ? "Envoyez-la sur WhatsApp, on la retrouve" : "Demandez-nous, on la retrouve"}
      </a>
    </div>
  );
}
