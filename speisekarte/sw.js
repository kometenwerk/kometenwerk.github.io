// Offline-Speicher für FIDELIA Speisekarte
const V = "kw-speisekarte-2026-11-12";
const SHELL = ["./", "index.html", "manifest.webmanifest", "speisekarte.js", "speisekarte.css", "icons/icon-192.png", "icons/icon-512.png", "../shared/kw.css", "../shared/kw.js", "../shared/vendor/qr/qrcode.js", "../shared/marken/omnivia-zeichen.webp", "../shared/fonts/fonts.css", "../shared/fonts/space-grotesk-latin-400-normal.woff2", "../shared/fonts/space-grotesk-latin-500-normal.woff2", "../shared/fonts/space-grotesk-latin-600-normal.woff2"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x.startsWith("kw-speisekarte-") && x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  if (req.mode === "navigate") { e.respondWith(fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(req, c)); } return r; }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html")))); return; }
  e.respondWith(caches.match(req).then(hit => { const net = fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(req, c)); } return r; }).catch(() => hit); return hit || net; }));
});
