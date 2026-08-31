"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import { upsertPromotion, type PromotionFormState } from "@/app/actions/admin";

const field =
  "w-full px-3 min-h-tap border border-navy-900/15 rounded-lg text-sm outline-none focus:border-gold-500";

export type EditablePromotion = {
  id: string;
  title: string;
  imageUrl: string;
  href: string | null;
  placement: "HERO" | "CAMPAIGN";
  kind: "SEASONAL" | "NEW_ARRIVALS" | "DEAL" | null;
  order: number;
  active: boolean;
};

// Kept in step with next.config.ts's serverActions.bodySizeLimit, minus room
// for multipart overhead. Checked here so an oversized picture is refused
// before it is uploaded rather than after.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Add or edit a banner.
 *
 * The image is uploaded, not typed: the shop is changing artwork every season
 * and should never need to know where files live on the server. A path can
 * still be typed for the pictures that ship with the project.
 */
export default function PromotionForm({
  promo,
  onSaved,
}: {
  promo?: EditablePromotion;
  onSaved?: () => void;
}) {
  const [placement, setPlacement] = useState<"HERO" | "CAMPAIGN">(promo?.placement ?? "CAMPAIGN");
  const [preview, setPreview] = useState<string | null>(promo?.imageUrl ?? null);
  const [fileError, setFileError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // Only object URLs get revoked; the stored /api/images/… path must survive.
  const objectUrl = useRef<string | null>(null);

  // Clearing up after a save happens here rather than in an effect watching
  // `state`: the save is an event, and an effect would also re-fire on any
  // unrelated re-render that happens to see the same successful state.
  const [state, action, pending] = useActionState<PromotionFormState, FormData>(
    async (prev, formData) => {
      const result = await upsertPromotion(prev, formData);
      if (result?.ok) {
        onSaved?.();
        if (!promo) {
          formRef.current?.reset();
          setPreview(null);
        }
      }
      return result;
    },
    undefined,
  );

  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    if (!file) {
      setPreview(promo?.imageUrl ?? null);
      setFileError(null);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setFileError(`« ${file.name} » fait ${(file.size / 1024 / 1024).toFixed(1)} Mo — maximum 4 Mo.`);
      e.target.value = "";
      setPreview(promo?.imageUrl ?? null);
      return;
    }
    setFileError(null);
    objectUrl.current = URL.createObjectURL(file);
    setPreview(objectUrl.current);
  };

  return (
    <form ref={formRef} action={action} className="grid sm:grid-cols-2 gap-3">
      {promo && <input type="hidden" name="id" value={promo.id} />}

      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="text-xs font-semibold text-navy-900/70">
          Titre — sert aussi de texte alternatif de l&rsquo;image
        </span>
        <input
          name="title"
          required
          defaultValue={promo?.title}
          placeholder="Freinage : jusqu'à -25% jusqu'au 30 septembre"
          className={field}
        />
      </label>

      <div className="sm:col-span-2 flex flex-col sm:flex-row gap-4 items-start">
        <div className="relative w-full sm:w-56 aspect-[21/9] shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-navy-900/10">
          {preview ? (
            <Image src={preview} alt="" fill sizes="224px" className="object-cover" unoptimized />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-xs text-navy-900/35">
              Aperçu
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-navy-900/70">
              Image {promo ? "(laisser vide pour garder l'actuelle)" : "— JPEG, PNG, WebP ou AVIF, 4 Mo max"}
            </span>
            <input
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={onPick}
              className="w-full text-sm file:me-3 file:min-h-tap file:px-4 file:rounded-lg file:border-0 file:bg-navy-900 file:text-white file:font-display file:font-bold file:uppercase file:text-xs file:tracking-wide"
            />
            <span className="text-[11px] text-navy-900/45">
              Format conseillé : 1600 × 686 px (21:9). L&rsquo;image est recadrée au centre.
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-navy-900/70">
              …ou un chemin d&rsquo;image du site
            </span>
            <input
              name="imageUrl"
              defaultValue={promo?.imageUrl.startsWith("/images/") ? promo.imageUrl : ""}
              placeholder="/images/storefront.png"
              className={field}
            />
          </label>
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-navy-900/70">Emplacement</span>
        <select
          name="placement"
          value={placement}
          onChange={(e) => setPlacement(e.target.value as "HERO" | "CAMPAIGN")}
          className={field}
        >
          <option value="CAMPAIGN">Carrousel de campagnes (milieu de page)</option>
          <option value="HERO">Bandeau du haut (page d&rsquo;accueil)</option>
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-navy-900/70">Type de campagne</span>
        <select
          name="kind"
          defaultValue={promo?.kind ?? "SEASONAL"}
          disabled={placement !== "CAMPAIGN"}
          className={`${field} disabled:bg-gray-50 disabled:text-navy-900/35`}
        >
          <option value="SEASONAL">Campagne de saison</option>
          <option value="NEW_ARRIVALS">Nouveautés</option>
          <option value="DEAL">Bon plan</option>
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-navy-900/70">Lien (chemin interne, facultatif)</span>
        <input
          name="href"
          defaultValue={promo?.href ?? ""}
          placeholder="/catalogue/freinage"
          className={field}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-navy-900/70">Ordre</span>
        <input
          name="order"
          type="number"
          inputMode="numeric"
          defaultValue={promo?.order ?? 0}
          className={field}
        />
      </label>

      <label className="flex items-center gap-2 sm:col-span-2">
        <input name="active" type="checkbox" defaultChecked={promo?.active ?? true} className="w-5 h-5" />
        <span className="text-sm text-navy-900">Active</span>
      </label>

      {fileError && <p className="sm:col-span-2 text-sm text-red-600">{fileError}</p>}
      {state?.error && <p className="sm:col-span-2 text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="sm:col-span-2 text-sm text-green-700">Bannière enregistrée.</p>}

      <button
        disabled={pending || !!fileError}
        className="sm:col-span-2 min-h-tap px-5 rounded-lg bg-navy-900 hover:bg-navy-800 disabled:opacity-60 text-white font-display font-bold uppercase tracking-wide text-sm"
      >
        {pending ? "…" : promo ? "Enregistrer" : "Ajouter la bannière"}
      </button>
    </form>
  );
}
