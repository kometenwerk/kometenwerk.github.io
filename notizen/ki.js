// FIDELIA Notizen · Lokale KI
// Zwei Wege, beide nur auf dem eigenen Gerät:
//  1. Ollama auf dem Laptop (http://localhost:11434) – am stärksten, nutzt die Rechenleistung des PCs.
//  2. AORIS-Motor im Browser (Gemini Nano in Chrome oder ein offenes Modell über WebLLM).
// Kein Text und kein Bild geht an einen Server im Internet.

export const OLLAMA = "http://localhost:11434";

/* ---------- Reine Helfer (ohne Browser testbar) ---------- */

// Holt das erste JSON-Objekt aus einer KI-Antwort (Modelle schreiben gern Text drumherum)
export function jsonAusText(text) {
  text = String(text || "").replace(/<think>[\s\S]*?(<\/think>|$)/g, "").replace(/```(?:json)?/g, "");
  const start = text.indexOf("{");
  if (start < 0) return null;
  let tiefe = 0, inString = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inString = false; continue; }
    if (c === '"') inString = true;
    else if (c === "{") tiefe++;
    else if (c === "}" && --tiefe === 0) { try { return JSON.parse(text.slice(start, i + 1)); } catch (e) { return null; } }
  }
  return null;
}

const kurz = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);

// Prüft Karteikarten und Quizfragen aus der KI. Kaputtes fliegt raus.
export function lernstoffPruefen(obj) {
  const karten = [], fragen = [];
  if (obj && Array.isArray(obj.karten)) {
    for (const k of obj.karten) {
      const v = kurz(k && (k.vorne || k.begriff || k.frage), 160), h = kurz(k && (k.hinten || k.erklaerung || k.antwort), 400);
      if (v && h && v.toLowerCase() !== h.toLowerCase() && !karten.some(x => x.vorne.toLowerCase() === v.toLowerCase())) karten.push({ vorne: v, hinten: h });
    }
  }
  if (obj && Array.isArray(obj.fragen)) {
    for (const f of obj.fragen) {
      if (!f || !Array.isArray(f.optionen)) continue;
      const frage = kurz(f.frage, 240), opt = f.optionen.map(o => kurz(o, 140)).filter(Boolean);
      let r = Number(f.richtig);
      if (typeof f.richtig === "string" && isNaN(r)) r = opt.findIndex(o => o.toLowerCase() === kurz(f.richtig, 140).toLowerCase());
      if (!frage || opt.length !== 4 || new Set(opt.map(o => o.toLowerCase())).size !== 4) continue;
      if (!Number.isInteger(r) || r < 0 || r > 3) continue;
      fragen.push({ frage, optionen: opt, richtig: r });
    }
  }
  return { karten: karten.slice(0, 12), fragen: fragen.slice(0, 8) };
}

// Schlagwörter, falls keine KI da ist (oder zum Gegenprüfen)
export const SCHLAGWOERTER = {
  Mathe: ["gleichung", "funktion", "dreieck", "bruch", "brüche", "prozent", "winkel", "fläche", "volumen", "term", "rechne", "berechne", "zahl", "geometrie", "parabel", "wurzel", "potenz", "satz des pythagoras", "kreis", "x²", "lösung"],
  Deutsch: ["gedicht", "erörterung", "inhaltsangabe", "grammatik", "satzglied", "erzähler", "kurzgeschichte", "ballade", "rechtschreibung", "kommasetzung", "novelle", "reim", "strophe", "argument"],
  Englisch: ["the ", " and ", " is ", "vocabulary", "simple past", "present perfect", "unit", "english", "irregular verbs", "you ", " are "],
  Französisch: ["le ", "la ", "les ", "est ", "nous", "vous", "français", "bonjour", "passé composé", "être", "avoir"],
  Geschichte: ["jahrhundert", "krieg", "kaiser", "könig", "revolution", "mittelalter", "antike", "römer", "weimarer", "reich", "epoche", "quelle", "pharao", "ritter", "napoleon", "v. chr", "n. chr"],
  Erdkunde: ["klima", "kontinent", "gebirge", "fluss", "breitengrad", "längengrad", "atlas", "vulkan", "plattentektonik", "bevölkerung", "landwirtschaft", "erdkunde", "geographie", "ozean"],
  Biologie: ["zelle", "pflanze", "tier", "organ", "fotosynthese", "photosynthese", "blut", "herz", "ökosystem", "bakterien", "vererbung", "dna", "nerven", "skelett"],
  Chemie: ["atom", "molekül", "reaktion", "element", "periodensystem", "säure", "base", "salz", "oxidation", "elektronen", "stoff", "gemisch"],
  Physik: ["kraft", "energie", "geschwindigkeit", "strom", "spannung", "widerstand", "newton", "joule", "watt", "optik", "linse", "magnet", "beschleunigung"],
  NWT: ["arduino", "sensor", "schaltung", "led", "experiment", "messung", "bauteil", "programm"],
  Informatik: ["algorithmus", "programm", "variable", "schleife", "python", "code", "binär", "daten", "computer"],
  Gemeinschaftskunde: ["demokratie", "wahl", "bundestag", "grundgesetz", "parlament", "partei", "regierung", "gericht", "rechte", "bürger"],
  "Religion / Ethik": ["gott", "bibel", "glaube", "religion", "ethik", "moral", "gewissen", "kirche", "islam", "judentum", "philosophie"],
  Musik: ["note", "takt", "melodie", "rhythmus", "komponist", "tonleiter", "instrument", "akkord"],
  Kunst: ["farbe", "perspektive", "künstler", "malerei", "skulptur", "zeichnung", "epoche der kunst"]
};

// Fach anhand von Schlagwörtern raten. Gibt { fach, punkte } oder null.
export function fachRaten(text, faecher) {
  const t = " " + String(text || "").toLowerCase() + " ";
  let best = null;
  for (const f of faecher) {
    const name = typeof f === "string" ? f : f.name;
    const liste = (SCHLAGWOERTER[name] || []).concat([name.toLowerCase()]);
    let punkte = 0;
    for (const w of liste) { let i = -1; while ((i = t.indexOf(w, i + 1)) >= 0) punkte++; }
    if (punkte && (!best || punkte > best.punkte)) best = { fach: name, punkte };
  }
  return best && best.punkte >= 2 ? best : null;
}

// Antwort der KI zum Sortieren prüfen: Fach muss in der Liste stehen
export function sortierungPruefen(obj, faecher) {
  const namen = faecher.map(f => typeof f === "string" ? f : f.name);
  let fach = kurz(obj && obj.fach, 60);
  const treffer = namen.find(n => n.toLowerCase() === fach.toLowerCase()) || namen.find(n => fach && n.toLowerCase().startsWith(fach.toLowerCase().slice(0, 4)));
  return { fach: treffer || "", titel: kurz(obj && obj.titel, 60).replace(/^["„]|["“]$/g, "") };
}

// Langen Text in Stücke teilen (an Satzenden), damit kleine Modelle nicht überlaufen
export function stuecke(text, max = 5000) {
  const saetze = String(text || "").split(/(?<=[.!?])\s+/);
  const out = []; let akt = "";
  for (const s of saetze) {
    if ((akt + " " + s).length > max && akt) { out.push(akt.trim()); akt = ""; }
    akt += " " + s;
    while (akt.length > max) { out.push(akt.slice(0, max).trim()); akt = akt.slice(max); }
  }
  if (akt.trim()) out.push(akt.trim());
  return out;
}

// Karteikarten OHNE KI: Zeilen wie „Begriff: Erklärung“ oder „Begriff – Erklärung“
export function kartenAusMuster(text) {
  const out = [];
  for (let zeile of String(text || "").split("\n")) {
    zeile = zeile.replace(/^\s*(?:[-•*·]|\d+[.)])\s+/, "").trim();
    const m = zeile.match(/^(.{2,80}?)\s*(?::(?=\s)|\s[–—-]\s|\s=\s|\s→\s|\s->\s)\s*(.{2,400})$/);
    if (!m) continue;
    const vorne = m[1].trim(), hinten = m[2].trim();
    if (vorne.split(/\s+/).length > 7) continue; // ganzer Satz statt Begriff
    if (/^(hausaufgabe|merke|datum|thema|seite|s\.|nr\.|aufgabe|überschrift|name|klasse)$/i.test(vorne)) continue;
    if (/\d$/.test(vorne) && /^\d/.test(hinten)) continue; // Uhrzeit wie 10: 30
    if (!out.some(k => k.vorne.toLowerCase() === vorne.toLowerCase())) out.push({ vorne, hinten });
  }
  return out.slice(0, 40);
}

// Quiz OHNE KI: richtige Erklärung + 3 Erklärungen von anderen Karten (ab 4 Karten)
export function quizAusKarten(karten, zufall = Math.random) {
  if (karten.length < 4) return [];
  const out = [];
  for (const k of karten.slice(0, 10)) {
    const andere = karten.filter(x => x !== k && x.hinten.toLowerCase() !== k.hinten.toLowerCase());
    if (andere.length < 3) continue;
    const falsch = andere.slice().sort(() => zufall() - 0.5).slice(0, 3).map(x => x.hinten);
    const richtig = Math.floor(zufall() * 4);
    const optionen = falsch.slice(); optionen.splice(richtig, 0, k.hinten);
    out.push({ frage: "Was passt zu „" + k.vorne + "“?", optionen, richtig });
  }
  return out;
}

/* ---------- Anweisungen an die KI ---------- */

export const ANWEISUNG = {
  sortieren: (faecher) => "Du sortierst Schul-Unterlagen eines Schülers. Mögliche Fächer: " + faecher.join(", ") +
    ". Lies den Text und antworte NUR mit JSON in dieser Form: {\"fach\": \"<genau ein Fach aus der Liste oder leer, wenn unklar>\", \"titel\": \"<kurze Überschrift, höchstens 6 Wörter>\"}",
  lernstoff: "Du machst aus einem Hefteintrag Lernmaterial für einen Schüler. Benutze NUR Fakten, die wirklich im Text stehen – erfinde nichts. " +
    "Antworte NUR mit JSON: {\"karten\": [{\"vorne\": \"Begriff oder kurze Frage\", \"hinten\": \"Erklärung aus dem Text\"}], " +
    "\"fragen\": [{\"frage\": \"...\", \"optionen\": [\"A\", \"B\", \"C\", \"D\"], \"richtig\": 0}]}. " +
    "Höchstens 8 Karten und 5 Fragen. Jede Frage hat genau 4 verschiedene Antworten, \"richtig\" ist die Nummer der richtigen (0 bis 3). Schreib auf Deutsch.",
  zusammenfassen: (laenge) => "Du schreibst aus der Mitschrift einer Schulstunde einen Heft-Eintrag. " +
    (laenge === "ausfuehrlich" ? "Schreib ausführlich: Überschrift, dann alle wichtigen Punkte als Stichpunkte mit kurzen Erklärungen, dann „Merke:“ mit den 2–3 wichtigsten Sätzen." :
      "Schreib kurz: Überschrift, dann die 4–8 wichtigsten Punkte als Stichpunkte, dann „Merke:“ mit einem Satz.") +
    " Nimm nur auf, was wirklich gesagt wurde. Lass Ermahnungen, Organisatorisches und Nebengespräche weg. Hausaufgaben schreibst du am Ende unter „Hausaufgabe:“. Schreib auf Deutsch, ohne Markdown-Sternchen.",
  abschreiben: "Schreib den Text auf diesem Blatt so genau wie möglich ab, auch Handschrift. Nur den Text, keine Erklärung."
};

/* ---------- Verbindung zu den Gehirnen (nur im Browser) ---------- */

function mitZeit(ms) {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

// Läuft Ollama, und welche Modelle gibt es? → { ok, modelle: [{name, bild}], fehler }
export async function ollamaPruefen() {
  try {
    const r = await fetch(OLLAMA + "/api/tags", { signal: mitZeit(2500) });
    if (!r.ok) return { ok: false, modelle: [], fehler: "antwort" };
    const j = await r.json();
    const modelle = (j.models || []).map(m => ({ name: m.name, bild: /llava|vision|gemma3|qwen2\.5vl|qwen2\.5-vl|minicpm-v|moondream|llama3\.2-vision|granite3\.2-vision/i.test(m.name) }));
    return { ok: true, modelle, fehler: modelle.length ? "" : "keine-modelle" };
  } catch (e) {
    return { ok: false, modelle: [], fehler: "nicht-erreichbar" };
  }
}

// Wählt ein gutes Modell aus der Liste
export function modellWaehlen(modelle, wunsch) {
  if (wunsch && modelle.some(m => m.name === wunsch)) return wunsch;
  const vorlieben = [/gemma3:4b/, /gemma3/, /qwen2\.5:7b/, /qwen3/, /qwen2\.5/, /llama3\.2/, /gemma2/, /mistral/, /phi/];
  for (const v of vorlieben) { const m = modelle.find(x => v.test(x.name)); if (m) return m.name; }
  return modelle[0] ? modelle[0].name : "";
}

let aoris = null, aorisLaden = null;
async function aorisStarten(fortschritt) {
  if (aoris) return aoris;
  if (!aorisLaden) aorisLaden = (async () => {
    const motor = await import("../ki/motor.js");
    const g = await motor.geraetPruefen();
    const id = motor.empfehlung(g);
    if (!id) throw new Error("Dieses Gerät kann keine Browser-KI ausführen.");
    aoris = await motor.starten(id, g, fortschritt);
    return aoris;
  })().catch(e => { aorisLaden = null; throw e; });
  return aorisLaden;
}

// Läuft die Browser-KI schon (ohne etwas laden zu müssen)?
export const aorisBereit = () => !!aoris;

// „KI jetzt einrichten“: lädt einmal alles, damit es später sofort geht
export async function einrichten(einst, fortschritt) {
  if (einst.art === "aus") return { weg: "", text: "Die KI ist ausgeschaltet." };
  if (einst.art !== "aoris") {
    const o = await ollamaPruefen();
    if (o.ok && o.modelle.length) return { weg: "ollama", text: "Ollama läuft schon – hier muss nichts geladen werden." };
    if (einst.art === "ollama") throw new Error("ollama-fehlt");
  }
  const m = await aorisStarten(fortschritt);
  return { weg: "aoris", text: m.name + " ist bereit." };
}

// Ist überhaupt eine KI möglich? → "ollama" | "aoris" | ""
export async function verfuegbar(einst) {
  const art = (einst && einst.art) || "auto";
  if (art === "aus") return "";
  if (art === "ollama" || art === "auto") { const o = await ollamaPruefen(); if (o.ok && o.modelle.length) return "ollama"; if (art === "ollama") return ""; }
  if (typeof navigator !== "undefined" && ("gpu" in navigator || typeof LanguageModel !== "undefined")) return "aoris";
  return "";
}

// Fragt die KI. { system, text, json, bild (Blob) } → Antwort-Text
export async function fragen(einst, { system, text, json = false, bild = null }, fortschritt) {
  const weg = await verfuegbar(einst);
  if (!weg) throw new Error("keine-ki");
  if (weg === "ollama") {
    const o = await ollamaPruefen();
    const nachricht = { role: "user", content: text };
    let modell = modellWaehlen(o.modelle, einst.ollamaModell);
    if (bild) {
      const bm = o.modelle.find(m => m.name === einst.bildModell) || o.modelle.find(m => m.bild);
      if (!bm) throw new Error("kein-bildmodell");
      modell = bm.name;
      nachricht.images = [await alsBase64(bild)];
    }
    const r = await fetch(OLLAMA + "/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: modell, stream: false, format: json ? "json" : undefined, options: { temperature: 0.2 },
        messages: [{ role: "system", content: system }, nachricht] })
    });
    if (!r.ok) throw new Error("ollama-fehler");
    const j = await r.json();
    return (j.message && j.message.content) || "";
  }
  if (bild) throw new Error("kein-bildmodell");
  const m = await aorisStarten(fortschritt);
  let out = "";
  await m.neu();
  for await (const teil of m.antworte([{ role: "system", content: system }, { role: "user", content: text }])) out += teil;
  return out;
}

function alsBase64(blob) {
  return new Promise((ok, nein) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1]);
    r.onerror = () => nein(r.error);
    r.readAsDataURL(blob);
  });
}

/* ---------- Fertige Aufgaben ---------- */

export async function sortieren(einst, text, faecher) {
  const namen = faecher.map(f => f.name || f);
  try {
    // Im Hintergrund nie heimlich ein großes Browser-Modell herunterladen: nur Ollama oder eine schon gestartete Browser-KI
    const weg = await verfuegbar(einst);
    if (weg !== "ollama" && !aoris) throw new Error("nicht-im-hintergrund");
    const a = await fragen(einst, { system: ANWEISUNG.sortieren(namen), text: kurz(text, 3000), json: true });
    const r = sortierungPruefen(jsonAusText(a), faecher);
    if (r.fach || r.titel) return Object.assign(r, { wer: "ki" });
  } catch (e) { /* ohne KI: Schlagwörter */ }
  const g = fachRaten(text, faecher);
  return { fach: g ? g.fach : "", titel: "", wer: "schlagwort" };
}

export async function lernstoff(einst, text, fortschritt) {
  const a = await fragen(einst, { system: ANWEISUNG.lernstoff, text: kurz(text, 6000), json: true }, fortschritt);
  return lernstoffPruefen(jsonAusText(a));
}

export async function zusammenfassen(einst, text, laenge, fortschritt) {
  const teile = stuecke(text, 5000), out = [];
  for (let i = 0; i < teile.length; i++) {
    fortschritt && fortschritt(i / teile.length, "Zusammenfassung " + (i + 1) + " von " + teile.length + " …");
    out.push(await fragen(einst, { system: ANWEISUNG.zusammenfassen(laenge), text: teile[i] }));
  }
  return out.join("\n\n").replace(/\*\*/g, "").replace(/^#+\s*/gm, "").trim();
}

// Bild (Handschrift, Foto) lesen: Ollama mit Bild-Modell oder Gemini Nano in Chrome (kann Bilder ansehen)
export async function bildLesen(einst, blob) {
  if (!einst || einst.art === "aus") throw new Error("keine-ki");
  if (einst.art !== "aoris") {
    const o = await ollamaPruefen();
    if (o.ok && o.modelle.some(m => m.bild)) return abschreiben(einst, blob);
  }
  if (typeof LanguageModel !== "undefined") {
    const opt = { expectedInputs: [{ type: "image" }, { type: "text", languages: ["de"] }], expectedOutputs: [{ type: "text", languages: ["de"] }] };
    const verfuegbar = await LanguageModel.availability(opt).catch(() => "unavailable");
    if (verfuegbar !== "unavailable") {
      const s = await LanguageModel.create(opt);
      try { return await s.prompt([{ role: "user", content: [{ type: "text", value: ANWEISUNG.abschreiben }, { type: "image", value: blob }] }]); }
      finally { try { s.destroy(); } catch (e) {} }
    }
  }
  throw new Error("kein-bildmodell");
}

export async function abschreiben(einst, bild) {
  return fragen(einst, { system: ANWEISUNG.abschreiben, text: "Bitte abschreiben.", bild });
}
