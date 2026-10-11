import { GOVERNORATES, GRAND_TUNIS } from "@/lib/governorates";
import { RETURN_DAYS, WARRANTY_MONTHS } from "@/lib/policy";
import { SHOP_ERROR_HOURS } from "@/lib/returns-rules";
import { getSettings, publicContact } from "@/lib/settings";
import { parseClock, parseDays, parseWindow } from "@/lib/delivery-estimate";
import { FLAT_DELIVERY_FEE } from "@/lib/shipping";
import { smsAvailable } from "@/lib/sms";
import { taxPolicy } from "@/lib/tax";
import { Cache, guard, ok, preflight } from "../../_lib/respond";

const PUBLIC = { cache: Cache.catalogue, cors: true };

const hhmm = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
const cutoffText = (v: string) => {
  const n = parseClock(v);
  return n == null ? null : hhmm(n);
};
const windowText = (v: string) => {
  const w = parseWindow(v);
  return w ? `${w.start}–${w.end}` : null;
};
const daysText = (v: string) => {
  const d = parseDays(v);
  return d ? [...d].sort().join(",") : null;
};

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
            /**
             * What the estimated date is worked out from (lib/delivery-estimate),
             * normalised: the cut-off "14:00", the courier's hours "10:00–18:00",
             * the working days "1,2,3,4,5,6" (Monday = 1). Null until the shop
             * states it — and with no cut-off, no date is shown anywhere.
             */
            cutoff: cutoffText(settings.delivery_cutoff),
            window: windowText(settings.delivery_window),
            days: daysText(settings.delivery_days),
          },
          tax: { vatRate: tax.vatRate, stampDuty: tax.stampDuty },
          supplierLeadTime: text(settings.supplier_lead_time),
          warrantyMonths: WARRANTY_MONTHS,
          returnDays: RETURN_DAYS,
          /** "Signalez-le-nous dans les 48 heures avec une photo" — the shop's-error window (lib/returns-rules). */
          shopErrorHours: SHOP_ERROR_HOURS,
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
          /**
           * Whether "sign in with a code by SMS" can be offered: true once an
           * SMS provider is configured (lib/sms). False means the app shows
           * the e-mail sign-in only, rather than a code that never arrives.
           */
          auth: { phoneCode: smsAvailable() },
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
