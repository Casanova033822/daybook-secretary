import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
// Code-native app mark: a small sun on a rounded terracotta tile.
const size = 256, bytes = Buffer.alloc((size * 4 + 1) * size);
const lineDistance = (x, y, ax, ay, bx, by) => { const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2))); return Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay)); };
const rounded = (x, y) => Math.hypot(Math.max(Math.abs(x - 128) - 62, 0), Math.max(Math.abs(y - 128) - 62, 0)) <= 50;
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  let total = [0, 0, 0, 0];
  for (const dx of [.25, .75]) for (const dy of [.25, .75]) {
    const px = x + dx, py = y + dy;
    if (!rounded(px, py)) continue;
    let white = Math.abs(Math.hypot(px - 128, py - 128) - 35) < 5;
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; if (lineDistance(px, py, 128 + Math.cos(a) * 55, 128 + Math.sin(a) * 55, 128 + Math.cos(a) * 70, 128 + Math.sin(a) * 70) < 4.5) white = true; }
    const color = white ? [255, 249, 240] : [211, 143, 109];
    color.forEach((v, i) => { total[i] += v; }); total[3] += 255;
  }
  const offset = y * (size * 4 + 1) + 1 + x * 4;
  for (let c = 0; c < 3; c++) bytes[offset + c] = total[3] ? Math.round(total[c] * 255 / total[3]) : 0;
  bytes[offset + 3] = Math.round(total[3] / 4);
}
function crc32(buf) { let crc = 0xffffffff; for (const b of buf) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const label = Buffer.from(type); const result = Buffer.alloc(data.length + 12); result.writeUInt32BE(data.length); label.copy(result, 4); data.copy(result, 8); result.writeUInt32BE(crc32(Buffer.concat([label, data])), data.length + 8); return result; }
const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(bytes)), chunk('IEND', Buffer.alloc(0))]);
mkdirSync('assets', { recursive: true }); writeFileSync('assets/icon.png', png);
const ico = Buffer.alloc(22); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4); ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(png.length, 14); ico.writeUInt32LE(22, 18);
writeFileSync('assets/icon.ico', Buffer.concat([ico, png]));
