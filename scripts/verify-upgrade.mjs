// Read-only comparison of personal data before and after an in-place update.
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const db = new DatabaseSync(join(process.env.APPDATA, '日序', 'daybook.sqlite'), { readOnly: true });
const fingerprint = {};
for (const table of ['items', 'exceptions', 'states', 'deliveries']) {
  const rows = db.prepare(`SELECT * FROM ${table}`).all().map(row => JSON.stringify(row)).sort();
  fingerprint[table] = { count: rows.length, hash: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
}
for (const key of ['settings', 'presets']) {
  const row = db.prepare('SELECT value FROM meta WHERE key=?').get(key);
  fingerprint[key] = createHash('sha256').update(String(row?.value)).digest('hex');
}
fingerprint.integrity = db.prepare('PRAGMA integrity_check').get().integrity_check;
db.close();
const path = 'test-results/upgrade-before.json';
mkdirSync('test-results', { recursive: true });
if (process.argv[2] === 'before') writeFileSync(path, JSON.stringify(fingerprint, null, 2));
else {
  assert.deepEqual(fingerprint, JSON.parse(readFileSync(path, 'utf8')));
  writeFileSync('test-results/upgrade-after.json', JSON.stringify({ preserved: true, ...fingerprint }, null, 2));
}
console.log(process.argv[2] === 'before' ? 'Captured read-only personal data fingerprint.' : 'PASS: existing events, states, exceptions, reminder history, presets and settings preserved exactly; SQLite integrity OK.');
