import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { toNumber, formatTNDfr } from "@/lib/money";
import { getBuyAgain, getShoppableFamilies, getOrderCounts, contactFrom } from "@/lib/data/account";
import AuthForms from "@/components/AuthForms";
import AccountShell from "@/components/account/AccountShell";
import OrderTracker from "@/components/account/OrderTracker";
import QuickActions from "@/components/account/QuickActions";
import GarageSection from "@/components/account/GarageSection";
import ShopForCar from "@/components/account/ShopForCar";
import BuyAgain from "@/components/account/BuyAgain";
import { StatusBadge, NEXT_STEP, OrderRow, TrustPanel, HelpPanel } from "@/components/account/OrderBits";
import { IconArrowRight, IconPackage } from "@/components/account/icons";

export const metadata = { title: "Mon compte" };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) return <AuthForms />;

  const [settings, orders, counts, buyAgain, families, spend] = await Promise.all([
    getSettings(),
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: {
        id: true, ref: true, status: true, total: true, createdAt: true,
        governorate: true, deliveryMethod: true,
        history: { orderBy: { createdAt: "asc" }, select: { status: true, createdAt: true } },
        items: { select: { id: true, name: true, qty: true } },
      },
    }),
    getOrderCounts(user.id),
    getBuyAgain(user.id, 6),
    getShoppableFamilies(8),
    prisma.order.aggregate({
      where: { userId: user.id, status: { not: "CANCELLED" } },
      _sum: { total: true },
    }),
  ]);

  const contact = contactFrom(settings);
  const firstName = user.name.split(" ")[0];
  // "Active" means still moving. A delivered order is history, not a task.
  const active = orders.find((o) => !["DELIVERED", "CANCELLED"].includes(o.status)) ?? null;
  const recent = orders.filter((o) => o.id !== active?.id).slice(0, 3);

  return (
    <AccountShell
      title={`Bonjour, ${firstName} 👋`}
      subtitle="Voici ce qui se passe avec votre voiture et vos commandes."
      user={{ name: user.name, email: user.email, role: user.role }}
      orderCount={counts.total}
      activeOrders={counts.active}
      whatsapp={contact.whatsapp}
    >
      <div className="flex flex-col gap-4 lg:gap-5">
        {/* ---------- hero: the live order ---------- */}
        {active ? (
          <section
            aria-labelledby="active-order"
            className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
          >
            <div className="px-5 pt-5 pb-4 sm:px-6 border-b border-slate-100">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p id="active-order" className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-slate-400">
                    Commande en cours
                  </p>
                  <p className="font-mono font-bold text-xl sm:text-2xl text-navy-950 mt-1" dir="ltr">{active.ref}</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Passée le{" "}
                    {new Date(active.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                    {" à "}
                    {new Date(active.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    <span className="font-semibold text-navy-950">{formatTNDfr(toNumber(active.total))}</span>
                    {" · "}
                    {active.deliveryMethod === "PICKUP" ? "Retrait en magasin" : `Livraison ${active.governorate}`}
                  </p>
                </div>
                <StatusBadge status={active.status} />
              </div>
            </div>

            <div className="px-5 py-5 sm:px-6">
              {/* Compact on purpose: the dashboard answers "where is it?" in a
                  glance and keeps the CTA above the fold. The full timeline
                  lives on the order page, which is where you go to read it. */}
              <OrderTracker
                status={active.status}
                placedAt={active.createdAt.toISOString()}
                events={active.history.map((h) => ({ status: h.status, at: h.createdAt.toISOString() }))}
                compact
              />

              <p className="text-sm text-slate-600 mt-4 leading-relaxed">{NEXT_STEP[active.status]}</p>

              <div className="flex flex-wrap items-center gap-2 mt-5">
                <Link
                  href={`/compte/commandes/${active.ref}`}
                  className="inline-flex items-center gap-2 min-h-tap px-5 rounded-xl bg-navy-950 hover:bg-navy-800 text-white font-display font-bold uppercase text-xs tracking-wide transition-colors"
                >
                  Suivre ma commande <IconArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/compte/commandes"
                  className="inline-flex items-center min-h-tap px-4 rounded-xl border border-slate-300 text-navy-900 text-sm font-semibold hover:border-navy-700 transition-colors"
                >
                  Voir les détails
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <span className="inline-grid place-items-center w-12 h-12 rounded-full bg-slate-100 text-slate-400 mb-3">
              <IconPackage />
            </span>
            <p className="font-semibold text-navy-950 mb-1">
              {counts.total > 0 ? "Aucune commande en cours" : "Aucune commande pour le moment"}
            </p>
            <p className="text-sm text-slate-500 mb-4 max-w-sm mx-auto">
              {counts.total > 0
                ? "Vos commandes récentes restent accessibles ci-dessous."
                : "Votre prochain achat apparaîtra ici."}
            </p>
            <Link
              href="/recherche"
              className="inline-flex items-center gap-2 min-h-tap px-5 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-display font-bold uppercase text-xs tracking-wide"
            >
              Trouver une pièce
            </Link>
          </section>
        )}

        <QuickActions whatsapp={contact.whatsapp} />

        <GarageSection />

        <ShopForCar categories={families} />

        <BuyAgain items={buyAgain} />

        {recent.length > 0 && (
          <section aria-labelledby="recent" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
              <h2 id="recent" className="font-heading font-extrabold uppercase text-navy-950 tracking-tight">
                Mes commandes
              </h2>
              <Link
                href="/compte/commandes"
                className="inline-flex items-center gap-1 min-h-tap-compact text-xs font-semibold text-navy-900 hover:text-red-600"
              >
                Voir toutes mes commandes <IconArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="flex flex-col divide-y divide-slate-100">
              {recent.map((o) => (
                <OrderRow
                  key={o.id}
                  order={{
                    ref: o.ref,
                    status: o.status,
                    total: toNumber(o.total),
                    createdAt: o.createdAt.toISOString(),
                  }}
                />
              ))}
            </div>
          </section>
        )}

        <div className="grid lg:grid-cols-2 gap-4 lg:gap-5 [&>*]:min-w-0">
          <HelpPanel contact={contact} orderRef={active?.ref} />
          <TrustPanel />
        </div>

        {counts.total > 0 && (
          <p className="text-xs text-slate-400 text-center">
            {counts.total} commande{counts.total > 1 ? "s" : ""} · {formatTNDfr(toNumber(spend._sum.total ?? 0))} depuis votre
            inscription
          </p>
        )}
      </div>
    </AccountShell>
  );
}
