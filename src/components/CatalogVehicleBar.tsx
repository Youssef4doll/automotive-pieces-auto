"use client";

import { useLocale } from "@/i18n/LocaleProvider";
import { useVehicle } from "@/lib/vehicle-store";
import MyVehicleChip from "./MyVehicleChip";

export default function CatalogVehicleBar() {
  const { t } = useLocale();
  const vehicle = useVehicle((s) => s.vehicle);

  return (
    <div className="flex items-center gap-3 flex-wrap bg-navy-950 rounded-xl px-4 py-3.5 mb-6">
      <span className="text-sm text-white/85 flex-1 min-w-[220px]">
        {vehicle ? t("catalog.vehicleActive") : t("catalog.vehiclePrompt")}
      </span>
      <MyVehicleChip />
    </div>
  );
}
