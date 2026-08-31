"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { contactLink } from "@/lib/contact-link";
import {
  IconHome, IconOrders, IconCar, IconHelp, IconUser, IconPackage, IconWhatsApp,
} from "./icons";

type Item = {
  href: string;
  label: string;
  short: string;
  Icon: (p: { className?: string }) => React.ReactElement;
  exact?: boolean;
  /** Shown in the phone tab bar. Five is the most a thumb row can hold. */
  bottom?: boolean;
};

const ITEMS: Item[] = [
  { href: "/compte", label: "Accueil", short: "Accueil", Icon: IconHome, exact: true, bottom: true },
  { href: "/compte/commandes", label: "Mes commandes", short: "Commandes", Icon: IconOrders, bottom: true },
  { href: "/compte/garage", label: "Mon garage", short: "Garage", Icon: IconCar, bottom: true },
  { href: "/compte/pieces", label: "Mes pièces", short: "Pièces", Icon: IconPackage },
  { href: "/compte/aide", label: "Aide", short: "Aide", Icon: IconHelp, bottom: true },
  { href: "/compte/profil", label: "Mon profil", short: "Profil", Icon: IconUser, bottom: true },
];

/**
 * The application shell for the customer area.
 *
 * Desktop gets a compact rail so the content can use the full width. A phone
 * gets a sticky tab bar within thumb reach instead, because a rail on a small
 * screen either eats a third of it or hides behind a menu button. Only one of
 * the two is ever rendered visible.
 */
export default function AccountShell({
  title,
  subtitle,
  initials,
  orderCount,
  activeOrders,
  whatsapp,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  initials: string;
  /** Lifetime orders — context on the rail, not a call to action. */
  orderCount?: number;
  /** Orders still in flight. The only count worth badging. */
  activeOrders?: number;
  whatsapp?: string | null;
  /** Optional page-level control rendered beside the title on wide screens. */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (i: Item) => (i.exact ? pathname === i.href : pathname?.startsWith(i.href));
  const bottom = ITEMS.filter((i) => i.bottom);

  return (
    <div className="bg-white min-h-screen">
      <div className="w-full min-w-0 mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8 py-5 lg:py-9">
        <div className="lg:grid lg:grid-cols-[236px_1fr] lg:gap-8 xl:gap-10">
          {/* ---------- desktop rail ---------- */}
          <aside className="hidden lg:flex lg:flex-col sticky top-28 self-start max-h-[calc(100vh-8rem)]">
            <nav aria-label="Espace client" className="flex flex-col gap-1">
              {ITEMS.map((item) => {
                const active = isActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`group flex items-center gap-3 px-3.5 min-h-tap rounded-xl text-sm transition-colors ${
                      active
                        ? "bg-slate-50 text-navy-950 font-semibold border-s-[3px] border-red-500 ps-3"
                        : "text-slate-600 hover:bg-slate-50 hover:text-navy-950 border-s-[3px] border-transparent ps-3"
                    }`}
                  >
                    <item.Icon className={active ? "text-navy-900" : "text-slate-400 group-hover:text-navy-900"} />
                    <span className="flex-1">{item.label}</span>
                    {item.href === "/compte/commandes" && orderCount ? (
                      <span className="text-xs tabular-nums text-slate-400">
                        {orderCount}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            {/* Always a way to get help. WhatsApp when the shop has a number,
                the help centre when it does not — a customer with a problem
                should never find the support card simply missing. */}
            <a
              href={whatsapp ? contactLink({ whatsapp, email: null }) : "/compte/aide"}
              {...(whatsapp ? { target: "_blank", rel: "noreferrer" } : {})}
              className="mt-6 flex items-center gap-3 px-3.5 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 hover:border-green-300 hover:text-green-700 transition-colors"
            >
              {whatsapp ? <IconWhatsApp className="text-green-600" /> : <IconHelp className="text-slate-400" />}
              <span className="leading-tight">
                <span className="block font-semibold text-navy-950">Assistance</span>
                <span className="block text-xs">
                  {whatsapp ? "Une personne répond" : "Questions fréquentes"}
                </span>
              </span>
            </a>
          </aside>

          {/* ---------- content ---------- */}
          <div className="min-w-0">
            <header className="flex items-start justify-between gap-4 mb-5 lg:mb-7">
              <div className="min-w-0">
                <h1 className="text-[22px] sm:text-3xl font-heading font-extrabold uppercase text-navy-950 tracking-tight leading-[1.1]">
                  {title}
                </h1>
                {subtitle && <p className="text-sm text-slate-500 mt-1.5 max-w-prose">{subtitle}</p>}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {action}
                <Link
                  href="/compte/profil"
                  aria-label="Mon profil"
                  className="w-tap h-11 rounded-full bg-slate-100 border border-slate-200 text-navy-900 grid place-items-center font-display font-bold text-sm tracking-wide hover:bg-slate-200 transition-colors"
                >
                  {initials}
                </Link>
              </div>
            </header>

            {children}

            {/* Keeps the last card clear of the phone tab bar. */}
            <div className="h-24 lg:hidden" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* ---------- phone tab bar ---------- */}
      <nav
        aria-label="Espace client"
        className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur pb-safe"
      >
        <ul className="grid grid-cols-5">
          {bottom.map((item) => {
            const active = isActive(item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center justify-center gap-1 min-h-tap py-2 text-[11px] ${
                    active ? "text-navy-950 font-semibold" : "text-slate-400"
                  }`}
                >
                  {/* The active state reads from the filled pill and the weight,
                      not colour alone. */}
                  <span
                    className={`relative grid place-items-center w-11 h-7 rounded-full transition-colors ${
                      active ? "bg-navy-50 text-navy-900" : "text-slate-400"
                    }`}
                  >
                    <item.Icon />
                    {item.href === "/compte/commandes" && activeOrders ? (
                      <span className="absolute -top-1 end-1.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-red-600 text-white text-[10px] font-bold tabular-nums">
                        {activeOrders > 9 ? "9+" : activeOrders}
                        <span className="sr-only"> commande{activeOrders > 1 ? "s" : ""} en cours</span>
                      </span>
                    ) : null}
                  </span>
                  {item.short}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

