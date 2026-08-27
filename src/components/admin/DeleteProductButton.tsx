"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProduct } from "@/app/actions/admin";

export default function DeleteProductButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm("Supprimer ce produit ?")) return;
    startTransition(async () => {
      await deleteProduct(productId);
      router.refresh();
    });
  }

  return (
    <button
      onClick={onDelete}
      disabled={pending}
      className="text-xs font-display font-bold uppercase tracking-wide text-red-500 hover:underline disabled:opacity-50"
    >
      Supprimer
    </button>
  );
}
