// Tests für Paket 5 und die Microsoft-Funktionen: node notizen/tests/office2.test.mjs
import assert from "node:assert/strict";
import * as D from "../diagramm.js";
import * as X from "../xlsx.js";
import * as K from "../folien-kern.js";
import * as Rg from "../tabellen-regeln.js";
import { zeitplan } from "../pptx.js";
import * as fflate from "../../shared/vendor/fflate-0.8.3/fflate.mjs";
let ok = 0;
function test(n, f) { f(); ok++; console.log("✓ " + n); }
test("Trendlinie (Ausgleichsgerade)", () => { const t = D.trendlinie([[0, 1], [1, 3], [2, 5]]); assert.ok(Math.abs(t.m - 2) < 1e-9 && Math.abs(t.b - 1) < 1e-9 && Math.abs(t.r2 - 1) < 1e-9); assert.equal(D.trendlinie([[1, 1]]), null); });
test("Punkt-Diagramm als SVG mit Gleichung", () => { const s = D.svg({ labels: ["0", "1", "2"], reihen: [{ name: "y", werte: [1, 3, 5] }] }, "punkt", "T"); assert.ok(s.includes("y = 2·x") && s.includes("<circle")); });
test("Excel: Diagramme, bedingte Formatierung, Auswahlliste", () => {
  const z = { A1: { v: "x" }, B1: { v: "y" }, A2: { v: "1" }, B2: { v: "2" }, A3: { v: "2" }, B3: { v: "4" } };
  const bytes = X.schreiben({ blaetter: [{ name: "B", zellen: z, spalten: {}, fix: { z: 0, s: 0 }, diagramme: [{ art: "punkt", bereich: "A1:B3" }, { art: "saeule", bereich: "A1:B3", titel: "S" }], regeln: [{ bereich: "B2:B3", art: "groesser", wert: "3", farbe: "#ffcdd2" }], auswahl: [{ bereich: "C2:C3", werte: ["ja", "nein"] }] }] }, fflate);
  const f = fflate.unzipSync(bytes), sheet = fflate.strFromU8(f["xl/worksheets/sheet1.xml"]);
  assert.ok(f["xl/charts/chart1.xml"] && f["xl/charts/chart2.xml"] && f["xl/drawings/drawing1.xml"]);
  assert.ok(fflate.strFromU8(f["xl/charts/chart1.xml"]).includes("<c:trendline>"));
  assert.ok(sheet.indexOf("<conditionalFormatting") < sheet.indexOf("<dataValidations") && sheet.indexOf("<dataValidations") < sheet.indexOf("<drawing"));
  assert.ok(fflate.strFromU8(f["xl/styles.xml"]).includes("<dxfs count=\"1\">"));
  assert.equal(X.lesen(bytes, fflate).blaetter[0].zellen.B3.v, "4");
});
test("Bedingte Formatierung färbt nur passende Zellen", () => {
  const blatt = { name: "B", regeln: [{ bereich: "A1:A3", art: "kleiner", wert: "5", farbe: "#ff0000" }, { bereich: "B1:B3", art: "enthaelt", wert: "ja", farbe: "#00ff00" }] };
  assert.ok(Rg.stilFuer(blatt, 0, 0, 3, null).includes("#ff0000")); assert.equal(Rg.stilFuer(blatt, 0, 0, 7, null), ""); assert.equal(Rg.stilFuer(blatt, 5, 0, 3, null), "");
  assert.ok(Rg.stilFuer(blatt, 1, 1, "Ja klar", null).includes("#00ff00"));
  assert.deepEqual(Rg.auswahlFuer({ auswahl: [{ bereich: "C2:C9", werte: ["a"] }] }, 3, 2), ["a"]);
});
test("Designideen behalten den Inhalt", () => {
  const f = K.neueFolie("bildText"); f.el[1].src = "data:image/png;base64,AA";
  const ideen = K.designIdeen(f); assert.ok(ideen.length >= 3);
  for (const i of ideen) assert.ok(i.folie.el.some(e => e.rolle === "titel") && i.folie.el.some(e => e.typ === "bild"));
});
test("Folienmaster: eigenes Design mit Fußzeile und Nummer", () => {
  const d = K.design({ basis: "nacht", akzent: "#00ff00", fuss: "Max · 9b", nummer: true });
  assert.equal(d.akzent, "#00ff00"); assert.equal(d.hg, K.DESIGNS.nacht.hg);
  const h = K.folieHtml(K.neueFolie("inhalt"), { basis: "klar", fuss: "Max", nummer: true }, { nr: 3 });
  assert.ok(h.includes("folie-fuss") && h.includes(">3<"));
});
test("PowerPoint-Animationen: Zeitplan in der richtigen Reihenfolge", () => { const z = zeitplan([{ spid: 5, schritt: 2 }, { spid: 3, schritt: 1 }]); assert.ok(z.indexOf('spid="3"') < z.indexOf('spid="5"')); assert.equal(zeitplan([]), ""); });
console.log(ok + " Tests bestanden.");
