"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { contactLink } from "@/lib/contact-link";
import { initialsOf } from "@/lib/initials";
import AccountMenu, { LogoutButton, type AccountUser } from "./AccountMenu";
import {
  IconHome, IconOrders, IconCar, IconHelp, IconUser, IconPackage, IconWhatsApp,
} from "./icons";

type Item = {
  href: string;
  label: string;
  short: string;
  Icon: (p: { className?: string }) => React.ReactElement;
  exact?: boolean;
};

const ITEMS: Item[] = [
  { href: "/compte", label: "Accueil", short: "Accueil", Icon: IconHome, exact: true },
  { href: "/compte/commandes", label: "Mes commandes", short: "Commandes", Icon: IconOrders },
  { href: "/compte/garage", label: "Mon garage", short: "Garage", Icon: IconCar },
  { href: "/compte/pieces", label: "Mes pièces", short: "Pièces", Icon: IconPackage },
  { href: "/compte/aide", label: "Aide", short: "Aide", Icon: IconHelp },
  { href: "/compte/profil", label: "Mon profil", short: "Profil", Icon: IconUser },
];

/**
 * The application shell for the customer area.
 *
 * Desktop gets a compact rail so the content can use the full width.
 *
 * A phone gets the same six destinations as one scrollable row of chips
 * directly under the page title. It used to get a fixed tab bar pinned to the
 * bottom of the screen, and that bar was a poor trade three times over: it
 * covered the last card on every page (paid for with a 96px spacer), it could
 * only fit five of the six sections so "Mes pièces" was unreachable from it,
 * and on a storefront — unlike a native app — the bottom of the viewport is
 * already where the browser puts its own chrome. The chips sit where the eye
 * already is after reading the heading, show every section, and scroll the
 * page normally.
 */
export default function AccountShell({
  title,
  subtitle,
  user,
  orderCount,
  activeOrders,
  whatsapp,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Who is signed in — drives the identity card, the avatar and the menu. */
  user: AccountUser;
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
  const initials = initialsOf(user.name);

  return (
    <div className="bg-white min-h-screen">
      <div className="w-full min-w-0 mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8 py-5 lg:py-9">
        <div className="lg:grid lg:grid-cols-[236px_1fr] lg:gap-8 xl:gap-10">
          {/* ---------- desktop rail ---------- */}
          <aside className="hidden lg:flex lg:flex-col sticky top-28 self-start max-h-[calc(100vh-8rem)]">
            {/* Who is signed in, said plainly at the top of the rail. Without
                it the only clue was two letters in a circle, which is not an
                answer to "am I in the right account?". */}
            <Link
              href="/compte/profil"
              className="flex items-center gap-3 mb-4 p-2.5 rounded-xl border border-slate-200 bg-white hover:border-navy-900/30 transition-colors"
            >
              <span className="shrink-0 w-10 h-10 rounded-full bg-navy-900 text-white grid place-items-center font-display font-bold text-sm tracking-wide">
                {initials}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block text-sm font-semibold text-navy-950 truncate">{user.name}</span>
                <span className="block text-xs text-slate-500 truncate" dir="ltr">
                  {user.email}
                </span>
              </span>
            </Link>

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

            <div className="mt-2 pt-2 border-t border-slate-200">
              <LogoutButton />
            </div>
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
                <AccountMenu user={user} initials={initials} />
              </div>
            </header>

            {/* ---------- phone navigation ---------- */}
            <nav aria-label="Espace client" className="lg:hidden -mx-4 sm:-mx-6 px-4 sm:px-6 mb-5">
              {/* One row, scrolled sideways, every section present. The active
                  one is filled rather than merely tinted, so the state survives
                  a greyscale screenshot and a colour-blind reader. */}
              <ul className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
                {ITEMS.map((item) => {
                  const active = isActive(item);
                  return (
                    <li key={item.href} className="shrink-0">
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`relative flex items-center gap-2 min-h-tap-compact px-3.5 rounded-full border text-[13px] font-semibold whitespace-nowrap transition-colors ${
                          active
                            ? "bg-navy-900 border-navy-900 text-white"
                            : "bg-white border-slate-200 text-slate-600"
                        }`}
                      >
                        <item.Icon className={active ? "text-white" : "text-slate-400"} />
                        {item.short}
                        {item.href === "/compte/commandes" && activeOrders ? (
                          <span
                            className={`min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full text-[10px] font-bold tabular-nums ${
                              active ? "bg-white text-navy-900" : "bg-red-600 text-white"
                            }`}
                          >
                            {activeOrders > 9 ? "9+" : activeOrders}
                            <span className="sr-only"> commande{activeOrders > 1 ? "s" : ""} en cours</span>
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {children}

            {/* Help and sign-out, at the end of the page on a phone. They live
                in the rail on a desktop; without this they were only reachable
                on a phone through the avatar menu. */}
            <div className="lg:hidden mt-8 pt-5 border-t border-slate-200 flex flex-col gap-2">
              <a
                href={whatsapp ? contactLink({ whatsapp, email: null }) : "/compte/aide"}
                {...(whatsapp ? { target: "_blank", rel: "noreferrer" } : {})}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-600"
              >
                {whatsapp ? <IconWhatsApp className="text-green-600" /> : <IconHelp className="text-slate-400" />}
                <span className="leading-tight">
                  <span className="block font-semibold text-navy-950">Assistance</span>
                  <span className="block text-xs">
                    {whatsapp ? "Une personne répond" : "Questions fréquentes"}
                  </span>
                </span>
              </a>
              <LogoutButton className="border border-slate-200 rounded-xl" />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

