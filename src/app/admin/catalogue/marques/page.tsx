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
      legalName: true,
      street: true,
      postalCode: true,
      city: true,
      country: true,
      phone: true,
      email: true,
      website: true,
      _count: { select: { products: true } },
    },
  });

  const brands: AdminBrand[] = rows.map(({ _count, ...b }) => ({
    ...b,
    productCount: _count.products,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">Marques</h1>
        <p className="text-sm text-gray-500 mt-1">
          Les marques proposées dans le formulaire produit et dans les filtres du catalogue. Les
          coordonnées du fabricant que vous saisissez ici s&apos;affichent sur chaque fiche produit
          de la marque — laissez-les vides tant que vous ne les avez pas.
        </p>
      </div>
      <CatalogTabs />
      <BrandManager brands={brands} />
    </div>
  );
}
