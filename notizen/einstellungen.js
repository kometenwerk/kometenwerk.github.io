// FIDELIA Notizen · Einstellungen und Einrichtungs-Assistent
// Jeder stellt sich die App beim ersten Start selbst zusammen: Fächer, Funktionen (mit Unterfunktionen),
// KI-Check und Aussehen. Alles lässt sich später unter ⚙️ Einstellungen ändern.

import * as KI from "./ki.js";
import * as Sprache from "./sprache.js";
import * as Sync from "./sync.js";
import * as Papier from "./papier.js";

const KEY = "kw-notizen-einst";
const esc = (s) => window.KW.esc(s);

export const START_FAECHER = [
  ["Deutsch", "#d64545"], ["Mathe", "#1f4fd1"], ["Englisch", "#c98a00"], ["Französisch", "#9b51e0"],
  ["Biologie", "#1a8f4c"], ["Chemie", "#0f766e"], ["Physik", "#2563eb"], ["NWT", "#d4561a"],
  ["Informatik", "#334155"], ["Geschichte", "#8b5e34"], ["Erdkunde", "#4d7c0f"], ["Gemeinschaftskunde", "#be185d"],
  ["Religion / Ethik", "#7c3aed"], ["Kunst", "#db2777"], ["Musik", "#0891b2"], ["Sport", "#16a34a"]
];

