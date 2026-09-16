import {
  hasManufacturerInfo,
  manufacturerAddress,
  websiteHref,
  websiteLabel,
  type ManufacturerInfo as Info,
} from "@/lib/manufacturer";

/**
 * Who made the part, printed where a buyer can find it.
 *
 * A shop is the last link in a chain. When a part fails, the person holding it
 * needs the company that built it — a registered name, an address, a way to
 * write — and unless the seller publishes that, they have no way to get it.
 *
 * Every line comes from what the shop typed into /admin/catalogue/marques,
 * copied from what the manufacturer itself publishes. A brand with nothing
 * entered renders nothing at all: a panel headed "Informations fabricant" with
 * only the brand name under it would imply we looked the company up and this
 * is all there is, which is a claim and not a true one.
 */
export default function ManufacturerInfo({ name, info }: { name: string; info: Info }) {
  if (!hasManufacturerInfo(info)) return null;

  const address = manufacturerAddress(info);
  const phone = info.phone?.trim();
  const email = info.email?.trim();
  const website = info.website?.trim();

  return (
    <section id="fabricant" className="scroll-mt-24">
      <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950 mb-1">
        Informations fabricant
      </h2>
      <p className="text-sm text-gray-600 mb-3">
        Le fabricant de cette pièce, tel qu&apos;il se déclare. À contacter directement pour toute
        question de sécurité ou de conformité du produit.
      </p>

      <address className="not-italic rounded-xl border border-gray-200 bg-gray-50/60 p-4 text-sm leading-relaxed">
        <span className="block font-heading font-extrabold uppercase tracking-tight text-navy-950">
          {name}
        </span>
        {info.legalName?.trim() && (
          <span className="block text-navy-900">{info.legalName.trim()}</span>
        )}
        {address && <span className="block text-gray-700">{address}</span>}

        {(phone || email || website) && (
          <span className="mt-2 flex flex-col gap-0.5">
            {phone && (
              // tel: on the digits only — a number written "+49 2941 / 38 - 0"
              // is readable to a person and unusable to a dialler.
              <a
                href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                dir="ltr"
                className="w-fit text-navy-600 hover:text-red-600 hover:underline underline-offset-2"
              >
                {phone}
              </a>
            )}
            {email && (
              <a
                href={`mailto:${email}`}
                dir="ltr"
                className="w-fit break-all text-navy-600 hover:text-red-600 hover:underline underline-offset-2"
              >
                {email}
              </a>
            )}
            {website && (
              <a
                href={websiteHref(website)}
                target="_blank"
                rel="noreferrer nofollow"
                dir="ltr"
                className="w-fit break-all text-navy-600 hover:text-red-600 hover:underline underline-offset-2"
              >
                {websiteLabel(website)}
              </a>
            )}
          </span>
        )}
      </address>
    </section>
  );
}
