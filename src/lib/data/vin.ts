import { prisma } from "@/lib/prisma";
import { MAKE_SLUG_ALIASES } from "@/lib/vin";
import { decodeVinOnline } from "@/lib/vin-online";
import { matchModels, narrowEngines, readVin } from "@/lib/vin-reading";
import { listPickerEngines, listPickerModels, type PickerEngine, type PickerModel } from "./vehicles";

export type VinAnswer = {
  /** The make, as the shop lists it; null when the VIN's maker is not one. */
  make: { id: string; name: string; slug: string } | null;
  /** The model year, where the VIN carries it. */
  year: number | null;
  /** What was read about the model and engine, for the line on the screen. */
  read: { model: string | null; litres: number | null; fuel: "diesel" | "essence" | null };
  /** The shop's models the VIN points to — one when it is sure. */
  models: PickerModel[];
  /** With exactly one model: its engines, narrowed by what the VIN says. */
  engines: PickerEngine[];
  /** Where the model came from: the VIN itself, or the online decoder. */
  source: "vin" | "online" | null;
};

/**
 * A VIN, answered with the shop's own catalogue: the make; the model year
 * where the maker writes it; the model when the VIN carries it (Volkswagen
 * group) or the online decoder knows it; and that model's engines to choose
 * from. Everything returned is a row of the shop's — the customer still
 * taps the engine, so nothing is saved on a guess.
 */
export async function identifyVin(vin: string): Promise<VinAnswer> {
  const reading = readVin(vin);
  const none: VinAnswer = { make: null, year: null, read: { model: null, litres: null, fuel: null }, models: [], engines: [], source: null };
  if (!reading.makeSlug) return none;

  const slugs = [reading.makeSlug, ...(MAKE_SLUG_ALIASES[reading.makeSlug] ?? [])];
  const make = await prisma.vehicleMake.findFirst({
    where: { slug: { in: slugs } },
    select: { id: true, name: true, slug: true },
  });
  if (!make) return none;

  let year = reading.year;
  let read: VinAnswer["read"] = { model: reading.modelNames[0] ?? null, litres: null, fuel: null };
  let names = reading.modelNames;
  let source: VinAnswer["source"] = names.length ? "vin" : null;
  if (!names.length) {
    const online = await decodeVinOnline(vin);
    if (online?.model) {
      names = [online.model];
      year = year ?? online.year;
      read = { model: online.model, litres: online.litres, fuel: online.fuel };
      source = "online";
    }
  }

  const all = names.length ? ((await listPickerModels(make.slug)) ?? []) : [];
  const models = matchModels(all, names, year);
  let engines: PickerEngine[] = [];
  if (models.length === 1) {
    const list = (await listPickerEngines(make.slug, models[0]!.slug)) ?? [];
    engines = narrowEngines(list, { year, litres: read.litres, fuel: read.fuel });
  }
  return { make, year, read, models, engines, source: models.length ? source : null };
}
