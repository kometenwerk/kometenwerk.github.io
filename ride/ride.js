/* FLARESSA Ride – Tacho, Strecke und Fahrten-Tagebuch. Alles bleibt auf dem Gerät (localStorage „kw-ride“). */
(function () {
  "use strict";
  var esc = KW.esc, $ = function (id) { return document.getElementById(id); };
  var D = KW.load("kw-ride", null) || { fahrten: [], art: "rad" };
  function speichern() { KW.save("kw-ride", D); }
  var ARTEN = { rad: "🚴 Fahrrad", skate: "🛹 Skateboard", bmx: "🚲 BMX", roller: "🛴 Roller", inline: "⛸️ Inliner", laufen: "🏃 Laufen" };
  var f = null, beob = null, uhr = null, sperre = null; // laufende Fahrt

  function abstand(a, b) { var R = 6371000, r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r, x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2); return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)); }
  function zeit(s) { s = Math.round(s); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); }
  function km(m) { return (m / 1000).toFixed(m < 10000 ? 2 : 1).replace(".", ","); }
  function kmh(v) { return (v * 3.6).toFixed(1).replace(".", ","); }

  /* ---------- Start-Ansicht ---------- */
  function start() {
    var summe = D.fahrten.reduce(function (s, x) { return s + x.m; }, 0);
    $("ansicht").innerHTML = '<div class="tacho-start"><div class="kreis" aria-hidden="true"><span>0</span><small>km/h</small></div>' +
      '<div class="arten">' + Object.keys(ARTEN).map(function (a) { return '<button type="button" data-art="' + a + '" aria-pressed="' + (D.art === a) + '">' + ARTEN[a] + "</button>"; }).join("") + "</div>" +
      '<button class="los" type="button" id="los">▶ Fahrt starten</button>' +
      '<p class="warn">⚠️ Schau während der Fahrt nicht aufs Handy. Benutz eine Halterung, trag einen Helm und halte dich an die Verkehrsregeln.</p></div>' +
      (D.fahrten.length ? '<div class="kacheln"><div class="card kachel"><small>Fahrten</small><b>' + D.fahrten.length + '</b></div><div class="card kachel"><small>Gesamt</small><b>' + km(summe) + ' km</b></div><div class="card kachel"><small>Schnellste</small><b>' + kmh(Math.max.apply(null, D.fahrten.map(function (x) { return x.max; }))) + " km/h</b></div></div>" +
        '<h2 class="sec">Deine Fahrten</h2><div class="liste">' + D.fahrten.slice().reverse().map(function (x) { return '<button class="eintrag" type="button" data-f="' + x.id + '"><span class="i">' + (ARTEN[x.art] || "🚴").split(" ")[0] + '</span><span class="mitte"><b>' + km(x.m) + " km · " + zeit(x.s) + "</b><small>" + new Date(x.start).toLocaleString("de-DE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + '</small></span><span class="rechts">⌀ ' + kmh(x.s ? x.m / x.s : 0) + " km/h</span></button>"; }).join("") + "</div>" : "");
    $("los").onclick = losfahren;
  }

  /* ---------- Fahren ---------- */
  function losfahren() {
    if (!navigator.geolocation) { KW.toast("Dein Gerät kann keinen Standort bestimmen."); return; }
    f = { id: KW.id(), art: D.art, start: Date.now(), m: 0, s: 0, max: 0, punkte: [], pause: false, letzt: null, v: 0, aktivSeit: Date.now() };
    fahrAnsicht();
    beob = navigator.geolocation.watchPosition(position, function (e) { $("gps").textContent = e.code === 1 ? "📍 Bitte erlaube den Standort, sonst geht der Tacho nicht." : "📡 Suche GPS …"; }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    uhr = setInterval(tick, 1000);
    wachHalten();
  }
  function position(p) {
    if (!f || f.pause) return;
    var c = p.coords, pkt = [c.latitude, c.longitude], jetzt = p.timestamp || Date.now();
    $("gps").textContent = c.accuracy <= 25 ? "📡 GPS gut (±" + Math.round(c.accuracy) + " m)" : "📡 GPS ungenau (±" + Math.round(c.accuracy) + " m)";
    if (c.accuracy > 40) return; // zu ungenau – lieber weglassen
    if (f.letzt) {
      var d = abstand(f.letzt.p, pkt), dt = (jetzt - f.letzt.t) / 1000;
      if (dt <= 0) return;
      var v = typeof c.speed === "number" && c.speed >= 0 ? c.speed : d / dt;
      if (v > 33) return; // über 120 km/h: Messfehler
      if (d < Math.max(2, c.accuracy * 0.3) && v < 0.8) { f.v = 0; return; } // Stillstand / Zittern
      f.m += d; f.v = v; if (v > f.max) f.max = v;
    }
    f.letzt = { p: pkt, t: jetzt };
    f.punkte.push([Math.round(pkt[0] * 1e5) / 1e5, Math.round(pkt[1] * 1e5) / 1e5]);
    if (f.punkte.length > 4000) f.punkte = f.punkte.filter(function (_, i) { return i % 2 === 0; });
    anzeigen();
  }
  function tick() { if (!f || f.pause) return; f.s++; if (f.letzt && Date.now() - f.letzt.t > 6000) f.v = 0; anzeigen(); }
  function fahrAnsicht() {
    $("ansicht").innerHTML = '<div class="fahrt"><div class="gps" id="gps">📡 Suche GPS …</div><div class="tacho"><b id="tempo">0</b><small>km/h</small></div>' +
      '<div class="werte"><div><b id="strecke">0,00</b><small>km</small></div><div><b id="dauer">0:00</b><small>Zeit</small></div><div><b id="schnitt">0,0</b><small>⌀ km/h</small></div><div><b id="spitze">0,0</b><small>max km/h</small></div></div>' +
      '<svg class="spur" id="spur" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-label="Deine Strecke"></svg>' +
      '<div class="steuer"><button class="gross-knopf pause" type="button" id="pauseK">⏸ Pause</button><button class="gross-knopf stopp" type="button" id="stoppK">⏹ Ende</button></div></div>';
    $("pauseK").onclick = function () { f.pause = !f.pause; f.letzt = null; this.textContent = f.pause ? "▶ Weiter" : "⏸ Pause"; this.classList.toggle("an", f.pause); };
    $("stoppK").onclick = beenden;
  }
  function anzeigen() {
    if (!$("tempo")) return;
    $("tempo").textContent = Math.round(f.v * 3.6); $("strecke").textContent = km(f.m); $("dauer").textContent = zeit(f.s);
    $("schnitt").textContent = kmh(f.s ? f.m / f.s : 0); $("spitze").textContent = kmh(f.max);
    spurMalen($("spur"), f.punkte);
  }
  function spurMalen(el, p) {
    if (!el || p.length < 2) return;
    var la = p.map(function (x) { return x[0]; }), lo = p.map(function (x) { return x[1]; }), k = Math.cos(la[0] * Math.PI / 180);
    var a = Math.min.apply(null, la), b = Math.max.apply(null, la), c = Math.min.apply(null, lo), d = Math.max.apply(null, lo);
    var w = Math.max((d - c) * k, b - a, 1e-5);
    var pts = p.map(function (x) { return (5 + ((x[1] - c) * k + (w - (d - c) * k) / 2) / w * 90).toFixed(2) + "," + (95 - ((x[0] - a) + (w - (b - a)) / 2) / w * 90).toFixed(2); });
    el.innerHTML = '<polyline points="' + pts.join(" ") + '" fill="none" stroke="#ff8a3c" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="' + pts[0].split(",")[0] + '" cy="' + pts[0].split(",")[1] + '" r="2.4" fill="#22c55e"/><circle cx="' + pts[pts.length - 1].split(",")[0] + '" cy="' + pts[pts.length - 1].split(",")[1] + '" r="2.8" fill="#fff" stroke="#ff8a3c" stroke-width="1.2"/>';
  }
  function beenden() {
    if (beob !== null) navigator.geolocation.clearWatch(beob); clearInterval(uhr); beob = null;
    if (sperre) { try { sperre.release(); } catch (e) { /* egal */ } sperre = null; }
    if (f.m < 30) { KW.toast("Fahrt war zu kurz – nicht gespeichert."); f = null; start(); return; }
    var x = { id: f.id, art: f.art, start: f.start, m: Math.round(f.m), s: f.s, max: f.max, punkte: f.punkte };
    D.fahrten.push(x); if (D.fahrten.length > 200) D.fahrten.shift(); speichern(); f = null;
    zeigeFahrt(x.id); KW.toast("Fahrt gespeichert 🏁");
  }
  function wachHalten() { if ("wakeLock" in navigator) navigator.wakeLock.request("screen").then(function (s) { sperre = s; }).catch(function () {}); }
  document.addEventListener("visibilitychange", function () { if (!document.hidden && f) wachHalten(); });

  function zeigeFahrt(id) {
    var x = D.fahrten.filter(function (y) { return y.id === id; })[0]; if (!x) return start();
    $("ansicht").innerHTML = '<button class="btn small" type="button" id="zur">← Zurück</button><div class="card fahrtkarte"><h2>' + (ARTEN[x.art] || "") + "</h2><p class=\"muted\">" + new Date(x.start).toLocaleString("de-DE") + '</p><svg class="spur gross" id="spur" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"></svg>' +
      '<div class="werte hell"><div><b>' + km(x.m) + '</b><small>km</small></div><div><b>' + zeit(x.s) + '</b><small>Zeit</small></div><div><b>' + kmh(x.s ? x.m / x.s : 0) + '</b><small>⌀ km/h</small></div><div><b>' + kmh(x.max) + '</b><small>max km/h</small></div></div></div>' +
      '<div class="row" style="margin-top:12px"><button class="btn" type="button" id="gpx">⬇️ Als GPX speichern</button><button class="btn danger" type="button" id="weg">🗑️ Löschen</button></div>';
    spurMalen($("spur"), x.punkte);
    $("zur").onclick = start;
    $("weg").onclick = function () { if (!confirm("Diese Fahrt löschen?")) return; D.fahrten = D.fahrten.filter(function (y) { return y.id !== id; }); speichern(); start(); };
    $("gpx").onclick = function () {
      var g = '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="FLARESSA Ride" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>' + esc(ARTEN[x.art] || "Fahrt") + "</name><trkseg>" + x.punkte.map(function (p) { return '<trkpt lat="' + p[0] + '" lon="' + p[1] + '"/>'; }).join("") + "</trkseg></trk></gpx>";
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([g], { type: "application/gpx+xml" })); a.download = "Fahrt-" + new Date(x.start).toISOString().slice(0, 10) + ".gpx"; document.body.appendChild(a); a.click(); a.remove();
    };
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-art]"); if (a && !f) { D.art = a.dataset.art; speichern(); start(); return; }
    var x = e.target.closest("[data-f]"); if (x && !f) zeigeFahrt(x.dataset.f);
  });
  window.addEventListener("beforeunload", function (e) { if (f) { e.preventDefault(); e.returnValue = ""; } });
  KW.footer("ride", function () { return D; }, function (d) { if (d && Array.isArray(d.fahrten)) { D = d; speichern(); start(); } });
  start();
})();
