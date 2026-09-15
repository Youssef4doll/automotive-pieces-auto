/**
 * The number formats the analytics screens use.
 *
 * Its own module, with no `"use client"` marker, because both sides need it:
 * the page is a server component that formats values into props, and the chart
 * components are client components that format their own labels. A function
 * exported from a `"use client"` file becomes a client *reference* — the server
 * cannot call it, and the page renders an error boundary saying so.
 *
 * Whole dinars on purpose. `formatTND` in lib/money prints two decimals because
 * an invoice line has to; a ninety-day revenue figure with centimes on it is
 * two digits of noise on a number nobody is going to reconcile.
 */

export const fmtTND = (n: number) =>
  `${n.toLocaleString("fr-TN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} DT`;

export const fmtInt = (n: number) => n.toLocaleString("fr-TN");

/** One decimal only below 10 %, where the difference between 3 % and 3.4 % is
 *  the thing being looked at. */
export const fmtPct = (n: number) => `${(n * 100).toFixed(n >= 0.1 || n <= -0.1 ? 0 : 1)} %`;