// Alle Funktionen mit ihren Unterfunktionen. art: "schalter" | "wahl" | "fest" (immer an, nicht abschaltbar)
export const FUNKTIONEN = [
  { id: "heft", icon: "📓", name: "Heft", text: "Digitales Heft mit Stift und Tastatur.", fest: true, unter: [
    { id: "raster", name: "Papier für neue Seiten", art: "wahl", wert: "karo5-r", werte: [["karo5-r", "Kariert mit Rand"], ["karo5", "Kariert"], ["lin8-r", "Liniert mit Rand"], ["lin8", "Liniert"], ["punkte5", "Punkte"], ["leer", "Leer"]] },
    { id: "formen", name: "Formen-Erkennung (am Ende kurz halten)", art: "schalter", wert: true },
    { id: "autokorrektur", name: "Autokorrektur beim Tippen (Satzanfang groß, → … – „“)", art: "schalter", wert: true },
    { id: "marker", name: "Textmarker", art: "schalter", wert: true },
    { id: "radierer", name: "Radiergummi", art: "wahl", wert: "strich", werte: [["strich", "Ganze Striche"], ["stueck", "Nur wo du radierst"]] }
  ] },
  { id: "tabellen", icon: "📊", name: "Tabellen", text: "Rechnen wie in Excel: Formeln, Diagramme, Notenrechner.", unter: [
    { id: "diagramme", name: "Diagramme", art: "schalter", wert: true },
    { id: "hand", name: "Mit dem Stift in Zellen schreiben (KI)", art: "schalter", wert: true }
  ] },
  { id: "folien", icon: "🖥️", name: "Präsentationen", text: "Folien wie in PowerPoint – mit Vorführen, Stift und Laserpointer.", unter: [
    { id: "ki", name: "Folien aus einer Heftseite machen (KI)", art: "schalter", wert: true },
    { id: "laser", name: "Stift und Laserpointer beim Vorführen", art: "schalter", wert: true }
  ] },
  { id: "scanner", icon: "📷", name: "Scanner", text: "Arbeitsblätter mit der Kamera einscannen.", unter: [
    { id: "auto", name: "Automatisch auslösen, wenn das Blatt ruhig liegt", art: "schalter", wert: true },
    { id: "animation", name: "Scan-Strich und Haken", art: "schalter", wert: true },
    { id: "filter", name: "Papierweiß-Filter", art: "wahl", wert: "farbe", werte: [["farbe", "Farbe (Papier weiß)"], ["normal", "Graustufen"], ["stark", "Schwarz/Weiß"], ["aus", "Originalfoto"]] },
    { id: "nachbau", name: "Als Word-Seite nachbauen (Text bearbeitbar)", art: "schalter", wert: true },
    { id: "mehrfach", name: "Mehrere Blätter hintereinander", art: "schalter", wert: true },
    { id: "ton", name: "Ton beim Scannen", art: "schalter", wert: true },
    { id: "ocr", name: "Text auf dem Blatt erkennen (für Suche und KI)", art: "schalter", wert: true }
  ] },
  { id: "planer", icon: "📅", name: "Planer-Verbindung", text: "Hausaufgaben und Stundenplan aus dem FIDELIA Planer.", unter: [
    { id: "hausaufgaben", name: "Hausaufgaben in den Planer eintragen", art: "schalter", wert: true },
    { id: "stundenplan", name: "Stundenplan von heute anzeigen", art: "schalter", wert: true },
    { id: "vortag", name: "Erinnerung am Vortag", art: "schalter", wert: true },
    { id: "countdown", name: "Klassenarbeiten mit Countdown", art: "schalter", wert: true }
  ] },
  { id: "lernen", icon: "🧠", name: "Karteikarten & Quiz", text: "Aus deinen Notizen Lernkarten und Quizfragen machen.", ki: true, unter: [
    { id: "karten", name: "Karteikarten vorschlagen", art: "schalter", wert: true },
    { id: "quiz", name: "Quizfragen vorschlagen", art: "schalter", wert: true },
    { id: "pruefen", name: "Vor dem Speichern prüfen (empfohlen)", art: "schalter", wert: true },
    { id: "erinnerung", name: "Lern-Erinnerung vor Klassenarbeiten", art: "schalter", wert: true }
  ] },
  { id: "audio", icon: "🎙️", name: "Audio-Scribe", text: "Unterricht aufnehmen und als Heftseite zusammenfassen – nur mit Erlaubnis der Lehrkraft.", ki: true, unter: [
    { id: "zustimmung", name: "Lehrer-Zustimmung abfragen", art: "fest", wert: true },
    { id: "loeschen", name: "Aufnahme nach dem Umwandeln löschen", art: "fest", wert: true },
    { id: "laenge", name: "Zusammenfassung", art: "wahl", wert: "kurz", werte: [["kurz", "Kurz"], ["ausfuehrlich", "Ausführlich"]] },
    { id: "volltext", name: "Ganzen Text zusätzlich speichern", art: "schalter", wert: false },
    { id: "modell", name: "Spracherkennung", art: "wahl", wert: "auto", werte: [["auto", "Automatisch (Handy klein, Laptop normal)"], ["tiny", "Sehr klein (ca. 75 MB)"], ["base", "Normal (ca. 150 MB)"], ["small", "Genauer (ca. 500 MB)"]] }
  ] },
  { id: "kisort", icon: "🤖", name: "KI-Sortierung", text: "Scans und Seiten automatisch ins richtige Fach legen.", ki: true, unter: [
    { id: "auto", name: "Automatisch in Fach-Ordner", art: "schalter", wert: true },
    { id: "fragen", name: "Vorher fragen („Ist das Mathe?“)", art: "schalter", wert: true },
    { id: "titel", name: "Überschrift vorschlagen", art: "schalter", wert: true }
  ] }
];

function standard() {
  const e = { fertig: false, thema: "auto", faecher: [], an: {}, f: {}, ki: { art: "auto", ollamaModell: "", bildModell: "" } };
  for (const fn of FUNKTIONEN) {
    e.an[fn.id] = fn.id === "audio" ? false : true;
    e.f[fn.id] = {};
    for (const u of fn.unter) e.f[fn.id][u.id] = u.wert;
  }
  return e;
}

export function laden() {
  const e = standard(), alt = window.KW.load(KEY, null);
  if (!alt) return e;
  Object.assign(e, alt, { an: Object.assign(e.an, alt.an || {}), ki: Object.assign(e.ki, alt.ki || {}) });
  for (const fn of FUNKTIONEN) e.f[fn.id] = Object.assign(standard().f[fn.id], (alt.f || {})[fn.id] || {});
  // Feste Unterfunktionen lassen sich nicht abschalten
  for (const fn of FUNKTIONEN) for (const u of fn.unter) if (u.art === "fest") e.f[fn.id][u.id] = true;
  e.an.heft = true;
  // Update 2: neuer Farb-Filter als Standard
  if (!e.v2) { if (e.f.scanner.filter === "normal") e.f.scanner.filter = "farbe"; e.v2 = true; }
  return e;
}

