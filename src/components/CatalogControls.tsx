"use client";

import { useRouter } from "next/navigation";

export default function CatalogControls({
  basePath,
  activeBrandSlug,
  activeSort,
}: {
  basePath: string;
  activeBrandSlug?: string;
  activeSort?: string;
}) {
  const router = useRouter();

  function onSortChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams();
    if (activeBrandSlug) params.set("brand", activeBrandSlug);
    if (e.target.value) params.set("sort", e.target.value);
    router.push(`${basePath}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="flex items-center justify-between mb-4 gap-3">
      {activeBrandSlug ? (
        <a
          href={`${basePath}${activeSort ? `?sort=${activeSort}` : ""}`}
          className="text-xs px-2.5 py-1.5 rounded-full bg-navy-900 text-white font-medium"
        >
          {activeBrandSlug} ✕
        </a>
      ) : (
        <span />
      )}
      <select
        defaultValue={activeSort ?? ""}
        onChange={onSortChange}
        className="text-sm border border-gray-300 rounded-lg px-2.5 min-h-tap outline-none"
      >
        <option value="">Popularité</option>
        <option value="price-asc">Prix croissant</option>
        <option value="price-desc">Prix décroissant</option>
      </select>
    </div>
  );
}
