// FIDELIA Notizen · Weitere Reiter der Werkzeug-Leiste: Formelsammlung, Periodensystem, Einheiten, Lern-Timer

import * as N from "./nachschlagen.js";
import * as Schule from "./schule.js";

const KW = window.KW, esc = KW.esc;

/* ---------- Formelsammlung ---------- */
export function formelnAufbauen(box, { einfuegen }) {
  let q = "";
  box.innerHTML = '<div class="fs"><input class="inp" type="search" id="fsQ" placeholder="Suchen, z. B. Kreis, Dichte" aria-label="Formel suchen"><div id="fsListe" class="fs-liste"></div></div>';
  const liste = box.querySelector("#fsListe");
  function zeichnen() {
    const t = q.toLowerCase(), gruppen = {};
    N.FORMELN.filter(f => !t || (f[0] + " " + f[1] + " " + f[3] + " " + N.texZuText(f[2])).toLowerCase().includes(t)).forEach((f, i) => (gruppen[f[0]] = gruppen[f[0]] || []).push(f));
    liste.innerHTML = Object.keys(gruppen).length ? Object.entries(gruppen).map(([g, fs]) => '<h4>' + esc(g) + '</h4>' + fs.map(f => {
      const i = N.FORMELN.indexOf(f);
      let bild = esc(N.texZuText(f[2]));
      if (window.katex) try { bild = window.katex.renderToString(f[2], { throwOnError: false, output: "html" }); } catch (e) {}
      return '<button type="button" class="fs-z" data-i="' + i + '" title="Ins Heft einfügen"><b>' + esc(f[1]) + '</b><span class="fs-f">' + bild + '</span>' + (f[3] ? '<small>' + esc(f[3]) + '</small>' : "") + '</button>';
    }).join("")).join("") : '<p class="muted">Nichts gefunden.</p>';
    liste.querySelectorAll("[data-i]").forEach(b => b.onclick = () => { const f = N.FORMELN[b.dataset.i]; einfuegen(N.texZuText(f[2]), { tex: f[2] }); });
  }
  box.querySelector("#fsQ").oninput = (e) => { q = e.target.value; zeichnen(); };
  zeichnen();
  import("./editor.js").then(E => E.katex()).then(() => zeichnen()).catch(() => {});
  return { fokus: () => box.querySelector("#fsQ").focus() };
}

