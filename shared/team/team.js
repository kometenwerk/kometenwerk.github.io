/* OMNIVIA Team-Apps – gemeinsamer Chat-Kern
   Jede Firma hat ihre eigene App (team/omnivia, team/flaressa, …). Die Seite setzt:
     <html data-firma="omnivia" data-marke="omnivia">
   Daten liegen im bestehenden Firebase-Projekt unter "team/…" (gleiche Mitgliedschaft wie bisher).
   Kanäle und Nachrichten einer Firma haben das Präfix "<firma>--".
   Ohne Verbindung (oder mit ?demo=1) läuft ein Demo-Modus nur auf diesem Gerät. */
(function () {
  "use strict";
  var T = window.OMNI_TEAM, FIRMA = document.documentElement.getAttribute("data-firma"), F = T.firmen[FIRMA];
  if (!F) return;
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var $ = function (id) { return document.getElementById(id); };
  var K = function (k) { return FIRMA + "--" + k; };
  var BASIS = (document.currentScript && document.currentScript.src || "").replace(/team\/team\.js.*$/, "") || "../../shared/";
  var CFG = { apiKey: "AIzaSyBaCkktmwGDgr6v_8p85aa2Fl6NsjODFMQ", authDomain: "krawallzoo.firebaseapp.com", databaseURL: "https://krawallzoo-default-rtdb.europe-west1.firebasedatabase.app", projectId: "krawallzoo" };
  var FB = "https://cdn.jsdelivr.net/npm/firebase@10.12.2/";
  var WEBLLM = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.84/lib/index.js";
  var MODELLE = { gruendlich: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", schnell: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC" };

  document.documentElement.style.setProperty("--f", F.farbe);
  document.documentElement.style.setProperty("--f-tinte", F.tinte);

  /* ---------- Speicher auf dem Gerät ---------- */
  function lade(k, std) { try { var v = localStorage.getItem(k); return v == null ? std : JSON.parse(v); } catch (e) { return std; } }
  function merke(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* egal */ } }

  /* ---------- Rollen ---------- */
  var ROLLEN = {}; T.rollen.forEach(function (r) { ROLLEN[r.id] = r; });
  var eigeneKis = {}; // aus der Datenbank: <firma>--kis
  function alleRollen() { var a = T.rollen.slice(); Object.keys(eigeneKis).forEach(function (k) { a.push(eigeneKis[k]); }); return a; }
  function rolle(id) { return ROLLEN[id] || eigeneKis[id] || null; }
  function rolleNachName(n) { n = String(n).toLowerCase(); var a = alleRollen(); for (var i = 0; i < a.length; i++) if (a[i].name.toLowerCase() === n) return a[i]; return null; }
  function firmenRollen(f) { return alleRollen().filter(function (r) { return r.firma === f; }); }

  /* ================================================================
     Datenbank: Firebase oder Demo (nur auf diesem Gerät)
     ================================================================ */
  var B = null, DEMO = false;
  function ladeSkript(src) { return new Promise(function (ok, nein) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = function () { nein(new Error("Keine Verbindung zum Chat-Server.")); }; document.head.appendChild(s); }); }
  function mitZeitlimit(p, ms) { return Promise.race([p, new Promise(function (_, n) { setTimeout(function () { n(new Error("Der Chat-Server antwortet nicht.")); }, ms); })]); }

  function firebaseDB() {
    return mitZeitlimit((async function () {
      if (!window.firebase) {
        await ladeSkript(FB + "firebase-app-compat.js");
        await ladeSkript(FB + "firebase-auth-compat.js");
        await ladeSkript(FB + "firebase-database-compat.js");
      }
      if (!firebase.apps.length) firebase.initializeApp(CFG);
      var db = firebase.database(), auth = firebase.auth();
      await new Promise(function (r) { var un = auth.onAuthStateChanged(function () { un(); r(); }); });
      if (!auth.currentUser) await auth.signInAnonymously();
      // einmal lesen, damit wir wissen, dass die Verbindung steht
      await db.ref("team/meta").once("value");
      return {
        uid: auth.currentUser.uid,
        zeit: function () { return firebase.database.ServerValue.TIMESTAMP; },
        hoer: function (pfad, cb, letzte, beiFehler) {
          var ref = db.ref(pfad); if (letzte) ref = ref.limitToLast(letzte);
          var f = function (s) { cb(s.val()); }; ref.on("value", f, function (e) { console.warn(pfad, e && e.message); if (beiFehler) beiFehler(e); });
          return function () { ref.off("value", f); };
        },
        push: function (pfad, obj) { return db.ref(pfad).push(obj); },
        set: function (pfad, obj) { return db.ref(pfad).set(obj); },
        update: function (map) { return db.ref().update(map); },
        weg: function (pfad) { return db.ref(pfad).remove(); },
        verbunden: function (cb) { db.ref(".info/connected").on("value", function (s) { cb(s.val() !== false); }); }
      };
    })(), 12000);
  }

  function demoDB() {
    var KEY = "omni-team-demo", baum = lade(KEY, null), hoerer = [];
    if (!baum) {
      baum = { team: { meta: { name: "OMNIVIA", owner: "demo" }, members: { demo: { name: "Chef", rolle: "admin" } }, channels: {}, msgs: {} } };
    }
    function teile(p) { return p.split("/").filter(Boolean); }
    function hol(p) { var o = baum; teile(p).forEach(function (t) { o = o == null ? undefined : o[t]; }); return o; }
    function setz(p, v) { var t = teile(p), o = baum; for (var i = 0; i < t.length - 1; i++) { if (o[t[i]] == null || typeof o[t[i]] !== "object") o[t[i]] = {}; o = o[t[i]]; } if (v == null) delete o[t[t.length - 1]]; else o[t[t.length - 1]] = JSON.parse(JSON.stringify(v)); }
    function melden(p) {
      merke(KEY, baum);
      hoerer.slice().forEach(function (h) { if (p.indexOf(h.pfad) === 0 || h.pfad.indexOf(p) === 0) h.f(); });
    }
    var zaehler = 0;
    function id() { zaehler++; return "d" + Date.now().toString(36) + zaehler.toString(36).padStart(3, "0"); }
    function stempel(o) { if (o && typeof o === "object" && o.t === "__ZEIT__") o.t = Date.now(); return o; }
    return Promise.resolve({
      uid: "demo",
      zeit: function () { return "__ZEIT__"; },
      hoer: function (pfad, cb, letzte) {
        var h = { pfad: pfad, f: function () {
          var v = hol(pfad);
          if (letzte && v && typeof v === "object") { var k = Object.keys(v).sort().slice(-letzte), o = {}; k.forEach(function (x) { o[x] = v[x]; }); v = o; }
          cb(v == null ? null : JSON.parse(JSON.stringify(v)));
        } };
        hoerer.push(h); setTimeout(h.f, 0);
        return function () { hoerer = hoerer.filter(function (x) { return x !== h; }); };
      },
      push: function (pfad, obj) { var k = id(); setz(pfad + "/" + k, stempel(obj)); melden(pfad + "/" + k); return Promise.resolve({ key: k }); },
      set: function (pfad, obj) { setz(pfad, stempel(obj)); melden(pfad); return Promise.resolve(); },
      update: function (map) { Object.keys(map).forEach(function (p) { setz(p, stempel(map[p])); }); Object.keys(map).forEach(melden); return Promise.resolve(); },
      weg: function (pfad) { setz(pfad, null); melden(pfad); return Promise.resolve(); },
      verbunden: function (cb) { cb(true); }
    });
  }

  /* ================================================================
     Start, Gründen, Beitreten
     ================================================================ */
  var meta = null, ich = null, uid = null, mitglieder = {}, anfragen = {};
  function zeige(id) { ["sLaden", "sFehler", "sGruenden", "sBeitreten", "sWarten"].forEach(function (s) { $(s).hidden = s !== id; }); $("app").hidden = id !== "app"; }
  function code(u) { var h = 0; for (var i = 0; i < u.length; i++) h = (h * 31 + u.charCodeAt(i)) >>> 0; return h.toString(36).toUpperCase().padStart(4, "0").slice(-4); }

  function starten(demo) {
    zeige("sLaden");
    DEMO = !!demo;
    (DEMO ? demoDB() : firebaseDB()).then(function (db) {
      B = db; uid = db.uid;
      $("status").textContent = DEMO ? "Demo" : "Verbunden"; $("status").className = "status " + (DEMO ? "demo" : "an");
      B.verbunden(function (an) { if (!DEMO) { $("status").textContent = an ? "Verbunden" : "Offline"; $("status").className = "status" + (an ? " an" : ""); } });
      B.hoer("team/meta", function (m) { meta = m; weiter(); });
    }).catch(function (e) {
      $("fehlerText").textContent = (e && e.message) || String(e);
      zeige("sFehler");
    });
  }
  var mitgliedHoert = false, anfrageHoert = false, chatLaeuft = false, meineAnfrage = null;
  function weiter() {
    if (!meta) { zeige("sGruenden"); return; }
    if (mitgliedHoert) return; mitgliedHoert = true;
    B.hoer("team/members/" + uid, function (v) {
      ich = v;
      if (ich) { if (!chatLaeuft) chatStarten(); else kopfZeichnen(); }
      else {
        if (chatLaeuft) { toast("Du bist nicht mehr im Team."); location.reload(); return; }
        if (!anfrageHoert) { anfrageHoert = true; B.hoer("team/requests/" + uid, function (a) { meineAnfrage = a; if (!ich) anfrageZeigen(); }); }
        anfrageZeigen();
      }
    });
  }
  function anfrageZeigen() {
    if (meineAnfrage) { $("meinCode").textContent = code(uid); zeige("sWarten"); }
    else { $("teamNameB").textContent = meta.name || "OMNIVIA"; zeige("sBeitreten"); }
  }
  $("gruendenForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var n = $("gName").value.trim(); if (!n) return;
    var u = {}; u["team/meta"] = { name: "OMNIVIA", owner: uid, t: B.zeit() }; u["team/members/" + uid] = { name: n, rolle: "admin" };
    B.update(u).catch(fehlerToast);
  });
  $("beitretenForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var n = $("bName").value.trim(); if (!n) return;
    B.set("team/requests/" + uid, { name: n, code: code(uid), t: B.zeit() }).catch(fehlerToast);
  });
  $("anfrageZurueck").onclick = function () { B.weg("team/requests/" + uid); };
  $("nochmal").onclick = function () { starten(false); };
  $("demoStart").onclick = function () { starten(true); };

  function fehlerToast(e) { toast("Das ging nicht: " + ((e && e.message) || "unbekannter Fehler")); }
  var toastT = null;
  function toast(t) {
    var el = document.querySelector(".toast"); if (el) el.remove();
    el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); el.textContent = t; document.body.appendChild(el);
    clearTimeout(toastT); toastT = setTimeout(function () { el.remove(); }, 3600);
  }
  function istAdmin() { return ich && ich.rolle === "admin"; }

  /* ================================================================
     Chat
     ================================================================ */
  var kanaele = {}, aktiv = null, msgs = [], abmelden = null, gelesen = lade("omni-team-gelesen", {}), letzte = {}, aufgaben = {}, ansicht = "chat", kunden = {}, kundenGesperrt = false;
  var offeneAbt = lade("omni-team-abt-" + FIRMA, {});
  function istKiChat(k) { return k && k.indexOf(K("ki-")) === 0; }
  function kiAusKey(k) { var m = k.slice(K("ki-").length).split("~")[0]; return rolle(m); }
  function kiKey(id) { return K("ki-" + id + "~" + uid); }

  function chatStarten() {
    chatLaeuft = true; zeige("app");
    kopfZeichnen();
    B.hoer("team/members", function (v) { mitglieder = v || {}; });
    B.hoer("team/requests", function (v) { anfragen = v || {}; seiteZeichnen(); });
    B.hoer("team/channels", function (v) {
      var alle = v || {}, n = {};
      Object.keys(alle).forEach(function (k) { if (k.indexOf(FIRMA + "--") === 0) n[k] = alle[k]; });
      kanaele = n;
      if (!Object.keys(kanaele).length && istAdmin()) { standardKanaele(); return; }
      Object.keys(kanaele).forEach(letzteHoeren);
      if (!aktiv || (!kanaele[aktiv] && !istKiChat(aktiv))) oeffne(lade("omni-team-zuletzt-" + FIRMA, null) || ersterKanal());
      seiteZeichnen();
    });
    B.hoer("team/msgs/" + K("kis"), function (v) {
      eigeneKis = {};
      Object.keys(v || {}).forEach(function (k) { var x = v[k]; if (x && x.kiName) eigeneKis["eigen-" + k] = { id: "eigen-" + k, name: x.kiName, firma: FIRMA, abt: x.abt || "Eigene KIs", rolle: x.text || "", em: x.em || "🤖", achtet: x.achtet || [], stich: "", eigen: true }; });
      seiteZeichnen();
    });
    B.hoer("team/msgs/" + K("aufgaben"), function (v) { aufgaben = v || {}; seiteZeichnen(); if (ansicht === "aufgaben") aufgabenZeichnen(); });
    // Kunden-Anfragen von der Website (Kunden-Seite). Die Zentrale sieht alle, die Firmen nur ihre eigenen.
    if (DEMO) demoAnfragen();
    B.hoer("anfragen", function (v) {
      kundenGesperrt = false; kunden = {};
      Object.keys(v || {}).forEach(function (k) { var a = v[k]; if (a && a.name && (FIRMA === "omnivia" || a.firma === FIRMA)) kunden[k] = a; });
      seiteZeichnen(); if (ansicht === "kunden") kundenZeichnen(); kopfZeichnen();
    }, null, function () { kundenGesperrt = true; seiteZeichnen(); if (ansicht === "kunden") kundenZeichnen(); });
    KI.vorladen();
  }
  function standardKanaele() {
    var u = {}; F.kanaele.forEach(function (n, i) { u["team/channels/" + K(n)] = { name: n, pos: i }; });
    B.update(u).then(function () {
      var l = rolle(F.leitung);
      return B.push("team/msgs/" + K("allgemein"), { uid: uid, name: l.name, text: "Willkommen im " + F.name + " Team! 🚀 Ich bin " + l.name + ", " + l.rolle + ". Schreib @Name, um jemanden aus dem KI-Team anzusprechen, oder tipp auf „🧩 Auftrag“, wenn wir etwas gemeinsam planen sollen.", t: B.zeit(), rolle: l.id, ki: true });
    }).catch(fehlerToast);
  }
  function ersterKanal() { var k = Object.keys(kanaele).sort(function (a, b) { return (kanaele[a].pos || 0) - (kanaele[b].pos || 0); }); return k.indexOf(K("allgemein")) >= 0 ? K("allgemein") : k[0]; }
  var letzteAbos = {};
  function letzteHoeren(k) {
    if (letzteAbos[k]) return;
    letzteAbos[k] = B.hoer("team/msgs/" + k, function (v) { var m = 0; Object.keys(v || {}).forEach(function (x) { m = Math.max(m, +v[x].t || 0); }); letzte[k] = m; seiteZeichnen(); }, 1);
  }
  function ungelesen(k) { return (letzte[k] || 0) > (gelesen[k] || 0) && k !== aktiv; }

  function oeffne(k) {
    if (!k) return;
    ansicht = "chat"; aktiv = k; merke("omni-team-zuletzt-" + FIRMA, k);
    if (abmelden) abmelden();
    msgs = []; verlaufZeichnen(true);
    abmelden = B.hoer("team/msgs/" + k, function (v) {
      msgs = Object.keys(v || {}).map(function (id) { var m = v[id]; m.id = id; return m; }).filter(function (m) { return m && (m.text || m.kiName); }).sort(function (a, b) { return (a.t || 0) - (b.t || 0) || (a.id < b.id ? -1 : 1); });
      if (msgs.length) { letzte[k] = Math.max(letzte[k] || 0, msgs[msgs.length - 1].t || 0); }
      gelesen[k] = Date.now() + 1000; merke("omni-team-gelesen", gelesen);
      verlaufZeichnen();
    }, 300);
    $("verlauf").hidden = false; $("aufgabenAnsicht").hidden = true; $("eingabe").hidden = false;
    kopfZeichnen(); seiteZeichnen(); schliesseMenue();
    setTimeout(function () { $("text").focus({ preventScroll: true }); }, 50);
  }

  /* ---------- Seitenleiste ---------- */
  var KW_LOGO = '<svg viewBox="36 44 284 216" aria-hidden="true" style="height:26px;width:auto"><path d="M190 128 L50 250" stroke="#fff" stroke-width="22" stroke-linecap="round"/><path d="M212 150 L120 246" stroke="#ff8a3c" stroke-width="9" stroke-linecap="round"/><g transform="translate(220 110)"><g fill="#fff"><rect x="-11" y="-58" width="22" height="24" rx="4"/><rect x="-11" y="-58" width="22" height="24" rx="4" transform="rotate(45)"/><rect x="-11" y="-58" width="22" height="24" rx="4" transform="rotate(90)"/><rect x="-11" y="-58" width="22" height="24" rx="4" transform="rotate(135)"/><rect x="-11" y="-58" width="22" height="24" rx="4" transform="rotate(180)"/><rect x="-11" y="-58" width="22" height="24" rx="4" transform="rotate(225)"/><rect x="-11" y="-58" width="22" height="24" rx="4" transform="rotate(270)"/><rect x="-11" y="-58" width="22" height="24" rx="4" transform="rotate(315)"/><circle r="42"/></g><circle r="30" fill="none" stroke="#12141d" stroke-width="3"/><circle r="15" fill="#ff8a3c"/></g></svg>';
  function kopfZeichnen() {
    var logo = FIRMA === "kometenwerk" ? KW_LOGO : '<img src="' + BASIS + "marken/" + FIRMA + '-zeichen.webp" alt="">';
    $("seiteKopf").innerHTML = logo + '<div class="titel"><b>' + esc(F.name.toUpperCase()) + '</b><small>Team</small></div>' +
      '<button class="rund zu" type="button" id="zuMenue" aria-label="Menü schließen">✕</button>';
    $("zuMenue").onclick = schliesseMenue;
    var t = "", u = "";
    if (ansicht === "aufgaben") { t = "✓ Aufgaben"; u = offeneAufgaben() + " offen"; }
    else if (ansicht === "kunden") { t = "📥 Anfragen"; u = neueKunden() + " neu · von der Kunden-Seite"; }
    else if (istKiChat(aktiv)) { var r = kiAusKey(aktiv); t = r ? r.em + " " + r.name : "KI"; u = r ? r.rolle + " · " + T.firmen[r.firma].name : ""; }
    else if (aktiv && kanaele[aktiv]) { t = "# " + kanaele[aktiv].name; u = F.voll; }
    $("kopfTitel").textContent = t; $("kopfUnter").textContent = u;
    document.title = (t ? t + " · " : "") + F.name + " Team";
  }
  function offeneAufgaben() { return Object.keys(aufgaben).filter(function (k) { return aufgaben[k] && !aufgaben[k].erledigt; }).length; }
  var kiSuche = "";
  function seiteZeichnen() {
    if (!chatLaeuft) return;
    var h = "";
    // Kanäle
    h += '<div class="gruppe">Kanäle' + (istAdmin() ? '<button type="button" data-a="neuKanal" aria-label="Kanal anlegen" title="Kanal anlegen">＋</button>' : "") + "</div>";
    Object.keys(kanaele).sort(function (a, b) { return (kanaele[a].pos || 0) - (kanaele[b].pos || 0); }).forEach(function (k) {
      h += '<button class="eintrag" type="button" data-k="' + esc(k) + '"' + (k === aktiv && ansicht === "chat" ? ' aria-current="true"' : "") + '><span class="hash">#</span><span class="name">' + esc(kanaele[k].name) + "</span>" + (ungelesen(k) ? '<span class="neu" aria-label="neu"></span>' : "") + "</button>";
    });
    var oa = offeneAufgaben();
    h += '<button class="eintrag" type="button" data-a="aufgaben"' + (ansicht === "aufgaben" ? ' aria-current="true"' : "") + '><span class="hash">✓</span><span class="name">Aufgaben</span>' + (oa ? '<span class="zahl">' + oa + "</span>" : "") + "</button>";
    var nk = neueKunden();
    h += '<button class="eintrag" type="button" data-a="kunden"' + (ansicht === "kunden" ? ' aria-current="true"' : "") + '><span class="hash">📥</span><span class="name">Anfragen</span>' + (nk ? '<span class="zahl">' + nk + "</span>" : "") + "</button>";
    var na = Object.keys(anfragen).length;
    h += '<button class="eintrag" type="button" data-a="team"><span class="hash">👥</span><span class="name">Team &amp; Einstellungen</span>' + (istAdmin() && na ? '<span class="zahl">' + na + "</span>" : "") + "</button>";
    // KI-Team
    var eigene = firmenRollen(FIRMA);
    h += '<div class="gruppe">KI-Team · ' + eigene.length + '<button type="button" data-a="neueKi" aria-label="Neue KI einstellen" title="Neue KI einstellen">＋</button></div>';
    h += '<input class="suche" id="kiSuche" type="search" placeholder="KI suchen …" aria-label="KI suchen" value="' + esc(kiSuche) + '">';
    var liste = kiSuche ? alleRollen().filter(function (r) { var s = kiSuche.toLowerCase(); return (r.name + " " + r.rolle + " " + r.abt).toLowerCase().indexOf(s) >= 0; }) : eigene;
    var abts = {}; liste.forEach(function (r) { var a = kiSuche && r.firma !== FIRMA ? T.firmen[r.firma].name + " · " + r.abt : r.abt; (abts[a] = abts[a] || []).push(r); });
    Object.keys(abts).forEach(function (a, i) {
      var auf = kiSuche ? true : (a in offeneAbt ? offeneAbt[a] : i < 2);
      h += '<button class="abt-kopf" type="button" data-abt="' + esc(a) + '" aria-expanded="' + auf + '">' + esc(a) + '<span class="anz">' + abts[a].length + "</span></button>";
      if (auf) abts[a].forEach(function (r) {
        var k = kiKey(r.id);
        h += '<button class="eintrag ki-eintrag" type="button" data-ki="' + esc(r.id) + '"' + (aktiv === k && ansicht === "chat" ? ' aria-current="true"' : "") + '><span aria-hidden="true">' + esc(r.em) + '</span><span class="name"><span>' + esc(r.name) + '</span><span class="rolle">' + esc(r.rolle) + "</span></span></button>";
      });
    });
    if (FIRMA !== "omnivia" && !kiSuche) h += '<p class="hinweis" style="margin:10px 6px 0">Aus der Zentrale holst du Leute mit @Name dazu, z. B. @Kai zum Testen oder @Sam für die Sicherheit.</p>';
    var sc = $("seiteInhalt").scrollTop; $("seiteInhalt").innerHTML = h; $("seiteInhalt").scrollTop = sc;
    var s = $("kiSuche"); if (s && document.activeElement && document.activeElement.id === "kiSuche-merk") s.focus();
  }
  $("seiteInhalt").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.k) oeffne(b.dataset.k);
    else if (b.dataset.ki) steckbrief(b.dataset.ki);
    else if (b.dataset.abt != null) { offeneAbt[b.dataset.abt] = b.getAttribute("aria-expanded") !== "true"; merke("omni-team-abt-" + FIRMA, offeneAbt); seiteZeichnen(); }
    else if (b.dataset.a === "aufgaben") aufgabenOeffnen();
    else if (b.dataset.a === "kunden") kundenOeffnen();
    else if (b.dataset.a === "team") teamFenster();
    else if (b.dataset.a === "neueKi") neueKiFenster();
    else if (b.dataset.a === "neuKanal") neuerKanal();
  });
  $("seiteInhalt").addEventListener("input", function (e) {
    if (e.target.id !== "kiSuche") return;
    kiSuche = e.target.value; var pos = e.target.selectionStart; seiteZeichnen();
    var s = $("kiSuche"); s.focus(); try { s.setSelectionRange(pos, pos); } catch (x) { /* egal */ }
  });
  function oeffneMenue() { $("app").classList.add("offen"); }
  function schliesseMenue() { $("app").classList.remove("offen"); }
  $("menu").onclick = oeffneMenue;
  $("app").addEventListener("click", function (e) { if (e.target === $("app") && $("app").classList.contains("offen")) schliesseMenue(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") schliesseMenue(); });

  /* ---------- Nachrichten zeichnen ---------- */
  var FARBEN = ["#f2c46d", "#3fe0b0", "#a66bff", "#3b9cff", "#ff8a3c", "#ff7eb6", "#8bd450"];
  function farbe(u) { var h = 0; u = String(u || ""); for (var i = 0; i < u.length; i++) h = (h * 17 + u.charCodeAt(i)) >>> 0; return FARBEN[h % FARBEN.length]; }
  function textHtml(t) {
    return esc(t).replace(/(^|\s)@([A-Za-zÄÖÜäöüß]{2,})/g, function (m, a, n) { return rolleNachName(n) ? a + '<span class="at">@' + n + "</span>" : m; })
      .replace(/\*\*([^*\n]{1,120})\*\*/g, "<b>$1</b>");
  }
  function uhr(t) { var d = new Date(t || Date.now()); return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }); }
  function tagText(t) { var d = new Date(t || Date.now()), h = new Date(); var g = new Date(h); g.setDate(h.getDate() - 1); if (d.toDateString() === h.toDateString()) return "Heute"; if (d.toDateString() === g.toDateString()) return "Gestern"; return d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" }); }
  function verlaufZeichnen(leeren) {
    var v = $("verlauf"), unten = v.scrollHeight - v.scrollTop - v.clientHeight < 120;
    if (leeren) { v.innerHTML = ""; return; }
    if (!msgs.length) {
      var r = istKiChat(aktiv) ? kiAusKey(aktiv) : null;
      v.innerHTML = '<div class="leer"><div class="gross">' + (r ? esc(r.em) : "💬") + "</div>" +
        (r ? "<b>Schreib " + esc(r.name) + " direkt an.</b><span>" + esc(r.rolle) + ". " + esc(r.name) + " antwortet dir hier persönlich.</span>"
           : "<b>Noch keine Nachrichten.</b><span>Schreib die erste! Mit @Name holst du jemanden aus dem KI-Team dazu.</span>") + "</div>";
      return;
    }
    var h = "", vorher = null, tag = "";
    msgs.forEach(function (m) {
      var tg = tagText(m.t); if (tg !== tag) { h += '<div class="tag">' + esc(tg) + "</div>"; tag = tg; vorher = null; }
      var r = m.rolle ? rolle(m.rolle) : null, wer = r ? "ki:" + r.id : "u:" + m.uid;
      var folge = vorher && vorher.wer === wer && (m.t - vorher.t) < 5 * 60000 && !m.plan;
      var av = r ? '<div class="av" style="border-color:' + T.firmen[r.firma].farbe + '55"><span aria-hidden="true">' + esc(r.em) + '</span><span class="ki-mark">KI</span></div>'
                 : '<div class="av mensch" style="background:' + farbe(m.uid) + '">' + esc((m.name || "?").charAt(0).toUpperCase()) + "</div>";
      var name = r ? r.name : (m.name || "Jemand");
      var extra = r ? '<span class="badge">KI</span><span class="rolle">' + esc(r.rolle) + (r.firma !== FIRMA ? " · " + esc(T.firmen[r.firma].name) : "") + "</span>" : "";
      var akt = "";
      if (m.plan) akt = '<div class="aktionen"><button class="knopf klein haupt" type="button" data-freigabe="' + esc(m.id) + '">111 · Freigeben</button><button class="knopf klein" type="button" data-kopie="' + esc(m.id) + '">Plan kopieren</button><button class="knopf klein" type="button" data-zuaufgaben="' + esc(m.id) + '">In Aufgaben</button></div>';
      h += '<div class="msg' + (folge ? " folge" : "") + (m.plan ? " plan" : "") + (m.system ? " system" : "") + '">' + av +
        '<div style="min-width:0"><div class="msg-kopf"><b>' + esc(name) + "</b>" + extra + "<time>" + uhr(m.t) + '</time></div><div class="text">' + textHtml(m.text) + "</div>" + akt + "</div></div>";
      vorher = { wer: wer, t: m.t };
    });
    v.innerHTML = h;
    if (unten || leeren !== false) v.scrollTop = v.scrollHeight;
  }
  $("verlauf").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    var m = function (id) { return msgs.filter(function (x) { return x.id === id; })[0]; };
    if (b.dataset.freigabe) senden("111");
    else if (b.dataset.kopie) { var t = m(b.dataset.kopie).text; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast("Plan kopiert."); }).catch(function () { toast("Kopieren ging nicht – markiere den Text von Hand."); }); }
    else if (b.dataset.zuaufgaben) planZuAufgaben(m(b.dataset.zuaufgaben));
  });

  /* ---------- Schreiben ---------- */
  var ta = $("text");
  function hoehe() { ta.style.height = "auto"; ta.style.height = Math.min(160, ta.scrollHeight) + "px"; }
  ta.addEventListener("input", function () { hoehe(); vorschlagen(); });
  ta.addEventListener("keydown", function (e) {
    if (!$("vorschlaege").hidden) {
      var bs = [].slice.call($("vorschlaege").querySelectorAll("button")), i = bs.findIndex(function (b) { return b.getAttribute("aria-selected") === "true"; });
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); i = (i + (e.key === "ArrowDown" ? 1 : -1) + bs.length) % bs.length; bs.forEach(function (b, j) { b.setAttribute("aria-selected", j === i); }); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); if (bs[i]) bs[i].click(); return; }
      if (e.key === "Escape") { $("vorschlaege").hidden = true; return; }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("sendenForm").requestSubmit(); }
  });
  function vorschlagen() {
    var vor = ta.value.slice(0, ta.selectionStart), m = vor.match(/@([A-Za-zÄÖÜäöüß]*)$/), box = $("vorschlaege");
    if (!m) { box.hidden = true; return; }
    var q = m[1].toLowerCase();
    var name0 = function (r) { return r.name.toLowerCase().indexOf(q) === 0; };
    var treffer = alleRollen().filter(function (r) { return name0(r) || (q.length >= 3 && r.rolle.toLowerCase().indexOf(q) >= 0); })
      .sort(function (a, b) { return (name0(a) ? 0 : 1) - (name0(b) ? 0 : 1) || (a.firma === FIRMA ? 0 : 1) - (b.firma === FIRMA ? 0 : 1) || a.name.localeCompare(b.name); }).slice(0, 8);
    if (!treffer.length) { box.hidden = true; return; }
    box.innerHTML = treffer.map(function (r, i) { return '<button type="button" role="option" aria-selected="' + (i === 0) + '" data-n="' + esc(r.name) + '"><span>' + esc(r.em) + "</span><span><b>" + esc(r.name) + "</b> <small>" + esc(r.rolle) + " · " + esc(T.firmen[r.firma].name) + "</small></span></button>"; }).join("");
    box.hidden = false;
  }
  $("vorschlaege").addEventListener("mousedown", function (e) { e.preventDefault(); });
  $("vorschlaege").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    var pos = ta.selectionStart, vor = ta.value.slice(0, pos).replace(/@[A-Za-zÄÖÜäöüß]*$/, "@" + b.dataset.n + " ");
    ta.value = vor + ta.value.slice(pos); ta.setSelectionRange(vor.length, vor.length); $("vorschlaege").hidden = true; ta.focus(); hoehe();
  });
  $("sendenForm").addEventListener("submit", function (e) { e.preventDefault(); var t = ta.value.trim(); if (!t) return; ta.value = ""; hoehe(); $("vorschlaege").hidden = true; senden(t); });
  $("auftragKnopf").onclick = function () {
    var t = ta.value.trim();
    if (!t) { ta.value = "Auftrag: "; ta.focus(); hoehe(); toast("Beschreib kurz, was gebaut oder geplant werden soll, und tipp nochmal auf 🧩."); return; }
    ta.value = ""; hoehe(); senden(t, true);
  };
  $("tipps").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; ta.value = b.dataset.t; ta.focus(); hoehe(); vorschlagen(); });
  function tippsZeichnen() {
    var l = rolle(F.leitung);
    var t = [["@" + l.name + " ", "@" + l.name + " fragen"], ["Auftrag: ", "🧩 Auftrag planen"], ["@Kai ", "@Kai testen lassen"]];
    $("tipps").innerHTML = t.map(function (x) { return '<button type="button" data-t="' + esc(x[0]) + '">' + esc(x[1]) + "</button>"; }).join("");
  }

  function senden(text, alsAuftrag) {
    if (!aktiv) return;
    var key = aktiv, auftrag = alsAuftrag || /^auftrag\s*:/i.test(text);
    if (auftrag) text = text.replace(/^auftrag\s*:\s*/i, "").trim() || text;
    B.push("team/msgs/" + key, { uid: uid, name: ich.name, text: (auftrag ? "🧩 Auftrag: " : "") + text, t: B.zeit() }).then(function () {
      if (auftrag) return auftragBesprechen(key, text);
      if (/^\s*111\s*$/.test(text)) return freigabe(key);
      var genannt = [], re = /@([A-Za-zÄÖÜäöüß]{2,})/g, m;
      while ((m = re.exec(text))) { var r = rolleNachName(m[1]); if (r && genannt.indexOf(r) < 0) genannt.push(r); }
      if (istKiChat(key) && !genannt.length) { var ki = kiAusKey(key); if (ki) genannt.push(ki); }
      genannt.slice(0, 4).forEach(function (r) { KI.auftrag(key, r, null); });
    }).catch(fehlerToast);
  }

  /* ================================================================
     KI: Browser-KI (WebLLM) oder Steckbrief-Antworten
     ================================================================ */
  var KI = (function () {
    var engine = null, laden = null, modell = null, schlange = Promise.resolve(), wartend = 0;
    var tempo = function () { return lade("omni-team-tempo", "gruendlich"); };
    function gpuDa() { if (!("gpu" in navigator)) return Promise.resolve(false); return navigator.gpu.requestAdapter().then(function (a) { return !!a; }).catch(function () { return false; }); }
    function leiste(p, t) { $("kiLeiste").hidden = p >= 1; $("kiBalken").style.width = Math.round(p * 100) + "%"; if (t) $("kiText").textContent = t; }
    function bereit() {
      if (DEMO || lade("omni-team-ki-aus", false)) return Promise.resolve(null);
      var wunsch = MODELLE[tempo()];
      if (engine && modell === wunsch) return Promise.resolve(engine);
      if (laden) return laden;
      laden = gpuDa().then(function (ok) {
        if (!ok) { merke("omni-team-kein-gpu", true); return null; }
        return import(WEBLLM).then(function (webllm) {
          leiste(0, "🤖 KI wird geladen … 0 %");
          var fn = engine ? engine.reload(wunsch).then(function () { return engine; }) :
            webllm.CreateMLCEngine(wunsch, { initProgressCallback: function (r) { leiste(r.progress || 0, "🤖 KI wird geladen … " + Math.round((r.progress || 0) * 100) + " % (nur beim ersten Mal)"); } }, { context_window_size: 4096 });
          return fn.then(function (e) { engine = e; modell = wunsch; leiste(1); merke("omni-team-ki-genutzt", true); return e; });
        });
      }).catch(function (e) { console.warn("KI", e); leiste(1); toast("Die KI konnte nicht geladen werden – Antworten kommen jetzt aus den Steckbriefen."); return null; })
        .then(function (e) { laden = null; return e; });
      return laden;
    }
    function vorladen() { if (lade("omni-team-ki-genutzt", false) && !DEMO) { var go = function () { bereit(); }; if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 6000 }); else setTimeout(go, 3000); } }
    function system(r, zusatz) {
      var fr = T.firmen[r.firma];
      return "Du bist " + r.name + ", eine KI-Rolle im Team von " + fr.voll + " (Teil der OMNIVIA Group). Deine Aufgabe: " + r.rolle + " (Abteilung " + r.abt + "). " +
        (r.achtet && r.achtet.length ? "Du achtest besonders auf: " + r.achtet.join("; ") + ". " : "") +
        "Der Chef von OMNIVIA ist ein junger Gründer; sprich ihn mit du an. Antworte auf Deutsch, freundlich und konkret, in höchstens 5 kurzen Sätzen. " +
        "Regeln: OMNIVIA ist sicher, ehrlich und werbefrei. Alles soll kostenlos bleiben (GitHub Pages, Firebase Spark). Erfinde keine Fakten, Preise oder Testergebnisse; sag ehrlich, wenn du etwas nicht weißt. " +
        "Keine Geheimnisse, Passwörter oder Schlüssel in den Chat. Du bist eine KI und gibst dich nicht als Mensch aus. Bleib in deinem Fachgebiet und nenne sonst, wer zuständig ist. " + (zusatz || "");
    }
    function steckbriefAntwort(r, frage, zusatz) {
      var a = r.achtet || [];
      if (zusatz === "zusammenfassung") return null;
      var s = "Aus Sicht von " + r.rolle + ":";
      if (a.length) s += "\n" + a.map(function (x, i) { return (i + 1) + ". " + x; }).join("\n");
      return s + "\n\n(aus meinem Steckbrief – Browser-KI hier nicht aktiv)";
    }
    function verlaufFuer(key) {
      return msgs.filter(function (m) { return !m.system; }).slice(-8).map(function (m) {
        var r = m.rolle ? rolle(m.rolle) : null;
        return { role: r ? "assistant" : "user", content: (r ? r.name : (m.name || "Chef")) + ": " + String(m.text).slice(0, 700) };
      });
    }
    function denken(r, key, anweisung, extraKontext) {
      return bereit().then(function (e) {
        if (!e) return steckbriefAntwort(r, anweisung);
        var nachrichten = [{ role: "system", content: system(r, anweisung) }].concat(key === aktiv ? verlaufFuer(key) : []);
        if (extraKontext) nachrichten.push({ role: "user", content: extraKontext });
        if (nachrichten[nachrichten.length - 1].role !== "user") nachrichten.push({ role: "user", content: "Was meinst du dazu?" });
        return e.chat.completions.create({ messages: nachrichten, max_tokens: tempo() === "schnell" ? 180 : 280, temperature: 0.6 })
          .then(function (res) { var t = (res.choices[0].message.content || "").trim().replace(new RegExp("^" + r.name + ":\\s*"), ""); return t || steckbriefAntwort(r); });
      }).catch(function (e) { console.warn(e); return steckbriefAntwort(r); });
    }
    function tippt(r) { wartend++; $("tippt").hidden = false; $("tipptText").textContent = r.name + " schreibt …"; }
    function fertig() { wartend--; if (wartend <= 0) { wartend = 0; $("tippt").hidden = true; } }
    // Eine Antwort nach der anderen
    function auftrag(key, r, anweisung, extra, msgExtra) {
      schlange = schlange.then(function () {
        tippt(r);
        return denken(r, key, anweisung, extra).then(function (text) {
          if (!text) return;
          var m = { uid: uid, name: r.name, text: text, t: B.zeit(), rolle: r.id, ki: true };
          Object.keys(msgExtra || {}).forEach(function (k) { m[k] = msgExtra[k]; });
          return B.push("team/msgs/" + key, m);
        }).then(fertig, function (e) { fertig(); fehlerToast(e); });
      });
      return schlange;
    }
    return { auftrag: auftrag, denken: denken, bereit: bereit, vorladen: vorladen, steckbriefAntwort: steckbriefAntwort, warte: function () { return schlange; } };
  })();

  /* ---------- Auftrag: Paul wählt, Fachleute sagen ihre Meinung, Sofie fasst zusammen ---------- */
  function auswahl(text) {
    var MOD = ["paul", "sofie", "henrike"], t = text.toLowerCase();
    // Die Zentrale (OMNIVIA) darf Fachleute aus allen Firmen holen, die anderen Firmen ihre eigenen plus die Zentrale
    var kandidaten = alleRollen().filter(function (r) { return (FIRMA === "omnivia" || r.firma === FIRMA || r.firma === "omnivia") && MOD.indexOf(r.id) < 0; });
    var punkte = kandidaten.map(function (r) {
      var p = 0; if (r.stich) r.stich.split("|").forEach(function (w) { if (w && t.indexOf(w) >= 0) p += 2; });
      if (r.firma === FIRMA) p += 0.5;
      return { r: r, p: p };
    }).filter(function (x) { return x.p >= 2; }).sort(function (a, b) { return b.p - a.p; });
    var wahl = [], dazu = function (r) { if (r && wahl.indexOf(r) < 0) wahl.push(r); };
    dazu(rolle(F.leitung));
    punkte.slice(0, 5).forEach(function (x) { dazu(x.r); });
    if (wahl.length < 3) firmenRollen(FIRMA).forEach(function (r) { if (wahl.length < 3 && MOD.indexOf(r.id) < 0) dazu(r); });
    if (!wahl.some(function (r) { return r.abt === "Sicherheit"; })) dazu(/kind|spiel|chat|fremd/.test(t) ? rolle("hanna") : rolle("sam"));
    return wahl.slice(0, 7);
  }
  function auftragBesprechen(key, text) {
    var paul = rolle("paul"), sofie = rolle("sofie"), wahl = auswahl(text), antworten = [];
    var liste = wahl.map(function (r) { return "@" + r.name + " (" + r.rolle + ")"; }).join(", ");
    return B.push("team/msgs/" + key, { uid: uid, name: paul.name, rolle: "paul", ki: true, t: B.zeit(),
      text: "Gute Aufgabe! Dafür hole ich " + wahl.length + " Leute dazu: " + liste + ". Jede und jeder sagt kurz, worauf es aus ihrer Sicht ankommt. Danach fasst Sofie alles zusammen." })
      .then(function () {
        wahl.forEach(function (r) {
          KI.auftrag(key, r, "Es geht um diesen Auftrag des Chefs: \"" + text + "\". Gib in 2 bis 3 Sätzen deine fachliche Einschätzung aus deiner Rolle: worauf achten, was zuerst tun, welches Risiko.", "Auftrag: " + text);
        });
        return KI.warte();
      }).then(function () {
        // Antworten einsammeln (aus den aktuellen Nachrichten)
        var seit = msgs.filter(function (m) { return wahl.some(function (r) { return r.id === m.rolle; }); }).slice(-wahl.length);
        antworten = seit.map(function (m) { return rolle(m.rolle).name + ": " + m.text; });
        return KI.bereit().then(function (e) {
          if (!e) return B.push("team/msgs/" + key, { uid: uid, name: sofie.name, rolle: "sofie", ki: true, plan: true, t: B.zeit(),
            text: "📋 Plan zu „" + text + "“\n\n" + wahl.map(function (r, i) { return (i + 1) + ". " + r.name + " klärt: " + ((r.achtet || [])[0] || "Was ist aus meiner Sicht wichtig?"); }).join("\n") +
              "\n\nOffene Frage: Was ist die kleinste erste Version?\nWenn alles passt, gib mit 111 frei." });
          return KI.auftrag(key, sofie, "Fasse die Einschätzungen des Teams zu einem klaren Plan zusammen: höchstens 5 nummerierte Schritte, dann 'Offene Fragen:' mit höchstens 2 Punkten. Beginne mit '📋 Plan zu' und dem Thema. Schließe mit dem Satz: 'Wenn alles passt, gib mit 111 frei.'",
            "Auftrag: " + text + "\n\nEinschätzungen:\n" + antworten.join("\n"), { plan: true });
        });
      });
  }
  function freigabe(key) {
    var plan = null; for (var i = msgs.length - 1; i >= 0; i--) { if (msgs[i].plan) { plan = msgs[i]; break; } if (/^\s*111\s*$/.test(msgs[i].text) && msgs[i].uid === uid && i < msgs.length - 1) break; }
    var greta = rolle("greta");
    if (!plan) return B.push("team/msgs/" + key, { uid: uid, name: greta.name, rolle: "greta", ki: true, t: B.zeit(), text: "Hier gibt es noch keinen Plan zum Freigeben. Tipp auf „🧩 Auftrag“ und beschreib, was entstehen soll – dann planen wir zuerst." });
    var werkstatt = meta && meta.werkstatt;
    return B.push("team/msgs/" + key, { uid: uid, name: greta.name, rolle: "greta", ki: true, t: B.zeit(), text: werkstatt
      ? "✅ Freigabe erhalten! Ich gebe den Plan an die Werkstatt. Sobald die Vorschau fertig ist, melde ich mich hier."
      : "✅ Freigabe ist notiert. Die Werkstatt, in der eine große KI den Code selbst baut, ist aber noch nicht eingerichtet. Dafür braucht es einmal einen KI-Schlüssel – das klärst du am besten mit deinen Eltern. Bis dahin: Plan kopieren oder mit „In Aufgaben“ übernehmen." });
  }
  function planZuAufgaben(m) {
    if (!m) return;
    var zeilen = String(m.text).split("\n").map(function (z) { return z.trim(); }).filter(function (z) { return /^\d+[.)]\s+/.test(z); }).map(function (z) { return z.replace(/^\d+[.)]\s+/, ""); });
    if (!zeilen.length) { toast("In diesem Plan habe ich keine nummerierten Schritte gefunden."); return; }
    var u = {}; zeilen.forEach(function (z, i) { u["team/msgs/" + K("aufgaben") + "/a" + Date.now().toString(36) + i] = { uid: uid, name: ich.name, text: z.slice(0, 300), t: Date.now() + i, erledigt: false }; });
    B.update(u).then(function () { toast(zeilen.length + " Aufgaben übernommen."); }).catch(fehlerToast);
  }

  /* ---------- Aufgaben ---------- */
  function aufgabenOeffnen() { ansicht = "aufgaben"; $("verlauf").hidden = true; $("eingabe").hidden = true; $("aufgabenAnsicht").hidden = false; aufgabenZeichnen(); kopfZeichnen(); seiteZeichnen(); schliesseMenue(); }
  function aufgabenZeichnen() {
    var l = Object.keys(aufgaben).map(function (k) { var a = aufgaben[k]; a.id = k; return a; }).filter(function (a) { return a && a.text; })
      .sort(function (a, b) { return (a.erledigt ? 1 : 0) - (b.erledigt ? 1 : 0) || (a.t || 0) - (b.t || 0); });
    var h = '<form id="aufgabeForm" class="reihe" style="margin-bottom:6px"><div class="feld" style="flex:1;min-width:200px"><label for="neueAufgabe" class="vh">Neue Aufgabe</label><input id="neueAufgabe" placeholder="Neue Aufgabe …" maxlength="300" autocomplete="off"></div><button class="knopf haupt" type="submit">Hinzufügen</button></form>';
    if (!l.length) h += '<div class="leer"><div class="gross">✓</div><b>Keine Aufgaben.</b><span>Füg oben eine hinzu – oder übernimm einen Plan aus dem Chat mit „In Aufgaben“.</span></div>';
    l.forEach(function (a) {
      h += '<div class="aufgabe' + (a.erledigt ? " erledigt" : "") + '"><input type="checkbox" id="auf-' + esc(a.id) + '" data-id="' + esc(a.id) + '"' + (a.erledigt ? " checked" : "") + '><label for="auf-' + esc(a.id) + '" class="was">' + esc(a.text) + '<div class="wer">von ' + esc(a.name || "?") + "</div></label>" +
        '<button type="button" data-weg="' + esc(a.id) + '" aria-label="Aufgabe löschen">✕</button></div>';
    });
    $("aufgabenAnsicht").innerHTML = h;
    $("aufgabeForm").onsubmit = function (e) {
      e.preventDefault(); var t = $("neueAufgabe").value.trim(); if (!t) return;
      B.push("team/msgs/" + K("aufgaben"), { uid: uid, name: ich.name, text: t, t: B.zeit(), erledigt: false }).then(function () { var n = $("neueAufgabe"); if (n) n.focus(); }).catch(fehlerToast);
    };
  }
  $("aufgabenAnsicht").addEventListener("change", function (e) {
    var id = e.target.dataset.id; if (!id || !aufgaben[id]) return;
    var a = aufgaben[id]; B.set("team/msgs/" + K("aufgaben") + "/" + id, { uid: a.uid, name: a.name, text: a.text, t: a.t, erledigt: e.target.checked }).catch(fehlerToast);
  });
  $("aufgabenAnsicht").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-weg]"); if (!b) return;
    B.weg("team/msgs/" + K("aufgaben") + "/" + b.dataset.weg).catch(fehlerToast);
  });


  /* ---------- Kunden-Anfragen (von der Kunden-Seite der Website) ---------- */
  var STATUS = { neu: ["Neu", 0], angenommen: ["Angenommen", 1], fertig: ["Fertig", 2], abgelehnt: ["Abgelehnt", 3] };
  function stat(a) { return STATUS[a.status] ? a.status : "neu"; }
  function neueKunden() { return Object.keys(kunden).filter(function (k) { return stat(kunden[k]) === "neu"; }).length; }
  function kundenKanal() { return kanaele[K("kunden")] ? K("kunden") : kanaele[K("auftraege")] ? K("auftraege") : ersterKanal(); }
  function istMail(k) { return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(k || "").trim()); }
  function demoAnfragen() {
    var fertigGeprueft = false, ab = B.hoer("anfragen", function (v) {
      if (fertigGeprueft) return; fertigGeprueft = true; setTimeout(function () { ab(); }, 0);
      if (v || lade("omni-team-demo-anfragen", false)) return; merke("omni-team-demo-anfragen", true);
      var jetzt = Date.now();
      B.set("anfragen/demo1", { firma: "fidelia", anliegen: "Neue Website", paket: "Verein", bausteine: "Startseite & Über uns, Kontakt & Anfahrt, Termine & Veranstaltungen, Mannschaften / Team", name: "SV Musterstadt (Beispiel)", kontakt: "vorstand@sv-musterstadt.example", alt: "", text: "Wir brauchen eine Seite mit Spielplan und Trainingszeiten. Wäre schön bis zum Saisonstart.", gespraech: "Telefon", gefunden: "Empfehlung von Bekannten", zeit: jetzt - 3600e3 });
      B.set("anfragen/demo2", { firma: "fidelia", anliegen: "Kleine Web-App", paket: "App", bausteine: "Angebot, Preise oder Speisekarte, Öffnungszeiten", name: "Café Sonne (Beispiel)", kontakt: "0123 456789", alt: "www.cafe-sonne.example", text: "Eine Speisekarte, die wir selbst ändern können.", gespraech: "Persönliches Treffen", gefunden: "Google-Suche", zeit: jetzt - 26 * 3600e3 });
    });
  }
  function kundenOeffnen() { ansicht = "kunden"; $("verlauf").hidden = true; $("eingabe").hidden = true; $("aufgabenAnsicht").hidden = false; kundenZeichnen(); kopfZeichnen(); seiteZeichnen(); schliesseMenue(); }
  function datum(t) { var d = new Date(t || Date.now()); return tagText(t) + ", " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }); }
  function milaStatistik(l) {
    var z = {}, n = 0; l.forEach(function (a) { if (a.gefunden) { z[a.gefunden] = (z[a.gefunden] || 0) + 1; n++; } });
    var mila = rolle("mila"), top = Object.keys(z).sort(function (a, b) { return z[b] - z[a]; });
    var h = '<div class="mila"><div class="mila-kopf"><span class="av" aria-hidden="true">' + esc(mila.em) + '</span><div><b>' + esc(mila.name) + '</b> · ' + esc(mila.rolle) + '<br><small>So haben uns die Kunden gefunden</small></div></div>';
    if (!n) return h + '<p class="hinweis">Noch keine Angaben. Sobald Kunden „Wie hast du von uns erfahren?“ ausfüllen, zähle ich hier mit, welche Werbung wirklich wirkt.</p></div>';
    h += top.map(function (k) { return '<div class="balken-zeile"><span>' + esc(k) + '</span><span class="balken"><i style="width:' + Math.round(z[k] / z[top[0]] * 100) + '%"></i></span><b>' + z[k] + "</b></div>"; }).join("");
    return h + '<p class="hinweis">' + (top.length > 1 || n > 2 ? "Am meisten bringt gerade: <b>" + esc(top[0]) + "</b>. " : "") + "Ich zähle nur – wer was angegeben hat, spielt keine Rolle.</p></div>";
  }
  function kundenZeichnen() {
    if (ansicht !== "kunden") return;
    var l = Object.keys(kunden).map(function (k) { var a = kunden[k]; a.id = k; return a; })
      .sort(function (a, b) { return STATUS[stat(a)][1] - STATUS[stat(b)][1] || (b.zeit || 0) - (a.zeit || 0); });
    var h = "";
    if (kundenGesperrt) h += '<div class="kunde-hinweis">🔒 <b>Die Anfragen sind noch gesperrt.</b> In Firebase fehlt noch die Regel für „anfragen“. Sobald du sie eingefügt hast, erscheinen hier die Anfragen von der Kunden-Seite.</div>';
    if (!l.length) h += '<div class="leer"><div class="gross">📥</div><b>Noch keine Anfragen.</b><span>Wenn jemand auf der Kunden-Seite ein Projekt anfragt, landet es hier' + (FIRMA === "omnivia" ? " – die Zentrale sieht die Anfragen aller Firmen." : ".") + "</span></div>";
    l.forEach(function (a) {
      var st = stat(a), fr = T.firmen[a.firma] || F, kontakt = istMail(a.kontakt) ? '<a href="mailto:' + esc(a.kontakt) + '">' + esc(a.kontakt) + "</a>" : esc(a.kontakt);
      h += '<article class="kunde st-' + st + '"><div class="kunde-kopf"><b>' + esc(a.name) + '</b><span class="st">' + STATUS[st][0] + "</span>" +
        (FIRMA === "omnivia" ? '<span class="firma-chip" style="--c:' + fr.farbe + '">' + esc(fr.name) + "</span>" : "") + '<small>' + esc(datum(a.zeit)) + "</small></div>" +
        '<dl><dt>Anliegen</dt><dd>' + esc(a.anliegen || "–") + (a.paket && a.paket !== "–" ? " · Paket „" + esc(a.paket) + "“" : "") + "</dd>" +
        (a.bausteine ? "<dt>Bausteine</dt><dd>" + esc(a.bausteine) + "</dd>" : "") +
        "<dt>Kontakt</dt><dd>" + kontakt + " · möchte: " + esc(a.gespraech || "–") + "</dd>" +
        (a.alt ? "<dt>Alte Seite</dt><dd>" + esc(a.alt) + "</dd>" : "") +
        (a.gefunden ? "<dt>Gefunden über</dt><dd>" + esc(a.gefunden) + "</dd>" : "") + "</dl>" +
        (a.text ? '<p class="kunde-text">' + esc(a.text) + "</p>" : "") +
        (a.bearbeitet ? '<p class="wer">bearbeitet von ' + esc(a.bearbeitet) + "</p>" : "") +
        '<div class="aktionen">' +
        (st === "neu" ? '<button class="knopf klein haupt" type="button" data-kannehmen="' + esc(a.id) + '">✅ Annehmen &amp; planen</button>' : "") +
        (st === "neu" || st === "angenommen" ? '<button class="knopf klein" type="button" data-kantwort="' + esc(a.id) + '">✍️ Antwort-Entwurf</button>' : "") +
        (st === "angenommen" ? '<button class="knopf klein" type="button" data-kfertig="' + esc(a.id) + '">🏁 Projekt fertig</button>' : "") +
        (st === "neu" ? '<button class="knopf klein" type="button" data-kab="' + esc(a.id) + '">Ablehnen</button>' : "") +
        (st === "fertig" || st === "abgelehnt" ? '<button class="knopf klein" type="button" data-kneu="' + esc(a.id) + '">Wieder öffnen</button>' : "") +
        (istAdmin() ? '<button class="knopf klein gefahr" type="button" data-klosch="' + esc(a.id) + '">Löschen</button>' : "") + "</div></article>";
    });
    if (l.length) h += milaStatistik(l);
    h += '<p class="hinweis">Datenschutz: Lösch eine Anfrage, sobald sie erledigt ist. Die KIs schreiben Kunden nie von allein – Antworten schickst du selbst.</p>';
    $("aufgabenAnsicht").innerHTML = h;
  }
  function kundenStatus(id, st) { var u = {}; u["anfragen/" + id + "/status"] = st; u["anfragen/" + id + "/bearbeitet"] = ich.name; return B.update(u); }
  function annehmen(a) {
    var text = "Kundenanfrage von " + a.name + ": " + (a.anliegen || "Projekt") + (a.paket && a.paket !== "–" ? ", Paket " + a.paket : "") +
      (a.bausteine ? ". Bausteine: " + a.bausteine : "") + (a.text ? ". Wunsch: " + a.text : "");
    kundenStatus(a.id, "angenommen").then(function () {
      return B.push("team/msgs/" + K("aufgaben"), { uid: uid, name: ich.name, text: ("Kundenprojekt: " + a.name + " – " + (a.anliegen || "")).slice(0, 300), t: B.zeit(), erledigt: false });
    }).then(function () {
      var key = kundenKanal(); oeffne(key);
      toast("Angenommen! Das Team plant jetzt in #" + ((kanaele[key] || {}).name || "allgemein") + ".");
      return auftragBesprechen(key, text.slice(0, 600));
    }).catch(fehlerToast);
  }
  function fertigMelden(a) {
    kundenStatus(a.id, "fertig").then(function () {
      var jana = rolle("jana"), key = kundenKanal(); oeffne(key);
      return B.push("team/msgs/" + key, { uid: uid, name: jana.name, rolle: "jana", ki: true, t: B.zeit(),
        text: "🎉 Das Projekt für " + a.name + " ist fertig – glückwunsch! Idee von der Werbung: Wenn " + a.name + " einverstanden ist, zeigen wir das Projekt als Beispiel auf unserer Website. Bitte vorher ausdrücklich um Erlaubnis fragen – ohne Ja kein Beispiel. Und die Anfrage selbst kannst du jetzt löschen." });
    }).catch(fehlerToast);
  }
  function entwurfVorlage(a) {
    var fr = T.firmen[a.firma] || F, g = String(a.gespraech || "");
    var wie = /telefon/i.test(g) ? "kurz am Telefon" : /pers/i.test(g) ? "bei einem persönlichen Treffen" : "erst einmal per E-Mail";
    return "Hallo " + a.name + ",\n\nvielen Dank für deine Anfrage bei " + fr.voll + "! Wir haben sie gelesen und freuen uns über dein Interesse an „" + (a.anliegen || "deinem Projekt") + "“." +
      (a.paket && a.paket !== "–" ? " Nach deiner Auswahl passt das Paket „" + a.paket + "“ gut – das schauen wir uns gemeinsam genauer an." : "") +
      "\n\nGern besprechen wir alles " + wie + ". Wann passt es dir in den nächsten Tagen?\n\nViele Grüße\n" + ich.name + "\n" + fr.voll + " · OMNIVIA Group";
  }
  function antwortEntwurf(a) {
    var ella = rolle("ella"), mail = istMail(a.kontakt);
    fenster('<div class="fenster"><h3>✍️ Antwort an ' + esc(a.name) + '</h3><p class="hinweis" id="ellaStatus">' + esc(ella.em + " " + ella.name) + ' hat einen Entwurf geschrieben. Lies ihn durch und ändere, was du willst.</p>' +
      '<div class="feld"><label for="entwurf">Text</label><textarea id="entwurf" rows="12">' + esc(entwurfVorlage(a)) + '</textarea></div>' +
      '<p class="hinweis">Abschicken musst du selbst – die KI schreibt Kunden nie von allein.' + (mail ? "" : " Kontakt ist eine Telefonnummer: " + esc(a.kontakt) + " – der Text hilft dir beim Anrufen.") + '</p>' +
      '<div class="reihe"><button class="knopf" type="button" data-zu>Schließen</button><span style="flex:1"></span><button class="knopf" type="button" id="entwurfKopie">📋 Kopieren</button>' +
      (mail ? '<button class="knopf haupt" type="button" id="entwurfMail">✉️ In E-Mail öffnen</button>' : "") + "</div></div>");
    $("entwurfKopie").onclick = function () { var t = $("entwurf").value; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast("Text kopiert."); }).catch(function () { toast("Kopieren ging nicht – markiere den Text von Hand."); }); };
    if ($("entwurfMail")) $("entwurfMail").onclick = function () { location.href = "mailto:" + a.kontakt.trim() + "?subject=" + encodeURIComponent("Deine Anfrage bei " + (T.firmen[a.firma] || F).voll) + "&body=" + encodeURIComponent($("entwurf").value); };
    // Mit Browser-KI schreibt Ella den Text persönlicher, sonst bleibt die Vorlage
    KI.bereit().then(function (e) {
      if (!e || !$("entwurf")) return;
      $("ellaStatus").textContent = ella.em + " " + ella.name + " formuliert den Text gerade persönlicher …";
      var vorher = $("entwurf").value;
      return KI.denken(ella, null, "Schreibe eine kurze, freundliche Antwort-E-Mail an einen Kunden. Du-Form, ehrlich, keine Preise oder Termine erfinden, kein Betreff. Schließe mit 'Viele Grüße' und dem Namen " + ich.name + ".",
        "Anfrage: " + JSON.stringify({ name: a.name, anliegen: a.anliegen, paket: a.paket, bausteine: a.bausteine, nachricht: a.text, gespraech: a.gespraech })).then(function (t) {
        if (!$("entwurf")) return;
        if (t && $("entwurf").value === vorher && t.indexOf("Steckbrief") < 0) { $("entwurf").value = t; $("ellaStatus").textContent = ella.em + " " + ella.name + " hat den Entwurf geschrieben. Lies ihn durch und ändere, was du willst."; }
        else $("ellaStatus").textContent = ella.em + " " + ella.name + " hat einen Entwurf geschrieben. Lies ihn durch und ändere, was du willst.";
      });
    }).catch(function () { /* Vorlage bleibt */ });
  }
  var loeschWarten = null;
  $("aufgabenAnsicht").addEventListener("click", function (e) {
    if (ansicht !== "kunden") return;
    var b = e.target.closest("button"); if (!b) return;
    var d = b.dataset, a = kunden[d.kannehmen || d.kantwort || d.kfertig || d.kab || d.kneu || d.klosch]; if (!a) return;
    if (d.kannehmen) annehmen(a);
    else if (d.kantwort) antwortEntwurf(a);
    else if (d.kfertig) fertigMelden(a);
    else if (d.kab) kundenStatus(a.id, "abgelehnt").then(function () { toast("Abgelehnt. Schreib " + a.name + " am besten trotzdem eine kurze, freundliche Absage."); }).catch(fehlerToast);
    else if (d.kneu) kundenStatus(a.id, "neu").catch(fehlerToast);
    else if (d.klosch) {
      if (loeschWarten !== a.id) { loeschWarten = a.id; b.textContent = "Wirklich löschen?"; setTimeout(function () { if (loeschWarten === a.id) { loeschWarten = null; kundenZeichnen(); } }, 4000); return; }
      loeschWarten = null; B.weg("anfragen/" + a.id).then(function () { toast("Anfrage gelöscht."); }).catch(fehlerToast);
    }
  });

  /* ---------- Fenster: Steckbrief, neue KI, Team ---------- */
  var dlg = $("fenster");
  function fenster(html) { $("fensterInhalt").innerHTML = html; if (!dlg.open) dlg.showModal(); }
  dlg.addEventListener("click", function (e) { if (e.target === dlg || e.target.closest("[data-zu]")) dlg.close(); });
  function steckbrief(id) {
    var r = rolle(id); if (!r) return;
    var fr = T.firmen[r.firma];
    fenster('<div class="fenster"><div class="steckbrief"><div class="av" style="border-color:' + fr.farbe + '"><span aria-hidden="true">' + esc(r.em) + '</span><span class="ki-mark">KI</span></div><div><h3>' + esc(r.name) + '</h3><div>' + esc(r.rolle) + '</div><div class="wo">' + esc(fr.voll) + " · " + esc(r.abt) + "</div></div></div>" +
      (r.achtet && r.achtet.length ? '<div class="gruppe" style="margin:4px 0 0">Achtet bei jedem Projekt auf</div><ul class="achtet">' + r.achtet.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + "</ul>" : "") +
      '<p class="hinweis">' + esc(r.name) + ' ist eine KI-Rolle. Geantwortet wird von der Browser-KI, die in diese Rolle schlüpft.</p>' +
      '<div class="reihe"><button class="knopf haupt" type="button" id="dm">💬 ' + esc(r.name) + ' schreiben</button><button class="knopf" type="button" id="erw">@' + esc(r.name) + ' im Kanal</button>' +
      (r.eigen && istAdmin() ? '<button class="knopf gefahr" type="button" id="kiWeg">Entlassen</button>' : "") + '<span style="flex:1"></span><button class="knopf" type="button" data-zu>Schließen</button></div></div>');
    $("dm").onclick = function () { dlg.close(); oeffne(kiKey(r.id)); };
    $("erw").onclick = function () { dlg.close(); if (istKiChat(aktiv) || ansicht !== "chat") oeffne(ersterKanal()); ta.value = "@" + r.name + " " + ta.value; ta.focus(); hoehe(); };
    if ($("kiWeg")) $("kiWeg").onclick = function () { B.weg("team/msgs/" + K("kis") + "/" + r.id.replace(/^eigen-/, "")).then(function () { dlg.close(); toast(r.name + " wurde entlassen."); }).catch(fehlerToast); };
  }
  function neueKiFenster() {
    var abts = {}; firmenRollen(FIRMA).forEach(function (r) { abts[r.abt] = 1; });
    fenster('<form class="fenster" id="kiForm"><h3>➕ Neue KI einstellen</h3><p class="hinweis">Die neue KI gehört zum ' + esc(F.name) + ' Team. Sie bekommt einen eigenen Namen, eine Aufgabe und Prüfpunkte.</p>' +
      '<div class="reihe"><div class="feld" style="flex:1;min-width:160px"><label for="kiName">Name</label><input id="kiName" required maxlength="20" placeholder="z. B. Lumi" autocomplete="off"></div><div class="feld" style="width:90px"><label for="kiEm">Emoji</label><input id="kiEm" maxlength="4" value="🤖"></div></div>' +
      '<div class="feld"><label for="kiAbt">Abteilung</label><input id="kiAbt" list="abtListe" required maxlength="40" placeholder="z. B. Technik"><datalist id="abtListe">' + Object.keys(abts).map(function (a) { return '<option value="' + esc(a) + '">'; }).join("") + "</datalist></div>" +
      '<div class="feld"><label for="kiRolle">Aufgabe</label><input id="kiRolle" required maxlength="80" placeholder="z. B. Spieletests auf dem Tablet"></div>' +
      '<div class="feld"><label for="kiAchtet">Worauf achtet die KI? (eine Zeile pro Punkt)</label><textarea id="kiAchtet" rows="3" maxlength="300" placeholder="Läuft es flüssig?&#10;Sind die Knöpfe groß genug?"></textarea></div>' +
      '<p class="hinweis" id="kiFehler" hidden></p><div class="reihe"><button class="knopf" type="button" data-zu>Abbrechen</button><span style="flex:1"></span><button class="knopf haupt" type="submit">Einstellen</button></div></form>');
    $("kiForm").onsubmit = function (e) {
      e.preventDefault();
      var n = $("kiName").value.trim().replace(/[^A-Za-zÄÖÜäöüß\-]/g, "");
      if (!n) { $("kiFehler").hidden = false; $("kiFehler").textContent = "Der Name darf nur Buchstaben haben."; return; }
      if (rolleNachName(n)) { $("kiFehler").hidden = false; $("kiFehler").textContent = "„" + n + "“ gibt es schon. Nimm bitte einen anderen Namen."; return; }
      var achtet = $("kiAchtet").value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 5);
      B.push("team/msgs/" + K("kis"), { uid: uid, name: ich.name, t: B.zeit(), kiName: n.charAt(0).toUpperCase() + n.slice(1), em: $("kiEm").value.trim() || "🤖", abt: $("kiAbt").value.trim(), text: $("kiRolle").value.trim(), achtet: achtet })
        .then(function () { dlg.close(); toast(n + " ist jetzt im Team! 🎉"); }).catch(fehlerToast);
    };
    setTimeout(function () { $("kiName").focus(); }, 30);
  }
  function neuerKanal() {
    fenster('<form class="fenster" id="kanalForm"><h3># Neuer Kanal</h3><div class="feld"><label for="kanalName">Name</label><input id="kanalName" required maxlength="24" placeholder="z. B. sound" autocomplete="off"></div><div class="reihe"><button class="knopf" type="button" data-zu>Abbrechen</button><span style="flex:1"></span><button class="knopf haupt" type="submit">Anlegen</button></div></form>');
    $("kanalForm").onsubmit = function (e) {
      e.preventDefault();
      var n = $("kanalName").value.trim().toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
      if (!n) return;
      B.set("team/channels/" + K(n), { name: n, pos: Object.keys(kanaele).length }).then(function () { dlg.close(); oeffne(K(n)); }).catch(fehlerToast);
    };
    setTimeout(function () { $("kanalName").focus(); }, 30);
  }
  function teamFenster() {
    var h = '<div class="fenster"><h3>👥 Team &amp; Einstellungen</h3>';
    var an = Object.keys(anfragen);
    if (istAdmin() && an.length) {
      h += '<div class="gruppe" style="margin:0">Beitritts-Anfragen</div><div class="liste">' + an.map(function (k) { var a = anfragen[k]; return '<div class="zeile"><span class="name"><b>' + esc(a.name) + "</b><br><small>Code " + esc(a.code) + ' – vergleiche ihn mit dem Code auf dem anderen Gerät</small></span><button class="knopf klein haupt" type="button" data-ja="' + esc(k) + '">Aufnehmen</button><button class="knopf klein" type="button" data-nein="' + esc(k) + '">Ablehnen</button></div>'; }).join("") + "</div>";
    }
    h += '<div class="gruppe" style="margin:0">Mitglieder</div><div class="liste">' + Object.keys(mitglieder).map(function (k) { var m = mitglieder[k]; return '<div class="zeile"><span class="av mensch" style="width:30px;height:30px;border-radius:9px;background:' + farbe(k) + '">' + esc((m.name || "?").charAt(0).toUpperCase()) + '</span><span class="name">' + esc(m.name) + (k === uid ? " (du)" : "") + "</span><small>" + (m.rolle === "admin" ? "Chef" : "Mitglied") + "</small></div>"; }).join("") + "</div>";
    h += '<p class="hinweis">Mitglieder sind in allen fünf Team-Apps dieselben. Neue Leute öffnen eine Team-App, geben ihren Namen ein und du nimmst sie hier auf.</p>';
    var t = lade("omni-team-tempo", "gruendlich"), aus = lade("omni-team-ki-aus", false);
    h += '<div class="gruppe" style="margin:0">Browser-KI</div><div class="feld"><label for="kiTempo">Wie soll die KI antworten?</label><select id="kiTempo"><option value="gruendlich"' + (t === "gruendlich" && !aus ? " selected" : "") + '>Gründlich (besser, braucht ca. 1 GB Download)</option><option value="schnell"' + (t === "schnell" && !aus ? " selected" : "") + '>Schnell (kleiner, ca. 400 MB)</option><option value="aus"' + (aus ? " selected" : "") + '>Aus (Antworten nur aus den Steckbriefen)</option></select></div>' +
      (lade("omni-team-kein-gpu", false) ? '<p class="hinweis">Dieses Gerät kann die Browser-KI nicht ausführen (es fehlt WebGPU). Am besten klappt es am PC mit einem aktuellen Chrome oder Edge.</p>' : "");
    h += '<div class="feld"><label for="meinName">Dein Name</label><input id="meinName" maxlength="30" value="' + esc(ich.name) + '"></div>';
    h += '<div class="reihe">' + (DEMO ? '<button class="knopf gefahr" type="button" id="demoReset">Demo zurücksetzen</button>' : "") + '<span style="flex:1"></span><button class="knopf haupt" type="button" id="teamOk">Fertig</button></div></div>';
    fenster(h);
    $("teamOk").onclick = function () {
      var n = $("meinName").value.trim(), v = $("kiTempo").value;
      if (v === "aus") merke("omni-team-ki-aus", true); else { merke("omni-team-ki-aus", false); merke("omni-team-tempo", v); }
      if (n && n !== ich.name) B.set("team/members/" + uid, { name: n, rolle: ich.rolle }).catch(fehlerToast);
      dlg.close();
    };
    if ($("demoReset")) $("demoReset").onclick = function () { try { localStorage.removeItem("omni-team-demo"); localStorage.removeItem("omni-team-demo-anfragen"); } catch (e) { /* egal */ } location.reload(); };
    $("fensterInhalt").onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.ja) { var a = anfragen[b.dataset.ja], u = {}; u["team/members/" + b.dataset.ja] = { name: a.name, rolle: "mitglied" }; u["team/requests/" + b.dataset.ja] = null; B.update(u).then(function () { toast(a.name + " ist im Team! 🎉"); teamFenster(); }).catch(fehlerToast); }
      if (b.dataset.nein) B.weg("team/requests/" + b.dataset.nein).then(teamFenster).catch(fehlerToast);
    };
  }

  /* ---------- Los ---------- */
  tippsZeichnen();
  var demoGewuenscht = /[?&]demo=1\b/.test(location.search);
  starten(demoGewuenscht);
  if ("serviceWorker" in navigator && !demoGewuenscht) navigator.serviceWorker.register("sw.js").catch(function () { /* egal */ });
})();
