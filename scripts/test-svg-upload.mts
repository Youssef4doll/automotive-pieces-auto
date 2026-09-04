/**
 * The SVG gate, exercised directly.
 *
 * SVG is the one upload format that is a document rather than a picture, so
 * this is the check that decides whether a file the shop was handed can run
 * script on the shop's own origin. Everything hostile below is a real
 * published bypass shape, not an invention; the point of the list is that a
 * refusal has to be the outcome for all of them, and a plain icon still has to
 * get through or the feature is useless.
 *
 *   npx tsx scripts/test-svg-upload.mts
 */
import { readImageFile, assetUrl, mediaAssetIdFromUrl } from "../src/lib/image-upload";

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const svgFile = (body: string, name = "icon.svg") =>
  new File([body], name, { type: "image/svg+xml" });

const PLAIN =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>';

/* ---------------------------------------------------------------- */
console.log("\n[1] A REAL ICON GETS THROUGH");

{
  const r = await readImageFile(svgFile(PLAIN), { allowVector: true });
  check("a plain circle icon is accepted", r.ok, r.ok ? "" : r.error);
  if (r.ok) {
    check("it is stored as image/svg+xml", r.mimeType === "image/svg+xml", r.mimeType);
    const out = new TextDecoder().decode(r.bytes);
    check("the drawing survives", out.includes("<circle"), out.slice(0, 80));
  }
}

