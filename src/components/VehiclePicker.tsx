"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/i18n/LocaleProvider";
import { useVehicle, vehicleLabel } from "@/lib/vehicle-store";

type Engine = { id: string; name: string; fuel: string | null; powerHp: number | null };
type Model = { id: string; name: string; yearFrom: number | null; yearTo: number | null; engines: Engine[] };
type Make = { id: string; name: string; slug: string; models: Model[] };

export default function VehiclePicker({
  onClose,
  initialMakeSlug,
}: {
  onClose: () => void;
  initialMakeSlug?: string;
}) {
  const { t } = useLocale();
  const setVehicle = useVehicle((s) => s.set);
  const savedVehicles = useVehicle((s) => s.vehicles);
  const activeVehicle = useVehicle((s) => s.vehicle);
  const selectActive = useVehicle((s) => s.selectActive);
  const removeVehicle = useVehicle((s) => s.removeVehicle);
  const [makes, setMakes] = useState<Make[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"make" | "model" | "engine">("make");
  const [make, setMake] = useState<Make | null>(null);
  const [model, setModel] = useState<Model | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch("/api/vehicles")
      .then((r) => r.json())
      .then((data: Make[]) => {
        setMakes(data);
        if (initialMakeSlug) {
          const preset = data.find((m) => m.slug === initialMakeSlug);
          if (preset) {
            setMake(preset);
            setStep("model");
          }
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredMakes = makes.filter((m) => m.name.toLowerCase().includes(filter.toLowerCase()));
  const filteredModels = make?.models.filter((m) => m.name.toLowerCase().includes(filter.toLowerCase())) ?? [];

  function pickEngine(engine: Engine) {
    if (!make || !model) return;
    setVehicle({
      makeId: make.id,
      makeName: make.name,
      modelId: model.id,
      modelName: model.name,
      engineId: engine.id,
      engineName: engine.name,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2 text-sm">
            <button
              className={`py-2.5 px-1.5 -my-2.5 -ms-1.5 ${step === "make" ? "font-bold text-navy-900" : "text-gray-400"}`}
              onClick={() => {
                setStep("make");
                setFilter("");
              }}
            >
              {t("vehicle.make")}
            </button>
            {make && (
              <>
                <span className="text-gray-300">›</span>
                <button
                  className={`py-2.5 px-1.5 -my-2.5 ${step === "model" ? "font-bold text-navy-900" : "text-gray-400"}`}
                  onClick={() => {
                    setStep("model");
                    setFilter("");
                  }}
                >
                  {make.name}
                </button>
              </>
            )}
            {model && (
              <>
                <span className="text-gray-300">›</span>
                <span className="font-bold text-navy-900">{model.name}</span>
              </>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-gray-500" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {step !== "engine" && (
          <div className="p-3 border-b">
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Rechercher…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-navy-700"
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2">
          {loading && <p className="text-center text-gray-400 py-8 text-sm">Chargement…</p>}

          {!loading && step === "make" && savedVehicles.length > 0 && !filter && (
            <div className="p-1 mb-3">
              <p className="text-xs font-bold text-gray-400 uppercase mb-2">{t("garage.title")}</p>
              <ul className="flex flex-col gap-2">
                {savedVehicles.map((v) => {
                  const active = activeVehicle?.engineId === v.engineId;
                  return (
                    <li key={v.engineId} className="flex items-stretch gap-2">
                      <button
                        onClick={() => {
                          selectActive(v.engineId);
                          onClose();
                        }}
                        className={`flex-1 min-w-0 text-start px-3 py-2.5 rounded-lg border flex items-center justify-between gap-2 text-sm ${
                          active ? "border-navy-700 bg-navy-50" : "border-gray-200 hover:border-navy-700"
                        }`}
                      >
                        <span className="min-w-0 truncate font-medium">{vehicleLabel(v)}</span>
                        {active && (
                          <span className="shrink-0 text-[10px] font-bold uppercase text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
                            {t("garage.active")}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => removeVehicle(v.engineId)}
                        aria-label={t("garage.remove")}
                        className="shrink-0 w-11 rounded-lg border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 flex items-center justify-center"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                        </svg>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs font-bold text-gray-400 uppercase mt-4 mb-2">{t("garage.addAnother")}</p>
            </div>
          )}

          {!loading && step === "make" && (
            <ul className="grid grid-cols-2 gap-2 p-1">
              {filteredMakes.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => {
                      setMake(m);
                      setStep("model");
                      setFilter("");
                    }}
                    className="w-full text-start px-3 py-3 rounded-lg border border-gray-200 hover:border-navy-700 hover:bg-navy-50 text-sm font-medium"
                  >
                    {m.name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!loading && step === "model" && make && (
            <ul className="flex flex-col gap-2 p-1">
              {filteredModels.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => {
                      setModel(m);
                      setStep("engine");
                    }}
                    className="w-full text-start px-3 py-3 rounded-lg border border-gray-200 hover:border-navy-700 flex items-center justify-between text-sm"
                  >
                    <span className="font-medium">{m.name}</span>
                    <span className="text-xs text-gray-400">
                      {m.yearFrom}–{m.yearTo}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!loading && step === "engine" && model && (
            <ul className="flex flex-col gap-2 p-1">
              {model.engines.map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => pickEngine(e)}
                    className="w-full text-start px-3 py-3 rounded-lg border border-gray-200 hover:border-navy-700 flex items-center justify-between text-sm"
                  >
                    <span className="font-medium">{e.name}</span>
                    <span className="text-xs text-gray-400">
                      {e.fuel} {e.powerHp ? `· ${e.powerHp}ch` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
