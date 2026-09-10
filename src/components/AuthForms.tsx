"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/i18n/LocaleProvider";
import type { DictKey } from "@/i18n/dictionaries";
import { login, signup, type AuthState } from "@/app/actions/auth";
import FormShield from "@/components/FormShield";

/**
 * Sign in / create an account.
 *
 * Two halves. The left one is the shop: its photo, its name, and four things
 * an account is actually for — each of which exists (order e-mails, the
 * garage, cash on delivery, a person to ask). The right one is the form, with
 * one tab open at a time so only ever one password field is on the page.
 *
 * The form's own type, colour and control sizes are the shop's originals and
 * are deliberately left alone: the owner picked the red submit button, the
 * condensed uppercase label and the plain placeholder inputs, and a redesign
 * that quietly restyled them was the wrong kind of change. Only the two
 * controls under the password are new, and they are drawn in the same idiom.
 *
 * No "continue with Google / Facebook": there is no OAuth behind this site,
 * and a button that opens nothing is worse than no button.
 */

const FEATURES: { title: DictKey; sub: DictKey; icon: "truck" | "car" | "cash" | "headset" }[] = [
  { title: "auth.f1", sub: "auth.f1s", icon: "truck" },
  { title: "auth.f2", sub: "auth.f2s", icon: "car" },
  { title: "auth.f3", sub: "auth.f3s", icon: "cash" },
  { title: "auth.f4", sub: "auth.f4s", icon: "headset" },
];

/** The shop's originals, kept verbatim so the two forms cannot drift apart. */
const TAB = "flex-1 py-3 text-sm font-display font-bold uppercase tracking-wide";
const INPUT = "px-3 py-3 border border-gray-300 rounded-lg text-sm outline-none focus:border-gold-500";
const SUBMIT =
  "py-3 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-display font-bold uppercase tracking-wide";

