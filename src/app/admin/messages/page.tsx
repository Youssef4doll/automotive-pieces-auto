import Link from "next/link";
import { prisma } from "@/lib/prisma";
import MessageRow from "@/components/admin/MessageRow";

export const metadata = { title: "Messages" };

/**
 * What customers wrote in, and whether anybody has dealt with it.
 *
 * The shop ran on WhatsApp alone, which works right up until you want to know
 * how many people asked about the same part, hand a question to whoever is
 * working tomorrow, or show what was said to a customer who is now disputing
 * an order. This is the record the shop owns.
 *
 * Unhandled first, because that half of the page is a job and the rest is a
 * record. A website message is answered by e-mail or WhatsApp; a question
 * asked from the app can also be answered here in writing, because the app
 * shows that answer to the customer (lib/questions).
 */
export default async function AdminMessagesPage() {
  const messages = await prisma.contactMessage.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: {
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
      user: { select: { id: true, email: true } },
      photos: { select: { id: true }, orderBy: { createdAt: "asc" } },
      reply: true,
      repliedAt: true,
      accessTokenHash: true,
    },
  });

  const waiting = messages.filter((m) => m.status === "NEW").length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">Messages</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ce que les clients ont écrit depuis{" "}
          <Link href="/contact" className="underline underline-offset-2 hover:text-red-600">
            la page contact
          </Link>
          et depuis l&apos;application. La réponse part par e-mail ou WhatsApp ; une question posée dans
          l&apos;application peut aussi recevoir sa réponse ici, que le client lira sous sa question.
        </p>
      </div>

      {messages.length === 0 ? (
        <p className="rounded-xl border border-navy-900/10 bg-white p-6 text-sm text-gray-500 shadow-sm">
          Aucun message pour l&apos;instant.
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-navy-950">{waiting}</span> en attente sur {messages.length}
          </p>
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <MessageRow
                key={m.id}
                message={{
                  id: m.id,
                  name: m.name,
                  email: m.email,
                  phone: m.phone,
                  subject: m.subject,
                  body: m.body,
                  status: m.status,
                  orderRef: m.orderRef,
                  productSku: m.productSku,
                  vehicle: m.vehicle,
                  user: m.user,
                  photoIds: m.photos.map((p) => p.id),
                  createdAt: m.createdAt.toISOString(),
                  handledAt: m.handledAt ? m.handledAt.toISOString() : null,
                  inApp: Boolean(m.accessTokenHash),
                  reply: m.reply,
                  repliedAt: m.repliedAt ? m.repliedAt.toISOString() : null,
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
