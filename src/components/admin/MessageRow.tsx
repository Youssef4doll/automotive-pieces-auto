"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { replyToMessage, setMessageHandled } from "@/app/actions/contact-admin";

export type AdminMessage = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  subject: string;
  body: string;
  status: "NEW" | "HANDLED";
  orderRef: string | null;
  productSku: string | null;
  vehicle: string | null;
  createdAt: string;
  handledAt: string | null;
  user: { id: string; email: string | null } | null;
  photoIds: string[];
  /** Asked from the app: a written reply reaches the asker there. */
  inApp: boolean;
  reply: string | null;
  repliedAt: string | null;
};

/** A Tunisian number as wa.me wants it: 216 and eight digits. */
const whatsappNumber = (phone: string | null) => {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.length === 8 ? `216${d}` : d;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * One message in the shop's inbox.
 *
 * The context line is the reason this page exists rather than an e-mail
 * folder: the order, the part and the car came with the message, so "ça ne va
 * pas sur ma voiture" is already answerable without writing back to ask which
 * car. Each of those is a link into the admin where there is one to make.
 *
 * "Répondre" is a plain mailto (or WhatsApp to the customer's number). The
 * shop answers from its own mailbox and the customer gets a normal reply
 * thread. A question asked from the app also takes a written answer here,
 * which the customer reads in the app under their question — with a push
 * and an e-mail when they can be reached that way.
 */
export default function MessageRow({ message: m }: { message: AdminMessage }) {
  const [handled, setHandled] = useState(m.status === "HANDLED");
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState("");
  const [answer, setAnswer] = useState(m.reply);
  const [answeredAt, setAnsweredAt] = useState(m.repliedAt);
  const [replyError, setReplyError] = useState<string | null>(null);

  function sendReply() {
    const text = draft.trim();
    if (!text) return;
    setReplyError(null);
    start(async () => {
      const res = await replyToMessage(m.id, text);
      if (!res.ok) return setReplyError(res.error);
      setAnswer(text);
      setAnsweredAt(new Date().toISOString());
      setDraft("");
      setHandled(true);
    });
  }

  function toggle() {
    const next = !handled;
    setHandled(next); // optimistic: the row is the shop's own bookkeeping
    start(async () => {
      const res = await setMessageHandled(m.id, next);
      if (!res.ok) setHandled(!next);
    });
  }

  const context = [
    m.orderRef && { label: m.orderRef, href: null as string | null },
    m.productSku && { label: m.productSku, href: `/admin/stock?q=${encodeURIComponent(m.productSku)}` },
    m.vehicle && { label: m.vehicle, href: null },
  ].filter((c): c is { label: string; href: string | null } => Boolean(c));

  return (
    <article
      className={`rounded-xl border p-4 shadow-sm transition ${
        handled ? "border-navy-900/10 bg-white/60" : "border-gold-500/60 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-navy-950">{m.subject}</h2>
        <span className="text-xs text-navy-900/45">{fmt(m.createdAt)}</span>
      </div>

      <p className="mt-1 text-sm text-gray-600">
        <span className="font-semibold text-navy-900">{m.name}</span>{" "}
        {m.email && (
          <a href={`mailto:${m.email}`} dir="ltr" className="underline underline-offset-2 hover:text-red-600">
            {m.email}
          </a>
        )}
        {m.phone && (
          <>
            {" · "}
            <a href={`tel:${m.phone.replace(/[^\d+]/g, "")}`} dir="ltr" className="underline underline-offset-2 hover:text-red-600">
              {m.phone}
            </a>
          </>
        )}
        {m.user ? (
          <>
            {" · "}
            <Link href={`/admin/clients/${m.user.id}`} className="underline underline-offset-2 hover:text-red-600">
              fiche client
            </Link>
          </>
        ) : (
          <span className="text-navy-900/40"> · visiteur</span>
        )}
      </p>

      <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{m.body}</p>

      {m.photoIds.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {m.photoIds.map((id) => (
            <a key={id} href={`/api/admin/contact-photos/${id}`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- private, admin-only bytes; next/image would cache them publicly */}
              <img src={`/api/admin/contact-photos/${id}`} alt="Photo envoyée par le client" className="h-28 w-28 rounded-lg border border-navy-900/10 object-cover" />
            </a>
          ))}
        </div>
      )}

      {context.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {context.map((c) =>
            c.href ? (
              <Link
                key={c.label}
                href={c.href}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-navy-900 hover:bg-slate-200"
              >
                {c.label}
              </Link>
            ) : (
              <span key={c.label} className="rounded-full bg-slate-100 px-2.5 py-1 text-[12px] text-navy-900/70">
                {c.label}
              </span>
            )
          )}
        </div>
      )}

      {answer && (
        <div className="mt-3 rounded-lg border border-navy-900/10 bg-slate-50 p-3">
          <p className="text-[11px] font-display font-bold uppercase tracking-wide text-navy-900/50">
            Réponse dans l&apos;application{answeredAt ? ` · ${fmt(answeredAt)}` : ""}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-navy-950">{answer}</p>
        </div>
      )}

      {m.inApp && (
        <div className="mt-3 flex flex-col gap-2">
          <label className="text-xs font-semibold text-navy-900/70" htmlFor={`reply-${m.id}`}>
            {answer ? "Corriger la réponse" : "Répondre dans l'application"}
          </label>
          <textarea
            id={`reply-${m.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Le client la lira sous sa question, dans l'application."
            className="w-full rounded-lg border border-navy-900/15 bg-white p-2.5 text-sm text-navy-950 focus:border-navy-900/40 focus:outline-none"
          />
          {replyError && <p className="text-xs text-red-700">{replyError}</p>}
          <div>
            <button
              type="button"
              onClick={sendReply}
              disabled={pending || !draft.trim()}
              className="inline-flex min-h-tap-compact items-center rounded-lg bg-gold-500 px-4 text-xs font-display font-bold uppercase tracking-wide text-navy-950 hover:bg-gold-400 disabled:opacity-50"
            >
              Envoyer la réponse
            </button>
          </div>
        </div>
      )}

      <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-navy-900/8 pt-3">
        <a
          href={
            m.email
              ? `mailto:${m.email}?subject=${encodeURIComponent(`Re : ${m.subject}`)}`
              : `https://wa.me/${whatsappNumber(m.phone)}?text=${encodeURIComponent(`Bonjour ${m.name}, au sujet de votre photo :`)}`
          }
          className="inline-flex min-h-tap-compact items-center rounded-lg bg-navy-900 px-4 text-xs font-display font-bold uppercase tracking-wide text-white hover:bg-navy-950"
        >
          Répondre
        </a>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className={`inline-flex min-h-tap-compact items-center rounded-lg border px-4 text-xs font-display font-bold uppercase tracking-wide disabled:opacity-60 ${
            handled
              ? "border-navy-900/15 text-navy-900/60 hover:border-navy-900/35"
              : "border-green-600/40 bg-green-50 text-green-800 hover:border-green-600"
          }`}
        >
          {handled ? "Rouvrir" : "Marquer traité"}
        </button>
        {handled && m.handledAt && (
          <span className="text-xs text-navy-900/40">Traité le {fmt(m.handledAt)}</span>
        )}
      </div>
    </article>
  );
}
