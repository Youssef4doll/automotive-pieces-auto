/**
 * The compatibility verdict, from evidence — one pure function so the rule
 * is tested rather than scattered.
 *
 *   FITS          a VERIFIED row for exactly this engine.
 *   DOES_NOT_FIT  the part needs the other fuel (lib/fitment-rules), or the
 *                 shop confirmed it for other engines of THIS model and not
 *                 this one — the model was covered and this engine left out.
 *   UNKNOWN       everything else, shown as "à vérifier": a DERIVED row; a
 *                 VERIFIED row for another engine with the same engine code
 *                 and fuel (very likely the same engine, still to confirm);
 *                 or no evidence at all. Listed for a Peugeot and not for a
 *                 BMW means the shop has not looked at BMWs, not that the
 *                 part does not fit one.
 */
export type FitmentVerdict = "FITS" | "UNKNOWN" | "DOES_NOT_FIT";

export type FitEvidence = {
  /** The row for exactly this engine, by its confidence; null when none. */
  mine: "VERIFIED" | "DERIVED" | null;
  /** VERIFIED for another engine of the same model. */
  sameModel: boolean;
  /** VERIFIED for another engine with the same engine code and fuel. */
  sameCode: boolean;
  /** The part needs the other fuel. */
  wrongFuel: boolean;
};

export function fitVerdict(e: FitEvidence): FitmentVerdict {
  if (e.wrongFuel) return "DOES_NOT_FIT";
  if (e.mine === "VERIFIED") return "FITS";
  if (e.mine === "DERIVED" || e.sameCode) return "UNKNOWN";
  if (e.sameModel) return "DOES_NOT_FIT";
  return "UNKNOWN";
}

/** Engine codes compare without case, spaces or dashes: "K9K 612" = "k9k-612". */
export function sameEngineCode(a: string | null | undefined, b: string | null | undefined): boolean {
  const n = (s: string) => s.toUpperCase().replace(/[\s-]/g, "");
  return Boolean(a && b && n(a) === n(b));
}
