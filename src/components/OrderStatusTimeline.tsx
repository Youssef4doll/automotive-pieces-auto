const STEPS: { key: string; label: string }[] = [
  { key: "CONFIRMED", label: "Confirmée" },
  { key: "PREPARED", label: "Préparée" },
  { key: "SHIPPED", label: "Expédiée" },
  { key: "DELIVERED", label: "Livrée" },
];

export type StatusEvent = { status: string; at: string };

function formatMoment(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
    time: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  };
}

/**
 * "Where is my order" is the question this answers, and a bare tick does not
 * answer it: a customer wants to know *when* each step happened, so they can
 * judge whether today's silence is normal. Each completed step therefore
 * carries the moment it was reached, taken from the order's own status history.
 */
export default function OrderStatusTimeline({
  status,
  events = [],
}: {
  status: string;
  events?: StatusEvent[];
}) {
  if (status === "CANCELLED") {
    const cancelled = events.find((e) => e.status === "CANCELLED");
    const at = cancelled ? formatMoment(cancelled.at) : null;
    return (
      <p className="text-sm font-semibold text-red-600">
        Commande annulée
        {at && <span className="font-normal text-red-500"> · {at.day} à {at.time}</span>}
      </p>
    );
  }

  const currentIndex = status === "PENDING" ? -1 : STEPS.findIndex((s) => s.key === status);
  // The first time a status was reached is the truthful one: an order set back
  // and forward again should still show when it originally shipped.
  const firstAt = new Map<string, string>();
  for (const e of events) if (!firstAt.has(e.status)) firstAt.set(e.status, e.at);

  return (
    <ol className="flex items-start">
      {STEPS.map((step, i) => {
        const done = i <= currentIndex;
        const iso = firstAt.get(step.key);
        const moment = done && iso ? formatMoment(iso) : null;
        return (
          <li key={step.key} className="flex items-start flex-1 last:flex-none min-w-0">
            <div className="flex flex-col items-center gap-1 min-w-0">
              <div
                aria-hidden="true"
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  done ? "bg-green-700 text-white" : "bg-gray-200 text-gray-600"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              <span className={`text-[11px] whitespace-nowrap ${done ? "text-green-700 font-semibold" : "text-gray-600"}`}>
                {step.label}
              </span>
              {/* Reserve the line whether or not there is a date, so the four
                  steps stay on one baseline instead of jumping about. */}
              <span className="text-[10px] leading-tight text-center text-gray-600 whitespace-nowrap min-h-[2.1em]">
                {moment ? (
                  <>
                    {moment.day}
                    <br />
                    {moment.time}
                  </>
                ) : (
                  ""
                )}
              </span>
              <span className="sr-only">
                {done ? `${step.label}${moment ? ` le ${moment.day} à ${moment.time}` : ""}` : `${step.label} — à venir`}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mt-3 ${i < currentIndex ? "bg-green-600" : "bg-gray-200"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
