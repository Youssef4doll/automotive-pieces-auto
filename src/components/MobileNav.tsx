"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLocale } from "@/i18n/LocaleProvider";
import { parts } from "@/i18n/plural";
import CategoryThumb from "./CategoryThumb";
import LanguageSwitcher from "./LanguageSwitcher";
import type { MegaMenuFamily } from "./MegaMenu";

/**
 * The phone's way into the catalogue.
 *
 * It was an accordion: sixteen family names in a column, tap one and its
 * subcategories unfolded underneath, pushing everything below it down the
 * page. That has two problems on a phone. The list is uppercase text and
 * nothing else, so choosing between "Transmission" and "Direction et
 * suspension" is a reading exercise; and an expanded family leaves the other
 * fifteen on screen, so the shopper scrolls past the answer to find it.
 *
 * This is a drill-down instead, the shape every large parts catalogue's mobile
 * menu has settled on. One screen shows the families, each with a picture;
 * tapping one replaces the screen with that family's subcategories, each with
 * a picture of its own, under a back arrow. The list is never longer than what
 * you asked for.
 *
 * The pictures are the shop's, uploaded per category from /admin/catalogue,
 * and until one is uploaded the family's line drawing stands in — see
 * CategoryThumb. Nothing here is stock photography and nothing is invented:
 * the counts beside each row are live product counts, and a category holding
 * nothing never reaches this component (getMegaMenu drops it).
 */
