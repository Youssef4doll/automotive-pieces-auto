"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { readImageFile, mediaAssetIdFromUrl, assetUrl } from "@/lib/image-upload";

async function assertAdmin() {
  const admin = await requireAdmin();
  if (!admin) throw new Error("Non autorisé");
  return admin;
}

export type VehicleActionState = { error?: string; ok?: string } | undefined;

function revalidateVehicleSurfaces() {
  revalidatePath("/admin/catalogue/vehicules");
  revalidatePath("/", "layout");
}

/**
 * A make's logo is shown once and reused everywhere that make appears — the
 * home page's "Les véhicules que nous couvrons" cards, and eventually the
 * garage picker — so one upload per brand covers every model under it,
 * instead of asking the admin to supply a picture per model.
 */
export async function uploadMakeLogo(
  _prev: VehicleActionState,
  formData: FormData,
): Promise<VehicleActionState> {
  await assertAdmin();
  const makeId = String(formData.get("makeId") ?? "");
  const file = formData.get("file");
  if (!makeId) return { error: "Marque introuvable." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez une image." };

  const make = await prisma.vehicleMake.findUnique({ where: { id: makeId }, select: { name: true, logoUrl: true } });
  if (!make) return { error: "Marque introuvable." };

  // Vectors allowed: a manufacturer ships its logo as an SVG, it renders in a
  // 36px chip and a 44px admin row, and a bitmap scaled to both is the version
  // that looks wrong on the phone the shop's customers actually use.
  const read = await readImageFile(file, { allowVector: true });
  if (!read.ok) return { error: read.error };

  const asset = await prisma.mediaAsset.create({
    data: { data: read.bytes, mimeType: read.mimeType },
    select: { id: true },
  });
  const logoUrl = assetUrl(asset.id, read.mimeType);

  await prisma.vehicleMake.update({ where: { id: makeId }, data: { logoUrl } });

  // The old picture belonged to this make alone; nothing else can be
  // pointing at it.
  const oldAssetId = mediaAssetIdFromUrl(make.logoUrl);
  if (oldAssetId) await prisma.mediaAsset.deleteMany({ where: { id: oldAssetId } });

  revalidateVehicleSurfaces();
  return { ok: `Logo ${make.name} mis à jour` };
}

export async function removeMakeLogo(makeId: string): Promise<VehicleActionState> {
  await assertAdmin();
  const make = await prisma.vehicleMake.findUnique({ where: { id: makeId }, select: { name: true, logoUrl: true } });
  if (!make) return { error: "Marque introuvable." };

  await prisma.vehicleMake.update({ where: { id: makeId }, data: { logoUrl: null } });
  const assetId = mediaAssetIdFromUrl(make.logoUrl);
  if (assetId) await prisma.mediaAsset.deleteMany({ where: { id: assetId } });

  revalidateVehicleSurfaces();
  return { ok: `Logo ${make.name} retiré` };
}

/* -------------------------------------------------------------------------
   Makes, models and engines
   -------------------------------------------------------------------------
   The vehicle tree was seeded once and then read-only, which meant the shop
   could not add the car that just walked into the workshop. Everything below
   is ordinary CRUD over it, with two rules that are not negotiable:

   - A slug is derived, never typed. It is the address of a real page
     (/pieces/renault/clio-iv) and a hand-typed one drifts from the name.
   - Nothing that parts are attached to is deleted silently. Removing a model
     takes its engines with it, and those engines carry the fitment rows that
     say which parts fit — so the count is reported and the delete is refused
     unless the caller has seen it.
   ------------------------------------------------------------------------- */

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const nameOf = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const intOf = (fd: FormData, key: string) => {
  const raw = String(fd.get(key) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

/** Years have to make sense before they are stored, not after. */
function checkYears(from: number | null, to: number | null): string | null {
  const thisYear = new Date().getFullYear();
  for (const [label, y] of [["début", from], ["fin", to]] as const) {
    if (y !== null && (y < 1950 || y > thisYear + 2)) {
      return `Année de ${label} invalide (${y}) — attendu entre 1950 et ${thisYear + 2}.`;
    }
  }
  if (from !== null && to !== null && to < from) return "L'année de fin est avant l'année de début.";
  return null;
}

export async function upsertMake(_prev: VehicleActionState, formData: FormData): Promise<VehicleActionState> {
  await assertAdmin();
  const id = nameOf(formData, "id");
  const name = nameOf(formData, "name");
  if (name.length < 2) return { error: "Le nom de la marque est trop court." };

  const slug = slugify(name);
  if (!slug) return { error: "Ce nom ne donne pas d'adresse utilisable." };

  const clash = await prisma.vehicleMake.findFirst({
    where: { OR: [{ name }, { slug }], ...(id ? { NOT: { id } } : {}) },
    select: { name: true },
  });
  if (clash) return { error: `« ${clash.name} » existe déjà.` };

  if (id) await prisma.vehicleMake.update({ where: { id }, data: { name, slug } });
  else await prisma.vehicleMake.create({ data: { name, slug } });

  revalidateVehicleSurfaces();
  return { ok: id ? `${name} mise à jour` : `${name} ajoutée` };
}

export async function deleteMake(makeId: string): Promise<VehicleActionState> {
  await assertAdmin();
  const make = await prisma.vehicleMake.findUnique({
    where: { id: makeId },
    select: { name: true, logoUrl: true, models: { select: { _count: { select: { engines: true } } } } },
  });
  if (!make) return { error: "Marque introuvable." };

  // Refuse rather than cascade. Deleting a make takes its models, its engines
  // and every fitment row hanging off them — that is compatibility data the
  // shop cannot rebuild from memory.
  const fitments = await prisma.productFitment.count({
    where: { engine: { model: { makeId } } },
  });
  if (fitments > 0) {
    return {
      error: `${make.name} porte ${fitments} compatibilité(s) produit. Retirez-les d'abord — les supprimer ici effacerait des données que rien ne permet de reconstituer.`,
    };
  }

  await prisma.vehicleMake.delete({ where: { id: makeId } });
  const assetId = mediaAssetIdFromUrl(make.logoUrl);
  if (assetId) await prisma.mediaAsset.deleteMany({ where: { id: assetId } });

  revalidateVehicleSurfaces();
  return { ok: `${make.name} supprimée` };
}

export async function upsertModel(_prev: VehicleActionState, formData: FormData): Promise<VehicleActionState> {
  await assertAdmin();
  const id = nameOf(formData, "id");
  const makeId = nameOf(formData, "makeId");
  const name = nameOf(formData, "name");
  if (!makeId) return { error: "Marque manquante." };
  if (name.length < 1) return { error: "Le nom du modèle est vide." };

  const yearFrom = intOf(formData, "yearFrom");
  const yearTo = intOf(formData, "yearTo");
  const badYears = checkYears(yearFrom, yearTo);
  if (badYears) return { error: badYears };

  const slug = slugify(name);
  if (!slug) return { error: "Ce nom ne donne pas d'adresse utilisable." };

  const clash = await prisma.vehicleModel.findFirst({
    where: { makeId, OR: [{ name }, { slug }], ...(id ? { NOT: { id } } : {}) },
    select: { name: true },
  });
  if (clash) return { error: `« ${clash.name} » existe déjà pour cette marque.` };

  const data = { makeId, name, slug, yearFrom, yearTo };
  if (id) await prisma.vehicleModel.update({ where: { id }, data });
  else await prisma.vehicleModel.create({ data });

  revalidateVehicleSurfaces();
  return { ok: id ? `${name} mis à jour` : `${name} ajouté` };
}

export async function deleteModel(modelId: string): Promise<VehicleActionState> {
  await assertAdmin();
  const model = await prisma.vehicleModel.findUnique({ where: { id: modelId }, select: { name: true } });
  if (!model) return { error: "Modèle introuvable." };

  const fitments = await prisma.productFitment.count({ where: { engine: { modelId } } });
  if (fitments > 0) {
    return { error: `${model.name} porte ${fitments} compatibilité(s) produit. Retirez-les d'abord.` };
  }

  await prisma.vehicleModel.delete({ where: { id: modelId } });
  revalidateVehicleSurfaces();
  return { ok: `${model.name} supprimé` };
}

export async function upsertEngine(_prev: VehicleActionState, formData: FormData): Promise<VehicleActionState> {
  await assertAdmin();
  const id = nameOf(formData, "id");
  const modelId = nameOf(formData, "modelId");
  const name = nameOf(formData, "name");
  if (!modelId) return { error: "Modèle manquant." };
  if (name.length < 1) return { error: "Le nom de la motorisation est vide." };

  const yearFrom = intOf(formData, "yearFrom");
  const yearTo = intOf(formData, "yearTo");
  const badYears = checkYears(yearFrom, yearTo);
  if (badYears) return { error: badYears };

  const clash = await prisma.vehicleEngine.findFirst({
    where: { modelId, name, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  });
  if (clash) return { error: `« ${name} » existe déjà sur ce modèle.` };

  const data = {
    modelId,
    name,
    fuel: nameOf(formData, "fuel") || null,
    engineCode: nameOf(formData, "engineCode") || null,
    powerHp: intOf(formData, "powerHp"),
    displacementCc: intOf(formData, "displacementCc"),
    yearFrom,
    yearTo,
  };
  if (id) await prisma.vehicleEngine.update({ where: { id }, data });
  else await prisma.vehicleEngine.create({ data });

  revalidateVehicleSurfaces();
  return { ok: id ? `${name} mise à jour` : `${name} ajoutée` };
}

export async function deleteEngine(engineId: string): Promise<VehicleActionState> {
  await assertAdmin();
  const engine = await prisma.vehicleEngine.findUnique({
    where: { id: engineId },
    select: { name: true, _count: { select: { fitments: true } } },
  });
  if (!engine) return { error: "Motorisation introuvable." };
  if (engine._count.fitments > 0) {
    return { error: `${engine.name} porte ${engine._count.fitments} compatibilité(s) produit. Retirez-les d'abord.` };
  }

  await prisma.vehicleEngine.delete({ where: { id: engineId } });
  revalidateVehicleSurfaces();
  return { ok: `${engine.name} supprimée` };
}

/* -------------------------------------------------------------------------
   Which cars a part fits
   ------------------------------------------------------------------------- */

/**
 * Attach or detach a part from one engine.
 *
 * This is the data behind "compatible avec votre véhicule" on the storefront —
 * FitConfidence reads it, and a part with no fitment rows at all is shown as
 * unknown rather than incompatible, which is why an empty list is a legitimate
 * state and not something to paper over.
 *
 * Rows written here are VERIFIED: an admin ticking a box is saying they know,
 * which is a different claim from a row inferred from a shared reference.
 */
export async function setFitment(
  productId: string,
  engineId: string,
  fits: boolean,
): Promise<VehicleActionState> {
  await assertAdmin();
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { slug: true } });
  if (!product) return { error: "Produit introuvable." };

  if (fits) {
    await prisma.productFitment.upsert({
      where: { productId_engineId: { productId, engineId } },
      create: { productId, engineId, confidence: "VERIFIED", source: "admin" },
      update: { confidence: "VERIFIED", source: "admin" },
    });
  } else {
    await prisma.productFitment.deleteMany({ where: { productId, engineId } });
  }

  revalidatePath(`/admin/stock/${productId}`);
  revalidatePath(`/produit/${product.slug}`);
  revalidatePath("/", "layout");
  return { ok: fits ? "Compatibilité ajoutée" : "Compatibilité retirée" };
}

/** Every engine of one model at once — a part usually fits a whole model. */
export async function setModelFitment(
  productId: string,
  modelId: string,
  fits: boolean,
): Promise<VehicleActionState> {
  await assertAdmin();
  const engines = await prisma.vehicleEngine.findMany({ where: { modelId }, select: { id: true } });
  if (engines.length === 0) return { error: "Ce modèle n'a aucune motorisation." };

  if (fits) {
    await prisma.productFitment.createMany({
      data: engines.map((e) => ({ productId, engineId: e.id, confidence: "VERIFIED" as const, source: "admin" })),
      skipDuplicates: true,
    });
  } else {
    await prisma.productFitment.deleteMany({ where: { productId, engineId: { in: engines.map((e) => e.id) } } });
  }

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { slug: true } });
  revalidatePath(`/admin/stock/${productId}`);
  if (product) revalidatePath(`/produit/${product.slug}`);
  revalidatePath("/", "layout");
  return { ok: fits ? `${engines.length} motorisation(s) ajoutée(s)` : `${engines.length} retirée(s)` };
}
