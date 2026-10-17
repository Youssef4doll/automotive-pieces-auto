"use client";

import Image from "next/image";
import { useLocale } from "@/i18n/LocaleProvider";

/**
 * The phone app, shown before it is in the stores (the owner, October 2026).
 *
 * The shop's front in a frame with "Téléchargez l'application" over it and
 * the two store buttons, locked: the app is not published yet, so the
 * buttons say "Bientôt" and go nowhere — a link to a store page that does
 * not exist would be the site promising what it does not have. Beside it a
 * phone showing the app's real catalogue screen, standing up out of the
 * white into the navy band above.
 *
 * Replaces "Passez nous voir": the address, hours and number stay on the
 * contact page and in the footer, and the links that went to #magasin go
 * there.
 */
export default function AppPromo() {
  const { t } = useLocale();
  return (
    <section id="application" className="mx-auto shell-w px-4 pb-8 sm:pb-12">
      <div className="grid sm:grid-cols-2 gap-6 sm:gap-10 items-end">
        <div className="relative h-72 sm:h-96 mt-8 sm:mt-12 rounded-2xl overflow-hidden border border-gray-200 order-2 sm:order-1">
          <Image
            src="/images/storefront.png"
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 50vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950/90 via-navy-950/35 to-navy-950/10" />
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
            <h2 className="text-2xl sm:text-4xl font-heading font-extrabold uppercase text-white tracking-tight mb-4">
              {t("appPromo.title")}
            </h2>
            <div className="flex flex-wrap gap-3">
              <StoreButton store="apple" soon={t("appPromo.soon")} locked={t("appPromo.locked")} />
              <StoreButton store="google" soon={t("appPromo.soon")} locked={t("appPromo.locked")} />
            </div>
          </div>
        </div>

        <div className="relative z-10 flex justify-center order-1 sm:order-2 -mt-24 sm:-mt-56">
          <Phone alt={t("appPromo.screen")} />
        </div>
      </div>
    </section>
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

/** An iPhone, drawn: the screen is the app's catalogue, as it really looks. */
function Phone({ alt }: { alt: string }) {
  return (
    <div className="relative w-[200px] sm:w-[260px] rounded-[44px] sm:rounded-[52px] bg-navy-950 p-[9px] sm:p-[11px] shadow-[0_30px_60px_-12px_rgba(3,10,26,0.55),0_12px_24px_-8px_rgba(3,10,26,0.35)] ring-1 ring-white/10">
      <div className="relative aspect-[448/974] rounded-[36px] sm:rounded-[42px] overflow-hidden bg-white">
        <Image src="/images/app-screen.webp" alt={alt} fill sizes="260px" className="object-cover object-top" />
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-[34%] h-[22px] rounded-full bg-navy-950" aria-hidden />
      </div>
      <span className="absolute -left-[3px] top-28 w-[3px] h-10 rounded-l bg-navy-900" aria-hidden />
      <span className="absolute -left-[3px] top-44 w-[3px] h-16 rounded-l bg-navy-900" aria-hidden />
      <span className="absolute -right-[3px] top-36 w-[3px] h-20 rounded-r bg-navy-900" aria-hidden />
    </div>
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
