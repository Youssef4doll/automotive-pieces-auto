"use client";

import { useState } from "react";
import { useLocale } from "@/i18n/LocaleProvider";
import { useCart } from "@/lib/cart-store";
import { useVehicle, vehicleLabel } from "@/lib/vehicle-store";
import Price from "./Price";
import VehiclePicker from "./VehiclePicker";

export default function ProductActions({
  product,
}: {
  product: {
    id: string;
    slug: string;
    sku: string;
    name: string;
    imageUrl: string;
    priceSell: number;
    stockQty: number;
    fitmentEngineIds: string[];
  };
}) {
  const { t } = useLocale();
  const add = useCart((s) => s.add);
  const vehicle = useVehicle((s) => s.vehicle);
  const [qty, setQty] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [added, setAdded] = useState(false);

  const outOfStock = product.stockQty <= 0;
  const compatible = vehicle ? product.fitmentEngineIds.includes(vehicle.engineId) : null;

  function handleAdd() {
    add(
      {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        slug: product.slug,
        imageUrl: product.imageUrl,
        unitPrice: product.priceSell,
        stockQty: product.stockQty,
      },
      qty
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
        {compatible === true && (
          <p className="text-sm font-semibold text-green-700 flex items-center gap-1.5">
            ✓ {t("compat.compatible")} — {vehicleLabel(vehicle)}
          </p>
        )}
        {compatible === false && (
          <p className="text-sm font-medium text-amber-700 flex items-center gap-1.5">
            ? {vehicleLabel(vehicle)} — vérifiez la compatibilité
          </p>
        )}
        {compatible === null && (
          <p className="text-sm text-gray-600">{t("finder.notSet")}</p>
        )}
        <button
          onClick={() => setPickerOpen(true)}
          className="inline-flex items-center min-h-11 px-3 -ms-3 mt-0.5 rounded-lg text-xs font-semibold text-navy-900 underline underline-offset-2 hover:bg-navy-900/5 active:bg-navy-900/10 transition"
        >
          {vehicle ? t("finder.changeVehicle") : t("compat.check")}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center border border-gray-300 rounded-lg">
          <button
            className="w-10 h-11 text-lg font-bold text-gray-600"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
          >
            −
          </button>
          <span className="w-10 text-center font-semibold">{qty}</span>
          <button
            className="w-10 h-11 text-lg font-bold text-gray-600"
            onClick={() => setQty((q) => Math.min(product.stockQty || 99, q + 1))}
          >
            +
          </button>
        </div>
        <button
          disabled={outOfStock}
          onClick={handleAdd}
          className="flex-1 h-12 rounded-lg bg-gold-500 hover:bg-gold-400 disabled:bg-gray-300 text-navy-950 font-display font-bold uppercase tracking-wide text-sm sm:text-base"
        >
          {added ? (
            "✓ Ajouté"
          ) : (
            <>
              {t("product.addToCart")} · <Price value={product.priceSell * qty} />
            </>
          )}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full bg-green-50 text-green-700 border border-green-200">
          {t("trust.cod")}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full bg-gold-500/10 text-navy-900 border border-gold-500/40">
          {t("trust.exchange")}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full bg-gray-100 text-navy-900 border border-gray-200">
          {t("trust.warranty")}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full bg-gray-100 text-navy-900 border border-gray-200">
          {t("trust.returns")}
        </span>
      </div>

      {pickerOpen && <VehiclePicker onClose={() => setPickerOpen(false)} />}
    </div>
  );
}
