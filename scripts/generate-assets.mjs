/**
 * Generates the PWA icons and the OG share image deterministically —
 * `node scripts/generate-assets.mjs`. Hand-rolled PNG encoder (zlib deflate
 * + chunk CRCs) drawing rects and a chunky 5x7 bitmap wordmark: lo-fi on
 * purpose, matching the rubber-stamp aesthetic. Rerun after art changes.
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// ---------------------------------------------------------------- palette
const PAPER = [0xf7, 0xf5, 0xee];
const BRIGHT = [0xfd, 0xfc, 0xf7];
const INK = [0x1c, 0x1b, 0x17];
const RED = [0xb3, 0x38, 0x2c];

// ------------------------------------------------------------- 5x7 font
const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '00110', '00110'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

// ------------------------------------------------------------ raster ops
function makeImage(w, h) {
  return { w, h, px: new Uint8Array(w * h * 4) };
}

function fillRect(img, x, y, w, h, [r, g, b]) {
  const x1 = Math.max(0, Math.round(x));
  const y1 = Math.max(0, Math.round(y));
  const x2 = Math.min(img.w, Math.round(x + w));
  const y2 = Math.min(img.h, Math.round(y + h));
  for (let yy = y1; yy < y2; yy++) {
    for (let xx = x1; xx < x2; xx++) {
      const i = (yy * img.w + xx) * 4;
      img.px[i] = r;
      img.px[i + 1] = g;
      img.px[i + 2] = b;
      img.px[i + 3] = 255;
    }
  }
}

function strokeRect(img, x, y, w, h, thickness, color) {
  fillRect(img, x, y, w, thickness, color);
  fillRect(img, x, y + h - thickness, w, thickness, color);
  fillRect(img, x, y, thickness, h, color);
  fillRect(img, x + w - thickness, y, thickness, h, color);
}

function textWidth(str, scale) {
  return str.length * 6 * scale - scale;
}

function drawText(img, str, x, y, scale, color) {
  let cx = x;
  for (const ch of str) {
    const glyph = FONT[ch] ?? FONT[' '];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] === '1') {
          fillRect(img, cx + col * scale, y + row * scale, scale, scale, color);
        }
      }
    }
    cx += 6 * scale;
  }
}

// ------------------------------------------------------------ png encode
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(img) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(img.h * (img.w * 4 + 1));
  for (let y = 0; y < img.h; y++) {
    raw[y * (img.w * 4 + 1)] = 0; // filter none
    Buffer.from(img.px.buffer, y * img.w * 4, img.w * 4).copy(
      raw,
      y * (img.w * 4 + 1) + 1,
    );
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- assets
function drawIcon(size, maskable) {
  const img = makeImage(size, size);
  const u = size / 512;
  fillRect(img, 0, 0, size, size, PAPER);
  const inset = (maskable ? 96 : 56) * u;
  const shadow = 18 * u;
  const cardW = size - inset * 2;
  fillRect(img, inset + shadow, inset + shadow, cardW, cardW, INK);
  fillRect(img, inset, inset, cardW, cardW, BRIGHT);
  strokeRect(img, inset, inset, cardW, cardW, 10 * u, INK);
  fillRect(img, inset + 36 * u, inset + 52 * u, cardW - 72 * u, 8 * u, INK);
  const scale = Math.max(1, Math.round(22 * u));
  const tw = textWidth('TSH', scale);
  const tx = (size - tw) / 2;
  const ty = (size - 7 * scale) / 2 + 14 * u;
  strokeRect(img, tx - 22 * u, ty - 26 * u, tw + 44 * u, 7 * scale + 52 * u, 12 * u, RED);
  drawText(img, 'TSH', tx, ty, scale, RED);
  return img;
}

/**
 * Slab-serif letters built from rectangles (T, S, H only) — the closest an
 * encoder without font rasterization gets to "serif wordmark," and it reads
 * as letterpress. Each letter fills a w x h box with stroke s.
 */
