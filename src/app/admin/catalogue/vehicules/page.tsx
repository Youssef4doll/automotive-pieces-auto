import { prisma } from "@/lib/prisma";
import VehicleMakeManager, { type AdminMake } from "@/components/admin/VehicleMakeManager";
import CatalogTabs from "@/components/admin/CatalogTabs";

export const metadata = { title: "Véhicules" };

export default async function VehiclesAdminPage() {
  const rows = await prisma.vehicleMake.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, logoUrl: true, _count: { select: { models: true } } },
  });

  const makes: AdminMake[] = rows.map((m) => ({
    id: m.id,
    name: m.name,
    logoUrl: m.logoUrl,
    modelCount: m._count.models,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">Véhicules</h1>
        <p className="text-sm text-gray-500 mt-1">
          Un logo par marque, réutilisé pour tous ses modèles dans « Les véhicules que nous couvrons » sur
          la page d&rsquo;accueil.
        </p>
      </div>
      <CatalogTabs />
      <VehicleMakeManager makes={makes} />
    </div>
  );
}
