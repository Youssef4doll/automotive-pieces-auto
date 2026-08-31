import { IconCheck } from "./icons";

const STEPS = [
  { key: "CONFIRMED", label: "Confirmée" },
  { key: "PREPARED", label: "Préparée" },
  { key: "SHIPPED", label: "Expédiée" },
  { key: "DELIVERED", label: "Livrée" },
] as const;

export type TrackerEvent = { status: string; at: string };

function moment(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} à ${d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

type State = "done" | "current" | "todo";

/**
 * The order's progress, with the moment each step was reached.
 *
 * State is carried by shape and text as well as colour — a filled green dot with
 * a tick for done, a ringed gold dot for the step in progress, a hollow grey one
 * for what is still ahead — so it stays readable without colour vision, and
 * every step is named for a screen reader.
 *
 * Layout is width-driven rather than cosmetic. Five French labels need ~61px
 * each and a 390px card only affords 61.5px per column, so the horizontal rail
 * is used from `sm` up and phones get a vertical timeline instead — which also
 * leaves room for the full timestamp rather than a truncated date. In a list of
 * orders (`compact`) the phone shows the rail with a single summary line, so a
 * page of orders stays scannable.
 */
export default function OrderTracker({
  status,
  events = [],
  placedAt,
  compact = false,
}: {
  status: string;
  events?: TrackerEvent[];
  placedAt?: string;
  compact?: boolean;
}) {
  if (status === "CANCELLED") {
    const at = events.find((e) => e.status === "CANCELLED")?.at;
    return (
      <p className="text-sm font-semibold text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
        Commande annulée{at && <span className="font-normal text-red-500"> · {moment(at)}</span>}
      </p>
    );
  }

  const current = status === "PENDING" ? -1 : STEPS.findIndex((s) => s.key === status);
  // First occurrence wins: an order pushed back and forward again should still
  // report when it originally shipped.
  const firstAt = new Map<string, string>();
  for (const e of events) if (!firstAt.has(e.status)) firstAt.set(e.status, e.at);

  const stateOf = (i: number): State => (i < current ? "done" : i === current ? "current" : "todo");

  // One list, rendered two ways. "Commandée" is not a status in the data — it is
  // the order's own creation time, shown so a pending order is not four empty
  // circles.
  const rows: { key: string; label: string; state: State; at?: string; n?: number }[] = [];
  if (placedAt) rows.push({ key: "PLACED", label: "Commandée", state: "done", at: placedAt });
  STEPS.forEach((s, i) => rows.push({ key: s.key, label: s.label, state: stateOf(i), at: firstAt.get(s.key), n: i + 1 }));

  return (
    <>
      {/* Phone */}
      <div className="sm:hidden">{compact ? <PhoneCompact rows={rows} /> : <PhoneTimeline rows={rows} />}</div>

      {/* Tablet and up: the horizontal rail, which fits from 640px on. */}
      <div className="hidden sm:flex flex-col gap-2">
        <ol className="flex items-start">
          {rows.map((r, i) => (
            <li key={r.key} className={`flex items-start min-w-0 ${i === rows.length - 1 ? "" : "flex-1"}`}>
              <Dot state={r.state} n={r.n} label={r.label} at={r.at} compact={compact} />
              {i < rows.length - 1 && <Rail filled={r.state === "done"} />}
            </li>
          ))}
        </ol>

        <div className="flex text-[11px] leading-tight" aria-hidden="true">
          {rows.map((r, i) => (
            <div key={r.key} className={`min-w-0 pe-1 ${i === rows.length - 1 ? "w-[70px] text-end pe-0" : "flex-1"}`}>
              <p className={labelClass(r.state)}>{r.label}</p>
              {r.at && r.state !== "todo" ? (
                <p className="text-slate-400">{moment(r.at)}</p>
              ) : (
                <p className="text-transparent select-none">—</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function labelClass(state: State) {
  return state === "current"
    ? "font-bold text-navy-950"
    : state === "done"
      ? "font-semibold text-green-700"
      : "text-slate-400";
}

/**
 * The phone timeline. Vertical, so each step gets a whole line for its name and
 * the exact time it happened — no truncation, no collisions, and the shape of
 * the list itself shows how far along the order is.
 */
function PhoneTimeline({ rows }: { rows: { key: string; label: string; state: State; at?: string; n?: number }[] }) {
  return (
    <ol className="flex flex-col">
      {rows.map((r, i) => (
        <li key={r.key} className="flex gap-3">
          <div className="flex flex-col items-center shrink-0">
            <Dot state={r.state} n={r.n} label={r.label} at={r.at} />
            {i < rows.length - 1 && (
              <span
                aria-hidden="true"
                className={`w-[3px] flex-1 min-h-[14px] rounded-full my-1 ${
                  r.state === "done" ? "bg-green-600" : "bg-slate-200"
                }`}
              />
            )}
          </div>
          <div className={`min-w-0 text-[13px] leading-tight ${i < rows.length - 1 ? "pb-2.5" : ""} pt-1`} aria-hidden="true">
            <p className={labelClass(r.state)}>{r.label}</p>
            {r.at && r.state !== "todo" && <p className="text-[11px] text-slate-400 mt-0.5">{moment(r.at)}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * The phone view inside a list of orders: the rail keeps its at-a-glance
 * progress, and one line names where the order actually is. Five stacked steps
 * per card would turn a page of orders into a page of timelines.
 */
function PhoneCompact({ rows }: { rows: { key: string; label: string; state: State; at?: string; n?: number }[] }) {
  const latest = [...rows].reverse().find((r) => r.state !== "todo") ?? rows[0];
  return (
    <div className="flex flex-col gap-2">
      <ol className="flex items-center">
        {rows.map((r, i) => (
          <li key={r.key} className={`flex items-center min-w-0 ${i === rows.length - 1 ? "" : "flex-1"}`}>
            <Dot state={r.state} n={r.n} label={r.label} at={r.at} compact />
            {i < rows.length - 1 && <Rail filled={r.state === "done"} compact />}
          </li>
        ))}
      </ol>
      <p className="text-[11px] leading-tight" aria-hidden="true">
        <span className={labelClass(latest.state)}>{latest.label}</span>
        {latest.at && <span className="text-slate-400"> · {moment(latest.at)}</span>}
      </p>
    </div>
  );
}

function Dot({
  state,
  n,
  label,
  at,
  compact,
}: {
  state: State;
  n?: number;
  label?: string;
  at?: string;
  compact?: boolean;
}) {
  const size = compact ? "w-6 h-6" : "w-7 h-7";
  return (
    <span
      className={`${size} rounded-full grid place-items-center text-[11px] font-bold shrink-0 transition-colors ${
        state === "done"
          ? "bg-green-600 text-white"
          : state === "current"
            ? "bg-gold-500 text-navy-950 ring-4 ring-gold-500/25"
            : "bg-white text-slate-300 border-2 border-slate-200"
      }`}
    >
      {state === "done" ? <IconCheck className="w-3.5 h-3.5" /> : n}
      <span className="sr-only">
        {label ?? "Commandée"}
        {state === "done" ? ` — faite${at ? ` le ${moment(at)}` : ""}` : state === "current" ? " — en cours" : " — à venir"}
      </span>
    </span>
  );
}

function Rail({ filled, compact }: { filled: boolean; compact?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex-1 h-[3px] mx-1.5 rounded-full ${compact ? "" : "mt-3"} ${filled ? "bg-green-600" : "bg-slate-200"}`}
    />
  );
}
