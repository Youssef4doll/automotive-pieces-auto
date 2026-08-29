"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/catalogue", label: "Catégories" },
  { href: "/admin/catalogue/marques", label: "Marques" },
  { href: "/admin/stock", label: "Produits" },
  { href: "/admin/qualite", label: "Qualité" },
  { href: "/admin/import", label: "Import" },
];

export default function CatalogTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 border-b border-gray-200">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-4 min-h-tap inline-flex items-center font-display font-bold uppercase text-xs tracking-wide border-b-2 -mb-px ${
              active ? "border-red-500 text-navy-950" : "border-transparent text-gray-500 hover:text-navy-900"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
