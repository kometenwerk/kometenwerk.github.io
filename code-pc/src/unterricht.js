// Kometenwerk Code · Unterrichts-Modus
// Nur die Befehle aus dem LernBaustein „Arduino 1“ sind erlaubt. Alles andere wird markiert (nicht verboten –
// die Lehrkraft entscheidet). Eigene Variablen- und Funktionsnamen sind natürlich immer erlaubt.
import * as C from "./code-kern.js";

// aus der Bauanleitung (LernBaustein_Arduino1): genau diese Anweisungen kommen dort vor
export const GRUNDLISTE = [
  "void", "setup", "loop", "int", "long", "float",
  "if", "else", "for", "while",
  "delay", "tone", "noTone",
  "pinMode", "digitalWrite", "digitalRead", "analogWrite", "analogRead",
  "random", "randomSeed",
  "Serial.begin", "Serial.print", "Serial.println",
  "HIGH", "LOW", "OUTPUT", "INPUT", "INPUT_PULLUP", "A0", "A1", "A2", "A3", "A4", "A5"
];

// alle Namen, die „Befehle“ sind (nicht vom Schüler selbst ausgedacht)
const BEFEHLE = new Set([...Object.keys(C.WISSEN), ...Object.keys(C.KONSTANTEN), ...C.TYPEN, ...C.SCHLUESSEL, "setup", "loop",
  "lcd", "LiquidCrystal", "Servo", "Wire", "String", "sizeof", "bitRead", "bitWrite", "highByte", "lowByte", "sin", "cos", "sqrt", "pow", "interrupts", "noInterrupts", "shiftOut", "shiftIn"]);

export function erlaubteListe(extra = []) { return new Set([...GRUNDLISTE, ...extra.map(s => String(s).trim()).filter(Boolean)]); }

// ist das ein Befehl, der nicht auf der Liste steht?
export function istFremd(name, erlaubt) {
  if (erlaubt.has(name)) return false;
  if (name.startsWith("Serial.")) return true;
  return BEFEHLE.has(name);
}

// Code ohne Kommentare und Texte (gleiche Länge, damit Zeilen/Spalten stimmen)
function leeren(code) {
  return code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, (m) => m.replace(/[^\n]/g, " "));
}

// Meldungen im gleichen Format wie C.pruefen: { z, sp, art, text, tipp }
export function pruefen(code, erlaubt) {
  const roh = leeren(String(code)), aus = [], gesehen = new Set();
  const zeilen = roh.split("\n");
  zeilen.forEach((z, i) => {
    for (const m of z.matchAll(/#\s*include\s*<([^>]+)>/g)) aus.push({ z: i + 1, sp: m.index + 1, art: "hinweis", text: "Unterrichts-Modus: Bibliothek <" + m[1] + "> kam im Unterricht nicht vor.", tipp: "Frag deine Lehrkraft, ob du sie benutzen darfst." });
    for (const m of z.matchAll(/\b(Serial\s*\.\s*[A-Za-z_]\w*|[A-Za-z_]\w*)\b/g)) {
      const name = m[1].replace(/\s+/g, "");
      if (!istFremd(name, erlaubt)) continue;
      const schl = name + "@" + (i + 1);
      if (gesehen.has(schl)) continue; gesehen.add(schl);
      aus.push({ z: i + 1, sp: m.index + 1, art: "hinweis", text: "Unterrichts-Modus: „" + name + "“ steht nicht auf der Liste aus dem Unterricht.", tipp: "Benutz nur Anweisungen aus der Bauanleitung – oder frag, ob es erlaubt ist." });
    }
  });
  return aus;
}

// Zusammenfassung: welche Befehle benutzt der Code, welche davon sind fremd?
export function uebersicht(code, erlaubt) {
  const roh = leeren(String(code)), zahl = new Map();
  for (const m of roh.matchAll(/\b(Serial\s*\.\s*[A-Za-z_]\w*|[A-Za-z_]\w*)\b/g)) {
    const n = m[1].replace(/\s+/g, ""); if (!BEFEHLE.has(n) && !erlaubt.has(n) && !n.startsWith("Serial.")) continue;
    zahl.set(n, (zahl.get(n) || 0) + 1);
  }
  return [...zahl].map(([name, anzahl]) => ({ name, anzahl, ok: !istFremd(name, erlaubt) })).sort((a, b) => (a.ok - b.ok) || b.anzahl - a.anzahl);
}
