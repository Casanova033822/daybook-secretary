import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { allowedRequest, bundledPath, developmentUrl, rendererUrl, trustedRenderer } from '../electron/security.js';
const dist = resolve('test-results/security-fixture/dist');
test('published app ignores developer URL; development allows only the exact loopback origin', () => {
  for (const url of ['http://127.0.0.1:5173', 'https://example.com', 'file:///private.html']) assert.equal(developmentUrl(true, url), undefined);
  assert.equal(developmentUrl(false, 'http://127.0.0.1:5173'), 'http://127.0.0.1:5173/');
  for (const url of ['http://127.0.0.1:5173.evil.example', 'http://127.0.0.1:5174', 'http://user@127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:5173/?remote=true']) assert.equal(developmentUrl(false, url), undefined);
});
test('IPC trusts the correct document and card hash, not another frame/document', () => {
  const main = rendererUrl(dist), card = rendererUrl(dist, undefined, true);
  assert.ok(trustedRenderer(main, dist)); assert.ok(trustedRenderer(card, dist, undefined, true));
  for (const url of [undefined, 'about:blank', 'https://example.com', main + '?x=1', card]) assert.equal(trustedRenderer(url, dist), false);
  assert.equal(trustedRenderer(main, dist, undefined, true), false);
});
test('production allows bundled resources, denies outbound traffic and outside files', () => {
  assert.ok(allowedRequest('daybook://app/assets/chime-abc.wav', dist));
  assert.ok(allowedRequest('daybook://app/assets/hk-abc.svg', dist));
  assert.ok(allowedRequest('data:image/png;base64,AA==', dist));
  for (const url of ['https://example.com', 'http://127.0.0.1:5173', 'ws://127.0.0.1:5173', pathToFileURL(resolve(dist, 'index.html')).href, pathToFileURL(resolve(dist, '../daybook.sqlite')).href, pathToFileURL(resolve(dist + '-other', 'secret.txt')).href, 'file://remote-host/share/secret', 'not a URL']) assert.equal(allowedRequest(url, dist), false, url);
  assert.ok(allowedRequest('ws://127.0.0.1:5173', dist, 'http://127.0.0.1:5173/'));
});

test('custom protocol exposes only bundled assets, rejecting path traversal and alternate hosts', () => {
  assert.equal(bundledPath('daybook://app/index.html#reminder', dist), resolve(dist, 'index.html'));
  assert.equal(bundledPath('daybook://app/assets/chime-abc.wav', dist), resolve(dist, 'assets/chime-abc.wav'));
  for (const url of ['daybook://other/index.html', 'daybook://user@app/index.html', 'daybook://app:90/index.html', 'daybook://app/daybook.sqlite', 'daybook://app/assets/%2e%2e%2fdaybook.sqlite', 'daybook://app/assets/%5c..%5cdaybook.sqlite', 'daybook://app/assets/chime.wav:secret', 'daybook://app/assets/%00.wav', 'daybook://app/assets/code.js.map', 'daybook://app/index.html?file=secret']) assert.equal(bundledPath(url, dist), undefined, url);
});
