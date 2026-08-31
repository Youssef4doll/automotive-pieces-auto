"use client";

import Link from "next/link";
import { useVehicle } from "@/lib/vehicle-store";
import { IconSearch, IconCar, IconRepeat, IconChat } from "./icons";

/**
 * Four next actions, always in the same place. Whatever state the account is
 * in, one of these is the useful thing to do next — which is the difference
 * between a dashboard that reports and one that helps.
 */
export default function QuickActions({ whatsapp }: { whatsapp: string | null }) {
  const vehicle = useVehicle((s) => s.vehicle);

  // White cards throughout; the accent is carried by the icon, not by filling
  // a whole tile — four saturated blocks compete with the order card above.
  const items = [
    { href: "/recherche", label: "Trouver une pièce", Icon: IconSearch, accent: true },
    {
      href: vehicle ? "/#symptomes" : "/compte/garage",
      label: vehicle ? `Acheter pour ma ${vehicle.makeName}` : "Ajouter ma voiture",
      Icon: IconCar,
      accent: true,
    },
    { href: "/compte/pieces", label: "Commander à nouveau", Icon: IconRepeat, accent: false },
    { href: "/compte/aide", label: "Besoin d'aide ?", Icon: IconChat, accent: false },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map(({ href, label, Icon, accent }) => (
        <Link
          key={label}
          href={href}
          className="group flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 min-h-[104px] text-navy-950 transition-all hover:border-slate-300 hover:shadow-sm hover:-translate-y-0.5"
        >
          <span
            className={`grid place-items-center w-9 h-9 rounded-lg ${
              accent ? "bg-gold-500/15 text-navy-900" : "bg-slate-100 text-slate-500"
            }`}
          >
            <Icon className="w-[18px] h-[18px]" />
          </span>
          <span className="text-sm font-semibold leading-snug">{label}</span>
        </Link>
      ))}
    </div>
  );
}
