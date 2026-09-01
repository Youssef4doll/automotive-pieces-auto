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

export type CheckoutDefaults = {
  name: string;
  phone: string;
  email: string;
  governorate: string;
  address: string;
};

export default function CheckoutForm({
  freeShippingThreshold,
  deliveryGrandTunis,
  deliveryRegions,
  defaults,
  signedIn = false,
}: {
  freeShippingThreshold: number;
  deliveryGrandTunis: string;
  deliveryRegions: string;
  defaults?: CheckoutDefaults;
  /** Only changes the wording — checkout never requires an account. */
  signedIn?: boolean;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const subtotal = cartSubtotal(items);

  const [name, setName] = useState(defaults?.name ?? "");
  const [phone, setPhone] = useState(defaults?.phone ?? "");
  const [email, setEmail] = useState(defaults?.email ?? "");
  const [governorate, setGovernorate] = useState(defaults?.governorate || "Tunis");
  const [address, setAddress] = useState(defaults?.address ?? "");
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
      <h1 className="text-xl sm:text-2xl font-extrabold text-navy-950 mb-2">{t("checkout.title")}</h1>

      {/* Said out loud, because "do I have to make an account?" is the question
          that loses the order. Signing in is offered as a shortcut for people
          who already have one, never as a gate — the form below submits either
          way. Creating an account is offered after the order instead, when it
          costs the customer nothing. */}
      {!signedIn && (
        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          {/* Both choices are shown, neither blocks. The version of this that
              costs orders is a modal in front of the form; here the guest form
              is already below and filled in by scrolling past this. Signing in
              is a shortcut for people who have an account, and creating one is
              offered after the order, when it costs the buyer nothing. */}
          <div className="rounded-xl border-2 border-navy-900 bg-navy-50/50 p-4">
            <p className="font-heading font-extrabold uppercase tracking-tight text-navy-950">
              Commander en tant qu&apos;invité
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Aucun compte nécessaire. Remplissez le formulaire ci-dessous et c&apos;est commandé —
              paiement à la livraison.
            </p>
            <p className="inline-flex items-center gap-1.5 mt-2.5 text-[13px] font-semibold text-green-700">
              ✓ C&apos;est le chemin le plus rapide
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="font-heading font-extrabold uppercase tracking-tight text-navy-950">
              Déjà client ?
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Connectez-vous pour remplir vos informations automatiquement, suivre la commande et
              retrouver vos achats.
            </p>
            <Link
              href="/compte"
              className="inline-flex items-center justify-center min-h-tap px-5 mt-2.5 rounded-lg border border-navy-900 text-navy-900 font-semibold text-sm hover:bg-navy-50 transition-colors"
            >
              Se connecter
            </Link>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="grid md:grid-cols-3 gap-8">
        {/* min-w-0 on BOTH grid children is required, not optional: a grid
            item defaults to min-width:auto, so it reserves its content's
            min-content width. The order summary contains a `truncate`
            (white-space:nowrap) product name, whose min-content is the full
            untruncated string — that forced the whole checkout page to 385px
            and made it scroll sideways on every phone. Giving the span
            min-w-0 alone is NOT enough; the grid item itself must opt out. */}
        <div className="md:col-span-2 flex flex-col gap-6 min-w-0">
          <fieldset className="flex flex-col gap-3">
            <h2 className="font-bold text-navy-900">{t("checkout.contact")}</h2>
            {/* Persistent labels, not placeholder-only: a placeholder vanishes
                the moment the user types, so on review they can't tell which
                field is which. autoComplete/inputMode give mobile browsers
                what they need for autofill and the right keyboard. */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-600">{t("checkout.name")}</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder={t("checkout.name")}
                className="px-3 min-h-tap border border-gray-300 rounded-lg text-sm"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-600">{t("checkout.phone")}</span>
              <input
                required
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder={t("checkout.phone")}
                className="px-3 min-h-tap border border-gray-300 rounded-lg text-sm"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-600">{t("checkout.email")}</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={t("checkout.email")}
                className="px-3 min-h-tap border border-gray-300 rounded-lg text-sm"
              />
            </label>
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
                  className={`inline-flex items-center min-h-tap px-4 rounded-full text-xs font-medium border ${governorate === g ? "bg-navy-900 text-white border-navy-900" : "border-gray-300 text-gray-600"}`}
                >
                  {g}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              {t("checkout.estimate")}: <strong dir="ltr">{estimate}</strong>
            </p>
            {deliveryMethod === "DELIVERY" && (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-gray-600">{t("checkout.address")}</span>
                <input
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  autoComplete="street-address"
                  placeholder={t("checkout.address")}
                  className="px-3 min-h-tap border border-gray-300 rounded-lg text-sm"
                />
              </label>
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
                <p className="text-xs text-gray-600">{t("checkout.cardSoon")}</p>
              </button>
            </div>
          </fieldset>

          <fieldset>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("checkout.notes")} className="w-full px-3 py-3 border border-gray-300 rounded-lg text-sm" rows={2} />
          </fieldset>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 bg-white h-fit flex flex-col gap-3 sticky top-24 min-w-0">
          <h2 className="font-bold text-navy-900">{t("cart.title")}</h2>
          {/* min-w-0 below is load-bearing: `truncate` sets white-space:nowrap,
              and without it this flex item's min-content is the full
              untruncated product name, which forced the entire checkout page
              to 385px and made it scroll sideways on every phone. */}
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
            {items.map((i) => (
              <div key={i.productId} className="flex justify-between text-sm min-w-0">
                <span className="text-gray-600 truncate pe-2 min-w-0">{i.qty}× {i.name}</span>
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
