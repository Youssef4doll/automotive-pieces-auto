"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Dashboard", icon: "📊", exact: true },
  { href: "/admin/commandes", label: "Commandes", icon: "🧾" },
  { href: "/admin/stock", label: "Stock", icon: "📦" },
  { href: "/admin/clients", label: "Clients", icon: "👤" },
  { href: "/admin/parametres", label: "Paramètres", icon: "⚙️" },
];

export default function AdminNav({ horizontal = false }: { horizontal?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className={horizontal ? "flex gap-1 p-2" : "flex flex-col gap-1 p-3"}>
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap ${
              active ? "bg-white/10 text-white" : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
