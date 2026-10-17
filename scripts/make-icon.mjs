// Writes a 512x512 code-drawn PNG app icon (no downloaded assets). Usage: node scripts/make-icon.mjs out.png
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const S = 512;
const px = Buffer.alloc((S * 4 + 1) * S);
const put = (x, y, [r, g, b]) => {
  const o = y * (S * 4 + 1) + 1 + x * 4;
  px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
};
// 16x16 pixel note on a night background, scaled 32x.
const art = [
  '................', '................', '.........#######', '.........#######', '.........##...##', '.........##...##',
  '.........##...##', '.........##...##', '.........##...##', '.....#####..####', '....######.#####', '....######.#####',
  '.....####...###.', '................', '................', '................',
];
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const on = art[y >> 5][x >> 5] === '#';
    put(x, y, on ? [242, 220, 75] : [11, 11, 20]);
  }
}
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6;
writeFileSync(process.argv[2] ?? 'app-icon.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(px)), chunk('IEND', Buffer.alloc(0))]));
