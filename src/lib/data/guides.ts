import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Buying guides — the questions customers ask before they know what to order.
 *
 * Written to be useful rather than to rank: someone whose car pulls to one
 * side under braking does not know they need a caliper, and the search box
 * cannot help them. Each guide ends where the shop can actually serve them,
 * on a family of parts it stocks.
 *
 * Two rules held throughout:
 *
 *  - No invented numbers. Service intervals differ by engine and by
 *    manufacturer, so the guides say where to find yours (the service book,
 *    the carte grise, us) instead of printing a figure that would be wrong for
 *    most readers. A wrong interval in print is worse than no interval.
 *  - No page without a destination. A guide whose family the shop does not
 *    stock is not published, so every guide can end in something buyable.
 */

export type GuideSection = { heading: string; body: string[] };

export type Guide = {
  slug: string;
  title: string;
  /** The question a customer would actually type or ask over the counter. */
  question: string;
  summary: string;
  /** Category slug this guide sends the reader to. Must hold live products. */
  familySlug: string;
  sections: GuideSection[];
};

const GUIDES: Guide[] = [
  {
    slug: "quand-changer-les-plaquettes-de-frein",
    title: "Quand changer ses plaquettes de frein",
    question: "Comment savoir si mes plaquettes de frein sont usées ?",
    summary:
      "Les signes qui indiquent des plaquettes en fin de vie, ce qu'il faut vérifier avant de commander, et pourquoi les disques comptent autant que les plaquettes.",
    familySlug: "freinage",
    sections: [
      {
        heading: "Les signes qui ne trompent pas",
        body: [
          "Un sifflement métallique quand vous freinez doucement est le témoin d'usure qui fait son travail : il est posé pour crier avant que la garniture ne soit épuisée. À ce stade la pièce est encore sûre, mais le compte à rebours a commencé.",
          "Un grincement grave et continu, lui, signifie que la garniture est partie et que le support métallique frotte sur le disque. Il ne faut plus rouler ainsi : à ce moment-là ce ne sont plus seulement les plaquettes qu'il faut remplacer, mais aussi les disques qu'elles sont en train de rayer.",
          "Une pédale qui s'enfonce plus qu'avant, des vibrations dans le volant au freinage, ou une voiture qui tire d'un côté quand vous ralentissez : ce sont des symptômes de freinage, mais pas forcément des plaquettes. Ils désignent souvent un étrier grippé ou un disque voilé.",
        ],
      },
      {
        heading: "Ce qu'il faut vérifier avant de commander",
        body: [
          "L'épaisseur restante se lit par la jante, sans démonter la roue : la garniture est la partie tendre entre le support métallique et le disque. Neuve elle fait généralement autour d'un centimètre et demi ; il faut la remplacer bien avant qu'elle n'atteigne l'épaisseur du support.",
          "Vérifiez l'essieu. Les plaquettes avant et arrière ne sont pas les mêmes pièces, ne s'usent pas au même rythme, et se remplacent toujours par paire sur le même essieu — jamais d'un seul côté.",
          "Regardez les disques en même temps. Un disque marqué d'un rebord net sur son bord extérieur est trop usé pour recevoir des plaquettes neuves : elles s'useraient en quelques milliers de kilomètres.",
        ],
      },
      {
        heading: "Trouver la bonne référence",
        body: [
          "Une plaquette se choisit sur la motorisation, pas seulement sur le modèle : deux Clio IV n'ont pas les mêmes freins selon le moteur. Indiquez votre véhicule sur le site et nous ne montrons que ce qui va dessus.",
          "Si vous avez encore l'ancienne pièce ou son emballage, le numéro imprimé dessus est la voie la plus sûre : tapez-le dans la recherche, il nous mène directement à la référence.",
        ],
      },
    ],
  },
  {
    slug: "choisir-son-huile-moteur",
    title: "Choisir son huile moteur",
    question: "Quelle huile moteur pour ma voiture ?",
    summary:
      "Ce que veulent dire 5W-30 et 10W-40, pourquoi la norme constructeur compte plus que la marque, et où trouver celle qui correspond à votre moteur.",
    familySlug: "lubrifiant",
    sections: [
      {
        heading: "Lire l'étiquette",
        body: [
          "Sur un bidon marqué 5W-30, le premier nombre décrit la fluidité à froid — plus il est bas, mieux l'huile circule au démarrage, qui est le moment où un moteur s'use le plus. Le second décrit sa tenue une fois chaud.",
          "En Tunisie le froid n'est pas le problème ; la chaleur l'est. Cela ne veut pas dire qu'il faut choisir l'huile la plus épaisse : un moteur moderne a des passages calibrés pour une viscosité précise, et une huile trop épaisse arrive trop tard là où elle doit arriver.",
        ],
      },
      {
        heading: "La norme constructeur avant la marque",
        body: [
          "Ce qui compte réellement n'est pas le nom sur le bidon mais l'homologation qu'il porte : ACEA, API, et surtout l'approbation propre au constructeur. Un moteur diesel équipé d'un filtre à particules exige une huile dite « low SAPS » ; y mettre une huile ordinaire encrasse le filtre, et le filtre coûte bien plus cher que le bidon.",
          "La référence exacte pour votre moteur est écrite dans le carnet d'entretien du véhicule. C'est la seule source qui vaut pour votre voiture en particulier — nous ne publions pas de tableau d'équivalences, parce qu'un tableau juste pour la plupart des moteurs est faux pour le vôtre.",
        ],
      },
      {
        heading: "Ce qui se change en même temps",
        body: [
          "Une vidange sans filtre à huile neuf n'est pas une vidange : le filtre retient les particules de la période précédente et les rendrait immédiatement à l'huile neuve.",
          "C'est aussi le moment de regarder le filtre à air et le filtre d'habitacle, qui se contrôlent en deux minutes pendant que la voiture est levée.",
        ],
      },
    ],
  },
  {
    slug: "kit-de-distribution-quand-le-remplacer",
    title: "Kit de distribution : quand le remplacer",
    question: "Quand faut-il changer la courroie de distribution ?",
    summary:
      "Pourquoi c'est la pièce à ne pas laisser passer, ce que contient un kit complet, et comment savoir où en est la vôtre.",
    familySlug: "courroie-tendeur-et-chaine",
    sections: [
      {
        heading: "Pourquoi celle-ci et pas une autre",
        body: [
          "La courroie de distribution synchronise le haut et le bas du moteur. Sur la plupart des moteurs modernes, si elle casse, les soupapes rencontrent les pistons — et la facture n'est plus celle d'une courroie mais celle d'un moteur.",
          "C'est la seule pièce d'entretien dont l'oubli peut détruire le moteur sans prévenir. Elle ne donne presque jamais de signe avant-coureur : elle se remplace sur une échéance, pas sur un symptôme.",
        ],
      },
      {
        heading: "Connaître son échéance",
        body: [
          "L'intervalle dépend du moteur et se compte en kilomètres et en années — la matière vieillit même sur une voiture peu roulée. Votre carnet d'entretien donne le chiffre pour votre motorisation ; si vous ne l'avez pas, envoyez-nous votre carte grise et nous le cherchons avec vous.",
          "Si vous avez acheté la voiture d'occasion sans facture de distribution, considérez qu'elle est à faire. C'est un pari à sens unique : la refaire pour rien coûte une courroie, l'oublier coûte un moteur.",
        ],
      },
      {
        heading: "Kit complet, pas courroie seule",
        body: [
          "Un kit contient la courroie, les galets et le tendeur — les pièces qui tournent avec elle et qui ont exactement le même âge. Remonter une courroie neuve sur un galet fatigué revient à refaire le travail deux fois.",
          "Sur beaucoup de moteurs la pompe à eau est entraînée par cette même courroie. Si c'est le cas du vôtre, elle se change dans le même mouvement : la main-d'œuvre est déjà payée.",
        ],
      },
    ],
  },
  {
    slug: "filtre-habitacle-air-huile-carburant",
    title: "Les quatre filtres, et ce que chacun protège",
    question: "À quoi servent les différents filtres de ma voiture ?",
    summary:
      "Huile, air, carburant, habitacle : ce que chacun retient, ce qui arrive quand il est bouché, et lequel se néglige le plus souvent.",
    familySlug: "filtres",
    sections: [
      {
        heading: "Filtre à huile",
        body: [
          "Il retient les particules métalliques et les résidus de combustion en suspension dans l'huile. Saturé, il s'ouvre sur son clapet de sécurité et l'huile circule alors sans être filtrée du tout — le moteur continue de tourner, et s'use en silence.",
          "Il se remplace à chaque vidange, sans exception.",
        ],
      },
      {
        heading: "Filtre à air",
        body: [
          "Il protège le moteur de la poussière. Dans un pays où la poussière est une donnée permanente, c'est le filtre qui se colmate le plus vite.",
          "Un filtre à air bouché étouffe le moteur : consommation en hausse, reprises molles. Il se contrôle à l'œil en le sortant de sa boîte, et c'est l'entretien le moins cher et le plus visité du carnet.",
        ],
      },
      {
        heading: "Filtre à carburant",
        body: [
          "Il protège le circuit d'injection, qui est la partie la plus chère et la plus fragile d'un diesel moderne. Encrassé, il provoque des à-coups, des pertes de puissance en côte, parfois des démarrages difficiles.",
          "Il ne se contrôle pas à l'œil : il se remplace à l'échéance donnée par le constructeur.",
        ],
      },
      {
        heading: "Filtre d'habitacle",
        body: [
          "Celui-ci ne protège pas le moteur mais vous. C'est le seul filtre dont l'oubli se sent immédiatement : odeurs, vitres qui se désembuent mal, climatisation qui souffle moins fort.",
          "Il s'appelle aussi filtre à pollen ou filtre de climatisation — trois noms pour la même pièce, ce qui explique qu'on le cherche souvent au mauvais endroit.",
        ],
      },
    ],
  },
];

