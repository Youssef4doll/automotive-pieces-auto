"use client";

import { useState } from "react";
import { useLocale } from "@/i18n/LocaleProvider";
import { useVehicle, vehicleLabel } from "@/lib/vehicle-store";
import VehiclePicker from "./VehiclePicker";

/**
 * The vehicle card in a category page's header.
 *
 * A category page opened without a vehicle is a wall of parts, most of which
 * do not fit the car in the customer's driveway — and nothing on the page says
 * so. That is the moment a shopper either asks for help or leaves, so it is
 * the moment to ask the one question that makes the rest of the page correct.
 *
 * With a vehicle it is a statement of fact instead: this is your car,
 * compatible parts come first. The claim is deliberately "shown first", not
 * "only these fit" — the bar above the grid can still reveal parts whose
 * compatibility nobody has verified, and calling those incompatible would be a
 * claim the data does not support.
 */
export default function CategoryVehicleBar() {
  const { t } = useLocale();
  const vehicle = useVehicle((s) => s.vehicle);
  const [open, setOpen] = useState(false);

  return (
    <>
      {vehicle ? (
        <div className="flex items-center gap-3.5 rounded-2xl border border-navy-900/10 bg-white p-4 shadow-sm">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy-50 text-navy-900">
            <IconCar />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-navy-900/55">{t("cat.yourVehicle")}</p>
            <p className="truncate font-heading text-[16px] font-extrabold leading-tight text-navy-950">{vehicleLabel(vehicle)}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-green-700">
              <IconCheck />
              {t("cat.compatibleShown")}
            </p>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-1 inline-flex min-h-tap-compact items-center gap-1 text-xs font-semibold text-navy-900 underline underline-offset-2 hover:text-red-600"
            >
              {t("cat.changeVehicle")} <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border border-navy-900/10 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy-50 text-navy-900">
              <IconCar />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-heading text-[16px] font-extrabold leading-tight text-navy-950">{t("cat.tellUsCar")}</p>
              <p className="mt-0.5 text-xs text-gray-600">{t("cat.tellUsCarWhy")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full rounded-lg bg-navy-900 px-4 min-h-tap text-xs font-display font-bold uppercase tracking-wide text-white hover:bg-navy-800"
          >
            {t("finder2.pickCar")}
          </button>
        </div>
      )}
      {open && <VehiclePicker onClose={() => setOpen(false)} />}
    </>
  );
}

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
      <path d="m4 12.5 5 5L20 6.5" />
    </svg>
  );
}

function IconCar() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
      <path d="M5 17h14M4 17v-4.2L6 7h12l2 5.8V17" />
      <path d="M4 17v2h3v-2M17 17v2h3v-2" />
      <circle cx="7.5" cy="13.5" r=".8" />
      <circle cx="16.5" cy="13.5" r=".8" />
    </svg>
  );
}
