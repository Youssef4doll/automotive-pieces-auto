"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { uploadMakeLogo, removeMakeLogo, type VehicleActionState } from "@/app/actions/vehicles";

export type AdminMake = {
  id: string;
  name: string;
  logoUrl: string | null;
  modelCount: number;
};

/**
 * One logo per make covers every model under it on the home page's
 * "Les véhicules que nous couvrons" cards — see VehicleShortcuts. Editing a
 * make's name isn't offered here: the taxonomy is seeded from the shop's
 * real vehicle list, and this screen's only job is the picture.
 */
export default function VehicleMakeManager({ makes }: { makes: AdminMake[] }) {
  return (
    <div className="flex flex-col gap-2">
      {makes.map((m) => (
        <MakeRow key={m.id} make={m} />
      ))}
    </div>
  );
}

function MakeRow({ make }: { make: AdminMake }) {
  const [state, action, pending] = useActionState<VehicleActionState, FormData>(uploadMakeLogo, undefined);
  const [removing, startRemove] = useTransition();
  const [preview, setPreview] = useState<string | null>(make.logoUrl);
  const objectUrl = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    if (!file) return;
    objectUrl.current = URL.createObjectURL(file);
    setPreview(objectUrl.current);
  };

  return (
    <div data-make={make.id} className="flex flex-wrap items-center gap-3 border border-gray-200 rounded-xl bg-white px-3 py-2.5">
      <span className="relative shrink-0 w-11 h-11 rounded-lg overflow-hidden bg-gray-50">
        {preview && (
          <Image src={preview} alt="" fill sizes="44px" className="object-contain p-1" unoptimized={preview.startsWith("blob:")} />
        )}
      </span>

      <div className="min-w-32">
        <p className="font-heading font-bold uppercase text-navy-950">{make.name}</p>
        <p className="text-xs text-gray-600">{make.modelCount} modèle(s)</p>
      </div>

      <form ref={formRef} action={action} className="flex items-center gap-2 ms-auto">
        <input type="hidden" name="makeId" value={make.id} />
        <input
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={onPick}
          className="text-xs file:me-2 file:min-h-tap-compact file:px-3 file:rounded-lg file:border-0 file:bg-navy-900 file:text-white file:font-display file:font-bold file:uppercase file:text-[11px]"
        />
        <button
          disabled={pending}
          className="min-h-tap-compact px-3 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 font-display font-bold uppercase text-xs tracking-wide disabled:opacity-60"
        >
          {pending ? "…" : "Téléverser"}
        </button>
        {make.logoUrl && (
          <button
            type="button"
            disabled={removing}
            onClick={() => {
              startRemove(async () => {
                await removeMakeLogo(make.id);
                setPreview(null);
              });
            }}
            className="min-h-tap-compact px-3 rounded-lg border border-gray-200 text-gray-600 hover:text-red-600 hover:border-red-200 text-xs font-semibold disabled:opacity-50"
          >
            Retirer
          </button>
        )}
      </form>

      {state?.error && <p className="w-full text-xs text-red-600">{state.error}</p>}
    </div>
  );
}
