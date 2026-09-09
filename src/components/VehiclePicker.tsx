"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/i18n/LocaleProvider";
import { parts as partsLabel } from "@/i18n/plural";
import { useVehicle, vehicleLabel } from "@/lib/vehicle-store";
import { decodeVinMakeSlug, isValidVinFormat } from "@/lib/vin";
import { track } from "@/lib/track";

type Engine = { id: string; name: string; fuel: string | null; powerHp: number | null };
type Model = { id: string; name: string; slug: string; yearFrom: number | null; yearTo: number | null; engines: Engine[] };
type Make = {
  id: string;
  name: string;
  slug: string;
  /** Uploaded from /admin/catalogue/vehicules. Null draws the initials. */
  logoUrl: string | null;
  /** Distinct active parts with a fitment against this make. Counted, not guessed. */
  partCount: number;
  models: Model[];
};

/**
 * "Which car do you drive?", asked properly.
 *
 * It used to open straight onto a bare grid of manufacturer names under a
 * search box. That is a fine screen for somebody who knows the answer, and a
 * dead end for everybody else — and "everybody else" is a large share of the
 * people this shop serves. Someone who bought the car second-hand, or drives
 * the family's, frequently cannot name the engine, which is the one field that
 * actually decides whether a part fits.
 *
 * So the dialog now opens on a choice: I know my car, or I don't. The first is
 * the same three taps as before, and the second is the shop taking the problem
 * on — a photo of the registration document, the VIN off the windscreen, or a
 * person to talk to. Nothing is inferred and nothing is guessed: the VIN route
 * decodes the manufacturer and then hands back to the ordinary picker rather
 * than pretending to know the model.
 *
 * One layout, two shapes: a full-height sheet a thumb can work on a phone, a
 * centred dialog on a desktop. `dvh` rather than `vh` because mobile browser
 * chrome makes `100vh` taller than the screen actually is.
 *
 * ---------------------------------------------------------------------------
 * On what this is not
 *
 * The big European catalogues run this screen on TecDoc — a licensed
 * commercial database of vehicles and part compatibility — and put a
 * number-plate box at the top of it, which queries a national vehicle
 * register. This shop has neither: TecDoc needs a paid subscription and API
 * credentials, and there is no consultable register for Tunisian plates. So
 * the plate box is not here pretending to work, and the make/model/engine
 * lists are the shop's own vehicle table, not an imported catalogue. What is
 * borrowed is the shape of the interaction, which is free.
 *
 * The one honest local equivalent of a plate lookup is the carte grise, which
 * carries all three answers and which a customer can photograph in five
 * seconds. That is the first card on the "I don't know" path.
 */

type Path = "choose" | "know" | "help";
type Step = "make" | "model" | "engine";

