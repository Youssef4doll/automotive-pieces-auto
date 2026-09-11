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
 *
 * This is also where the shop's own market gets into the search. The
 * catalogue is written in French, but a Tunisian customer types "debriyaj",
 * "blaket", "zit" or دبرياج — none of which a fuzzy matcher can rescue,
 * because they are not misspellings of the French, they are different words.
 * Mapping them here is what lets an Arabic or Maghrebi query reach a French
 * catalogue at all.
 *
 * The local list below is a starting point, not a finished one: the authority
 * on how this shop's customers type is the shop, and /admin/analytics already
 * records every search that found nothing. Anything that keeps appearing
 * there belongs here.
 *
 * Aliases are folded on the way in, so they can be written the natural way —
 * "شمعة", not "شمعه".
 */

import { fold } from "./fold";

/** canonical catalogue wording → the ways people ask for it */
const VOCABULARY: Record<string, string[]> = {
  // --- Freinage ---------------------------------------------------------
  "plaquette frein": [
    "plaquette", "plaquettes", "plaquette de frein", "plaquettes de frein",
    "plaquette frein", "garniture de frein", "garnitures",
    "brake pad", "brake pads", "pad de frein", "pads",
    "blaket", "blakat", "plaket", "بلاكات", "بلاكة", "تيل الفرامل", "تيل فرامل", "تيل",
  ],
  "disque frein": [
    "disque", "disques", "disque de frein", "disques de frein",
    "brake disc", "brake discs", "brake rotor", "rotor", "rotors",
    "disk", "disc", "دسك", "قرص الفرامل", "قرص فرامل", "أقراص الفرامل",
  ],
  "etrier frein": ["etrier", "etriers", "etrier de frein", "caliper", "brake caliper"],
  "machoire frein": ["machoire", "machoires", "machoire de frein", "brake shoe", "brake shoes"],
  "liquide frein": ["liquide de frein", "liquide frein", "brake fluid", "dot4", "dot 4",
    "زيت الفرامل", "سائل الفرامل",
  ],
  freinage: ["frein", "freins", "freinage", "braking", "brakes",
    "fren", "frin", "فرامل", "الفرامل", "فران", "مكابح",
  ],

  // --- Filtration -------------------------------------------------------
  "filtre huile": ["filtre a huile", "filtre huile", "oil filter", "filtre dhuile",
    "filtre zit", "filtr zit", "فلتر الزيت", "فلتر زيت", "فيلتر الزيت", "فيلتر زيت",
  ],
  "filtre air": ["filtre a air", "filtre air", "air filter",
    "filtre lehwa", "فلتر الهواء", "فلتر هواء", "فيلتر الهواء",
  ],
  "filtre habitacle": [
    "filtre habitacle", "filtre d habitacle", "filtre pollen", "filtre a pollen",
    "filtre clim", "filtre climatisation", "cabin filter", "pollen filter",
    "فلتر المكيف", "فلتر مكيف", "فلتر الغبار",
  ],
  "filtre carburant": [
    "filtre a carburant", "filtre carburant", "filtre gasoil", "filtre a gasoil",
    "filtre essence", "fuel filter", "diesel filter",
    "filtre mazout", "فلتر الغازوال", "فلتر البنزين", "فلتر الوقود", "فلتر المازوت",
  ],
  filtre: ["filtre", "filtres", "filter", "filters", "filtration",
    "filtr", "filtre", "فلتر", "فيلتر", "الفلتر",
  ],

  // --- Distribution / courroies ----------------------------------------
  "courroie distribution": [
    "kit distribution", "kit distri", "distri", "distribution",
    "courroie de distribution", "courroie distribution",
    "timing belt", "timing kit", "cambelt",
    "korai", "kouray", "kourai", "كوراي", "سير التوزيع", "سير الكوراي", "السير",
  ],
  "courroie accessoire": [
    "courroie accessoire", "courroie d accessoire", "courroie alternateur",
    "courroie striee", "serpentine belt", "accessory belt",
  ],
  galet: ["galet", "galets", "galet tendeur", "tendeur", "tensioner", "idler",
    "galet tendeur", "بكرة", "بكرة السير",
  ],
  "pompe eau": ["pompe a eau", "pompe eau", "water pump",
    "طرمبة الماء", "مضخة الماء", "طرمبة",
  ],

  // --- Moteur / lubrifiants --------------------------------------------
  "huile moteur": [
    "huile", "huile moteur", "huile de moteur", "vidange", "lubrifiant",
    "engine oil", "motor oil", "oil change", "5w30", "5w 30", "10w40", "10w 40",
    "zit", "zeit", "vidanj", "zit moteur", "زيت", "الزيت", "زيت المحرك", "تبديل الزيت", "زيت موتور",
  ],
  "bougie allumage": [
    "bougie", "bougies", "bougie d allumage", "bougie allumage",
    "spark plug", "spark plugs",
    "bouji", "boujie", "بوجي", "بوجيات", "شمعة", "شمعات", "شمعة الإشعال",
  ],
  "bougie prechauffage": [
    "bougie de prechauffage", "bougie prechauffage", "prechauffage",
    "glow plug", "glow plugs",
    "بوجي التسخين", "شمعة التسخين", "شمعات التسخين",
  ],
  "joint culasse": ["joint de culasse", "joint culasse", "head gasket",
    "joint culas", "جوان الكولاس", "جوان الرأس",
  ],

  // --- Suspension / direction ------------------------------------------
  amortisseur: ["amortisseur", "amortisseurs", "amorto", "shock absorber", "shock", "damper",
    "amortisour", "amortisor", "أمرتيسور", "مساعدات", "المساعدات", "ممتص الصدمات",
  ],
  "rotule direction": ["rotule", "rotules", "rotule de direction", "ball joint", "tie rod",
    "rotul", "روتيل", "رأس المقود",
  ],
  "biellette barre stabilisatrice": [
    "biellette", "biellettes", "biellette de barre stabilisatrice",
    "barre stabilisatrice", "anti roulis", "stabiliser link", "drop link",
  ],
  "roulement roue": ["roulement", "roulements", "roulement de roue", "wheel bearing",
    "rolman", "roulman", "رولمان", "رلمان", "كوسينة",
  ],
  "triangle suspension": ["triangle", "bras de suspension", "control arm", "wishbone"],

  // --- Transmission -----------------------------------------------------
  embrayage: ["embrayage", "kit embrayage", "kit d embrayage", "clutch", "clutch kit",
    "debriyaj", "dabriyaj", "debriaj", "kloutch", "دبرياج", "الدبرياج", "كلتش", "قابض",
  ],
  cardan: ["cardan", "cardans", "soufflet de cardan", "driveshaft", "cv joint",
    "kardan", "كردان", "الكردان",
  ],

  // --- Électrique -------------------------------------------------------
  batterie: ["batterie", "batteries", "battery",
    "batri", "batrie", "بطارية", "البطارية", "بطاريه",
  ],
  alternateur: ["alternateur", "alternator",
    "dinamo", "dynamo", "دينامو", "الدينامو", "مولد الكهرباء",
  ],
  demarreur: ["demarreur", "starter", "starter motor",
    "demareur", "dimarer", "مارش", "دمرور", "بادئ التشغيل",
  ],

  // --- Refroidissement / clim ------------------------------------------
  radiateur: ["radiateur", "radiator",
    "radiater", "radyater", "رادياتور", "الرادياتور", "المبرد",
  ],
  thermostat: ["thermostat", "calorstat",
    "ترموستات", "كالورستا",
  ],
  "liquide refroidissement": [
    "liquide de refroidissement", "liquide refroidissement", "antigel",
    "coolant", "antifreeze",
    "ماء الرادياتور", "سائل التبريد",
  ],

  // --- Essuyage / éclairage --------------------------------------------
  "balai essuie glace": [
    "balai", "balais", "essuie glace", "essuie glaces", "balai d essuie glace",
    "wiper", "wipers", "wiper blade",
    "masahat", "مساحات", "المساحات", "مساحة الزجاج", "مساحات المطر",
  ],
  ampoule: ["ampoule", "ampoules", "phare", "phares", "bulb", "headlight",
    "lampa", "لمبة", "لمبات", "مصباح", "ضوء", "الضوء",
  ],

  // --- Capteurs ---------------------------------------------------------
  "capteur abs": ["capteur abs", "sonde abs", "abs sensor"],
  "sonde lambda": ["sonde lambda", "lambda", "oxygen sensor", "o2 sensor"],
};

