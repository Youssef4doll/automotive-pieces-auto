"use client";

import { useVehicle } from "@/lib/vehicle-store";

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
 * coverage silence is what most visitors saw. Three honest states replace it,
 * and the two uncertain ones both carry a way forward instead of a dead end.
 */
export default function FitConfidence({ product, whatsapp }: { product: FitInput; whatsapp: string }) {
  const vehicle = useVehicle((s) => s.vehicle);

  const position = [
    product.axle === "AVANT" ? "Avant" : product.axle === "ARRIERE" ? "Arrière" : null,
    product.side === "GAUCHE" ? "Gauche" : product.side === "DROITE" ? "Droite" : null,
  ].filter(Boolean);

  const ask = (text: string) =>
    `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`;

  let state: "verified" | "mismatch" | "unknown" | "no-vehicle";
  if (!vehicle) state = "no-vehicle";
  else if (product.fitmentEngineIds.includes(vehicle.engineId)) state = "verified";
  else if (product.hasFitmentData) state = "mismatch";
  else state = "unknown";

  const vehicleLabel = vehicle ? `${vehicle.makeName} ${vehicle.modelName} ${vehicle.engineName}` : "";

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
        </div>
      )}

      {state === "mismatch" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-sm font-semibold text-amber-800">À confirmer pour votre {vehicleLabel}</p>
          <p className="text-xs text-amber-700 mt-0.5 mb-2">
            Cette pièce n&apos;est pas listée pour votre motorisation. Elle peut malgré tout convenir — envoyez-nous
            votre carte grise et on vérifie.
          </p>
          <a
            href={ask(`Bonjour, est-ce que « ${product.name} » (réf. ${product.sku}) convient à ma ${vehicleLabel} ?`)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center min-h-tap-compact px-3 rounded-lg bg-green-600 text-white text-xs font-semibold"
          >
            Vérifier sur WhatsApp
          </a>
        </div>
      )}

      {state === "unknown" && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
          <p className="text-sm font-semibold text-navy-950">Compatibilité à confirmer</p>
          <p className="text-xs text-gray-600 mt-0.5 mb-2">
            Nous n&apos;avons pas encore la liste des véhicules pour cette référence. Dites-nous votre voiture et on
            confirme avant que vous ne commandiez.
          </p>
          <a
            href={ask(`Bonjour, est-ce que « ${product.name} » (réf. ${product.sku}) convient à ma voiture ?`)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center min-h-tap-compact px-3 rounded-lg bg-green-600 text-white text-xs font-semibold"
          >
            Faire vérifier
          </a>
        </div>
      )}

      {state === "no-vehicle" && product.hasFitmentData && (
        <p className="text-sm text-gray-600">
          Indiquez votre véhicule en haut de la page pour vérifier la compatibilité.
        </p>
      )}
    </div>
  );
}
