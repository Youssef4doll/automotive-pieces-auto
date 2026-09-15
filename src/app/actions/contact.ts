"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { hit, callerKey, LIMITS } from "@/lib/rate-limit";
import { checkForm } from "@/lib/bot-check";
import { sendMail } from "@/lib/email";
import { contactMessageMail } from "@/lib/email-templates";
import { loadShopForEmail } from "@/lib/order-emails";
import { CONTACT_SUBJECTS } from "@/lib/contact-subjects";

/**
 * "Besoin d'aide ?" — the contact form.
 *
 * The shop ran on WhatsApp alone. That is the channel Tunisian customers
 * actually use and it is not going anywhere, but on its own it means the shop
 * owns no record of anything: a question asked on WhatsApp lives on one phone,
 * cannot be counted, cannot be handed to whoever is working tomorrow, and
 * cannot be produced when a customer disputes what was agreed. A message left
 * here is a row the shop owns, and the owner still gets an e-mail about it.
 *
 * The context fields are attached by the page, never typed: the order or part
 * the customer was looking at, and the car in their garage. That is the whole
 * difference between "my part doesn't fit" and a message the shop can act on
 * without a second round of questions.
 */

const schema = z.object({
  name: z.string().trim().min(2, "Votre nom, s'il vous plaît").max(120),
  email: z.email("Adresse e-mail invalide").max(200),
  phone: z.string().trim().max(40).optional(),
  subject: z.enum(CONTACT_SUBJECTS),
  body: z.string().trim().min(10, "Dites-nous en un peu plus — au moins quelques mots").max(4000),
  // Attached by the page from what the shopper already had on screen. Bounded
  // like everything else a browser sends, and never used to look anything up:
  // they are written down as context for a person to read.
  orderRef: z.string().trim().max(40).optional(),
  productSku: z.string().trim().max(64).optional(),
  vehicle: z.string().trim().max(160).optional(),
});

export type ContactState = { ok?: boolean; error?: string } | undefined;

export async function sendContactMessage(
  _prev: ContactState,
  formData: FormData
): Promise<ContactState> {
  // The honeypot only, deliberately — no timing check.
  //
  // bot-check's own rule is that timing is opt-in "only where a false positive
  // is cheap", and a lost contact message is not: the customer is told "message
  // envoyé", nothing is written, and nobody ever replies to a real question.
  // Two seconds is also a low bar to cross with an autofilled name and e-mail
  // and a short "où est ma commande ?". The filled honeypot is the signal that
  // is close to proof, and the rate limit above caps the volume either way.
  //
  // A bot gets the thank-you screen and nothing else. Telling it what it
  // tripped only teaches it what to change.
  if (!checkForm(formData).human) return { ok: true };

  const gate = hit(await callerKey("contact"), LIMITS.contact.limit, LIMITS.contact.windowMs);
  if (!gate.ok) {
    return { error: `Trop de messages envoyés. Réessayez dans ${Math.ceil(gate.retryAfter / 60)} minute(s).` };
  }

  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    subject: formData.get("subject"),
    body: formData.get("body"),
    orderRef: formData.get("orderRef") || undefined,
    productSku: formData.get("productSku") || undefined,
    vehicle: formData.get("vehicle") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire incomplet" };
  }

  const user = await getCurrentUser();
  const message = await prisma.contactMessage.create({
    data: { ...parsed.data, userId: user?.id ?? null },
  });

  // The row is the record; the e-mail is the nudge. A mail transport that is
  // not configured, or is down, must not lose the message — so this runs after
  // the write and never throws (sendMail logs its own failures).
  const shop = await loadShopForEmail();
  const mail = contactMessageMail(
    {
      id: message.id,
      name: message.name,
      email: message.email,
      phone: message.phone,
      subject: message.subject,
      body: message.body,
      orderRef: message.orderRef,
      productSku: message.productSku,
      vehicle: message.vehicle,
      createdAt: message.createdAt,
      signedIn: Boolean(user),
    },
    shop
  );
  if (mail) await sendMail(mail);

  return { ok: true };
}
