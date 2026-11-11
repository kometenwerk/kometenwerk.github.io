// Tests für Unterrichts-Modus, Pin-Übersicht und ZIP
import assert from "node:assert/strict";
import * as U from "../src/unterricht.js";
import { pinsAusCode } from "../src/zeichnen.js";
import { zip } from "../src/zip.js";
const erl = U.erlaubteListe();
const code = 'int led = 3;\n// millis() im Kommentar zählt nicht\nvoid setup() { pinMode(led, OUTPUT); Serial.begin(9600); }\nvoid loop() { long t = millis(); Serial.println("millis"); if (Serial.available()) {} digitalWrite(led, HIGH); }\n';
const m = U.pruefen(code, erl);
assert.deepEqual(m.map(x => x.text.match(/„(.+?)“/)[1]), ["millis", "Serial.available"]);
assert.equal(m[0].z, 4);
assert.equal(U.pruefen(code, U.erlaubteListe(["millis", "Serial.available"])).length, 0);
assert.ok(!U.istFremd("meineVariable", erl)); assert.ok(U.istFremd("bool", erl));
const p = pinsAusCode(code); assert.deepEqual(p.map(x => x.pin), ["D3"]);
const z = zip([{ name: "a.txt", inhalt: "hallo" }]); assert.equal(z[0], 0x50); assert.equal(z.length, 30 + 5 + 5 + 46 + 5 + 22);
console.log("✓ Unterrichts-Modus, Pins, ZIP");
