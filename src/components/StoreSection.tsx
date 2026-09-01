import Image from "next/image";
import { getSettings, publicContact } from "@/lib/settings";
import SectionHeading from "./SectionHeading";
import Eyebrow from "./Eyebrow";
import T from "./T";
import WhatsAppLink from "./WhatsAppLink";

export default async function StoreSection() {
  const settings = await getSettings();
  const contact = publicContact(settings);

  return (
    <section id="magasin" className="mx-auto max-w-7xl px-4 py-7 sm:py-10">
      <div className="grid sm:grid-cols-2 gap-8 items-center">
        <div className="relative h-56 sm:h-80 rounded-2xl overflow-hidden border border-gray-200">
          <Image
            src="/images/storefront.png"
            alt="Notre magasin"
            fill
            sizes="(max-width: 640px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
        <div>
          <Eyebrow k="store.title" />
          <SectionHeading
            k="store.heading"
            className="text-xl sm:text-4xl font-heading font-extrabold uppercase text-navy-950 tracking-tight mb-3"
          />
          <p className="text-sm text-gray-600 mb-4">
            <T k="store.subtitle" />
          </p>
          {/* Only details the owner has actually entered. An empty list is
              better than three lines of "à compléter" under a heading that
              asks the customer to visit. */}
          <ul className="flex flex-col gap-2.5 text-sm text-gray-700">
            {[contact.address, contact.hours, contact.phone]
              .filter((v): v is string => Boolean(v))
              .map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gold-500 shrink-0" />
                  <span dir={line === contact.phone ? "ltr" : undefined}>{line}</span>
                </li>
              ))}
          </ul>
          {contact.whatsapp && (
          <WhatsAppLink
            whatsapp={contact.whatsapp}
            source="store_section"
            className="inline-flex items-center gap-2 mt-5 px-5 py-3 rounded-lg bg-green-700 hover:bg-green-800 text-white text-sm font-display font-bold uppercase tracking-wide"
          >
            WhatsApp
          </WhatsAppLink>
          )}
        </div>
      </div>
    </section>
  );
}
