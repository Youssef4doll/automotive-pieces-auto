"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/i18n/LocaleProvider";
import { useVehicle, vehicleLabel } from "@/lib/vehicle-store";
import { decodeVinMakeSlug, isValidVinFormat } from "@/lib/vin";
import { track } from "@/lib/track";
import VehiclePicker from "./VehiclePicker";
import SearchSuggest from "./SearchSuggest";

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

  return (
    <section id="finder" className="mx-auto max-w-7xl px-4 pt-6 pb-8 sm:pt-9 sm:pb-12">
      <div className="mb-4 sm:mb-5">
        <h2 className="font-heading font-extrabold uppercase text-xl sm:text-2xl text-navy-950 tracking-tight">
          {t("finder2.title")}
        </h2>
        <p className="text-sm text-gray-600 mt-1">{t("finder2.subtitle")}</p>
      </div>

      {/* The routes. Each is a button, not a tab strip: a tab strip says
          "these are views of one thing", and these are four different jobs. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <RouteCard
          active={route === "car"}
          onClick={() => setRoute("car")}
          icon={<IconCar />}
          title={t("finder2.carTitle")}
          hint={vehicle ? (vehicleLabel(vehicle) ?? "") : t("finder2.carHint")}
          primary
        />
        <RouteCard
          active={route === "name"}
          onClick={() => setRoute("name")}
          icon={<IconSearch />}
          title={t("finder2.nameTitle")}
          hint={t("finder2.nameHint")}
        />
        <RouteCard
          active={route === "ref"}
          onClick={() => setRoute("ref")}
          icon={<IconHash />}
          title={t("finder2.refTitle")}
          hint={t("finder2.refHint")}
        />
        <RouteCard
          active={route === "unknown"}
          onClick={() => setRoute("unknown")}
          icon={<IconHelp />}
          title={t("finder2.unknownTitle")}
          hint={t("finder2.unknownHint")}
        />
      </div>

      {/* One panel, under the chosen route. */}
      <div className="mt-2.5 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        {route === "car" && (
          <div className="flex flex-col gap-3">
            {vehicle ? (
              <>
                <p className="text-sm text-gray-600">{t("finder2.carSaved")}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 min-h-tap px-4 rounded-xl bg-navy-50 border border-navy-900/15 text-navy-950 font-semibold text-sm">
                    <IconCar />
                    {vehicleLabel(vehicle)}
                  </span>
                  <Link
                    href="/recherche?q="
                    onClick={() => track("search_started", { query: "", source: "finder_my_car" })}
                    className="inline-flex items-center min-h-tap px-5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-display font-bold uppercase text-xs tracking-wide"
                  >
                    {t("finder2.shopForCar")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => openPicker()}
                    className="inline-flex items-center min-h-tap px-4 rounded-xl border border-gray-300 text-navy-900 text-sm font-semibold hover:border-navy-900"
                  >
                    {t("finder2.changeCar")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600">{t("finder2.carIntro")}</p>
                <button
                  type="button"
                  onClick={() => openPicker()}
                  className="self-start inline-flex items-center gap-2 min-h-tap px-6 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-display font-bold uppercase text-sm tracking-wide"
                >
                  {t("finder2.pickCar")}
                </button>

                {/* The VIN is faster than three dropdowns for anyone holding
                    their papers, but it is an expert's shortcut, so it sits
                    under the main action rather than competing with it. */}
                <details className="mt-1 group">
                  <summary className="inline-flex items-center gap-1.5 min-h-tap-compact text-sm text-navy-700 hover:text-navy-950 cursor-pointer select-none">
                    <IconChevron />
                    {t("finder2.vinToggle")}
                  </summary>
                  <form onSubmit={submitVin} className="mt-2 flex flex-wrap items-start gap-2">
                    <div className="min-w-0">
                      <input
                        dir="ltr"
                        value={vin}
                        onChange={(e) =>
                          setVin(e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17))
                        }
                        placeholder="VF1BR1V0H12345678"
                        aria-label="VIN"
                        className={`w-full sm:w-72 px-3 min-h-tap text-base border rounded-xl outline-none font-mono tracking-wider ${
                          vin.length === 17 ? "border-green-600" : vin.length > 0 ? "border-amber-400" : "border-gray-300"
                        }`}
                      />
                      <span className="block text-xs text-gray-600 mt-1">{vin.length}/17</span>
                      {vinMsg && <p className="text-xs text-amber-700 mt-0.5">{vinMsg}</p>}
                    </div>
                    <button
                      type="submit"
                      disabled={vin.length !== 17}
                      className="min-h-tap px-5 rounded-xl bg-navy-900 enabled:hover:bg-navy-800 text-white disabled:bg-gray-200 disabled:text-gray-600 font-display font-bold uppercase text-xs tracking-wide"
                    >
                      {t("finder.identify")}
                    </button>
                  </form>
                </details>
              </>
            )}
          </div>
        )}

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

      {pickerOpen && (
        <VehiclePicker onClose={() => setPickerOpen(false)} initialMakeSlug={presetMake} contactUrl={contactUrl} />
      )}
    </section>
  );
}

function RouteCard({
  active,
  onClick,
  icon,
  title,
  hint,
  primary = false,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex items-start gap-3 p-3.5 rounded-2xl border text-start transition ${
        active
          ? "border-navy-900 bg-navy-900 text-white shadow-sm"
          : primary
            ? "border-navy-900/25 bg-white hover:border-navy-900"
            : "border-gray-200 bg-white hover:border-navy-900/40"
      }`}
    >
      <span
        className={`shrink-0 grid place-items-center w-9 h-9 rounded-xl ${
          active ? "bg-white/15 text-white" : "bg-gray-100 text-navy-900"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-sm leading-tight">{title}</span>
        <span className={`block text-xs mt-0.5 leading-snug ${active ? "text-white/70" : "text-gray-600"}`}>
          {hint}
        </span>
      </span>
    </button>
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
function IconSearch() {
  return <Stroke><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></Stroke>;
}
function IconHash() {
  return <Stroke><path d="M10 3 8 21M16 3l-2 18M3.5 8.5h17M3 15.5h17" /></Stroke>;
}
function IconHelp() {
  return <Stroke><circle cx="12" cy="12" r="9" /><path d="M9.2 9.3a2.9 2.9 0 0 1 5.6 1c0 2-2.8 2.4-2.8 4" /><path d="M12 17.5h.01" /></Stroke>;
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
