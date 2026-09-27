import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Avis clients" };

/**
 * What customers said about delivered orders, newest first — from the app's
 * rating card. For the shop only: nothing here is published anywhere. The
 * average is shown only once there are five ratings, because the mean of two
 * is a mood, not a measure.
 */
export default async function AdminReviewsPage() {
  const [reviews, agg] = await Promise.all([
    prisma.orderReview.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        stars: true,
        comment: true,
        updatedAt: true,
        order: { select: { id: true, ref: true, customerName: true, items: { select: { name: true }, take: 1, orderBy: { id: "asc" } } } },
      },
    }),
    prisma.orderReview.aggregate({ _avg: { stars: true }, _count: { _all: true } }),
  ]);
  const count = agg._count._all;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">Avis clients</h1>
        <p className="text-sm text-navy-900/50 mt-1">
          Les notes laissées dans l&rsquo;application après une livraison. Visibles ici uniquement.
          {count >= 5 && agg._avg.stars != null && (
            <span className="ms-1 font-semibold text-navy-950">
              Moyenne {agg._avg.stars.toFixed(1).replace(".", ",")} / 5 sur {count} avis.
            </span>
          )}
        </p>
      </div>
      {reviews.length === 0 ? (
        <p className="text-sm text-navy-900/50">Aucun avis pour l&rsquo;instant.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-xl border border-navy-900/10 bg-white p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gold-500 tracking-widest" aria-label={`${r.stars} sur 5`}>
                  {"★".repeat(r.stars)}
                  <span className="text-navy-900/15">{"★".repeat(5 - r.stars)}</span>
                </span>
                <span className="text-xs text-navy-900/40">{r.updatedAt.toLocaleDateString("fr-FR")}</span>
              </div>
              {r.comment && <p className="text-sm text-navy-900/80">« {r.comment} »</p>}
              <Link href={`/admin/commandes/${r.order.id}`} className="text-xs text-navy-900/50 hover:text-red-500">
                {r.order.customerName} · {r.order.items[0]?.name ?? r.order.ref} · <span className="font-mono">{r.order.ref}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
