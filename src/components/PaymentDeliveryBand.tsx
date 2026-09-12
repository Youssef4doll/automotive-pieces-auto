import T from "./T";

/**
 * How you receive it, and how you pay for it — in the footer, on every page.
 *
 * Modelled on the band the big European catalogues run above their copyright
 * line, and deliberately not copied from one. Theirs carry DHL, GLS, UPS,
 * Visa, Klarna, PayPal and Apple Pay; this shop has none of those. Putting
 * those marks here would tell a customer they can pay by card and choose a
 * courier, and then the checkout would refuse both — which costs an order and
 * a support call, and is exactly the kind of claim this project does not make.
 *
 * So it shows what the shop actually does: home delivery at a flat fee or free
 * pickup in store, paid in cash when it arrives. Card is listed because it is
 * genuinely coming, and marked as such rather than implied.
 *
 * Drawn rather than fetched: these are our own marks, so the band costs no
 * network requests and cannot break when a third party moves a logo.
 */

type Method = {
  key: string;
  label: string;
  detail?: string;
  soon?: boolean;
  icon: React.ReactNode;
};

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export default function PaymentDeliveryBand({
  grandTunis,
  regions,
}: {
  /** Delivery time for Grand Tunis, from settings — never guessed. */
  grandTunis: string;
  /** Delivery time for the rest of the country. */
  regions: string;
}) {
  const delivery: Method[] = [
    {
      key: "home",
      label: "Livraison à domicile",
      detail: `Grand Tunis ${grandTunis} · régions ${regions}`,
      icon: (
        <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true" className="w-6 h-6">
          <path d="M2.5 7.5h10v9h-10z" />
          <path d="M12.5 11h4l3 3v2.5h-7z" />
          <circle cx="7" cy="18" r="1.6" />
          <circle cx="16.5" cy="18" r="1.6" />
        </svg>
      ),
    },
    {
      key: "pickup",
      label: "Retrait en magasin",
      detail: "Gratuit",
      icon: (
        <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true" className="w-6 h-6">
          <path d="M4 9.5V19h16V9.5" />
          <path d="M3 5h18l-1.2 4.5H4.2z" />
          <path d="M10 19v-5h4v5" />
        </svg>
      ),
    },
  ];

  const payment: Method[] = [
    {
      key: "cod",
      label: "Paiement à la livraison",
      detail: "En espèces, à la réception",
      icon: (
        <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true" className="w-6 h-6">
          <rect x="2.5" y="6" width="19" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.6" />
          <path d="M6 10v4M18 10v4" />
        </svg>
      ),
    },
    {
      key: "card",
      label: "Carte bancaire",
      soon: true,
      icon: (
        <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true" className="w-6 h-6">
          <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
          <path d="M2.5 10h19" />
          <path d="M6 14.5h4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="mx-auto shell-w px-4 pt-8">
      <div className="grid gap-6 sm:grid-cols-2 pb-8 border-b border-white/10">
        <Group titleKey="footer.methodsDelivery" methods={delivery} />
        <Group titleKey="footer.methodsPayment" methods={payment} />
      </div>
    </div>
  );
}

function Group({ titleKey, methods }: { titleKey: string; methods: Method[] }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-display font-bold uppercase tracking-wide text-white/50">
        <T k={titleKey as Parameters<typeof T>[0]["k"]} />
      </p>
      <ul className="flex flex-wrap gap-2 mt-3">
        {methods.map((m) => (
          <li
            key={m.key}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-white/15 bg-white/[0.04] min-w-0"
          >
            <span className="shrink-0 text-white/70">{m.icon}</span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[13px] font-semibold text-white/90 leading-tight">{m.label}</span>
                {m.soon && (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                    <T k="footer.methodSoon" />
                  </span>
                )}
              </span>
              {m.detail && (
                <span className="block text-[11.5px] text-white/45 leading-tight mt-0.5">{m.detail}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
