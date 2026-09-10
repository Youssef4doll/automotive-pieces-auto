"use client";

import { useState, useTransition } from "react";
import { setFitment, setModelFitment } from "@/app/actions/vehicles";

export type FitMake = {
  id: string;
  name: string;
  models: {
    id: string;
    name: string;
    yearFrom: number | null;
    yearTo: number | null;
    engines: { id: string; name: string; fuel: string | null; engineCode: string | null }[];
  }[];
};

/**
 * Which cars this part fits.
 *
 * This is the data the storefront's "compatible avec votre véhicule" badge
 * reads — see FitConfidence. Three states matter and only two are obvious:
 * a part with fitments that include the shopper's engine is a yes, one with
 * fitments that exclude it is a no, and a part with **no fitment rows at all**
 * is an honest "we do not know" rather than a no. So leaving this empty is a
 * legitimate answer, and the panel says so instead of nagging.
 *
 * Ticking a whole model is the common case — a filter fits every engine in the
 * range — so that is one control, with the engines underneath for the parts
 * where it genuinely depends on the motor.
 */
export default function FitmentEditor({
  productId,
  makes,
  initialEngineIds,
}: {
  productId: string;
  makes: FitMake[];
  initialEngineIds: string[];
}) {
  const [fitted, setFitted] = useState<Set<string>>(new Set(initialEngineIds));
  const [openMake, setOpenMake] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggleEngine = (engineId: string, next: boolean) => {
    // Optimistic: the checkbox answers the tap, and the server correction (if
    // any) arrives as a message rather than a silently reverted box.
    setFitted((s) => {
      const copy = new Set(s);
      if (next) copy.add(engineId);
      else copy.delete(engineId);
      return copy;
    });
    start(async () => {
      const r = await setFitment(productId, engineId, next);
      setMsg(r?.error ?? null);
      if (r?.error) {
        setFitted((s) => {
          const copy = new Set(s);
          if (next) copy.delete(engineId);
          else copy.add(engineId);
          return copy;
        });
      }
    });
  };

  const toggleModel = (model: FitMake["models"][number], next: boolean) => {
    const ids = model.engines.map((e) => e.id);
    setFitted((s) => {
      const copy = new Set(s);
      for (const id of ids) next ? copy.add(id) : copy.delete(id);
      return copy;
    });
    start(async () => {
      const r = await setModelFitment(productId, model.id, next);
      setMsg(r?.error ?? null);
    });
  };

  const countFor = (make: FitMake) =>
    make.models.reduce((n, m) => n + m.engines.filter((e) => fitted.has(e.id)).length, 0);

  return (
    <section aria-labelledby="fitments" className="flex flex-col gap-3">
      <div>
        <h2 id="fitments" className="text-xs font-display font-bold uppercase tracking-wide text-navy-900/45">
          Véhicules compatibles
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {fitted.size === 0 ? (
            <>
              Aucune compatibilité déclarée. En ligne, la pièce s&apos;affiche comme{" "}
              <span className="font-semibold">non vérifiée</span> — jamais comme incompatible.
            </>
          ) : (
            <>
              <span className="font-semibold text-navy-950">{fitted.size}</span> motorisation(s) déclarée(s)
              compatible(s). Les clients dont le véhicule y figure voient la pièce confirmée.
            </>
          )}
        </p>
      </div>

      {msg && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{msg}</p>
      )}

      <div className="flex flex-col gap-1.5">
        {makes.map((make) => {
          const open = openMake === make.id;
          const n = countFor(make);
          return (
            <div key={make.id} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenMake(open ? null : make.id)}
                className="w-full flex items-center gap-3 px-3 min-h-tap text-start hover:bg-gray-50"
              >
                <span className="flex-1 font-semibold text-sm text-navy-950">{make.name}</span>
                {n > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                    {n}
                  </span>
                )}
                <span className="text-xs text-gray-400">{make.models.length} modèle(s)</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`text-gray-400 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden="true">
                  <path d="M8 5l8 7-8 7" />
                </svg>
              </button>

              {open && (
                <div className="border-t border-gray-100 p-3 flex flex-col gap-3 bg-gray-50/60">
                  {make.models.length === 0 && (
                    <p className="text-sm text-gray-500">Cette marque n&apos;a encore aucun modèle.</p>
                  )}
                  {make.models.map((model) => {
                    const all = model.engines.length > 0 && model.engines.every((e) => fitted.has(e.id));
                    const some = model.engines.some((e) => fitted.has(e.id));
                    const years = [model.yearFrom, model.yearTo].filter(Boolean).join("–");
                    return (
                      <div key={model.id} className="rounded-lg border border-gray-200 bg-white p-2.5">
                        <label className="flex items-center gap-2.5 min-h-tap-compact cursor-pointer">
                          <input
                            type="checkbox"
                            className="w-[18px] h-[18px]"
                            checked={all}
                            ref={(el) => { if (el) el.indeterminate = some && !all; }}
                            disabled={pending || model.engines.length === 0}
                            onChange={(e) => toggleModel(model, e.target.checked)}
                          />
                          <span className="font-semibold text-sm text-navy-950">{model.name}</span>
                          {years && <span className="text-xs text-gray-500">{years}</span>}
                          {model.engines.length === 0 && (
                            <span className="text-xs text-amber-700">aucune motorisation</span>
                          )}
                        </label>

                        {model.engines.length > 0 && (
                          <ul className="mt-1.5 ps-7 flex flex-col gap-0.5">
                            {model.engines.map((e) => (
                              <li key={e.id}>
                                <label className="flex items-center gap-2.5 min-h-tap-compact cursor-pointer text-sm">
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4"
                                    checked={fitted.has(e.id)}
                                    disabled={pending}
                                    onChange={(ev) => toggleEngine(e.id, ev.target.checked)}
                                  />
                                  <span className="text-navy-900">{e.name}</span>
                                  <span className="text-xs text-gray-500">
                                    {[e.fuel, e.engineCode].filter(Boolean).join(" · ")}
                                  </span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
