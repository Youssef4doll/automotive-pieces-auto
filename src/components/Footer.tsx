import Image from "next/image";
import Link from "next/link";
import { getMegaMenu } from "@/lib/data/catalog";
import { getSettings, publicContact, contactHref, isExternalContact } from "@/lib/settings";
import { About, Heading, Rights, LangRow } from "./FooterClient";
import NewsletterForm from "./NewsletterForm";
import T from "./T";

export default async function Footer() {
  const [families, settings] = await Promise.all([getMegaMenu(), getSettings()]);
  const catalogueLinks = families.slice(0, 4);
  const contact = publicContact(settings);
  const help = contactHref(contact);

  return (
    <footer className="bg-navy-950 text-white/80 mt-8 pb-24 lg:pb-8">
      <div className="mx-auto max-w-7xl px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-1">
          <Image src="/images/logo-white.png" alt="Automotive Pièces Auto" width={150} height={50} className="h-9 w-auto mb-3" />
          <About />
          {/* Contact rows appear once the owner has filled them in; an unset
              detail is omitted rather than shown as a placeholder. */}
          {(contact.email || contact.phone) && (
            <div className="text-sm mt-3 flex flex-col gap-1">
              {contact.email && (
                <a href={`mailto:${contact.email}`} dir="ltr" className="text-start hover:text-white">
                  {contact.email}
                </a>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} dir="ltr" className="text-start hover:text-white">
                  {contact.phone}
                </a>
              )}
            </div>
          )}
        </div>

        <div>
          <Heading k="footer.catalogueCol" />
          <ul className="space-y-2 text-sm mt-3">
            {catalogueLinks.map((f) => (
              <li key={f.id}>
                <Link href={`/catalogue/${f.slug}`} className="hover:text-white min-h-11 inline-flex items-center">
                  {f.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <Heading k="footer.aideCol" />
          <ul className="space-y-2 text-sm mt-3">
            <li>
              <a href={help} {...(isExternalContact(help) ? { target: "_blank", rel: "noreferrer" } : {})} className="hover:text-white min-h-11 inline-flex items-center">
                <T k="footer.deliveryReturns" />
              </a>
            </li>
            <li>
              <span className="min-h-11 inline-flex items-center"><T k="footer.warranty" /></span>
            </li>
            <li>
              <Link href="/sources" className="hover:text-white min-h-11 inline-flex items-center">
                Sources et méthode
              </Link>
            </li>
            <li>
              <Link href="/compte/commandes" className="hover:text-white min-h-11 inline-flex items-center">
                <T k="footer.tracking" />
              </Link>
            </li>
            <li>
              <a href={help} {...(isExternalContact(help) ? { target: "_blank", rel: "noreferrer" } : {})} className="hover:text-white min-h-11 inline-flex items-center">
                <T k="nav.contact" />
              </a>
            </li>
          </ul>
        </div>

        <div>
          <Heading k="footer.promosCol" />
          <div className="mt-3">
            <NewsletterForm />
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-[11px] px-2 py-1 rounded border border-white/20 text-white/60 uppercase">
              <T k="footer.chipCod" />
            </span>
            <span className="text-[11px] px-2 py-1 rounded border border-white/20 text-white/60 uppercase">
              <T k="footer.chipCard" />
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/10">
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} Automotive Pièces Auto. <Rights />
          </p>
          <div className="flex items-center gap-4 text-xs text-white/40">
            <span><T k="footer.terms" /> · <T k="footer.privacy" /></span>
          </div>
          <LangRow />
        </div>
      </div>
    </footer>
  );
}
