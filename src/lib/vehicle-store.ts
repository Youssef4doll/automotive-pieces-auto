"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SelectedVehicle = {
  makeId: string;
  makeName: string;
  modelId: string;
  modelName: string;
  engineId: string;
  engineName: string;
} | null;

type VehicleState = {
  vehicle: SelectedVehicle;
  set: (v: SelectedVehicle) => void;
  clear: () => void;
};

export const useVehicle = create<VehicleState>()(
  persist(
    (set) => ({
      vehicle: null,
      set: (v) => set({ vehicle: v }),
      clear: () => set({ vehicle: null }),
    }),
    { name: "apa-vehicle" }
  )
);

export function vehicleLabel(v: SelectedVehicle) {
  if (!v) return null;
  return `${v.makeName} ${v.modelName} · ${v.engineName}`;
}
