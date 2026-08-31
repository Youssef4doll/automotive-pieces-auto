import { getPacks } from "@/lib/data/catalog";
import SectionHeading from "./SectionHeading";
import Eyebrow from "./Eyebrow";
import T from "./T";
import PackCard from "./PackCard";

export default async function PacksSection() {
  // Three packs is a taste of the range, not the whole catalogue — the
  // section links onward for the rest.
  const packs = (await getPacks()).slice(0, 3);
  if (packs.length === 0) return null;

  return (
    <section id="packs" className="mx-auto max-w-7xl px-4 py-7 sm:py-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-6">
        <div>
          <Eyebrow k="packs.eyebrow" />
          <SectionHeading
            k="packs.title"
            className="text-xl sm:text-3xl font-heading font-extrabold uppercase text-navy-950 tracking-tight"
          />
        </div>
        <p className="text-sm text-gray-500 max-w-md">
          <T k="packs.subtitle" />
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {packs.map((pack) => (
          <PackCard key={pack.id} pack={pack} />
        ))}
      </div>
    </section>
  );
}
