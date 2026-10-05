import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { pushQuestionReply } from "@/lib/push";
import { sendMail } from "@/lib/email";
import { contactMessageMail, questionReplyMail } from "@/lib/email-templates";
import { loadShopForEmail } from "@/lib/order-emails";
import { afterResponse } from "@/lib/defer";

/**
 * "Demander à la boutique" from the app — a question, with or without a
 * photo, that lands in the shop's inbox (/admin/messages, and Messages in
 * the staff app) and gets its answer back in the app.
 *
 * It is the one way to reach the shop that never depends on the shop having
 * published a phone or a WhatsApp number: the shop already has the asker's
 * number (they give it with the question) and can call back, or answer in
 * writing here — which the app shows under the question, and on the order's
 * page when the question was about an order.
 *
 * The asker reads the answer with a token minted with the question, kept in
 * the phone's keychain, stored here as SHA-256 — the order token's design
 * (lib/order-token). The id alone opens nothing.
 */

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;
const hash = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

export const MAX_QUESTION_PHOTOS = 3;
export const MAX_REPLY = 2000;

export type NewQuestion = {
  name: string;
  phone: string;
  body: string;
  email: string | null;
  vehicle?: string;
  productSku?: string;
  /** Proven by the caller: the order's token, or its account. */
  order?: { id: string; ref: string } | null;
  /** Typed context only — kept for a person to read. */
  orderRef?: string;
  userId: string | null;
  photos: { data: Uint8Array<ArrayBuffer>; mime: string }[];
  pushToken?: string | null;
  pushLocale?: string | null;
};

/** The line the inbox and the e-mail lead with. */
export function questionSubject(q: Pick<NewQuestion, "order" | "orderRef" | "productSku" | "photos" | "body">) {
  const ref = q.order?.ref ?? q.orderRef;
  if (ref) return `Question sur la commande ${ref}`;
  if (q.productSku) return `Question sur la pièce ${q.productSku}`;
  if (q.photos.length && !q.body) return "Photo d'une pièce à identifier";
  return "Question depuis l'application";
}

/** File the question; returns its id and the asker's token (the only time it exists). */
export async function createQuestion(q: NewQuestion) {
  const token = randomBytes(32).toString("base64url");
  const subject = questionSubject(q);
  const body = q.body || "Photo envoyée depuis l'application, sans commentaire.";
  const message = await prisma.contactMessage.create({
    data: {
      name: q.name,
      phone: q.phone,
      email: q.email,
      subject,
      body,
      vehicle: q.vehicle,
      productSku: q.productSku,
      orderRef: q.order?.ref ?? q.orderRef ?? null,
      orderId: q.order?.id ?? null,
      userId: q.userId,
      accessTokenHash: hash(token),
      pushToken: q.pushToken ?? null,
      pushLocale: q.pushLocale ?? null,
      photos: { create: q.photos.map((p) => ({ data: p.data, mime: p.mime })) },
    },
    select: { id: true, createdAt: true },
  });

  // The row is the record; the e-mail is the owner's nudge, and never throws.
  const shop = await loadShopForEmail();
  const mail = contactMessageMail(
    {
      id: message.id,
      name: q.name,
      email: q.email,
      phone: q.phone,
      subject,
      body,
      orderRef: q.order?.ref ?? q.orderRef ?? null,
      productSku: q.productSku ?? null,
      vehicle: q.vehicle ?? null,
      createdAt: message.createdAt,
      signedIn: Boolean(q.userId),
      photoCount: q.photos.length,
    },
    shop,
  );
  if (mail) afterResponse(() => sendMail(mail));
  return { id: message.id, token };
}

/** What the asker sees of their question. Never the photos' bytes, never the inbox status words. */
export const QUESTION_VIEW = {
  id: true,
  subject: true,
  body: true,
  orderRef: true,
  productSku: true,
  createdAt: true,
  reply: true,
  repliedAt: true,
  status: true,
  _count: { select: { photos: true } },
} as const;

type QuestionRow = {
  id: string;
  subject: string;
  body: string;
  orderRef: string | null;
  productSku: string | null;
  createdAt: Date;
  reply: string | null;
  repliedAt: Date | null;
  status: "NEW" | "HANDLED";
  _count: { photos: number };
};

export function questionView(m: QuestionRow) {
  return {
    id: m.id,
    subject: m.subject,
    body: m.body,
    orderRef: m.orderRef,
    productSku: m.productSku,
    photoCount: m._count.photos,
    createdAt: m.createdAt.toISOString(),
    reply: m.reply,
    repliedAt: m.repliedAt?.toISOString() ?? null,
    /** Read and dealt with — a call back counts — even with no written reply. */
    handled: m.status === "HANDLED",
  };
}

/** The question this token opens, if it is the one with this id. */
export async function questionForToken(id: string, token: string | null | undefined) {
  if (!token || !TOKEN_SHAPE.test(token)) return null;
  const row = await prisma.contactMessage.findUnique({ where: { accessTokenHash: hash(token) }, select: QUESTION_VIEW });
  return row && row.id === id ? row : null;
}

/**
 * The shop's written answer. Saved, the message marked handled, and the
 * asker told: a push to the phones that may hear it (lib/push) and an
 * e-mail when they gave an address. Answering again replaces the answer —
 * a correction, not a thread.
 */
export async function replyToQuestion(id: string, reply: string) {
  const text = reply.trim().slice(0, MAX_REPLY);
  if (!text) return { ok: false as const, error: "empty" as const };
  const exists = await prisma.contactMessage.findUnique({
    where: { id },
    select: { accessTokenHash: true, name: true, email: true, subject: true, body: true, orderRef: true },
  });
  if (!exists) return { ok: false as const, error: "not_found" as const };
  // Only a question asked from the app can be read back there; a website
  // message is answered by e-mail or phone, as it always was.
  if (!exists.accessTokenHash) return { ok: false as const, error: "not_in_app" as const };

  const now = new Date();
  await prisma.contactMessage.update({
    where: { id },
    data: { reply: text, repliedAt: now, status: "HANDLED", handledAt: now },
  });
  afterResponse(async () => {
    await pushQuestionReply(id);
    if (exists.email) {
      const shop = await loadShopForEmail();
      const mail = questionReplyMail({ name: exists.name, email: exists.email, question: exists.body, reply: text, orderRef: exists.orderRef }, shop);
      if (mail) await sendMail(mail);
    }
  });
  return { ok: true as const };
}
