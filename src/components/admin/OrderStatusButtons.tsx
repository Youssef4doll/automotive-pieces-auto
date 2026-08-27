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
          className={`px-3 py-2 rounded-lg text-xs font-semibold border disabled:opacity-50 ${
            status === s ? "bg-navy-900 text-white border-navy-900" : "border-gray-300 text-gray-600 hover:border-navy-500"
          }`}
        >
          {ORDER_STATUS_LABEL[s]}
        </button>
      ))}
      <button
        disabled={pending}
        onClick={() => setStatus("CANCELLED")}
        className={`px-3 py-2 rounded-lg text-xs font-semibold border disabled:opacity-50 ${
          status === "CANCELLED" ? "bg-red-600 text-white border-red-600" : "border-red-200 text-red-600 hover:border-red-500"
        }`}
      >
        Annuler
      </button>
    </div>
  );
}
