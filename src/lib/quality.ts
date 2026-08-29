/**
 * Catalogue readiness, expressed per product.
 *
 * The point is not to grade the shop — it is to give whoever is loading the
 * real catalogue a precise, finite worklist. Every check names one missing
 * thing and is weighted by how much that thing costs the business when absent:
 * a product nobody can find (no reference) or nobody trusts (no photo) hurts
 * far more than a missing description.
 */

export type QualityCheck = {
  key: string;
  label: string;
  weight: number;
  ok: boolean;
  /** Why it matters, shown to the operator so the list is self-explaining. */
  why: string;
};

export type ProductQualityInput = {
  name: string;
  description: string;
  priceSell: unknown;
  priceBuy: unknown;
  stockQty: number;
  categoryId: string;
  brandId: string | null;
  axle: string | null;
  side: string | null;
  _count: { images: number; references: number; fitments: number };
};

const num = (v: unknown) => Number(v ?? 0);

/**
 * Position only applies to parts that actually have a side or an axle. We
 * cannot know that from the data alone, so it is judged on the name: if the
 * name says "avant" or "gauche", the structured field must agree. This keeps
 * an oil filter from being marked incomplete for lacking an axle.
 */
function positionExpected(name: string) {
  const n = name.toLowerCase();
  return {
    axle: /\bavant\b|\barri[eè]re\b/.test(n),
    side: /\bgauche\b|\bdroit/.test(n),
  };
}

export function scoreProduct(p: ProductQualityInput): {
  score: number;
  checks: QualityCheck[];
  missing: QualityCheck[];
} {
  const expects = positionExpected(p.name);

  const checks: QualityCheck[] = [
    {
      key: "reference",
      label: "Référence OEM ou équipementier",
      weight: 25,
      ok: p._count.references > 0,
      why: "Sans référence, le client qui tient l'ancienne pièce ne peut pas la trouver.",
    },
    {
      key: "photo",
      label: "Photo propre au produit",
      weight: 20,
      ok: p._count.images > 0,
      why: "La photo est la fiche technique du client : elle décide de l'achat.",
    },
    {
      key: "fitment",
      label: "Compatibilité véhicule",
      weight: 20,
      ok: p._count.fitments > 0,
      why: "Sans compatibilité, impossible de répondre « est-ce que ça va sur ma voiture ? ».",
    },
    {
      key: "priceBuy",
      label: "Prix d'achat",
      weight: 10,
      ok: num(p.priceBuy) > 0,
      why: "Sans prix d'achat, la marge de cette ligne est invisible.",
    },
    {
      key: "priceSell",
      label: "Prix de vente",
      weight: 10,
      ok: num(p.priceSell) > 0,
      why: "Un produit sans prix ne peut pas être vendu.",
    },
    {
      key: "brand",
      label: "Marque",
      weight: 5,
      ok: !!p.brandId,
      why: "La marque est un filtre du catalogue et un signal de confiance.",
    },
    {
      key: "description",
      label: "Description",
      weight: 5,
      ok: p.description.trim().length >= 20,
      why: "La description alimente la recherche interne et le référencement.",
    },
    {
      key: "position",
      label: "Position (essieu / côté)",
      weight: 5,
      ok: (!expects.axle || !!p.axle) && (!expects.side || !!p.side),
      why: "Le nom mentionne une position : sans champ structuré, on livre la mauvaise pièce.",
    },
  ];

  const total = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.reduce((s, c) => s + (c.ok ? c.weight : 0), 0);
  return {
    score: Math.round((earned / total) * 100),
    checks,
    missing: checks.filter((c) => !c.ok).sort((a, b) => b.weight - a.weight),
  };
}

/** Products below this are not fit to be shown to a customer. */
export const SELLABLE_THRESHOLD = 60;

export function qualityBand(score: number): { label: string; tone: "ok" | "warn" | "bad" } {
  if (score >= 85) return { label: "Prêt", tone: "ok" };
  if (score >= SELLABLE_THRESHOLD) return { label: "Incomplet", tone: "warn" };
  return { label: "À compléter", tone: "bad" };
}
