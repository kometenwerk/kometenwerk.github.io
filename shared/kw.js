/* OMNIVIA – gemeinsame Helfer für alle Apps (FIDELIA, AORIS, Kometenwerk Robotics) */
(function () {
  "use strict";
  var KW = window.KW = {};

  /* ✕-Knopf „Zurück zur Startseite“ (shared/zurueck.js) – wichtig, wenn die Startseite als App installiert ist */
  try {
    var hier = document.currentScript && document.currentScript.src;
    if (hier) { var zu = document.createElement("script"); zu.src = new URL("zurueck.js", hier).href; document.head.appendChild(zu); }
  } catch (e) {}

  KW.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  KW.id = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };

  /* Speichern auf dem Gerät. Klappt auch, wenn der Browser Speicher verbietet (dann nur bis zum Schließen). */
  var mem = {};
  KW.load = function (key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw != null) return JSON.parse(raw);
    } catch (e) {}
    return key in mem ? mem[key] : fallback;
  };
  KW.save = function (key, value) {
    mem[key] = value;
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  };

  /* Kurzer Hinweis unten, optional mit Knopf (z. B. Rückgängig) */
  var toastTimer = null;
  KW.toast = function (text, label, action) {
    var old = document.querySelector(".kw-toast");
    if (old) old.remove();
    clearTimeout(toastTimer);
    var t = document.createElement("div");
    t.className = "kw-toast";
    t.setAttribute("role", "status");
    t.innerHTML = "<span>" + KW.esc(text) + "</span>";
    if (label && action) {
      var b = document.createElement("button");
      b.textContent = label;
      b.onclick = function () { t.remove(); action(); };
      t.appendChild(b);
    }
    document.body.appendChild(t);
    toastTimer = setTimeout(function () { t.remove(); }, label ? 6000 : 2600);
  };

  /* Datum-Helfer */
  // Termine aus anderen OMNIVIA-Apps in den FIDELIA Planer eintragen (gleiches Gerät, gleiche Website).
  // liste: [{ quelle: "pet-impf-123", titel, datum: "JJJJ-MM-TT", zeit: "HH:MM", notiz }] – gleiche quelle wird nicht doppelt eingetragen.
  KW.planerTermine = function (liste) {
    var d = KW.load("kw-planer", null);
    if (!d || !Array.isArray(d.eintraege)) d = { eintraege: [] };
    var neu = 0, alt = 0;
    (liste || []).forEach(function (t) {
      if (!t || !t.datum || !t.titel) return;
      var da = d.eintraege.filter(function (e) { return t.quelle && e.quelle === t.quelle; })[0];
      if (da) { da.titel = t.titel; da.datum = t.datum; da.zeit = t.zeit || ""; da.notiz = t.notiz || ""; alt++; return; }
      d.eintraege.push({ id: KW.id(), erledigt: false, erstellt: new Date().toISOString(), typ: "termin", fach: "", titel: String(t.titel).slice(0, 120), datum: t.datum, zeit: t.zeit || "", notiz: String(t.notiz || "").slice(0, 300), quelle: t.quelle || "" });
      neu++;
    });
    KW.save("kw-planer", d);
    return { neu: neu, aktualisiert: alt };
  };
  KW.today = function () { var d = new Date(); return KW.ymd(d); };
  KW.ymd = function (d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };
  KW.parse = function (s) { var p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
  KW.addDays = function (s, n) { var d = KW.parse(s); d.setDate(d.getDate() + n); return KW.ymd(d); };
  KW.days = function (a, b) { return Math.round((KW.parse(b) - KW.parse(a)) / 864e5); };

  /* Sicherung als Datei – damit nichts verloren geht und für später, wenn es das Kometen-Konto gibt */
  KW.backup = function (name, data) {
    var blob = new Blob([JSON.stringify({ app: name, version: 1, gespeichert: new Date().toISOString(), daten: data }, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kometenwerk-" + name + "-" + KW.today() + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  };
  KW.restore = function (name, done) {
    var inp = document.createElement("input");
    inp.type = "file"; inp.accept = "application/json,.json";
    inp.onchange = function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      f.text().then(function (txt) {
        var j = JSON.parse(txt);
        if (!j || j.app !== name || !j.daten) throw new Error("falsch");
        done(j.daten);
      }).catch(function () { KW.toast("Diese Datei ist keine Sicherung von dieser App."); });
    };
    inp.click();
  };

  /* Als App installieren */
  var deferred = null;
  function standalone() {
    return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  }
  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }
  function iosHilfe() {
    var d = document.getElementById("kwIosHilfe");
    if (!d) {
      d = document.createElement("dialog");
      d.id = "kwIosHilfe"; d.className = "sheet";
      d.innerHTML = '<div class="sheet-in"><h2>Auf dem iPhone installieren</h2>' +
        '<p>1. Tippe unten in Safari auf <b>Teilen</b> (das Viereck mit dem Pfeil nach oben).</p>' +
        '<p>2. Wähle <b>„Zum Home-Bildschirm“</b>.</p><p>3. Tippe oben rechts auf <b>„Hinzufügen“</b>.</p>' +
        '<p class="muted">Danach findest du die App mit eigenem Icon auf deinem Startbildschirm.</p>' +
        '<form method="dialog" class="sheet-foot"><button class="btn primary">Verstanden</button></form></div>';
      document.body.appendChild(d);
    }
    d.showModal();
  }
  function setupInstall() {
    var b = document.getElementById("kwInstall");
    if (!b) return;
    if (standalone()) { b.hidden = true; return; }
    if (isIOS()) { b.hidden = false; b.onclick = iosHilfe; return; }
    b.hidden = true;
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault(); deferred = e; b.hidden = false;
    });
    b.onclick = function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.then(function (c) {
        if (c && c.outcome === "accepted") { b.hidden = true; KW.toast("Installiert! Du findest die App jetzt auf deinem Startbildschirm."); }
        deferred = null;
      });
    };
    window.addEventListener("appinstalled", function () { b.hidden = true; });
  }

  /* Offline-Speicher */
  function setupSW() {
    if (!("serviceWorker" in navigator) || location.protocol !== "https:") return;
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  /* Fußzeile mit Sicherung */
  KW.footer = function (name, getData, setData) {
    var f = document.createElement("footer");
    f.className = "kw-foot";
    var MARKE = { fidelia: ["FIDELIA Digital", "../apps/"], aoris: ["AORIS Tech", "../lab/"], kometenwerk: ["Kometenwerk Robotics", "../robotics/"], flaressa: ["FLARESSA Gaming", "../spiele/"] }[document.documentElement.getAttribute("data-marke")];
    f.innerHTML = '<span>' + (MARKE ? 'Eine App von <a href="' + MARKE[1] + '">' + MARKE[0] + '</a> · ' : '') + 'Ein Angebot der <a href="../">OMNIVIA Group</a> · Deine Daten bleiben auf diesem Gerät.</span>' +
      '<span><button type="button" data-a="save">Sicherung speichern</button> · <button type="button" data-a="load">Sicherung laden</button></span>';
    f.querySelector('[data-a="save"]').onclick = function () { KW.backup(name, getData()); };
    f.querySelector('[data-a="load"]').onclick = function () {
      KW.restore(name, function (d) {
        if (confirm("Die Sicherung ersetzt alles, was gerade in der App ist. Weiter?")) { setData(d); KW.toast("Sicherung geladen."); }
      });
    };
    document.body.appendChild(f);
  };


  /* Altersempfehlung in der Kopfleiste */
  var ALTER = { karten: 8, planer: 8, notizen: 8, quiz: 8, fokus: 8, taschengeld: 8, beats: 6, werkstatt: 10, kueche: 10, ki: 12, chat: 12, arcade: 6, pet: 8, events: 10, form: 10, health: 10, ride: 8, feed: 12 };
  function setupAlter() {
    var teil = location.pathname.split("/").filter(Boolean), ordner = teil[teil.length - 1] === "index.html" ? teil[teil.length - 2] : teil[teil.length - 1];
    var a = ALTER[ordner], bar = document.querySelector(".kw-bar h1");
    if (!a || !bar || document.querySelector(".kw-alter")) return;
    var l = document.createElement("a");
    l.className = "kw-alter"; l.href = "../alter/#ab" + a; l.textContent = "ab " + a;
    l.title = "Altersempfehlung: ab " + a + " Jahren"; l.setAttribute("aria-label", "Empfohlen ab " + a + " Jahren");
    bar.insertAdjacentElement("afterend", l);
  }
  document.addEventListener("DOMContentLoaded", function () { setupInstall(); setupSW(); setupAlter(); });
})();
