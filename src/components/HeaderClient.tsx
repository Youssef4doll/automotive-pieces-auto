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
  const [q, setQ] = useState("");

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/recherche?q=${encodeURIComponent(q.trim())}`);
    setMobileOpen(false);
  }

  return (
    <>
      <div className="bg-navy-950 text-white text-[11px] sm:text-xs">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 py-1.5 flex items-center justify-center gap-4 overflow-x-auto no-scrollbar">
          <span className="whitespace-nowrap">💳 {t("top.cod")}</span>
          <span className="hidden sm:inline whitespace-nowrap">🚚 {t("top.delivery")}</span>
          <span className="hidden md:inline whitespace-nowrap">↩ {t("top.returns")}</span>
        </div>
      </div>

      <header className="sticky top-0 z-40 bg-navy-900 text-white shadow-md">
        <div className="mx-auto max-w-7xl px-3 sm:px-4">
          <div className="flex items-center gap-3 py-2.5">
            <button
              className="lg:hidden p-2 -ml-2 rounded hover:bg-white/10"
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

            <nav className="hidden lg:flex items-center gap-1 ms-2">
              <div
                className="relative"
                onMouseEnter={() => setMenuOpen(true)}
                onMouseLeave={() => setMenuOpen(false)}
              >
                <button className="px-3 py-2 rounded-md text-sm font-medium hover:bg-white/10 flex items-center gap-1">
                  {t("nav.products")}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {menuOpen && <MegaMenu families={menu} onNavigate={() => setMenuOpen(false)} />}
              </div>
              <button
                onClick={() => setVehicleOpen(true)}
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-white/10"
              >
                {t("nav.byVehicle")}
              </button>
              <Link href="/#marques" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-white/10">
                {t("nav.brands")}
              </Link>
              <Link href="/#magasin" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-white/10">
                {t("nav.stores")}
              </Link>
            </nav>

            <form onSubmit={submitSearch} className="hidden md:flex flex-1 max-w-md mx-2">
              <div className="flex w-full rounded-lg overflow-hidden bg-white">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  type="search"
                  placeholder={t("nav.search")}
                  className="flex-1 px-3 py-2 text-sm text-navy-900 outline-none min-w-0"
                />
                <button type="submit" className="px-3 bg-gold-500 hover:bg-gold-600 text-navy-950" aria-label={t("hero.searchCta")}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                </button>
              </div>
            </form>

            <div className="flex items-center gap-1 sm:gap-2 ms-auto">
              <div className="hidden sm:block">
                <LanguageSwitcher compact />
              </div>
              <Link
                href="/compte"
                className="hidden sm:flex flex-col items-center px-2 py-1.5 rounded-md hover:bg-white/10 min-w-11 min-h-11 justify-center"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
                </svg>
                <span className="text-[10px] mt-0.5 max-w-16 truncate">{userName ?? t("nav.account")}</span>
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="hidden sm:inline-flex text-[11px] px-2 py-1 rounded bg-gold-500 text-navy-950 font-semibold hover:bg-gold-400"
                >
                  {t("nav.admin")}
                </Link>
              )}
              <button
                onClick={openCart}
                className="relative flex flex-col items-center px-2 py-1.5 rounded-md hover:bg-white/10 min-w-11 min-h-11 justify-center"
                aria-label={t("nav.cart")}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
                </svg>
                {count > 0 && (
                  <span className="absolute -top-0.5 -end-0.5 bg-red-600 text-white text-[10px] leading-none rounded-full min-w-4 h-4 px-1 flex items-center justify-center font-bold">
                    {count}
                  </span>
                )}
              </button>
            </div>
          </div>

          <form onSubmit={submitSearch} className="md:hidden pb-2.5">
            <div className="flex w-full rounded-lg overflow-hidden bg-white">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                type="search"
                placeholder={t("nav.search")}
                className="flex-1 px-3 py-2.5 text-sm text-navy-900 outline-none min-w-0"
              />
              <button type="submit" className="px-3 bg-gold-500 text-navy-950" aria-label={t("hero.searchCta")}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </button>
            </div>
          </form>
        </div>
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
            <div className="p-3 flex flex-col gap-1">
              <button
                onClick={() => {
                  setVehicleOpen(true);
                  setMobileOpen(false);
                }}
                className="text-start px-3 py-3 rounded-lg bg-gold-500 text-navy-950 font-semibold text-sm"
              >
                🚗 {t("nav.byVehicle")}
              </button>
              <Link href="/compte" onClick={() => setMobileOpen(false)} className="px-3 py-3 rounded-lg hover:bg-gray-100 text-sm font-medium">
                {userName ?? t("nav.account")}
              </Link>
              {isAdmin && (
                <Link href="/admin" onClick={() => setMobileOpen(false)} className="px-3 py-3 rounded-lg hover:bg-gray-100 text-sm font-medium">
                  {t("nav.admin")}
                </Link>
              )}
              <Link href="/#marques" onClick={() => setMobileOpen(false)} className="px-3 py-3 rounded-lg hover:bg-gray-100 text-sm font-medium">
                {t("nav.brands")}
              </Link>
              <Link href="/#magasin" onClick={() => setMobileOpen(false)} className="px-3 py-3 rounded-lg hover:bg-gray-100 text-sm font-medium">
                {t("nav.stores")}
              </Link>
              <div className="h-px bg-gray-200 my-2" />
              <p className="px-3 text-xs font-semibold text-gray-400 uppercase">{t("nav.products")}</p>
              {menu.map((family) => (
                <Link
                  key={family.id}
                  href={`/catalogue/${family.slug}`}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between px-3 py-3 rounded-lg hover:bg-gray-100 text-sm"
                >
                  {family.name}
                  <span className="text-gray-400">›</span>
                </Link>
              ))}
              <div className="h-px bg-gray-200 my-2" />
              <div className="px-3 py-2">
                <LanguageSwitcher />
              </div>
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-3 rounded-lg bg-green-600 text-white text-sm font-medium text-center mt-2"
              >
                WhatsApp · {phone}
              </a>
            </div>
          </div>
        </div>
      )}

      {vehicleOpen && <VehiclePicker onClose={() => setVehicleOpen(false)} />}
    </>
  );
}
