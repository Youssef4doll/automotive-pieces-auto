import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { MAX_REPLY, replyToQuestion } from "@/lib/questions";
import { fail, ok, preflightWrite, readJson } from "../../../_lib/respond";
import { ADMIN, asAdmin } from "../../_lib/admin";

export const OPTIONS = preflightWrite;

const SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  subject: true,
  body: true,
  status: true,
  orderRef: true,
  productSku: true,
  vehicle: true,
  createdAt: true,
  handledAt: true,
  reply: true,
  repliedAt: true,
  accessTokenHash: true,
  userId: true,
  order: { select: { id: true, ref: true, status: true } },
  photos: { select: { id: true }, orderBy: { createdAt: "asc" as const } },
} as const;

async function view(id: string) {
  const m = await prisma.contactMessage.findUnique({ where: { id }, select: SELECT });
  if (!m) return null;
  const { accessTokenHash, photos, order, userId, ...rest } = m;
  return {
    ...rest,
    createdAt: m.createdAt.toISOString(),
    handledAt: m.handledAt?.toISOString() ?? null,
    repliedAt: m.repliedAt?.toISOString() ?? null,
    signedIn: Boolean(userId),
    inApp: Boolean(accessTokenHash),
    /** Only an order the asker proved is theirs; a typed reference stays in `orderRef`. */
    order,
    photoIds: photos.map((p) => p.id),
  };
}

/** One message, whole: the text, the context, the photos' ids, the answer so far. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return asAdmin(request, "message GET", async () => {
    const m = await view((await params).id);
    return m ? ok(m, ADMIN) : fail("not_found", ADMIN);
  });
}

const body = z.union([
  z.object({ reply: z.string().trim().min(1).max(MAX_REPLY) }),
  z.object({ status: z.enum(["NEW", "HANDLED"]) }),
]);

/**
 * `{ reply }` — answer in writing (app questions only: the asker reads it in
 * the app, and gets a push and an e-mail when they can); the message is
 * marked handled. `{ status }` — mark it handled (answered by phone) or not.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return asAdmin(request, "message POST", async () => {
    const { id } = await params;
    const parsed = body.safeParse(await readJson(request, 8_192));
    if (!parsed.success) return fail("invalid_field", ADMIN, undefined, { field: "reply" });

    if ("reply" in parsed.data) {
      const done = await replyToQuestion(id, parsed.data.reply);
      if (!done.ok) {
        if (done.error === "not_found") return fail("not_found", ADMIN);
        return fail("invalid_field", ADMIN, undefined, { field: "reply", reason: done.error });
      }
    } else {
      const handled = parsed.data.status === "HANDLED";
      const changed = await prisma.contactMessage.updateMany({
        where: { id },
        data: { status: parsed.data.status, handledAt: handled ? new Date() : null },
      });
      if (!changed.count) return fail("not_found", ADMIN);
    }
    const m = await view(id);
    return m ? ok(m, ADMIN) : fail("not_found", ADMIN);
  });
}
