"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useVehicle } from "@/lib/vehicle-store";
import VehiclePicker from "@/components/VehiclePicker";
import { IconCar, IconCheck, IconPlus, IconTrash, IconArrowRight } from "./icons";

/**
 * The garage is the centre of an automotive account: the stored vehicle is what
 * turns a catalogue into "parts for my car". Only the fields the vehicle store
 * actually holds are shown — make, model, engine — because inventing a year or
 * a fuel type would be worse than omitting it.
 */
export default function GarageSection({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const vehicles = useVehicle((s) => s.vehicles);
  const active = useVehicle((s) => s.vehicle);
  const selectActive = useVehicle((s) => s.selectActive);
  const removeVehicle = useVehicle((s) => s.removeVehicle);
  const [pickerOpen, setPickerOpen] = useState(false);

  function shopFor(engineId: string) {
    selectActive(engineId);
    router.push("/#symptomes");
  }

  return (
    <section aria-labelledby="garage" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <h2 id="garage" className="font-heading font-extrabold uppercase text-navy-950 tracking-tight">
            Mon garage
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Retrouvez rapidement les pièces compatibles avec vos véhicules.
          </p>
        </div>
        {vehicles.length > 0 && !compact && (
          <Link
            href="/compte/garage"
            className="inline-flex items-center gap-1 min-h-tap-compact text-xs font-semibold text-navy-900 hover:text-red-600"
          >
            Tout voir <IconArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {vehicles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center">
          <span className="inline-grid place-items-center w-12 h-12 rounded-full bg-slate-100 text-slate-400 mb-3">
            <IconCar />
          </span>
          <p className="font-semibold text-navy-950 mb-1">Votre garage est vide</p>
          <p className="text-sm text-slate-500 mb-4 max-w-sm mx-auto">
            Ajoutez votre voiture pour trouver plus facilement les bonnes pièces.
          </p>
          <button
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-2 min-h-tap px-5 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-display font-bold uppercase text-xs tracking-wide"
          >
            <IconPlus className="w-4 h-4" /> Ajouter mon véhicule
          </button>
        </div>
      ) : (
        <>
          {/* A rail on a phone, a grid once there is room. */}
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar sm:overflow-visible">
            <ul className={`flex gap-3 w-max sm:w-auto sm:grid ${compact ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
              {vehicles.map((v) => {
                const isActive = active?.engineId === v.engineId;
                return (
                  <li
                    key={v.engineId}
                    className={`w-[260px] sm:w-auto shrink-0 rounded-xl border p-4 transition-colors ${
                      isActive ? "border-navy-900 bg-navy-50/60" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p
                          className="font-heading font-extrabold uppercase leading-tight truncate text-navy-950"
                        >
                          {v.makeName} {v.modelName}
                        </p>
                        <p className="text-xs mt-0.5 truncate text-slate-500">
                          {v.engineName}
                        </p>
                      </div>
                      <IconCar className={isActive ? "text-navy-900" : "text-slate-300"} />
                    </div>

                    {isActive ? (
                      <p className="inline-flex items-center gap-1.5 mt-3 text-[11px] font-bold uppercase tracking-wide text-green-700">
                        <IconCheck className="w-3.5 h-3.5" /> Véhicule actif
                      </p>
                    ) : (
                      <button
                        onClick={() => selectActive(v.engineId)}
                        className="mt-3 inline-flex items-center min-h-tap-compact text-xs font-semibold text-navy-900 underline underline-offset-2"
                      >
                        Rendre actif
                      </button>
                    )}

                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => shopFor(v.engineId)}
                        className={`flex-1 min-h-tap rounded-lg font-display font-bold uppercase text-xs tracking-wide transition-colors ${
                          isActive
                            ? "bg-gold-500 hover:bg-gold-400 text-navy-950"
                            : "bg-white border border-navy-900 text-navy-950 hover:bg-navy-50"
                        }`}
                      >
                        Acheter pour cette voiture
                      </button>
                      <button
                        onClick={() => removeVehicle(v.engineId)}
                        aria-label={`Retirer ${v.makeName} ${v.modelName} du garage`}
                        className="w-tap min-h-tap rounded-lg border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 grid place-items-center transition-colors"
                      >
                        <IconTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <button
            onClick={() => setPickerOpen(true)}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 min-h-tap rounded-xl border border-dashed border-slate-300 text-slate-600 hover:border-navy-700 hover:text-navy-900 text-sm font-semibold transition-colors"
          >
            <IconPlus className="w-4 h-4" /> Ajouter un véhicule
          </button>
        </>
      )}

      {pickerOpen && <VehiclePicker onClose={() => setPickerOpen(false)} />}
    </section>
  );
}
