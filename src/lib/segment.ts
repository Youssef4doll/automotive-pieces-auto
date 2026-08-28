import type { CustomerSegment } from "@prisma/client";

// The `User.segment` column existed in the schema but nothing ever wrote to
// it after seed time — every customer showed whatever the seed script
// hardcoded (mostly "REGULAR"), forever, regardless of real order history.
// A customer with 19 real orders and ~2000 TND spent still read "REGULAR"
// next to a brand-new account. This is the one place segment is decided —
// both the live admin display and the write-back after each order call
// this, so they can't drift apart.
export function computeSegment(completedOrderCount: number, totalSpent: number): CustomerSegment {
  if (completedOrderCount === 0) return "NEW";
  if (completedOrderCount >= 5 || totalSpent >= 1000) return "VIP";
  return "REGULAR";
}
