// Offline-Speicher für FIDELIA Team
const V = "omni-team-fidelia-2026-10-29-studio";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "../../shared/team/team.css", "../../shared/team/team.js", "../../shared/team/rollen.js", "../../shared/intro.js", "../../shared/fonts/fonts.css", "../../shared/fonts/space-grotesk-latin-400-normal.woff2", "../../shared/fonts/space-grotesk-latin-500-normal.woff2", "../../shared/fonts/space-grotesk-latin-600-normal.woff2", "../../shared/marken/omnivia-zeichen.webp", "../../shared/marken/fidelia-zeichen.webp"].filter(Boolean);
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x.startsWith("omni-team-fidelia-") && x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return; // Firebase und KI-Modelle nicht anfassen
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
