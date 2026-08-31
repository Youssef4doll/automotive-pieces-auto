import { headers } from "next/headers";

/**
 * Structured data, written safely.
 *
 * Two things this handles that a bare `<script>` does not:
 *
 * 1. Escaping. A product name or description containing `</script>` would end
 *    the element early and everything after it would be parsed as markup —
 *    catalogue text becoming executable page content. Escaping `<` as `<`
 *    is still valid JSON and cannot close the tag.
 * 2. The nonce. `src/proxy.ts` serves a nonce-based CSP, so an inline script
 *    without the current request's nonce is refused by the browser.
 */
export default async function JsonLd({ data }: { data: unknown }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      // Escaped above; JSON.stringify output is not user-controlled markup.
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
