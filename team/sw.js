// Aufräumen: Hier lag der Offline-Speicher des alten Kometen-Team-Chats.
// Diese Datei löscht ihn und meldet sich dann selbst ab. Die neuen Team-Apps
// (team/omnivia, team/flaressa, …) haben jeweils ihren eigenen Speicher.
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.filter(function (k) { return k.indexOf("kw-team-") === 0; }).map(function (k) { return caches.delete(k); }));
    await self.registration.unregister();
    var fenster = await self.clients.matchAll({ type: "window" });
    fenster.forEach(function (c) { c.navigate(c.url); });
  })());
});
