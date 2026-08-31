import "server-only";

/**
 * Two cheap signals that cost a real customer nothing.
 *
 * 1. A honeypot field, hidden from people and left empty by them. Most form
 *    spam is a script that fills every input it finds, so a filled honeypot is
 *    close to proof.
 * 2. Time to submit. A person needs seconds to read a form and type into it;
 *    a script posts immediately.
 *
 * Deliberately not a CAPTCHA: this shop sells to people on phones with patchy
 * connections, and a puzzle in front of the checkout costs more real orders
 * than the spam it prevents. If abuse ever gets past this, the honest next
 * step is a challenge on the specific form being abused, not on all of them.
 */

/** Name of the hidden input. Innocuous enough that a bot will want to fill it. */
export const HONEYPOT_FIELD = "company_website";

/** Name of the hidden timestamp input. */
export const TIMESTAMP_FIELD = "form_loaded_at";

/** Faster than this and it was not typed by a person. */
const MIN_SECONDS = 2;

/** Older than this and the page has been sitting open; the signal is stale, not bad. */
const MAX_SECONDS = 60 * 60 * 6;

export type BotVerdict = { human: true } | { human: false; reason: "honeypot" | "too-fast" };

/**
 * The two signals are not equally trustworthy, so they are not applied equally.
 *
 * A filled honeypot is close to proof and blocks everywhere. Timing is weaker:
 * a returning customer whose browser autofills the whole form and who then
 * clicks submit can genuinely be under the threshold, and rejecting them costs
 * a real account. So `useTiming` is opt-in, and callers turn it on only where
 * a false positive is cheap — the newsletter, not the signup form.
 */
export function checkForm(formData: FormData, { useTiming = false } = {}): BotVerdict {
  const trap = formData.get(HONEYPOT_FIELD);
  if (typeof trap === "string" && trap.trim() !== "") {
    return { human: false, reason: "honeypot" };
  }

  if (useTiming) {
    const loadedAt = Number(formData.get(TIMESTAMP_FIELD));
    if (Number.isFinite(loadedAt) && loadedAt > 0) {
      const elapsed = (Date.now() - loadedAt) / 1000;
      // A stale form is not suspicious; only an impossibly fast one is. A clock
      // ahead of the server produces a negative elapsed, also not human.
      if (elapsed < MIN_SECONDS && elapsed > -MAX_SECONDS) {
        return { human: false, reason: "too-fast" };
      }
    }
  }

  return { human: true };
}
