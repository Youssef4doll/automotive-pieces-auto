"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useVehicle } from "@/lib/vehicle-store";

type Engine = { id: string; name: string; fuel: string | null; powerHp: number | null };

/**
 * Turns a landing page into a shopping session.
 *
 * Someone arriving from Google searched for their own car, so the site
 * already knows more about them than any form could ask. This offers the one
 * thing that makes every subsequent page better — saving the vehicle — in a
 * single tap, and asks for the engine only because a brake pad for a 1.5 dCi
 * is not a brake pad for a 1.2 16v.
 *
 * If the car is already in the garage it says so instead of asking again.
 */
export default function AdoptVehicle({
  makeId,
  makeName,
  modelId,
  modelName,
  engines,
}: {
  makeId: string;
  makeName: string;
  modelId: string;
  modelName: string;
  engines: Engine[];
}) {
  const router = useRouter();
  const active = useVehicle((s) => s.vehicle);
  const save = useVehicle((s) => s.set);
  const [choosing, setChoosing] = useState(false);

  const alreadyHere = active?.modelId === modelId;

  const pick = (engine: Engine) => {
    save({
      makeId,
      makeName,
      modelId,
      modelName,
      engineId: engine.id,
      engineName: engine.name,
    });
    setChoosing(false);
    router.refresh();
  };

  if (alreadyHere) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
        <span className="text-sm text-green-900">
          <span aria-hidden="true">✓</span> Votre véhicule : <strong className="font-semibold">
            {makeName} {modelName} {active?.engineName}
          </strong>
        </span>
        <button
          type="button"
          onClick={() => setChoosing(true)}
          className="text-sm font-semibold text-navy-600 hover:text-red-600 underline underline-offset-2"
        >
          Changer de motorisation
        </button>
        {choosing && <EngineList engines={engines} onPick={pick} />}
      </div>
    );
  }

  if (engines.length === 0) return null;

  return (
    <div className="rounded-xl border border-navy-900/12 bg-navy-50/60 px-4 py-3">
      {!choosing ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-sm text-navy-950 min-w-0">
            Vous roulez en <strong className="font-semibold">{makeName} {modelName}</strong> ? Enregistrez-la
            et nous filtrons tout le site sur votre voiture.
          </p>
          <button
            type="button"
            onClick={() => (engines.length === 1 ? pick(engines[0]) : setChoosing(true))}
            className="shrink-0 inline-flex items-center min-h-tap px-4 rounded-lg bg-navy-950 hover:bg-navy-800 text-white font-display font-bold uppercase text-xs tracking-wide transition-colors"
          >
            C&apos;est ma voiture
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm text-navy-950 mb-2.5">Quelle motorisation ?</p>
          <EngineList engines={engines} onPick={pick} />
        </div>
      )}
    </div>
  );
}

function EngineList({ engines, onPick }: { engines: Engine[]; onPick: (e: Engine) => void }) {
  return (
    <div className="flex flex-wrap gap-2 w-full">
      {engines.map((e) => (
        <button
          key={e.id}
          type="button"
          onClick={() => onPick(e)}
          className="inline-flex items-center gap-2 min-h-tap-compact px-3.5 rounded-full border border-navy-900/20 bg-white text-sm font-semibold text-navy-900 hover:border-navy-900 transition-colors"
        >
          {e.name}
          {e.powerHp && <span className="font-normal text-gray-600">{e.powerHp} ch</span>}
        </button>
      ))}
    </div>
  );
}
