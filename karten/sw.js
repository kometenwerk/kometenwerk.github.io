// Offline-Speicher für OMNIVIA Karten
const V = "kw-karten-2026-11-06a";
const DATEN = "kw-karten-daten";   // Straßennetz und Suche, bleibt über Versionen erhalten
const SHELL = ["./", "index.html", "app.js", "netz.js", "suche.js", "verkehr.js", "navi.js", "karten.css", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png",
  "../shared/kw.css", "../shared/kw.js", "../shared/intro.js", "../shared/marken/omnivia-zeichen.webp", "../shared/fonts/fonts.css",
  "../shared/fonts/space-grotesk-latin-400-normal.woff2", "../shared/fonts/space-grotesk-latin-500-normal.woff2", "../shared/fonts/space-grotesk-latin-600-normal.woff2"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("kw-karten-") && k !== V && k !== DATEN).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
const FREMD = ["cdn.jsdelivr.net"];
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const eigen = url.origin === location.origin;
  if (!eigen && !FREMD.includes(url.hostname)) return; // Kartenbilder und Verkehrsmeldungen nicht speichern
  const daten = eigen && url.pathname.includes("/karten/daten/");
  const frisch = req.mode === "navigate" || (daten && /\/(index|verkehr)\.json$/.test(url.pathname));
  const speicher = daten ? DATEN : V;
  if (frisch) {
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const c = r.clone(); caches.open(speicher).then(x => x.put(req, c)); }
      return r;
    }).catch(() => caches.match(req).then(r => r || (req.mode === "navigate" ? caches.match("index.html") : Response.error()))));
    return;
  }
  e.respondWith(caches.open(speicher).then(c => c.match(req)).then(hit => {
    const net = fetch(req).then(r => {
      if (r.ok) { const c = r.clone(); caches.open(speicher).then(x => x.put(req, c)); }
      return r;
    }).catch(() => hit || Response.error());
    return hit || net;
  }));
});
