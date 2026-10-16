/* Kometenwerk – kleine Helfer für die öffentlichen Seiten */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  // Menü auf dem Handy
  var nav = document.querySelector(".nav"), burger = document.querySelector(".burger");
  if (nav && burger) {
    burger.addEventListener("click", function () {
      var auf = !nav.classList.contains("open");
      nav.classList.toggle("open", auf);
      burger.setAttribute("aria-expanded", auf ? "true" : "false");
    });
    nav.addEventListener("click", function (e) { if (e.target.closest(".nav-links a")) { nav.classList.remove("open"); burger.setAttribute("aria-expanded", "false"); } });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && nav.classList.contains("open")) { nav.classList.remove("open"); burger.setAttribute("aria-expanded", "false"); burger.focus(); } });
  }

  // Abschnitte gleiten beim Scrollen sanft ins Bild
  var els = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("show"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach(function (el) { io.observe(el); });
  } else {
    els.forEach(function (el) { el.classList.add("show"); });
  }

  // Jahr in der Fußzeile
  document.querySelectorAll("[data-jahr]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();

/* ---------- Effekte: Zähler, Parallax, Sternschnuppen, Easter Egg, Steckbriefe, Umlaufbahn, Mission Control, Tilt ---------- */
(function () {
  "use strict";
  var RUHIG = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MAUS = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;
  var $$ = function (s) { return [].slice.call(document.querySelectorAll(s)); };

  // Zähler laufen hoch
  var zahlen = $$("[data-zahl]");
  if (zahlen.length && !RUHIG && "IntersectionObserver" in window) {
    zahlen.forEach(function (el) { el.textContent = el.dataset.von || "0"; });
    var zio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return; zio.unobserve(e.target);
        var el = e.target, ziel = +el.dataset.zahl, von = +(el.dataset.von || 0), t0 = performance.now(), d = 1400;
        (function schritt(t) {
          var p = Math.min(1, (t - t0) / d), w = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(von + (ziel - von) * w);
          if (p < 1) requestAnimationFrame(schritt);
        })(t0);
      });
    }, { threshold: 0.6 });
    zahlen.forEach(function (el) { zio.observe(el); });
  }

  // Sterne bewegen sich mit Maus oder Handy-Neigung
  var px = $$(".parallax");
  if (px.length && !RUHIG) {
    var setze = function (x, y) { px.forEach(function (el) { var t = +(el.dataset.tiefe || 14); el.style.transform = "translate(" + (x * t).toFixed(1) + "px," + (y * t).toFixed(1) + "px)"; }); };
    if (MAUS) window.addEventListener("pointermove", function (e) { setze(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5); }, { passive: true });
    window.addEventListener("deviceorientation", function (e) { if (e.gamma == null) return; setze(Math.max(-1, Math.min(1, e.gamma / 30)) / 2, Math.max(-1, Math.min(1, (e.beta - 40) / 30)) / 2); }, { passive: true });
  }

  // Sternschnuppen
  var buehne = document.querySelector(".schnuppen");
  function schnuppe(b, verz) {
    var s = document.createElement("span"); s.className = "schnuppe";
    s.style.left = (35 + Math.random() * 70) + "%"; s.style.top = (Math.random() * 45) + "%";
    if (verz) s.style.animationDelay = verz + "ms";
    b.appendChild(s); setTimeout(function () { s.remove(); }, 1400 + (verz || 0));
  }
  if (buehne && !RUHIG) {
    (function naechste() { setTimeout(function () { if (!document.hidden) schnuppe(buehne); naechste(); }, 4500 + Math.random() * 5000); })();
    setTimeout(function () { schnuppe(buehne); }, 1800);
  }

  // Easter Egg: 5× auf den Kometen tippen
  var komet = document.getElementById("komet"), klicks = [];
  function toast(t) {
    var el = document.createElement("div"); el.className = "egg-toast"; el.setAttribute("role", "status"); el.textContent = t;
    document.body.appendChild(el); requestAnimationFrame(function () { el.classList.add("zeigen"); });
    setTimeout(function () { el.classList.remove("zeigen"); setTimeout(function () { el.remove(); }, 400); }, 3800);
  }
  if (komet) komet.addEventListener("click", function () {
    var jetzt = Date.now(); klicks = klicks.filter(function (k) { return jetzt - k < 2500; }); klicks.push(jetzt);
    komet.classList.add("zuck"); setTimeout(function () { komet.classList.remove("zuck"); }, 1200);
    if (klicks.length >= 5) {
      klicks = [];
      if (buehne && !RUHIG) for (var i = 0; i < 28; i++) schnuppe(buehne, i * 110);
      toast("🌠 Du hast den Sternschnuppen-Regen entdeckt!");
    }
  });

  // Steckbriefe umdrehen
  $$(".flip").forEach(function (f) {
    var vorne = f.querySelector(".front"), hinten = f.querySelector(".back");
    function dreh() {
      var an = !f.classList.contains("on");
      f.classList.toggle("on", an); f.setAttribute("aria-pressed", an ? "true" : "false");
      if (vorne) vorne.setAttribute("aria-hidden", an ? "true" : "false");
      if (hinten) hinten.setAttribute("aria-hidden", an ? "false" : "true");
    }
    f.addEventListener("click", dreh);
    f.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); dreh(); } });
  });

  // Umlaufbahn füllt sich beim Scrollen
  var bahn = document.querySelector(".bahn");
  if (bahn) {
    var punkte = [].slice.call(bahn.children), warte = false;
    var rechne = function () {
      warte = false;
      var r = bahn.getBoundingClientRect(), mitte = innerHeight * 0.62;
      var p = Math.max(0, Math.min(1, (mitte - r.top) / r.height));
      bahn.style.setProperty("--p", p.toFixed(3));
      punkte.forEach(function (li) { li.classList.toggle("an", li.getBoundingClientRect().top + 28 < mitte); });
    };
    window.addEventListener("scroll", function () { if (!warte) { warte = true; requestAnimationFrame(rechne); } }, { passive: true });
    rechne();
  }

  // Mission Control: Status und Neuigkeiten live aus der Datenbank (nur lesen)
  var mission = document.getElementById("mission");
  if (mission) {
    var st = document.getElementById("mStatus"), liste = document.getElementById("mNeu"), puls = mission.querySelector(".m-puls");
    var ctrl = "AbortController" in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 6000);
    fetch("https://krawallzoo-default-rtdb.europe-west1.firebasedatabase.app/public.json", ctrl ? { cache: "no-cache", signal: ctrl.signal } : { cache: "no-cache" })
      .then(function (r) { clearTimeout(timer); if (!r.ok) throw 0; return r.json(); })
      .then(function (d) {
        d = d || {};
        var s = d.status || { art: "ok", text: "" }, warn = s.art === "warn";
        st.textContent = s.text || (warn ? "Bei einer App gibt es gerade ein Problem – wir arbeiten dran." : "Alle Systeme laufen.");
        if (puls) puls.classList.toggle("warn", warn);
        var n = d.neu || {}, k = Object.keys(n).filter(function (x) { return n[x] && n[x].text; }).sort(function (a, b) { return (n[b].t || 0) - (n[a].t || 0); }).slice(0, 3);
        if (!k.length) return;
        liste.textContent = "";
        k.forEach(function (x) {
          var li = document.createElement("li"), t = document.createElement("span"), dt = new Date(n[x].t);
          t.className = "m-t"; t.textContent = isNaN(dt) ? "Neu" : dt.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
          li.appendChild(t); li.appendChild(document.createTextNode(n[x].text)); liste.appendChild(li);
        });
      })
      .catch(function () { st.textContent = "Live-Daten gerade nicht erreichbar"; if (puls) puls.classList.add("warn"); });
  }

  // App-Karten kippen leicht mit der Maus
  if (MAUS && !RUHIG) $$(".tilt").forEach(function (c) {
    c.addEventListener("pointermove", function (e) {
      var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      c.style.transform = "perspective(800px) rotateX(" + (-y * 8).toFixed(2) + "deg) rotateY(" + (x * 10).toFixed(2) + "deg) translateY(-4px)";
    });
    c.addEventListener("pointerleave", function () { c.style.transform = ""; });
  });
})();
