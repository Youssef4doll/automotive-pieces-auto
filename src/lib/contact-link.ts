/**
 * Building a "contact us" link, without touching the database.
 *
 * `settings.ts` reaches for Prisma, so a client component importing from it
 * would drag the database client into the browser bundle. The channels a
 * customer can be offered are plain strings, so the logic that turns them into
 * an href lives here and both sides import it.
 */

export type ContactChannels = {
  /** Digits only, or null until the owner has entered a number. */
  whatsapp: string | null;
  email: string | null;
};

/**
 * WhatsApp is the channel Tunisian shoppers actually use, so it wins when set;
 * otherwise email, and failing both the store section, which at least says when
 * the shop is open. Never a dead `https://wa.me/` with no number after it.
 */
export function contactLink(contact: ContactChannels, message?: string): string {
  if (contact.whatsapp) {
    const digits = contact.whatsapp.replace(/\D/g, "");
    return message ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : `https://wa.me/${digits}`;
  }
  if (contact.email) {
    return message
      ? `mailto:${contact.email}?subject=${encodeURIComponent(message)}`
      : `mailto:${contact.email}`;
  }
  return "/#magasin";
}

/** True when the link leaves the site, so the caller can set target and rel. */
export function isExternalContact(href: string) {
  return href.startsWith("http") || href.startsWith("mailto:");
}

/** Spread onto an anchor so internal fallbacks do not open a new tab. */
export function contactLinkProps(href: string) {
  return isExternalContact(href) ? ({ target: "_blank", rel: "noreferrer" } as const) : ({} as const);
}
