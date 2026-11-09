// Tests für die Rechen-Maschine der Tabellen: node notizen/tests/formel.test.mjs
import assert from "node:assert/strict";
import * as F from "../formel.js";
let ok = 0;
function test(n, f) { f(); ok++; console.log("✓ " + n); }
const mappe = (zellen, weitere = []) => ({ blaetter: [{ name: "Blatt1", zellen: Object.fromEntries(Object.entries(zellen).map(([k, v]) => [k, { v }])) }, ...weitere] });
const w = (zellen, z = "A9") => F.alleRechnen(mappe(zellen)).wert("Blatt1", z);
const anz = (v) => F.anzeigen(v);

test("Grundrechnen mit Punkt vor Strich, Klammern, Potenz, Prozent", () => {
  assert.equal(w({ A9: "=1+2*3" }), 7);
  assert.equal(w({ A9: "=(1+2)*3" }), 9);
  assert.equal(w({ A9: "=2^3^2" }), 64);
  assert.equal(w({ A9: "=-2^2" }), 4);
  assert.equal(w({ A9: "=50%*10" }), 5);
  assert.equal(anz(w({ A9: "=0,1+0,2" })), "0,3");
});
test("Zellbezüge, deutsche Zahlen, Euro und Prozent in Zellen", () => {
  assert.equal(w({ A1: "3,5", A2: "1.000", A3: "12 €", A4: "50%", A9: "=A1+A2+A3+A4" }), 1016);
});
test("SUMME, MITTELWERT, MIN, MAX, ANZAHL über Bereiche (Text wird ignoriert)", () => {
  const z = { A1: "Note", A2: "2", A3: "1", A4: "3", A5: "", B9: "=SUMME(A1:A5)", C9: "=MITTELWERT(A2:A4)", D9: "=MAX(A1:A5)", E9: "=ANZAHL(A1:A5)", F9: "=ANZAHL2(A1:A5)" };
  const r = F.alleRechnen(mappe(z));
  assert.deepEqual(["B9", "C9", "D9", "E9", "F9"].map(n => r.wert("Blatt1", n)), [6, 2, 3, 3, 4]);
});
test("Englische Namen und Komma als Trenner gehen auch", () => {
  assert.equal(w({ A1: "4", A2: "6", A9: "=SUM(A1,A2)" }), 10);
  assert.equal(w({ A1: "4", A9: "=IF(A1>3,\"ja\",\"nein\")" }), "ja");
  assert.equal(w({ A9: "=RUNDEN(2,567;1)" }), 2.6);
  assert.equal(w({ A9: "=1,5*2" }), 3);
});
test("WENN, UND, ODER, Vergleiche, Text verketten", () => {
  assert.equal(w({ A1: "5", A9: '=WENN(UND(A1>2;A1<10);"mittel";"anders")' }), "mittel");
  assert.equal(w({ A1: "Max", A9: '="Hallo "&A1&"!"' }), "Hallo Max!");
  assert.equal(w({ A9: '=ODER(1>2;"a"="A")' }), true);
});
test("Fehler: #DIV/0!, #NAME?, #ZYKLUS!, WENNFEHLER", () => {
  assert.equal(anz(w({ A9: "=1/0" })), "#DIV/0!");
  assert.equal(anz(w({ A9: "=GIBTSNICHT(1)" })), "#NAME?");
  assert.equal(anz(w({ A1: "=A9", A9: "=A1+1" })), "#ZYKLUS!");
  assert.equal(w({ A9: '=WENNFEHLER(1/0;"geht nicht")' }), "geht nicht");
  assert.equal(anz(w({ A9: "=1+" })), "#WERT!");
});
test("ZÄHLENWENN, SUMMEWENN, SVERWEIS", () => {
  const z = { A1: "Apfel", B1: "3", A2: "Birne", B2: "5", A3: "Apfel", B3: "2", C9: '=ZÄHLENWENN(A1:A3;"Apfel")', D9: '=SUMMEWENN(A1:A3;"Apfel";B1:B3)', E9: '=SUMMEWENN(B1:B3;">2")', F9: '=SVERWEIS("birne";A1:B3;2;FALSCH)' };
  const r = F.alleRechnen(mappe(z));
  assert.deepEqual(["C9", "D9", "E9", "F9"].map(n => r.wert("Blatt1", n)), [2, 5, 8, 5]);
});
test("Bezug auf anderes Blatt", () => {
  const m = mappe({ A9: "=Noten!B2*2" }, [{ name: "Noten", zellen: { B2: { v: "21" } } }]);
  assert.equal(F.alleRechnen(m).wert("Blatt1", "A9"), 42);
});
test("Formeln beim Kopieren verschieben ($ bleibt fest)", () => {
  assert.equal(F.verschieben("=A1+$B$1+B$2+$C3", 2, 1), "=B3+$B$1+C$2+$C5");
  assert.equal(F.verschieben('=SUMME(A1:A3)&"A1"', 1, 0), '=SUMME(A2:A4)&"A1"');
});
test("Ausfüllen setzt Reihen fort", () => {
  assert.deepEqual(F.fortsetzen(["1", "3"], 3), ["5", "7", "9"]);
  assert.deepEqual(F.fortsetzen(["Montag"], 2), ["Dienstag", "Mittwoch"]);
  assert.deepEqual(F.fortsetzen(["Dez"], 2), ["Jan", "Feb"]);
  assert.deepEqual(F.fortsetzen(["Aufgabe 1"], 2), ["Aufgabe 2", "Aufgabe 3"]);
  assert.deepEqual(F.fortsetzen(["09.11.2026"], 2), ["10.11.2026", "11.11.2026"]);
  assert.deepEqual(F.fortsetzen(["=A1*2"], 2, [1, 0]), ["=A2*2", "=A3*2"]);
});
test("Übersetzen für Excel-Dateien und zurück", () => {
  assert.equal(F.nachExcel('=WENN(A1>2,5;"ja";SUMME(B1:B3))'), 'IF(A1>2.5,"ja",SUM(B1:B3))');
  assert.equal(F.vonExcel('IF(A1>2.5,"ja",SUM(B1:B3))'), '=WENN(A1>2.5;"ja";SUMME(B1:B3))');
  assert.equal(F.alleRechnen(mappe({ A1: "3", A9: F.vonExcel('IF(A1>2.5,"ja",SUM(B1:B3))') })).wert("Blatt1", "A9"), "ja");
});
test("Anzeige: Euro, Prozent, Datum, Spaltennamen", () => {
  assert.equal(F.anzeigen(1234.5, "eur"), "1.234,50 €");
  assert.equal(F.anzeigen(0.255, "proz"), "25,5 %");
  assert.equal(F.anzeigen(F.eingabeLesen("09.11.2026").wert, "datum"), "9.11.2026");
  assert.equal(F.spalteName(27), "AB"); assert.equal(F.spalteNr("AB"), 27);
});
console.log(ok + " Tests bestanden.");
