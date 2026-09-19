"use client";

import { useState } from "react";
import { useLocale } from "@/i18n/LocaleProvider";
import { useCart } from "@/lib/cart-store";
import { useVehicle, vehicleLabel } from "@/lib/vehicle-store";
import { contactLink, contactLinkProps } from "@/lib/contact-link";
import Price from "./Price";
import VehiclePicker from "./VehiclePicker";
import StickyBuyBar from "./product/StickyBuyBar";
import { track } from "@/lib/track";
import { availabilityView, type SupplyMode } from "@/lib/availability";
import { IconAlert, IconCar } from "@/components/icons";

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
    /** What an empty shelf means for this part — see lib/availability. */
    supply: SupplyMode;
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

  // Three answers, not two. An empty shelf is usually a delay at this shop,
  // not a refusal, and the page used to take the buy button away for both.
  const avail = availabilityView(product);
  /** Set once the shopper has been shown the mismatch and pressed on anyway. */
  const [confirmedMismatch, setConfirmedMismatch] = useState(false);
  const [askingConfirm, setAskingConfirm] = useState(false);

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

  /**
   * `force` is not a convenience: it is the only way the confirm button can
   * work.
   *
   * That button sets `confirmedMismatch` and calls this in the same handler,
   * and a `useState` setter does not change the value the current closure is
   * reading — so the check below saw `false`, returned early, and the panel
   * re-opened on itself. "Ajouter quand même" added nothing, every time.
   */
  function handleAdd(force = false): boolean {
    // A part the shop's own data says is not for this car does not go into a
    // basket on one tap. It asks first — once, inline, with the free check
    // offered beside it. This is the narrow case: `not-listed` means the part
    // HAS fitment data and this engine is not in it. `no-data` keeps the
    // ordinary button, because "we have not checked" is not "it does not fit",
    // and gating on that would put a warning on most of the catalogue.
    if (fit === "not-listed" && !confirmedMismatch && !force) {
      setAskingConfirm(true);
      return false;
    }
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
    setAskingConfirm(false);
    setTimeout(() => setAdded(false), 1500);
    return true;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* A part nobody can supply any more is the only one with no button.
          Everything else is buyable — including a part with nothing on the
          shelf, which this shop orders in. The page used to replace the
          button with a WhatsApp link for both cases, which turned a sale the
          shop wanted into a message it had to chase. */}
      {avail.buyable ? (
        <>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-lg border border-gray-300">
              <button
                className="w-tap h-tap text-lg font-bold text-gray-600"
                aria-label={t("cart.decrease")}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                −
              </button>
              <span className="w-10 text-center font-semibold">{qty}</span>
              {/* stockQty 0 is not a cap of zero: it is a part that is
                  ordered in, and the store has always read it that way. */}
              <button
                className="w-tap h-tap text-lg font-bold text-gray-600"
                aria-label={t("cart.increase")}
                onClick={() => setQty((q) => Math.min(product.stockQty || 99, q + 1))}
              >
                +
              </button>
            </div>
            <button
              // Wrapped, not passed by reference: `onClick={handleAdd}` hands
              // the click event in as `force`, and an event object is truthy.
              onClick={() => handleAdd()}
              className="min-h-tap-primary flex-1 rounded-lg bg-gold-500 font-display text-sm font-bold uppercase tracking-wide text-navy-950 transition-transform hover:bg-gold-400 active:scale-[0.98] sm:text-base"
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

          {askingConfirm && (
            <div
              role="alertdialog"
              aria-label={t("compat.notListedTitle")}
              // Brought into view when it appears, because the tap that opens
              // it can come from the sticky bar at the bottom of a phone — and
              // a question asked off screen reads as a button that did
              // nothing. `nearest` so the inline button, where the panel is
              // already visible, does not jump the page.
              ref={(el) => el?.scrollIntoView({ block: "nearest", behavior: "smooth" })}
              className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4"
            >
              <p className="flex items-start gap-2 text-sm font-semibold text-amber-900">
                <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {t("compat.notListedTitle")}
              </p>
              <p className="text-xs leading-relaxed text-amber-900/80">{t("compat.notListedBody")}</p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={askHref}
                  {...contactLinkProps(askHref)}
                  className="inline-flex min-h-tap items-center rounded-lg bg-navy-950 px-4 font-display text-xs font-bold uppercase tracking-wide text-white hover:bg-navy-800"
                >
                  {t("compat.askCheck")}
                </a>
                {/* Secondary on purpose. The shopper may well be right — they
                    can see the part in their hand and we cannot — so the door
                    stays open, just not on the way past. */}
                <button
                  onClick={() => {
                    setConfirmedMismatch(true);
                    setAskingConfirm(false);
                    handleAdd(true);
                  }}
                  className="inline-flex min-h-tap items-center rounded-lg border border-amber-400 px-4 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                >
                  {t("compat.addAnyway")}
                </button>
              </div>
            </div>
          )}

          {/* Rendered here so its sentinel sits directly under the real
              button — the bar appears exactly when that button leaves. */}
          <StickyBuyBar product={product} label={avail.label} onAdd={() => handleAdd()} />
        </>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-navy-900">{avail.label}</p>
          <p className="text-xs text-gray-600">{avail.detail}</p>
          <a
            href={outOfStockHref}
            {...contactLinkProps(outOfStockHref)}
            onClick={() => track("whatsapp_clicked", { source: "product_unavailable", sku: product.sku })}
            className="flex min-h-tap-primary items-center justify-center gap-2 rounded-lg bg-green-700 font-display text-sm font-bold uppercase tracking-wide text-white hover:bg-green-800"
          >
            {t("product.checkAvailability")}
          </a>
        </div>
      )}

      {/* Buy first, then the vehicle check — the order the reference pages
          use, and the reason is measured: this panel is ~197px tall, and with
          it above the button on a phone the button landed 1.43 screens down,
          so the one action the page exists for was never on the first screen.
          Compatibility is still answered above the fold, by the "Compatible
          avec …" line under the name; this is where a shopper confirms it
          against their own car, which is a thing they do after deciding they
          want the part. */}
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
            <IconCar className="h-[17px] w-[17px]" />
            {t("compat.pickVehicle")}
          </button>
        </div>
      )}

      {pickerOpen && <VehiclePicker onClose={() => setPickerOpen(false)} />}
    </div>
  );
}
