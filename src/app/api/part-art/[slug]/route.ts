import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { partArtSvg } from "@/lib/part-art";

/**
 * The illustrated drawing for a part family (lib/part-art), as a standalone
 * SVG — the picture the app shows on a category tile, a family page and a
 * part nobody has photographed yet. Same resolution rule as /api/part-icon:
 * a subcategory borrows its family's drawing, an unknown slug gets the
 * generic part. Same lockdown headers too.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug.replace(/\.svg$/i, "");
  const category = await prisma.category.findUnique({
    where: { slug },
    select: { slug: true, parent: { select: { slug: true } } },
  });
  const familySlug = category?.parent?.slug ?? category?.slug ?? null;
  return new Response(partArtSvg(familySlug), {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "public, max-age=86400",
      // The app's web build reads these from another origin.
      "Access-Control-Allow-Origin": "*",
    },
  });
}
