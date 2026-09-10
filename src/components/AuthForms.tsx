"use client";

import { useActionState, useId, useState, type ReactNode } from "react";
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
 * garage, cash on delivery, a person to ask). The right one is the form, on a
 * card, with one tab open at a time so only ever one password field is on the
 * page.
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

const INPUT =
  "w-full min-h-[50px] rounded-xl border border-gray-300 bg-white ps-11 pe-3 text-base text-navy-950 placeholder:text-gray-400 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/30";
const PRIMARY =
  "inline-flex w-full min-h-[52px] items-center justify-center gap-2 rounded-xl bg-gold-500 text-navy-950 font-display text-sm font-bold uppercase tracking-wide transition hover:bg-gold-400 active:scale-[0.99] disabled:opacity-60";

export default function AuthForms() {
  const { t } = useLocale();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loginState, loginAction, loginPending] = useActionState<AuthState, FormData>(login, undefined);
  const [signupState, signupAction, signupPending] = useActionState<AuthState, FormData>(signup, undefined);

  return (
    <div className="grid min-h-[720px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
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
              bug the last version of this page shipped with. */}
          <Image
            src="/images/logo-white.png"
            alt="Automotive Pièces Auto"
            width={186}
            height={62}
            className="h-12 w-auto self-start object-contain"
          />
          <span aria-hidden="true" className="h-9 w-px bg-gold-500/70" />
          <p className="max-w-[15ch] text-xs leading-snug text-white/75">{t("auth.tagline")}</p>
        </div>

        <div className="relative max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">{t("auth.welcome")}</p>
          <h1 className="mt-3 font-heading text-[2.7rem] font-extrabold leading-[1.02] tracking-tight xl:text-[3.3rem]">
            Automotive
            <br />
            <span className="text-gold-500">Pièces Auto</span>
          </h1>
          <p className="mt-5 max-w-[38ch] text-[15px] leading-relaxed text-white/80">{t("auth.intro")}</p>

          <ul className="mt-8 flex flex-col gap-3.5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-center gap-3.5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/10 text-white">
                  <FeatureIcon name={f.icon} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold leading-tight">{t(f.title)}</span>
                  <span className="block text-xs text-white/60">{t(f.sub)}</span>
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
      <div className="relative flex flex-col overflow-hidden bg-[#f6f7fb]">
        {/* A faint mark of the brand's hexagon, bottom right. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          className="pointer-events-none absolute -bottom-24 -end-16 h-[420px] w-[420px] text-gold-500/[0.09]"
        >
          <path d="M28 6h44l22 44-22 44H28L6 50z" fill="currentColor" />
        </svg>

        <div className="relative flex justify-end px-4 pt-4 sm:px-8">
          <Link href="/" className="inline-flex min-h-tap items-center text-sm font-semibold text-navy-900 hover:text-red-600">
            {t("auth.backShop")}
          </Link>
        </div>

        <div className="relative flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
          <div className="w-full max-w-[560px]">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-navy-900/50">
              {tab === "login" ? t("auth.welcomeBack") : t("auth.newHere")}
            </p>
            <h2 className="mt-1.5 font-heading text-[2rem] font-extrabold leading-tight text-navy-950 sm:text-[2.4rem]">
              {tab === "login" ? t("auth.loginTitle") : t("auth.signupTitle")}
            </h2>
            <p className="mt-2 text-[15px] text-gray-600">{tab === "login" ? t("auth.loginSub") : t("auth.signupSub")}</p>

            <div className="mt-6 rounded-2xl border border-navy-900/10 bg-white p-5 shadow-[0_18px_50px_-24px_rgba(8,22,51,0.35)] sm:p-6">
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#eef1f7] p-1">
                <TabButton active={tab === "login"} onClick={() => setTab("login")} icon="user">
                  {t("account.login")}
                </TabButton>
                <TabButton active={tab === "signup"} onClick={() => setTab("signup")} icon="user-plus">
                  {t("account.signup")}
                </TabButton>
              </div>

              {tab === "login" ? (
                <form action={loginAction} className="mt-5 flex flex-col gap-4">
                  <Field label={t("account.email")} icon="mail">
                    {(id) => (
                      <input id={id} name="email" type="email" required autoComplete="email" placeholder={t("auth.emailPlaceholder")} className={INPUT} />
                    )}
                  </Field>
                  <Field
                    label={t("account.password")}
                    icon="lock"
                    trailing={<EyeButton shown={showPassword} onToggle={() => setShowPassword((v) => !v)} t={t} />}
                  >
                    {(id) => (
                      <input
                        id={id}
                        name="password"
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete="current-password"
                        placeholder={t("auth.passwordPlaceholder")}
                        className={`${INPUT} pe-12`}
                      />
                    )}
                  </Field>

                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                    <label className="inline-flex min-h-tap-compact items-center gap-2 text-gray-700">
                      <input type="checkbox" name="remember" defaultChecked className="h-4 w-4 rounded border-gray-300 accent-navy-900" />
                      {t("auth.remember")}
                    </label>
                    <Link
                      href="/compte/mot-de-passe-oublie"
                      className="inline-flex min-h-tap-compact items-center font-medium text-navy-900 underline underline-offset-2 hover:text-red-600"
                    >
                      {t("auth.forgot")}
                    </Link>
                  </div>

                  {loginState?.error && (
                    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {loginState.error}
                    </p>
                  )}
                  <button type="submit" disabled={loginPending} className={PRIMARY}>
                    {loginPending ? "…" : t("account.submitLogin")}
                    <ArrowIcon />
                  </button>
                </form>
              ) : (
                <form action={signupAction} className="relative mt-5 flex flex-col gap-4">
                  <FormShield />
                  <Field label={t("account.name")} icon="user">
                    {(id) => <input id={id} name="name" required autoComplete="name" className={INPUT} />}
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t("account.email")} icon="mail">
                      {(id) => (
                        <input id={id} name="email" type="email" required autoComplete="email" placeholder={t("auth.emailPlaceholder")} className={INPUT} />
                      )}
                    </Field>
                    <Field label={t("account.phone")} icon="phone">
                      {(id) => <input id={id} name="phone" required dir="ltr" autoComplete="tel" inputMode="tel" className={INPUT} />}
                    </Field>
                  </div>
                  <Field
                    label={t("account.password")}
                    icon="lock"
                    trailing={<EyeButton shown={showPassword} onToggle={() => setShowPassword((v) => !v)} t={t} />}
                  >
                    {(id) => (
                      <input
                        id={id}
                        name="password"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        className={`${INPUT} pe-12`}
                      />
                    )}
                  </Field>

                  {signupState?.error && (
                    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {signupState.error}
                    </p>
                  )}
                  <button type="submit" disabled={signupPending} className={PRIMARY}>
                    {signupPending ? "…" : t("account.submitSignup")}
                    <ArrowIcon />
                  </button>
                </form>
              )}
            </div>

            <p className="mt-5 text-center text-sm text-gray-600">
              {tab === "login" ? (
                <>
                  {t("auth.noAccount")}{" "}
                  <button
                    type="button"
                    onClick={() => setTab("signup")}
                    className="font-semibold text-navy-900 underline underline-offset-2 hover:text-red-600"
                  >
                    {t("auth.register")}
                  </button>
                </>
              ) : (
                <>
                  {t("auth.haveAccount")}{" "}
                  <button
                    type="button"
                    onClick={() => setTab("login")}
                    className="font-semibold text-navy-900 underline underline-offset-2 hover:text-red-600"
                  >
                    {t("account.submitLogin")}
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ pieces ---- */

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: "user" | "user-plus";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-tap items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${
        active ? "bg-navy-900 text-white shadow" : "text-navy-900/70 hover:text-navy-950"
      }`}
    >
      <FieldIcon name={icon} />
      {children}
    </button>
  );
}

/** A labelled input with a leading icon and, optionally, a trailing control.
 *  The input is rendered by the caller so its own attributes stay in one
 *  place; this only supplies the id the label points at. */
function Field({
  label,
  icon,
  trailing,
  children,
}: {
  label: string;
  icon: "mail" | "lock" | "user" | "phone";
  trailing?: ReactNode;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-navy-950">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 start-0 flex w-11 items-center justify-center text-gray-400">
          <FieldIcon name={icon} />
        </span>
        {children(id)}
        {trailing && <span className="absolute inset-y-0 end-0 flex items-center pe-1.5">{trailing}</span>}
      </div>
    </div>
  );
}

function EyeButton({ shown, onToggle, t }: { shown: boolean; onToggle: () => void; t: (k: DictKey) => string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={shown}
      aria-label={shown ? t("auth.hidePassword") : t("auth.showPassword")}
      className="grid h-10 w-10 place-items-center rounded-lg text-gray-400 hover:text-navy-900"
    >
      {shown ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <path d="M1 1l22 22" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function FieldIcon({ name }: { name: "mail" | "lock" | "user" | "phone" | "user-plus" }) {
  const common = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "mail":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      );
    case "lock":
      return (
        <svg {...common}>
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      );
    case "phone":
      return (
        <svg {...common}>
          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2Z" />
        </svg>
      );
    case "user-plus":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M19 8v6M22 11h-6" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
  }
}

function FeatureIcon({ name }: { name: "truck" | "car" | "cash" | "headset" }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
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
