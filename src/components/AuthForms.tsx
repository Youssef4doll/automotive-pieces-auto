"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/i18n/LocaleProvider";
import type { DictKey } from "@/i18n/dictionaries";
import { login, signup, type AuthState } from "@/app/actions/auth";
import FormShield from "@/components/FormShield";

const PERK_KEYS: DictKey[] = ["auth.perk1", "auth.perk2", "auth.perk3", "auth.perk4"];

export default function AuthForms() {
  const { t } = useLocale();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [loginState, loginAction, loginPending] = useActionState<AuthState, FormData>(login, undefined);
  const [signupState, signupAction, signupPending] = useActionState<AuthState, FormData>(signup, undefined);

  return (
    <div className="grid lg:grid-cols-2 min-h-[640px]">
      {/* `relative overflow-hidden` for the light behind the panel below. */}
      <div className="hidden lg:flex flex-col justify-between bg-navy-950 text-white p-10 xl:p-14 relative overflow-hidden">
        {/* One soft warm light from the top-left, in the brand's gold. The
            panel was a flat navy rectangle the width of half a monitor, which
            is a lot of one colour; this gives it a light source without
            adding an image to download. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -start-32 w-[520px] h-[520px] rounded-full opacity-[0.13]"
          style={{ background: "radial-gradient(circle, #fbc000 0%, transparent 68%)" }}
        />

        {/* self-start is load-bearing, not decoration.

            This is a direct child of a `flex flex-col` container, whose
            default align-items resolves to stretch — which pulled the logo to
            the full width of the panel while `h-11` held its height at 44px.
            It rendered 688×44: an aspect of 15.6 on artwork that is 3.0, so
            the wordmark was smeared across five times its natural width. The
            header's copy of the same logo was unaffected because that flex
            row sets items-center. object-contain is the belt to this braces:
            even if something stretches the box again, the artwork inside it
            keeps its proportions rather than distorting. */}
        <Image
          src="/images/logo-white.png"
          alt="Automotive Pièces Auto"
          width={160}
          height={53}
          className="relative self-start h-11 w-auto object-contain"
        />

        <div className="relative">
          {/* 9ch broke the headline into five stubby lines ("VOS /
              COMMANDES, / SUIVIES / DE BOUT / EN BOUT"). 16ch lets it fall
              into three, which is a shape rather than a stack. */}
          <h1 className="font-heading font-extrabold uppercase text-3xl xl:text-[2.6rem] leading-[1.05] tracking-tight max-w-[16ch]">
            {t("auth.headline")}
          </h1>
          {/* A short gold rule under the headline, the same one the hero
              uses, so this page belongs to the same site. */}
          <div className="w-14 h-1 bg-gold-500 rounded-full mt-5 mb-7" />
          <div className="flex flex-col gap-3.5">
            {PERK_KEYS.map((k) => (
              <div key={k} className="flex gap-3 items-start">
                <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-gold-500 text-navy-950 flex items-center justify-center text-[11px] font-bold">
                  ✓
                </span>
                <span className="text-sm text-white/80 leading-relaxed">{t(k)}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/45">{t("auth.stat")}</p>
      </div>

      <div className="flex flex-col">
        <div className="flex justify-end px-4 sm:px-8 pt-4">
          <Link href="/" className="inline-flex items-center min-h-tap text-xs font-semibold text-gray-500 hover:text-red-600">
            {t("auth.backShop")}
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-md">
            <div className="flex rounded-lg overflow-hidden border border-gray-200 mb-6">
              <button
                type="button"
                onClick={() => setTab("login")}
                className={`flex-1 py-3 text-sm font-display font-bold uppercase tracking-wide ${tab === "login" ? "bg-navy-900 text-white" : "bg-white text-gray-500"}`}
              >
                {t("account.login")}
              </button>
              <button
                type="button"
                onClick={() => setTab("signup")}
                className={`flex-1 py-3 text-sm font-display font-bold uppercase tracking-wide ${tab === "signup" ? "bg-navy-900 text-white" : "bg-white text-gray-500"}`}
              >
                {t("account.signup")}
              </button>
            </div>

            {tab === "login" ? (
              <form action={loginAction} className="flex flex-col gap-3">
                <input name="email" type="email" required placeholder={t("account.email")} className="px-3 py-3 border border-gray-300 rounded-lg text-sm outline-none focus:border-gold-500" />
                <input name="password" type="password" required placeholder={t("account.password")} className="px-3 py-3 border border-gray-300 rounded-lg text-sm outline-none focus:border-gold-500" />
                {loginState?.error && <p className="text-xs text-red-600">{loginState.error}</p>}
                <button type="submit" disabled={loginPending} className="py-3 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-display font-bold uppercase tracking-wide">
                  {loginPending ? "…" : t("account.submitLogin")}
                </button>
                <button type="button" onClick={() => setTab("signup")} className="inline-flex items-center justify-center min-h-tap text-xs text-navy-900 underline">
                  {t("account.switchToSignup")}
                </button>
                <p className="text-[11px] text-gray-600 mt-2">
                  Démo admin : admin@automotive-pieces-auto.tn / admin1234
                </p>
              </form>
            ) : (
              <form action={signupAction} className="relative flex flex-col gap-3">
                <FormShield />
                <input name="name" required placeholder={t("account.name")} className="px-3 py-3 border border-gray-300 rounded-lg text-sm outline-none focus:border-gold-500" />
                <input name="email" type="email" required placeholder={t("account.email")} className="px-3 py-3 border border-gray-300 rounded-lg text-sm outline-none focus:border-gold-500" />
                <input name="phone" required dir="ltr" placeholder={t("account.phone")} className="px-3 py-3 border border-gray-300 rounded-lg text-sm outline-none focus:border-gold-500" />
                <input name="password" type="password" required placeholder={t("account.password")} className="px-3 py-3 border border-gray-300 rounded-lg text-sm outline-none focus:border-gold-500" />
                {signupState?.error && <p className="text-xs text-red-600">{signupState.error}</p>}
                <button type="submit" disabled={signupPending} className="py-3 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-display font-bold uppercase tracking-wide">
                  {signupPending ? "…" : t("account.submitSignup")}
                </button>
                <button type="button" onClick={() => setTab("login")} className="inline-flex items-center justify-center min-h-tap text-xs text-navy-900 underline">
                  {t("account.switchToLogin")}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
