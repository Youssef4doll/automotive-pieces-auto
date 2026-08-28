"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import {
  uploadProductImages,
  deleteProductImage,
  setPrimaryImage,
  type ImageActionState,
} from "@/app/actions/images";

export type AdminImage = { id: string; alt: string };

export default function ProductImageManager({
  productId,
  images,
  fallbackUrl,
}: {
  productId: string;
  images: AdminImage[];
  fallbackUrl: string;
}) {
  const [msg, setMsg] = useState<ImageActionState>(undefined);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function run(fn: () => Promise<ImageActionState>) {
    start(async () => setMsg(await fn()));
  }

  function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    run(async () => {
      const r = await uploadProductImages(productId, fd);
      if (inputRef.current) inputRef.current.value = "";
      return r;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-display font-bold uppercase tracking-wide text-navy-900/45">
        Photos du produit
      </span>

      {msg?.error && (
        <p className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{msg.error}</p>
      )}
      {msg?.ok && (
        <p className="text-sm font-medium text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{msg.ok}</p>
      )}

      {images.length === 0 ? (
        <div className="flex items-center gap-3 p-3 border border-dashed border-gray-300 rounded-lg">
          <Image src={fallbackUrl} alt="" width={64} height={64} className="rounded-md object-cover bg-gray-50" />
          <p className="text-sm text-gray-500">
            Aucune photo propre à ce produit — l&apos;image générique du catalogue est affichée en ligne.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {images.map((img, i) => (
            <li key={img.id} className="relative border border-gray-200 rounded-lg overflow-hidden bg-white">
              <div className="relative aspect-square bg-gray-50">
                <Image src={`/api/images/${img.id}`} alt={img.alt} fill className="object-cover" sizes="160px" />
              </div>
              {i === 0 && (
                <span className="absolute top-1 start-1 bg-navy-900 text-white text-[10px] font-bold uppercase px-1.5 py-0.5 rounded">
                  Principale
                </span>
              )}
              <div className="flex border-t border-gray-100">
                <button
                  type="button"
                  disabled={pending || i === 0}
                  onClick={() => run(() => setPrimaryImage(img.id))}
                  className="flex-1 min-h-tap-compact text-[11px] font-semibold text-navy-900 disabled:opacity-30 hover:bg-gray-50"
                >
                  {i === 0 ? "—" : "Principale"}
                </button>
                <button
                  type="button"
                  aria-label="Supprimer la photo"
                  disabled={pending}
                  onClick={() => run(() => deleteProductImage(img.id))}
                  className="w-tap min-h-tap-compact text-red-600 border-s border-gray-100 hover:bg-red-50 disabled:opacity-30"
                >
                  🗑
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* A plain file input rather than a URL box: the point is that the shop
          owner can put their own photo of the part online from their phone. */}
      <label className="inline-flex flex-col gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          disabled={pending}
          onChange={(e) => onFiles(e.target.files)}
          className="text-sm file:me-3 file:px-4 file:min-h-tap file:rounded-lg file:border-0 file:bg-gold-500 file:text-navy-950 file:font-display file:font-bold file:uppercase file:text-xs file:tracking-wide file:cursor-pointer"
        />
        <span className="text-xs text-gray-500">
          JPEG, PNG, WebP ou AVIF · 4 Mo maximum par photo · 8 photos par produit
          {pending ? " · envoi en cours…" : ""}
        </span>
      </label>
    </div>
  );
}
