"use client";

import { track } from "@/lib/track";
import { contactLink } from "@/lib/contact-link";

/**
 * A plain `<a>` to wa.me that fires a `whatsapp_clicked` analytics event
 * before the (new-tab) navigation happens. Drop-in replacement anywhere a
 * server component would otherwise render the link directly — this is the
 * only part that needs to be a client component.
 */
export default function WhatsAppLink({
  whatsapp,
  text,
  source,
  className,
  children,
}: {
  whatsapp: string | null;
  text?: string;
  source: string;
  className?: string;
  children: React.ReactNode;
}) {
  // No number, no button. A control labelled "WhatsApp" that quietly goes
  // somewhere else is worse than one that is not there: the customer has
  // already decided how they want to talk to the shop by the time they tap it.
  // This is the fail-closed half of isDiallable — a setting that is missing or
  // half-filled removes the offer instead of shipping a dead one.
  if (!whatsapp) return null;

  const href = contactLink({ whatsapp, email: null }, text);
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={() => track("whatsapp_clicked", { source })}
      className={className}
    >
      {children}
    </a>
  );
}
