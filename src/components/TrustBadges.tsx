import T from "./T";

const ITEMS = [1, 2, 3, 4] as const;

export default function TrustBadges() {
  return (
    <section className="bg-white px-4 pb-2 pt-5 sm:pt-8">
      <div className="mx-auto max-w-7xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {ITEMS.map((n) => (
          <div key={n} className="flex items-center gap-3.5 p-4.5 rounded-lg bg-gray-50">
            <div
              className="shrink-0 w-11 h-11 bg-navy-900 flex items-center justify-center text-gold-500 font-heading font-extrabold text-lg"
              style={{ clipPath: "polygon(25% 3%,75% 3%,100% 50%,75% 97%,25% 97%,0% 50%)" }}
            >
              {n}
            </div>
            <div>
              <div className="font-display font-bold uppercase tracking-wide text-sm text-navy-950">
                <T k={`trust.title${n}`} />
              </div>
              <div className="text-[13px] text-gray-500">
                <T k={`trust.sub${n}`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
