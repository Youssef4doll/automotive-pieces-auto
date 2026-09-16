"use client";

import { useState } from "react";
import { useLocale } from "@/i18n/LocaleProvider";
import { useCart } from "@/lib/cart-store";
import { useVehicle, vehicleLabel } from "@/lib/vehicle-store";
import { contactLink, contactLinkProps } from "@/lib/contact-link";
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
    /** Whether the shop has recorded any compatibility for this part at all. */
    hasFitmentData: boolean;
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

  /**
   * Four states, and the fourth is the one this used to get wrong.
   *
   * "Not in the list" and "there is no list" are different facts, and only the
   * first of them means the part does not fit. A reference the shop has not
   * recorded any compatibility for was being shown as *ne correspond pas à
   * votre véhicule* — a claim about the part, made from the absence of data,
   * to every shopper with a car saved. It says what it actually knows now.
   *
   * This is also the only compatibility panel on the page. There used to be
   * two, one here and one above, each subscribing to the vehicle store and
   * each shipping its own copy of the picker; the shopper read the same
   * verdict twice and paid for it twice.
   */
  const fit: "fits" | "not-listed" | "no-data" | "no-vehicle" = !vehicle
    ? "no-vehicle"
    : product.fitmentEngineIds.includes(vehicle.engineId)
      ? "fits"
      : product.hasFitmentData
        ? "not-listed"
        : "no-data";

  const outOfStockHref = contactLink(
    { whatsapp, email: null },
    `${t("product.outOfStockMsg")} ${product.name} (${product.sku})`,
  );

  /** The shop's own channel, carrying the question already written out. */
  const askHref = contactLink(
    { whatsapp, email: null },
    `${t("compat.askMsg")} « ${product.name} » (${t("product.ref")} ${product.sku})${
      vehicle ? ` — ${vehicleLabel(vehicle)}` : ""
    } ?`,
  );

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
      {/* One panel, four states, one place to change the car. */}
      {fit === "fits" && (
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

      {fit === "not-listed" && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 sm:p-4">
          <div className="flex items-center gap-3">
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
          {/* Not a dead end: the part may still suit a version the catalogue
              does not list, and a person here can say so from a carte grise. */}
          <p className="text-xs text-amber-800/80 mt-2">{t("compat.notListedHelp")}</p>
          <a
            href={askHref}
            {...contactLinkProps(askHref)}
            onClick={() => track("whatsapp_clicked", { source: "product_fit_check", sku: product.sku })}
            className="mt-2 inline-flex items-center min-h-tap-compact px-3 rounded-lg bg-green-700 hover:bg-green-800 text-white text-xs font-semibold"
          >
            {t("compat.askCheck")}
          </a>
        </div>
      )}

      {fit === "no-data" && (
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-3.5 sm:p-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-heading font-extrabold uppercase text-navy-950 text-sm sm:text-[15px] tracking-tight leading-tight">
                {t("compat.noData")}
              </p>
              <p className="text-xs text-gray-600 mt-0.5 truncate">{vehicleLabel(vehicle)}</p>
            </div>
            <button
              onClick={() => setPickerOpen(true)}
              className="shrink-0 self-stretch flex items-center text-xs font-semibold text-gray-500 hover:text-navy-950 underline underline-offset-2 px-1"
            >
              {t("hero.changeVehicle")}
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-2">{t("compat.noDataHelp")}</p>
          <a
            href={askHref}
            {...contactLinkProps(askHref)}
            onClick={() => track("whatsapp_clicked", { source: "product_fit_unknown", sku: product.sku })}
            className="mt-2 inline-flex items-center min-h-tap-compact px-3 rounded-lg bg-green-700 hover:bg-green-800 text-white text-xs font-semibold"
          >
            {t("compat.askCheck")}
          </a>
        </div>
      )}

      {/* The ask, where the decision is made.
          This used to read "Non renseigné" beside a button — a status line
          about a form field, at the exact moment somebody is deciding whether
          to spend money. It asks the question instead, and says what
          answering it will get them, which differs depending on whether this
          part has any compatibility data to check against. */}
      {fit === "no-vehicle" && (
        <div className="rounded-xl bg-navy-50/60 border border-navy-900/15 p-3.5 sm:p-4">
          <p className="font-heading font-extrabold uppercase text-navy-950 text-sm sm:text-[15px] tracking-tight leading-tight">
            {t("compat.askTitle")}
          </p>
          <p className="text-xs text-gray-600 mt-0.5 mb-2.5">
            {product.hasFitmentData ? t("compat.askHintListed") : t("compat.askHintUnlisted")}
          </p>
          <button
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-2 min-h-tap px-4 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-display font-bold uppercase text-xs tracking-wide"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 17h14M4 17v-4.2L6 7h12l2 5.8V17" />
              <path d="M4 17v2h3v-2M17 17v2h3v-2" />
              <circle cx="7.5" cy="13.5" r=".8" />
              <circle cx="16.5" cy="13.5" r=".8" />
            </svg>
            {t("compat.pickVehicle")}
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
          {/* Built through contactLink, which falls back to e-mail and then to
              the store section. The hand-rolled URL this replaces became
              `https://wa.me/null?text=…` on a shop that had not entered a
              number — a dead end offered as the only way out of one. */}
          <a
            href={outOfStockHref}
            {...contactLinkProps(outOfStockHref)}
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
