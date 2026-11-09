// Tests für Hilfslinien und Ausrichten: node notizen/tests/ausrichten.test.mjs
import assert from "node:assert/strict";
import * as H from "../ausrichten.js";
let ok = 0;
function test(n, f) { f(); ok++; console.log("✓ " + n); }
test("Rastet an der Kante eines anderen Elements ein und zeigt eine Linie", () => {
  const r = H.einrasten({ x: 203, y: 300, w: 100, h: 50 }, [{ x: 200, y: 100, w: 150, h: 80 }]);
  assert.equal(r.dx, -3);
  const l = r.linien.find(l => l.achse === "x" && l.pos === 200); assert.ok(l); assert.equal(l.von, 100); assert.equal(l.bis, 350);
});
test("Rastet an der Folienmitte ein", () => {
  const r = H.einrasten({ x: 428, y: 10, w: 100, h: 40 }, []); assert.equal(r.dx, 2); assert.ok(r.linien.some(l => l.pos === 480));
});
test("Gleicher Abstand zwischen zwei Nachbarn", () => {
  const r = H.einrasten({ x: 305, y: 100, w: 100, h: 50 }, [{ x: 100, y: 100, w: 100, h: 50 }, { x: 520, y: 100, w: 100, h: 50 }], { schwelle: 6 });
  assert.equal(r.dx, 5); assert.equal(r.abstaende.length, 2); assert.equal(r.abstaende[0].wert, 110);
});
test("Führungslinien und Raster", () => {
  assert.equal(H.einrasten({ x: 97, y: 33, w: 40, h: 10 }, [], { fuehrungX: [100], smart: false }).dx, 3);
  const r = H.einrasten({ x: 47, y: 33, w: 10, h: 10 }, [], { raster: 20, smart: false }); assert.equal(r.dx, -7); assert.equal(r.dy, 7);
  assert.equal(H.einrasten({ x: 97, y: 33, w: 10, h: 10 }, [{ x: 100, y: 200, w: 5, h: 5 }], { smart: false }).dx, 0);
});
test("Ausrichten an der Folie und aneinander", () => {
  const a = [{ x: 10, y: 10, w: 100, h: 50 }]; H.ausrichten(a, "mitte"); assert.equal(a[0].x, 430);
  const b = [{ x: 10, y: 10, w: 100, h: 50 }, { x: 300, y: 80, w: 50, h: 20 }]; H.ausrichten(b, "rechts"); assert.deepEqual(b.map(e => e.x), [250, 300]);
  H.ausrichten(b, "unten"); assert.deepEqual(b.map(e => e.y), [50, 80]);
});
test("Gleichmäßig verteilen", () => {
  const a = [{ x: 0, y: 0, w: 100, h: 10 }, { x: 150, y: 0, w: 50, h: 10 }, { x: 500, y: 0, w: 100, h: 10 }];
  assert.ok(H.verteilen(a, "x")); assert.equal(a[1].x, 275);
  assert.equal(H.verteilen(a.slice(0, 2), "x"), false);
});
test("Drehwinkel rastet bei 15° ein", () => {
  assert.equal(H.winkelEinrasten(88), 90); assert.equal(H.winkelEinrasten(-3), 0); assert.equal(H.winkelEinrasten(52), 52); assert.equal(H.winkelEinrasten(52, true), 52);
});
console.log(ok + " Tests bestanden.");
