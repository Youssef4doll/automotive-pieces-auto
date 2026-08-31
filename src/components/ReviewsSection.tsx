import { getRecentReviews } from "@/lib/data/catalog";
import SectionHeading from "./SectionHeading";

export default async function ReviewsSection() {
  const reviews = (await getRecentReviews()).slice(0, 3);
  if (reviews.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-7 sm:py-10">
      <SectionHeading
        k="reviews.title"
        className="text-xl sm:text-3xl font-heading font-extrabold uppercase text-navy-950 tracking-tight mb-6"
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {reviews.map((r) => (
          <div key={r.id} className="p-5 rounded-xl bg-gray-50">
            <div className="flex text-gold-500 text-sm mb-2">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
            <p className="text-sm text-gray-700 mb-3">{r.comment}</p>
            <p className="text-xs font-semibold text-gray-500">{r.authorName}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
