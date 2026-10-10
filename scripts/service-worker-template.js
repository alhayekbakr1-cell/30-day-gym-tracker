/* global self, caches */
const POLICY = /*OFFLINE_POLICY*/ { version: "test", assets: [] };
const CACHE = `gym-shell-${POLICY.version}`;
const SHELL = "/offline";
const ASSETS = new Set(POLICY.assets);
const unavailable = () => new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gym Tracker — offline</title><body><h1>Gym Tracker is offline</h1><p>The app shell is unavailable. Connect to the internet and visit the tracker once to prepare offline startup. Your device drafts have not been changed.</p><a href="/">Retry connection</a></body></html>', { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
function safeStatic(url) { return url.origin === self.location.origin && !url.search && ASSETS.has(url.pathname); }
function correctType(path, response) {
  const type = response.headers.get("content-type") ?? "";
  return response.ok && !response.redirected && (/\.js$/.test(path) ? /javascript/.test(type) : /\.css$/.test(path) ? /text\/css/.test(type) : /\.(woff2?|ttf)$/.test(path) ? /font|octet-stream/.test(type) : /image\//.test(type));
}
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const response = await fetch(SHELL, { cache: "no-store" });
    if (!response.ok || response.redirected || !(await response.clone().text()).includes('data-offline-shell="generic"')) throw new Error("Generic offline shell unavailable");
    const cache = await caches.open(CACHE);
    await cache.put(SHELL, response);
    await Promise.all(POLICY.assets.map(async path => {
      const asset = await fetch(path, { cache: "reload" });
      if (!correctType(path, asset)) throw new Error("Offline asset unavailable");
      await cache.put(path, asset);
    }));
    // No skipWaiting: don't interrupt an editing tab or replace its assets.
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith("gym-shell-") && key !== CACHE) await caches.delete(key);
    // Never touch localStorage/IndexedDB or claim/reload active clients.
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // All APIs, auth routes, RSC requests, identity and authenticated HTML bypass Cache Storage.
  if (request.mode === "navigate" && (url.pathname === "/" || url.pathname === SHELL)) {
    event.respondWith((async () => {
      try { return await fetch(request); }
      catch { return (await (await caches.open(CACHE)).match(SHELL)) ?? unavailable(); }
    })());
  } else if (safeStatic(url)) {
    event.respondWith((async () => {
      const cached = await (await caches.open(CACHE)).match(url.pathname);
      return cached ?? fetch(request);
    })());
  }
});
