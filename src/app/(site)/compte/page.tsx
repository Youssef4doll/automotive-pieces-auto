import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";
import { logout } from "@/app/actions/auth";
import AuthForms from "@/components/AuthForms";
import MyGarage from "@/components/MyGarage";
import SupportCard from "@/components/SupportCard";
import Price from "@/components/Price";

export const metadata = { title: "Mon compte" };

const STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  PREPARED: "Préparée",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
};

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user) {
    return <AuthForms />;
  }

  const [settings, lastOrder, orderCount] = await Promise.all([
    getSettings(),
    prisma.order.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, ref: true, status: true, total: true, createdAt: true },
    }),
    prisma.order.count({ where: { userId: user.id } }),
  ]);

  const contact = {
    whatsapp: settings.shop_whatsapp,
    phone: settings.shop_phone,
    email: settings.shop_email,
    hours: settings.shop_hours,
  };

  return (
    <div className="mx-auto max-w-md px-4 py-8 flex flex-col gap-4">
      <div className="p-5 rounded-xl border border-gray-200 bg-white">
        <p className="text-xs text-gray-400 uppercase font-bold mb-1">Mon compte</p>
        <p className="font-bold text-navy-950 text-lg">{user.name}</p>
        <p className="text-sm text-gray-500">{user.email}</p>
        {user.phone && <p className="text-sm text-gray-500" dir="ltr">{user.phone}</p>}
      </div>

      {/* The one thing a customer opens this page to check is "where is my
          order" — so it answers that before anything else. */}
      {lastOrder && (
        <Link
          href="/compte/commandes"
          className="p-4 rounded-xl border border-gray-200 bg-white hover:border-navy-300 flex items-center gap-3"
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 uppercase font-bold mb-0.5">Dernière commande</p>
            <p className="font-mono font-bold text-navy-950 text-sm" dir="ltr">{lastOrder.ref}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {new Date(lastOrder.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} ·{" "}
              <Price value={toNumber(lastOrder.total)} className="inline" />
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
        </Link>
      )}

      <MyGarage />

      <div className="flex flex-col gap-2">
        <Link
          href="/compte/commandes"
          className="flex items-center justify-center min-h-tap px-4 rounded-lg bg-navy-900 text-white font-semibold"
        >
          Mes commandes{orderCount > 0 ? ` (${orderCount})` : ""}
        </Link>
        {user.role === "ADMIN" && (
          <Link
            href="/admin"
            className="flex items-center justify-center min-h-tap px-4 rounded-lg bg-gold-500 text-navy-950 font-semibold"
          >
            Espace admin
          </Link>
        )}
      </div>

      <SupportCard contact={contact} />

      <form action={logout}>
        <button className="w-full min-h-tap px-4 rounded-lg border border-gray-300 text-gray-600 font-medium">
          Déconnexion
        </button>
      </form>
    </div>
  );
}