/**
 * The guides whose family the shop can actually serve.
 *
 * A guide that ends on an empty category is an article that wastes the
 * reader's time and teaches a crawler the site is thin, so it stays unpublished
 * until there is stock behind it — and appears on its own once there is.
 */
export async function listGuides(): Promise<(Guide & { productCount: number })[]> {
  const families = await prisma.category.findMany({
    where: { slug: { in: GUIDES.map((g) => g.familySlug) } },
    select: {
      slug: true,
      name: true,
      _count: { select: { products: { where: { active: true } } } },
      children: { select: { _count: { select: { products: { where: { active: true } } } } } },
    },
  });

  const counts = new Map(
    families.map((f) => [
      f.slug,
      f._count.products + f.children.reduce((n, c) => n + c._count.products, 0),
    ]),
  );

  return GUIDES.map((g) => ({ ...g, productCount: counts.get(g.familySlug) ?? 0 })).filter(
    (g) => g.productCount > 0,
  );
}

export async function getGuide(slug: string) {
  return (await listGuides()).find((g) => g.slug === slug) ?? null;
}

/** The family a guide points at, with its display name. */
export async function getGuideFamily(familySlug: string) {
  return prisma.category.findUnique({ where: { slug: familySlug }, select: { name: true, slug: true } });
}
