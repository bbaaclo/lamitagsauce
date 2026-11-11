// Change this version (v2 -> v3 ...) every time you upload changed app files,
// so installed phones pick up the update the next time they open with internet.
const CACHE = 'lami-tag-sauce-v4';
const SHELL = 'index.html';
const ASSETS = [
  SHELL, 'manifest.webmanifest',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png',
  'fonts/jakarta-latin.woff2', 'fonts/jakarta-latin-ext.woff2'
];

// A response that came through a redirect cannot be served to a page navigation
// (the browser shows ERR_FAILED). Store a clean copy instead.
async function clean(res) {
  if (!res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: 200, statusText: 'OK', headers: res.headers });
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const a of ASSETS) {
      const res = await fetch(new Request(a, { cache: 'reload' }));
      if (!res.ok) throw new Error('Could not fetch ' + a);
      await cache.put(a, await clean(res));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Opening the app (from the icon, "/" or "/index.html") always gets the saved app page.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cached = await caches.match(SHELL);
      if (cached) return cached;
      try { return await clean(await fetch(req)); }
      catch (err) { return Response.error(); }
    })());
    return;
  }

  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try { return await fetch(req); } catch (err) { return Response.error(); }
  })());
});
