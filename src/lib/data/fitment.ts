import "server-only";
import { prisma } from "@/lib/prisma";
import { engineFuelKind, needsOtherFuelWhere } from "@/lib/fitment-rules";
import { sameEngineCode } from "@/lib/fitment-verdict";

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

export type FitContext = {
  engineId: string;
  fuel: string | null;
  /** productId → confirmed elsewhere on this model / for the same engine code. */
  near: Map<string, { sameModel: boolean; sameCode: boolean }>;
};

/**
 * Everything the verdict needs beyond the part's own row for this engine,
 * for a page of parts in one query: VERIFIED rows on other engines of the
 * same model, or on engines with the same engine code and fuel.
 */
export async function fitContext(engineId: string | undefined, productIds: string[]): Promise<FitContext | undefined> {
  if (!engineId) return undefined;
  const engine = await prisma.vehicleEngine.findUnique({
    where: { id: engineId },
    select: { modelId: true, engineCode: true, fuel: true },
  });
  if (!engine) return { engineId, fuel: null, near: new Map() };
  const near = new Map<string, { sameModel: boolean; sameCode: boolean }>();
  if (productIds.length) {
    const rows = await prisma.productFitment.findMany({
      where: {
        productId: { in: productIds },
        confidence: "VERIFIED",
        engineId: { not: engineId },
        engine: {
          OR: [
            { modelId: engine.modelId },
            ...(engine.engineCode ? [{ engineCode: { not: null } }] : []),
          ],
        },
      },
      select: { productId: true, engine: { select: { modelId: true, engineCode: true, fuel: true } } },
    });
    const myKind = engineFuelKind(engine.fuel);
    for (const r of rows) {
      const cur = near.get(r.productId) ?? { sameModel: false, sameCode: false };
      if (r.engine.modelId === engine.modelId) cur.sameModel = true;
      if (sameEngineCode(r.engine.engineCode, engine.engineCode) && engineFuelKind(r.engine.fuel) === myKind) cur.sameCode = true;
      near.set(r.productId, cur);
    }
  }
  return { engineId, fuel: engine.fuel, near };
}
