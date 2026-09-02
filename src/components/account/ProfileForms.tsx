"use client";

import { useActionState, useEffect, useState } from "react";
import { updateProfile, changePassword, type AccountState } from "@/app/actions/account";

/**
 * The profile card, in two states.
 *
 * Read mode is the default because that is what a customer opening the page
 * wants — to check a number, not to type one. "Modifier" swaps the same card
 * into inputs in place rather than sending them to a separate page, so the
 * values they were just reading stay on screen while they correct one of them.
 */
export function ProfileCard({
  name,
  email,
  phone,
  memberSince,
}: {
  name: string;
  email: string;
  phone: string | null;
  memberSince: string;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<AccountState, FormData>(updateProfile, undefined);

  // Controlled, not defaultValue: React resets an uncontrolled form once its
  // action settles, so a rejected email ("already taken") wiped every field the
  // customer had just typed and handed them a blank form under an error
  // message. Holding the values here survives the re-render.
  const [form, setForm] = useState({ name, email, phone: phone ?? "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Leave edit mode only once the server confirms the write, so a rejected
  // email (already taken) keeps the customer in the form with their typing.
  useEffect(() => {
    if (state?.ok) setEditing(false);
  }, [state]);

  const cancel = () => {
    setForm({ name, email, phone: phone ?? "" });
    setEditing(false);
  };

  return (
    <section aria-labelledby="infos" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h2 id="infos" className="font-heading font-extrabold uppercase text-navy-950 tracking-tight">
          Mes informations
        </h2>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 inline-flex items-center gap-1.5 min-h-tap-compact px-3 rounded-lg border border-slate-300 text-navy-900 text-[13px] font-semibold hover:border-navy-900 transition-colors"
          >
            <PencilIcon /> Modifier
          </button>
        )}
      </div>

      {state?.ok && state.message && !editing && (
        <p role="status" className="mb-4 text-[13px] text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          {state.message}
        </p>
      )}

      {editing ? (
        <form action={action} className="grid sm:grid-cols-2 gap-4">
          <Input label="Nom" name="name" value={form.name} onChange={set("name")} autoComplete="name" required />
          <Input label="Email" name="email" type="email" value={form.email} onChange={set("email")} autoComplete="email" required />
          <Input
            label="Téléphone"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={set("phone")}
            autoComplete="tel"
            dir="ltr"
            hint="Nous vous appelons à ce numéro pour confirmer vos commandes."
          />
          {/* Not editable — it is the account's creation date, not a field. */}
          <div className="min-w-0">
            <span className="block text-[11px] font-display font-bold uppercase tracking-wide text-slate-500 mb-1.5">
              Client depuis
            </span>
            <span className="block text-sm text-navy-950">{memberSince}</span>
          </div>

          {state?.error && (
            <p role="alert" className="sm:col-span-2 text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

          <div className="sm:col-span-2 flex flex-wrap gap-2 pt-1">
            <button
              disabled={pending}
              className="inline-flex items-center min-h-tap px-5 rounded-xl bg-navy-900 hover:bg-navy-950 text-white font-display font-bold uppercase text-xs tracking-wide disabled:opacity-60"
            >
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="inline-flex items-center min-h-tap px-5 rounded-xl border border-slate-300 text-slate-600 text-sm font-semibold hover:border-slate-400"
            >
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <dl className="grid sm:grid-cols-2 gap-4">
          <ReadField label="Nom" value={name} />
          <ReadField label="Email" value={email} />
          <ReadField label="Téléphone" value={phone ?? "Non renseigné"} dir={phone ? "ltr" : undefined} />
          <ReadField label="Client depuis" value={memberSince} />
        </dl>
      )}
    </section>
  );
}

/** Collapsed until asked for: most visits are not a password change. */
export function PasswordCard() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<AccountState, FormData>(changePassword, undefined);
  // Controlled for the same reason as the profile card: without it, correcting
  // a mistyped confirmation meant re-entering all three fields, and the field
  // React had just blanked was `required`, so the retry never even submitted.
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const set = (k: keyof typeof pw) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setPw((v) => ({ ...v, [k]: e.target.value }));
  const close = () => {
    setPw({ current: "", next: "", confirm: "" });
    setOpen(false);
  };

  useEffect(() => {
    if (state?.ok) {
      setPw({ current: "", next: "", confirm: "" });
      setOpen(false);
    }
  }, [state]);

  return (
    <section aria-labelledby="motdepasse" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="motdepasse" className="font-heading font-extrabold uppercase text-navy-950 tracking-tight">
            Mot de passe
          </h2>
          <p className="text-sm text-slate-500 mt-1">Changez-le à tout moment depuis cet écran.</p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 inline-flex items-center gap-1.5 min-h-tap-compact px-3 rounded-lg border border-slate-300 text-navy-900 text-[13px] font-semibold hover:border-navy-900 transition-colors"
          >
            <PencilIcon /> Modifier
          </button>
        )}
      </div>

      {state?.ok && state.message && !open && (
        <p role="status" className="mt-4 text-[13px] text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          {state.message}
        </p>
      )}

      {open && (
        <form action={action} className="mt-4 grid sm:grid-cols-2 gap-4">
          <Input
            label="Mot de passe actuel"
            name="current"
            type="password"
            value={pw.current}
            onChange={set("current")}
            autoComplete="current-password"
            required
            className="sm:col-span-2"
          />
          <Input label="Nouveau mot de passe" name="next" type="password" value={pw.next} onChange={set("next")} autoComplete="new-password" minLength={6} required />
          <Input label="Confirmer" name="confirm" type="password" value={pw.confirm} onChange={set("confirm")} autoComplete="new-password" minLength={6} required />

          {state?.error && (
            <p role="alert" className="sm:col-span-2 text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

          <div className="sm:col-span-2 flex flex-wrap gap-2 pt-1">
            <button
              disabled={pending}
              className="inline-flex items-center min-h-tap px-5 rounded-xl bg-navy-900 hover:bg-navy-950 text-white font-display font-bold uppercase text-xs tracking-wide disabled:opacity-60"
            >
              {pending ? "…" : "Changer le mot de passe"}
            </button>
            <button
              type="button"
              onClick={close}
              className="inline-flex items-center min-h-tap px-5 rounded-xl border border-slate-300 text-slate-600 text-sm font-semibold hover:border-slate-400"
            >
              Annuler
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function Input({
  label,
  hint,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className={`min-w-0 block ${className}`}>
      <span className="block text-[11px] font-display font-bold uppercase tracking-wide text-slate-500 mb-1.5">
        {label}
      </span>
      {/* text-base, not text-sm: iOS zooms the whole page on focus for any
          field under 16px, and the zoom does not come back on blur. */}
      <input
        {...props}
        className="w-full min-h-tap px-3.5 rounded-xl border border-slate-300 bg-white text-base text-navy-950 outline-none focus:border-navy-900 focus:ring-2 focus:ring-navy-900/10"
      />
      {hint && <span className="block text-xs text-slate-400 mt-1.5">{hint}</span>}
    </label>
  );
}

function ReadField({ label, value, dir }: { label: string; value: string; dir?: "ltr" }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-display font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm text-navy-950 mt-0.5 break-words" dir={dir}>
        {value}
      </dd>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
