import Hero from "@/components/Hero";
import FinderGrid from "@/components/FinderGrid";
import BrandMarquee from "@/components/BrandMarquee";
import CategoryGrid from "@/components/CategoryGrid";
import PacksSection from "@/components/PacksSection";
import ProductGrid from "@/components/ProductGrid";
import WhyUs from "@/components/WhyUs";
import ReviewsSection from "@/components/ReviewsSection";
import StoreSection from "@/components/StoreSection";
import NotFoundBand from "@/components/NotFoundBand";
import B2BBand from "@/components/B2BBand";
import SectionHeading from "@/components/SectionHeading";
import Eyebrow from "@/components/Eyebrow";
import TrustBadges from "@/components/TrustBadges";
import T from "@/components/T";
import { getTopSellers } from "@/lib/data/catalog";
import { getSettings } from "@/lib/settings";

export default async function HomePage() {
  const [topSellers, settings] = await Promise.all([getTopSellers(8), getSettings()]);

  return (
    <>
      <Hero />
      <BrandMarquee />
      <FinderGrid whatsapp={settings.shop_whatsapp} />
      <CategoryGrid />
      <PacksSection />
      <TrustBadges />
      {topSellers.length > 0 && (
        <section id="produits" className="mx-auto max-w-7xl px-4 py-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div>
              <Eyebrow k="home.bestsellersEyebrow" />
              <SectionHeading
                k="home.bestsellers"
                className="text-2xl sm:text-3xl font-heading font-extrabold uppercase text-navy-950 tracking-tight"
              />
            </div>
            <div className="flex gap-2">
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
      <ReviewsSection />
      <StoreSection />
      <NotFoundBand whatsapp={settings.shop_whatsapp} phone={settings.shop_phone} />
      <B2BBand whatsapp={settings.shop_whatsapp} />
    </>
  );
}