/**
 * Car names as they are written in Arabic.
 *
 * The catalogue spells them in Latin — "Clio", "Picanto", "Berlingo" — so an
 * Arabic query naming a car had nothing to match: كليو is not a misspelling of
 * clio, it is the same word in another script. The left-hand side here is the
 * Latin spelling the catalogue actually uses, so the expansion aims at a word
 * that is in the index.
 *
 * Kept apart from the trade vocabulary above because these are not catalogue
 * taxonomy and must stay out of the "did you mean" dictionary, which should
 * only ever suggest a kind of part.
 */
const VEHICLE_TERMS: Record<string, string[]> = {
  renault: ["رينو", "رونو"],
  clio: ["كليو"],
  symbol: ["سامبول", "سيمبول"],
  megane: ["ميغان"],
  kangoo: ["كانغو"],
  peugeot: ["بيجو", "بجو"],
  citroen: ["ستروين", "سيتروين"],
  berlingo: ["برلينغو"],
  partner: ["بارتنر"],
  volkswagen: ["فولكسفاغن", "فولكس"],
  golf: ["غولف", "جولف"],
  polo: ["بولو"],
  seat: ["سيات"],
  skoda: ["سكودا"],
  kia: ["كيا"],
  picanto: ["بيكانتو"],
  sportage: ["سبورتاج"],
  hyundai: ["هيونداي", "هيوندا"],
  accent: ["أكسنت", "اكسنت"],
  toyota: ["تويوتا"],
  yaris: ["ياريس"],
  hilux: ["هيلوكس"],
  ford: ["فورد"],
  fiat: ["فيات"],
  dacia: ["داسيا", "داشيا"],
  logan: ["لوغان"],
  sandero: ["سانديرو"],
  nissan: ["نيسان"],
  suzuki: ["سوزوكي"],
  isuzu: ["ايسوزو"],
  mercedes: ["مرسيدس"],
  bmw: ["بي ام دبليو"],
  opel: ["أوبل", "اوبل"],
  chevrolet: ["شفروليه"],
  mitsubishi: ["ميتسوبيشي"],
  mahindra: ["ماهيندرا"],
};

