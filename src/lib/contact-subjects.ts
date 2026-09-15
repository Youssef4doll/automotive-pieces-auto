/**
 * The subjects the contact form offers.
 *
 * Its own module, not an export from the server action, because a `"use
 * server"` file may only export async functions — Next refuses the build at
 * runtime with "can only export async functions, found object", and the page
 * renders an error boundary instead of a form. The client component and the
 * action's validator both need this list, so it lives somewhere both can
 * import from.
 *
 * A fixed list rather than a free-text subject line: a subject box on a public
 * form is a spam field, and these five are what the shop is actually asked.
 */
export const CONTACT_SUBJECTS = [
  "Compatibilité d'une pièce",
  "Où est ma commande ?",
  "Retour ou échange",
  "Demande de devis",
  "Autre question",
] as const;
