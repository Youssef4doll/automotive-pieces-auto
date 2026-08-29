import { slugify } from "@/lib/slug";
import { normalizeReference, parseReferenceList } from "@/lib/reference";

/**
 * CSV parsing that survives real supplier exports: quoted fields containing
 * the delimiter, doubled quotes, CRLF line endings, and a UTF-8 BOM that
 * Excel adds silently and which otherwise corrupts the first column name.
 * Delimiter is detected because French exports frequently use ';'.
 */
export function parseDelimited(text: string): { headers: string[]; rows: string[][] } {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.slice(0, clean.indexOf("\n") === -1 ? clean.length : clean.indexOf("\n"));
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === delimiter) { row.push(field); field = ""; continue; }
    if (c === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = []; field = "";
      continue;
    }
    field += c;
  }
  row.push(field.replace(/\r$/, ""));
  if (row.some((f) => f.trim() !== "")) rows.push(row);

  const headers = (rows.shift() ?? []).map((h) => h.trim());
  return { headers, rows };
}

/** The fields an import can populate, and the header names we recognise. */
export const IMPORT_FIELDS = {
  sku: { label: "Référence interne (SKU)", required: true, aliases: ["sku", "reference", "référence", "ref", "code", "code article"] },
  name: { label: "Nom du produit", required: true, aliases: ["name", "nom", "designation", "désignation", "libelle", "libellé", "produit"] },
  category: { label: "Catégorie", required: true, aliases: ["category", "categorie", "catégorie", "famille", "sous-famille"] },
  brand: { label: "Marque", required: false, aliases: ["brand", "marque", "fabricant", "equipementier", "équipementier"] },
  priceSell: { label: "Prix de vente", required: true, aliases: ["pricesell", "prix", "prix de vente", "prix vente", "pv", "price"] },
  priceBuy: { label: "Prix d'achat", required: false, aliases: ["pricebuy", "prix achat", "prix d'achat", "pa", "cost", "cout", "coût"] },
  stockQty: { label: "Stock", required: false, aliases: ["stock", "stockqty", "quantite", "quantité", "qty", "qte", "qté"] },
  oem: { label: "Références OEM", required: false, aliases: ["oem", "ref oem", "référence oem", "reference oem", "constructeur"] },
  aftermarket: { label: "Références équipementier", required: false, aliases: ["aftermarket", "ref equipementier", "référence équipementier", "ref fabricant"] },
  description: { label: "Description", required: false, aliases: ["description", "desc", "details", "détails"] },
  axle: { label: "Essieu", required: false, aliases: ["axle", "essieu", "position essieu"] },
  side: { label: "Côté", required: false, aliases: ["side", "cote", "côté", "position laterale"] },
} as const;

export type ImportField = keyof typeof IMPORT_FIELDS;

/** Best-guess mapping from the file's headers to our fields. */
export function autoMap(headers: string[]): Partial<Record<ImportField, number>> {
  const map: Partial<Record<ImportField, number>> = {};
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  headers.forEach((h, i) => {
    const hn = norm(h);
    for (const [field, def] of Object.entries(IMPORT_FIELDS) as [ImportField, { aliases: readonly string[] }][]) {
      if (map[field] !== undefined) continue;
      if (def.aliases.some((a) => norm(a) === hn)) { map[field] = i; return; }
    }
  });
  return map;
}

export type ParsedRow = {
  line: number;
  sku: string;
  name: string;
  category: string;
  brand: string | null;
  priceSell: number | null;
  priceBuy: number | null;
  stockQty: number;
  oem: string[];
  aftermarket: string[];
  description: string;
  axle: "AVANT" | "ARRIERE" | null;
  side: "GAUCHE" | "DROITE" | null;
  slug: string;
  errors: string[];
  warnings: string[];
};

/** Prices arrive as "149,90", "149.90 DT", "1 149,90". All must become 149.9. */
function parsePrice(raw: string): number | null {
  if (!raw?.trim()) return null;
  const cleaned = raw.replace(/[^\d,.-]/g, "").replace(/\s/g, "");
  if (!cleaned) return null;
  // If both separators appear, the last one is the decimal separator.
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let n: string;
  if (lastComma > lastDot) n = cleaned.replace(/\./g, "").replace(",", ".");
  else n = cleaned.replace(/,/g, "");
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function parseAxle(raw: string): "AVANT" | "ARRIERE" | null {
  const s = raw.toLowerCase();
  if (/avant|front|av\b/.test(s)) return "AVANT";
  if (/arri|rear|ar\b/.test(s)) return "ARRIERE";
  return null;
}

function parseSide(raw: string): "GAUCHE" | "DROITE" | null {
  const s = raw.toLowerCase();
  if (/gauche|left|\bg\b/.test(s)) return "GAUCHE";
  if (/droit|right|\bd\b/.test(s)) return "DROITE";
  return null;
}

/**
 * Validate and normalise one row. Errors block the row; warnings let it
 * through but tell the operator what will be incomplete — the distinction
 * matters because a supplier file is never perfect and refusing everything
 * would make the importer unusable.
 */
export function normalizeRow(
  values: string[],
  map: Partial<Record<ImportField, number>>,
  line: number,
): ParsedRow {
  const get = (f: ImportField) => {
    const i = map[f];
    return i === undefined ? "" : (values[i] ?? "").trim();
  };

  const errors: string[] = [];
  const warnings: string[] = [];

  const sku = get("sku");
  const name = get("name");
  const category = get("category");
  if (!sku) errors.push("Référence (SKU) manquante");
  if (!name) errors.push("Nom manquant");
  if (!category) errors.push("Catégorie manquante");

  const priceSell = parsePrice(get("priceSell"));
  if (priceSell === null) errors.push("Prix de vente illisible ou absent");
  else if (priceSell <= 0) errors.push("Prix de vente à zéro");

  const priceBuy = parsePrice(get("priceBuy"));
  if (priceBuy === null) warnings.push("Pas de prix d'achat : la marge sera inconnue");
  else if (priceSell !== null && priceBuy > priceSell) warnings.push("Prix d'achat supérieur au prix de vente");

  const stockRaw = get("stockQty");
  const stockQty = stockRaw ? Math.max(0, Math.trunc(Number(stockRaw.replace(/[^\d-]/g, "")) || 0)) : 0;
  if (!stockRaw) warnings.push("Stock non renseigné : importé à 0");

  const oem = parseReferenceList(get("oem")).filter((r) => normalizeReference(r).length >= 3);
  const aftermarket = parseReferenceList(get("aftermarket")).filter((r) => normalizeReference(r).length >= 3);
  if (oem.length === 0 && aftermarket.length === 0) {
    warnings.push("Aucune référence : le produit sera introuvable par référence");
  }

  const axle = parseAxle(get("axle") || name);
  const side = parseSide(get("side") || name);

  return {
    line, sku, name, category,
    brand: get("brand") || null,
    priceSell, priceBuy, stockQty, oem, aftermarket,
    description: get("description"),
    axle, side,
    slug: slugify(`${name}-${sku}`),
    errors, warnings,
  };
}

/** Duplicate SKUs inside one file are an error, not a warning: they overwrite each other. */
export function flagDuplicates(rows: ParsedRow[]) {
  const seen = new Map<string, number>();
  for (const r of rows) {
    if (!r.sku) continue;
    const key = r.sku.toUpperCase();
    const first = seen.get(key);
    if (first !== undefined) r.errors.push(`Référence en double dans le fichier (déjà ligne ${first})`);
    else seen.set(key, r.line);
  }
  return rows;
}
