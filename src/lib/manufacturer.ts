/**
 * Who made the part.
 *
 * A shop is the last step of a chain, not the start of it. When a brake disc
 * cracks, the person holding it needs the company that built it — a name, a
 * registered address, a way to write — and that is information the shop either
 * publishes or the customer cannot get at all. In the European Union a seller
 * is now obliged to carry it for every article it lists; Tunisia obliges
 * nothing of the sort today, and the information is worth publishing anyway,
 * because "who do I complain to" is a question a parts shop gets asked with or
 * without a regulation behind it.
 *
 * Every field is typed in by the shop from what the manufacturer itself
 * publishes. Nothing here is guessed, scraped or completed from a pattern: a
 * brand with an address shows its address, and a brand with nothing shows no
 * panel — never a template with the parts we happen to know filled in and the
 * rest left looking official.
 */

export type ManufacturerInfo = {
  legalName: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
};

/** Blank-safe: an empty string in the database is the same as no value. */
function value(v: string | null | undefined): string | null {
  const s = v?.trim();
  return s ? s : null;
}

/**
 * "Rixbecker Str. 75, 59552 Lippstadt, DE" — from whichever parts exist.
 *
 * Assembled rather than stored as one line so a missing postcode leaves no
 * gap and a missing city leaves no stray comma. Street and locality are kept
 * as separate segments because that is how a postal address is read aloud.
 */
export function manufacturerAddress(m: ManufacturerInfo): string | null {
  const locality = [value(m.postalCode), value(m.city)].filter(Boolean).join(" ");
  const parts = [value(m.street), locality || null, value(m.country)].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

/** Does this brand have anything to publish at all? */
export function hasManufacturerInfo(m: ManufacturerInfo): boolean {
  return (
    !!value(m.legalName) ||
    !!manufacturerAddress(m) ||
    !!value(m.phone) ||
    !!value(m.email) ||
    !!value(m.website)
  );
}

/**
 * The site as it is worth reading — "hella.com" rather than
 * "https://www.hella.com/". The link still carries the full address; only the
 * text is trimmed, and a value that is not a URL is printed as typed rather
 * than mangled.
 */
export function websiteLabel(url: string): string {
  return url
    .trim()
    .replace(/^[a-z]+:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");
}

/** The href for a typed website, which the shop may have entered bare. */
export function websiteHref(url: string): string {
  const s = url.trim();
  return /^[a-z]+:\/\//i.test(s) ? s : `https://${s}`;
}
