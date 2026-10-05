import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { customerForRequest } from "@/lib/customer-session";
import { callerKey, hit, LIMITS } from "@/lib/rate-limit";
import { MAX_IMAGE_BYTES, sniffMime } from "@/lib/image-upload";
import { personName, phoneNumber } from "@/lib/validation";
import { sendMail } from "@/lib/email";
import { contactMessageMail } from "@/lib/email-templates";
import { loadShopForEmail } from "@/lib/order-emails";
import { fail, guard, ok, preflightWrite } from "../_lib/respond";
import { afterResponse } from "@/lib/defer";

/** Write CORS: this route reads no cookie; the optional bearer is the app's own. */
const POLICY = { cors: "write" as const };
export const OPTIONS = preflightWrite;

const MAX_PHOTOS = 3;

const fields = z.object({
  name: personName,
  phone: phoneNumber,
  note: z.string().trim().max(1000).optional(),
  // Context the app attaches from what is on screen; written down for a
  // person to read, never used to look anything up.
  vehicle: z.string().trim().max(160).optional(),
  productSku: z.string().trim().max(64).optional(),
});

/**
 * "I have the part in my hand but not its name" — a photo, the car, a phone
 * number, into the shop's inbox (/admin/messages) with the photo attached.
 *
 * Multipart: `photos` (1–3 JPEG/PNG/WebP, 4 MB each, checked by their bytes,
 * not their declared type), `name`, `phone`, and optional `note`, `vehicle`,
 * `productSku`. A signed-in customer's bearer files the request under their
 * account. Answers `{ id }`.
 *
 * Nothing here pretends to answer: the shop looks at the photo and calls or
 * writes back. The app says exactly that.
 */
export async function POST(request: Request) {
  return guard(
    async () => {
      const gate = hit(await callerKey("expert"), LIMITS.expertRequest.limit, LIMITS.expertRequest.windowMs);
      if (!gate.ok) return fail("rate_limited", POLICY, { "Retry-After": String(gate.retryAfter) });

      const declared = Number(request.headers.get("content-length") ?? 0);
      if (declared > MAX_IMAGE_BYTES * MAX_PHOTOS + 64_000) return fail("bad_request", POLICY, undefined, { reason: "too_large" });

      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        return fail("bad_request", POLICY);
      }

      const parsed = fields.safeParse({
        name: form.get("name") ?? "",
        phone: form.get("phone") ?? "",
        note: form.get("note") || undefined,
        vehicle: form.get("vehicle") || undefined,
        productSku: form.get("productSku") || undefined,
      });
      if (!parsed.success) {
        return fail("invalid_field", POLICY, undefined, { field: String(parsed.error.issues[0]?.path[0] ?? "form") });
      }

      const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
      if (files.length === 0 || files.length > MAX_PHOTOS) return fail("invalid_field", POLICY, undefined, { field: "photos" });

      const photos: { data: Uint8Array<ArrayBuffer>; mime: string }[] = [];
      for (const file of files) {
        if (file.size > MAX_IMAGE_BYTES) return fail("bad_request", POLICY, undefined, { reason: "too_large" });
        const data = new Uint8Array(await file.arrayBuffer());
        const mime = sniffMime(data);
        if (!mime || mime === "image/avif") return fail("invalid_field", POLICY, undefined, { field: "photos" });
        photos.push({ data, mime });
      }

      const customer = await customerForRequest(request);
      const { name, phone, note, vehicle, productSku } = parsed.data;
      const message = await prisma.contactMessage.create({
        data: {
          name,
          phone,
          email: customer?.email ?? null,
          subject: "Photo d'une pièce à identifier",
          body: note?.trim() || "Photo envoyée depuis l'application, sans commentaire.",
          vehicle,
          productSku,
          userId: customer?.id ?? null,
          photos: { create: photos.map((p) => ({ data: p.data, mime: p.mime })) },
        },
        select: { id: true, createdAt: true },
      });

      // The row is the record; the e-mail is the nudge, and never throws.
      const shop = await loadShopForEmail();
      const mail = contactMessageMail(
        {
          id: message.id,
          name,
          email: customer?.email ?? null,
          phone,
          subject: "Photo d'une pièce à identifier",
          body: note?.trim() || "Photo envoyée depuis l'application, sans commentaire.",
          orderRef: null,
          productSku: productSku ?? null,
          vehicle: vehicle ?? null,
          createdAt: message.createdAt,
          signedIn: Boolean(customer),
          photoCount: photos.length,
        },
        shop,
      );
      if (mail) afterResponse(() => sendMail(mail));

      return ok({ id: message.id }, POLICY);
    },
    "expert-requests POST",
    POLICY,
  );
}
