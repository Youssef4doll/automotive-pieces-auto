import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getOrderByRef } from "@/app/actions/orders";
import { getSettings, publicContact } from "@/lib/settings";
import { toNumber, formatTNDfr } from "@/lib/money";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import PrintButton from "@/components/PrintButton";

/**
 * The order on paper.
 *
 * The shop had nothing printable at all: a customer had a web page they could
 * not file, and the person packing the box worked off a screen. This one
 * document serves both — the customer prints it as their record, the shop
 * prints it as the note that travels with the parcel — because they contain
 * the same facts and maintaining two that can disagree is worse than one.
 *
 * **It is a "Reçu", not a "Facture", unless the shop has a matricule fiscal.**
 * In Tunisia an invoice carries the seller's tax number; a document titled
 * "Facture" without one is not an invoice, and printing that word on it
 * anyway would be a false claim on a piece of paper a customer might file for
 * their own accounts. Fill `shop_tax_id` in /admin/parametres and this
 * becomes a facture, with the matricule on it, automatically.
 *
 * Access is `getOrderByRef`'s, not this page's: the owner, the browser that
 * placed a guest order, or an admin. A guessed reference 404s.
 */

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref } = await params;
  return {
    title: `Reçu ${ref}`,
    // One customer, one order, once. Never a search result.
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  };
}

const PAYMENT_LABEL: Record<string, string> = {
  COD: "Paiement à la livraison (espèces)",
  CARD: "Carte bancaire",
};

