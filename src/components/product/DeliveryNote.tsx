import { IconTruck, IconShield, IconReturn, IconBanknote } from "@/components/icons";
import { FLAT_DELIVERY_FEE } from "@/lib/shipping";
import { formatTND } from "@/lib/money";
import type { Availability } from "@/lib/availability";

/**
 * What happens after "Ajouter au panier", under the button that asks for it.
 *
 * The reference pages this was built against all carry a dispatch line here —
 * *Ready for dispatch Friday (18.09) from €9.90*. This one deliberately does
 * **not** name a day, and that is worth explaining rather than leaving as an
 * omission:
 *
 * A dated promise needs two things the shop has not given anyone — a daily
 * dispatch cut-off, and a working calendar (Sunday, jours fériés). Without
 * them "vendredi 18.09" is arithmetic dressed as a commitment, and on cash on
 * delivery a date the shop misses is not a disappointed customer, it is a
 * courier at a door with nobody expecting him and an order that comes back.
 *
 * Every figure below is one the shop has actually stated: the two delivery
 * windows and the free-delivery threshold from /admin/parametres, the flat fee
 * from lib/shipping — the same number the cart and the checkout charge. Fill
 * in a dispatch cut-off one day and a date can be derived honestly; until then
 * the window is the strongest true thing available.
 */
export default function DeliveryNote({
  availability,
  grandTunis,
  regions,
  freeShippingThreshold,
  leadTime,
}: {
  availability: Availability;
  grandTunis: string;
  regions: string;
  freeShippingThreshold: number;
  /** `supplier_lead_time`, for a part that has to be ordered in first. */
  leadTime?: string | null;
}) {
  if (availability === "UNAVAILABLE") return null;
  const lead = leadTime?.trim() || null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-navy-900/10 bg-slate-50/70 p-4">
      <div className="flex items-start gap-3">
        <IconTruck className="mt-0.5 h-5 w-5 shrink-0 text-navy-900" />
        <div className="min-w-0">
          <p className="font-display text-sm font-bold uppercase tracking-wide text-navy-950">
            {availability === "IN_STOCK" ? "Prête à expédier" : "Expédiée dès réception"}
          </p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-gray-600">
            {availability === "ON_ORDER" && (
              <>
                Nous la commandons chez notre fournisseur
                {lead ? ` — ${lead}` : ""}, puis&nbsp;:{" "}
              </>
            )}
            Grand Tunis <bdi dir="ltr">{grandTunis}</bdi> · autres régions{" "}
            <bdi dir="ltr">{regions}</bdi> — {formatTND(FLAT_DELIVERY_FEE)}, offerte dès{" "}
            {formatTND(freeShippingThreshold)}.
          </p>
        </div>
      </div>

      {/* The shop's three standing promises, from the same phrases the home
          page and the checkout use, so they cannot come to say different
          things. Icons rather than emoji — an emoji is a different drawing on
          every phone. */}
      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1.5 border-t border-navy-900/8 p-0 pt-3 text-[13px] text-gray-700">
        <li className="inline-flex items-center gap-1.5">
          <IconBanknote className="h-4 w-4 shrink-0 text-gold-500" />
          Paiement à la livraison
        </li>
        <li className="inline-flex items-center gap-1.5">
          <IconReturn className="h-4 w-4 shrink-0 text-gold-500" />
          Retour sous 14 jours
        </li>
        <li className="inline-flex items-center gap-1.5">
          <IconShield className="h-4 w-4 shrink-0 text-gold-500" />
          Garantie 12 mois
        </li>
      </ul>
    </div>
  );
}
