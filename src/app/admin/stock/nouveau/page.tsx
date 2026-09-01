import { prisma } from "@/lib/prisma";
import ProductForm from "@/components/admin/ProductForm";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>;
}) {
  // Arrives from the unmet-demand list on /admin/analytics, carrying what the
  // customer actually typed.
  const { name } = await searchParams;

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
      {name && (
        <p className="text-sm text-navy-900/55 -mt-3">
          Créé depuis une recherche client restée sans résultat : «&nbsp;{name}&nbsp;».
        </p>
      )}
      <ProductForm categories={categories} brands={brands} suggestedName={name?.slice(0, 120)} />
    </div>
  );
}
