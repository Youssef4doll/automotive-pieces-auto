import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import AddedToast from "@/components/AddedToast";
import MascotWidget from "@/components/MascotWidget";
import StickyCartBar from "@/components/StickyCartBar";
import { getSettings } from "@/lib/settings";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const settings = await getSettings();
  const freeShippingThreshold = Number(settings.free_shipping_threshold) || 150;

  return (
    <>
      <Header />
      <main className="flex-1 flex flex-col">{children}</main>
      <Footer />
      <CartDrawer freeShippingThreshold={freeShippingThreshold} />
      <AddedToast />
      <StickyCartBar />
      <MascotWidget whatsapp={settings.shop_whatsapp} />
    </>
  );
}
