import Hero from "@/components/Hero";
import FinderGrid from "@/components/FinderGrid";
import BrandMarquee from "@/components/BrandMarquee";
import CategoryGrid from "@/components/CategoryGrid";
import ProductGrid from "@/components/ProductGrid";
import WhyUs from "@/components/WhyUs";
import ReviewsSection from "@/components/ReviewsSection";
import StoreSection from "@/components/StoreSection";
import SectionHeading from "@/components/SectionHeading";
import { getTopSellers } from "@/lib/data/catalog";
import { getSettings } from "@/lib/settings";

export default async function HomePage() {
  const [topSellers, settings] = await Promise.all([getTopSellers(8), getSettings()]);

  return (
    <>
      <Hero />
      <FinderGrid whatsapp={settings.shop_whatsapp} />
      <BrandMarquee />
      <CategoryGrid />
      {topSellers.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-10">
          <SectionHeading k="home.bestsellers" />
          <ProductGrid products={topSellers} />
        </section>
      )}
      <WhyUs />
      <ReviewsSection />
      <StoreSection />
    </>
  );
}
