import { getMegaMenu } from "@/lib/data/catalog";
import { getSettings, publicContact, contactHref } from "@/lib/settings";
import { getCurrentUser } from "@/lib/session";
import HeaderClient from "./HeaderClient";

export default async function Header() {
  const [families, settings, user] = await Promise.all([
    getMegaMenu(),
    getSettings(),
    getCurrentUser(),
  ]);

  // Only what the menu draws. The category rows carry a picture now, so
  // imageUrl comes along — the bytes do not: it is a path to /api/images/[id],
  // and when it is null the family's line drawing stands in on the client.
  const menu = families.map((f) => ({
    id: f.id,
    name: f.name,
    slug: f.slug,
    count: f.productCount,
    imageUrl: f.imageUrl,
    children: f.children.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      count: c._count.products,
      imageUrl: c.imageUrl,
    })),
  }));

  const contact = publicContact(settings);
  // Resolved here rather than in the client component: settings.ts reaches for
  // Prisma, so the browser gets the finished URL instead of the helper.
  const contactUrl = contactHref(contact);

  return (
    <HeaderClient
      menu={menu}
      whatsapp={contact.whatsapp}
      phone={contact.phone}
      storeAddress={contact.address}
      contactUrl={contactUrl}
      userName={user?.name ?? null}
      isAdmin={user?.role === "ADMIN"}
    />
  );
}
