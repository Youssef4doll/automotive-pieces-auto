"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { upsertBrand, deleteBrand, type CatalogFormState } from "@/app/actions/catalog";

export type AdminBrand = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isPartsBrand: boolean;
  productCount: number;
};

export default function BrandManager({ brands }: { brands: AdminBrand[] }) {
  const [msg, setMsg] = useState<CatalogFormState>(undefined);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<CatalogFormState>) {
    start(async () => {
      setMsg(await fn());
      setEditing(null);
      setAdding(false);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {msg?.error && (
        <p className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{msg.error}</p>
      )}
      {msg?.ok && (
        <p className="text-sm font-medium text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{msg.ok}</p>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-500">{brands.length} marque(s)</p>
        <button
          onClick={() => { setAdding(!adding); setEditing(null); }}
          className="px-4 min-h-tap rounded-lg bg-navy-900 text-white font-display font-bold uppercase text-xs tracking-wide"
        >
          + Nouvelle marque
        </button>
      </div>

      {adding && (
        <BrandForm onSubmit={(fd) => run(() => upsertBrand(undefined, fd))} pending={pending} onCancel={() => setAdding(false)} />
      )}

      <ul className="flex flex-col gap-2">
        {brands.map((b) => (
          <li key={b.id} className="border border-gray-200 rounded-xl bg-white">
            <div className="flex items-center gap-2 px-3 py-2 flex-wrap">
              {/* The logo, at the size it is worth checking. Uploading one and
                  then having to reopen the form to find out whether it took is
                  the reason this row shows it. */}
              {b.logoUrl ? (
                <span className="relative shrink-0 w-9 h-9 rounded-lg overflow-hidden bg-gray-50 border border-gray-200">
                  <Image src={b.logoUrl} alt="" fill sizes="36px" className="object-contain p-1" />
                </span>
              ) : (
                <span className="shrink-0 w-9 h-9 rounded-lg bg-gray-100 text-gray-400 font-display font-bold text-sm flex items-center justify-center">
                  {b.name[0]?.toUpperCase() ?? "?"}
                </span>
              )}
              <span className="flex-1 min-w-0">
                <span className="font-heading font-bold uppercase text-navy-950">{b.name}</span>
                <span className="text-xs text-gray-600"> /{b.slug} · {b.productCount} prod.</span>
                {!b.isPartsBrand && <span className="ms-2 text-[11px] text-gray-500">(marque véhicule)</span>}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  aria-label="Modifier"
                  onClick={() => setEditing(editing === b.id ? null : b.id)}
                  className="w-tap min-h-tap rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center"
                >
                  ✎
                </button>
                <button
                  type="button"
                  aria-label="Supprimer"
                  disabled={pending}
                  onClick={() => run(() => deleteBrand(b.id))}
                  className="w-tap min-h-tap rounded-lg border border-gray-200 text-red-600 hover:bg-red-50 flex items-center justify-center disabled:opacity-30"
                >
                  🗑
                </button>
              </div>
            </div>
            {editing === b.id && (
              <div className="px-3 pb-3 border-t border-gray-100 pt-3">
                <BrandForm
                  brand={b}
                  onSubmit={(fd) => run(() => upsertBrand(undefined, fd))}
                  pending={pending}
                  onCancel={() => setEditing(null)}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BrandForm({
  brand,
  onSubmit,
  pending,
  onCancel,
}: {
  brand?: AdminBrand;
  onSubmit: (fd: FormData) => void;
  pending: boolean;
  onCancel: () => void;
}) {
  const input = "w-full px-3 min-h-tap border border-navy-900/15 rounded-lg text-sm outline-none focus:border-gold-500";

  // The logo could only be set by typing a path into a text box, which meant
  // in practice that it could not be set: the shop has the manufacturer's PNG
  // or SVG on a laptop, not on the server, and no way to put it there. It is
  // uploaded now, like every other picture on the site.
  const [preview, setPreview] = useState<string | null>(brand?.logoUrl ?? null);
  const [removeChecked, setRemoveChecked] = useState(false);
  const objectUrl = useRef<string | null>(null);

  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);

  const uploaded = !!brand?.logoUrl?.startsWith("/api/images/");

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    if (!file) {
      setPreview(brand?.logoUrl ?? null);
      return;
    }
    setRemoveChecked(false);
    objectUrl.current = URL.createObjectURL(file);
    setPreview(objectUrl.current);
  };

  return (
    <form action={onSubmit} className="flex flex-wrap items-end gap-2 bg-white border border-gray-200 rounded-lg p-3">
      {brand && <input type="hidden" name="id" value={brand.id} />}
      <label className="flex flex-col gap-1 flex-1 min-w-36">
        <span className="text-[11px] font-display font-bold uppercase tracking-wide text-navy-900/45">Nom</span>
        <input name="name" required defaultValue={brand?.name} placeholder="Ex. Bosch" className={input} />
      </label>
      <label className="flex flex-col gap-1 flex-1 min-w-36">
        <span className="text-[11px] font-display font-bold uppercase tracking-wide text-navy-900/45">Lien (auto si vide)</span>
        <input name="slug" defaultValue={brand?.slug} placeholder="bosch" className={input} />
      </label>

      <div className="flex items-end gap-2 w-full sm:w-auto">
        <span className="relative shrink-0 w-11 h-11 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
          {preview && !removeChecked && (
            <Image
              src={preview}
              alt=""
              fill
              sizes="44px"
              className="object-contain p-1"
              unoptimized={preview.startsWith("blob:")}
            />
          )}
        </span>
        <label className="flex flex-col gap-1 flex-1 min-w-36">
          <span className="text-[11px] font-display font-bold uppercase tracking-wide text-navy-900/45">Logo</span>
          <input
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
            onChange={onPickFile}
            className="w-full text-xs file:me-2 file:min-h-tap-compact file:px-3 file:rounded-lg file:border-0 file:bg-navy-900 file:text-white file:font-display file:font-bold file:uppercase file:text-[11px]"
          />
          <span className="text-[10.5px] text-navy-900/40 leading-tight">
            SVG conseillé (net à toutes les tailles) · JPEG, PNG, WebP, AVIF acceptés
          </span>
        </label>
        {brand?.logoUrl && (
          <label className="flex items-center gap-1.5 text-xs text-gray-600 mb-2.5 shrink-0">
            <input
              type="checkbox"
              name="removeLogo"
              checked={removeChecked}
              onChange={(e) => {
                setRemoveChecked(e.target.checked);
                setPreview(e.target.checked ? null : brand.logoUrl);
              }}
            />
            Retirer
          </label>
        )}
      </div>

      {/* Kept for the logos that ship with the project. An uploaded one has no
          path to show here, so the box is left empty and labelled rather than
          reading as "this brand has no logo". */}
      <label className="flex flex-col gap-1 flex-1 min-w-36">
        <span className="text-[11px] font-display font-bold uppercase tracking-wide text-navy-900/45">
          …ou un chemin d&rsquo;image du site
        </span>
        <input
          name="logoUrl"
          defaultValue={uploaded ? "" : brand?.logoUrl ?? ""}
          placeholder="/images/brands/bosch.png"
          className={input}
        />
        {uploaded && (
          <span className="text-[10.5px] text-navy-900/40 leading-tight">
            Logo téléversé — laissez vide pour le conserver.
          </span>
        )}
      </label>

      <label className="flex items-center gap-2 text-sm min-h-tap">
        <input type="checkbox" name="isPartsBrand" defaultChecked={brand?.isPartsBrand ?? true} />
        Marque de pièces
      </label>
      <button
        disabled={pending}
        className="px-4 min-h-tap rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 font-display font-bold uppercase text-xs tracking-wide disabled:opacity-60"
      >
        {pending ? "…" : "Enregistrer"}
      </button>
      <button type="button" onClick={onCancel} className="px-3 min-h-tap text-xs text-gray-500 underline">
        Annuler
      </button>
    </form>
  );
}
