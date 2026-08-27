const STEPS: { key: string; label: string }[] = [
  { key: "CONFIRMED", label: "Confirmée" },
  { key: "PREPARED", label: "Préparée" },
  { key: "SHIPPED", label: "Expédiée" },
  { key: "DELIVERED", label: "Livrée" },
];

export default function OrderStatusTimeline({ status }: { status: string }) {
  if (status === "CANCELLED") {
    return <p className="text-sm font-semibold text-red-600">Commande annulée</p>;
  }

  const currentIndex = status === "PENDING" ? -1 : STEPS.findIndex((s) => s.key === status);

  return (
    <div className="flex items-center">
      {STEPS.map((step, i) => {
        const done = i <= currentIndex;
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  done ? "bg-green-600 text-white" : "bg-gray-200 text-gray-400"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              <span className={`text-[10px] whitespace-nowrap ${done ? "text-green-700 font-semibold" : "text-gray-400"}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${i < currentIndex ? "bg-green-600" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
