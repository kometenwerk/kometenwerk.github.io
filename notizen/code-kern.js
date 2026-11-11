// FIDELIA Notizen · Arduino-Code: Wissen, Farben und eine eigene Prüfung mit Erklärungen auf Deutsch.
// Das ist NICHT der echte Übersetzer (der steckt im PC-Programm), sondern findet die typischen Anfänger-Fehler.
// Ohne Browser – wird mit node getestet.

/* ---------- Was der Editor kennt ---------- */
// name: [Aufbau, Erklärung]
export const WISSEN = {
  pinMode: ["pinMode(pin, OUTPUT | INPUT | INPUT_PULLUP)", "Sagt dem Arduino, ob ein Pin etwas ausgibt (LED, Summer) oder einliest (Taster). Gehört in setup()."],
  digitalWrite: ["digitalWrite(pin, HIGH | LOW)", "Schaltet einen Pin an (HIGH = 5 V) oder aus (LOW = 0 V)."],
  digitalRead: ["digitalRead(pin)", "Liest einen Pin: HIGH oder LOW. Mit INPUT_PULLUP ist ein gedrückter Taster LOW."],
  analogRead: ["analogRead(A0 … A5)", "Misst eine Spannung an A0–A5 und gibt 0 … 1023 zurück (z. B. Drehregler, Lichtsensor)."],
  analogWrite: ["analogWrite(pin, 0 … 255)", "Dimmt eine LED oder regelt einen Motor (nur an Pins mit ~: 3, 5, 6, 9, 10, 11)."],
  delay: ["delay(ms)", "Wartet so viele Millisekunden. 1000 ms = 1 Sekunde. Während delay macht der Arduino nichts anderes."],
  delayMicroseconds: ["delayMicroseconds(µs)", "Wartet Mikrosekunden (1000 µs = 1 ms)."],
  millis: ["millis()", "Millisekunden seit dem Start. Gut, um Zeit zu messen, ohne zu warten: unsigned long start = millis();"],
  micros: ["micros()", "Mikrosekunden seit dem Start – noch genauer als millis()."],
  random: ["random(von, bis)", "Zufallszahl von „von“ bis „bis − 1“. random(1, 7) ergibt 1 … 6."],
  randomSeed: ["randomSeed(analogRead(A0))", "Macht den Zufall wirklich zufällig. Einmal in setup(), an einem freien Pin."],
  map: ["map(wert, vonMin, vonMax, nachMin, nachMax)", "Rechnet einen Wert in einen anderen Bereich um, z. B. 0…1023 → 0…180."],
  constrain: ["constrain(wert, min, max)", "Hält einen Wert zwischen min und max."],
  min: ["min(a, b)", "Die kleinere Zahl."], max: ["max(a, b)", "Die größere Zahl."], abs: ["abs(x)", "Betrag: −5 wird 5."],
  tone: ["tone(pin, frequenz, dauer)", "Spielt einen Ton auf dem Summer. 440 = Kammerton A. Dauer in ms (optional)."],
  noTone: ["noTone(pin)", "Schaltet den Ton aus."],
  pulseIn: ["pulseIn(pin, HIGH)", "Misst, wie lange ein Pin HIGH ist (z. B. Ultraschall-Sensor)."],
  attachInterrupt: ["attachInterrupt(digitalPinToInterrupt(2), funktion, FALLING)", "Ruft eine Funktion sofort auf, wenn sich Pin 2 oder 3 ändert."],
  digitalPinToInterrupt: ["digitalPinToInterrupt(pin)", "Wandelt Pin 2/3 in die Interrupt-Nummer um."],
  "Serial.begin": ["Serial.begin(9600)", "Startet die Verbindung zum Computer. Die Zahl (Baud) muss im Seriellen Monitor gleich sein."],
  "Serial.print": ["Serial.print(wert)", "Schreibt etwas in den Seriellen Monitor – ohne neue Zeile."],
  "Serial.println": ["Serial.println(wert)", "Schreibt etwas in den Seriellen Monitor und macht danach eine neue Zeile."],
  "Serial.available": ["Serial.available()", "Wie viele Zeichen vom Computer angekommen sind."],
  "Serial.read": ["Serial.read()", "Liest ein Zeichen, das vom Computer geschickt wurde."],
  "Serial.parseInt": ["Serial.parseInt()", "Liest eine Zahl, die vom Computer geschickt wurde."],
  "Serial.readStringUntil": ["Serial.readStringUntil('\\n')", "Liest Text bis zum Zeilenende."],
  "Serial.write": ["Serial.write(byte)", "Schickt ein einzelnes Byte."],
  "Serial.flush": ["Serial.flush()", "Wartet, bis alles verschickt ist."]
};
export const KONSTANTEN = { HIGH: "an (5 V)", LOW: "aus (0 V)", INPUT: "Eingang", OUTPUT: "Ausgang", INPUT_PULLUP: "Eingang mit eingebautem Widerstand – Taster einfach nach GND", LED_BUILTIN: "die kleine LED auf dem Board (Pin 13)", true: "wahr", false: "falsch", A0: "Analog-Pin 0", A1: "Analog-Pin 1", A2: "Analog-Pin 2", A3: "Analog-Pin 3", A4: "Analog-Pin 4 (SDA)", A5: "Analog-Pin 5 (SCL)", RISING: "steigende Flanke", FALLING: "fallende Flanke", CHANGE: "jede Änderung", PI: "π ≈ 3,14159" };
export const TYPEN = ["void", "int", "long", "unsigned", "float", "double", "bool", "boolean", "byte", "char", "word", "short", "String", "const", "static", "volatile", "uint8_t", "uint16_t", "uint32_t", "int8_t", "int16_t", "int32_t", "size_t", "auto"];
export const SCHLUESSEL = ["if", "else", "for", "while", "do", "switch", "case", "default", "break", "continue", "return", "goto", "sizeof", "struct", "class", "new", "delete", "public", "private", "enum", "typedef"];
const ALLE_NAMEN = [...Object.keys(WISSEN), ...Object.keys(KONSTANTEN), ...TYPEN, ...SCHLUESSEL, "setup", "loop"];

