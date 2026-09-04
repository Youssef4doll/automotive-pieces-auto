"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ProductGrid from "./ProductGrid";
import VehicleFilterBar, { groupByFit } from "./VehicleFilterBar";
import TrackEvent from "./TrackEvent";
import type { CardProduct } from "./ProductCard";
import { useVehicle } from "@/lib/vehicle-store";
import { logSearchMiss } from "@/app/actions/analytics";
import { contactLinkProps } from "@/lib/contact-link";

export type SearchProduct = CardProduct & { matchTier?: number };

/**
 * The results half of the search page.
 *
 * Client-side for one reason: the shopper's vehicle lives in their browser,
 * and "parts for my car first" is the single biggest improvement search can
 * make. The server ranks by relevance; this re-ranks the compatible ones to
 * the front without a round trip, exactly as the catalogue does.
 */
export default function SearchResults({
  query,
  products,
  suggestion,
  contactHref,
  contactLabel,
  fallbacks,
}: {
  query: string;
  products: SearchProduct[];
  /** A closer spelling of what they seem to have meant, never applied silently. */
  suggestion: string | null;
  contactHref: string;
  contactLabel: string;
  fallbacks: { id: string; name: string; slug: string }[];
}) {
  const vehicle = useVehicle((v) => v.vehicle);
  const [showAll, setShowAll] = useState(false);
  const groups = groupByFit(products, vehicle?.engineId ?? null);

  // Relevance decided the order; the vehicle decides what comes first. Within
  // each group the server's ranking is preserved, so an exact reference match
  // stays at the top of its group.
  const ordered = vehicle && !showAll ? groups.fits : products;

  // Fuzzy hits are real answers but weaker ones, so they are shown under their
  // own heading rather than mixed in as if they were what was asked for.
  const direct = ordered.filter((p) => (p.matchTier ?? 1) <= 1);
  const approximate = ordered.filter((p) => (p.matchTier ?? 1) > 1);

  if (products.length === 0) {
    return <NoResults query={query} suggestion={suggestion} contactHref={contactHref} contactLabel={contactLabel} fallbacks={fallbacks} />;
  }

  return (
    <>
      <TrackEvent name="search_completed" properties={{ query, resultCount: products.length }} />

      {suggestion && (
        <p className="text-sm text-gray-600 mb-4">
          Vous cherchiez peut-être{" "}
          <Link
            href={`/recherche?q=${encodeURIComponent(suggestion)}`}
            className="font-semibold text-navy-600 hover:text-red-600 underline underline-offset-2"
          >
            {suggestion}
          </Link>
          {" "}?
        </p>
      )}

      <VehicleFilterBar
        total={products.length}
        fitCount={groups.fits.length}
        unverifiedCount={groups.unverified.length}
        showAll={showAll}
        onToggle={setShowAll}
      />

      {ordered.length === 0 ? (
        <div className="text-center py-10 px-4 border border-dashed border-gray-300 rounded-xl">
          <p className="text-navy-950 font-semibold mb-1">
            Aucun de ces résultats n&apos;est vérifié pour votre {vehicle?.makeName}
          </p>
          <p className="text-sm text-gray-600 mb-5 max-w-md mx-auto">
            {products.length} référence{products.length > 1 ? "s" : ""} correspondent à votre recherche, sans
            compatibilité confirmée avec votre véhicule.
          </p>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="inline-flex items-center min-h-tap px-5 rounded-lg bg-navy-950 hover:bg-navy-800 text-white font-display font-bold uppercase text-xs tracking-wide"
          >
            Voir les {products.length} résultats
          </button>
        </div>
      ) : (
        <>
          {direct.length > 0 && <ProductGrid products={direct} />}

          {approximate.length > 0 && (
            <section className={direct.length > 0 ? "mt-8 pt-6 border-t border-gray-200" : ""}>
              <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950 text-lg">
                Résultats approchants
              </h2>
              <p className="text-sm text-gray-600 mt-1 mb-4 max-w-prose">
                Ces références ne correspondent pas mot pour mot à « {query} », mais s&apos;en rapprochent.
              </p>
              <ProductGrid products={approximate} />
            </section>
          )}
        </>
      )}
    </>
  );
}

/**
 * The empty result, treated as the start of a conversation rather than a dead
 * end.
 *
 * Every route out of here is real: a closer spelling if we have one, the
 * shop's own contact channel, the reference box, and the families that
 * actually hold stock. The query itself is filed as demand — a customer who
 * asked for something the shop does not carry has just written a line of the
 * buying list.
 */
