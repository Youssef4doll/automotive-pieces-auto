"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useVehicle } from "@/lib/vehicle-store";

export type FitmentRow = {
  makeName: string;
  makeSlug: string;
  modelName: string;
  modelSlug: string;
  engineId: string;
  engineName: string;
  /** Fuel, power and engine code — only what the catalogue records. */
  engineSpec: string;
  /** VERIFIED came from a catalogue or a confirmed delivery; DERIVED did not. */
  derived: boolean;
};

const FIRST_SHOWN = 6;

/**
 * Which cars this part is listed for — as something you can search, not read.
 *
 * It used to be a three-column table: one row per engine, every row printed,
 * in whatever order the database returned. That is fine for the four-engine
 * parts this catalogue holds today and unusable for the ones it will hold
 * tomorrow — a wiper blade fits several hundred engines, and "is mine in
 * there?" is not a question you answer by reading three hundred rows.
 *
 * So the same data is grouped by make and model, filtered by two selects, and
 * folded after six manufacturers. Nothing is hidden that the filter cannot
 * reach, and nothing is added: these are the fitments the shop actually
 * recorded, and a row inferred rather than confirmed says so on its face
 * instead of sitting beside the confirmed ones looking identical.
 *
 * The shopper's own car, if they told us, preselects the make filter. That is
 * the whole reason most people open this section, and it costs them a tap
 * rather than a scroll.
 */
export default function FitmentBrowser({ rows }: { rows: FitmentRow[] }) {
  const vehicle = useVehicle((s) => s.vehicle);

  const makes = useMemo(
    () => [...new Set(rows.map((r) => r.makeName))].sort((a, b) => a.localeCompare(b, "fr")),
    [rows],
  );

  // Preselected from the saved car only when this part is actually listed for
  // it — preselecting a make with no rows would open the section on "aucun
  // véhicule", which reads as "does not fit" and is not what it means.
  const [make, setMake] = useState(() =>
    vehicle && makes.includes(vehicle.makeName) ? vehicle.makeName : "",
  );
  const [model, setModel] = useState("");
  const [expanded, setExpanded] = useState(false);

  const models = useMemo(
    () =>
      [...new Set(rows.filter((r) => !make || r.makeName === make).map((r) => r.modelName))].sort(
        (a, b) => a.localeCompare(b, "fr"),
      ),
    [rows, make],
  );

  const filtered = rows.filter(
    (r) => (!make || r.makeName === make) && (!model || r.modelName === model),
  );

  // make → model → engines, in one pass, alphabetical throughout so the same
  // part always lists its cars in the same order.
  const grouped = useMemo(() => {
    const byMake = new Map<string, Map<string, FitmentRow[]>>();
    for (const r of filtered) {
      const models = byMake.get(r.makeName) ?? new Map<string, FitmentRow[]>();
      const engines = models.get(r.modelName) ?? [];
      engines.push(r);
      models.set(r.modelName, engines);
      byMake.set(r.makeName, models);
    }
    return [...byMake.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "fr"))
      .map(([makeName, models]) => ({
        makeName,
        models: [...models.entries()]
          .sort(([a], [b]) => a.localeCompare(b, "fr"))
          .map(([modelName, engines]) => ({ modelName, engines })),
      }));
  }, [filtered]);

  const filtering = make !== "" || model !== "";
  // A filtered list is a result, and a result is never folded — somebody who
  // just asked for one manufacturer wants to see it, not a "show more".
  const visible = expanded || filtering ? grouped : grouped.slice(0, FIRST_SHOWN);
  const hidden = grouped.length - visible.length;

  const select =
    "min-h-tap min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-base text-navy-950 outline-none focus:border-navy-700";

  return (
    <div className="flex flex-col gap-3">
      {/* Only where there is something to narrow. Two selects above three rows
          cost more screen than they save. */}
      {makes.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={make}
            aria-label="Filtrer par marque"
            onChange={(e) => {
              setMake(e.target.value);
              setModel("");
            }}
            className={select}
          >
            <option value="">Toutes les marques</option>
            {makes.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={model}
            aria-label="Filtrer par modèle"
            onChange={(e) => setModel(e.target.value)}
            className={select}
          >
            <option value="">Tous les modèles</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {filtering && (
            <button
              type="button"
              onClick={() => {
                setMake("");
                setModel("");
              }}
              className="min-h-tap shrink-0 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-navy-900 hover:border-navy-900"
            >
              Réinitialiser
            </button>
          )}
        </div>
      )}

      {grouped.length === 0 ? (
        <p className="text-sm text-gray-500">
          Aucun véhicule ne correspond à ce filtre pour cette référence.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {visible.map((g) => (
            <li key={g.makeName} className="rounded-xl border border-gray-200 bg-white">
              <p className="border-b border-gray-100 px-3.5 py-2 font-heading text-sm font-extrabold uppercase tracking-tight text-navy-950">
                {g.makeName}
              </p>
              <ul className="m-0 flex list-none flex-col divide-y divide-gray-50 p-0">
                {g.models.map((m) => (
                  <li key={m.modelName} className="px-3.5 py-2.5">
                    {/* Every model is a way into that car's own page: somebody
                        checking whether this fits their Clio is one tap from
                        everything else the shop holds for it. */}
                    <Link
                      href={`/pieces/${m.engines[0].makeSlug}/${m.engines[0].modelSlug}`}
                      className="text-sm font-semibold text-navy-600 underline-offset-2 hover:text-red-600 hover:underline"
                    >
                      {m.modelName}
                    </Link>
                    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {m.engines.map((e) => (
                        <span
                          key={e.engineId}
                          className={`text-[13px] ${
                            vehicle?.engineId === e.engineId
                              ? "font-semibold text-green-700"
                              : "text-gray-600"
                          }`}
                        >
                          {e.engineName}
                          {e.engineSpec && (
                            <span className="text-gray-400"> · {e.engineSpec}</span>
                          )}
                          {/* Said plainly, because the shop is not equally sure
                              of every line and must not look as though it is. */}
                          {e.derived && (
                            <span className="text-amber-700" title="Déduite d'une référence partagée, non confirmée">
                              {" "}
                              (à confirmer)
                            </span>
                          )}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="self-start min-h-tap rounded-lg border border-navy-900/15 px-4 font-display text-xs font-bold uppercase tracking-wide text-navy-900 hover:border-gold-500"
        >
          Voir les {hidden} autre(s) marque(s)
        </button>
      )}
    </div>
  );
}
