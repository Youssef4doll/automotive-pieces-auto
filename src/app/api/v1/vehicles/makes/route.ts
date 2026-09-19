import { listPickerMakes } from "@/lib/data/vehicles";
import { Cache, guard, ok, preflight } from "../../_lib/respond";

/**
 * Every manufacturer the shop has vehicle data for, alphabetical.
 *
 * `partCount` is how many distinct active parts have a recorded fitment
 * against one of this make's engines. It is a fact about the catalogue, never
 * a popularity figure, and a make with a count of zero is still returned: the
 * picker's job is to find out what the customer drives, and a shop whose
 * fitment table is thin would otherwise offer a list of four cars.
 */
const PUBLIC = { cache: Cache.catalogue, cors: true };

export async function GET() {
  return guard(async () => ok(await listPickerMakes(), PUBLIC), "vehicles/makes", PUBLIC);
}

export const OPTIONS = preflight;
