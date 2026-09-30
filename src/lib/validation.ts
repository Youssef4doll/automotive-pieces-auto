import { z } from "zod";
import { weakPassword } from "./weak-passwords";

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
 * A Tunisian number is 8 digits, first digit 2–9; the country code and the
 * separators are the customer's business. So "+216 20 445 566", "0021620445566",
 * "20445566" and "20 44 55 66" are the same number — and "204455661" (nine
 * digits, which the first version let through) is not a number at all.
 */
export function tunisianDigits(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00216")) d = d.slice(5);
  else if (d.length === 11 && d.startsWith("216")) d = d.slice(3);
  return /^[2-9]\d{7}$/.test(d) ? d : null;
}

export function phoneProblem(raw: string): string | null {
  const v = raw.trim();
  if (v.length > 30) return "Ce numéro est trop long.";
  if (!tunisianDigits(v)) return "Un numéro tunisien compte 8 chiffres (ex. 20 123 456).";
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

/**
 * A password — at signup, on a reset, on a change. One rule, four callers.
 *
 * Eight characters at least, and not one of the passwords every attacker
 * tries first (lib/weak-passwords). The ceiling is bcrypt's: it reads 72
 * BYTES and silently ignores the rest, so it is counted in bytes — an Arabic
 * password of forty letters is eighty bytes, and past 72 only its start
 * would count.
 *
 * Each refusal carries `params.reason` ("short", "long", "common"), which the
 * app API sends as the field's reason so the phone can say it in its own
 * three languages. Passwords already set under the old six-character rule
 * keep working; the rule applies only when a password is chosen.
 */
export const PASSWORD_MIN = 8;

export const passwordRule = z.string().superRefine((value, ctx) => {
  if (value.length < PASSWORD_MIN) {
    ctx.addIssue({ code: "custom", message: `Le mot de passe doit contenir au moins ${PASSWORD_MIN} caractères.`, params: { reason: "short" } });
  } else if (new TextEncoder().encode(value).length > 72) {
    ctx.addIssue({ code: "custom", message: "Le mot de passe est trop long.", params: { reason: "long" } });
  } else if (weakPassword(value)) {
    ctx.addIssue({
      code: "custom",
      message: "Ce mot de passe est parmi les plus utilisés : choisissez-en un autre.",
      params: { reason: "common" },
    });
  }
});

/** Said when a password is built from the account's own e-mail or name. */
export const PERSONAL_PASSWORD_MESSAGE = "Le mot de passe ne doit pas reprendre votre nom ou votre adresse e-mail.";

/** The same rule, knowing whose password it is — for a schema's own superRefine. */
export function checkPersonalPassword(password: string, person: { email?: string; name?: string }, ctx: z.RefinementCtx, path: string) {
  if (weakPassword(password, person) === "personal") {
    ctx.addIssue({ code: "custom", path: [path], message: PERSONAL_PASSWORD_MESSAGE, params: { reason: "personal" } });
  }
}

/** The `reason` of the first refusal, for the app API's `invalid_field`. */
export function issueReason(issue: z.core.$ZodIssue | undefined): string | undefined {
  const params = (issue as { params?: { reason?: unknown } } | undefined)?.params;
  return typeof params?.reason === "string" ? params.reason : undefined;
}

/**
 * An e-mail address, as stored: trimmed and lower-cased. Addresses are
 * case-insensitive in practice, and an account made as "Sami@…" used to be
 * unreachable by somebody signing in as "sami@…".
 */
export const emailAddress = (message = "Cette adresse e-mail n'est pas valide.") =>
  z.string().trim().toLowerCase().max(200, message).pipe(z.email(message));

/**
 * A new account — the website's signup form and the app's, one rule.
 */
export const signupSchema = z
  .object({
    name: personName,
    email: emailAddress(),
    phone: phoneNumber,
    password: passwordRule,
  })
  .superRefine((d, ctx) => checkPersonalPassword(d.password, { email: d.email, name: d.name }, ctx, "password"));
