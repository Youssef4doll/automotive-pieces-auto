import { NextRequest } from "next/server";
import { z } from "zod";
import { listPickerModels } from "@/lib/data/vehicles";
import { Cache, fail, guard, ok, preflight } from "../../_lib/respond";

// A slug, bounded, so an unbounded string never reaches the query.
const slug = z.string().trim().min(1).max(64);

const PUBLIC = { cache: Cache.catalogue, cors: true };

/**
 * The models of one make.
 *
 * Keyed by the make's slug rather than its id: a slug is the same value the
 * website puts in its own URLs, it survives a database restore, and it is
 * readable in a bug report from a shopper.
 */
export async function GET(request: NextRequest) {
  return guard(async () => {
    const parsed = slug.safeParse(request.nextUrl.searchParams.get("make") ?? "");
    if (!parsed.success) return fail("bad_request", PUBLIC);

    const models = await listPickerModels(parsed.data);
    // A make that does not exist is a 404. A make with no models recorded is
    // an empty list with a 200 — the screen has something true to say about
    // each and they are not the same sentence.
    if (models === null) return fail("not_found", PUBLIC);

    return ok(models, PUBLIC);
  }, "vehicles/models", PUBLIC);
}

export const OPTIONS = preflight;