export function speichern(e) { window.KW.save(KEY, e); }

export function themaSetzen(t) {
  if (t === "hell" || t === "dunkel") document.documentElement.setAttribute("data-thema", t);
  else document.documentElement.removeAttribute("data-thema");
}

// Fächer, die es im Planer schon gibt (dann passen Farben überall zusammen)
export function planerFaecher() {
  const p = window.KW.load("kw-planer", null);
  if (p && Array.isArray(p.faecher) && p.faecher.length) return p.faecher.map(f => ({ name: f.name, farbe: f.farbe }));
  return START_FAECHER.map(f => ({ name: f[0], farbe: f[1] }));
}

// Neue eigene Fächer auch im Planer anlegen, damit Hausaufgaben dort richtig aussehen
export function faecherAnPlaner(faecher) {
  const p = window.KW.load("kw-planer", null);
  if (!p || !Array.isArray(p.faecher)) return;
  let neu = 0;
  for (const f of faecher) if (!p.faecher.some(x => x.name === f.name)) { p.faecher.push({ name: f.name, farbe: f.farbe }); neu++; }
  if (neu) window.KW.save("kw-planer", p);
}

/* ---------- Bausteine für Assistent und Einstellungen ---------- */

function faecherHtml(e) {
  const alle = planerFaecher();
  for (const f of e.faecher) if (!alle.some(x => x.name === f.name)) alle.push(f);
  return '<div class="fach-wahl" role="group" aria-label="Deine Fächer">' + alle.map(f => {
    const an = e.faecher.some(x => x.name === f.name);
    return '<button type="button" class="fach-chip" data-fach="' + esc(f.name) + '" data-farbe="' + esc(f.farbe) + '" aria-pressed="' + an + '" style="--f:' + esc(f.farbe) + '">' + (an ? "✓ " : "") + esc(f.name) + '</button>';
  }).join("") + '</div>' +
  '<div class="row fach-neu"><input class="inp" id="fachNeuName" maxlength="30" placeholder="Eigenes Fach, z. B. Latein" aria-label="Eigenes Fach">' +
  '<input type="color" id="fachNeuFarbe" value="#0e7490" aria-label="Farbe für das neue Fach"><button type="button" class="btn" id="fachNeuPlus">+ Dazu</button></div>';
}

function faecherBinden(el, e, neuZeichnen) {
  el.querySelectorAll(".fach-chip").forEach(b => b.onclick = () => {
    const name = b.dataset.fach, i = e.faecher.findIndex(x => x.name === name);
    if (i >= 0) e.faecher.splice(i, 1); else e.faecher.push({ name, farbe: b.dataset.farbe });
    neuZeichnen();
  });
  const plus = el.querySelector("#fachNeuPlus");
  if (plus) plus.onclick = () => {
    const name = el.querySelector("#fachNeuName").value.trim();
    if (!name) return;
    if (!e.faecher.some(x => x.name.toLowerCase() === name.toLowerCase())) e.faecher.push({ name, farbe: el.querySelector("#fachNeuFarbe").value });
    neuZeichnen();
  };
}

