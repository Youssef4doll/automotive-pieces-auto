import { z } from "zod";

/**
 * Field rules shared by the signup form and the checkout.
 *
 * They were separate, and both were `min(2)` — which is how the shop ended up
 * with a customer whose name is `ttttt@gmail.com`. That is not a cosmetic
 * problem: the name goes on a delivery note, into the order-confirmation
 * e-mail's greeting, onto the admin's picking list and into the "BONJOUR,
 * TTTTT@GMAIL.COM" header of the account. A driver reads it at the door.
 *
 * The rules are deliberately about *shape*, never about which names are real.
 * Tunisian names are written in Latin and Arabic script, with apostrophes,
 * hyphens and spaces — Ben Salah, Abd el-Kader, M'hamed, بن صالح — and a
 * whitelist of "allowed" characters would reject customers. So: it must have
 * letters in it, and it must not be one of the two things people paste into a
 * name box by accident.
 *
 * **The rules are plain functions and the zod schemas wrap them**, rather than
 * the other way round. The checkout runs them in the browser as the shopper
 * types, and importing a zod schema into a client component would ship zod to
 * every visitor for four string checks.
 */

/** Letters in any script — Latin, Arabic, anything. Not a character class. */
const LETTERS = /\p{L}/gu;

/** The verdict on a name, or null when there is nothing wrong with it. */
export function nameProblem(raw: string): string | null {
  const v = raw.trim();
  if (v.length < 2) return "Indiquez votre nom (au moins 2 caractères).";
  if (v.length > 80) return "Ce nom est trop long.";
  // The reported case, and the common one: the browser offers the e-mail it
  // has remembered and it lands in whichever box has focus.
  if (v.includes("@")) return "Indiquez votre nom, pas une adresse e-mail.";
  if (/https?:\/\/|www\./i.test(v)) return "Indiquez votre nom, pas une adresse web.";
  // "12345" and "...." are not names. Two letters is the floor: initials are
  // legitimate, and a one-letter name is not worth arguing with a customer
  // about at the moment they are trying to pay.
  if ((v.match(LETTERS) ?? []).length < 2) return "Ce nom ne ressemble pas à un nom.";
  return null;
}

/**
 * A Tunisian mobile is 8 digits; the country code and separators are the
 * customer's business. Counted rather than pattern-matched, so "+216 20 445
 * 566", "20445566" and "20 44 55 66" are all the same number.
 */
export function phoneProblem(raw: string): string | null {
  const v = raw.trim();
  if (v.length > 30) return "Ce numéro est trop long.";
  if (v.replace(/\D/g, "").length < 8) return "Un numéro de téléphone compte 8 chiffres.";
  return null;
}

/** The same rule, for a server action. One definition, two callers. */
const fromProblem = (problem: (v: string) => string | null) =>
  z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      const message = problem(value);
      if (message) ctx.addIssue({ code: "custom", message });
    });

export const personName = fromProblem(nameProblem);
export const phoneNumber = fromProblem(phoneProblem);
