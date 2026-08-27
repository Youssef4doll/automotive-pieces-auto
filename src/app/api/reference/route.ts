import { NextRequest, NextResponse } from "next/server";
import { findProductByReference } from "@/lib/data/catalog";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const product = await findProductByReference(q);
  if (!product) return NextResponse.json({ found: false });
  return NextResponse.json({ found: true, slug: product.slug, categorySlug: product.category.slug });
}
