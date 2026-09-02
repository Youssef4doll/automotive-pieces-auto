"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { upsertCategory, deleteCategory, moveCategory, type CatalogFormState } from "@/app/actions/catalog";

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  order: number;
  imageUrl: string | null;
  productCount: number;
  children: {
    id: string;
    name: string;
    slug: string;
    order: number;
    imageUrl: string | null;
    productCount: number;
  }[];
};

/** Small thumbnail used in both the family and subcategory rows. */
function Thumb({ name, imageUrl, size = 32 }: { name: string; imageUrl: string | null; size?: number }) {
  if (imageUrl) {
    return (
      <span
        className="relative shrink-0 rounded-lg overflow-hidden bg-gray-100"
        style={{ width: size, height: size }}
      >
        <Image src={imageUrl} alt="" fill sizes={`${size}px`} className="object-cover" />
      </span>
    );
  }
  // No picture yet: an initial in a plain tile, so a family missing its photo
  // is obvious to the admin at a glance rather than showing a broken image.
  return (
    <span
      className="shrink-0 rounded-lg bg-gray-100 text-gray-500 font-display font-bold flex items-center justify-center"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

export default function CategoryManager({ families }: { families: AdminCategory[] }) {
  const [msg, setMsg] = useState<CatalogFormState>(undefined);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | "root" | null>(null);
  const [pending, start] = useTransition();

  // Every mutation funnels through here so the single banner always reflects
  // the last thing the admin did, including a refusal such as "contains 12
  // products". Server actions revalidate, so the list re-renders on its own.
  function run(fn: () => Promise<CatalogFormState>) {
    start(async () => {
      setMsg(await fn());
      setEditing(null);
      setAdding(null);
    });
  }

  function submit(formData: FormData) {
    run(() => upsertCategory(undefined, formData));
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
        <p className="text-sm text-gray-500">
          {families.length} famille(s) · {families.reduce((n, f) => n + f.children.length, 0)} sous-catégorie(s)
        </p>
        <button
          onClick={() => { setAdding(adding === "root" ? null : "root"); setEditing(null); }}
          className="px-4 min-h-tap rounded-lg bg-navy-900 text-white font-display font-bold uppercase text-xs tracking-wide"
        >
          + Nouvelle famille
        </button>
      </div>

      {adding === "root" && (
        <CategoryForm onSubmit={submit} pending={pending} onCancel={() => setAdding(null)} />
      )}

      <ul className="flex flex-col gap-2">
        {families.map((f, i) => {
          const open = openId === f.id;
          return (
            <li key={f.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
              <div className="flex items-center gap-2 px-3 py-2 flex-wrap">
                <button
                  onClick={() => setOpenId(open ? null : f.id)}
                  className="flex items-center gap-2.5 min-h-tap flex-1 min-w-0 text-start"
                  aria-expanded={open}
                >
                  <span className={`text-gray-600 transition-transform ${open ? "rotate-90" : ""}`}>›</span>
                  <Thumb name={f.name} imageUrl={f.imageUrl} />
                  <span className="font-heading font-bold uppercase text-navy-950 truncate">{f.name}</span>
                  <span className="text-xs text-gray-600 shrink-0">
                    /{f.slug} · {f.children.length} sous-cat. · {f.productCount} prod.
                  </span>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <IconBtn label="Monter" disabled={i === 0 || pending} onClick={() => run(() => moveCategory(f.id, "up"))}>↑</IconBtn>
                  <IconBtn label="Descendre" disabled={i === families.length - 1 || pending} onClick={() => run(() => moveCategory(f.id, "down"))}>↓</IconBtn>
                  <IconBtn label="Modifier" onClick={() => { setEditing(editing === f.id ? null : f.id); setAdding(null); }}>✎</IconBtn>
                  <IconBtn label="Supprimer" danger onClick={() => run(() => deleteCategory(f.id))} disabled={pending}>🗑</IconBtn>
                </div>
              </div>

              {editing === f.id && (
                <div className="px-3 pb-3 border-t border-gray-100 pt-3">
                  <CategoryForm category={f} onSubmit={submit} pending={pending} onCancel={() => setEditing(null)} />
                </div>
              )}

              {open && (
                <div className="border-t border-gray-100 bg-gray-50/60 px-3 py-2 flex flex-col gap-1.5">
                  {f.children.map((c, ci) => (
                    <div key={c.id}>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <Thumb name={c.name} imageUrl={c.imageUrl} size={26} />
                        <span className="flex-1 min-w-0 text-sm text-gray-700 truncate">
                          {c.name}
                          <span className="text-xs text-gray-600"> /{c.slug} · {c.productCount} prod.</span>
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <IconBtn label="Monter" disabled={ci === 0 || pending} onClick={() => run(() => moveCategory(c.id, "up"))}>↑</IconBtn>
                          <IconBtn label="Descendre" disabled={ci === f.children.length - 1 || pending} onClick={() => run(() => moveCategory(c.id, "down"))}>↓</IconBtn>
                          <IconBtn label="Modifier" onClick={() => setEditing(editing === c.id ? null : c.id)}>✎</IconBtn>
                          <IconBtn label="Supprimer" danger disabled={pending} onClick={() => run(() => deleteCategory(c.id))}>🗑</IconBtn>
                        </div>
                      </div>
                      {editing === c.id && (
                        <div className="py-2">
                          <CategoryForm
                            category={c}
                            parentId={f.id}
                            onSubmit={submit}
                            pending={pending}
                            onCancel={() => setEditing(null)}
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {adding === f.id ? (
                    <CategoryForm parentId={f.id} onSubmit={submit} pending={pending} onCancel={() => setAdding(null)} />
                  ) : (
                    <button
                      onClick={() => { setAdding(f.id); setEditing(null); }}
                      className="self-start text-xs font-semibold text-navy-900 underline min-h-tap-compact inline-flex items-center"
                    >
                      + Ajouter une sous-catégorie à « {f.name} »
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CategoryForm({
  category,
  parentId,
  onSubmit,
  pending,
  onCancel,
}: {
  category?: { id: string; name: string; slug: string; imageUrl?: string | null };
  parentId?: string;
  onSubmit: (fd: FormData) => void;
  pending: boolean;
  onCancel: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(category?.imageUrl ?? null);
  const [removeChecked, setRemoveChecked] = useState(false);
  const objectUrl = useRef<string | null>(null);

  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    if (!file) {
      setPreview(category?.imageUrl ?? null);
      return;
    }
    setRemoveChecked(false);
    objectUrl.current = URL.createObjectURL(file);
    setPreview(objectUrl.current);
  };

  return (
    <form action={onSubmit} className="flex flex-wrap items-end gap-2 bg-white border border-gray-200 rounded-lg p-3">
      {category && <input type="hidden" name="id" value={category.id} />}
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <label className="flex flex-col gap-1 flex-1 min-w-40">
        <span className="text-[11px] font-display font-bold uppercase tracking-wide text-navy-900/45">Nom</span>
        <input
          name="name"
          required
          defaultValue={category?.name}
          placeholder="Ex. Freinage"
          className="w-full px-3 min-h-tap border border-navy-900/15 rounded-lg text-sm outline-none focus:border-gold-500"
        />
      </label>
      <label className="flex flex-col gap-1 flex-1 min-w-40">
        <span className="text-[11px] font-display font-bold uppercase tracking-wide text-navy-900/45">
          Lien (auto si vide)
        </span>
        <input
          name="slug"
          defaultValue={category?.slug}
          placeholder="freinage"
          className="w-full px-3 min-h-tap border border-navy-900/15 rounded-lg text-sm outline-none focus:border-gold-500"
        />
      </label>

      <div className="flex items-end gap-2 w-full sm:w-auto">
        <span className="relative shrink-0 w-11 h-11 rounded-lg overflow-hidden bg-gray-100">
          {preview && !removeChecked && (
            <Image src={preview} alt="" fill sizes="44px" className="object-cover" unoptimized={preview.startsWith("blob:")} />
          )}
        </span>
        <label className="flex flex-col gap-1 flex-1 min-w-32">
          <span className="text-[11px] font-display font-bold uppercase tracking-wide text-navy-900/45">Image</span>
          <input
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={onPickFile}
            className="w-full text-xs file:me-2 file:min-h-tap-compact file:px-3 file:rounded-lg file:border-0 file:bg-navy-900 file:text-white file:font-display file:font-bold file:uppercase file:text-[11px]"
          />
        </label>
        {category?.imageUrl && (
          <label className="flex items-center gap-1.5 text-xs text-gray-600 mb-2.5 shrink-0">
            <input
              type="checkbox"
              name="removeImage"
              checked={removeChecked}
              onChange={(e) => {
                setRemoveChecked(e.target.checked);
                if (e.target.checked) setPreview(null);
                else setPreview(category.imageUrl ?? null);
              }}
            />
            Retirer
          </label>
        )}
      </div>

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

function IconBtn({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`w-tap min-h-tap rounded-lg border border-gray-200 text-sm flex items-center justify-center disabled:opacity-30 ${
        danger ? "text-red-600 hover:bg-red-50" : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}
