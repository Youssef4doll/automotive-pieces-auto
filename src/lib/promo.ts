import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";
import { hit, LIMITS, peek } from "@/lib/rate-limit";
import { normalizeCode, promoVerdict, type PromoRow, type PromoVerdict } from "@/lib/promo-rules";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * A code, looked up and judged against a basket — for the cart quote and for
 * the order, which is why both call this and neither works a discount out on
 * its own.
 *
 * `lock` is for the order: it takes the code's row FOR UPDATE inside the
 * order's transaction, so two customers spending the last use of a
 * "50 premières commandes" code at the same second cannot both get it — the
 * second waits, then counts the first one's order.
 */
export async function judgePromo(
  raw: string,
  subtotal: number,
  opts: { db?: Db; lock?: boolean; now?: Date; missKey?: string } = {},
): Promise<PromoVerdict & { id?: string }> {
  const db = opts.db ?? prisma;
  const code = normalizeCode(raw);
  if (!code) return { ok: false, reason: "unknown" };
  // A caller who has typed ten codes that do not exist is guessing; the
  // eleventh is not even looked up. Only misses are charged — see LIMITS.
  if (opts.missKey && !peek(opts.missKey, LIMITS.promoMiss.limit).ok) return { ok: false, reason: "too_many" };
  const verdict = await judge(db, code, subtotal, opts);
  if (opts.missKey && !verdict.ok && verdict.reason === "unknown") hit(opts.missKey, LIMITS.promoMiss.limit, LIMITS.promoMiss.windowMs);
  return verdict;
}

async function judge(db: Db, code: string, subtotal: number, opts: { lock?: boolean; now?: Date }): Promise<PromoVerdict & { id?: string }> {
  if (opts.lock) await db.$queryRaw`SELECT id FROM "PromoCode" WHERE code = ${code} FOR UPDATE`;
  const row = await db.promoCode.findUnique({ where: { code } });
  if (!row) return { ok: false, reason: "unknown" };
  const uses = row.maxUses == null ? 0 : await db.order.count({ where: { promoCodeId: row.id, status: { not: "CANCELLED" } } });
  const promo: PromoRow = {
    code: row.code,
    kind: row.kind,
    value: toNumber(row.value),
    minSubtotal: row.minSubtotal == null ? null : toNumber(row.minSubtotal),
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    maxUses: row.maxUses,
    active: row.active,
  };
  const verdict = promoVerdict(promo, subtotal, uses, opts.now ?? new Date());
  return verdict.ok ? { ...verdict, id: row.id } : verdict;
}
