// Tests für den Taschenrechner: node notizen/tests/rechner.test.mjs
import assert from "node:assert/strict";
import * as R from "../rechner-kern.js";
let ok = 0;
function test(n, f) { f(); ok++; console.log("✓ " + n); }
const f = (t, sp, e, art) => R.formatieren(R.rechnen(t, sp, e), e, art);
test("Grundrechnen, Punkt vor Strich, Klammern", () => {
  assert.equal(f("2+3×4"), "14"); assert.equal(f("(2+3)×4"), "20"); assert.equal(f("2^3^2"), "512"); assert.equal(f("-3^2"), "-9");
  assert.equal(f("0,1+0,2", {}, { bruch: "komma" }), "0,3"); assert.equal(f("7÷2", {}, { bruch: "komma" }), "3,5");
});
test("Brüche bleiben exakt: ¾ + ⅔ = 17⁄12 = 1 5⁄12", () => {
  assert.equal(f("3⁄4+2⁄3"), "17⁄12"); assert.equal(f("3⁄4+2⁄3", {}, {}, "gemischt"), "1 5⁄12"); assert.equal(f("3⁄4+2⁄3", {}, {}, "komma"), "1,416666667");
  assert.equal(f("1⁄2×4"), "2"); assert.equal(f("0,25"), "1⁄4"); assert.equal(f("(2⁄3)^2"), "4⁄9"); assert.equal(f("√(9⁄4)"), "3⁄2");
});
test("Winkel in Grad und Bogenmaß", () => {
  assert.equal(f("sin(30)"), "1⁄2"); assert.equal(f("cos(90)"), "0"); assert.equal(f("sin(180)"), "0");
  assert.equal(f("sin(π÷2)", {}, { winkel: "rad" }), "1"); assert.equal(f("tan⁻¹(1)"), "45");
  assert.throws(() => R.rechnen("tan(90)"));
});
test("Wurzeln, Potenzen, Logarithmen, Fakultät, nCr", () => {
  assert.equal(f("√(16)"), "4"); assert.equal(f("ⁿ√(3;27)"), "3"); assert.equal(f("5²"), "25"); assert.equal(f("2⁻¹"), "1⁄2");
  assert.equal(f("log(1000)"), "3"); assert.equal(f("ln(ℯ)"), "1"); assert.equal(f("5!"), "120"); assert.equal(f("5nCr2"), "10"); assert.equal(f("5nPr2"), "20");
  assert.equal(f("2E3"), "2000"); assert.equal(f("50%×80"), "40");
});
test("π, Mal-Zeichen ergänzen, Speicher, ans", () => {
  assert.equal(f("2π", {}, { fix: 2 }), "6,28");
  assert.equal(f("3(2+1)"), "9");
  assert.equal(f("2x+1", { x: R.bruch(3) }), "7");
  assert.equal(f("ans×2", { ans: R.bruch(21) }), "42");
});
test("math-Menü: ggT, kgV, runden, Betrag", () => {
  assert.equal(f("ggT(12;18)"), "6"); assert.equal(f("kgV(4;6)"), "12"); assert.equal(f("round(3,14159;2)"), "157⁄50"); assert.equal(f("round(3,14159;2)", {}, { bruch: "komma" }), "3,14"); assert.equal(f("abs(-5)"), "5");
});
test("Fehler werden verständlich gemeldet", () => {
  assert.throws(() => R.rechnen("1÷0"), /Division durch 0/);
  assert.throws(() => R.rechnen("√(-4)"), /negativen/);
  assert.throws(() => R.rechnen("2+"), /fehlt/);
  assert.equal(f("(2+3"), "5"); // fehlende Klammer am Ende ist ok
});
test("Große und kleine Zahlen in wissenschaftlicher Schreibweise", () => {
  assert.equal(f("10^12"), "1×10¹²"); assert.equal(f("1÷3", {}, { anzeige: "sci", fix: 3 }), "3,333×10⁻¹");
});
test("Wertetabelle und Statistik", () => {
  const t = R.tabelle("x²-1", -2, 1, 5); assert.deepEqual(t.map(r => r[1]), ["3", "0", "-1", "0", "3"]);
  const s = R.statistik([2, 4, 4, 4, 5, 5, 7, 9]); assert.equal(s.mittel, 5); assert.equal(s.median, 4.5); assert.equal(s.sigma, 2);
});
test("Hübsche Anzeige: Brüche, Wurzeln, Hochzahlen", () => {
  const h = R.schoen("3⁄4+√(2)×5^(2)");
  assert.ok(h.includes('class="bruch"') && h.includes('class="wurzel"') && h.includes("<sup>2</sup>"));
});
console.log(ok + " Tests bestanden.");