export default function MobileNav({
  menu,
  userName,
  isAdmin,
  whatsapp,
  phone,
  contactUrl,
  onClose,
  onPickVehicle,
}: {
  menu: MegaMenuFamily[];
  userName: string | null;
  isAdmin: boolean;
  whatsapp: string | null;
  phone: string | null;
  contactUrl: string;
  onClose: () => void;
  /** Hands over to the vehicle sheet; the caller closes this first. */
  onPickVehicle: () => void;
}) {
  const { t } = useLocale();
  const [openFamilyId, setOpenFamilyId] = useState<string | null>(null);
  const openFamily = menu.find((f) => f.id === openFamilyId) ?? null;

  // Escape closes, and the page behind stays put while the drawer is open —
  // scrolling the catalogue under an open menu reads as a broken overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("nav.products")}
        className="absolute inset-y-0 start-0 w-[88%] max-w-sm bg-white flex flex-col"
      >
        {/* ------------------------------------------------------------ head */}
        <div className="shrink-0 flex items-center gap-1 px-2 py-2.5 bg-navy-900 text-white">
          {openFamily ? (
            <>
              <button
                onClick={() => setOpenFamilyId(null)}
                aria-label={t("vp.back")}
                className="shrink-0 w-tap h-11 grid place-items-center rounded-lg hover:bg-white/10"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="rtl:rotate-180">
                  <path d="m15 5-7 7 7 7" />
                </svg>
              </button>
              <h2 className="flex-1 min-w-0 truncate font-heading font-extrabold uppercase tracking-tight text-[15px]">
                {openFamily.name}
              </h2>
            </>
          ) : (
            <Link href="/" onClick={onClose} className="flex-1 min-w-0 flex items-center ps-2">
              <Image src="/images/logo-white.png" alt="Automotive Pièces Auto" width={130} height={43} className="h-7 w-auto" />
            </Link>
          )}
          <button
            onClick={onClose}
            aria-label="Fermer le menu"
            className="shrink-0 w-tap h-11 grid place-items-center rounded-lg hover:bg-white/10"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* ------------------------------------------------------------ body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {openFamily ? (
            /* ---------------------------------------- one family's contents */
            <div key={openFamily.id} className="motion-safe:animate-[fade-in_160ms_ease-out]">
              {/* First row, always: the family's own page. Someone who drilled
                  in wanting "brakes" and not "brake discs specifically" would
                  otherwise have to guess which subcategory is closest. */}
              <Link
                href={`/catalogue/${openFamily.slug}`}
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-3 border-b border-gray-100 bg-navy-50/50"
              >
                <CategoryThumb slug={openFamily.slug} imageUrl={openFamily.imageUrl} size={40} className="bg-white" />
                <span className="flex-1 min-w-0">
                  <span className="block font-display font-bold uppercase text-[13px] tracking-wide text-navy-950">
                    {t("mnav.viewAll")}
                  </span>
                  <span className="block text-xs text-gray-600 mt-0.5">
                    {parts(t, openFamily.count)}
                  </span>
                </span>
                <Chevron />
              </Link>

              <ul>
                {openFamily.children.map((sub) => (
                  <li key={sub.id}>
                    <Link
                      href={`/catalogue/${openFamily.slug}/${sub.slug}`}
                      onClick={onClose}
                      className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 active:bg-gray-50"
                    >
                      <CategoryThumb slug={sub.slug} imageUrl={sub.imageUrl} size={36} />
                      <span className="flex-1 min-w-0 text-sm font-semibold text-navy-900 leading-snug">
                        {sub.name}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-gray-500">{sub.count}</span>
                      <Chevron />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            /* ------------------------------------------------ the top level */
            <>
              <div className="p-3">
                <button
                  onClick={onPickVehicle}
                  className="w-full flex items-center gap-3 px-3.5 min-h-tap rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 text-start"
                >
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
                    <path d="M5 17h14M4 17v-4.2L6 7h12l2 5.8V17" />
                    <path d="M4 17v2h3v-2M17 17v2h3v-2" />
                    <circle cx="7.5" cy="13.5" r=".8" />
                    <circle cx="16.5" cy="13.5" r=".8" />
                  </svg>
                  <span className="flex-1 min-w-0 font-display font-bold uppercase text-[13px] tracking-wide">
                    {t("nav.byVehicle")}
                  </span>
                  <Chevron />
                </button>
              </div>

              {/* 12px is this project's legibility floor and this label is
                  real copy, not decoration. */}
              <p className="px-3 pb-1.5 text-xs font-display font-bold uppercase tracking-wide text-gray-500">
                {t("nav.products")}
              </p>
              <ul className="border-t border-gray-100">
                {menu.map((family) => (
                  <li key={family.id}>
                    <button
                      onClick={() => setOpenFamilyId(family.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 text-start active:bg-gray-50"
                    >
                      <CategoryThumb slug={family.slug} imageUrl={family.imageUrl} size={40} />
                      <span className="flex-1 min-w-0">
                        <span className="block font-display font-bold uppercase text-[13px] tracking-wide text-navy-950 leading-snug">
                          {family.name}
                        </span>
                        <span className="block text-xs text-gray-500 mt-0.5">
                          {parts(t, family.count)}
                        </span>
                      </span>
                      <Chevron />
                    </button>
                  </li>
                ))}
              </ul>

              <nav className="p-3 flex flex-col gap-0.5 mt-1 border-t-8 border-gray-100">
                <Secondary href="/compte" onClose={onClose}>
                  {userName ?? t("nav.account")}
                </Secondary>
                {isAdmin && (
                  <Secondary href="/admin" onClose={onClose}>
                    {t("nav.admin")}
                  </Secondary>
                )}
                <Secondary href="/#marques" onClose={onClose}>
                  {t("nav.brands")}
                </Secondary>
                <Secondary href="/#magasin" onClose={onClose}>
                  {t("nav.about")}
                </Secondary>
              </nav>

              <div className="px-3 pb-4 flex flex-col gap-3">
                <LanguageSwitcher />
                {/* Only when the shop has actually given us a number. */}
                {whatsapp && (
                  <a
                    href={contactUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center min-h-tap px-3 rounded-xl bg-green-700 text-white text-sm font-bold"
                  >
                    WhatsApp
                    {phone && (
                      <>
                        {" · "}
                        <span dir="ltr">{phone}</span>
                      </>
                    )}
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Chevron() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-gray-400 rtl:rotate-180"
      aria-hidden="true"
    >
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

function Secondary({
  href,
  onClose,
  children,
}: {
  href: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className="flex items-center min-h-tap px-3 rounded-lg text-sm font-semibold text-navy-900 active:bg-gray-100"
    >
      {children}
    </Link>
  );
}
