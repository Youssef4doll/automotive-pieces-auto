import { prisma } from "@/lib/prisma";
import BrandManager, { type AdminBrand } from "@/components/admin/BrandManager";
import CatalogTabs from "@/components/admin/CatalogTabs";

export default async function BrandsAdminPage() {
  const rows = await prisma.brand.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      isPartsBrand: true,
      _count: { select: { products: true } },
    },
  });

  const brands: AdminBrand[] = rows.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    logoUrl: b.logoUrl,
    isPartsBrand: b.isPartsBrand,
    productCount: b._count.products,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">Marques</h1>
        <p className="text-sm text-gray-500 mt-1">
          Les marques proposées dans le formulaire produit et dans les filtres du catalogue.
        </p>
      </div>
      <CatalogTabs />
      <BrandManager brands={brands} />
    </div>
  );
}
