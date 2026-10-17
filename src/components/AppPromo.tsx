"use client";

import Image from "next/image";
import { useLocale } from "@/i18n/LocaleProvider";

/**
 * The phone app, before it is in the stores (the owner, October 2026, from
 * his reference banner).
 *
 * A navy banner: the shop's mark, "Votre voiture. Les bonnes pièces." — the
 * app's own headline — a line on what it does, the two store buttons and
 * three promises the shop already makes everywhere else. On the other side,
 * the app on a tilted phone among brake discs, filters and a shock absorber,
 * fading into the navy.
 *
 * The store buttons are locked: the app is not published yet, so they say
 * "Bientôt" and go nowhere — a link to a store page that does not exist
 * would be the site promising what it does not have.
 *
 * Replaces "Passez nous voir": the address, hours and number stay on the
 * contact page and in the footer, and the links that went to #magasin go
 * there.
 */
export default function AppPromo() {
  const { t } = useLocale();
  return (
    <section id="application" className="mx-auto shell-w px-4 py-8 sm:py-12">
      <div className="relative overflow-hidden rounded-3xl bg-navy-950 text-white shadow-[0_24px_60px_-20px_rgba(3,10,26,0.55)]">
        {/* The phone among the parts: above the words on a phone, beside them from sm up. */}
        <div className="relative h-[26rem] sm:absolute sm:inset-y-0 sm:end-0 sm:h-auto sm:w-[56%] [mask-image:linear-gradient(to_bottom,black_70%,transparent)] sm:[mask-image:linear-gradient(to_right,transparent,black_38%)] sm:rtl:[mask-image:linear-gradient(to_left,transparent,black_38%)]">
          <Image
            src="/images/app-banner.webp"
            alt={t("appPromo.screen")}
            fill
            sizes="(max-width: 640px) 100vw, 56vw"
            className="object-cover object-[50%_35%] sm:object-[50%_40%]"
          />
        </div>
        <div className="pointer-events-none absolute inset-0 hidden sm:block bg-gradient-to-r rtl:bg-gradient-to-l from-navy-950 via-navy-950/70 via-45% to-transparent to-70%" />

        <div className="relative px-6 pb-8 pt-2 sm:px-12 sm:py-14 sm:max-w-[54%]">
          <Image src="/images/logo-white.png" alt="Automotive Pièces Auto" width={720} height={240} className="w-40 sm:w-56 h-auto mb-6 sm:mb-8" />
          <h2 className="font-heading text-[2rem] sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight mb-4">
            <span className="block font-sans font-normal">{t("appPromo.title1")}</span>
            <span className="block font-extrabold">{t("appPromo.title2")}</span>
          </h2>
          <p className="text-base sm:text-lg text-white/75 max-w-md mb-7">{t("appPromo.body")}</p>
          <div className="flex flex-wrap gap-3 mb-8">
            <StoreButton store="apple" soon={t("appPromo.soon")} locked={t("appPromo.locked")} />
            <StoreButton store="google" soon={t("appPromo.soon")} locked={t("appPromo.locked")} />
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-3 text-sm text-white/90">
            <Promise icon={<ShieldGlyph />} label={t("appPromo.fit")} />
            <Promise icon={<CashGlyph />} label={t("trust.cod")} />
            <Promise icon={<BadgeGlyph />} label={t("trust.warranty")} />
          </ul>
        </div>
      </div>
    </section>
  );
}

function Promise({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="text-gold-500">{icon}</span>
      {label}
    </li>
  );
}

function ShieldGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6L12 3z" />
      <path d="m8.8 12 2.2 2.2 4.4-4.4" />
    </svg>
  );
}

function CashGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 9.5v5M18 9.5v5" />
    </svg>
  );
}

function BadgeGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="9" r="6" />
      <path d="m8.5 14.2-1.5 7 5-2.7 5 2.7-1.5-7" />
    </svg>
  );
}

/** A store badge, locked until the app is published. */
function StoreButton({ store, soon, locked }: { store: "apple" | "google"; soon: string; locked: string }) {
  const name = store === "apple" ? "App Store" : "Google Play";
  return (
    <span
      role="img"
      aria-label={`${name} — ${locked}`}
      title={locked}
      className="inline-flex items-center gap-3 h-14 ps-3.5 pe-4 rounded-xl bg-black/80 border border-white/25 text-white cursor-not-allowed select-none"
    >
      {store === "apple" ? <AppleGlyph /> : <PlayGlyph />}
      <span className="flex flex-col leading-tight">
        <span className="text-[11px] text-white/75">{soon}</span>
        <span className="text-base font-display font-bold">{name}</span>
      </span>
      <span className="ms-1 flex items-center justify-center w-7 h-7 rounded-full bg-gold-500 text-navy-950" aria-hidden>
        <LockGlyph />
      </span>
    </span>
  );
}

function AppleGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.37 12.62c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.86-.76-1.47.02-2.83.86-3.59 2.17-1.53 2.65-.39 6.58 1.1 8.73.73 1.05 1.6 2.23 2.73 2.19 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.83-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.32-3.49zM14.2 6.17c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.69-.92 2.68.97.08 1.96-.49 2.56-1.23z" />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg width="24" height="26" viewBox="0 0 24 26" aria-hidden>
      <path d="M2.2 1.1 13.6 12.9 2.2 24.7c-.4-.2-.7-.7-.7-1.3V2.4c0-.6.3-1.1.7-1.3z" fill="#34A853" />
      <path d="m17.4 9-3.8 3.9 3.8 3.9 4.3-2.4c1.2-.7 1.2-2.3 0-3L17.4 9z" fill="#FBBC04" />
      <path d="M2.2 1.1c.4-.2.9-.2 1.4.1L17.4 9l-3.8 3.9L2.2 1.1z" fill="#4285F4" />
      <path d="m13.6 12.9 3.8 3.9-13.8 7.8c-.5.3-1 .3-1.4.1l11.4-11.8z" fill="#EA4335" />
    </svg>
  );
}

function LockGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
