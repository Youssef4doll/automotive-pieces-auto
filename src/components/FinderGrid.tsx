"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/i18n/LocaleProvider";
import { decodeVinMakeSlug, isValidVinFormat } from "@/lib/vin";
import VehiclePicker from "./VehiclePicker";

export default function FinderGrid({ whatsapp }: { whatsapp: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [presetMake, setPresetMake] = useState<string | undefined>(undefined);

  const [vin, setVin] = useState("");
  const [vinMsg, setVinMsg] = useState<string | null>(null);

  const [ref, setRef] = useState("");
  const [refMsg, setRefMsg] = useState<string | null>(null);

  const [plateSent, setPlateSent] = useState(false);

  function openPicker(makeSlug?: string) {
    setPresetMake(makeSlug);
    setPickerOpen(true);
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
      <h2 className="text-xl sm:text-2xl font-extrabold text-navy-950 mb-5">{t("finder.title")}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => openPicker()}
          className="text-start p-4 rounded-xl border-2 border-gray-200 hover:border-navy-700 bg-white flex flex-col gap-2"
        >
          <span className="text-2xl">🚗</span>
          <span className="font-bold text-navy-900 text-sm">{t("finder.byModel")}</span>
          <span className="text-xs text-gray-500">{t("finder.byModelDesc")}</span>
        </button>

        <div className="p-4 rounded-xl border-2 border-gray-200 bg-white flex flex-col gap-2">
          <span className="text-2xl">📇</span>
          <span className="font-bold text-navy-900 text-sm">{t("finder.byPlate")}</span>
          <span className="text-xs text-gray-500">{t("finder.byPlateDesc")}</span>
          {plateSent ? (
            <span className="text-xs font-semibold text-green-700 mt-1">{t("finder.plateReceived")}</span>
          ) : (
            <label className="mt-1 text-xs font-semibold text-navy-900 bg-gold-500 hover:bg-gold-400 rounded-lg px-3 py-2 text-center cursor-pointer min-h-11 flex items-center justify-center">
              {t("finder.uploadPhoto")}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={() => setPlateSent(true)}
              />
            </label>
          )}
        </div>

        <div className="p-4 rounded-xl border-2 border-gray-200 bg-white flex flex-col gap-2">
          <span className="text-2xl">🔢</span>
          <span className="font-bold text-navy-900 text-sm">{t("finder.byVin")}</span>
          <span className="text-xs text-gray-500">{t("finder.byVinDesc")}</span>
          <form onSubmit={submitVin} className="mt-1 flex flex-col gap-1.5">
            <input
              dir="ltr"
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17))}
              placeholder="VF15R..."
              className={`px-2.5 py-2 text-sm border rounded-lg outline-none font-mono tracking-wider ${
                vin.length === 17 ? "border-green-500" : vin.length > 0 ? "border-amber-400" : "border-gray-300"
              }`}
            />
            <div className="flex items-center justify-between text-[10px] text-gray-400">
              <span>{vin.length}/17</span>
              <button type="submit" className="text-navy-900 font-bold underline">
                {t("hero.searchCta")}
              </button>
            </div>
            {vinMsg && <p className="text-[11px] text-amber-600">{vinMsg}</p>}
          </form>
        </div>

        <div className="p-4 rounded-xl border-2 border-gray-200 bg-white flex flex-col gap-2">
          <span className="text-2xl">🔎</span>
          <span className="font-bold text-navy-900 text-sm">{t("finder.byRef")}</span>
          <span className="text-xs text-gray-500">{t("finder.byRefDesc")}</span>
          <form onSubmit={submitRef} className="mt-1 flex gap-1.5">
            <input
              dir="ltr"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="FL-0810…"
              className="flex-1 min-w-0 px-2.5 py-2 text-sm border border-gray-300 rounded-lg outline-none"
            />
            <button type="submit" className="px-2.5 rounded-lg bg-navy-900 text-white text-xs font-bold shrink-0">
              →
            </button>
          </form>
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
        </div>
      </div>

      {pickerOpen && <VehiclePicker onClose={() => setPickerOpen(false)} initialMakeSlug={presetMake} />}
    </section>
  );
}
