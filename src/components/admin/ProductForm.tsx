"use client";

import { useActionState } from "react";
import { upsertProduct, type ProductFormState } from "@/app/actions/admin";

type Category = { id: string; name: string; parent: { name: string } | null };
type Brand = { id: string; name: string };

export default function ProductForm({
  product,
  categories,
  brands,
  suggestedName,
}: {
  product?: {
    id: string;
    sku: string;
    name: string;
    categoryId: string;
    brandId: string | null;
    description: string;
    imageUrl?: string;
    axle?: string | null;
    side?: string | null;
    oemRefsText?: string;
    aftermarketRefsText?: string;
    priceBuy: number;
    priceSell: number;
    compareAtPrice: number | null;
    stockQty: number;
    lowStockThreshold: number;
    isTopSeller: boolean;
    active: boolean;
  };
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

  return (
    <form action={action} className="flex flex-col gap-4 max-w-xl">
      {product && <input type="hidden" name="id" value={product.id} />}

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Référence (SKU)">
          <input name="sku" required defaultValue={product?.sku} className="w-full min-h-tap px-3 py-2.5 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500 transition-colors" />
        </Field>
        <Field label="Nom du produit">
          <input name="name" required defaultValue={product?.name ?? suggestedName} className="w-full min-h-tap px-3 py-2.5 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500 transition-colors" />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Catégorie">
          <select name="categoryId" required defaultValue={product?.categoryId} className="w-full min-h-tap px-3 py-2.5 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500 transition-colors">
            <option value="">— Choisir —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parent ? `${c.parent.name} › ${c.name}` : c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Marque">
          <select name="brandId" defaultValue={product?.brandId ?? ""} className="w-full min-h-tap px-3 py-2.5 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500 transition-colors">
            <option value="">—</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Description">
        <textarea name="description" defaultValue={product?.description} rows={3} className="w-full min-h-tap px-3 py-2.5 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500 transition-colors" />
      </Field>

      {/* References are the lookup key of the trade and position is what stops
          a wrong-part delivery — both are structured fields, never parsed back
          out of the product name. */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Références constructeur (OEM)">
          <textarea
            name="oemRefsText"
            rows={2}
            defaultValue={product?.oemRefsText ?? ""}
            placeholder="7701234567, 82 00 123 456"
            className="w-full min-h-tap px-3 py-2.5 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500 transition-colors"
          />
        </Field>
        <Field label="Références équipementier">
          <textarea
            name="aftermarketRefsText"
            rows={2}
            defaultValue={product?.aftermarketRefsText ?? ""}
            placeholder="GDB1330, 0986424815"
            className="w-full min-h-tap px-3 py-2.5 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500 transition-colors"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Essieu">
          <select name="axle" defaultValue={product?.axle ?? ""} className="w-full min-h-tap px-3 py-2.5 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500 transition-colors">
            <option value="">— Sans objet —</option>
            <option value="AVANT">Avant</option>
            <option value="ARRIERE">Arrière</option>
          </select>
        </Field>
        <Field label="Côté">
          <select name="side" defaultValue={product?.side ?? ""} className="w-full min-h-tap px-3 py-2.5 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500 transition-colors">
            <option value="">— Sans objet —</option>
            <option value="GAUCHE">Gauche</option>
            <option value="DROITE">Droite</option>
          </select>
        </Field>
      </div>

      <Field label="Image (chemin — laisser vide pour conserver l'actuelle)">
        <input name="imageUrl" defaultValue={product?.imageUrl ?? ""} placeholder="/images/parts-lineup.png" className="w-full min-h-tap px-3 py-2.5 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500 transition-colors" />
      </Field>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Field label="Prix d'achat (DT)">
          <input name="priceBuy" type="number" step="0.01" min="0" required defaultValue={product?.priceBuy} className="w-full min-h-tap px-3 py-2.5 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500 transition-colors" />
        </Field>
        <Field label="Prix de vente (DT)">
          <input name="priceSell" type="number" step="0.01" min="0" required defaultValue={product?.priceSell} className="w-full min-h-tap px-3 py-2.5 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500 transition-colors" />
        </Field>
        <Field label="Prix barré (opt.)">
          <input name="compareAtPrice" type="number" step="0.01" min="0" defaultValue={product?.compareAtPrice ?? ""} className="w-full min-h-tap px-3 py-2.5 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500 transition-colors" />
        </Field>
        <Field label="Stock">
          <input name="stockQty" type="number" min="0" required defaultValue={product?.stockQty ?? 0} className="w-full min-h-tap px-3 py-2.5 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500 transition-colors" />
        </Field>
      </div>

      <Field label="Seuil stock faible">
        <input name="lowStockThreshold" type="number" min="0" defaultValue={product?.lowStockThreshold ?? 5} className="w-full min-h-tap px-3 py-2.5 rounded-lg border border-navy-900/15 text-sm outline-none focus:border-gold-500 transition-colors max-w-32" />
      </Field>

      {/* The default 13px checkbox is a miss-tap on a phone; the label is the
          real target, so it carries the tap height and the box is scaled up. */}
      <div className="flex gap-6 flex-wrap">
        <label className="flex items-center gap-2 text-sm min-h-tap cursor-pointer">
          <input type="checkbox" name="isTopSeller" defaultChecked={product?.isTopSeller} className="w-[18px] h-[18px]" /> Top vente
        </label>
        <label className="flex items-center gap-2 text-sm min-h-tap cursor-pointer">
          {/* An unchecked checkbox submits nothing at all, and the action read
              "missing" as "keep it active" — so a product could never be taken
              offline. The hidden field always submits a value; when the box is
              ticked the checkbox's "on" comes later and wins. */}
          <input type="hidden" name="active" value="false" />
          <input type="checkbox" name="active" defaultChecked={product?.active ?? true} className="w-[18px] h-[18px]" /> Actif (visible en ligne)
        </label>
      </div>

      {state?.error && <p className="text-sm text-red-600 font-medium">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-700 font-medium">Enregistré ✓</p>}

      <button
        disabled={pending}
        className="self-start px-5 py-3 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 font-display font-bold uppercase tracking-wide disabled:opacity-60"
      >
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>

    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-display font-bold uppercase tracking-wide text-navy-900/45">{label}</span>
      {children}
    </label>
  );
}
