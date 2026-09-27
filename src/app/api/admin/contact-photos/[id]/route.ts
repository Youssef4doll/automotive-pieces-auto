import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

/**
 * A photo a customer sent with a question, for the shop's inbox.
 *
 * Admin only, and never cached by anything shared: these are customers'
 * pictures, some of them taken in their own garage. The catalogue's public
 * /api/images route is deliberately not used for them.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return new NextResponse(null, { status: 404 });
  const { id } = await params;
  const photo = await prisma.contactPhoto.findUnique({ where: { id }, select: { data: true, mime: true } });
  if (!photo) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(photo.data), {
    headers: {
      "Content-Type": photo.mime,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
