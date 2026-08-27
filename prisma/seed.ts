import { PrismaClient, OrderStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ---------------------------------------------------------------------------
// 1. Category taxonomy — verbatim from the shop owner's own catalog list.
// ---------------------------------------------------------------------------
const TAXONOMY: Record<string, string[]> = {
  "Filtres": [
    "Filtre à huile",
    "Filtre à air",
    "Filtre à carburant",
    "Filtre hydraulique, boîte automatique",
    "Filtre habitacle",
  ],
  "Freinage": [
    "Étrier de frein",
    "Disque de frein",
    "Flexible de frein",
    "Tambour de frein",
    "Cable frein à main",
    "Maître-cylindre de frein",
    "Cylindre de roue",
    "Mâchoire de frein",
    "Kit de plaquettes de frein",
    "Capteur ABS",
    "Indicateur d'usure, plaquette de freins",
  ],
  "Courroie, tendeur et chaine": [
    "Courroie",
    "Courroie de distribution",
    "Kit de distribution",
    "Poulie-Tendeur, Courroie De Distribution",
    "Tendeur courroie",
    "Tendeur, chaîne de distribution",
    "Glissiere chaine distribution",
    "Chaîne de distribution",
    "Poulie, vilebrequin",
    "Poulies",
  ],
  "Allumage préchauffage": ["Bougie d'allumage", "Bobine d'allumage", "Fiche, bobine d'allumage"],
  "Suspension": [
    "Ressort de suspension",
    "Compresseur, système d'air comprimé",
    "Amortisseur",
    "Coupelle de suspension",
    "Butée élastique",
  ],
  "Direction et Trains roulants": [
    "Rotule de direction intérieure, barre de connexion",
    "Soufflet direction",
    "Silent-bloc",
    "Bras et Triangle suspension",
    "Barre de connexion",
    "Crémaillère de direction",
    "Boitier direction",
    "Moyeu de roue",
    "Kit de roulements de roue",
    "Fusée d'essieu, suspension de roue",
    "Silent-bloc barre stabilisatrice",
    "Rotule de direction",
    "Rotule de suspension",
    "Bielette suspension",
  ],
  "Embrayage": [
    "Butée embrayage",
    "Cylindre émetteur, embrayage",
    "Mécanisme d'embrayage",
    "Disque d'embrayage",
    "Tirette à câble, commande d'embrayage",
    "Kit d'embrayage",
    "Volant moteur",
    "Cylindre récepteur, embrayage",
    "Fourchette embrayage",
  ],
  "Moteur": [
    "Pompe hydraulique, direction",
    "Joint d'étanchéité, carter d'huile",
    "Corps papillon",
    "Joint culasse",
    "Joint de cache culbuteurs",
    "Pompe à carburant",
    "Carter d'huile",
    "Pompe à huile",
    "Cable accelerateur",
    "Couvercle de culasse",
    "Vanne EGR",
    "Pompe à eau",
    "Durite d'air",
    "Turbo",
    "Support moteur",
    "Soupape, dégazage du carter (renifleur)",
    "Support boite vitesse",
    "Pochette joint",
  ],
  "Eclairage": ["Feu clignotant", "Phare avant", "Antibrouillard", "Feu arrière"],
  "Démarrage électrique": ["Démarreur", "Alternateur", "Poulie roue libre, alternateur"],
  "Capteurs et sondes": [
    "Sonde de température, liquide de refroidissement",
    "Capteur vilebrequin",
    "Sonde lambda",
    "Débitmètre de masse d'air",
    "Capteur, température des gaz",
    "Capteur arbre à cames",
  ],
  "Carosserie": [
    "Balai d'essuie-glace",
    "Tringlerie d'essuie-glace",
    "Pompe d'eau de nettoyage, nettoyage des vitres",
    "Serrure de porte",
    "Pédale d'accélérateur",
    "Lève-vitre",
    "Bague Spirale",
    "vérin",
  ],
  "Refroidissement moteur": [
    "Bouchon radiateur / Vase d'eau",
    "Thermostat d'eau",
    "Vase d'expansion, liquide de refroidissement",
    "Intercooler, échangeur",
    "Radiateur d'huile",
    "Radiateur, refroidissement du moteur",
    "Durite de radiateur",
    "Ventilateur, refroidissement du moteur",
    "Embrayage, ventilateur de radiateur",
    "Tuyauterie du réfrigérant",
    "Pipette d'eau",
    "Durite turbo",
    "Durite chauffage",
  ],
  "Cardan et Transmission": [
    "Tête cardan",
    "Cardan",
    "Soufflet, arbre de commande",
    "Roulement central",
    "Joint, arbre de transmission",
    "Cable vitesse",
  ],
  "Climatisation": [
    "Compresseur, climatisation",
    "Radiateur climatisation",
    "Radiateur chauffage",
    "Evaporateur climatisation",
    "Pressostat, climatisation",
    "Pulseur d'air habitacle",
    "Résistance, pulseur d'air habitacle",
  ],
  "Lubrifiant": [
    "Huile pour boîte automatique",
    "Huile moteur",
    "Huile pour boîte de vitesses et pont",
    "Huile pour direction assistée",
    "Antigel",
    "Huile, boîte de vitesses à variation continue (CVT)",
  ],
};

// ---------------------------------------------------------------------------
// 2. Parts brands (équipementiers)
// ---------------------------------------------------------------------------
const PARTS_BRANDS = [
  "Kamoka", "Bosch", "Valeo", "Mann-Filter", "Febi", "SKF", "NGK", "Sachs",
  "TRW", "Filtron", "Gates", "Exide", "Delphi", "Monroe", "Ferodo", "Denso",
  "Elring", "Castrol", "Ashika",
];

// ---------------------------------------------------------------------------
// 3. Vehicles — ten common Tunisian makes with a few models/engines each.
// ---------------------------------------------------------------------------
const VEHICLES: Record<string, { model: string; years: [number, number]; engines: { name: string; fuel: string; hp: number }[] }[]> = {
  Renault: [
    { model: "Clio IV", years: [2012, 2019], engines: [{ name: "1.5 dCi", fuel: "Diesel", hp: 90 }, { name: "0.9 TCe", fuel: "Essence", hp: 90 }] },
    { model: "Clio III", years: [2005, 2012], engines: [{ name: "1.5 dCi", fuel: "Diesel", hp: 85 }] },
    { model: "Symbol", years: [2008, 2020], engines: [{ name: "1.5 dCi", fuel: "Diesel", hp: 75 }] },
  ],
  Peugeot: [
    { model: "208", years: [2012, 2024], engines: [{ name: "1.5 BlueHDi", fuel: "Diesel", hp: 100 }, { name: "1.2 PureTech", fuel: "Essence", hp: 82 }] },
    { model: "308", years: [2013, 2021], engines: [{ name: "1.6 HDi", fuel: "Diesel", hp: 92 }] },
    { model: "Partner", years: [2008, 2018], engines: [{ name: "1.6 HDi", fuel: "Diesel", hp: 90 }] },
  ],
  Volkswagen: [
    { model: "Golf VII", years: [2012, 2020], engines: [{ name: "1.6 TDI", fuel: "Diesel", hp: 105 }, { name: "1.4 TSI", fuel: "Essence", hp: 125 }] },
    { model: "Polo V", years: [2009, 2017], engines: [{ name: "1.4 TDI", fuel: "Diesel", hp: 75 }] },
  ],
  Kia: [
    { model: "Picanto", years: [2011, 2023], engines: [{ name: "1.0", fuel: "Essence", hp: 67 }] },
    { model: "Sportage", years: [2015, 2022], engines: [{ name: "1.7 CRDi", fuel: "Diesel", hp: 115 }] },
  ],
  Hyundai: [
    { model: "i10", years: [2013, 2023], engines: [{ name: "1.0", fuel: "Essence", hp: 67 }] },
    { model: "Accent", years: [2010, 2020], engines: [{ name: "1.4 CRDi", fuel: "Diesel", hp: 90 }] },
  ],
  Citroën: [
    { model: "C3", years: [2010, 2020], engines: [{ name: "1.4 HDi", fuel: "Diesel", hp: 70 }] },
    { model: "Berlingo", years: [2008, 2018], engines: [{ name: "1.6 HDi", fuel: "Diesel", hp: 92 }] },
  ],
  Fiat: [
    { model: "Punto", years: [2005, 2018], engines: [{ name: "1.3 Multijet", fuel: "Diesel", hp: 75 }] },
    { model: "Doblo", years: [2010, 2021], engines: [{ name: "1.6 Multijet", fuel: "Diesel", hp: 105 }] },
  ],
  Dacia: [
    { model: "Logan II", years: [2012, 2021], engines: [{ name: "1.5 dCi", fuel: "Diesel", hp: 90 }] },
    { model: "Duster", years: [2010, 2023], engines: [{ name: "1.5 dCi", fuel: "Diesel", hp: 110 }] },
  ],
  Toyota: [
    { model: "Yaris", years: [2011, 2020], engines: [{ name: "1.4 D-4D", fuel: "Diesel", hp: 90 }] },
    { model: "Corolla", years: [2013, 2022], engines: [{ name: "1.4 D-4D", fuel: "Diesel", hp: 90 }] },
  ],
  BMW: [
    { model: "Série 3 (E90)", years: [2005, 2012], engines: [{ name: "320d", fuel: "Diesel", hp: 163 }] },
    { model: "Série 1 (E87)", years: [2004, 2011], engines: [{ name: "116i", fuel: "Essence", hp: 136 }] },
  ],
};

async function main() {
  console.log("Seeding categories…");
  const catByName = new Map<string, string>();
  let order = 0;
  for (const [family, subs] of Object.entries(TAXONOMY)) {
    order += 1;
    const parent = await prisma.category.upsert({
      where: { slug: slugify(family) },
      update: { name: family, order },
      create: { name: family, slug: slugify(family), order },
    });
    catByName.set(family, parent.id);
    let subOrder = 0;
    for (const sub of subs) {
      subOrder += 1;
      const slug = slugify(`${family}-${sub}`);
      const child = await prisma.category.upsert({
        where: { slug },
        update: { name: sub, order: subOrder, parentId: parent.id },
        create: { name: sub, slug, order: subOrder, parentId: parent.id },
      });
      catByName.set(`${family}>${sub}`, child.id);
    }
  }

  console.log("Seeding brands…");
  const brandByName = new Map<string, string>();
  for (const name of PARTS_BRANDS) {
    const brand = await prisma.brand.upsert({
      where: { slug: slugify(name) },
      update: {},
      create: { name, slug: slugify(name), isPartsBrand: true },
    });
    brandByName.set(name, brand.id);
  }

  console.log("Seeding vehicles…");
  const engineByKey = new Map<string, string>();
  for (const [makeName, models] of Object.entries(VEHICLES)) {
    const make = await prisma.vehicleMake.upsert({
      where: { slug: slugify(makeName) },
      update: {},
      create: { name: makeName, slug: slugify(makeName) },
    });
    for (const m of models) {
      const model = await prisma.vehicleModel.upsert({
        where: { makeId_name: { makeId: make.id, name: m.model } },
        update: { yearFrom: m.years[0], yearTo: m.years[1] },
        create: { makeId: make.id, name: m.model, yearFrom: m.years[0], yearTo: m.years[1] },
      });
      for (const e of m.engines) {
        const engine = await prisma.vehicleEngine.upsert({
          where: { modelId_name: { modelId: model.id, name: e.name } },
          update: { fuel: e.fuel, powerHp: e.hp },
          create: { modelId: model.id, name: e.name, fuel: e.fuel, powerHp: e.hp },
        });
        engineByKey.set(`${makeName}|${m.model}|${e.name}`, engine.id);
      }
    }
  }

  const allEngineIds = [...engineByKey.values()];
  function randomEngines(count: number) {
    const shuffled = [...allEngineIds].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  console.log("Seeding products…");

  type SeedProduct = {
    sku: string; name: string; brand: string; category: string;
    priceBuy: number; priceSell: number; compareAt?: number; stockQty: number;
    description: string; oemRefs?: string[]; isTopSeller?: boolean;
    engineFitCount?: number;
  };

  const products: SeedProduct[] = [
    // ---- Filtres > Filtre à air — verbatim from the shop owner's reference list ----
    { sku: "F217001", name: "Filtre à air KAMOKA F217001", brand: "Kamoka", category: "Filtres>Filtre à air", priceBuy: 21, priceSell: 32.70, stockQty: 24, description: "Filtre à air HYUNDAI PONY, PONY Wagon, JEEP CHEROKEE (XJ), GRAND CHEROKEE I (ZJ), GRAND CHEROKEE II (WJ, WG), MERCEDES-BENZ CLASSE C (W203)", isTopSeller: true },
    { sku: "20-0L-L21", name: "Filtre à air ASHIKA 20-0L-L21", brand: "Ashika", category: "Filtres>Filtre à air", priceBuy: 25, priceSell: 38.50, stockQty: 18, description: "Filtre à air JAGUAR E-PACE (X540), LAND ROVER DISCOVERY SPORT (L550), DISCOVERY SPORT VAN (L550), RANGE ROVER EVOQUE (L538), RANGE ROVER EVOQUE (L551), RANGE ROVER EVOQUE Décapotable (L538)" },
    { sku: "F232301", name: "Filtre à air KAMOKA F232301", brand: "Kamoka", category: "Filtres>Filtre à air", priceBuy: 23, priceSell: 36.50, stockQty: 15, description: "Filtre à air BMW Série 3 (E90), Série 5 (E61) Touring, FIAT DUCATO Autobus/Autocar (244_), SCUDO Camionnette (270_, 272_), FORD USA TAURUS (P5_), MERCEDES-BENZ CLASSE A (W169)" },
    { sku: "20-03-335", name: "Filtre à air ASHIKA 20-03-335", brand: "Ashika", category: "Filtres>Filtre à air", priceBuy: 13, priceSell: 20.90, stockQty: 30, description: "Filtre à air MAZDA 2 (DE), 3 (BK), 3 (BL), 3 Sedan (BK), 3 Sedan (BL)" },
    { sku: "F207801", name: "Filtre à air KAMOKA F207801", brand: "Kamoka", category: "Filtres>Filtre à air", priceBuy: 33, priceSell: 52.90, stockQty: 10, description: "Filtre à air ALPINA D10 (E39), D10 Break (E39), BMW Série 3 (E46), Série 3 (E46) Coupé, Série 3 (E46) Décapotable, Série 3 (E46) Touring" },
    { sku: "F247901", name: "Filtre à air KAMOKA F247901", brand: "Kamoka", category: "Filtres>Filtre à air", priceBuy: 19, priceSell: 30.50, stockQty: 20, description: "Filtre à air JAGUAR E-PACE (X540), LAND ROVER DISCOVERY SPORT (L550), DISCOVERY SPORT VAN (L550), FREELANDER 2 (L359), RANGE ROVER EVOQUE (L538), RANGE ROVER EVOQUE Décapotable (L538)" },
    { sku: "20-0L-L17", name: "Filtre à air ASHIKA 20-0L-L17", brand: "Ashika", category: "Filtres>Filtre à air", priceBuy: 22, priceSell: 34.80, stockQty: 12, description: "Filtre à air LAND ROVER DISCOVERY IV (L319), DISCOVERY V (L462), RANGE ROVER III (L322), RANGE ROVER IV (L405), RANGE ROVER SPORT (L320), RANGE ROVER SPORT (L494)" },
    { sku: "F205701", name: "Filtre à air KAMOKA F205701", brand: "Kamoka", category: "Filtres>Filtre à air", priceBuy: 32, priceSell: 51.00, stockQty: 3, description: "Filtre à air ALPINA D3 (E90), D3 Break (E91), AUDI A4 (8K2, B8), BMW Série 1 (E81), Série 1 (E87), Série 1 Coupé (E82)" },
    { sku: "20-05-587", name: "Filtre à air ASHIKA 20-05-587", brand: "Ashika", category: "Filtres>Filtre à air", priceBuy: 16, priceSell: 26.00, stockQty: 25, description: "Filtre à air MITSUBISHI CARISMA Sedan (DA_), COLT V (CJ_, CP_), LANCER VI (CJ-CP_), LANCER VII (CS_A, CT_A), LANCER VII Break (CS_W, CT_W), OUTLANDER I (CU_W)" },
    { sku: "F247701", name: "Filtre à air KAMOKA F247701", brand: "Kamoka", category: "Filtres>Filtre à air", priceBuy: 17, priceSell: 28.20, stockQty: 14, description: "Filtre à air KIA PRO CEE'D (ED), LAND ROVER DISCOVERY III (L319), DISCOVERY III VAN (L319), DISCOVERY IV (L319), DISCOVERY IV VAN (L319), RANGE ROVER III (L322)" },
    { sku: "20-09-915", name: "Filtre à air ASHIKA 20-09-915", brand: "Ashika", category: "Filtres>Filtre à air", priceBuy: 19, priceSell: 30.60, stockQty: 9, description: "Filtre à air JEEP WRANGLER III (JK)" },
    { sku: "F235701", name: "Filtre à air KAMOKA F235701", brand: "Kamoka", category: "Filtres>Filtre à air", priceBuy: 20, priceSell: 32.10, stockQty: 16, description: "Filtre à air ALFA ROMEO 4C (960_), 4C SPIDER (961_), FIAT BRAVO II (198_), LANCIA DELTA III (844_)" },

    // ---- Filtres > Filtre à huile ----
    { sku: "OC-90-KM", name: "Filtre à huile KAMOKA F109101", brand: "Kamoka", category: "Filtres>Filtre à huile", priceBuy: 6, priceSell: 11.90, stockQty: 60, description: "Filtre à huile compatible Renault Clio III/IV, Dacia Logan/Duster 1.5 dCi", isTopSeller: true, engineFitCount: 4 },
    { sku: "OC-91-MF", name: "Filtre à huile MANN-FILTER W712/75", brand: "Mann-Filter", category: "Filtres>Filtre à huile", priceBuy: 8, priceSell: 14.50, stockQty: 40, description: "Filtre à huile compatible Peugeot 208/308, Citroën C3 1.6 HDi", engineFitCount: 3 },
    { sku: "OC-92-VL", name: "Filtre à huile VALEO 586504", brand: "Valeo", category: "Filtres>Filtre à huile", priceBuy: 7, priceSell: 13.20, stockQty: 35, description: "Filtre à huile compatible Volkswagen Golf/Polo TDI", engineFitCount: 2 },
    { sku: "OC-93-FB", name: "Filtre à huile FEBI 26845", brand: "Febi", category: "Filtres>Filtre à huile", priceBuy: 6, priceSell: 12.40, stockQty: 45, description: "Filtre à huile compatible Kia/Hyundai essence et diesel", engineFitCount: 3 },

    // ---- Freinage ----
    { sku: "BR-4820", name: "Kit de plaquettes de frein avant TRW GDB1330", brand: "TRW", category: "Freinage>Kit de plaquettes de frein", priceBuy: 58, priceSell: 89.00, compareAt: 109, stockQty: 22, description: "Kit de plaquettes de frein avant, compatible Renault Clio III/IV, Dacia Logan/Duster", isTopSeller: true, engineFitCount: 5 },
    { sku: "BR-4821", name: "Kit de plaquettes de frein avant FERODO FDB1234", brand: "Ferodo", category: "Freinage>Kit de plaquettes de frein", priceBuy: 62, priceSell: 94.00, stockQty: 4, description: "Kit de plaquettes de frein avant, compatible Peugeot 208/308, Citroën C3", engineFitCount: 3 },
    { sku: "BR-4822", name: "Kit de plaquettes de frein arrière SACHS", brand: "Sachs", category: "Freinage>Kit de plaquettes de frein", priceBuy: 45, priceSell: 72.00, stockQty: 18, description: "Kit de plaquettes de frein arrière, compatible Volkswagen Golf/Polo", engineFitCount: 2 },
    { sku: "DS-1001", name: "Disque de frein avant ventilé TRW DF4109", brand: "TRW", category: "Freinage>Disque de frein", priceBuy: 65, priceSell: 99.00, stockQty: 16, description: "Disque de frein avant ventilé Ø280mm, compatible Renault Clio IV, Dacia Duster", isTopSeller: true, engineFitCount: 4 },
    { sku: "DS-1002", name: "Disque de frein arrière plein FEBI", brand: "Febi", category: "Freinage>Disque de frein", priceBuy: 40, priceSell: 62.00, stockQty: 20, description: "Disque de frein arrière plein Ø260mm, compatible Peugeot 208/308", engineFitCount: 3 },
    { sku: "DS-1003", name: "Disque de frein avant KAMOKA", brand: "Kamoka", category: "Freinage>Disque de frein", priceBuy: 38, priceSell: 58.00, stockQty: 25, description: "Disque de frein avant, compatible Kia Picanto, Hyundai i10", engineFitCount: 2 },
    { sku: "ET-2001", name: "Étrier de frein avant droit DELPHI", brand: "Delphi", category: "Freinage>Étrier de frein", priceBuy: 120, priceSell: 179.00, stockQty: 8, description: "Étrier de frein avant droit, compatible Renault Clio III/IV", engineFitCount: 2 },

    // ---- Courroie, tendeur et chaine ----
    { sku: "TB-3001", name: "Kit de distribution GATES K015578XS", brand: "Gates", category: "Courroie, tendeur et chaine>Kit de distribution", priceBuy: 95, priceSell: 149.00, compareAt: 179, stockQty: 12, description: "Kit de distribution complet (courroie + galets), compatible Renault Clio/Dacia 1.5 dCi", isTopSeller: true, engineFitCount: 4 },
    { sku: "TB-3002", name: "Kit de distribution + pompe à eau GATES", brand: "Gates", category: "Courroie, tendeur et chaine>Kit de distribution", priceBuy: 130, priceSell: 199.00, stockQty: 6, description: "Kit de distribution avec pompe à eau, compatible Volkswagen Golf/Polo TDI", engineFitCount: 2 },
    { sku: "TB-3003", name: "Courroie de distribution GATES 5568XS", brand: "Gates", category: "Courroie, tendeur et chaine>Courroie de distribution", priceBuy: 35, priceSell: 55.00, stockQty: 20, description: "Courroie de distribution seule, compatible Peugeot 208/308 1.6 HDi", engineFitCount: 3 },
    { sku: "TB-3004", name: "Courroie d'accessoire GATES 6PK1190", brand: "Gates", category: "Courroie, tendeur et chaine>Courroie", priceBuy: 18, priceSell: 29.00, stockQty: 30, description: "Courroie d'accessoire (alternateur/clim), compatible large gamme Renault/Dacia", engineFitCount: 5 },

    // ---- Allumage préchauffage ----
    { sku: "SP-5001", name: "Bougie d'allumage NGK BKR6E (x4)", brand: "NGK", category: "Allumage préchauffage>Bougie d'allumage", priceBuy: 24, priceSell: 39.00, stockQty: 50, description: "Jeu de 4 bougies d'allumage, compatible essence Peugeot/Citroën/Toyota", isTopSeller: true, engineFitCount: 4 },
    { sku: "SP-5002", name: "Bobine d'allumage DENSO", brand: "Denso", category: "Allumage préchauffage>Bobine d'allumage", priceBuy: 45, priceSell: 69.00, stockQty: 14, description: "Bobine d'allumage, compatible Kia/Hyundai essence", engineFitCount: 2 },

    // ---- Suspension ----
    { sku: "AM-6001", name: "Amortisseur avant MONROE G8952", brand: "Monroe", category: "Suspension>Amortisseur", priceBuy: 78, priceSell: 119.00, stockQty: 14, description: "Amortisseur avant à gaz, compatible Renault Clio III/IV", isTopSeller: true, engineFitCount: 3 },
    { sku: "AM-6002", name: "Amortisseur arrière MONROE", brand: "Monroe", category: "Suspension>Amortisseur", priceBuy: 62, priceSell: 95.00, stockQty: 10, description: "Amortisseur arrière, compatible Peugeot 208/308", engineFitCount: 2 },
    { sku: "AM-6003", name: "Amortisseur avant SACHS", brand: "Sachs", category: "Suspension>Amortisseur", priceBuy: 82, priceSell: 125.00, stockQty: 7, description: "Amortisseur avant, compatible Volkswagen Golf VII", engineFitCount: 2 },

    // ---- Direction et Trains roulants ----
    { sku: "RD-7001", name: "Rotule de direction TRW JTE717", brand: "TRW", category: "Direction et Trains roulants>Rotule de direction", priceBuy: 22, priceSell: 35.00, stockQty: 20, description: "Rotule de direction extérieure, compatible Renault/Dacia", engineFitCount: 3 },
    { sku: "KR-7002", name: "Kit de roulements de roue SKF VKBA3573", brand: "SKF", category: "Direction et Trains roulants>Kit de roulements de roue", priceBuy: 55, priceSell: 85.00, stockQty: 12, description: "Kit de roulement de roue avant, compatible Peugeot/Citroën", engineFitCount: 3 },

    // ---- Embrayage ----
    { sku: "CL-8001", name: "Kit d'embrayage SACHS 3000951xxx", brand: "Sachs", category: "Embrayage>Kit d'embrayage", priceBuy: 145, priceSell: 219.00, stockQty: 8, description: "Kit d'embrayage complet (disque + mécanisme + butée), compatible Renault Clio/Dacia 1.5 dCi", isTopSeller: true, engineFitCount: 3 },
    { sku: "CL-8002", name: "Kit d'embrayage VALEO", brand: "Valeo", category: "Embrayage>Kit d'embrayage", priceBuy: 160, priceSell: 239.00, stockQty: 5, description: "Kit d'embrayage complet, compatible Volkswagen Golf TDI", engineFitCount: 2 },

    // ---- Moteur ----
    { sku: "WP-9001", name: "Pompe à eau GATES WP0034", brand: "Gates", category: "Moteur>Pompe à eau", priceBuy: 42, priceSell: 65.00, stockQty: 15, description: "Pompe à eau, compatible Renault/Dacia 1.5 dCi", engineFitCount: 3 },
    { sku: "TU-9002", name: "Turbo (échange standard) GARRETT", brand: "Bosch", category: "Moteur>Turbo", priceBuy: 380, priceSell: 549.00, stockQty: 3, description: "Turbocompresseur reconditionné, compatible Peugeot/Citroën 1.6 HDi", engineFitCount: 2 },
    { sku: "SM-9003", name: "Support moteur FEBI", brand: "Febi", category: "Moteur>Support moteur", priceBuy: 28, priceSell: 45.00, stockQty: 18, description: "Support moteur, compatible large gamme Renault/Dacia", engineFitCount: 4 },

    // ---- Eclairage ----
    { sku: "LG-10001", name: "Phare avant droit VALEO", brand: "Valeo", category: "Eclairage>Phare avant", priceBuy: 145, priceSell: 219.00, stockQty: 6, description: "Optique de phare avant droit, compatible Renault Clio IV", engineFitCount: 2 },
    { sku: "LG-10002", name: "Feu arrière gauche DEPO", brand: "Valeo", category: "Eclairage>Feu arrière", priceBuy: 65, priceSell: 99.00, stockQty: 9, description: "Feu arrière gauche, compatible Peugeot 208", engineFitCount: 2 },

    // ---- Démarrage électrique ----
    { sku: "ST-11001", name: "Démarreur BOSCH 0001107405", brand: "Bosch", category: "Démarrage électrique>Démarreur", priceBuy: 210, priceSell: 299.00, stockQty: 7, description: "Démarreur, compatible Renault/Dacia 1.5 dCi", engineFitCount: 3 },
    { sku: "AL-11002", name: "Alternateur VALEO 439521", brand: "Valeo", category: "Démarrage électrique>Alternateur", priceBuy: 260, priceSell: 369.00, stockQty: 5, description: "Alternateur 120A, compatible Peugeot/Citroën HDi", engineFitCount: 3 },

    // ---- Capteurs et sondes ----
    { sku: "SN-12001", name: "Sonde lambda BOSCH 0258006537", brand: "Bosch", category: "Capteurs et sondes>Sonde lambda", priceBuy: 68, priceSell: 99.00, stockQty: 11, description: "Sonde lambda, compatible essence Kia/Hyundai/Toyota", engineFitCount: 3 },

    // ---- Carosserie ----
    { sku: "WB-13001", name: "Balai d'essuie-glace BOSCH Aerotwin (paire)", brand: "Bosch", category: "Carosserie>Balai d'essuie-glace", priceBuy: 22, priceSell: 35.00, stockQty: 40, description: "Paire de balais d'essuie-glace, compatible toute gamme", isTopSeller: true, engineFitCount: 6 },

    // ---- Refroidissement moteur ----
    { sku: "RD-14001", name: "Radiateur de refroidissement moteur VALEO", brand: "Valeo", category: "Refroidissement moteur>Radiateur, refroidissement du moteur", priceBuy: 145, priceSell: 219.00, stockQty: 6, description: "Radiateur moteur, compatible Renault Clio III/IV", engineFitCount: 2 },
    { sku: "TH-14002", name: "Thermostat d'eau FEBI", brand: "Febi", category: "Refroidissement moteur>Thermostat d'eau", priceBuy: 18, priceSell: 29.00, stockQty: 25, description: "Thermostat d'eau, compatible large gamme diesel", engineFitCount: 4 },

    // ---- Cardan et Transmission ----
    { sku: "CV-15001", name: "Cardan complet côté roue GKN", brand: "SKF", category: "Cardan et Transmission>Cardan", priceBuy: 95, priceSell: 145.00, stockQty: 9, description: "Cardan complet côté roue, compatible Peugeot/Citroën", engineFitCount: 2 },

    // ---- Climatisation ----
    { sku: "AC-16001", name: "Compresseur de climatisation DENSO", brand: "Denso", category: "Climatisation>Compresseur, climatisation", priceBuy: 320, priceSell: 449.00, stockQty: 4, description: "Compresseur de climatisation, compatible Renault/Dacia", engineFitCount: 2 },

    // ---- Lubrifiant ----
    { sku: "OIL-17001", name: "Huile moteur CASTROL EDGE 5W30 (5L)", brand: "Castrol", category: "Lubrifiant>Huile moteur", priceBuy: 68, priceSell: 94.00, stockQty: 45, description: "Huile moteur synthèse 5W30, bidon 5 litres, toutes motorisations essence/diesel récentes", isTopSeller: true },
    { sku: "OIL-17002", name: "Huile moteur CASTROL MAGNATEC 10W40 (4L)", brand: "Castrol", category: "Lubrifiant>Huile moteur", priceBuy: 48, priceSell: 69.00, stockQty: 38, description: "Huile moteur semi-synthèse 10W40, bidon 4 litres" },
    { sku: "OIL-17003", name: "Antigel CASTROL -37°C (5L)", brand: "Castrol", category: "Lubrifiant>Antigel", priceBuy: 22, priceSell: 34.00, stockQty: 30, description: "Liquide de refroidissement prêt à l'emploi, protection -37°C" },

    // ---- Packs entretien — real bundle SKUs, priced honestly as sum − 15% ----
    { sku: "PACK-REVISION-15K", name: "Pack Révision 15 000 km", brand: "Automotive", category: "Lubrifiant>Huile moteur", priceBuy: 90, priceSell: 118.00, compareAt: 138.60, stockQty: 20, description: "Vidange complète : huile moteur 5W-30 (5L), filtre à huile et filtre à air.", engineFitCount: 0 },
    { sku: "PACK-FREINAGE-AV-AR", name: "Pack Freinage avant + arrière", brand: "Automotive", category: "Freinage>Kit de plaquettes de frein", priceBuy: 165, priceSell: 221.00, compareAt: 260.00, stockQty: 12, description: "Plaquettes avant et arrière, plus disque de frein avant : de quoi refaire les quatre roues.", engineFitCount: 0 },
    { sku: "PACK-HIVER", name: "Pack Prêt pour l'hiver", brand: "Automotive", category: "Carosserie>Balai d'essuie-glace", priceBuy: 65, priceSell: 83.00, compareAt: 98.00, stockQty: 20, description: "Balais d'essuie-glace, antigel -37°C et thermostat d'eau.", engineFitCount: 0 },
  ];

  // Component breakdown shown in the pack's "Dans le pack" list — pulled from
  // the real, currently seeded products above, not a separate invented list.
  const PACK_CONTENTS: Record<string, string[]> = {
    "PACK-REVISION-15K": ["OC-90-KM", "F217001", "OIL-17001"],
    "PACK-FREINAGE-AV-AR": ["BR-4820", "BR-4822", "DS-1001"],
    "PACK-HIVER": ["WB-13001", "OIL-17003", "TH-14002"],
  };

  const productIdBySku = new Map<string, string>();
  for (const p of products) {
    const categoryId = catByName.get(p.category);
    if (!categoryId) throw new Error(`Unknown category ${p.category}`);
    const brandId = brandByName.get(p.brand);
    const created = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        sku: p.sku,
        name: p.name,
        slug: slugify(`${p.name}-${p.sku}`),
        brandId,
        categoryId,
        description: p.description,
        priceBuy: p.priceBuy,
        priceSell: p.priceSell,
        compareAtPrice: p.compareAt,
        stockQty: p.stockQty,
        lowStockThreshold: 5,
        isTopSeller: !!p.isTopSeller,
        oemRefs: p.oemRefs ?? [],
        specs: p.sku in PACK_CONTENTS ? { packContents: PACK_CONTENTS[p.sku] } : undefined,
      },
    });
    productIdBySku.set(p.sku, created.id);

    const fitCount = p.engineFitCount ?? 3;
    const engines = randomEngines(fitCount);
    for (const engineId of engines) {
      await prisma.productFitment.upsert({
        where: { productId_engineId: { productId: created.id, engineId } },
        update: {},
        create: { productId: created.id, engineId },
      });
    }
  }

  console.log("Seeding settings…");
  // Left as clearly-flagged placeholders — a real launch must not ship with
  // guessed contact details. See src/lib/settings.ts DEFAULT_SETTINGS.

  console.log("Seeding admin + demo customer…");
  // update: {} here would mean re-running the seed against a database that
  // already has these rows (e.g. a stale demo account, or a password hash
  // from a previous version of this script) leaves the password exactly as
  // it was — so the "Admin login: .../admin1234" line below would print a
  // credential that isn't actually true. Reset the hash (and the other
  // fields) on every run so the printed credentials are always correct.
  const adminPasswordHash = await bcrypt.hash("admin1234", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@automotive-pieces-auto.tn" },
    update: { passwordHash: adminPasswordHash, name: "Admin", role: "ADMIN" },
    create: {
      email: "admin@automotive-pieces-auto.tn",
      passwordHash: adminPasswordHash,
      name: "Admin",
      role: "ADMIN",
    },
  });

  const customerPasswordHash = await bcrypt.hash("client1234", 10);
  const customer = await prisma.user.upsert({
    where: { email: "karim.bensalah@example.com" },
    update: {
      passwordHash: customerPasswordHash,
      name: "Karim Ben Salah",
      phone: "+216 20 111 222",
      role: "CUSTOMER",
      segment: "REGULAR",
    },
    create: {
      email: "karim.bensalah@example.com",
      passwordHash: customerPasswordHash,
      name: "Karim Ben Salah",
      phone: "+216 20 111 222",
      role: "CUSTOMER",
      segment: "REGULAR",
    },
  });

  console.log("Seeding demo orders…");
  const brakePad = productIdBySku.get("BR-4820")!;
  const airFilter = productIdBySku.get("F217001")!;
  const oil = productIdBySku.get("OIL-17001")!;

  const existingOrders = await prisma.order.count();
  if (existingOrders === 0) {
    const demoOrders: {
      ref: string; customerName: string; phone: string; status: OrderStatus;
      items: { productId: string; qty: number }[]; daysAgo: number;
    }[] = [
      { ref: "CMD-1042", customerName: "Karim Ben Salah", phone: "+216 20 111 222", status: "PENDING", items: [{ productId: brakePad, qty: 1 }, { productId: oil, qty: 1 }], daysAgo: 0 },
      { ref: "CMD-1041", customerName: "Amira Trabelsi", phone: "+216 22 333 444", status: "SHIPPED", items: [{ productId: brakePad, qty: 2 }], daysAgo: 1 },
      { ref: "CMD-1040", customerName: "Mohamed Gharbi", phone: "+216 24 555 666", status: "DELIVERED", items: [{ productId: airFilter, qty: 3 }], daysAgo: 4 },
      { ref: "CMD-1039", customerName: "Sonia Fekih", phone: "+216 26 777 888", status: "CONFIRMED", items: [{ productId: oil, qty: 2 }, { productId: airFilter, qty: 1 }], daysAgo: 2 },
    ];

    for (const o of demoOrders) {
      const lineItems = await Promise.all(
        o.items.map(async (it) => {
          const prod = await prisma.product.findUniqueOrThrow({ where: { id: it.productId } });
          return {
            productId: prod.id,
            name: prod.name,
            sku: prod.sku,
            imageUrl: prod.imageUrl,
            unitPrice: prod.priceSell,
            qty: it.qty,
            lineTotal: Number(prod.priceSell) * it.qty,
          };
        })
      );
      const subtotal = lineItems.reduce((s, l) => s + Number(l.lineTotal), 0);
      const shippingFee = subtotal >= 150 ? 0 : 8;
      const createdAt = new Date(Date.now() - o.daysAgo * 86400000);
      await prisma.order.create({
        data: {
          ref: o.ref,
          userId: o.customerName === "Karim Ben Salah" ? customer.id : undefined,
          customerName: o.customerName,
          phone: o.phone,
          governorate: "Tunis",
          address: "Adresse cliente (démo)",
          deliveryMethod: "DELIVERY",
          paymentMethod: "COD",
          status: o.status,
          subtotal,
          shippingFee,
          total: subtotal + shippingFee,
          createdAt,
          updatedAt: createdAt,
          items: { create: lineItems },
          history: {
            create: { status: o.status, createdAt },
          },
        },
      });
    }
  }

  console.log("Seeding reviews…");
  const existingReviews = await prisma.review.count();
  if (existingReviews === 0) {
    await prisma.review.createMany({
      data: [
        { productId: brakePad, authorName: "Mehdi B. — Sfax", rating: 5, comment: "Commandé un kit de freinage le matin, livré en 48h à Sfax. Les références correspondaient exactement.", verified: true },
        { productId: airFilter, authorName: "Salma T. — Tunis", rating: 5, comment: "J'ai envoyé ma carte grise sur WhatsApp, ils m'ont trouvé la pièce en 10 minutes. Service impeccable.", verified: true },
        { productId: oil, authorName: "Garage Ennasr — Ariana", rating: 5, comment: "Nous équipons notre garage chez eux depuis deux ans. Prix corrects et disponibilité réelle.", verified: true },
      ],
    });
  }

  console.log("Done.");
  console.log("Admin login: admin@automotive-pieces-auto.tn / admin1234");
  console.log("Demo customer login: karim.bensalah@example.com / client1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
