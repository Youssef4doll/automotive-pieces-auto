import { z } from "zod";
import { Prisma } from "@prisma/client";
import { adminProductDetail, updateProductQuick } from "@/lib/admin/products";
import { fail, ok, preflightWrite, readJson } from "../../../_lib/respond";
import { ADMIN, asAdmin } from "../../_lib/admin";

export const OPTIONS = preflightWrite;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return asAdmin(request, "product", async () => {
    const product = await adminProductDetail((await params).id);
    return product ? ok(product, ADMIN) : fail("not_found", ADMIN);
  });
}

/** Never negative; the column is Decimal(10,2) and rounds the rest. */
const money = z.number().finite().min(0).max(99_999_999);

const patch = z
  .object({
    priceSell: money.optional(),
    priceBuy: money.optional(),
    active: z.boolean().optional(),
    supply: z.enum(["ON_ORDER", "UNAVAILABLE"]).optional(),
    lowStockThreshold: z.number().int().min(0).max(100_000).optional(),
  })
  .strict();

/** The fields a phone may change: price, purchase price, online, supply, alert threshold. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return asAdmin(request, "product PATCH", async () => {
    const parsed = patch.safeParse(await readJson(request, 2_048));
    if (!parsed.success) {
      return fail("invalid_field", ADMIN, undefined, { field: String(parsed.error.issues[0]?.path[0] ?? "") });
    }
    const { id } = await params;
    try {
      await updateProductQuick(id, parsed.data);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return fail("not_found", ADMIN);
      throw e;
    }
    return ok(await adminProductDetail(id), ADMIN);
  });
}
