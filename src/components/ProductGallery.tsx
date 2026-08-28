"use client";

import Image from "next/image";
import { useState } from "react";

export type GalleryImage = { src: string; alt: string };

export default function ProductGallery({
  images,
  name,
  discount,
}: {
  images: GalleryImage[];
  name: string;
  discount: number | null;
}) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
        <Image
          key={current.src}
          src={current.src}
          alt={current.alt || name}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover motion-safe:animate-[fade-in_200ms_ease-out]"
          priority
        />
        {discount && (
          <span className="absolute top-3 end-3 bg-red-600 text-white text-xs font-bold px-2.5 py-1.5 rounded">
            -{discount}%
          </span>
        )}
      </div>

      {/* One photo needs no picker — the strip only appears when there is a
          real choice to make. */}
      {images.length > 1 && (
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar">
          <div className="flex gap-2 w-max">
            {images.map((img, i) => (
              <button
                key={img.src}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Photo ${i + 1} sur ${images.length}`}
                aria-current={i === active}
                className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 ${
                  i === active ? "border-navy-900" : "border-gray-200"
                }`}
              >
                <Image src={img.src} alt="" fill sizes="64px" className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
