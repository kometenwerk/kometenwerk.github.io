// FLARESSA Fotobox – Tablet oder Laptop wird zur Fotobox. Fotos bleiben in IndexedDB auf dem Gerät.
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var esc = KW.esc, app = $("#app"), KEY = "kw-fotobox";
  var F = Object.assign({ text: "Unsere Feier", datum: true, farbe: "#be185d", modus: "einzel", countdown: 3, kamera: "user", spiegeln: true, zurueckSek: 8, pin: "" }, KW.load(KEY, {}));
  var sichern = function () { KW.save(KEY, F); };

  /* ---------- Speicher ---------- */
  var dbP = null;
  function db() { return dbP || (dbP = new Promise(function (ok, nein) { var r = indexedDB.open("kw-fotobox", 1); r.onupgradeneeded = function () { r.result.createObjectStore("fotos", { keyPath: "id" }); }; r.onsuccess = function () { ok(r.result); }; r.onerror = function () { nein(r.error); }; })); }
  function tx(modus, fn) { return db().then(function (d) { return new Promise(function (ok) { var t = d.transaction("fotos", modus), st = t.objectStore("fotos"), r = fn(st); t.oncomplete = function () { ok(r && r.result); }; t.onerror = function () { ok(null); }; }); }); }
  var alle = function () { return tx("readonly", function (s) { return s.getAll(); }).then(function (l) { return (l || []).sort(function (a, b) { return b.zeit - a.zeit; }); }); };
  var lege = function (f) { return tx("readwrite", function (s) { return s.put(f); }); };
  var weg = function (id) { return tx("readwrite", function (s) { return s.delete(id); }); };
  var leeren = function () { return tx("readwrite", function (s) { return s.clear(); }); };

  /* ---------- Rahmen ---------- */
  function datumText() { return new Date().toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" }); }
  function rahmen(bilder) { // bilder: Canvas-Liste → fertiges Bild mit Rahmen und Text
    var w = bilder[0].width, h = bilder[0].height, rand = Math.round(w * 0.04), unten = Math.round((bilder.length === 1 ? w : 2 * w) * 0.12), c = document.createElement("canvas"), x;
    if (bilder.length === 1) { c.width = w + 2 * rand; c.height = h + rand + unten; }
    else { c.width = 2 * w + 3 * rand; c.height = 2 * h + 2 * rand + unten; }
    x = c.getContext("2d");
    x.fillStyle = F.farbe; x.fillRect(0, 0, c.width, c.height);
    bilder.forEach(function (b, i) { var sx = bilder.length === 1 ? rand : rand + (i % 2) * (w + rand), sy = bilder.length === 1 ? rand : rand + Math.floor(i / 2) * (h + rand); x.drawImage(b, sx, sy); });
    var grund = c.height - unten, fs = Math.round(unten * 0.36);
    x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle";
    x.font = "600 " + fs + "px 'Space Grotesk', system-ui, sans-serif";
    x.fillText(F.text || "", c.width / 2, grund + unten * (F.datum ? 0.38 : 0.5), c.width - 2 * rand);
    if (F.datum) { x.font = "400 " + Math.round(fs * 0.55) + "px 'Space Grotesk', system-ui, sans-serif"; x.globalAlpha = 0.85; x.fillText(datumText(), c.width / 2, grund + unten * 0.74); x.globalAlpha = 1; }
    return c.toDataURL("image/jpeg", 0.9);
  }
  function testBild(farbe) { var c = document.createElement("canvas"); c.width = 640; c.height = 480; var x = c.getContext("2d"); var g = x.createLinearGradient(0, 0, 640, 480); g.addColorStop(0, farbe); g.addColorStop(1, "#1f2937"); x.fillStyle = g; x.fillRect(0, 0, 640, 480); x.font = "120px sans-serif"; x.textAlign = "center"; x.fillText("😄", 320, 280); return c; }

  /* ---------- Einrichten ---------- */
  function einrichten() {
    stopKamera(); document.body.classList.remove("box");
    app.innerHTML = '<div class="f-hinweis">Tablet oder Laptop auf einen Ständer stellen, „Fotobox starten“ – die Gäste tippen auf den großen Knopf, ein Countdown läuft, und das Foto landet in der Galerie. <b>Alles bleibt auf diesem Gerät.</b> Sag den Gästen, dass fotografiert wird, und gib Fotos nur weiter, wenn alle einverstanden sind.</div>' +
      '<div class="card" style="padding:14px"><div class="field"><label for="fText">Text im Rahmen</label><input class="inp" id="fText" value="' + esc(F.text) + '" placeholder="z. B. Hochzeit Anna & Ben"></div>' +
      '<label class="row" style="gap:8px;margin:6px 0"><input type="checkbox" id="fDatum"' + (F.datum ? " checked" : "") + '> Datum zeigen</label>' +
      '<div class="row" style="gap:10px;align-items:center;margin:8px 0"><label for="fFarbe">Rahmenfarbe</label><input type="color" id="fFarbe" value="' + esc(F.farbe) + '"></div>' +
      '<div class="field"><label for="fModus">Art</label><select class="inp" id="fModus"><option value="einzel"' + (F.modus === "einzel" ? " selected" : "") + '>Ein Foto</option><option value="vier"' + (F.modus === "vier" ? " selected" : "") + ">Vier Fotos hintereinander (Collage)</option></select></div>" +
      '<div class="field"><label for="fCount">Countdown</label><select class="inp" id="fCount">' + [3, 5, 10].map(function (n) { return '<option value="' + n + '"' + (F.countdown === n ? " selected" : "") + ">" + n + " Sekunden</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label for="fKam">Kamera</label><select class="inp" id="fKam"><option value="user"' + (F.kamera === "user" ? " selected" : "") + '>Vorne (Selfie)</option><option value="environment"' + (F.kamera === "environment" ? " selected" : "") + ">Hinten</option></select></div>" +
      '<label class="row" style="gap:8px;margin:6px 0"><input type="checkbox" id="fSpiegel"' + (F.spiegeln ? " checked" : "") + '> Bei der Selfie-Kamera spiegeln (wie ein Spiegel – so erwarten es die meisten)</label>' +
      '<div class="field"><label for="fPin">PIN zum Beenden (optional, damit Gäste nicht in die Galerie kommen)</label><input class="inp" id="fPin" inputmode="numeric" value="' + esc(F.pin) + '"></div>' +
      '<div class="f-vorschau-rahmen"><p class="muted">So sieht der Rahmen aus:</p><img id="rahmenBild" alt="Vorschau des Rahmens" style="width:100%;border-radius:8px"></div>' +
      '<div class="row" style="gap:8px;margin:16px 0"><button type="button" class="btn primary" id="start">📸 Fotobox starten</button></div></div>' +
      '<h2>Galerie <span class="muted" id="anz"></span></h2><div class="row" style="gap:8px;margin-bottom:10px;flex-wrap:wrap"><button type="button" class="btn" id="zip">⬇ Alle als ZIP</button><button type="button" class="btn" id="allesWeg">Alle löschen</button></div><div class="f-galerie" id="gal"></div>';
    var bind = function (id, k, fn) { $(id).oninput = $(id).onchange = function () { F[k] = fn ? fn(this) : this.value; sichern(); vorschau(); }; };
    bind("#fText", "text"); bind("#fDatum", "datum", function (e) { return e.checked; }); bind("#fFarbe", "farbe"); bind("#fModus", "modus");
    bind("#fCount", "countdown", function (e) { return +e.value; }); bind("#fKam", "kamera"); bind("#fSpiegel", "spiegeln", function (e) { return e.checked; }); bind("#fPin", "pin", function (e) { return e.value.replace(/\D/g, ""); });
    $("#start").onclick = box;
    $("#zip").onclick = zip;
    $("#allesWeg").onclick = function () { if (confirm("Wirklich ALLE Fotos löschen? Das geht nicht rückgängig.")) leeren().then(galerie); };
    vorschau(); galerie();
  }
  function vorschau() { var t = testBild(F.farbe); $("#rahmenBild").src = rahmen(F.modus === "vier" ? [t, t, t, t] : [t]); }
  function galerie() {
    alle().then(function (l) {
      $("#anz").textContent = "(" + l.length + ")";
      $("#gal").innerHTML = l.length ? l.map(function (f) { return '<figure><img src="' + f.bild + '" alt="Foto vom ' + esc(new Date(f.zeit).toLocaleString("de-DE")) + '" loading="lazy"><button type="button" data-weg="' + f.id + '" aria-label="Foto löschen">×</button><a href="' + f.bild + '" download="fotobox-' + f.id + '.jpg">⬇</a></figure>'; }).join("") : '<p class="muted">Noch keine Fotos.</p>';
      $("#gal").querySelectorAll("[data-weg]").forEach(function (b) { b.onclick = function () { if (confirm("Foto löschen?")) weg(b.dataset.weg).then(galerie); }; });
    });
  }
  function zip() {
    alle().then(function (l) {
      if (!l.length) return KW.toast("Keine Fotos.");
      KW.toast("ZIP wird gepackt …");
      return import("../shared/vendor/fflate-0.8.3/fflate.mjs").then(function (ff) {
        var dateien = {};
        l.forEach(function (f, i) { var b = atob(f.bild.split(",")[1]), u = new Uint8Array(b.length); for (var k = 0; k < b.length; k++) u[k] = b.charCodeAt(k); dateien["foto-" + String(l.length - i).padStart(3, "0") + ".jpg"] = [u, { level: 0 }]; });
        var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([ff.zipSync(dateien)], { type: "application/zip" })); a.download = "fotobox-" + KW.today() + ".zip"; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      });
    });
  }

  /* ---------- Fotobox-Modus ---------- */
  var strom = null, laeuft = false, zurueckT = null;
  function stopKamera() { if (strom) { strom.getTracks().forEach(function (t) { t.stop(); }); strom = null; } }
  function box() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return KW.toast("Dieses Gerät kann die Kamera hier nicht benutzen.");
    navigator.mediaDevices.getUserMedia({ video: { facingMode: F.kamera, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }).then(function (s) {
      strom = s; document.body.classList.add("box");
      if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
      app.innerHTML = '<div class="b-box" id="box"><video id="vid" autoplay playsinline muted class="' + (F.spiegeln && F.kamera === "user" ? "spiegel" : "") + '"></video>' + (F.text ? '<div class="b-titel">' + esc(F.text) + "</div>" : "") + '<button type="button" class="b-los" id="los">📸 Foto machen!</button><button type="button" class="b-ecke" id="ende">✕</button></div>';
      $("#vid").srcObject = s;
      $("#los").onclick = ausloesen;
      $("#ende").onclick = function () { if (F.pin) { var p = prompt("PIN zum Beenden:"); if (p !== F.pin) return; } if (document.fullscreenElement) document.exitFullscreen().catch(function () {}); einrichten(); };
    }).catch(function () { KW.toast("Kein Zugriff auf die Kamera. Bitte in den Browser-Einstellungen erlauben."); });
  }
  function warte(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  function zaehlen(n) {
    var box = $("#box"), z = document.createElement("div"); z.className = "b-zahl"; box.appendChild(z);
    var schritt = function (i) { if (i === 0) { z.remove(); return Promise.resolve(); } z.textContent = i; z.style.animation = "none"; void z.offsetWidth; z.style.animation = ""; return warte(1000).then(function () { return schritt(i - 1); }); };
    return schritt(n);
  }
  function knips() {
    var v = $("#vid"), c = document.createElement("canvas"), w = v.videoWidth || 1280, h = v.videoHeight || 720, max = 1600, s = Math.min(1, max / Math.max(w, h));
    c.width = Math.round(w * s); c.height = Math.round(h * s);
    var x = c.getContext("2d");
    if (F.kamera === "user" && F.spiegeln) { x.translate(c.width, 0); x.scale(-1, 1); } // Selfie wie im Spiegel speichern – so erwarten es die Leute
    x.drawImage(v, 0, 0, c.width, c.height);
    var b = document.createElement("div"); b.className = "b-blitz"; $("#box").appendChild(b); setTimeout(function () { b.remove(); }, 500);
    return c;
  }
  function ausloesen() {
    if (laeuft) return; laeuft = true; clearTimeout(zurueckT);
    $("#los").hidden = true;
    var anzahl = F.modus === "vier" ? 4 : 1, bilder = [];
    var eins = function (i) {
      if (i >= anzahl) return Promise.resolve();
      var info = null;
      if (anzahl > 1) { info = document.createElement("div"); info.className = "b-schritt"; info.textContent = "Foto " + (i + 1) + " von 4"; $("#box").appendChild(info); }
      return zaehlen(i === 0 ? F.countdown : 3).then(function () { bilder.push(knips()); if (info) info.remove(); return warte(600); }).then(function () { return eins(i + 1); });
    };
    eins(0).then(function () {
      var fertig = rahmen(bilder), id = KW.id();
      return lege({ id: id, bild: fertig, zeit: Date.now() }).then(function () {
        var e = document.createElement("div"); e.className = "b-ergebnis";
        e.innerHTML = '<img src="' + fertig + '" alt="Dein Foto"><div class="k"><button type="button" id="nochmal" style="background:var(--app);color:#fff">📸 Noch eins!</button><button type="button" id="ok">✔ Super</button></div><p style="opacity:.7;margin:0">Gespeichert. Gleich geht es weiter …</p>';
        $("#box").appendChild(e);
        var zurueck = function () { e.remove(); $("#los").hidden = false; laeuft = false; };
        $("#ok").onclick = function () { clearTimeout(zurueckT); zurueck(); };
        $("#nochmal").onclick = function () { clearTimeout(zurueckT); zurueck(); ausloesen(); };
        zurueckT = setTimeout(zurueck, F.zurueckSek * 1000);
      });
    }).catch(function () { laeuft = false; $("#los").hidden = false; });
  }
  document.addEventListener("keydown", function (e) { if (document.body.classList.contains("box") && (e.key === " " || e.key === "Enter") && !laeuft) { e.preventDefault(); ausloesen(); } });

  einrichten();
  KW.footer("fotobox", function () { return F; }, function (d) { F = Object.assign(F, d); sichern(); einrichten(); });
})();
