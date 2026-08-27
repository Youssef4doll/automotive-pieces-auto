import { getPartsBrands } from "@/lib/data/catalog";
import { Heading } from "./FooterClient";

export default async function BrandMarquee() {
  const brands = await getPartsBrands();

  return (
    <section id="marques" className="bg-navy-900 py-8">
      <div className="mx-auto max-w-7xl px-4 mb-4">
        <Heading k="home.brands" />
      </div>
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {brands.map((b) => (
            <div
              key={b.id}
              className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-white/25 bg-white/5 px-2 py-4"
            >
              <span className="w-9 h-9 rounded-md bg-white/10 flex items-center justify-center text-white/40">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
              </span>
              <span className="text-white/85 font-display font-bold uppercase text-xs sm:text-sm text-center">
                {b.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
