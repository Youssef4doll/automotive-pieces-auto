/**
 * What a VIN says on its own, read without any outside service.
 *
 * Three things, each only where the VIN really carries it:
 *
 *  - the make, from the World Manufacturer Identifier (characters 1–3,
 *    `lib/vin.ts`);
 *  - the model year, from character 10 — only for the makers that put it
 *    there on the cars sold here (the Volkswagen group, Hyundai, Kia). PSA
 *    and Renault do not, so for a Peugeot the year is left unknown rather
 *    than read off a character that means something else;
 *  - for the Volkswagen group only, the model, from characters 7–8: the
 *    group writes its platform code there (WVWZZZ**1K**… is a Golf V). The
 *    table below holds the codes of the cars sold in Tunisia; a code not in
 *    it gives no model, never a guess.
 *
 * The engine is not in a European VIN. The customer picks it from the
 * shop's own list for the model, narrowed by the year when there is one.
 */
import { decodeVinMakeSlug } from "./vin";

/** Makers that write the model year in character 10 on the cars sold here. */
const YEAR_AT_10 = new Set(["volkswagen", "audi", "skoda", "seat", "hyundai", "kia"]);

/** ISO 3779 year letters: no I, O, Q, U, Z or 0. "A" is 1980 or 2010. */
const YEAR_CODES = "ABCDEFGHJKLMNPRSTVWXY123456789";

/**
 * Volkswagen-group platform codes (characters 7–8) → the names a catalogue
 * lists that car under. The first name is the one shown; the others are how
 * the shop may have spelled it.
 */
const VAG_MODELS: Record<string, Record<string, string[]>> = {
  volkswagen: {
    "1J": ["Golf IV", "Bora"],
    "1K": ["Golf V", "Jetta V"],
    "5K": ["Golf VI"],
    AU: ["Golf VII"],
    "5G": ["Golf VII"],
    "9N": ["Polo IV"],
    "6R": ["Polo V"],
    "6C": ["Polo V"],
    AW: ["Polo VI"],
    "3C": ["Passat B6", "Passat B7", "Passat"],
    "3G": ["Passat B8", "Passat"],
    "5N": ["Tiguan I", "Tiguan"],
    "1T": ["Touran I", "Touran"],
    "2K": ["Caddy III", "Caddy"],
    "7H": ["Transporter T5", "Transporter"],
  },
  skoda: {
    "6Y": ["Fabia I"],
    "5J": ["Fabia II", "Roomster"],
    NJ: ["Fabia III"],
    "1U": ["Octavia I"],
    "1Z": ["Octavia II"],
    "5E": ["Octavia III"],
    NH: ["Rapid"],
    "3T": ["Superb II"],
    "3V": ["Superb III"],
    "5L": ["Yeti"],
  },
  seat: {
    "6K": ["Ibiza II", "Cordoba"],
    "6L": ["Ibiza III", "Cordoba"],
    "6J": ["Ibiza IV"],
    "6P": ["Ibiza IV"],
    KJ: ["Ibiza V", "Arona"],
    "1M": ["Leon I", "Toledo II"],
    "1P": ["Leon II"],
    "5F": ["Leon III"],
    "5P": ["Altea", "Toledo III"],
  },
  audi: {
    "8L": ["A3 I", "A3 (8L)"],
    "8P": ["A3 II", "A3 (8P)"],
    "8V": ["A3 III", "A3 (8V)"],
    "8E": ["A4 B6", "A4 B7", "A4"],
    "8K": ["A4 B8", "A4"],
    "8W": ["A4 B9", "A4"],
    "4F": ["A6 C6", "A6"],
    "4G": ["A6 C7", "A6"],
    "8X": ["A1"],
    "8U": ["Q3"],
    "8R": ["Q5"],
    "4L": ["Q7"],
  },
};

export type VinReading = {
  makeSlug: string | null;
  /** Model year, where this maker encodes it; null otherwise. */
  year: number | null;
  /** Names the model may be listed under, best first; empty when unknown. */
  modelNames: string[];
};

