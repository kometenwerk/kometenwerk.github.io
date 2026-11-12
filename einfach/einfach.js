// FIDELIA Einfach – große, ruhige Oberfläche fürs Tablet von Oma und Opa.
// Die Familie richtet alles ein (mit PIN geschützt). Alles bleibt auf dem Gerät; nur das Wetter fragt open-meteo.com.
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var esc = KW.esc;
  var KEY = "kw-einfach";
  var E = Object.assign({ fertig: false, name: "", pin: "", ort: null, kontakte: [], links: [{ name: "Nachrichten in einfacher Sprache", url: "https://www.nachrichtenleicht.de/" }, { name: "tagesschau", url: "https://www.tagesschau.de/" }], erinnerungen: [], gross: false, kontrast: false, vorlesen: true, kacheln: { familie: true, fotos: true, wetter: true, nachrichten: true, erinnerungen: true, hilfe: true } }, KW.load(KEY, {}));
  var sichern = function () { KW.save(KEY, E); };
  var app = $("#app");

  /* ---------- Fotos in IndexedDB (zu groß für localStorage) ---------- */
  var dbP = null;
  function db() {
    if (dbP) return dbP;
    dbP = new Promise(function (ok, nein) { var r = indexedDB.open("kw-einfach", 1); r.onupgradeneeded = function () { r.result.createObjectStore("fotos", { keyPath: "id" }); }; r.onsuccess = function () { ok(r.result); }; r.onerror = function () { nein(r.error); }; });
    return dbP;
  }
  function fotosAlle() { return db().then(function (d) { return new Promise(function (ok) { var r = d.transaction("fotos").objectStore("fotos").getAll(); r.onsuccess = function () { ok((r.result || []).sort(function (a, b) { return a.zeit - b.zeit; })); }; r.onerror = function () { ok([]); }; }); }).catch(function () { return []; }); }
  function fotoLege(f) { return db().then(function (d) { return new Promise(function (ok) { var t = d.transaction("fotos", "readwrite"); t.objectStore("fotos").put(f); t.oncomplete = ok; t.onerror = ok; }); }); }
  function fotoWeg(id) { return db().then(function (d) { return new Promise(function (ok) { var t = d.transaction("fotos", "readwrite"); t.objectStore("fotos").delete(id); t.oncomplete = ok; t.onerror = ok; }); }); }
  function verkleinern(datei, max) {
    return new Promise(function (ok, nein) {
      var url = URL.createObjectURL(datei), i = new Image();
      i.onload = function () { var s = Math.min(1, max / Math.max(i.width, i.height)), c = document.createElement("canvas"); c.width = Math.round(i.width * s); c.height = Math.round(i.height * s); c.getContext("2d").drawImage(i, 0, 0, c.width, c.height); URL.revokeObjectURL(url); ok(c.toDataURL("image/jpeg", 0.85)); };
      i.onerror = function () { URL.revokeObjectURL(url); nein(); };
      i.src = url;
    });
  }

  /* ---------- Vorlesen ---------- */
  function sag(text) { if (!E.vorlesen || !window.speechSynthesis) return; try { speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(text); u.lang = "de-DE"; u.rate = 0.9; speechSynthesis.speak(u); } catch (e) {} }

  /* ---------- Aussehen ---------- */
  function aussehen() {
    document.body.classList.toggle("e-modus", !!E.fertig);
    document.body.classList.toggle("e-sehr-gross", !!E.gross);
    document.body.classList.toggle("e-kontrast", !!E.kontrast);
  }
  var TAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  function uhrText() { var d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
  function datumText() { var d = new Date(); return TAGE[d.getDay()] + ", " + d.getDate() + ". " + d.toLocaleDateString("de-DE", { month: "long" }) + " " + d.getFullYear(); }
  function tageszeit() { var h = new Date().getHours(); return h < 11 ? "Guten Morgen" : h < 18 ? "Guten Tag" : "Guten Abend"; }

  /* ---------- Startseite ---------- */
  var KACHELN = [["familie", "📞", "Familie"], ["fotos", "🖼️", "Fotos"], ["wetter", "☀️", "Wetter"], ["nachrichten", "📰", "Nachrichten"], ["erinnerungen", "⏰", "Erinnerungen"], ["hilfe", "🆘", "Hilfe", "rot"]];
  function start() {
    var heute = heutigeErinnerungen();
    app.innerHTML = '<div class="e-kopf"><div><div class="e-uhr" id="uhr">' + uhrText() + '</div><div class="e-datum" id="datum">' + esc(datumText()) + '</div></div><div class="e-hallo">' + esc(tageszeit()) + (E.name ? ",<br>" + esc(E.name) : "") + "</div></div>" +
      (heute.length ? '<div class="e-heute">' + heute.map(function (r) { return '<div class="e-hinweis">⏰ ' + esc(r.zeit) + " Uhr – " + esc(r.text) + "</div>"; }).join("") + "</div>" : "") +
      '<div class="e-kacheln">' + KACHELN.filter(function (k) { return E.kacheln[k[0]] !== false; }).map(function (k) { return '<button type="button" class="e-kachel ' + (k[3] || "") + '" data-k="' + k[0] + '"><span class="i" aria-hidden="true">' + k[1] + "</span>" + k[2] + "</button>"; }).join("") + "</div>" +
      '<button type="button" class="e-einr" id="einr" title="Einrichten (für die Familie)">⚙ Einrichten</button>';
    app.querySelectorAll("[data-k]").forEach(function (b) { b.onclick = function () { SEITEN[b.dataset.k](); }; });
    halten($("#einr"), einrichtenFragen);
  }
  function zurueck() { return '<button type="button" class="e-zurueck" id="zur">← Zurück</button>'; }
  function zurueckBinden() { $("#zur").onclick = start; $("#zur").focus(); }

  /* ---------- Familie ---------- */
  function familie() {
    sag("Familie");
    app.innerHTML = zurueck() + '<h2 class="e-titel">📞 Familie</h2>' + (E.kontakte.length ? E.kontakte.map(function (k, i) {
      return '<div class="e-karte">' + (k.foto ? '<img class="e-foto" src="' + k.foto + '" alt="">' : '<div class="e-foto" aria-hidden="true">🙂</div>') + '<div class="e-name">' + esc(k.name) + '</div><div class="e-knoepfe">' +
        (k.tel ? '<a class="e-k" href="tel:' + esc(k.tel.replace(/[^\d+]/g, "")) + '" data-sag="' + esc(k.name) + ' anrufen">📞 Anrufen</a>' : "") +
        (k.video ? '<a class="e-k" href="' + esc(k.video) + '" target="_blank" rel="noopener" data-sag="Videoanruf mit ' + esc(k.name) + '">🎥 Video</a>' : "") +
        (k.tel && k.whatsapp ? '<a class="e-k hell" href="https://wa.me/' + esc(k.tel.replace(/\D/g, "").replace(/^0/, "49")) + '" target="_blank" rel="noopener">💬 Nachricht</a>' : "") + "</div></div>";
    }).join("") : '<p class="e-leise">Noch niemand eingetragen. Die Familie kann das unter „Einrichten“ machen.</p>');
    zurueckBinden();
    app.querySelectorAll("[data-sag]").forEach(function (a) { a.addEventListener("click", function () { sag(a.dataset.sag); }); });
  }

  /* ---------- Fotos ---------- */
  function fotos() {
    sag("Fotos");
    fotosAlle().then(function (l) {
      app.innerHTML = zurueck() + '<h2 class="e-titel">🖼️ Fotos</h2>' + (l.length ? '<button type="button" class="e-k" id="schau" style="margin:0 4px 16px">▶ Alle Fotos nacheinander zeigen</button><div class="e-fotos">' + l.map(function (f, i) { return '<button type="button" data-i="' + i + '" aria-label="' + esc(f.text || "Foto " + (i + 1)) + '"><img src="' + f.bild + '" alt=""></button>'; }).join("") + "</div>" : '<p class="e-leise">Noch keine Fotos. Die Familie kann unter „Einrichten“ welche hinzufügen.</p>');
      zurueckBinden();
      var s = $("#schau"); if (s) s.onclick = function () { schau(l, 0, true); };
      app.querySelectorAll("[data-i]").forEach(function (b) { b.onclick = function () { schau(l, +b.dataset.i, false); }; });
    });
  }
  function schau(l, i, auto) {
    var d = $("#voll"), timer = null;
    function zeig() {
      var f = l[i];
      $("#vollIn").innerHTML = '<div class="e-schau"><img src="' + f.bild + '" alt=""><button type="button" class="pf l" aria-label="Voriges Foto">‹</button><button type="button" class="pf r" aria-label="Nächstes Foto">›</button><button type="button" class="zu">✕ Schließen</button>' + (f.text ? '<div class="unter">' + esc(f.text) + "</div>" : "") + "</div>";
      $("#vollIn .l").onclick = function () { i = (i - 1 + l.length) % l.length; neu(); };
      $("#vollIn .r").onclick = function () { i = (i + 1) % l.length; neu(); };
      $("#vollIn .zu").onclick = function () { clearInterval(timer); d.close(); };
    }
    function neu() { zeig(); if (auto) { clearInterval(timer); timer = setInterval(function () { i = (i + 1) % l.length; zeig(); }, 8000); } }
    d.onclose = function () { clearInterval(timer); };
    neu(); d.showModal();
  }

  /* ---------- Wetter (open-meteo.com, ohne Konto) ---------- */
  var WMO = function (c) { return c === 0 ? ["☀️", "Sonnig"] : c <= 2 ? ["🌤️", "Leicht bewölkt"] : c === 3 ? ["☁️", "Bewölkt"] : c <= 48 ? ["🌫️", "Nebel"] : c <= 57 ? ["🌦️", "Nieselregen"] : c <= 67 ? ["🌧️", "Regen"] : c <= 77 ? ["❄️", "Schnee"] : c <= 82 ? ["🌧️", "Regenschauer"] : c <= 86 ? ["🌨️", "Schneeschauer"] : ["⛈️", "Gewitter"]; };
  function wetter() {
    sag("Wetter");
    app.innerHTML = zurueck() + '<h2 class="e-titel">☀️ Wetter' + (E.ort ? " in " + esc(E.ort.name) : "") + '</h2><div id="w" class="e-leise">Lädt …</div>';
    zurueckBinden();
    if (!E.ort) { $("#w").textContent = "Der Ort ist noch nicht eingestellt. Die Familie kann das unter „Einrichten“ machen."; return; }
    fetch("https://api.open-meteo.com/v1/forecast?latitude=" + E.ort.lat + "&longitude=" + E.ort.lon + "&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=4")
      .then(function (r) { return r.json(); }).then(function (j) {
        var c = j.current, w = WMO(c.weather_code), t = Math.round(c.temperature_2m), d = j.daily, regen = d.precipitation_probability_max[0];
        var tipp = t <= 3 ? "Warm anziehen – es ist kalt. Vorsicht, glatt!" : t <= 12 ? "Eine Jacke mitnehmen." : t >= 28 ? "Heiß! Viel trinken und im Schatten bleiben." : "Angenehmes Wetter.";
        if (regen >= 50) tipp += " Regenschirm mitnehmen!";
        $("#w").className = "";
        $("#w").innerHTML = '<div class="e-karte e-wetter"><span class="gross" aria-hidden="true">' + w[0] + '</span><div><div class="temp">' + t + ' °C</div><div>' + w[1] + '</div></div></div><div class="e-hinweis">' + esc(tipp) + '</div><div class="e-tage">' +
          [1, 2, 3].map(function (k) { var x = WMO(d.weather_code[k]), tag = TAGE[new Date(d.time[k] + "T12:00").getDay()]; return '<div class="e-tag"><b>' + (k === 1 ? "Morgen" : tag) + '</b><div class="i" aria-hidden="true">' + x[0] + "</div>" + Math.round(d.temperature_2m_min[k]) + "° bis " + Math.round(d.temperature_2m_max[k]) + "°</div>"; }).join("") + "</div>";
        sag("Heute " + w[1] + ", " + t + " Grad. " + tipp);
      }).catch(function () { $("#w").textContent = "Gerade kein Internet – das Wetter kann nicht geladen werden."; });
  }

  /* ---------- Nachrichten ---------- */
  function nachrichten() {
    sag("Nachrichten");
    app.innerHTML = zurueck() + '<h2 class="e-titel">📰 Nachrichten</h2>' + E.links.map(function (l) { return '<div class="e-karte"><div class="e-name">' + esc(l.name) + '</div><a class="e-k" href="' + esc(l.url) + '" target="_blank" rel="noopener">Öffnen</a></div>'; }).join("");
    zurueckBinden();
  }

  /* ---------- Erinnerungen ---------- */
  function heutigeErinnerungen() { var t = new Date().getDay(); return E.erinnerungen.filter(function (r) { return !r.tage || !r.tage.length || r.tage.indexOf(t) >= 0; }).sort(function (a, b) { return a.zeit.localeCompare(b.zeit); }); }
  function erinnerungen() {
    sag("Erinnerungen");
    var l = heutigeErinnerungen();
    app.innerHTML = zurueck() + '<h2 class="e-titel">⏰ Heute</h2>' + (l.length ? l.map(function (r) { var erl = r.erledigt === KW.today(); return '<div class="e-karte"><div class="e-name">' + esc(r.zeit) + " Uhr – " + esc(r.text) + "</div>" + (erl ? '<span class="e-k hell">✔ Erledigt</span>' : "") + "</div>"; }).join("") : '<p class="e-leise">Heute steht nichts an.</p>');
    zurueckBinden();
  }
  var gezeigt = {};
  function erinnerungPruefen() {
    var jetzt = uhrText(), heute = KW.today();
    heutigeErinnerungen().forEach(function (r) {
      var schl = heute + r.id;
      if (r.zeit === jetzt && !gezeigt[schl] && r.erledigt !== heute) {
        gezeigt[schl] = true;
        var d = $("#voll");
        $("#vollIn").innerHTML = '<div class="e-erinnern" role="alert"><div class="i" aria-hidden="true">⏰</div><h2>' + esc(r.text) + "</h2><p>" + esc(r.zeit) + ' Uhr</p><button type="button" id="erl">✔ Erledigt</button></div>';
        if (!d.open) d.showModal();
        sag("Erinnerung: " + r.text);
        try { var a = new AudioContext(), o = a.createOscillator(), g = a.createGain(); o.frequency.value = 660; o.connect(g); g.connect(a.destination); g.gain.value = 0.2; o.start(); o.stop(a.currentTime + 0.6); } catch (e) {}
        $("#erl").onclick = function () { r.erledigt = heute; sichern(); d.close(); start(); };
      }
    });
  }

  /* ---------- Hilfe ---------- */
  function hilfe() {
    sag("Hilfe");
    var k = E.kontakte[0];
    app.innerHTML = zurueck() + '<h2 class="e-titel">🆘 Hilfe</h2>' +
      (k && k.tel ? '<div class="e-karte"><div class="e-name">' + esc(k.name) + ' anrufen</div><a class="e-k" href="tel:' + esc(k.tel.replace(/[^\d+]/g, "")) + '">📞 Anrufen</a></div>' : "") +
      '<div class="e-karte"><div class="e-name">Notruf<br><span class="e-leise">Feuerwehr und Rettungsdienst</span></div><button type="button" class="e-k rot" id="n112">📞 112</button></div>' +
      '<div class="e-karte"><div class="e-name">Ärztlicher Bereitschaftsdienst<br><span class="e-leise">wenn die Praxis zu hat</span></div><a class="e-k hell" href="tel:116117">📞 116 117</a></div>';
    zurueckBinden();
    $("#n112").onclick = function () {
      $("#vollIn").innerHTML = '<div class="e-erinnern" style="background:#b42318"><h2>Wirklich den Notruf 112 anrufen?</h2><div class="e-knoepfe" style="justify-content:center"><a class="e-k" style="background:#fff;color:#b42318;font-size:40px;padding:22px 44px" href="tel:112">Ja, 112 anrufen</a><button type="button" id="nein">Nein</button></div></div>';
      $("#voll").showModal(); sag("Wirklich den Notruf eins eins zwei anrufen?");
      $("#nein").onclick = function () { $("#voll").close(); };
    };
  }
  var SEITEN = { familie: familie, fotos: fotos, wetter: wetter, nachrichten: nachrichten, erinnerungen: erinnerungen, hilfe: hilfe };

  /* ---------- Einrichten (für die Familie) ---------- */
  function halten(el, f) { // 2 Sekunden gedrückt halten → damit Oma nicht aus Versehen hineinkommt
    var t = null;
    el.addEventListener("pointerdown", function () { t = setTimeout(f, 1500); el.textContent = "… halten"; });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { el.addEventListener(ev, function () { clearTimeout(t); el.textContent = "⚙ Einrichten"; }); });
    el.addEventListener("keydown", function (e) { if (e.key === "Enter") f(); });
  }
  function einrichtenFragen() {
    if (!E.pin) { einrichten(); return; }
    var p = prompt("PIN zum Einrichten:");
    if (p === null) return;
    if (p === E.pin) einrichten(); else KW.toast("Falsche PIN.");
  }
  function einrichten() {
    document.body.classList.remove("e-modus");
    var tage = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    app.innerHTML = '<div class="e-setup">' +
      '<div class="card" style="padding:16px"><h2 style="margin-top:0">⚙ Einrichten</h2><p class="muted">Hier richtest du das Tablet für deine Oma, deinen Opa oder andere ältere Menschen ein. Danach sehen sie nur noch große Knöpfe. Zum Einrichten später unten rechts auf „⚙ Einrichten“ <b>lange drücken</b> und die PIN eingeben.</p>' +
      '<div class="feld"><label for="sName">Wie soll die Person begrüßt werden?</label><input class="inp" id="sName" value="' + esc(E.name) + '" placeholder="z. B. Oma Erika"></div>' +
      '<div class="feld"><label for="sPin">PIN zum Einrichten (4 Ziffern)</label><input class="inp" id="sPin" inputmode="numeric" maxlength="8" value="' + esc(E.pin) + '" placeholder="z. B. 2580"></div></div>' +

      '<h2>📞 Familie</h2><p class="muted">Foto, Name, Telefonnummer und optional ein Link für Videoanrufe (z. B. ein fester Raum bei meet.jit.si).</p><div id="sKont"></div><button type="button" class="btn" id="sKontNeu">+ Person</button>' +

      '<h2>🖼️ Fotos</h2><div class="mini-fotos" id="sFotos"></div><label class="btn" style="margin-top:8px">+ Fotos auswählen<input type="file" id="sFotoDatei" accept="image/*" multiple hidden></label>' +

      '<h2>☀️ Ort fürs Wetter</h2><div class="zeile"><input class="inp" id="sOrt" value="' + esc(E.ort ? E.ort.name : "") + '" placeholder="z. B. Lindau"><button type="button" class="btn" id="sOrtSuch">Suchen</button><span class="muted" id="sOrtInfo"></span></div>' +

      '<h2>⏰ Erinnerungen</h2><p class="muted">Erscheinen groß mit Ton, wenn die App offen ist (z. B. Tabletten, Arzttermin, Mülltonne). Bei geschlossener App kommt nichts – dafür lieber zusätzlich den Wecker vom Tablet nutzen.</p><div id="sErin"></div><button type="button" class="btn" id="sErinNeu">+ Erinnerung</button>' +

      '<h2>📰 Nachrichten-Links</h2><div id="sLinks"></div><button type="button" class="btn" id="sLinkNeu">+ Link</button>' +

      '<h2>Aussehen</h2>' + KACHELN.map(function (k) { return '<label class="check"><input type="checkbox" data-kachel="' + k[0] + '"' + (E.kacheln[k[0]] !== false ? " checked" : "") + "> Kachel „" + k[2] + "“ zeigen</label>"; }).join("") +
      '<label class="check"><input type="checkbox" id="sGross"' + (E.gross ? " checked" : "") + '> Noch größere Schrift</label><label class="check"><input type="checkbox" id="sKontrast"' + (E.kontrast ? " checked" : "") + '> Starker Kontrast (schwarz-weiß)</label><label class="check"><input type="checkbox" id="sVorlesen"' + (E.vorlesen ? " checked" : "") + "> Knöpfe und Wetter vorlesen</label>" +

      '<h2>Übertragen</h2><p class="muted">Du kannst alles auf deinem eigenen Gerät vorbereiten und dann als Datei aufs Tablet holen.</p><div class="zeile"><button type="button" class="btn" id="sExport">Einrichtung speichern</button><label class="btn">Einrichtung laden<input type="file" id="sImport" accept=".json,.einfach" hidden></label></div>' +
      '<div class="zeile" style="margin:24px 0 60px"><button type="button" class="btn primary" id="sFertig">✔ Fertig – große Ansicht starten</button></div></div>';

    kontakteZeigen(); fotosZeigen(); erinZeigen(); linksZeigen();
    $("#sName").oninput = function () { E.name = this.value.trim(); sichern(); };
    $("#sPin").oninput = function () { E.pin = this.value.replace(/\D/g, ""); sichern(); };
    $("#sKontNeu").onclick = function () { E.kontakte.push({ id: KW.id(), name: "", tel: "", video: "", whatsapp: false, foto: "" }); sichern(); kontakteZeigen(); };
    $("#sFotoDatei").onchange = function () {
      var dateien = Array.from(this.files || []); if (!dateien.length) return;
      KW.toast("Fotos werden eingefügt …");
      Promise.all(dateien.map(function (f) { return verkleinern(f, 1600).then(function (b) { return fotoLege({ id: KW.id(), bild: b, text: "", zeit: Date.now() }); }).catch(function () {}); })).then(fotosZeigen);
      this.value = "";
    };
    $("#sOrtSuch").onclick = function () {
      var q = $("#sOrt").value.trim(); if (!q) return;
      $("#sOrtInfo").textContent = "Sucht …";
      fetch("https://geocoding-api.open-meteo.com/v1/search?count=1&language=de&name=" + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (j) {
        var o = j.results && j.results[0]; if (!o) { $("#sOrtInfo").textContent = "Nicht gefunden."; return; }
        E.ort = { name: o.name, lat: o.latitude, lon: o.longitude }; sichern();
        $("#sOrtInfo").textContent = "✔ " + o.name + (o.admin1 ? ", " + o.admin1 : "");
      }).catch(function () { $("#sOrtInfo").textContent = "Kein Internet."; });
    };
    $("#sErinNeu").onclick = function () { E.erinnerungen.push({ id: KW.id(), zeit: "08:00", text: "", tage: [] }); sichern(); erinZeigen(); };
    $("#sLinkNeu").onclick = function () { E.links.push({ name: "", url: "https://" }); sichern(); linksZeigen(); };
    app.querySelectorAll("[data-kachel]").forEach(function (c) { c.onchange = function () { E.kacheln[c.dataset.kachel] = c.checked; sichern(); }; });
    $("#sGross").onchange = function () { E.gross = this.checked; sichern(); aussehen(); };
    $("#sKontrast").onchange = function () { E.kontrast = this.checked; sichern(); aussehen(); };
    $("#sVorlesen").onchange = function () { E.vorlesen = this.checked; sichern(); };
    $("#sExport").onclick = function () { fotosAlle().then(function (f) { var blob = new Blob([JSON.stringify({ art: "fidelia-einfach", einstellungen: E, fotos: f })], { type: "application/json" }), a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "einfach-" + (E.name || "einrichtung").replace(/[^\wäöüÄÖÜß-]+/g, "_") + ".json"; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000); }); };
    $("#sImport").onchange = function () {
      var f = this.files && this.files[0]; if (!f) return;
      f.text().then(function (t) {
        var j = JSON.parse(t); if (j.art !== "fidelia-einfach") throw new Error();
        if (!confirm("Die Einrichtung ersetzt alles auf diesem Tablet. Weiter?")) return;
        E = Object.assign(E, j.einstellungen); sichern();
        return Promise.all((j.fotos || []).map(fotoLege)).then(function () { KW.toast("✔ Einrichtung geladen."); einrichten(); });
      }).catch(function () { KW.toast("Das ist keine Einrichtungs-Datei."); });
    };
    $("#sFertig").onclick = function () {
      if (!E.pin || E.pin.length < 4) { KW.toast("Bitte erst eine PIN mit mindestens 4 Ziffern eintragen."); $("#sPin").focus(); return; }
      E.fertig = true; sichern(); aussehen(); start(); window.scrollTo(0, 0);
    };

    function kontakteZeigen() {
      $("#sKont").innerHTML = E.kontakte.map(function (k, i) {
        return '<div class="kont">' + (k.foto ? '<img src="' + k.foto + '" alt="">' : '<span class="ohne">🙂</span>') + '<div>' +
          '<div class="zeile"><input class="inp" data-k="name" data-i="' + i + '" value="' + esc(k.name) + '" placeholder="Name, z. B. Lena (Enkelin)"><input class="inp" data-k="tel" data-i="' + i + '" value="' + esc(k.tel) + '" placeholder="Telefon" inputmode="tel"></div>' +
          '<div class="zeile" style="margin-top:6px"><input class="inp" data-k="video" data-i="' + i + '" value="' + esc(k.video) + '" placeholder="Videoanruf-Link (optional)" style="flex:1"></div>' +
          '<div class="zeile" style="margin-top:6px"><label class="check"><input type="checkbox" data-k="whatsapp" data-i="' + i + '"' + (k.whatsapp ? " checked" : "") + '> Nachricht über WhatsApp</label><label class="btn small">Foto<input type="file" accept="image/*" data-foto="' + i + '" hidden></label>' +
          (i ? '<button type="button" class="btn small" data-hoch="' + i + '">▲</button>' : "") + '<button type="button" class="btn small" data-weg="' + i + '">Entfernen</button></div></div></div>';
      }).join("");
      $("#sKont").querySelectorAll("[data-k]").forEach(function (f) { f.oninput = f.onchange = function () { E.kontakte[+f.dataset.i][f.dataset.k] = f.type === "checkbox" ? f.checked : f.value.trim(); sichern(); }; });
      $("#sKont").querySelectorAll("[data-foto]").forEach(function (f) { f.onchange = function () { var d = f.files && f.files[0]; if (!d) return; verkleinern(d, 400).then(function (b) { E.kontakte[+f.dataset.foto].foto = b; sichern(); kontakteZeigen(); }); }; });
      $("#sKont").querySelectorAll("[data-weg]").forEach(function (b) { b.onclick = function () { if (confirm("Diese Person entfernen?")) { E.kontakte.splice(+b.dataset.weg, 1); sichern(); kontakteZeigen(); } }; });
      $("#sKont").querySelectorAll("[data-hoch]").forEach(function (b) { b.onclick = function () { var i = +b.dataset.hoch, x = E.kontakte.splice(i, 1)[0]; E.kontakte.splice(i - 1, 0, x); sichern(); kontakteZeigen(); }; });
    }
    function fotosZeigen() {
      fotosAlle().then(function (l) {
        $("#sFotos").innerHTML = l.length ? l.map(function (f) { return '<span><img src="' + f.bild + '" alt=""><button type="button" data-fweg="' + f.id + '" aria-label="Foto löschen">×</button></span>'; }).join("") : '<p class="muted">Noch keine Fotos.</p>';
        $("#sFotos").querySelectorAll("[data-fweg]").forEach(function (b) { b.onclick = function () { fotoWeg(b.dataset.fweg).then(fotosZeigen); }; });
      });
    }
    function erinZeigen() {
      $("#sErin").innerHTML = E.erinnerungen.map(function (r, i) {
        return '<div class="zeile card" style="padding:8px;margin-bottom:6px"><input class="inp" type="time" data-e="zeit" data-i="' + i + '" value="' + esc(r.zeit) + '"><input class="inp" data-e="text" data-i="' + i + '" value="' + esc(r.text) + '" placeholder="z. B. Tablette nehmen" style="flex:1;min-width:160px">' +
          tage.map(function (t, n) { return '<label class="check" style="margin:0"><input type="checkbox" data-tag="' + n + '" data-i="' + i + '"' + (r.tage && r.tage.indexOf(n) >= 0 ? " checked" : "") + ">" + t + "</label>"; }).join("") +
          '<button type="button" class="btn small" data-eweg="' + i + '">Entfernen</button></div>';
      }).join("") + (E.erinnerungen.length ? '<p class="muted">Kein Tag angekreuzt = jeden Tag.</p>' : "");
      $("#sErin").querySelectorAll("[data-e]").forEach(function (f) { f.oninput = function () { E.erinnerungen[+f.dataset.i][f.dataset.e] = f.value; sichern(); }; });
      $("#sErin").querySelectorAll("[data-tag]").forEach(function (c) { c.onchange = function () { var r = E.erinnerungen[+c.dataset.i], n = +c.dataset.tag; r.tage = (r.tage || []).filter(function (x) { return x !== n; }); if (c.checked) r.tage.push(n); sichern(); }; });
      $("#sErin").querySelectorAll("[data-eweg]").forEach(function (b) { b.onclick = function () { E.erinnerungen.splice(+b.dataset.eweg, 1); sichern(); erinZeigen(); }; });
    }
    function linksZeigen() {
      $("#sLinks").innerHTML = E.links.map(function (l, i) { return '<div class="zeile" style="margin-bottom:6px"><input class="inp" data-l="name" data-i="' + i + '" value="' + esc(l.name) + '" placeholder="Name"><input class="inp" data-l="url" data-i="' + i + '" value="' + esc(l.url) + '" placeholder="https://…" style="flex:1"><button type="button" class="btn small" data-lweg="' + i + '">Entfernen</button></div>'; }).join("");
      $("#sLinks").querySelectorAll("[data-l]").forEach(function (f) { f.oninput = function () { var v = f.value.trim(); if (f.dataset.l === "url" && v && !/^https?:\/\//i.test(v)) return; E.links[+f.dataset.i][f.dataset.l] = v; sichern(); }; });
      $("#sLinks").querySelectorAll("[data-lweg]").forEach(function (b) { b.onclick = function () { E.links.splice(+b.dataset.lweg, 1); sichern(); linksZeigen(); }; });
    }
  }

  /* ---------- Start ---------- */
  aussehen();
  if (E.fertig) start(); else einrichten();
  setInterval(function () { var u = $("#uhr"); if (u) { u.textContent = uhrText(); $("#datum").textContent = datumText(); } erinnerungPruefen(); }, 15000);
  KW.footer("einfach", function () { return E; }, function (d) { E = Object.assign(E, d); sichern(); aussehen(); E.fertig ? start() : einrichten(); });
})();
