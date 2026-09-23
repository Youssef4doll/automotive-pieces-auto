import { addProductImages, adminProductDetail, MAX_PHOTOS_PER_PRODUCT } from "@/lib/admin/products";
import { MAX_IMAGE_BYTES } from "@/lib/image-upload";
import { fail, ok, preflightWrite } from "../../../../_lib/respond";
import { ADMIN, asAdmin } from "../../../_lib/admin";

export const OPTIONS = preflightWrite;

/**
 * multipart/form-data, one or more `files`. The bytes are checked for what
 * they are (lib/image-upload), not for what their name or type claims.
 *
 * Refusals carry a machine reason, never a sentence — the app writes its own
 * in three languages: `full` (eight already), `too_many` (+ `room`),
 * `bad_file` (not a JPEG/PNG/WebP/AVIF, or over 4 MB).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return asAdmin(request, "product images", async () => {
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_IMAGE_BYTES * MAX_PHOTOS_PER_PRODUCT + 64_000) {
      return fail("invalid_field", ADMIN, undefined, { field: "files", reason: "bad_file" });
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail("bad_request", ADMIN);
    }
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    const { id } = await params;
    const result = await addProductImages(id, files);
    if (!result.ok) {
      if (result.code === "not_found") return fail("not_found", ADMIN);
      return fail("invalid_field", ADMIN, undefined, {
        field: "files",
        reason: result.code,
        ...(result.room !== undefined ? { room: String(result.room) } : {}),
      });
    }
    return ok(await adminProductDetail(id), ADMIN);
  });
}
