import { getRecentReviews } from "@/lib/data/catalog";
import SectionHeading from "./SectionHeading";

export default async function ReviewsSection() {
  const reviews = await getRecentReviews();
  if (reviews.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <SectionHeading k="reviews.title" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {reviews.map((r) => (
          <div key={r.id} className="p-4 rounded-xl border border-gray-200 bg-white">
            <div className="flex text-gold-500 text-sm mb-2">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
            <p className="text-sm text-gray-700 mb-3">&ldquo;{r.comment}&rdquo;</p>
            <p className="text-xs font-semibold text-navy-900">
              {r.authorName} {r.verified && <span className="text-green-600">· ✓ Achat vérifié</span>}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
