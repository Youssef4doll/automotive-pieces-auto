import Hero from "@/components/Hero";
import FinderGrid from "@/components/FinderGrid";
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
import PromoGrid from "@/components/PromoGrid";
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
      <PromoGrid promos={promos} />
      <Hero shortcuts={shortcuts} />
      <BrandMarquee />
      <FinderGrid contactUrl={contactUrl} />
      {/* Two ways to shop, side by side and equally valid: by the car you
          drive, or by the kind of part you need. Neither is forced. */}
      <VehicleShortcuts />
      <CategoryGrid />
      {/* Campaign band. Empty by default and invisible to shoppers until the
          shop uploads artwork in /admin/promotions — an admin sees a prompt
          there instead, so an empty band is discoverable without inventing a
          campaign that was never run. */}
      <PromoCarousel promos={campaigns} manageHref={admin ? "/admin/promotions" : null} />
      <TrustBadges />
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
            {/* Wraps instead of overflowing: four fixed chips in a nowrap row
                pushed this section past the viewport on 320px phones. */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-semibold px-3.5 py-2 rounded-full bg-navy-900 text-white">
                <T k="product.chipAll" />
              </span>
              <span className="text-sm font-semibold px-3.5 py-2 rounded-full bg-white border border-navy-900/15 text-navy-900/80">
                <T k="product.chipBrake" />
              </span>
              <span className="text-sm font-semibold px-3.5 py-2 rounded-full bg-white border border-navy-900/15 text-navy-900/80">
                <T k="product.chipFilter" />
              </span>
              <span className="text-sm font-semibold px-3.5 py-2 rounded-full bg-white border border-navy-900/15 text-navy-900/80">
                <T k="product.chipOil" />
              </span>
            </div>
          </div>
          <ProductGrid products={topSellers} />
        </section>
      )}
      <WhyUs />
      <StoreSection />
      <NotFoundBand contactUrl={contactUrl} phone={contact.phone} />
      <B2BBand contactUrl={contactUrl} />
    </>
  );
}
