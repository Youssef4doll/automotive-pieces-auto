import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DEFAULT_SETTINGS, getSettings, isPlaceholder, updateSettings, type SettingsMap } from "@/lib/settings";
import { fail, ok, preflightWrite, readJson } from "../../_lib/respond";
import { ADMIN, asAdmin } from "../_lib/admin";

/**
 * The shop's own facts — the same keys as /admin/parametres, written through
 * the same updateSettings (known keys only, 500 characters each). Each value
 * comes with whether it is still the flagged placeholder, so the app can say
 * "à compléter" instead of printing a fake phone number back at the owner as
 * if it were theirs.
 */
export const OPTIONS = preflightWrite;

const KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof SettingsMap)[];

async function snapshot() {
  const s = await getSettings();
  return KEYS.map((key) => ({ key, value: s[key], placeholder: isPlaceholder(s[key]) }));
}

export async function GET(request: Request) {
  return asAdmin(request, "settings", async () => ok(await snapshot(), ADMIN));
}

const patch = z.record(z.string(), z.string().max(500));

export async function PATCH(request: Request) {
  return asAdmin(request, "settings PATCH", async () => {
    const parsed = patch.safeParse(await readJson(request, 16_384));
    if (!parsed.success) return fail("bad_request", ADMIN);
    const unknown = Object.keys(parsed.data).find((k) => !(k in DEFAULT_SETTINGS));
    if (unknown) return fail("invalid_field", ADMIN, undefined, { field: unknown });
    await updateSettings(parsed.data as Partial<SettingsMap>);
    revalidatePath("/admin/parametres");
    revalidatePath("/", "layout");
    return ok(await snapshot(), ADMIN);
  });
}
