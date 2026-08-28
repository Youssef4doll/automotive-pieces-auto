"use client";

import { track } from "@/lib/track";

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
  whatsapp: string;
  text?: string;
  source: string;
  className?: string;
  children: React.ReactNode;
}) {
  const href = `https://wa.me/${whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
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
