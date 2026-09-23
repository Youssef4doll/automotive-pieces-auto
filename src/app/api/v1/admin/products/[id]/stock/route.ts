import { z } from "zod";
import { adjustProductStock, adminProductDetail, setProductStock } from "@/lib/admin/products";
import { prisma } from "@/lib/prisma";
import { fail, ok, preflightWrite, readJson } from "../../../../_lib/respond";
import { ADMIN, asAdmin } from "../../../_lib/admin";

export const OPTIONS = preflightWrite;

/**
 * { set: 12 }     "I counted twelve on the shelf"
 * { change: +5 }  "five came in" / { change: -1 } "one was damaged"
 * Either way a StockMovement records the difference, as on the website.
 */
const body = z.union([
  z.object({ set: z.number().int().min(0).max(1_000_000), note: z.string().trim().max(200).optional() }).strict(),
  z.object({ change: z.number().int().min(-100_000).max(100_000).refine((n) => n !== 0), note: z.string().trim().max(200).optional() }).strict(),
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return asAdmin(request, "product stock", async () => {
    const parsed = body.safeParse(await readJson(request, 1_024));
    if (!parsed.success) return fail("invalid_field", ADMIN, undefined, { field: "stock" });
    const { id } = await params;
    if ("set" in parsed.data) {
      if (!(await setProductStock(id, parsed.data.set, parsed.data.note || undefined))) return fail("not_found", ADMIN);
    } else {
      const current = await prisma.product.findUnique({ where: { id }, select: { stockQty: true } });
      if (!current) return fail("not_found", ADMIN);
      // A decrease may not take the shelf below zero. (Stock can already be
      // below zero from sales made on order; adding to it is always allowed.)
      if (parsed.data.change < 0 && current.stockQty + parsed.data.change < 0) {
        return fail("invalid_field", ADMIN, undefined, { field: "stock" });
      }
      await adjustProductStock(id, parsed.data.change, parsed.data.note || undefined);
    }
    return ok(await adminProductDetail(id), ADMIN);
  });
}
