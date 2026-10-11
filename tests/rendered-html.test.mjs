import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders the production tracker without development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.doesNotMatch(html, developmentPreviewMeta);
  assert.match(html, /Progress dashboard/i);
  assert.match(html, /Coach snapshot/i);
  assert.match(html, /Copy for ChatGPT/i);
  assert.match(html, /Upper A/i);
  assert.match(html, /A balanced four-day routine/i);
  assert.match(html, /Working sets per four-session cycle/i);
  assert.match(html, /Daily recovery &amp; nutrition/i);
  assert.match(html, /Install the app/i);
  assert.match(html, /manifest\.webmanifest/i);
});

test('generic offline page contains no supplied identity and APIs reject missing authentication', async () => {
  const { default: worker } = await import(new URL('../dist/server/index.js', import.meta.url));
  const env = { ASSETS: { fetch: async () => new Response('Not found', { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const offline = await worker.fetch(new Request('http://localhost/offline', { headers: { accept: 'text/html', 'oai-authenticated-user-email': 'synthetic-identity@example.test' } }), env, ctx);
  assert.equal(offline.status, 200);
  const html = await offline.text(); assert.match(html, /data-offline-shell="generic"/); assert.doesNotMatch(html, /synthetic-identity@example.test/); assert.match(html, /Personal records stay hidden/);
  for (const [path, method] of [['/api/coach', 'POST'], ['/api/progress', 'PUT'], ['/api/session', 'GET']]) {
    const response = await worker.fetch(new Request('http://localhost' + path, { method }), env, ctx);
    assert.equal(response.status, 401, path);
  }
});
