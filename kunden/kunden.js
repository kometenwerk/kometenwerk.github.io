/* Kometenwerk für Kunden – Pakete, Projekt-Planer, Anfrage per E-Mail und Chef-Modus (?chef) */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  function laden(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function speichern(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var tTimer;
  function toast(t) { var el = $("toast"); el.textContent = t; el.classList.add("zeigen"); clearTimeout(tTimer); tTimer = setTimeout(function () { el.classList.remove("zeigen"); }, 3200); }

  var STANDARD = {
    email: "",
    ueberUns: "Kometenwerk ist ein junges Studio aus Deutschland. Wir bauen Websites, Apps und Spiele – modern, schnell und fürs Handy gemacht.",
    angebote: [],
    impressum: ""
  };
  var ANLIEGEN = [["neu", "✨ Neue Website"], ["modern", "🔧 Alte Seite modernisieren"], ["app", "📱 Kleine Web-App"], ["frage", "💬 Erst mal eine Frage"]];
  var BAUSTEINE = [
    ["start", "🏠", "Startseite & Über uns", 1, true], ["kontakt", "✉️", "Kontakt & Anfahrt", 1, true],
    ["termine", "📅", "Termine & Veranstaltungen", 2], ["galerie", "🖼️", "Bildergalerie", 1],
    ["team", "👥", "Mannschaften / Team", 2], ["angebot", "🏷️", "Angebot, Preise oder Speisekarte", 1],
    ["zeiten", "🕒", "Öffnungszeiten", 1], ["news", "📰", "Neuigkeiten / Blog", 2],
    ["download", "📄", "Downloads & Formulare", 1], ["mitglied", "📝", "Mitgliedsantrag", 2],
    ["englisch", "🌍", "Auch auf Englisch", 2], ["selbst", "✏️", "Texte selbst ändern", 2],
    ["effekte", "🌠", "Besondere Effekte & Animationen", 2], ["domain", "🔗", "Hilfe bei eigener Adresse (Domain)", 1]
  ];
  var C = null, ONLINE = null, schritt = 1;
  var P = laden("kw-kunden-planer", null) || { art: "neu", wahl: { start: true, kontakt: true } };

  function sauber(c) {
    c = c && typeof c === "object" ? c : {};
    var o = JSON.parse(JSON.stringify(STANDARD));
    if (typeof c.email === "string") o.email = c.email.trim();
    if (typeof c.ueberUns === "string" && c.ueberUns.trim()) o.ueberUns = c.ueberUns.trim();
    if (Array.isArray(c.angebote)) o.angebote = c.angebote.filter(function (a) { return a && a.name; }).slice(0, 8).map(function (a) {
      return { name: String(a.name), text: String(a.text || ""), punkte: (Array.isArray(a.punkte) ? a.punkte : []).map(String).filter(Boolean).slice(0, 10), preis: String(a.preis || ""), hervor: !!a.hervor };
    });
    if (typeof c.impressum === "string") o.impressum = c.impressum.trim();
    return o;
  }
  function emailOk() { return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(C.email) && !/example\.(com|org|net)$/i.test(C.email); }
  function freigeschaltet() { return emailOk() && C.impressum.length > 10; }

  /* ---------- Anzeige ---------- */
  function pakete() {
    $("angebotListe").innerHTML = C.angebote.map(function (a, i) {
      return '<article class="paket reveal show' + (a.hervor ? " hervor" : "") + '" data-i="' + i + '">' + (a.hervor ? '<span class="p-band">Beliebt</span>' : "") +
        '<h3>' + esc(a.name) + '</h3><p class="p-text">' + esc(a.text) + '</p>' +
        (a.punkte.length ? '<ul>' + a.punkte.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join("") + '</ul>' : "") +
        '<p class="p-preis">' + esc(a.preis || "Preis nach Gespräch") + '</p>' +
        '<a class="btn' + (a.hervor ? " primary" : "") + '" href="#planer" data-paket="' + i + '">Dieses Paket planen</a></article>';
    }).join("") || '<p class="center" style="color:var(--muted)">Pakete folgen bald.</p>';
  }
  function alles() {
    $("ueberText").textContent = C.ueberUns;
    pakete();
    var frei = freigeschaltet();
    $("kStatus").hidden = frei;
    $("plBald").hidden = frei;
    $("senden").disabled = !frei;
    planerZeigen();
  }

  /* ---------- Projekt-Planer ---------- */
  function punkte() { var s = 0; BAUSTEINE.forEach(function (b) { if (P.wahl[b[0]]) s += b[3]; }); return s; }
  function empfehlung() {
    var A = C.angebote; if (!A.length) return -1;
    if (P.art === "app") { for (var i = 0; i < A.length; i++) if (/app/i.test(A[i].name)) return i; }
    var p = punkte(), idx = p <= 4 ? 0 : p <= 10 ? 1 : 2;
    return Math.min(idx, A.length - 1);
  }
  function planerZeigen() {
    $("plArt").innerHTML = ANLIEGEN.map(function (a) {
      return '<label class="pl-chip"><input type="radio" name="plArt" value="' + a[0] + '"' + (P.art === a[0] ? " checked" : "") + '><span>' + a[1] + '</span></label>';
    }).join("");
    $("plBoxen").innerHTML = BAUSTEINE.map(function (b) {
      return '<label class="pl-box"><input type="checkbox" value="' + b[0] + '"' + (P.wahl[b[0]] ? " checked" : "") + '><span class="pl-em" aria-hidden="true">' + b[1] + '</span><span>' + esc(b[2]) + '</span></label>';
    }).join("");
    ergebnis();
  }
  function ergebnis() {
    var p = punkte(), i = empfehlung(), A = C.angebote, n = BAUSTEINE.filter(function (b) { return P.wahl[b[0]]; }).length;
    $("plMeter").style.width = Math.min(100, 10 + p * 6) + "%";
    if (P.art === "frage") $("plEmpf").innerHTML = "💬 Kein Problem – schick uns einfach deine Frage. Die Auswahl oben ist freiwillig.";
    else if (i < 0) $("plEmpf").textContent = n + " Bausteine gewählt.";
    else $("plEmpf").innerHTML = "<b>" + n + " Bausteine gewählt.</b> Passendes Paket: <b class=\"pl-paket\">" + esc(A[i].name) + "</b>";
    document.querySelectorAll(".paket").forEach(function (el) { el.classList.toggle("empfohlen", +el.dataset.i === i && P.art !== "frage"); });
    speichern("kw-kunden-planer", P);
  }
  $("plArt").addEventListener("change", function (e) { if (e.target.name === "plArt") { P.art = e.target.value; ergebnis(); } });
  $("plBoxen").addEventListener("change", function (e) { var t = e.target; if (t.type === "checkbox") { P.wahl[t.value] = t.checked; ergebnis(); } });

  function zuSchritt(s) {
    schritt = s;
    document.querySelectorAll(".pl-schritt").forEach(function (el) { el.hidden = +el.dataset.s !== s; });
    document.querySelectorAll(".pl-schritte li").forEach(function (li) { li.classList.toggle("an", +li.dataset.s <= s); });
    $("plBalken").style.width = (s / 3 * 100) + "%";
    if (s === 3) $("plZusammen").innerHTML = zusammenHtml();
    var ziel = document.querySelector('.pl-schritt[data-s="' + s + '"]');
    var f = ziel.querySelector("input,textarea,button"); if (f && s > 1) setTimeout(function () { f.focus({ preventScroll: true }); }, 30);
    $("planer").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  document.querySelector(".pl").addEventListener("click", function (e) {
    var b = e.target.closest("[data-weiter]"); if (!b) return;
    var s = +b.dataset.weiter;
    if (s === 3 && !$("kName").value.trim()) { toast("Schreib bitte kurz deinen Namen oder Verein dazu."); $("kName").focus(); return; }
    zuSchritt(s);
  });
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-paket]"); if (!a) return;
    var name = (C.angebote[+a.dataset.paket] || {}).name || "";
    if (/app/i.test(name)) P.art = "app";
    var t = $("kText"); if (name && t.value.indexOf(name) < 0) t.value = ("Interesse an: " + name + "\n" + t.value).trim();
    planerZeigen(); zuSchritt(1);
  });

  function anfrage() {
    var art = (document.querySelector('input[name="art"]:checked') || {}).value || "Telefon";
    var anl = (ANLIEGEN.filter(function (a) { return a[0] === P.art; })[0] || ANLIEGEN[0])[1].replace(/^\S+\s/, "");
    var bs = BAUSTEINE.filter(function (b) { return P.wahl[b[0]]; }).map(function (b) { return b[2]; });
    var i = empfehlung(), paket = i >= 0 && P.art !== "frage" ? C.angebote[i].name : "–";
    var name = $("kName").value.trim(), alt = $("kAlt").value.trim(), text = $("kText").value.trim();
    var betreff = "Projektanfrage: " + anl + (name ? " – " + name : "");
    var s = function (x) { return String(x).replace(/[|\n\r]/g, " ").trim(); };
    var body = "Hallo Kometenwerk,\n\nich interessiere mich für ein Projekt.\n\nAnliegen: " + anl + "\nPassendes Paket laut Planer: " + paket +
      "\nGewünschte Bausteine: " + (bs.length ? bs.join(", ") : "–") + "\nName / Verein: " + (name || "–") + (alt ? "\nBisherige Website: " + alt : "") +
      "\nGespräch am liebsten: " + art + (text ? "\n\nNachricht:\n" + text : "") + "\n\nViele Grüße\n\n---\nKW-TERMIN: - | " + s(anl) + " | " + s(name || "–") + " | " + s(art);
    return { betreff: betreff, body: body, bs: bs, paket: paket, anl: anl, art: art, name: name };
  }
  function zusammenHtml() {
    var a = anfrage();
    return '<h3>Deine Anfrage</h3><dl>' +
      '<dt>Anliegen</dt><dd>' + esc(a.anl) + '</dd>' +
      (a.paket !== "–" ? '<dt>Passendes Paket</dt><dd>' + esc(a.paket) + '</dd>' : "") +
      '<dt>Bausteine</dt><dd>' + (a.bs.length ? a.bs.map(function (b) { return '<span class="pl-tag">' + esc(b) + '</span>'; }).join("") : "–") + '</dd>' +
      '<dt>Name / Verein</dt><dd>' + esc(a.name || "–") + '</dd>' +
      '<dt>Gespräch</dt><dd>' + esc(a.art) + '</dd></dl>';
  }
  $("senden").addEventListener("click", function () {
    if (!freigeschaltet()) return;
    var a = anfrage(), voll = "Betreff: " + a.betreff + "\n\n" + a.body;
    $("fertig").hidden = false;
    $("fertig").innerHTML = '<b>Fast geschafft! ✉️</b><p>Dein E-Mail-Programm sollte sich jetzt öffnen. Schick die E-Mail einfach ab – wir melden uns meist innerhalb von drei Tagen.</p>' +
      '<p class="pl-klein">Hat sich nichts geöffnet? Dann schick diesen Text an <b>' + esc(C.email) + '</b>:</p><pre>' + esc(voll) + '</pre>' +
      '<button class="btn" type="button" id="kopieren">📋 Text kopieren</button>';
    $("kopieren").onclick = function () { (navigator.clipboard ? navigator.clipboard.writeText(voll) : Promise.reject()).then(function () { toast("Kopiert."); }).catch(function () {}); };
    location.href = "mailto:" + C.email + "?subject=" + encodeURIComponent(a.betreff) + "&body=" + encodeURIComponent(a.body);
  });

  /* ---------- Chef-Modus: Einstellungen zusammenklicken und für GitHub kopieren ---------- */
  function chefModus() {
    var E = sauber(laden("kw-kunden-entwurf", null) || C), el = $("chef");
    el.hidden = false;
    function json() { return JSON.stringify(Object.assign({}, ONLINE || {}, { _anleitung: "Am einfachsten änderst du diese Datei über kometenwerk.github.io/kunden/?chef" }, sauber(E)), null, 2); }
    function zeichnen() {
      el.innerHTML = '<div class="wrap"><h2>🛠️ Chef-Modus</h2><p>Hier stellst du alles ein. Die Seite darunter zeigt sofort, wie es aussieht. Danach kopierst du das Ergebnis und ersetzt auf GitHub die Datei <b>kunden/einstellungen.json</b>. Nur das, was auf GitHub steht, sehen die Kunden.</p>' +
        (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(E.email) ? '<p class="c-warn">⚠️ Trag eine echte Kometenwerk-E-Mail ein. Ohne sie sind Anfragen gesperrt.</p>' : "") +
        (E.impressum.length <= 10 ? '<p class="c-warn">⚠️ Ohne Impressum (Name und Postanschrift) bleiben Anfragen gesperrt. Klärt mit deinen Eltern, wessen Angaben dort stehen.</p>' : "") +
        '<label class="pl-feld"><span>E-Mail für Anfragen</span><input data-f="email" type="email" value="' + esc(E.email) + '"></label>' +
        '<label class="pl-feld"><span>Kurz über uns</span><textarea data-f="ueberUns" rows="3">' + esc(E.ueberUns) + '</textarea></label>' +
        '<div class="pl-feld"><span>Pakete</span>' + E.angebote.map(function (a, i) {
          return '<div class="c-paket"><input data-a="' + i + '" data-k="name" value="' + esc(a.name) + '" aria-label="Name des Pakets">' +
            '<textarea data-a="' + i + '" data-k="text" rows="2" aria-label="Kurzbeschreibung">' + esc(a.text) + '</textarea>' +
            '<textarea data-a="' + i + '" data-k="punkte" rows="4" aria-label="Was ist drin (eine Zeile pro Punkt)" placeholder="Eine Zeile pro Punkt">' + esc(a.punkte.join("\n")) + '</textarea>' +
            '<div class="c-reihe"><input data-a="' + i + '" data-k="preis" value="' + esc(a.preis) + '" placeholder="leer = „Preis nach Gespräch“" aria-label="Preis">' +
            '<label><input type="checkbox" data-a="' + i + '" data-k="hervor"' + (a.hervor ? " checked" : "") + '> Beliebt</label>' +
            '<button class="btn" type="button" data-weg="' + i + '">Entfernen</button></div></div>';
        }).join("") + '<button class="btn" type="button" id="aPlus">+ Paket</button></div>' +
        '<label class="pl-feld"><span>Impressum (vollständiger Name, Straße + Hausnummer, PLZ + Ort, E-Mail – mit deinen Eltern klären)</span><textarea data-f="impressum" rows="5">' + esc(E.impressum) + '</textarea></label>' +
        '<div class="pl-knoepfe"><button class="btn primary" type="button" id="cKopieren">📋 Einstellungen kopieren</button><button class="btn" type="button" id="cDatei">⬇️ Als Datei speichern</button><button class="btn" type="button" id="cReset">↺ Wieder wie auf GitHub</button></div>' +
        '<ol class="pl-klein"><li>Auf „Einstellungen kopieren“ tippen.</li><li>Auf GitHub im Repo <b>kometenwerk.github.io</b> die Datei <b>kunden/einstellungen.json</b> öffnen.</li><li>Stift ✏️ → alles markieren → einfügen → „Commit changes“.</li><li>Nach 1–2 Minuten sehen die Kunden die neue Version.</li></ol></div>';
    }
    function neu() { speichern("kw-kunden-entwurf", E); C = sauber(E); alles(); }
    el.addEventListener("input", function (e) {
      var t = e.target;
      if (t.dataset.f) E[t.dataset.f] = t.value;
      else if (t.dataset.a) {
        var a = E.angebote[+t.dataset.a];
        if (t.dataset.k === "punkte") a.punkte = t.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
        else if (t.dataset.k === "hervor") a.hervor = t.checked;
        else a[t.dataset.k] = t.value;
      } else return;
      neu();
    });
    el.addEventListener("click", function (e) {
      var t = e.target.closest("button"); if (!t) return;
      if (t.id === "aPlus") { E.angebote.push({ name: "Neues Paket", text: "", punkte: [], preis: "", hervor: false }); neu(); zeichnen(); }
      else if (t.dataset.weg) { E.angebote.splice(+t.dataset.weg, 1); neu(); zeichnen(); }
      else if (t.id === "cKopieren") { var j = json(); (navigator.clipboard ? navigator.clipboard.writeText(j) : Promise.reject()).then(function () { toast("Kopiert! Jetzt auf GitHub einfügen."); }).catch(function () { window.prompt("Kopiere diesen Text:", j); }); }
      else if (t.id === "cDatei") { var b = new Blob([json()], { type: "application/json" }), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "einstellungen.json"; document.body.appendChild(a); a.click(); a.remove(); }
      else if (t.id === "cReset") { if (!confirm("Deinen Entwurf verwerfen und die Einstellungen von GitHub laden?")) return; speichern("kw-kunden-entwurf", null); E = sauber(ONLINE); neu(); zeichnen(); }
    });
    zeichnen(); C = sauber(E); alles();
  }

  /* ---------- Start ---------- */
  fetch("einstellungen.json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .then(function (d) { ONLINE = d; }).catch(function () { ONLINE = {}; })
    .then(function () {
      C = sauber(ONLINE); alles(); zuSchrittStill(1);
      if (/[?&]chef\b/.test(location.search)) chefModus();
    });
  function zuSchrittStill(s) { document.querySelectorAll(".pl-schritt").forEach(function (el) { el.hidden = +el.dataset.s !== s; }); $("plBalken").style.width = (s / 3 * 100) + "%"; }

  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(function () {});
})();