{
  // What Illustrator and Inkscape actually emit around the drawing.
  const dressed = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generator: Adobe Illustrator 27.0, SVG Export Plug-In -->
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 48 48">
  <metadata><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/></metadata>
  <style>.a{fill:#0b1b3a}</style>
  <path class="a" d="M4 4h40v40H4z"/>
</svg>`;
  const r = await readImageFile(svgFile(dressed), { allowVector: true });
  check("an editor export with a DOCTYPE and metadata is accepted", r.ok, r.ok ? "" : r.error);
  if (r.ok) {
    const out = new TextDecoder().decode(r.bytes);
    check("the XML declaration is stripped", !out.includes("<?xml"));
    check("the DOCTYPE is stripped", !/<!DOCTYPE/i.test(out));
    check("the comment is stripped", !out.includes("Illustrator"));
    check("its <style> block survives", out.includes(".a{fill:#0b1b3a}"));
    check("the path survives", out.includes("<path"));
  }
}

/* ---------------------------------------------------------------- */
console.log("\n[2] IT SCALES, OR IT DOES NOT GET IN");

{
  const sized = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect width="64" height="32"/></svg>';
  const r = await readImageFile(svgFile(sized), { allowVector: true });
  check("width/height with no viewBox is accepted", r.ok, r.ok ? "" : r.error);
  if (r.ok) {
    const out = new TextDecoder().decode(r.bytes);
    check("a viewBox is computed from them", out.includes('viewBox="0 0 64 32"'), out.slice(0, 120));
    check("the fixed pixel size is dropped from the root", !/<svg[^>]*\swidth=/i.test(out), out.slice(0, 120));
    check("the inner rect keeps its own size", out.includes('<rect width="64"'));
  }
}

{
  const r = await readImageFile(svgFile(PLAIN), { allowVector: true });
  const out = r.ok ? new TextDecoder().decode(r.bytes) : "";
  check("an existing viewBox is left alone", out.includes('viewBox="0 0 24 24"'));
  check("preserveAspectRatio is filled in", out.includes("preserveAspectRatio"), out.slice(0, 120));
}

{
  const naked = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="4"/></svg>';
  const r = await readImageFile(svgFile(naked), { allowVector: true });
  check("no viewBox and no dimensions is refused", !r.ok, r.ok ? "accepted" : r.error);
}

/* ---------------------------------------------------------------- */
console.log("\n[3] NOTHING THAT CAN RUN, LOAD OR PHONE HOME");

const HOSTILE: [string, string][] = [
  ["a <script> block", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script></svg>`],
  ["a spaced-out <script", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">< script>alert(1)</script></svg>`],
  ["an onload handler", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"><circle r="1"/></svg>`],
  ["an onclick on a child", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle r="1" onclick="alert(1)"/></svg>`],
  ["a <foreignObject> escape into HTML", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><img src=x onerror="alert(1)"/></body></foreignObject></svg>`],
  ["a javascript: link", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><a href="javascript:alert(1)"><circle r="1"/></a></svg>`],
  ["an <animate> writing into href", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><a><animate attributeName="href" values="javascript:alert(1)"/><circle r="1"/></a></svg>`],
  ["a <set> writing an event handler", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><set attributeName="onload" to="alert(1)"/></svg>`],
  ["an entity declaration", `<!DOCTYPE svg [<!ENTITY x "y">]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle r="1"/></svg>`],
  ["an external entity file read", `<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text>&xxe;</text></svg>`],
  ["a CDATA section", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style><![CDATA[*{fill:red}]]></style></svg>`],
  ["a remote <image> beacon", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><image href="https://tracker.example/p.gif"/></svg>`],
  ["an embedded bitmap data: URI", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><image href="data:image/png;base64,iVBOR"/></svg>`],
  ["an xlink:href to a remote file", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><use xlink:href="https://evil.example/x.svg#a"/></svg>`],
  ["a CSS @import", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>@import url(https://evil.example/x.css);</style></svg>`],
  ["a url() to a remote resource", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect fill="url(https://evil.example/x)" width="1" height="1"/></svg>`],
  ["an <iframe>", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><iframe src="/admin"/></svg>`],
  ["a script hidden behind a comment", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><!-- --><script>alert(1)</script><!-- --></svg>`],
  // The second reference is the hostile one: a scan that stops at the first
  // match reads the harmless `#clip` and waves the file through.
  ["a remote reference after a safe one", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><use href="#clip"/><image href="https://evil.example/p.gif"/></svg>`],
];

for (const [label, body] of HOSTILE) {
  const r = await readImageFile(svgFile(body), { allowVector: true });
  check(`refuses ${label}`, !r.ok, r.ok ? "ACCEPTED" : "");
}

/* ---------------------------------------------------------------- */
console.log("\n[4] SVG IS OFF UNLESS THE CALL SITE ASKS FOR IT");

{
  const r = await readImageFile(svgFile(PLAIN));
  check("a product photo upload refuses an SVG", !r.ok, r.ok ? "ACCEPTED" : "");
  if (!r.ok) check("and does not offer SVG in the message", !r.error.includes("SVG"), r.error);
}
{
  const r = await readImageFile(svgFile(PLAIN), { allowVector: true });
  check("a category upload offers it", r.ok);
}

/* ---------------------------------------------------------------- */
console.log("\n[5] SIZE, AND THINGS THAT ARE NOT IMAGES AT ALL");

{
  // 600 Ko of path data: past the vector cap, nowhere near the 4 Mo raster one.
  const huge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="${"M0 0".repeat(150_000)}"/></svg>`;
  const r = await readImageFile(svgFile(huge), { allowVector: true });
  check("a 500 Ko+ SVG is refused", !r.ok, r.ok ? `accepted (${huge.length} bytes)` : "");
  if (!r.ok) check("and the message says the vector limit, not 4 Mo", r.error.includes("500 Ko"), r.error);
}
{
  const r = await readImageFile(new File(["<html><body>hi</body></html>"], "x.svg"), { allowVector: true });
  check("an HTML file renamed .svg is refused", !r.ok, r.ok ? "ACCEPTED" : "");
}
{
  const r = await readImageFile(new File(["MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00"], "x.png"), { allowVector: true });
  check("a Windows executable is refused", !r.ok, r.ok ? "ACCEPTED" : "");
}
{
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  const r = await readImageFile(new File([png], "real.png"), { allowVector: true });
  check("a real PNG still uploads", r.ok, r.ok ? "" : r.error);
  if (r.ok) check("and is stored as image/png", r.mimeType === "image/png", r.mimeType);
}

/* ---------------------------------------------------------------- */
console.log("\n[6] THE URL CARRIES THE FORMAT");

check("a vector gets the .svg suffix", assetUrl("abc123", "image/svg+xml") === "/api/images/abc123.svg");
check("a raster does not", assetUrl("abc123", "image/png") === "/api/images/abc123");
check("the id reads back off a vector URL", mediaAssetIdFromUrl("/api/images/abc123.svg") === "abc123");
check("and off a raster URL", mediaAssetIdFromUrl("/api/images/abc123") === "abc123");
check("a static path yields no id", mediaAssetIdFromUrl("/images/storefront.png") === null);
check("a foreign URL yields no id", mediaAssetIdFromUrl("https://evil.example/api/images/x") === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
