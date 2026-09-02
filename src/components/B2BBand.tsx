import Eyebrow from "./Eyebrow";
import T from "./T";
import B2BCta from "./B2BCta";

export default function B2BBand({ contactUrl }: { contactUrl: string }) {
  return (
    <section className="bg-navy-950 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div>
          <Eyebrow k="b2b.eyebrow" className="text-xs font-display font-bold uppercase tracking-wide text-gold-500 mb-1.5" />
          <h2 className="font-heading font-extrabold uppercase text-xl sm:text-2xl text-white tracking-tight">
            <T k="b2b.title" />
          </h2>
          <p className="text-white/60 text-sm mt-1">
            <T k="b2b.subtitle" />
          </p>
        </div>
        <B2BCta contactUrl={contactUrl} />
      </div>
    </section>
  );
}
