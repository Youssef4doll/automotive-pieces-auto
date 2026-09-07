"use client";

import Link from "next/link";
import { useVehicle } from "@/lib/vehicle-store";
import { IconOrders, IconCar, IconPackage, IconHelp, IconUser, IconArrowRight } from "./icons";

type Tile = {
  href: string;
  title: string;
  blurb: string;
  Icon: (p: { className?: string }) => React.ReactElement;
  /** A real count, or null when there is nothing to count. */
  count?: number | null;
};

/**
 * The account, as a board of doors.
 *
 * It was a dashboard: a live order with its full timeline, quick actions, the
 * garage, a search box, previously-bought parts, recent orders, help and a
 * trust panel, stacked. Everything on it was real and useful, and together it
 * was a wall — the shop's own word was "complicated". A hub asks one question
 * instead ("what did you come here to do?") and every answer is one tap away,
 * which is how the big parts catalogues do it.
 *
 * Five tiles: the shop has six sections and the sixth is this page. The
 * reference this was modelled on has eight, including saved cards, a document
 * vault, returns and an address book — none of which exist here. A tile that
 * opens onto a page we have not built is worse than no tile, so those are not
 * here.
 *
 * The counts are read, never estimated: orders come from the database, vehicles
 * from the garage in this browser.
 */
export default function AccountTiles({
  orderCount,
  partCount,
}: {
  orderCount: number;
  partCount: number;
}) {
  // The garage lives in the browser, so it can only be counted on the client.
  const vehicles = useVehicle((s) => s.vehicles);

  const tiles: Tile[] = [
    {
      href: "/compte/commandes",
      title: "Mes commandes",
      blurb: "Suivre une commande, revoir ce que vous avez acheté",
      Icon: IconOrders,
      count: orderCount,
    },
    {
      href: "/compte/garage",
      title: "Mon garage",
      blurb: "Vos voitures, pour ne voir que les pièces qui vont dessus",
      Icon: IconCar,
      count: vehicles.length,
    },
    {
      href: "/compte/pieces",
      title: "Mes pièces",
      blurb: "Racheter une pièce déjà commandée en un clic",
      Icon: IconPackage,
      count: partCount,
    },
    {
      href: "/compte/profil",
      title: "Mon profil",
      blurb: "Nom, téléphone, adresse e-mail et mot de passe",
      Icon: IconUser,
      count: null,
    },
    {
      href: "/compte/aide",
      title: "Aide",
      blurb: "Livraison, retours, garantie — et comment nous joindre",
      Icon: IconHelp,
      count: null,
    },
  ];

  return (
    // Labelled because the phone's section row is also a list of links to
    // /compte/*, and "the tiles" needs to be a thing you can name — for a
    // screen reader first, and for the tests second.
    <ul
      aria-label="Sections de votre compte"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
    >
      {tiles.map((t) => (
        <li key={t.href}>
          <Link
            href={t.href}
            className="group h-full flex flex-col gap-3 p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white hover:border-navy-900 hover:shadow-sm transition-colors"
          >
            <span className="flex items-start justify-between gap-3">
              <span className="grid place-items-center w-11 h-11 rounded-xl bg-slate-50 text-navy-900 group-hover:bg-navy-900 group-hover:text-white transition-colors">
                <t.Icon className="w-5 h-5" />
              </span>
              {/* Only when there is something to say. A badge reading "0" is a
                  worry, not information — the tile's own copy already says
                  what the section is for. */}
              {typeof t.count === "number" && t.count > 0 && (
                <span className="min-w-6 h-6 px-2 grid place-items-center rounded-full bg-slate-100 text-navy-900 text-xs font-bold tabular-nums">
                  {t.count}
                </span>
              )}
            </span>

            <span className="flex-1">
              <span className="block font-heading font-extrabold uppercase tracking-tight text-navy-950">
                {t.title}
              </span>
              <span className="block text-sm text-slate-500 mt-1 leading-snug">{t.blurb}</span>
            </span>

            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy-900 group-hover:text-red-600 transition-colors">
              Ouvrir <IconArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
