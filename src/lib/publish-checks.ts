import { brandInNameMismatch } from "./catalog-anomalies";

/**
 * What a part must have before customers can see it — one list for the
 * admin form and the import, so the two cannot disagree.
 *
 * Blocking: a price that is not a price (zero, above MAX_PRICE, or below
 * what the shop pays), no brand, or a title naming another brand ("… DELPHI"
 * filed under TOTAL). Not blocking but said out loud: no photo — the part
 * then shows its family's illustration, tagged as one, and the admin has to
 * choose "Publier sans photo" knowingly.
 */
export const MAX_PRICE = 50_000;

export type PublishCheck = { key: "price" | "margin" | "brand" | "brandName" | "photo"; message: string; blocking: boolean };

export function publishChecks(p: {
  name: string;
  priceSell: number;
  priceBuy: number | null;
  brandName: string | null;
  imageCount: number;
  allBrands: string[];
}): PublishCheck[] {
  const out: PublishCheck[] = [];
  if (!(p.priceSell > 0)) out.push({ key: "price", message: "Prix de vente à zéro ou absent.", blocking: true });
  else if (p.priceSell > MAX_PRICE) out.push({ key: "price", message: `Prix de vente au-delà de ${MAX_PRICE.toLocaleString("fr-FR")} DT — une virgule oubliée ?`, blocking: true });
  if (p.priceBuy != null && p.priceBuy > 0 && p.priceSell > 0 && p.priceSell < p.priceBuy)
    out.push({ key: "margin", message: "Prix de vente inférieur au prix d'achat.", blocking: true });
  if (!p.brandName) out.push({ key: "brand", message: "Aucune marque choisie.", blocking: true });
  else {
    const other = brandInNameMismatch(p.name, p.brandName, p.allBrands);
    if (other) out.push({ key: "brandName", message: `Le nom cite ${other} mais la marque choisie est ${p.brandName}.`, blocking: true });
  }
  if (p.imageCount === 0) out.push({ key: "photo", message: "Aucune photo : l'illustration de la famille sera affichée.", blocking: false });
  return out;
}

export const canPublish = (checks: PublishCheck[]) => !checks.some((c) => c.blocking);
