import { setCategoryImage } from "@/lib/admin/categories";
import { MAX_IMAGE_BYTES } from "@/lib/image-upload";
import { fail, ok, preflightWrite } from "../../../../_lib/respond";
import { ADMIN, asAdmin } from "../../../_lib/admin";

export const OPTIONS = preflightWrite;

/** multipart/form-data with one `file`: replaces the family's picture. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return asAdmin(request, "category image", async () => {
    if (Number(request.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES + 64_000) {
      return fail("invalid_field", ADMIN, undefined, { field: "file", reason: "bad_file" });
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail("bad_request", ADMIN);
    }
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return fail("invalid_field", ADMIN, undefined, { field: "file", reason: "no_file" });
    const result = await setCategoryImage((await params).id, file);
    if (!result.ok) {
      return result.code === "not_found"
        ? fail("not_found", ADMIN)
        : fail("invalid_field", ADMIN, undefined, { field: "file", reason: "bad_file" });
    }
    return ok({ imageUrl: result.imageUrl }, ADMIN);
  });
}

/** Back to the drawn icon. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return asAdmin(request, "category image DELETE", async () => {
    const result = await setCategoryImage((await params).id, null);
    return result.ok ? ok({ imageUrl: null }, ADMIN) : fail("not_found", ADMIN);
  });
}
