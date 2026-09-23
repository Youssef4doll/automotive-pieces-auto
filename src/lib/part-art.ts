/**
 * The illustrated set: one drawing per part family, in the shop's colours.
 *
 * The line icons in part-icons.ts are for small places — the mega menu, a
 * 20px badge. Where a family is *the picture* (a category tile, a product
 * with no photograph yet, the head of a family page) a grey 1.25-stroke
 * sketch reads as "image missing". These are the same objects drawn as
 * objects: a dark navy outline, flat metal greys, the brand's yellow as the
 * one accent, a soft ground shadow — one designer's hand across all sixteen.
 *
 * Our own drawings, on a 64-unit grid, built only from rects, circles,
 * ellipses and paths so the markup passes the same SVG allowlist uploaded
 * pictures do. Served whole by /api/part-art/<slug>.svg; the app fetches
 * them from there rather than carrying a copy.
 */

const O = "#0f2352"; // outline
const M1 = "#eef2f8"; // light metal
const M2 = "#c9d3e3"; // mid metal
const M3 = "#8f9db6"; // dark metal
const D = "#26324a"; // rubber
const N = "#1c3a70"; // navy
const Y = "#fbc000"; // accent
const W = "#ffffff";

const shadow = `<ellipse cx="32" cy="60" rx="20" ry="2.6" fill="${O}" fill-opacity="0.10" stroke="none"/>`;

function ring(cx: number, cy: number, r: number, n: number, dot: number, fill: string, phase = 0) {
  let out = "";
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    out += `<circle cx="${(cx + r * Math.cos(a)).toFixed(2)}" cy="${(cy + r * Math.sin(a)).toFixed(2)}" r="${dot}" fill="${fill}" stroke="none"/>`;
  }
  return out;
}

