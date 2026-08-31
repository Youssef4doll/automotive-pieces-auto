import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { getOrderCounts, contactFrom, getShoppableFamilies } from "@/lib/data/account";
import AccountShell from "@/components/account/AccountShell";
import { initialsOf } from "@/lib/initials";
import GarageSection from "@/components/account/GarageSection";
import ShopForCar from "@/components/account/ShopForCar";

export const metadata = { title: "Mon garage" };

export default async function GaragePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/compte");

  const [settings, counts, families] = await Promise.all([
    getSettings(),
    getOrderCounts(user.id),
    getShoppableFamilies(10),
  ]);
  const contact = contactFrom(settings);

  return (
    <AccountShell
      title="Mon garage"
      subtitle="Vos véhicules, et les pièces qui vont avec."
      initials={initialsOf(user.name)}
      orderCount={counts.total}
      activeOrders={counts.active}
      whatsapp={contact.whatsapp}
    >
      <div className="flex flex-col gap-4 lg:gap-5">
        <GarageSection />
        <ShopForCar categories={families} />
      </div>
    </AccountShell>
  );
}