/** Wording that says *where* on the car, which must survive normalisation. */
const POSITION_TERMS: Record<string, string[]> = {
  avant: ["avant", "av", "front", "امامي", "أمامي", "قدام", "الامامي"],
  arriere: ["arriere", "ar", "rear", "back", "خلفي", "الخلفي", "ورا", "لور"],
  gauche: ["gauche", "left", "يسار", "ايسر", "أيسر", "الشمال"],
  droit: ["droit", "droite", "right", "يمين", "ايمن", "أيمن", "اليمين"],
};

type Alias = { phrase: string; canonical: string; words: number };

/** Longest phrases first, so "filtre habitacle" wins over bare "filtre". */
const ALIASES: Alias[] = [
  ...Object.entries(VOCABULARY),
  ...Object.entries(POSITION_TERMS),
  ...Object.entries(VEHICLE_TERMS),
]
  .flatMap(([canonical, aliases]) =>
    aliases.map((raw) => {
      // Folded here rather than by hand, so an alias can be written the way
      // it is spelt — "شمعة", "Filtre à huile" — and still be compared against
      // a folded query.
      const phrase = fold(raw);
      return { phrase, canonical, words: phrase.split(" ").filter(Boolean).length };
    }),
  )
  .filter((a) => a.phrase.length > 0)
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