export const PART_ART: Record<string, string> = {
  freinage: `${shadow}
    <circle cx="27" cy="33" r="22" fill="${M1}"/>
    <circle cx="27" cy="33" r="14.5" fill="${M2}"/>
    ${ring(27, 33, 18.2, 12, 1.1, M3)}
    <circle cx="27" cy="33" r="7.5" fill="${M1}"/>
    ${ring(27, 33, 4.3, 5, 1.2, O, -Math.PI / 2)}
    <path d="M38 9.5c11 2.5 18.5 11 19.5 22.5l-.5 5.5c-.6 3-4 4.5-7 3.2-1.6-9.4-7.2-16.6-15.6-20.2-2.6-3.2-.6-11.8 3.6-11z" fill="${Y}"/>
    <path d="M42 17c5.5 2.7 9.2 7.6 10.6 13.6" fill="none"/>
    <circle cx="44.5" cy="13.5" r="1.5" fill="${O}" stroke="none"/>
    <circle cx="54.5" cy="26" r="1.5" fill="${O}" stroke="none"/>`,

  filtres: `${shadow}
    <path d="M17 19h30v31c0 4.4-3.6 8-8 8H25c-4.4 0-8-3.6-8-8z" fill="${N}"/>
    <rect x="17" y="30" width="30" height="11" fill="${Y}"/>
    <path d="M22 45v8M27 46v9M32 46v9M37 46v9M42 45v8" stroke="${M3}" fill="none"/>
    <ellipse cx="32" cy="19" rx="15" ry="5.5" fill="${M2}"/>
    <ellipse cx="32" cy="18.6" rx="6.5" ry="2.3" fill="${M3}"/>
    ${ring(32, 19, 10.5, 8, 0.9, O)}
    <path d="M23 35.5h18" stroke="${O}" fill="none"/>`,

  "courroie-tendeur-et-chaine": `${shadow}
    <path d="M9.5 34.5 36 13.2a11 11 0 0 1 17 9.8l-3 21.2a6.5 6.5 0 0 1-8.2 5.5L20.5 50A13 13 0 0 1 9.5 34.5z" fill="none" stroke="${D}" stroke-width="5"/>
    <path d="M9.5 34.5 36 13.2a11 11 0 0 1 17 9.8l-3 21.2a6.5 6.5 0 0 1-8.2 5.5L20.5 50A13 13 0 0 1 9.5 34.5z" fill="none" stroke="${O}" stroke-width="1" stroke-dasharray="2 3"/>
    <circle cx="22" cy="38" r="11" fill="${M2}"/>
    <circle cx="22" cy="38" r="4.2" fill="${M1}"/>
    <circle cx="44" cy="22" r="8.5" fill="${M2}"/>
    <circle cx="44" cy="22" r="3.2" fill="${M1}"/>
    <circle cx="44" cy="44" r="5.5" fill="${Y}"/>
    <circle cx="44" cy="44" r="1.6" fill="${O}" stroke="none"/>`,

  "allumage-prechauffage": `${shadow}
    <rect x="28.5" y="3.5" width="7" height="6" rx="1.2" fill="${M2}"/>
    <path d="M27 9.5h10l1.2 18H25.8z" fill="${W}"/>
    <path d="M27.3 14h9.4M27 18.5h10M26.7 23h10.6" stroke="${M3}" fill="none"/>
    <path d="M22.5 27.5h19l-1 9h-17z" fill="${M2}"/>
    <path d="M28 27.5v9M36 27.5v9" fill="none"/>
    <rect x="26" y="36.5" width="12" height="13" fill="${M1}"/>
    <path d="M26 40h12M26 43.5h12M26 47h12" stroke="${M3}" fill="none"/>
    <path d="M32 49.5v5.5h5" fill="none"/>
    <path d="M47 44l-4 6h3.4l-2.6 6 7-8h-3.6l2.8-4z" fill="${Y}"/>`,

  suspension: `${shadow}
    <rect x="21" y="3.5" width="22" height="5.5" rx="2" fill="${M2}"/>
    <rect x="29.5" y="9" width="5" height="22" fill="${M1}"/>
    <rect x="26" y="30" width="12" height="23" rx="2.5" fill="${N}"/>
    <circle cx="32" cy="56" r="3.6" fill="${M2}"/>
    <g fill="none">
      <path d="M18.5 14.5c0-1.7 6-3 13.5-3s13.5 1.3 13.5 3M18.5 21.5c0-1.7 6-3 13.5-3s13.5 1.3 13.5 3M18.5 28.5c0-1.7 6-3 13.5-3s13.5 1.3 13.5 3M18.5 35.5c0-1.7 6-3 13.5-3s13.5 1.3 13.5 3M18.5 42.5c0-1.7 6-3 13.5-3s13.5 1.3 13.5 3" stroke="${O}" stroke-width="6"/>
      <path d="M18.5 14.5c0-1.7 6-3 13.5-3s13.5 1.3 13.5 3M18.5 21.5c0-1.7 6-3 13.5-3s13.5 1.3 13.5 3M18.5 28.5c0-1.7 6-3 13.5-3s13.5 1.3 13.5 3M18.5 35.5c0-1.7 6-3 13.5-3s13.5 1.3 13.5 3M18.5 42.5c0-1.7 6-3 13.5-3s13.5 1.3 13.5 3" stroke="${Y}" stroke-width="3.4"/>
    </g>`,

  "direction-et-trains-roulants": `${shadow}
    <path d="M32 6a25 25 0 1 1 0 50 25 25 0 0 1 0-50zm0 6.5a18.5 18.5 0 1 0 0 37 18.5 18.5 0 0 0 0-37z" fill="${D}" fill-rule="evenodd"/>
    <path d="M14 29h11l3 5h8l3-5h11v4H40.5L37 39.5v10.2h-10V39.5L23.5 33H14z" fill="${M2}"/>
    <circle cx="32" cy="33" r="6.2" fill="${N}"/>
    <circle cx="32" cy="33" r="2.2" fill="${Y}" stroke="none"/>`,

  embrayage: `${shadow}
    <circle cx="32" cy="32" r="25" fill="${D}"/>
    <circle cx="32" cy="32" r="25" fill="none" stroke="${M3}" stroke-width="1" stroke-dasharray="1.5 3"/>
    <circle cx="32" cy="32" r="17" fill="${M1}"/>
    ${[0, 60, 120, 180, 240, 300]
      .map(
        (d) =>
          `<rect x="29.5" y="17" width="5" height="7.5" rx="1.6" fill="${Y}" transform="rotate(${d} 32 32)"/>`,
      )
      .join("")}
    <circle cx="32" cy="32" r="6" fill="${M2}"/>
    <circle cx="32" cy="32" r="2.6" fill="${O}" stroke="none"/>`,

  moteur: `${shadow}
    <rect x="11" y="10" width="34" height="11" rx="2.5" fill="${N}"/>
    <path d="M16 13.5v4M21 13.5v4M26 13.5v4M31 13.5v4M36 13.5v4" stroke="${W}" stroke-opacity="0.6" fill="none"/>
    <rect x="37" y="5" width="6" height="5" rx="1.2" fill="${Y}"/>
    <rect x="7" y="21" width="42" height="26" rx="3" fill="${M2}"/>
    <path d="M13 27h30M13 32h30M13 37h30" stroke="${M3}" fill="none"/>
    <path d="M11 47h34l-3.5 8.5h-27z" fill="${M3}"/>
    <path d="M49 33h4" fill="none"/>
    <circle cx="54" cy="38" r="7" fill="${M1}"/>
    <circle cx="54" cy="38" r="2.6" fill="${O}" stroke="none"/>`,

  eclairage: `${shadow}
    <path d="M6 22c0-7.7 6.3-12 14-12h28c6.6 0 10 5 10 11v17c0 8.3-6.7 14-15 14H20c-7.7 0-14-6.3-14-14z" fill="${N}"/>
    <circle cx="22" cy="30" r="9.5" fill="${M1}"/>
    <circle cx="22" cy="30" r="4.2" fill="${W}"/>
    <circle cx="43" cy="29" r="7.5" fill="${M1}"/>
    <circle cx="43" cy="29" r="3.2" fill="${W}"/>
    <path d="M12 45.5h36" stroke="${Y}" stroke-width="3.4" fill="none"/>`,

  "demarrage-electrique": `${shadow}
    <rect x="13" y="9.5" width="9" height="6.5" rx="1.3" fill="${M2}"/>
    <rect x="42" y="9.5" width="9" height="6.5" rx="1.3" fill="${M2}"/>
    <rect x="6" y="15.5" width="52" height="8" rx="2" fill="${D}"/>
    <rect x="8" y="23.5" width="48" height="31" rx="3" fill="${N}"/>
    <rect x="14" y="30" width="36" height="16" rx="2.5" fill="${Y}"/>
    <path d="M20 38h7M23.5 34.5v7M37 38h7" stroke="${O}" stroke-width="2.4" fill="none"/>`,

  "capteurs-et-sondes": `${shadow}
    <rect x="3" y="29" width="9" height="7" rx="1.5" fill="${M1}"/>
    <path d="M12 26h12v13H12z" fill="${M2}"/>
    <path d="M16 26v13M20 26v13" fill="none"/>
    <rect x="24" y="23.5" width="15" height="18" rx="3.5" fill="${N}"/>
    <rect x="28" y="20" width="7" height="4" rx="1" fill="${Y}"/>
    <path d="M39 33c9 0 11 4 12.5 10s4 9 9 9" stroke="${D}" stroke-width="4.5" fill="none"/>`,

  carosserie: `${shadow}
    <path d="M9 15h30.5L56 31.5V53c0 2.2-1.8 4-4 4H13c-2.2 0-4-1.8-4-4z" fill="${M1}"/>
    <path d="M13.5 19h24.5l12 12H13.5z" fill="${N}"/>
    <path d="M17 22.5h9" stroke="${W}" stroke-opacity="0.55" fill="none"/>
    <path d="M9 38h47" fill="none" stroke="${M3}"/>
    <rect x="38" y="41.5" width="10" height="3.6" rx="1.8" fill="${Y}"/>`,

  "refroidissement-moteur": `${shadow}
    <rect x="5" y="13" width="54" height="42" rx="3" fill="${M2}"/>
    <rect x="10" y="18" width="44" height="32" fill="${M1}"/>
    <path d="M14 18v32M18 18v32M22 18v32M26 18v32M30 18v32M34 18v32M38 18v32M42 18v32M46 18v32M50 18v32" stroke="${M3}" stroke-width="1.2" fill="none"/>
    <rect x="45" y="6" width="9" height="7" rx="2" fill="${Y}"/>
    <path d="M5 44H1.5" stroke="${D}" stroke-width="4" fill="none"/>`,

  "cardan-et-transmission": `${shadow}
    <rect x="21" y="29" width="22" height="6" fill="${M2}"/>
    <path d="M14 25l3-2 3 2 3-2v18l-3-2-3 2-3-2z" fill="${D}"/>
    <path d="M50 25l-3-2-3 2-3-2v18l3-2 3 2 3-2z" fill="${D}"/>
    <circle cx="9" cy="32" r="7.5" fill="${M1}"/>
    <circle cx="9" cy="32" r="3" fill="${Y}"/>
    <circle cx="55" cy="32" r="7.5" fill="${M1}"/>
    <circle cx="55" cy="32" r="3" fill="${Y}"/>`,

  climatisation: `${shadow}
    <rect x="8" y="22" width="30" height="32" rx="6" fill="${M2}"/>
    <path d="M12 30h22M12 36h22M12 42h22" stroke="${M3}" fill="none"/>
    <circle cx="23" cy="38" r="0" fill="none"/>
    <circle cx="44" cy="40" r="12" fill="${M1}"/>
    <circle cx="44" cy="40" r="7" fill="${M2}"/>
    <circle cx="44" cy="40" r="2.6" fill="${O}" stroke="none"/>
    <circle cx="48" cy="13" r="9.5" fill="${Y}"/>
    <path d="M48 6.5v13M42.4 9.8l11.2 6.4M42.4 16.2l11.2-6.4" stroke="${O}" stroke-width="1.8" fill="none"/>`,

  lubrifiant: `${shadow}
    <rect x="14" y="7" width="11" height="8" rx="1.6" fill="${Y}"/>
    <path d="M12 15h26l11 9v29c0 2.2-1.8 4-4 4H12c-2.2 0-4-1.8-4-4V19c0-2.2 1.8-4 4-4z" fill="${N}"/>
    <path d="M38 15v9h11" fill="none"/>
    <path d="M40 27h5v9h-5z" fill="${D}"/>
    <rect x="13" y="30" width="23" height="18" rx="2.5" fill="${W}"/>
    <path d="M24.5 33.5c2.4 3.1 3.6 4.9 3.6 6.3a3.6 3.6 0 1 1-7.2 0c0-1.4 1.2-3.2 3.6-6.3z" fill="${Y}"/>`,
};

const GENERIC = `${shadow}
  <path d="M32 6l22 12.5v25L32 56 10 43.5v-25z" fill="${M2}"/>
  <circle cx="32" cy="31" r="10" fill="${M1}"/>
  <circle cx="32" cy="31" r="4" fill="${Y}"/>`;

/** A whole SVG document for a family slug; an unknown slug gets the generic part. */
export function partArtSvg(slug: string | null | undefined): string {
  const body = (slug && PART_ART[slug]) || GENERIC;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Illustration">
<g stroke="${O}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</g>
</svg>`;
}
