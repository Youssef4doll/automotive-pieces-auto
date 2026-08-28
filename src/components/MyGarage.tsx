"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/i18n/LocaleProvider";
import { useVehicle } from "@/lib/vehicle-store";
import VehiclePicker from "./VehiclePicker";

export default function MyGarage() {
  const { t } = useLocale();
  const router = useRouter();
  const vehicles = useVehicle((s) => s.vehicles);
  const activeVehicle = useVehicle((s) => s.vehicle);
  const selectActive = useVehicle((s) => s.selectActive);
  const removeVehicle = useVehicle((s) => s.removeVehicle);
  const [pickerOpen, setPickerOpen] = useState(false);

  function shopForThisCar(engineId: string) {
    selectActive(engineId);
    router.push("/#symptomes");
  }

  return (
    <div className="p-5 rounded-xl border border-gray-200 bg-white mb-4">
      <p className="text-xs text-gray-400 uppercase font-bold mb-3">{t("garage.title")}</p>

      {vehicles.length === 0 ? (
        <p className="text-sm text-gray-500 mb-3">{t("garage.empty")}</p>
      ) : (
        <div className="flex flex-col gap-2.5 mb-3">
          {vehicles.map((v) => {
            const active = activeVehicle?.engineId === v.engineId;
            return (
              <div
                key={v.engineId}
                className={`rounded-lg border p-3.5 ${active ? "border-navy-700 bg-navy-50/60" : "border-gray-200"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-heading font-extrabold uppercase text-navy-950 text-sm leading-tight truncate">
                      {v.makeName} {v.modelName}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{v.engineName}</p>
                  </div>
                  {active ? (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
                      ✓ {t("garage.active")}
                    </span>
                  ) : (
                    <button
                      onClick={() => selectActive(v.engineId)}
                      className="shrink-0 text-xs font-semibold text-navy-900 underline underline-offset-2 min-h-9 flex items-center px-1"
                    >
                      {t("hero.changeVehicle") /* i.e. "use this one" — same intent, reused copy */}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2.5">
                  <button
                    onClick={() => shopForThisCar(v.engineId)}
                    className="flex-1 min-h-10 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 font-display font-bold uppercase text-xs tracking-wide"
                  >
                    {t("garage.shopForThisCar")}
                  </button>
                  <button
                    onClick={() => removeVehicle(v.engineId)}
                    aria-label={t("garage.remove")}
                    className="shrink-0 w-10 h-10 rounded-lg border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 flex items-center justify-center"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setPickerOpen(true)}
        className="w-full min-h-11 rounded-lg border border-dashed border-gray-300 text-gray-600 hover:border-navy-700 hover:text-navy-900 text-sm font-semibold"
      >
        + {t("garage.addAnother")}
      </button>

      {pickerOpen && <VehiclePicker onClose={() => setPickerOpen(false)} />}
    </div>
  );
}
