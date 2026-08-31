import { prisma } from "@/lib/prisma";
import PromotionForm from "@/components/admin/PromotionForm";
import PromotionCard from "@/components/admin/PromotionCard";

export const metadata = { title: "Bannières" };

const SURFACES = [
  {
    placement: "CAMPAIGN" as const,
    title: "Carrousel de campagnes",
    blurb:
      "La bande large au milieu de la page d'accueil : campagnes de saison, nouveautés, bons plans. " +
      "Les bannières défilent dans l'ordre ci-dessous. Sans bannière active, la bande n'apparaît pas du tout.",
  },
  {
    placement: "HERO" as const,
    title: "Bandeau du haut",
    blurb:
      "La grille tout en haut de la page d'accueil. La première bannière occupe toute la largeur, " +
      "les suivantes se rangent sur deux colonnes.",
  },
];

export default async function AdminPromotionsPage() {
  const promotions = await prisma.promotion.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">
          Bannières
        </h1>
        <p className="text-sm text-navy-900/50 mt-1">
          Les images promotionnelles de la page d&rsquo;accueil. Tout se change ici, sans mise en
          ligne : téléversez une image, choisissez l&rsquo;emplacement, désactivez une bannière pour
          la retirer sans la supprimer.
        </p>
      </div>

      <div className="rounded-xl border border-navy-900/10 bg-white shadow-sm p-5">
        <h2 className="font-display font-bold uppercase tracking-wide text-sm text-navy-950 mb-4">
          Ajouter une bannière
        </h2>
        <PromotionForm />
      </div>

      {SURFACES.map((surface) => {
        const rows = promotions.filter((p) => p.placement === surface.placement);
        return (
          <section key={surface.placement} className="flex flex-col gap-3">
            <div>
              <h2 className="font-display font-bold uppercase tracking-wide text-sm text-navy-950">
                {surface.title}
                <span className="ms-2 font-sans font-semibold text-navy-900/35 normal-case tracking-normal">
                  {rows.length}
                </span>
              </h2>
              <p className="text-xs text-navy-900/45 mt-1 max-w-2xl">{surface.blurb}</p>
            </div>

            {rows.length === 0 ? (
              <p className="text-sm text-navy-900/40 rounded-xl border border-dashed border-navy-900/15 px-4 py-6 text-center">
                Aucune bannière ici pour le moment.
              </p>
            ) : (
              rows.map((p, i) => (
                <PromotionCard
                  key={p.id}
                  promo={{
                    id: p.id,
                    title: p.title,
                    imageUrl: p.imageUrl,
                    href: p.href,
                    placement: p.placement,
                    kind: p.kind,
                    order: p.order,
                    active: p.active,
                  }}
                  isFirst={i === 0}
                  isLast={i === rows.length - 1}
                />
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}
