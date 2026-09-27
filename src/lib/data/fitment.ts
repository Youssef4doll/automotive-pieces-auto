import "server-only";
import { prisma } from "@/lib/prisma";
import { engineFuelKind, needsOtherFuelWhere } from "@/lib/fitment-rules";

/** The chosen engine's fuel, once per request that has an engine. */
export async function engineFuelOf(engineId?: string): Promise<string | null> {
  if (!engineId) return null;
  const e = await prisma.vehicleEngine.findUnique({ where: { id: engineId }, select: { fuel: true } });
  return e?.fuel ?? null;
}

/**
 * The `where` for "confirmed to fit this engine": a VERIFIED row for it —
 * a DERIVED row is a lead, not a confirmation — and not a part that needs
 * the other fuel, whatever a row says (lib/fitment-rules).
 */
export function confirmedFitWhere(engineId: string, fuel: string | null) {
  const kind = engineFuelKind(fuel);
  return {
    fitments: { some: { engineId, confidence: "VERIFIED" as const } },
    ...(kind ? { NOT: needsOtherFuelWhere(kind) } : {}),
  };
}
