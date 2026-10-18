// Offline-Speicher für Kometen-Küche
const V = "kw-kueche-2026-10-17a";
const SHELL = ["./", "index.html", "manifest.webmanifest", "rezept-lesen.js", "icons/icon-192.png", "icons/icon-512.png", "../shared/kw.css", "../shared/kw.js", "../shared/fonts/fonts.css", "../shared/fonts/space-grotesk-latin-400-normal.woff2", "../shared/fonts/space-grotesk-latin-500-normal.woff2", "../shared/fonts/space-grotesk-latin-600-normal.woff2"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("kw-kueche-") && k !== V).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
const NETZ = ["einstellungen.json"];
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Rezept-Helfer & Co. nie zwischenspeichern
  if (req.mode === "navigate" || NETZ.some(n => url.pathname.endsWith("/" + n))) {
    e.respondWith(fetch(req).then(res => { const c = res.clone(); caches.open(V).then(x => x.put(req, c)); return res; }).catch(() => caches.match(req).then(r => r || caches.match("index.html"))));
    return;
  }
  // Texterkennung (groß) erst speichern, wenn sie einmal benutzt wurde
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { if (res.ok) { const c = res.clone(); caches.open(V).then(x => x.put(req, c)); } return res; })));
});