/* ---------- Periodensystem ---------- */
export function pseAufbauen(box, { einfuegen }) {
  let wahl = N.ELEMENTE[0];
  const zelle = (e) => '<button type="button" class="pse-e art-' + e.art.replace("?", "x2") + '" style="grid-row:' + e.zeile + ';grid-column:' + e.spalte + '" data-z="' + e.z + '" title="' + esc(e.name) + '" aria-label="' + esc(e.name + " " + e.sym + ", Ordnungszahl " + e.z) + '"><small>' + e.z + '</small>' + e.sym + '</button>';
  box.innerHTML = '<div class="pse">' +
    '<div class="row pse-kopf"><input class="inp" type="search" id="pseQ" placeholder="Element oder Nummer" aria-label="Element suchen"><button type="button" class="btn small" id="pseGross" title="Größer anzeigen" aria-label="Größer anzeigen">⤢</button></div>' +
    '<div class="pse-gitter" id="pseGitter">' + N.ELEMENTE.map(zelle).join("") +
    '<span class="pse-platz art-l" style="grid-row:6;grid-column:3" aria-hidden="true">57–71</span><span class="pse-platz art-ac" style="grid-row:7;grid-column:3" aria-hidden="true">89–103</span></div>' +
    '<div class="pse-info card" id="pseInfo" aria-live="polite"></div>' +
    '<div class="pse-mol"><label class="field"><span>⚗️ Molare Masse berechnen</span><input class="inp" id="pseMol" placeholder="z. B. H2O, Ca(OH)2" spellcheck="false"></label><div id="pseMolErg" aria-live="polite"></div></div>' +
    '<div class="pse-legende">' + ["a", "ea", "u", "m", "h", "n", "x", "e", "l", "ac"].map(k => '<span><i class="art-' + k + '"></i>' + N.ART[k] + '</span>').join("") + '</div></div>';
  const info = box.querySelector("#pseInfo");
  function zeigen(e) {
    wahl = e;
    box.querySelectorAll(".pse-e").forEach(b => b.classList.toggle("an", Number(b.dataset.z) === e.z));
    info.innerHTML = '<div class="pse-gross art-' + e.art.replace("?", "x2") + '"><small>' + e.z + '</small><b>' + e.sym + '</b><span>' + e.masse + '</span></div><div><h3>' + esc(e.name) + '</h3>' +
      '<p>' + esc(e.artName) + '<br>Ordnungszahl ' + e.z + ' · Atommasse ' + e.masse + ' u<br>' + e.periode + '. Periode' + (e.art === "l" || e.art === "ac" ? "" : ' · ' + e.gruppe + '. Gruppe') + (e.aussen ? '<br>Außenelektronen: ' + e.aussen : "") + '<br>Protonen: ' + e.z + ' · Elektronen: ' + e.z + '</p>' +
      '<button type="button" class="btn small" id="pseRein">→ „' + esc(e.sym) + '“ einfügen</button></div>';
    info.querySelector("#pseRein").onclick = () => einfuegen(e.sym);
  }
  box.querySelectorAll(".pse-e").forEach(b => b.onclick = () => zeigen(N.ELEMENTE[b.dataset.z - 1]));
  box.querySelector("#pseQ").oninput = (ev) => { const r = N.elementSuchen(ev.target.value); if (r[0]) zeigen(r[0]); };
  box.querySelector("#pseGross").onclick = () => { const l = box.closest(".wz-leiste"); l.classList.toggle("breit"); document.body.classList.toggle("wz-breit", l.classList.contains("breit")); };
  const mol = box.querySelector("#pseMol"), molErg = box.querySelector("#pseMolErg");
  mol.oninput = () => {
    const r = N.molmasse(mol.value);
    if (!mol.value.trim()) { molErg.innerHTML = ""; return; }
    if (!r) { molErg.innerHTML = '<p class="muted klein">Schreib die Formel mit großen Anfangsbuchstaben, z. B. NaCl, H2SO4.</p>'; return; }
    const m = N.zahlDe(r.masse);
    molErg.innerHTML = '<p><b>M = ' + m + ' g/mol</b><br><small class="muted">' + Object.entries(r.teile).map(([k, v]) => v + " × " + k).join(" + ") + '</small></p><button type="button" class="btn small" id="molRein">→ einfügen</button>';
    molErg.querySelector("#molRein").onclick = () => einfuegen("M(" + mol.value.trim() + ") = " + m + " g/mol");
  };
  zeigen(wahl);
  return { fokus: () => box.querySelector("#pseQ").focus() };
}

