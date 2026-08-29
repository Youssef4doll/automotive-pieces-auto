import Link from "next/link";

export type ShopContact = {
  whatsapp: string;
  phone: string;
  email: string;
  hours: string;
};

/**
 * Every support route in one place. When it is opened from an order, the
 * WhatsApp message is pre-filled with that order's reference so the customer
 * never has to find it and the shop knows immediately what the question is
 * about — the single biggest cause of back-and-forth on a phone-first shop.
 */
export default function SupportCard({
  contact,
  orderRef,
  compact = false,
}: {
  contact: ShopContact;
  orderRef?: string;
  compact?: boolean;
}) {
  const message = orderRef
    ? `Bonjour, j'ai une question sur ma commande ${orderRef}.`
    : "Bonjour, j'ai besoin d'aide pour trouver une pièce.";
  const wa = `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(message)}`;
  const tel = `tel:${contact.phone.replace(/[^\d+]/g, "")}`;

  if (compact) {
    return (
      <a
        href={wa}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 min-h-tap-compact text-sm font-semibold text-green-700 hover:underline"
      >
        <WhatsAppIcon /> Besoin d&apos;aide ?
      </a>
    );
  }

  return (
    <div className="p-4 sm:p-5 rounded-xl border border-gray-200 bg-white">
      <h2 className="font-heading font-extrabold uppercase text-navy-950 tracking-tight mb-1">Besoin d&apos;aide ?</h2>
      <p className="text-sm text-gray-500 mb-4">
        Une question sur {orderRef ? `la commande ${orderRef}` : "une pièce, une commande ou une livraison"} ? On répond
        vite. {contact.hours}
      </p>
      <div className="flex flex-col gap-2">
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 min-h-tap px-4 rounded-lg bg-green-600 hover:bg-green-500 text-white font-display font-bold uppercase text-xs tracking-wide"
        >
          <WhatsAppIcon /> Écrire sur WhatsApp
        </a>
        <a
          href={tel}
          className="flex items-center justify-center gap-2 min-h-tap px-4 rounded-lg border border-gray-300 text-navy-900 font-display font-bold uppercase text-xs tracking-wide"
        >
          Appeler <span dir="ltr" className="font-mono normal-case">{contact.phone}</span>
        </a>
        <a
          href={`mailto:${contact.email}`}
          className="flex items-center justify-center min-h-tap px-4 rounded-lg border border-gray-300 text-navy-900 text-sm"
        >
          {contact.email}
        </a>
        <Link href="/#magasin" className="flex items-center justify-center min-h-tap text-sm text-gray-500 underline">
          Voir l&apos;adresse du magasin
        </Link>
      </div>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm5.5 14.1c-.2.6-1.2 1.2-1.7 1.3-.5.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1-1.4-1-2.6 0-1.2.6-1.8.9-2.1.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2 0 .4-.1.5l-.3.4c-.1.1-.3.3-.1.6.1.3.6 1.1 1.4 1.7 1 .8 1.7 1 2 1.2.2.1.4.1.5-.1l.7-.8c.2-.2.4-.2.6-.1l1.8.8c.2.1.4.2.5.3 0 .1 0 .6-.3 1Z" />
    </svg>
  );
}
