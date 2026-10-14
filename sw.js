// Aufräumen: Hier lag aus Versehen der Offline-Speicher des Nachrichten-Hefts.
// Diese Datei löscht ihn wieder und meldet sich dann selbst ab.
// Das echte Nachrichten-Heft liegt unter /ND/ und hat seinen eigenen Speicher.
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.filter(function (k) { return k.indexOf("heft-") === 0; }).map(function (k) { return caches.delete(k); }));
    await self.registration.unregister();
    var fenster = await self.clients.matchAll({ type: "window" });
    fenster.forEach(function (c) { c.navigate(c.url); });
  })());
});
