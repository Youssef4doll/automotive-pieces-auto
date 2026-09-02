"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { readImageFile, mediaAssetIdFromUrl } from "@/lib/image-upload";

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

  const read = await readImageFile(file);
  if (!read.ok) return { error: read.error };

  const asset = await prisma.mediaAsset.create({
    data: { data: read.bytes, mimeType: read.mimeType },
    select: { id: true },
  });
  const logoUrl = `/api/images/${asset.id}`;

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
