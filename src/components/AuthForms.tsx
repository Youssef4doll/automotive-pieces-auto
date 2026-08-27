"use client";

import { useActionState, useState } from "react";
import { useLocale } from "@/i18n/LocaleProvider";
import { login, signup, type AuthState } from "@/app/actions/auth";

export default function AuthForms() {
  const { t } = useLocale();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [loginState, loginAction, loginPending] = useActionState<AuthState, FormData>(login, undefined);
  const [signupState, signupAction, signupPending] = useActionState<AuthState, FormData>(signup, undefined);

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="flex rounded-lg overflow-hidden border border-gray-200 mb-6">
        <button
          type="button"
          onClick={() => setTab("login")}
          className={`flex-1 py-3 text-sm font-semibold ${tab === "login" ? "bg-navy-900 text-white" : "bg-white text-gray-500"}`}
        >
          {t("account.login")}
        </button>
        <button
          type="button"
          onClick={() => setTab("signup")}
          className={`flex-1 py-3 text-sm font-semibold ${tab === "signup" ? "bg-navy-900 text-white" : "bg-white text-gray-500"}`}
        >
          {t("account.signup")}
        </button>
      </div>

      {tab === "login" ? (
        <form action={loginAction} className="flex flex-col gap-3">
          <input name="email" type="email" required placeholder={t("account.email")} className="px-3 py-3 border border-gray-300 rounded-lg text-sm" />
          <input name="password" type="password" required placeholder={t("account.password")} className="px-3 py-3 border border-gray-300 rounded-lg text-sm" />
          {loginState?.error && <p className="text-xs text-red-600">{loginState.error}</p>}
          <button type="submit" disabled={loginPending} className="py-3 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold">
            {loginPending ? "…" : t("account.submitLogin")}
          </button>
          <button type="button" onClick={() => setTab("signup")} className="text-xs text-navy-900 underline">
            {t("account.switchToSignup")}
          </button>
          <p className="text-[11px] text-gray-400 mt-2">
            Démo admin : admin@automotive-pieces-auto.tn / admin1234
          </p>
        </form>
      ) : (
        <form action={signupAction} className="flex flex-col gap-3">
          <input name="name" required placeholder={t("account.name")} className="px-3 py-3 border border-gray-300 rounded-lg text-sm" />
          <input name="email" type="email" required placeholder={t("account.email")} className="px-3 py-3 border border-gray-300 rounded-lg text-sm" />
          <input name="phone" required dir="ltr" placeholder={t("account.phone")} className="px-3 py-3 border border-gray-300 rounded-lg text-sm" />
          <input name="password" type="password" required placeholder={t("account.password")} className="px-3 py-3 border border-gray-300 rounded-lg text-sm" />
          {signupState?.error && <p className="text-xs text-red-600">{signupState.error}</p>}
          <button type="submit" disabled={signupPending} className="py-3 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold">
            {signupPending ? "…" : t("account.submitSignup")}
          </button>
          <button type="button" onClick={() => setTab("login")} className="text-xs text-navy-900 underline">
            {t("account.switchToLogin")}
          </button>
        </form>
      )}
    </div>
  );
}
