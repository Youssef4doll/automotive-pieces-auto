import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderByRef } from "@/app/actions/orders";
import { getCurrentUser } from "@/lib/session";
import { placedInThisBrowser } from "@/lib/order-access";
import { toNumber } from "@/lib/money";
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
  const order = await getOrderByRef(ref);
  if (!order) notFound();

  // References are sequential and printed on this very page, so knowing one
  // proves nothing. Either you are signed in as the customer, or you are the
  // browser that placed it — otherwise this order is not found for you.
  const user = await getCurrentUser();
  const mine = (user && order.userId === user.id) || (await placedInThisBrowser(order.id));
  if (!mine) notFound();

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-3xl mx-auto mb-5">✓</div>
      <h1 className="text-2xl font-heading font-extrabold uppercase text-navy-950 mb-2 tracking-tight">Commande confirmée !</h1>
      <p className="text-gray-600 mb-1">Merci pour votre confiance. Nous préparons votre commande.</p>
      <p className="text-sm text-gray-400 mb-6">
        Numéro de commande : <span className="font-mono font-bold text-navy-900" dir="ltr">{order.ref}</span>
      </p>

      {/* The question a customer has the second after paying is "what happens
          now?". Showing the same tracker their account page uses answers it
          here, at the moment it is asked, instead of making them go looking. */}
      <section className="text-start p-4 rounded-xl border border-gray-200 bg-white mb-4">
        <h2 className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-gray-400 mb-3">
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
        <div className="border-t mt-2 pt-2 flex justify-between font-bold text-navy-900">
          <span>Total</span>
          <Price value={toNumber(order.total)} />
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
        <Link href="/" className="px-5 py-3 rounded-lg border border-gray-300 text-navy-900 font-semibold">
          Continuer mes achats
        </Link>
      </div>
    </div>
  );
}
