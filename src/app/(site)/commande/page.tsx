import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import CheckoutForm from "@/components/CheckoutForm";

export const metadata = { title: "Finaliser la commande" };

export default async function CheckoutPage() {
  const [settings, user] = await Promise.all([getSettings(), getCurrentUser()]);

  // A signed-in shopper should never retype what we already know. Their last
  // order carries the delivery address they actually used, which is a better
  // default than a blank field on every repeat purchase.
  const lastOrder = user
    ? await prisma.order.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: { customerName: true, phone: true, governorate: true, address: true },
      })
    : null;

  return (
    <CheckoutForm
      freeShippingThreshold={Number(settings.free_shipping_threshold) || 150}
      deliveryGrandTunis={settings.delivery_grand_tunis}
      deliveryRegions={settings.delivery_regions}
      defaults={{
        name: user?.name ?? lastOrder?.customerName ?? "",
        phone: user?.phone ?? lastOrder?.phone ?? "",
        email: user?.email ?? "",
        governorate: lastOrder?.governorate ?? "Tunis",
        address: lastOrder?.address ?? "",
      }}
    />
  );
}
