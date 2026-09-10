"use client";

import { useActionState } from "react";
import { requestPasswordReset, type ResetRequestState } from "@/app/actions/password-reset";
import FormShield from "@/components/FormShield";

export default function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<ResetRequestState, FormData>(requestPasswordReset, undefined);

  if (state?.sent) {
    return (
      <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm leading-relaxed text-green-900">
        <p className="font-semibold">C&apos;est envoyé — si un compte existe avec cette adresse.</p>
        <p className="mt-1">
          Le lien est valable une heure. S&apos;il n&apos;arrive pas dans les minutes qui viennent, regardez dans les courriers
          indésirables, puis vérifiez l&apos;adresse saisie.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="relative flex flex-col gap-4">
      <FormShield />
      <div>
        <label htmlFor="reset-email" className="mb-1.5 block text-sm font-semibold text-navy-950">
          Adresse e-mail du compte
        </label>
        <input
          id="reset-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="exemple@domaine.com"
          className="w-full min-h-[50px] rounded-xl border border-gray-300 bg-white px-4 text-base text-navy-950 placeholder:text-gray-400 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/30"
        />
      </div>
      {state?.error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full min-h-[52px] items-center justify-center rounded-xl bg-gold-500 font-display text-sm font-bold uppercase tracking-wide text-navy-950 transition hover:bg-gold-400 disabled:opacity-60"
      >
        {pending ? "…" : "Envoyer le lien"}
      </button>
    </form>
  );
}
