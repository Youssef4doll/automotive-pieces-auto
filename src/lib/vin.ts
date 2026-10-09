// The make from the World Manufacturer Identifier (the first 3 characters),
// for the makes sold in Tunisia — several plants per make (a Peugeot is VF3
// or VR3, a Hyundai i10 built in India is MAL). The rest of what a VIN says
// is read in lib/vin-reading.ts.
const WMI_TO_MAKE_SLUG: Record<string, string> = {
  VF1: "renault",
  VF3: "peugeot",
  VR3: "peugeot",
  VF7: "citroen",
  VR7: "citroen",
  UU1: "dacia",
  VSS: "seat",
  WVW: "volkswagen",
  WV1: "volkswagen",
  WV2: "volkswagen",
  WVG: "volkswagen",
  WAU: "audi",
  TMB: "skoda",
  KNA: "kia",
  KNB: "kia",
  KNE: "kia",
  U5Y: "kia",
  KMH: "hyundai",
  TMA: "hyundai",
  NLH: "hyundai",
  MAL: "hyundai",
  JTD: "toyota",
  JT2: "toyota",
  VNK: "toyota",
  SB1: "toyota",
  NMT: "toyota",
  ZFA: "fiat",
  NM4: "fiat",
  WBA: "bmw",
  WBS: "bmw",
  WMW: "mini",
  WDD: "mercedes-benz",
  WDB: "mercedes-benz",
  W1K: "mercedes-benz",
  WF0: "ford",
  W0L: "opel",
  W0V: "opel",
  SJN: "nissan",
  VSK: "nissan",
  JN1: "nissan",
  TSM: "suzuki",
  JMZ: "mazda",
  JMB: "mitsubishi",
  SHH: "honda",
  JHM: "honda",
  YV1: "volvo",
  KL1: "chevrolet",
};

/** Other slugs a shop may have given the same make. */
export const MAKE_SLUG_ALIASES: Record<string, string[]> = {
  "mercedes-benz": ["mercedes"],
};

export function decodeVinMakeSlug(vin: string): string | null {
  const clean = vin.trim().toUpperCase();
  if (clean.length < 3) return null;
  return WMI_TO_MAKE_SLUG[clean.slice(0, 3)] ?? null;
}

export function isValidVinFormat(vin: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin.trim().toUpperCase());
}
