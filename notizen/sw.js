// Offline-Speicher für FIDELIA Notizen
const V = "kw-notizen-2026-11-09-puzzle";
const SHELL = ["./", "index.html", "manifest.webmanifest", "notizen.css", "app.js", "speicher.js", "einstellungen.js", "ki.js", "heft.js", "scanner.js", "scan-kern.js", "planer.js", "lernen.js", "audio.js", "start.js", "sprache.js", "sync.js", "papier.js", "formen.js", "editor.js", "nachbau.js", "export.js", "formel.js", "xlsx.js", "diagramm.js", "tabellen.js", "extras.js", "folien-kern.js", "folien.js", "pptx.js", "plotter.js", "mindmap.js", "rechner-kern.js", "rechner.js", "werkzeuge.js", "ausrichten.js", "../ki/motor.js", "../shared/vendor/qr/qrcode.js", "../shared/vendor/fflate-0.8.3/fflate.mjs", "../shared/vendor/katex-0.16.47/katex.min.js", "../shared/vendor/katex-0.16.47/katex.min.css", "icons/icon-192.png", "icons/icon-512.png", "../shared/kw.css", "../shared/kw.js", "../shared/intro.js", "../shared/marken/fidelia.webp", "../shared/marken/omnivia-zeichen.webp", "../shared/fonts/fonts.css", "../shared/fonts/space-grotesk-latin-400-normal.woff2", "../shared/fonts/space-grotesk-latin-500-normal.woff2", "../shared/fonts/space-grotesk-latin-600-normal.woff2"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("kw-notizen-") && k !== V).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
const FREMD = ["raw.githubusercontent.com", "cdn.jsdelivr.net"];
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
