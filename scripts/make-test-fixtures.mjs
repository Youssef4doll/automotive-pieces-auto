// The files the end-to-end suites upload.
//
// Five suites (a-to-z, admin-crud, banners, category-images, product-photos)
// exercise the real upload path, which needs real files to hand it. They used
// to come from a directory that only existed on one machine, so the battery
// could not be run from a fresh clone. They are generated here instead: what
// the suites assert is that a valid image is stored and served and an invalid
// one is refused, and none of that depends on what the picture is of.
//
//   node scripts/make-test-fixtures.mjs [dir]     # default: .e2e-fixtures
//
// Then point the suites at it:  PICS_DIR=.e2e-fixtures node scripts/e2e-*.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const dir = resolve(process.argv[2] || ".e2e-fixtures");
mkdirSync(dir, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/**
 * A real PNG: 8-bit RGB, written by hand so there is no image library in the
 * test path.
 *
 * Deliberately not a flat colour. Two suites assert that an upload stored real
 * bytes rather than a path, by checking the row is bigger than 5KB and 10KB —
 * and a single-colour 400x400 PNG deflates to 1.4KB, so flat fixtures failed a
 * check that was doing its job. A gradient with a little deterministic jitter
 * compresses like a photograph does. The jitter comes from a fixed seed, so
 * the same bytes come out on every machine.
 */
function png(width, height, [r, g, b]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  // 10..12 stay 0: deflate, adaptive filtering, no interlace.

  // Each row is a filter byte followed by RGB triples.
  let seed = 0x2f6e2b1;
  const jitter = () => {
    // xorshift32: a couple of lines, and identical everywhere.
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >> 17;
    seed ^= seed << 5; seed >>>= 0;
    return (seed % 14) - 7;
  };
  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    const shade = Math.round((y / height) * 60) - 30;
    for (let x = 0; x < width; x++) {
      row[1 + x * 3] = clamp(r + shade + jitter());
      row[2 + x * 3] = clamp(g + shade + jitter());
      row[3 + x * 3] = clamp(b + shade + jitter());
    }
    rows.push(row);
  }
  const raw = Buffer.concat(rows);

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Square product and category pictures, and 21:9 banner artwork at the size
// the admin form recommends. Distinct colours so a wrong file in a failing
// screenshot is obvious at a glance.
const files = {
  "pad-front.png": png(400, 400, [30, 41, 59]),
  "pad-side.png": png(400, 400, [71, 85, 105]),
  "freinage.png": png(400, 400, [190, 30, 45]),
  "renault-logo.png": png(400, 400, [245, 197, 24]),
  "banner-freinage.png": png(1600, 686, [11, 27, 58]),
  "banner-hiver.png": png(1600, 686, [12, 74, 110]),
  // Not an image at all: the suites check that the upload refuses it.
  "notanimage.txt": Buffer.from("this is definitely not an image\n"),
};

for (const [name, data] of Object.entries(files)) {
  writeFileSync(join(dir, name), data);
}

console.log(`Wrote ${Object.keys(files).length} fixtures to ${dir}`);
console.log("Run the suites with:  PICS_DIR=" + dir);
