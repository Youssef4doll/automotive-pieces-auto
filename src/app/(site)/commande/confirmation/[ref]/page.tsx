import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderByRef } from "@/app/actions/orders";
import { toNumber, formatTND } from "@/lib/money";
import { taxBreakdown, vatRateLabel } from "@/lib/tax";
import Price from "@/components/Price";
import type { Metadata } from "next";
import OrderTracker from "@/components/account/OrderTracker";
import { NEXT_STEP } from "@/components/account/OrderBits";

// Never indexed and never followed: this page exists for one customer, once.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ ref: string }>;
}): Promise<Metadata> {
  const { ref } = await params;
  return {
    title: `Commande ${ref} confirmée`,
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  };
}

export default async function ConfirmationPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  // References are sequential and printed on this very page, so knowing one
  // proves nothing. getOrderByRef returns the order only to the customer who
  // owns it or the browser that placed it — the check lives inside the lookup
  // rather than here, because that file is "use server" and every export in it
  // is reachable on its own, page guard or no page guard.
  const order = await getOrderByRef(ref);
  if (!order) notFound();

  const shipping = toNumber(order.shippingFee);
  const tax = taxBreakdown({
    subtotal: toNumber(order.subtotal),
    shippingFee: shipping,
    vatRate: toNumber(order.vatRate),
    stampDuty: toNumber(order.stampDuty),
  });

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-3xl mx-auto mb-5">✓</div>
      <h1 className="text-2xl font-heading font-extrabold uppercase text-navy-950 mb-2 tracking-tight">Commande confirmée !</h1>
      <p className="text-gray-600 mb-1">Merci pour votre confiance. Nous préparons votre commande.</p>
      <p className="text-sm text-gray-600 mb-6">
        Numéro de commande : <span className="font-mono font-bold text-navy-900" dir="ltr">{order.ref}</span>
      </p>

      {/* The question a customer has the second after paying is "what happens
          now?". Showing the same tracker their account page uses answers it
          here, at the moment it is asked, instead of making them go looking. */}
      <section className="text-start p-4 rounded-xl border border-gray-200 bg-white mb-4">
        <h2 className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-gray-600 mb-3">
          Suivi de votre commande
        </h2>
        <OrderTracker
          status={order.status}
          placedAt={order.createdAt.toISOString()}
          events={order.history.map((h) => ({ status: h.status, at: h.createdAt.toISOString() }))}
        />
        <p className="text-sm text-gray-600 mt-4">{NEXT_STEP[order.status]}</p>
      </section>

      <div className="text-start p-4 rounded-xl border border-gray-200 bg-white mb-6">
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm py-1">
            <span className="text-gray-600">{item.qty}× {item.name}</span>
            <Price value={toNumber(item.lineTotal)} className="font-medium" />
          </div>
        ))}
        {/* Everything between the parts and the total, named. This block
            listed the lines and then a larger Total with nothing in between,
            which is exactly the gap the question "why 22,20 and not 13,20?"
            lives in — and the timbre fiscal made it wider. */}
        <div className="border-t mt-2 pt-2 flex flex-col gap-1 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>{order.deliveryMethod === "PICKUP" ? "Retrait en magasin" : "Livraison"}</span>
            <span>{shipping > 0 ? <Price value={shipping} /> : "Offerte"}</span>
          </div>
          {tax.stampDuty > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Timbre fiscal</span>
              <Price value={tax.stampDuty} />
            </div>
          )}
          <div className="flex justify-between font-bold text-navy-900 pt-1">
            <span>{tax.taxed ? "Total TTC" : "Total"}</span>
            <Price value={toNumber(order.total)} />
          </div>
          {/* Below the total, not in the column above it: the TVA is already
              inside every figure there, and a row that is not added to the
              ones around it does not belong among them. The facture states
              the same amount properly broken out. */}
          {tax.taxed && (
            <p className="text-xs text-gray-500">
              dont TVA {vatRateLabel(tax.vatRate)} : {formatTND(tax.vat)}
            </p>
          )}
        </div>
      </div>

      {/* Offered after the order, never before it. A guest has just proved
          they wanted to buy; this is the moment an account is worth something
          to them rather than an obstacle in front of the checkout. */}
      {!order.userId && (
        <section className="text-start p-4 rounded-xl border border-gray-200 bg-white mb-6">
          <h2 className="font-heading font-extrabold uppercase text-navy-950 tracking-tight">
            Créer votre compte ?
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Avec un compte vous pouvez suivre cette commande, enregistrer votre véhicule pour ne voir
            que les pièces compatibles, retrouver vos achats et commander plus vite la prochaine fois.
          </p>
          <Link
            href="/compte"
            className="inline-flex items-center justify-center min-h-tap px-5 mt-3 rounded-lg border border-navy-900 text-navy-900 font-semibold text-sm hover:bg-navy-50 transition-colors"
          >
            Créer mon compte
          </Link>
        </section>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/compte/commandes" className="px-5 py-3 rounded-lg bg-navy-900 text-white font-semibold">
          Suivre ma commande
        </Link>
        {/* A guest checking out has no account to come back to; this page and
            the cookie behind it are the only record they have, so the way to
            keep one belongs here rather than only in the account area. */}
        <Link href={`/commande/${order.ref}/recu`} className="px-5 py-3 rounded-lg border border-gray-300 text-navy-900 font-semibold">
          Reçu à imprimer
        </Link>
        <Link href="/" className="px-5 py-3 rounded-lg border border-gray-300 text-navy-900 font-semibold">
          Continuer mes achats
        </Link>
      </div>
    </div>
  );
}
