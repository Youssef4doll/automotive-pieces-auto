import { adminForRequest } from "@/lib/admin-session";
import { returnPhoto } from "@/lib/returns";
import { preflightWrite } from "../../../../_lib/respond";

export const OPTIONS = preflightWrite;

/**
 * A customer's photo of a returned part, for the staff app. Bearer only, like
 * every /api/v1/admin route — it reads no cookie, which is what lets it answer
 * any origin (see WRITE_CORS in respond.ts) — and never cached by anything
 * shared. The app fetches it with the session and shows the bytes.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await adminForRequest(request))) return new Response(null, { status: 401, headers: CORS });
  const photo = await returnPhoto((await params).id);
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
