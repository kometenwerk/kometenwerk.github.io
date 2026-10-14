// Offline-Speicher für Kometen-KI
const V = "kw-ki-ee6aa082";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "../shared/kw.css", "../shared/kw.js"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("kw-ki-") && k !== V).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
const FREMD = ["fonts.googleapis.com", "fonts.gstatic.com", "raw.githubusercontent.com", "cdn.jsdelivr.net"];
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const eigen = url.origin === location.origin;
  if (!eigen && !FREMD.includes(url.hostname)) return;
  if (req.mode === "navigate" || url.hostname === "raw.githubusercontent.com") {
    // Erst Netz (damit es aktuell ist), sonst gespeicherte Version
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(req, c)); }
      return r;
    }).catch(() => caches.match(req).then(r => r || caches.match("index.html"))));
    return;
  }
  // Sonst: sofort aus dem Speicher, im Hintergrund auffrischen
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => {
      if (r.ok || r.type === "opaque") { const c = r.clone(); caches.open(V).then(x => x.put(req, c)); }
      return r;
    }).catch(() => hit);
    return hit || net;
  }));
});
