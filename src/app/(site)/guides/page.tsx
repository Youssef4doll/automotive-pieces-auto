import Link from "next/link";
import type { Metadata } from "next";
import { listGuides } from "@/lib/data/guides";
import Breadcrumbs from "@/components/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import { pageMeta } from "@/lib/seo";
import { breadcrumbSchema, itemListSchema } from "@/lib/schema";

export const metadata: Metadata = pageMeta({
  title: "Guides d'entretien auto",
  description:
    "Comment savoir si vos plaquettes sont usées, quelle huile choisir, quand refaire la distribution. " +
    "Des repères concrets pour commander la bonne pièce du premier coup.",
  path: "/guides",
});

export default async function GuidesPage() {
  const guides = await listGuides();

  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: "Guides", path: "/guides" },
  ];

  return (
    <div className="w-full min-w-0 mx-auto max-w-7xl px-4 py-6">
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <JsonLd data={itemListSchema(guides.map((g) => ({ name: g.title, path: `/guides/${g.slug}` })))} />

      <div className="mb-3">
        <Breadcrumbs items={crumbs} />
      </div>

      <h1 className="text-xl sm:text-2xl font-heading font-extrabold uppercase text-navy-950 tracking-tight">
        Guides d&apos;entretien
      </h1>
      <p className="text-sm text-gray-600 mt-1 mb-6 max-w-prose">
        Les questions qu&apos;on nous pose au comptoir, répondues ici. Pas de chiffres inventés : quand un
        intervalle dépend de votre moteur, nous vous disons où le trouver plutôt que d&apos;en imprimer un
        qui serait faux pour votre voiture.
      </p>

      {guides.length === 0 ? (
        <p className="text-sm text-gray-500">Aucun guide publié pour le moment.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {guides.map((g) => (
            <Link
              key={g.slug}
              href={`/guides/${g.slug}`}
              className="block p-4 sm:p-5 rounded-xl border border-navy-900/12 bg-white hover:border-navy-900/35 transition-colors"
            >
              <p className="text-xs font-display font-bold uppercase tracking-wide text-red-600 mb-1.5">
                {g.question}
              </p>
              <h2 className="font-heading font-extrabold uppercase text-navy-950 tracking-tight">{g.title}</h2>
              <p className="text-sm text-gray-600 mt-1.5">{g.summary}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
