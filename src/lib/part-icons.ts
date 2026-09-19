/**
 * The line drawings, as markup, in one place.
 *
 * They are the fallback picture for a part family, and they are needed in two
 * shapes: as JSX inside the category tiles, and as a standalone SVG document
 * served for any product the shop has not photographed yet. Defining the paths
 * twice is how the two would drift, so they are defined here as strings and
 * both consumers render the same characters.
 *
 * These are our own drawings. The viewBox is 24x24 and every icon is stroked,
 * not filled, so a consumer sets `stroke` and gets a coherent set.
 */

/**
 * The car.
 *
 * The shop's own side-view drawing, and the one symbol here that is not on
 * the 24-unit grid: it is kept at its authored coordinates (a 605×320
 * canvas) so it can be re-exported from the drawing without anyone
 * re-plotting it, and the transform maps it into the grid. tx/ty/scale come
 * from its tight bounds — x 54→518, y 79→265 once the strokes are counted —
 * fitted to the width and centred vertically, because a car runs out of
 * width first.
 *
 * It is also the only one that fills: the body is a closed ribbon, and
 * stroking a ribbon draws both of its edges. Stroke widths are in the
 * drawing's units, chosen so that 24 of them land on the 1.25 the rest of the
 * set uses once scaled. The wheels are rings rather than the drawing's
 * disc-and-white-hub, so they read on navy chips and dark bars too.
 *
 * It lives in this module rather than in components/icons because both
 * consumers of this file need it — carrosserie's family drawing below, and
 * IconCar, which is the same car in the site chrome. Two copies is how the
 * two would drift.
 */
export const CAR_MARKUP =
  '<g transform="translate(-2.793 3.104) scale(0.051724)" stroke-linecap="round" stroke-linejoin="round">' +
  '<path fill="currentColor" stroke-width="24" d="M66 135 L135 135 L174 96 Q185 91 205 91 L292 91 Q311 92 329 103 L373 139 Q390 141 409 141 Q449 140 476 152 Q499 163 505 183 Q510 198 506 218 L494 218 L494 193 Q491 174 468 164 Q446 154 413 154 L374 154 L324 112 Q307 102 289 102 L205 102 Q188 102 178 111 L137 143 L75 143 L75 205 Q75 216 87 221 L101 226 L101 215 Q84 211 84 203 L84 151 Z" />' +
  '<path stroke-width="26" stroke-linecap="butt" d="M194 222 L386 222" />' +
  '<circle cx="149" cy="224" r="28.5" stroke-width="25" />' +
  '<circle cx="434" cy="224" r="28.5" stroke-width="25" />' +
  "</g>";

/** Inner markup of each family's drawing, keyed by the seeded family slug. */
export const PART_ICONS: Record<string, string> = {
  "filtres":
    '<ellipse cx="12" cy="6.5" rx="6" ry="2.4" /> <path d="M6 6.5v11c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4v-11" /> <path d="M9 7.6v11.6M12 8v12M15 7.6v11.6" />',
  "freinage":
    '<circle cx="11" cy="12" r="7.2" /> <circle cx="11" cy="12" r="2.4" /> <path d="M16.4 7.2 19 5.6M17.8 10l2.9-1M17.8 14l2.9 1M16.4 16.8 19 18.4" />',
  "courroie-tendeur-et-chaine":
    '<circle cx="7.5" cy="9" r="3.6" /> <circle cx="16.5" cy="15" r="3.1" /> <path d="M6.4 12.4 15 17.9M8.9 5.7 19 12.6" />',
  "allumage-prechauffage":
    '<path d="M10 3h4v4h-4z" /> <path d="M9.2 7h5.6v4H9.2z" /> <path d="M10.4 11h3.2v5h-3.2z" /> <path d="M12 16v5" />',
  "suspension":
    '<path d="M8.5 4h7M8.5 7h7M8.5 10h7M8.5 13h7" /> <path d="M12 13v3" /> <rect x="9.6" y="16" width="4.8" height="5" rx="1.4" />',
  "direction-et-trains-roulants":
    '<circle cx="12" cy="12" r="8.2" /> <circle cx="12" cy="12" r="2.4" /> <path d="M12 9.6V3.8M9.9 13.2 5 17.6M14.1 13.2 19 17.6" />',
  "embrayage":
    '<circle cx="12" cy="12" r="8.2" /> <circle cx="12" cy="12" r="3" /> <path d="M12 3.8v3.4M12 16.8v3.4M3.8 12h3.4M16.8 12h3.4" />',
  "moteur":
    '<path d="M3.5 12.5h3V9h5V7h5v3h2.4a1.6 1.6 0 0 1 1.6 1.6v4.9h-3v2H6.5v-2h-3z" /> <circle cx="18" cy="17" r="1.4" />',
  "eclairage":
    '<path d="M4 8.5a4.5 4.5 0 0 1 4.5-4.5h1.8a6.5 6.5 0 0 1 0 16H8.5A4.5 4.5 0 0 1 4 15.5z" /> <path d="M16.4 8.5h4M16.4 12h4.6M16.4 15.5h4" />',
  "demarrage-electrique":
    '<rect x="3" y="7.5" width="18" height="11" rx="1.6" /> <path d="M7.5 7.5V5.5h3v2M13.5 7.5V5.5h3v2" /> <path d="M7 13h3.4M8.7 11.3v3.4M13.8 13h3.4" />',
  "capteurs-et-sondes":
    '<path d="M10 20V9.5" /> <rect x="7.6" y="4.5" width="4.8" height="5" rx="1.2" /> <path d="M14.8 6.6a6 6 0 0 1 0 8.4M17.4 4.6a9.4 9.4 0 0 1 0 12.4" />',
  // The family is bodywork, and the drawing it had was a blunt three-quarter
  // box that read as a crate. The car below is the site's car.
  "carosserie": CAR_MARKUP,
  "refroidissement-moteur":
    '<rect x="3.5" y="5" width="17" height="14" rx="1.6" /> <path d="M7.5 5v14M12 5v14M16.5 5v14" />',
  "cardan-et-transmission":
    '<circle cx="5.4" cy="12" r="2.6" /> <circle cx="18.6" cy="12" r="2.6" /> <path d="M8 12h8" /> <path d="M9.6 9.8v4.4M14.4 9.8v4.4" />',
  "climatisation":
    '<circle cx="12" cy="12" r="8.2" /> <circle cx="12" cy="12" r="1.6" /> <path d="M12 10.4c0-3 -3.6-4.2-4.6-2.2M13.4 12.8c2.6 1.5 5.6-.9 4.4-2.8M10.6 12.8c-1.7 2.5.4 5.6 2.6 4.6" />',
  "lubrifiant":
    '<path d="M4 12.5h9.5V19a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 19z" /> <path d="M6.4 12.5v-2.4h4.7v2.4M13.5 14.4l6-3.4" /> <path d="M17.6 4c1.6 2 2.4 3.1 2.4 4a2.4 2.4 0 1 1-4.8 0c0-.9.8-2 2.4-4z" />',
};

/** A part outline, for anything with no drawing of its own. */
export const GENERIC_PART_ICON =
  '<path d="M12 3.4 19.6 7.7v8.6L12 20.6 4.4 16.3V7.7z" /> <circle cx="12" cy="12" r="3.1" />';

/** The drawing for a family slug, never null — an unknown slug gets the outline. */
export function partIconMarkup(slug: string | null | undefined): string {
  return (slug && PART_ICONS[slug]) || GENERIC_PART_ICON;
}
