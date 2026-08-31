import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findProductByReference } from "@/lib/data/catalog";
import { hit, callerKey, LIMITS } from "@/lib/rate-limit";

// A part reference is short and alphanumeric. Bounding it here keeps an
// unbounded string out of the lookup and makes the endpoint useless as a way
// to probe the database with long or exotic input.
const querySchema = z.string().trim().min(2).max(64);

export async function GET(request: NextRequest) {
  // The one public endpoint that can be walked to enumerate the catalogue.
  const gate = hit(await callerKey("reference"), LIMITS.reference.limit, LIMITS.reference.windowMs);
  if (!gate.ok) {
    return NextResponse.json(
      { found: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
  }

  const parsed = querySchema.safeParse(request.nextUrl.searchParams.get("q") ?? "");
  if (!parsed.success) return NextResponse.json({ found: false });

  const product = await findProductByReference(parsed.data);
  if (!product) return NextResponse.json({ found: false });

  // Only what the caller needs to navigate — not the row.
  return NextResponse.json({
    found: true,
    slug: product.slug,
    categorySlug: product.category.slug,
  });
}
