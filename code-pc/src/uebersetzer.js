// Kometenwerk Code · Meldungen des echten Übersetzers (avr-gcc / avrdude) auf Deutsch erklären
// Ohne Browser – wird mit node getestet.

import { WISSEN, KONSTANTEN, pruefen } from "./code-kern.js";

function abstand(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1));
  return d[a.length][b.length];
}
// eigener, besserer Vorschlag (gcc schlägt bei „brind“ z. B. „find“ vor – gemeint ist fast immer „begin“)
function besser(name, liste) { let best = null, bd = 99; for (const n of liste) { const d = abstand(name, n); if (d < bd) { bd = d; best = n; } } return bd <= Math.max(1, Math.floor(name.length / 3)) ? best : null; }
const SERIAL = Object.keys(WISSEN).filter(n => n.startsWith("Serial.")).map(n => n.slice(7));

// Bekannte Bibliotheken: Datei → Name im Bibliotheksverwalter
export const BIBLIOTHEKEN = {
  "LiquidCrystal_I2C.h": "LiquidCrystal I2C", "Adafruit_SSD1306.h": "Adafruit SSD1306", "Adafruit_GFX.h": "Adafruit GFX Library", "DHT.h": "DHT sensor library",
  "Servo.h": "Servo", "Stepper.h": "Stepper", "LiquidCrystal.h": "LiquidCrystal", "Adafruit_NeoPixel.h": "Adafruit NeoPixel", "FastLED.h": "FastLED",
  "IRremote.h": "IRremote", "IRremote.hpp": "IRremote", "NewPing.h": "NewPing", "MFRC522.h": "MFRC522", "RTClib.h": "RTClib", "OneWire.h": "OneWire",
  "DallasTemperature.h": "DallasTemperature", "Keypad.h": "Keypad", "TM1637Display.h": "TM1637", "U8g2lib.h": "U8g2", "AccelStepper.h": "AccelStepper", "Adafruit_BMP280.h": "Adafruit BMP280 Library", "MPU6050.h": "MPU6050"
};

