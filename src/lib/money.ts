export function formatTND(value: number | string) {
  const n = typeof value === "string" ? Number(value) : value;
  return `${n.toFixed(2)} DT`;
}

export function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "toNumber" in (value as { toNumber?: () => number })) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

/**
 * French number convention: a comma for the decimal separator and a
 * narrow no-break space as the thousands separator — "1 535,00 DT".
 * Used in the customer account area; the admin keeps formatTND so its
 * tables and exports are unaffected.
 */
export function formatTNDfr(value: number | string) {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "— DT";
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT`;
}
