"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { track } from "./track";

export type SavedVehicle = {
  makeId: string;
  makeName: string;
  modelId: string;
  modelName: string;
  engineId: string;
  engineName: string;
};

export type SelectedVehicle = SavedVehicle | null;

type VehicleState = {
  // "My Garage": every vehicle the customer has ever identified, most
  // recently used first. `vehicle` mirrors whichever one is active so every
  // existing consumer (`useVehicle((s) => s.vehicle)`) keeps working
  // unchanged — a saved garage is additive, not a breaking change.
  vehicles: SavedVehicle[];
  vehicle: SelectedVehicle;
  /** Select an engine — adds it to the garage if new, and makes it active. */
  set: (v: SavedVehicle) => void;
  /** Switch the active vehicle to one already in the garage. */
  selectActive: (engineId: string) => void;
  /** Remove a vehicle from the garage; if it was active, activate the next one (or none). */
  removeVehicle: (engineId: string) => void;
  clear: () => void;
};

const MAX_GARAGE_SIZE = 6;

export const useVehicle = create<VehicleState>()(
  persist(
    (set, get) => ({
      vehicles: [],
      vehicle: null,
      set: (v) => {
        set((state) => {
          const rest = state.vehicles.filter((x) => x.engineId !== v.engineId);
          const vehicles = [v, ...rest].slice(0, MAX_GARAGE_SIZE);
          return { vehicles, vehicle: v };
        });
        track("vehicle_selected", { makeName: v.makeName, modelName: v.modelName, engineName: v.engineName });
      },
      selectActive: (engineId) => {
        const found = get().vehicles.find((x) => x.engineId === engineId);
        if (found) set({ vehicle: found });
      },
      removeVehicle: (engineId) =>
        set((state) => {
          const vehicles = state.vehicles.filter((x) => x.engineId !== engineId);
          const vehicle = state.vehicle?.engineId === engineId ? (vehicles[0] ?? null) : state.vehicle;
          return { vehicles, vehicle };
        }),
      clear: () => set({ vehicle: null }),
    }),
    { name: "apa-vehicle" }
  )
);

export function vehicleLabel(v: SelectedVehicle) {
  if (!v) return null;
  return `${v.makeName} ${v.modelName} · ${v.engineName}`;
}
