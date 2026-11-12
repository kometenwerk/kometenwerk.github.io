// FLARESSA Buzzer – Quiz-Show auf einem Gerät (Laptop am Beamer oder Tablet in der Mitte).
// Buzzern per Taste (auch USB-Buzzer, die sich wie Tasten verhalten) oder per Touch-Feld.
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var esc = KW.esc, app = $("#app"), KEY = "kw-buzzer";
  var FARBEN = ["#dc2626", "#2563eb", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#db2777", "#4d7c0f"];
  var TASTEN = ["a", "l", "q", "p", "z", "m", "1", "0"];
  var B = Object.assign({
    teams: [{ name: "Team Rot", farbe: FARBEN[0], taste: "a" }, { name: "Team Blau", farbe: FARBEN[1], taste: "l" }],
    fragenText: "Wie viele Beine hat eine Spinne? | 8 | 1\nWelcher Planet ist der Sonne am nächsten? | Merkur | 1\nWie heißt die Hauptstadt von Österreich? | Wien | 1\nWas ist 12 × 12? | 144 | 2\nIn welchem Jahr fiel die Berliner Mauer? | 1989 | 2",
    sekunden: 20, minus: true, touch: false, ton: true
  }, KW.load(KEY, {}));
  var sichern = function () { KW.save(KEY, B); };

  /* ---------- Töne ---------- */
  var ac = null;
  function ton(f, d, typ) { if (!B.ton) return; try { ac = ac || new AudioContext(); var o = ac.createOscillator(), g = ac.createGain(); o.type = typ || "square"; o.frequency.value = f; g.gain.setValueAtTime(.18, ac.currentTime); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + d); o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + d); } catch (e) {} }
  var TON = { buzz: function () { ton(220, .5, "sawtooth"); }, ok: function () { ton(660, .15, "triangle"); setTimeout(function () { ton(880, .3, "triangle"); }, 150); }, nein: function () { ton(160, .6, "square"); }, tick: function () { ton(1200, .05, "sine"); } };

  function fragenLesen() {
    return B.fragenText.split("\n").map(function (z) { return z.trim(); }).filter(Boolean).map(function (z) { var t = z.split("|").map(function (x) { return x.trim(); }); return { frage: t[0], antwort: t[1] || "", punkte: Math.max(1, parseInt(t[2], 10) || 1) }; });
  }

  /* ---------- Einrichten ---------- */
  function einrichten() {
    document.body.classList.remove("spiel");
    app.innerHTML = '<div class="b-hinweis">So geht\'s: Laptop an den Beamer oder Fernseher – jedes Team bekommt eine Taste (oder echte USB-Buzzer, die wie Tasten funktionieren). Mit „Touch-Felder“ wird ein Tablet in der Mitte zum Buzzer-Pult. Du als Quizmaster bewertest mit <b>Enter</b> (richtig) und <b>Rücktaste</b> (falsch).</div>' +
      '<h2>Teams</h2><div class="b-teams" id="teams"></div><button type="button" class="btn" id="teamNeu" style="margin-top:8px">+ Team</button>' +
      '<h2>Fragen</h2><div class="card b-fragen" style="padding:12px"><p class="muted" style="margin-top:0">Eine Frage pro Zeile: <code>Frage | Antwort | Punkte</code>. Ohne Fragen kannst du auch frei fragen – dann zeigt der Bildschirm nur die Buzzer.</p><textarea class="inp" id="fragen" aria-label="Fragen">' + esc(B.fragenText) + '</textarea><p class="muted" id="anzahl"></p></div>' +
      '<h2>Regeln</h2><div class="card" style="padding:12px"><label class="row" style="gap:8px;align-items:center">Zeit zum Antworten nach dem Buzzern: <input class="inp" id="sek" style="width:80px" inputmode="numeric" value="' + B.sekunden + '"> Sekunden (0 = ohne Uhr)</label>' +
      '<label class="row" style="gap:8px;margin-top:8px"><input type="checkbox" id="minus"' + (B.minus ? " checked" : "") + '> Falsche Antwort gibt 1 Minuspunkt</label><label class="row" style="gap:8px;margin-top:8px"><input type="checkbox" id="touch"' + (B.touch ? " checked" : "") + '> Touch-Felder anzeigen (Tablet als Buzzer-Pult)</label><label class="row" style="gap:8px;margin-top:8px"><input type="checkbox" id="tonA"' + (B.ton ? " checked" : "") + "> Töne</label></div>" +
      '<div class="row" style="gap:8px;margin:18px 0"><button type="button" class="btn primary" id="los">▶ Quiz starten</button><button type="button" class="btn" id="test">🔔 Buzzer testen</button></div>';
    teams();
    $("#fragen").oninput = function () { B.fragenText = this.value; sichern(); anzahl(); };
    $("#sek").oninput = function () { B.sekunden = Math.max(0, parseInt(this.value, 10) || 0); sichern(); };
    $("#minus").onchange = function () { B.minus = this.checked; sichern(); };
    $("#touch").onchange = function () { B.touch = this.checked; sichern(); };
    $("#tonA").onchange = function () { B.ton = this.checked; sichern(); };
    $("#teamNeu").onclick = function () { if (B.teams.length >= 8) return KW.toast("Höchstens 8 Teams."); var i = B.teams.length; B.teams.push({ name: "Team " + (i + 1), farbe: FARBEN[i], taste: TASTEN[i] }); sichern(); teams(); };
    $("#los").onclick = function () { if (B.teams.length < 1) return; starten(false); };
    $("#test").onclick = function () { starten(true); };
    anzahl();
  }
  function anzahl() { var n = fragenLesen().length; $("#anzahl").textContent = n ? n + " Fragen" : "Keine Fragen – freies Quiz."; }
  function teams() {
    $("#teams").innerHTML = B.teams.map(function (t, i) { return '<div class="b-team"><input type="color" data-t="farbe" data-i="' + i + '" value="' + esc(t.farbe) + '" aria-label="Farbe"><input class="inp" data-t="name" data-i="' + i + '" value="' + esc(t.name) + '" aria-label="Teamname"><input class="inp b-taste" data-t="taste" data-i="' + i + '" value="' + esc(t.taste) + '" maxlength="1" aria-label="Buzzer-Taste" title="Buzzer-Taste"><button type="button" class="btn small" data-weg="' + i + '" aria-label="Team entfernen">×</button></div>'; }).join("") + '<p class="muted" style="margin:0;font-size:.85rem">Rechts die Buzzer-Taste. Nicht Enter, Leertaste oder Pfeile nehmen – die braucht der Quizmaster.</p>';
    $("#teams").querySelectorAll("[data-t]").forEach(function (el) { el.oninput = function () { var v = el.value; if (el.dataset.t === "taste") { v = v.toLowerCase().slice(-1); el.value = v; } B.teams[+el.dataset.i][el.dataset.t] = v; sichern(); }; });
    $("#teams").querySelectorAll("[data-weg]").forEach(function (b) { b.onclick = function () { B.teams.splice(+b.dataset.weg, 1); sichern(); teams(); }; });
  }

  /* ---------- Spiel ---------- */
  var S = null, uhrT = null;
  function starten(test) {
    S = { test: test, fragen: test ? [] : fragenLesen(), nr: 0, punkte: B.teams.map(function () { return 0; }), dran: -1, raus: [], offen: false, loesung: false, rest: 0, ende: false };
    document.body.classList.add("spiel");
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
    S.offen = true; zeichne();
  }
  function frageAkt() { return S.fragen[S.nr] || null; }
  function zeichne() {
    var f = frageAkt(), frei = !S.fragen.length;
    var mitte;
    if (S.ende) {
      var rang = B.teams.map(function (t, i) { return { t: t, p: S.punkte[i] }; }).sort(function (a, b) { return b.p - a.p; });
      mitte = '<div class="s-ende"><div class="s-frage">🏆 ' + esc(rang[0].t.name) + " gewinnt!</div><table>" + rang.map(function (r, i) { return "<tr><td>" + (i + 1) + '.</td><td style="color:' + esc(r.t.farbe) + '">' + esc(r.t.name) + "</td><td><b>" + r.p + "</b></td></tr>"; }).join("") + "</table></div>";
    } else {
      mitte = (S.test ? '<div class="s-frage">Buzzer-Test: Jedes Team drückt einmal seine Taste.</div>' : frei ? '<div class="s-frage">Frage ' + (S.nr + 1) + "</div>" : '<div class="s-frage">' + esc(f.frage) + "</div>") +
        (S.dran >= 0 ? '<div class="s-dran" style="background:' + esc(B.teams[S.dran].farbe) + '">' + esc(B.teams[S.dran].name) + "</div>" + (B.sekunden && !S.test ? '<div class="s-uhr' + (S.rest <= 5 ? " knapp" : "") + '" id="uhr">' + S.rest + "</div>" : "") : '<div class="s-uhr" style="opacity:.5">' + (S.offen ? "Wer weiß es? Buzzern!" : "") + "</div>") +
        (S.loesung && f ? '<div class="s-antwort">Antwort: ' + esc(f.antwort) + "</div>" : "");
    }
    app.innerHTML = '<div class="s-buehne"><div class="s-oben"><span>' + (S.ende ? "Ende" : S.test ? "Test" : frei ? "Freies Quiz" : "Frage " + (S.nr + 1) + " von " + S.fragen.length + " · " + f.punkte + (f.punkte === 1 ? " Punkt" : " Punkte")) + '</span><span><button type="button" id="ton" aria-label="Töne an/aus">' + (B.ton ? "🔊" : "🔇") + '</button> <button type="button" id="stop">✕ Beenden</button></span></div>' +
      '<div class="s-mitte">' + mitte + "</div>" +
      (S.ende ? '<div class="s-steuer"><button type="button" id="nochmal">↻ Nochmal</button><button type="button" id="zurueck">Zurück zur Einrichtung</button></div>' :
        '<div class="s-steuer">' + (S.dran >= 0 && !S.test ? '<button type="button" class="ok" id="ok">✔ Richtig<kbd>Enter</kbd></button><button type="button" class="nein" id="falsch">✘ Falsch<kbd>⌫</kbd></button>' : "") +
        (f && !S.loesung ? '<button type="button" id="loes">Antwort zeigen<kbd>↓</kbd></button>' : "") + '<button type="button" id="weiter">' + (S.test ? "Test fertig" : "Nächste Frage") + "<kbd>→</kbd></button></div>") +
      '<div class="s-punkte">' + B.teams.map(function (t, i) { return '<div style="--t:' + esc(t.farbe) + '" class="' + (S.raus.indexOf(i) >= 0 ? "raus" : "") + '">' + esc(t.name) + "<b>" + S.punkte[i] + "</b><small>Taste " + esc(t.taste.toUpperCase()) + "</small></div>"; }).join("") + "</div>" +
      (B.touch && !S.ende ? '<div class="s-pads" style="grid-template-columns:repeat(' + Math.min(4, B.teams.length) + ',1fr)">' + B.teams.map(function (t, i) { return '<button type="button" data-pad="' + i + '" style="--t:' + esc(t.farbe) + '"' + (!S.offen || S.raus.indexOf(i) >= 0 ? " disabled" : "") + ">" + esc(t.name) + "</button>"; }).join("") + "</div>" : "") + "</div>";
    var bind = function (id, fn) { var el = document.getElementById(id); if (el) el.onclick = fn; };
    bind("ok", richtig); bind("falsch", falsch); bind("weiter", weiter); bind("loes", function () { S.loesung = true; zeichne(); });
    bind("stop", function () { if (confirm("Quiz beenden?")) beenden(); }); bind("zurueck", beenden); bind("nochmal", function () { starten(false); });
    bind("ton", function () { B.ton = !B.ton; sichern(); zeichne(); });
    app.querySelectorAll("[data-pad]").forEach(function (b) { b.addEventListener("pointerdown", function (e) { e.preventDefault(); buzz(+b.dataset.pad); }); });
  }
  function buzz(i) {
    if (!S || S.ende || !S.offen || S.raus.indexOf(i) >= 0 || !B.teams[i]) return;
    S.offen = false; S.dran = i; TON.buzz();
    if (S.test) { S.raus.push(i); setTimeout(function () { S.dran = -1; S.offen = S.raus.length < B.teams.length; zeichne(); }, 900); zeichne(); return; }
    S.rest = B.sekunden; zeichne();
    clearInterval(uhrT);
    if (B.sekunden) uhrT = setInterval(function () { S.rest--; var u = $("#uhr"); if (u) { u.textContent = S.rest; u.classList.toggle("knapp", S.rest <= 5); } if (S.rest <= 5 && S.rest > 0) TON.tick(); if (S.rest <= 0) { clearInterval(uhrT); falsch(); } }, 1000);
  }
  function richtig() { if (S.dran < 0) return; clearInterval(uhrT); var f = frageAkt(); S.punkte[S.dran] += f ? f.punkte : 1; TON.ok(); S.loesung = true; S.dran = -1; zeichne(); }
  function falsch() {
    if (S.dran < 0) return; clearInterval(uhrT); TON.nein();
    if (B.minus) S.punkte[S.dran] -= 1;
    S.raus.push(S.dran); S.dran = -1;
    S.offen = S.raus.length < B.teams.length; if (!S.offen) S.loesung = true;
    zeichne();
  }
  function weiter() {
    clearInterval(uhrT);
    if (S.test) { beenden(); return; }
    if (S.fragen.length && S.nr >= S.fragen.length - 1) { S.ende = true; TON.ok(); zeichne(); return; }
    S.nr++; S.dran = -1; S.raus = []; S.loesung = false; S.offen = true; zeichne();
  }
  function beenden() { clearInterval(uhrT); S = null; if (document.fullscreenElement) document.exitFullscreen().catch(function () {}); einrichten(); }

  document.addEventListener("keydown", function (e) {
    if (!S || e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === "Enter") { e.preventDefault(); richtig(); return; }
    if (e.key === "Backspace") { e.preventDefault(); falsch(); return; }
    if (e.key === "ArrowRight") { e.preventDefault(); if (!S.ende) weiter(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); if (frageAkt()) { S.loesung = true; zeichne(); } return; }
    if (e.repeat) return;
    var k = e.key.toLowerCase();
    B.teams.forEach(function (t, i) { if (t.taste && t.taste === k) buzz(i); });
  });

  einrichten();
  KW.footer("buzzer", function () { return B; }, function (d) { B = Object.assign(B, d); sichern(); einrichten(); });
})();
