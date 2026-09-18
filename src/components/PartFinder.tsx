"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/i18n/LocaleProvider";
import { ArtCar, ArtPart, ArtReference, ArtUnknown, ArtCarteGrise } from "@/components/finder/RouteArt";
import { useVehicle, vehicleLabel } from "@/lib/vehicle-store";
import { decodeVinMakeSlug, isValidVinFormat } from "@/lib/vin";
import { track } from "@/lib/track";
import VehiclePicker from "./VehiclePicker";
import SearchSuggest from "./SearchSuggest";

/** One size for the four pictures, so they cannot drift apart. Full width and
 *  landscape: these are small illustrations across the top of a card, not
 *  icons beside a label — at 56px square they were read as bullets and
 *  skipped. */
const ART = "h-14 w-full sm:h-[4.5rem] lg:h-20";

/**
 * The one thing the homepage asks: how would you like to find your part?
 *
 * The previous version put all four identification methods on screen at once
 * as a four-column wall of forms. Every visitor had to read four labels, four
 * descriptions and four inputs before doing anything, which is a lot of work
 * to ask of someone whose actual thought is "my brakes are squeaking".
 *
 * Now it is a choice first and a form second. Five routes, each one a sentence
 * a normal person would say out loud, and only the chosen one opens. The
 * routes are deliberately unequal: knowing your car is the way most people get
 * the right part, so it is the biggest and it is open by default.
 *
 * The fifth route is the one that was missing entirely — "I don't know what
 * it's called". Not knowing the word for the part is the single most common
 * reason someone gives up on a parts site, and the shop can absorb that with a
 * photo and a phone number far more cheaply than the customer can learn the
 * vocabulary.
 */

type Route = "car" | "name" | "ref" | "unknown";

