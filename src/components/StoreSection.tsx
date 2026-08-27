import Image from "next/image";
import { getSettings } from "@/lib/settings";
import SectionHeading from "./SectionHeading";

export default async function StoreSection() {
  const settings = await getSettings();

  return (
    <section id="magasin" className="mx-auto max-w-7xl px-4 py-10">
      <div className="grid sm:grid-cols-2 gap-6 bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="relative h-56 sm:h-80">
          <Image src="/images/storefront.png" alt="Notre magasin" fill className="object-cover" />
        </div>
        <div className="p-6 sm:p-8 flex flex-col justify-center">
          <SectionHeading k="store.title" className="text-xl sm:text-2xl font-extrabold text-navy-950 mb-3" />
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex gap-2">
              <span>📍</span>
              <span>{settings.shop_address}</span>
            </li>
            <li className="flex gap-2">
              <span>🕐</span>
              <span>{settings.shop_hours}</span>
            </li>
            <li className="flex gap-2">
              <span>📞</span>
              <span dir="ltr">{settings.shop_phone}</span>
            </li>
          </ul>
          <a
            href={`https://wa.me/${settings.shop_whatsapp}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 mt-5 px-5 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold"
          >
            WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}