export function funktionenHtml(e, offen) {
  return '<div class="fkt-liste">' + FUNKTIONEN.map(fn => {
    const an = !!e.an[fn.id], auf = offen && offen[fn.id];
    let h = '<div class="fkt' + (an ? " an" : "") + '" data-fkt="' + fn.id + '">' +
      '<div class="fkt-kopf"><button type="button" class="fkt-auf" data-auf="' + fn.id + '" aria-expanded="' + !!auf + '" aria-label="Unterfunktionen von ' + esc(fn.name) + ' ' + (auf ? "zuklappen" : "aufklappen") + '">' +
      '<span class="fkt-ico" aria-hidden="true">' + fn.icon + '</span><span><b>' + esc(fn.name) + (fn.ki ? ' <small class="ki-mark">KI</small>' : "") + '</b><small>' + esc(fn.text) + '</small></span><span class="pfeil" aria-hidden="true">' + (auf ? "▾" : "▸") + '</span></button>' +
      (fn.fest ? '<span class="immer">immer an</span>' : '<label class="sw"><input type="checkbox" data-an="' + fn.id + '"' + (an ? " checked" : "") + '><span class="vh">' + esc(fn.name) + ' an</span><i aria-hidden="true"></i></label>') +
      '</div>';
    if (auf) {
      h += '<div class="fkt-unter">' + fn.unter.map(u => {
        const w = e.f[fn.id][u.id];
        if (u.art === "wahl") return '<label class="u-zeile"><span>' + esc(u.name) + '</span><select class="inp" data-u="' + fn.id + "." + u.id + '"' + (an ? "" : " disabled") + '>' +
          u.werte.map(o => '<option value="' + o[0] + '"' + (o[0] === w ? " selected" : "") + '>' + esc(o[1]) + '</option>').join("") + '</select></label>';
        if (u.art === "fest") return '<div class="u-zeile"><span>' + esc(u.name) + '</span><span class="immer">🔒 immer an</span></div>';
        return '<label class="u-zeile"><span>' + esc(u.name) + '</span><span class="sw klein"><input type="checkbox" data-u="' + fn.id + "." + u.id + '"' + (w ? " checked" : "") + (an ? "" : " disabled") + '><i aria-hidden="true"></i></span></label>';
      }).join("") + '</div>';
    }
    return h + '</div>';
  }).join("") + '</div>';
}

export function funktionenBinden(el, e, offen, neuZeichnen, geaendert) {
  el.querySelectorAll("[data-auf]").forEach(b => b.onclick = () => { offen[b.dataset.auf] = !offen[b.dataset.auf]; neuZeichnen(); });
  el.querySelectorAll("[data-an]").forEach(c => c.onchange = () => {
    e.an[c.dataset.an] = c.checked;
    if (c.checked && c.dataset.an === "audio") window.KW.toast("Wichtig: Nimm Lehrer nur auf, wenn sie Ja gesagt haben.");
    geaendert && geaendert(); neuZeichnen();
  });
  el.querySelectorAll("[data-u]").forEach(c => c.onchange = () => {
    const [f, u] = c.dataset.u.split(".");
    e.f[f][u] = c.type === "checkbox" ? c.checked : c.value;
    geaendert && geaendert();
  });
}

