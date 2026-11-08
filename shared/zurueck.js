/* OMNIVIA – ✕-Knopf „Zurück zur Startseite“ für alle Apps und Spiele.
   Wichtig, wenn die Startseite als App auf dem Handy installiert ist: Dort gibt es
   keine Browser-Leiste und keinen Zurück-Knopf.

   Einbinden:
   - Apps mit shared/kw.js bekommen den Knopf automatisch (kw.js lädt diese Datei).
   - Andere Seiten: <script src="../shared/zurueck.js" defer></script>
     Für Spiele mit Nachfrage: data-fragen="Spiel verlassen?"
     Knopf in eine eigene Kopfleiste setzen: data-leiste=".kopf"
   - Eine App kann vor dem Verlassen selbst fragen: KW.vorVerlassen = function () { return true / false; }
   - Kein Knopf auf einer Seite: <html data-kein-zu>
*/
(function () {
  "use strict";
  if (window.__omniZu) return;
  window.__omniZu = true;

  // Im Video-Studio werden Spiele in einem Rahmen gezeigt – dort keinen Knopf.
  try { if (window.self !== window.top) return; } catch (e) { return; }

  var me = document.currentScript || document.querySelector('script[src*="zurueck.js"]');
  var start = new URL("../", (me && me.src) || location.href).href;

  function los() {
    // Einstellungen am <script>-Tag der Seite (auch wenn kw.js die Datei schon vorher geladen hat)
    var cfg = document.querySelector('script[src*="zurueck.js"][data-fragen], script[src*="zurueck.js"][data-leiste]');
    var frage = (cfg && cfg.getAttribute("data-fragen")) || "";
    var leiste = (cfg && cfg.getAttribute("data-leiste")) || ".kw-bar";
    if (document.documentElement.hasAttribute("data-kein-zu") || document.querySelector(".omni-zu")) return;
    if (location.href.split(/[?#]/)[0] === start) return;

    var bar = document.querySelector(leiste);
    var b = document.createElement("a");
    b.href = start;
    b.className = "omni-zu" + (bar ? " in-leiste" : " schwebend");
    b.setAttribute("aria-label", "Schließen – zurück zur Startseite");
    b.title = "Zurück zur Startseite";
    b.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" fill="none"/></svg>';
    b.addEventListener("click", function (e) {
      var ok = true;
      try { if (window.KW && typeof KW.vorVerlassen === "function") ok = KW.vorVerlassen() !== false; } catch (x) {}
      if (ok && frage) ok = confirm(frage);
      if (!ok) e.preventDefault();
    });

    var css = document.createElement("style");
    css.textContent =
      ".omni-zu{flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:50%;color:inherit;text-decoration:none;-webkit-tap-highlight-color:transparent}" +
      ".omni-zu.in-leiste{background:rgba(255,255,255,.14);margin-left:2px}" +
      ".omni-zu.in-leiste:hover{background:rgba(255,255,255,.26)}" +
      ".omni-zu.schwebend{position:fixed;z-index:2147482000;top:calc(10px + env(safe-area-inset-top,0px));right:calc(10px + env(safe-area-inset-right,0px));width:38px;height:38px;color:#fff;background:rgba(10,11,16,.62);border:1px solid rgba(255,255,255,.28);box-shadow:0 2px 10px rgba(0,0,0,.35);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}" +
      ".omni-zu.schwebend:hover{background:rgba(10,11,16,.8)}" +
      ".omni-zu:focus-visible{outline:3px solid #f2c46d;outline-offset:2px}" +
      "@media print{.omni-zu{display:none}}";
    document.head.appendChild(css);

    if (bar) bar.appendChild(b); else document.body.appendChild(b);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", los);
  else los();
})();
