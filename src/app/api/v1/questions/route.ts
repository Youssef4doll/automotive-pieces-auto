import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { customerForRequest } from "@/lib/customer-session";
import { callerKey, hit, LIMITS } from "@/lib/rate-limit";
import { MAX_IMAGE_BYTES, sniffMime } from "@/lib/image-upload";
import { orderIdForToken } from "@/lib/order-token";
import { EXPO_TOKEN, pushLocale } from "@/lib/push-copy";
import { createQuestion, MAX_QUESTION_PHOTOS } from "@/lib/questions";
import { personName, phoneNumber } from "@/lib/validation";
import { fail, guard, ok, preflightWrite } from "../_lib/respond";

/** Write CORS: this route reads no cookie; the optional bearer is the app's own. */
const POLICY = { cors: "write" as const };
export const OPTIONS = preflightWrite;

const fields = z.object({
  name: personName,
  phone: phoneNumber,
  body: z.string().trim().max(1500).optional(),
  vehicle: z.string().trim().max(160).optional(),
  productSku: z.string().trim().max(64).optional(),
  orderRef: z.string().trim().max(32).optional(),
  orderToken: z.string().max(100).optional(),
  pushToken: z.string().regex(EXPO_TOKEN).optional(),
  locale: z.string().max(5).optional(),
});

/**
 * "Demander à la boutique": a question, a photo, or both → the shop's inbox.
 *
 * Multipart: `name`, `phone`, then `body` and/or 1–3 `photos` (JPEG, PNG or
 * WebP, 4 MB each, checked by their bytes); optional context `vehicle`,
 * `productSku`, `orderRef` (+ `orderToken`, the order's own token, which is
 * what makes it the asker's order), and `pushToken` + `locale` to be told
 * when the shop answers. A signed-in customer's bearer files it under their
 * account — and proves an order of theirs without a token.
 *
 * Answers `{ id, token }`: the token is the asker's key to read the answer
 * (GET questions/[id]). It exists only in this response.
 */
export async function POST(request: Request) {
  return guard(
    async () => {
      const gate = hit(await callerKey("question"), LIMITS.contact.limit, LIMITS.contact.windowMs);
      if (!gate.ok) return fail("rate_limited", POLICY, { "Retry-After": String(gate.retryAfter) });

      const declared = Number(request.headers.get("content-length") ?? 0);
      if (declared > MAX_IMAGE_BYTES * MAX_QUESTION_PHOTOS + 64_000) return fail("payload_too_large", POLICY);

      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        return fail("bad_request", POLICY);
      }
      const value = (k: string) => {
        const v = form.get(k);
        return typeof v === "string" && v.trim() ? v : undefined;
      };
      const parsed = fields.safeParse({
        name: form.get("name") ?? "",
        phone: form.get("phone") ?? "",
        body: value("body"),
        vehicle: value("vehicle"),
        productSku: value("productSku"),
        orderRef: value("orderRef"),
        orderToken: value("orderToken"),
        pushToken: value("pushToken"),
        locale: value("locale"),
      });
      if (!parsed.success) {
        return fail("invalid_field", POLICY, undefined, { field: String(parsed.error.issues[0]?.path[0] ?? "form") });
      }

      const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
      if (files.length > MAX_QUESTION_PHOTOS) return fail("invalid_field", POLICY, undefined, { field: "photos" });
      const photos: { data: Uint8Array<ArrayBuffer>; mime: string }[] = [];
      for (const file of files) {
        if (file.size > MAX_IMAGE_BYTES) return fail("payload_too_large", POLICY);
        const data = new Uint8Array(await file.arrayBuffer());
        const mime = sniffMime(data);
        if (!mime || mime === "image/avif") return fail("invalid_field", POLICY, undefined, { field: "photos" });
        photos.push({ data, mime });
      }
      const text = parsed.data.body ?? "";
      // Something to answer: a sentence, or a picture.
      if (text.length < 3 && photos.length === 0) return fail("invalid_field", POLICY, undefined, { field: "body" });

      const customer = await customerForRequest(request);
      const { orderRef, orderToken } = parsed.data;
      let order: { id: string; ref: string } | null = null;
      if (orderRef) {
        const byToken = await orderIdForToken(orderRef, orderToken);
        if (byToken) order = { id: byToken, ref: orderRef };
        else if (customer) {
          order = await prisma.order.findFirst({ where: { ref: orderRef, userId: customer.id }, select: { id: true, ref: true } });
        }
      }

      const { id, token } = await createQuestion({
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: customer?.email ?? null,
        body: text,
        vehicle: parsed.data.vehicle,
        productSku: parsed.data.productSku,
        order,
        orderRef: order ? undefined : orderRef,
        userId: customer?.id ?? null,
        photos,
        pushToken: parsed.data.pushToken ?? null,
        pushLocale: parsed.data.pushToken ? pushLocale(parsed.data.locale) : null,
      });
      return ok({ id, token, order: order ? order.ref : null }, POLICY);
    },
    "questions POST",
    POLICY,
  );
}
