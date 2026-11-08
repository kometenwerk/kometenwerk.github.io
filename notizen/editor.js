// FIDELIA Notizen · Text wie in Word
// Formatierung (Schrift, Größe, Fett …), Listen, Tabellen, Bilder, Formeln (KaTeX), Inhaltsverzeichnis,
// Vorlagen, Wörter zählen, Diktieren (Whisper auf dem Gerät) und Vorlesen (Stimmen auf dem Gerät).

import * as Sprache from "./sprache.js";

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
  return d.textContent.replace(/\n{3,}/g, "\n\n").trim();
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

export function vorlesen(text, knopf) {
  const sy = window.speechSynthesis;
  if (!sy) { KW.toast("Dein Browser kann nicht vorlesen."); return; }
  if (sy.speaking) { sy.cancel(); if (knopf) knopf.classList.remove("an"); return; }
  const stimmen = sy.getVoices().filter(v => /^de/i.test(v.lang));
  const stimme = stimmen.find(v => v.localService) || null; // nur lokale Stimmen: nichts geht ins Internet
  if (!stimme) { KW.toast(stimmen.length ? "Auf diesem Gerät gibt es nur Online-Stimmen – die nutze ich nicht." : "Auf diesem Gerät ist keine deutsche Stimme installiert."); return; }
  const u = new SpeechSynthesisUtterance(String(text).slice(0, 30000));
  u.voice = stimme; u.lang = stimme.lang; u.rate = 0.95;
  u.onend = u.onerror = () => knopf && knopf.classList.remove("an");
  if (knopf) knopf.classList.add("an");
  sy.speak(u);
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

// rich: das bearbeitbare Feld; geaendert(): speichern; extras: { formel(), bild(), toc(), diktat(), vorlesen() }
export function leisteHtml() {
  return '<div class="wort-leiste" role="toolbar" aria-label="Text formatieren">' +
    '<select data-w="block" aria-label="Formatvorlage" title="Formatvorlage"><option value="p">Normal</option><option value="h1">Überschrift 1</option><option value="h2">Überschrift 2</option><option value="h3">Überschrift 3</option><option value="blockquote">Zitat</option></select>' +
    '<select data-w="schrift" aria-label="Schriftart" title="Schriftart">' + SCHRIFTEN.map(s => '<option value="' + esc(s[0]) + '">' + s[1] + '</option>').join("") + '</select>' +
    '<select data-w="groesse" aria-label="Schriftgröße" title="Schriftgröße"><option value="">Größe</option>' + GROESSEN.map(g => '<option>' + g + '</option>').join("") + '</select>' +
    '<span class="trenn"></span>' +
    '<button type="button" data-c="bold" title="Fett (Strg+B)" aria-label="Fett"><b>F</b></button>' +
    '<button type="button" data-c="italic" title="Kursiv (Strg+I)" aria-label="Kursiv"><i>K</i></button>' +
    '<button type="button" data-c="underline" title="Unterstrichen (Strg+U)" aria-label="Unterstrichen"><u>U</u></button>' +
    '<button type="button" data-c="strikeThrough" title="Durchgestrichen" aria-label="Durchgestrichen"><s>S</s></button>' +
    '<button type="button" data-c="superscript" title="Hochgestellt" aria-label="Hochgestellt">x²</button>' +
    '<button type="button" data-c="subscript" title="Tiefgestellt" aria-label="Tiefgestellt">x₂</button>' +
    '<label class="farb-knopf" title="Schriftfarbe"><span aria-hidden="true">A</span><input type="color" data-w="farbe" value="#c93a3a" aria-label="Schriftfarbe"></label>' +
    '<select data-w="marker" aria-label="Textmarker" title="Textmarker">' + MARKER.map(m => '<option value="' + m[0] + '">🖍 ' + m[1] + '</option>').join("") + '</select>' +
    '<span class="trenn"></span>' +
    '<button type="button" data-c="justifyLeft" title="Links" aria-label="Linksbündig">⯇</button>' +
    '<button type="button" data-c="justifyCenter" title="Mitte" aria-label="Zentriert">≡</button>' +
    '<button type="button" data-c="justifyRight" title="Rechts" aria-label="Rechtsbündig">⯈</button>' +
    '<button type="button" data-c="justifyFull" title="Blocksatz" aria-label="Blocksatz">☰</button>' +
    '<button type="button" data-c="insertUnorderedList" title="Aufzählung" aria-label="Aufzählung">•≡</button>' +
    '<button type="button" data-c="insertOrderedList" title="Nummerierung" aria-label="Nummerierung">1.</button>' +
    '<button type="button" data-c="outdent" title="Einzug kleiner" aria-label="Einzug verkleinern">⇤</button>' +
    '<button type="button" data-c="indent" title="Einzug größer" aria-label="Einzug vergrößern">⇥</button>' +
    '<span class="trenn"></span>' +
    '<button type="button" data-x="tabelle" title="Tabelle einfügen" aria-label="Tabelle einfügen">⊞</button>' +
    '<button type="button" data-x="bild" title="Bild einfügen" aria-label="Bild einfügen">🖼️</button>' +
    '<button type="button" data-x="formel" title="Formel einfügen" aria-label="Formel einfügen">∑</button>' +
    '<button type="button" data-x="toc" title="Inhaltsverzeichnis" aria-label="Inhaltsverzeichnis">📑</button>' +
    '<button type="button" data-x="diktat" title="Diktieren" aria-label="Diktieren">🎤</button>' +
    '<button type="button" data-x="vorlesen" title="Vorlesen" aria-label="Vorlesen">🔊</button>' +
    '<button type="button" data-c="removeFormat" title="Formatierung löschen" aria-label="Formatierung löschen">⌫A</button>' +
  '</div>' +
  '<div class="tabellen-leiste" hidden><span class="muted klein">Tabelle:</span><button type="button" data-t="zeile+">+ Zeile</button><button type="button" data-t="spalte+">+ Spalte</button><button type="button" data-t="zeile-">− Zeile</button><button type="button" data-t="spalte-">− Spalte</button><button type="button" data-t="kopf">Kopfzeile</button><button type="button" data-t="weg">Tabelle löschen</button></div>';
}

export function leisteBinden(wurzel, rich, geaendert, extras) {
  const leiste = wurzel.querySelector(".wort-leiste"), tabLeiste = wurzel.querySelector(".tabellen-leiste");
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
  const cmd = (c, w) => { zurueck(); document.execCommand("styleWithCSS", false, true); document.execCommand(c, false, w); merken(); geaendert(); zustandZeigen(); };

  leiste.querySelectorAll("button").forEach(b => b.addEventListener("mousedown", e => e.preventDefault()));
  leiste.querySelectorAll("[data-c]").forEach(b => b.onclick = () => cmd(b.dataset.c));
  leiste.querySelector('[data-w="block"]').onchange = (e) => cmd("formatBlock", e.target.value);
  leiste.querySelector('[data-w="schrift"]').onchange = (e) => { cmd("fontName", e.target.value || "Space Grotesk"); };
  leiste.querySelector('[data-w="farbe"]').oninput = (e) => cmd("foreColor", e.target.value);
  leiste.querySelector('[data-w="marker"]').onchange = (e) => { cmd("hiliteColor", e.target.value || "transparent"); e.target.value = ""; };
  leiste.querySelector('[data-w="groesse"]').onchange = (e) => {
    const pt = Number(e.target.value); if (!pt) return;
    zurueck(); document.execCommand("styleWithCSS", false, false); document.execCommand("fontSize", false, "7");
    rich.querySelectorAll('font[size="7"]').forEach(f => { const s = document.createElement("span"); s.style.fontSize = (pt / 11).toFixed(3) + "em"; s.innerHTML = f.innerHTML; f.replaceWith(s); });
    e.target.value = ""; geaendert();
  };
  const x = (n) => leiste.querySelector('[data-x="' + n + '"]');
  x("tabelle").onclick = () => {
    const z = Math.max(1, Math.min(30, parseInt(prompt("Wie viele Zeilen?", "3"), 10) || 0)), sp = Math.max(1, Math.min(10, parseInt(prompt("Wie viele Spalten?", "3"), 10) || 0));
    if (!z || !sp) return;
    // Tabelle hinter den aktuellen Absatz setzen (nicht mitten hinein) und in die erste Zelle springen
    zurueck();
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
  x("bild").onclick = async () => { merken(); const r = bereich && bereich.cloneRange(); const url = await extras.bild(); if (url) einfuegenBei(r, '<img class="bild" src="' + url + '" alt="">'); };
  x("formel").onclick = async () => { merken(); const r = bereich && bereich.cloneRange(); const tex = await formelDialog(""); if (tex) einfuegenBei(r, formelHtml(tex) + "&nbsp;"); };
  x("toc").onclick = () => { inhaltsverzeichnis(rich); geaendert(); };
  x("diktat").onclick = () => { merken(); diktieren(x("diktat"), extras.sprachModell, (text) => cmd("insertText", (bereich && !bereich.collapsed ? "" : " ") + text)); };
  x("vorlesen").onclick = () => { const s = getSelection(); vorlesen(s.toString() && rich.contains(s.anchorNode) ? s.toString() : htmlZuText(rich.innerHTML), x("vorlesen")); };

  // Formel antippen → bearbeiten
  rich.addEventListener("click", async (e) => {
    const f = e.target.closest(".formel");
    if (f && rich.contains(f)) { const tex = await formelDialog(f.dataset.tex); if (tex) { const t = document.createElement("span"); t.innerHTML = formelHtml(tex); f.replaceWith(t.firstChild); geaendert(); } return; }
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
    m.innerHTML = '<button data-b="25">Klein</button><button data-b="50">Mittel</button><button data-b="100">Groß</button><button data-a="left">⯇</button><button data-a="center">≡</button><button data-a="right">⯈</button><button data-a="weg">🗑</button>';
    const r = img.getBoundingClientRect();
    m.style.left = Math.max(8, r.left) + "px"; m.style.top = Math.max(70, r.top - 46) + "px";
    document.body.appendChild(m);
    m.onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
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

  function zustandZeigen() {
    if (!document.body.contains(leiste)) return;
    const an = (c) => { try { return document.queryCommandState(c); } catch (e) { return false; } };
    leiste.querySelectorAll("[data-c]").forEach(b => b.classList.toggle("an", ["bold", "italic", "underline", "strikeThrough", "superscript", "subscript", "insertUnorderedList", "insertOrderedList"].includes(b.dataset.c) && an(b.dataset.c)));
    const s = getSelection(), n = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
    if (n && rich.contains(n)) {
      const blk = n.closest("h1,h2,h3,blockquote,p,li,div");
      const t = blk ? blk.tagName.toLowerCase() : "p";
      leiste.querySelector('[data-w="block"]').value = ["h1", "h2", "h3", "blockquote"].includes(t) ? t : "p";
    }
    tabLeiste.hidden = !zelle();
  }

  // Tastenkürzel wie in Word
  rich.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === "b") { e.preventDefault(); cmd("bold"); } else if (k === "i") { e.preventDefault(); cmd("italic"); } else if (k === "u") { e.preventDefault(); cmd("underline"); }
    else if (e.altKey && ["1", "2", "3"].includes(k)) { e.preventDefault(); cmd("formatBlock", "h" + k); }
  });
  // Eingefügtes aus dem Internet: nur einfache Formatierung behalten
  rich.addEventListener("paste", (e) => {
    const html = e.clipboardData && e.clipboardData.getData("text/html");
    if (!html) return;
    e.preventDefault();
    cmd("insertHTML", saeubern(html));
  });
  return { zustandZeigen };
}

// Fremdes HTML (z. B. aus Word oder einer Website) auf erlaubte Teile kürzen – sicher, ohne Skripte
export function saeubern(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const ERLAUBT = new Set(["P", "BR", "B", "STRONG", "I", "EM", "U", "S", "SUB", "SUP", "H1", "H2", "H3", "UL", "OL", "LI", "TABLE", "TBODY", "THEAD", "TR", "TD", "TH", "BLOCKQUOTE", "SPAN", "IMG", "A"]);
  function sauber(n) {
    if (n.nodeType === 3) return document.createTextNode(n.textContent);
    if (n.nodeType !== 1) return null;
    if (!ERLAUBT.has(n.tagName)) { const f = document.createDocumentFragment(); n.childNodes.forEach(c => { const x = sauber(c); if (x) f.appendChild(x); }); return f; }
    const e = document.createElement(n.tagName === "A" ? "span" : n.tagName);
    if (n.tagName === "IMG") { const src = n.getAttribute("src") || ""; if (!/^data:image\//.test(src)) return null; e.src = src; e.className = "bild"; return e; }
    const st = n.style;
    if (st && st.fontWeight && /bold|[6-9]00/.test(st.fontWeight)) e.style.fontWeight = "bold";
    if (st && st.fontStyle === "italic") e.style.fontStyle = "italic";
    if (st && st.textAlign) e.style.textAlign = st.textAlign;
    n.childNodes.forEach(c => { const x = sauber(c); if (x) e.appendChild(x); });
    return e;
  }
  const f = document.createElement("div");
  doc.body.childNodes.forEach(c => { const x = sauber(c); if (x) f.appendChild(x); });
  return f.innerHTML;
}
