/* FIDELIA Chat – Speicher auf dem Gerät (IndexedDB) und Verbindung zum Server
   Der Server (Firebase) leitet nur weiter: Nachrichten liegen dort verschlüsselt,
   bis das Handy des Empfängers sie abholt – dann werden sie dort gelöscht. */
(function () {
  "use strict";
  var FC = window.FC = window.FC || {};
  var DEMO = (location.search.match(/[?&]demo=([a-z0-9]{1,12})/) || [])[1] || null;
  FC.DEMO = DEMO;

  /* ---------- Gerät: IndexedDB ---------- */
  var DBNAME = "fidelia-chat" + (DEMO ? "-demo-" + DEMO : "");
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (ok, nein) {
      var r = indexedDB.open(DBNAME, 1);
      r.onupgradeneeded = function () {
        var d = r.result;
        d.createObjectStore("ich");
        d.createObjectStore("kontakte", { keyPath: "cid" });
        var n = d.createObjectStore("nachrichten", { keyPath: "id" });
        n.createIndex("chat", "chat");
      };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { nein(r.error); };
    });
    return dbp;
  }
  function tx(store, art, fn) {
    return db().then(function (d) {
      return new Promise(function (ok, nein) {
        var t = d.transaction(store, art), s = t.objectStore(store), erg;
        erg = fn(s);
        t.oncomplete = function () { ok(erg && "result" in erg ? erg.result : erg); };
        t.onerror = t.onabort = function () { nein(t.error); };
      });
    });
  }
  FC.lokal = {
    hol: function (store, key) { return tx(store, "readonly", function (s) { return s.get(key); }); },
    alle: function (store) { return tx(store, "readonly", function (s) { return s.getAll(); }); },
    leg: function (store, wert, key) { return tx(store, "readwrite", function (s) { return key === undefined ? s.put(wert) : s.put(wert, key); }); },
    weg: function (store, key) { return tx(store, "readwrite", function (s) { return s.delete(key); }); },
    chat: function (cid) { return tx("nachrichten", "readonly", function (s) { return s.index("chat").getAll(cid); }); },
    chatWeg: function (cid) {
      return db().then(function (d) {
        return new Promise(function (ok, nein) {
          var t = d.transaction("nachrichten", "readwrite"), c = t.objectStore("nachrichten").index("chat").openCursor(IDBKeyRange.only(cid));
          c.onsuccess = function () { var x = c.result; if (x) { x.delete(); x.continue(); } };
          t.oncomplete = ok; t.onerror = function () { nein(t.error); };
        });
      });
    },
    allesWeg: function () {
      return db().then(function (d) { d.close(); dbp = null; return new Promise(function (ok) { var r = indexedDB.deleteDatabase(DBNAME); r.onsuccess = r.onerror = r.onblocked = function () { ok(); }; }); });
    }
  };

  /* ---------- Server ---------- */
  var CFG = { apiKey: "AIzaSyBaCkktmwGDgr6v_8p85aa2Fl6NsjODFMQ", authDomain: "krawallzoo.firebaseapp.com", databaseURL: "https://krawallzoo-default-rtdb.europe-west1.firebasedatabase.app", projectId: "krawallzoo", storageBucket: "krawallzoo.firebasestorage.app" };
  var FB = "https://cdn.jsdelivr.net/npm/firebase@10.12.2/";
  function skript(src) { return new Promise(function (ok, nein) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = function () { nein(new Error("Laden fehlgeschlagen")); }; document.head.appendChild(s); }); }
  function zeitlimit(p, ms, text) { return Promise.race([p, new Promise(function (_, n) { setTimeout(function () { n(new Error(text)); }, ms); })]); }

  function firebaseServer() {
    return zeitlimit((async function () {
      if (!window.firebase) { await skript(FB + "firebase-app-compat.js"); await skript(FB + "firebase-auth-compat.js"); await skript(FB + "firebase-database-compat.js"); }
      if (!firebase.apps.length) firebase.initializeApp(CFG);
      var d = firebase.database(), auth = firebase.auth();
      await new Promise(function (r) { var un = auth.onAuthStateChanged(function () { un(); r(); }); });
      if (!auth.currentUser) await auth.signInAnonymously();
      var P = function (p) { return d.ref("fchat/" + p); };
      return {
        uid: auth.currentUser.uid,
        TS: firebase.database.ServerValue.TIMESTAMP,
        hol: function (p) { return P(p).once("value").then(function (s) { return s.val(); }); },
        setz: function (p, v) { return P(p).set(v); },
        weg: function (p) { return P(p).remove(); },
        neu: function (p, v) { var r = P(p).push(); return r.set(v).then(function () { return r.key; }); },
        neuKey: function (p) { return P(p).push().key; },
        kinder: function (p, cb, wegCb) {
          var r = P(p), a = function (s) { cb(s.key, s.val()); }, w = function (s) { if (wegCb) wegCb(s.key); };
          r.on("child_added", a); r.on("child_changed", a); r.on("child_removed", w);
          return function () { r.off("child_added", a); r.off("child_changed", a); r.off("child_removed", w); };
        },
        wert: function (p, cb) { var r = P(p), f = function (s) { cb(s.val()); }; r.on("value", f, function () { cb(null); }); return function () { r.off("value", f); }; },
        verbunden: function (cb) { var r = d.ref(".info/connected"), f = function (s) { cb(!!s.val()); }; r.on("value", f); return function () { r.off("value", f); }; },
        // Meldungen liegen außerhalb, nur der Chef darf sie lesen
        meldungen: function (cb) { var r = P("meldungen"), f = function (s) { cb(s.val() || {}); }; r.on("value", f, function () { cb(null); }); return function () { r.off("value", f); }; }
      };
    })(), 15000, "Der Chat-Server antwortet nicht. Bist du online?");
  }

  /* Übungs-Server: alles im Browser (localStorage), für Tests mit zwei Fenstern: ?demo=anna / ?demo=ben */
  function demoServer() {
    var KEY = "fchat-demo-baum", uid = "uid-" + DEMO, horcher = [];
    function lies() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
    function schreib(b) { localStorage.setItem(KEY, JSON.stringify(b)); }
    function teile(p) { return String(p).split("/").filter(Boolean); }
    function bei(b, p) { var t = teile(p), x = b; for (var i = 0; i < t.length; i++) { if (x == null || typeof x !== "object") return null; x = x[t[i]]; } return x === undefined ? null : x; }
    function setze(b, p, v) {
      var t = teile(p), x = b;
      for (var i = 0; i < t.length - 1; i++) { if (typeof x[t[i]] !== "object" || x[t[i]] === null) x[t[i]] = {}; x = x[t[i]]; }
      if (v === null || v === undefined) delete x[t[t.length - 1]]; else x[t[t.length - 1]] = v;
    }
    function aufloesen(v) { if (v && typeof v === "object") { if (v[".sv"] === "timestamp") return Date.now(); var o = Array.isArray(v) ? [] : {}; Object.keys(v).forEach(function (k) { o[k] = aufloesen(v[k]); }); return o; } return v; }
    function melden() { horcher.forEach(function (h) { h(); }); }
    window.addEventListener("storage", function (e) { if (e.key === KEY) melden(); });
    var zaehler = 0;
    return Promise.resolve({
      uid: uid, demo: true,
      TS: { ".sv": "timestamp" },
      hol: function (p) { return Promise.resolve(JSON.parse(JSON.stringify(bei(lies(), p)))); },
      setz: function (p, v) { var b = lies(); setze(b, p, aufloesen(v)); schreib(b); setTimeout(melden, 0); return Promise.resolve(); },
      weg: function (p) { var b = lies(); setze(b, p, null); schreib(b); setTimeout(melden, 0); return Promise.resolve(); },
      neuKey: function () { return "-d" + Date.now().toString(36) + (zaehler++) + Math.random().toString(36).slice(2, 6); },
      neu: function (p, v) { var k = this.neuKey(); return this.setz(p + "/" + k, v).then(function () { return k; }); },
      kinder: function (p, cb, wegCb) {
        var alt = {};
        function pruef() {
          var jetzt = bei(lies(), p) || {};
          Object.keys(jetzt).forEach(function (k) { var s = JSON.stringify(jetzt[k]); if (alt[k] !== s) { alt[k] = s; cb(k, JSON.parse(s)); } });
          Object.keys(alt).forEach(function (k) { if (!(k in jetzt)) { delete alt[k]; if (wegCb) wegCb(k); } });
        }
        horcher.push(pruef); setTimeout(pruef, 0);
        return function () { horcher = horcher.filter(function (h) { return h !== pruef; }); };
      },
      wert: function (p, cb) { var alt; function pruef() { var s = JSON.stringify(bei(lies(), p)); if (s !== alt) { alt = s; cb(JSON.parse(s)); } } horcher.push(pruef); setTimeout(pruef, 0); return function () { horcher = horcher.filter(function (h) { return h !== pruef; }); }; },
      verbunden: function (cb) { setTimeout(function () { cb(true); }, 0); return function () {}; },
      meldungen: function (cb) { return this.wert("meldungen", function (v) { cb(v || {}); }); }
    });
  }

  FC.server = function () { return DEMO ? demoServer() : firebaseServer(); };
})();
