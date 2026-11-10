// Tests für Formelsammlung, Periodensystem, Einheiten: node notizen/tests/nachschlagen.test.mjs
import assert from "node:assert/strict";
import * as N from "../nachschlagen.js";
let ok = 0;
function test(n, f) { f(); ok++; console.log("✓ " + n); }
test("Periodensystem: 118 Elemente am richtigen Platz", () => {
  assert.equal(N.ELEMENTE.length, 118);
  const e = (s) => N.ELEMENTE.find(x => x.sym === s);
  assert.deepEqual([e("O").periode, e("O").gruppe, e("O").aussen], [2, 16, 6]);
  assert.deepEqual([e("Na").periode, e("Na").gruppe, e("Na").aussen], [3, 1, 1]);
  assert.deepEqual([e("Fe").periode, e("Fe").gruppe], [4, 8]);
  assert.deepEqual([e("Au").periode, e("Au").gruppe, e("Au").name], [6, 11, "Gold"]);
  assert.equal(e("Ce").zeile, 9); assert.equal(e("U").zeile, 10); assert.equal(e("Og").spalte, 18); assert.equal(e("He").aussen, 2);
  // kein Platz doppelt belegt
  const plaetze = new Set(N.ELEMENTE.map(x => x.zeile + "-" + x.spalte)); assert.equal(plaetze.size, 118);
  assert.equal(N.elementSuchen("26")[0].sym, "Fe"); assert.equal(N.elementSuchen("ei")[0].name, "Eisen"); assert.equal(N.elementSuchen("c")[0].sym, "C");
});
test("Molare Masse", () => {
  assert.equal(N.molmasse("H2O").masse, 18.015); assert.equal(N.molmasse("H₂SO₄").masse, 98.072);
  assert.equal(N.molmasse("Ca(OH)2").masse, 74.092); assert.deepEqual(N.molmasse("CuSO4·5H2O").teile, { Cu: 1, S: 1, O: 9, H: 10 });
  assert.equal(N.molmasse("Xy2"), null); assert.equal(N.molmasse("H2O)"), null);
});
test("Einheiten umrechnen", () => {
  assert.equal(N.umrechnen(1, "km", "m", "Länge"), 1000); assert.equal(N.umrechnen(36, "km/h", "m/s", "Geschwindigkeit"), 10);
  assert.equal(N.umrechnen(100, "°C", "°F", "Temperatur"), 212); assert.equal(N.umrechnen(0, "K", "°C", "Temperatur"), -273.15);
  assert.equal(N.umrechnen(1, "ha", "m²", "Fläche"), 10000); assert.equal(N.umrechnen(1, "dm³ = l", "cm³ = ml", "Volumen"), 1000);
  assert.equal(N.umrechnen(1, "GiB", "MiB", "Daten"), 1024); assert.equal(N.umrechnen(1, "m", "kg", "Länge"), null);
  assert.equal(N.zahlDe(1234.5), "1.234,5");
});
test("Formeln als Text", () => {
  assert.equal(N.texZuText("A = \\frac{a + c}{2} \\cdot h"), "A = (a + c)/2 · h");
  assert.equal(N.texZuText("a^2 + b^2 = c^2"), "a² + b² = c²");
  assert.ok(N.FORMELN.every(f => !/\\/.test(N.texZuText(f[2]))), "kein LaTeX-Rest");
});
console.log(ok + " Tests bestanden.");
