/* Kometenwerk – Texterkennung (OCR) direkt im Browser.
   Alles liegt auf unserem eigenen Server, kein Foto verlässt das Gerät.
   Nutzung: KWOCR.erkenne(dateiOderBild, "deu", function (prozent, text) {}).then(function (text) { … }) */
(function () {
  "use strict";
  var me = document.currentScript, BASE = new URL("./", (me && me.src) || location.href).href;
  var laden = null, worker = null, workerSprache = "";

  function skript(src) {
    return new Promise(function (ok, nein) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = function () { nein(new Error("laden")); }; document.head.appendChild(s); });
  }
  function bibliothek() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (!laden) laden = skript(BASE + "tesseract.min.js").then(function () { return window.Tesseract; }).catch(function (e) { laden = null; throw e; });
    return laden;
  }
  var fortschritt = null;
  function holeWorker(sprache) {
    if (worker && workerSprache === sprache) return Promise.resolve(worker);
    var alt = worker; worker = null;
    return Promise.resolve(alt && alt.terminate()).catch(function () {}).then(bibliothek).then(function (T) {
      return T.createWorker(sprache, 1, {
        workerPath: BASE + "worker.min.js", corePath: BASE, langPath: BASE + "lang", gzip: true, workerBlobURL: false,
        logger: function (m) { if (fortschritt && m && typeof m.progress === "number") fortschritt(m.status, m.progress); }
      });
    }).then(function (w) { worker = w; workerSprache = sprache; return w; });
  }

  /* Foto verkleinern, damit es schnell geht (max. 2000 px) */
  function vorbereiten(datei) {
    return new Promise(function (ok, nein) {
      var url = URL.createObjectURL(datei), img = new Image();
      img.onload = function () {
        var f = Math.min(1, 2000 / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
        var x = c.getContext("2d"); x.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); ok(c);
      };
      img.onerror = function () { URL.revokeObjectURL(url); nein(new Error("bild")); };
      img.src = url;
    });
  }

  window.KWOCR = {
    /* sprache z. B. "deu", "eng", "deu+eng", "fra+deu" */
    erkenne: function (datei, sprache, onFortschritt) {
      fortschritt = function (status, p) {
        if (!onFortschritt) return;
        var anteil = /recogniz/i.test(status) ? 0.35 + p * 0.65 : /load|init/i.test(status) ? p * 0.35 : 0.35;
        onFortschritt(Math.round(anteil * 100), /recogniz/i.test(status) ? "Text wird gelesen …" : "Texterkennung wird geladen …");
      };
      return Promise.all([holeWorker(sprache || "deu"), vorbereiten(datei)]).then(function (r) {
        return r[0].recognize(r[1]);
      }).then(function (res) { fortschritt = null; return (res && res.data && res.data.text) || ""; });
    },
    beenden: function () { if (worker) { worker.terminate(); worker = null; workerSprache = ""; } }
  };
})();
