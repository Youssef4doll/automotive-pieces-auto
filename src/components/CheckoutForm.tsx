"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/i18n/LocaleProvider";
import { useCart, cartSubtotal } from "@/lib/cart-store";
import Price from "./Price";
import { shippingFeeFor, FLAT_DELIVERY_FEE } from "@/lib/shipping";
import { GOVERNORATES, GRAND_TUNIS } from "@/lib/governorates";
import { placeOrder } from "@/app/actions/orders";
import { track } from "@/lib/track";
import { getAttribution } from "@/lib/attribution";
import { useVehicle } from "@/lib/vehicle-store";
import {
  IconUser,
  IconTruck,
  IconStore,
  IconBanknote,
  IconCard,
  IconCheck,
  IconLock,
  IconShield,
  IconReturn,
  IconMapPin,
  IconClock,
  IconAlert,
} from "@/components/icons";

/** One input's worth of chrome, so the three fieldsets cannot drift apart. */
const FIELD =
  "w-full px-3 min-h-tap border border-gray-300 rounded-lg text-base text-navy-950 outline-none focus:border-navy-900";

/**
 * A numbered step.
 *
 * The form is three decisions — who you are, how you get it, how you pay —
 * and it used to present them as five unlabelled `<fieldset>`s of equal
 * weight, so on a phone it read as one long scroll with no sense of how much
 * was left. The number is the same hexagon the site uses elsewhere; the icon
 * says which decision it is without reading.
 */
function Step({
  n,
  Icon,
  title,
  children,
}: {
  n: number;
  Icon: (p: { className?: string }) => React.ReactElement;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2.5 font-heading font-extrabold uppercase tracking-tight text-navy-950">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center bg-navy-900 text-[13px] font-sans font-bold text-gold-500"
          style={{ clipPath: "polygon(25% 3%,75% 3%,100% 50%,75% 97%,25% 97%,0% 50%)" }}
          aria-hidden="true"
        >
          {n}
        </span>
        <Icon className="h-[18px] w-[18px] text-navy-900/40" />
        {title}
      </h2>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-gray-600">
        {label}
        {hint && <span className="ms-1.5 font-normal text-gray-500">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

/** One of a pair of mutually exclusive cards, with the chosen one ticked. */
function Choice({
  selected,
  onClick,
  Icon,
  title,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  Icon: (p: { className?: string }) => React.ReactElement;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-col gap-1.5 p-3 rounded-lg border-2 text-start transition-colors ${
        selected ? "border-navy-900 bg-navy-50" : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <span className="flex items-center gap-2 font-semibold text-sm text-navy-950">
        <Icon className={`h-4 w-4 ${selected ? "text-navy-900" : "text-gray-400"}`} />
        <span className="min-w-0 flex-1">{title}</span>
        {/* The tick is what tells a colour-blind shopper which card is
            chosen; the navy border alone does not. */}
        {selected && <IconCheck className="h-4 w-4 shrink-0 text-navy-900" />}
      </span>
      <span className="text-xs text-gray-600">{children}</span>
    </button>
  );
}

function Spinner() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={28}
      height={28}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      aria-hidden="true"
      className="mx-auto text-navy-900 motion-safe:animate-spin"
    >
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

/** The shape of the page, with nothing claimed inside it. */
function CheckoutSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8" aria-busy="true">
      <div className="h-7 w-56 rounded bg-gray-100" />
      <div className="mt-6 grid gap-8 md:grid-cols-3">
        <div className="flex flex-col gap-4 md:col-span-2">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="h-tap rounded-lg bg-gray-100" />
          ))}
        </div>
        <div className="h-56 rounded-xl border border-gray-200 bg-gray-50" />
      </div>
    </div>
  );
}

export type CheckoutDefaults = {
  name: string;
  phone: string;
  email: string;
  governorate: string;
  address: string;
};

