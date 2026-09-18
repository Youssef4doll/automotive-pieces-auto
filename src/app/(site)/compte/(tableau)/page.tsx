import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { toNumber, formatTNDfr } from "@/lib/money";
import { getOrderCounts, contactFrom } from "@/lib/data/account";
import AuthForms from "@/components/AuthForms";
import FormNotice from "@/components/FormNotice";
import AccountShell from "@/components/account/AccountShell";
import AccountTiles from "@/components/account/AccountTiles";
import { StatusBadge, NEXT_STEP } from "@/components/account/OrderBits";
import { IconArrowRight } from "@/components/icons";

export const metadata = { title: "Mon compte" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ rattachees?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <AuthForms />;

  // How many guest orders this sign-in pulled into the account — see
  // claimOrdersForUser. Announced rather than done quietly: the proof of
  // ownership is the browser's cookie, and a browser can be shared. On a
  // family phone or in a cybercafé the person who registers may not be the
  // person who ordered, so the shop says what it attached and to whom to
  // speak if that is wrong, instead of moving somebody else's order into an
  // account without a word.
  const claimed = Number((await searchParams).rattachees ?? 0) || 0;

  const [settings, active, counts, partCount] = await Promise.all([
    getSettings(),
    // Only the one order that is still moving. A delivered order is history,
    // and history lives behind the "Mes commandes" tile.
    prisma.order.findFirst({
      where: { userId: user.id, status: { notIn: ["DELIVERED", "CANCELLED"] } },
      orderBy: { createdAt: "desc" },
      select: { ref: true, status: true, total: true, createdAt: true },
    }),
    getOrderCounts(user.id),
    // How many distinct parts this customer has bought, for the tile's badge.
    prisma.orderItem
      .findMany({
        where: { order: { userId: user.id } },
        select: { productId: true },
        distinct: ["productId"],
      })
      .then((rows) => rows.filter((r) => r.productId).length),
  ]);

  const contact = contactFrom(settings);
  const firstName = user.name.split(" ")[0];

  return (
    <AccountShell
      title={`Bonjour, ${firstName}`}
      subtitle="Que souhaitez-vous faire ?"
      user={{ name: user.name, email: user.email, role: user.role }}
      orderCount={counts.total}
      activeOrders={counts.active}
      whatsapp={contact.whatsapp}
    >
      <div className="flex flex-col gap-4 sm:gap-5">
        {claimed > 0 && (
          <FormNotice tone="warn" title="Vos commandes ont été rattachées">
            {claimed === 1
              ? "La commande passée depuis cet appareil est désormais dans votre compte."
              : `Les ${claimed} commandes passées depuis cet appareil sont désormais dans votre compte.`}{" "}
            Si vous ne les reconnaissez pas — un téléphone partagé, par exemple —{" "}
            <Link href="/contact" className="font-semibold underline underline-offset-2">
              dites-le-nous
            </Link>{" "}
            et nous les détacherons.
          </FormNotice>
        )}

        {/* One line, not a dashboard.

            The page this replaced opened with the live order's full timeline,
            which is the right amount of detail on the order's own page and too
            much on a hub. "Where is my order?" is still the question most
            people arrive with, so it is still answered here — reference,
            status, what happens next, and a way in. Everything else about the
            order is one tap away. Nothing shows at all when nothing is
            moving. */}
        {active && (
          <Link
            href={`/compte/commandes/${active.ref}`}
            className="group flex flex-wrap items-center gap-x-4 gap-y-2 p-4 sm:px-5 rounded-2xl border border-navy-900/15 bg-navy-50/40 hover:border-navy-900 transition-colors"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-navy-950" dir="ltr">
                  {active.ref}
                </span>
                <StatusBadge status={active.status} />
              </span>
              <span className="block text-sm text-slate-600 mt-1">{NEXT_STEP[active.status]}</span>
            </span>
            <span className="flex items-center gap-3 shrink-0">
              <span className="font-heading font-extrabold text-navy-950 tabular-nums">
                {formatTNDfr(toNumber(active.total))}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-display font-bold uppercase tracking-wide text-navy-900 group-hover:text-red-600 transition-colors">
                Suivre <IconArrowRight className="w-4 h-4" />
              </span>
            </span>
          </Link>
        )}

        <AccountTiles orderCount={counts.total} partCount={partCount} />
      </div>
    </AccountShell>
  );
}
