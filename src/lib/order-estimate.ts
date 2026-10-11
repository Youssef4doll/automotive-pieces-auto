import { estimateDelivery, parseWindow, type DeliveryEstimate } from "@/lib/delivery-estimate";
import { GRAND_TUNIS } from "@/lib/governorates";
import type { SettingsMap } from "@/lib/settings";

/**
 * The delivery estimate for an order going to `governorate` now, from the
 * shop's settings (lib/delivery-estimate), or null: for a pickup, and
 * whenever the shop has not stated enough to promise a date.
 */
export function orderEstimate(
  settings: SettingsMap,
  governorate: string | null | undefined,
  method: "DELIVERY" | "PICKUP",
  now = new Date(),
): DeliveryEstimate | null {
  if (method !== "DELIVERY" || !governorate) return null;
  const delay = GRAND_TUNIS.has(governorate) ? settings.delivery_grand_tunis : settings.delivery_regions;
  return estimateDelivery({
    now,
    delay,
    cutoff: settings.delivery_cutoff,
    window: settings.delivery_window,
    days: settings.delivery_days,
  });
}

/** What an order stored, read back as the app's estimate — or null when no date was promised. */
export function storedEstimate(o: { estimatedFrom: Date | null; estimatedTo: Date | null; estimatedWindow: string | null }): DeliveryEstimate | null {
  if (!o.estimatedFrom || !o.estimatedTo) return null;
  return {
    from: o.estimatedFrom.toISOString().slice(0, 10),
    to: o.estimatedTo.toISOString().slice(0, 10),
    window: parseWindow(o.estimatedWindow),
  };
}
