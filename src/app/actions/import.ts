"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { slugify } from "@/lib/slug";
import { normalizeReference } from "@/lib/reference";
import { parseDelimited, autoMap, normalizeRow, flagDuplicates, type ParsedRow, type ImportField } from "@/lib/import/parse";

async function assertAdmin() {
  const admin = await requireAdmin();
  if (!admin) throw new Error("Non autorisé");
  return admin;
}

export type ImportState = { error?: string; ok?: string; batchId?: string } | undefined;

const MAX_ROWS = 20000;
const MAX_BYTES = 12 * 1024 * 1024;

/**
 * Step 1 — parse and validate, but write nothing to the catalogue. The batch
 * stores the parsed rows so the preview the operator approves is byte-for-byte
 * what gets applied; re-parsing at apply time would let the two diverge.
 */
export async function stageImport(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const admin = await assertAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Aucun fichier sélectionné." };
  if (file.size > MAX_BYTES) return { error: `Fichier trop volumineux (max ${MAX_BYTES / 1024 / 1024} Mo).` };

  const text = await file.text();
  const { headers, rows } = parseDelimited(text);
  if (headers.length === 0 || rows.length === 0) return { error: "Fichier vide ou illisible." };
  if (rows.length > MAX_ROWS) return { error: `${rows.length} lignes : au-delà de ${MAX_ROWS}, découpez le fichier.` };

  const map = autoMap(headers);
  const missingRequired = (["sku", "name", "category", "priceSell"] as ImportField[]).filter((f) => map[f] === undefined);
  if (missingRequired.length > 0) {
    return {
      error: `Colonnes obligatoires introuvables : ${missingRequired.join(", ")}. En-têtes lus : ${headers.join(" · ")}`,
    };
  }

  const parsed = flagDuplicates(rows.map((r, i) => normalizeRow(r, map, i + 2)));

  // Which of these already exist decides created vs updated in the preview.
  const skus = parsed.map((r) => r.sku).filter(Boolean);
  const existing = await prisma.product.findMany({
    where: { sku: { in: skus } },
    select: { sku: true },
  });
  const existingSkus = new Set(existing.map((e) => e.sku));

  const valid = parsed.filter((r) => r.errors.length === 0);
  const batch = await prisma.importBatch.create({
    data: {
      filename: file.name,
      status: "DRAFT",
      rowCount: parsed.length,
      createdCount: valid.filter((r) => !existingSkus.has(r.sku)).length,
      updatedCount: valid.filter((r) => existingSkus.has(r.sku)).length,
      errorCount: parsed.length - valid.length,
      skippedCount: 0,
      payload: parsed as unknown as object,
      report: {
        headers,
        mapping: map,
        warningCount: parsed.reduce((s, r) => s + r.warnings.length, 0),
      },
      createdById: admin.id,
    },
    select: { id: true },
  });

  revalidatePath("/admin/import");
  return { ok: `${parsed.length} ligne(s) analysée(s)`, batchId: batch.id };
}

/**
 * Step 2 — apply. Categories and brands named in the file are created if they
 * do not exist, because refusing an import over a missing category would make
 * the operator do the work by hand anyway. Everything is tagged with the batch
 * id so it can be undone.
 */
