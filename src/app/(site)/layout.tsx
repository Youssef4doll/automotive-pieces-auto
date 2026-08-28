import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import AddedToast from "@/components/AddedToast";
import ScrollTopButton from "@/components/ScrollTopButton";
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
      {/* Nothing else floats over the page. The persistent WhatsApp widget and
          the sticky bottom cart bar were both removed: they covered content on
          every screen and competed with the page's own actions. WhatsApp is
          still reachable from the header, footer, the finder, the "can't find
          your part" band and out-of-stock products — the floating copy added
          no reach, only noise. Cart feedback is carried by the header badge
          and the add-to-cart confirmation instead. */}
      <ScrollTopButton />
    </>
  );
}
