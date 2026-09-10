"use client";

import { useActionState, useState } from "react";
import { resetPassword, type ResetState } from "@/app/actions/password-reset";

const INPUT =
  "w-full min-h-[50px] rounded-xl border border-gray-300 bg-white px-4 pe-12 text-base text-navy-950 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/30";

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPassword, undefined);
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="new-password" className="mb-1.5 block text-sm font-semibold text-navy-950">
          Nouveau mot de passe
        </label>
        <div className="relative">
          <input id="new-password" name="password" type={show ? "text" : "password"} required minLength={6} autoComplete="new-password" className={INPUT} />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-pressed={show}
            aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="absolute inset-y-0 end-1.5 my-auto grid h-10 w-10 place-items-center rounded-lg text-gray-400 hover:text-navy-900"
          >
            {show ? "🙈" : "👁"}
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">Six caractères au minimum.</p>
      </div>
      <div>
        <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-semibold text-navy-950">
          Confirmez-le
        </label>
        <input id="confirm-password" name="confirm" type={show ? "text" : "password"} required minLength={6} autoComplete="new-password" className={INPUT} />
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
        {pending ? "…" : "Enregistrer le nouveau mot de passe"}
      </button>
    </form>
  );
}
