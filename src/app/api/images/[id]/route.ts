import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Serves a product photo out of Postgres. The id is content-stable — editing a
// photo means uploading a new row with a new id — so the response can be
// cached hard and never revalidated.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const image = await prisma.productImage.findUnique({
    where: { id },
    select: { data: true, mimeType: true },
  });
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
  return new Response(body, {
    headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
