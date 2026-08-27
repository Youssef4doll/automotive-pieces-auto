import { getSettings } from "@/lib/settings";
import CheckoutForm from "@/components/CheckoutForm";

export const metadata = { title: "Finaliser la commande" };

export default async function CheckoutPage() {
  const settings = await getSettings();

  return (
    <CheckoutForm
      freeShippingThreshold={Number(settings.free_shipping_threshold) || 150}
      deliveryGrandTunis={settings.delivery_grand_tunis}
      deliveryRegions={settings.delivery_regions}
    />
  );
}
