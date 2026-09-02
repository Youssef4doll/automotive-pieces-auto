/**
 * A drawn icon per part family, for the tiles nobody has photographed yet.
 *
 * The fallback used to be the family's first letter in a grey square, which
 * made a board of sixteen families read as sixteen identical placeholders —
 * "F" for Filtres sitting beside "F" for Freinage told the shopper nothing and
 * looked unfinished. The big European catalogues lead these boards with a
 * drawing of the part, because a picture of a brake disc is recognisable to
 * somebody who does not know the French word for it, which is exactly the
 * customer this shop keeps losing.
 *
 * These are our own line drawings, matched to the seeded families by slug, and
 * they are a fallback only: the moment the shop uploads a real photograph in
 * /admin/catalogue, that photograph wins. Anything unrecognised gets a generic
 * part outline rather than a letter — a wrong-looking icon would be worse than
 * a neutral one, so nothing here guesses.
 */

const ICONS: Record<string, React.ReactNode> = {
  // Filtre — pleated cylinder.
  filtres: (
    <>
      <ellipse cx="12" cy="6.5" rx="6" ry="2.4" />
      <path d="M6 6.5v11c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4v-11" />
      <path d="M9 7.6v11.6M12 8v12M15 7.6v11.6" />
    </>
  ),
  // Freinage — disc with a caliper over it.
  freinage: (
    <>
      <circle cx="11" cy="12" r="7.2" />
      <circle cx="11" cy="12" r="2.4" />
      <path d="M16.4 7.2 19 5.6M17.8 10l2.9-1M17.8 14l2.9 1M16.4 16.8 19 18.4" />
    </>
  ),
  // Courroie — belt around two pulleys.
  "courroie-tendeur-et-chaine": (
    <>
      <circle cx="7.5" cy="9" r="3.6" />
      <circle cx="16.5" cy="15" r="3.1" />
      <path d="M6.4 12.4 15 17.9M8.9 5.7 19 12.6" />
    </>
  ),
  // Allumage — spark plug.
  "allumage-prechauffage": (
    <>
      <path d="M10 3h4v4h-4z" />
      <path d="M9.2 7h5.6v4H9.2z" />
      <path d="M10.4 11h3.2v5h-3.2z" />
      <path d="M12 16v5" />
    </>
  ),
  // Suspension — coil spring over a shock body.
  suspension: (
    <>
      <path d="M8.5 4h7M8.5 7h7M8.5 10h7M8.5 13h7" />
      <path d="M12 13v3" />
      <rect x="9.6" y="16" width="4.8" height="5" rx="1.4" />
    </>
  ),
  // Direction — steering wheel.
  "direction-et-trains-roulants": (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M12 9.6V3.8M9.9 13.2 5 17.6M14.1 13.2 19 17.6" />
    </>
  ),
  // Embrayage — clutch friction disc.
  embrayage: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.8v3.4M12 16.8v3.4M3.8 12h3.4M16.8 12h3.4" />
    </>
  ),
  // Moteur — block with a head and pulley.
  moteur: (
    <>
      <path d="M3.5 12.5h3V9h5V7h5v3h2.4a1.6 1.6 0 0 1 1.6 1.6v4.9h-3v2H6.5v-2h-3z" />
      <circle cx="18" cy="17" r="1.4" />
    </>
  ),
  // Éclairage — headlamp with beams.
  eclairage: (
    <>
      <path d="M4 8.5a4.5 4.5 0 0 1 4.5-4.5h1.8a6.5 6.5 0 0 1 0 16H8.5A4.5 4.5 0 0 1 4 15.5z" />
      <path d="M16.4 8.5h4M16.4 12h4.6M16.4 15.5h4" />
    </>
  ),
  // Démarrage — battery.
  "demarrage-electrique": (
    <>
      <rect x="3" y="7.5" width="18" height="11" rx="1.6" />
      <path d="M7.5 7.5V5.5h3v2M13.5 7.5V5.5h3v2" />
      <path d="M7 13h3.4M8.7 11.3v3.4M13.8 13h3.4" />
    </>
  ),
  // Capteurs — sensor with a signal.
  "capteurs-et-sondes": (
    <>
      <path d="M10 20V9.5" />
      <rect x="7.6" y="4.5" width="4.8" height="5" rx="1.2" />
      <path d="M14.8 6.6a6 6 0 0 1 0 8.4M17.4 4.6a9.4 9.4 0 0 1 0 12.4" />
    </>
  ),
  // Carrosserie — a door panel.
  carosserie: (
    <>
      <path d="M3.6 18V9.6L8 5h9.2a3.2 3.2 0 0 1 3.2 3.2V18z" />
      <path d="M8 5v4.6h12.4" />
      <path d="M6.4 13.6h3.2" />
    </>
  ),
  // Refroidissement — radiator.
  "refroidissement-moteur": (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="1.6" />
      <path d="M7.5 5v14M12 5v14M16.5 5v14" />
    </>
  ),
  // Cardan — driveshaft with joints.
  "cardan-et-transmission": (
    <>
      <circle cx="5.4" cy="12" r="2.6" />
      <circle cx="18.6" cy="12" r="2.6" />
      <path d="M8 12h8" />
      <path d="M9.6 9.8v4.4M14.4 9.8v4.4" />
    </>
  ),
  // Climatisation — fan.
  climatisation: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="1.6" />
      <path d="M12 10.4c0-3 -3.6-4.2-4.6-2.2M13.4 12.8c2.6 1.5 5.6-.9 4.4-2.8M10.6 12.8c-1.7 2.5.4 5.6 2.6 4.6" />
    </>
  ),
  // Lubrifiant — oil can with a drop.
  lubrifiant: (
    <>
      <path d="M4 12.5h9.5V19a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 19z" />
      <path d="M6.4 12.5v-2.4h4.7v2.4M13.5 14.4l6-3.4" />
      <path d="M17.6 4c1.6 2 2.4 3.1 2.4 4a2.4 2.4 0 1 1-4.8 0c0-.9.8-2 2.4-4z" />
    </>
  ),
};

/** A part outline, for a family with no drawing of its own. */
const GENERIC = (
  <>
    <path d="M12 3.4 19.6 7.7v8.6L12 20.6 4.4 16.3V7.7z" />
    <circle cx="12" cy="12" r="3.1" />
  </>
);

export default function FamilyIcon({ slug, className = "" }: { slug: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICONS[slug] ?? GENERIC}
    </svg>
  );
}
