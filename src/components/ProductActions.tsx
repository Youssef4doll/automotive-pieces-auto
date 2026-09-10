"use client";

import { useState } from "react";
import { useLocale } from "@/i18n/LocaleProvider";
import { useCart } from "@/lib/cart-store";
import { useVehicle, vehicleLabel } from "@/lib/vehicle-store";
import Price from "./Price";
import VehiclePicker from "./VehiclePicker";
import { track } from "@/lib/track";

export default function ProductActions({
  product,
  whatsapp,
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
  whatsapp: string | null;
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
      {compatible === true && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-3.5 sm:p-4 flex items-center gap-3">
          <span className="shrink-0 w-8 h-8 rounded-full bg-green-700 text-white flex items-center justify-center motion-safe:animate-[check-pop_450ms_ease-out]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading font-extrabold uppercase text-green-800 text-sm sm:text-[15px] tracking-tight leading-tight">
              {t("compat.fitsYourCar")}
            </p>
            <p className="text-xs text-green-700/75 mt-0.5 truncate">{vehicleLabel(vehicle)}</p>
          </div>
          <button
            onClick={() => setPickerOpen(true)}
            className="shrink-0 self-stretch flex items-center text-xs font-semibold text-green-800/60 hover:text-green-800 underline underline-offset-2 px-1"
          >
            {t("hero.changeVehicle")}
          </button>
        </div>
      )}
      {compatible === false && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 sm:p-4 flex items-center gap-3">
          <span className="shrink-0 w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-extrabold text-sm">
            !
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading font-extrabold uppercase text-amber-800 text-sm sm:text-[15px] tracking-tight leading-tight">
              {t("compat.doesntMatch")}
            </p>
            <p className="text-xs text-amber-700/75 mt-0.5 truncate">{vehicleLabel(vehicle)}</p>
          </div>
          <button
            onClick={() => setPickerOpen(true)}
            className="shrink-0 self-stretch flex items-center text-xs font-semibold text-amber-800/60 hover:text-amber-800 underline underline-offset-2 px-1"
          >
            {t("hero.changeVehicle")}
          </button>
        </div>
      )}
      {compatible === null && (
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-3.5 sm:p-4 flex items-center gap-3">
          <p className="text-sm text-gray-600 flex-1">{t("finder.notSet")}</p>
          <button
            onClick={() => setPickerOpen(true)}
            className="shrink-0 px-4 min-h-11 rounded-lg bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold uppercase tracking-wide"
          >
            {t("compat.check")}
          </button>
        </div>
      )}

      {/* Out of stock is not a dead end. A disabled button leaves the customer
          with nowhere to go; here the expert channel becomes the primary
          action instead, which is also the one case where WhatsApp should
          outrank "add to cart". */}
      {outOfStock ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-navy-900">{t("product.outOfStockTitle")}</p>
          <p className="text-xs text-gray-600">{t("product.outOfStockHelp")}</p>
          <a
            href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(
              `${t("product.outOfStockMsg")} ${product.name} (${product.sku})`
            )}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => track("whatsapp_clicked", { source: "product_out_of_stock", sku: product.sku })}
            className="flex items-center justify-center gap-2 min-h-tap-primary rounded-lg bg-green-700 hover:bg-green-800 text-white font-display font-bold uppercase tracking-wide text-sm"
          >
            {t("product.checkAvailability")}
          </a>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-gray-300 rounded-lg">
            <button
              className="w-tap h-tap text-lg font-bold text-gray-600"
              aria-label={t("cart.decrease")}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
            >
              −
            </button>
            <span className="w-10 text-center font-semibold">{qty}</span>
            <button
              className="w-tap h-tap text-lg font-bold text-gray-600"
              aria-label={t("cart.increase")}
              onClick={() => setQty((q) => Math.min(product.stockQty || 99, q + 1))}
            >
              +
            </button>
          </div>
          <button
            onClick={handleAdd}
            className="flex-1 min-h-tap-primary rounded-lg bg-gold-500 hover:bg-gold-400 active:scale-[0.98] transition-transform text-navy-950 font-display font-bold uppercase tracking-wide text-sm sm:text-base"
          >
            {added ? (
              `✓ ${t("product.added")}`
            ) : (
              <>
                {t("product.addToCart")} · <Price value={product.priceSell * qty} />
              </>
            )}
          </button>
        </div>
      )}

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
