/**
 * How a motorisation is written down.
 *
 * The catalogues this trade runs on print an engine as power in both units and
 * the manufacturer's engine code — "85 kW / 116 ch · M47 D20" — because those
 * two facts are what separate two engines a brochure calls by the same name.
 * A mechanic reads the code off the block; the customer reads the horsepower
 * off the registration document. Printing one without the other loses half the
 * audience.
 *
 * Only what the catalogue records is printed. The one derived value here is
 * kilowatts, and it is a unit conversion rather than a claim: 1 ch (metric
 * horsepower, the PS of the German catalogues) is exactly 0.735 498 75 kW, so
 * an engine recorded at 116 ch is the same engine whichever unit you write it
 * in. An engine with no power recorded shows no power, not a zero.
 */

const KW_PER_HP = 0.73549875;

/** Metric horsepower to kilowatts, rounded to the whole unit catalogues use. */
export function kwFromHp(hp: number): number {
  return Math.round(hp * KW_PER_HP);
}

export type EngineFacts = {
  fuel?: string | null;
  powerHp?: number | null;
  engineCode?: string | null;
  displacementCc?: number | null;
};

/** "85 kW / 116 ch", or nothing at all. */
export function enginePower(hp: number | null | undefined): string | null {
  return hp && hp > 0 ? `${kwFromHp(hp)} kW / ${hp} ch` : null;
}

/**
 * The line under an engine's name: fuel, power, engine code.
 *
 * `withFuel` is off where the fuel is already the step the shopper just chose —
 * repeating "Diesel" on every row of a list they reached by tapping "Diesel"
 * is noise, and on a phone it is noise that pushes the engine code off the end
 * of the line.
 */
export function engineSpecLine(e: EngineFacts, { withFuel = true } = {}): string {
  return [withFuel ? e.fuel?.trim() || null : null, enginePower(e.powerHp), e.engineCode?.trim() || null]
    .filter(Boolean)
    .join(" · ");
}

/**
 * "1.5 l" from 1461 cc — the displacement a catalogue groups engines under.
 *
 * Rounded to one decimal, which is how every brochure prints it and is close
 * enough that 1461 cc and 1498 cc both land on the 1.5 everybody calls them.
 */
export function displacementLitres(cc: number | null | undefined): string | null {
  return cc && cc > 0 ? `${(cc / 1000).toFixed(1)} l` : null;
}

/**
 * Fuels, in the order a picker should offer them.
 *
 * Free text in the database, because the shop types it and because a fixed
 * enum would have to be migrated the first time it sells a part for a hybrid.
 * Anything the shop wrote that is not in this list still appears in the
 * picker — it simply sorts after the ones that are.
 */
const FUEL_ORDER = ["essence", "diesel", "hybride", "électrique", "gpl"];

export function compareFuels(a: string, b: string): number {
  const rank = (f: string) => {
    const i = FUEL_ORDER.indexOf(f.trim().toLowerCase());
    return i === -1 ? FUEL_ORDER.length : i;
  };
  return rank(a) - rank(b) || a.localeCompare(b, "fr");
}