const REGELN = [
  [/'(\w+)' does not name a type(?:; did you mean '(\w+)')?/, (m) => ["„" + m[1] + "“ steht hier an einer Stelle, wo der Arduino einen Typ (wie int) erwartet.", "Steht die Zeile außerhalb von setup() oder loop()? Anweisungen müssen zwischen die geschweiften Klammern { }. Oder ist es ein Tippfehler?"]],
  [/'(\w+)' was not declared in this scope(?:; did you mean '(\w+)')?/, (m) => { const t = besser(m[1], [...Object.keys(KONSTANTEN), ...Object.keys(WISSEN).filter(n => !n.includes("."))]) || m[2]; return ["„" + m[1] + "“ kennt der Arduino hier nicht.", t ? "Meintest du „" + t + "“?" : "Tippfehler? Oder die Variable wurde nicht oben erstellt (z. B. int " + m[1] + " = 0;)."]; }],
  [/'class (\w+)' has no member named '(\w+)'(?:; did you mean '(\w+)')?/, (m) => { const t = m[1] === "HardwareSerial" ? besser(m[2], SERIAL) || m[3] : m[3]; return ["„" + m[2] + "“ gibt es bei " + (m[1] === "HardwareSerial" ? "Serial" : m[1]) + " nicht.", t ? "Meintest du „" + (m[1] === "HardwareSerial" ? "Serial." : "") + t + "“?" : ""]; }],
  [/expected ';' before (.*)/, () => ["Hier fehlt ein „;“.", "Meistens am Ende der Zeile davor."]],
  [/expected '\)' before (.*)/, () => ["Hier fehlt eine „)“.", "Zähl die Klammern: jede ( braucht eine )."]],
  [/expected '\}' at end of input/, () => ["Am Ende fehlt eine „}“.", "Jede { braucht eine }."]],
  [/expected declaration before '\}' token/, () => ["Hier ist eine „}“ zu viel.", ""]],
  [/expected primary-expression before '(.+?)'/, (m) => ["„" + m[1] + "“ steht hier an der falschen Stelle.", "Fehlt davor etwas, oder ist ein Zeichen zu viel?"]],
  [/expected unqualified-id before (.*)/, () => ["Hier erwartet der Arduino einen Namen.", "Erst der Typ, dann der Name: int x = 0;"]],
  [/expected initializer before (.*)/, () => ["Diese Zeile ist so nicht vollständig.", "Fehlt ein „;“ oder ein „=“?"]],
  [/too few arguments to function '(.+?)'/, (m) => ["Zu wenige Angaben für „" + m[1].replace(/\(.*/, "") + "“.", ""]],
  [/too many arguments to function '(.+?)'/, (m) => ["Zu viele Angaben für „" + m[1].replace(/\(.*/, "") + "“.", ""]],
  [/lvalue required as left operand of assignment/, () => ["Links vom „=“ muss eine Variable stehen.", "Wolltest du vergleichen? Dann „==“."]],
  [/suggest parentheses around assignment used as truth value/, () => ["In der Bedingung steht „=“.", "„=“ speichert, „==“ vergleicht."]],
  [/'else' without a previous 'if'/, () => ["„else“ ohne „if“ davor.", "Oft steht hinter if (…) ein „;“ zu viel."]],
  [/missing terminating " character/, () => ["Ein Anführungszeichen wird nicht geschlossen.", "Text gehört zwischen zwei \"…\"."]],
  [/stray '\\?(\d+|.)' in program/, () => ["Hier steht ein komisches Zeichen.", "Oft aus Word kopiert (z. B. „ “ statt \"). Tipp die Zeile neu."]],
  [/redefinition of '(.+?)'/, (m) => ["„" + m[1] + "“ gibt es doppelt.", "Jeder Name darf nur einmal erstellt werden."]],
  [/conflicting declaration '(.+?)'/, (m) => ["„" + m[1] + "“ wird doppelt erstellt.", ""]],
  [/invalid conversion from '(.+?)' to '(.+?)'/, (m) => ["Der Typ passt nicht (" + m[1] + " → " + m[2] + ").", ""]],
  [/(\S+\.h): No such file or directory/, (m) => ["Die Bibliothek „" + m[1] + "“ fehlt.", BIBLIOTHEKEN[m[1]] ? "Installiere „" + BIBLIOTHEKEN[m[1]] + "“ – Knopf unten." : "Suche sie unter 📚 Bibliotheken."]],
  [/a function-definition is not allowed here/, () => ["Hier darf keine Funktion stehen.", "Wahrscheinlich fehlt davor eine „}“."]],
  [/expected '\(' before/, () => ["Hier fehlt eine „(“.", "z. B. if (x == 1)"]],
  [/(?:ISO C\+\+ forbids|declaration does not declare anything)/, () => ["Diese Zeile ist so nicht erlaubt.", ""]],
  [/unused variable '(\w+)'/, (m) => ["„" + m[1] + "“ wird nie benutzt.", "Kein Fehler – nur ein Hinweis."]],
  [/comparison (?:of integer expressions|between signed and unsigned)/, () => ["Vergleich von Zahlen mit/ohne Vorzeichen.", "Meist harmlos."]]
];

// Ausgabe von arduino-cli compile → { meldungen: [{ z, sp, art, text, tipp, roh }], groesse: {flash, flashMax, ram, ramMax}|null, bibliothek: name|null }
export function lesen(ausgabe, dateiName = "", code = "") {
  ausgabe = String(ausgabe).replace(/[‘’`´]/g, "'").replace(/\x1b\[[0-9;]*m/g, "");
  const meldungen = [], zeilen = ausgabe.split(/\r?\n/);
  const eigene = code ? pruefen(code) : [];
  let bibliothek = null;
  for (const l of zeilen) {
    const m = /^(.*?):(\d+):(?:(\d+):)?\s*(fatal error|error|warning|Fehler|Warnung):\s*(.*)$/.exec(l);
    if (!m) continue;
    if (dateiName && !m[1].endsWith(dateiName) && !/No such file/.test(m[5])) continue;     // Meldungen aus Bibliotheken auslassen
    const art = /warn/i.test(m[4]) ? "hinweis" : "fehler", roh = m[5];
    let text = roh, tipp = "";
    for (const [re, f] of REGELN) { const x = re.exec(roh); if (x) { [text, tipp] = f(x); if (re.source.includes("No such file")) bibliothek = BIBLIOTHEKEN[x[1]] || x[1].replace(/\.h$/, ""); break; } }
    // die eigene Prüfung kennt den Code und hat oft den besseren Vorschlag (z. B. Serial.begin bei 9600)
    const meins = eigene.find(e => e.z === Number(m[2]) && /Meintest du/.test(e.tipp) && /Meintest du|kennt der Arduino|gibt es bei/.test(tipp + text));
    if (meins) tipp = meins.tipp.replace(/ \S+\(.*$/, "");
    if (!meldungen.some(o => o.z === Number(m[2]) && o.text === text)) meldungen.push({ z: Number(m[2]), sp: Number(m[3] || 1), art, text, tipp, roh });
  }
  const g = /(?:Sketch uses|Der Sketch verwendet)\s+(\d+)\s+[Bb]ytes.*?(?:Maximum is|Maximum sind|Das Maximum sind)\s+(\d+)/.exec(ausgabe);
  const r = /(?:Global variables use|Globale Variablen verwenden)\s+(\d+)\s+[Bb]ytes.*?(?:Maximum is|Maximum sind|Das Maximum sind)\s+(\d+)/.exec(ausgabe);
  return { meldungen, groesse: g ? { flash: Number(g[1]), flashMax: Number(g[2]), ram: r ? Number(r[1]) : 0, ramMax: r ? Number(r[2]) : 0 } : null, bibliothek };
}

// Hochladen: typische Fehler von avrdude erklären
export function hochladenFehler(ausgabe) {
  const a = String(ausgabe);
  if (/not in sync|programmer is not responding|stk500_getsync|stk500_recv/i.test(a)) return ["Der Arduino antwortet nicht.", "Stimmen Board und Port? Beim Nano: unter Board „Nano (Old Bootloader)“ probieren. Kabel prüfen – manche USB-Kabel laden nur."];
  if (/Access is denied|Zugriff verweigert|Device or resource busy|can't open device|Permission denied/i.test(a)) return ["Der Port ist belegt.", "Ist noch ein anderer Monitor oder die Arduino IDE offen? Schließ sie und versuch es nochmal."];
  if (/No such file or directory.*(COM|tty)|could not open port|port .* not found/i.test(a)) return ["Der Port wurde nicht gefunden.", "Steck den Arduino ab und wieder an und wähle den Port neu."];
  if (/Sketch too big|zu groß/i.test(a)) return ["Das Programm ist zu groß für dieses Board.", "Weniger Text in Serial.print oder F(\"…\") benutzen."];
  if (/platform not installed|Plattform .* nicht installiert/i.test(a)) return ["Die Arduino-Werkzeuge fehlen noch.", "Klick auf „Einrichten“."];
  return null;
}
export const BOARDS = [["arduino:avr:uno", "Arduino Uno"], ["arduino:avr:nano", "Arduino Nano"], ["arduino:avr:nano:cpu=atmega328old", "Arduino Nano (Old Bootloader)"], ["arduino:avr:mega", "Arduino Mega 2560"], ["arduino:avr:leonardo", "Arduino Leonardo"], ["arduino:avr:micro", "Arduino Micro"]];
