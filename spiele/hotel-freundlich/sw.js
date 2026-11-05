const CACHE='hotel-freundlich-v2';
const FILES=['./','./index.html','./spiel.css','./spiel.js','./welt.js','../../shared/vendor/three-0.160.0/three.module.min.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png','../../Krawallzoo/fonts/fonts.css','../../shared/intro.js','../../shared/marken/omnivia-zeichen.webp'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('hotel-freundlich-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  e.respondWith(fetch(req).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});return res;}).catch(()=>caches.match(req).then(r=>r||caches.match('./index.html'))));
});