export default function AuthForms() {
  const { t } = useLocale();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [loginState, loginAction, loginPending] = useActionState<AuthState, FormData>(login, undefined);
  const [signupState, signupAction, signupPending] = useActionState<AuthState, FormData>(signup, undefined);

  return (
    // 780px, not 640: the left column is three blocks pushed apart by
    // justify-between, and at the shop's type scale the middle one is tall
    // enough that a 640px column ran the feature list into the sign-up line
    // underneath it.
    <div className="grid min-h-[780px] lg:grid-cols-2">
      {/* ------------------------------------------------ the shop ---------- */}
      <div className="relative hidden overflow-hidden bg-navy-950 p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        {/* The shop front, dimmed under navy so the type stays readable. The
            picture is the site's own, not stock. */}
        <Image
          src="/images/storefront.png"
          alt=""
          fill
          sizes="50vw"
          className="scale-105 object-cover object-[62%_center] opacity-45"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,22,51,0.97)_0%,rgba(8,22,51,0.86)_50%,rgba(8,22,51,0.6)_100%)]"
        />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/3 bg-[linear-gradient(180deg,transparent,rgba(8,22,51,0.92))]" />

        <div className="relative flex items-center gap-5">
          {/* self-start: this is a flex child, and a stretched logo was the
              bug an earlier version of this page shipped with. */}
          <Image
            src="/images/logo-white.png"
            alt="Automotive Pièces Auto"
            width={186}
            height={62}
            className="h-12 w-auto self-start object-contain"
          />
          <span aria-hidden="true" className="h-9 w-px bg-gold-500/70" />
          <p className="max-w-[15ch] text-sm leading-snug text-white/75">{t("auth.tagline")}</p>
        </div>

        <div className="relative max-w-md">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/70">{t("auth.welcome")}</p>
          <h1 className="mt-3 font-heading text-[2.7rem] font-extrabold leading-[1.02] tracking-tight xl:text-[3.3rem]">
            Automotive
            <br />
            <span className="text-gold-500">Pièces Auto</span>
          </h1>
          <p className="mt-5 max-w-[38ch] text-base leading-relaxed text-white/80">{t("auth.intro")}</p>

          <ul className="mt-8 flex flex-col gap-3.5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-center gap-3.5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/10 text-white">
                  <FeatureIcon name={f.icon} />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold leading-tight">{t(f.title)}</span>
                  <span className="block text-sm text-white/60">{t(f.sub)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-3 text-sm text-white/80">
          <span aria-hidden="true" className="h-px w-8 bg-gold-500" />
          <span>{t("auth.noAccount")}</span>
          <button
            type="button"
            onClick={() => setTab("signup")}
            className="inline-flex items-center gap-1 font-semibold text-white underline underline-offset-4 hover:text-gold-400"
          >
            {t("auth.register")} <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------ the form ---------- */}
      <div className="flex flex-col">
        <div className="flex justify-end px-4 pt-4 sm:px-8">
          <Link href="/" className="inline-flex min-h-tap items-center text-sm font-semibold text-gray-500 hover:text-red-600">
            {t("auth.backShop")}
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-8">
          <div className="w-full max-w-md">
            <div className="mb-6 flex overflow-hidden rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => setTab("login")}
                className={`${TAB} ${tab === "login" ? "bg-navy-900 text-white" : "bg-white text-gray-500"}`}
              >
                {t("account.login")}
              </button>
              <button
                type="button"
                onClick={() => setTab("signup")}
                className={`${TAB} ${tab === "signup" ? "bg-navy-900 text-white" : "bg-white text-gray-500"}`}
              >
                {t("account.signup")}
              </button>
            </div>

            {tab === "login" ? (
              <form action={loginAction} className="flex flex-col gap-3">
                <input name="email" type="email" required autoComplete="email" placeholder={t("account.email")} className={INPUT} />
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder={t("account.password")}
                  className={INPUT}
                />

                {/* The two controls the old form did not have. Same type and
                    colours as everything around them, on one line, so they
                    read as part of the form rather than as a second design. */}
                <div className="flex flex-wrap items-center justify-between gap-x-4 text-sm">
                  <label className="inline-flex min-h-tap-compact items-center gap-2 text-gray-700">
                    <input type="checkbox" name="remember" defaultChecked className="h-4 w-4 rounded border-gray-300 accent-navy-900" />
                    {t("auth.remember")}
                  </label>
                  <Link
                    href="/compte/mot-de-passe-oublie"
                    className="inline-flex min-h-tap-compact items-center text-navy-900 underline hover:text-red-600"
                  >
                    {t("auth.forgot")}
                  </Link>
                </div>

                {loginState?.error && <p className="text-xs text-red-600">{loginState.error}</p>}
                <button type="submit" disabled={loginPending} className={SUBMIT}>
                  {loginPending ? "…" : t("account.submitLogin")}
                </button>
                <button
                  type="button"
                  onClick={() => setTab("signup")}
                  className="inline-flex min-h-tap items-center justify-center text-xs text-navy-900 underline"
                >
                  {t("account.switchToSignup")}
                </button>
              </form>
            ) : (
              <form action={signupAction} className="relative flex flex-col gap-3">
                <FormShield />
                <input name="name" required autoComplete="name" placeholder={t("account.name")} className={INPUT} />
                <input name="email" type="email" required autoComplete="email" placeholder={t("account.email")} className={INPUT} />
                <input name="phone" required dir="ltr" autoComplete="tel" inputMode="tel" placeholder={t("account.phone")} className={INPUT} />
                <input
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder={t("account.password")}
                  className={INPUT}
                />
                {signupState?.error && <p className="text-xs text-red-600">{signupState.error}</p>}
                <button type="submit" disabled={signupPending} className={SUBMIT}>
                  {signupPending ? "…" : t("account.submitSignup")}
                </button>
                <button
                  type="button"
                  onClick={() => setTab("login")}
                  className="inline-flex min-h-tap items-center justify-center text-xs text-navy-900 underline"
                >
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

function FeatureIcon({ name }: { name: "truck" | "car" | "cash" | "headset" }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "truck":
      return (
        <svg {...common}>
          <path d="M1 3h13v13H1zM14 8h4l4 4v4h-8z" />
          <circle cx="5.5" cy="18.5" r="2" />
          <circle cx="18.5" cy="18.5" r="2" />
        </svg>
      );
    case "car":
      return (
        <svg {...common}>
          <path d="M5 17h14M4 17v-4.2L6 7h12l2 5.8V17" />
          <path d="M4 17v2h3v-2M17 17v2h3v-2" />
          <circle cx="7.5" cy="13.5" r=".8" />
          <circle cx="16.5" cy="13.5" r=".8" />
        </svg>
      );
    case "cash":
      return (
        <svg {...common}>
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M6 12h.01M18 12h.01" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
          <path d="M4 14h3v5H5a1 1 0 0 1-1-1v-4ZM17 14h3v4a1 1 0 0 1-1 1h-2v-5Z" />
          <path d="M14 21h2a3 3 0 0 0 3-3" />
        </svg>
      );
  }
}
