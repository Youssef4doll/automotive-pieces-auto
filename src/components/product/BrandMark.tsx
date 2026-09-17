import Image from "next/image";

/**
 * The maker's mark.
 *
 * A parts shop sells on brand as much as on price — the reference pages this
 * was built against all put the maker's logo at the top of the product, above
 * the name — and this site had the brand as five words of grey 12px text.
 *
 * Two states, and the second one is the one that matters today: **not one of
 * the nineteen brands in this catalogue has had a logo uploaded yet.** So the
 * fallback is not an apology. It sets the maker's name in the site's own
 * display lettering on the site's own navy, with the gold rule underneath —
 * a wordmark that looks deliberate next to a real logo rather than like a
 * picture that failed to load. What it never does is draw a brand's logo from
 * memory: an approximation of somebody else's trademark is worse than plain
 * type, legally and visually.
 *
 * Upload one in Admin → Catalogue → Marques and it takes this slot.
 */
export default function BrandMark({
  name,
  logoUrl,
  size = "md",
  className = "",
}: {
  name: string;
  logoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const box =
    size === "lg" ? "h-16 w-32 sm:h-20 sm:w-40" : size === "sm" ? "h-7 w-16" : "h-9 w-24";
  const type = size === "lg" ? "text-xl sm:text-2xl" : size === "sm" ? "text-[11px]" : "text-sm";

  if (logoUrl) {
    return (
      <span className={`relative block shrink-0 ${box} ${className}`}>
        <Image
          src={logoUrl}
          alt={name}
          fill
          // The slot, not the largest slot it ever reaches — asking for a
          // 640px rendition of a logo drawn at 128px is six times the pixels.
          sizes={size === "lg" ? "(max-width: 640px) 128px, 160px" : size === "sm" ? "64px" : "96px"}
          // Bottom-left, not centre-left. The slot has to be tall enough for a
          // roundel, so a wide wordmark — which is what most parts brands use —
          // is drawn short inside it and `object-contain` centres it, leaving an
          // empty strip underneath. On the product page that strip sits between
          // the maker and the product name and reads as loose spacing that no
          // amount of adjusting the gap can fix, because it is inside the image.
          // Anchored to the bottom, the slack falls above the mark, where there
          // is nothing for it to push apart.
          className="object-contain object-left-bottom"
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 flex-col items-start justify-center gap-1 ${className}`}
      aria-label={name}
    >
      <span
        className={`font-heading font-extrabold uppercase leading-none tracking-tight text-navy-950 ${type}`}
      >
        {name}
      </span>
      <span className="block h-[3px] w-8 rounded-full bg-gold-500" aria-hidden="true" />
    </span>
  );
}
