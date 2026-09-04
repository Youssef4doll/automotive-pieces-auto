import Hero from "@/components/Hero";
import PartFinder from "@/components/PartFinder";
import BrandMarquee from "@/components/BrandMarquee";
import CategoryGrid from "@/components/CategoryGrid";
import ProductGrid from "@/components/ProductGrid";
import WhyUs from "@/components/WhyUs";
import StoreSection from "@/components/StoreSection";
import NotFoundBand from "@/components/NotFoundBand";
import B2BBand from "@/components/B2BBand";
import SectionHeading from "@/components/SectionHeading";
import Eyebrow from "@/components/Eyebrow";
import TrustBadges from "@/components/TrustBadges";
import T from "@/components/T";
import { getTopSellers, getActivePromotions, getTopSubcategories } from "@/lib/data/catalog";
import { getSettings, publicContact, contactHref } from "@/lib/settings";
import { requireAdmin } from "@/lib/session";
import PromoCarousel from "@/components/PromoCarousel";
import VehicleShortcuts from "@/components/VehicleShortcuts";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Pièces détachées auto en Tunisie — compatibilité vérifiée",
  description:
    "Trouvez la bonne pièce pour votre voiture : recherche par véhicule, par référence ou par symptôme. " +
    "Livraison 24h Grand Tunis, 48–72h en régions, paiement à la livraison.",
  path: "/",
});

export default async function HomePage() {
  const [topSellers, settings, promos, campaigns, admin, shortcuts] = await Promise.all([
    getTopSellers(6),
    getSettings(),
    getActivePromotions("HERO"),
    getActivePromotions("CAMPAIGN"),
    requireAdmin(),
    getTopSubcategories(3),
  ]);
  const contact = publicContact(settings);
  const contactUrl = contactHref(contact);

  return (
    <>
      {/* The order below is the customer's journey, not a list of everything
          the shop could say.

          1. Find my part   — the only job most visitors came to do
          2. Campaigns      — merchandising, after the job, never in front of it
          3. Browse         — for the shopper who would rather look than type
          4. Best sellers   — real sales data, once they know how to buy
          5. Why us / store — trust, at the point where they are deciding
          6. Help / B2B     — the ways out for everyone else

          Two things moved a long way. The brand marquee used to sit between
          the hero and the finder, so the first interactive thing on the page
          was a strip of logos nobody came for; it now sits with the other
          trust material near the bottom. And the promotional grid used to be
          the very first thing above the hero, which made a parts shop open
          like a billboard. */}
      <Hero shortcuts={shortcuts} />
      <PartFinder contactUrl={contactUrl} />

      {/* One banner at a time, arrows to move between them.
          
          The deals used to render as a separate grid above this — a wide
          featured image with a two-column grid of smaller ones under it — so
          the same page carried promotional artwork in two different shapes in
          two different places. Everything the shop is currently pushing now
          goes through one carousel: the hero slots first, then the campaigns.
          
          Empty by default and invisible to shoppers until the shop uploads
          artwork in /admin/promotions — an admin sees a prompt there instead,
          so an empty band is discoverable without inventing a campaign that
          was never run. */}
      <PromoCarousel
        promos={[
          ...promos.map((p) => ({ ...p, kind: null })),
          ...campaigns,
        ]}
        manageHref={admin ? "/admin/promotions" : null}
      />

      {/* Two ways to browse, side by side and equally valid: by the car you
          drive, or by the kind of part you need. Neither is forced. */}
      <CategoryGrid />
      <VehicleShortcuts />
      {topSellers.length > 0 && (
        <section id="produits" className="mx-auto max-w-7xl px-4 py-7 sm:py-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div>
              <Eyebrow k="home.bestsellersEyebrow" />
              <SectionHeading
                k="home.bestsellers"
                className="text-xl sm:text-3xl font-heading font-extrabold uppercase text-navy-950 tracking-tight"
              />
            </div>
            {/* The four category chips that used to sit here are gone. They
                were <span>s styled exactly like the real filter pills on the
                catalogue pages, so they read as controls and did nothing when
                tapped. A control that does not control is worse than no
                control. */}
          </div>
          <ProductGrid products={topSellers} />
        </section>
      )}
      <TrustBadges />
      <BrandMarquee />
      <WhyUs />
      <StoreSection />
      <NotFoundBand contactUrl={contactUrl} phone={contact.phone} />
      <B2BBand contactUrl={contactUrl} />
    </>
  );
}
