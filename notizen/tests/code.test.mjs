// Tests für die Arduino-Code-Prüfung: node notizen/tests/code.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import * as C from "../code-kern.js";
let ok = 0;
function test(n, f) { f(); ok++; console.log("✓ " + n); }
const fehler = (c) => C.pruefen(c).filter(p => p.art === "fehler");
test("Richtiger Code hat keine Fehler", () => {
  const c = `#include <Wire.h>
const int LED = 8;   // rote LED
int zaehler = 0;
unsigned long start;
/* mehrere
   Zeilen Kommentar ohne ; */
int doppelt(int x) {
  return x * 2;
}
void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}
void loop() {
  if (digitalRead(2) == LOW && zaehler < 10) { zaehler = zaehler + 1; }
  else if (zaehler >= 10) {
    zaehler = 0;
  } else {
    digitalWrite(LED, HIGH);
  }
  for (int i = 0; i < 3; i++) {
    tone(6, 440 + i * 100,
         200);
  }
  switch (zaehler) {
    case 1: delay(10); break;
    default: break;
  }
  int w = map(analogRead(A0), 0, 1023, 0, 180);
  Serial.println(doppelt(w));
}`;
  assert.deepEqual(fehler(c), []);
});
test("Typische Anfänger-Fehler werden gefunden und erklärt", () => {
  const c = fs.readFileSync(new URL("./daten/nutzer.ino", import.meta.url), "utf8"), p = C.pruefen(c), t = (z) => p.filter(x => x.z === z).map(x => x.text + " " + x.tipp).join(" | ");
  assert.match(t(1), /fehlt der Name/);
  assert.match(t(6), /Serial\.begin/);
  assert.match(t(7), /randomSeed/);
  assert.match(t(11), /analogRead geht nur an A0/); assert.match(t(11), /Anführungszeichen/);
  assert.match(t(15), /==/);
  assert.match(t(16), /2 Angaben/);
  assert.match(t(18), /LOW/);
  assert.ok(p.some(x => /nie geschlossen/.test(x.text)));
  assert.ok(p.some(x => /fehlt ein „;“/.test(x.text) && x.z === 21));
});
test("setup/loop fehlt, Groß-/Kleinschreibung", () => {
  assert.ok(fehler("int x = 1;").some(p => /setup/.test(p.text)));
  assert.ok(fehler("void setup() { DigitalWrite(8, HIGH); }\nvoid loop() {}").some(p => /digitalWrite/.test(p.text)));
});
test("Vorschläge und Erklärungen", () => {
  assert.equal(C.vorschlaege("digitalW")[0].name, "digitalWrite");
  assert.ok(C.vorschlaege("zae", "int zaehler = 0;").some(v => v.name === "zaehler"));
  assert.match(C.erklaeren("millis").info, /Millisekunden/);
  assert.ok(C.faerben("int x = 5; // hi").includes('class="c-kommentar"'));
  assert.equal(C.dateiName("Reaktionstester für NWT!"), "Reaktionstester_fur_NWT");
});
console.log(ok + " Tests bestanden.");
