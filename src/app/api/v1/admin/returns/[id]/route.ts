import { adminReturnDetail, moveReturn, returnMove } from "@/lib/returns";
import { fail, ok, preflightWrite, readJson } from "../../../_lib/respond";
import { ADMIN, asAdmin } from "../../_lib/admin";

export const OPTIONS = preflightWrite;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return asAdmin(request, "return", async () => {
    const detail = await adminReturnDetail((await params).id);
    return detail ? ok(detail, ADMIN) : fail("not_found", ADMIN);
  });
}

/**
 * Move a request on: `{ to: "APPROVED", method, shopNote? }`,
 * `{ to: "REFUSED", shopNote }`, `{ to: "RECEIVED", restock }`,
 * `{ to: "RESOLVED", outcome, refundAmount?, shopNote? }`. The customer is
 * notified exactly as from the website. A step not allowed from where the
 * request stands is `unavailable` with `reason: "transition"`.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return asAdmin(request, "return move", async () => {
    const parsed = returnMove.safeParse(await readJson(request, 4_096));
    if (!parsed.success) return fail("invalid_field", ADMIN, undefined, { field: String(parsed.error.issues[0]?.path[0] ?? "to") });
    const id = (await params).id;
    const result = await moveReturn(id, parsed.data);
    if (!result.ok) {
      if (result.problem === "not_found") return fail("not_found", ADMIN);
      if (result.problem === "refund_amount") return fail("invalid_field", ADMIN, undefined, { field: "refundAmount" });
      return fail("unavailable", ADMIN, undefined, { reason: "transition" });
    }
    return ok(await adminReturnDetail(id), ADMIN);
  });
}
