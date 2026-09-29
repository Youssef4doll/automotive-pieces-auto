import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getOrderByRef } from "@/app/actions/orders";
import { getCurrentUser } from "@/lib/session";
import { returnsForOrder } from "@/lib/returns";
import ReturnForm from "@/components/returns/ReturnForm";

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref } = await params;
  return { title: `Retourner une pièce — ${ref}`, robots: { index: false, follow: false } };
}

/**
 * "Retourner une pièce" on the website — the same request the app files,
 * through the same rules. Served to whoever may read the order (its owner
 * signed in, or the browser that placed or looked it up), like the order
 * page itself.
 */
export default async function ReturnPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const order = await getOrderByRef(ref);
  if (!order) notFound();
  const user = await getCurrentUser();
  const back = user && order.userId === user.id ? `/compte/commandes/${order.ref}` : `/commande/confirmation/${order.ref}`;
  const { options } = await returnsForOrder(order.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <Link href={back} className="text-sm font-semibold text-navy-900 underline underline-offset-2">
        ← Commande {order.ref}
      </Link>
      <h1 className="mt-3 font-heading text-2xl font-extrabold uppercase tracking-tight text-navy-950 sm:text-3xl">Retourner une pièce</h1>
      {!options ? (
        <p className="mt-4 text-gray-700">
          Un retour se demande une fois la commande livrée. Tant qu&apos;elle ne l&apos;est pas, écrivez-nous en indiquant son
          numéro : nous pouvons encore la modifier.
        </p>
      ) : (
        <ReturnForm
          orderRef={order.ref}
          back={back}
          vehicleLabel={order.vehicleLabel}
          reasons={options.reasons}
          lines={order.items.map((i) => ({
            orderItemId: i.id,
            name: i.name,
            sku: i.sku,
            qty: i.qty,
            returnable: options.items.find((x) => x.orderItemId === i.id)?.returnable ?? 0,
          }))}
        />
      )}
    </div>
  );
}