/** The model year a character-10 code stands for, the latest not in the future. */
export function modelYear(code: string, now: Date = new Date()): number | null {
  const i = YEAR_CODES.indexOf(code);
  if (i < 0) return null;
  const latest = now.getFullYear() + 1;
  // Letters cycle every 30 years from 1980; digits are 2001–2009 (and 2031…).
  const base = i < 21 ? 1980 + i : 2001 + (i - 21);
  let year = base;
  while (year + 30 <= latest) year += 30;
  return year;
}

export function readVin(vin: string, now: Date = new Date()): VinReading {
  const v = vin.trim().toUpperCase();
  const makeSlug = decodeVinMakeSlug(v);
  if (!makeSlug || v.length !== 17) return { makeSlug, year: null, modelNames: [] };
  const year = YEAR_AT_10.has(makeSlug) ? modelYear(v[9]!, now) : null;
  const modelNames = VAG_MODELS[makeSlug]?.[v.slice(6, 8)] ?? [];
  return { makeSlug, year, modelNames };
}

const ROMAN: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10" };

/** "Golf VII", "golf 7", "GOLF-7" → "golf 7": how two spellings of one car compare. */
export function modelKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map((w, i) => (i > 0 && ROMAN[w] ? ROMAN[w] : w))
    .join(" ");
}

type ListedModel = { id: string; name: string; yearFrom: number | null; yearTo: number | null };

function yearFits(m: { yearFrom: number | null; yearTo: number | null }, year: number | null) {
  if (year === null) return true;
  if (m.yearFrom !== null && year < m.yearFrom - 1) return false;
  if (m.yearTo !== null && year > m.yearTo + 1) return false;
  return true;
}

/**
 * The shop's models a VIN points to: the exact name first ("Golf VII" for
 * "Golf VII" or "Golf 7"); failing that, a model listed under the bare name
 * ("Golf", "Ibiza") whose years fit the VIN's. Several answers when the
 * shop lists the car more than once — the screen then asks which.
 */
export function matchModels<M extends ListedModel>(models: M[], names: string[], year: number | null): M[] {
  if (!names.length) return [];
  const keys = names.map(modelKey);
  const exact = models.filter((m) => keys.includes(modelKey(m.name)) && yearFits(m, year));
  if (exact.length) return exact;
  const bases = new Set(keys.map((k) => k.split(" ")[0]!));
  return models.filter((m) => {
    const k = modelKey(m.name);
    return !k.includes(" ") && bases.has(k) && yearFits(m, year);
  });
}

type ListedEngine = { name: string; fuel: string | null; displacementCc: number | null; yearFrom?: number | null; yearTo?: number | null };

/**
 * Narrow a model's engines by what is known — the year, and (from an online
 * decoder) the displacement and the fuel. A narrowing that would leave none
 * is not applied: the customer then sees every engine of the model, which is
 * what the picker shows anyway.
 */
export function narrowEngines<E extends ListedEngine>(
  engines: E[],
  known: { year: number | null; litres?: number | null; fuel?: "diesel" | "essence" | null },
): E[] {
  let out = engines;
  const keep = (next: E[]) => {
    if (next.length) out = next;
  };
  if (known.year !== null) keep(out.filter((e) => yearFits({ yearFrom: e.yearFrom ?? null, yearTo: e.yearTo ?? null }, known.year)));
  if (known.fuel) keep(out.filter((e) => !e.fuel || e.fuel.toLowerCase() === known.fuel));
  if (known.litres) {
    const litres = known.litres;
    keep(
      out.filter((e) => {
        if (e.displacementCc) return Math.abs(e.displacementCc / 1000 - litres) < 0.08;
        const m = /^(\d\.\d)/.exec(e.name.trim());
        return m ? Math.abs(Number(m[1]) - litres) < 0.08 : true;
      }),
    );
  }
  return out;
}
