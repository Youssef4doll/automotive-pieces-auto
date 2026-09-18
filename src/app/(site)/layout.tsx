import Header from "@/components/Header";
import NavProgress from "@/components/NavProgress";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import CartSync from "@/components/CartSync";
import AddedToast from "@/components/AddedToast";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import { getSettings } from "@/lib/settings";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const settings = await getSettings();
  const freeShippingThreshold = Number(settings.free_shipping_threshold) || 150;

  return (
    <>
      <NavProgress />
      <Header />
      {/* `flex-1` so a short page still pushes the footer to the bottom — but
          NOT `flex flex-col`, which it was.

          A column flex container makes every section on every page a flex
          item, and `mx-auto` on a flex item does not centre it inside its
          container: it shrink-wraps it to its own content and centres that.
          So a page laid out as `mx-auto shell-w` rendered at whatever width
          its text happened to need — the home page's vehicle board came out
          809px wide on a 1920px screen instead of 1280, /marques came out
          736px, and an empty cart came out 225px. It was invisible on a phone,
          where content fills the width anyway, and is the whole of "the site
          is small on a big screen".

          Block layout also can't be widened from inside by a child that
          overflows, which is what the `min-w-0` notes dotted around the
          sections were defending against. Those are now belt and braces. */}
      <main className="flex-1">{children}</main>
      <Footer />
      <CartSync />
      <CartDrawer freeShippingThreshold={freeShippingThreshold} />
      <AddedToast />
      {/* Google's, not ours. `Analytics` — the shop's own page-view recorder
          that feeds /admin/analytics — is mounted once in the ROOT layout and
          stays there; this sits in the storefront layout so the admin's own
          staff are not counted as shoppers. */}
      <GoogleAnalytics />
      {/* Nothing floats over the page. The persistent WhatsApp widget, the
          sticky bottom cart bar and — last of the three — the scroll-to-top
          button were all removed for the same reason: they covered content on
          every screen and competed with the page's own actions. The last one
          was the clearest case, because it was caught doing it: on a product
          page it sat on top of "Ajouter" in the sticky buy bar, a round disc
          over the one control the shopper came for. WhatsApp is still
          reachable from the header, footer, the finder, the "can't find your
          part" band and out-of-stock products; cart feedback is carried by the
          header badge and the add-to-cart confirmation; and the way back to
          the top of a page is the one control every browser and phone already
          provides. The only bar left is the product page's own buy bar, which
          is the page's action rather than furniture on top of it. */}
    </>
  );
}
