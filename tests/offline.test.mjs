import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../scripts/service-worker-template.js', import.meta.url), 'utf8');
function worker() {
  const handlers = {}, stores = new Map(); let online = true;
  const caches = { keys: async () => [...stores.keys()], delete: async key => stores.delete(key), open: async key => {
    if (!stores.has(key)) stores.set(key, new Map()); const store = stores.get(key);
    return { put: async (path, value) => store.set(path, value.clone()), match: async path => store.get(path)?.clone() };
  } };
  const fetch = async request => { if (!online) throw Error('Offline'); const path = typeof request === 'string' ? request : new URL(request.url).pathname; return new Response(path === '/offline' ? '<html data-offline-shell="generic">No user identity</html>' : 'static', { headers: { 'content-type': path === '/offline' ? 'text/html' : 'text/javascript' } }); };
  vm.runInNewContext(source.replace('/*OFFLINE_POLICY*/ { version: "test", assets: [] }', JSON.stringify({ version: 'test', assets: ['/assets/tracker.js'] })), { self: { location: { origin: 'https://gym.test' }, addEventListener: (name, callback) => { handlers[name] = callback; } }, caches, fetch, Response, URL, Set, Promise });
  return { handlers, stores, setOffline: () => { online = false; }, run: async name => { let promise; handlers[name]({ waitUntil: task => { promise = task; } }); await promise; }, navigate: async path => { let task; handlers.fetch({ request: { method: 'GET', mode: 'navigate', url: 'https://gym.test' + path }, respondWith: value => { task = value; } }); return task; } };
}
test('successful online install enables generic cold offline shell and safe static assets', async () => {
  const w = worker(); await w.run('install'); w.setOffline(); const response = await w.navigate('/'); assert.equal(response.status, 200); assert.match(await response.text(), /No user identity/);
  assert.deepEqual([...[...w.stores.values()][0].keys()].sort(), ['/assets/tracker.js', '/offline']);
});
test('missing cache and first offline install report unavailable without a false sign-in', async () => {
  const w = worker(); w.setOffline(); await assert.rejects(w.run('install')); const response = await w.navigate('/'); assert.equal(response.status, 503); assert.match(await response.text(), /visit the tracker once/);
});
test('APIs, auth, private pages and query/RSC assets never enter service worker caches', async () => {
  const w = worker(); await w.run('install');
  for (const path of ['/api/progress', '/api/session', '/api/coach', '/signin-with-chatgpt', '/callback', '/?__rsc=1']) {
    let captured = false; w.handlers.fetch({ request: { method: 'GET', mode: 'cors', url: 'https://gym.test' + path }, respondWith: () => { captured = true; } }); assert.equal(captured, false, path);
  }
  const before = JSON.stringify([...w.stores.values()].map(store => [...store.keys()])); await w.navigate('/'); assert.equal(JSON.stringify([...w.stores.values()].map(store => [...store.keys()])), before);
});
test('worker activation touches only its shell caches and never deletes recovery drafts or reloads clients', async () => {
  const w = worker(); w.stores.set('gym-shell-old', new Map()); w.stores.set('unrelated-cache', new Map()); await w.run('activate'); assert.equal(w.stores.has('gym-shell-old'), false); assert.equal(w.stores.has('unrelated-cache'), true);
  assert.doesNotMatch(source, /self\.skipWaiting\(|clients\.claim\(|localStorage\.|indexedDB\./);
});

test('cache versions change when a stable-name static asset changes', async t => {
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises'); const { tmpdir } = await import('node:os'); const { spawnSync } = await import('node:child_process');
  const path = await import('node:path'); const directory = await mkdtemp(path.join(tmpdir(), 'gym-shell-test-')); t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, 'dist/client/assets'), { recursive: true }); await mkdir(path.join(directory, 'scripts'));
  await writeFile(path.join(directory, 'scripts/service-worker-template.js'), source); await writeFile(path.join(directory, 'dist/client/assets/main.js'), 'first');
  const generate = async () => { const result = spawnSync(process.execPath, [new URL('../scripts/prepare-offline.mjs', import.meta.url).pathname], { cwd: directory, encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); return await readFile(path.join(directory, 'dist/client/service-worker.js'), 'utf8'); };
  const first = await generate(); assert.equal(await generate(), first);
  await writeFile(path.join(directory, 'dist/client/assets/main.js'), 'changed'); assert.notEqual(await generate(), first);
});
