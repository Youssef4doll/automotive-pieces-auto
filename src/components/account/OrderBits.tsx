import Link from "next/link";
import { formatTNDfr } from "@/lib/money";
import { IconArrowRight, IconShield, IconCheck, IconWhatsApp, IconPhone, IconHelp } from "./icons";

export const STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  PREPARED: "Préparée",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
};

export const NEXT_STEP: Record<string, string> = {
  PENDING: "Nous confirmons votre commande, en général sous quelques heures.",
  CONFIRMED: "Nous préparons vos pièces.",
  PREPARED: "Votre commande est prête. Elle part à la livraison très prochainement.",
  SHIPPED: "En route. Le livreur vous appelle avant de passer.",
  DELIVERED: "Livrée. Un souci avec une pièce ? Écrivez-nous, on s'en occupe.",
  CANCELLED: "Cette commande a été annulée.",
};

/** Soft, accessible status colours — never the only signal, always with text. */
export function StatusBadge({
  status,
  size = "md",
  onDark = false,
}: {
  status: string;
  size?: "sm" | "md";
  /** The hero sits on navy, where the light tones fail contrast entirely. */
  onDark?: boolean;
}) {
  const tone = onDark
    ? status === "DELIVERED"
      ? "bg-green-500/20 text-green-200 border-green-400/40"
      : status === "CANCELLED"
        ? "bg-red-500/20 text-red-200 border-red-400/40"
        : "bg-gold-500 text-navy-950 border-gold-500"
    :
    status === "DELIVERED"
      ? "bg-green-50 text-green-800 border-green-200"
      : status === "CANCELLED"
        ? "bg-red-50 text-red-700 border-red-200"
        : status === "SHIPPED"
          ? "bg-blue-50 text-blue-800 border-blue-200"
          : "bg-gold-500/15 text-navy-900 border-gold-500/40";
  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border whitespace-nowrap ${tone} ${
        size === "sm" ? "text-[11px] px-2.5 py-1" : "text-xs px-3 py-1.5"
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

/** One compact order row, used in the dashboard's recent list. */
export function OrderRow({
  order,
}: {
  order: { ref: string; status: string; total: number; createdAt: string };
}) {
  return (
    <Link
      href={`/compte/commandes/${order.ref}`}
      className="flex items-center gap-3 px-3 py-3 -mx-1 rounded-xl hover:bg-slate-50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="font-mono font-bold text-sm text-navy-950" dir="ltr">
          {order.ref}
        </p>
        <p className="text-xs text-slate-400">
          {new Date(order.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>
      <span className="text-sm font-semibold text-navy-950 tabular-nums whitespace-nowrap">
        {formatTNDfr(order.total)}
      </span>
      <StatusBadge status={order.status} size="sm" />
      <IconArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
    </Link>
  );
}

/** Reassurance, limited to things the shop genuinely does. */
export function TrustPanel() {
  const points = [
    "Pièces sélectionnées auprès de nos fournisseurs",
    "Assistance humaine, pas un robot",
    "Suivi de commande à chaque étape",
    "Aide pour identifier la bonne référence",
  ];
  return (
    <section aria-labelledby="trust" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2
        id="trust"
        className="flex items-center gap-2 font-heading font-extrabold uppercase text-navy-950 tracking-tight mb-3"
      >
        <IconShield className="text-gold-500" /> Votre espace Automotive
      </h2>
      <ul className="grid sm:grid-cols-2 gap-y-2 gap-x-4">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-sm text-slate-600">
            <IconCheck className="w-4 h-4 mt-0.5 text-green-600 shrink-0" />
            {p}
          </li>
        ))}
      </ul>
    </section>
  );
}

export type ShopContact = { whatsapp: string; phone: string; email: string; hours: string };

/** Support, with the order reference already written into the message. */
export function HelpPanel({ contact, orderRef }: { contact: ShopContact; orderRef?: string }) {
  const message = orderRef
    ? `Bonjour, j'ai besoin d'aide concernant ma commande ${orderRef}.`
    : "Bonjour, j'ai besoin d'aide pour trouver une pièce.";
  return (
    <section aria-labelledby="help" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 id="help" className="font-heading font-extrabold uppercase text-navy-950 tracking-tight">
        Besoin d&apos;un coup de main ?
      </h2>
      <p className="text-sm text-slate-500 mt-0.5 mb-4">
        Une vraie personne vous répond pendant les heures d&apos;ouverture.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <a
          href={`https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-2 min-h-tap px-4 rounded-xl bg-green-600 hover:bg-green-500 text-white font-display font-bold uppercase text-xs tracking-wide transition-colors"
        >
          <IconWhatsApp /> Écrire sur WhatsApp
        </a>
        <a
          href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
          className="inline-flex items-center justify-center gap-2 min-h-tap px-4 rounded-xl border border-slate-300 text-navy-900 text-sm font-semibold hover:border-navy-700 transition-colors"
        >
          <IconPhone className="w-4 h-4" /> Appeler
        </a>
        <Link
          href="/compte/aide"
          className="inline-flex items-center justify-center gap-2 min-h-tap px-4 rounded-xl border border-slate-300 text-navy-900 text-sm font-semibold hover:border-navy-700 transition-colors"
        >
          <IconHelp className="w-4 h-4" /> FAQ
        </Link>
      </div>

      <p className="text-xs text-slate-400 mt-3">{contact.hours}</p>
    </section>
  );
}
