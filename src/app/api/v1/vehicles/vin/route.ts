import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeVinMakeSlug, isValidVinFormat } from "@/lib/vin";
import { Cache, fail, guard, ok, preflight } from "../../_lib/respond";

const PUBLIC = { cache: Cache.catalogue, cors: true };

/**
 * Which make a VIN belongs to — and nothing more, said plainly.
 *
 * `lib/vin.ts` recognises the World Manufacturer Identifier, the first three
 * characters, for the makes this shop stocks. That is all it does: it is not
 * a VIN decoder, which needs a paid data service, and this endpoint does not
 * pretend to be one. The model and the engine are still the customer's to
 * choose; the app says so on the screen.
 *
 * The make is looked up in the shop's own vehicle table before it is
 * returned, so the app is never sent to a make page that does not exist —
 * the WMI table can name a manufacturer the shop has no vehicle rows for.
 *
 * A malformed VIN is a 400; a well-formed one from a manufacturer the table
 * does not know is `{ make: null }`, which is an answer, not an error. The
 * VIN itself is not logged or stored.
 */
export async function GET(request: NextRequest) {
  return guard(
    async () => {
      const vin = (request.nextUrl.searchParams.get("vin") ?? "").trim().toUpperCase();
      if (!isValidVinFormat(vin)) return fail("bad_request", PUBLIC);

      const slug = decodeVinMakeSlug(vin);
      const make = slug
        ? await prisma.vehicleMake.findUnique({ where: { slug }, select: { id: true, name: true, slug: true } })
        : null;
      return ok({ make }, PUBLIC);
    },
    "vehicles/vin",
    PUBLIC,
  );
}

export const OPTIONS = preflight;
