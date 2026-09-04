import "server-only";

/**
 * Shared rules for every picture an admin uploads — product photos, category
 * icons, brand logos and banner artwork alike. All of them end up as bytes in
 * Postgres served by /api/images/[id], so all of them have to be checked the
 * same way; keeping the check in one place is what stops the newer upload path
 * from being the lenient one.
 */

/** Raster formats a browser can render, and the only thing a photo may be. */
export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

/**
 * SVG is allowed for the pictures that are drawings rather than photographs —
 * category icons and brand logos — because those are the ones that have to
 * stay sharp from a 44px admin thumbnail to a full-width tile on a desktop,
 * and a vector is the only format that does that from a single file.
 *
 * It is opt-in per call site rather than allowed everywhere, because SVG is
 * not really an image format: it is a document format that happens to draw.
 * A product photo has nothing to gain from it and every reason not to accept
 * a file type with an element tree.
 */
export const VECTOR_IMAGE_TYPE = "image/svg+xml";

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
/** An icon or a logo is a few kilobytes of path data. Anything approaching
 *  this is either an embedded bitmap or something that is not an icon. */
export const MAX_VECTOR_BYTES = 512 * 1024;

/** Magic-number sniff: the declared Content-Type is client-supplied and can lie. */
export function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  const ascii = (i: number, s: string) => String.fromCharCode(...b.slice(i, i + s.length)) === s;
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  if (ascii(4, "ftyp") && (ascii(8, "avif") || ascii(8, "avis"))) return "image/avif";
  return null;
}

/* ------------------------------------------------------------------ *
 * SVG
 * ------------------------------------------------------------------ */

/**
 * Elements that make an SVG something other than a drawing. `script` and the
 * media/embedding elements are obvious; `foreignObject` is the one people
 * forget, because it opens a hole straight back into HTML. The SMIL animation
 * elements are here because `<set attributeName="onload" to="…">` and
 * `<animate attributeName="href" values="javascript:…">` are how you smuggle
 * a handler past a scan that only looks at attributes as written.
 */
const FORBIDDEN_ELEMENTS = [
  "script",
  "foreignobject",
  "iframe",
  "embed",
  "object",
  "audio",
  "video",
  "handler",
  "set",
  "animate",
  "animatetransform",
  "animatemotion",
];