/* ---------- Zerlegen (für Farben und Prüfung) ---------- */
// Teile: { t: "kommentar"|"text"|"zeichen"|"zahl"|"wort"|"vor"|"sym"|"leer", v, z (Zeile, ab 1) }
export function zerlegen(code) {
  const out = []; let i = 0, z = 1; const s = String(code);
  const push = (t, v) => { out.push({ t, v, z }); z += (v.match(/\n/g) || []).length; };
  while (i < s.length) {
    const c = s[i], r = s.slice(i);
    let m;
    if (r.startsWith("//")) { const e = s.indexOf("\n", i); const v = e < 0 ? r : s.slice(i, e); push("kommentar", v); i += v.length; continue; }
    if (r.startsWith("/*")) { const e = s.indexOf("*/", i + 2); const v = e < 0 ? r : s.slice(i, e + 2); push("kommentar", v); i += v.length; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < s.length && s[j] !== c && s[j] !== "\n") { if (s[j] === "\\") j++; j++; } const v = s.slice(i, Math.min(s.length, j + 1)); push(c === '"' ? "text" : "zeichen", v); i += v.length; continue; }
    if (c === "#" && (i === 0 || s[i - 1] === "\n" || /^\s*$/.test(s.slice(s.lastIndexOf("\n", i - 1) + 1, i)))) { const e = s.indexOf("\n", i); const v = e < 0 ? r : s.slice(i, e); push("vor", v); i += v.length; continue; }
    if ((m = /^(?:0x[0-9a-fA-F]+|0b[01]+|\d+\.?\d*(?:[eE][+-]?\d+)?)[uUlLfF]*/.exec(r))) { push("zahl", m[0]); i += m[0].length; continue; }
    if ((m = /^[A-Za-z_ÄÖÜäöüß][\wÄÖÜäöüß]*/.exec(r))) { push("wort", m[0]); i += m[0].length; continue; }
    if ((m = /^\s+/.exec(r))) { push("leer", m[0]); i += m[0].length; continue; }
    if ((m = /^(?:==|!=|<=|>=|&&|\|\||\+\+|--|\+=|-=|\*=|\/=|<<|>>|->|::)/.exec(r))) { push("sym", m[0]); i += 2; continue; }
    push("sym", c); i++;
  }
  return out;
}

