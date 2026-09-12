import { getSettings } from "@/lib/settings";
import { taxPolicy } from "@/lib/tax";
import CartView from "@/components/CartView";

/**
 * The cart is a server page wrapping a client view for one reason: the free
 * delivery threshold is a shop setting, and the cart cannot state what
 * delivery costs without it. It used to state nothing at all and call the
 * subtotal a total.
 */
export default async function CartPage() {
  const settings = await getSettings();
  return (
    <CartView
      freeShippingThreshold={Number(settings.free_shipping_threshold) || 150}
      stampDuty={taxPolicy(settings).stampDuty}
    />
  );
}
