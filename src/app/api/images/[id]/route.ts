import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { VECTOR_IMAGE_TYPE } from "@/lib/image-upload";

// Serves an uploaded picture out of Postgres — a product photo, a category
// icon, a brand logo, or banner artwork stored as a MediaAsset. The id is
// content-stable — replacing a picture means uploading a new row with a new id
// — so the response can be cached hard and never revalidated.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;

  // A vector is stored at `<id>.svg` so that next/image can tell from the URL
  // alone to serve it as-is rather than sending it to the optimiser, which
  // refuses SVG. The suffix is addressing, not identity, so it comes off
  // before the lookup and an id resolves the same either way.
  const id = raw.replace(/\.svg$/i, "");

  // Ids come from the same cuid space, so one lookup can miss without meaning
  // the picture is gone; both tables are checked before giving up.
  const image =
    (await prisma.productImage.findUnique({ where: { id }, select: { data: true, mimeType: true } })) ??
    (await prisma.mediaAsset.findUnique({ where: { id }, select: { data: true, mimeType: true } }));
  // Past orders and saved carts hold the photo URL they were placed with, so a
  // photo the admin later deletes must degrade to the generic part picture
  // rather than leaving a broken thumbnail in someone's order history.
  if (!image) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/images/parts-lineup.png", "Cache-Control": "no-store" },
    });
  }

  const body = new Uint8Array(image.data);
  const headers: Record<string, string> = {
    "Content-Type": image.mimeType,
    "Content-Length": String(body.byteLength),
    "Cache-Control": "public, max-age=31536000, immutable",
  };

  // An SVG loaded through <img> is inert by browser rule, but the same URL
  // typed into the address bar is a document on this origin, and a document
  // can run script. Everything stored here is sanitised on the way in; this is
  // the second lock, so a file that ever gets past the first one still cannot
  // execute, load anything, or navigate. Inline styles stay allowed because
  // that is how an icon carries its own colours.
  //
  // (This route is excluded from the proxy matcher, so it gets no policy
  // unless it sets one here.)
  if (image.mimeType === VECTOR_IMAGE_TYPE) {
    headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
  }

  return new Response(body, { headers });
}
