import { makePrimaryImage } from "@/lib/admin/products";
import { fail, ok, preflightWrite } from "../../../../_lib/respond";
import { ADMIN, asAdmin } from "../../../_lib/admin";

export const OPTIONS = preflightWrite;

/** Make this the photo shown on cards, in the basket and in search. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return asAdmin(request, "image primary", async () =>
    (await makePrimaryImage((await params).id)) ? ok({ ok: true }, ADMIN) : fail("not_found", ADMIN),
  );
}
