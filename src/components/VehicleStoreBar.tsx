"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/i18n/LocaleProvider";
import { useVehicle, vehicleLabel } from "@/lib/vehicle-store";
import VehiclePicker from "./VehiclePicker";

/**
 * A persistent "my vehicle / my store" strip sitting directly under the
 * header on every page.
 *
 * For an auto-parts shop the selected vehicle decides whether anything on
 * the page is even buyable, so it belongs in the site chrome rather than
 * inside one section of one page — previously it only appeared on catalogue
 * pages, so a shopper landing on a product or the homepage had no visible
 * way to set it. Keeping it here also means the answer to "does this fit?"
 * is always one tap away, wherever the shopper is.
 */
export default function VehicleStoreBar({ storeAddress }: { storeAddress: string | null }) {
  const { t } = useLocale();
  const vehicle = useVehicle((s) => s.vehicle);
  const [pickerOpen, setPickerOpen] = useState(false);
  const label = vehicleLabel(vehicle);

  return (
    <>
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl grid grid-cols-2 divide-x divide-gray-200">
          <button
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-2.5 px-gutter py-2 min-h-tap text-start hover:bg-gray-50 transition-colors"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0f2352" strokeWidth="1.6" className="shrink-0">
              <path d="M3 13l1.8-5.2A2 2 0 0 1 6.7 6.4h10.6a2 2 0 0 1 1.9 1.4L21 13v5h-3v-1.6H6V18H3v-5Z" />
              <circle cx="7" cy="15" r="1" />
              <circle cx="17" cy="15" r="1" />
            </svg>
            <span className="min-w-0">
              <span className="block text-[10.5px] uppercase tracking-[.08em] text-gray-500 leading-tight">
                {t("finder.myVehicle")}
              </span>
              <span className={`block text-[13px] font-bold leading-tight truncate ${label ? "text-navy-950" : "text-navy-900"}`}>
                {label ?? t("nav.selectVehicle")}
              </span>
            </span>
          </button>

          <Link
            href="/#magasin"
            className="flex items-center gap-2.5 px-gutter py-2 min-h-tap hover:bg-gray-50 transition-colors"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0f2352" strokeWidth="1.6" className="shrink-0">
              <path d="M4 9h16v11H4z" />
              <path d="M3 9l1.6-4h14.8L21 9" />
              <path d="M9.5 20v-5h5v5" />
            </svg>
            <span className="min-w-0">
              <span className="block text-[10.5px] uppercase tracking-[.08em] text-gray-500 leading-tight">
                {t("nav.myStore")}
              </span>
              <span className="block text-[13px] font-bold text-navy-950 leading-tight truncate">
                {/* Falls back to a contact prompt rather than an address the
                    owner has not entered yet. */}
                {storeAddress ?? t("nav.contact")}
              </span>
            </span>
          </Link>
        </div>
      </div>

      {pickerOpen && <VehiclePicker onClose={() => setPickerOpen(false)} />}
    </>
  );
}
