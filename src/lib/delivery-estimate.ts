/**
 * When an order should arrive — "Livraison estimée : mardi 7 octobre,
 * 10 h–18 h" — from the shop's own settings and nothing else (the owner,
 * October 2026).
 *
 * Four things the shop states in /admin/parametres (or Espace boutique →
 * Paramètres in the app):
 *
 *   - its delay for the governorate, as it already publishes it: "24h" for
 *     Grand Tunis, "48–72h" elsewhere — whole days at 24 h each;
 *   - the cut-off ("14:00"): an order placed before it leaves the same day,
 *     after it the next day the shop ships;
 *   - the days the courier works ("1,2,3,4,5,6": Monday to Saturday);
 *   - the courier's hours ("10:00–18:00"), said with the date when given.
 *
 * Without a cut-off there is no date: whether today counts is the one fact
 * the estimate cannot do without, and guessing it would be a promise the
 * shop never made. A delay written in anything but hours ("2 à 3 jours
 * ouvrables") gives no date either. The screens then say the delay as the
 * shop wrote it, as before.
 *
 * Pure, in Tunisian time (UTC+1 all year — no daylight saving since 2009),
 * so the server and the phone agree whatever zone the phone is in. The app
 * keeps a copy (lib/delivery-estimate) with the same tests.
 */

export type DeliveryEstimate = {
  /** First possible day, "YYYY-MM-DD" in Tunisian time. */
  from: string;
  /** Last possible day; the same as `from` for a one-day promise. */
  to: string;
  /** The courier's hours, "10:00" and "18:00", or null when the shop gave none. */
  window: { start: string; end: string } | null;
};

const TUNIS_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "24h" → [1, 1], "48–72h" → [2, 3]; null for anything not in hours. */
export function delayDays(delay: string | null | undefined): [number, number] | null {
  if (!delay || !/^\s*\d+\s*(?:[–-]\s*\d+\s*)?h\s*$/i.test(delay)) return null;
  const hours = (delay.match(/\d+/g) ?? []).map(Number);
  if (!hours.length || hours.some((h) => h <= 0 || h > 24 * 30)) return null;
  const days = hours.map((h) => Math.max(1, Math.ceil(h / 24)));
  return [Math.min(...days), Math.max(...days)];
}

/** "14:00", "14h", "14h30" → minutes after midnight; null otherwise. */
export function parseClock(raw: string | null | undefined): number | null {
  const m = (raw ?? "").trim().match(/^(\d{1,2})\s*(?:[:h]\s*(\d{2})?)?$/i);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** "10:00–18:00", "10h-18h", "10 h – 18 h" → { start: "10:00", end: "18:00" }. */
export function parseWindow(raw: string | null | undefined): { start: string; end: string } | null {
  const parts = (raw ?? "").split(/[–—-]/).map((p) => p.replace(/\s+/g, ""));
  if (parts.length !== 2) return null;
  const a = parseClock(parts[0]);
  const b = parseClock(parts[1]);
  if (a == null || b == null || b <= a) return null;
  const fmt = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
  return { start: fmt(a), end: fmt(b) };
}

/** "1,2,3,4,5,6" (Monday = 1 … Sunday = 7) → the set; null when it names no day. */
export function parseDays(raw: string | null | undefined): Set<number> | null {
  const days = new Set(
    (raw ?? "")
      .split(/[\s,;]+/)
      .map(Number)
      .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7),
  );
  return days.size ? days : null;
}

/** Monday = 1 … Sunday = 7, for a UTC-shifted Tunisian date. */
const isoDay = (d: Date) => ((d.getUTCDay() + 6) % 7) + 1;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** The `n`th working day after `day` (n ≥ 1). */
function addWorkingDays(day: Date, n: number, days: Set<number>): Date {
  let d = day;
  let left = n;
  while (left > 0) {
    d = new Date(d.getTime() + DAY_MS);
    if (days.has(isoDay(d))) left--;
  }
  return d;
}

export function estimateDelivery({
  now,
  delay,
  cutoff,
  window,
  days,
}: {
  now: Date;
  /** The shop's delay for the governorate, as published: "24h", "48–72h". */
  delay: string | null | undefined;
  cutoff: string | null | undefined;
  window: string | null | undefined;
  days: string | null | undefined;
}): DeliveryEstimate | null {
  const span = delayDays(delay);
  const cut = parseClock(cutoff);
  const working = parseDays(days);
  if (!span || cut == null || !working) return null;

  // Tunisian wall-clock time, read with the UTC getters.
  const local = new Date(now.getTime() + TUNIS_OFFSET_MS);
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const today = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));

  // The day the parcel leaves: today when it is a working day and the order
  // beats the cut-off, otherwise the next working day.
  const leaves = working.has(isoDay(today)) && minutes < cut ? today : addWorkingDays(today, 1, working);
  return {
    from: ymd(addWorkingDays(leaves, span[0], working)),
    to: ymd(addWorkingDays(leaves, span[1], working)),
    window: parseWindow(window),
  };
}

/** The end of an estimate, as an instant: the close of the window (or of the day) in Tunis. */
export function estimateDeadline(to: string, window: { end: string } | null): Date {
  const end = parseClock(window?.end ?? "23:59") ?? 23 * 60 + 59;
  return new Date(Date.parse(`${to}T00:00:00Z`) + end * 60_000 - TUNIS_OFFSET_MS);
}
