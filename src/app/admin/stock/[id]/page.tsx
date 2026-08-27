import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";
import ProductForm from "@/components/admin/ProductForm";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories, brands] = await Promise.all([
    prisma.product.findUnique({ where: { id } }),
    prisma.category.findMany({ where: { parentId: { not: null } }, include: { parent: true }, orderBy: { name: "asc" } }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!product) notFound();

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">Modifier — {product.name}</h1>
      <ProductForm
        product={{
          id: product.id,
          sku: product.sku,
          name: product.name,
          categoryId: product.categoryId,
          brandId: product.brandId,
          description: product.description,
          priceBuy: toNumber(product.priceBuy),
          priceSell: toNumber(product.priceSell),
          compareAtPrice: product.compareAtPrice ? toNumber(product.compareAtPrice) : null,
          stockQty: product.stockQty,
          lowStockThreshold: product.lowStockThreshold,
          isTopSeller: product.isTopSeller,
          active: product.active,
        }}
        categories={categories}
        brands={brands}
      />
    </div>
  );
}
