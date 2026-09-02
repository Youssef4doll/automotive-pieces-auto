import { prisma } from "@/lib/prisma";
import CategoryManager, { type AdminCategory } from "@/components/admin/CategoryManager";
import CatalogTabs from "@/components/admin/CatalogTabs";

export default async function CatalogueAdminPage() {
  const rows = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { order: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      order: true,
      imageUrl: true,
      _count: { select: { products: true } },
      children: {
        orderBy: { order: "asc" },
        select: { id: true, name: true, slug: true, order: true, imageUrl: true, _count: { select: { products: true } } },
      },
    },
  });

  const families: AdminCategory[] = rows.map((f) => ({
    id: f.id,
    name: f.name,
    slug: f.slug,
    order: f.order,
    imageUrl: f.imageUrl,
    productCount: f._count.products,
    children: f.children.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      order: c.order,
      imageUrl: c.imageUrl,
      productCount: c._count.products,
    })),
  }));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">Catalogue</h1>
        <p className="text-sm text-gray-500 mt-1">
          Les familles et sous-catégories d&apos;ici pilotent le menu, le pied de page et les pages /catalogue du site.
          Toute modification est enregistrée en base et visible immédiatement en ligne.
        </p>
      </div>
      <CatalogTabs />
      <CategoryManager families={families} />
    </div>
  );
}
