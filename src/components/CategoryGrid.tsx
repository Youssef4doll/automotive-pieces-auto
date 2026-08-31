import { getMegaMenu } from "@/lib/data/catalog";
import { getSettings, publicContact } from "@/lib/settings";
import SectionHeading from "./SectionHeading";
import Eyebrow from "./Eyebrow";
import T from "./T";
import { FamiliesFooter } from "./FamiliesFooter";
import FamiliesTabs from "./FamiliesTabs";

export default async function CategoryGrid() {
  const [families, settings] = await Promise.all([getMegaMenu(), getSettings()]);
  const familiesForTabs = families.map((f) => ({
    slug: f.slug,
    name: f.name,
    children: f.children.map((c) => ({ slug: c.slug, name: c.name })),
  }));

  return (
    <section id="symptomes" className="mx-auto max-w-7xl px-4 py-10">
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

      <FamiliesTabs families={familiesForTabs} />

      <FamiliesFooter whatsapp={publicContact(settings).whatsapp} />
    </section>
  );
}
