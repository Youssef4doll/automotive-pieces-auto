import { getMegaMenu } from "@/lib/data/catalog";
import { getSettings, publicContact } from "@/lib/settings";
import { requireAdmin } from "@/lib/session";
import SectionHeading from "./SectionHeading";
import Eyebrow from "./Eyebrow";
import T from "./T";
import { FamiliesFooter } from "./FamiliesFooter";
import FamiliesTabs from "./FamiliesTabs";

export default async function CategoryGrid() {
  // An admin sees the whole catalogue, empty families included, so that adding
  // one is visibly something that happened. A shopper sees only what has parts
  // behind it. Same component, same page, two audiences.
  const admin = await requireAdmin();
  const [families, settings] = await Promise.all([getMegaMenu(!!admin), getSettings()]);
  const familiesForTabs = families.map((f) => ({
    slug: f.slug,
    name: f.name,
    imageUrl: f.imageUrl,
    productCount: f.productCount,
    children: f.children.map((c) => ({ slug: c.slug, name: c.name, imageUrl: c.imageUrl, count: c._count.products })),
  }));

  return (
    <section id="symptomes" className="mx-auto shell-w px-4 py-7 sm:py-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-6">
        <div>
          <Eyebrow k="families.eyebrow" />
          <SectionHeading
            k="families.title"
            className="text-xl sm:text-3xl font-heading font-extrabold uppercase text-navy-950 tracking-tight"
          />
        </div>
        <p className="text-sm text-gray-500 max-w-md">
          <T k="families.subtitle" />
        </p>
      </div>

      <FamiliesTabs families={familiesForTabs} admin={!!admin} />

      <FamiliesFooter whatsapp={publicContact(settings).whatsapp} />
    </section>
  );
}
