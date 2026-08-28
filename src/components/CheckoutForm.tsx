"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/i18n/LocaleProvider";
import { useCart, cartSubtotal } from "@/lib/cart-store";
import Price from "./Price";
import { GOVERNORATES, GRAND_TUNIS } from "@/lib/governorates";
import { placeOrder } from "@/app/actions/orders";
import { track } from "@/lib/track";
import { getAttribution } from "@/lib/attribution";

export default function CheckoutForm({
  freeShippingThreshold,
  deliveryGrandTunis,
  deliveryRegions,
}: {
  freeShippingThreshold: number;
  deliveryGrandTunis: string;
  deliveryRegions: string;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const subtotal = cartSubtotal(items);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [governorate, setGovernorate] = useState("Tunis");
  const [address, setAddress] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "CARD">("COD");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGrandTunis = GRAND_TUNIS.has(governorate);
  const shippingFee = deliveryMethod === "PICKUP" ? 0 : subtotal >= freeShippingThreshold ? 0 : 8;
  const total = subtotal + shippingFee;
  const estimate = deliveryMethod === "PICKUP" ? "2h" : isGrandTunis ? deliveryGrandTunis : deliveryRegions;

  // items.length, not [] — the cart is a zustand `persist` store, so on
  // first paint it's still empty until localStorage rehydrates a moment
  // later. Firing this on an empty `[]`-effect raced that hydration and
  // silently dropped the event for real checkouts (caught via the
  // analytics dashboard itself: checkout_started read 0 while
  // checkout_completed read 1 — an impossible funnel). The ref keeps it
  // to exactly one fire even though the effect can now re-run.
  const trackedStart = useRef(false);
  useEffect(() => {
    if (items.length > 0 && !trackedStart.current) {
      trackedStart.current = true;
      track("checkout_started", { itemCount: items.length, subtotal });
    }
  }, [items.length, subtotal]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (items.length === 0) return;
    setSubmitting(true);
    const attribution = getAttribution();
    const result = await placeOrder({
      customerName: name,
      phone,
      email: email || undefined,
      governorate,
      address: deliveryMethod === "DELIVERY" ? address : undefined,
      deliveryMethod,
      paymentMethod,
      notes: notes || undefined,
      items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
      source: attribution?.source,
      medium: attribution?.medium,
      campaign: attribution?.campaign ?? undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      track("checkout_failed", { error: result.error });
      return;
    }
    track("checkout_completed", { ref: result.ref, total, itemCount: items.length });
    clear();
    router.push(`/commande/confirmation/${result.ref}`);
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-gray-600 font-medium mb-6">{t("cart.empty")}</p>
        <Link href="/" className="px-5 py-3 rounded-lg bg-navy-900 text-white font-semibold">
          {t("cart.continue")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-xl sm:text-2xl font-extrabold text-navy-950 mb-6">{t("checkout.title")}</h1>

      <form onSubmit={submit} className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 flex flex-col gap-6">
          <fieldset className="flex flex-col gap-3">
            <h2 className="font-bold text-navy-900">{t("checkout.contact")}</h2>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder={t("checkout.name")} className="px-3 py-3 border border-gray-300 rounded-lg text-sm" />
            <input required dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder={t("checkout.phone")} className="px-3 py-3 border border-gray-300 rounded-lg text-sm" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder={t("checkout.email")} className="px-3 py-3 border border-gray-300 rounded-lg text-sm" />
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <h2 className="font-bold text-navy-900">{t("checkout.deliveryMethod")}</h2>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setDeliveryMethod("DELIVERY")} className={`p-3 rounded-lg border-2 text-start ${deliveryMethod === "DELIVERY" ? "border-navy-900 bg-navy-50" : "border-gray-200"}`}>
                <p className="font-semibold text-sm">{t("checkout.delivery")}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  <bdi dir="ltr">{isGrandTunis ? deliveryGrandTunis : deliveryRegions}</bdi> ·{" "}
                  {subtotal >= freeShippingThreshold ? t("cart.free") : <Price value={8} />}
                </p>
              </button>
              <button type="button" onClick={() => setDeliveryMethod("PICKUP")} className={`p-3 rounded-lg border-2 text-start ${deliveryMethod === "PICKUP" ? "border-navy-900 bg-navy-50" : "border-gray-200"}`}>
                <p className="font-semibold text-sm">{t("checkout.pickup")}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t("checkout.pickupFree")}</p>
              </button>
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <h2 className="font-bold text-navy-900">{t("checkout.governorate")}</h2>
            <div className="flex flex-wrap gap-2">
              {GOVERNORATES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGovernorate(g)}
                  className={`px-3 py-2.5 rounded-full text-xs font-medium border ${governorate === g ? "bg-navy-900 text-white border-navy-900" : "border-gray-300 text-gray-600"}`}
                >
                  {g}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              {t("checkout.estimate")}: <strong dir="ltr">{estimate}</strong>
            </p>
            {deliveryMethod === "DELIVERY" && (
              <input required value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("checkout.address")} className="px-3 py-3 border border-gray-300 rounded-lg text-sm" />
            )}
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <h2 className="font-bold text-navy-900">{t("checkout.payment")}</h2>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setPaymentMethod("COD")} className={`p-3 rounded-lg border-2 text-start ${paymentMethod === "COD" ? "border-navy-900 bg-navy-50" : "border-gray-200"}`}>
                <p className="font-semibold text-sm">💳 {t("checkout.cod")}</p>
              </button>
              <button type="button" disabled className="p-3 rounded-lg border-2 border-gray-100 text-start opacity-50 cursor-not-allowed">
                <p className="font-semibold text-sm">{t("checkout.card")}</p>
                <p className="text-xs text-gray-400">{t("checkout.cardSoon")}</p>
              </button>
            </div>
          </fieldset>

          <fieldset>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("checkout.notes")} className="w-full px-3 py-3 border border-gray-300 rounded-lg text-sm" rows={2} />
          </fieldset>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 bg-white h-fit flex flex-col gap-3 sticky top-24">
          <h2 className="font-bold text-navy-900">{t("cart.title")}</h2>
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
            {items.map((i) => (
              <div key={i.productId} className="flex justify-between text-sm">
                <span className="text-gray-600 truncate pe-2">{i.qty}× {i.name}</span>
                <span className="font-medium whitespace-nowrap"><Price value={i.unitPrice * i.qty} /></span>
              </div>
            ))}
          </div>
          <div className="border-t pt-2 flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>{t("cart.subtotal")}</span>
              <Price value={subtotal} />
            </div>
            <div className="flex justify-between text-gray-600">
              <span>{t("cart.shipping")}</span>
              <span>{shippingFee === 0 ? t("cart.free") : <Price value={shippingFee} />}</span>
            </div>
            <div className="flex justify-between font-bold text-navy-900 text-base">
              <span>{t("cart.total")}</span>
              <Price value={total} />
            </div>
          </div>
          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="py-3 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold"
          >
            {submitting ? "…" : t("checkout.place")}
          </button>
        </div>
      </form>
    </div>
  );
}
