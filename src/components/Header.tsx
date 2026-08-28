import { getMegaMenu } from "@/lib/data/catalog";
import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/session";
import HeaderClient from "./HeaderClient";

export default async function Header() {
  const [families, settings, user] = await Promise.all([
    getMegaMenu(),
    getSettings(),
    getCurrentUser(),
  ]);

  const menu = families.map((f) => ({
    id: f.id,
    name: f.name,
    slug: f.slug,
    children: f.children.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      count: c._count.products,
    })),
  }));

  return (
    <HeaderClient
      menu={menu}
      whatsapp={settings.shop_whatsapp}
      phone={settings.shop_phone}
      storeAddress={settings.shop_address}
      userName={user?.name ?? null}
      isAdmin={user?.role === "ADMIN"}
    />
  );
}
