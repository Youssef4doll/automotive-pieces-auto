"use client";

import { useId, useState } from "react";
import { fmtTND, fmtInt, fmtPct } from "@/lib/format-analytics";

/**
 * The chart primitives for /admin/analyse.
 *
 * Inline SVG, no library. Not out of thrift — the shop's storefront bundle is
 * measured to the kilobyte and a charting library on an admin page would not
 * reach it — but because everything here is one of three shapes, and three
 * shapes drawn by hand are less code than the adapter around a library that
 * draws thirty.
 *
 * **Colour does one job per chart and is validated, not chosen.** Magnitude
 * bars are a single hue: the bar's length already encodes the value, so
 * colouring by value spends the identity channel re-encoding it. The funnel is
 * an ordinal ramp — its stages have an order, so the order is in the colour —
 * stepped from the brand navy and checked for monotone lightness, visible
 * step gaps and a light end that clears the surface. Status is a reserved
 * scale and always ships with a word, never colour alone.
 *
 * The ramp below is the validated instance. Do not add a hue to it by eye.
 */
export const RAMP = ["#7d97c4", "#4f6ea8", "#274a87", "#0f2352"] as const;
export const SERIES = "#274a87";
export const INK = "#0f2352";
export const MUTED = "#64748b";
export const GRID = "#e2e8f0";
/** Reserved. Each is ≥ 4.5:1 on white and is never used as "series 4". */
export const STATUS = { good: "#0a7d3f", warning: "#a45c00", critical: "#c50e26" } as const;

// Re-exported so a chart and its page import the same names, but *defined* in
// a plain module: a formatter exported from a "use client" file is a client
// reference the server component cannot call. See lib/format-analytics.
export { fmtTND, fmtInt, fmtPct } from "@/lib/format-analytics";

/* ------------------------------------------------------------- stat tile */

/**
 * One number, its movement, and nothing else.
 *
 * A single current value is a stat tile, not a one-bar bar chart. The delta is
 * a word and an arrow as well as a colour, so it survives being printed, being
 * read by somebody with full colour-blindness, and being looked at quickly.
 */