/** Comments, the XML declaration, processing instructions and DOCTYPEs. */
const INVISIBLE = [
  /<!--[\s\S]*?-->/g,
  /<\?[\s\S]*?\?>/g,
  /<!DOCTYPE[^>[]*>/gi,
  /<metadata\b[\s\S]*?<\/metadata\s*>/gi,
];

type SvgCheck = { ok: true; svg: string } | { ok: false; reason: string };

/**
 * Reject the dangerous, strip the invisible, then look again.
 *
 * The order matters. Removing script and handlers and trusting the removal is
 * how sanitisers get bypassed — a construct the stripper does not recognise
 * survives in a file that now looks clean. So nothing dangerous is stripped at
 * all: it is grounds for refusing the file, and the admin is told which
 * element or attribute did it. Only decoration with no visual output is
 * removed, and the whole scan runs a second time over the result, so anything
 * a strip step happened to uncover still fails.
 */
function checkSvg(source: string): SvgCheck {
  const scan = (text: string): string | null => {
    // An internal DTD subset is entity expansion and external entity reads —
    // a parser bomb and a file-read primitive, neither of which an icon needs.
    if (/<!ENTITY/i.test(text)) return "une déclaration d'entité (<!ENTITY>)";
    if (/<!DOCTYPE[^>]*\[/i.test(text)) return "un DOCTYPE avec sous-ensemble interne";
    // CDATA can carry anything and hides it from every check below.
    if (/<!\[CDATA\[/i.test(text)) return "une section CDATA";
    for (const el of FORBIDDEN_ELEMENTS) {
      if (new RegExp(`<\\s*/?\\s*${el}\\b`, "i").test(text)) return `un élément <${el}>`;
    }
    // onload=, onclick=, onmouseover= and the rest.
    const handler = text.match(/\s(on[a-z]+)\s*=/i);
    if (handler) return `un gestionnaire d'événement ${handler[1]}=`;
    // These have no innocent reading inside a drawing, wherever they appear.
    if (/\b(?:javascript|vbscript)\s*:/i.test(text)) return "une URL javascript: ou vbscript:";
    // Every reference that leaves the file, not just the first one: a
    // tracking pixel, an embedded bitmap, or an external stylesheet that
    // repaints the icon into something else. Only same-file fragments
    // (`#gradient`) are a drawing referring to its own parts.
    for (const ref of text.matchAll(/\b(?:xlink:href|href|src)\s*=\s*["']([^"']*)["']/gi)) {
      const value = ref[1].trim();
      if (value && !value.startsWith("#")) return `une référence externe (${value.slice(0, 40)})`;
    }
    if (/@import/i.test(text)) return "un @import CSS";
    if (/url\(\s*["']?\s*[a-z][a-z0-9+.-]*:/i.test(text)) return "une url() vers une ressource externe";
    return null;
  };

  const before = scan(source);
  if (before) return { ok: false, reason: before };

  let svg = source;
  for (const re of INVISIBLE) svg = svg.replace(re, "");
  svg = svg.trim();

  // Second pass over the stripped text: if removing a comment or a DOCTYPE
  // brought something into view, it fails here rather than being served.
  const after = scan(svg);
  if (after) return { ok: false, reason: after };

  if (!/<svg[\s>]/i.test(svg)) return { ok: false, reason: "aucun élément <svg> racine" };
  return { ok: true, svg };
}

/** The opening `<svg …>` tag's attributes, as written. */
function svgOpenTag(svg: string): string | null {
  const m = svg.match(/<svg\b([^>]*)>/i);
  return m ? m[1] : null;
}

const attr = (tag: string, name: string): string | null => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return m ? m[1].trim() : null;
};

/**
 * Guarantee the file scales.
 *
 * An SVG without a viewBox has an intrinsic size and nothing else: dropped
 * into a tile that is 44px in the admin and 150px on the storefront, it draws
 * at its authored size in both and is cropped or lost in the corner. The
 * viewBox is the thing that makes one file correct at every size on every
 * device, so a file that lacks one gets it computed from its width and height,
 * and one that has neither is refused rather than shipped to break later.
 *
 * The width/height attributes are then dropped: left in place they fight the
 * CSS box the tile gives it, which is the other half of the same problem.
 */
function ensureScalable(svg: string): SvgCheck {
  const tag = svgOpenTag(svg);
  if (!tag) return { ok: false, reason: "aucun élément <svg> racine" };

  const box = attr(tag, "viewBox");
  let nextTag = tag;

  if (!box) {
    const num = (v: string | null) => {
      const n = v ? parseFloat(v) : NaN;
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    const w = num(attr(tag, "width"));
    const h = num(attr(tag, "height"));
    if (!w || !h) {
      return {
        ok: false,
        reason: "ni viewBox ni dimensions — le fichier ne peut pas s'adapter à l'écran",
      };
    }
    nextTag = `${nextTag} viewBox="0 0 ${w} ${h}"`;
  }

  // Strip the fixed pixel size so the tile decides how big the drawing is.
  nextTag = nextTag.replace(/\s(width|height)\s*=\s*["'][^"']*["']/gi, "");
  // preserveAspectRatio defaults to letterboxing, which is what a logo in a
  // square tile wants, so it is only set when the file left it out.
  if (!attr(nextTag, "preserveAspectRatio")) nextTag += ' preserveAspectRatio="xMidYMid meet"';

  // Function replacement, not a string: `$&` and friends in a path or an id
  // would otherwise be read as backreferences and corrupt the drawing.
  return { ok: true, svg: svg.replace(/<svg\b[^>]*>/i, () => `<svg${nextTag}>`) };
}

export type ReadImageResult =
  | { ok: true; bytes: Uint8Array<ArrayBuffer>; mimeType: string }
  | { ok: false; error: string };

export type ReadImageOptions = {
  /** Accept SVG as well as the raster formats. Off unless asked for. */
  allowVector?: boolean;
};

/** Size check, then content check. Messages are shown to the admin as-is. */
export async function readImageFile(
  file: File,
  { allowVector = false }: ReadImageOptions = {},
): Promise<ReadImageResult> {
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `« ${file.name} » dépasse 4 Mo (${(file.size / 1024 / 1024).toFixed(1)} Mo).`,
    };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = sniffMime(bytes);
  if (mimeType && ALLOWED_IMAGE_TYPES.has(mimeType)) return { ok: true, bytes, mimeType };

  // Not a raster image. It may still be an SVG, which has no magic number —
  // it is text, so it is read as text and judged on what it contains.
  if (allowVector && looksLikeSvg(bytes)) {
    if (file.size > MAX_VECTOR_BYTES) {
      return {
        ok: false,
        error: `« ${file.name} » fait ${Math.round(file.size / 1024)} Ko — un SVG est limité à 500 Ko.`,
      };
    }
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/^﻿/, "");
    const checked = checkSvg(text);
    if (!checked.ok) {
      return { ok: false, error: `« ${file.name} » contient ${checked.reason} et a été refusé.` };
    }
    const scalable = ensureScalable(checked.svg);
    if (!scalable.ok) {
      return { ok: false, error: `« ${file.name} » : ${scalable.reason}.` };
    }
    return {
      ok: true,
      bytes: new TextEncoder().encode(scalable.svg) as Uint8Array<ArrayBuffer>,
      mimeType: VECTOR_IMAGE_TYPE,
    };
  }

  return {
    ok: false,
    error: allowVector
      ? `« ${file.name} » n'est pas une image JPEG, PNG, WebP, AVIF ou SVG.`
      : `« ${file.name} » n'est pas une image JPEG, PNG, WebP ou AVIF.`,
  };
}

/** Text, and an `<svg` root somewhere in the opening bytes. */
function looksLikeSvg(bytes: Uint8Array): boolean {
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.slice(0, 2048))
    .replace(/^﻿/, "");
  return /<svg[\s>]/i.test(head);
}

/* ------------------------------------------------------------------ *
 * URLs
 * ------------------------------------------------------------------ */

/**
 * Where a stored asset is served from.
 *
 * A vector gets a `.svg` on the end, and that suffix is load-bearing rather
 * than cosmetic: next/image reads it and serves the file as-is instead of
 * pushing it through the optimiser, which refuses SVG and answers 400. One
 * character in the stored URL is what makes every `<Image>` on the site — the
 * tile, the admin thumbnail, the header logo — render an uploaded icon
 * correctly without any of them having to know it is one.
 */
export function assetUrl(id: string, mimeType: string): string {
  return mimeType === VECTOR_IMAGE_TYPE ? `/api/images/${id}.svg` : `/api/images/${id}`;
}

/** Both spellings of an asset URL, for matching a stored value. */
export function assetUrlVariants(id: string): string[] {
  return [`/api/images/${id}`, `/api/images/${id}.svg`];
}

/** The id half of a /api/images/<id> URL, or null if the URL is a static path. */
export function mediaAssetIdFromUrl(url: string | null | undefined): string | null {
  const m = url?.match(/^\/api\/images\/([A-Za-z0-9_-]+)(?:\.svg)?$/);
  return m ? m[1] : null;
}
