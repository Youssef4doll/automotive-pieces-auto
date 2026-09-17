import Image from "next/image";
import Link from "next/link";
import { getMegaMenu } from "@/lib/data/catalog";
import { getSettings, publicContact } from "@/lib/settings";
import { About, Heading, Rights, LangRow } from "./FooterClient";
import PaymentDeliveryBand from "./PaymentDeliveryBand";
import T from "./T";

export default async function Footer() {
  const [families, settings] = await Promise.all([getMegaMenu(), getSettings()]);
  const catalogueLinks = families.slice(0, 4);
  const contact = publicContact(settings);

  return (
    <footer data-print-hide className="bg-navy-950 text-white/80 mt-8 pb-24 lg:pb-8">
      <div className="mx-auto shell-w px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
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
            {/* The policy page, not a WhatsApp deep link. A customer about to
                hand cash to a courier is asking what it costs and what happens
                if the part is wrong; opening a chat app puts the burden of the
                question back on them, and answers nothing at 2am. */}
            <li>
              <Link href="/livraison-retours" className="hover:text-white min-h-11 inline-flex items-center">
                <T k="footer.deliveryReturns" />
              </Link>
            </li>
            <li>
              <Link href="/livraison-retours#garantie" className="hover:text-white min-h-11 inline-flex items-center">
                <T k="footer.warranty" />
              </Link>
            </li>
            <li>
              <Link href="/guides" className="hover:text-white min-h-11 inline-flex items-center">
                Guides d&apos;entretien
              </Link>
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
              {/* The page, not the WhatsApp deep link this used to be. The
                  page carries WhatsApp as its first option, plus the shop's
                  own details and a form, so nothing is lost by going through
                  it — and a "Contact" that jumps straight out to another app
                  is a surprise when what you wanted was an address. */}
              <Link href="/contact" className="hover:text-white min-h-11 inline-flex items-center">
                <T k="nav.contact" />
              </Link>
            </li>
          </ul>
        </div>

        {/* Help, where the newsletter box used to be.

            A footer's last column is the one people reach when they have run
            out of links to try, and an e-mail capture is the least useful
            thing to meet them with — the shop had no screen to read those
            subscribers on anyway. This says where to go instead, and /contact
            offers WhatsApp, the shop's details and a form on one page.

            Full width on a phone: the footer is two columns there, and a
            160px box left about seven characters of the old placeholder
            visible. The link columns are happy at half width; a heading that
            is a whole sentence is not. */}
        <div className="col-span-2 md:col-span-1">
          <Heading k="footer.helpCol" />
          <Link
            href="/contact"
            className="mt-2 inline-flex min-h-tap items-center gap-1.5 text-sm font-semibold text-white hover:text-gold-500"
          >
            <T k="footer.allContacts" />
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true" className="rtl-flip">
              <path d="M8 5l8 7-8 7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Replaces two chips that sat in the newsletter column and read as
          decoration — one of which promised "carte bancaire" while the
          checkout refuses it. */}
      <PaymentDeliveryBand
        grandTunis={settings.delivery_grand_tunis}
        regions={settings.delivery_regions}
        hasStore={!!contact.address}
      />

      <div className="mx-auto shell-w px-4 pb-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6">
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} Automotive Pièces Auto. <Rights />
          </p>
          {/* These were a <span>. Two words of grey text where a first-time
              buyer looks for the terms they are about to accept reads as a
              shop that has not written any — which, until now, was true. */}
          <div className="flex items-center gap-4 text-xs">
            <Link href="/conditions" className="text-white/60 underline underline-offset-2 hover:text-white">
              <T k="footer.terms" />
            </Link>
            <Link href="/confidentialite" className="text-white/60 underline underline-offset-2 hover:text-white">
              <T k="footer.privacy" />
            </Link>
          </div>
          <LangRow />
        </div>
      </div>
    </footer>
  );
}
