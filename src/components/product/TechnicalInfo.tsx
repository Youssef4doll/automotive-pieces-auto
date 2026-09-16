import Link from "next/link";

export type TechRow = { label: string; value: string; href?: string };

/**
 * The specification sheet, moved out of the way of the product.
 *
 * The old page opened on a paragraph of technical prose and then a grid of
 * every key in a free-form JSON bag, all of it at the same weight. Somebody
 * deciding whether a part is the right part does not read that first — they
 * look at the picture, the name, whether it fits their car and what it costs,
 * and they come to the specifications only once they have decided they care.
 *
 * So the eight rows that identify a part are always visible, and everything
 * else is behind a `<details>`. Native, not a React toggle: it costs no
 * JavaScript, it opens without hydration, it is keyboard- and
 * screen-reader-addressable for free, and Ctrl+F finds the closed content in
 * every browser that matters.
 *
 * Rows are only ever built from fields the shop has filled in — `rows()` in
 * the page drops anything empty — so a thinly-described part shows three rows
 * rather than eight labels with dashes after them.
 */
export default function TechnicalInfo({
  rows,
  extra,
}: {
  /** The identity rows, always shown. */
  rows: TechRow[];
  /** Everything else the shop has recorded, behind the disclosure. */
  extra: TechRow[];
}) {
  if (rows.length === 0 && extra.length === 0) return null;

  return (
    <section id="technique" className="scroll-mt-24">
      <h2 className="mb-3 font-heading font-extrabold uppercase tracking-tight text-navy-950">
        Informations techniques
      </h2>

      <dl className="overflow-hidden rounded-xl border border-navy-900/10">
        {rows.map((r, i) => (
          <Row key={r.label} row={r} striped={i % 2 === 1} />
        ))}
      </dl>

      {extra.length > 0 && (
        <details className="group mt-2">
          <summary className="inline-flex min-h-tap cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-navy-900 underline underline-offset-2 hover:text-red-600">
            Toutes les caractéristiques ({extra.length})
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="transition-transform group-open:rotate-180"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <dl className="mt-2 overflow-hidden rounded-xl border border-navy-900/10">
            {extra.map((r, i) => (
              <Row key={r.label} row={r} striped={i % 2 === 1} />
            ))}
          </dl>
        </details>
      )}
    </section>
  );
}

function Row({ row, striped }: { row: TechRow; striped: boolean }) {
  return (
    <div
      className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3.5 py-2.5 text-sm ${
        striped ? "bg-gray-50/70" : "bg-white"
      }`}
    >
      <dt className="text-gray-500">{row.label}</dt>
      <dd className="min-w-0 text-end font-semibold text-navy-950">
        {row.href ? (
          <Link href={row.href} className="underline underline-offset-2 hover:text-red-600">
            {row.value}
          </Link>
        ) : (
          row.value
        )}
      </dd>
    </div>
  );
}
