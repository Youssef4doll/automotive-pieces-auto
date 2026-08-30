import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";
import { getBuyAgain } from "@/lib/data/account";
import { logout } from "@/app/actions/auth";
import AuthForms from "@/components/AuthForms";
import MyGarage from "@/components/MyGarage";
import SupportCard from "@/components/SupportCard";
import Price from "@/components/Price";
import OrderStatusTimeline from "@/components/OrderStatusTimeline";
import AccountShell from "@/components/account/AccountShell";
import BuyAgain from "@/components/account/BuyAgain";

export const metadata = { title: "Mon compte" };

const STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  PREPARED: "Préparée",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
};

const NEXT_STEP: Record<string, string> = {
  PENDING: "Nous confirmons votre commande, en général sous quelques heures.",
  CONFIRMED: "Nous préparons vos pièces.",
  PREPARED: "Prête — elle part à la livraison très prochainement.",
  SHIPPED: "En route. Le livreur vous appelle avant de passer.",
  DELIVERED: "Livrée. Un souci avec une pièce ? Écrivez-nous.",
};

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) return <AuthForms />;

  const [settings, lastOrder, orderCount, buyAgain, spend] = await Promise.all([
    getSettings(),
    prisma.order.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, ref: true, status: true, total: true, createdAt: true, governorate: true, deliveryMethod: true,
        history: { orderBy: { createdAt: "asc" }, select: { status: true, createdAt: true } },
        items: { select: { id: true, name: true, qty: true } },
      },
    }),
    prisma.order.count({ where: { userId: user.id } }),
    getBuyAgain(user.id),
    prisma.order.aggregate({
      where: { userId: user.id, status: { not: "CANCELLED" } },
      _sum: { total: true },
    }),
  ]);

  const contact = {
    whatsapp: settings.shop_whatsapp,
    phone: settings.shop_phone,
    email: settings.shop_email,
    hours: settings.shop_hours,
  };
  const inFlight = lastOrder && !["DELIVERED", "CANCELLED"].includes(lastOrder.status);

  return (
    <AccountShell
      title={`Bonjour ${user.name.split(" ")[0]}`}
      subtitle={
        orderCount > 0
          ? `${orderCount} commande${orderCount > 1 ? "s" : ""} · ${toNumber(spend._sum.total ?? 0).toFixed(2)} DT au total`
          : "Bienvenue — voici votre espace."
      }
      count={orderCount}
    >
      <div className="flex flex-col gap-4">
        {/* One question dominates this page: where is my order. It gets the
            top of the screen, full width, and nothing competes with it. */}
        {lastOrder ? (
          <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
              <div className="min-w-0">
                <p className="text-xs text-gray-400 uppercase font-bold">
                  {inFlight ? "Commande en cours" : "Dernière commande"}
                </p>
                <p className="font-mono font-bold text-navy-950 mt-0.5" dir="ltr">{lastOrder.ref}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {/* The time, not just the date: a freshly placed order has no
                      completed step yet, so without this the customer sees four
                      grey circles and nothing telling them it registered. */}
                  Passée le{" "}
                  {new Date(lastOrder.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                  {" à "}
                  {new Date(lastOrder.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  {" · "}
                  <Price value={toNumber(lastOrder.total)} className="inline" />
                  {" · "}
                  {lastOrder.deliveryMethod === "PICKUP" ? "Retrait en magasin" : `Livraison ${lastOrder.governorate}`}
                </p>
              </div>
              <span
                className={`text-xs font-bold px-3 py-1.5 rounded-full shrink-0 ${
                  lastOrder.status === "DELIVERED"
                    ? "bg-green-100 text-green-700"
                    : lastOrder.status === "CANCELLED"
                      ? "bg-red-100 text-red-700"
                      : "bg-gold-500/20 text-navy-900"
                }`}
              >
                {STATUS_LABEL[lastOrder.status]}
              </span>
            </div>

            {lastOrder.status !== "CANCELLED" && (
              <OrderStatusTimeline
                status={lastOrder.status}
                events={lastOrder.history.map((h) => ({ status: h.status, at: h.createdAt.toISOString() }))}
              />
            )}

            <p className="text-xs text-gray-500 mt-3">{NEXT_STEP[lastOrder.status]}</p>

            <div className="flex items-center gap-3 mt-4 pt-3 border-t flex-wrap">
              <Link
                href="/compte/commandes"
                className="inline-flex items-center min-h-tap px-4 rounded-lg bg-navy-900 hover:bg-navy-800 text-white font-display font-bold uppercase text-xs tracking-wide"
              >
                Suivre ma commande
              </Link>
              <SupportCard contact={contact} orderRef={lastOrder.ref} compact />
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center">
            <p className="text-3xl mb-2">🔧</p>
            <p className="font-medium text-navy-950 mb-1">Aucune commande pour le moment</p>
            <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
              Enregistrez votre voiture et nous ne vous montrerons que les pièces qui vont dessus.
            </p>
            <Link
              href="/"
              className="inline-flex items-center min-h-tap px-5 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 font-display font-bold uppercase text-xs tracking-wide"
            >
              Trouver ma pièce
            </Link>
          </section>
        )}

        <BuyAgain items={buyAgain} />

        {/* Two columns from lg: the garage drives the next purchase, support
            catches the questions that would otherwise become abandonment. */}
        <div className="grid lg:grid-cols-2 gap-4 [&>*]:min-w-0">
          <MyGarage />
          <SupportCard contact={contact} />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <p className="text-xs text-gray-400 uppercase font-bold mb-2">Mes informations</p>
          <p className="font-semibold text-navy-950">{user.name}</p>
          <p className="text-sm text-gray-500">{user.email}</p>
          {user.phone && <p className="text-sm text-gray-500" dir="ltr">{user.phone}</p>}
          <div className="flex gap-2 mt-4 flex-wrap">
            {user.role === "ADMIN" && (
              <Link
                href="/admin"
                className="inline-flex items-center min-h-tap px-4 rounded-lg bg-gold-500 text-navy-950 font-display font-bold uppercase text-xs tracking-wide"
              >
                Espace admin
              </Link>
            )}
            <form action={logout}>
              <button className="inline-flex items-center min-h-tap px-4 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium">
                Déconnexion
              </button>
            </form>
          </div>
        </div>
      </div>
    </AccountShell>
  );
}
