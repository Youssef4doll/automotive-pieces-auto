import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatTND, toNumber } from "@/lib/money";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import { computeSegment } from "@/lib/segment";
import CustomerEditor from "@/components/admin/CustomerEditor";

const FIELD_LABEL: Record<string, string> = { name: "Nom", email: "Email", phone: "Téléphone" };

const SEGMENT_STYLE: Record<string, string> = {
  VIP: "bg-gold-500/25 text-navy-900",
  REGULAR: "bg-navy-900/10 text-navy-900",
  NEW: "bg-gray-100 text-gray-500",
};

export default async function AdminClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await prisma.user.findUnique({
    where: { id },
    include: {
      orders: { include: { items: true }, orderBy: { createdAt: "desc" } },
      profileChanges: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!customer) notFound();

  const completedOrders = customer.orders.filter((o) => o.status !== "CANCELLED");
  const ltv = completedOrders.reduce((s, o) => s + toNumber(o.total), 0);
  const segment = computeSegment(completedOrders.length, ltv);

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <Link href="/admin/clients" className="text-sm font-display font-bold uppercase text-xs tracking-wide text-red-500 self-start">
        ← Clients
      </Link>

      <div className="p-5 rounded-xl bg-white border border-navy-900/10 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-heading font-extrabold text-navy-950">{customer.name}</h1>
          <p className="text-sm text-gray-500">{customer.email}</p>
          {customer.phone && <p className="text-sm text-gray-500" dir="ltr">{customer.phone}</p>}
        </div>
        <div className="text-end">
          <p className="text-xs font-display font-bold text-navy-900/45 uppercase tracking-wide">Valeur totale</p>
          <p className="text-xl font-heading font-extrabold text-navy-900">{formatTND(ltv)}</p>
          <span className={`text-xs font-display font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${SEGMENT_STYLE[segment]}`}>
            {segment}
          </span>
        </div>
      </div>

      <CustomerEditor
        customer={{
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          orderCount: customer.orders.length,
        }}
      />

      {customer.profileChanges.length > 0 && (
        <section className="p-5 rounded-xl bg-white border border-navy-900/10 shadow-sm">
          <h2 className="font-display font-bold uppercase tracking-wide text-sm text-navy-950 mb-1">
            Modifications de la fiche
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            Les commandes ci-dessous portent le nom donné au moment de l&apos;achat — corriger la fiche ne les
            réécrit pas.
          </p>
          <ul className="flex flex-col divide-y divide-navy-900/8 text-sm">
            {customer.profileChanges.map((c) => (
              <li key={c.id} className="py-2 flex flex-wrap items-baseline gap-x-2">
                <span className="text-[11px] font-display font-bold uppercase tracking-wide text-navy-900/45 w-20 shrink-0">
                  {FIELD_LABEL[c.field] ?? c.field}
                </span>
                <span className="text-gray-500 line-through break-all">{c.oldValue || "—"}</span>
                <span className="text-navy-900/30">→</span>
                <span className="text-navy-950 font-medium break-all">{c.newValue || "—"}</span>
                <span className="ms-auto text-xs text-navy-900/40 whitespace-nowrap">
                  {new Date(c.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" })}
                  {" · "}
                  {c.changedBy === "ADMIN" ? "par la boutique" : "par le client"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="p-5 rounded-xl bg-white border border-navy-900/10 shadow-sm">
        <h2 className="font-display font-bold uppercase tracking-wide text-sm text-navy-950 mb-3">Historique des commandes</h2>
        <div className="flex flex-col divide-y divide-navy-900/8">
          {customer.orders.map((o) => (
            <Link key={o.id} href={`/admin/commandes/${o.id}`} className="flex items-center justify-between py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded">
              <div>
                <p className="font-mono font-bold text-sm">{o.ref}</p>
                <p className="text-xs text-navy-900/40">
                  {new Date(o.createdAt).toLocaleDateString("fr-FR")}
                  {/* The name as it stood when this order was taken. Different
                      from the account's current name after a correction, and
                      that difference is the point. */}
                  {o.customerName !== customer.name && ` · au nom de ${o.customerName}`}
                </p>
              </div>
              <div className="text-end">
                <p className="font-semibold text-sm">{formatTND(toNumber(o.total))}</p>
                <p className="text-xs text-navy-900/40">{ORDER_STATUS_LABEL[o.status]}</p>
              </div>
            </Link>
          ))}
          {customer.orders.length === 0 && <p className="text-sm text-navy-900/40 py-4">Aucune commande</p>}
        </div>
      </div>
    </div>
  );
}
