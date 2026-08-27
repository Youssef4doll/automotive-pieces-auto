// Prefix-based VIN decoding. This is NOT a real VIN decoder — it's a
// convenience that recognizes the World Manufacturer Identifier (first 3
// characters) for the makes this shop stocks, so a customer typing their VIN
// gets routed straight to "pick your model" instead of a dead end. A real
// decoder needs a paid VIN-data service.
const WMI_TO_MAKE_SLUG: Record<string, string> = {
  VF1: "renault",
  VF3: "peugeot",
  VF7: "citroen",
  UU1: "dacia",
  VSS: "seat",
  WVW: "volkswagen",
  WV1: "volkswagen",
  WV2: "volkswagen",
  KNA: "kia",
  KNB: "kia",
  KMH: "hyundai",
  JTD: "toyota",
  JT2: "toyota",
  ZFA: "fiat",
  WBA: "bmw",
  WBS: "bmw",
};

export function decodeVinMakeSlug(vin: string): string | null {
  const clean = vin.trim().toUpperCase();
  if (clean.length < 3) return null;
  return WMI_TO_MAKE_SLUG[clean.slice(0, 3)] ?? null;
}

export function isValidVinFormat(vin: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin.trim().toUpperCase());
}
