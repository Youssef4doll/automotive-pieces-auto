import { prisma } from "@/lib/prisma";
import ProductForm from "@/components/admin/ProductForm";

export default async function NewProductPage() {
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({
      where: { parentId: { not: null } },
      include: { parent: true },
      orderBy: { name: "asc" },
    }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">Nouveau produit</h1>
      <ProductForm categories={categories} brands={brands} />
    </div>
  );
}
