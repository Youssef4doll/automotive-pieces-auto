import { NextRequest } from "next/server";
import { sweepLateOrders } from "@/lib/order-delays";

/**
 * Vercel's daily cron (vercel.json): tell the customers whose order will
 * miss its promised date, before they ask (lib/order-delays).
 *
 * Vercel signs its cron calls with `Authorization: Bearer $CRON_SECRET`.
 * Without that secret set, the route refuses everyone — an open URL that
 * texts customers is not something to leave lying around.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const told = await sweepLateOrders();
  return Response.json({ told: told.length });
}
