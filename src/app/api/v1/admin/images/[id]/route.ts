import { removeProductImage } from "@/lib/admin/products";
import { fail, ok, preflightWrite } from "../../../_lib/respond";
import { ADMIN, asAdmin } from "../../_lib/admin";

export const OPTIONS = preflightWrite;

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return asAdmin(request, "image DELETE", async () =>
    (await removeProductImage((await params).id)) ? ok({ ok: true }, ADMIN) : fail("not_found", ADMIN),
  );
}
