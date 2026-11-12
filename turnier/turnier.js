// FIDELIA Turnier – Liga (jeder gegen jeden), K.-o. oder Gruppen + K.-o.
// Spiele werden aus Teams + Einstellungen berechnet; gespeichert werden nur die Ergebnisse.
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var esc = KW.esc, app = $("#app"), KEY = "kw-turnier";
  var D = KW.load(KEY, null);
  function neuesTurnier(name) { return { id: KW.id(), name: name || "Mein Turnier", sport: "Fußball", modus: "gruppen", teams: ["FC Blau", "SV Rot", "TSV Grün", "Die Gelben", "Kickers", "Eintracht", "Adler", "Löwen"], sieg: 3, rueck: false, felder: 2, start: "10:00", dauer: 12, pause: 3, gruppen: 2, weiter: 2, erg: {}, koTeams: null, koErg: {} }; }
  if (!D) { var t0 = neuesTurnier("Beispiel-Turnier"); D = { akt: t0.id, turniere: {} }; D.turniere[t0.id] = t0; }
  var sichern = function () { KW.save(KEY, D); };
  var T = function () { return D.turniere[D.akt]; };
  var tab = "plan", nurLesen = false, LT = null; // LT = Turnier aus geteiltem Link

  /* ---------- Rechnen ---------- */
  function rundenRR(liste) { // Kreis-Methode: jeder gegen jeden
    var l = liste.slice(); if (l.length % 2) l.push(null);
    var n = l.length, runden = [];
    for (var r = 0; r < n - 1; r++) {
      var paare = [];
      for (var i = 0; i < n / 2; i++) { var a = l[i], b = l[n - 1 - i]; if (a !== null && b !== null) paare.push(r % 2 ? [b, a] : [a, b]); }
      runden.push(paare); l.splice(1, 0, l.pop());
    }
    return runden;
  }
  function gruppenVon(t) {
    var g = t.modus === "gruppen" ? Math.max(1, Math.min(t.gruppen, Math.floor(t.teams.length / 2))) : 1, out = [];
    for (var i = 0; i < g; i++) out.push([]);
    t.teams.forEach(function (_, i) { var r = Math.floor(i / g), k = i % g; out[r % 2 ? g - 1 - k : k].push(i); }); // Schlange, damit die Gruppen ausgeglichen sind
    return out;
  }
  var GN = "ABCDEFGH";
  function gruppenSpiele(t) {
    if (t.modus === "ko") return [];
    var gr = gruppenVon(t), proGruppe = gr.map(function (g) { var r = rundenRR(g); if (t.rueck) r = r.concat(r.map(function (p) { return p.map(function (x) { return [x[1], x[0]]; }); })); return r; });
    var max = Math.max.apply(null, proGruppe.map(function (r) { return r.length; })), spiele = [];
    for (var r = 0; r < max; r++) proGruppe.forEach(function (rs, gi) { (rs[r] || []).forEach(function (p) { var k = "g" + gi + "-" + r + "-" + p[0] + "-" + p[1]; spiele.push({ key: k, gruppe: gi, runde: r, a: p[0], b: p[1], e: t.erg[k] }); }); });
    return spiele;
  }
  function tabelle(t, spiele, gi) {
    var gr = gruppenVon(t)[gi], z = {};
    gr.forEach(function (i) { z[i] = { i: i, sp: 0, s: 0, u: 0, n: 0, tp: 0, tm: 0, p: 0 }; });
    spiele.forEach(function (s) {
      if (s.gruppe !== gi || !s.e) return;
      var a = z[s.a], b = z[s.b], x = s.e[0], y = s.e[1];
      a.sp++; b.sp++; a.tp += x; a.tm += y; b.tp += y; b.tm += x;
      if (x > y) { a.s++; b.n++; a.p += t.sieg; } else if (x < y) { b.s++; a.n++; b.p += t.sieg; } else { a.u++; b.u++; a.p++; b.p++; }
    });
    return Object.keys(z).map(function (k) { return z[k]; }).sort(function (a, b) { return b.p - a.p || (b.tp - b.tm) - (a.tp - a.tm) || b.tp - a.tp || t.teams[a.i].localeCompare(t.teams[b.i]); });
  }
  function setzliste(size) { var l = [1]; while (l.length < size) { var n = l.length * 2 + 1, neu = []; l.forEach(function (s) { neu.push(s, n - s); }); l = neu; } return l; }
  function koTeams(t) { return t.modus === "ko" ? t.teams.map(function (_, i) { return i; }) : t.modus === "gruppen" ? t.koTeams : null; }
  function ko(t) { // → Runden mit Spielen {a,b,e,w}; a/b: Teamindex, null = Freilos, undefined = steht noch nicht fest
    var tl = koTeams(t); if (!tl || tl.length < 2) return null;
    var size = 1; while (size < tl.length) size *= 2;
    var sl = setzliste(size), runden = [], erste = [];
    for (var i = 0; i < size / 2; i++) { var sa = sl[2 * i], sb = sl[2 * i + 1]; erste.push({ a: sa <= tl.length ? tl[sa - 1] : null, b: sb <= tl.length ? tl[sb - 1] : null }); }
    runden.push(erste);
    while (runden[runden.length - 1].length > 1) { var v = runden[runden.length - 1], n = []; for (var j = 0; j < v.length; j += 2) n.push({ a: undefined, b: undefined }); runden.push(n); }
    runden.forEach(function (r, ri) {
      r.forEach(function (s, si) {
        if (ri > 0) { s.a = runden[ri - 1][2 * si].w; s.b = runden[ri - 1][2 * si + 1].w; }
        s.key = "k" + ri + "-" + si; s.e = t.koErg[s.key];
        if (s.a === null && s.b === null) s.w = null;
        else if (s.a === null) s.w = s.b; else if (s.b === null) s.w = s.a;
        else if (s.a === undefined || s.b === undefined || !s.e) s.w = undefined;
        else s.w = s.e[0] > s.e[1] ? s.a : s.e[1] > s.e[0] ? s.b : s.e[2] === "a" ? s.a : s.e[2] === "b" ? s.b : undefined;
      });
    });
    return runden;
  }
  function rundenName(n, ri) { var rest = n - ri; return rest === 1 ? "Finale" : rest === 2 ? "Halbfinale" : rest === 3 ? "Viertelfinale" : rest === 4 ? "Achtelfinale" : "Runde " + (ri + 1); }
  function zeitText(t, slot) { var m = /^(\d{1,2}):(\d{2})$/.exec(t.start || ""); if (!m) return ""; var min = +m[1] * 60 + +m[2] + slot * ((+t.dauer || 0) + (+t.pause || 0)); return String(Math.floor(min / 60) % 24).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0"); }
  function planen(t) { // Zeiten und Felder verteilen
    var gs = gruppenSpiele(t), f = Math.max(1, +t.felder || 1);
    gs.forEach(function (s, k) { s.slot = Math.floor(k / f); s.feld = k % f + 1; s.zeit = zeitText(t, s.slot); });
    var basis = gs.length ? gs[gs.length - 1].slot + 1 : 0, kr = ko(t);
    if (kr) kr.forEach(function (r) { var k = 0; r.forEach(function (s) { if (s.a === null || s.b === null) return; s.slot = basis + Math.floor(k / f); s.feld = k % f + 1; s.zeit = zeitText(t, s.slot); k++; }); basis = (k ? Math.floor((k - 1) / f) + 1 : 0) + basis; });
    return { gs: gs, ko: kr };
  }
  var name = function (t, i) { return i === null ? "Freilos" : i === undefined ? "?" : esc(t.teams[i] || "?"); };

  /* ---------- Teilen (Link mit komprimierten Daten) ---------- */
  function b64u(b) { var s = ""; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function unb64u(t) { t = t.replace(/-/g, "+").replace(/_/g, "/"); while (t.length % 4) t += "="; var s = atob(t), b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
  function packen(o) { var r = new TextEncoder().encode(JSON.stringify(o)); if (!window.CompressionStream) return Promise.resolve("u" + b64u(r)); return new Response(new Blob([r]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer().then(function (a) { return "z" + b64u(new Uint8Array(a)); }); }
  function entpacken(s) { var b = unb64u(s.slice(1)); if (s[0] === "u") return Promise.resolve(JSON.parse(new TextDecoder().decode(b))); return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text().then(JSON.parse); }
  function linkBauen(t) { return packen(Object.assign({}, t, { stand: Date.now() })).then(function (p) { return location.origin + location.pathname.replace(/index\.html$/, "") + "#t=" + p; }); }

  /* ---------- Oberfläche ---------- */
  function zeichne() {
    var t = T();
    document.body.classList.remove("beamer");
    app.innerHTML = '<div class="t-oben"><select class="inp" id="wahl" aria-label="Turnier wählen">' + Object.keys(D.turniere).map(function (id) { return '<option value="' + id + '"' + (id === D.akt ? " selected" : "") + ">" + esc(D.turniere[id].name) + "</option>"; }).join("") + '</select><button type="button" class="btn" id="neu">+ Neues Turnier</button><button type="button" class="btn" id="loeschen">Löschen</button></div>' +
      '<div class="tabs" role="tablist">' + [["einst", "⚙ Teams & Regeln"], ["plan", "📋 Spielplan"], ["tab", "📊 Tabelle"], ["ko", "🏆 K.-o."], ["teilen", "📢 Beamer & Teilen"]].filter(function (x) { return x[0] !== "ko" || t.modus !== "liga"; }).filter(function (x) { return x[0] !== "tab" || t.modus !== "ko"; }).map(function (x) { return '<button type="button" role="tab" data-tab="' + x[0] + '" aria-selected="' + (tab === x[0]) + '">' + x[1] + "</button>"; }).join("") + '</div><div class="t-tab" id="inhalt"></div>';
    $("#wahl").onchange = function () { D.akt = this.value; sichern(); zeichne(); };
    $("#neu").onclick = function () { var n = prompt("Name des Turniers:", "Turnier " + (Object.keys(D.turniere).length + 1)); if (!n) return; var x = neuesTurnier(n); x.teams = []; D.turniere[x.id] = x; D.akt = x.id; tab = "einst"; sichern(); zeichne(); };
    $("#loeschen").onclick = function () { if (!confirm("Turnier „" + t.name + "“ mit allen Ergebnissen löschen?")) return; delete D.turniere[t.id]; var ids = Object.keys(D.turniere); if (!ids.length) { var x = neuesTurnier(); D.turniere[x.id] = x; ids = [x.id]; } D.akt = ids[0]; sichern(); zeichne(); };
    app.querySelectorAll("[data-tab]").forEach(function (b) { b.onclick = function () { tab = b.dataset.tab; zeichne(); }; });
    if ((tab === "ko" && t.modus === "liga") || (tab === "tab" && t.modus === "ko")) tab = "plan";
    ({ einst: einst, plan: plan, tab: tabellen, ko: koZeigen, teilen: teilen })[tab](t);
  }
  function hatErg(t) { return Object.keys(t.erg).length + Object.keys(t.koErg).length > 0; }

  function einst(t) {
    var el = $("#inhalt");
    el.innerHTML = '<div class="card" style="padding:14px"><div class="field"><label for="tName">Name</label><input class="inp" id="tName" value="' + esc(t.name) + '"></div><div class="field"><label for="tSport">Sportart / Spiel</label><input class="inp" id="tSport" value="' + esc(t.sport) + '" placeholder="z. B. Fußball, Tischtennis, Mario Kart"></div>' +
      '<div class="field"><label for="tModus">Modus</label><select class="inp" id="tModus"><option value="liga"' + (t.modus === "liga" ? " selected" : "") + '>Jeder gegen jeden (Liga)</option><option value="gruppen"' + (t.modus === "gruppen" ? " selected" : "") + '>Gruppen, danach K.-o.</option><option value="ko"' + (t.modus === "ko" ? " selected" : "") + ">Nur K.-o.</option></select></div>" +
      (t.modus === "gruppen" ? '<div class="row" style="gap:10px;flex-wrap:wrap"><label>Gruppen <input class="inp" id="tGr" style="width:70px" inputmode="numeric" value="' + t.gruppen + '"></label><label>Weiter pro Gruppe <select class="inp" id="tWeiter" style="width:auto">' + [1, 2, 4].map(function (n) { return '<option value="' + n + '"' + (t.weiter === n ? " selected" : "") + ">" + n + "</option>"; }).join("") + "</select></label></div>" : "") +
      (t.modus !== "ko" ? '<div class="row" style="gap:10px;flex-wrap:wrap;margin-top:8px"><label>Punkte für Sieg <select class="inp" id="tSieg" style="width:auto"><option value="3"' + (t.sieg === 3 ? " selected" : "") + '>3</option><option value="2"' + (t.sieg === 2 ? " selected" : "") + '>2</option></select></label><label class="row" style="gap:6px"><input type="checkbox" id="tRueck"' + (t.rueck ? " checked" : "") + "> Hin- und Rückspiel</label></div>" : "") +
      '<div class="row" style="gap:10px;flex-wrap:wrap;margin-top:8px"><label>Start <input class="inp" id="tStart" type="time" value="' + esc(t.start) + '" style="width:auto"></label><label>Spieldauer (Min.) <input class="inp" id="tDauer" style="width:70px" inputmode="numeric" value="' + t.dauer + '"></label><label>Pause (Min.) <input class="inp" id="tPause" style="width:70px" inputmode="numeric" value="' + t.pause + '"></label><label>Felder / Tische <input class="inp" id="tFelder" style="width:70px" inputmode="numeric" value="' + t.felder + '"></label></div></div>' +
      '<h2>Teams (' + t.teams.length + ')</h2><div class="card" style="padding:14px"><p class="muted" style="margin-top:0">Ein Team pro Zeile. Bei K.-o. ist die Reihenfolge die Setzliste (die Stärksten zuerst).</p><textarea class="inp" id="tTeams" style="width:100%;min-height:200px;box-sizing:border-box">' + esc(t.teams.join("\n")) + '</textarea><div class="row" style="gap:8px;margin-top:8px"><button type="button" class="btn primary" id="tUeber">Teams übernehmen</button><button type="button" class="btn" id="tMisch">🎲 Zufällig mischen</button></div></div>';
    var zahl = function (id, k, min, max) { var e = $(id); if (e) e.onchange = function () { t[k] = Math.max(min, Math.min(max, parseInt(this.value, 10) || min)); sichern(); }; };
    $("#tName").oninput = function () { t.name = this.value; sichern(); var o = $("#wahl option:checked"); if (o) o.textContent = t.name; };
    $("#tSport").oninput = function () { t.sport = this.value; sichern(); };
    $("#tModus").onchange = function () { if (hatErg(t) && !confirm("Modus wechseln? Alle Ergebnisse werden gelöscht.")) { this.value = t.modus; return; } t.modus = this.value; t.erg = {}; t.koErg = {}; t.koTeams = null; sichern(); zeichne(); };
    var gr = $("#tGr"); if (gr) gr.onchange = function () { if (hatErg(t) && !confirm("Gruppen ändern? Alle Ergebnisse werden gelöscht.")) { this.value = t.gruppen; return; } t.gruppen = Math.max(1, Math.min(8, parseInt(this.value, 10) || 1)); t.erg = {}; t.koErg = {}; t.koTeams = null; sichern(); };
    var w = $("#tWeiter"); if (w) w.onchange = function () { t.weiter = +this.value; sichern(); };
    var s = $("#tSieg"); if (s) s.onchange = function () { t.sieg = +this.value; sichern(); };
    var r = $("#tRueck"); if (r) r.onchange = function () { if (hatErg(t) && !confirm("Ändern? Alle Ergebnisse werden gelöscht.")) { this.checked = t.rueck; return; } t.rueck = this.checked; t.erg = {}; sichern(); };
    $("#tStart").onchange = function () { t.start = this.value; sichern(); };
    zahl("#tDauer", "dauer", 1, 300); zahl("#tPause", "pause", 0, 120); zahl("#tFelder", "felder", 1, 20);
    $("#tUeber").onclick = function () {
      var neu = $("#tTeams").value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
      if (neu.length > 64) return KW.toast("Höchstens 64 Teams.");
      if (neu.length !== t.teams.length && hatErg(t)) { if (!confirm("Die Anzahl der Teams ändert sich – alle Ergebnisse werden gelöscht. Weiter?")) return; t.erg = {}; t.koErg = {}; t.koTeams = null; }
      t.teams = neu; sichern(); KW.toast("✔ " + neu.length + " Teams"); zeichne();
    };
    $("#tMisch").onclick = function () { var l = $("#tTeams").value.split("\n").filter(function (x) { return x.trim(); }); for (var i = l.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = l[i]; l[i] = l[j]; l[j] = x; } $("#tTeams").value = l.join("\n"); };
  }

  function ergEingabe(wurzel, t) { // Schlüssel mit „k…“ = K.-o.-Spiel, sonst Gruppenspiel
    wurzel.querySelectorAll("[data-e]").forEach(function (inp) {
      inp.addEventListener("change", function () {
        var k = inp.dataset.e, ziel = k[0] === "k" ? "koErg" : "erg", p = wurzel.querySelectorAll('[data-e="' + k + '"]'), a = p[0].value.trim(), b = p[1].value.trim();
        if (a !== "" && b !== "" && /^\d+$/.test(a) && /^\d+$/.test(b)) { var alt = t[ziel][k] || []; t[ziel][k] = [+a, +b].concat(+a === +b && alt[2] ? [alt[2]] : []); }
        else if (a === "" && b === "") delete t[ziel][k];
        else return;
        sichern(); zeichne();
      });
    });
  }
  function plan(t) {
    var el = $("#inhalt"), p = planen(t);
    if (t.teams.length < 2) { el.innerHTML = '<p class="muted">Erst unter „Teams &amp; Regeln“ mindestens zwei Teams eintragen.</p>'; return; }
    var h = "", letzt = -1;
    p.gs.forEach(function (s) {
      if (s.slot !== letzt) { h += '<h3 class="t-runde">' + (s.zeit ? s.zeit + " Uhr" : "Runde " + (s.slot + 1)) + "</h3>"; letzt = s.slot; }
      h += spielZeile(t, s, "e", p.gs.length && t.modus === "gruppen" ? "Gr. " + GN[s.gruppe] : "");
    });
    if (p.ko) p.ko.forEach(function (r, ri) { var echte = r.filter(function (s) { return s.a !== null && s.b !== null; }); if (!echte.length) return; h += '<h3 class="t-runde">' + rundenName(p.ko.length, ri) + (echte[0].zeit ? " · ab " + echte[0].zeit + " Uhr" : "") + "</h3>"; echte.forEach(function (s) { h += spielZeile(t, s, "k", ""); }); });
    if (t.modus === "gruppen" && !t.koTeams) h += '<p class="muted" style="margin-top:14px">Die K.-o.-Runde startest du im Reiter „🏆 K.-o.“, wenn die Gruppenspiele fertig sind.</p>';
    el.innerHTML = '<div class="row no-print" style="gap:8px;margin-bottom:6px"><button type="button" class="btn small" id="druck">🖨 Spielplan drucken</button></div><div class="card" style="padding:4px 12px 12px">' + h + "</div>";
    $("#druck").onclick = function () { window.print(); };
    ergEingabe(el, t);
  }
  function spielZeile(t, s, art, extra) {
    var e = s.e || [], fertig = !!s.e, wa = fertig && (e[0] > e[1] || e[2] === "a"), wb = fertig && (e[1] > e[0] || e[2] === "b"), offen = s.a === undefined || s.b === undefined;
    return '<div class="t-spiel' + (fertig ? " fertig" : "") + '"><div class="zeit">' + [t.felder > 1 && s.feld ? "Feld " + s.feld : "", extra].filter(Boolean).join("<br>") + '</div><div class="a' + (wa ? " sieg" : "") + '">' + name(t, s.a) + '</div><input class="inp" data-e="' + s.key + '" value="' + (e.length ? e[0] : "") + '" inputmode="numeric" aria-label="Tore ' + name(t, s.a) + '"' + (offen || nurLesen ? " disabled" : "") + '><span>:</span><input class="inp" data-e="' + s.key + '" value="' + (e.length ? e[1] : "") + '" inputmode="numeric" aria-label="Tore ' + name(t, s.b) + '"' + (offen || nurLesen ? " disabled" : "") + '><div class="b' + (wb ? " sieg" : "") + '">' + name(t, s.b) + "</div></div>";
  }
  function tabelleHtml(t, gs, gi, weiterAnz) {
    return '<table class="t-tab-tabelle"><thead><tr><th>#</th><th>Team</th><th title="Spiele">Sp</th><th title="Siege">S</th><th title="Unentschieden">U</th><th title="Niederlagen">N</th><th>Tore</th><th title="Differenz">Diff</th><th>Pkt</th></tr></thead><tbody>' +
      tabelle(t, gs, gi).map(function (z, i) { return '<tr class="' + (i < weiterAnz ? "weiter" : "") + '"><td>' + (i + 1) + "</td><td>" + name(t, z.i) + "</td><td>" + z.sp + "</td><td>" + z.s + "</td><td>" + z.u + "</td><td>" + z.n + "</td><td>" + z.tp + ":" + z.tm + "</td><td>" + (z.tp - z.tm > 0 ? "+" : "") + (z.tp - z.tm) + "</td><td><b>" + z.p + "</b></td></tr>"; }).join("") + "</tbody></table>";
  }
  function tabellen(t) {
    var gs = gruppenSpiele(t), gr = gruppenVon(t);
    $("#inhalt").innerHTML = gr.map(function (_, gi) { return '<div class="card" style="padding:12px;margin-bottom:12px">' + (gr.length > 1 ? '<h2 style="margin-top:0">Gruppe ' + GN[gi] + "</h2>" : "") + tabelleHtml(t, gs, gi, t.modus === "gruppen" ? t.weiter : 0) + "</div>"; }).join("") + '<p class="muted">Reihenfolge: Punkte, dann Tordifferenz, dann mehr Tore.' + (t.modus === "gruppen" ? " Grün markiert = kommt weiter." : "") + "</p>";
  }
  function koZeigen(t) {
    var el = $("#inhalt");
    if (t.modus === "gruppen" && !t.koTeams) {
      var gs = gruppenSpiele(t), offen = gs.filter(function (s) { return !s.e; }).length;
      el.innerHTML = '<div class="card" style="padding:14px"><p>' + (offen ? "Noch " + offen + " Gruppenspiele ohne Ergebnis." : "✔ Alle Gruppenspiele sind fertig.") + '</p><button type="button" class="btn primary" id="koLos">🏆 K.-o.-Runde starten</button><p class="muted">Pro Gruppe kommen ' + t.weiter + " Teams weiter. Gruppensieger spielen gegen Zweite anderer Gruppen.</p></div>";
      $("#koLos").onclick = function () {
        if (offen && !confirm("Es fehlen noch Ergebnisse. Trotzdem mit dem jetzigen Stand starten?")) return;
        var tabs = gruppenVon(t).map(function (_, gi) { return tabelle(t, gs, gi); }), q = [];
        for (var platz = 0; platz < t.weiter; platz++) tabs.forEach(function (tb) { if (tb[platz]) q.push(tb[platz].i); });
        t.koTeams = q; t.koErg = {}; sichern(); zeichne();
      };
      return;
    }
    var kr = ko(t);
    if (!kr) { el.innerHTML = '<p class="muted">Für K.-o. braucht es mindestens zwei Teams.</p>'; return; }
    var meister = kr[kr.length - 1][0].w;
    el.innerHTML = (meister !== undefined && meister !== null ? '<div class="t-sieger">🏆 Sieger: ' + name(t, meister) + "</div>" : "") + '<div class="t-baum">' + kr.map(function (r, ri) {
      return '<div class="r"><h3>' + rundenName(kr.length, ri) + "</h3>" + r.map(function (s) {
        if (s.a === null || s.b === null) return '<div class="t-ko" style="opacity:.5"><div class="z"><span>' + name(t, s.a === null ? s.b : s.a) + "</span><span>Freilos</span></div></div>";
        var e = s.e || [], offen = s.a === undefined || s.b === undefined, gleich = s.e && e[0] === e[1];
        return '<div class="t-ko"><div class="z' + (s.w === s.a && s.w !== undefined ? " gew" : "") + '"><span>' + name(t, s.a) + '</span><input class="inp" data-e="' + s.key + '" value="' + (e.length ? e[0] : "") + '" inputmode="numeric" aria-label="Ergebnis ' + name(t, s.a) + '"' + (offen || nurLesen ? " disabled" : "") + '></div><div class="z' + (s.w === s.b && s.w !== undefined ? " gew" : "") + '"><span>' + name(t, s.b) + '</span><input class="inp" data-e="' + s.key + '" value="' + (e.length ? e[1] : "") + '" inputmode="numeric" aria-label="Ergebnis ' + name(t, s.b) + '"' + (offen || nurLesen ? " disabled" : "") + "></div>" +
          (gleich && !nurLesen ? '<div class="elf">' + (e[2] ? "Entschieden (Elfmeter o. Ä.) – ändern:" : "Unentschieden – wer gewinnt (Elfmeter, Verlängerung …)?") + ' <button type="button" class="btn small' + (e[2] === "a" ? " primary" : "") + '" data-elf="' + s.key + '" data-w="a">' + name(t, s.a) + '</button> <button type="button" class="btn small' + (e[2] === "b" ? " primary" : "") + '" data-elf="' + s.key + '" data-w="b">' + name(t, s.b) + "</button></div>" : "") + (s.zeit ? '<div class="elf">' + s.zeit + " Uhr" + (t.felder > 1 ? " · Feld " + s.feld : "") + "</div>" : "") + "</div>";
      }).join("") + "</div>";
    }).join("") + "</div>" + (t.modus === "gruppen" && !nurLesen ? '<p><button type="button" class="btn small" id="koReset">K.-o.-Runde neu auslosen (aus den Tabellen)</button></p>' : "");
    if (nurLesen) return;
    ergEingabe(el, t);
    el.querySelectorAll("[data-elf]").forEach(function (b) { b.onclick = function () { var e = t.koErg[b.dataset.elf]; e[2] = b.dataset.w; sichern(); zeichne(); }; });
    var rs = $("#koReset"); if (rs) rs.onclick = function () { if (confirm("K.-o.-Runde löschen und neu aus den Tabellen bilden?")) { t.koTeams = null; t.koErg = {}; sichern(); zeichne(); } };
  }

  /* ---------- Beamer / Zuschauer ---------- */
  function beamer(t, lesen) {
    document.body.classList.add("beamer");
    var p = planen(t), gr = gruppenVon(t), alle = p.gs.slice();
    if (p.ko) p.ko.forEach(function (r, ri) { r.forEach(function (s) { if (s.a !== null && s.b !== null) { s.rn = rundenName(p.ko.length, ri); alle.push(s); } }); });
    var naechste = alle.filter(function (s) { return !s.e && s.a !== undefined && s.b !== undefined; }).slice(0, 6), letzte = alle.filter(function (s) { return s.e; }).slice(-5).reverse();
    var meister = p.ko ? p.ko[p.ko.length - 1][0].w : undefined;
    var links = t.modus === "ko" || (t.modus === "gruppen" && t.koTeams) ? koMini(t, p.ko) : gr.map(function (_, gi) { return '<div class="card" style="padding:12px;margin-bottom:12px">' + (gr.length > 1 ? "<h2 style=\"margin-top:0\">Gruppe " + GN[gi] + "</h2>" : "") + tabelleHtml(t, p.gs, gi, t.modus === "gruppen" ? t.weiter : 0) + "</div>"; }).join("");
    app.innerHTML = '<div class="bm-kopf"><h1>' + esc(t.name) + (t.sport ? ' <span style="opacity:.6;font-weight:400">· ' + esc(t.sport) + "</span>" : "") + "</h1>" + (lesen ? '<span style="opacity:.6">Stand: ' + new Date(t.stand || Date.now()).toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" }) + " Uhr</span>" : '<button type="button" id="bmZu">✕ Schließen</button>') + "</div>" +
      (meister !== undefined && meister !== null ? '<div class="t-sieger" style="font-size:2rem">🏆 ' + name(t, meister) + "</div>" : "") +
      '<div class="bm-zwei"><div>' + links + '</div><div><h2>Als Nächstes</h2>' + (naechste.length ? naechste.map(function (s) { return '<div class="bm-spiel"><span class="z">' + (s.zeit || "") + (t.felder > 1 && s.feld ? " F" + s.feld : "") + "</span><span style=\"flex:1\">" + name(t, s.a) + " – " + name(t, s.b) + (s.rn ? ' <small style="opacity:.6">' + s.rn + "</small>" : "") + "</span></div>"; }).join("") : '<p style="opacity:.6">Keine offenen Spiele.</p>') +
      '<h2 style="margin-top:3vh">Ergebnisse</h2>' + letzte.map(function (s) { return '<div class="bm-spiel"><span style="flex:1">' + name(t, s.a) + " – " + name(t, s.b) + "</span><b>" + s.e[0] + ":" + s.e[1] + (s.e[2] ? " n.E." : "") + "</b></div>"; }).join("") + "</div></div>";
    var zu = $("#bmZu"); if (zu) zu.onclick = function () { if (document.fullscreenElement) document.exitFullscreen().catch(function () {}); tab = "teilen"; zeichne(); };
  }
  function koMini(t, kr) {
    if (!kr) return "";
    return '<div class="t-baum">' + kr.map(function (r, ri) { return '<div class="r"><h3>' + rundenName(kr.length, ri) + "</h3>" + r.filter(function (s) { return s.a !== null && s.b !== null; }).map(function (s) { var e = s.e || []; return '<div class="t-ko"><div class="z' + (s.w === s.a && s.w !== undefined ? " gew" : "") + '"><span>' + name(t, s.a) + "</span><b>" + (e.length ? e[0] : "") + '</b></div><div class="z' + (s.w === s.b && s.w !== undefined ? " gew" : "") + '"><span>' + name(t, s.b) + "</span><b>" + (e.length ? e[1] : "") + "</b></div></div>"; }).join("") + "</div>"; }).join("") + "</div>";
  }
  function teilen(t) {
    var el = $("#inhalt");
    el.innerHTML = '<div class="card" style="padding:14px"><h2 style="margin-top:0">📺 Beamer-Ansicht</h2><p class="muted">Große Ansicht mit Tabelle, nächsten Spielen und Ergebnissen – für Fernseher oder Beamer in der Halle. Auf einem zweiten Gerät öffnen und Ergebnisse auf dem ersten eintragen geht nicht automatisch – dann lieber den Link unten neu teilen.</p><button type="button" class="btn primary" id="bm">📺 Beamer-Ansicht öffnen</button></div>' +
      '<div class="card" style="padding:14px;margin-top:12px"><h2 style="margin-top:0">📢 Für Zuschauer teilen</h2><p class="muted">Der Link enthält den aktuellen Stand. Neue Ergebnisse? Einfach neuen Link oder QR-Code erzeugen.</p><div class="row" style="gap:14px;align-items:center;flex-wrap:wrap"><div id="qr" style="width:170px;background:#fff;padding:8px;border-radius:8px"></div><div><button type="button" class="btn" id="kop">🔗 Link kopieren</button><p class="muted" id="lInfo"></p></div></div></div>';
    $("#bm").onclick = function () { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {}); beamer(t, false); };
    linkBauen(t).then(function (l) {
      try { var q = window.qrcode(0, "L"); q.addData(l); q.make(); $("#qr").innerHTML = q.createSvgTag({ cellSize: 3, margin: 0, scalable: true }); } catch (e) { $("#qr").textContent = "Zu viele Daten für einen QR-Code – bitte den Link schicken."; }
      $("#lInfo").textContent = l.length + " Zeichen";
      $("#kop").onclick = function () { (navigator.clipboard ? navigator.clipboard.writeText(l) : Promise.reject()).then(function () { KW.toast("Link kopiert."); }, function () { prompt("Link kopieren:", l); }); };
    });
  }

  /* ---------- Start ---------- */
  var m = location.hash.match(/^#t=(.+)$/);
  if (m) {
    nurLesen = true;
    entpacken(m[1]).then(function (x) { LT = x; beamer(LT, true); var k = document.createElement("p"); k.style.cssText = "opacity:.6;margin-top:3vh"; k.innerHTML = 'Turnier geplant mit <a style="color:#fff" href="./">FIDELIA Turnier</a>'; app.appendChild(k); }).catch(function () { app.innerHTML = "<p>Dieser Turnier-Link ist kaputt.</p>"; });
  } else {
    zeichne();
    KW.footer("turnier", function () { return D; }, function (d) { D = d; sichern(); zeichne(); });
  }
  window.addEventListener("hashchange", function () { location.reload(); });
})();
