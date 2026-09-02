"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { upsertProduct, type ProductFormState } from "@/app/actions/admin";

type Category = { id: string; name: string; parent: { name: string } | null };
type Brand = { id: string; name: string };

export type ProductFormValues = {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  brandId: string;
  description: string;
  imageUrl: string;
  axle: string;
  side: string;
  oemRefsText: string;
  aftermarketRefsText: string;
  priceBuy: string;
  priceSell: string;
  compareAtPrice: string;
  stockQty: string;
  lowStockThreshold: string;
  isTopSeller: boolean;
  active: boolean;
};

const BLANK: ProductFormValues = {
  id: "",
  sku: "",
  name: "",
  categoryId: "",
  brandId: "",
  description: "",
  imageUrl: "",
  axle: "",
  side: "",
  oemRefsText: "",
  aftermarketRefsText: "",
  priceBuy: "",
  priceSell: "",
  compareAtPrice: "",
  stockQty: "0",
  lowStockThreshold: "5",
  isTopSeller: false,
  active: true,
};

export default function ProductForm({
  product,
  categories,
  brands,
  suggestedName,
}: {
  product?: Partial<ProductFormValues> & { id: string };
  categories: Category[];
  brands: Brand[];
  /**
   * Prefill for a brand-new product, carried over from whatever prompted it —
   * today, a customer's failed search. It saves retyping a part name that the
   * admin is looking at on another screen, which is the difference between
   * acting on the buying list and meaning to.
   */
  suggestedName?: string;
}) {
  const [state, action, pending] = useActionState<ProductFormState, FormData>(upsertProduct, undefined);

  // Controlled, not defaultValue. React resets an uncontrolled form the moment
  // its action settles, so one rejected price used to hand back a blank form —
  // the references, the description, the whole entry gone, under a message
  // saying what to correct in a field that no longer held anything. Values
  // live here, and a rejected save repopulates from what the server echoed.
  const [v, setV] = useState<ProductFormValues>({
    ...BLANK,
    ...product,
    ...(suggestedName && !product ? { name: suggestedName } : {}),
  });
  const set = <K extends keyof ProductFormValues>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV((s) => ({ ...s, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  const [photoCount, setPhotoCount] = useState(0);
  const photoRef = useRef<HTMLInputElement>(null);
  const isNew = !product;

  useEffect(() => {
    if (state?.values) {
      setV((s) => ({ ...s, ...(state.values as Partial<ProductFormValues>) }));
    }
    if (state?.ok) {
      setPhotoCount(0);
      if (photoRef.current) photoRef.current.value = "";
      // A new product's form is cleared for the next one; an edit keeps what
      // is on screen, because it now matches what was saved.
      if (isNew) setV(BLANK);
    }
  }, [state, isNew]);

  /** Highlight the exact field the server refused, not the whole form. */
  const bad = (name: string) => (state?.error && state.field === name ? "border-red-500 bg-red-50" : "border-navy-900/15");

  return (
    <form action={action} className="flex flex-col gap-4 max-w-xl">
      {product && <input type="hidden" name="id" value={v.id} />}

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Référence (SKU)">
          <input name="sku" required value={v.sku} onChange={set("sku")} className={`w-full min-h-tap px-3 py-2.5 rounded-lg border text-sm outline-none focus:border-gold-500 transition-colors ${bad("sku")}`} />
        </Field>
        <Field label="Nom du produit" hint={product ? "L'adresse publique suit ce nom ; l'ancienne redirige." : undefined}>
          <input name="name" required value={v.name} onChange={set("name")} className={`w-full min-h-tap px-3 py-2.5 rounded-lg border text-sm outline-none focus:border-gold-500 transition-colors ${bad("name")}`} />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Catégorie">
          <select name="categoryId" required value={v.categoryId} onChange={set("categoryId")} className={`w-full min-h-tap px-3 py-2.5 rounded-lg border text-sm outline-none focus:border-gold-500 transition-colors ${bad("categoryId")}`}>
            <option value="">— Choisir —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parent ? `${c.parent.name} › ${c.name}` : c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Marque">
          <select name="brandId" value={v.brandId} onChange={set("brandId")} className="w-full min-h-tap px-3 py-2.5 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500 transition-colors">
            <option value="">—</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Description">
        <textarea name="description" value={v.description} onChange={set("description")} rows={3} className="w-full min-h-tap px-3 py-2.5 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500 transition-colors" />
      </Field>

      {/* Photos live on this form, not only on the edit screen. Adding a part
          used to mean saving it blind, finding it again in the list and
          opening it a second time just to attach the picture. */}
      <Field
        label="Photos du produit"
        hint="JPEG, PNG, WebP ou AVIF · 4 Mo maximum par photo · 8 par produit"
      >
        <input
          ref={photoRef}
          name="photos"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          onChange={(e) => setPhotoCount(e.target.files?.length ?? 0)}
          className="text-sm file:me-3 file:px-4 file:min-h-tap file:rounded-lg file:border-0 file:bg-gold-500 file:text-navy-950 file:font-display file:font-bold file:uppercase file:text-xs file:tracking-wide file:cursor-pointer"
        />
      </Field>
      {photoCount > 0 && (
        <p className="-mt-2 text-xs text-navy-900/55">
          {photoCount} photo(s) seront ajoutées à l&apos;enregistrement.
        </p>
      )}

      {/* References are the lookup key of the trade and position is what stops
          a wrong-part delivery — both are structured fields, never parsed back
          out of the product name. */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Références constructeur (OEM)">
          <textarea
            name="oemRefsText"
            rows={2}
            value={v.oemRefsText}
            onChange={set("oemRefsText")}
            placeholder="7701234567, 82 00 123 456"
            className="w-full min-h-tap px-3 py-2.5 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500 transition-colors"
          />
        </Field>
        <Field label="Références équipementier">
          <textarea
            name="aftermarketRefsText"
            rows={2}
            value={v.aftermarketRefsText}
            onChange={set("aftermarketRefsText")}
            placeholder="GDB1330, 0986424815"
            className="w-full min-h-tap px-3 py-2.5 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500 transition-colors"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Essieu">
          <select name="axle" value={v.axle} onChange={set("axle")} className="w-full min-h-tap px-3 py-2.5 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500 transition-colors">
            <option value="">— Sans objet —</option>
            <option value="AVANT">Avant</option>
            <option value="ARRIERE">Arrière</option>
          </select>
        </Field>
        <Field label="Côté">
          <select name="side" value={v.side} onChange={set("side")} className="w-full min-h-tap px-3 py-2.5 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500 transition-colors">
            <option value="">— Sans objet —</option>
            <option value="GAUCHE">Gauche</option>
            <option value="DROITE">Droite</option>
          </select>
        </Field>
      </div>

      <Field label="Image (chemin — laisser vide pour conserver l'actuelle)">
        <input name="imageUrl" value={v.imageUrl} onChange={set("imageUrl")} placeholder="/images/parts-lineup.png" className="w-full min-h-tap px-3 py-2.5 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500 transition-colors" />
      </Field>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Field label="Prix d'achat (DT)">
          <input name="priceBuy" type="number" step="0.01" min="0" required value={v.priceBuy} onChange={set("priceBuy")} className={`w-full min-h-tap px-3 py-2.5 rounded-lg border text-sm outline-none focus:border-gold-500 transition-colors ${bad("priceBuy")}`} />
        </Field>
        <Field label="Prix de vente (DT)">
          <input name="priceSell" type="number" step="0.01" min="0" required value={v.priceSell} onChange={set("priceSell")} className={`w-full min-h-tap px-3 py-2.5 rounded-lg border text-sm outline-none focus:border-gold-500 transition-colors ${bad("priceSell")}`} />
        </Field>
        <Field label="Prix barré (opt.)">
          <input name="compareAtPrice" type="number" step="0.01" min="0" value={v.compareAtPrice} onChange={set("compareAtPrice")} className="w-full min-h-tap px-3 py-2.5 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500 transition-colors" />
        </Field>
        <Field label="Stock">
          <input name="stockQty" type="number" min="0" required value={v.stockQty} onChange={set("stockQty")} className={`w-full min-h-tap px-3 py-2.5 rounded-lg border text-sm outline-none focus:border-gold-500 transition-colors ${bad("stockQty")}`} />
        </Field>
      </div>

      <Field label="Seuil stock faible">
        <input name="lowStockThreshold" type="number" min="0" value={v.lowStockThreshold} onChange={set("lowStockThreshold")} className="w-full min-h-tap px-3 py-2.5 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500 transition-colors max-w-32" />
      </Field>

      {/* The default 13px checkbox is a miss-tap on a phone; the label is the
          real target, so it carries the tap height and the box is scaled up. */}
      <div className="flex gap-6 flex-wrap">
        <label className="flex items-center gap-2 text-sm min-h-tap cursor-pointer">
          <input type="checkbox" name="isTopSeller" checked={v.isTopSeller} onChange={set("isTopSeller")} className="w-[18px] h-[18px]" /> Top vente
        </label>
        <label className="flex items-center gap-2 text-sm min-h-tap cursor-pointer">
          {/* An unchecked checkbox submits nothing at all, and the action read
              "missing" as "keep it active" — so a product could never be taken
              offline. The hidden field always submits a value; when the box is
              ticked the checkbox's "on" comes later and wins. */}
          <input type="hidden" name="active" value="false" />
          <input type="checkbox" name="active" checked={v.active} onChange={set("active")} className="w-[18px] h-[18px]" /> Actif (visible en ligne)
        </label>
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {state.error}
          {state.values && <span className="block text-red-600/80 mt-0.5">Rien n&apos;a été perdu — corrigez et réessayez.</span>}
        </p>
      )}
      {state?.ok && !state.error && (
        <p role="status" className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Enregistré ✓
        </p>
      )}

      <button
        disabled={pending}
        className="self-start px-5 py-3 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 font-display font-bold uppercase tracking-wide disabled:opacity-60"
      >
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-display font-bold uppercase tracking-wide text-navy-900/45">{label}</span>
      {children}
      {hint && <span className="text-xs text-navy-900/45">{hint}</span>}
    </label>
  );
}
