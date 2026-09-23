import { adminCategoryTree } from "@/lib/admin/categories";
import { ok, preflightWrite } from "../../_lib/respond";
import { ADMIN, asAdmin } from "../_lib/admin";

export const OPTIONS = preflightWrite;

export async function GET(request: Request) {
  return asAdmin(request, "categories", async () => ok(await adminCategoryTree(), ADMIN));
}