export default function PartFinder({ contactUrl }: { contactUrl: string }) {
  const { t } = useLocale();
  const router = useRouter();

  const vehicle = useVehicle((s) => s.vehicle);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [presetMake, setPresetMake] = useState<string | undefined>(undefined);

  // The route a shopper who already told us their car most likely wants is
  // not "which car" — it is the part. Open on the search box for them.
  const [route, setRoute] = useState<Route>("car");

  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const [ref, setRef] = useState("");
  const [refMsg, setRefMsg] = useState<string | null>(null);
  const [refBusy, setRefBusy] = useState(false);

  const [vin, setVin] = useState("");
  const [vinMsg, setVinMsg] = useState<string | null>(null);
  const [vinOpen, setVinOpen] = useState(false);
  const [photoSent, setPhotoSent] = useState(false);

  function openPicker(makeSlug?: string) {
    setPresetMake(makeSlug);
    setPickerOpen(true);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    track("search_started", { query: q.trim(), source: "finder" });
    router.push(`/recherche?q=${encodeURIComponent(q.trim())}`);
  }

  async function submitRef(e: React.FormEvent) {
    e.preventDefault();
    const value = ref.trim();
    if (!value) return;
    setRefBusy(true);
    setRefMsg(null);
    try {
      const res = await fetch(`/api/reference?q=${encodeURIComponent(value)}`);
      const data = await res.json();
      if (data.found) {
        router.push(`/produit/${data.slug}`);
        return;
      }
      // Not a dead end: the full search understands references too, and it
      // will offer the shop's own channel if it also comes up empty.
      router.push(`/recherche?q=${encodeURIComponent(value)}`);
    } catch {
      setRefMsg(t("finder2.refError"));
    } finally {
      setRefBusy(false);
    }
  }

  function submitVin(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidVinFormat(vin)) {
      setVinMsg(t("finder.vinRequired"));
      return;
    }
    const makeSlug = decodeVinMakeSlug(vin);
    if (!makeSlug) {
      setVinMsg(t("finder.vinNotRecognized"));
      return;
    }
    setVinMsg(null);
    openPicker(makeSlug);
  }

  /**
   * The VIN entry, rendered twice — folded on a phone, open on a wide screen.
   *
   * Declared here rather than as a module-level component so it reads the same
   * `vin` state as everything else: two copies with two independent states
   * would let the shopper type into one and submit the other.
   */
  function VinForm() {
    return (
      <form onSubmit={submitVin} className="min-w-0 flex-1">
        <p className="text-xs leading-snug text-gray-600">{t("finder2.vinWhere")}</p>
        <div className="mt-1.5 flex flex-wrap items-start gap-2">
          <div className="min-w-[12rem] flex-1">
            <input
              dir="ltr"
              value={vin}
              onChange={(e) =>
                setVin(e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17))
              }
              placeholder="VF1BR1V0H12345678"
              aria-label="VIN"
              className={`min-h-tap w-full rounded-xl border bg-white px-3 font-mono text-base tracking-wider outline-none ${
                vin.length === 17 ? "border-green-600" : vin.length > 0 ? "border-amber-400" : "border-gray-300"
              }`}
            />
            <span className="mt-1 block text-xs text-gray-600">{vin.length}/17</span>
            {vinMsg && <p className="mt-0.5 text-xs text-amber-700">{vinMsg}</p>}
          </div>
          <button
            type="submit"
            disabled={vin.length !== 17}
            className="min-h-tap rounded-xl bg-navy-900 px-5 font-display text-xs font-bold uppercase tracking-wide text-white enabled:hover:bg-navy-800 disabled:bg-gray-200 disabled:text-gray-600"
          >
            {t("finder.identify")}
          </button>
        </div>
      </form>
    );
  }

  return (
    <section id="finder" className="mx-auto shell-w px-4 pt-6 pb-8 sm:pt-9 sm:pb-12">
      {/* Eyebrow, promise, rule. The question is the small gold line; the
          heading is the answer to it, which is the thing worth setting large.
          The rule under it is the same gold, so the three read as one block
          rather than as a title with a stray caption. */}
      <div className="mb-5 sm:mb-6">
        {/* gold-800, not gold-500: the brand gold measures 2.09:1 on white and
            this is 12px text. See globals.css — the swatch is for fills and
            rules, and there is a darker step for the rare case where gold has
            to be read rather than looked at. */}
        <p className="font-display text-xs font-bold uppercase tracking-[0.12em] text-gold-800">
          {t("finder2.title")}
        </p>
        <h2 className="mt-1.5 max-w-[34rem] font-heading text-2xl font-extrabold leading-tight tracking-tight text-navy-950 sm:text-3xl">
          {t("finder2.subtitle")}
        </h2>
        <span className="mt-3 block h-1 w-14 rounded-full bg-gold-500" />
      </div>

      {/* The routes. Each is a button, not a tab strip: a tab strip says
          "these are views of one thing", and these are four different jobs. */}
      {/* Two across on a phone rather than four stacked, so every door is on
          screen at once and the choice is a glance instead of a scroll. */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <RouteCard
          active={route === "car"}
          onClick={() => setRoute("car")}
          art={<ArtCar className={ART} />}
          title={t("finder2.carTitle")}
          hint={vehicle ? (vehicleLabel(vehicle) ?? "") : t("finder2.carHint")}
          primary
        />
        <RouteCard
          active={route === "name"}
          onClick={() => setRoute("name")}
          art={<ArtPart className={ART} />}
          title={t("finder2.nameTitle")}
          hint={t("finder2.nameHint")}
        />
        <RouteCard
          active={route === "ref"}
          onClick={() => setRoute("ref")}
          art={<ArtReference className={ART} />}
          title={t("finder2.refTitle")}
          hint={t("finder2.refHint")}
        />
        <RouteCard
          active={route === "unknown"}
          onClick={() => setRoute("unknown")}
          art={<ArtUnknown className={ART} />}
          title={t("finder2.unknownTitle")}
          hint={t("finder2.unknownHint")}
        />
      </div>

      {/* One panel, under the chosen route — and none at all under "I know my
          car", because that door's answer is the band below, which is on
          screen whichever door is open. Two "Choisir ma voiture" buttons
          stacked on top of each other was the alternative. */}
      {route !== "car" && (
      <div className="mt-2.5 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        {route === "name" && (
          <form onSubmit={submitSearch} className="flex flex-col gap-2">
            <p className="text-sm text-gray-600">{t("finder2.nameIntro")}</p>
            {/* relative: the suggestion panel is positioned against this row. */}
            <div className="relative">
              <div className="flex rounded-xl overflow-hidden border border-gray-300 focus-within:border-navy-700">
                <input
                  ref={searchRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  type="search"
                  autoComplete="off"
                  aria-label={t("finder2.nameTitle")}
                  placeholder={t("finder2.namePlaceholder")}
                  className="flex-1 min-w-0 px-4 min-h-tap text-base outline-none"
                />
                <button className="px-5 bg-navy-900 hover:bg-navy-800 text-white font-display font-bold uppercase text-xs tracking-wide">
                  {t("hero.searchCta")}
                </button>
              </div>
              <SearchSuggest query={q} inputRef={searchRef} />
            </div>
            <p className="text-xs text-gray-600">{t("finder2.nameTypo")}</p>
          </form>
        )}

        {route === "ref" && (
          <form onSubmit={submitRef} className="flex flex-col gap-2">
            <p className="text-sm text-gray-600">{t("finder2.refIntro")}</p>
            <div className="flex flex-wrap gap-2">
              <input
                dir="ltr"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                aria-label={t("finder2.refTitle")}
                placeholder="GDB1330 · 7701234567"
                className="flex-1 min-w-0 px-4 min-h-tap text-base border border-gray-300 rounded-xl outline-none focus:border-navy-700 font-mono"
              />
              <button
                disabled={refBusy}
                className="min-h-tap px-6 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-display font-bold uppercase text-xs tracking-wide disabled:opacity-60"
              >
                {refBusy ? "…" : t("finder.search")}
              </button>
            </div>
            {refMsg && <p className="text-xs text-amber-700">{refMsg}</p>}
            <p className="text-xs text-gray-600">{t("finder2.refWhere")}</p>
          </form>
        )}

        {route === "unknown" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-600">{t("finder2.unknownIntro")}</p>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {/* A photo is the fastest description a person can give of a
                  part whose name they do not know. */}
              {photoSent ? (
                <span className="flex items-center gap-2 min-h-tap px-4 rounded-xl border border-green-300 bg-green-50 text-green-800 font-semibold text-sm">
                  {t("finder.plateReceived")}
                </span>
              ) : (
                <label className="flex items-center gap-2.5 min-h-tap px-4 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-semibold text-sm cursor-pointer">
                  <IconCamera />
                  {t("finder2.sendPhoto")}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={() => {
                      setPhotoSent(true);
                      track("whatsapp_clicked", { source: "finder_photo" });
                    }}
                  />
                </label>
              )}
              <a
                href={contactUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => track("whatsapp_clicked", { source: "finder_expert" })}
                className="flex items-center gap-2.5 min-h-tap px-4 rounded-xl bg-green-700 hover:bg-green-800 text-white font-semibold text-sm"
              >
                <IconChat />
                {t("finder2.askExpert")}
              </a>
              <Link
                href="/#symptomes"
                className="flex items-center gap-2.5 min-h-tap px-4 rounded-xl border border-gray-300 bg-white text-navy-900 font-semibold text-sm hover:border-navy-900"
              >
                <IconList />
                {t("finder2.browseFamilies")}
              </Link>
            </div>
            <p className="text-xs text-gray-600">{t("finder2.unknownNote")}</p>
          </div>
        )}
      </div>
      )}

      {/* The shop's promise, kept on screen whichever door is open.
          "Tell us your car once, and every part then says whether it fits" is
          the single thing this site does that a marketplace does not, and it
          used to be a paragraph inside one of the four panels — visible only
          to somebody who had already chosen the car door, which is the one
          group who needed no convincing. */}
      <div className="mt-3 overflow-hidden rounded-2xl border border-navy-900/15 bg-navy-50">
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:gap-6">
          <div className="min-w-0 flex-1">
            <p className="font-heading text-base font-extrabold tracking-tight text-navy-950 sm:text-lg">
              {t("finder2.bandTitle")}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">{t("finder2.bandBody")}</p>
          </div>

          {vehicle ? (
            <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
              <span className="inline-flex min-h-tap items-center gap-2 rounded-xl border border-navy-900/15 bg-white px-4 text-sm font-semibold text-navy-950">
                <IconCar />
                {vehicleLabel(vehicle)}
              </span>
              <Link
                href="/recherche?q="
                onClick={() => track("search_started", { query: "", source: "finder_my_car" })}
                className="inline-flex min-h-tap items-center gap-2 rounded-xl bg-gold-500 px-5 font-display text-xs font-bold uppercase tracking-wide text-navy-950 hover:bg-gold-400"
              >
                {t("finder2.shopForCar")}
                <IconArrowEnd />
              </Link>
              <button
                type="button"
                onClick={() => openPicker()}
                className="inline-flex min-h-tap items-center rounded-xl border border-navy-900/20 bg-white px-4 text-sm font-semibold text-navy-900 hover:border-navy-900"
              >
                {t("finder2.changeCar")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openPicker()}
              className="inline-flex min-h-tap-primary shrink-0 items-center justify-center gap-2.5 self-start rounded-xl bg-gold-500 px-6 font-display text-sm font-bold uppercase tracking-wide text-navy-950 hover:bg-gold-400 lg:self-auto"
            >
              <IconCar />
              {t("finder2.pickCar")}
              <IconArrowEnd />
            </button>
          )}

          {/* The VIN, with the document it is printed on beside it. An
              expert's shortcut — faster than three dropdowns for anybody
              holding their papers, meaningless to anybody who is not — so it
              sits to the side of the main action rather than in front of it,
              and it is folded away on a phone where it would otherwise be a
              third of the band. */}
          {/* One VIN form, folded on a phone and open on a wide screen.
              Not a <details>: `open` is an attribute, not a style, so it
              cannot be "open above lg" in CSS — and the first attempt
              (`lg:[&]:open`) silently did nothing, leaving the shortcut
              invisible on desktop. The second attempt rendered the block
              twice, which put two inputs labelled VIN in the page and made
              `#finder input[dir=ltr]` ambiguous for anything looking for the
              reference box. A toggle and one form. */}
          {!vehicle && (
            <div className="min-w-0 lg:w-[23rem] lg:shrink-0">
              <button
                type="button"
                onClick={() => setVinOpen((v) => !v)}
                aria-expanded={vinOpen}
                className="inline-flex min-h-tap-compact select-none items-center gap-1.5 text-sm font-semibold text-navy-700 hover:text-navy-950 lg:hidden"
              >
                <IconChevron />
                {t("finder2.vinToggle")}
              </button>
              <div className={`items-start gap-3 ${vinOpen ? "mt-2 flex" : "hidden lg:flex"}`}>
                <ArtCarteGrise className="hidden h-16 w-24 shrink-0 lg:block" />
                <VinForm />
              </div>
            </div>
          )}
        </div>
      </div>

      {pickerOpen && (
        <VehiclePicker onClose={() => setPickerOpen(false)} initialMakeSlug={presetMake} contactUrl={contactUrl} />
      )}
    </section>
  );
}

