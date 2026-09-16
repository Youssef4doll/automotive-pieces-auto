import Link from "next/link";
import type { OeGroup } from "@/lib/reference";

/**
 * The constructor's own numbers, grouped by the carmaker that stamps them.
 *
 * This is the most valuable block on a parts page and it used to be one line:
 * every OE number joined with a middle dot, unattributed and unclickable. Two
 * things were wrong with that. A number means nothing without its carmaker —
 * "1611349280" is a wiper blade to nobody, "PEUGEOT 1611349280" is what the
 * garage quotes back — and a number is a search, not a decoration: somebody
 * arrives here holding the old part, reads the number stamped on it, and the
 * one thing they want to do next is look it up.
 *
 * So each number is a link to its own reference page, which the site already
 * builds. The link is on the normalised form, because "1611 349 280" and
 * "1611349280" are one part number written twice and must not become two
 * addresses; the label stays exactly as the shop typed it, because that is how
 * it is printed on the part.
 *
 * Nothing here is generated. A part with no numbers entered shows no section —
 * an empty "OE numbers" heading suggests we looked and found none, which is a
 * different and untrue claim.
 */
export default function OeNumbers({
  groups,
  other,
  title,
}: {
  groups: OeGroup[];
  /** The equipment maker's own catalogue numbers, if any were entered. */
  other: { raw: string; normalized: string }[];
  title: string;
}) {
  if (groups.length === 0 && other.length === 0) return null;

  return (
    <section id="references-oe" className="scroll-mt-24">
      <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950 mb-1">
        Références
      </h2>
      <p className="text-sm text-gray-600 mb-3">
        Les numéros auxquels {title} répond. Touchez un numéro pour voir ce que nous avons sous
        cette référence.
      </p>

      <ul className="flex flex-col gap-3 list-none p-0 m-0">
        {groups.map((g) => (
          <li key={g.owner || "_"} className="flex flex-col gap-1.5">
            <span className="font-display text-[11px] font-bold uppercase tracking-wider text-navy-900/50">
              {/* A number whose carmaker nobody has recorded is still printed —
                  it is still the number that will be searched for — but it is
                  labelled as unattributed rather than filed under a guess. */}
              {g.owner || "Sans constructeur indiqué"}
            </span>
            <Chips refs={g.refs} />
          </li>
        ))}

        {/* The equipment maker's own catalogue numbers. Kept apart from the
            OE block, because they answer a different question: an OE number
            says "this replaces the part your car left the factory with", and
            this one says "this is what the box is called". */}
        {other.length > 0 && (
          <li className="flex flex-col gap-1.5">
            <span className="font-display text-[11px] font-bold uppercase tracking-wider text-navy-900/50">
              Référence équipementier
            </span>
            <Chips refs={other} />
          </li>
        )}
      </ul>
    </section>
  );
}

/**
 * A row of numbers, each one a link.
 *
 * `dir="ltr"` because a part number reads left to right whatever language
 * surrounds it: in Arabic, a bidirectional run would reorder the digit groups
 * of "77 01 234 567" on screen and print a number the part does not carry.
 * `break-all` so a long unbroken reference wraps inside its chip instead of
 * pushing the page off a 390px phone.
 */
function Chips({ refs }: { refs: { raw: string; normalized: string }[] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {refs.map((r) => (
        <Link
          key={r.normalized}
          href={`/reference/${r.normalized}`}
          dir="ltr"
          className="inline-flex min-h-tap-compact max-w-full items-center break-all rounded-lg border border-navy-900/12 bg-gray-50 px-2.5 font-mono text-[13px] text-navy-900 hover:border-gold-500 hover:bg-white"
        >
          {r.raw}
        </Link>
      ))}
    </span>
  );
}
