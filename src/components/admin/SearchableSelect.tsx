"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type Option = {
  value: string;
  /** What the admin reads and types against. */
  label: string;
  /** Shown greyed before the label — the family a subcategory belongs to. */
  group?: string | null;
};

/**
 * A select you can type into.
 *
 * The catalogue has sixteen families and well over a hundred subcategories,
 * and a native <select> holding all of them can only be searched by jumping to
 * the first letter — so filing a part under "Éclairage" meant scrolling a list
 * of a hundred and forty options past everything else that starts with E. That
 * is the slowest step in adding a product, repeated for every product.
 *
 * Typing filters instead. Matching folds accents and ignores case, and it
 * matches anywhere in the name rather than only at the start, because the
 * admin remembers the word in the middle ("bougie") as often as the one at the
 * front. A subcategory is matched on its family name too, so typing "frein"
 * finds everything filed under Freinage even when the word is not in the
 * child's own name.
 *
 * The value is submitted through a hidden input, so a form that used this in
 * place of a <select> keeps posting exactly the field it posted before.
 *
 * Keyboard behaviour is the combobox pattern used by the storefront's search
 * suggestions: arrows move, Enter takes the highlighted row, Escape closes and
 * puts back what was selected.
 */
export default function SearchableSelect({
  name,
  options,
  value,
  onChange,
  placeholder = "Rechercher…",
  emptyLabel = "—",
  invalid = false,
  required = false,
}: {
  name: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** The row that clears the field. Omit by passing null to force a choice. */
  emptyLabel?: string | null;
  invalid?: boolean;
  required?: boolean;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const selected = options.find((o) => o.value === value) ?? null;
  const selectedText = selected ? fullLabel(selected) : "";

  const matches = useMemo(() => {
    const q = fold(query);
    if (!q) return options;
    return options.filter((o) => fold(fullLabel(o)).includes(q));
  }, [options, query]);

  // A cleared row only when the field is optional, and only when nothing is
  // being typed — offering "no category" halfway through a search is noise.
  const rows: (Option | null)[] = useMemo(
    () => (emptyLabel !== null && !query ? [null, ...matches] : matches),
    [matches, emptyLabel, query],
  );

  // The highlight resets wherever the list changes — in the handlers, not in
  // an effect watching them. An effect would re-render a second time just to
  // move a number that the event already knew, on every keystroke.
  function openWith(nextQuery: string) {
    setQuery(nextQuery);
    setOpen(true);
    setActive(0);
  }

  // Close on a click outside. Pointerdown rather than click so the list is
  // gone before whatever was clicked reacts.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function close() {
    setOpen(false);
    setQuery("");
    setActive(0);
  }

  function pick(option: Option | null) {
    onChange(option ? option.value : "");
    close();
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        openWith("");
        return;
      }
      setActive((i) => {
        const next = e.key === "ArrowDown" ? i + 1 : i - 1;
        return (next + rows.length) % rows.length;
      });
      return;
    }
    if (e.key === "Enter") {
      // Only when the list is open: Enter on a closed combobox has to keep
      // submitting the form, which is what it does in a plain <select>.
      if (!open) return;
      e.preventDefault();
      if (rows[active] !== undefined) pick(rows[active]);
      return;
    }
    if (e.key === "Escape") {
      if (!open) return;
      e.preventDefault();
      close();
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <input type="hidden" name={name} value={value} />

      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-required={required || undefined}
        aria-activedescendant={open && rows[active] !== undefined ? `${listId}-${active}` : undefined}
        autoComplete="off"
        // Two states in one box: what is chosen when it is closed, what is
        // being typed when it is open. The placeholder carries the selection
        // while typing so the admin can still see what they are replacing.
        value={open ? query : selectedText}
        placeholder={open ? selectedText || placeholder : placeholder}
        onChange={(e) => openWith(e.target.value)}
        onFocus={() => openWith("")}
        onKeyDown={onKeyDown}
        className={`w-full min-h-tap px-3 py-2.5 pe-9 rounded-lg border text-sm outline-none focus:border-gold-500 transition-colors ${
          invalid ? "border-red-400 bg-red-50/40" : "border-navy-900/15"
        }`}
      />

      <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-navy-900/40">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </span>

      {open && (
        <div className="absolute z-50 top-full mt-1 inset-x-0 bg-white rounded-lg border border-gray-200 shadow-xl overflow-hidden">
          {rows.length === 0 ? (
            <p className="px-3 py-3 text-sm text-navy-900/50">Aucun résultat pour « {query} »</p>
          ) : (
            <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto">
              {rows.map((o, i) => (
                <li
                  key={o ? o.value : "__empty"}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={o ? o.value === value : value === ""}
                >
                  <button
                    type="button"
                    // mousedown, not click: the input's blur would otherwise
                    // close the list before the click landed.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(o);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={`w-full text-start px-3 py-2.5 text-sm ${
                      i === active ? "bg-gray-100" : "bg-white"
                    } ${o ? "text-navy-950" : "text-navy-900/50"}`}
                  >
                    {o ? (
                      <>
                        {o.group && <span className="text-navy-900/45">{o.group} › </span>}
                        {o.label}
                      </>
                    ) : (
                      emptyLabel
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const fullLabel = (o: Option) => (o.group ? `${o.group} › ${o.label}` : o.label);

/** Lower-case and strip accents, so "eclairage" finds "Éclairage". */
const fold = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