function drawSlabLetter(img, ch, x, y, w, h, s, color) {
  const serifW = Math.round(s * 1.9);
  const serifH = Math.round(s * 0.55);
  const stemX = x + Math.round((w - s) / 2);
  if (ch === 'T') {
    fillRect(img, x, y, w, s, color); // top bar
    fillRect(img, x, y + s, serifH + 2, serifH, color); // left drop serif
    fillRect(img, x + w - serifH - 2, y + s, serifH + 2, serifH, color);
    fillRect(img, stemX, y, s, h, color); // stem
    fillRect(img, x + Math.round((w - serifW) / 2), y + h - serifH, serifW, serifH, color); // foot
  } else if (ch === 'S') {
    const mid = y + Math.round((h - s) / 2);
    fillRect(img, x, y, w, s, color); // top
    fillRect(img, x, y + s, s, mid - y - s, color); // upper-left stem
    fillRect(img, x, mid, w, s, color); // middle
    fillRect(img, x + w - s, mid + s, s, y + h - mid - 2 * s, color); // lower-right stem
    fillRect(img, x, y + h - s, w, s, color); // bottom
  } else if (ch === 'H') {
    for (const sx of [x, x + w - s]) {
      fillRect(img, sx, y, s, h, color); // stems
      const cx = sx + Math.round(s / 2);
      fillRect(img, cx - Math.round(serifW / 2), y, serifW, serifH, color); // head serif
      fillRect(img, cx - Math.round(serifW / 2), y + h - serifH, serifW, serifH, color); // foot serif
    }
    fillRect(img, x, y + Math.round((h - s) / 2), w, s, color); // crossbar
  }
}

/** 180x180 apple-touch-icon: paper, memo rule, ink slab TSH, red accent. */
function drawAppleTouchIcon() {
  const img = makeImage(180, 180);
  fillRect(img, 0, 0, 180, 180, PAPER);
  fillRect(img, 20, 26, 140, 5, INK); // memo header rule
  const letterW = 40;
  const gap = 10;
  const x0 = Math.round((180 - (letterW * 3 + gap * 2)) / 2);
  for (const [i, ch] of ['T', 'S', 'H'].entries()) {
    drawSlabLetter(img, ch, x0 + i * (letterW + gap), 54, letterW, 68, 12, INK);
  }
  fillRect(img, x0, 140, letterW * 3 + gap * 2, 9, RED); // stamp-red accent rule
  return img;
}

function drawOg() {
  const img = makeImage(1200, 630);
  fillRect(img, 0, 0, 1200, 630, PAPER);
  fillRect(img, 52, 52, 1120, 540, INK); // offset shadow
  fillRect(img, 40, 40, 1120, 540, BRIGHT);
  strokeRect(img, 40, 40, 1120, 540, 6, INK);

  drawText(img, 'INTERNAL MEMORANDUM', 100, 92, 3, INK);
  fillRect(img, 100, 122, 1000, 5, INK);

  drawText(img, 'TERM SHEET', 100, 170, 16, INK);
  drawText(img, 'HAPPENS', 100, 300, 16, INK);

  // Red stamp grazing the wordmark's tail, like every memo that mattered.
  const stamp = 'MOST FUNDS FAIL';
  const sw = textWidth(stamp, 4);
  strokeRect(img, 700 - 24, 338 - 22, sw + 48, 7 * 4 + 44, 8, RED);
  drawText(img, stamp, 700, 338, 4, RED);

  drawText(img, 'A SATIRICAL VC CARD-SWIPE ROGUELITE', 100, 445, 3, INK);
  drawText(img, 'TERMSHEETHAPPENS.GAME', 100, 540, 3, INK);
  return img;
}

mkdirSync(join(outRoot, 'icons'), { recursive: true });
writeFileSync(join(outRoot, 'icons', 'icon-192.png'), encodePng(drawIcon(192, false)));
writeFileSync(join(outRoot, 'icons', 'icon-512.png'), encodePng(drawIcon(512, false)));
writeFileSync(join(outRoot, 'icons', 'icon-maskable-512.png'), encodePng(drawIcon(512, true)));
writeFileSync(join(outRoot, 'icons', 'apple-touch-icon.png'), encodePng(drawAppleTouchIcon()));
writeFileSync(join(outRoot, 'og.png'), encodePng(drawOg()));
console.log(
  'Wrote icons/icon-192.png, icons/icon-512.png, icons/icon-maskable-512.png, icons/apple-touch-icon.png, og.png',
);