export function StatTile({
  label,
  value,
  delta,
  sub,
}: {
  label: string;
  value: string;
  /** Period-on-period change, or null when there is no earlier period to compare with. */
  delta?: number | null;
  sub?: string;
}) {
  const up = (delta ?? 0) > 0;
  const flat = delta === 0;
  return (
    <div className="rounded-xl border border-navy-900/10 border-l-4 border-l-gold-500 bg-white p-4 shadow-sm">
      <p className="font-display text-xs font-bold uppercase tracking-wide text-navy-900/45">{label}</p>
      <p className="mt-1 font-heading text-2xl font-extrabold text-navy-950 tabular-nums">{value}</p>
      {delta == null ? (
        sub && <p className="mt-0.5 text-xs text-navy-900/40">{sub}</p>
      ) : (
        <p
          className="mt-0.5 text-xs font-semibold tabular-nums"
          style={{ color: flat ? MUTED : up ? STATUS.good : STATUS.critical }}
        >
          {flat ? "→" : up ? "↑" : "↓"} {fmtPct(Math.abs(delta))}{" "}
          <span className="font-normal text-navy-900/40">vs 30 j précédents</span>
        </p>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- trend chart */

export type TrendPoint = { day: string; revenue: number; orders: number };

/**
 * Daily revenue, with the projection drawn as what it is.
 *
 * One series, so no legend box — the heading names it. What needs telling
 * apart is *measured* from *projected*, and that is carried by the dash
 * pattern and two direct labels rather than by a second hue: a forecast in its
 * own colour reads as a second product line.
 *
 * The band is the projection's uncertainty, not a second series. It is drawn
 * under the line at low opacity so it recedes.
 */
export function TrendChart({
  points,
  fitToday,
  fitEnd,
  dailySd,
  horizonDays,
}: {
  points: TrendPoint[];
  /** The fitted line's value today, or null when the forecast refused to run. */
  fitToday: number | null;
  fitEnd: number;
  /** Half-width of the cone at the far end; it is zero at today. */
  dailySd: number;
  horizonDays: number;
}) {
  const uid = useId();
  const [hover, setHover] = useState<number | null>(null);

  const W = 720;
  const H = 210;
  const PAD = { top: 12, right: 12, bottom: 22, left: 46 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // The projection shares the x-scale with the history, so the horizon is
  // drawn to scale rather than as a stub on the end.
  const forecasting = fitToday != null;
  const totalDays = points.length + (forecasting ? horizonDays : 0);
  const maxY = Math.max(1, ...points.map((p) => p.revenue), forecasting ? fitEnd + dailySd : 0);

  const x = (i: number) => PAD.left + (totalDays <= 1 ? 0 : (i / (totalDays - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / maxY) * plotH;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.revenue).toFixed(1)}`).join(" ");

  const lastI = points.length - 1;
  // Both ends on the fitted line, and the cone opening from today rather than
  // from the last actual point — the uncertainty is zero for a day already
  // known and grows with distance, which is what a residual spread means.
  const forecastPath = !forecasting
    ? ""
    : `M${x(lastI).toFixed(1)},${y(fitToday!).toFixed(1)} L${x(totalDays - 1).toFixed(1)},${y(fitEnd).toFixed(1)}`;
  const bandPath = !forecasting
    ? ""
    : [
        `M${x(lastI).toFixed(1)},${y(fitToday!).toFixed(1)}`,
        `L${x(totalDays - 1).toFixed(1)},${y(fitEnd + dailySd).toFixed(1)}`,
        `L${x(totalDays - 1).toFixed(1)},${y(Math.max(0, fitEnd - dailySd)).toFixed(1)}`,
        "Z",
      ].join(" ");

  const ticks = [0, maxY / 2, maxY];
  const hovered = hover == null ? null : points[hover];

  return (
    <figure className="m-0">
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Chiffre d'affaires quotidien sur ${points.length} jours`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - box.left) / box.width) * W;
            const i = Math.round(((px - PAD.left) / plotW) * (totalDays - 1));
            setHover(i >= 0 && i < points.length ? i : null);
          }}
        >
          {/* Recessive grid: three lines, no box, no vertical rules. */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill={MUTED}>
                {Math.round(t)}
              </text>
            </g>
          ))}

          {forecasting && (
            <>
              <path d={bandPath} fill={SERIES} opacity="0.12" />
              <path d={forecastPath} fill="none" stroke={SERIES} strokeWidth="2" strokeDasharray="5 4" opacity="0.75" />
              <line
                x1={x(lastI)} x2={x(lastI)} y1={PAD.top} y2={PAD.top + plotH}
                stroke={MUTED} strokeWidth="1" strokeDasharray="2 3" opacity="0.6"
              />
            </>
          )}

          <path d={line} fill="none" stroke={SERIES} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {hovered && (
            <>
              <line x1={x(hover!)} x2={x(hover!)} y1={PAD.top} y2={PAD.top + plotH} stroke={INK} strokeWidth="1" opacity="0.35" />
              {/* 2px surface ring, so the marker reads on top of the line. */}
              <circle cx={x(hover!)} cy={y(hovered.revenue)} r="5" fill={SERIES} stroke="#ffffff" strokeWidth="2" />
            </>
          )}

          <text x={PAD.left} y={H - 6} fontSize="11" fill={MUTED}>
            {points[0]?.day}
          </text>
          <text x={x(lastI)} y={H - 6} fontSize="11" fill={MUTED} textAnchor="middle">
            aujourd&apos;hui
          </text>
          {forecasting && (
            <text x={W - PAD.right} y={H - 6} fontSize="11" fill={MUTED} textAnchor="end">
              +{horizonDays} j
            </text>
          )}
          <title id={uid}>Chiffre d&apos;affaires par jour</title>
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-navy-950 px-2.5 py-1.5 text-xs text-white shadow-lg"
            style={{ left: `${(x(hover!) / W) * 100}%`, top: `${(y(hovered.revenue) / H) * 100}%` }}
          >
            <span className="block font-semibold tabular-nums">{fmtTND(hovered.revenue)}</span>
            <span className="block text-white/60">
              {hovered.day} · {fmtInt(hovered.orders)} cmd
            </span>
          </div>
        )}
      </div>
      <figcaption className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy-900/50">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 rounded" style={{ background: SERIES }} /> réalisé
        </span>
        {forecasting && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-5 rounded"
              style={{ backgroundImage: `repeating-linear-gradient(90deg, ${SERIES} 0 5px, transparent 5px 9px)` }}
            />
            projection · fourchette ombrée
          </span>
        )}
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------ funnel bars */

