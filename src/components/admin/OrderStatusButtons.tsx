"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus } from "@/app/actions/admin";
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABEL } from "@/lib/order-status";
import type { OrderStatus } from "@prisma/client";

export default function OrderStatusButtons({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setStatus(next: OrderStatus) {
    startTransition(async () => {
      await updateOrderStatus(orderId, next);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {ORDER_STATUS_FLOW.map((s) => (
        <button
          key={s}
          disabled={pending}
          onClick={() => setStatus(s)}
          className={`px-3 py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wide border disabled:opacity-50 ${
            status === s
              ? "bg-gold-500 text-navy-950 border-gold-500"
              : "border-navy-900/15 text-navy-900/60 hover:border-navy-900/40"
          }`}
        >
          {ORDER_STATUS_LABEL[s]}
        </button>
      ))}
      <button
        disabled={pending}
        onClick={() => setStatus("CANCELLED")}
        className={`px-3 py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wide border disabled:opacity-50 ${
          status === "CANCELLED" ? "bg-red-500 text-white border-red-500" : "border-red-200 text-red-600 hover:border-red-500"
        }`}
      >
        Annuler
      </button>
    </div>
  );
}
