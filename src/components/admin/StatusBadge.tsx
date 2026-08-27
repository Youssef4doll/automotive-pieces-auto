import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import type { OrderStatus } from "@prisma/client";

const COLORS: Record<OrderStatus, string> = {
  PENDING: "bg-gold-500/20 text-navy-900",
  CONFIRMED: "bg-gold-500/20 text-navy-900",
  PREPARED: "bg-gold-500/20 text-navy-900",
  SHIPPED: "bg-gold-500/20 text-navy-900",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`text-xs font-display font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${COLORS[status]}`}>
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}