export default function VehiclePicker({
  onClose,
  initialMakeSlug,
  contactUrl = "/#magasin",
}: {
  onClose: () => void;
  initialMakeSlug?: string;
  /** The shop's own channel. Falls back to the store section on the homepage. */
  contactUrl?: string;
}) {
  const { t } = useLocale();
  const setVehicle = useVehicle((s) => s.set);
  const savedVehicles = useVehicle((s) => s.vehicles);
  const activeVehicle = useVehicle((s) => s.vehicle);
  const selectActive = useVehicle((s) => s.selectActive);
  const removeVehicle = useVehicle((s) => s.removeVehicle);

  const [makes, setMakes] = useState<Make[]>([]);
  const [loading, setLoading] = useState(true);
  // Someone arriving with a make already decided (from a VIN, or a brand page)
  // has answered the first question, so skip the chooser for them.
  const [path, setPath] = useState<Path>(initialMakeSlug ? "know" : "choose");
  const [step, setStep] = useState<Step>("make");
  const [make, setMake] = useState<Make | null>(null);
  const [model, setModel] = useState<Model | null>(null);
  const [filter, setFilter] = useState("");

  const [vin, setVin] = useState("");
  const [vinMsg, setVinMsg] = useState<string | null>(null);
  const [photoSent, setPhotoSent] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/vehicles")
      .then((r) => r.json())
      .then((data: Make[]) => {
        setMakes(data);
        if (initialMakeSlug) {
          const preset = data.find((m) => m.slug === initialMakeSlug);
          if (preset) {
            setMake(preset);
            setStep("model");
          }
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape closes, and the page behind does not scroll while this is open —
  // on a phone a scrolling background under a sheet feels broken.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  /**
   * Focus the search when a list appears — on a device with a real keyboard.
   *
   * On a phone, focusing an input summons the on-screen keyboard, and the
   * keyboard covers roughly the bottom half of the screen. The sheet is
   * bottom-anchored, so the grid of manufacturers the shopper just asked for
   * opened underneath it: they tapped "Je connais ma voiture" and got a
   * keyboard they had not asked for, hiding the answer. Dismissing it meant
   * tapping "done" before they could even look.
   *
   * `pointer: fine` is the honest test — it asks whether the device has a
   * precise pointer (mouse, trackpad, stylus) rather than guessing from the
   * screen width, so a small laptop window still gets the focus and a large
   * tablet does not. A shopper on a phone who *wants* to type just taps the
   * box, which is one tap and costs them nothing.
   */
  useEffect(() => {
    if (path !== "know" || step === "engine") return;
    const hasFinePointer =
      typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches;
    if (hasFinePointer) searchRef.current?.focus();
  }, [path, step]);

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const q = norm(filter.trim());
  const filteredMakes = makes.filter((m) => norm(m.name).includes(q));
  const filteredModels = make?.models.filter((m) => norm(m.name).includes(q)) ?? [];

  /**
   * The search box on the first screen looks past the makes to the models.
   *
   * Someone who wants brake pads for a Clio types "clio", not "renault" — and
   * a box that only matched manufacturers answered that with "no result",
   * which is the worst possible reply to a correct query. Matching on
   * "make model" as one string means "renault clio" and "clio" both land, and
   * the row goes straight to the motorisation step, so a model match saves a
   * tap rather than costing one.
   *
   * Two characters minimum: a single letter matches most of the table and the
   * list stops being a result.
   */
  const modelMatches =
    q.length >= 2
      ? makes.flatMap((mk) =>
          mk.models
            .filter((mo) => norm(`${mk.name} ${mo.name}`).includes(q))
            .map((mo) => ({ make: mk, model: mo }))
        )
      : [];

  /**
   * One list of every make, in alphabetical order.
   *
   * It used to be two: a "Marques les mieux fournies" panel of the top six by
   * parts held, then "Autres marques" for the rest. The ranking was real —
   * counted off the fitment table, gated so it only appeared when the sixth
   * make genuinely outstocked the seventh — and it was still the wrong shape
   * for this screen. Nobody opens this dialog to browse manufacturers. They
   * open it holding one specific car, and the only question is "where is
   * mine?" — which a coverage ranking actively obstructs, because you cannot
   * guess which of two panels your make landed in without reading both. The
   * shop's own verdict on the heading was blunter: "the title is bad".
   *
   * Alphabetical answers the real question, and the part count stays on every
   * tile, so how well we cover a make is still on screen — it just no longer
   * decides where the make sits.
   */
  const sortedMakes = [...filteredMakes].sort((a, b) => a.name.localeCompare(b.name, "fr"));

  /**
   * A search box only where there is something to search.
   *
   * On the make step it always earns its place — it looks past the makes to
   * the models, so it is how "clio" finds a Renault. On the model step it is
   * filtering a list the shop can usually count on one hand: BMW has two
   * models, and a full-width input above two rows is a control that costs a
   * quarter of a phone screen to save nobody a scroll. Eight is roughly where
   * a list stops fitting above the fold on a phone.
   */
  const showSearch = step === "make" || (step === "model" && (make?.models.length ?? 0) >= 8);

  function pickModel(mk: Make, mo: Model) {
    setMake(mk);
    setModel(mo);
    setStep("engine");
    setFilter("");
  }

  function pickEngine(engine: Engine) {
    if (!make || !model) return;
    setVehicle({
      makeId: make.id,
      makeName: make.name,
      modelId: model.id,
      modelName: model.name,
      engineId: engine.id,
      engineName: engine.name,
    });
    onClose();
  }

  function submitVin(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidVinFormat(vin)) {
      setVinMsg(t("finder.vinRequired"));
      return;
    }
    const slug = decodeVinMakeSlug(vin);
    const found = slug ? makes.find((m) => m.slug === slug) : null;
    if (!found) {
      setVinMsg(t("finder.vinNotRecognized"));
      return;
    }
    // The VIN tells us the manufacturer and nothing more that we can trust, so
    // it drops the shopper into the model list rather than claiming a model.
    track("vehicle_vin_decoded", { makeName: found.name });
    setVinMsg(null);
    setMake(found);
    setStep("model");
    setFilter("");
    setPath("know");
  }

  const back = () => {
    if (path === "help") return setPath("choose");
    if (step === "engine") { setModel(null); setStep("model"); setFilter(""); return; }
    if (step === "model") { setMake(null); setStep("make"); setFilter(""); return; }
    setPath("choose");
  };

  const title =
    path === "choose" ? t("vp.title")
      : path === "help" ? t("vp.helpShort")
        : step === "make" ? t("vp.stepMake")
          : step === "model" ? make?.name ?? t("vp.stepModel")
            : model?.name ?? t("vp.stepEngine");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-[2px]" onClick={onClose} />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("vp.title")}
        className="relative bg-white w-full flex flex-col rounded-t-2xl max-h-[92dvh] sm:max-h-[86vh] sm:max-w-2xl sm:rounded-2xl shadow-2xl"
      >
        {/* ---------------------------------------------------------- header */}
        <header className="shrink-0 flex items-center gap-2 px-3 sm:px-4 py-3 border-b border-gray-200">
          {path !== "choose" && (
            <button
              type="button"
              onClick={back}
              aria-label={t("vp.back")}
              className="shrink-0 w-tap h-11 -ms-1 grid place-items-center rounded-lg text-navy-900 hover:bg-gray-100"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="rtl:rotate-180">
                <path d="m15 5-7 7 7 7" />
              </svg>
            </button>
          )}
          <h2 className="flex-1 min-w-0 truncate font-heading font-extrabold uppercase tracking-tight text-navy-950 text-base sm:text-lg">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 w-tap h-11 -me-1 grid place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-navy-950"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        {/* Where they are in the three steps. Only on the "I know" path, where
            there are steps to be at. */}
        {path === "know" && (
          <ol className="shrink-0 flex items-center gap-1.5 px-3 sm:px-4 py-2 border-b border-gray-100 text-[11px] font-display font-bold uppercase tracking-wide">
            {(["make", "model", "engine"] as Step[]).map((s, i) => {
              const done = (s === "make" && make) || (s === "model" && model);
              const here = step === s;
              return (
                <li key={s} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-gray-300">›</span>}
                  <span
                    className={`px-2 py-1 rounded-full ${
                      here ? "bg-navy-900 text-white" : done ? "bg-green-50 text-green-800" : "text-gray-400"
                    }`}
                  >
                    {t(s === "make" ? "vp.stepMake" : s === "model" ? "vp.stepModel" : "vp.stepEngine")}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {/* Search sits outside the scroll area so it stays put while a long
            list of makes moves under it. */}
        {path === "know" && showSearch && (
          <div className="shrink-0 p-3 border-b border-gray-100">
            <div className="relative">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true">
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" />
              </svg>
              <input
                ref={searchRef}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                type="search"
                aria-label={t(step === "make" ? "vp.searchAny" : "vp.searchModel")}
                placeholder={t(step === "make" ? "vp.searchAny" : "vp.searchModel")}
                className="w-full ps-9 pe-3 min-h-tap rounded-xl border border-gray-300 text-base outline-none focus:border-navy-700"
              />
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------ body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-4">
          {/* ---- the choice ---- */}
          {path === "choose" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-gray-600">{t("vp.lead")}</p>

              {savedVehicles.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {savedVehicles.map((v) => {
                    const active = activeVehicle?.engineId === v.engineId;
                    return (
                      <li key={v.engineId} className="flex items-stretch gap-2">
                        <button
                          type="button"
                          onClick={() => { selectActive(v.engineId); onClose(); }}
                          className={`flex-1 min-w-0 text-start px-3.5 min-h-tap rounded-xl border flex items-center justify-between gap-2 text-sm ${
                            active ? "border-green-400 bg-green-50" : "border-gray-200 hover:border-navy-700"
                          }`}
                        >
                          <span className="min-w-0 truncate font-semibold text-navy-950">{vehicleLabel(v)}</span>
                          {active && (
                            <span className="shrink-0 text-[10px] font-bold uppercase text-green-800">
                              {t("garage.active")}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeVehicle(v.engineId)}
                          aria-label={t("garage.remove")}
                          className="shrink-0 w-tap rounded-xl border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 grid place-items-center"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                          </svg>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <BigChoice
                onClick={() => { setPath("know"); setStep("make"); setFilter(""); }}
                icon={<IconCar />}
                title={t("vp.knowTitle")}
                hint={t("vp.knowHint")}
                primary
              />
              <BigChoice
                onClick={() => setPath("help")}
                icon={<IconHelp />}
                title={t("vp.dontTitle")}
                hint={t("vp.dontHint")}
              />

              <button
                type="button"
                onClick={onClose}
                className="self-center mt-1 min-h-tap-compact px-3 text-sm text-gray-500 hover:text-navy-950 underline underline-offset-2"
              >
                {t("vp.skip")}
              </button>
            </div>
          )}

          {/* ---- I know my car ---- */}
          {path === "know" && loading && (
            <p className="text-center text-gray-600 py-10 text-sm">Chargement…</p>
          )}

          {path === "know" && !loading && step === "make" && (
            filteredMakes.length === 0 && modelMatches.length === 0 ? (
              <NoMatch onHelp={() => setPath("help")} />
            ) : (
              <div className="flex flex-col gap-5">
                {sortedMakes.length > 0 && (
                  <section>
                    {/* One row per make on a phone, two from 420px, three on a
                        desktop dialog. The two-column grid this replaced put
                        a 30px logo, a make name and a part count into a 165px
                        cell, which truncated "Volkswagen" on every phone the
                        shop's customers actually use. A full-width row has
                        room for all three and is a bigger tap target. */}
                    <ul className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 gap-2">
                      {sortedMakes.map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => { setMake(m); setStep("model"); setFilter(""); }}
                            className="w-full text-start ps-2 pe-3 py-2 min-h-tap rounded-xl border border-gray-200 hover:border-navy-700 hover:bg-navy-50 active:bg-navy-50 flex items-center gap-2.5"
                          >
                            <MakeMark make={m} size={36} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[15px] font-semibold text-navy-950 leading-tight">
                                {m.name}
                              </span>
                              {/* What we can actually do for this make. A make
                                  we hold nothing for says so rather than
                                  looking identical to one we cover. */}
                              <span className="block truncate text-xs text-gray-500 tabular-nums mt-0.5">
                                {m.partCount > 0 ? partsLabel(t, m.partCount) : t("vp.noParts")}
                              </span>
                            </span>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-300 rtl:rotate-180" aria-hidden="true">
                              <path d="m9 5 7 7-7 7" />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Typing "clio" lands here rather than on "no result". */}
                {modelMatches.length > 0 && (
                  <section>
                    <SectionHead title={t("vp.modelsMatching")} />
                    <ul className="flex flex-col gap-2">
                      {modelMatches.map(({ make: mk, model: mo }) => (
                        <li key={`${mk.id}-${mo.id}`}>
                          <button
                            type="button"
                            onClick={() => pickModel(mk, mo)}
                            className="w-full text-start ps-2 pe-3.5 min-h-tap rounded-xl border border-gray-200 hover:border-navy-700 hover:bg-navy-50 flex items-center gap-2.5"
                          >
                            <MakeMark make={mk} size={30} />
                            <span className="min-w-0 flex-1 text-sm">
                              <span className="block truncate font-semibold text-navy-950">
                                {mk.name} {mo.name}
                              </span>
                              {yearsOf(mo) && (
                                <span className="block text-xs text-gray-500 tabular-nums">{yearsOf(mo)}</span>
                              )}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )
          )}

          {path === "know" && !loading && step === "model" && make && (
            filteredModels.length === 0 ? (
              <NoMatch onHelp={() => setPath("help")} />
            ) : (
              // Two lines rather than name-left / years-right: "Golf VII
              // Sportsvan" and "2014–2020" fought for one 320px row and the
              // name lost, so a shopper picked between two truncated models
              // that looked identical.
              <ul className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
                {filteredModels.map((m) => {
                  const years = yearsOf(m);
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => { setModel(m); setStep("engine"); }}
                        className="w-full h-full text-start px-3.5 py-2 min-h-tap rounded-xl border border-gray-200 hover:border-navy-700 active:bg-navy-50 flex items-center gap-2.5"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold text-navy-950 leading-tight">
                            {m.name}
                          </span>
                          {years && (
                            <span className="block text-xs text-gray-500 tabular-nums mt-0.5">{years}</span>
                          )}
                        </span>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-300 rtl:rotate-180" aria-hidden="true">
                          <path d="m9 5 7 7-7 7" />
                        </svg>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          )}

          {path === "know" && !loading && step === "engine" && model && (
            <ul className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
              {model.engines.map((e) => {
                // Only what the catalogue actually records for this engine.
                const spec = [e.fuel, e.powerHp ? `${e.powerHp} ch` : null].filter(Boolean).join(" · ");
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => pickEngine(e)}
                      className="w-full h-full text-start px-3.5 py-2 min-h-tap rounded-xl border border-gray-200 hover:border-navy-700 hover:bg-navy-50 active:bg-navy-50 flex flex-col justify-center"
                    >
                      <span className="block truncate text-[15px] font-semibold text-navy-950 leading-tight">
                        {e.name}
                      </span>
                      {spec && <span className="block truncate text-xs text-gray-500 mt-0.5">{spec}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* ---- I don't know ---- */}
          {path === "help" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-gray-600">{t("vp.helpTitle")}</p>
              {/* The registration document carries all three answers, so the
                  cheapest thing a customer can do is photograph it. */}
              <HelpCard title={t("vp.cardTitle")} hint={t("vp.cardHint")} icon={<IconCard />}>
                {photoSent ? (
                  <p className="min-h-tap flex items-center px-3.5 rounded-xl border border-green-300 bg-green-50 text-green-800 text-sm font-semibold">
                    {t("vp.cardSent")}
                  </p>
                ) : (
                  <label className="inline-flex items-center gap-2 min-h-tap px-4 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 text-sm font-semibold cursor-pointer">
                    <IconCamera />
                    {t("vp.cardCta")}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={() => { setPhotoSent(true); track("whatsapp_clicked", { source: "picker_card" }); }}
                    />
                  </label>
                )}
              </HelpCard>

              <HelpCard title={t("vp.vinTitle")} hint={t("vp.vinHint")} icon={<IconHash />}>
                <form onSubmit={submitVin} className="flex flex-wrap gap-2">
                  <div className="flex-1 min-w-40">
                    <input
                      dir="ltr"
                      value={vin}
                      onChange={(e) => setVin(e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17))}
                      placeholder="VF1BR1V0H12345678"
                      aria-label="VIN"
                      className={`w-full px-3 min-h-tap rounded-xl border text-base font-mono tracking-wider outline-none ${
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
                    {t("vp.vinCta")}
                  </button>
                </form>
              </HelpCard>

              <HelpCard title={t("vp.expertTitle")} hint={t("vp.expertHint")} icon={<IconChat />}>
                <a
                  href={contactUrl}
                  {...(contactUrl.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
                  onClick={() => track("whatsapp_clicked", { source: "picker_expert" })}
                  className="inline-flex items-center gap-2 min-h-tap px-4 rounded-xl bg-green-700 hover:bg-green-800 text-white text-sm font-semibold"
                >
                  {t("vp.expertCta")}
                </a>
              </HelpCard>

              {/* People arrive expecting to type their plate, because the
                  European catalogues offer it. Saying why we don't costs two
                  lines and stops the shopper hunting for a box that isn't
                  there. It is a note, not a card — nothing to click. */}
              <p className="text-xs text-gray-500 leading-relaxed px-1">
                <span className="font-semibold text-gray-600">{t("vp.plateTitle")}</span>{" "}
                {t("vp.plateHint")}
              </p>
            </div>
          )}
        </div>

        {/* A way out of every screen, not just the first one.
            Somebody who cannot find their car in the list should be able to
            keep shopping from wherever they gave up, rather than backing out
            step by step to reach the one link that let them through. */}
        {path !== "choose" && (
          <footer className="shrink-0 border-t border-gray-100 px-3 py-2 text-center">
            <button
              type="button"
              onClick={onClose}
              className="min-h-tap-compact px-3 text-sm text-gray-500 hover:text-navy-950 underline underline-offset-2"
            >
              {t("vp.skip")}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

/** "2012–2019", or "2012–…" while the model is still made. Never invented: an
 *  unknown start year prints nothing at all. */
function yearsOf(m: Model): string | null {
  return m.yearFrom ? `${m.yearFrom}–${m.yearTo ?? "…"}` : null;
}

/* ------------------------------------------------------------------ bits -- */

function SectionHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-2">
      <h3 className="text-xs font-display font-bold uppercase tracking-wide text-gray-500">{title}</h3>
      {hint && <p className="text-xs text-gray-500 mt-1 leading-snug">{hint}</p>}
    </div>
  );
}

/**
 * A manufacturer's logo, or its initials.
 *
 * The logo is uploaded from /admin/catalogue/vehicules and none has been yet,
 * so today every one of these is a monogram. That is the point: fetching
 * manufacturer logos from the web would put someone else's trademarks on our
 * pages without a licence, and a grey square would tell the shopper nothing.
 * Initials are ours, they are legible at 30px, and they disappear the moment a
 * real logo is uploaded.
 */
function MakeMark({ make, size = 44 }: { make: Make; size?: number }) {
  return (
    <span
      className="relative shrink-0 grid place-items-center overflow-hidden rounded-lg bg-slate-100"
      style={{ width: size, height: size }}
    >
      {make.logoUrl ? (
        <Image src={make.logoUrl} alt="" fill sizes={`${size}px`} className="object-contain p-1" />
      ) : (
        <span
          aria-hidden="true"
          className="font-heading font-extrabold text-navy-800/70 leading-none"
          style={{ fontSize: Math.round(size * 0.4) }}
        >
          {make.name.slice(0, 2).toUpperCase()}
        </span>
      )}
    </span>
  );
}

function BigChoice({
  onClick, icon, title, hint, primary = false,
}: {
  onClick: () => void; icon: React.ReactNode; title: string; hint: string; primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3.5 p-4 rounded-2xl border text-start transition ${
        primary
          ? "border-navy-900 bg-navy-900 text-white hover:bg-navy-800"
          : "border-gray-200 bg-white hover:border-navy-900"
      }`}
    >
      <span className={`shrink-0 grid place-items-center w-11 h-11 rounded-xl ${primary ? "bg-white/15" : "bg-gray-100 text-navy-900"}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-[15px] leading-tight">{title}</span>
        <span className={`block text-xs mt-0.5 ${primary ? "text-white/70" : "text-gray-600"}`}>{hint}</span>
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className={`shrink-0 rtl:rotate-180 ${primary ? "text-white/70" : "text-gray-400"}`} aria-hidden="true">
        <path d="m9 5 7 7-7 7" />
      </svg>
    </button>
  );
}

function HelpCard({
  title, hint, icon, children,
}: { title: string; hint: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 p-4">
      <div className="flex items-start gap-3 mb-3">
        <span className="shrink-0 grid place-items-center w-9 h-9 rounded-xl bg-gray-100 text-navy-900">{icon}</span>
        <div className="min-w-0">
          <h3 className="font-semibold text-[15px] text-navy-950 leading-tight">{title}</h3>
          <p className="text-xs text-gray-600 mt-0.5">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function NoMatch({ onHelp }: { onHelp: () => void }) {
  const { t } = useLocale();
  return (
    <div className="text-center py-10 px-4">
      <p className="font-semibold text-navy-950">{t("vp.noMatch")}</p>
      <p className="text-sm text-gray-600 mt-1 mb-4">{t("vp.noMatchHint")}</p>
      <button
        type="button"
        onClick={onHelp}
        className="inline-flex items-center min-h-tap px-5 rounded-xl border border-gray-300 text-navy-900 text-sm font-semibold hover:border-navy-900"
      >
        {t("vp.dontTitle")}
      </button>
    </div>
  );
}

function Stroke({ children, size = 20 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
      {children}
    </svg>
  );
}
function IconCar() {
  return (
    <Stroke>
      <path d="M5 17h14M4 17v-4.2L6 7h12l2 5.8V17" />
      <path d="M4 17v2h3v-2M17 17v2h3v-2" />
      <circle cx="7.5" cy="13.5" r=".8" /><circle cx="16.5" cy="13.5" r=".8" />
    </Stroke>
  );
}
function IconHelp() {
  return <Stroke><circle cx="12" cy="12" r="9" /><path d="M9.2 9.3a2.9 2.9 0 0 1 5.6 1c0 2-2.8 2.4-2.8 4" /><path d="M12 17.5h.01" /></Stroke>;
}
function IconCard() {
  return <Stroke size={18}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9.5h5M7 13h8M7 16h4" /></Stroke>;
}
function IconHash() {
  return <Stroke size={18}><path d="M10 3 8 21M16 3l-2 18M3.5 8.5h17M3 15.5h17" /></Stroke>;
}
function IconChat() {
  return <Stroke size={18}><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 21l1.9-5A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4Z" /></Stroke>;
}
function IconCamera() {
  return (
    <Stroke size={17}>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.2-2h8.2l1.2 2h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5Z" />
      <circle cx="12" cy="13" r="3.4" />
    </Stroke>
  );
}
