import { bearerToken } from "@/lib/order-token";
import { questionForToken, questionView } from "@/lib/questions";
import { callerKey, hit, LIMITS } from "@/lib/rate-limit";
import { fail, guard, ok, preflightWrite } from "../../_lib/respond";

const POLICY = { cors: "write" as const };
export const OPTIONS = preflightWrite;

/**
 * One question and the shop's answer, for the phone that asked it:
 * `Authorization: Bearer <the token from POST questions>`. Any other id or
 * token is `not_found`, the same answer, so ids cannot be walked.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return guard(
    async () => {
      const gate = hit(await callerKey("question-read"), LIMITS.orderRead.limit, LIMITS.orderRead.windowMs);
      if (!gate.ok) return fail("rate_limited", POLICY, { "Retry-After": String(gate.retryAfter) });
      const { id } = await params;
      const row = await questionForToken(id, bearerToken(request.headers.get("authorization")));
      if (!row) return fail("not_found", POLICY);
      return ok(questionView(row), POLICY);
    },
    "questions GET",
    POLICY,
  );
}
