"use client";

import { useState } from "react";
import { useLocale } from "@/i18n/LocaleProvider";
import { useVehicle, vehicleLabel } from "@/lib/vehicle-store";
import VehiclePicker from "./VehiclePicker";

/**
 * What a category page says before it says anything else.
 *
 * A category page opened without a vehicle is a wall of parts, most of which
 * do not fit the car in the customer's driveway — and nothing on the page says
 * so. That is the moment a shopper either asks for help or leaves, so it is
 * the moment to ask the one question that makes the rest of the page correct.
 *
 * With a vehicle it is a statement of fact instead: this is the category, this
 * is your car, compatible parts come first. The claim is deliberately "shown
 * first", not "only these fit" — the filter bar below can still reveal parts
 * whose compatibility nobody has verified, and calling those incompatible
 * would be a claim the data does not support.
 */
export default function CategoryVehicleBar({ categoryName }: { categoryName: string }) {
  const { t } = useLocale();
  const vehicle = useVehicle((s) => s.vehicle);
  const [open, setOpen] = useState(false);

  return (
    <>
      {vehicle ? (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-green-200 bg-green-50 px-3.5 py-2.5">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-green-900">
            <IconCheck />
            {categoryName} — {t("cat.forYourCar")} {vehicleLabel(vehicle)}
          </span>
          <span className="text-xs text-green-800/80">{t("cat.compatibleShown")}</span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="ms-auto min-h-tap-compact px-3 rounded-lg border border-green-300 bg-white text-green-900 text-xs font-semibold hover:border-green-500"
          >
            {t("cat.changeCar")}
          </button>
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-navy-900/15 bg-navy-50 px-3.5 py-2.5">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-navy-950">
            <IconCar />
            {t("cat.tellUsCar")}
          </span>
          <span className="text-xs text-navy-900/70">{t("cat.tellUsCarWhy")}</span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="ms-auto min-h-tap-compact px-4 rounded-lg bg-navy-900 hover:bg-navy-800 text-white text-xs font-display font-bold uppercase tracking-wide"
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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
      <path d="m4 12.5 5 5L20 6.5" />
    </svg>
  );
}

function IconCar() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
      <path d="M5 17h14M4 17v-4.2L6 7h12l2 5.8V17" />
      <path d="M4 17v2h3v-2M17 17v2h3v-2" />
      <circle cx="7.5" cy="13.5" r=".8" />
      <circle cx="16.5" cy="13.5" r=".8" />
    </svg>
  );
}
