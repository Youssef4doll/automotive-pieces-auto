/**
 * Skeletons that match the real layout, so the page does not jump when the
 * content lands. `animate-pulse` is a Tailwind primitive and respects the
 * project's prefers-reduced-motion block.
 */
export function Bar({ className = "" }: { className?: string }) {
  return <span className={`block rounded bg-slate-200/80 ${className}`} />;
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 animate-pulse">
      <Bar className="h-3 w-24 mb-3" />
      <Bar className="h-6 w-40 mb-4" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Bar key={i} className={`h-3 ${i === lines - 1 ? "w-1/2" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}

export function AccountSkeleton() {
  return (
    <div className="w-full min-w-0 mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8 py-5 lg:py-9">
      <div className="lg:grid lg:grid-cols-[236px_1fr] lg:gap-8 xl:gap-10">
        <div className="hidden lg:flex flex-col gap-2" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Bar key={i} className="h-11 w-full animate-pulse" />
          ))}
        </div>
        <div className="min-w-0 flex flex-col gap-4" role="status" aria-label="Chargement de votre espace">
          <Bar className="h-8 w-56 animate-pulse" />
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden animate-pulse">
            <div className="bg-slate-200/60 h-28" />
            <div className="p-5 flex flex-col gap-3">
              <Bar className="h-7 w-full" />
              <Bar className="h-3 w-2/3" />
              <Bar className="h-11 w-48 mt-2" />
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Bar key={i} className="h-[104px] rounded-2xl animate-pulse" />
            ))}
          </div>
          <CardSkeleton lines={2} />
          <CardSkeleton lines={4} />
        </div>
      </div>
    </div>
  );
}
