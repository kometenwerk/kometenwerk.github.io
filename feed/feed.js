/* FIDELIA Feed – deine Nachrichten-Quellen auf einen Blick. Ohne Werbung, ohne Algorithmus: einfach nach Zeit sortiert.
   Gelesen, Gemerkt und deine Auswahl bleiben auf dem Gerät (localStorage „kw-feed“). */
(function () {
  "use strict";
  var esc = KW.esc, $ = function (id) { return document.getElementById(id); };
  var D = KW.load("kw-feed", null) || { an: null, gelesen: {}, gemerkt: [], eigene: [] };
  function speichern() { KW.save("kw-feed", D); }
  var daten = null, filter = "alle", suche = "", eigeneArtikel = [];

  function wann(z) { var s = Math.round(Date.now() / 1000 - z); if (s < 3600) return "vor " + Math.max(1, Math.round(s / 60)) + " Min."; if (s < 86400) return "vor " + Math.round(s / 3600) + " Std."; return new Date(z * 1000).toLocaleDateString("de-DE", { day: "numeric", month: "short" }); }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } }

  async function laden() {
    try { var r = await fetch("daten/feeds.json?t=" + Math.floor(Date.now() / 300000), { cache: "no-cache" }); daten = await r.json(); }
    catch (e) { daten = daten || { stand: 0, quellen: [] }; KW.toast("Offline – du siehst die zuletzt geladenen Artikel."); }
    if (!D.an) { D.an = daten.quellen.filter(function (q) { return /Nachrichten|Wissen/.test(q.thema); }).map(function (q) { return q.id; }); speichern(); }
    await eigeneLaden();
    zeigen();
  }
  // Eigene Quellen: klappt nur, wenn die Seite das Abrufen aus dem Browser erlaubt
  async function eigeneLaden() {
    eigeneArtikel = [];
    for (var i = 0; i < D.eigene.length; i++) {
      var q = D.eigene[i];
      try { var r = await fetch(q.url); var xml = new DOMParser().parseFromString(await r.text(), "text/xml"); q.ok = true;
        Array.prototype.slice.call(xml.querySelectorAll("item, entry"), 0, 25).forEach(function (it) {
          var t = (it.querySelector("title") || {}).textContent || "", l = it.querySelector("link"), link = l ? (l.getAttribute("href") || l.textContent) : "", z = (it.querySelector("pubDate, published, updated") || {}).textContent;
          var s = ((it.querySelector("description, summary") || {}).textContent || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 280);
          if (t && /^https?:/.test(link)) eigeneArtikel.push({ t: t.trim(), s: s, l: link.trim(), z: Math.round((Date.parse(z) || Date.now()) / 1000), q: q.id, qn: q.name });
        });
      } catch (e) { q.ok = false; }
    }
  }
  function alleArtikel() {
    var a = [];
    (daten.quellen || []).forEach(function (q) { if (D.an.indexOf(q.id) < 0) return; q.artikel.forEach(function (x) { a.push({ t: x.t, s: x.s, l: x.l, z: x.z, q: q.id, qn: q.name, th: q.thema }); }); });
    return a.concat(eigeneArtikel);
  }
  function zeigen() {
    var themen = {}; (daten.quellen || []).forEach(function (q) { if (D.an.indexOf(q.id) >= 0) themen[q.thema] = 1; });
    var a = filter === "gemerkt" ? D.gemerkt.slice() : alleArtikel().filter(function (x) { return filter === "alle" || x.th === filter || (filter === "eigene" && !x.th); });
    if (suche) { var s = suche.toLowerCase(); a = a.filter(function (x) { return (x.t + " " + x.s).toLowerCase().indexOf(s) >= 0; }); }
    var gesehen = {}; a = a.filter(function (x) { if (gesehen[x.l]) return false; gesehen[x.l] = 1; return true; }).sort(function (x, y) { return y.z - x.z; }).slice(0, 150);
    var h = '<div class="leiste"><input class="inp" id="suche" type="search" placeholder="In den Artikeln suchen" value="' + esc(suche) + '" aria-label="Suchen"><button class="btn" type="button" data-a="quellen">⚙️ Quellen</button></div>';
    h += '<div class="filter" role="tablist">' + [["alle", "Alles"]].concat(Object.keys(themen).map(function (t) { return [t, t]; })).concat(D.eigene.length ? [["eigene", "Eigene"]] : []).concat([["gemerkt", "⭐ Gemerkt" + (D.gemerkt.length ? " (" + D.gemerkt.length + ")" : "")]]).map(function (f) { return '<button type="button" role="tab" data-f="' + esc(f[0]) + '" aria-selected="' + (filter === f[0]) + '">' + esc(f[1]) + "</button>"; }).join("") + "</div>";
    if (!daten.stand && !eigeneArtikel.length) h += '<div class="empty"><b>Die ersten Artikel kommen gleich</b>Der Feed wird jede Stunde neu geladen. Schau in ein paar Minuten nochmal vorbei.</div>';
    else if (!a.length) h += '<div class="empty"><b>' + (filter === "gemerkt" ? "Noch nichts gemerkt" : "Keine Artikel") + "</b>" + (filter === "gemerkt" ? "Tipp bei einem Artikel auf ☆, um ihn für später zu merken." : "Wähle unter ⚙️ Quellen aus, was du lesen willst.") + "</div>";
    else h += '<div class="artikel-liste">' + a.map(function (x) { var gem = D.gemerkt.some(function (g) { return g.l === x.l; }); return '<article class="artikel' + (D.gelesen[x.l] ? " gelesen" : "") + '"><a href="' + esc(x.l) + '" target="_blank" rel="noopener noreferrer" data-l="' + esc(x.l) + '"><small class="quelle">' + esc(x.qn) + " · " + esc(wann(x.z)) + "</small><h3>" + esc(x.t) + "</h3>" + (x.s ? "<p>" + esc(x.s) + "</p>" : "") + '<small class="host">' + esc(host(x.l)) + ' ↗</small></a><button class="merk" type="button" data-m="' + esc(x.l) + '" aria-label="' + (gem ? "Nicht mehr merken" : "Merken") + '" aria-pressed="' + gem + '">' + (gem ? "⭐" : "☆") + "</button></article>"; }).join("") + "</div>";
    if (daten.stand) h += '<p class="muted klein stand">Stand: ' + new Date(daten.stand * 1000).toLocaleString("de-DE") + " · wird jede Stunde aktualisiert · sortiert nur nach Zeit, ohne Algorithmus</p>";
    $("ansicht").innerHTML = h;
    var f = $("suche"); f.oninput = function () { suche = this.value; clearTimeout(f._t); f._t = setTimeout(function () { zeigen(); var n = $("suche"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 300); };
  }
  function quellenFenster() {
    var dlg = $("fenster"), fin = $("fensterIn"), themen = {};
    (daten.quellen || []).forEach(function (q) { (themen[q.thema] = themen[q.thema] || []).push(q); });
    fin.innerHTML = "<h2>Deine Quellen</h2><p class=\"muted klein\">Wähle aus, was in deinem Feed erscheint.</p>" + Object.keys(themen).map(function (t) { return '<h3 class="sec">' + esc(t) + '</h3><div class="quellen">' + themen[t].map(function (q) { return '<label class="quelle-wahl"><input type="checkbox" value="' + esc(q.id) + '"' + (D.an.indexOf(q.id) >= 0 ? " checked" : "") + "><span>" + esc(q.name) + (q.ok === false ? " ⚠️" : "") + "</span></label>"; }).join("") + "</div>"; }).join("") +
      '<h3 class="sec">Eigene Quelle (RSS-Link)</h3>' + D.eigene.map(function (q, i) { return '<div class="row" style="align-items:center"><span style="flex:1">' + esc(q.name) + (q.ok === false ? ' <small class="muted">– lässt sich nicht laden</small>' : "") + '</span><button class="btn small" type="button" data-weg="' + i + '">✕</button></div>'; }).join("") +
      '<form class="row" id="eigen"><input class="inp" id="eUrl" type="url" placeholder="https://…/rss" style="flex:1" aria-label="RSS-Link"><button class="btn" type="submit">＋</button></form><p class="muted klein">Manche Seiten erlauben das Laden aus dem Browser nicht. Dann sag uns Bescheid – wir nehmen die Quelle in den Katalog auf.</p>' +
      '<div class="sheet-foot"><button class="btn primary" type="button" id="qOk">Fertig</button></div>';
    dlg.showModal();
    fin.querySelector("#qOk").onclick = function () { D.an = Array.prototype.map.call(fin.querySelectorAll(".quelle-wahl input:checked"), function (x) { return x.value; }); speichern(); dlg.close(); filter = "alle"; zeigen(); };
    fin.querySelector("#eigen").onsubmit = async function (e) { e.preventDefault(); var u = fin.querySelector("#eUrl").value.trim(); if (!/^https:\/\//.test(u)) { KW.toast("Bitte einen https-Link eingeben."); return; } D.eigene.push({ id: "e" + KW.id(), name: host(u), url: u }); speichern(); await eigeneLaden(); quellenFenster(); KW.toast(D.eigene[D.eigene.length - 1].ok ? "Quelle hinzugefügt ✅" : "Diese Quelle lässt sich leider nicht direkt laden."); };
    fin.onclick = function (e) { var b = e.target.closest("[data-weg]"); if (b) { D.eigene.splice(+b.dataset.weg, 1); speichern(); eigeneLaden().then(quellenFenster); } };
  }
  $("fenster").addEventListener("click", function (e) { if (e.target === this) this.close(); });
  document.addEventListener("click", function (e) {
    var f = e.target.closest("[data-f]"); if (f) { filter = f.dataset.f; zeigen(); return; }
    var m = e.target.closest("[data-m]"); if (m) { var l = m.dataset.m, i = D.gemerkt.findIndex(function (g) { return g.l === l; }); if (i >= 0) D.gemerkt.splice(i, 1); else { var x = alleArtikel().filter(function (y) { return y.l === l; })[0]; if (x) D.gemerkt.unshift(x); D.gemerkt = D.gemerkt.slice(0, 100); } speichern(); zeigen(); return; }
    var a = e.target.closest("[data-l]"); if (a) { D.gelesen[a.dataset.l] = Date.now(); var k = Object.keys(D.gelesen); if (k.length > 800) k.sort(function (x, y) { return D.gelesen[x] - D.gelesen[y]; }).slice(0, 300).forEach(function (x) { delete D.gelesen[x]; }); speichern(); a.closest(".artikel").classList.add("gelesen"); return; }
    var q = e.target.closest('[data-a="quellen"]'); if (q) quellenFenster();
  });
  document.addEventListener("visibilitychange", function () { if (!document.hidden && daten && Date.now() / 1000 - daten.stand > 1800) laden(); });
  laden();
})();
