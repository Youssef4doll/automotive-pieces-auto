import { cookies } from "next/headers";
import { getMegaMenu } from "@/lib/data/catalog";
import { getSettings, publicContact, contactHref } from "@/lib/settings";
import { getCurrentUser } from "@/lib/session";
import HeaderClient, { NOTICE_COOKIE } from "./HeaderClient";

export default async function Header() {
  const [families, settings, user, jar] = await Promise.all([
    getMegaMenu(),
    getSettings(),
    getCurrentUser(),
    cookies(),
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
      // Read here, on the server, so the delivery strip is in the first HTML
      // the phone paints. It used to be decided in an effect against
      // localStorage, which meant it was absent from every first paint and
      // then inserted 44px above the fold a second later: the whole page
      // jumped down, on every route, for every visitor who had not dismissed
      // it. That one shift was the site's entire CLS.
      noticeDismissed={jar.get(NOTICE_COOKIE)?.value === "1"}
    />
  );
}
