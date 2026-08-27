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
