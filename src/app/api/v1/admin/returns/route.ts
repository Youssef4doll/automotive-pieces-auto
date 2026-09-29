import { listReturns, openReturnCounts } from "@/lib/returns";
import { RETURN_STATUSES, type ReturnStatus } from "@/lib/returns-rules";
import { ok, preflightWrite } from "../../_lib/respond";
import { ADMIN, asAdmin } from "../_lib/admin";

export const OPTIONS = preflightWrite;

/** ?filter=open (default) | all | a status → { counts, returns }. */
export async function GET(request: Request) {
  return asAdmin(request, "returns", async () => {
    const raw = new URL(request.url).searchParams.get("filter") ?? "open";
    const filter = raw === "all" || raw === "open" || (RETURN_STATUSES as readonly string[]).includes(raw) ? (raw as "open" | "all" | ReturnStatus) : "open";
    const [counts, returns] = await Promise.all([openReturnCounts(), listReturns(filter)]);
    return ok({ counts, returns }, ADMIN);
  });
}
