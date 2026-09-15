"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { setMessageHandled } from "@/app/actions/contact-admin";

export type AdminMessage = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  body: string;
  status: "NEW" | "HANDLED";
  orderRef: string | null;
  productSku: string | null;
  vehicle: string | null;
  createdAt: string;
  handledAt: string | null;
  user: { id: string; email: string } | null;
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
 * "Répondre" is a plain mailto. The shop answers from its own mailbox and the
 * customer gets a normal reply thread — this table records that the message
 * came in and that somebody dealt with it, and does not pretend to be a
 * helpdesk it would then have to keep true.
 */
export default function MessageRow({ message: m }: { message: AdminMessage }) {
  const [handled, setHandled] = useState(m.status === "HANDLED");
  const [pending, start] = useTransition();

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
        <a href={`mailto:${m.email}`} dir="ltr" className="underline underline-offset-2 hover:text-red-600">
          {m.email}
        </a>
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

      <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-navy-900/8 pt-3">
        <a
          href={`mailto:${m.email}?subject=${encodeURIComponent(`Re : ${m.subject}`)}`}
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
