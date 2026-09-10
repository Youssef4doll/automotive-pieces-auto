"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/track";

export type Suggestion = {
  label: string;
  kind: "reference" | "category" | "brand" | "product";
  href: string;
  hint?: string;
};

const KIND_LABEL: Record<Suggestion["kind"], string> = {
  reference: "Référence",
  category: "Catégorie",
  brand: "Marque",
  product: "Produit",
};

/**
 * Answers already fetched in this tab, keyed by the exact query.
 *
 * Typing is not a straight line: people overshoot and backspace, and every
 * character they delete used to cost another round trip before the list came
 * back. Shared across every mounted search box (the hero, the header, the
 * phone overlay) so moving between them starts warm, and module-level so it
 * survives the components unmounting.
 */
const CACHE = new Map<string, Suggestion[]>();
/** Enough for a long session of typing; old entries are dropped in order. */
const CACHE_MAX = 120;

function remember(q: string, items: Suggestion[]) {
  if (CACHE.has(q)) CACHE.delete(q);
  CACHE.set(q, items);
  if (CACHE.size > CACHE_MAX) CACHE.delete(CACHE.keys().next().value as string);
}

/**
 * How long to wait after a keystroke before asking the server.
 *
 * The endpoint answers in 10-20ms, so the debounce was the whole of the
 * perceived delay: 160ms meant the list arrived a beat after the customer had
 * stopped typing and started reading. 70ms still collapses a fast typist's
 * burst into one request but lands inside the window where the list feels like
 * it was already there.
 */
const DEBOUNCE_MS = 70;

/**
 * Type-ahead for the search boxes.
 *
 * Every row is a real product, category, brand or reference from the catalogue
 * — the endpoint builds them from the database, so nothing offered here leads
 * to an empty results page. Picking one navigates straight to that thing
 * rather than running a text search for its name, which is the difference
 * between a suggestion list and a list of guesses.
 *
 * Keyboard behaviour follows the combobox pattern: arrows move, Enter takes
 * the highlighted row (or submits the raw text when nothing is highlighted),
 * Escape closes without losing what was typed.
 */
export default function SearchSuggest({
  query,
  onPick,
  inputRef,
  align = "left",
}: {
  query: string;
  /** Called after a suggestion is chosen, so the caller can close its overlay. */
  onPick?: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  align?: "left" | "full";
}) {
  const router = useRouter();
  const listId = useId();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced so typing a reference does not fire a request per character,
  // and aborted on the next keystroke so a slow reply cannot overwrite a
  // newer one. A query already answered in this tab skips both and paints
  // synchronously — backspacing through a word should not feel like new work.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }

    const cached = CACHE.get(q);
    if (cached) {
      setItems(cached);
      setActive(-1);
      setOpen(cached.length > 0);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions: Suggestion[] };
        const list = data.suggestions ?? [];
        remember(q, list);
        setItems(list);
        setActive(-1);
        setOpen(list.length > 0);
      } catch {
        /* aborted or offline: leave the previous list alone */
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Close when focus or a click goes elsewhere.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current?.contains(e.target as Node)) return;
      if (inputRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [inputRef]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const go = (s: Suggestion) => {
      setOpen(false);
      onPick?.();
      // Whether shoppers take the suggestions is the only honest measure of
      // whether the suggestions are any good.
      track("autocomplete_selected", { kind: s.kind, label: s.label, query });
      router.push(s.href);
    };

    const onKey = (e: KeyboardEvent) => {
      if (!open || items.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (i + 1) % items.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
      } else if (e.key === "Enter") {
        if (active >= 0 && items[active]) {
          e.preventDefault();
          go(items[active]);
        }
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };

    input.addEventListener("keydown", onKey);
    return () => input.removeEventListener("keydown", onKey);
  }, [open, items, active, inputRef, router, onPick, query]);

  // Wire the input into the combobox so assistive tech follows along.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-expanded", open ? "true" : "false");
    input.setAttribute("aria-controls", listId);
    input.setAttribute("aria-autocomplete", "list");
    if (active >= 0 && items[active]) input.setAttribute("aria-activedescendant", `${listId}-${active}`);
    else input.removeAttribute("aria-activedescendant");
  }, [open, active, items, inputRef, listId]);

  if (!open || items.length === 0) return null;

  return (
    <div
      ref={boxRef}
      className={`absolute z-50 top-full mt-1 bg-white rounded-lg border border-gray-200 shadow-xl overflow-hidden ${
        align === "full" ? "inset-x-0" : "start-0 end-0"
      }`}
    >
      <ul id={listId} role="listbox" aria-label="Suggestions de recherche" className="max-h-[60vh] overflow-y-auto">
        {items.map((s, i) => (
          <li key={`${s.kind}-${s.href}-${s.label}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
            <button
              type="button"
              // mousedown, not click: the input's blur would otherwise close
              // the list before the click landed.
              onMouseDown={(e) => {
                e.preventDefault();
                setOpen(false);
                onPick?.();
                track("autocomplete_selected", { kind: s.kind, label: s.label, query });
                router.push(s.href);
              }}
              onMouseEnter={() => setActive(i)}
              className={`w-full text-start flex items-center gap-3 px-3 min-h-tap py-2 border-b border-gray-100 last:border-b-0 transition-colors ${
                i === active ? "bg-gray-100" : "bg-white"
              }`}
            >
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] text-navy-950 leading-tight truncate">{s.label}</span>
                {s.hint && <span className="block text-[12px] text-gray-500 truncate">{s.hint}</span>}
              </span>
              <span className="shrink-0 text-[11px] uppercase tracking-wide text-gray-600">
                {KIND_LABEL[s.kind]}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
