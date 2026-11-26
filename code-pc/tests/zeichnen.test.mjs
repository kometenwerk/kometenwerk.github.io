// Tests für Boards, Bauteile und Bohrungen im Zeichner
import assert from "node:assert/strict";
import { SYM, bohrMass, BRETTER } from "../src/zeichnen.js";
import { brettLayout } from "../src/bretter.js";

let n = 0; const ok = (name, f) => { f(); n++; console.log("✓ " + name); };

ok("Boards: alle Pins auf dem 10er-Raster, keine doppelten Stellen", () => {
  for (const b of ["uno", "nano", "mega"]) for (const a of ["symbol", "echt"]) {
    const L = brettLayout(b, a), stellen = new Set();
    for (const [x, y, name] of L.pins) { assert.equal(x % 10, 0, b + a + name); assert.equal(y % 10, 0, b + a + name); const k = x + "," + y; assert.ok(!stellen.has(k), "doppelt " + b + a + name); stellen.add(k); }
  }
});
ok("Uno hat alle Pins (D0–D13, A0–A5, RESET, AREF, IOREF, SDA, SCL, 3× GND, USB)", () => {
  for (const a of ["symbol", "echt"]) {
    const namen = brettLayout("uno", a).pins.map(p => p[2]);
    for (let i = 0; i <= 13; i++) assert.ok(namen.includes("D" + i)); for (let i = 0; i <= 5; i++) assert.ok(namen.includes("A" + i));
    for (const x of ["RESET", "AREF", "IOREF", "SDA", "SCL", "USB", "5V", "3.3V", "Vin"]) assert.ok(namen.includes(x), x);
    assert.equal(namen.filter(x => x === "GND").length, 3);
    // beide Ansichten haben dieselben Pins → Leitungen können beim Umschalten mitwandern
    assert.deepEqual([...namen].sort(), brettLayout("uno", a === "echt" ? "symbol" : "echt").pins.map(p => p[2]).sort());
  }
});
ok("Nano hat A0–A7 und D0–D13, Mega D0–D53 und A0–A15", () => {
  const na = brettLayout("nano", "symbol").pins.map(p => p[2]), me = brettLayout("mega", "echt").pins.map(p => p[2]);
  for (let i = 0; i <= 7; i++) assert.ok(na.includes("A" + i)); for (let i = 0; i <= 13; i++) assert.ok(na.includes("D" + i));
  for (let i = 0; i <= 53; i++) assert.ok(me.includes("D" + i), "D" + i); for (let i = 0; i <= 15; i++) assert.ok(me.includes("A" + i));
});
ok("Alter Uno (ohne v) behält seine Pins – alte Pläne bleiben gleich", () => {
  const alt = SYM.arduino.pins({ typ: "arduino" });
  assert.equal(alt.length, 25); assert.deepEqual(alt[0], [0, 20, "5V"]); assert.deepEqual(alt.find(p => p[2] === "D13"), [140, 20, "D13"]);
  assert.ok(BRETTER.has("nano") && BRETTER.has("mega"));
});
ok("Neue Bauteile: Zeichnung ohne Fehler, Pins vorhanden", () => {
  for (const t of ["usb", "rgb", "schalter", "batterie", "diode", "kondensator", "transistor", "relais", "servo", "ultraschall", "ldr", "temp", "pir", "oled", "segment7", "ledstreifen"]) {
    const s = SYM[t], e = { typ: t, x: 0, y: 0, w: s.w, h: s.h }; assert.ok(s.svg(e, 1).length > 20, t);
    const pins = typeof s.pins === "function" ? s.pins(e) : s.pins; assert.ok(pins.length >= 1, t);
  }
  assert.deepEqual(SYM.kondensator.pins({ gepolt: true }).map(p => p[2]), ["+", "−"]);
});
ok("Bohrungen: Ausdehnung von Langloch und Senkung", () => {
  assert.deepEqual(bohrMass({ d: 4 }), { rx: 2, ry: 2, L: 0, v: false, r: 2 });
  const l = bohrMass({ d: 4, art: "langloch", laenge: 10 }); assert.equal(l.rx, 7); assert.equal(l.ry, 2);
  const v = bohrMass({ d: 4, art: "langloch", laenge: 10, richtung: "v" }); assert.equal(v.rx, 2); assert.equal(v.ry, 7);
  assert.equal(bohrMass({ d: 3.4, art: "senk", senkD: 6.5 }).rx, 3.25);
  for (const art of ["durch", "gewinde", "senk", "langloch"]) assert.ok(SYM.bohrung.svg({ d: 3, art, dmass: true, laenge: 8 }, 1).includes("<"), art);
});
console.log(n + " Zeichner-Tests bestanden.");
