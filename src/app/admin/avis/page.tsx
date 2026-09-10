import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ReviewModeration from "@/components/admin/ReviewModeration";

export const metadata = { title: "Avis clients" };

/**
 * The moderation queue.
 *
 * Reviews are written by customers and are invisible on the storefront until
 * somebody here has read them. Waiting ones come first, because that is the
 * only part of this page that is a job rather than a record.
 *
 * Only customers who have taken delivery of the part can write one at all
 * (see actions/reviews.ts), so this queue is small by construction and is not
 * a spam bin — it is a shop reading what its customers said before putting it
 * on the page under its own name.
 */
export default async function AdminReviewsPage() {
  const reviews = await prisma.review.findMany({
    orderBy: [{ published: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      authorName: true,
      rating: true,
      comment: true,
      verified: true,
      published: true,
      createdAt: true,
      product: { select: { name: true, slug: true } },
    },
  });

  const waiting = reviews.filter((r) => !r.published).length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">Avis clients</h1>
        <p className="text-sm text-gray-500 mt-1">
          Un avis n&rsquo;apparaît sur la fiche produit qu&rsquo;une fois publié ici. Seuls les clients ayant
          reçu la pièce peuvent en écrire un.
        </p>
      </div>

      {waiting > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5">
          <p className="text-sm font-semibold text-amber-900">
            {waiting === 1 ? "1 avis attend d’être relu" : `${waiting} avis attendent d’être relus`}
          </p>
          <p className="text-sm text-amber-800 mt-1">
            Tant qu&rsquo;ils ne sont pas publiés, ils ne comptent pas dans la note affichée sur la fiche produit.
          </p>
        </div>
      )}

      {reviews.length === 0 ? (
        // Honest about why it is empty. "Aucun avis" alone reads as broken.
        <div className="rounded-xl border border-dashed border-gray-300 px-4 py-12 text-center">
          <p className="font-semibold text-navy-950">Aucun avis pour l&rsquo;instant</p>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Les avis arrivent des clients dont la commande est passée en <strong>Livrée</strong> : ils voient
            alors un formulaire sur la fiche de la pièce qu&rsquo;ils ont reçue.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {reviews.map((r) => (
            <li
              key={r.id}
              className={`rounded-xl border p-4 ${
                r.published ? "border-gray-200 bg-white" : "border-amber-300 bg-amber-50/40"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/produit/${r.product.slug}`}
                    className="font-semibold text-navy-950 hover:text-red-600"
                  >
                    {r.product.name}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {r.authorName}
                    {r.verified && <span className="text-green-700 ms-2">Achat vérifié</span>}
                    <span className="ms-2">{new Date(r.createdAt).toLocaleDateString("fr-FR")}</span>
                  </p>
                </div>
                <span className="text-gold-500 text-sm shrink-0">
                  {"★".repeat(r.rating)}
                  {"☆".repeat(5 - r.rating)}
                </span>
              </div>

              <p className="text-sm text-gray-700 mt-2.5 whitespace-pre-line">{r.comment}</p>

              <div className="mt-3">
                <ReviewModeration id={r.id} published={r.published} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
