// Tests für Präsentations-Kern und Funktionsplotter: node notizen/tests/office.test.mjs
import assert from "node:assert/strict";
import * as K from "../folien-kern.js";
import * as P from "../plotter.js";
let ok = 0;
function test(n, f) { f(); ok++; console.log("✓ " + n); }
test("Jedes Layout baut eine Folie mit gültigen Elementen", () => {
  for (const id of Object.keys(K.LAYOUTS)) {
    const f = K.neueFolie(id);
    for (const e of f.el) { assert.ok(e.id && e.w > 0 && e.h > 0 && e.x >= 0 && e.y >= 0 && e.x + e.w <= K.W && e.y + e.h <= K.H, id); }
  }
});
test("Folie wird zu HTML, Animationen werden schrittweise versteckt", () => {
  const f = K.neueFolie("inhalt"); f.el[1].anim = 1;
  assert.ok(K.folieHtml(f, "nacht", { schritt: 0 }).includes("versteckt"));
  assert.ok(!K.folieHtml(f, "nacht", { schritt: 1 }).includes("versteckt"));
  assert.ok(K.folieHtml(f, "gibtsnicht").includes("#ffffff")); // unbekanntes Design → Klar
});
test("Gliederung aus KI-Antwort wird geprüft und gekürzt", () => {
  assert.equal(K.gliederungPruefen({ folien: [] }), null);
  const g = K.gliederungPruefen({ folien: [{ titel: "Thema", punkte: ["Untertitel"] }, { title: "Teil 1", bullets: ["a", "b", "c", "d", "e", "f", "g", "h"] }] });
  assert.equal(g.length, 2); assert.equal(g[1].titel, "Teil 1"); assert.equal(g[1].punkte.length, 7);
  const folien = K.folienAusGliederung(g);
  assert.equal(folien[0].layout, "titel"); assert.ok(folien[1].el[1].html.includes("<li>a</li>"));
});
test("Funktionen lesen: 2x, Potenz, sin, Komma, Betrag", () => {
  assert.equal(P.lesen("2x+1")(3), 7);
  assert.equal(P.lesen("f(x) = x^2 - 2")(3), 7);
  assert.equal(P.lesen("0,5x")(4), 2);
  assert.ok(Math.abs(P.lesen("sin(pi/2)")(0) - 1) < 1e-12);
  assert.equal(P.lesen("|x-3|")(1), 2);
  assert.equal(P.lesen("2(x+1)")(1), 4);
  assert.equal(P.lesen("-x^2")(3), -9);
  assert.throws(() => P.lesen("2x+"));
});
test("Nullstellen werden gefunden", () => {
  const n = P.nullstellen(P.lesen("x^2-4"), -5, 5);
  assert.equal(n.length, 2); assert.ok(Math.abs(n[0] + 2) < 1e-6 && Math.abs(n[1] - 2) < 1e-6);
  assert.equal(P.nullstellen(P.lesen("1/x"), -5, 5).length, 0);
});
console.log(ok + " Tests bestanden.");