/**
 * One door, with its picture doing the explaining.
 *
 * This was an 18px line icon beside two lines of text, laid out sideways, and
 * on a phone the four of them stacked into a column of about thirty words
 * between the shopper and the first tap. The artwork leads now and the words
 * confirm it, which is the right order when the reader is standing at a
 * counter or at the roadside.
 *
 * The plate behind the picture stays light on a selected card, where
 * everything else turns navy. That is deliberate: the illustrations then need
 * one fixed palette rather than an inverted second set to keep in step, and
 * on the chosen card it reads as a sticker rather than a hole.
 */
function RouteCard({
  active,
  onClick,
  art,
  title,
  hint,
  primary = false,
}: {
  active: boolean;
  onClick: () => void;
  art: React.ReactNode;
  title: string;
  hint: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`group flex min-h-tap flex-col items-start gap-2 rounded-2xl border bg-white p-2.5 text-start transition sm:gap-3 sm:p-4 ${
        active
          ? "border-navy-900 ring-1 ring-navy-900 shadow-sm"
          : primary
            ? "border-navy-900/20 hover:border-navy-900/50"
            : "border-gray-200 hover:border-navy-900/40"
      }`}
    >
      {/* The card stays white on every state and the artwork keeps one fixed
          palette. It used to flip to navy when chosen, which meant the picture
          needed a light plate carved out of a dark card — two things to keep
          in step, and one navy-on-navy drawing away from being invisible. The
          border, the ring and the arrow say which door is open instead. */}
      <span className="grid w-full place-items-center rounded-xl bg-navy-50 py-2 sm:py-3">{art}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold leading-tight text-navy-950 sm:text-[15px]">{title}</span>
        <span className="mt-1 block text-xs leading-snug text-gray-600">{hint}</span>
      </span>
      {/* The affordance the four titles were missing: something that looks
          like it goes somewhere. Filled on the open door. */}
      <span
        aria-hidden="true"
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors sm:h-9 sm:w-9 ${
          active
            ? "bg-navy-900 text-white"
            : "border border-navy-900/20 text-navy-900 group-hover:border-navy-900 group-hover:bg-navy-900 group-hover:text-white"
        }`}
      >
        <IconArrowEnd />
      </span>
    </button>
  );
}

/** The arrow on a route card. Flips with the writing direction. */
function IconArrowEnd() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="rtl:-scale-x-100">
      <path d="M5 12h13" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

/* Line icons, sized to the text they sit beside. */

function Stroke({ children, size = 18 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function IconCar() {
  return (
    <Stroke>
      <path d="M5 17h14M4 17v-4.2L6 7h12l2 5.8V17" />
      <path d="M4 17v2h3v-2M17 17v2h3v-2" />
      <circle cx="7.5" cy="13.5" r=".8" />
      <circle cx="16.5" cy="13.5" r=".8" />
    </Stroke>
  );
}
function IconCamera() {
  return (
    <Stroke>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.2-2h8.2l1.2 2h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5Z" />
      <circle cx="12" cy="13" r="3.4" />
    </Stroke>
  );
}
function IconChat() {
  return <Stroke><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 21l1.9-5A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4Z" /></Stroke>;
}
function IconList() {
  return <Stroke><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></Stroke>;
}
function IconChevron() {
  return <Stroke size={14}><path d="m9 6 6 6-6 6" /></Stroke>;
}
