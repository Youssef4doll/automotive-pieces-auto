"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { sendContactMessage, type ContactState } from "@/app/actions/contact";
import { CONTACT_SUBJECTS } from "@/lib/contact-subjects";
import { useVehicle, vehicleLabel } from "@/lib/vehicle-store";
import FormShield from "@/components/FormShield";

/**
 * The form on /contact.
 *
 * Three of its fields are filled in without asking. `?commande=` and `?ref=`
 * come from the links on an order page, and the car comes from the garage the
 * shopper already told us about — so a message about a part that does not fit
 * arrives with the part and the car attached instead of starting a round of
 * "which order?" and "which car?". They are shown, not hidden: a form that
 * quietly attaches things is a form nobody trusts.
 *
 * Name and e-mail are prefilled for a signed-in customer and still editable —
 * somebody writing on behalf of a garage may want the reply somewhere else.
 */
export default function ContactForm({
  defaults,
}: {
  defaults: { name: string; email: string; phone: string };
}) {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContactMessage, undefined);
  const params = useSearchParams();
  const vehicle = useVehicle((s) => s.vehicle);

  const orderRef = params.get("commande") ?? "";
  const productSku = params.get("ref") ?? "";
  const car = (vehicle ? vehicleLabel(vehicle) : "") ?? "";

  // A link that already knows what it is about. "Une question sur cette
  // pièce ?" on a product page arrives here carrying the reference and the
  // subject, so the shopper types their question and nothing else. Matched
  // against the fixed list rather than trusted: the subject is a public URL
  // parameter, and an arbitrary string in it would be somebody else's text
  // rendered inside our form.
  const asked = params.get("sujet");
  const subject = CONTACT_SUBJECTS.find((s) => s === asked) ?? CONTACT_SUBJECTS[0];

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6">
        <h2 className="font-heading text-lg font-extrabold uppercase tracking-tight text-green-900">
          Message envoyé
        </h2>
        <p className="mt-2 text-sm text-green-900/80">
          Nous vous répondons sur l&apos;adresse que vous avez indiquée. Si c&apos;est urgent, WhatsApp est
          plus rapide.
        </p>
      </div>
    );
  }

  const field = "w-full rounded-lg border border-gray-300 px-3 py-3 text-base text-navy-950 outline-none focus:border-navy-900";

  return (
    <form action={action} className="flex flex-col gap-3.5 rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
      <FormShield />

      <div className="grid gap-3.5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-navy-900">Nom *</span>
          <input name="name" required defaultValue={defaults.name} className={field} autoComplete="name" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-navy-900">E-mail *</span>
          <input name="email" type="email" required defaultValue={defaults.email} className={field} autoComplete="email" />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-navy-900">
          Téléphone <span className="font-normal text-gray-500">(facultatif)</span>
        </span>
        <input name="phone" type="tel" dir="ltr" defaultValue={defaults.phone} className={field} autoComplete="tel" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-navy-900">Sujet *</span>
        <select name="subject" required defaultValue={subject} className={field}>
          {CONTACT_SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-navy-900">Votre message *</span>
        <textarea name="body" required rows={6} className={`${field} resize-y`} />
      </label>

      {/* What the page is attaching, said out loud. The inputs are readonly
          rather than hidden so the shopper can see what is going with their
          message — and they are plain text on the server, written down as
          context for a person, never used to look anything up. */}
      {(orderRef || productSku || car) && (
        <div className="rounded-lg bg-slate-50 px-3.5 py-3 text-[13px] text-gray-600">
          <span className="font-semibold text-navy-900">Joint à votre message :</span>{" "}
          {[orderRef && `commande ${orderRef}`, productSku && `référence ${productSku}`, car]
            .filter(Boolean)
            .join(" · ")}
        </div>
      )}
      <input type="hidden" name="orderRef" value={orderRef} />
      <input type="hidden" name="productSku" value={productSku} />
      <input type="hidden" name="vehicle" value={car} />

      {state?.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="min-h-tap rounded-lg bg-red-600 px-6 font-display font-bold uppercase tracking-wide text-white hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? "Envoi…" : "Envoyer"}
      </button>
    </form>
  );
}