const escH = (t) => String(t).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
// Farbiges HTML für den Editor (gleiche Länge wie der Text, damit es genau unter der Eingabe liegt)
export function faerben(code) {
  return zerlegen(code).map(x => {
    if (x.t === "leer") return escH(x.v);
    if (x.t === "wort") {
      const k = TYPEN.includes(x.v) ? "c-typ" : SCHLUESSEL.includes(x.v) ? "c-schl" : x.v in KONSTANTEN ? "c-konst" : (x.v in WISSEN || x.v === "setup" || x.v === "loop" || x.v === "Serial") ? "c-fn" : "";
      return k ? '<span class="' + k + '">' + escH(x.v) + "</span>" : escH(x.v);
    }
    return '<span class="c-' + x.t + '">' + escH(x.v) + "</span>";
  }).join("");
}

/* ---------- Vorschläge beim Tippen ---------- */
export function vorschlaege(praefix, code = "") {
  const p = String(praefix || ""); if (p.length < 2) return [];
  const eigene = [...new Set([...String(code).matchAll(/\b(?:int|long|float|bool|byte|char|String|void|double|unsigned long|const int)\s+([A-Za-z_]\w*)/g)].map(m => m[1]))];
  const namen = [...new Set([...Object.keys(WISSEN), ...Object.keys(KONSTANTEN), ...TYPEN, ...SCHLUESSEL, ...eigene])];
  const k = p.toLowerCase();
  return namen.filter(n => n.toLowerCase().startsWith(k) && n !== p).sort((a, b) => a.length - b.length).slice(0, 8)
    .map(n => ({ name: n, aufbau: WISSEN[n] ? WISSEN[n][0] : "", info: WISSEN[n] ? WISSEN[n][1] : KONSTANTEN[n] || (eigene.includes(n) ? "deine Variable/Funktion" : "") }));
}
// Erklärung zum Wort an der Stelle (für die Hilfe-Zeile)
export function erklaeren(wort) {
  if (!wort) return null;
  if (WISSEN[wort]) return { aufbau: WISSEN[wort][0], info: WISSEN[wort][1] };
  if (KONSTANTEN[wort]) return { aufbau: wort, info: KONSTANTEN[wort] };
  if (wort === "setup") return { aufbau: "void setup() { … }", info: "Läuft einmal beim Start: Pins einstellen, Serial starten." };
  if (wort === "loop") return { aufbau: "void loop() { … }", info: "Läuft danach immer wieder, ohne Ende." };
  const t = { if: "if (bedingung) { … } – macht etwas nur, wenn die Bedingung stimmt.", else: "else { … } – sonst.", for: "for (int i = 0; i < 10; i++) { … } – wiederholt etwas mehrmals.", while: "while (bedingung) { … } – wiederholt, solange die Bedingung stimmt.", int: "int – ganze Zahl (−32768 … 32767).", long: "long – große ganze Zahl.", float: "float – Kommazahl (mit Punkt: 3.14).", bool: "bool – true oder false.", unsigned: "unsigned – nur positive Zahlen, z. B. unsigned long für millis().", const: "const – Wert, der sich nie ändert, z. B. const int LED = 8;", void: "void – die Funktion gibt nichts zurück.", return: "return – Funktion beenden (und einen Wert zurückgeben)." };
  return t[wort] ? { aufbau: wort, info: t[wort] } : null;
}

