import "server-only";
import { prisma } from "@/lib/prisma";
import { normalizeReference } from "@/lib/reference";

/**
 * The part numbers this shop can answer for.
 *
 * A reference page is only worth existing — and only worth a crawler's time —
 * if there is a live product behind it. This gathers every number the
 * catalogue actually carries: the SKU printed on the box, the constructor's
 * OEM numbers, and the cross-reference table once it is populated.
 *
 * Deduplicated on the normalised form, because "GDB 1330", "GDB-1330" and
 * "gdb1330" are one part number written three ways, and three URLs for one
 * part is how a catalogue teaches Google it is full of duplicates.
 */
export async function listIndexableReferences(): Promise<string[]> {
  const [products, references] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, select: { sku: true, oemRefs: true } }),
    prisma.partReference.findMany({
      where: { product: { active: true } },
      select: { normalized: true },
      distinct: ["normalized"],
    }),
  ]);

  const seen = new Set<string>();
  for (const p of products) {
    for (const raw of [p.sku, ...p.oemRefs]) {
      const n = normalizeReference(raw);
      if (n.length >= 3) seen.add(n);
    }
  }
  for (const r of references) {
    if (r.normalized.length >= 3) seen.add(r.normalized);
  }
  return [...seen];
}
