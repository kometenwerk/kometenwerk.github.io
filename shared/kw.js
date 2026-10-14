/* Kometenwerk – gemeinsame Helfer für alle Apps */
(function () {
  "use strict";
  var KW = window.KW = {};

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
    f.innerHTML = '<span>Ein Projekt von <a href="../">Kometenwerk</a> · Deine Daten bleiben auf diesem Gerät.</span>' +
      '<span><button type="button" data-a="save">Sicherung speichern</button> · <button type="button" data-a="load">Sicherung laden</button></span>';
    f.querySelector('[data-a="save"]').onclick = function () { KW.backup(name, getData()); };
    f.querySelector('[data-a="load"]').onclick = function () {
      KW.restore(name, function (d) {
        if (confirm("Die Sicherung ersetzt alles, was gerade in der App ist. Weiter?")) { setData(d); KW.toast("Sicherung geladen."); }
      });
    };
    document.body.appendChild(f);
  };

  document.addEventListener("DOMContentLoaded", function () { setupInstall(); setupSW(); });
})();
