import { listAdminProducts, type StockFilter } from "@/lib/admin/products";
import { ok, preflightWrite } from "../../_lib/respond";
import { ADMIN, asAdmin } from "../_lib/admin";

export const OPTIONS = preflightWrite;

const FILTERS: StockFilter[] = ["", "rupture", "bas", "sansphoto", "inactif"];

/** ?q=&f=rupture|bas|sansphoto|inactif&cursor= — the website's stock filters. */
export async function GET(request: Request) {
  return asAdmin(request, "products", async () => {
    const url = new URL(request.url);
    const rawF = url.searchParams.get("f") ?? "";
    const f = (FILTERS as string[]).includes(rawF) ? (rawF as StockFilter) : "";
    const q = url.searchParams.get("q")?.trim().slice(0, 80) || undefined;
    const cursor = url.searchParams.get("cursor") || undefined;
    return ok(await listAdminProducts({ q, f, cursor }), ADMIN);
  });
}
