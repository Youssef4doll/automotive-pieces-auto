"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  uploadMakeLogo, removeMakeLogo,
  upsertMake, deleteMake,
  upsertModel, deleteModel,
  upsertEngine, deleteEngine,
  type VehicleActionState,
} from "@/app/actions/vehicles";

export type AdminEngine = {
  id: string;
  name: string;
  fuel: string | null;
  engineCode: string | null;
  powerHp: number | null;
  displacementCc: number | null;
  yearFrom: number | null;
  yearTo: number | null;
  fitmentCount: number;
};

export type AdminModel = {
  id: string;
  name: string;
  slug: string;
  yearFrom: number | null;
  yearTo: number | null;
  engines: AdminEngine[];
};

export type AdminMake = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  models: AdminModel[];
};

/**
 * The vehicle tree, editable.
 *
 * It used to be seeded once and read-only apart from the logo, which meant the
 * shop could not add the car that had just driven in. Three levels, each with
 * the same shape: a row you can rename, a form to add one, and a delete that
 * refuses while parts are attached — the fitment rows underneath an engine are
 * compatibility data nobody can reconstruct from memory, so they are never
 * cascaded away quietly.
 */
export default function VehicleMakeManager({ makes }: { makes: AdminMake[] }) {
  const [openMake, setOpenMake] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <NewMakeForm />
      <div className="flex flex-col gap-2">
        {makes.map((m) => (
          <MakeRow key={m.id} make={m} open={openMake === m.id} onToggle={() => setOpenMake(openMake === m.id ? null : m.id)} />
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- makes -- */

function NewMakeForm() {
  const [state, action, pending] = useActionState<VehicleActionState, FormData>(upsertMake, undefined);
  const [name, setName] = useState("");
  useEffect(() => { if (state?.ok) setName(""); }, [state]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2 border border-gray-200 rounded-xl bg-white px-3 py-3">
      <label className="flex-1 min-w-40 flex flex-col gap-1.5">
        <span className="text-xs font-display font-bold uppercase tracking-wide text-navy-900/45">Nouvelle marque</span>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Dacia"
          className="w-full min-h-tap px-3 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500"
        />
      </label>
      <button disabled={pending} className="min-h-tap px-4 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 font-display font-bold uppercase text-xs tracking-wide disabled:opacity-60">
        {pending ? "…" : "Ajouter"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function MakeRow({ make, open, onToggle }: { make: AdminMake; open: boolean; onToggle: () => void }) {
  const [logoState, logoAction, logoPending] = useActionState<VehicleActionState, FormData>(uploadMakeLogo, undefined);
  const [nameState, nameAction, namePending] = useActionState<VehicleActionState, FormData>(upsertMake, undefined);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<VehicleActionState>(undefined);
  const [name, setName] = useState(make.name);
  const [preview, setPreview] = useState<string | null>(make.logoUrl);
  const objectUrl = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => { if (logoState?.ok) formRef.current?.reset(); }, [logoState]);
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    if (!file) return;
    objectUrl.current = URL.createObjectURL(file);
    setPreview(objectUrl.current);
  };

  const engineCount = make.models.reduce((n, m) => n + m.engines.length, 0);
  const fitmentCount = make.models.reduce((n, m) => n + m.engines.reduce((k, e) => k + e.fitmentCount, 0), 0);

  return (
    <div data-make={make.id} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
        <span className="relative shrink-0 w-11 h-11 rounded-lg overflow-hidden bg-gray-50">
          {preview && (
            <Image src={preview} alt="" fill sizes="44px" className="object-contain p-1" unoptimized={preview.startsWith("blob:")} />
          )}
        </span>

        <form action={nameAction} className="flex items-center gap-2 min-w-40">
          <input type="hidden" name="id" value={make.id} />
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label={`Nom de ${make.name}`}
            className="w-36 min-h-tap-compact px-2 rounded-lg border border-transparent hover:border-navy-900/15 focus:border-gold-500 font-heading font-bold uppercase text-navy-950 text-sm outline-none"
          />
          {name !== make.name && (
            <button disabled={namePending} className="min-h-tap-compact px-2.5 rounded-lg bg-navy-900 text-white text-[11px] font-display font-bold uppercase disabled:opacity-60">
              {namePending ? "…" : "OK"}
            </button>
          )}
        </form>

        <p className="text-xs text-gray-600">
          {make.models.length} modèle(s) · {engineCount} motorisation(s)
          {fitmentCount > 0 && ` · ${fitmentCount} compatibilité(s)`}
        </p>

        <form ref={formRef} action={logoAction} className="flex items-center gap-2 ms-auto">
          <input type="hidden" name="makeId" value={make.id} />
          <input
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
            onChange={onPick}
            title="Logo de la marque — SVG conseillé, ou JPEG, PNG, WebP, AVIF"
            className="text-xs max-w-52 file:me-2 file:min-h-tap-compact file:px-3 file:rounded-lg file:border-0 file:bg-navy-900 file:text-white file:font-display file:font-bold file:uppercase file:text-[11px]"
          />
          <button
            disabled={logoPending}
            className="min-h-tap-compact px-3 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 font-display font-bold uppercase text-xs tracking-wide disabled:opacity-60"
          >
            {logoPending ? "…" : "Téléverser"}
          </button>
          {make.logoUrl && (
            <button
              type="button"
              disabled={busy}
              onClick={() => start(async () => { setMsg(await removeMakeLogo(make.id)); setPreview(null); })}
              className="min-h-tap-compact px-3 rounded-lg border border-gray-200 text-gray-600 hover:text-red-600 hover:border-red-200 text-xs font-semibold disabled:opacity-50"
            >
              Retirer
            </button>
          )}
        </form>

        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="min-h-tap-compact px-3 rounded-lg border border-gray-200 text-navy-900 text-xs font-semibold hover:border-navy-900"
        >
          {open ? "Fermer" : "Modèles"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => start(async () => setMsg(await deleteMake(make.id)))}
          className="min-h-tap-compact px-3 rounded-lg border border-gray-200 text-gray-600 hover:text-red-600 hover:border-red-200 text-xs font-semibold disabled:opacity-50"
        >
          Supprimer
        </button>
      </div>

      <Feedback state={logoState} className="px-3 pb-2" />
      <Feedback state={nameState} className="px-3 pb-2" />
      <Feedback state={msg} className="px-3 pb-2" />

      {open && (
        <div className="border-t border-gray-100 bg-gray-50/60 p-3 flex flex-col gap-2">
          <NewModelForm makeId={make.id} />
          {make.models.length === 0 && <p className="text-sm text-gray-500">Aucun modèle pour cette marque.</p>}
          {make.models.map((m) => (
            <ModelRow key={m.id} model={m} makeId={make.id} />
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- models -- */

function NewModelForm({ makeId }: { makeId: string }) {
  const [state, action, pending] = useActionState<VehicleActionState, FormData>(upsertModel, undefined);
  const [v, setV] = useState({ name: "", yearFrom: "", yearTo: "" });
  useEffect(() => { if (state?.ok) setV({ name: "", yearFrom: "", yearTo: "" }); }, [state]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2.5">
      <input type="hidden" name="makeId" value={makeId} />
      <Small label="Nouveau modèle" width="w-40">
        <input name="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Clio IV" className={INPUT} />
      </Small>
      <Small label="De" width="w-20">
        <input name="yearFrom" inputMode="numeric" value={v.yearFrom} onChange={(e) => setV({ ...v, yearFrom: e.target.value })} placeholder="2012" className={INPUT} />
      </Small>
      <Small label="À" width="w-20">
        <input name="yearTo" inputMode="numeric" value={v.yearTo} onChange={(e) => setV({ ...v, yearTo: e.target.value })} placeholder="2019" className={INPUT} />
      </Small>
      <button disabled={pending} className="min-h-tap-compact px-3 rounded-lg bg-navy-900 hover:bg-navy-800 text-white font-display font-bold uppercase text-[11px] tracking-wide disabled:opacity-60">
        {pending ? "…" : "Ajouter"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function ModelRow({ model, makeId }: { model: AdminModel; makeId: string }) {
  const [state, action, pending] = useActionState<VehicleActionState, FormData>(upsertModel, undefined);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<VehicleActionState>(undefined);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({
    name: model.name,
    yearFrom: model.yearFrom?.toString() ?? "",
    yearTo: model.yearTo?.toString() ?? "",
  });
  const dirty = v.name !== model.name || v.yearFrom !== (model.yearFrom?.toString() ?? "") || v.yearTo !== (model.yearTo?.toString() ?? "");
  const fitments = model.engines.reduce((n, e) => n + e.fitmentCount, 0);

  return (
    <div data-model={model.id} className="rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-end gap-2 px-3 py-2.5">
        <form action={action} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={model.id} />
          <input type="hidden" name="makeId" value={makeId} />
          <Small label="Modèle" width="w-40">
            <input name="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={INPUT} />
          </Small>
          <Small label="De" width="w-20">
            <input name="yearFrom" inputMode="numeric" value={v.yearFrom} onChange={(e) => setV({ ...v, yearFrom: e.target.value })} className={INPUT} />
          </Small>
          <Small label="À" width="w-20">
            <input name="yearTo" inputMode="numeric" value={v.yearTo} onChange={(e) => setV({ ...v, yearTo: e.target.value })} className={INPUT} />
          </Small>
          {dirty && (
            <button disabled={pending} className="min-h-tap-compact px-3 rounded-lg bg-navy-900 text-white text-[11px] font-display font-bold uppercase disabled:opacity-60">
              {pending ? "…" : "Enregistrer"}
            </button>
          )}
        </form>

        <span className="text-xs text-gray-600 ms-auto">
          {model.engines.length} motorisation(s){fitments > 0 && ` · ${fitments} compatibilité(s)`}
        </span>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="min-h-tap-compact px-3 rounded-lg border border-gray-200 text-navy-900 text-xs font-semibold hover:border-navy-900"
        >
          {open ? "Fermer" : "Motorisations"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => start(async () => setMsg(await deleteModel(model.id)))}
          className="min-h-tap-compact px-3 rounded-lg border border-gray-200 text-gray-600 hover:text-red-600 hover:border-red-200 text-xs font-semibold disabled:opacity-50"
        >
          Supprimer
        </button>
      </div>

      <Feedback state={state} className="px-3 pb-2" />
      <Feedback state={msg} className="px-3 pb-2" />

      {open && (
        <div className="border-t border-gray-100 p-3 flex flex-col gap-2 bg-gray-50/60">
          <NewEngineForm modelId={model.id} />
          {model.engines.length === 0 && <p className="text-sm text-gray-500">Aucune motorisation.</p>}
          {model.engines.map((e) => (
            <EngineRow key={e.id} engine={e} modelId={model.id} />
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- engines -- */

function NewEngineForm({ modelId }: { modelId: string }) {
  const [state, action, pending] = useActionState<VehicleActionState, FormData>(upsertEngine, undefined);
  const [v, setV] = useState({ name: "", fuel: "", engineCode: "", powerHp: "" });
  useEffect(() => { if (state?.ok) setV({ name: "", fuel: "", engineCode: "", powerHp: "" }); }, [state]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2.5">
      <input type="hidden" name="modelId" value={modelId} />
      <Small label="Motorisation" width="w-32">
        <input name="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="1.5 dCi" className={INPUT} />
      </Small>
      <Small label="Carburant" width="w-28">
        <select name="fuel" value={v.fuel} onChange={(e) => setV({ ...v, fuel: e.target.value })} className={INPUT}>
          <option value="">—</option>
          <option value="diesel">Diesel</option>
          <option value="essence">Essence</option>
          <option value="hybride">Hybride</option>
          <option value="electrique">Électrique</option>
        </select>
      </Small>
      <Small label="Code moteur" width="w-24">
        <input name="engineCode" value={v.engineCode} onChange={(e) => setV({ ...v, engineCode: e.target.value })} placeholder="K9K" className={INPUT} />
      </Small>
      <Small label="Ch" width="w-16">
        <input name="powerHp" inputMode="numeric" value={v.powerHp} onChange={(e) => setV({ ...v, powerHp: e.target.value })} placeholder="90" className={INPUT} />
      </Small>
      <button disabled={pending} className="min-h-tap-compact px-3 rounded-lg bg-navy-900 hover:bg-navy-800 text-white font-display font-bold uppercase text-[11px] tracking-wide disabled:opacity-60">
        {pending ? "…" : "Ajouter"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function EngineRow({ engine, modelId }: { engine: AdminEngine; modelId: string }) {
  const [state, action, pending] = useActionState<VehicleActionState, FormData>(upsertEngine, undefined);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<VehicleActionState>(undefined);
  const [v, setV] = useState({
    name: engine.name,
    fuel: engine.fuel ?? "",
    engineCode: engine.engineCode ?? "",
    powerHp: engine.powerHp?.toString() ?? "",
  });
  const dirty =
    v.name !== engine.name ||
    v.fuel !== (engine.fuel ?? "") ||
    v.engineCode !== (engine.engineCode ?? "") ||
    v.powerHp !== (engine.powerHp?.toString() ?? "");

  return (
    <div data-engine={engine.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
      <div className="flex flex-wrap items-end gap-2">
        <form action={action} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={engine.id} />
          <input type="hidden" name="modelId" value={modelId} />
          <Small label="Motorisation" width="w-32">
            <input name="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={INPUT} />
          </Small>
          <Small label="Carburant" width="w-28">
            <select name="fuel" value={v.fuel} onChange={(e) => setV({ ...v, fuel: e.target.value })} className={INPUT}>
              <option value="">—</option>
              <option value="diesel">Diesel</option>
              <option value="essence">Essence</option>
              <option value="hybride">Hybride</option>
              <option value="electrique">Électrique</option>
            </select>
          </Small>
          <Small label="Code moteur" width="w-24">
            <input name="engineCode" value={v.engineCode} onChange={(e) => setV({ ...v, engineCode: e.target.value })} className={INPUT} />
          </Small>
          <Small label="Ch" width="w-16">
            <input name="powerHp" inputMode="numeric" value={v.powerHp} onChange={(e) => setV({ ...v, powerHp: e.target.value })} className={INPUT} />
          </Small>
          {dirty && (
            <button disabled={pending} className="min-h-tap-compact px-3 rounded-lg bg-navy-900 text-white text-[11px] font-display font-bold uppercase disabled:opacity-60">
              {pending ? "…" : "Enregistrer"}
            </button>
          )}
        </form>

        <span className="text-xs text-gray-600 ms-auto">
          {engine.fitmentCount > 0 ? `${engine.fitmentCount} pièce(s) compatible(s)` : "aucune pièce liée"}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => start(async () => setMsg(await deleteEngine(engine.id)))}
          className="min-h-tap-compact px-3 rounded-lg border border-gray-200 text-gray-600 hover:text-red-600 hover:border-red-200 text-xs font-semibold disabled:opacity-50"
        >
          Supprimer
        </button>
      </div>
      <Feedback state={state} />
      <Feedback state={msg} />
    </div>
  );
}

/* ---------------------------------------------------------------- bits -- */

const INPUT =
  "w-full min-h-tap-compact px-2 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500";

function Small({ label, width, children }: { label: string; width: string; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1 ${width}`}>
      <span className="text-[10px] font-display font-bold uppercase tracking-wide text-navy-900/40">{label}</span>
      {children}
    </label>
  );
}

function Feedback({ state, className = "" }: { state: VehicleActionState; className?: string }) {
  if (!state?.error && !state?.ok) return null;
  return (
    <p
      role={state.error ? "alert" : "status"}
      className={`w-full text-xs ${state.error ? "text-red-700" : "text-green-800"} ${className}`}
    >
      {state.error ?? state.ok}
    </p>
  );
}
