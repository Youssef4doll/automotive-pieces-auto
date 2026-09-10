import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getGuide, getGuideFamily, listGuides } from "@/lib/data/guides";
import { getProductsForCategory, getCategoryBySlug } from "@/lib/data/catalog";
import ProductGrid from "@/components/ProductGrid";
import Breadcrumbs from "@/components/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import { pageMeta, clampDescription, SITE_NAME } from "@/lib/seo";
import { breadcrumbSchema } from "@/lib/schema";
import { siteUrl } from "@/lib/site";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) return { title: "Guide introuvable" };

  return pageMeta({
    title: guide.title,
    description: clampDescription(guide.summary),
    path: `/guides/${guide.slug}`,
    type: "article",
  });
}

export default async function GuidePage({ params }: { params: Params }) {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) notFound();

  const family = await getGuideFamily(guide.familySlug);
  const category = family ? await getCategoryBySlug(family.slug) : null;
  // The guide ends where the shop can serve the reader. A handful of real
  // parts, not a catalogue dump — the point is to make the next step obvious.
  const products = category ? (await getProductsForCategory(category.id, { includeDescendants: true })).slice(0, 4) : [];

  const others = (await listGuides()).filter((g) => g.slug !== guide.slug);
  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: "Guides", path: "/guides" },
    { name: guide.title, path: `/guides/${guide.slug}` },
  ];

  return (
    <div className="w-full min-w-0 mx-auto max-w-7xl px-4 py-6">
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: guide.title,
          description: guide.summary,
          author: { "@type": "Organization", name: SITE_NAME },
          publisher: { "@type": "Organization", name: SITE_NAME },
          mainEntityOfPage: `${siteUrl()}/guides/${guide.slug}`,
        }}
      />

      <div className="mb-3">
        <Breadcrumbs items={crumbs} />
      </div>

      <article className="max-w-prose">
        <p className="text-xs font-display font-bold uppercase tracking-wide text-red-600 mb-1.5">
          {guide.question}
        </p>
        <h1 className="text-xl sm:text-2xl font-heading font-extrabold uppercase text-navy-950 tracking-tight">
          {guide.title}
        </h1>
        <p className="text-base text-gray-700 mt-3">{guide.summary}</p>

        {guide.sections.map((s) => (
          <section key={s.heading} className="mt-7">
            <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950 text-lg mb-2">
              {s.heading}
            </h2>
            {s.body.map((paragraph) => (
              <p key={paragraph.slice(0, 32)} className="text-[15px] leading-relaxed text-gray-700 mb-3">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </article>

      {products.length > 0 && family && (
        <section className="mt-10 pt-6 border-t border-gray-200">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950 text-lg">
              {family.name} en stock
            </h2>
            <Link
              href={`/catalogue/${family.slug}`}
              className="text-sm font-semibold text-navy-600 hover:text-red-600 underline underline-offset-2"
            >
              Voir toute la famille →
            </Link>
          </div>
          <ProductGrid products={products} />
          <p className="text-sm text-gray-500 mt-4">
            Indiquez votre véhicule et nous ne montrons que les références compatibles —{" "}
            <Link href="/compte/garage" className="text-navy-600 hover:text-red-600 underline underline-offset-2">
              choisir ma voiture
            </Link>
            .
          </p>
        </section>
      )}

      {others.length > 0 && (
        <section className="mt-10 pt-6 border-t border-gray-200">
          <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950 text-lg mb-3">
            Autres guides
          </h2>
          <div className="flex flex-wrap gap-2">
            {others.map((g) => (
              <Link
                key={g.slug}
                href={`/guides/${g.slug}`}
                className="inline-flex items-center min-h-tap-compact px-3 rounded-full border border-gray-300 bg-white text-sm text-gray-700 hover:border-navy-300"
              >
                {g.title}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
