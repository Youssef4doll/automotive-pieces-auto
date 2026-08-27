import Link from "next/link";
import { getMegaMenu } from "@/lib/data/catalog";
import { getSettings } from "@/lib/settings";
import SectionHeading from "./SectionHeading";
import Eyebrow from "./Eyebrow";
import T from "./T";
import { FamiliesFooter } from "./FamiliesFooter";

export default async function CategoryGrid() {
  const [families, settings] = await Promise.all([getMegaMenu(), getSettings()]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-6">
        <div>
          <Eyebrow k="families.eyebrow" />
          <SectionHeading
            k="families.title"
            className="text-2xl sm:text-3xl font-heading font-extrabold uppercase text-navy-950 tracking-tight"
          />
        </div>
        <p className="text-sm text-gray-500 max-w-md">
          <T k="families.subtitle" />
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {families.map((f) => (
          <Link
            key={f.id}
            href={`/catalogue/${f.slug}`}
            className="flex items-center justify-between gap-3 p-4 rounded-xl border border-gray-200 bg-white hover:border-navy-700 hover:shadow-md transition"
          >
            <div>
              <p className="text-sm font-heading font-bold uppercase text-navy-950">{f.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {f.children.length} <T k="families.subcats" />
              </p>
            </div>
            <span className="shrink-0 w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-red-500">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
          </Link>
        ))}
      </div>

      <FamiliesFooter whatsapp={settings.shop_whatsapp} />
    </section>
  );
}
