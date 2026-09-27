import { prisma } from "@/lib/prisma";
import { formatTND, toNumber } from "@/lib/money";
import PromoCodeForm from "@/components/admin/PromoCodeForm";
import PromoCodeActions from "@/components/admin/PromoCodeRow";

export const metadata = { title: "Codes promo" };

const dateFr = (d: Date | null) => (d ? d.toLocaleDateString("fr-FR", { timeZone: "Africa/Tunis" }) : null);

/**
 * Promo codes: what exists, what each has cost, and a form for a new one.
 *
 * The uses and the total given away are counted from the orders themselves
 * (cancelled ones left out) — the same count the checkout checks a limit
 * against, so the number here is the number that will refuse the next order.
 */
export default async function AdminPromoCodesPage() {
  const [codes, usage] = await Promise.all([
    prisma.promoCode.findMany({ orderBy: [{ active: "desc" }, { createdAt: "desc" }] }),
    prisma.order.groupBy({
      by: ["promoCodeId"],
      where: { promoCodeId: { not: null }, status: { not: "CANCELLED" } },
      _count: { _all: true },
      _sum: { discount: true },
    }),
  ]);
  const usageById = new Map(usage.map((u) => [u.promoCodeId, { n: u._count._all, given: toNumber(u._sum.discount ?? 0) }]));
  const now = new Date();

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">Codes promo</h1>
        <p className="text-sm text-navy-900/50 mt-1">
          Des codes à donner aux clients (réseaux sociaux, garages partenaires, fidélité). Le site et l&rsquo;application
          les acceptent au paiement ; la remise est toujours calculée ici, par le serveur.
        </p>
      </div>

      <div className="rounded-xl border border-navy-900/10 bg-white shadow-sm p-5">
        <h2 className="font-display font-bold uppercase tracking-wide text-sm text-navy-950 mb-4">Nouveau code</h2>
        <PromoCodeForm />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display font-bold uppercase tracking-wide text-sm text-navy-950">
          Codes
          <span className="ms-2 font-sans font-semibold text-navy-900/35 normal-case tracking-normal">{codes.length}</span>
        </h2>
        {codes.length === 0 ? (
          <p className="text-sm text-navy-900/50">Aucun code pour l&rsquo;instant.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {codes.map((c) => {
              const u = usageById.get(c.id) ?? { n: 0, given: 0 };
              const expired = c.endsAt != null && c.endsAt < now;
              const soon = c.startsAt != null && c.startsAt > now;
              const full = c.maxUses != null && u.n >= c.maxUses;
              const state = !c.active ? "Désactivé" : expired ? "Expiré" : full ? "Épuisé" : soon ? "À venir" : "Actif";
              const live = state === "Actif";
              return (
                <li key={c.id} className="rounded-xl border border-navy-900/10 bg-white p-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-navy-950">{c.code}</span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${live ? "bg-green-100 text-green-800" : "bg-navy-900/5 text-navy-900/50"}`}>
                        {state}
                      </span>
                    </div>
                    <p className="text-sm text-navy-900/70">
                      {c.kind === "PERCENT" ? `−${toNumber(c.value)} %` : `−${formatTND(toNumber(c.value))}`} sur les pièces
                      {c.minSubtotal != null && ` · dès ${formatTND(toNumber(c.minSubtotal))}`}
                      {(c.startsAt || c.endsAt) &&
                        ` · ${c.startsAt ? `du ${dateFr(c.startsAt)} ` : ""}${c.endsAt ? `au ${dateFr(c.endsAt)}` : ""}`}
                    </p>
                    <p className="text-xs text-navy-900/45">
                      {u.n} utilisation{u.n > 1 ? "s" : ""}
                      {c.maxUses != null && ` sur ${c.maxUses}`} · {formatTND(u.given)} de remise accordée
                      {c.note && ` · ${c.note}`}
                    </p>
                  </div>
                  <PromoCodeActions id={c.id} active={c.active} used={u.n} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
