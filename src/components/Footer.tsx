import Image from "next/image";
import Link from "next/link";
import { getMegaMenu } from "@/lib/data/catalog";
import { getSettings } from "@/lib/settings";
import { About, Heading, Rights, LangRow } from "./FooterClient";

export default async function Footer() {
  const [families, settings] = await Promise.all([getMegaMenu(), getSettings()]);

  return (
    <footer className="bg-navy-950 text-white/80 mt-16 pb-24 lg:pb-8">
      <div className="mx-auto max-w-7xl px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-1">
          <Image src="/images/logo-white.png" alt="Automotive Pièces Auto" width={150} height={50} className="h-9 w-auto mb-3" />
          <About />
        </div>
        <div>
          <Heading k="footer.categories" />
          <ul className="space-y-2 text-sm mt-3">
            {families.slice(0, 6).map((f) => (
              <li key={f.id}>
                <Link href={`/catalogue/${f.slug}`} className="hover:text-white min-h-11 inline-flex items-center">
                  {f.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Heading k="footer.contact" />
          <ul className="space-y-2 text-sm mt-3">
            <li>{settings.shop_address}</li>
            <li dir="ltr" className="text-start">{settings.shop_phone}</li>
            <li dir="ltr" className="text-start">{settings.shop_email}</li>
            <li>{settings.shop_hours}</li>
          </ul>
        </div>
        <div>
          <Heading k="store.title" />
          <p className="text-sm mt-3">{settings.shop_address}</p>
          <p className="text-sm mt-1">{settings.shop_hours}</p>
          <a
            href={`https://wa.me/${settings.shop_whatsapp}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium min-h-11"
          >
            WhatsApp
          </a>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-6">
        <div className="flex flex-wrap gap-3 text-[11px] text-white/50 pb-4 border-b border-white/10">
          <span>💳 COD</span>
          <span>🛡 Garantie 12 mois</span>
          <span>↩ Retour 14 jours</span>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} Automotive Pièces Auto. <Rights />
          </p>
          <LangRow />
        </div>
      </div>
    </footer>
  );
}
