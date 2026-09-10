import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { getOrderCounts, contactFrom } from "@/lib/data/account";
import { logout } from "@/app/actions/auth";
import AccountShell from "@/components/account/AccountShell";
import GarageSection from "@/components/account/GarageSection";
import { ProfileCard, PasswordCard } from "@/components/account/ProfileForms";
import { IconArrowRight, IconWhatsApp } from "@/components/account/icons";

export const metadata = { title: "Mon profil" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/compte");

  const [settings, counts, lastOrder] = await Promise.all([
    getSettings(),
    getOrderCounts(user.id),
    // The delivery address is not a stored profile field — it is captured per
    // order. Showing the most recent one is truthful; inventing an address book
    // that the backend does not have would not be.
    prisma.order.findFirst({
      where: { userId: user.id, deliveryMethod: "DELIVERY" },
      orderBy: { createdAt: "desc" },
      select: { governorate: true, address: true, phone: true, createdAt: true },
    }),
  ]);
  const contact = contactFrom(settings);

  return (
    <AccountShell
      title="Mon profil"
      subtitle="Vos informations, vos véhicules et votre session."
      user={{ name: user.name, email: user.email, role: user.role }}
      orderCount={counts.total}
      activeOrders={counts.active}
      whatsapp={contact.whatsapp}
    >
      <div className="flex flex-col gap-4 lg:gap-5">
        <ProfileCard
          name={user.name}
          email={user.email}
          phone={user.phone}
          memberSince={new Date(user.createdAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
        />

        <PasswordCard />

        <section aria-labelledby="adresse" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 id="adresse" className="font-heading font-extrabold uppercase text-navy-950 tracking-tight mb-4">
            Mon adresse de livraison
          </h2>
          {lastOrder ? (
            <>
              <dl className="grid sm:grid-cols-2 gap-4">
                <Field label="Gouvernorat" value={lastOrder.governorate} />
                {lastOrder.address && <Field label="Adresse" value={lastOrder.address} />}
                {lastOrder.phone && <Field label="Téléphone de livraison" value={lastOrder.phone} dir="ltr" />}
              </dl>
              <p className="text-xs text-slate-400 mt-4">
                Reprise de votre dernière commande. Elle est pré-remplie à chaque nouvelle commande et vous pouvez la
                modifier à ce moment-là.
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Aucune adresse enregistrée pour l&apos;instant. Elle sera mémorisée à votre première commande livrée.
            </p>
          )}
        </section>

        <GarageSection compact />

        <section aria-labelledby="assistance" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 id="assistance" className="font-heading font-extrabold uppercase text-navy-950 tracking-tight mb-3">
            Communication
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            Nous vous contactons par téléphone ou WhatsApp au sujet de vos commandes : confirmation, préparation et
            livraison. Nous n&apos;envoyons pas de messages publicitaires.
          </p>
          <a
            href={`https://wa.me/${contact.whatsapp}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 min-h-tap px-4 rounded-xl border border-slate-300 text-navy-900 text-sm font-semibold hover:border-green-400 hover:text-green-700 transition-colors"
          >
            <IconWhatsApp className="text-green-600" /> Nous écrire
          </a>
        </section>

        <section aria-labelledby="session" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 id="session" className="font-heading font-extrabold uppercase text-navy-950 tracking-tight mb-3">
            Session
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            Vous êtes connecté en tant que <span className="font-semibold text-navy-950">{user.email}</span>. Votre
            panier est conservé, vous le retrouverez à votre prochaine connexion.
          </p>
          <div className="flex flex-wrap gap-2">
            {/* The primary control on this card, not a grey outline tucked in a
                corner: logging out is the one thing a shared or borrowed phone
                needs to be able to do without hunting. */}
            <form action={logout}>
              <button className="inline-flex items-center gap-2 min-h-tap px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-display font-bold uppercase text-xs tracking-wide">
                <IconLogout /> Se déconnecter
              </button>
            </form>
            {user.role === "ADMIN" && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 min-h-tap px-4 rounded-xl border border-slate-300 text-navy-900 text-sm font-semibold hover:border-navy-900 transition-colors"
              >
                Espace admin <IconArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </section>
      </div>
    </AccountShell>
  );
}

function IconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function Field({ label, value, dir }: { label: string; value: string; dir?: "ltr" }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-display font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm text-navy-950 mt-0.5 break-words" dir={dir}>
        {value}
      </dd>
    </div>
  );
}
