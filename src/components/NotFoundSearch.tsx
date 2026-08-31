"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The search box on the 404 page. Submits to the normal search route so a
 * mistyped reference lands somewhere useful on the very next request.
 */
export default function NotFoundSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const query = q.trim();
        if (query) router.push(`/recherche?q=${encodeURIComponent(query)}`);
      }}
      className="flex flex-col sm:flex-row gap-2"
      role="search"
    >
      <label htmlFor="notfound-q" className="sr-only">
        Rechercher une pièce ou une référence
      </label>
      <input
        id="notfound-q"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Référence, marque ou nom de pièce…"
        className="flex-1 min-h-tap px-4 rounded-xl border border-gray-300 bg-white text-sm outline-none focus:border-navy-700 transition-colors"
      />
      <button
        type="submit"
        className="min-h-tap px-6 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-display font-bold uppercase text-xs tracking-wide transition-colors"
      >
        Rechercher
      </button>
    </form>
  );
}
