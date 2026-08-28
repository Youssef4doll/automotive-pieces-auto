"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/i18n/LocaleProvider";
import { decodeVinMakeSlug, isValidVinFormat } from "@/lib/vin";
import VehiclePicker from "./VehiclePicker";
import { track } from "@/lib/track";

export default function FinderGrid({ whatsapp }: { whatsapp: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [presetMake, setPresetMake] = useState<string | undefined>(undefined);

  const [modelQuery, setModelQuery] = useState("");
  const [vin, setVin] = useState("");
  const [vinMsg, setVinMsg] = useState<string | null>(null);

  const [ref, setRef] = useState("");
  const [refMsg, setRefMsg] = useState<string | null>(null);

  const [plateSent, setPlateSent] = useState(false);

  function openPicker(makeSlug?: string) {
    setPresetMake(makeSlug);
    setPickerOpen(true);
  }

  function submitModel(e: React.FormEvent) {
    e.preventDefault();
    openPicker();
  }

  function submitVin(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidVinFormat(vin)) {
      setVinMsg(t("finder.vinRequired"));
      return;
    }
    const makeSlug = decodeVinMakeSlug(vin);
    if (makeSlug) {
      setVinMsg(null);
      openPicker(makeSlug);
    } else {
      setVinMsg(t("finder.vinNotRecognized"));
    }
  }

  async function submitRef(e: React.FormEvent) {
    e.preventDefault();
    if (!ref.trim()) return;
    const res = await fetch(`/api/reference?q=${encodeURIComponent(ref.trim())}`);
    const data = await res.json();
    if (data.found) {
      router.push(`/produit/${data.slug}`);
    } else {
      setRefMsg(t("empty.whatsapp"));
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-6">
          <h2 className="font-heading font-extrabold uppercase text-xl sm:text-2xl text-navy-950 tracking-tight">
            {t("finder.title")}
          </h2>
          <p className="text-sm text-gray-500">{t("finder.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Par modèle */}
          <div className="flex flex-col gap-2.5">
            <FinderTitle k="finder.byModel" />
            <p className="hidden sm:block text-xs text-gray-500 min-h-8">{t("finder.byModelDesc")}</p>
            <form onSubmit={submitModel}>
              <input
                value={modelQuery}
                onChange={(e) => setModelQuery(e.target.value)}
                placeholder={t("finder.byModelPlaceholder")}
                className="w-full px-3 min-h-tap text-sm border border-gray-300 rounded-lg outline-none focus:border-navy-700"
              />
            </form>
            <button
              onClick={() => openPicker()}
              className="mt-auto w-full min-h-tap rounded-lg bg-navy-900 hover:bg-navy-800 text-white font-display font-bold uppercase text-xs tracking-wide flex items-center justify-center gap-2"
            >
              {t("finder.browse")}
            </button>
          </div>

          {/* Par carte grise */}
          <div className="flex flex-col gap-2.5">
            <FinderTitle k="finder.byPlate" />
            <p className="hidden sm:block text-xs text-gray-500 min-h-8">{t("finder.byPlateDesc")}</p>
            <div className="flex-1" />
            {plateSent ? (
              <span className="text-xs font-semibold text-green-700 py-2.5">{t("finder.plateReceived")}</span>
            ) : (
              <label className="w-full min-h-tap rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 font-display font-bold uppercase text-xs tracking-wide text-center cursor-pointer flex items-center justify-center gap-2">
                {t("finder.uploadPhoto")}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={() => setPlateSent(true)} />
              </label>
            )}
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => track("whatsapp_clicked", { source: "finder_plate" })}
              className="w-full min-h-tap rounded-lg bg-green-600 hover:bg-green-700 text-white font-display font-bold uppercase text-xs tracking-wide text-center flex items-center justify-center gap-2"
            >
              WhatsApp
            </a>
          </div>

          {/* Par VIN */}
          <div className="flex flex-col gap-2.5">
            <FinderTitle k="finder.byVin" />
            <p className="hidden sm:block text-xs text-gray-500 min-h-8">{t("finder.byVinDesc")}</p>
            <form onSubmit={submitVin} className="flex flex-col gap-2.5 flex-1">
              <div>
                <input
                  dir="ltr"
                  value={vin}
                  onChange={(e) => setVin(e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17))}
                  placeholder="VF1BR1V0H12345678"
                  className={`w-full px-3 min-h-tap text-sm border rounded-lg outline-none font-mono tracking-wider ${
                    vin.length === 17 ? "border-green-500" : vin.length > 0 ? "border-amber-400" : "border-gray-300"
                  }`}
                />
                <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                  <span>{vin.length}/17</span>
                </div>
                {vinMsg && <p className="text-[11px] text-amber-600 mt-1">{vinMsg}</p>}
              </div>
              <button
                type="submit"
                disabled={vin.length !== 17}
                className="mt-auto w-full min-h-tap rounded-lg bg-gray-200 enabled:bg-navy-900 disabled:text-gray-400 enabled:text-white enabled:hover:bg-navy-800 font-display font-bold uppercase text-xs tracking-wide"
              >
                {t("finder.identify")}
              </button>
            </form>
          </div>

          {/* Par référence */}
          <div className="flex flex-col gap-2.5">
            <FinderTitle k="finder.byRef" />
            <p className="hidden sm:block text-xs text-gray-500 min-h-8">{t("finder.byRefDesc")}</p>
            <form onSubmit={submitRef} className="flex flex-col gap-2.5 flex-1">
              <input
                dir="ltr"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="EX. FL-0810"
                className="w-full px-3 min-h-tap text-sm border border-gray-300 rounded-lg outline-none focus:border-navy-700"
              />
              {refMsg && (
                <a
                  href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Référence: ${ref}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-green-700 font-semibold underline"
                >
                  {refMsg}
                </a>
              )}
              <button
                type="submit"
                className="mt-auto w-full min-h-tap rounded-lg bg-gray-200 hover:bg-navy-900 hover:text-white text-gray-600 font-display font-bold uppercase text-xs tracking-wide transition"
              >
                {t("finder.search")}
              </button>
            </form>
          </div>
        </div>
      </div>

      {pickerOpen && <VehiclePicker onClose={() => setPickerOpen(false)} initialMakeSlug={presetMake} />}
    </section>
  );
}

function FinderTitle({ k }: { k: "finder.byModel" | "finder.byPlate" | "finder.byVin" | "finder.byRef" }) {
  const { t } = useLocale();
  return <h3 className="font-display font-bold uppercase text-red-500 text-sm tracking-wide">{t(k)}</h3>;
}
