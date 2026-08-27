"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/i18n/LocaleProvider";
import { useCart, cartCount } from "@/lib/cart-store";
import LanguageSwitcher from "./LanguageSwitcher";
import MegaMenu, { type MegaMenuFamily } from "./MegaMenu";
import VehiclePicker from "./VehiclePicker";

export default function HeaderClient({
  menu,
  whatsapp,
  phone,
  userName,
  isAdmin,
}: {
  menu: MegaMenuFamily[];
  whatsapp: string;
  phone: string;
  userName: string | null;
  isAdmin: boolean;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const items = useCart((s) => s.items);
  const openCart = useCart((s) => s.open);
  const count = cartCount(items);

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);
  const [q, setQ] = useState("");

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/recherche?q=${encodeURIComponent(q.trim())}`);
    setMobileOpen(false);
  }

  return (
    <>
      <div className="bg-red-500 text-white text-[11px] sm:text-xs">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 py-2 flex items-center justify-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar font-medium">
          <span className="whitespace-nowrap">{t("top.delivery")}</span>
          <span className="hidden sm:inline opacity-60">•</span>
          <span className="hidden sm:inline whitespace-nowrap">{t("top.cod")}</span>
          <span className="hidden md:inline opacity-60">•</span>
          <span className="hidden md:inline whitespace-nowrap">{t("top.returns")}</span>
        </div>
      </div>

      <header
        className="relative sticky top-0 z-40 bg-navy-900 text-white shadow-md"
        onMouseLeave={() => setMenuOpen(false)}
      >
        <div className="mx-auto max-w-7xl px-3 sm:px-4">
          <div className="flex items-center flex-wrap gap-[10px] lg:gap-[clamp(10px,1.2vw,18px)] py-2.5">
            <button
              className="lg:hidden p-2 -ms-2 rounded hover:bg-white/10 shrink-0"
              aria-label="Menu"
              onClick={() => setMobileOpen(true)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <Link href="/" className="shrink-0 flex items-center">
              <Image
                src="/images/logo-white.png"
                alt="Automotive Pièces Auto"
                width={160}
                height={53}
                className="h-8 sm:h-9 w-auto"
                priority
              />
            </Link>

            <nav className="hidden lg:flex items-center gap-1 shrink-0 font-display font-semibold uppercase text-sm tracking-wide whitespace-nowrap">
              <Link href="/" className="px-3 py-2 rounded-md hover:bg-white/10 border-b-2 border-gold-500">
                {t("nav.home")}
              </Link>
              <button
                className="px-3 py-2 rounded-md hover:bg-white/10 flex items-center gap-1"
                onMouseEnter={() => setMenuOpen(true)}
              >
                {t("nav.products")}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              <Link href="/#marques" className="px-3 py-2 rounded-md hover:bg-white/10">
                {t("nav.brands")}
              </Link>
              <Link href="/#magasin" className="px-3 py-2 rounded-md hover:bg-white/10">
                {t("nav.about")}
              </Link>
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-md hover:bg-white/10">
                {t("nav.contact")}
              </a>
            </nav>

            {/* This spacer and the search form below share the row's leftover
                width equally (both flex-1) — same ratio as the reference
                design — rather than all of it collapsing into one gap. */}
            <div className="hidden lg:block flex-1" />

            <form onSubmit={submitSearch} className="hidden md:flex flex-[1_1_150px] min-w-[130px]">
              <div className="flex w-full rounded-md overflow-hidden bg-white">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  type="search"
                  placeholder={t("nav.search")}
                  className="flex-1 px-3 py-2 text-sm text-navy-900 outline-none min-w-0"
                />
                <button type="submit" className="px-4 bg-gold-500 hover:bg-gold-400 text-navy-950 font-display font-bold text-sm uppercase tracking-wide">
                  {t("hero.searchOk")}
                </button>
              </div>
            </form>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="hidden xl:flex flex-col items-end leading-tight px-2"
              >
                <span className="text-[10px] uppercase text-white/60 tracking-wide">{t("nav.callToOrder")}</span>
                <span dir="ltr" className="text-sm font-bold text-white">{phone}</span>
              </a>
              <Link
                href="/compte"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-md border border-white/25 hover:bg-white/10 text-xs font-display font-bold uppercase tracking-wide"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
                </svg>
                <span className="max-w-20 truncate">{userName ?? t("nav.account")}</span>
              </Link>
              <Link
                href="/compte"
                className="sm:hidden flex items-center justify-center w-10 h-10 rounded-md hover:bg-white/10"
                aria-label={t("nav.account")}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
                </svg>
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="hidden sm:inline-flex text-[11px] px-2 py-1 rounded bg-gold-500 text-navy-950 font-bold uppercase"
                >
                  {t("nav.admin")}
                </Link>
              )}
              <button
                onClick={openCart}
                className="relative flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-md bg-gold-500 hover:bg-gold-400 text-navy-950 font-display font-bold uppercase text-xs sm:text-sm tracking-wide"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
                </svg>
                <span>{t("nav.cart")} ({count})</span>
              </button>
            </div>
          </div>

          <form onSubmit={submitSearch} className="md:hidden pb-3">
            <div className="flex w-full rounded-md overflow-hidden bg-white">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                type="search"
                placeholder={t("nav.search")}
                className="flex-1 px-3 py-2.5 text-sm text-navy-900 outline-none min-w-0"
              />
              <button type="submit" className="px-4 bg-gold-500 text-navy-950 font-display font-bold text-sm uppercase">
                {t("hero.searchOk")}
              </button>
            </div>
          </form>
        </div>

        {menuOpen && <MegaMenu families={menu} onNavigate={() => setMenuOpen(false)} />}
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 start-0 w-[85%] max-w-sm bg-white overflow-y-auto">
            <div className="flex items-center justify-between p-4 bg-navy-900 text-white">
              <Image src="/images/logo-white.png" alt="" width={130} height={43} className="h-7 w-auto" />
              <button onClick={() => setMobileOpen(false)} className="p-2" aria-label="Close">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="p-3 flex flex-col gap-1 font-display uppercase tracking-wide">
              <button
                onClick={() => {
                  setVehicleOpen(true);
                  setMobileOpen(false);
                }}
                className="text-start px-3 py-3 rounded-lg bg-gold-500 text-navy-950 font-bold text-sm"
              >
                {t("nav.byVehicle")}
              </button>
              <Link href="/compte" onClick={() => setMobileOpen(false)} className="px-3 py-3 rounded-lg hover:bg-gray-100 text-sm font-bold text-navy-900">
                {userName ?? t("nav.account")}
              </Link>
              {isAdmin && (
                <Link href="/admin" onClick={() => setMobileOpen(false)} className="px-3 py-3 rounded-lg hover:bg-gray-100 text-sm font-bold text-navy-900">
                  {t("nav.admin")}
                </Link>
              )}
              <Link href="/#marques" onClick={() => setMobileOpen(false)} className="px-3 py-3 rounded-lg hover:bg-gray-100 text-sm font-bold text-navy-900">
                {t("nav.brands")}
              </Link>
              <Link href="/#magasin" onClick={() => setMobileOpen(false)} className="px-3 py-3 rounded-lg hover:bg-gray-100 text-sm font-bold text-navy-900">
                {t("nav.about")}
              </Link>
              <div className="h-px bg-gray-200 my-2" />
              <p className="px-3 text-xs font-semibold text-gray-400 normal-case">{t("nav.products")}</p>
              {menu.map((family) => {
                const expanded = expandedFamily === family.id;
                return (
                  <div key={family.id} className={expanded ? "bg-gray-50 rounded-lg" : ""}>
                    <button
                      onClick={() => setExpandedFamily(expanded ? null : family.id)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-3 rounded-lg text-sm font-bold text-navy-900 border-s-[3px] ${
                        expanded ? "border-gold-500" : "border-transparent hover:bg-gray-100"
                      }`}
                    >
                      {family.name}
                      <span
                        className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] transition-transform ${
                          expanded ? "bg-red-50 text-red-600 rotate-180" : "bg-gray-100 text-red-500"
                        }`}
                      >
                        ▼
                      </span>
                    </button>
                    {expanded && (
                      <div className="flex flex-col">
                        {family.children.map((sub) => (
                          <Link
                            key={sub.id}
                            href={`/catalogue/${family.slug}/${sub.slug}`}
                            onClick={() => setMobileOpen(false)}
                            className="flex items-center gap-2 ps-8 pe-3 py-2.5 text-sm font-medium normal-case text-navy-900/80 border-t border-gray-100"
                          >
                            <span className="text-gold-500">•</span>
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="h-px bg-gray-200 my-2" />
              <div className="px-3 py-2 normal-case">
                <LanguageSwitcher />
              </div>
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-3 rounded-lg bg-green-600 text-white text-sm font-bold text-center mt-2"
              >
                WhatsApp · <span dir="ltr">{phone}</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {vehicleOpen && <VehiclePicker onClose={() => setVehicleOpen(false)} />}
    </>
  );
}