/* ---------- Einheiten ---------- */
export function einheitenAufbauen(box, { einfuegen }) {
  const S = KW.load("kw-einheiten", { art: "Länge", von: "km", nach: "m", wert: "1" });
  function zeichnen() {
    const t = N.EINHEITEN[S.art], namen = Object.keys(t);
    if (!(S.von in t)) S.von = namen[0]; if (!(S.nach in t)) S.nach = namen[1] || namen[0];
    box.innerHTML = '<div class="eh"><div class="eh-arten" role="tablist" aria-label="Größe">' + Object.keys(N.EINHEITEN).map(a => '<button type="button" role="tab" data-art="' + a + '" aria-selected="' + (a === S.art) + '">' + a + '</button>').join("") + '</div>' +
      '<div class="eh-reihe"><input class="inp" id="ehWert" inputmode="decimal" value="' + esc(S.wert) + '" aria-label="Wert"><select class="inp" id="ehVon" aria-label="von">' + namen.map(n => '<option' + (n === S.von ? " selected" : "") + '>' + esc(n) + '</option>').join("") + '</select></div>' +
      '<button type="button" class="btn small eh-tausch" id="ehTausch" aria-label="Einheiten tauschen">⇅</button>' +
      '<div class="eh-reihe"><output class="inp eh-erg" id="ehErg"></output><select class="inp" id="ehNach" aria-label="nach">' + namen.map(n => '<option' + (n === S.nach ? " selected" : "") + '>' + esc(n) + '</option>').join("") + '</select></div>' +
      '<p class="muted klein" id="ehFaktor"></p><button type="button" class="btn small" id="ehRein">→ einfügen</button>' +
      '<div class="eh-alle" id="ehAlle"></div></div>';
    const q = (s) => box.querySelector(s);
    const rechnen = () => {
      S.wert = q("#ehWert").value; S.von = q("#ehVon").value; S.nach = q("#ehNach").value; KW.save("kw-einheiten", S);
      const w = Number(String(S.wert).replace(/\./g, "").replace(",", ".")), r = N.umrechnen(w, S.von, S.nach, S.art);
      q("#ehErg").textContent = r == null ? "–" : N.zahlDe(r);
      const eins = N.umrechnen(1, S.von, S.nach, S.art);
      q("#ehFaktor").textContent = S.art === "Temperatur" ? (S.von === "°C" && S.nach === "K" ? "K = °C + 273,15" : S.von === "°C" && S.nach === "°F" ? "°F = °C · 1,8 + 32" : "") : "1 " + S.von + " = " + N.zahlDe(eins) + " " + S.nach;
      q("#ehAlle").innerHTML = isFinite(w) ? '<table class="tab"><tbody>' + Object.keys(N.EINHEITEN[S.art]).filter(n => n !== S.von).map(n => '<tr><td>' + N.zahlDe(N.umrechnen(w, S.von, n, S.art)) + '</td><td>' + esc(n) + '</td></tr>').join("") + '</tbody></table>' : "";
    };
    q("#ehWert").oninput = rechnen; q("#ehVon").onchange = rechnen; q("#ehNach").onchange = rechnen;
    q("#ehTausch").onclick = () => { [S.von, S.nach] = [S.nach, S.von]; zeichnen(); };
    q("#ehRein").onclick = () => einfuegen(S.wert + " " + S.von + " = " + q("#ehErg").textContent + " " + S.nach);
    box.querySelectorAll("[data-art]").forEach(b => b.onclick = () => { S.art = b.dataset.art; S.von = ""; S.nach = ""; zeichnen(); });
    rechnen();
  }
  zeichnen();
  return { fokus: () => { const w = box.querySelector("#ehWert"); w.focus(); w.select(); } };
}

