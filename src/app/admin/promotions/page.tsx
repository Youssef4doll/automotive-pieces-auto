import Image from "next/image";
import { prisma } from "@/lib/prisma";
import PromotionForm from "@/components/admin/PromotionForm";
import PromotionRow from "@/components/admin/PromotionRow";

export const metadata = { title: "Promotions" };

export default async function AdminPromotionsPage() {
  const promotions = await prisma.promotion.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">
          Promotions
        </h1>
        <p className="text-sm text-navy-900/50 mt-1">
          Les bannières affichées en haut de la page d&rsquo;accueil. Le carrousel suit l&rsquo;ordre
          ci-dessous ; désactivez une bannière pour la retirer sans la supprimer.
        </p>
      </div>

      <div className="rounded-xl border border-navy-900/10 bg-white shadow-sm p-5">
        <h2 className="font-display font-bold uppercase tracking-wide text-sm text-navy-950 mb-4">
          Ajouter une bannière
        </h2>
        <PromotionForm />
      </div>

      <div className="flex flex-col gap-3">
        {promotions.length === 0 && (
          <p className="text-sm text-navy-900/40">Aucune bannière pour le moment.</p>
        )}
        {promotions.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-navy-900/10 bg-white shadow-sm p-3 flex items-center gap-4"
          >
            <div className="relative w-32 h-16 shrink-0 rounded-lg overflow-hidden bg-gray-100">
              <Image src={p.imageUrl} alt="" fill sizes="128px" className="object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-navy-950 truncate">{p.title}</p>
              <p className="text-xs text-navy-900/45 truncate">
                #{p.order} · {p.href || "sans lien"}
              </p>
            </div>
            <PromotionRow id={p.id} active={p.active} />
          </div>
        ))}
      </div>
    </div>
  );
}