export default async function ReceiptPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const [order, settings] = await Promise.all([getOrderByRef(ref), getSettings()]);
  if (!order) notFound();

  const contact = publicContact(settings);
  const taxId = settings.shop_tax_id.trim();
  const isInvoice = taxId.length > 0;
  const title = isInvoice ? "Facture" : "Reçu";

  const subtotal = toNumber(order.subtotal);
  const shipping = toNumber(order.shippingFee);
  const total = toNumber(order.total);
  const placed = new Date(order.createdAt).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    // `print:` utilities strip the page chrome so what comes out of the printer
    // is the document and nothing else — no header, no nav, no shadows, no
    // rounded corners that render as grey boxes on a cheap laser printer.
    <div className="mx-auto max-w-3xl px-4 py-8 print:px-0 print:py-0 print:max-w-none">
      <div className="flex items-center justify-between gap-3 mb-6 print:hidden">
        <a href={`/compte/commandes/${order.ref}`} className="text-sm text-navy-900 hover:text-red-600 font-semibold">
          ← Retour à la commande
        </a>
        <PrintButton />
      </div>

      <article className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 print:border-0 print:rounded-none print:p-0">
        {/* ------------------------------------------------------- header */}
        <header className="flex flex-wrap items-start justify-between gap-6 pb-6 border-b-2 border-navy-900">
          <div className="min-w-0">
            <p className="font-heading font-extrabold uppercase tracking-tight text-xl text-navy-950">
              {contact.name}
            </p>
            {/* Every one of these is omitted rather than filled with a
                placeholder — the same rule the storefront follows, and it
                matters more here because this gets printed and kept. */}
            <div className="text-[13px] text-slate-600 mt-1 leading-relaxed">
              {contact.address && <p>{contact.address}</p>}
              {contact.phone && <p dir="ltr">{contact.phone}</p>}
              {contact.email && <p dir="ltr">{contact.email}</p>}
              {isInvoice && <p>Matricule fiscal : {taxId}</p>}
            </div>
          </div>
          <div className="text-end shrink-0">
            <p className="font-heading font-extrabold uppercase tracking-tight text-2xl text-navy-950">{title}</p>
            <p className="font-mono font-bold text-navy-900 mt-1" dir="ltr">
              {order.ref}
            </p>
            <p className="text-[13px] text-slate-600 mt-1">{placed}</p>
            <p className="text-[13px] text-slate-600">{ORDER_STATUS_LABEL[order.status]}</p>
          </div>
        </header>

        {/* ----------------------------------------------------- customer */}
        <section className="grid sm:grid-cols-2 gap-6 py-6 border-b border-slate-200">
          <div>
            <h2 className="text-[11px] font-display font-bold uppercase tracking-wide text-slate-500 mb-1.5">
              Client
            </h2>
            <p className="text-sm font-semibold text-navy-950">{order.customerName}</p>
            <p className="text-sm text-slate-600" dir="ltr">
              {order.phone}
            </p>
            {order.email && (
              <p className="text-sm text-slate-600" dir="ltr">
                {order.email}
              </p>
            )}
          </div>
          <div>
            <h2 className="text-[11px] font-display font-bold uppercase tracking-wide text-slate-500 mb-1.5">
              {order.deliveryMethod === "PICKUP" ? "Retrait" : "Livraison"}
            </h2>
            {order.deliveryMethod === "PICKUP" ? (
              <p className="text-sm text-slate-600">En magasin</p>
            ) : (
              <p className="text-sm text-slate-600">
                {order.address ? `${order.address}, ` : ""}
                {order.governorate}
              </p>
            )}
            <p className="text-sm text-slate-600 mt-1">
              {PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}
            </p>
          </div>
        </section>

        {/* -------------------------------------------------------- lines */}
        <table className="w-full text-sm mt-6">
          <thead>
            <tr className="text-[11px] font-display font-bold uppercase tracking-wide text-slate-500">
              <th className="text-start pb-2">Désignation</th>
              <th className="text-end pb-2 w-16">Qté</th>
              <th className="text-end pb-2 w-28">P.U.</th>
              <th className="text-end pb-2 w-28">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-t border-slate-200">
                <td className="py-2.5 pe-3">
                  <span className="block font-semibold text-navy-950">{item.name}</span>
                  <span className="block text-[12px] text-slate-500" dir="ltr">
                    {item.sku}
                  </span>
                </td>
                <td className="py-2.5 text-end tabular-nums">{item.qty}</td>
                <td className="py-2.5 text-end tabular-nums whitespace-nowrap">
                  {formatTNDfr(toNumber(item.unitPrice))}
                </td>
                <td className="py-2.5 text-end tabular-nums whitespace-nowrap font-semibold">
                  {formatTNDfr(toNumber(item.lineTotal))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ------------------------------------------------------- totals */}
        <div className="flex justify-end mt-4">
          <table className="text-sm w-full sm:w-72">
            <tbody>
              <tr>
                <td className="py-1 text-slate-600">Sous-total</td>
                <td className="py-1 text-end tabular-nums">{formatTNDfr(subtotal)}</td>
              </tr>
              <tr>
                <td className="py-1 text-slate-600">
                  {order.deliveryMethod === "PICKUP" ? "Retrait en magasin" : "Livraison"}
                </td>
                <td className="py-1 text-end tabular-nums">
                  {shipping > 0 ? formatTNDfr(shipping) : "Offerte"}
                </td>
              </tr>
              <tr className="border-t-2 border-navy-900">
                <td className="pt-2 font-heading font-extrabold uppercase text-navy-950">Total</td>
                <td className="pt-2 text-end font-heading font-extrabold text-navy-950 tabular-nums">
                  {formatTNDfr(total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {order.notes && (
          <p className="mt-6 text-sm text-slate-600">
            <span className="font-semibold text-navy-950">Note :</span> {order.notes}
          </p>
        )}

        {/* Says what the document is, without claiming to be more. A cash-on-
            delivery order is not paid at the moment this is printed, and the
            paper must not imply that it is. */}
        <footer className="mt-8 pt-4 border-t border-slate-200 text-[12px] text-slate-500 leading-relaxed">
          {order.paymentMethod === "COD" ? (
            <p>
              Document récapitulatif de la commande {order.ref}. Le règlement s&apos;effectue en espèces à la
              livraison ; ce document ne vaut pas preuve de paiement.
            </p>
          ) : (
            <p>Document récapitulatif de la commande {order.ref}.</p>
          )}
          {!isInvoice && (
            // Visible to the shop, not a warning at the customer: it reads as
            // an ordinary statement of what the document is.
            <p className="mt-1">
              Pour une facture avec matricule fiscal, renseignez-le dans les paramètres de la boutique.
            </p>
          )}
        </footer>
      </article>
    </div>
  );
}
