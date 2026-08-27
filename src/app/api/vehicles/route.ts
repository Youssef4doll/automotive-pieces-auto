import { NextResponse } from "next/server";
import { getVehicleMakes } from "@/lib/data/catalog";

export async function GET() {
  const makes = await getVehicleMakes();
  return NextResponse.json(makes);
}
