import "server-only";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";
import { computeSegment } from "@/lib/segment";

/**
 * Attach guest orders to an account, given ids the caller has already
 * proven it holds — the website's order cookie, or the app's order tokens.
 * Never the e-mail on the order, which nobody verified.
 *
 * `userId: null` in the filter matters: an order that already belongs to
 * somebody is never reassigned, whatever proof the caller carries. The
 * customer segment is derived from order history, so it is recomputed.
 */
export async function claimOrderIds(userId: string, ids: string[]) {
  if (ids.length === 0) return 0;
  const { count } = await prisma.order.updateMany({
    where: { id: { in: ids }, userId: null },
    data: { userId },
  });
  if (count === 0) return 0;

  const orders = await prisma.order.findMany({
    where: { userId, status: { not: "CANCELLED" } },
    select: { total: true },
  });
  await prisma.user.update({
    where: { id: userId },
    data: {
      segment: computeSegment(
        orders.length,
        orders.reduce((sum, o) => sum + toNumber(o.total), 0),
      ),
    },
  });
  return count;
}
