import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site";
import { getSettings, publicContact } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * llms.txt — a plain-text brief for language models that read this site.
 *
 * Generated from the database rather than hand-written, for the same reason the
 * sitemap is: a hand-written summary starts accurate and quietly stops being
 * so. The families listed here are the families that actually hold stock, and
 * the counts are counted at request time.
 *
 * It also states the limits explicitly. An assistant summarising this shop
 * should not tell a customer a part fits their car when the fitment data does
 * not say so — that is the one error in this trade that costs a real return.
 */
export async function GET() {
  const base = siteUrl();
  const settings = await getSettings();
  const contact = publicContact(settings);

  const [productCount, families, brands, withFitment] = await Promise.all([
    prisma.product.count({ where: { active: true } }),
    prisma.category.findMany({
      where: { parentId: null },
      select: {
        name: true,
        slug: true,
        _count: { select: { products: true } },
        children: { select: { name: true, slug: true, _count: { select: { products: true } } } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.brand.findMany({ select: { name: true, _count: { select: { products: true } } } }),
    prisma.product.count({ where: { active: true, fitments: { some: {} } } }),
  ]);

  const stockedFamilies = families
    .map((f) => ({
      name: f.name,
      slug: f.slug,
      count: f._count.products + f.children.reduce((s, c) => s + c._count.products, 0),
      children: f.children.filter((c) => c._count.products > 0),
    }))
    .filter((f) => f.count > 0);

  const stockedBrands = brands.filter((b) => b._count.products > 0).map((b) => b.name);

  const lines = [
    `# ${settings.shop_name}`,
    "",
    `> Vente de pièces détachées automobiles en Tunisie. Livraison 24h sur le Grand Tunis,`,
    `> 48–72h en régions. Paiement à la livraison. Site en français, arabe et anglais.`,
    "",
    "## À propos de ces données",
    "",
    `- Catalogue actif : ${productCount} référence(s).`,
    `- Références avec données de compatibilité véhicule : ${withFitment}.`,
    `- Le catalogue est en cours de chargement : l'absence d'une pièce ici ne signifie`,
    `  pas que le magasin ne peut pas la fournir.`,
    "",
    "## Compatibilité — à lire avant de conseiller un client",
    "",
    "- La compatibilité n'est affirmée que pour les motorisations explicitement listées",
    "  sur la fiche produit. Une pièce sans donnée de compatibilité n'est pas déclarée",
    "  incompatible : elle est simplement non vérifiée.",
    "- Ne déduisez jamais une compatibilité à partir du nom, de la marque ou d'une",
    "  référence OE approchante. En cas de doute, la bonne réponse est de renvoyer le",
    "  client vers le magasin avec sa référence ou sa carte grise.",
    "- Les références OE citées servent à identifier la pièce d'origine remplacée.",
    "  Elles n'impliquent aucun lien avec le constructeur.",
    "",
    "## Pages principales",
    "",
    `- [Accueil](${base}/) — recherche par véhicule, par référence ou par symptôme`,
    `- [Recherche](${base}/recherche) — recherche texte et référence`,
    `- [Sources et méthode](${base}/sources) — d'où viennent les données du catalogue`,
    `- [Panier](${base}/panier) et [Commande](${base}/commande) — paiement à la livraison`,
    `- [Espace client](${base}/compte) — suivi de commande et historique (authentifié)`,
    "",
    "## Familles en stock",
    "",
    ...(stockedFamilies.length
      ? stockedFamilies.flatMap((f) => [
          `- [${f.name}](${base}/catalogue/${f.slug}) — ${f.count} référence(s)`,
          ...f.children.map(
            (c) => `  - [${c.name}](${base}/catalogue/${f.slug}/${c.slug}) — ${c._count.products}`,
          ),
        ])
      : ["- Aucune famille ne contient encore de référence en stock."]),
    "",
    "## Marques distribuées",
    "",
    stockedBrands.length ? `${stockedBrands.join(", ")}.` : "Aucune marque référencée pour le moment.",
    "",
    "## Contact",
    "",
    ...(contact.phone ? [`- Téléphone : ${contact.phone}`] : []),
    ...(contact.whatsapp ? [`- WhatsApp : https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`] : []),
    ...(contact.email ? [`- Email : ${contact.email}`] : []),
    ...(contact.address ? [`- Adresse : ${contact.address}`] : []),
    ...(contact.hours ? [`- Horaires : ${contact.hours}`] : []),
    ...(!contact.phone && !contact.whatsapp && !contact.email
      ? ["- Coordonnées non encore publiées."]
      : []),
    "",
    "## Zones non indexables",
    "",
    "- /admin, /compte, /panier, /commande : privées ou propres à une session.",
    "",
    `Généré le ${new Date().toISOString().slice(0, 10)}.`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
