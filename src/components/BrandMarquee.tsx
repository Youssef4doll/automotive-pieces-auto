import { getPartsBrands } from "@/lib/data/catalog";
import T from "./T";

export default async function BrandMarquee() {
  const brands = await getPartsBrands();
  const track = [...brands, ...brands];

  return (
    <section id="marques" className="bg-navy-950 py-6 overflow-hidden border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 flex items-center gap-3.5 mb-4">
        <span className="font-display font-bold uppercase text-[12px] tracking-[0.16em] text-gold-500 whitespace-nowrap">
          <T k="home.brands" />
        </span>
        <span className="flex-1 h-px bg-white/15" />
        <span className="text-sm text-white/55 whitespace-nowrap">
          <T k="home.brandsSub" />
        </span>
      </div>
      <div className="flex w-max marquee-track">
        {track.map((b, i) => (
          <div
            key={`${b.id}-${i}`}
            className="shrink-0 mx-[7px] w-[180px] h-[82px] px-3.5 py-2.5 rounded-lg border border-white/15 bg-white flex items-center justify-center"
          >
            <span className="text-navy-900/70 font-display font-bold uppercase text-sm text-center leading-tight">
              {b.name}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
