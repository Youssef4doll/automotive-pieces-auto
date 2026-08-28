"use client";

import { useState } from "react";
import { useLocale } from "@/i18n/LocaleProvider";
import { useVehicle, vehicleLabel } from "@/lib/vehicle-store";
import VehiclePicker from "./VehiclePicker";

export default function MyVehicleChip() {
  const { t } = useLocale();
  const vehicle = useVehicle((s) => s.vehicle);
  const [open, setOpen] = useState(false);
  const label = vehicleLabel(vehicle);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-white/95 rounded-full ps-3 pe-1.5 min-h-tap shadow-sm border border-gray-200 text-xs sm:text-sm"
      >
        <span className="text-gray-500">{t("finder.myVehicle")}:</span>
        <span className="font-bold text-navy-900">{label ?? t("finder.notSet")}</span>
        <span className="px-2.5 py-1 rounded-full bg-navy-900 text-white text-[11px] font-semibold">
          {t("finder.changeVehicle")}
        </span>
      </button>
      {open && <VehiclePicker onClose={() => setOpen(false)} />}
    </>
  );
}