/* ---------- Lern-Timer (Pomodoro) ---------- */
// Zustand in kw-timer: { art: "lernen"|"pause", ende (ms), laenge (min), fach, pausiert (Rest-ms) }
export const timerZustand = () => KW.load("kw-timer", null);
export function timerAufbauen(box, A, { knopf }) {
  const E = KW.load("kw-timer-einst", { lernen: 25, pause: 5, fach: "" });
  let tick = null;
  function piep() {
    try { const ac = new (window.AudioContext || window.webkitAudioContext)(); [0, 0.25, 0.5].forEach(t => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(0.2, ac.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.2); o.connect(g); g.connect(ac.destination); o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.22); }); } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
  }
  function melden(text) {
    KW.toast(text); piep();
    try { if (document.hidden && "Notification" in window && Notification.permission === "granted") new Notification("FIDELIA Lern-Timer", { body: text }); } catch (e) {}
  }
  function fertig(Z) {
    if (Z.art === "lernen") { Schule.lernzeitPlus(Z.fach, Z.laenge); melden("🎉 " + Z.laenge + " Minuten geschafft! Jetzt " + E.pause + " Minuten Pause."); KW.save("kw-timer", { art: "pause", ende: Date.now() + E.pause * 60000, laenge: E.pause, fach: Z.fach }); }
    else { melden("⏰ Pause vorbei – weiter geht's!"); KW.save("kw-timer", null); }
  }
  function rest(Z) { return Z ? (Z.pausiert != null ? Z.pausiert : Z.ende - Date.now()) : E.lernen * 60000; }
  const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
  function zeichnen() {
    const Z = timerZustand(), r = rest(Z), gesamt = (Z ? Z.laenge : E.lernen) * 60000, anteil = Math.min(1, Math.max(0, 1 - r / gesamt));
    box.innerHTML = '<div class="tm">' +
      '<div class="tm-ring ' + (Z ? Z.art : "") + '" style="--p:' + (anteil * 360) + 'deg"><div><span class="tm-zeit" id="tmZeit" role="timer" aria-live="off">' + mmss(r) + '</span><small>' + (!Z ? "bereit" : Z.art === "pause" ? "☕ Pause" : "📚 " + esc(Z.fach || "Lernen")) + (Z && Z.pausiert != null ? " · angehalten" : "") + '</small></div></div>' +
      '<div class="row tm-knoepfe">' + (!Z ? '<button type="button" class="btn primary" id="tmStart">▶ Start</button>' :
        (Z.pausiert != null ? '<button type="button" class="btn primary" id="tmWeiter">▶ Weiter</button>' : '<button type="button" class="btn" id="tmHalt">⏸ Anhalten</button>') + '<button type="button" class="btn" id="tmStop">⏹ Stopp</button>' + (Z.art === "pause" ? '<button type="button" class="btn" id="tmSkip">⏭ Pause überspringen</button>' : "")) + '</div>' +
      (!Z ? '<label class="field"><span>Fach</span><select class="inp" id="tmFach"><option value="">Kein Fach</option>' + A.einst.faecher.map(f => '<option' + (f.name === E.fach ? " selected" : "") + '>' + esc(f.name) + '</option>').join("") + '</select></label>' +
        '<div class="tm-laengen" role="radiogroup" aria-label="Lernzeit">' + [15, 25, 45].map(m => '<button type="button" role="radio" aria-checked="' + (E.lernen === m) + '" data-m="' + m + '">' + m + ' min</button>').join("") + '</div>' +
        '<label class="field"><span>Pause danach</span><select class="inp" id="tmPause">' + [3, 5, 10, 15].map(m => '<option value="' + m + '"' + (E.pause === m ? " selected" : "") + '>' + m + ' Minuten</option>').join("") + '</select></label>' : "") +
      '<p class="muted klein">Handy weg, ein Fach, volle Konzentration. Die Minuten zählen in deine Lernwoche 🔥.</p></div>';
    const q = (s) => box.querySelector(s);
    if (q("#tmStart")) q("#tmStart").onclick = () => {
      E.fach = q("#tmFach").value; E.pause = Number(q("#tmPause").value); KW.save("kw-timer-einst", E);
      KW.save("kw-timer", { art: "lernen", ende: Date.now() + E.lernen * 60000, laenge: E.lernen, fach: E.fach });
      try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch (e) {}
      zeichnen();
    };
    box.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { E.lernen = Number(b.dataset.m); KW.save("kw-timer-einst", E); zeichnen(); });
    if (q("#tmHalt")) q("#tmHalt").onclick = () => { const Z2 = timerZustand(); Z2.pausiert = Z2.ende - Date.now(); KW.save("kw-timer", Z2); zeichnen(); };
    if (q("#tmWeiter")) q("#tmWeiter").onclick = () => { const Z2 = timerZustand(); Z2.ende = Date.now() + Z2.pausiert; delete Z2.pausiert; KW.save("kw-timer", Z2); zeichnen(); };
    if (q("#tmStop")) q("#tmStop").onclick = () => {
      const Z2 = timerZustand();
      if (Z2 && Z2.art === "lernen") { const min = Math.floor((Z2.laenge * 60000 - rest(Z2)) / 60000); if (min >= 1) Schule.lernzeitPlus(Z2.fach, min); }
      KW.save("kw-timer", null); zeichnen();
    };
    if (q("#tmSkip")) q("#tmSkip").onclick = () => { KW.save("kw-timer", null); zeichnen(); };
  }
  // läuft im Hintergrund weiter, auch wenn die Leiste zu ist
  clearInterval(tick);
  tick = setInterval(() => {
    const Z = timerZustand();
    if (Z && Z.pausiert == null && Z.ende <= Date.now()) { fertig(Z); if (!box.closest("[hidden]")) zeichnen(); }
    const Z2 = timerZustand();
    if (knopf) { if (Z2) { knopf.dataset.timer = Z2.pausiert != null ? "⏸" : Math.ceil(rest(Z2) / 60000) + "'"; knopf.classList.toggle("pause", Z2.art === "pause"); } else delete knopf.dataset.timer; }
    const z = box.querySelector("#tmZeit");
    if (z && Z2) { z.textContent = mmss(rest(Z2)); const ring = box.querySelector(".tm-ring"); if (ring) ring.style.setProperty("--p", (Math.min(1, Math.max(0, 1 - rest(Z2) / (Z2.laenge * 60000))) * 360) + "deg"); }
  }, 1000);
  zeichnen();
  return { fokus: () => { const b = box.querySelector("#tmStart, #tmHalt, #tmWeiter"); b && b.focus(); } };
}
