"use client";

/**
 * Prints the page it sits on.
 *
 * A client component for one reason: `window.print()`. It hides itself from
 * the printout — a button rendered onto paper is a grey rectangle that means
 * nothing to whoever is holding it.
 *
 * "Imprimer ou enregistrer en PDF" rather than "Télécharger le PDF", because
 * that is honestly what happens: the browser's print dialog offers "Save as
 * PDF" on every desktop platform and iOS, and nothing here generates a PDF
 * server-side. Promising a download and opening a print dialog is a small lie
 * that makes a customer think the button failed.
 */
export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 min-h-tap px-4 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-display font-bold uppercase text-xs tracking-wide transition-colors print:hidden"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 9V3h12v6" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <path d="M6 14h12v7H6z" />
      </svg>
      Imprimer ou enregistrer en PDF
    </button>
  );
}
