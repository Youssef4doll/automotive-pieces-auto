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
  // Only keys the application actually reads. The caller is already an
  // authenticated admin, but a settings form that writes whatever key it is
  // handed turns one bad form post into arbitrary rows in a table the whole
  // site reads from.
  const entries = (Object.entries(patch) as [string, string][]).filter(
    ([key, value]) => key in DEFAULT_SETTINGS && typeof value === "string" && value.length <= 500,
  );
  if (entries.length === 0) return;
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
  const v = value.trim();
  if (!v) return true;
  if (v.includes("à compléter") || v.includes("à-completer")) return true;
  // The default WhatsApp number carries no "à compléter" marker but is just as
  // fake: a run of zeros is nobody's phone number.
  if (/^\+?[\s0]*$/.test(v.replace(/[()\-.]/g, ""))) return true;
  if (v.replace(/\D/g, "") === DEFAULT_SETTINGS.shop_whatsapp) return true;
  return false;
}

/** A setting the owner has actually filled in, or null. */
function filled(value: string | undefined) {
  const v = (value ?? "").trim();
  return !v || isPlaceholder(v) ? null : v;
}

/**
 * Shop contact details as the public site may show them.
 *
 * Anything the owner has not filled in comes back as `null` so the storefront
 * can omit that row entirely. Printing "⚠ Adresse à compléter" to a customer
 * reads as a broken site, and inventing a phone number to fill the gap would be
 * worse — an unanswered number costs a sale and the trust behind it. The
 * warnings belong in /admin/parametres, where somebody can act on them.
 */
export function publicContact(settings: SettingsMap) {
  return {
    name: settings.shop_name,
    phone: filled(settings.shop_phone),
    email: filled(settings.shop_email),
    address: filled(settings.shop_address),
    whatsapp: filled(settings.shop_whatsapp),
    hours: filled(settings.shop_hours),
  };
}

export type PublicContact = ReturnType<typeof publicContact>;

/** Re-exported so server components have one import for settings + links. */
export { contactLink as contactHref, isExternalContact, contactLinkProps } from "@/lib/contact-link";

/** Which public-facing details are still unset — shown to the admin only. */
export function missingContactFields(settings: SettingsMap) {
  const c = publicContact(settings);
  const missing: string[] = [];
  if (!c.phone) missing.push("Téléphone");
  if (!c.whatsapp) missing.push("WhatsApp");
  if (!c.email) missing.push("Email de contact");
  if (!c.address) missing.push("Adresse");
  return missing;
}
