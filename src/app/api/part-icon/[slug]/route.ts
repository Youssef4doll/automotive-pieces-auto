import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { partIconMarkup } from "@/lib/part-icons";

/**
 * The picture for a part nobody has photographed yet.
 *
 * Every product in the catalogue shipped pointing at /images/parts-lineup.png
 * — the hero artwork, a bottle of engine oil and an air filter. So a brake
 * disc's page showed engine oil, and a search for "plaquette" returned four
 * brake-pad results all illustrated with the same oil bottle. That is worse
 * than no picture: it is a wrong one, and it reads as a shop that does not
 * know what it sells.
 *
 * This serves the drawing for the part's own family instead — a brake pad gets
 * a brake disc, a filter gets a filter. It says "no photograph yet" honestly
 * while still telling the shopper what kind of thing they are looking at, and
 * it disappears the moment a real photo is uploaded.
 *
 * The slug is a category's, and a subcategory carries no drawing of its own,
 * so it resolves up to its family first.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await params;
  const slug = raw.replace(/\.svg$/i, "");

  const category = await prisma.category.findUnique({
    where: { slug },
    select: { slug: true, parent: { select: { slug: true } } },
  });
  // A subcategory borrows its family's drawing; an unknown slug gets the
  // generic part outline rather than nothing.
  const familySlug = category?.parent?.slug ?? category?.slug ?? null;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="Photo à venir">
<rect width="96" height="96" fill="#f8fafc"/>
<g transform="translate(24 24) scale(2)" fill="none" stroke="#94a3b8" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">${partIconMarkup(familySlug)}</g>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      // Same lockdown the uploaded-image route carries: this is a document on
      // our own origin when opened directly, and it costs nothing to say it
      // may do nothing but draw.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      // Derived from a slug and a constant, so it never goes stale for a given
      // address — a category renamed to a new slug is a new address.
      "Cache-Control": "public, max-age=86400",
    },
  });
}
