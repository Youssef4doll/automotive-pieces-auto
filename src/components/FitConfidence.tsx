"use client";

import { useState } from "react";
import { useVehicle } from "@/lib/vehicle-store";
import { contactLink } from "@/lib/contact-link";
import VehiclePicker from "./VehiclePicker";

export type FitInput = {
  name: string;
  sku: string;
  fitmentEngineIds: string[];
  axle: string | null;
  side: string | null;
  hasFitmentData: boolean;
};

/**
 * Never claim certainty we do not have.
 *
 * Silence was being read as "probably doesn't fit", and with partial fitment
 * coverage silence is what most visitors saw. Four honest states replace it,
 * and the uncertain ones all carry a way forward instead of a dead end.
 *
 * The way forward now starts here rather than elsewhere. A shopper with no car
 * saved used to be told to "indiquez votre véhicule en haut de la page" — an
 * instruction, pointing at a control somewhere else, given at the exact moment
 * they were deciding whether to spend money. The picker opens from this panel
 * instead: the question is asked where the answer matters, and answering it
 * turns the same panel into a verdict without leaving the product.
 */
export default function FitConfidence({ product, whatsapp }: { product: FitInput; whatsapp: string | null }) {
  const vehicle = useVehicle((s) => s.vehicle);
  const [pickerOpen, setPickerOpen] = useState(false);

  const position = [
    product.axle === "AVANT" ? "Avant" : product.axle === "ARRIERE" ? "Arrière" : null,
    product.side === "GAUCHE" ? "Gauche" : product.side === "DROITE" ? "Droite" : null,
  ].filter(Boolean);

  const ask = (text: string) =>
    contactLink({ whatsapp, email: null }, text);

  let state: "verified" | "mismatch" | "unknown" | "no-vehicle";
  if (!vehicle) state = "no-vehicle";
  else if (product.fitmentEngineIds.includes(vehicle.engineId)) state = "verified";
  else if (product.hasFitmentData) state = "mismatch";
  else state = "unknown";

  const vehicleLabel = vehicle ? `${vehicle.makeName} ${vehicle.modelName} ${vehicle.engineName}` : "";

  /** Small, secondary, and in every state that has a car: this is a correction,
   *  not an action — it must never compete with "add to cart". */
  const changeCar = (
    <button
      type="button"
      onClick={() => setPickerOpen(true)}
      className="inline-flex min-h-tap-compact items-center px-2 text-xs font-semibold text-navy-700 underline underline-offset-2 hover:text-navy-950"
    >
      Changer de véhicule
    </button>
  );

  return (
    <div className="flex flex-col gap-2 mb-4">
      {position.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Position :</span>
          {position.map((p) => (
            <span key={p} className="text-xs font-bold uppercase tracking-wide px-2 py-1 rounded bg-navy-900 text-white">
              {p}
            </span>
          ))}
        </div>
      )}

      {state === "verified" && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
          <p className="text-sm font-semibold text-green-800">✓ Compatible avec votre {vehicleLabel}</p>
          <p className="text-xs text-green-700 mt-0.5">Compatibilité vérifiée dans notre base.</p>
          <div className="mt-1 -ms-2">{changeCar}</div>
        </div>
      )}

      {state === "mismatch" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-sm font-semibold text-amber-800">À confirmer pour votre {vehicleLabel}</p>
          <p className="text-xs text-amber-700 mt-0.5 mb-2">
            Cette pièce n&apos;est pas listée pour votre motorisation. Elle peut malgré tout convenir — envoyez-nous
            votre carte grise et on vérifie.
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <a
              href={ask(`Bonjour, est-ce que « ${product.name} » (réf. ${product.sku}) convient à ma ${vehicleLabel} ?`)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center min-h-tap-compact px-3 rounded-lg bg-green-700 text-white text-xs font-semibold"
            >
              Vérifier sur WhatsApp
            </a>
            {changeCar}
          </div>
        </div>
      )}

      {state === "unknown" && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
          <p className="text-sm font-semibold text-navy-950">Compatibilité à confirmer</p>
          <p className="text-xs text-gray-600 mt-0.5 mb-2">
            Nous n&apos;avons pas encore la liste des véhicules pour cette référence. Dites-nous votre voiture et on
            confirme avant que vous ne commandiez.
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <a
              href={ask(`Bonjour, est-ce que « ${product.name} » (réf. ${product.sku}) convient à ma voiture ?`)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center min-h-tap-compact px-3 rounded-lg bg-green-700 text-white text-xs font-semibold"
            >
              Faire vérifier
            </a>
            {changeCar}
          </div>
        </div>
      )}

      {/* The ask, where the decision is made.
          Offered whether or not this part has fitment data: a shopper who
          tells us their car gets a verdict on this page when we have one, and
          gets the rest of the site filtered to their car either way. */}
      {state === "no-vehicle" && (
        <div className="rounded-lg border border-navy-900/15 bg-navy-50/60 px-3 py-2.5">
          <p className="text-sm font-semibold text-navy-950">Cette pièce va-t-elle sur votre voiture ?</p>
          <p className="text-xs text-gray-600 mt-0.5 mb-2">
            {product.hasFitmentData
              ? "Choisissez votre véhicule et nous vous le disons tout de suite, sur cette page."
              : "Dites-nous votre véhicule : nous confirmons la référence avant que vous ne commandiez."}
          </p>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-2 min-h-tap px-4 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-display font-bold uppercase text-xs tracking-wide"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 17h14M4 17v-4.2L6 7h12l2 5.8V17" />
              <path d="M4 17v2h3v-2M17 17v2h3v-2" />
              <circle cx="7.5" cy="13.5" r=".8" />
              <circle cx="16.5" cy="13.5" r=".8" />
            </svg>
            Sélectionner mon véhicule
          </button>
        </div>
      )}

      {pickerOpen && <VehiclePicker onClose={() => setPickerOpen(false)} />}
    </div>
  );
}
