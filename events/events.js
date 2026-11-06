/* OMNIVIA Events – Einladungen mit Zusagen und „Wer bringt was mit“.
   Alles ist mit einem Schlüssel verschlüsselt, der nur im Einladungs-Link steht (nach dem #).
   Der Server sieht nur Kauderwelsch. Gäste brauchen kein Konto, nur ihren Vornamen. */
(function () {
  "use strict";
  var esc = KW.esc, $ = function (id) { return document.getElementById(id); }, S = crypto.subtle, TE = new TextEncoder(), TD = new TextDecoder();
  var DEMO = (location.search.match(/[?&]demo=([a-z0-9]{1,12})/) || [])[1] || null;
  var LKEY = "kw-events" + (DEMO ? "-" + DEMO : "");
  var L = KW.load(LKEY, null) || { meine: {}, name: "" };
  function merken() { KW.save(LKEY, L); }

  /* ---------- Verschlüsselung ---------- */
  function b64(buf) { var b = new Uint8Array(buf), s = ""; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function unb64(s) { s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; var r = atob(s), b = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) b[i] = r.charCodeAt(i); return b; }
  function zufall(n) { return crypto.getRandomValues(new Uint8Array(n)); }
  var schluessel = {};
  function key(roh) { return schluessel[roh] || (schluessel[roh] = S.importKey("raw", unb64(roh), "AES-GCM", false, ["encrypt", "decrypt"])); }
  async function zu(roh, obj, zusatz) { var iv = zufall(12), ct = await S.encrypt({ name: "AES-GCM", iv: iv, additionalData: TE.encode(zusatz) }, await key(roh), TE.encode(JSON.stringify(obj))); return { iv: b64(iv), ct: b64(ct) }; }
  async function auf(roh, x, zusatz) { var pt = await S.decrypt({ name: "AES-GCM", iv: unb64(x.iv), additionalData: TE.encode(zusatz) }, await key(roh), unb64(x.ct)); return JSON.parse(TD.decode(pt)); }

  /* ---------- Server (Firebase oder Übungs-Server) ---------- */
  var CFG = { apiKey: "AIzaSyBaCkktmwGDgr6v_8p85aa2Fl6NsjODFMQ", authDomain: "krawallzoo.firebaseapp.com", databaseURL: "https://krawallzoo-default-rtdb.europe-west1.firebasedatabase.app", projectId: "krawallzoo" };
  var FB = "https://cdn.jsdelivr.net/npm/firebase@10.12.2/", B = null;
  function skript(src) { return new Promise(function (ok, nein) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = nein; document.head.appendChild(s); }); }
  async function server() {
    if (B) return B;
    if (DEMO) {
      var K = "events-demo-baum", h = [];
      var lies = function () { try { return JSON.parse(localStorage.getItem(K) || "{}"); } catch (e) { return {}; } };
      var bei = function (b, p) { return p.split("/").reduce(function (x, t) { return x && typeof x === "object" ? x[t] : undefined; }, b); };
      var setz = function (p, v) { var b = lies(), t = p.split("/"), x = b; for (var i = 0; i < t.length - 1; i++) { x[t[i]] = x[t[i]] || {}; x = x[t[i]]; } if (v === null) delete x[t[t.length - 1]]; else x[t[t.length - 1]] = v; localStorage.setItem(K, JSON.stringify(b)); setTimeout(function () { h.forEach(function (f) { f(); }); }, 0); return Promise.resolve(); };
      addEventListener("storage", function (e) { if (e.key === K) h.forEach(function (f) { f(); }); });
      B = { uid: "uid-" + DEMO, TS: Date.now(), hol: function (p) { return Promise.resolve(bei(lies(), "events/" + p) || null); }, setz: function (p, v) { return setz("events/" + p, v); }, weg: function (p) { return setz("events/" + p, null); },
        wert: function (p, cb) { var alt; var f = function () { var s = JSON.stringify(bei(lies(), "events/" + p) || null); if (s !== alt) { alt = s; cb(JSON.parse(s)); } }; h.push(f); setTimeout(f, 0); return function () { h = h.filter(function (x) { return x !== f; }); }; } };
      return B;
    }
    if (!window.firebase) { await skript(FB + "firebase-app-compat.js"); await skript(FB + "firebase-auth-compat.js"); await skript(FB + "firebase-database-compat.js"); }
    if (!firebase.apps.length) firebase.initializeApp(CFG);
    var auth = firebase.auth(), d = firebase.database();
    await new Promise(function (r) { var u = auth.onAuthStateChanged(function () { u(); r(); }); });
    if (!auth.currentUser) await auth.signInAnonymously();
    var P = function (p) { return d.ref("events/" + p); };
    B = { uid: auth.currentUser.uid, TS: firebase.database.ServerValue.TIMESTAMP, hol: function (p) { return P(p).once("value").then(function (s) { return s.val(); }); }, setz: function (p, v) { return P(p).set(v); }, weg: function (p) { return P(p).remove(); },
      wert: function (p, cb) { var r = P(p), f = function (s) { cb(s.val()); }; r.on("value", f, function () { cb(null); }); return function () { r.off("value", f); }; } };
    return B;
  }
  function fehler(e) { var m = String(e && (e.code || e.message) || e); return /permission/i.test(m) ? "Der Server hat das abgelehnt. (Für den Chef: Sind die Firebase-Regeln für Events eingefügt?)" : /network|fetch|offline/i.test(m) ? "Keine Verbindung – bist du online?" : m; }

  /* ---------- Hilfen ---------- */
  var WTAG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  function datumLang(d) { if (!d) return ""; var x = KW.parse(d); return WTAG[x.getDay()] + ", " + x.getDate() + ". " + ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"][x.getMonth()] + " " + x.getFullYear(); }
  function link(id, k) { return location.origin + location.pathname + "?e=" + id + "#" + k; }
  var EMO = ["🎉", "🎂", "🍕", "⚽", "🎮", "🎤", "🏕️", "🎄", "🏊", "🍿", "🎨", "🏡"];
  var fenster = $("fenster"), fin = $("fensterIn");
  function oeffne(html, setup) { fin.innerHTML = html; if (!fenster.open) fenster.showModal(); if (setup) setup(fin); var f = fin.querySelector("[autofocus]"); if (f) setTimeout(function () { f.focus(); }, 50); }
  function schliessen() { if (fenster.open) fenster.close(); }
  fenster.addEventListener("click", function (e) { if (e.target === fenster) schliessen(); });
  function v(id) { var e = fin.querySelector("#" + id); return e ? e.value.trim() : ""; }

  /* ---------- Start: meine Events ---------- */
  var ev = null, abo = null; // offenes Event {id, k, meta, gaeste, mit}
  function start() {
    var m = location.search.match(/[?&]e=([A-Za-z0-9_-]{16,24})/), k = location.hash.slice(1);
    if (m && /^[A-Za-z0-9_-]{43}$/.test(k)) { L.meine[m[1]] = L.meine[m[1]] || { k: k }; L.meine[m[1]].k = k; merken(); oeffnen(m[1]); return; }
    if (m) { $("ansicht").innerHTML = '<div class="empty"><b>Dieser Link ist unvollständig</b>Bitte lass dir den ganzen Einladungs-Link nochmal schicken.</div>'; return; }
    liste();
  }
  async function liste() {
    if (abo) { abo(); abo = null; } ev = null;
    history.replaceState(null, "", location.pathname + location.search.replace(/[?&]e=[^&]*/, "").replace(/^&/, "?"));
    var ids = Object.keys(L.meine);
    var h = '<div class="hallo"><div class="gross" aria-hidden="true">🎉</div><h2>Einladen leicht gemacht</h2><p>Erstell eine Einladung, schick den Link – deine Gäste sagen zu und tragen ein, was sie mitbringen. Ohne Anmeldung, verschlüsselt, ohne Werbung.</p><button class="btn primary" type="button" data-a="neu">＋ Neue Einladung</button></div>';
    if (ids.length) {
      h += '<h2 class="sec">Deine Events</h2><div class="liste">';
      var daten = [];
      try { await server(); for (var i = 0; i < ids.length; i++) { var x = L.meine[ids[i]]; var roh = await B.hol(ids[i] + "/meta").catch(function () { return null; }); var meta = null; if (roh) try { meta = await auf(x.k, roh, ids[i] + "/meta"); } catch (e) { meta = null; } daten.push({ id: ids[i], meta: meta, admin: roh && roh.admin === B.uid }); } } catch (e) { daten = ids.map(function (id) { return { id: id, meta: null }; }); }
      daten.sort(function (a, b) { return ((a.meta && a.meta.datum) || "9") < ((b.meta && b.meta.datum) || "9") ? -1 : 1; });
      h += daten.map(function (d) { var m = d.meta; return '<button class="eintrag" type="button" data-ev="' + d.id + '"><span class="i">' + esc(m ? m.em : "❔") + '</span><span class="mitte"><b>' + esc(m ? m.titel : "Event nicht mehr da") + "</b><small>" + (m ? esc(datumLang(m.datum)) + (m.uhr ? " · " + esc(m.uhr) : "") : "vielleicht gelöscht") + '</small></span><span class="rechts">' + (d.admin ? '<span class="chip">Gastgeber</span>' : "") + "</span></button>"; }).join("") + "</div>";
    }
    $("ansicht").innerHTML = h;
  }

  /* ---------- Event anlegen / bearbeiten ---------- */
  function eventFenster(alt) {
    var w = alt ? JSON.parse(JSON.stringify(alt)) : { em: "🎉", bedarf: [] };
    oeffne("<h2>" + (alt ? "Event bearbeiten" : "Neue Einladung") + "</h2>" +
      '<label class="field"><span>Was wird gefeiert?</span><input class="inp" id="eTitel" maxlength="60" placeholder="z. B. Mias Geburtstag" value="' + esc(w.titel || "") + '" autofocus></label>' +
      '<div class="field"><span>Bild</span><div class="emojis" id="eEm">' + EMO.map(function (e) { return '<button type="button" data-e="' + e + '" aria-pressed="' + (w.em === e) + '">' + e + "</button>"; }).join("") + "</div></div>" +
      '<div class="row"><label class="field"><span>Datum</span><input class="inp" type="date" id="eDatum" value="' + esc(w.datum || KW.addDays(KW.today(), 7)) + '"></label><label class="field"><span>Uhrzeit</span><input class="inp" type="time" id="eUhr" value="' + esc(w.uhr || "15:00") + '"></label></div>' +
      '<label class="field"><span>Wo? (freiwillig – nur grob, z. B. „bei uns im Garten“)</span><input class="inp" id="eOrt" maxlength="80" value="' + esc(w.ort || "") + '"></label>' +
      '<label class="field"><span>Nachricht an die Gäste (freiwillig)</span><textarea class="inp" id="eText" maxlength="500">' + esc(w.text || "") + "</textarea></label>" +
      '<label class="field"><span>Was wird gebraucht? (eine Sache pro Zeile – die Gäste können sich eintragen)</span><textarea class="inp" id="eBedarf" maxlength="600" placeholder="Nudelsalat&#10;Getränke&#10;Kuchen">' + esc((w.bedarf || []).join("\n")) + "</textarea></label>" +
      '<label class="field"><span>Dein Name als Gastgeber</span><input class="inp" id="eName" maxlength="30" value="' + esc(w.gastgeber || L.name || "") + '"></label>' +
      '<p class="muted klein">🔒 Die Einladung ist verschlüsselt. Lesen kann sie nur, wer den Link hat – schick ihn nur an Leute, die du einladen willst. Schreib keine genaue Adresse rein, wenn der Link weitergeschickt werden könnte.</p>' +
      '<div class="sheet-foot"><button class="btn" type="button" id="eAbbr">Abbrechen</button><button class="btn primary" type="button" id="eOk">' + (alt ? "Speichern" : "Einladung erstellen") + "</button></div>",
      function (f) {
        f.querySelector("#eEm").onclick = function (e) { var b = e.target.closest("[data-e]"); if (!b) return; w.em = b.dataset.e; f.querySelectorAll("#eEm button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); };
        f.querySelector("#eAbbr").onclick = schliessen;
        f.querySelector("#eOk").onclick = async function () {
          w.titel = v("eTitel"); w.datum = v("eDatum"); w.uhr = v("eUhr"); w.ort = v("eOrt"); w.text = v("eText"); w.gastgeber = v("eName");
          w.bedarf = v("eBedarf").split("\n").map(function (z) { return z.trim(); }).filter(Boolean).slice(0, 30);
          if (!w.titel || !w.datum) { KW.toast("Bitte gib einen Titel und ein Datum ein."); return; }
          this.disabled = true;
          try {
            await server();
            var id = alt ? ev.id : b64(zufall(12)), k = alt ? ev.k : b64(zufall(32));
            var x = await zu(k, w, id + "/meta");
            await B.setz(id + "/meta", { admin: B.uid, iv: x.iv, ct: x.ct, zeit: B.TS });
            L.meine[id] = { k: k, gastgeber: true }; if (w.gastgeber) L.name = w.gastgeber; merken();
            { for (var i = 0; i < w.bedarf.length; i++) { var mid = b64(zufall(9)); var mx = await zu(k, { t: w.bedarf[i], wer: "" }, id + "/mit/" + mid); await B.setz(id + "/mit/" + mid, { uid: B.uid, iv: mx.iv, ct: mx.ct, zeit: B.TS }); } }
            schliessen(); oeffnen(id); if (!alt) setTimeout(teilen, 500);
          } catch (e) { this.disabled = false; KW.toast(fehler(e)); }
        };
      });
  }

  /* ---------- Event ansehen ---------- */
  async function oeffnen(id) {
    var x = L.meine[id]; if (!x) return liste();
    if (abo) abo();
    ev = { id: id, k: x.k, meta: null, gaeste: {}, mit: {}, admin: false };
    $("ansicht").innerHTML = '<div class="empty">Einladung wird geladen …</div>';
    history.replaceState(null, "", "?e=" + id + (DEMO ? "&demo=" + DEMO : "") + "#" + x.k);
    try { await server(); } catch (e) { $("ansicht").innerHTML = '<div class="empty"><b>Keine Verbindung</b>Bist du online?</div>'; return; }
    abo = B.wert(id, async function (d) {
      if (!ev || ev.id !== id) return;
      if (!d || !d.meta) { $("ansicht").innerHTML = '<div class="empty"><b>Diese Einladung gibt es nicht (mehr)</b>Vielleicht hat der Gastgeber sie gelöscht.</div><p style="text-align:center"><button class="btn" type="button" data-a="weg-lokal">Aus meiner Liste entfernen</button></p>'; return; }
      try { ev.meta = await auf(ev.k, d.meta, id + "/meta"); } catch (e) { $("ansicht").innerHTML = '<div class="empty"><b>Der Link passt nicht</b>Lass dir den Einladungs-Link nochmal schicken.</div>'; return; }
      ev.admin = d.meta.admin === B.uid;
      ev.gaeste = {}; ev.mit = {};
      var g = d.gaeste || {}, m = d.mit || {};
      for (var gid in g) try { ev.gaeste[gid] = Object.assign(await auf(ev.k, g[gid], id + "/gaeste/" + gid), { _uid: g[gid].uid }); } catch (e) { /* kaputt */ }
      for (var mid in m) try { ev.mit[mid] = Object.assign(await auf(ev.k, m[mid], id + "/mit/" + mid), { _uid: m[mid].uid, _z: m[mid].zeit }); } catch (e) { /* kaputt */ }
      zeigen();
    });
  }
  function meinGast() { var e = L.meine[ev.id] || {}; return e.gast && ev.gaeste[e.gast] ? e.gast : null; }
  function zeigen() {
    var m = ev.meta, ids = Object.keys(ev.gaeste), ja = 0, viell = 0, nein = 0, pers = 0;
    ids.forEach(function (i) { var g = ev.gaeste[i]; if (g.a === "ja") { ja++; pers += 1 + (+g.plus || 0); } else if (g.a === "vielleicht") viell++; else nein++; });
    var ich = meinGast(), g = ich ? ev.gaeste[ich] : null, vorbei = m.datum < KW.today();
    var h = '<button class="btn small" type="button" data-a="liste" style="margin-bottom:10px">← Alle Events</button>';
    h += '<div class="card karte-ev"><div class="ev-em" aria-hidden="true">' + esc(m.em) + '</div><h2>' + esc(m.titel) + '</h2><p class="wann">📅 ' + esc(datumLang(m.datum)) + (m.uhr ? " · 🕒 " + esc(m.uhr) + " Uhr" : "") + "</p>" + (m.ort ? '<p class="wann">📍 ' + esc(m.ort) + "</p>" : "") + (m.gastgeber ? '<p class="muted klein">Eingeladen von ' + esc(m.gastgeber) + "</p>" : "") + (m.text ? '<p class="nachricht">' + esc(m.text) + "</p>" : "") + (vorbei ? '<p class="chip">Schon vorbei</p>' : "") + "</div>";
    if (!ev.admin) {
      h += '<div class="card antwort"><h3>' + (g ? "Deine Antwort" : "Kommst du?") + "</h3>" +
        '<div class="row knopfreihe">' + [["ja", "👍 Ich komme"], ["vielleicht", "🤔 Vielleicht"], ["nein", "😔 Leider nicht"]].map(function (a) { return '<button class="btn' + (g && g.a === a[0] ? " primary" : "") + '" type="button" data-antw="' + a[0] + '">' + a[1] + "</button>"; }).join("") + "</div>" +
        (g ? '<p class="muted klein">Gespeichert als <b>' + esc(g.name) + "</b>" + (g.plus ? " +" + g.plus : "") + ". Du kannst deine Antwort jederzeit ändern.</p>" : "") + "</div>";
    }
    h += '<div class="card zahlen"><div><b>' + ja + "</b><small>kommen" + (pers > ja ? " (" + pers + " Personen)" : "") + "</small></div><div><b>" + viell + "</b><small>vielleicht</small></div><div><b>" + nein + "</b><small>nicht</small></div></div>";
    h += '<h2 class="sec">Wer bringt was mit?</h2><div class="liste">' + Object.keys(ev.mit).sort(function (a, b) { return (ev.mit[a]._z || 0) - (ev.mit[b]._z || 0); }).map(function (i) { var x = ev.mit[i]; var meins = x.wer && x.werUid === B.uid; return '<div class="eintrag statisch"><span class="i">' + (x.wer ? "✅" : "🧺") + '</span><span class="mitte"><b>' + esc(x.t) + "</b><small>" + (x.wer ? "bringt " + esc(x.wer) : "noch offen") + '</small></span><span class="rechts">' + (!x.wer ? '<button class="btn small primary" type="button" data-nehm="' + i + '">Ich bring\'s</button>' : meins ? '<button class="btn small" type="button" data-lass="' + i + '">Doch nicht</button>' : "") + (ev.admin ? '<button class="btn small" type="button" data-mweg="' + i + '" aria-label="Löschen">✕</button>' : "") + "</span></div>"; }).join("") + "</div>" +
      '<form class="row" id="mitNeu" style="margin-top:8px"><input class="inp" id="mitText" maxlength="60" placeholder="Ich bringe noch etwas anderes mit …" style="flex:1"><button class="btn" type="submit">＋</button></form>';
    if (ids.length && (ev.admin || ich)) h += '<h2 class="sec">Gäste</h2><div class="liste">' + ids.map(function (i) { var x = ev.gaeste[i]; return '<div class="eintrag statisch"><span class="i">' + ({ ja: "👍", vielleicht: "🤔", nein: "😔" }[x.a] || "❔") + '</span><span class="mitte"><b>' + esc(x.name) + (x.plus ? " +" + x.plus : "") + "</b>" + (x.notiz ? "<small>" + esc(x.notiz) + "</small>" : "") + "</span>" + (ev.admin ? '<span class="rechts"><button class="btn small" type="button" data-gweg="' + i + '" aria-label="Entfernen">✕</button></span>' : "") + "</div>"; }).join("") + "</div>";
    h += '<div class="row" style="margin-top:18px;gap:8px"><button class="btn primary" type="button" data-a="teilen">📨 Einladung teilen</button><button class="btn" type="button" data-a="planer">📋 In den FIDELIA Planer</button><button class="btn" type="button" data-a="ics">📅 Kalender-Datei</button>' + (ev.admin ? '<button class="btn" type="button" data-a="bearb">✏️ Bearbeiten</button><button class="btn danger" type="button" data-a="loeschen">🗑️ Event löschen</button>' : "") + "</div>";
    if (ev.admin && vorbei) h += '<p class="muted klein" style="margin-top:10px">Das Event ist vorbei. Lösch es, dann verschwinden auch alle Antworten vom Server.</p>';
    $("ansicht").innerHTML = h;
  }
  function antwortFenster(a) {
    var g = meinGast() ? ev.gaeste[meinGast()] : null;
    oeffne("<h2>" + ({ ja: "👍 Schön, dass du kommst!", vielleicht: "🤔 Vielleicht", nein: "😔 Schade!" }[a]) + "</h2>" +
      '<label class="field"><span>Dein Vorname</span><input class="inp" id="gName" maxlength="30" value="' + esc(g ? g.name : L.name || "") + '" autofocus></label>' +
      (a === "ja" ? '<label class="field"><span>Bringst du noch jemanden mit?</span><select class="inp" id="gPlus">' + [0, 1, 2, 3, 4, 5].map(function (n) { return '<option value="' + n + '"' + (g && +g.plus === n ? " selected" : "") + ">" + (n ? "+" + n + (n === 1 ? " Person" : " Personen") : "Nein, nur ich") + "</option>"; }).join("") + "</select></label>" : "") +
      '<label class="field"><span>Nachricht an den Gastgeber (freiwillig)</span><input class="inp" id="gNotiz" maxlength="140" value="' + esc(g ? g.notiz || "" : "") + '"></label>' +
      '<div class="sheet-foot"><button class="btn" type="button" id="gAbbr">Abbrechen</button><button class="btn primary" type="button" id="gOk">Antwort senden</button></div>',
      function (f) {
        f.querySelector("#gAbbr").onclick = schliessen;
        f.querySelector("#gOk").onclick = async function () {
          var name = v("gName"); if (!name) { KW.toast("Wie heißt du?"); return; }
          this.disabled = true;
          try {
            var gid = meinGast() || b64(zufall(9)), x = await zu(ev.k, { name: name, a: a, plus: +(v("gPlus") || 0), notiz: v("gNotiz") }, ev.id + "/gaeste/" + gid);
            await B.setz(ev.id + "/gaeste/" + gid, { uid: B.uid, iv: x.iv, ct: x.ct, zeit: B.TS });
            L.meine[ev.id].gast = gid; L.name = name; merken(); schliessen(); KW.toast(a === "ja" ? "Super, bis dann! 🎉" : "Danke für deine Antwort.");
          } catch (e) { this.disabled = false; KW.toast(fehler(e)); }
        };
      });
  }
  async function mitSetzen(mid, obj) { var x = await zu(ev.k, obj, ev.id + "/mit/" + mid); var alt = ev.mit[mid]; await B.setz(ev.id + "/mit/" + mid, { uid: alt && alt._uid ? alt._uid : B.uid, iv: x.iv, ct: x.ct, zeit: alt && alt._z ? alt._z : B.TS }); }
  function teilen() {
    var l = link(ev.id, ev.k), m = ev.meta, text = m.em + " Einladung: " + m.titel + " – " + datumLang(m.datum) + (m.uhr ? " um " + m.uhr + " Uhr" : "") + ". Sag hier zu:";
    oeffne('<h2>📨 Einladung teilen</h2><div class="qr" id="qr"></div><div class="row"><input class="inp" readonly value="' + esc(l) + '" style="flex:1;font-size:.85rem" aria-label="Einladungs-Link"><button class="btn primary" type="button" id="tTeil">' + (navigator.share ? "Teilen" : "Kopieren") + '</button></div><p class="muted klein">Schick den Link nur an Leute, die du einladen willst – wer ihn hat, kann die Einladung lesen und antworten. Er funktioniert in FIDELIA Chat, WhatsApp oder per SMS.</p><div class="sheet-foot"><button class="btn" type="button" id="tZu">Fertig</button></div>',
      function (f) {
        f.querySelector("#tZu").onclick = schliessen;
        f.querySelector("#tTeil").onclick = function () { if (navigator.share) navigator.share({ title: m.titel, text: text, url: l }).catch(function () {}); else navigator.clipboard.writeText(text + " " + l).then(function () { KW.toast("Link kopiert – füg ihn in eine Nachricht ein."); }); };
        var mal = function () { var q = window.qrcode(0, "M"); q.addData(l); q.make(); f.querySelector("#qr").innerHTML = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); };
        if (window.qrcode) mal(); else { var s = document.createElement("script"); s.src = "../shared/vendor/qr/qrcode.js"; s.onload = mal; document.head.appendChild(s); }
      });
  }
  function ics() {
    var m = ev.meta, t = m.datum.replace(/-/g, ""), st = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    var txt = function (s) { return String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n"); };
    var z = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OMNIVIA//Events//DE", "BEGIN:VEVENT", "UID:" + ev.id + "@omnivia-events", "DTSTAMP:" + st];
    if (m.uhr) z.push("DTSTART:" + t + "T" + m.uhr.replace(":", "") + "00", "DURATION:PT3H"); else z.push("DTSTART;VALUE=DATE:" + t, "DTEND;VALUE=DATE:" + KW.addDays(m.datum, 1).replace(/-/g, ""));
    z.push("SUMMARY:" + txt(m.em + " " + m.titel)); if (m.ort) z.push("LOCATION:" + txt(m.ort)); z.push("DESCRIPTION:" + txt((m.text || "") + "\n" + link(ev.id, ev.k)), "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + txt(m.titel), "TRIGGER:-P1D", "END:VALARM", "END:VEVENT", "END:VCALENDAR");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([z.join("\r\n")], { type: "text/calendar" })); a.download = m.titel.replace(/[^\wäöüÄÖÜß -]/g, "") + ".ics"; document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- Klicks ---------- */
  document.addEventListener("submit", async function (e) {
    if (e.target.id !== "mitNeu") return; e.preventDefault();
    var t = $("mitText").value.trim(); if (!t || !ev) return;
    var name = L.name || (meinGast() && ev.gaeste[meinGast()].name) || (ev.admin ? ev.meta.gastgeber : "");
    if (!name) { name = (prompt("Wie heißt du?") || "").trim().slice(0, 30); if (!name) return; L.name = name; merken(); }
    try { await mitSetzen(b64(zufall(9)), { t: t.slice(0, 60), wer: name, werUid: B.uid }); $("mitText").value = ""; } catch (err) { KW.toast(fehler(err)); }
  });
  document.addEventListener("click", async function (e) {
    if (fenster.contains(e.target)) return;
    var b = e.target.closest("[data-a],[data-ev],[data-antw],[data-nehm],[data-lass],[data-mweg],[data-gweg]"); if (!b) return;
    try {
      if (b.dataset.ev) { oeffnen(b.dataset.ev); return; }
      if (b.dataset.antw) { antwortFenster(b.dataset.antw); return; }
      if (b.dataset.nehm || b.dataset.lass) {
        var mid = b.dataset.nehm || b.dataset.lass, x = ev.mit[mid];
        var name = L.name || (meinGast() && ev.gaeste[meinGast()].name) || (ev.admin ? ev.meta.gastgeber : "");
        if (b.dataset.nehm && !name) { name = (prompt("Wie heißt du?") || "").trim().slice(0, 30); if (!name) return; L.name = name; merken(); }
        await mitSetzen(mid, { t: x.t, wer: b.dataset.nehm ? name : "", werUid: b.dataset.nehm ? B.uid : "" }); return;
      }
      if (b.dataset.mweg) { await B.weg(ev.id + "/mit/" + b.dataset.mweg); return; }
      if (b.dataset.gweg) { if (confirm("Diese Antwort entfernen?")) await B.weg(ev.id + "/gaeste/" + b.dataset.gweg); return; }
      var a = b.dataset.a;
      if (a === "neu") eventFenster(null);
      else if (a === "liste") liste();
      else if (a === "teilen") teilen();
      else if (a === "ics") ics();
      else if (a === "planer") { var m = ev.meta; KW.planerTermine([{ quelle: "event-" + ev.id, titel: m.em + " " + m.titel, datum: m.datum, zeit: m.uhr, notiz: "OMNIVIA Events" + (m.ort ? " · " + m.ort : "") }]); KW.toast("📋 Im Planer eingetragen", "Planer öffnen", function () { location.href = "../planer/"; }); }
      else if (a === "bearb") { var w = Object.assign({}, ev.meta); w.bedarf = []; eventFenster(w); }
      else if (a === "loeschen") { if (!confirm("Event „" + ev.meta.titel + "“ für alle löschen? Alle Antworten verschwinden.")) return; await B.weg(ev.id); delete L.meine[ev.id]; merken(); KW.toast("Event gelöscht."); liste(); }
      else if (a === "weg-lokal") { delete L.meine[ev.id]; merken(); liste(); }
    } catch (err) { KW.toast(fehler(err)); }
  });
  start();
})();
