/**
 * What customers type, mapped to what the catalogue calls things.
 *
 * A parts search fails for boring reasons: the shop's rows say "Kit de
 * plaquettes de frein avant", the customer types "plaquette frein av", "kit
 * distri", "filtre clim" or "brake pads". None of those are misspellings that
 * a fuzzy matcher should have to guess at — they are the trade's actual
 * vocabulary, and they belong in a list rather than in a similarity score.
 *
 * Every canonical term on the left is wording that really appears in this
 * catalogue's taxonomy, so an expansion always aims at something the shop can
 * sell. Aliases are matched on the folded query (accent-free, lower case), as
 * whole words or phrases — never as loose substrings, which is what turns
 * "disque" into a match for "disquette".
 */

/** canonical catalogue wording → the ways people ask for it */
const VOCABULARY: Record<string, string[]> = {
  // --- Freinage ---------------------------------------------------------
  "plaquette frein": [
    "plaquette", "plaquettes", "plaquette de frein", "plaquettes de frein",
    "plaquette frein", "garniture de frein", "garnitures",
    "brake pad", "brake pads", "pad de frein", "pads",
  ],
  "disque frein": [
    "disque", "disques", "disque de frein", "disques de frein",
    "brake disc", "brake discs", "brake rotor", "rotor", "rotors",
  ],
  "etrier frein": ["etrier", "etriers", "etrier de frein", "caliper", "brake caliper"],
  "machoire frein": ["machoire", "machoires", "machoire de frein", "brake shoe", "brake shoes"],
  "liquide frein": ["liquide de frein", "liquide frein", "brake fluid", "dot4", "dot 4"],
  freinage: ["frein", "freins", "freinage", "braking", "brakes"],

  // --- Filtration -------------------------------------------------------
  "filtre huile": ["filtre a huile", "filtre huile", "oil filter", "filtre dhuile"],
  "filtre air": ["filtre a air", "filtre air", "air filter"],
  "filtre habitacle": [
    "filtre habitacle", "filtre d habitacle", "filtre pollen", "filtre a pollen",
    "filtre clim", "filtre climatisation", "cabin filter", "pollen filter",
  ],
  "filtre carburant": [
    "filtre a carburant", "filtre carburant", "filtre gasoil", "filtre a gasoil",
    "filtre essence", "fuel filter", "diesel filter",
  ],
  filtre: ["filtre", "filtres", "filter", "filters", "filtration"],

  // --- Distribution / courroies ----------------------------------------
  "courroie distribution": [
    "kit distribution", "kit distri", "distri", "distribution",
    "courroie de distribution", "courroie distribution",
    "timing belt", "timing kit", "cambelt",
  ],
  "courroie accessoire": [
    "courroie accessoire", "courroie d accessoire", "courroie alternateur",
    "courroie striee", "serpentine belt", "accessory belt",
  ],
  galet: ["galet", "galets", "galet tendeur", "tendeur", "tensioner", "idler"],
  "pompe eau": ["pompe a eau", "pompe eau", "water pump"],

  // --- Moteur / lubrifiants --------------------------------------------
  "huile moteur": [
    "huile", "huile moteur", "huile de moteur", "vidange", "lubrifiant",
    "engine oil", "motor oil", "oil change", "5w30", "5w 30", "10w40", "10w 40",
  ],
  "bougie allumage": [
    "bougie", "bougies", "bougie d allumage", "bougie allumage",
    "spark plug", "spark plugs",
  ],
  "bougie prechauffage": [
    "bougie de prechauffage", "bougie prechauffage", "prechauffage",
    "glow plug", "glow plugs",
  ],
  "joint culasse": ["joint de culasse", "joint culasse", "head gasket"],

  // --- Suspension / direction ------------------------------------------
  amortisseur: ["amortisseur", "amortisseurs", "amorto", "shock absorber", "shock", "damper"],
  "rotule direction": ["rotule", "rotules", "rotule de direction", "ball joint", "tie rod"],
  "biellette barre stabilisatrice": [
    "biellette", "biellettes", "biellette de barre stabilisatrice",
    "barre stabilisatrice", "anti roulis", "stabiliser link", "drop link",
  ],
  "roulement roue": ["roulement", "roulements", "roulement de roue", "wheel bearing"],
  "triangle suspension": ["triangle", "bras de suspension", "control arm", "wishbone"],

  // --- Transmission -----------------------------------------------------
  embrayage: ["embrayage", "kit embrayage", "kit d embrayage", "clutch", "clutch kit"],
  cardan: ["cardan", "cardans", "soufflet de cardan", "driveshaft", "cv joint"],

  // --- Électrique -------------------------------------------------------
  batterie: ["batterie", "batteries", "battery"],
  alternateur: ["alternateur", "alternator"],
  demarreur: ["demarreur", "starter", "starter motor"],

  // --- Refroidissement / clim ------------------------------------------
  radiateur: ["radiateur", "radiator"],
  thermostat: ["thermostat", "calorstat"],
  "liquide refroidissement": [
    "liquide de refroidissement", "liquide refroidissement", "antigel",
    "coolant", "antifreeze",
  ],

  // --- Essuyage / éclairage --------------------------------------------
  "balai essuie glace": [
    "balai", "balais", "essuie glace", "essuie glaces", "balai d essuie glace",
    "wiper", "wipers", "wiper blade",
  ],
  ampoule: ["ampoule", "ampoules", "phare", "phares", "bulb", "headlight"],

  // --- Capteurs ---------------------------------------------------------
  "capteur abs": ["capteur abs", "sonde abs", "abs sensor"],
  "sonde lambda": ["sonde lambda", "lambda", "oxygen sensor", "o2 sensor"],
};

/** Wording that says *where* on the car, which must survive normalisation. */
const POSITION_TERMS: Record<string, string[]> = {
  avant: ["avant", "av", "front"],
  arriere: ["arriere", "ar", "rear", "back"],
  gauche: ["gauche", "left"],
  droit: ["droit", "droite", "right"],
};

type Alias = { phrase: string; canonical: string; words: number };

/** Longest phrases first, so "filtre habitacle" wins over bare "filtre". */
const ALIASES: Alias[] = [...Object.entries(VOCABULARY), ...Object.entries(POSITION_TERMS)]
  .flatMap(([canonical, aliases]) =>
    aliases.map((phrase) => ({ phrase, canonical, words: phrase.split(" ").length })),
  )
  .sort((a, b) => b.phrase.length - a.phrase.length);

/**
 * Rewrite a folded query into catalogue wording.
 *
 * Returns the canonical terms found and the words that matched nothing (a
 * brand, a model, a reference — those go to the index as typed). Matching
 * walks the query left to right taking the longest alias that starts at each
 * position, so "kit distri clio" yields "courroie distribution" + "clio" and
 * not a stray "kit".
 */
export function expandQuery(folded: string): { canonical: string[]; rest: string[] } {
  const words = folded.split(" ").filter(Boolean);
  const canonical: string[] = [];
  const rest: string[] = [];

  let i = 0;
  while (i < words.length) {
    let matched: Alias | null = null;
    for (const alias of ALIASES) {
      if (alias.words > words.length - i) continue;
      if (words.slice(i, i + alias.words).join(" ") === alias.phrase) {
        matched = alias;
        break;
      }
    }
    if (matched) {
      if (!canonical.includes(matched.canonical)) canonical.push(matched.canonical);
      i += matched.words;
    } else {
      rest.push(words[i]);
      i += 1;
    }
  }

  return { canonical, rest };
}

/** Every canonical term, for the "did you mean" dictionary. */
export const CANONICAL_TERMS: string[] = Object.keys(VOCABULARY);
