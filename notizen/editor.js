// FIDELIA Notizen · Text wie in Word
// Formatierung (Schrift, Größe, Fett …), Listen, Tabellen, Bilder, Formeln (KaTeX), Inhaltsverzeichnis,
// Vorlagen, Wörter zählen, Diktieren (Whisper auf dem Gerät) und Vorlesen (Stimmen auf dem Gerät).

import * as Sprache from "./sprache.js";
import * as Plus from "./heft-plus.js";

const KW = window.KW, esc = KW.esc;
const KATEX = "../shared/vendor/katex-0.16.47/";

export const SCHRIFTEN = [
  ["", "Standard"], ["Arial, Helvetica, sans-serif", "Arial"], ["Georgia, 'Times New Roman', serif", "Times"],
  ["'Comic Sans MS', 'Comic Neue', cursive", "Comic"], ["'Courier New', monospace", "Courier"], ["Verdana, sans-serif", "Verdana"]
];
export const GROESSEN = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];
const MARKER = [["", "Kein"], ["#fff176", "Gelb"], ["#a5f3a1", "Grün"], ["#ffb3dc", "Pink"], ["#9ee3ff", "Blau"], ["#ffcc80", "Orange"]];

/* ---------- Hilfen ---------- */

export function textZuHtml(text) {
  return String(text || "").split("\n").map(z => "<p>" + (esc(z) || "<br>") + "</p>").join("");
}
export function htmlZuText(html) {
  const d = document.createElement("div");
  d.innerHTML = html || "";
  d.querySelectorAll(".formel").forEach(f => f.replaceWith(" " + (f.dataset.tex || "") + " "));
  d.querySelectorAll("p,div,h1,h2,h3,li,tr,br,blockquote").forEach(e => e.insertAdjacentText("afterend", "\n"));
  d.querySelectorAll("td,th").forEach(e => e.insertAdjacentText("afterend", "\t"));
  return d.textContent.replace(/\u200b/g, "").replace(/\n{3,}/g, "\n\n").trim();
}
export function woerter(text) { const w = String(text || "").trim().match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu); return w ? w.length : 0; }

/* ---------- Formeln (KaTeX) ---------- */

let katexLaden = null;
export function katex() {
  if (window.katex) return Promise.resolve(window.katex);
  if (!katexLaden) katexLaden = new Promise((ok, nein) => {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = KATEX + "katex.min.css"; document.head.appendChild(l);
    const s = document.createElement("script"); s.src = KATEX + "katex.min.js"; s.onload = () => ok(window.katex); s.onerror = () => { katexLaden = null; nein(new Error("katex")); };
    document.head.appendChild(s);
  });
  return katexLaden;
}
// Seiten mit Formeln brauchen das KaTeX-Aussehen
export function formelnVorbereiten(el) { if (el.querySelector(".formel")) katex().catch(() => {}); }

export function formelHtml(tex) {
  const k = window.katex;
  let innen = "";
  try { innen = k.renderToString(tex, { throwOnError: false, displayMode: false, output: "html" }); } catch (e) { innen = esc(tex); }
  return '<span class="formel" contenteditable="false" data-tex="' + esc(tex) + '">' + innen + '</span>';
}

const FORMEL_KNOEPFE = [
  ["Bruch", "\\frac{a}{b}"], ["Wurzel", "\\sqrt{x}"], ["n-te Wurzel", "\\sqrt[n]{x}"], ["Hoch", "x^{2}"], ["Tief", "x_{1}"],
  ["·", "\\cdot "], ["÷", "\\div "], ["±", "\\pm "], ["≤", "\\le "], ["≥", "\\ge "], ["≠", "\\ne "], ["≈", "\\approx "],
  ["π", "\\pi "], ["∞", "\\infty "], ["α", "\\alpha "], ["β", "\\beta "], ["γ", "\\gamma "], ["Δ", "\\Delta "], ["°", "^{\\circ}"],
  ["→", "\\rightarrow "], ["⇌", "\\rightleftharpoons "], ["Summe", "\\sum_{i=1}^{n} "], ["Vektor", "\\vec{v}"], ["Winkel", "\\angle "],
  ["H₂O", "\\mathrm{H_2O}"], ["CO₂", "\\mathrm{CO_2}"], ["Klammer", "\\left( x \\right)"], ["Matrix", "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}"]
];

export async function formelDialog(alt) {
  try { await katex(); } catch (e) { KW.toast("Der Formel-Editor braucht beim ersten Mal Internet."); return null; }
  return new Promise(fertig => {
    const d = document.createElement("dialog");
    d.className = "sheet breit";
    d.innerHTML = '<form class="sheet-in" method="dialog"><h2>∑ Formel</h2>' +
      '<div class="formel-knoepfe">' + FORMEL_KNOEPFE.map((k, i) => '<button type="button" class="btn small" data-i="' + i + '">' + esc(k[0]) + '</button>').join("") + '</div>' +
      '<label class="field"><span>Formel (Schreibweise wie LaTeX, z. B. <code>\\frac{1}{2}</code> für ½)</span><textarea class="inp" id="fTex" rows="2" spellcheck="false">' + esc(alt || "") + '</textarea></label>' +
      '<div class="formel-vorschau card" id="fVor" aria-live="polite"></div>' +
      '<div class="sheet-foot"><button type="button" class="btn" id="fAb">Abbrechen</button><span class="sp"></span><button class="btn primary" value="ok">Einfügen</button></div></form>';
    document.body.appendChild(d);
    const ta = d.querySelector("#fTex"), vor = d.querySelector("#fVor");
    const zeig = () => { try { vor.innerHTML = window.katex.renderToString(ta.value || "\\text{Vorschau}", { throwOnError: false, displayMode: true }); } catch (e) { vor.textContent = "…"; } };
    d.querySelectorAll("[data-i]").forEach(b => b.onclick = () => {
      const t = FORMEL_KNOEPFE[b.dataset.i][1], a = ta.selectionStart, e = ta.selectionEnd;
      ta.value = ta.value.slice(0, a) + t + ta.value.slice(e); ta.focus(); ta.selectionStart = ta.selectionEnd = a + t.length; zeig();
    });
    ta.oninput = zeig; zeig();
    let ergebnis = null;
    d.querySelector("#fAb").onclick = () => d.close();
    d.querySelector("form").onsubmit = () => { ergebnis = ta.value.trim() || null; };
    d.addEventListener("close", () => { d.remove(); fertig(ergebnis); });
    d.showModal(); ta.focus();
  });
}

/* ---------- Vorlagen ---------- */

