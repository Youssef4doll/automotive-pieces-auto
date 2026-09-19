import { NextRequest } from "next/server";
import { z } from "zod";
import { listPickerEngines } from "@/lib/data/vehicles";
import { Cache, fail, guard, ok, preflight } from "../../_lib/respond";

const slug = z.string().trim().min(1).max(64);

const PUBLIC = { cache: Cache.catalogue, cors: true };

/**
 * The motorisations of one model — the last step before the app knows the car.
 *
 * Both slugs are required. A model slug is unique only within its make, so
 * asking for "clio-iv" without "renault" is a question with more than one
 * answer, and the endpoint refuses it rather than picking one.
 */
export async function GET(request: NextRequest) {
  return guard(async () => {
    const make = slug.safeParse(request.nextUrl.searchParams.get("make") ?? "");
    const model = slug.safeParse(request.nextUrl.searchParams.get("model") ?? "");
    if (!make.success || !model.success) return fail("bad_request", PUBLIC);

    const engines = await listPickerEngines(make.data, model.data);
    if (engines === null) return fail("not_found", PUBLIC);

    return ok(engines, PUBLIC);
  }, "vehicles/engines", PUBLIC);
}

export const OPTIONS = preflight;