function NoResults({
  query,
  suggestion,
  contactHref,
  contactLabel,
  fallbacks,
}: {
  query: string;
  suggestion: string | null;
  contactHref: string;
  contactLabel: string;
  fallbacks: { id: string; name: string; slug: string }[];
}) {
  // One line per want, not one per mount.
  //
  // The effect on its own fires twice for a single search in development,
  // because Strict Mode mounts, unmounts and remounts to prove an effect is
  // safe to repeat — and this one is not, since it increments a counter on the
  // server. React does not double-invoke in production, so the buying list is
  // right there today, but "right as long as nothing ever remounts this" is
  // not a property worth relying on for the number the shop orders stock
  // against. The ref makes the write happen once per query however many times
  // the component is mounted.
  const logged = useRef<string | null>(null);
  useEffect(() => {
    if (logged.current === query) return;
    logged.current = query;
    void logSearchMiss(query);
  }, [query]);

  return (
    <div className="flex flex-col gap-8">
      <TrackEvent name="search_failed" properties={{ query }} />

      <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 sm:py-10">
        <p className="text-center text-navy-950 font-semibold text-lg mb-1">
          Nous n&apos;avons pas trouvé de correspondance exacte
        </p>
        <p className="text-center text-sm text-gray-600 mb-6 max-w-md mx-auto">
          Rien dans le catalogue ne correspond à « {query} ». Voici les moyens les plus rapides d&apos;avoir la
          bonne pièce.
        </p>

        {suggestion && (
          <p className="text-center text-sm mb-6">
            Vous cherchiez peut-être{" "}
            <Link
              href={`/recherche?q=${encodeURIComponent(suggestion)}`}
              className="font-semibold text-navy-600 hover:text-red-600 underline underline-offset-2"
            >
              {suggestion}
            </Link>
            {" "}?
          </p>
        )}

        {/* Line icons rather than emoji. Emoji render as a different typeface
            on every platform, carry colours nothing else on the page uses, and
            read as chat rather than as a parts counter. These inherit the
            text colour and the weight of the button they sit in. */}
        <div className="grid gap-2.5 sm:grid-cols-2 max-w-2xl mx-auto">
          <a
            href={contactHref}
            {...contactLinkProps(contactHref)}
            className="flex items-center gap-3 min-h-tap px-4 rounded-lg bg-green-700 hover:bg-green-800 text-white font-semibold text-sm"
          >
            <IconChat />
            {contactLabel}
          </a>
          <Link
            href="/compte/garage"
            className="flex items-center gap-3 min-h-tap px-4 rounded-lg border border-gray-300 bg-white text-navy-900 font-semibold text-sm hover:border-navy-700"
          >
            <IconCar />
            Choisir ou changer de véhicule
          </Link>
          <Link
            href="/#finder"
            className="flex items-center gap-3 min-h-tap px-4 rounded-lg border border-gray-300 bg-white text-navy-900 font-semibold text-sm hover:border-navy-700"
          >
            <IconHash />
            Chercher par référence
          </Link>
          <Link
            href="/#finder"
            className="flex items-center gap-3 min-h-tap px-4 rounded-lg border border-gray-300 bg-white text-navy-900 font-semibold text-sm hover:border-navy-700"
          >
            <IconCamera />
            Envoyer une photo de la carte grise
          </Link>
        </div>
      </div>

      {fallbacks.length > 0 && (
        <section>
          <h2 className="font-heading font-extrabold uppercase text-navy-950 mb-3 tracking-tight">
            Parcourir par famille
          </h2>
          <div className="flex flex-wrap gap-2">
            {fallbacks.map((f) => (
              <Link
                key={f.id}
                href={`/catalogue/${f.slug}`}
                className="inline-flex items-center min-h-tap-compact px-3 rounded-full border border-gray-300 bg-white text-sm text-gray-700 hover:border-navy-300"
              >
                {f.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* The four ways out of an empty result, drawn rather than typed as emoji. */

function Stroke({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function IconChat() {
  return <Stroke><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 21l1.9-5A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4Z" /></Stroke>;
}

function IconCar() {
  return (
    <Stroke>
      <path d="M5 17h14M4 17v-4.2L6 7h12l2 5.8V17" />
      <path d="M4 17v2h3v-2M17 17v2h3v-2" />
      <circle cx="7.5" cy="13.5" r=".8" />
      <circle cx="16.5" cy="13.5" r=".8" />
    </Stroke>
  );
}

function IconHash() {
  return <Stroke><path d="M10 3 8 21M16 3l-2 18M3.5 8.5h17M3 15.5h17" /></Stroke>;
}

function IconCamera() {
  return (
    <Stroke>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.2-2h8.2l1.2 2h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5Z" />
      <circle cx="12" cy="13" r="3.4" />
    </Stroke>
  );
}
