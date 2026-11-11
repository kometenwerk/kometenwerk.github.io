// Tests: Übersetzer-Meldungen auf Deutsch – node tests/fehler.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import * as U from "../src/uebersetzer.js";
let ok = 0; const test = (n, f) => { f(); ok++; console.log("✓ " + n); };
test("gcc-Fehler werden erklärt", () => {
  const code = "#include <LiquidCrystal_I2C.h>\nint x = 0;\nvoid setup() {\n  Serial.brind(9600);\n  pinMode(8, OUTPUT)\n}\nvoid loop() {\n  digitalWrite(8, HIG);\n  if (x = 1) { delay(10); }\n}\n";
  const r = U.lesen(fs.readFileSync(new URL("./gcc-ausgabe.txt", import.meta.url), "utf8"), "", code);
  const z = (n) => r.meldungen.find(m => m.z === n);
  assert.match(z(4).text, /brind/); assert.match(z(4).tipp, /Serial\.begin/);
  assert.match(z(6).text, /fehlt ein „;“/);
  assert.match(z(8).tipp, /HIGH/);
  assert.equal(z(9).art, "hinweis"); assert.match(z(9).tipp, /==/);
  assert.equal(r.bibliothek, "Adafruit SSD1306");
});
test("Größe lesen", () => {
  const r = U.lesen(fs.readFileSync(new URL("./groesse.txt", import.meta.url), "utf8"));
  assert.deepEqual(r.groesse, { flash: 2804, flashMax: 32256, ram: 240, ramMax: 2048 });
});
test("Hochladen-Fehler", () => {
  assert.match(U.hochladenFehler("avrdude: stk500_recv(): programmer is not responding")[0], /antwortet nicht/);
  assert.match(U.hochladenFehler("can't open device \"COM3\": Access is denied.")[0], /belegt/);
  assert.equal(U.hochladenFehler("alles gut"), null);
});
console.log(ok + " Tests bestanden.");
