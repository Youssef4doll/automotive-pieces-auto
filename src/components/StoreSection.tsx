import Image from "next/image";
import { getSettings } from "@/lib/settings";
import SectionHeading from "./SectionHeading";
import Eyebrow from "./Eyebrow";
import T from "./T";

export default async function StoreSection() {
  const settings = await getSettings();

  return (
    <section id="magasin" className="mx-auto max-w-7xl px-4 py-10">
      <div className="grid sm:grid-cols-2 gap-8 items-center">
        <div className="relative h-56 sm:h-80 rounded-2xl overflow-hidden border border-gray-200">
          <Image src="/images/storefront.png" alt="Notre magasin" fill className="object-cover" />
        </div>
        <div>
          <Eyebrow k="store.title" />
          <SectionHeading
            k="store.heading"
            className="text-2xl sm:text-4xl font-heading font-extrabold uppercase text-navy-950 tracking-tight mb-3"
          />
          <p className="text-sm text-gray-600 mb-4">
            <T k="store.subtitle" />
          </p>
          <ul className="flex flex-col gap-2.5 text-sm text-gray-700">
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gold-500 shrink-0" />
              {settings.shop_address}
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gold-500 shrink-0" />
              {settings.shop_hours}
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gold-500 shrink-0" />
              <span dir="ltr">{settings.shop_phone}</span>
            </li>
          </ul>
          <a
            href={`https://wa.me/${settings.shop_whatsapp}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 mt-5 px-5 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-display font-bold uppercase tracking-wide"
          >
            WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}