/**
 * The funnel, with the leak named.
 *
 * Stages are ordinal — swapping two would change the meaning — so they take a
 * one-hue ramp rather than four identities. The number that matters is not the
 * stage count but the fall between stages, so that is what is set beside each
 * step, and the worst one is called out in words.
 */
export function FunnelBars({ steps }: { steps: { step: string; count: number }[] }) {
  const top = Math.max(1, steps[0]?.count ?? 1);
  return (
    <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
      {steps.map((s, i) => {
        const prev = i === 0 ? null : steps[i - 1].count;
        const drop = prev && prev > 0 ? 1 - s.count / prev : null;
        return (
          <li key={s.step}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-navy-900">{s.step}</span>
              <span className="tabular-nums font-semibold text-navy-950">{fmtInt(s.count)}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-navy-900/6">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(1, (s.count / top) * 100)}%`, background: RAMP[i % RAMP.length] }}
                />
              </div>
              <span className="w-24 shrink-0 text-end text-xs tabular-nums" style={{ color: drop && drop > 0.6 ? STATUS.critical : MUTED }}>
                {drop == null ? "—" : `−${fmtPct(drop)}`}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* --------------------------------------------------------------- bar list */

/**
 * A ranked list of magnitudes.
 *
 * One hue for every bar. These are nominal — products, campaigns, cars,
 * governorates — so there is no order for a ramp to carry, and the length
 * already says how much. Values are direct-labelled because the list is short;
 * a chart with an axis would be more furniture than data at ten rows.
 */
export function BarList({
  rows,
  empty,
}: {
  rows: { key: string; label: string; sub?: string; value: number; display: string }[];
  empty: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-navy-900/40">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm text-navy-900">
              {r.label}
              {r.sub && <span className="ms-1.5 text-xs text-navy-900/40">{r.sub}</span>}
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-navy-950">{r.display}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-navy-900/6">
            <div className="h-full rounded-full" style={{ width: `${Math.max(1, (r.value / max) * 100)}%`, background: SERIES }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------ status chip */

/** Reserved colours, and never colour alone — the word is always there. */
export function StatusChip({ tone, children }: { tone: keyof typeof STATUS; children: React.ReactNode }) {
  const bg = { good: "#e8f5ee", warning: "#fdf3e3", critical: "#fdeaed" }[tone];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold"
      style={{ background: bg, color: STATUS[tone] }}
    >
      <span aria-hidden="true">{tone === "good" ? "●" : tone === "warning" ? "▲" : "■"}</span>
      {children}
    </span>
  );
}

/** A panel. One shape for every section so the page reads as one thing. */
export function Panel({
  title,
  hint,
  aside,
  children,
}: {
  title: string;
  hint?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-navy-900/10 bg-white p-5 shadow-sm">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-navy-950">{title}</h2>
        {aside}
      </div>
      {hint && <p className="mb-3.5 max-w-2xl text-xs text-navy-900/45">{hint}</p>}
      {children}
    </section>
  );
}