/* ---------- Prüfen ---------- */
function abstand(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function aehnlich(name, liste) {
  let best = null, bd = 99;
  for (const n of liste) { const d = abstand(name, n); if (d < bd) { bd = d; best = n; } }
  return bd <= Math.max(2, Math.floor(name.length / 3)) ? best : null;
}

// → [{ z (Zeile), art: "fehler"|"hinweis", text, tipp }]
export function pruefen(code) {
  const teile = zerlegen(code), out = [];
  const dazu = (z, art, text, tipp = "") => { if (!out.some(o => o.z === z && o.text === text)) out.push({ z, art, text, tipp }); };
  const bed = teile.filter(x => x.t !== "leer" && x.t !== "kommentar");
  // Block-Kommentare für die Zeilen-Prüfung leeren (Zeilen bleiben erhalten)
  const zeilen = String(code).replace(/\/\*[\s\S]*?(\*\/|$)/g, m => m.replace(/[^\n]/g, " ")).split("\n");

  // eigene Namen: Funktionen, Variablen, Objekte (z. B. LiquidCrystal_I2C lcd(…))
  const eigeneFn = new Set(), eigeneVar = new Set(), objekte = new Set();
  for (let i = 0; i < bed.length - 2; i++) {
    const a = bed[i], b = bed[i + 1], c = bed[i + 2];
    if (a.t === "wort" && b.t === "wort" && !SCHLUESSEL.includes(b.v)) {
      if (c.v === "(" && TYPEN.includes(a.v)) eigeneFn.add(b.v);
      else if (TYPEN.includes(a.v)) eigeneVar.add(b.v);
      else if (/^[A-Z]/.test(a.v) && !(a.v in KONSTANTEN)) objekte.add(b.v);          // Klasse objekt
    }
    if (a.t === "wort" && TYPEN.includes(a.v) && b.v === "*" && c.t === "wort") eigeneVar.add(c.v);
  }
  for (let i = 0; i < bed.length - 1; i++) if (bed[i].v === "," && bed[i + 1].t === "wort") { const v = bed[i + 2]; if (v && v.t === "wort" && TYPEN.includes(bed[i + 1].v)) eigeneVar.add(v.v); }
  for (const z of zeilen) { const m = /^\s*#define\s+(\w+)/.exec(z); if (m) eigeneVar.add(m[1]); }
  const bibliothek = /#include\s*[<"](?!Arduino)/.test(code);

  // 1) Klammern
  const stapel = [];
  for (const x of bed) {
    if ("({[".includes(x.v) && x.t === "sym") stapel.push(x);
    else if (")}]".includes(x.v) && x.t === "sym") {
      const auf = stapel.pop(), passt = { ")": "(", "}": "{", "]": "[" }[x.v];
      if (!auf) dazu(x.z, "fehler", "Hier ist eine „" + x.v + "“ zu viel.", "Zu jeder schließenden Klammer gehört eine öffnende.");
      else if (auf.v !== passt) dazu(x.z, "fehler", "„" + x.v + "“ passt nicht zu „" + auf.v + "“ aus Zeile " + auf.z + ".", "Klammern müssen in der richtigen Reihenfolge zugehen.");
    }
  }
  for (const a of stapel) dazu(a.z, "fehler", "Die „" + a.v + "“ wird nie geschlossen.", a.v === "{" ? "Am Ende fehlt eine „}“." : "Es fehlt eine „" + { "(": ")", "[": "]" }[a.v] + "“.");

  // 2) Wörter: Groß/klein, unbekannte Befehle, Tippfehler
  const bekannteFn = new Set([...Object.keys(WISSEN).filter(n => !n.includes(".")), ...eigeneFn, "setup", "loop", "sizeof", "bitRead", "bitWrite", "bitSet", "bitClear", "highByte", "lowByte", "sqrt", "pow", "sin", "cos", "tan", "round", "floor", "ceil", "isDigit", "isAlpha", "String", "int", "float", "long", "byte", "char", "word", "shiftOut", "shiftIn", "yield", "interrupts", "noInterrupts", "F", "sprintf", "snprintf", "strlen", "strcmp", "memset", "memcpy", "dtostrf", "atoi", "itoa", "detachInterrupt", "if", "while", "for", "switch", "return"]);
  for (let i = 0; i < bed.length; i++) {
    const x = bed[i], vor = bed[i - 1], nach = bed[i + 1];
    if (x.t !== "wort") continue;
    // HIGH/LOW/OUTPUT … falsch geschrieben
    const gross = Object.keys(KONSTANTEN).find(k => k !== x.v && k.toLowerCase() === x.v.toLowerCase());
    if (gross && !eigeneVar.has(x.v)) { dazu(x.z, "fehler", "„" + x.v + "“ muss „" + gross + "“ heißen.", "Groß- und Kleinschreibung zählt beim Arduino."); continue; }
    if (vor && vor.v === ".") {                                    // Methode: Serial.xxx / lcd.xxx
      const obj = bed[i - 2];
      if (obj && obj.v === "Serial") {
        const ganz = "Serial." + x.v;
        if (!WISSEN[ganz] && !["setTimeout", "readString", "readBytes", "find", "peek", "end", "availableForWrite", "parseFloat"].includes(x.v)) {
          const arg = bed[i + 2];
          const t = arg && arg.t === "zahl" && /^(300|1200|2400|4800|9600|19200|38400|57600|115200)$/.test(arg.v) ? "Serial.begin" : aehnlich(ganz, Object.keys(WISSEN).filter(n => n.startsWith("Serial.")));
          dazu(x.z, "fehler", "„" + ganz + "“ gibt es nicht.", t ? "Meintest du „" + t + "“?" : "");
        }
      }
      continue;
    }
    if (nach && nach.v === "(" && !bekannteFn.has(x.v) && !objekte.has(x.v) && !eigeneVar.has(x.v) && !TYPEN.includes(x.v) && !(vor && (TYPEN.includes(vor.v) || /^[A-Z]/.test(vor.v) && vor.t === "wort"))) {
      const gleich = [...bekannteFn].find(n => n.toLowerCase() === x.v.toLowerCase());
      const t = gleich || aehnlich(x.v, [...bekannteFn].filter(n => n.length > 2));
      if (gleich) dazu(x.z, "fehler", "„" + x.v + "“ muss „" + gleich + "“ heißen.", "Groß- und Kleinschreibung zählt.");
      else if (t || !bibliothek) dazu(x.z, bibliothek ? "hinweis" : "fehler", "Den Befehl „" + x.v + "“ kenne ich nicht.", t ? "Meintest du „" + t + "“?" + (WISSEN[t] ? " " + WISSEN[t][0] : "") : "Wenn er aus einer Bibliothek kommt, binde sie oben mit #include ein.");
    }
    // int = x  (Name fehlt)
    if (TYPEN.includes(x.v) && nach && nach.v === "=" ) dazu(x.z, "fehler", "Nach „" + x.v + "“ fehlt der Name.", "Erst der Typ, dann der Name: int x = 0;");
  }

  // 3) Zeilen: Semikolon, = statt ==, Text als Befehl, Befehl ohne Wirkung
  let tiefeKlammer = 0;
  zeilen.forEach((roh, n) => {
    const z = n + 1;
    const ohne = roh.replace(/\/\/.*$/, "").replace(/"(?:\\.|[^"\\])*"/g, '""').trim();
    if (!ohne || ohne.startsWith("#") || ohne.startsWith("/*") || ohne.startsWith("*")) return;
    // if (a = b)
    const iff = /\b(?:if|while)\s*\(/.exec(ohne);
    let bedingung = null;
    if (iff) { let t = 0, j = iff.index + iff[0].length - 1, k = j; for (; k < ohne.length; k++) { if (ohne[k] === "(") t++; else if (ohne[k] === ")") { t--; if (!t) break; } } bedingung = ohne.slice(j + 1, k); }
    if (bedingung && /(^|[^=!<>])=([^=]|$)/.test(bedingung)) dazu(z, "fehler", "In der Bedingung steht „=“.", "„=“ speichert, „==“ vergleicht: if (x == 1)");
    // Text in Anführungszeichen, der kein Argument ist
    const echt = roh.replace(/\/\/.*$/, "");
    if (/(^|[;)}{]\s*)"[^"]*"\s*(\{|$|[A-Za-z])/.test(echt.trim()) || /\)\s*"[^"]*"/.test(echt)) dazu(z, "fehler", "Text in Anführungszeichen ist kein Befehl.", "Notizen schreibst du mit // davor. Text gehört nur in Klammern, z. B. Serial.println(\"Hallo\");");
    // fehlendes Semikolon
    const offen = (ohne.match(/\(/g) || []).length - (ohne.match(/\)/g) || []).length;
    tiefeKlammer += offen;
    const naechste = (zeilen.slice(n + 1).find(l => l.replace(/\/\/.*$/, "").trim()) || "").replace(/\/\/.*$/, "").trim();
    const kopf = /^(?:\}\s*)?(?:if|else|for|while|switch|do)\b/.test(ohne) || /^[\w<>\s\*&:,]+\s+\**\w+\s*\([^;]*\)\s*(const)?\s*$/.test(ohne) && /^\{/.test(naechste);
    const fnKopf = /^(?:[A-Za-z_][\w<>]*\s+)+\**[A-Za-z_]\w*\s*\([^;]*\)\s*\{?$/.test(ohne) && !/^(?:return|else)\b/.test(ohne) && TYPEN.some(t => ohne.startsWith(t + " "));
    if (tiefeKlammer > 0 || kopf || fnKopf) { if (tiefeKlammer < 0) tiefeKlammer = 0; return; }
    tiefeKlammer = 0;
    if (/[;{},:]$/.test(ohne) || /^(case\b|default\b|public:|private:)/.test(ohne) || /^[{}]/.test(ohne) && ohne.length === 1) return;
    if (/^[.&|+\-*/?:]/.test(naechste) || /[&|+\-*/,=(]$/.test(ohne)) return;
    if (/[\w)\]"'+\-]$/.test(ohne)) dazu(z, "fehler", "Am Ende der Zeile fehlt ein „;“.", "Jeder Befehl endet mit einem Semikolon.");
  });

  // 4) Aufrufe genauer anschauen
  const aufrufe = [...String(code).replace(/\/\/.*$/gm, "").matchAll(/\b(digitalWrite|digitalRead|pinMode|analogRead|analogWrite|tone|delay|millis)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)];
  const zeileVon = (idx) => String(code).slice(0, idx).split("\n").length;
  const mitPinMode = new Set();
  for (const a of aufrufe) if (a[1] === "pinMode") mitPinMode.add(a[2].split(",")[0].trim());
  const parameter = new Set([...String(code).matchAll(/\w+\s*\(([^()]*)\)\s*\{/g)].flatMap(m => m[1].split(",").map(p => (p.trim().split(/\s+/).pop() || "").replace(/[*&]/g, ""))));
  const pinModeMitVariable = [...mitPinMode].some(p => /[\[\]]/.test(p) || !/^(\d+|[A-Z_][A-Z0-9_]*)$/.test(p));
  for (const a of aufrufe) {
    const args = a[2].trim() ? a[2].split(",").map(x => x.trim()) : [], z = zeileVon(a.index);
    const soll = { digitalWrite: 2, pinMode: 2, analogWrite: 2, digitalRead: 1, analogRead: 1, delay: 1, millis: 0 }[a[1]];
    if (soll != null && args.length !== soll) dazu(z, "fehler", a[1] + " braucht " + (soll === 0 ? "nichts" : soll === 1 ? "eine Angabe" : soll + " Angaben") + " in den Klammern.", WISSEN[a[1]] ? WISSEN[a[1]][0] : "");
    if (a[1] === "analogRead" && args[0] && /^\d+$/.test(args[0]) && Number(args[0]) > 5) dazu(z, "fehler", "analogRead geht nur an A0 … A5.", "Für Taster und andere An/Aus-Sachen nimm digitalRead(" + args[0] + ").");
    if ((a[1] === "digitalWrite" || a[1] === "digitalRead") && args[0] && !mitPinMode.has(args[0]) && !/LED_BUILTIN/.test(args[0]) && /^(\d+|[A-Za-z_]\w*)$/.test(args[0]) && !parameter.has(args[0]) && !(pinModeMitVariable && !/^\d+$/.test(args[0]))) dazu(z, "hinweis", "Für Pin „" + args[0] + "“ fehlt pinMode in setup().", a[1] === "digitalWrite" ? "pinMode(" + args[0] + ", OUTPUT);" : "pinMode(" + args[0] + ", INPUT_PULLUP);");
  }
  // millis() ohne Wirkung, analogRead ohne Wirkung
  zeilen.forEach((roh, n) => { const t = roh.replace(/\/\/.*$/, "").trim(); if (/^(millis|micros|analogRead|digitalRead|random)\s*\([^)]*\)\s*;?$/.test(t)) dazu(n + 1, "hinweis", "Diese Zeile macht allein nichts.", "Merk dir das Ergebnis: int wert = " + t.replace(/;$/, "") + ";"); });

  // 5) setup und loop
  if (!/\bvoid\s+setup\s*\(\s*\)/.test(code)) dazu(1, "fehler", "Es fehlt „void setup()“.", "Jedes Arduino-Programm braucht setup() und loop().");
  if (!/\bvoid\s+loop\s*\(\s*\)/.test(code)) dazu(1, "fehler", "Es fehlt „void loop()“.", "Jedes Arduino-Programm braucht setup() und loop().");

  return out.sort((a, b) => a.z - b.z || (a.art === "fehler" ? -1 : 1));
}

/* ---------- Vorlagen ---------- */
export const LEER = "void setup() {\n  // läuft einmal beim Start\n\n}\n\nvoid loop() {\n  // läuft immer wieder\n\n}\n";
export const BEISPIELE = [
  ["Leer", LEER],
  ["Grundgerüst mit Serial", "void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  \n}\n"],
  ["Taster lesen", "const int TASTER = 2;\n\nvoid setup() {\n  pinMode(TASTER, INPUT_PULLUP);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  if (digitalRead(TASTER) == LOW) {\n    // gedrückt\n  }\n}\n"],
  ["Zeit messen ohne delay", "unsigned long letzteZeit = 0;\n\nvoid setup() {\n\n}\n\nvoid loop() {\n  if (millis() - letzteZeit >= 1000) {\n    letzteZeit = millis();\n    // passiert jede Sekunde\n  }\n}\n"]
];
// Link fürs PC-Programm: kometenwerk-code://oeffnen?name=…&code=… (Base64, URL-sicher)
export function pcLink(name, code) {
  const b = typeof btoa === "function" ? btoa(unescape(encodeURIComponent(code))) : Buffer.from(code, "utf8").toString("base64");
  return "kometenwerk-code://oeffnen?name=" + encodeURIComponent(name) + "&code=" + b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export const dateiName = (titel) => (String(titel || "sketch").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss").replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "") || "sketch").slice(0, 40);