// KI-Check: zeigt, ob Ollama läuft, und erklärt sonst, wie man es einrichtet
export async function kiCheck(el, e, geaendert) {
  el.innerHTML = '<p class="muted">Ich schaue, ob auf diesem Gerät eine KI läuft …</p>';
  const o = await KI.ollamaPruefen();
  const browserKi = "gpu" in navigator || typeof LanguageModel !== "undefined";
  let h = "";
  if (o.ok && o.modelle.length) {
    const m = KI.modellWaehlen(o.modelle, e.ki.ollamaModell);
    h += '<div class="ki-status gut">✅ <b>Ollama läuft</b> – deine KI rechnet auf diesem Laptop.</div>' +
      '<label class="field"><span>Modell für Text</span><select class="inp" id="kiModell">' + o.modelle.map(x => '<option' + (x.name === m ? " selected" : "") + '>' + esc(x.name) + '</option>').join("") + '</select></label>';
    const bilder = o.modelle.filter(x => x.bild);
    h += bilder.length ? '<label class="field"><span>Modell für Handschrift (liest Fotos)</span><select class="inp" id="kiBild">' + bilder.map(x => '<option' + (x.name === e.ki.bildModell ? " selected" : "") + '>' + esc(x.name) + '</option>').join("") + '</select></label>'
      : '<p class="muted klein">Tipp: Für Handschrift ein Modell laden, das Bilder lesen kann: <code>ollama pull gemma3:4b</code></p>';
  } else if (o.ok) {
    h += '<div class="ki-status mittel">⚠️ <b>Ollama läuft, aber hat noch kein Modell.</b></div><p>Öffne die Eingabeaufforderung und tippe:</p><pre>ollama pull gemma3:4b</pre>';
  } else {
    h += '<div class="ki-status' + (browserKi ? " mittel" : "") + '">' + (browserKi ? "🟡 <b>Ollama nicht gefunden.</b> Die App nimmt stattdessen die Browser-KI von AORIS (lädt beim ersten Mal einmalig ein Modell)." : "⚪ <b>Keine KI gefunden.</b> Die App funktioniert trotzdem – nur ohne KI-Knöpfe.") + '</div>' +
      '<details class="anleitung"><summary>So richtest du Ollama ein (stärker und schneller)</summary><ol>' +
      '<li>Lade Ollama von <b>ollama.com</b> herunter und installiere es (frag vorher deine Eltern).</li>' +
      '<li>Öffne die Eingabeaufforderung und lade ein Modell:<pre>ollama pull gemma3:4b</pre></li>' +
      '<li>Erlaube dieser Seite, mit Ollama zu sprechen. Windows:<pre>setx OLLAMA_ORIGINS "https://kometenwerk.github.io"</pre>Mac:<pre>launchctl setenv OLLAMA_ORIGINS "https://kometenwerk.github.io"</pre></li>' +
      '<li>Ollama beenden (Symbol unten rechts) und neu starten.</li>' +
      '<li>Fragt der Browser nach „Geräten im lokalen Netzwerk“, tippe auf <b>Zulassen</b>.</li></ol></details>';
  }
  h += '<label class="field"><span>Welche KI soll die App benutzen?</span><select class="inp" id="kiArt">' +
    [["auto", "Automatisch (erst Ollama, sonst Browser-KI)"], ["ollama", "Nur Ollama"], ["aoris", "Nur Browser-KI (AORIS)"], ["aus", "Keine KI"]].map(a => '<option value="' + a[0] + '"' + (a[0] === e.ki.art ? " selected" : "") + '>' + a[1] + '</option>').join("") + '</select></label>' +
    '<button type="button" class="btn small" id="kiNochmal">↻ Nochmal prüfen</button>';
  const ollamaDa = o.ok && o.modelle.length;
  const brauchtLaden = (e.ki.art !== "aus" && !(ollamaDa && e.ki.art !== "aoris")) || e.an.audio;
  if (brauchtLaden && (browserKi || e.an.audio)) {
    h += '<div class="ki-einrichten card"><button type="button" class="btn primary" id="kiLos">🤖 KI jetzt einrichten</button>' +
      '<div class="balken" id="kiBal" hidden><i></i></div><p class="muted klein" id="kiLosText">Lädt einmal alles, was die App braucht' +
      (e.an.audio ? " (auch die Spracherkennung, " + Sprache.GROESSE[Sprache.modellName(e.f.audio.modell)] + ")" : "") + '. Danach geht alles sofort. Am besten im WLAN.' +
      (Sprache.istHandy() ? " Auf dem Handy nimmt die App die kleine KI – die macht öfter Fehler." : "") + '</p></div>';
  }
  h += '<p class="muted klein">🔒 Egal welche: Deine Texte, Fotos und Aufnahmen bleiben auf diesem Gerät.</p>';
  el.innerHTML = h;
  const los = el.querySelector("#kiLos");
  if (los) los.onclick = async () => {
    const c = navigator.connection;
    if (c && (c.type === "cellular" || c.saveData) && !confirm("Du bist nicht im WLAN. Das Laden kann viele Daten verbrauchen. Trotzdem?")) return;
    const bal = el.querySelector("#kiBal"), txt = el.querySelector("#kiLosText");
    los.disabled = true; bal.hidden = false;
    const zeig = (p, t) => { bal.firstChild.style.width = Math.max(3, Math.round((p || 0) * 100)) + "%"; if (t) txt.textContent = t; };
    const fertig = [];
    try {
      if (e.ki.art !== "aus") { const r = await KI.einrichten(e.ki, zeig); fertig.push(r.text); }
    } catch (err) { fertig.push(err.message === "ollama-fehlt" ? "Ollama wurde nicht gefunden." : "Die Text-KI konnte auf diesem Gerät nicht starten."); }
    try {
      if (e.an.audio) { zeig(0, "Spracherkennung wird geladen …"); await Sprache.laden(e.f.audio.modell, zeig); fertig.push("Spracherkennung ist bereit."); }
    } catch (err) { fertig.push("Die Spracherkennung konnte nicht geladen werden."); }
    zeig(1); txt.textContent = "✅ " + fertig.join(" ");
    los.textContent = "Fertig"; e.ki.eingerichtet = true; geaendert && geaendert();
  };
  const setz = (id, f) => { const x = el.querySelector(id); if (x) x.onchange = () => { f(x.value); geaendert && geaendert(); }; };
  setz("#kiModell", v => e.ki.ollamaModell = v);
  setz("#kiBild", v => e.ki.bildModell = v);
  setz("#kiArt", v => e.ki.art = v);
  if (o.ok && o.modelle.length) {
    if (!e.ki.ollamaModell) e.ki.ollamaModell = KI.modellWaehlen(o.modelle, "");
    if (!e.ki.bildModell) { const b = o.modelle.find(x => x.bild); if (b) e.ki.bildModell = b.name; }
    geaendert && geaendert();
  }
  el.querySelector("#kiNochmal").onclick = () => kiCheck(el, e, geaendert);
}

