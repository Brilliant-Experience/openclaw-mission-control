// Mission Control — Service Worker (offline shell)
// Cache version: bump CACHE to invalidate on deploy.
const CACHE = "mc-shell-v1";
const SHELL = ["/", "/dashboard", "/offline"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => {
      // Take over immediately without waiting for old SW to become idle.
      self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (e) => {
  // Remove stale caches from previous versions.
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // Only intercept same-origin navigation requests for the offline fallback.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(() =>
        caches.match("/").then((r) => r ?? new Response("Offline", { status: 503 }))
      )
    );
  }
});
