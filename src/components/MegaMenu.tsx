"use client";

import Link from "next/link";

export type MegaMenuFamily = {
  id: string;
  name: string;
  slug: string;
  children: { id: string; name: string; slug: string; count: number }[];
};

export default function MegaMenu({
  families,
  onNavigate,
}: {
  families: MegaMenuFamily[];
  onNavigate?: () => void;
}) {
  return (
    <div className="absolute top-full start-0 mt-0 w-[min(90vw,860px)] bg-white text-navy-950 rounded-b-xl shadow-2xl border-t-2 border-gold-500 grid grid-cols-4 gap-0 max-h-[70vh] overflow-y-auto">
      {families.map((family) => (
        <div key={family.id} className="p-3 border-e border-gray-100">
          <Link
            href={`/catalogue/${family.slug}`}
            onClick={onNavigate}
            className="block text-sm font-bold text-navy-900 hover:text-red-600 mb-2"
          >
            {family.name}
          </Link>
          <ul className="space-y-1">
            {family.children.map((sub) => (
              <li key={sub.id}>
                <Link
                  href={`/catalogue/${family.slug}/${sub.slug}`}
                  onClick={onNavigate}
                  className="text-xs text-gray-600 hover:text-red-600 flex items-center justify-between py-0.5"
                >
                  <span className="truncate">{sub.name}</span>
                  {sub.count > 0 && <span className="text-gray-400 ms-1 shrink-0">{sub.count}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
