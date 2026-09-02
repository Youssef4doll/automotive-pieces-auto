"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { adminUpdateCustomer, adminDeleteCustomer, type CustomerState } from "@/app/actions/customers";

export type EditableCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  orderCount: number;
};

/**
 * The shop correcting a customer's details.
 *
 * Half of this shop's customers give their name over the phone, so the name on
 * an account is as often the shop's typo as the customer's, and there was no
 * way to fix one. What this must not do is rewrite the past: an order stores
 * the name it was placed under, and every edit here is filed with the admin
 * who made it, so the record shows both what the account says now and what it
 * said when each order was taken.
 */
export default function CustomerEditor({ customer }: { customer: EditableCustomer }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<CustomerState, FormData>(adminUpdateCustomer, undefined);
  const [confirming, setConfirming] = useState(false);
  const [delState, setDelState] = useState<CustomerState>(undefined);
  const [deleting, startDelete] = useTransition();

  const [v, setV] = useState({
    name: customer.name,
    email: customer.email,
    phone: customer.phone ?? "",
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  // Controlled, so a rejected email keeps the rest of what was typed — React
  // blanks an uncontrolled form as soon as its action settles.
  useEffect(() => {
    if (state?.ok) setEditing(false);
  }, [state]);

  return (
    <section aria-labelledby="fiche" className="p-5 rounded-xl bg-white border border-navy-900/10 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h2 id="fiche" className="font-display font-bold uppercase tracking-wide text-sm text-navy-950">
          Fiche client
        </h2>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-tap-compact px-3 rounded-lg border border-gray-300 text-navy-900 text-[13px] font-semibold hover:border-navy-900"
          >
            Modifier
          </button>
        )}
      </div>

      {state?.ok && !editing && (
        <p role="status" className="mb-4 text-[13px] text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          {state.ok}
        </p>
      )}

      {editing ? (
        <form action={action} className="grid sm:grid-cols-2 gap-4">
          <input type="hidden" name="id" value={customer.id} />
          <Field label="Nom">
            <input name="name" value={v.name} onChange={set("name")} required className={INPUT} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" value={v.email} onChange={set("email")} required className={INPUT} dir="ltr" />
          </Field>
          <Field label="Téléphone">
            <input name="phone" type="tel" value={v.phone} onChange={set("phone")} className={INPUT} dir="ltr" />
          </Field>

          {state?.error && (
            <p role="alert" className="sm:col-span-2 text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {state.error}
              <span className="block text-red-600/80 mt-0.5">Rien n&apos;a été perdu — corrigez et réessayez.</span>
            </p>
          )}

          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <button disabled={pending} className="min-h-tap px-5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white font-display font-bold uppercase text-xs tracking-wide disabled:opacity-60">
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={() => {
                setV({ name: customer.name, email: customer.email, phone: customer.phone ?? "" });
                setEditing(false);
              }}
              className="min-h-tap px-5 rounded-lg border border-gray-300 text-gray-600 text-sm font-semibold hover:border-gray-400"
            >
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <dl className="grid sm:grid-cols-2 gap-4">
          <Read label="Nom" value={customer.name} />
          <Read label="Email" value={customer.email} dir="ltr" />
          <Read label="Téléphone" value={customer.phone ?? "Non renseigné"} dir={customer.phone ? "ltr" : undefined} />
        </dl>
      )}

      <div className="mt-5 pt-4 border-t border-gray-100">
        {customer.orderCount > 0 ? (
          <p className="text-xs text-gray-500">
            Ce compte porte {customer.orderCount} commande(s) et ne peut pas être supprimé — l&apos;historique de
            ventes est la comptabilité de la boutique.
          </p>
        ) : confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-red-700">Supprimer définitivement ce compte&nbsp;?</span>
            <button
              type="button"
              disabled={deleting}
              onClick={() =>
                startDelete(async () => {
                  const r = await adminDeleteCustomer(customer.id);
                  setDelState(r);
                  if (r?.ok) router.push("/admin/clients");
                })
              }
              className="min-h-tap-compact px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-display font-bold uppercase disabled:opacity-60"
            >
              {deleting ? "…" : "Confirmer"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="min-h-tap-compact px-3 rounded-lg border border-gray-300 text-gray-600 text-xs font-semibold"
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="min-h-tap-compact px-3 rounded-lg border border-gray-300 text-gray-600 hover:text-red-600 hover:border-red-200 text-xs font-semibold"
          >
            Supprimer ce compte
          </button>
        )}
        {delState?.error && <p role="alert" className="mt-2 text-[13px] text-red-700">{delState.error}</p>}
      </div>
    </section>
  );
}

const INPUT =
  "w-full min-h-tap px-3 rounded-lg border border-navy-900/15 bg-white text-base text-navy-950 outline-none focus:border-gold-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="text-[11px] font-display font-bold uppercase tracking-wide text-navy-900/45">{label}</span>
      {children}
    </label>
  );
}

function Read({ label, value, dir }: { label: string; value: string; dir?: "ltr" }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-display font-bold uppercase tracking-wide text-navy-900/45">{label}</dt>
      <dd className="text-sm text-navy-950 mt-0.5 break-words" dir={dir}>{value}</dd>
    </div>
  );
}
