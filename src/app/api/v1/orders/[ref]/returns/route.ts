import { NextRequest } from "next/server";
import { z } from "zod";
import { appOrderView } from "@/lib/orders/view";
import { orderIdForRequest } from "@/lib/orders/request-access";
import { callerKey, hit, LIMITS, peek } from "@/lib/rate-limit";
import { MAX_IMAGE_BYTES, sniffMime } from "@/lib/image-upload";
import { createReturn, returnInput } from "@/lib/returns";
import { MAX_RETURN_PHOTOS } from "@/lib/returns-rules";
import { fail, guard, ok, preflightWrite } from "../../../_lib/respond";

const ref = z.string().trim().toUpperCase().min(3).max(32);
const POLICY = { cors: "write" as const };

export const OPTIONS = preflightWrite;

/**
 * "Retourner une pièce" on a delivered order.
 *
 * Multipart: `request` — JSON `{ reason, wish, note?, unmounted, items:
 * [{ orderItemId, qty }] }` — and 0 to 4 `photos` (JPEG/PNG/WebP, 4 MB each,
 * checked by their bytes). Same key as reading the order: its token, or the
 * session of the account it belongs to.
 *
 * Every rule is checked again here (lib/returns-rules): the deadline for the
 * reason, the quantities still free, the photo the policy asks for, the
 * "never fitted" declaration. A refusal says which, as `invalid_field` with
 * `reason`: closed | no_items | qty | photo_required | unmounted_required |
 * too_many_photos; `unavailable` with `reason: "not_delivered"` before the
 * shop has marked the order delivered. Answers the order as it now stands,
 * with the new request on it.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ ref: string }> }) {
  return guard(
    async () => {
      const caller = await callerKey("return-request");
      const flood = hit(`${caller}:attempt`, LIMITS.returnAttempt.limit, LIMITS.returnAttempt.windowMs);
      const filed = peek(caller, LIMITS.returnRequest.limit);
      const gate = !flood.ok ? flood : filed;
      if (!gate.ok) return fail("rate_limited", POLICY, { "Retry-After": String(gate.retryAfter) });
      const parsedRef = ref.safeParse((await context.params).ref);
      if (!parsedRef.success) return fail("not_found", POLICY);
      const orderId = await orderIdForRequest(request, parsedRef.data);
      if (orderId === null) return fail("unauthorized", POLICY);
      if (!orderId) return fail("not_found", POLICY);

      const declared = Number(request.headers.get("content-length") ?? 0);
      if (declared > MAX_IMAGE_BYTES * MAX_RETURN_PHOTOS + 64_000) return fail("bad_request", POLICY, undefined, { reason: "too_large" });
      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        return fail("bad_request", POLICY);
      }
      let json: unknown;
      try {
        json = JSON.parse(String(form.get("request") ?? ""));
      } catch {
        return fail("invalid_field", POLICY, undefined, { field: "request" });
      }
      const parsed = returnInput.safeParse(json);
      if (!parsed.success) return fail("invalid_field", POLICY, undefined, { field: String(parsed.error.issues[0]?.path[0] ?? "request") });

      const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
      if (files.length > MAX_RETURN_PHOTOS) return fail("invalid_field", POLICY, undefined, { field: "photos", reason: "too_many_photos" });
      const photos: { data: Uint8Array<ArrayBuffer>; mime: string }[] = [];
      for (const file of files) {
        if (file.size > MAX_IMAGE_BYTES) return fail("bad_request", POLICY, undefined, { reason: "too_large" });
        const data = new Uint8Array(await file.arrayBuffer());
        const mime = sniffMime(data);
        if (!mime || mime === "image/avif") return fail("invalid_field", POLICY, undefined, { field: "photos" });
        photos.push({ data, mime });
      }

      const result = await createReturn(orderId, parsed.data, photos);
      if (!result.ok) {
        if (result.problem === "not_delivered") return fail("unavailable", POLICY, undefined, { reason: "not_delivered" });
        return fail("invalid_field", POLICY, undefined, { field: result.problem === "too_many_photos" ? "photos" : "request", reason: result.problem });
      }
      hit(caller, LIMITS.returnRequest.limit, LIMITS.returnRequest.windowMs);
      return ok({ returnRef: result.ref, order: await appOrderView(orderId) }, POLICY);
    },
    "orders/[ref]/returns",
    POLICY,
  );
}
