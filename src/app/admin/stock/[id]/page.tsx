import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";
import ProductForm from "@/components/admin/ProductForm";
import ProductImageManager from "@/components/admin/ProductImageManager";
import FitmentEditor, { type FitMake } from "@/components/admin/FitmentEditor";
import ProductLinksEditor from "@/components/admin/ProductLinksEditor";
import PublishPanel from "@/components/admin/PublishPanel";
import { checksFor } from "@/app/actions/admin";
import { formatTND } from "@/lib/money";
import { formatOwnedReferenceList, groupOeReferences } from "@/lib/reference";

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nouveau?: string }>;
}) {
  const { id } = await params;
  const { nouveau } = await searchParams;
  const [product, categories, brands, makes] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { order: "asc" }, select: { id: true, alt: true } },
        references: { select: { type: true, brand: true, raw: true, normalized: true } },
        fitments: { where: { confidence: "VERIFIED" as const }, select: { engineId: true } },
        oldSlugs: { orderBy: { createdAt: "desc" }, select: { slug: true } },
        links: { orderBy: { order: "asc" }, select: { linked: { select: { id: true, name: true, sku: true, active: true } } } },
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
  const checks = await checksFor(product.id);
  const brandName = brands.find((b) => b.id === product.brandId)?.name ?? null;
  const family = await prisma.category.findUnique({ where: { id: product.categoryId }, select: { slug: true, parent: { select: { slug: true } } } });

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
        <PublishPanel
          productId={product.id}
          active={product.active}
          checks={checks}
          fresh={nouveau === "1"}
          preview={{
            name: product.name,
            brand: brandName,
            sku: product.sku,
            price: formatTND(toNumber(product.priceSell)),
            imageUrl: product.images[0] ? `/api/images/${product.images[0].id}` : `/api/part-art/${family?.parent?.slug ?? family?.slug ?? "freinage"}.svg`,
            illustration: product.images.length === 0,
          }}
        />
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

      <div className="rounded-xl border border-navy-900/10 bg-white p-4">
        <ProductLinksEditor productId={product.id} links={product.links.map((l) => l.linked)} />
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
          // Written back in the form the box accepts, grouped by carmaker, and
          // folding in the flat `oemRefs` array the seed and older imports
          // filled. What the admin sees is exactly what is stored, so a save
          // that only fixes a price cannot silently drop a reference nobody
          // showed them.
          oemRefsText: formatOwnedReferenceList(
            groupOeReferences(
              product.references.filter((r) => r.type === "OEM"),
              product.oemRefs,
            ).flatMap((g) => g.refs.map((r) => ({ owner: g.owner, raw: r.raw }))),
          ),
          aftermarketRefsText: product.references.filter((r) => r.type === "AFTERMARKET").map((r) => r.raw).join(", "),
          priceBuy: String(toNumber(product.priceBuy)),
          priceSell: String(toNumber(product.priceSell)),
          compareAtPrice: product.compareAtPrice ? String(toNumber(product.compareAtPrice)) : "",
          stockQty: String(product.stockQty),
          lowStockThreshold: String(product.lowStockThreshold),
          supply: product.supply,
          isTopSeller: product.isTopSeller,
          active: product.active,
        }}
        categories={categories}
        brands={brands}
      />
    </div>
  );
}
