/* FLARESSA Arcade – Menü, Spiel-Schleife, Eingaben, Töne, Rekorde */
(function () {
  "use strict";
  var SP = window.ARCADE_SPIELE, $ = function (id) { return document.getElementById(id); };
  var KEY = "kw-arcade";
  var D = (window.KW && KW.load(KEY, null)) || { rekord: {}, ton: true, gespielt: {} };
  function speichern() { if (window.KW) KW.save(KEY, D); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---------- Menü ---------- */
  function menue() {
    $("raster").innerHTML = SP.map(function (s) {
      var r = D.rekord[s.id];
      return '<button class="karte" type="button" data-s="' + s.id + '" style="--c:' + s.farbe + '"><span class="em" aria-hidden="true">' + s.emoji + "</span><b>" + esc(s.name) + "</b><small>" + esc(s.text) + '</small><span class="best">' + (r ? "🏆 Rekord: " + r : "Neu – probier's aus!") + "</span></button>";
    }).join("");
  }
  $("raster").onclick = function (e) { var b = e.target.closest("[data-s]"); if (b) starte(b.dataset.s); };
  function tonKnopf() { $("tonKnopf").textContent = D.ton ? "🔊" : "🔇"; $("tonKnopf").setAttribute("aria-label", D.ton ? "Ton aus" : "Ton an"); }
  $("tonKnopf").onclick = function () { D.ton = !D.ton; speichern(); tonKnopf(); if (D.ton) ton("punkt"); };

  /* ---------- Töne (selbst erzeugt) ---------- */
  var ac = null;
  function ton(art) {
    if (!D.ton) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "suspended") ac.resume();
      var t = ac.currentTime;
      var T = { tick: [[660, 0.04, "square", 0.04]], tock: [[220, 0.06, "square", 0.05]], klick: [[520, 0.05, "triangle", 0.12], [780, 0.05, "triangle", 0.08, 0.04]], punkt: [[880, 0.07, "sine", 0.12], [1320, 0.1, "sine", 0.1, 0.06]],
        jubel: [[523, 0.1, "square", 0.07], [659, 0.1, "square", 0.07, 0.09], [784, 0.1, "square", 0.07, 0.18], [1047, 0.22, "square", 0.07, 0.27]], aua: [[300, 0.35, "sawtooth", 0.09, 0, 80]], flap: [[400, 0.08, "triangle", 0.1, 0, 700]],
        piu: [[1200, 0.08, "square", 0.025, 0, 400]], bumm: [[160, 0.18, "sawtooth", 0.08, 0, 40]] }[art] || [];
      T.forEach(function (n) {
        var o = ac.createOscillator(), g = ac.createGain(), ab = t + (n[4] || 0);
        o.type = n[2]; o.frequency.setValueAtTime(n[0], ab); if (n[5]) o.frequency.exponentialRampToValueAtTime(n[5], ab + n[1]);
        g.gain.setValueAtTime(n[3], ab); g.gain.exponentialRampToValueAtTime(0.0001, ab + n[1]);
        o.connect(g); g.connect(ac.destination); o.start(ab); o.stop(ab + n[1] + 0.02);
      });
    } catch (e) { /* ohne Ton */ }
  }

  /* ---------- Spiel ---------- */
  var cv = $("lw"), g = cv.getContext("2d"), spiel = null, laeuft = false, pause = false, zuletzt = 0, wackeln = 0, raf = 0, punkteAlt = -1;
  function groesse() {
    if (!spiel) return;
    var r = $("rahmen").getBoundingClientRect(), k = Math.min(r.width / spiel.W, r.height / spiel.H), dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.width = Math.floor(spiel.W * k) + "px"; cv.style.height = Math.floor(spiel.H * k) + "px";
    cv.width = Math.floor(spiel.W * k * dpr); cv.height = Math.floor(spiel.H * k * dpr);
    g.setTransform(cv.width / spiel.W, 0, 0, cv.height / spiel.H, 0, 0);
  }
  window.addEventListener("resize", groesse);
  var api = {
    ton: ton,
    wackeln: function (n) { wackeln = Math.max(wackeln, n); if (navigator.vibrate && n > 6) try { navigator.vibrate(30); } catch (e) { /* egal */ } },
    ende: function (punkte, text) { if (!laeuft) return; laeuft = false; setTimeout(function () { vorbei(punkte, text); }, 450); }
  };
  function starte(id) {
    spiel = SP.filter(function (s) { return s.id === id; })[0]; if (!spiel) return;
    $("buehne").hidden = false; document.body.style.overflow = "hidden";
    $("spielName").textContent = spiel.emoji + " " + spiel.name;
    knoepfe(); groesse();
    if (!D.gespielt[id]) { hilfeZeigen(true); D.gespielt[id] = 1; speichern(); } else neuStart();
    history.pushState({ spiel: id }, "");
  }
  function neuStart() {
    schicht(null); spiel.links = spiel.rechts = false; spiel.start(api); laeuft = true; pause = false; punkteAlt = -1;
    $("rekord").innerHTML = D.rekord[spiel.id] ? "Rekord<br>" + D.rekord[spiel.id] : "";
    zuletzt = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(schleife);
  }
  function schleife(jetzt) {
    raf = requestAnimationFrame(schleife);
    var dt = Math.min(0.05, (jetzt - zuletzt) / 1000); zuletzt = jetzt;
    if (laeuft && !pause) spiel.update(dt);
    g.save();
    if (wackeln > 0.2) { g.translate((Math.random() - 0.5) * wackeln, (Math.random() - 0.5) * wackeln); wackeln *= 0.86; }
    spiel.draw(g, pause ? 0 : dt);
    g.restore();
    if (spiel.punkte !== punkteAlt) { punkteAlt = spiel.punkte; $("punkte").textContent = spiel.punkte; }
  }
  function beenden() { laeuft = false; cancelAnimationFrame(raf); spiel = null; $("buehne").hidden = true; document.body.style.overflow = ""; schicht(null); menue(); }
  $("zurueck").onclick = function () { if (history.state && history.state.spiel) history.back(); else beenden(); };
  window.addEventListener("popstate", function () { if (spiel) beenden(); });
  $("pause").onclick = function () { if (!laeuft) return; pausieren(!pause); };
  function pausieren(an) {
    pause = an; $("pause").textContent = an ? "▶" : "⏸";
    if (an) schicht('<div class="box"><h2>Pause</h2><p>' + esc(spiel.hilfe) + '</p><button class="btn haupt" data-a="weiter">Weiterspielen</button><button class="btn" data-a="neu">Neu starten</button><button class="btn" data-a="menue">Zum Menü</button></div>');
    else schicht(null);
  }
  document.addEventListener("visibilitychange", function () { if (document.hidden && laeuft && !pause) pausieren(true); });
  function hilfeZeigen(erstesMal) {
    schicht('<div class="box"><div style="font-size:3rem">' + spiel.emoji + "</div><h2>" + esc(spiel.name) + "</h2><p>" + esc(spiel.text) + "</p><p><b>So geht's:</b> " + esc(spiel.hilfe) + '</p><button class="btn haupt" data-a="neu">' + (erstesMal ? "Los geht's!" : "Nochmal") + "</button></div>");
  }
  function vorbei(punkte, text) {
    var alt = D.rekord[spiel.id] || 0, neu = punkte > alt;
    if (neu) { D.rekord[spiel.id] = punkte; speichern(); ton("jubel"); }
    schicht('<div class="box">' + (neu && alt ? '<span class="rek">🏆 Neuer Rekord!</span>' : neu ? '<span class="rek">🏆 Dein erster Rekord!</span>' : "") + "<h2>" + esc(text || "Vorbei!") + '</h2><div class="gross">' + punkte + "</div><p>" + (neu ? "Stark!" : "Dein Rekord: " + alt) + '</p><button class="btn haupt" data-a="neu">Nochmal spielen</button><button class="btn" data-a="menue">Anderes Spiel</button></div>');
  }
  function schicht(html) { var s = $("schicht"); if (!html) { s.hidden = true; s.innerHTML = ""; return; } s.innerHTML = html; s.hidden = false; var b = s.querySelector(".btn.haupt"); if (b) b.focus(); }
  $("schicht").onclick = function (e) {
    var b = e.target.closest("[data-a]"); if (!b) return;
    e.stopPropagation();
    if (b.dataset.a === "neu") neuStart(); else if (b.dataset.a === "weiter") pausieren(false); else if (b.dataset.a === "menue") $("zurueck").click();
  };

  /* ---------- Eingaben ---------- */
  function knoepfe() {
    var k = spiel.knoepfe || [];
    $("knoepfe").innerHTML = k.map(function (x) { return '<button class="kn" type="button" data-k="' + esc(x[1]) + '" aria-label="' + esc(x[0]) + '">' + x[0] + "</button>"; }).join("");
    $("knoepfe").hidden = !k.length;
  }
  var gedrueckt = {};
  function taste(k, an) { if (!laeuft || pause || !spiel.taste) return; if (!spiel.mitLoslassen && !an) return; spiel.taste(k, an); }
  $("knoepfe").addEventListener("pointerdown", function (e) {
    var b = e.target.closest("[data-k]"); if (!b) return; e.preventDefault(); b.classList.add("an"); var k = b.dataset.k; taste(k, true);
    if (!spiel.mitLoslassen && (k === "ArrowLeft" || k === "ArrowRight" || k === "ArrowDown")) { gedrueckt[k] = setInterval(function () { taste(k, true); }, 110); }
    var los = function () { b.classList.remove("an"); clearInterval(gedrueckt[k]); taste(k, false); window.removeEventListener("pointerup", los); window.removeEventListener("pointercancel", los); };
    window.addEventListener("pointerup", los); window.addEventListener("pointercancel", los);
  });
  document.addEventListener("keydown", function (e) {
    if (!spiel) return;
    if (e.key === "Escape" || e.key === "p") { if (laeuft) pausieren(!pause); return; }
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].indexOf(e.key) >= 0) { e.preventDefault(); if (e.repeat && spiel.mitLoslassen) return; taste(e.key, true); }
  });
  document.addEventListener("keyup", function (e) { if (spiel) taste(e.key, false); });
  // Tippen, Wischen und Ziehen auf dem Spielfeld
  var start = null;
  function spielX(e) { var r = cv.getBoundingClientRect(); return (e.clientX - r.left) / r.width * spiel.W; }
  cv.addEventListener("pointerdown", function (e) {
    if (!laeuft || pause) return; e.preventDefault(); cv.setPointerCapture(e.pointerId);
    start = { x: e.clientX, y: e.clientY, t: performance.now(), gew: false };
    if (spiel.zieh) spiel.zieh(spielX(e));
  });
  cv.addEventListener("pointermove", function (e) {
    if (!start || !laeuft) return;
    if (spiel.zieh) spiel.zieh(spielX(e));
    var dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (spiel.wisch && !spiel.zieh && Math.hypot(dx, dy) > 28) {
      spiel.wisch(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "l" : "r") : (dy < 0 ? "o" : "u"));
      start.x = e.clientX; start.y = e.clientY; start.gew = true;
    }
  });
  cv.addEventListener("pointerup", function (e) {
    if (!start) return;
    var kurz = performance.now() - start.t < 260 && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 14;
    if (laeuft && !pause && kurz && !start.gew && spiel.tap) spiel.tap(spielX(e));
    if (spiel && spiel.ziehEnde) spiel.ziehEnde();
    start = null;
  });

  menue(); tonKnopf();
})();
