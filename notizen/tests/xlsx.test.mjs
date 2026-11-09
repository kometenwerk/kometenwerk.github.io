// Tests für Excel-Dateien und CSV: node notizen/tests/xlsx.test.mjs
import assert from "node:assert/strict";
import * as fflate from "../../shared/vendor/fflate-0.8.3/fflate.mjs";
import * as X from "../xlsx.js";
let ok = 0;
function test(n, f) { f(); ok++; console.log("✓ " + n); }
const m = { blaetter: [{ name: "Noten", spalten: { A: 140 }, fix: { z: 1, s: 0 }, zellen: {
  A1: { v: "Fach", f: { b: 1, bg: "#fff176" } }, B1: { v: "Note" }, A2: { v: "Mathe" }, B2: { v: "2,5" }, C2: { v: "12 €" },
  A3: { v: "Deutsch & <Co>" }, B3: { v: "1" }, B4: { v: "=MITTELWERT(B2:B3)" }, B5: { v: "09.11.2026" }, D5: { v: '=WENN(B4<2;"gut";"ok")' } } },
  { name: "Blatt 2", zellen: { A1: { v: "=Noten!B4*2" } } }] };
test(".xlsx schreiben und wieder lesen (Formeln, Formate, Fixieren, Sonderzeichen)", () => {
  const d = X.schreiben(m, fflate), z = X.lesen(d, fflate), b = z.blaetter[0];
  assert.equal(z.blaetter.length, 2);
  assert.equal(b.zellen.B4.v, "=MITTELWERT(B2:B3)");
  assert.equal(b.zellen.A3.v, "Deutsch & <Co>");
  assert.equal(b.zellen.B5.f.format, "datum");
  assert.equal(b.zellen.A1.f.b, 1);
  assert.equal(b.zellen.D5.v, '=WENN(B4<2;"gut";"ok")');
  assert.deepEqual(b.fix, { z: 1, s: 0 });
  assert.equal(z.blaetter[1].zellen.A1.v, "=Noten!B4*2");
});
test("CSV mit Semikolon schreiben und lesen", () => {
  const csv = X.csvSchreiben(m.blaetter[0], m);
  assert.ok(csv.includes("Schnitt") === false && csv.includes("1,75") && csv.includes("12,00 €") && csv.includes("9.11.2026"));
  assert.deepEqual(X.csvLesen('a;b\n1,5;"x;y"\n').zellen, { A1: { v: "a" }, B1: { v: "b" }, A2: { v: "1,5" }, B2: { v: "x;y" } });
  assert.equal(X.csvLesen("a,b\n1.5,2\n").zellen.A2.v, "1,5");
});
console.log(ok + " Tests bestanden.");
