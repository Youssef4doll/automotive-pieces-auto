import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";
import ProductForm from "@/components/admin/ProductForm";
import ProductImageManager from "@/components/admin/ProductImageManager";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories, brands] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { order: "asc" }, select: { id: true, alt: true } },
        references: { select: { type: true, raw: true } },
      },
    }),
    prisma.category.findMany({ where: { parentId: { not: null } }, include: { parent: true }, orderBy: { name: "asc" } }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!product) notFound();

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">
        Modifier — {product.name}
      </h1>

      <div className="rounded-xl border border-navy-900/10 bg-white p-4">
        <ProductImageManager productId={product.id} images={product.images} fallbackUrl={product.imageUrl} />
      </div>

      <ProductForm
        product={{
          id: product.id,
          sku: product.sku,
          name: product.name,
          categoryId: product.categoryId,
          brandId: product.brandId,
          description: product.description,
          imageUrl: product.imageUrl,
          axle: product.axle,
          side: product.side,
          oemRefsText: product.references.filter((r) => r.type === "OEM").map((r) => r.raw).join(", "),
          aftermarketRefsText: product.references.filter((r) => r.type === "AFTERMARKET").map((r) => r.raw).join(", "),
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
