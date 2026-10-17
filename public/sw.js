// The service worker: what lets the site be installed as an app and still open without a connection.
//
//   Pages          asked from the network first, so they are always current; a copy of each one visited is
//                  kept and shown if there is no connection, or if the network has not answered within a few
//                  seconds (a bad connection must never leave a blank screen when a kept copy would do).
//                  A page never visited gets /offline.html.
//   Built files    (/_next/static, fonts, icons, sounds) never change once made, so the kept copy is used.
//   /api, /admin   never kept: they are always live, or nothing.
//
// Change VERSION to throw every kept copy away on visitors' devices.
const VERSION = "v4";
const PAGES = `pages-${VERSION}`;
const FILES = `files-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((cache) => cache.add("/offline.html")).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((n) => n !== PAGES && n !== FILES).map((n) => caches.delete(n)))).then(() => self.clients.claim()),
  );
});

const fixed = (url) => url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/sounds/") || /\.(woff2?|png|svg|ico|jpg|jpeg|webp)$/.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin") || url.pathname.startsWith("/media/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const kept = await caches.match(request);
        // With a kept copy to fall back on, the network gets a few seconds; without one it gets as long as it needs.
        const live = fetch(request).then((response) => {
          if (response.ok) caches.open(PAGES).then((cache) => cache.put(request, response.clone()));
          return response;
        });
        const slow = new Promise((resolve) => setTimeout(() => resolve(null), kept ? 3500 : 60000));
        try {
          const answer = await Promise.race([live, slow]);
          if (answer) return answer;
        } catch {}
        // Nothing (or nothing yet) from the network: the kept copy, kept fresh by the fetch still running.
        return kept || (await live.catch(() => null)) || caches.match("/offline.html");
      })(),
    );
    return;
  }
  if (fixed(url)) {
    event.respondWith(
      caches.match(request).then(
        (kept) =>
          kept ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(FILES).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