export async function applyImport(batchId: string): Promise<ImportState> {
  await assertAdmin();

  const batch = await prisma.importBatch.findUnique({ where: { id: batchId } });
  if (!batch) return { error: "Import introuvable." };
  if (batch.status !== "DRAFT") return { error: "Cet import a déjà été traité." };

  const rows = (batch.payload as unknown as ParsedRow[]).filter((r) => r.errors.length === 0);
  if (rows.length === 0) return { error: "Aucune ligne valide à importer." };

  // Resolve every category and brand up front rather than per row: one pass
  // instead of thousands of round trips.
  const categoryNames = [...new Set(rows.map((r) => r.category))];
  const brandNames = [...new Set(rows.map((r) => r.brand).filter(Boolean))] as string[];

  const categoryByKey = new Map<string, string>();
  for (const name of categoryNames) {
    const slug = slugify(name);
    let cat = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
    if (!cat) {
      const last = await prisma.category.findFirst({ where: { parentId: null }, orderBy: { order: "desc" }, select: { order: true } });
      cat = await prisma.category.create({
        data: { name, slug, parentId: null, order: (last?.order ?? 0) + 1 },
        select: { id: true },
      });
    }
    categoryByKey.set(name, cat.id);
  }

  const brandByKey = new Map<string, string>();
  for (const name of brandNames) {
    const slug = slugify(name);
    let br = await prisma.brand.findUnique({ where: { slug }, select: { id: true } });
    if (!br) br = await prisma.brand.create({ data: { name, slug, isPartsBrand: true }, select: { id: true } });
    brandByKey.set(name, br.id);
  }

  let created = 0, updated = 0, failed = 0;

  for (const row of rows) {
    try {
      const categoryId = categoryByKey.get(row.category)!;
      const brandId = row.brand ? brandByKey.get(row.brand) ?? null : null;
      const base = {
        name: row.name,
        categoryId,
        brandId,
        description: row.description ?? "",
        priceSell: row.priceSell ?? 0,
        priceBuy: row.priceBuy ?? 0,
        stockQty: row.stockQty,
        axle: row.axle,
        side: row.side,
        importBatchId: batch.id,
      };

      const existing = await prisma.product.findUnique({ where: { sku: row.sku }, select: { id: true } });
      let productId: string;
      if (existing) {
        await prisma.product.update({ where: { id: existing.id }, data: base });
        productId = existing.id;
        updated++;
      } else {
        const p = await prisma.product.create({
          data: { ...base, sku: row.sku, slug: await uniqueSlug(row.slug) },
          select: { id: true },
        });
        productId = p.id;
        created++;
      }

      const refs = [
        ...row.oem.map((raw) => ({ type: "OEM" as const, raw })),
        ...row.aftermarket.map((raw) => ({ type: "AFTERMARKET" as const, raw })),
      ];
      for (const r of refs) {
        const normalized = normalizeReference(r.raw);
        if (!normalized) continue;
        await prisma.partReference.upsert({
          where: { productId_type_normalized: { productId, type: r.type, normalized } },
          create: { productId, type: r.type, raw: r.raw, normalized, brand: row.brand },
          update: { raw: r.raw, brand: row.brand },
        });
      }
    } catch {
      failed++;
    }
  }

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      status: "APPLIED",
      appliedAt: new Date(),
      createdCount: created,
      updatedCount: updated,
      skippedCount: failed,
    },
  });

  revalidatePath("/admin/import");
  revalidatePath("/admin/stock");
  revalidatePath("/admin/qualite");
  revalidatePath("/", "layout");
  return { ok: `${created} créé(s), ${updated} mis à jour${failed ? `, ${failed} en échec` : ""}` };
}

/**
 * Undo. Only products this batch *created* are deleted — a product it merely
 * updated is left alone, because deleting it would destroy data the batch did
 * not introduce. Products that have since been ordered are kept too.
 */
export async function rollbackImport(batchId: string): Promise<ImportState> {
  await assertAdmin();
  const batch = await prisma.importBatch.findUnique({ where: { id: batchId } });
  if (!batch) return { error: "Import introuvable." };
  if (batch.status !== "APPLIED") return { error: "Seul un import appliqué peut être annulé." };

  const rows = (batch.payload as unknown as ParsedRow[]).filter((r) => r.errors.length === 0);
  const skus = rows.map((r) => r.sku);

  const candidates = await prisma.product.findMany({
    where: { sku: { in: skus }, importBatchId: batch.id },
    select: { id: true, sku: true, _count: { select: { orderItems: true } } },
  });
  const deletable = candidates.filter((c) => c._count.orderItems === 0).map((c) => c.id);
  const kept = candidates.length - deletable.length;

  if (deletable.length > 0) {
    await prisma.productImage.deleteMany({ where: { productId: { in: deletable } } });
    await prisma.partReference.deleteMany({ where: { productId: { in: deletable } } });
    await prisma.productFitment.deleteMany({ where: { productId: { in: deletable } } });
    await prisma.stockMovement.deleteMany({ where: { productId: { in: deletable } } });
    await prisma.product.deleteMany({ where: { id: { in: deletable } } });
  }

  await prisma.importBatch.update({ where: { id: batch.id }, data: { status: "ROLLED_BACK" } });
  revalidatePath("/admin/import");
  revalidatePath("/admin/stock");
  revalidatePath("/", "layout");
  return {
    ok: `${deletable.length} produit(s) retiré(s)${kept ? ` · ${kept} conservé(s) car déjà commandé(s)` : ""}`,
  };
}

export async function discardImport(batchId: string): Promise<ImportState> {
  await assertAdmin();
  const batch = await prisma.importBatch.findUnique({ where: { id: batchId }, select: { status: true } });
  if (!batch) return { error: "Import introuvable." };
  if (batch.status !== "DRAFT") return { error: "Seul un brouillon peut être supprimé." };
  await prisma.importBatch.delete({ where: { id: batchId } });
  revalidatePath("/admin/import");
  return { ok: "Brouillon supprimé" };
}

/** Slugs are public URLs and must be unique; collisions get a numeric suffix. */
async function uniqueSlug(base: string): Promise<string> {
  const root = base || "produit";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const clash = await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!clash) return candidate;
  }
  return `${root}-${Date.now()}`;
}
