// Original two-note chime. PCM WAV avoids codecs and external/network dependencies.
import { writeFileSync } from 'node:fs';
const rate = 44100, count = Math.round(rate * 1.05), buffer = Buffer.alloc(44 + count * 2);
buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32);
buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(count * 2, 40);
for (let i = 0; i < count; i++) {
  let sample = 0;
  for (const [start, frequency] of [[0, 880], [0.28, 1174.66]]) {
    const t = i / rate - start;
    if (t >= 0) sample += Math.min(1, t / 0.008) * Math.exp(-6 * t) * 0.32 * (Math.sin(2 * Math.PI * frequency * t) + 0.15 * Math.sin(4 * Math.PI * frequency * t));
  }
  buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + i * 2);
}
writeFileSync(new URL('../assets/reminder.wav', import.meta.url), buffer);
