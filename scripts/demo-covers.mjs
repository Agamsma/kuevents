/**
 * Generates the demo cover art in `public/demo/`.
 *
 * Why generated rather than downloaded: `next.config.ts` narrows the image
 * optimiser to `firebasestorage.googleapis.com` on purpose — a wildcard there
 * would turn it into an open proxy anyone could point at any URL — and the CSP
 * allows `img-src 'self'`. A stock photo from some CDN would be refused twice
 * over, and loosening either to make a demo look nice would be a bad trade.
 *
 * Deliberately abstract, with no type in the artwork. The poster card sets the
 * event's title, venue and time OVER the image and holds them legible with
 * `.spotlight`, so a cover carrying its own headline would collide with the
 * real one. These are backgrounds, which is what a cover is.
 *
 * PNG is written by hand because the alternative is a native image dependency
 * for six demo files. The format is small: signature, IHDR, one zlib-deflated
 * IDAT of filter-0 scanlines, IEND.
 *
 *   node scripts/demo-covers.mjs
 */

import { deflateSync, crc32 } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "demo");

/** 2:3, matching the `.poster` block the card lays these into. */
const W = 800;
const H = 1200;

/*
 * Each cover is a warm ground with two soft lights over it.
 *
 * The hues stay inside the university's family — reds, ambers, a clay and a
 * deep plum — so six of them in a grid read as one set rather than a swatch
 * book. `ground` is the bottom of the vertical gradient and is always the
 * darkest value, because the card's type sits over the lower third.
 */
const COVERS = [
  {
    file: "dental.png",
    top: [122, 30, 28],
    ground: [28, 12, 14],
    lights: [
      { x: 0.24, y: 0.3, r: 0.52, rgb: [216, 86, 66], a: 0.85 },
      { x: 0.82, y: 0.14, r: 0.34, rgb: [247, 197, 122], a: 0.5 },
    ],
  },
  {
    file: "moot-court.png",
    top: [46, 30, 74],
    ground: [16, 11, 26],
    lights: [
      { x: 0.74, y: 0.26, r: 0.5, rgb: [128, 96, 196], a: 0.8 },
      { x: 0.2, y: 0.62, r: 0.4, rgb: [196, 62, 74], a: 0.45 },
    ],
  },
  {
    file: "colloquium.png",
    top: [26, 58, 62],
    ground: [10, 20, 24],
    lights: [
      { x: 0.3, y: 0.24, r: 0.46, rgb: [72, 168, 160], a: 0.78 },
      { x: 0.8, y: 0.66, r: 0.42, rgb: [231, 156, 86], a: 0.4 },
    ],
  },
  {
    file: "media-fest.png",
    top: [140, 54, 22],
    ground: [32, 14, 10],
    lights: [
      { x: 0.68, y: 0.22, r: 0.55, rgb: [247, 133, 67], a: 0.88 },
      { x: 0.18, y: 0.7, r: 0.38, rgb: [214, 62, 52], a: 0.5 },
    ],
  },
  {
    file: "design-summit.png",
    top: [150, 104, 26],
    ground: [34, 22, 12],
    lights: [
      { x: 0.32, y: 0.28, r: 0.5, rgb: [247, 215, 90], a: 0.72 },
      { x: 0.78, y: 0.68, r: 0.44, rgb: [200, 78, 44], a: 0.55 },
    ],
  },
  {
    file: "b-plan.png",
    top: [30, 62, 46],
    ground: [11, 22, 18],
    lights: [
      { x: 0.72, y: 0.3, r: 0.48, rgb: [86, 178, 128], a: 0.76 },
      { x: 0.24, y: 0.72, r: 0.4, rgb: [231, 186, 96], a: 0.42 },
    ],
  },
];

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

/** Smooth falloff, so a light has no visible rim. */
function falloff(t) {
  if (t >= 1) return 0;
  const u = 1 - t * t;
  return u * u;
}

function render({ top, ground, lights }) {
  // One filter byte (0 = None) per scanline, then RGB triples.
  const raw = Buffer.alloc(H * (1 + W * 3));
  const diag = Math.hypot(W, H);

  for (let y = 0; y < H; y += 1) {
    const rowStart = y * (1 + W * 3);
    raw[rowStart] = 0;

    // Eased rather than linear: a straight ramp bands visibly over 1200px.
    const v = y / (H - 1);
    const ease = v * v * (3 - 2 * v);

    for (let x = 0; x < W; x += 1) {
      let r = top[0] + (ground[0] - top[0]) * ease;
      let g = top[1] + (ground[1] - top[1]) * ease;
      let b = top[2] + (ground[2] - top[2]) * ease;

      for (const light of lights) {
        const dx = x - light.x * W;
        const dy = y - light.y * H;
        const k = falloff(Math.hypot(dx, dy) / (light.r * diag)) * light.a;
        if (k <= 0) continue;

        // Screen blend, so lights build up without clipping to flat white.
        r += (255 - r) * (light.rgb[0] / 255) * k;
        g += (255 - g) * (light.rgb[1] / 255) * k;
        b += (255 - b) * (light.rgb[2] / 255) * k;
      }

      /*
       * No dither, deliberately.
       *
       * An ordered dither here scattered the eight-bit banding beautifully and
       * took every file from roughly 20 KB to roughly 400 KB — PNG's filters
       * predict a smooth ramp almost perfectly and per-pixel noise destroys
       * that. Six of those is 2.3 MB of demo art in the repository.
       *
       * It also bought nothing. These are never served as written: `next/image`
       * re-encodes them to WebP at the width actually rendered (256px in a
       * four-column grid, 384px full-width on a phone), and that pass does its
       * own dithering on a gradient a quarter of this size. The banding the
       * noise existed to hide is not visible at the scale anyone sees.
       */
      const o = rowStart + 1 + x * 3;
      raw[o] = clamp255(r);
      raw[o + 1] = clamp255(g);
      raw[o + 2] = clamp255(b);
    }
  }

  return raw;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed) >>> 0);

  return Buffer.concat([length, typed, crc]);
}

function png(raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = truecolour RGB
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });

for (const cover of COVERS) {
  const file = join(OUT_DIR, cover.file);
  const bytes = png(render(cover));
  writeFileSync(file, bytes);
  console.log(`${cover.file.padEnd(20)} ${(bytes.length / 1024).toFixed(0)} KB`);
}

console.log(`\n${COVERS.length} covers written to public/demo/`);
