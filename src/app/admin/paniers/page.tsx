import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatTND, toNumber } from "@/lib/money";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Paniers abandonnés" };

/** A cart untouched for this long is worth a nudge rather than more waiting. */
const STALE_MINUTES = 60;

export default async function AbandonedCartsPage() {
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000);
  const [carts, settings, convertedCount] = await Promise.all([
    prisma.cart.findMany({
      where: { status: "ACTIVE", updatedAt: { lt: cutoff }, items: { some: {} } },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        user: { select: { name: true, phone: true, email: true } },
        items: { include: { product: { select: { name: true, sku: true, priceSell: true, stockQty: true } } } },
      },
    }),
    getSettings(),
    prisma.cart.count({ where: { status: "CONVERTED" } }),
  ]);

  const withValue = carts
    .map((c) => ({
      cart: c,
      value: c.items.reduce((s, i) => s + toNumber(i.product.priceSell) * i.qty, 0),
      reachable: c.user?.phone ?? c.phone ?? null,
    }))
    .sort((a, b) => b.value - a.value);

  const totalValue = withValue.reduce((s, c) => s + c.value, 0);
  const reachable = withValue.filter((c) => c.reachable).length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">
          Paniers abandonnés
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Des clients qui ont choisi leurs pièces et ne sont pas allés au bout. Sans panier côté serveur, ces
          commandes étaient invisibles — et donc définitivement perdues.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 [&>*]:min-w-0">
        <Tile label="Paniers en attente" value={String(withValue.length)} />
        <Tile label="Valeur en jeu" value={formatTND(totalValue)} tone={totalValue > 0 ? "warn" : undefined} />
        <Tile label="Joignables" value={`${reachable}/${withValue.length}`} hint="numéro connu" />
        <Tile label="Paniers convertis" value={String(convertedCount)} tone="ok" />
      </div>

      {withValue.length === 0 ? (
        <p className="text-sm text-gray-500 border border-dashed border-gray-300 rounded-xl px-4 py-10 text-center">
          Aucun panier abandonné de plus d&apos;une heure. Rien à récupérer pour le moment.
        </p>
      ) : (
        <div className="rounded-xl border border-navy-900/10 bg-white overflow-x-auto">
          <table className="w-full text-sm table-fixed min-w-[720px]">
            <thead className="bg-navy-950 text-white/70">
              <tr>
                <th className="text-start px-4 py-3 font-display font-bold uppercase text-[11px] tracking-wider w-44">Client</th>
                <th className="text-start px-3 py-3 font-display font-bold uppercase text-[11px] tracking-wider">Contenu</th>
                <th className="text-end px-3 py-3 font-display font-bold uppercase text-[11px] tracking-wider w-24">Valeur</th>
                <th className="text-start px-3 py-3 font-display font-bold uppercase text-[11px] tracking-wider w-28">Depuis</th>
                <th className="text-end px-4 py-3 font-display font-bold uppercase text-[11px] tracking-wider w-28">Relancer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-900/8">
              {withValue.map(({ cart, value, reachable: phone }) => {
                const hours = Math.round((Date.now() - cart.updatedAt.getTime()) / 3600000);
                const names = cart.items.map((i) => i.product.name).join(", ");
                const outOfStock = cart.items.some((i) => i.product.stockQty < i.qty);
                const message = `Bonjour${cart.user?.name ? ` ${cart.user.name}` : ""}, vous aviez sélectionné ${
                  cart.items.length > 1 ? "des pièces" : `« ${cart.items[0]?.product.name} »`
                } sur Automotive Pièces Auto. Souhaitez-vous que je finalise la commande pour vous ?`;
                return (
                  <tr key={cart.id} className="hover:bg-gray-50 align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium truncate">{cart.user?.name ?? "Visiteur"}</p>
                      <p className="text-xs text-navy-900/40" dir="ltr">{phone ?? "sans contact"}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="truncate text-gray-700">{names}</p>
                      <p className="text-xs text-navy-900/40">
                        {cart.items.length} ligne(s)
                        {outOfStock && <span className="text-amber-600"> · stock insuffisant</span>}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-end font-semibold tabular-nums">{formatTND(value)}</td>
                    <td className="px-3 py-3 text-gray-500 whitespace-nowrap">
                      {hours < 24 ? `${hours} h` : `${Math.round(hours / 24)} j`}
                    </td>
                    <td className="px-4 py-3 text-end">
                      {phone ? (
                        <a
                          href={`https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(message)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center min-h-tap-compact px-3 rounded-lg bg-green-600 text-white text-xs font-semibold"
                        >
                          WhatsApp
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Un panier est considéré abandonné après {STALE_MINUTES} minutes sans modification. Le numéro WhatsApp de la
        boutique est {settings.shop_whatsapp}.{" "}
        <Link href="/admin/analytics" className="underline inline-flex items-center min-h-tap-compact">
          Voir les autres pertes
        </Link>.
      </p>
    </div>
  );
}

function Tile({ label, value, tone, hint }: { label: string; value: string; tone?: "ok" | "warn"; hint?: string }) {
  const color = tone === "ok" ? "text-green-700" : tone === "warn" ? "text-amber-600" : "text-navy-950";
  return (
    <div className="p-4 rounded-xl bg-white border border-navy-900/10 shadow-sm">
      <p className="text-xs font-display font-bold text-navy-900/45 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-heading font-extrabold mt-1 tabular-nums ${color}`}>{value}</p>
      {hint && <p className="text-xs text-navy-900/40 mt-0.5">{hint}</p>}
    </div>
  );
}
