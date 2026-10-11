import "server-only";
import { z } from "zod";
import { GOVERNORATES } from "@/lib/governorates";

/** How many addresses one account may keep. Enough for home, work, the garage and family. */
export const MAX_ADDRESSES = 10;

/**
 * An address as the app sends it (api/v1/account/addresses). Where a driver
 * goes, in the customer's words: the governorate (one of the 24), the
 * delegation, the street, a landmark, and the pin when they placed one —
 * inside Tunisia's own box, both coordinates or neither.
 */
export const addressBody = z
  .object({
    label: z.string().trim().min(1).max(40),
    governorate: z.enum(GOVERNORATES as unknown as [string, ...string[]]),
    delegation: z.string().trim().max(80).optional().or(z.literal("")),
    address: z.string().trim().min(5).max(300),
    landmark: z.string().trim().max(200).optional().or(z.literal("")),
    latitude: z.number().min(30).max(38).nullable().optional(),
    longitude: z.number().min(7).max(12).nullable().optional(),
  })
  .refine((a) => (a.latitude == null) === (a.longitude == null), { path: ["latitude"] });

export const ADDRESS_SELECT = {
  id: true,
  label: true,
  governorate: true,
  delegation: true,
  address: true,
  landmark: true,
  latitude: true,
  longitude: true,
  lastUsedAt: true,
} as const;

export function addressView(a: {
  id: string;
  label: string;
  governorate: string;
  delegation: string | null;
  address: string;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  lastUsedAt: Date | null;
}) {
  return {
    id: a.id,
    label: a.label,
    governorate: a.governorate,
    delegation: a.delegation,
    address: a.address,
    landmark: a.landmark,
    pin: a.latitude != null && a.longitude != null ? { lat: a.latitude, lng: a.longitude } : null,
    lastUsedAt: a.lastUsedAt?.toISOString() ?? null,
  };
}

/** The body's fields as columns: empty strings stored as null. */
export function addressData(a: z.infer<typeof addressBody>) {
  return {
    label: a.label,
    governorate: a.governorate,
    delegation: a.delegation || null,
    address: a.address,
    landmark: a.landmark || null,
    latitude: a.latitude ?? null,
    longitude: a.longitude ?? null,
  };
}
