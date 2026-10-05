/**
 * "89,000 DT" — three decimals, as Tunisian labels and receipts print the
 * dinar (1 000 millimes), with a comma and narrow-space thousands. The same
 * figure the app prints (its lib/format formatDT), so the two never differ.
 */
export function formatTND(value: number | string) {
  return formatTNDfr(value);
}

export function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "toNumber" in (value as { toNumber?: () => number })) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

/** French number convention, three decimals: "1 535,000 DT". */
export function formatTNDfr(value: number | string) {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "— DT";
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DT`;
}
