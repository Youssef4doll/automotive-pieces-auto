import { prisma } from "@/lib/prisma";
import VehicleMakeManager, { type AdminMake } from "@/components/admin/VehicleMakeManager";
import CatalogTabs from "@/components/admin/CatalogTabs";

export const metadata = { title: "Véhicules" };

export default async function VehiclesAdminPage() {
  const rows = await prisma.vehicleMake.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      models: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          yearFrom: true,
          yearTo: true,
          engines: {
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              fuel: true,
              engineCode: true,
              powerHp: true,
              displacementCc: true,
              yearFrom: true,
              yearTo: true,
              _count: { select: { fitments: true } },
            },
          },
        },
      },
    },
  });

  const makes: AdminMake[] = rows.map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    logoUrl: m.logoUrl,
    models: m.models.map((mo) => ({
      id: mo.id,
      name: mo.name,
      slug: mo.slug,
      yearFrom: mo.yearFrom,
      yearTo: mo.yearTo,
      engines: mo.engines.map((e) => ({
        id: e.id,
        name: e.name,
        fuel: e.fuel,
        engineCode: e.engineCode,
        powerHp: e.powerHp,
        displacementCc: e.displacementCc,
        yearFrom: e.yearFrom,
        yearTo: e.yearTo,
        fitmentCount: e._count.fitments,
      })),
    })),
  }));

  const totals = makes.reduce(
    (t, m) => {
      t.models += m.models.length;
      for (const mo of m.models) t.engines += mo.engines.length;
      return t;
    },
    { models: 0, engines: 0 },
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">Véhicules</h1>
        <p className="text-sm text-gray-500 mt-1">
          {makes.length} marque(s) · {totals.models} modèle(s) · {totals.engines} motorisation(s). Le logo d&rsquo;une
          marque est réutilisé pour tous ses modèles sur la page d&rsquo;accueil ; les motorisations sont ce à quoi
          les pièces sont déclarées compatibles.
        </p>
      </div>
      <CatalogTabs />
      <VehicleMakeManager makes={makes} />
    </div>
  );
}
