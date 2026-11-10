// Tests für Formen-Erkennung, Lasso und Lineal: node notizen/tests/formen.test.mjs
import assert from "node:assert/strict";
import { formErkennen, markerGerade, imLasso, umformen, kanten, naechsteKante, aufKante, rahmen } from "../formen.js";
import { PAPIER, svg, info } from "../papier.js";
let ok = 0;
function test(n, f) { f(); ok++; console.log("✓ " + n); }
let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280 - 0.5);
const wackel = (p, s = 0.6) => p.map(q => [q[0] + rnd() * s, q[1] + rnd() * s, 0.5]);
function weg(ecken, n = 15) { const o = []; for (let i = 0; i < ecken.length - 1; i++) for (let k = 0; k < n; k++) { const a = ecken[i], b = ecken[i + 1]; o.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } o.push(ecken[ecken.length - 1]); return o; }

test("Krakelige Linie wird gerade (und rastet waagerecht ein)", () => {
  const r = formErkennen(wackel(weg([[10, 50], [90, 52]], 40)));
  assert.equal(r.form, "linie");
  const y = r.p.map(q => q[1]); assert.ok(Math.max(...y) - Math.min(...y) < 0.01);
});
test("Kreis wird erkannt", () => {
  const p = []; for (let i = 0; i <= 60; i++) { const w = i / 60 * 6.28; p.push([50 + 20 * Math.cos(w), 60 + 21 * Math.sin(w)]); }
  assert.equal(formErkennen(wackel(p)).form, "kreis");
});
test("Dreieck wird erkannt", () => assert.equal(formErkennen(wackel(weg([[20, 80], [60, 20], [100, 80], [21, 79]]))).form, "dreieck"));
test("Rechteck wird erkannt und gerade", () => {
  const r = formErkennen(wackel(weg([[20, 20], [80, 21], [79, 60], [21, 59], [20, 21]])));
  assert.equal(r.form, "rechteck");
});
test("Gekritzel bleibt Gekritzel", () => {
  const p = []; for (let i = 0; i < 80; i++) p.push([20 + i, 50 + 15 * Math.sin(i / 3)]);
  assert.equal(formErkennen(p), null);
});
test("Textmarker wird gerade", () => {
  assert.equal(markerGerade([[10, 50.4], [40, 51.2], [80, 50.1]]).length, 2);
  assert.equal(markerGerade([[10, 10], [20, 40]]).length, 2 /* steil: bleibt wie es ist */);
});
test("Lasso findet nur Striche innen", () => {
  const striche = [{ p: [[10, 10], [12, 12]] }, { p: [[50, 50], [52, 52]] }];
  assert.deepEqual(imLasso(striche, [[0, 0], [30, 0], [30, 30], [0, 30]]), [0]);
});
test("Umformen: verschieben, drehen, vergrößern", () => {
  const st = { art: "stift", b: 0.6, p: [[10, 0, 0.5], [20, 0, 0.5]] };
  assert.deepEqual(umformen(st, { dx: 5 }).p[0], [15, 0, 0.5]);
  const d = umformen(st, { w: 90, cx: 10, cy: 0 }); assert.deepEqual(d.p[1].slice(0, 2), [10, 10]);
  const g = umformen(st, { s: 2, cx: 10, cy: 0 }); assert.deepEqual(g.p[1].slice(0, 2), [30, 0]);
  const r = rahmen([st]); assert.equal(r.w, 10);
});
test("Lineal: Punkt wird auf die Kante gezogen", () => {
  const k = kanten({ art: "lineal", x: 20, y: 100, w: 0 });
  const kante = naechsteKante([50, 102], k);
  assert.ok(kante);
  assert.deepEqual(aufKante([50, 102, 0.5], kante), [50, 100, 0.5]);
  assert.equal(naechsteKante([50, 115], k), null);
  assert.equal(kanten({ art: "geo", x: 0, y: 0, w: 0 }).length, 3);
});
test("Alle Papierarten lassen sich zeichnen", () => {
  for (const p of PAPIER) { const s = svg(p.id, false) + svg(p.id, true); assert.ok(s.startsWith("<svg") && !s.includes("NaN"), p.id); }
  assert.equal(info("karo").id, "karo5");
  assert.ok(PAPIER.length >= 30);
});
console.log(ok + " Tests bestanden.");
{
  const Z = await import("../formen.js");
  assert.equal(Z.winkelDelta(350, 10), 20); assert.equal(Z.winkelDelta(10, 350), -20); assert.equal(Z.winkelDelta(0, 180), 180);
  const k = Z.zirkelBogen(50, 50, 20, 0, 360, 3);
  assert.ok(k.every(p => Math.abs(Math.hypot(p[0] - 50, p[1] - 50) - 20) < 0.1), "alle Punkte auf dem Kreis");
  assert.deepEqual(k[0].slice(0, 2), [70, 50]); assert.deepEqual(k[k.length - 1].slice(0, 2), [70, 50]);
  const s = Z.zirkelScharnier(50, 50, 30, 0); assert.deepEqual(s.mine, [80, 50]); assert.ok(s.oben[1] < 50);
  console.log("✓ Zirkel");
}
