/**
 * The public VIN decoder of the US road-safety agency (NHTSA vPIC) — free,
 * no key — asked only when the VIN alone did not name the model.
 *
 * It knows the cars built to its patterns (many Kia, Hyundai, Toyota,
 * Volkswagen); for a car built only for Europe (most Peugeot, Renault,
 * Dacia) it usually returns the make and nothing else, and that is what the
 * screen then says. Its answer is a hint matched against the shop's own
 * catalogue, never shown as the car's specification by itself.
 *
 * The VIN goes to that service and nowhere else; it is not logged or
 * stored here. `VIN_ONLINE_DECODER=off` turns the call off. It gives up after
 * a few seconds: a slow outside service must not hold the screen.
 */
export type OnlineVin = {
  model: string | null;
  year: number | null;
  litres: number | null;
  fuel: "diesel" | "essence" | null;
};

const TIMEOUT_MS = 3500;
const cache = new Map<string, OnlineVin | null>();

/** The parts of a vPIC "DecodeVinValues" answer this shop uses. */
export function parseVpic(body: unknown): OnlineVin | null {
  const row = (body as { Results?: Record<string, unknown>[] } | null)?.Results?.[0];
  if (!row) return null;
  const text = (k: string) => {
    const v = row[k];
    return typeof v === "string" && v.trim() && v.trim() !== "Not Applicable" ? v.trim() : null;
  };
  const model = text("Model");
  // Without a model, the service did not recognise the car: its year (read
  // off character 10 whatever the maker meant by it) is not kept either.
  if (!model) return null;
  const year = Number(text("ModelYear"));
  const litres = Number(text("DisplacementL"));
  const fuelText = (text("FuelTypePrimary") ?? "").toLowerCase();
  return {
    model,
    year: Number.isInteger(year) && year > 1980 ? year : null,
    litres: Number.isFinite(litres) && litres > 0.5 && litres < 9 ? Math.round(litres * 10) / 10 : null,
    fuel: fuelText.includes("diesel") ? "diesel" : fuelText.includes("gasoline") || fuelText.includes("petrol") ? "essence" : null,
  };
}

export async function decodeVinOnline(vin: string): Promise<OnlineVin | null> {
  if (process.env.VIN_ONLINE_DECODER === "off") return null;
  if (cache.has(vin)) return cache.get(vin) ?? null;
  try {
    const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const found = parseVpic(await res.json());
    if (cache.size > 500) cache.clear();
    cache.set(vin, found);
    return found;
  } catch {
    // Unreachable, slow or malformed: the VIN still gave the make.
    return null;
  }
}
