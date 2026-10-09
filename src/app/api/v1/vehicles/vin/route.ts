import { NextRequest } from "next/server";
import { identifyVin } from "@/lib/data/vin";
import { isValidVinFormat } from "@/lib/vin";
import { Cache, fail, guard, ok, preflight } from "../../_lib/respond";

const PUBLIC = { cache: Cache.catalogue, cors: true };

/**
 * What a VIN says, answered with the shop's own catalogue (lib/data/vin).
 *
 * `make` as before — the app's older builds read only that. Then the model
 * year where the maker writes it, the shop's models the VIN points to, and,
 * with one model, its engines to choose from. The VIN names the model for
 * the Volkswagen group; for other makers the public NHTSA decoder is asked
 * (lib/vin-online), and for a car it does not know only the make comes
 * back. The engine is always the customer's tap: nothing is saved here.
 *
 * A malformed VIN is a 400; a well-formed one from a manufacturer the shop
 * does not list is `{ make: null }`, which is an answer, not an error. The
 * VIN itself is not logged or stored.
 */
export async function GET(request: NextRequest) {
  return guard(
    async () => {
      const vin = (request.nextUrl.searchParams.get("vin") ?? "").trim().toUpperCase();
      if (!isValidVinFormat(vin)) return fail("bad_request", PUBLIC);

      return ok(await identifyVin(vin), PUBLIC);
    },
    "vehicles/vin",
    PUBLIC,
  );
}

export const OPTIONS = preflight;
