import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getMyOrders } from "@/app/actions/orders";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { toNumber, formatTNDfr } from "@/lib/money";
import { contactFrom } from "@/lib/data/account";
import AccountShell from "@/components/account/AccountShell";
import { initialsOf } from "@/lib/initials";
import OrderTracker from "@/components/account/OrderTracker";
import ReorderButton, { type ReorderItem } from "@/components/ReorderButton";
import { StatusBadge, NEXT_STEP, HelpPanel } from "@/components/account/OrderBits";
import { IconArrowRight, IconPackage, IconWhatsApp } from "@/components/account/icons";

export const metadata = { title: "Mes commandes" };

const FILTERS = [
  { key: "", label: "Toutes" },
  { key: "encours", label: "En cours" },
  { key: "livrees", label: "Livrées" },
  { key: "annulees", label: "Annulées" },
] as const;

const MATCH: Record<string, (s: string) => boolean> = {
  encours: (s) => !["DELIVERED", "CANCELLED"].includes(s),
  livrees: (s) => s === "DELIVERED",
  annulees: (s) => s === "CANCELLED",
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/compte");

  const { filtre = "" } = await searchParams;
  const [orders, settings] = await Promise.all([getMyOrders(), getSettings()]);

  // Order lines are snapshots and cannot say whether a part is still buyable,
  // so one lookup gives every line its live slug and stock.
  const productIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.productId).filter(Boolean)))] as string[];
  const live = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, slug: true, stockQty: true, active: true },
      })
    : [];
  const liveById = new Map(live.map((p) => [p.id, p]));
  const contact = contactFrom(settings);

  const counts = {
    "": orders.length,
    encours: orders.filter((o) => MATCH.encours(o.status)).length,
    livrees: orders.filter((o) => MATCH.livrees(o.status)).length,
    annulees: orders.filter((o) => MATCH.annulees(o.status)).length,
  };
  const shown = filtre && MATCH[filtre] ? orders.filter((o) => MATCH[filtre](o.status)) : orders;

  return (
    <AccountShell
      title="Mes commandes"
      subtitle="Suivez, consultez et recommandez vos achats."
      initials={initialsOf(user.name)}
      orderCount={orders.length}
      activeOrders={counts.encours}
      whatsapp={contact.whatsapp}
    >
      {orders.length === 0 ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-12 text-center">
            <span className="inline-grid place-items-center w-12 h-12 rounded-full bg-slate-100 text-slate-400 mb-3">
              <IconPackage />
            </span>
            <p className="font-semibold text-navy-950 mb-1">Aucune commande pour le moment</p>
            <p className="text-sm text-slate-500 mb-4">Votre prochain achat apparaîtra ici.</p>
            <Link
              href="/recherche"
              className="inline-flex items-center min-h-tap px-5 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-display font-bold uppercase text-xs tracking-wide"
            >
              Trouver une pièce
            </Link>
          </div>
          <HelpPanel contact={contact} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar">
            <div className="flex gap-2 w-max">
              {FILTERS.map((f) => {
                const activeFilter = filtre === f.key;
                const n = counts[f.key as keyof typeof counts];
                return (
                  <Link
                    key={f.key || "all"}
                    href={f.key ? `/compte/commandes?filtre=${f.key}` : "/compte/commandes"}
                    aria-current={activeFilter ? "true" : undefined}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap px-4 min-h-tap-compact rounded-full border text-sm transition-colors ${
                      activeFilter
                        ? "bg-navy-950 border-navy-950 text-white font-semibold"
                        : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    {f.label}
                    <span className={activeFilter ? "text-white/60" : "text-slate-400"}>{n}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {shown.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
              Aucune commande dans cette catégorie.
            </p>
          ) : (
            shown.map((order) => {
              const reorderItems: ReorderItem[] = order.items
                .filter((i) => i.productId && liveById.get(i.productId)?.active)
                .map((i) => {
                  const p = liveById.get(i.productId!)!;
                  return {
                    productId: p.id, name: i.name, sku: i.sku, slug: p.slug,
                    imageUrl: i.imageUrl, unitPrice: toNumber(i.unitPrice),
                    stockQty: p.stockQty, qty: i.qty,
                  };
                });

              return (
                <article
                  key={order.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                    {/* The reference and its date are one tap target: the ref
                        alone is 18px tall, well under a thumb. The negative
                        margin keeps the padding from changing the layout. */}
                    <Link
                      href={`/compte/commandes/${order.ref}`}
                      className="group block min-w-0 py-1 -my-1"
                    >
                      <span
                        className="block font-mono font-bold text-navy-950 group-hover:text-red-600 transition-colors"
                        dir="ltr"
                      >
                        {order.ref}
                      </span>
                      <span className="block text-xs text-slate-400 mt-0.5">
                        {new Date(order.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                        {" · "}
                        {order.deliveryMethod === "PICKUP" ? "Retrait en magasin" : order.governorate}
                      </span>
                    </Link>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-lg font-heading font-extrabold text-navy-950 tabular-nums">
                        {formatTNDfr(toNumber(order.total))}
                      </span>
                      <StatusBadge status={order.status} />
                    </div>
                  </div>

                  <OrderTracker
                    status={order.status}
                    placedAt={order.createdAt.toISOString()}
                    events={order.history.map((h) => ({ status: h.status, at: h.createdAt.toISOString() }))}
                    compact
                  />

                  <p className="text-xs text-slate-500 mt-3">{NEXT_STEP[order.status]}</p>

                  {/* A preview, not the whole basket — the detail page holds
                      that. Each line leads back to the part it was, but only
                      while that part still exists and is on sale: a link to a
                      withdrawn product is worse than plain text. */}
                  <ul className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 overflow-x-auto no-scrollbar">
                    {order.items.slice(0, 4).map((item) => {
                      const p = item.productId ? liveById.get(item.productId) : undefined;
                      const label = (
                        <>
                          <Image
                            src={item.imageUrl}
                            alt=""
                            width={36}
                            height={36}
                            loading="lazy"
                            className="w-9 h-9 rounded-md object-cover bg-slate-50 border border-slate-100"
                          />
                          <span className="text-xs text-slate-600 whitespace-nowrap">
                            {item.name.length > 28 ? `${item.name.slice(0, 28)}…` : item.name}
                            <span className="text-slate-400"> ×{item.qty}</span>
                          </span>
                        </>
                      );
                      return (
                        <li key={item.id} className="shrink-0 pe-3">
                          {p?.active ? (
                            <Link
                              href={`/produit/${p.slug}`}
                              className="flex items-center gap-2 min-h-tap-compact rounded-lg hover:text-navy-950 [&_span]:hover:text-navy-950 transition-colors"
                            >
                              {label}
                            </Link>
                          ) : (
                            <span className="flex items-center gap-2 min-h-tap-compact">{label}</span>
                          )}
                        </li>
                      );
                    })}
                    {order.items.length > 4 && (
                      <li className="text-xs text-slate-400 shrink-0">+{order.items.length - 4}</li>
                    )}
                  </ul>

                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <Link
                      href={`/compte/commandes/${order.ref}`}
                      className="inline-flex items-center gap-1.5 min-h-tap px-4 rounded-xl bg-navy-950 hover:bg-navy-800 text-white font-display font-bold uppercase text-xs tracking-wide transition-colors"
                    >
                      Suivre <IconArrowRight className="w-4 h-4" />
                    </Link>
                    <ReorderButton items={reorderItems} />
                    {/* Tertiary on purpose, but per-order: a customer with a
                        problem should not have to retype which order it is. */}
                    <a
                      href={`https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(
                        `Bonjour, j'ai une question sur ma commande ${order.ref}.`,
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 min-h-tap px-3 rounded-xl text-xs font-semibold text-slate-500 hover:text-green-700 transition-colors"
                    >
                      <IconWhatsApp className="w-4 h-4" /> Aide sur cette commande
                    </a>
                  </div>
                </article>
              );
            })
          )}

          <HelpPanel contact={contact} />
        </div>
      )}
    </AccountShell>
  );
}
