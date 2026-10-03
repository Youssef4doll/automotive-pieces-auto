import { adminForRequest } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { preflightWrite } from "../../../../../_lib/respond";

export const OPTIONS = preflightWrite;

/**
 * A photo a customer sent with a question, for the staff app — the twin of
 * admin/returns/photos: bearer only, no cookie (which is what lets it answer
 * any origin), never cached by anything shared.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  if (!(await adminForRequest(request))) return new Response(null, { status: 401, headers: CORS });
  const { id, photoId } = await params;
  const photo = await prisma.contactPhoto.findFirst({ where: { id: photoId, messageId: id }, select: { data: true, mime: true } });
  if (!photo) return new Response(null, { status: 404, headers: CORS });
  return new Response(Buffer.from(photo.data), {
    headers: {
      ...CORS,
      "Content-Type": photo.mime,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