export default function CheckoutForm({
  freeShippingThreshold,
  stampDuty = 0,
  deliveryGrandTunis,
  deliveryRegions,
  defaults,
  signedIn = false,
  storeAddress = null,
  storeHours = null,
}: {
  freeShippingThreshold: number;
  /** Droit de timbre, from the shop's settings — the same figure the cart
   *  quoted, and zero unless the shop is VAT registered. */
  stampDuty?: number;
  deliveryGrandTunis: string;
  deliveryRegions: string;
  defaults?: CheckoutDefaults;
  /** Only changes the wording — checkout never requires an account. */
  signedIn?: boolean;
  /** Where "retrait en magasin" actually means, and when the door is open.
   *  Null until the shop has entered them, and then the pickup card simply
   *  does not say where — better than naming a street we made up. */
  storeAddress?: string | null;
  storeHours?: string | null;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const vehicle = useVehicle((s) => s.vehicle);
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
  /**
   * The reference of an order that has already been recorded, set the moment
   * the server action comes back. It outranks the basket in the render below:
   * emptying the basket is the last thing a successful checkout does, and
   * without this the component would answer "your basket is empty" in the gap
   * before the confirmation page arrives — telling someone who has just
   * ordered that they have not.
   */
  const [placedRef, setPlacedRef] = useState<string | null>(null);

  const isGrandTunis = GRAND_TUNIS.has(governorate);
  const shippingFee = shippingFeeFor(subtotal, freeShippingThreshold, deliveryMethod);
  const total = subtotal + shippingFee + stampDuty;
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
      // The car the basket was filtered against, so the shop can check the
      // order against its own fitment table before picking it — and confirm
      // it, or catch a wrong part, without ringing the customer back. The id
      // only: the label on the order is read from our own tables server-side.
      vehicleEngineId: vehicle?.engineId,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      track("checkout_failed", { error: result.error });
      return;
    }
    track("checkout_completed", { ref: result.ref, total, itemCount: items.length });
    setPlacedRef(result.ref);
    clear();
    // replace, not push: this form is finished and its basket is gone, so the
    // back button should return to the shop rather than to a checkout that can
    // only say "empty" now.
    router.replace(`/commande/confirmation/${result.ref}`);
  }

  // Ordered. The order exists in the database — the action returned its
  // reference — so this states that, and names the reference in case the
  // confirmation page is slow to arrive or the shopper never gets there.
  if (placedRef) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <Spinner />
        <p className="mt-4 font-heading text-lg font-extrabold uppercase tracking-tight text-navy-950">
          {t("checkout.placedTitle")}
        </p>
        <p className="mt-1 text-sm text-gray-600">
          {t("checkout.placedRef")}{" "}
          <span className="font-mono font-bold text-navy-900" dir="ltr">{placedRef}</span>
        </p>
        <Link
          href={`/commande/confirmation/${placedRef}`}
          className="mt-5 inline-flex min-h-tap items-center rounded-lg border border-gray-300 px-5 text-sm font-semibold text-navy-900"
        >
          {t("checkout.placedOpen")}
        </Link>
      </div>
    );
  }

  // Before the basket has been read back out of localStorage, nothing here
  // knows whether it is empty — and the server, which rendered this HTML,
  // never could. Saying "your basket is empty" at this point was a guess that
  // was wrong for every shopper who had one: measured at 301ms on the cart
  // page and 35ms here, on a fast local machine with no network in the way.
  // The outline says "loading", which is the only true thing available.
  if (!hydrated) return <CheckoutSkeleton />;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-gray-600 font-semibold mb-6">{t("cart.empty")}</p>
        <Link href="/" className="px-5 py-3 rounded-lg bg-navy-900 text-white font-semibold">
          {t("cart.continue")}
        </Link>
      </div>
    );
  }


  const remainingForFree = Math.max(0, freeShippingThreshold - subtotal);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-heading text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-navy-950">
        {t("checkout.title")}
      </h1>
      {/* Three sentences for three sections, in the order they appear below.
          The last one is a fact, not a reassurance: cash on delivery is the
          only method the shop has switched on, so nobody is about to be asked
          for a card number. */}
      <p className="mt-1 mb-6 text-sm text-gray-600">{t("checkout.lede")}</p>

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
              <IconCheck className="h-4 w-4" />
              C&apos;est le chemin le plus rapide
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
              className="inline-flex items-center justify-center gap-1.5 min-h-tap px-5 mt-2.5 rounded-lg border border-navy-900 text-navy-900 font-semibold text-sm hover:bg-navy-50 transition-colors"
            >
              <IconUser className="h-4 w-4" />
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
        <div className="md:col-span-2 flex flex-col gap-7 min-w-0">
          <Step n={1} Icon={IconUser} title={t("checkout.contact")}>
            {/* Persistent labels, not placeholder-only: a placeholder vanishes
                the moment the user types, so on review they can't tell which
                field is which. autoComplete/inputMode give mobile browsers
                what they need for autofill and the right keyboard. */}
            <Field label={t("checkout.name")}>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder={t("checkout.name")}
                className={FIELD}
              />
            </Field>
            <Field label={t("checkout.phone")} hint={t("checkout.phoneHint")}>
              {/* minLength mirrors the server's own rule (shortText.min(6)) so
                  a too-short number is refused by the browser instantly
                  instead of after a round trip that has already been paid for.
                  No stricter pattern than that: the server does not impose
                  one, and a client-side rule the server does not share would
                  reject numbers the shop would happily have accepted. */}
              <input
                required
                minLength={6}
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder={t("checkout.phone")}
                className={FIELD}
              />
            </Field>
            <Field label={t("checkout.email")} hint={t("checkout.emailHint")}>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={t("checkout.email")}
                className={FIELD}
              />
            </Field>
          </Step>

          <Step n={2} Icon={IconTruck} title={t("checkout.deliveryMethod")}>
            <div className="grid grid-cols-2 gap-3">
              <Choice
                selected={deliveryMethod === "DELIVERY"}
                onClick={() => setDeliveryMethod("DELIVERY")}
                Icon={IconTruck}
                title={t("checkout.delivery")}
              >
                <bdi dir="ltr">{isGrandTunis ? deliveryGrandTunis : deliveryRegions}</bdi> ·{" "}
                {subtotal >= freeShippingThreshold ? (
                  <span className="font-semibold text-green-700">{t("cart.free")}</span>
                ) : (
                  <Price value={FLAT_DELIVERY_FEE} />
                )}
              </Choice>
              {/* Offered only when there is somewhere to go. The address block
                  below used to be the only thing that disappeared when the shop
                  had not entered one, which left a customer choosing "retrait
                  en magasin, gratuit, prêt en 2h" and then being told nowhere
                  to collect it — the worst of the two failures, because they
                  have already decided by then. */}
              {storeAddress && (
                <Choice
                  selected={deliveryMethod === "PICKUP"}
                  onClick={() => setDeliveryMethod("PICKUP")}
                  Icon={IconStore}
                  title={t("checkout.pickup")}
                >
                  {t("checkout.pickupFree")}
                </Choice>
              )}
            </div>

            {/* "Retrait en magasin" used to say free and ready in two hours
                without ever saying where. The address and the opening hours
                are the shop's own, entered in /admin/parametres, and this
                block simply does not appear until they are. */}
            {deliveryMethod === "PICKUP" && (storeAddress || storeHours) && (
              <div className="flex gap-2.5 rounded-lg bg-navy-50/60 p-3.5 text-sm">
                <IconMapPin className="mt-0.5 h-4 w-4 shrink-0 text-navy-900/50" />
                <div className="min-w-0">
                  {storeAddress && <p className="font-semibold text-navy-900">{storeAddress}</p>}
                  {storeHours && <p className="mt-0.5 text-gray-600">{storeHours}</p>}
                </div>
              </div>
            )}

            <Field label={t("checkout.governorate")}>
              <div className="flex flex-wrap gap-2">
                {GOVERNORATES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGovernorate(g)}
                    aria-pressed={governorate === g}
                    className={`inline-flex items-center min-h-tap px-4 rounded-full text-xs font-semibold border transition-colors ${
                      governorate === g
                        ? "bg-navy-900 text-white border-navy-900"
                        : "border-gray-300 text-gray-600 hover:border-navy-900"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </Field>

            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              <IconClock className="h-3.5 w-3.5 shrink-0" />
              {t("checkout.estimate")}: <strong dir="ltr">{estimate}</strong>
            </p>

            {deliveryMethod === "DELIVERY" && (
              <Field label={t("checkout.address")}>
                <input
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  autoComplete="street-address"
                  placeholder={t("checkout.address")}
                  className={FIELD}
                />
              </Field>
            )}
          </Step>

          <Step n={3} Icon={IconBanknote} title={t("checkout.payment")}>
            <div className="grid grid-cols-2 gap-3">
              {/* A banknote, because this is cash in hand at the door. The
                  emoji that used to sit here was 💳 — a bank card, drawn
                  differently on every phone, on the one payment method that
                  is explicitly not a card. */}
              <Choice
                selected={paymentMethod === "COD"}
                onClick={() => setPaymentMethod("COD")}
                Icon={IconBanknote}
                title={t("checkout.cod")}
              >
                {t("checkout.codHint")}
              </Choice>
              <div className="flex flex-col gap-1.5 p-3 rounded-lg border-2 border-gray-100 text-start opacity-60">
                <span className="flex items-center gap-2 font-semibold text-sm text-gray-500">
                  <IconCard className="h-4 w-4" />
                  {t("checkout.card")}
                </span>
                <span className="text-xs text-gray-500">{t("checkout.cardSoon")}</span>
              </div>
            </div>

            <Field label={t("checkout.notes")}>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("checkout.notesHint")}
                className={`${FIELD} py-3 resize-y`}
                rows={2}
              />
            </Field>
          </Step>
        </div>

        <div className="h-fit flex flex-col gap-3 sticky top-24 min-w-0">
          <div className="p-4 rounded-xl border border-gray-200 bg-white flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950">
                {t("cart.title")}
              </h2>
              {/* The way back. Without it the only route to changing a
                  quantity at this point is the browser's back button. */}
              <Link href="/panier" className="text-xs font-semibold text-navy-900/60 underline underline-offset-2 hover:text-red-600">
                {t("checkout.editCart")}
              </Link>
            </div>

            {/* min-w-0 below is load-bearing: `truncate` sets white-space:nowrap,
                and without it this flex item's min-content is the full
                untruncated product name, which forced the entire checkout page
                to 385px and made it scroll sideways on every phone. */}
            <div className="flex flex-col gap-2.5 max-h-56 overflow-y-auto">
              {items.map((i) => (
                <div key={i.productId} className="flex items-center gap-2.5 min-w-0">
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    <Image src={i.imageUrl} alt="" fill sizes="40px" className="object-cover" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block truncate text-gray-700">{i.name}</span>
                    <span className="block text-xs text-gray-500">
                      {i.qty} × <Price value={i.unitPrice} />
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-sm font-semibold">
                    <Price value={i.unitPrice * i.qty} />
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t pt-2.5 flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>{t("cart.subtotal")}</span>
                <Price value={subtotal} />
              </div>
              <div className="flex justify-between text-gray-600">
                <span>{t("cart.shipping")}</span>
                <span>
                  {shippingFee === 0 ? (
                    <span className="font-semibold text-green-700">{t("cart.free")}</span>
                  ) : (
                    <Price value={shippingFee} />
                  )}
                </span>
              </div>
              {stampDuty > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>{t("cart.stamp")}</span>
                  <Price value={stampDuty} />
                </div>
              )}
              <div className="flex justify-between font-bold text-navy-900 text-base border-t pt-2 mt-0.5">
                <span>{t("cart.total")}</span>
                <Price value={total} />
              </div>
            </div>

            {/* The same nudge the cart makes, repeated where the basket can
                still be changed. Only ever shown for home delivery — it is not
                true of a pickup, which is free at any amount. */}
            {deliveryMethod === "DELIVERY" && remainingForFree > 0 && (
              <p className="text-xs text-gray-600">
                {t("cart.freeShipProgress").replace("{amount}", String(Math.ceil(remainingForFree)))}
              </p>
            )}

            {error && (
              <p className="flex items-start gap-1.5 text-xs font-semibold text-red-600" role="alert">
                <IconAlert className="mt-px h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="min-h-tap rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold"
            >
              {submitting ? t("checkout.placing") : t("checkout.place")}
            </button>

            <p className="flex items-start gap-1.5 text-[11px] leading-snug text-gray-500">
              <IconLock className="mt-px h-3.5 w-3.5 shrink-0" />
              {t("checkout.privacy")}
            </p>
          </div>

          {/* The shop's three standing promises, at the moment the shopper is
              deciding whether to trust it with an order. The same three
              sentences as the badges on the home page, from the same keys —
              so they cannot come to say different things. */}
          <ul className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-slate-50 p-4 text-[13px] text-gray-700">
            {(
              [
                { k: "trust.cod", Icon: IconBanknote },
                { k: "trust.exchange", Icon: IconReturn },
                { k: "trust.warranty", Icon: IconShield },
              ] as const
            ).map(({ k, Icon }) => (
              <li key={k} className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-gold-500" />
                {t(k)}
              </li>
            ))}
          </ul>
        </div>
      </form>
    </div>
  );
}