const h = (t) => "<h2>" + t + "</h2>";
const p = (t) => "<p>" + (t || "<br>") + "</p>";
export const VORLAGEN = [
  { id: "referat", icon: "🎤", name: "Referat", raster: "leer", html: "<h1>Thema des Referats</h1>" + p("<i>Name · Klasse · Datum</i>") + h("1. Einleitung") + p("Worum geht es? Warum ist das Thema spannend?") + h("2. Hauptteil") + "<h3>2.1 …</h3>" + p() + "<h3>2.2 …</h3>" + p() + h("3. Schluss") + p("Zusammenfassung und eigene Meinung") + h("Quellen") + "<ul><li><br></li></ul>" },
  { id: "protokoll", icon: "🧪", name: "Versuchsprotokoll", raster: "karo5-r", html: "<h1>Versuchsprotokoll</h1>" + p("<b>Name:</b> &nbsp; <b>Datum:</b> &nbsp; <b>Fach:</b>") + h("Fragestellung") + p() + h("Vermutung") + p() + h("Material") + "<ul><li><br></li></ul>" + h("Durchführung") + "<ol><li><br></li></ol>" + h("Beobachtung") + p() + h("Auswertung / Ergebnis") + p() },
  { id: "steckbrief", icon: "🪪", name: "Steckbrief", raster: "leer", html: "<h1>Steckbrief: …</h1><table class=\"tab\"><tbody>" + ["Name", "Aussehen", "Lebensraum", "Nahrung", "Besonderheiten", "Feinde"].map(z => "<tr><td><b>" + z + "</b></td><td><br></td></tr>").join("") + "</tbody></table>" + p("<i>Bild hier einfügen</i>") },
  { id: "bild", icon: "🖼️", name: "Bildbeschreibung", raster: "lin8-r", html: "<h1>Bildbeschreibung</h1>" + h("Einleitung") + p("Titel, Künstler, Jahr, Technik") + h("Beschreibung") + p("Was sieht man im Vordergrund, in der Mitte, im Hintergrund?") + h("Deutung") + p("Welche Wirkung hat das Bild? Was will es sagen?") },
  { id: "eroerterung", icon: "⚖️", name: "Erörterung", raster: "lin8-r", html: "<h1>Erörterung: …?</h1>" + h("Einleitung") + p() + h("Pro-Argumente") + "<ol><li><br></li></ol>" + h("Contra-Argumente") + "<ol><li><br></li></ol>" + h("Schluss und eigene Meinung") + p() },
  { id: "inhalt", icon: "📖", name: "Inhaltsangabe", raster: "lin8-r", html: "<h1>Inhaltsangabe</h1>" + p("<b>Einleitung:</b> Titel, Autor, Textsorte, Erscheinungsjahr, Thema") + p("<b>Hauptteil:</b> (im Präsens, ohne wörtliche Rede)") + p("<b>Schluss:</b>") },
  { id: "brief", icon: "✉️", name: "Brief", raster: "leer", html: '<p style="text-align:right">Ort, Datum</p>' + p() + p("Liebe/r …,") + p() + p() + p("Viele Grüße") + p() },
  { id: "lesetagebuch", icon: "📚", name: "Lesetagebuch", raster: "lin8-r", html: "<h1>Lesetagebuch</h1>" + p("<b>Buch:</b> &nbsp; <b>Kapitel/Seiten:</b>") + h("Was passiert?") + p() + h("Wichtige Figuren") + "<ul><li><br></li></ul>" + h("Meine Meinung") + p() },
  { id: "lernzettel", icon: "🧠", name: "Lernzettel", raster: "karo5-r", html: "<h1>Lernzettel: …</h1>" + p("<b>Fach:</b> &nbsp; <b>Arbeit am:</b>") + h("Das Wichtigste in 3 Sätzen") + p() + h("Begriffe") + '<table class="tab"><tbody><tr><th>Begriff</th><th>Bedeutung</th></tr><tr><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td></tr></tbody></table>' + h("Formeln / Regeln") + p() + h("Das kann ich noch nicht") + "<ul><li><br></li></ul>" },
  { id: "buch", icon: "📕", name: "Buchvorstellung", raster: "leer", html: "<h1>Buchvorstellung</h1>" + p("<b>Titel:</b> &nbsp; <b>Autor/in:</b> &nbsp; <b>Erschienen:</b>") + h("Worum geht es?") + p() + h("Die Hauptfiguren") + "<ul><li><br></li></ul>" + h("Meine Lieblingsstelle") + p() + h("Meine Meinung") + p() + p("<b>Empfehlung:</b> ★★★★☆") },
  { id: "wochenplan", icon: "🗓️", name: "Wochenplan", raster: "leer", html: "<h1>Wochenplan</h1>" + '<table class="tab"><tbody><tr><th>Tag</th><th>Schule / Hausaufgaben</th><th>Lernen</th><th>Freizeit</th></tr>' + ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Wochenende"].map(t => "<tr><td><b>" + t + "</b></td><td><br></td><td><br></td><td><br></td></tr>").join("") + "</tbody></table>" + h("Ziele diese Woche") + "<ul><li><br></li></ul>" },
  { id: "nwtprojekt", icon: "🔧", name: "NWT-Projekt", raster: "karo5-r", html: "<h1>Projekt: …</h1>" + p("<b>Gruppe:</b> &nbsp; <b>Abgabe:</b>") + h("Aufgabe und Ziel") + p() + h("Teile und Material") + '<table class="tab"><tbody><tr><th>Teil</th><th>Anzahl</th><th>Wofür?</th></tr><tr><td><br></td><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td><td><br></td></tr></tbody></table>' + h("Ablauf (Tagebuch)") + p("<b>Datum – was haben wir gemacht? Welche Version?</b>") + h("Probleme und Lösungen") + p() + h("Testergebnisse") + p() + h("Fazit") + p() },
  { id: "mathe", icon: "📐", name: "Mathe-Aufgabe", raster: "karo5-r", html: "<h2>Aufgabe …</h2>" + p("<b>Gegeben:</b>") + p("<b>Gesucht:</b>") + p("<b>Lösung:</b>") + p() + p("<b>Antwort:</b>") }
];

/* ---------- Inhaltsverzeichnis ---------- */

export function inhaltsverzeichnis(rich) {
  const ueber = Array.from(rich.querySelectorAll("h1,h2,h3")).filter(x => !x.closest(".toc") && x.textContent.trim());
  if (!ueber.length) { KW.toast("Erst Überschriften machen (Format: Überschrift 1–3)."); return; }
  let html = '<div class="toc" contenteditable="false"><b>Inhaltsverzeichnis</b><ol>';
  ueber.forEach((u, i) => { u.id = u.id || "ue-" + i + "-" + KW.id(); html += '<li class="toc-' + u.tagName.toLowerCase() + '"><a href="#' + u.id + '" data-ziel="' + u.id + '">' + esc(u.textContent.trim()) + '</a></li>'; });
  html += "</ol></div>";
  const alt = rich.querySelector(".toc");
  if (alt) alt.outerHTML = html;
  else { const t = document.createElement("div"); t.innerHTML = html; const erst = rich.querySelector("h1"); erst ? erst.after(t.firstChild) : rich.prepend(t.firstChild); }
  KW.toast(alt ? "Inhaltsverzeichnis aktualisiert." : "Inhaltsverzeichnis eingefügt.");
}

/* ---------- Bilder ---------- */

export function bildWaehlen() {
  return new Promise(ok => {
    const i = document.createElement("input"); i.type = "file"; i.accept = "image/*";
    i.onchange = async () => {
      const f = i.files && i.files[0]; if (!f) return ok(null);
      try {
        const bmp = await createImageBitmap(f), m = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
        const c = document.createElement("canvas"); c.width = Math.round(bmp.width * m); c.height = Math.round(bmp.height * m);
        c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
        ok(c.toDataURL(f.type === "image/png" ? "image/png" : "image/jpeg", 0.85));
      } catch (e) { KW.toast("Das Bild konnte ich nicht öffnen."); ok(null); }
    };
    i.click();
  });
}

/* ---------- Vorlesen (nur Stimmen auf dem Gerät) ---------- */

// Vorlesen mit kleinem Player: Pause, Stopp, Tempo (0,75× bis 2×). Nur Stimmen auf dem Gerät.
export function vorlesen(text, knopf) {
  const sy = window.speechSynthesis;
  if (!sy) { KW.toast("Dein Browser kann nicht vorlesen."); return; }
  const alt = document.querySelector(".vl-player");
  if (alt) { alt._stopp(); return; }
  const stimmen = sy.getVoices().filter(v => /^de/i.test(v.lang));
  const stimme = stimmen.find(v => v.localService) || null; // nur lokale Stimmen: nichts geht ins Internet
  if (!stimme) { KW.toast(stimmen.length ? "Auf diesem Gerät gibt es nur Online-Stimmen – die nutze ich nicht." : "Auf diesem Gerät ist keine deutsche Stimme installiert."); return; }
  const ganz = String(text).slice(0, 30000).trim();
  if (!ganz) { KW.toast("Hier steht noch nichts zum Vorlesen."); return; }
  let tempo = KW.load("kw-vorlesen-tempo", 1), pos = 0, basis = 0, pausiert = false;
  const p = document.createElement("div");
  p.className = "vl-player"; p.setAttribute("role", "region"); p.setAttribute("aria-label", "Vorlesen");
  p.innerHTML = '<button type="button" class="btn small" data-v="pause" aria-label="Pause">⏸</button><div class="vl-mitte"><div class="vl-balken"><i></i></div><div class="vl-tempo" role="radiogroup" aria-label="Tempo">' +
    [0.75, 1, 1.25, 1.5, 2].map(t => '<button type="button" role="radio" data-t="' + t + '" aria-checked="' + (t === tempo) + '">' + String(t).replace(".", ",") + '×</button>').join("") + '</div></div><button type="button" class="btn small" data-v="stopp" aria-label="Vorlesen beenden">✕</button>';
  document.body.appendChild(p);
  const balken = p.querySelector(".vl-balken i");
  function sprechen(ab) {
    sy.cancel(); basis = ab;
    const u = new SpeechSynthesisUtterance(ganz.slice(ab));
    u.voice = stimme; u.lang = stimme.lang; u.rate = 0.95 * tempo;
    u.onboundary = (e) => { pos = basis + e.charIndex; balken.style.width = Math.round(pos / ganz.length * 100) + "%"; };
    u.onend = () => { if (!pausiert && sy.speaking === false && u._aktiv) stopp(); };
    u._aktiv = true; p._u && (p._u._aktiv = false); p._u = u;
    sy.speak(u);
  }
  function stopp() { if (p._u) p._u._aktiv = false; sy.cancel(); p.remove(); if (knopf) knopf.classList.remove("an"); }
  p._stopp = stopp;
  p.querySelector('[data-v="stopp"]').onclick = stopp;
  const pk = p.querySelector('[data-v="pause"]');
  pk.onclick = () => {
    if (!pausiert) { pausiert = true; if (p._u) p._u._aktiv = false; sy.cancel(); pk.textContent = "▶"; pk.setAttribute("aria-label", "Weiter"); }
    else { pausiert = false; pk.textContent = "⏸"; pk.setAttribute("aria-label", "Pause"); sprechen(satzAnfang(pos)); }
  };
  // beim Weitermachen am Satzanfang einsetzen, damit nichts abgehackt klingt
  const satzAnfang = (i) => { const vor = ganz.slice(0, i), m = Math.max(vor.lastIndexOf(". "), vor.lastIndexOf("\n"), vor.lastIndexOf("! "), vor.lastIndexOf("? ")); return m > 0 ? m + 1 : 0; };
  p.querySelectorAll("[data-t]").forEach(b => b.onclick = () => {
    tempo = Number(b.dataset.t); KW.save("kw-vorlesen-tempo", tempo);
    p.querySelectorAll("[data-t]").forEach(x => x.setAttribute("aria-checked", x === b));
    if (!pausiert) sprechen(satzAnfang(pos));
  });
  if (knopf) knopf.classList.add("an");
  window.addEventListener("hashchange", stopp, { once: true });
  sprechen(0);
}

/* ---------- Diktieren (Whisper auf dem Gerät) ---------- */

export async function diktieren(knopf, modellWahl, fertig) {
  if (knopf._rec) { knopf._rec.stop(); return; }
  let strom;
  try { strom = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch (e) { KW.toast("Das Mikrofon ist nicht erlaubt."); return; }
  const stuecke = [], rec = new MediaRecorder(strom);
  knopf._rec = rec; knopf.classList.add("an", "aufnahme"); knopf.title = "Tippen zum Beenden";
  KW.toast("🎤 Sprich jetzt – nochmal tippen zum Beenden.");
  rec.ondataavailable = (e) => e.data.size && stuecke.push(e.data);
  rec.onstop = async () => {
    strom.getTracks().forEach(t => t.stop());
    knopf._rec = null; knopf.classList.remove("aufnahme"); knopf.textContent = "⏳";
    try {
      const ton = await Sprache.zu16k(new Blob(stuecke, { type: rec.mimeType }));
      const w = await Sprache.laden(modellWahl, (p, t) => { knopf.title = t; });
      const r = await w(ton, { language: "german", task: "transcribe", chunk_length_s: 30, stride_length_s: 5 });
      const text = String((r && r.text) || "").trim();
      if (text) fertig(text); else KW.toast("Ich habe nichts verstanden.");
    } catch (e) { KW.toast("Die Spracherkennung konnte nicht starten."); }
    knopf.textContent = "🎤"; knopf.classList.remove("an");
  };
  rec.start();
}

/* ---------- Die Word-Leiste ---------- */

// Menüband wie in Word: Start · Einfügen · Werkzeuge (spart Platz, vor allem auf dem Handy)
const BAENDER = [["start", "Start"], ["einfuegen", "Einfügen"], ["werkzeuge", "Werkzeuge"]];
const g = (band, html) => '<span class="gruppe" data-gruppe="' + band + '">' + html + '</span>';

export function leisteHtml(extras = {}) {
  return '<div class="band-reiter" role="tablist" aria-label="Menüband">' + BAENDER.map(b => '<button type="button" role="tab" data-band="' + b[0] + '">' + b[1] + '</button>').join("") + '</div>' +
  '<div class="wort-leiste" role="toolbar" aria-label="Text formatieren" data-band="start">' +
    g("start",
      '<select data-w="block" aria-label="Formatvorlage" title="Formatvorlage"><option value="p">Normal</option><option value="h1">Überschrift 1</option><option value="h2">Überschrift 2</option><option value="h3">Überschrift 3</option><option value="blockquote">Zitat</option></select>' +
      '<select data-w="schrift" aria-label="Schriftart" title="Schriftart">' + SCHRIFTEN.map(s => '<option value="' + esc(s[0]) + '">' + s[1] + '</option>').join("") + '</select>' +
      '<select data-w="groesse" aria-label="Schriftgröße" title="Schriftgröße">' + GROESSEN.map(x => '<option>' + x + '</option>').join("") + '</select>' +
      '<span class="trenn"></span>' +
      '<button type="button" data-c="bold" title="Fett (Strg+B)" aria-label="Fett"><b>F</b></button>' +
      '<button type="button" data-c="italic" title="Kursiv (Strg+I)" aria-label="Kursiv"><i>K</i></button>' +
      '<button type="button" data-c="underline" title="Unterstrichen (Strg+U)" aria-label="Unterstrichen"><u>U</u></button>' +
      '<button type="button" data-c="strikeThrough" title="Durchgestrichen" aria-label="Durchgestrichen"><s>S</s></button>' +
      '<button type="button" data-c="superscript" title="Hochgestellt" aria-label="Hochgestellt">x²</button>' +
      '<button type="button" data-c="subscript" title="Tiefgestellt" aria-label="Tiefgestellt">x₂</button>' +
      '<label class="farb-knopf" title="Schriftfarbe"><span aria-hidden="true">A</span><input type="color" data-w="farbe" value="#101826" aria-label="Schriftfarbe"></label>' +
      '<select data-w="marker" aria-label="Textmarker" title="Textmarker">' + MARKER.map(m => '<option value="' + m[0] + '">🖍 ' + m[1] + '</option>').join("") + '</select>' +
      '<button type="button" data-x="pinsel" title="Format übertragen: erst Text mit dem Format antippen, dann Knopf, dann neuen Text markieren (Doppelklick = mehrmals)" aria-label="Format übertragen" aria-pressed="false">🖌️</button>' +
      '<button type="button" data-c="removeFormat" title="Formatierung löschen" aria-label="Formatierung löschen">⌫A</button>' +
      '<span class="trenn"></span>' +
      '<button type="button" data-c="justifyLeft" title="Links" aria-label="Linksbündig">⯇</button>' +
      '<button type="button" data-c="justifyCenter" title="Mitte" aria-label="Zentriert">≡</button>' +
      '<button type="button" data-c="justifyRight" title="Rechts" aria-label="Rechtsbündig">⯈</button>' +
      '<button type="button" data-c="justifyFull" title="Blocksatz" aria-label="Blocksatz">☰</button>' +
      '<button type="button" data-c="insertUnorderedList" title="Aufzählung" aria-label="Aufzählung">•≡</button>' +
      '<button type="button" data-c="insertOrderedList" title="Nummerierung" aria-label="Nummerierung">1.</button>' +
      '<button type="button" data-c="outdent" title="Einzug kleiner (Umschalt+Tab)" aria-label="Einzug verkleinern">⇤</button>' +
      '<button type="button" data-c="indent" title="Einzug größer (Tab)" aria-label="Einzug vergrößern">⇥</button>' + Plus.startHtml()) +
    g("einfuegen",
      '<button type="button" data-x="tabelle" title="Tabelle einfügen" aria-label="Tabelle einfügen">⊞ Tabelle</button>' +
      '<button type="button" data-x="bild" title="Bild einfügen" aria-label="Bild einfügen">🖼️ Bild</button>' +
      '<button type="button" data-x="formel" title="Formel einfügen" aria-label="Formel einfügen">∑ Formel</button>' +
      '<button type="button" data-x="toc" title="Inhaltsverzeichnis" aria-label="Inhaltsverzeichnis">📑 Inhalt</button>' +
      '<button type="button" data-x="linie" title="Trennlinie" aria-label="Trennlinie einfügen">― Linie</button>' +
      '<button type="button" data-x="zeichen" title="Sonderzeichen" aria-label="Sonderzeichen">Ω Zeichen</button>' +
      '<span class="trenn"></span><button type="button" data-x="plot" title="Funktionsgraph zeichnen" aria-label="Funktion zeichnen">📈 Funktion</button>' +
      '<button type="button" data-x="mindmap" title="Mindmap" aria-label="Mindmap einfügen">🧠 Mindmap</button>' +
      (extras.sprachnotiz ? '<button type="button" data-x="sprachnotiz" title="Sprachnotiz an dieser Stelle aufnehmen" aria-label="Sprachnotiz aufnehmen">🎙️ Sprachnotiz</button>' : "") +
      '<span class="trenn"></span><button type="button" data-x="fussnote" title="Fußnote an dieser Stelle" aria-label="Fußnote einfügen">¹ Fußnote</button>' +
      '<button type="button" data-x="quelle" title="Quelle angeben (kommt automatisch ins Quellenverzeichnis)" aria-label="Quelle angeben">📚 Quelle</button>' + Plus.einfuegenHtml()) +
    g("werkzeuge",
      '<button type="button" data-x="diktat" title="Diktieren" aria-label="Diktieren">🎤 Diktieren</button>' +
      '<button type="button" data-x="vorlesen" title="Vorlesen" aria-label="Vorlesen">🔊 Vorlesen</button>' +
      '<button type="button" data-x="auto" title="Autokorrektur an/aus" aria-label="Autokorrektur" aria-pressed="true">✨ Autokorrektur</button>' + Plus.werkzeugeHtml()) +
  '</div>' +
  '<div class="zeichen-leiste" hidden>' + "→ ← ⇒ ⇔ ≈ ≠ ≤ ≥ ± · × ÷ ° ² ³ ½ ¼ √ ∞ π α β γ Δ Ω µ € § © ✓ ✗ • …".split(" ").map(z => '<button type="button" data-z="' + z + '">' + z + '</button>').join("") + '</div>' +
  '<div class="tabellen-leiste" hidden><span class="muted klein">Tabelle:</span><button type="button" data-t="zeile+">+ Zeile</button><button type="button" data-t="spalte+">+ Spalte</button><button type="button" data-t="zeile-">− Zeile</button><button type="button" data-t="spalte-">− Spalte</button><button type="button" data-t="kopf">Kopfzeile</button><button type="button" data-t="weg">Tabelle löschen</button></div>';
}

// Farbe aus "rgb(…)" in "#rrggbb"
const hex = (c) => { const m = String(c).match(/\d+(\.\d+)?/g); return m && m.length >= 3 ? "#" + m.slice(0, 3).map(v => Math.round(+v).toString(16).padStart(2, "0")).join("") : "#101826"; };

/* Rückgängig/Wiederholen für den Text: eigene Schnappschüsse (klappt auch nach Tabelle, Bild, Formel …) */
function textPos(rich) {
  const s = getSelection(); if (!s.rangeCount || !rich.contains(s.anchorNode)) return null;
  const r = s.getRangeAt(0), a = document.createRange(); a.selectNodeContents(rich);
  try { a.setEnd(r.startContainer, r.startOffset); const start = a.toString().length; a.setEnd(r.endContainer, r.endOffset); return [start, a.toString().length]; } catch (e) { return null; }
}
function posSetzen(rich, pos) {
  if (!pos) return;
  const w = document.createTreeWalker(rich, NodeFilter.SHOW_TEXT); let n, z = 0; const r = document.createRange(); let start = false;
  while ((n = w.nextNode())) {
    const l = n.textContent.length;
    if (!start && z + l >= pos[0]) { r.setStart(n, pos[0] - z); start = true; }
    if (start && z + l >= pos[1]) { r.setEnd(n, pos[1] - z); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return; }
    z += l;
  }
  r.selectNodeContents(rich); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}

// Autokorrektur: was direkt vor dem Cursor steht, ggf. ersetzen
const ERSETZEN = [[/->$/, "→"], [/<-$/, "←"], [/=>$/, "⇒"], [/\.\.\.$/, "…"], [/ - $/, " – "], [/\(c\)$/i, "©"], [/\+-$/, "±"], [/!=$/, "≠"], [/<=$/, "≤"], [/>=$/, "≥"]];

export function leisteBinden(wurzel, rich, geaendert, extras = {}) {
  const leiste = wurzel.querySelector(".wort-leiste"), tabLeiste = wurzel.querySelector(".tabellen-leiste"), zeichenLeiste = wurzel.querySelector(".zeichen-leiste");
  // Enter macht einen richtigen Absatz (wie Word), nicht ein <div>
  try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (e) {}
  // Leeres Blatt: gleich mit einem Absatz anfangen (sonst landet der erste Text lose im Feld)
  rich.addEventListener("focus", () => {
    if (rich.isContentEditable && !rich.firstChild) { rich.innerHTML = "<p><br></p>"; const r = document.createRange(); r.setStart(rich.firstChild, 0); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  });

  /* Menüband */
  const bandSetzen = (b) => {
    leiste.dataset.band = b; KW.save("kw-notizen-band", b);
    wurzel.querySelectorAll("[data-band]").forEach(x => { if (x.tagName === "BUTTON") { x.classList.toggle("an", x.dataset.band === b); x.setAttribute("aria-selected", x.dataset.band === b); } });
    if (b !== "einfuegen") zeichenLeiste.hidden = true;
  };
  wurzel.querySelectorAll(".band-reiter [data-band]").forEach(b => { b.addEventListener("mousedown", e => e.preventDefault()); b.onclick = () => bandSetzen(b.dataset.band); });
  bandSetzen(KW.load("kw-notizen-band", "start") || "start");

  /* Verlauf */
  let verlauf = [], wieder = [], letzteZeit = 0, letzteArt = "";
  const stand = () => ({ html: rich.innerHTML, pos: textPos(rich) });
  const schnappschuss = (zwingen) => {
    const jetzt = Date.now(), h = rich.innerHTML;
    if (verlauf.length && verlauf[verlauf.length - 1].html === h) return;
    if (!zwingen && jetzt - letzteZeit < 900 && verlauf.length) { letzteZeit = jetzt; return; }
    verlauf.push(stand()); if (verlauf.length > 100) verlauf.shift(); wieder = []; letzteZeit = jetzt;
  };
  const herstellen = (z) => { rich.innerHTML = z.html; rich.focus({ preventScroll: true }); posSetzen(rich, z.pos); formelnVorbereiten(rich); geaendert(); zustandZeigen(); };
  const rueckgaengig = () => { if (!verlauf.length) return false; const jetzt = stand(); let z = verlauf.pop(); if (z.html === jetzt.html && verlauf.length) z = verlauf.pop(); else if (z.html === jetzt.html) return false; wieder.push(jetzt); letzteZeit = 0; herstellen(z); return true; };
  const wiederholen = () => { if (!wieder.length) return false; verlauf.push(stand()); herstellen(wieder.pop()); letzteZeit = 0; return true; };
  rich.addEventListener("beforeinput", (e) => {
    if (e.inputType === "historyUndo") { e.preventDefault(); rueckgaengig(); return; }
    if (e.inputType === "historyRedo") { e.preventDefault(); wiederholen(); return; }
    // neues Wort / neuer Absatz / Löschen beginnt einen neuen Schritt
    const neueArt = e.inputType.startsWith("delete") ? "weg" : e.inputType === "insertParagraph" ? "abs" : "tipp";
    schnappschuss(neueArt !== letzteArt || e.data === " " || neueArt === "abs"); letzteArt = neueArt;
  });

  let bereich = null;
  const merken = () => { const s = getSelection(); if (s.rangeCount && rich.contains(s.anchorNode)) bereich = s.getRangeAt(0).cloneRange(); };
  // Auswahl nur zurückholen, wenn sie gerade nicht mehr im Text ist (z. B. nach Klick in eine Auswahlliste)
  const zurueck = () => {
    const s = getSelection();
    const drin = s.rangeCount && rich.contains(s.anchorNode);
    rich.focus({ preventScroll: true });
    if (!drin && bereich) { s.removeAllRanges(); s.addRange(bereich); }
  };
  document.addEventListener("selectionchange", function aufpassen() {
    if (!document.body.contains(rich)) { document.removeEventListener("selectionchange", aufpassen); return; }
    merken(); zustandZeigen();
  });
  const cmd = (c, w) => { zurueck(); schnappschuss(true); document.execCommand("styleWithCSS", false, true); document.execCommand(c, false, w); merken(); geaendert(); zustandZeigen(); };
  // Schriftgröße in pt setzen (relativ zur Grundschrift = 11 pt, damit es mit dem Papier mitwächst)
  const groesseSetzen = (pt) => {
    zurueck(); schnappschuss(true);
    document.execCommand("styleWithCSS", false, false); document.execCommand("fontSize", false, "7");
    rich.querySelectorAll('font[size="7"]').forEach(f => { const s = document.createElement("span"); s.style.fontSize = (pt / 11).toFixed(3) + "em"; s.innerHTML = f.innerHTML; f.replaceWith(s); });
    merken(); geaendert(); zustandZeigen();
  };

  leiste.querySelectorAll("button").forEach(b => b.addEventListener("mousedown", e => e.preventDefault()));
  leiste.querySelectorAll("[data-c]").forEach(b => b.onclick = () => cmd(b.dataset.c));
  leiste.querySelector('[data-w="block"]').onchange = (e) => cmd("formatBlock", e.target.value);
  leiste.querySelector('[data-w="schrift"]').onchange = (e) => { cmd("fontName", e.target.value || "Space Grotesk"); };
  leiste.querySelector('[data-w="farbe"]').oninput = (e) => cmd("foreColor", e.target.value);
  leiste.querySelector('[data-w="marker"]').onchange = (e) => { cmd("hiliteColor", e.target.value || "transparent"); e.target.value = ""; };
  leiste.querySelector('[data-w="groesse"]').onchange = (e) => { const pt = Number(e.target.value); if (pt) groesseSetzen(pt); };

  /* Format übertragen (Pinsel) */
  const pinselBtn = leiste.querySelector('[data-x="pinsel"]');
  let pinsel = null;
  const formatVon = (n) => {
    const cs = getComputedStyle(n), basis = parseFloat(getComputedStyle(rich).fontSize) || 16;
    const an = (c) => { try { return document.queryCommandState(c); } catch (e) { return false; } };
    let hl = "", m = n; while (m && m !== rich) { const b = getComputedStyle(m).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) { hl = hex(b); break; } m = m.parentElement; }
    return { fett: an("bold"), kursiv: an("italic"), unter: an("underline"), durch: an("strikeThrough"), farbe: hex(cs.color), schrift: cs.fontFamily, pt: Math.round(parseFloat(cs.fontSize) / basis * 22) / 2, hl };
  };
  const pinselAus = () => { pinsel = null; pinselBtn.classList.remove("an"); pinselBtn.setAttribute("aria-pressed", "false"); rich.classList.remove("pinsel"); };
  const pinselAnwenden = () => {
    const f = pinsel; if (!f) return;
    const an = (c) => { try { return document.queryCommandState(c); } catch (e) { return false; } };
    schnappschuss(true);
    document.execCommand("styleWithCSS", false, true);
    [["bold", f.fett], ["italic", f.kursiv], ["underline", f.unter], ["strikeThrough", f.durch]].forEach(([c, soll]) => { if (an(c) !== soll) document.execCommand(c); });
    document.execCommand("foreColor", false, f.farbe);
    document.execCommand("fontName", false, f.schrift);
    document.execCommand("hiliteColor", false, f.hl || "transparent");
    document.execCommand("styleWithCSS", false, false); document.execCommand("fontSize", false, "7");
    rich.querySelectorAll('font[size="7"]').forEach(x => { const s = document.createElement("span"); s.style.fontSize = (f.pt / 11).toFixed(3) + "em"; s.innerHTML = x.innerHTML; x.replaceWith(s); });
    geaendert(); zustandZeigen();
    if (!f.mehrmals) pinselAus();
  };
  const pinselStart = (mehrmals) => {
    if (pinsel) { pinselAus(); return; }
    const s = getSelection(), n = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
    if (!n || !rich.contains(n)) { KW.toast("Erst in den Text tippen, dessen Format du übertragen willst."); return; }
    pinsel = Object.assign(formatVon(n), { mehrmals });
    pinselBtn.classList.add("an"); pinselBtn.setAttribute("aria-pressed", "true"); rich.classList.add("pinsel");
    KW.toast(mehrmals ? "🖌️ Format übertragen – mehrmals. Nochmal tippen zum Beenden." : "🖌️ Jetzt den Text markieren, der so aussehen soll.");
  };
  let pinselKlick = 0;
  pinselBtn.onclick = () => { const jetzt = Date.now(); if (jetzt - pinselKlick < 350) { pinselAus(); pinselStart(true); } else pinselStart(false); pinselKlick = jetzt; };
  rich.addEventListener("pointerup", () => setTimeout(() => { if (!pinsel) return; const s = getSelection(); if (s.rangeCount && !s.isCollapsed && rich.contains(s.anchorNode)) pinselAnwenden(); }, 0));

  const x = (n) => leiste.querySelector('[data-x="' + n + '"]');
  x("tabelle").onclick = () => {
    const z = Math.max(1, Math.min(30, parseInt(prompt("Wie viele Zeilen?", "3"), 10) || 0)), sp = Math.max(1, Math.min(10, parseInt(prompt("Wie viele Spalten?", "3"), 10) || 0));
    if (!z || !sp) return;
    // Tabelle hinter den aktuellen Absatz setzen (nicht mitten hinein) und in die erste Zelle springen
    zurueck(); schnappschuss(true);
    const tab = document.createElement("table"); tab.className = "tab";
    tab.innerHTML = "<tbody>" + ("<tr>" + "<td><br></td>".repeat(sp) + "</tr>").repeat(z) + "</tbody>";
    const s = getSelection(), n = s.rangeCount && rich.contains(s.anchorNode) ? (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement) : null;
    let blk = n && n !== rich ? n : null;
    while (blk && blk.parentElement !== rich) blk = blk.parentElement;
    const danach = document.createElement("p"); danach.innerHTML = "<br>";
    if (blk) { blk.after(tab); tab.after(danach); } else { rich.appendChild(tab); rich.appendChild(danach); }
    const r = document.createRange(); r.setStart(tab.rows[0].cells[0], 0); r.collapse(true); s.removeAllRanges(); s.addRange(r);
    merken(); geaendert(); zustandZeigen();
  };
  // Nach einem Dialog genau dort einfügen, wo der Cursor vorher war
  // (direkt mit Range, weil der Browser Formeln sonst aus dem Absatz herausschiebt)
  const einfuegenBei = (r, html) => {
    rich.focus({ preventScroll: true });
    schnappschuss(true);
    const s = getSelection();
    if (!r || !rich.contains(r.startContainer)) { r = document.createRange(); r.selectNodeContents(rich.lastElementChild || rich); r.collapse(false); }
    r.deleteContents();
    const vorlage = document.createElement("template"); vorlage.innerHTML = html;
    const letztes = vorlage.content.lastChild;
    r.insertNode(vorlage.content);
    const neu = document.createRange(); neu.setStartAfter(letztes); neu.collapse(true);
    s.removeAllRanges(); s.addRange(neu);
    merken(); geaendert();
  };
  x("bild").onclick = async () => { merken(); const r = bereich && bereich.cloneRange(); const url = await (extras.bild || bildWaehlen)(); if (url) einfuegenBei(r, '<img class="bild" src="' + url + '" alt="">'); };
  x("formel").onclick = async () => { merken(); const r = bereich && bereich.cloneRange(); const tex = await formelDialog(""); if (tex) einfuegenBei(r, formelHtml(tex) + "&nbsp;"); };
  x("toc").onclick = () => { schnappschuss(true); inhaltsverzeichnis(rich); geaendert(); };
  x("linie").onclick = () => cmd("insertHorizontalRule");
  x("zeichen").onclick = () => { zeichenLeiste.hidden = !zeichenLeiste.hidden; x("zeichen").classList.toggle("an", !zeichenLeiste.hidden); };
  zeichenLeiste.querySelectorAll("[data-z]").forEach(b => { b.addEventListener("mousedown", e => e.preventDefault()); b.onclick = () => cmd("insertText", b.dataset.z); });
  /* Funktion und Mindmap: als Bild, das sich wieder bearbeiten lässt */
  const graphEinfuegen = async (modul, alt, img) => {
    merken(); const r = bereich && bereich.cloneRange();
    const M = await import(modul === "plot" ? "./plotter.js" : "./mindmap.js");
    const e = await M.dialog(alt);
    if (!e) return;
    const attr = modul === "plot" ? "data-plot" : "data-mindmap";
    if (img) { schnappschuss(true); img.src = e.png; img.setAttribute(attr, JSON.stringify(e.daten)); geaendert(); return; }
    einfuegenBei(r, '<img class="bild" src="' + e.png + '" ' + attr + '="' + esc(JSON.stringify(e.daten)) + '" alt="' + (modul === "plot" ? "Funktionsgraph" : "Mindmap") + '" style="width:' + (modul === "plot" ? 75 : Math.max(40, Math.min(100, Math.round(e.w / 9)))) + '%;display:block;margin-left:auto;margin-right:auto">');
  };
  x("plot").onclick = () => graphEinfuegen("plot");
  x("mindmap").onclick = () => graphEinfuegen("mindmap");
  if (extras.sprachnotiz) x("sprachnotiz").onclick = async () => {
    merken(); const r = bereich && bereich.cloneRange();
    const SN = await import("./sprachnotiz.js"), e = await SN.aufnehmen();
    if (!e) return;
    const id = await extras.sprachnotiz.speichern(e.blob);
    einfuegenBei(r, SN.notizHtml(id, e.sekunden) + "&nbsp;");
    KW.toast("🎙️ Sprachnotiz eingefügt – antippen zum Abspielen.");
  };

  /* Fußnoten und Quellen: Nummern und Listen am Ende pflegen sich selbst */
  const fnStempel = () => rich.querySelectorAll("sup.fn").length + "|" + rich.querySelectorAll("span.zitat").length;
  let fnStand = fnStempel();
  function verzeichnisse() {
    const fns = Array.from(rich.querySelectorAll("sup.fn")), quellen = Array.from(rich.querySelectorAll("span.zitat"));
    fns.forEach((f, i) => { f.textContent = String(i + 1); f.contentEditable = "false"; });
    let fd = rich.querySelector(".fussnoten"), qd = rich.querySelector(".quellen");
    if (!fns.length) { if (fd) fd.remove(); fd = null; }
    else {
      if (!fd) { fd = document.createElement("div"); fd.className = "fussnoten"; fd.contentEditable = "false"; }
      fd.innerHTML = "<hr><ol>" + fns.map(f => "<li>" + esc(f.dataset.fn || "") + "</li>").join("") + "</ol>";
    }
    const liste = []; const gesehen = new Set();
    quellen.forEach(q => { let d = {}; try { d = JSON.parse(q.dataset.q || "{}"); } catch (e) {} const k = JSON.stringify(d); if (!gesehen.has(k)) { gesehen.add(k); liste.push(d); } q.contentEditable = "false"; });
    if (!liste.length) { if (qd) qd.remove(); }
    else {
      if (!qd) { qd = document.createElement("div"); qd.className = "quellen"; qd.contentEditable = "false"; }
      liste.sort((a, b) => String(a.autor || a.titel).localeCompare(String(b.autor || b.titel), "de"));
      qd.innerHTML = "<h3>Quellen</h3><ul>" + liste.map(q => "<li>" + esc(quelleText(q)) + "</li>").join("") + "</ul>";
      rich.appendChild(qd);
    }
    if (fd) rich.appendChild(fd);
    // nach dem Verzeichnis noch ein Absatz zum Weiterschreiben
    fnStand = fnStempel();
  }
  const quelleText = (q) => [q.autor ? q.autor + (q.jahr ? " (" + q.jahr + ")" : "") + ":" : q.jahr ? "(" + q.jahr + ")" : "", q.titel ? q.titel + "." : "", q.verlag ? q.verlag + "." : "", q.link ? q.link + (q.abgerufen ? " (abgerufen am " + q.abgerufen + ")" : "") : ""].filter(Boolean).join(" ");
  rich.addEventListener("input", () => { if (fnStempel() !== fnStand) { verzeichnisse(); geaendert(); } });
  x("fussnote").onclick = () => {
    merken(); const r = bereich && bereich.cloneRange();
    const text = prompt("Text der Fußnote:", ""); if (!text || !text.trim()) return;
    einfuegenBei(r, '<sup class="fn" contenteditable="false" data-fn="' + esc(text.trim()) + '">0</sup>');
    verzeichnisse(); geaendert();
  };
  function quelleDialog(alt) {
    return new Promise(fertig => {
      const d = document.createElement("dialog"); d.className = "sheet";
      const f = (id, lab, ph, typ = "text") => '<label class="feld"><span>' + lab + '</span><input class="inp" id="q_' + id + '" type="' + typ + '" value="' + esc((alt || {})[id] || "") + '" placeholder="' + ph + '"></label>';
      d.innerHTML = '<form class="sheet-in" method="dialog"><h2>📚 Quelle angeben</h2>' + f("autor", "Wer hat es geschrieben?", "z. B. Müller, Anna – oder Wikipedia") + f("titel", "Titel", "Titel des Buchs / der Seite") + f("jahr", "Jahr", "z. B. 2024") + f("verlag", "Verlag / Website", "z. B. Klett oder planet-schule.de") + f("link", "Link (falls Internet)", "https://…") +
        '<p class="muted klein">Im Text erscheint „(Autor Jahr)“, unten entsteht automatisch das Quellenverzeichnis.</p><div class="sheet-foot"><button type="button" class="btn" id="qAb">Abbrechen</button>' + (alt ? '<button type="button" class="btn danger" id="qWeg">Entfernen</button>' : "") + '<button class="btn primary" id="qOk">Fertig</button></div></form>';
      document.body.appendChild(d);
      let ergebnis = null;
      d.querySelector("#qAb").onclick = () => d.close();
      if (alt) d.querySelector("#qWeg").onclick = () => { ergebnis = "weg"; d.close(); };
      d.querySelector("#qOk").onclick = (e) => { e.preventDefault(); const q = {}; ["autor", "titel", "jahr", "verlag", "link"].forEach(k => { const v = d.querySelector("#q_" + k).value.trim(); if (v) q[k] = v; }); if (q.link && !alt) q.abgerufen = new Date().toLocaleDateString("de-DE"); else if (alt && alt.abgerufen) q.abgerufen = alt.abgerufen; if (!q.autor && !q.titel && !q.link) return; ergebnis = q; d.close(); };
      d.addEventListener("close", () => { d.remove(); fertig(ergebnis); });
      d.showModal();
    });
  }
  const zitatText = (q) => "(" + [(q.autor || q.titel || q.verlag || "Quelle").split(",")[0].trim(), q.jahr].filter(Boolean).join(" ") + ")";
  x("quelle").onclick = async () => {
    merken(); const r = bereich && bereich.cloneRange();
    const q = await quelleDialog(null); if (!q || q === "weg") return;
    einfuegenBei(r, '&nbsp;<span class="zitat" contenteditable="false" data-q="' + esc(JSON.stringify(q)) + '">' + esc(zitatText(q)) + "</span>&nbsp;");
    verzeichnisse(); geaendert();
  };
  rich.addEventListener("click", async (e) => {
    const fn = e.target.closest("sup.fn");
    if (fn && rich.contains(fn)) { const t = prompt("Fußnote ändern (leer = löschen):", fn.dataset.fn || ""); if (t === null) return; schnappschuss(true); if (!t.trim()) fn.remove(); else fn.dataset.fn = t.trim(); verzeichnisse(); geaendert(); return; }
    const z = e.target.closest("span.zitat");
    if (z && rich.contains(z)) { let alt = {}; try { alt = JSON.parse(z.dataset.q); } catch (x2) {} const q = await quelleDialog(alt); if (!q) return; schnappschuss(true); if (q === "weg") z.remove(); else { z.dataset.q = JSON.stringify(q); z.textContent = zitatText(q); } verzeichnisse(); geaendert(); }
  });

  x("diktat").onclick = () => { merken(); diktieren(x("diktat"), extras.sprachModell, (text) => cmd("insertText", (bereich && !bereich.collapsed ? "" : " ") + text)); };
  x("vorlesen").onclick = () => { const s = getSelection(); vorlesen(s.toString() && rich.contains(s.anchorNode) ? s.toString() : htmlZuText(rich.innerHTML), x("vorlesen")); };
  const autoAn = () => extras.autokorrektur ? extras.autokorrektur() : KW.load("kw-notizen-auto", true) !== false;
  const autoZeigen = () => { const a = autoAn(); x("auto").classList.toggle("an", a); x("auto").setAttribute("aria-pressed", a); };
  x("auto").onclick = () => { if (extras.autokorrekturSetzen) extras.autokorrekturSetzen(!autoAn()); else KW.save("kw-notizen-auto", !autoAn()); autoZeigen(); KW.toast("Autokorrektur " + (autoAn() ? "an" : "aus")); };
  autoZeigen();

  // Formel antippen → bearbeiten
  rich.addEventListener("click", async (e) => {
    const f = e.target.closest(".formel");
    if (f && rich.contains(f)) { const tex = await formelDialog(f.dataset.tex); if (tex) { schnappschuss(true); const t = document.createElement("span"); t.innerHTML = formelHtml(tex); f.replaceWith(t.firstChild); geaendert(); } return; }
    const a = e.target.closest(".toc a");
    if (a) { e.preventDefault(); const z = rich.querySelector("#" + CSS.escape(a.dataset.ziel)); if (z) z.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const img = e.target.closest("img.bild");
    rich.querySelectorAll("img.bild.gewaehlt").forEach(i => i !== img && i.classList.remove("gewaehlt"));
    if (img) bildMenue(img);
  });
  function bildMenue(img) {
    img.classList.add("gewaehlt");
    const alt = document.querySelector(".bild-menue"); if (alt) alt.remove();
    const m = document.createElement("div"); m.className = "bild-menue card";
    m.innerHTML = (img.dataset.plot ? '<button data-a="graph">✎ Graph ändern</button>' : img.dataset.mindmap ? '<button data-a="mm">✎ Mindmap ändern</button>' : "") + '<button data-b="25">Klein</button><button data-b="50">Mittel</button><button data-b="100">Groß</button><button data-a="left">⯇</button><button data-a="center">≡</button><button data-a="right">⯈</button>' + (img.dataset.plot || img.dataset.mindmap ? "" : '<button data-d="-90" title="Nach links drehen">⟲</button><button data-d="90" title="Nach rechts drehen">⟳</button><button data-a="zuschnitt" title="Zuschneiden">✂</button>') + '<button data-a="weg">🗑</button>';
    const r = img.getBoundingClientRect();
    m.style.left = Math.max(8, r.left) + "px"; m.style.top = Math.max(70, r.top - 46) + "px";
    document.body.appendChild(m);
    m.onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.a === "graph" || b.dataset.a === "mm") { m.remove(); let d = null; try { d = JSON.parse(b.dataset.a === "graph" ? img.dataset.plot : img.dataset.mindmap); } catch (x2) {} graphEinfuegen(b.dataset.a === "graph" ? "plot" : "mindmap", d, img); return; }
      if (b.dataset.d) { schnappschuss(true); m.remove(); Plus.bildDrehen(img, Number(b.dataset.d)).then(() => geaendert()); return; }
      if (b.dataset.a === "zuschnitt") { schnappschuss(true); m.remove(); Plus.bildZuschneiden(img).then(ok => { if (ok) geaendert(); }); return; }
      schnappschuss(true);
      if (b.dataset.b) img.style.width = b.dataset.b + "%";
      if (b.dataset.a === "weg") img.remove();
      else if (b.dataset.a) { img.style.display = "block"; img.style.marginLeft = b.dataset.a === "left" ? "0" : "auto"; img.style.marginRight = b.dataset.a === "right" ? "0" : "auto"; }
      m.remove(); geaendert();
    };
    setTimeout(() => document.addEventListener("pointerdown", function zu(ev) { if (!m.contains(ev.target)) { m.remove(); img.classList.remove("gewaehlt"); document.removeEventListener("pointerdown", zu); } }), 0);
  }

  // Tabelle bearbeiten
  function zelle() { const s = getSelection(); const n = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement); return n && rich.contains(n) ? n.closest("td,th") : null; }
  tabLeiste.querySelectorAll("button").forEach(b => { b.addEventListener("mousedown", e => e.preventDefault()); b.onclick = () => {
    const z = zelle(); if (!z) return;
    schnappschuss(true);
    const tr = z.parentElement, tab = z.closest("table"), i = Array.from(tr.children).indexOf(z);
    const a = b.dataset.t;
    if (a === "zeile+") { const n = tr.cloneNode(true); n.querySelectorAll("td,th").forEach(c => c.innerHTML = "<br>"); tr.after(n); }
    if (a === "zeile-" && tab.rows.length > 1) tr.remove();
    if (a === "spalte+") Array.from(tab.rows).forEach(r => { const c = document.createElement(r.cells[i] ? r.cells[i].tagName : "td"); c.innerHTML = "<br>"; (r.cells[i] || r.lastElementChild).after(c); });
    if (a === "spalte-" && tr.cells.length > 1) Array.from(tab.rows).forEach(r => r.cells[i] && r.cells[i].remove());
    if (a === "kopf") tab.classList.toggle("mit-kopf");
    if (a === "weg") tab.remove();
    geaendert(); zustandZeigen();
  }; });

  // Leiste zeigt, was gerade am Cursor gilt (Schrift, Größe, Farbe, Fett …) – wie in Word
  const sel = (w) => leiste.querySelector('[data-w="' + w + '"]');
  function zustandZeigen() {
    if (!document.body.contains(leiste)) return;
    const an = (c) => { try { return document.queryCommandState(c); } catch (e) { return false; } };
    leiste.querySelectorAll("[data-c]").forEach(b => b.classList.toggle("an", ["bold", "italic", "underline", "strikeThrough", "superscript", "subscript", "insertUnorderedList", "insertOrderedList"].includes(b.dataset.c) && an(b.dataset.c)));
    const s = getSelection(), n = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
    if (n && rich.contains(n)) {
      const blk = n.closest("h1,h2,h3,blockquote,p,li,div");
      const t = blk ? blk.tagName.toLowerCase() : "p";
      sel("block").value = ["h1", "h2", "h3", "blockquote"].includes(t) ? t : "p";
      const cs = getComputedStyle(n), basis = parseFloat(getComputedStyle(rich).fontSize) || 16;
      // Schrift
      const fam = cs.fontFamily.split(",")[0].replace(/["']/g, "").trim().toLowerCase();
      const opt = Array.from(sel("schrift").options).find(o => o.value && o.value.split(",")[0].replace(/["']/g, "").trim().toLowerCase() === fam);
      sel("schrift").value = opt ? opt.value : "";
      // Größe in pt (Grundschrift = 11 pt)
      const pt = Math.round(parseFloat(cs.fontSize) / basis * 22) / 2;
      const gs = sel("groesse");
      let o = Array.from(gs.options).find(q => Number(q.value) === pt);
      if (!o) { gs.querySelectorAll("option.extra").forEach(q => q.remove()); o = document.createElement("option"); o.className = "extra"; o.textContent = String(pt); o.value = String(pt); gs.appendChild(o); }
      gs.value = o.value;
      // Farbe
      if (document.activeElement !== sel("farbe")) sel("farbe").value = hex(cs.color);
    }
    tabLeiste.hidden = !zelle();
  }

  /* Tasten wie in Word */
  rich.addEventListener("keydown", (e) => {
    // Tab: in Tabellen zur nächsten Zelle, in Listen einrücken, sonst Tabulator
    if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const z = zelle(), s = getSelection(), n = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
      e.preventDefault();
      if (z) {
        const alle = Array.from(z.closest("table").querySelectorAll("td,th")), i = alle.indexOf(z);
        let ziel = alle[i + (e.shiftKey ? -1 : 1)];
        if (!ziel && !e.shiftKey) { schnappschuss(true); const tr = z.parentElement.cloneNode(true); tr.querySelectorAll("td,th").forEach(c => c.innerHTML = "<br>"); z.closest("tr").parentElement.appendChild(tr); ziel = tr.cells[0]; geaendert(); }
        if (ziel) { const r = document.createRange(); r.selectNodeContents(ziel); s.removeAllRanges(); s.addRange(r); }
        return;
      }
      if (n && n.closest("li")) { cmd(e.shiftKey ? "outdent" : "indent"); return; }
      if (!e.shiftKey) cmd("insertHTML", '<span class="tabz">\t</span>\u200b');
      return;
    }
    if (e.key === "Escape" && pinsel) { pinselAus(); return; }
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) { e.preventDefault(); rueckgaengig(); }
    else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); wiederholen(); }
    else if (k === "b") { e.preventDefault(); cmd("bold"); } else if (k === "i") { e.preventDefault(); cmd("italic"); } else if (k === "u") { e.preventDefault(); cmd("underline"); }
    else if (k === "e") { e.preventDefault(); cmd("justifyCenter"); } else if (k === "l") { e.preventDefault(); cmd("justifyLeft"); } else if (k === "r") { e.preventDefault(); cmd("justifyRight"); } else if (k === "j") { e.preventDefault(); cmd("justifyFull"); }
    else if (e.altKey && ["1", "2", "3"].includes(k)) { e.preventDefault(); cmd("formatBlock", "h" + k); }
    else if (e.altKey && k === "0") { e.preventDefault(); cmd("formatBlock", "p"); }
    else if (e.shiftKey && (k === ">" || k === "<")) { e.preventDefault(); const pt = Number(sel("groesse").value) || 11, i = GROESSEN.findIndex(q => q >= pt); groesseSetzen(GROESSEN[Math.max(0, Math.min(GROESSEN.length - 1, i + (k === ">" ? 1 : -1)))]); }
  });

  /* Autokorrektur nach Leerzeichen / Satzzeichen / Anführungszeichen */
  rich.addEventListener("input", (e) => {
    if (!autoAn() || e.inputType !== "insertText" || !e.data) return;
    const s = getSelection(); if (!s.isCollapsed) return;
    const t = s.anchorNode; if (!t || t.nodeType !== 3 || !rich.contains(t)) return;
    const o = s.anchorOffset, vor = t.textContent.slice(0, o);
    const ersetze = (laenge, neu) => {
      const r = document.createRange(); r.setStart(t, o - laenge); r.setEnd(t, o);
      s.removeAllRanges(); s.addRange(r);
      document.execCommand("insertText", false, neu);
    };
    // „Deutsche Anführungszeichen“
    if (e.data === '"') { const davor = vor.slice(-2, -1); ersetze(1, !davor || /[\s(\[{\-–—/]/.test(davor) ? "„" : "“"); return; }
    if (e.data === "'") { const davor = vor.slice(-2, -1); if (!davor || /\s/.test(davor)) { ersetze(1, "‚"); } else if (/[\p{L}]/u.test(davor) && /‚[^‘]*$/.test(vor.slice(0, -1))) ersetze(1, "‘"); return; }
    for (const [re, neu] of ERSETZEN) { const m = vor.match(re); if (m) { ersetze(m[0].length, neu); return; } }
    // Satzanfang groß (nach . ! ? oder am Absatzanfang), wenn ein Wort fertig ist
    if (/[\s.,!?;:]/.test(e.data)) {
      const m = vor.slice(0, -1).match(/(^|[.!?]\s+)(\p{Ll}[\p{L}]*)$/u);
      if (!m) return;
      const wort = m[2];
      // Am Absatzanfang nur, wenn wirklich nichts davor steht
      if (!m[1]) {
        const blk = t.parentElement.closest("p,li,h1,h2,h3,blockquote,div,td,th"); if (!blk || blk === rich) return;
        const r = document.createRange(); r.selectNodeContents(blk); r.setEnd(t, o - 1 - wort.length);
        if (r.toString().trim()) return;
      }
      if (/^(z|d|u|bzw|ca|usw|etc|vgl|evtl|ggf|s)$/.test(wort)) return; // Abkürzungen
      const pos = textPos(rich), start = o - 1 - wort.length, r = document.createRange(); r.setStart(t, start); r.setEnd(t, start + 1);
      s.removeAllRanges(); s.addRange(r);
      document.execCommand("insertText", false, wort[0].toLocaleUpperCase("de-DE"));
      posSetzen(rich, pos);
    }
  });

  // Eingefügtes aus Word oder dem Internet: Formatierung (Farbe, Größe, Ausrichtung, Listen) behalten, alles Gefährliche weg
  rich.addEventListener("paste", (e) => {
    const html = e.clipboardData && e.clipboardData.getData("text/html");
    if (!html) return;
    e.preventDefault();
    cmd("insertHTML", saeubern(html));
  });

  Plus.binden(wurzel, rich, geaendert, schnappschuss);
  return { zustandZeigen, rueckgaengig, wiederholen, schnappschuss: () => schnappschuss(true) };
}

// Größe aus Word/Website in em relativ zu 11 pt umrechnen
function groesseEm(v) {
  const m = String(v).match(/^([\d.]+)(pt|px|em|rem|%)$/); if (!m) return "";
  const z = +m[1], pt = m[2] === "pt" ? z : m[2] === "px" ? z * 0.75 : m[2] === "%" ? z / 100 * 11 : z * 11;
  if (!(pt > 4 && pt < 100) || Math.abs(pt - 11) < 0.6) return "";
  return (pt / 11).toFixed(3) + "em";
}

// Fremdes HTML (z. B. aus Word oder einer Website) auf erlaubte Teile kürzen – sicher, ohne Skripte
export function saeubern(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  // Word-Listen (Absätze mit mso-list) in echte Listen umbauen
  doc.querySelectorAll("p").forEach(p => {
    const st = p.getAttribute("style") || "";
    if (!/mso-list/i.test(st) && !/MsoListParagraph/i.test(p.className)) return;
    const marke = p.querySelector('[style*="mso-list:Ignore"], [style*="mso-list: Ignore"]');
    const zeichen = (marke ? marke.textContent : p.textContent).trim();
    if (marke) marke.remove();
    // Kommentare mit [if !supportLists] entfernen
    const geordnet = /^[0-9a-zA-Z]{1,3}[.)]/.test(zeichen);
    const li = doc.createElement("li"); li.innerHTML = p.innerHTML.replace(/^\s*(&nbsp;|\s)+/, "");
    const vorher = p.previousElementSibling;
    if (vorher && vorher.tagName === (geordnet ? "OL" : "UL") && vorher.dataset.word) vorher.appendChild(li);
    else { const l = doc.createElement(geordnet ? "ol" : "ul"); l.dataset.word = "1"; l.appendChild(li); p.before(l); }
    p.remove();
  });
  const ERLAUBT = new Set(["P", "BR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "SUB", "SUP", "H1", "H2", "H3", "H4", "UL", "OL", "LI", "TABLE", "TBODY", "THEAD", "TR", "TD", "TH", "BLOCKQUOTE", "SPAN", "FONT", "IMG", "A", "DIV", "HR"]);
  function sauber(n) {
    if (n.nodeType === 3) return document.createTextNode(n.textContent.replace(/ /g, " "));
    if (n.nodeType !== 1) return null;
    if (!ERLAUBT.has(n.tagName)) { if (/^(STYLE|SCRIPT|META|LINK|TITLE|XML|O:P)$/i.test(n.tagName)) return null; const f = document.createDocumentFragment(); n.childNodes.forEach(c => { const x = sauber(c); if (x) f.appendChild(x); }); return f; }
    const tag = n.tagName === "A" || n.tagName === "FONT" ? "SPAN" : n.tagName === "H4" ? "H3" : n.tagName === "DIV" ? "P" : n.tagName === "STRIKE" ? "S" : n.tagName;
    const e = document.createElement(tag);
    if (n.tagName === "IMG") { const src = n.getAttribute("src") || ""; if (!/^data:image\//.test(src)) return null; e.src = src; e.className = "bild"; return e; }
    if (n.tagName === "TABLE") e.className = "tab";
    const st = n.style;
    if (st) {
      if (st.fontWeight && /bold|[6-9]00/.test(st.fontWeight)) e.style.fontWeight = "bold";
      if (st.fontStyle === "italic") e.style.fontStyle = "italic";
      if (/underline/.test(st.textDecoration || st.textDecorationLine || "")) e.style.textDecoration = "underline";
      if (/^(center|right|justify)$/.test(st.textAlign)) e.style.textAlign = st.textAlign;
      // Farbe nur, wenn sie nicht (fast) schwarz ist – sonst wäre der Text im Dunkelmodus falsch
      if (st.color && !/^(black|windowtext|#000(000)?|rgb\(0, 0, 0\)|inherit|initial)$/i.test(st.color.trim())) e.style.color = st.color;
      const bg = st.backgroundColor || st.background;
      if (bg && /^(#|rgb|yellow|lime|aqua|fuchsia|cyan|magenta)/i.test(bg.trim()) && !/^(#fff(fff)?|white|rgb\(255, 255, 255\))$/i.test(bg.trim()) && tag !== "TD" && tag !== "TABLE") e.style.backgroundColor = bg;
      const gr = st.fontSize ? groesseEm(st.fontSize) : ""; if (gr && !/^H/.test(tag)) e.style.fontSize = gr;
      const ml = parseFloat(st.marginLeft); if (/^(P)$/.test(tag) && ml > 20 && /pt|px|cm/.test(st.marginLeft)) e.style.marginLeft = "1.4em";
    }
    if (n.tagName === "FONT" && n.getAttribute("color")) e.style.color = n.getAttribute("color");
    if (n.getAttribute("align") && /^(center|right|justify)$/i.test(n.getAttribute("align"))) e.style.textAlign = n.getAttribute("align").toLowerCase();
    n.childNodes.forEach(c => { const x = sauber(c); if (x) e.appendChild(x); });
    // leere Spans weg
    if (tag === "SPAN" && !e.getAttribute("style")) { const f = document.createDocumentFragment(); while (e.firstChild) f.appendChild(e.firstChild); return f; }
    return e;
  }
  const f = document.createElement("div");
  doc.body.childNodes.forEach(c => { const x = sauber(c); if (x) f.appendChild(x); });
  return f.innerHTML;
}
