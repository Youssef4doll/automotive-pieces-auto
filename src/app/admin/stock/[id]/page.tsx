import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";
import ProductForm from "@/components/admin/ProductForm";
import ProductImageManager from "@/components/admin/ProductImageManager";
import FitmentEditor, { type FitMake } from "@/components/admin/FitmentEditor";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories, brands, makes] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { order: "asc" }, select: { id: true, alt: true } },
        references: { select: { type: true, raw: true } },
        fitments: { select: { engineId: true } },
        oldSlugs: { orderBy: { createdAt: "desc" }, select: { slug: true } },
      },
    }),
    prisma.category.findMany({ where: { parentId: { not: null } }, include: { parent: true }, orderBy: { name: "asc" } }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.vehicleMake.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        models: {
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            yearFrom: true,
            yearTo: true,
            engines: {
              orderBy: { name: "asc" },
              select: { id: true, name: true, fuel: true, engineCode: true },
            },
          },
        },
      },
    }),
  ]);
  if (!product) notFound();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">
          Modifier — {product.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Ajouté le{" "}
          {new Date(product.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          {" · "}adresse publique <code className="text-navy-900">/produit/{product.slug}</code>
        </p>
        {product.oldSlugs.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            Anciennes adresses redirigées : {product.oldSlugs.map((s) => s.slug).join(", ")}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-navy-900/10 bg-white p-4">
        <ProductImageManager productId={product.id} images={product.images} fallbackUrl={product.imageUrl} />
      </div>

      <div className="rounded-xl border border-navy-900/10 bg-white p-4">
        <FitmentEditor
          productId={product.id}
          makes={makes as FitMake[]}
          initialEngineIds={product.fitments.map((f) => f.engineId)}
        />
      </div>

      <ProductForm
        product={{
          id: product.id,
          sku: product.sku,
          name: product.name,
          categoryId: product.categoryId,
          brandId: product.brandId ?? "",
          description: product.description,
          imageUrl: product.imageUrl,
          axle: product.axle ?? "",
          side: product.side ?? "",
          oemRefsText: product.references.filter((r) => r.type === "OEM").map((r) => r.raw).join(", "),
          aftermarketRefsText: product.references.filter((r) => r.type === "AFTERMARKET").map((r) => r.raw).join(", "),
          priceBuy: String(toNumber(product.priceBuy)),
          priceSell: String(toNumber(product.priceSell)),
          compareAtPrice: product.compareAtPrice ? String(toNumber(product.compareAtPrice)) : "",
          stockQty: String(product.stockQty),
          lowStockThreshold: String(product.lowStockThreshold),
          isTopSeller: product.isTopSeller,
          active: product.active,
        }}
        categories={categories}
        brands={brands}
      />
    </div>
  );
}
