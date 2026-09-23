import { GOVERNORATES, GRAND_TUNIS } from "@/lib/governorates";
import { RETURN_DAYS, WARRANTY_MONTHS } from "@/lib/policy";
import { getSettings, publicContact } from "@/lib/settings";
import { FLAT_DELIVERY_FEE } from "@/lib/shipping";
import { taxPolicy } from "@/lib/tax";
import { Cache, guard, ok, preflight } from "../../_lib/respond";

const PUBLIC = { cache: Cache.catalogue, cors: true };

/**
 * What the shop has said in public about how it trades.
 *
 * Every value here is already printed somewhere on the storefront, and every
 * one of them comes from the settings the owner edits in /admin/parametres
 * or from the constants the checkout itself charges with — never from a
 * number typed into the app. The brief is explicit that tax and delivery are
 * settings-driven and the app must not hard-code either.
 *
 * `contact` goes through `publicContact`, which returns null for any field
 * still on its placeholder. Production's WhatsApp number, phone, address and
 * e-mail are all placeholders today, so today this sends four nulls — and the
 * app must show no contact row rather than "⚠ à compléter" or, worse, a
 * number that rings nobody.
 *
 * Nothing secret is here and nothing ever should be: no admin address, no
 * SMTP host, no tax ID. The tax ID is only relevant on a printed invoice.
 */
export async function GET() {
  return guard(
    async () => {
      const settings = await getSettings();
      const contact = publicContact(settings);
      const tax = taxPolicy(settings);
      const text = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

      return ok(
        {
          currency: "TND",
          delivery: {
            fee: FLAT_DELIVERY_FEE,
            freeShippingThreshold: Number(settings.free_shipping_threshold) || 150,
            /** As the shop wrote them — "24h", "48–72h". Null when unset. */
            grandTunis: text(settings.delivery_grand_tunis),
            regions: text(settings.delivery_regions),
          },
          tax: { vatRate: tax.vatRate, stampDuty: tax.stampDuty },
          supplierLeadTime: text(settings.supplier_lead_time),
          warrantyMonths: WARRANTY_MONTHS,
          returnDays: RETURN_DAYS,
          /**
           * Cash on delivery only. The checkout refuses CARD outright, so
           * listing it here would put a button in the app that always fails.
           */
          paymentMethods: ["COD"] as const,
          /**
           * Collecting in store is only offered when the shop has said where
           * the store is. A pickup option with no address is a customer
           * driving around Tunis looking for a shop.
           */
          pickup: contact.address ? { address: contact.address, hours: contact.hours } : null,
          contact,
          governorates: GOVERNORATES,
          grandTunis: [...GRAND_TUNIS],
        },
        PUBLIC,
      );
    },
    "settings/public",
    PUBLIC,
  );
}

export const OPTIONS = preflight;
