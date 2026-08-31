import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { getOrderCounts, contactFrom, getBuyAgain } from "@/lib/data/account";
import AccountShell from "@/components/account/AccountShell";
import { initialsOf } from "@/lib/initials";
import BuyAgain from "@/components/account/BuyAgain";
import { IconPackage } from "@/components/account/icons";

export const metadata = { title: "Mes pièces" };

export default async function MyPartsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/compte");

  const [settings, counts, parts] = await Promise.all([
    getSettings(),
    getOrderCounts(user.id),
    // No cap: this page exists to show the whole history, not a preview of it.
    getBuyAgain(user.id, 60),
  ]);
  const contact = contactFrom(settings);

  return (
    <AccountShell
      title="Mes pièces"
      subtitle="Tout ce que vous avez déjà commandé, prêt à être racheté."
      initials={initialsOf(user.name)}
      orderCount={counts.total}
      activeOrders={counts.active}
      whatsapp={contact.whatsapp}
    >
      {parts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-12 text-center">
          <span className="inline-grid place-items-center w-12 h-12 rounded-full bg-slate-100 text-slate-400 mb-3">
            <IconPackage />
          </span>
          <p className="font-semibold text-navy-950 mb-1">Aucune pièce pour le moment</p>
          <p className="text-sm text-slate-500 mb-4">
            Les pièces que vous commandez apparaîtront ici, prêtes à être rachetées.
          </p>
          <Link
            href="/recherche"
            className="inline-flex items-center min-h-tap px-5 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-display font-bold uppercase text-xs tracking-wide"
          >
            Trouver une pièce
          </Link>
        </div>
      ) : (
        <BuyAgain items={parts} title="Vos pièces" showLink={false} />
      )}
    </AccountShell>
  );
}
