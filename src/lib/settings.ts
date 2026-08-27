import { prisma } from "@/lib/prisma";

// Site-wide settings the admin can edit from /admin/parametres.
// Anything not yet filled in by the shop owner is a clearly flagged
// placeholder so it can never ship silently wrong.
export const DEFAULT_SETTINGS = {
  shop_name: "Automotive Pièces Auto",
  shop_address: "⚠ Adresse à compléter",
  shop_phone: "⚠ +216 00 000 000 (à compléter)",
  shop_whatsapp: "21600000000",
  shop_email: "⚠ contact@à-completer.tn",
  shop_hours: "Lun–Sam · 8h30–18h30",
  free_shipping_threshold: "150",
  delivery_grand_tunis: "24h",
  delivery_regions: "48–72h",
};

export type SettingsMap = typeof DEFAULT_SETTINGS;

export async function getSettings(): Promise<SettingsMap> {
  const rows = await prisma.setting.findMany();
  const map = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.key in map) {
      (map as Record<string, string>)[row.key] = row.value;
    }
  }
  return map;
}

export async function updateSettings(patch: Partial<SettingsMap>) {
  const entries = Object.entries(patch) as [string, string][];
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      })
    )
  );
}

export function isPlaceholder(value: string) {
  return value.includes("à compléter") || value.includes("à-completer");
}
