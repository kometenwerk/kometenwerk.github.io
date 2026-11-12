// FIDELIA Speisekarte – die Karte steckt komprimiert im Link (#k=…). Kein Server, kein Konto.
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var esc = KW.esc, app = $("#app"), KEY = "kw-speisekarte";
  var ALLERGENE = { A: "Gluten", B: "Krebstiere", C: "Eier", D: "Fisch", E: "Erdnüsse", F: "Soja", G: "Milch/Laktose", H: "Schalenfrüchte (Nüsse)", L: "Sellerie", M: "Senf", N: "Sesam", O: "Sulfite", P: "Lupinen", R: "Weichtiere" };
  var BEISPIEL = { name: "Café am Markt", unter: "Frühstück · Kuchen · Mittagstisch", farbe: "#14532d", hinweis: "Alle Preise in Euro inkl. MwSt. Fragen Sie uns gern nach Allergenen.", adresse: "", kategorien: [
    { name: "Frühstück", gerichte: [{ name: "Croissant mit Butter und Marmelade", text: "", preis: "3,50", veg: true, vegan: false, scharf: false, al: "A,C,G" }, { name: "Rührei mit Brot", text: "Drei Eier, Schnittlauch, Bauernbrot", preis: "7,90", veg: true, al: "A,C,G" }] },
    { name: "Mittagstisch", gerichte: [{ name: "Gemüsecurry", text: "Mit Reis und Kokosmilch", preis: "11,50", veg: true, vegan: true, scharf: true, al: "" }, { name: "Schnitzel mit Pommes", text: "Vom Schwein, mit Zitrone", preis: "14,90", al: "A,C" }] },
    { name: "Getränke", gerichte: [{ name: "Kaffee", text: "", preis: "2,80", veg: true, vegan: true, al: "" }, { name: "Apfelschorle 0,4 l", text: "", preis: "3,20", veg: true, vegan: true, al: "" }] }
  ] };
  var K = KW.load(KEY, null) || JSON.parse(JSON.stringify(BEISPIEL));
  var sichern = function () { KW.save(KEY, K); };

  /* ---------- Link packen / entpacken ---------- */
  function b64u(bytes) { var s = ""; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function unb64u(t) { t = t.replace(/-/g, "+").replace(/_/g, "/"); while (t.length % 4) t += "="; var s = atob(t), b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
  function packen(obj) {
    var roh = new TextEncoder().encode(JSON.stringify(obj));
    if (!window.CompressionStream) return Promise.resolve("u" + b64u(roh));
    return new Response(new Blob([roh]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer().then(function (ab) { return "z" + b64u(new Uint8Array(ab)); });
  }
  function entpacken(t) {
    var art = t[0], b = unb64u(t.slice(1));
    if (art === "u") return Promise.resolve(JSON.parse(new TextDecoder().decode(b)));
    return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text().then(JSON.parse);
  }
  function kurz(k) { // nur das Nötige in den Link
    return { n: k.name, u: k.unter, f: k.farbe, h: k.hinweis, k: k.kategorien.map(function (c) { return [c.name, c.gerichte.map(function (g) { return [g.name, g.text || "", g.preis || "", (g.veg ? 1 : 0) + (g.vegan ? 2 : 0) + (g.scharf ? 4 : 0), g.al || ""]; })]; }) };
  }
  function lang(x) { return { name: x.n, unter: x.u, farbe: x.f, hinweis: x.h, kategorien: (x.k || []).map(function (c) { return { name: c[0], gerichte: c[1].map(function (g) { return { name: g[0], text: g[1], preis: g[2], veg: !!(g[3] & 1), vegan: !!(g[3] & 2), scharf: !!(g[3] & 4), al: g[4] }; }) }; }) }; }
  function linkBauen() { return packen(kurz(K)).then(function (p) { return location.origin + location.pathname.replace(/index\.html$/, "") + "#k=" + p; }); }

  /* ---------- Gäste-Ansicht ---------- */
  function gast(k) {
    document.body.classList.add("gast");
    document.title = k.name + " – Speisekarte";
    var filter = { veg: false, vegan: false };
    var farbe = /^#[0-9a-f]{6}$/i.test(k.farbe) ? k.farbe : "#14532d";
    function zeichne() {
      var benutzt = {};
      app.className = "";
      app.innerHTML = '<div class="g-karte" style="--k:' + farbe + '"><header class="g-kopf"><h1>' + esc(k.name) + "</h1>" + (k.unter ? "<p>" + esc(k.unter) + "</p>" : "") + "</header>" +
        '<nav class="g-nav" aria-label="Kategorien">' + k.kategorien.map(function (c, i) { return '<a href="#" data-sprung="' + i + '">' + esc(c.name) + "</a>"; }).join("") + "</nav>" +
        '<div class="g-filter"><button type="button" data-fi="veg" aria-pressed="' + filter.veg + '">🌱 Nur vegetarisch</button><button type="button" data-fi="vegan" aria-pressed="' + filter.vegan + '">Nur vegan</button></div>' +
        k.kategorien.map(function (c, i) {
          var g = c.gerichte.filter(function (x) { return (!filter.veg || x.veg || x.vegan) && (!filter.vegan || x.vegan); });
          if (!g.length) return "";
          return '<section class="g-kat" id="kat' + i + '"><h2>' + esc(c.name) + "</h2>" + g.map(function (x) {
            (x.al || "").split(/[ ,]+/).filter(Boolean).forEach(function (a) { benutzt[a.toUpperCase()] = 1; });
            return '<div class="g-ger"><div><b>' + esc(x.name) + "</b>" + (x.vegan ? '<span class="t">vegan</span>' : x.veg ? '<span class="t">vegetarisch</span>' : "") + (x.scharf ? '<span class="t scharf">scharf</span>' : "") + (x.text ? "<p>" + esc(x.text) + "</p>" : "") + (x.al ? '<div class="al">Allergene: ' + esc(x.al) + "</div>" : "") + '</div><div class="preis">' + (x.preis ? esc(x.preis) + " €" : "") + "</div></div>";
          }).join("") + "</section>";
        }).join("") +
        '<div class="g-fuss">' + (k.hinweis ? "<p>" + esc(k.hinweis) + "</p>" : "") + (Object.keys(benutzt).length ? "<details><summary>Allergene erklärt</summary><p>" + Object.keys(benutzt).sort().map(function (a) { return "<b>" + esc(a) + "</b> " + esc(ALLERGENE[a] || "?"); }).join(" · ") + "</p></details>" : "") + '<p style="margin-top:16px">Digitale Karte mit <a href="https://kometenwerk.github.io/speisekarte/">FIDELIA Speisekarte</a></p></div></div>';
      app.querySelectorAll("[data-sprung]").forEach(function (a) { a.onclick = function (e) { e.preventDefault(); var z = document.getElementById("kat" + a.dataset.sprung); if (z) z.scrollIntoView({ behavior: "smooth" }); }; });
      app.querySelectorAll("[data-fi]").forEach(function (b) { b.onclick = function () { filter[b.dataset.fi] = !filter[b.dataset.fi]; zeichne(); }; });
    }
    zeichne();
  }

  /* ---------- Bearbeiten ---------- */
  function editor() {
    app.innerHTML = '<div class="s-hinweis">Für Restaurants, Cafés, Imbisse und Vereinsfeste: Karte eintragen, Link oder QR-Code erzeugen, Aufsteller drucken. Die Karte steckt im Link selbst – es gibt keinen Server und kein Konto. <b>Nach jeder Änderung neuen QR-Code drucken.</b></div>' +
      '<div class="card" style="padding:14px"><div class="field"><label for="kName">Name</label><input class="inp" id="kName" value="' + esc(K.name) + '"></div><div class="field"><label for="kUnter">Unterzeile</label><input class="inp" id="kUnter" value="' + esc(K.unter) + '"></div><div class="row" style="gap:10px;align-items:center"><label for="kFarbe">Farbe</label><input type="color" id="kFarbe" value="' + esc(K.farbe) + '"></div><div class="field"><label for="kHinweis">Hinweis unten</label><input class="inp" id="kHinweis" value="' + esc(K.hinweis) + '"></div></div>' +
      '<h2>Karte</h2><div id="kats"></div><button type="button" class="btn" id="katNeu">+ Kategorie</button>' +
      '<h2>Teilen &amp; drucken</h2><div class="card" style="padding:14px"><div class="s-qr"><div id="qr"></div><div style="flex:1;min-width:220px"><p id="linkInfo" class="muted"></p><div class="row" style="gap:8px;flex-wrap:wrap"><button type="button" class="btn primary" id="ansehen">👀 Als Gast ansehen</button><button type="button" class="btn" id="kopieren">🔗 Link kopieren</button><button type="button" class="btn" id="aufsteller">🖨 QR-Aufsteller (4 pro A4)</button><button type="button" class="btn" id="papier">🖨 Karte auf Papier</button></div></div></div>' +
      '<div class="field" style="margin-top:12px"><label for="kAdresse">Eigene Adresse (optional)</label><input class="inp" id="kAdresse" value="' + esc(K.adresse || "") + '" placeholder="z. B. https://cafe-am-markt.de/karte"><p class="muted">Bei sehr großen Karten wird der QR-Code eng. Dann den Link auf der eigenen Webseite weiterleiten und hier die kurze Adresse eintragen – der QR-Code zeigt dann darauf.</p></div></div>' +
      '<div class="row" style="gap:8px;margin:14px 0"><button type="button" class="btn" id="beispiel">Beispiel laden</button><button type="button" class="btn" id="leer">Neue leere Karte</button></div>' +
      '<div class="druck-bogen" id="druck"></div>';
    $("#kName").oninput = function () { K.name = this.value; neu(); };
    $("#kUnter").oninput = function () { K.unter = this.value; neu(); };
    $("#kFarbe").oninput = function () { K.farbe = this.value; neu(); };
    $("#kHinweis").oninput = function () { K.hinweis = this.value; neu(); };
    $("#kAdresse").oninput = function () { K.adresse = this.value.trim(); neu(); };
    $("#katNeu").onclick = function () { K.kategorien.push({ name: "Neue Kategorie", gerichte: [] }); neu(); kats(); };
    $("#beispiel").onclick = function () { if (confirm("Beispiel laden? Deine Karte wird ersetzt.")) { K = JSON.parse(JSON.stringify(BEISPIEL)); neu(); editor(); } };
    $("#leer").onclick = function () { if (confirm("Neue leere Karte? Deine Karte wird ersetzt.")) { K = { name: "", unter: "", farbe: "#14532d", hinweis: "Alle Preise in Euro inkl. MwSt.", adresse: "", kategorien: [{ name: "Speisen", gerichte: [] }, { name: "Getränke", gerichte: [] }] }; neu(); editor(); } };
    $("#ansehen").onclick = function () { linkBauen().then(function (l) { window.open(l, "_blank"); }); };
    $("#kopieren").onclick = function () { linkBauen().then(function (l) { (navigator.clipboard ? navigator.clipboard.writeText(l) : Promise.reject()).then(function () { KW.toast("Link kopiert."); }, function () { prompt("Link kopieren:", l); }); }); };
    $("#aufsteller").onclick = function () { zielLink().then(function (l) { var q = qrSvg(l); $("#druck").innerHTML = '<div class="aufsteller">' + [0, 1, 2, 3].map(function () { return "<div><h2>" + esc(K.name || "Speisekarte") + "</h2><p>📱 Speisekarte scannen</p>" + q + "<p>Kamera aufs Handy halten – fertig.</p></div>"; }).join("") + "</div>"; window.print(); }); };
    $("#papier").onclick = function () { $("#druck").innerHTML = '<div class="karte-druck"><h1>' + esc(K.name) + '</h1><div class="u">' + esc(K.unter) + "</div>" + K.kategorien.map(function (c) { return "<h2>" + esc(c.name) + "</h2>" + c.gerichte.map(function (g) { return '<div class="z"><div><b>' + esc(g.name) + "</b>" + (g.vegan ? " (vegan)" : g.veg ? " (veg.)" : "") + (g.text || g.al ? "<small>" + esc(g.text) + (g.al ? " · Allergene: " + esc(g.al) : "") + "</small>" : "") + "</div><b>" + esc(g.preis) + (g.preis ? " €" : "") + "</b></div>"; }).join(""); }).join("") + '<p style="margin-top:8mm;font-size:9pt">' + esc(K.hinweis) + " Allergene: " + Object.keys(ALLERGENE).map(function (a) { return a + " " + ALLERGENE[a]; }).join(", ") + "</p></div>"; window.print(); };
    kats(); qrNeu();
  }
  function zielLink() { return K.adresse && /^https?:\/\//.test(K.adresse) ? Promise.resolve(K.adresse) : linkBauen(); }
  function qrSvg(l) { try { var q = window.qrcode(0, "L"); q.addData(l); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch (e) { return "<p>Die Karte ist zu groß für einen QR-Code – bitte eigene Adresse eintragen.</p>"; } }
  var qT = null;
  function neu() { sichern(); clearTimeout(qT); qT = setTimeout(qrNeu, 400); }
  function qrNeu() {
    zielLink().then(function (l) {
      $("#qr").innerHTML = qrSvg(l);
      var n = l.length;
      $("#linkInfo").innerHTML = "Link: " + n + " Zeichen. " + (K.adresse ? "QR zeigt auf deine eigene Adresse." : n < 900 ? "✔ QR-Code gut lesbar." : n < 1800 ? "⚠ QR-Code wird eng – groß drucken (mind. 6 cm)." : "⚠ Zu groß für einen sicheren QR-Code – eigene Adresse eintragen.");
    });
  }
  function kats() {
    $("#kats").innerHTML = K.kategorien.map(function (c, ci) {
      return '<div class="card s-kat"><div class="s-kat-kopf"><input class="inp" data-kn="' + ci + '" value="' + esc(c.name) + '" aria-label="Name der Kategorie">' + (ci ? '<button type="button" class="btn small" data-khoch="' + ci + '" aria-label="Kategorie nach oben">▲</button>' : "") + '<button type="button" class="btn small" data-kweg="' + ci + '">Entfernen</button></div>' +
        c.gerichte.map(function (g, gi) {
          var id = ci + "-" + gi;
          return '<div class="s-ger"><input class="inp" data-g="name" data-id="' + id + '" value="' + esc(g.name) + '" placeholder="Gericht" aria-label="Gericht"><input class="inp" data-g="preis" data-id="' + id + '" value="' + esc(g.preis) + '" placeholder="Preis" inputmode="decimal" aria-label="Preis in Euro"><input class="inp voll" data-g="text" data-id="' + id + '" value="' + esc(g.text) + '" placeholder="Beschreibung (optional)" aria-label="Beschreibung">' +
            '<div class="tags"><label><input type="checkbox" data-g="veg" data-id="' + id + '"' + (g.veg ? " checked" : "") + '>vegetarisch</label><label><input type="checkbox" data-g="vegan" data-id="' + id + '"' + (g.vegan ? " checked" : "") + '>vegan</label><label><input type="checkbox" data-g="scharf" data-id="' + id + '"' + (g.scharf ? " checked" : "") + '>scharf</label><input class="inp" data-g="al" data-id="' + id + '" value="' + esc(g.al) + '" placeholder="Allergene z. B. A,C,G" aria-label="Allergene" title="' + esc(Object.keys(ALLERGENE).map(function (a) { return a + " = " + ALLERGENE[a]; }).join("\n")) + '">' + (gi ? '<button type="button" class="btn small" data-ghoch="' + id + '" aria-label="Gericht nach oben">▲</button>' : "") + '<button type="button" class="btn small" data-gweg="' + id + '" aria-label="Gericht entfernen">×</button></div></div>';
        }).join("") + '<button type="button" class="btn small" data-gneu="' + ci + '" style="margin-top:8px">+ Gericht</button></div>';
    }).join("") + '<p class="muted" style="font-size:.85rem">Allergene: ' + Object.keys(ALLERGENE).map(function (a) { return "<b>" + a + "</b> " + ALLERGENE[a]; }).join(" · ") + ". Die Angaben macht der Betrieb – er ist dafür verantwortlich.</p>";
    var g = function (id) { var p = id.split("-"); return K.kategorien[+p[0]].gerichte[+p[1]]; };
    $("#kats").querySelectorAll("[data-kn]").forEach(function (el) { el.oninput = function () { K.kategorien[+el.dataset.kn].name = el.value; neu(); }; });
    $("#kats").querySelectorAll("[data-g]").forEach(function (el) { el.oninput = el.onchange = function () { g(el.dataset.id)[el.dataset.g] = el.type === "checkbox" ? el.checked : el.dataset.g === "al" ? el.value.toUpperCase() : el.value; neu(); }; });
    $("#kats").querySelectorAll("[data-gneu]").forEach(function (b) { b.onclick = function () { K.kategorien[+b.dataset.gneu].gerichte.push({ name: "", text: "", preis: "", al: "" }); neu(); kats(); var f = $("#kats").querySelectorAll('[data-g="name"]'); }; });
    $("#kats").querySelectorAll("[data-gweg]").forEach(function (b) { b.onclick = function () { var p = b.dataset.gweg.split("-"); K.kategorien[+p[0]].gerichte.splice(+p[1], 1); neu(); kats(); }; });
    $("#kats").querySelectorAll("[data-ghoch]").forEach(function (b) { b.onclick = function () { var p = b.dataset.ghoch.split("-"), l = K.kategorien[+p[0]].gerichte, i = +p[1]; l.splice(i - 1, 0, l.splice(i, 1)[0]); neu(); kats(); }; });
    $("#kats").querySelectorAll("[data-kweg]").forEach(function (b) { b.onclick = function () { if (confirm("Kategorie mit allen Gerichten entfernen?")) { K.kategorien.splice(+b.dataset.kweg, 1); neu(); kats(); } }; });
    $("#kats").querySelectorAll("[data-khoch]").forEach(function (b) { b.onclick = function () { var i = +b.dataset.khoch; K.kategorien.splice(i - 1, 0, K.kategorien.splice(i, 1)[0]); neu(); kats(); }; });
  }

  /* ---------- Start ---------- */
  var m = location.hash.match(/^#k=(.+)$/);
  if (m) {
    entpacken(m[1]).then(function (x) { gast(lang(x)); }).catch(function () { app.innerHTML = '<p style="padding:20px">Diese Speisekarte konnte nicht geöffnet werden. Bitte den QR-Code nochmal scannen.</p>'; });
  } else {
    editor();
    KW.footer("speisekarte", function () { return K; }, function (d) { K = d; sichern(); editor(); });
  }
  window.addEventListener("hashchange", function () { location.reload(); });
})();
