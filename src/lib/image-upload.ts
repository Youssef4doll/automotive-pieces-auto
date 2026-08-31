import "server-only";

/**
 * Shared rules for every picture an admin uploads — product photos and banner
 * artwork alike. Both end up as bytes in Postgres served by /api/images/[id],
 * so both have to be checked the same way; keeping the check in one place is
 * what stops the newer upload path from being the lenient one.
 */

// Only real raster formats a browser can render. Anything else — an SVG that
// could carry script, a PDF, a renamed .exe — is rejected outright rather than
// stored and later served back to shoppers.
export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

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

export type ReadImageResult =
  | { ok: true; bytes: Uint8Array<ArrayBuffer>; mimeType: string }
  | { ok: false; error: string };

/** Size check, then content check. Messages are shown to the admin as-is. */
export async function readImageFile(file: File): Promise<ReadImageResult> {
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `« ${file.name} » dépasse 4 Mo (${(file.size / 1024 / 1024).toFixed(1)} Mo).`,
    };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = sniffMime(bytes);
  if (!mimeType || !ALLOWED_IMAGE_TYPES.has(mimeType)) {
    return { ok: false, error: `« ${file.name} » n'est pas une image JPEG, PNG, WebP ou AVIF.` };
  }
  return { ok: true, bytes, mimeType };
}

/** The id half of a /api/images/<id> URL, or null if the URL is a static path. */
export function mediaAssetIdFromUrl(url: string | null | undefined): string | null {
  const m = url?.match(/^\/api\/images\/([A-Za-z0-9_-]+)$/);
  return m ? m[1] : null;
}
