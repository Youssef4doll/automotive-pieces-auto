import { getPartsBrands } from "@/lib/data/catalog";
import { Heading } from "./FooterClient";

export default async function BrandMarquee() {
  const brands = await getPartsBrands();
  const loop = [...brands, ...brands];

  return (
    <section id="marques" className="bg-navy-900 py-8 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 mb-4 text-center">
        <Heading k="home.brands" />
      </div>
      <div className="overflow-hidden">
        <div className="flex gap-4 w-max marquee-track">
          {loop.map((b, i) => (
            <div
              key={`${b.id}-${i}`}
              className="shrink-0 w-32 h-16 bg-white rounded-lg flex items-center justify-center text-navy-900 font-extrabold text-sm px-3 shadow"
            >
              {b.name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