function aussehenHtml(e) {
  const wahl = (name, id, werte, wert) => '<div class="field"><span>' + name + '</span><div class="tabs" role="radiogroup">' +
    werte.map(w => '<button type="button" role="radio" data-' + id + '="' + w[0] + '" aria-selected="' + (w[0] === wert) + '" aria-checked="' + (w[0] === wert) + '">' + w[1] + '</button>').join("") + '</div></div>';
  return wahl("Farben", "thema", [["auto", "Wie das Gerät"], ["hell", "☀️ Hell"], ["dunkel", "🌙 Dunkel"]], e.thema) +
    wahl("Neue Heftseiten", "raster", [["karo5-r", "Kariert"], ["lin8-r", "Liniert"], ["leer", "Leer"]], Papier.info(e.f.heft.raster).id) +
    '<div class="raster-vorschau" style="background-image:' + Papier.hintergrund(e.f.heft.raster, false).replace(/"/g, "&quot;") + ';background-size:100% auto" aria-hidden="true"></div>' +
    '<p class="muted klein">Weitere Papierarten (über 30) wählst du bei „+ Neue Seite“ – auch pro Fach.</p>';
}
function aussehenBinden(el, e, neuZeichnen, geaendert) {
  el.querySelectorAll("[data-thema]").forEach(b => b.onclick = () => { e.thema = b.dataset.thema; themaSetzen(e.thema); geaendert && geaendert(); neuZeichnen(); });
  el.querySelectorAll("[data-raster]").forEach(b => b.onclick = () => { e.f.heft.raster = b.dataset.raster; geaendert && geaendert(); neuZeichnen(); });
}

/* ---------- Einrichtungs-Assistent beim ersten Start ---------- */

export function assistent(e) {
  return new Promise(fertig => {
    const d = document.createElement("dialog");
    d.className = "sheet assistent";
    d.setAttribute("aria-label", "FIDELIA Notizen einrichten");
    document.body.appendChild(d);
    if (!e.faecher.length) e.faecher = planerFaecher().filter(f => ["Deutsch", "Mathe", "Englisch", "Biologie", "Geschichte", "Erdkunde"].includes(f.name));
    let schritt = 0;
    const offen = {};
    const SCHRITTE = ["Willkommen", "Fächer", "Funktionen", "KI", "Aussehen"];
    function zeichnen() {
      let inhalt = "";
      if (schritt === 0) inhalt = '<div class="willkommen"><div class="gross" aria-hidden="true">📓✏️📷</div><h2>Dein Schul-Cockpit</h2>' +
        '<p>Heft, Scanner, Hausaufgaben, Lernkarten und Mitschriften – alles in einer App.</p><p>Stell sie dir in 30 Sekunden so zusammen, wie du sie brauchst. Alles lässt sich später ändern.</p>' +
        '<p class="muted klein">🔒 Alles bleibt auf diesem Gerät. Die KI läuft nur auf deinem Laptop.</p></div>';
      if (schritt === 1) inhalt = '<h2>Welche Fächer hast du?</h2><p class="muted">Tipp an, was du hast. Jedes Fach bekommt einen eigenen Ordner.</p>' + faecherHtml(e);
      if (schritt === 2) inhalt = '<h2>Was willst du benutzen?</h2><p class="muted">Schalte an, was du brauchst. Tipp auf eine Funktion für mehr Einstellungen.</p>' + funktionenHtml(e, offen);
      if (schritt === 3) inhalt = '<h2>KI auf deinem Gerät</h2><p class="muted">Für Karteikarten, Mitschriften und Sortieren. Ohne KI geht alles andere trotzdem.</p><div id="kiBox"></div>';
      if (schritt === 4) inhalt = '<h2>Wie soll es aussehen?</h2>' + aussehenHtml(e);
      d.innerHTML = '<div class="sheet-in"><div class="punkte-leiste" aria-label="Schritt ' + (schritt + 1) + ' von ' + SCHRITTE.length + '">' +
        SCHRITTE.map((s, i) => '<span class="' + (i <= schritt ? "an" : "") + '" title="' + s + '"></span>').join("") + '</div>' + inhalt +
        '<div class="sheet-foot">' + (schritt ? '<button type="button" class="btn" id="zurueck">Zurück</button>' : "") + '<span class="sp"></span>' +
        '<button type="button" class="btn primary" id="weiter">' + (schritt === SCHRITTE.length - 1 ? "Los geht's 🚀" : "Weiter") + '</button></div></div>';
      if (schritt === 1) faecherBinden(d, e, zeichnen);
      if (schritt === 2) funktionenBinden(d, e, offen, zeichnen);
      if (schritt === 3) kiCheck(d.querySelector("#kiBox"), e);
      if (schritt === 4) aussehenBinden(d, e, zeichnen);
      const z = d.querySelector("#zurueck");
      if (z) z.onclick = () => { schritt--; zeichnen(); };
      d.querySelector("#weiter").onclick = () => {
        if (schritt === 1 && !e.faecher.length) { window.KW.toast("Wähl mindestens ein Fach aus."); return; }
        // Wer keine KI-Funktion will, braucht keinen KI-Check
        if (schritt === 2 && !FUNKTIONEN.some(f => f.ki && e.an[f.id]) && !e.f.scanner.ocr) schritt++;
        if (schritt < SCHRITTE.length - 1) { schritt++; zeichnen(); return; }
        e.fertig = true; speichern(e); faecherAnPlaner(e.faecher);
        d.close(); d.remove(); fertig(e);
      };
    }
    d.addEventListener("cancel", ev => ev.preventDefault());
    zeichnen();
    d.showModal();
  });
}

/* ---------- Einstellungs-Seite ---------- */

export function seite(A, el) {
  const e = A.einst, offen = {};
  function geaendert() { speichern(e); A.neuAufbauen(); }
  function zeichnen() {
    el.innerHTML = '<h2 class="titel">⚙️ Einstellungen</h2>' +
      '<section class="card abschnitt"><h3>Funktionen</h3>' + funktionenHtml(e, offen) + '</section>' +
      '<section class="card abschnitt"><h3>Fächer</h3>' + faecherHtml(e) + '</section>' +
      '<section class="card abschnitt"><h3>KI</h3><div id="kiBox"></div></section>' +
      '<section class="card abschnitt"><h3>Aussehen</h3>' + aussehenHtml(e) + '</section>' +
      '<section class="card abschnitt" id="geraete"><h3>📱 Geräte verbinden</h3><div id="syncBox"></div></section>' +
      '<section class="card abschnitt"><h3>Daten</h3><p class="muted">Alles liegt nur auf diesem Gerät. Mach ab und zu eine Sicherung.</p>' +
      '<div class="row"><button type="button" class="btn" id="sichern">💾 Sicherung speichern</button><button type="button" class="btn" id="laden">📂 Sicherung laden</button>' +
      '<button type="button" class="btn" id="assi">🔁 Einrichtung neu starten</button></div><p class="muted klein" id="platz"></p></section>';
    funktionenBinden(el, e, offen, zeichnen, geaendert);
    faecherBinden(el, e, () => { speichern(e); faecherAnPlaner(e.faecher); A.neuAufbauen(); zeichnen(); });
    aussehenBinden(el, e, zeichnen, geaendert);
    kiCheck(el.querySelector("#kiBox"), e, () => speichern(e));
    el.querySelector("#sichern").onclick = () => A.sicherungSpeichern();
    el.querySelector("#laden").onclick = () => A.sicherungLaden();
    el.querySelector("#assi").onclick = () => { e.fertig = false; speichern(e); location.reload(); };
    A.platzText(el.querySelector("#platz"));
    Sync.bereich(el.querySelector("#syncBox"));
  }
  zeichnen();
}
