"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/compte", label: "Vue d'ensemble", short: "Compte", exact: true },
  { href: "/compte/commandes", label: "Mes commandes", short: "Commandes" },
  { href: "/compte/aide", label: "Aide & contact", short: "Aide" },
];

/**
 * One shell for the whole customer area.
 *
 * The account was a 448px column floating in the middle of a 1440px laptop —
 * 992px of empty screen and no way to move between its pages. On desktop the
 * nav becomes a rail and the content gets real width; on a phone it collapses
 * to a single scrollable row of tabs so only one thing is ever competing for
 * attention.
 */
export default function AccountShell({
  title,
  subtitle,
  count,
  children,
}: {
  title: string;
  subtitle?: string;
  count?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (t: (typeof TABS)[number]) => (t.exact ? pathname === t.href : pathname?.startsWith(t.href));

  return (
    <div className="w-full min-w-0 mx-auto max-w-6xl px-4 py-6 lg:py-10">
      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-10">
        {/* Desktop rail */}
        <nav aria-label="Mon compte" className="hidden lg:block">
          <p className="text-xs font-display font-bold uppercase tracking-wide text-gray-400 mb-3 px-3">Mon compte</p>
          <ul className="flex flex-col gap-1 sticky top-32">
            {TABS.map((t) => {
              const active = isActive(t);
              return (
                <li key={t.href}>
                  <Link
                    href={t.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center justify-between gap-2 px-3 min-h-tap rounded-lg text-sm border-s-[3px] ${
                      active
                        ? "bg-navy-50 border-red-500 text-navy-950 font-semibold"
                        : "border-transparent text-gray-600 hover:bg-gray-50 hover:text-navy-900"
                    }`}
                  >
                    {t.label}
                    {t.href === "/compte/commandes" && count ? (
                      <span className="text-xs text-gray-400 tabular-nums">{count}</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0">
          {/* Mobile tabs — scrollable so they never wrap or shrink below tap size */}
          <nav aria-label="Mon compte" className="lg:hidden -mx-4 px-4 mb-5 overflow-x-auto no-scrollbar">
            <div className="flex gap-2 w-max">
              {TABS.map((t) => {
                const active = isActive(t);
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap px-4 min-h-tap-compact rounded-full border text-sm ${
                      active
                        ? "bg-navy-900 border-navy-900 text-white font-semibold"
                        : "bg-white border-gray-300 text-gray-700"
                    }`}
                  >
                    {t.short}
                    {t.href === "/compte/commandes" && count ? (
                      <span className={active ? "text-white/60" : "text-gray-400"}>{count}</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </nav>

          <header className="mb-5">
            <h1 className="text-xl sm:text-2xl font-heading font-extrabold uppercase text-navy-950 tracking-tight">
              {title}
            </h1>
            {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          </header>

          {children}
        </div>
      </div>
    </div>
  );
}
