// Tests für die unendliche Tafel (nur Rechnungen): node notizen/tests/tafel.test.mjs
import assert from "node:assert/strict";
globalThis.window = { KW: {} };
const T = await import("../tafel.js");
let ok = 0;
function test(n, f) { f(); ok++; console.log("✓ " + n); }
test("Rahmen und Ansicht", () => {
  const b = T.grenzen([{ b: 2, p: [[0, 0], [100, 50]] }], [{ x: 200, y: -20, w: 200, h: 140 }]);
  assert.deepEqual(b, { x: -1, y: -20, w: 401, h: 140 });
  assert.equal(T.grenzen([], []), null);
  const a = T.ansichtFuer({ x: 0, y: 0, w: 100, h: 100 }, 380, 380, 40); assert.equal(a.z, 1.5); assert.equal(a.ox, 115);
});
test("Zoom bleibt unter der Maus", () => {
  const a = { ox: 10, oy: 20, z: 1 }, n = T.zoomUm(a, 100, 100, 2);
  // Weltpunkt unter (100,100) vorher: (90,80) → nachher wieder bei (100,100)
  assert.equal(90 * n.z + n.ox, 100); assert.equal(80 * n.z + n.oy, 100);
  assert.equal(T.zoomUm(a, 0, 0, 100).z, 6);
});
test("Radierer trifft Striche (auch zwischen den Punkten)", () => {
  const st = [{ b: 2, p: [[0, 0], [100, 0]] }, { b: 2, p: [[0, 50], [10, 50]] }];
  assert.deepEqual(T.getroffen(st, 50, 3, 3), [0]); assert.deepEqual(T.getroffen(st, 50, 30, 3), []);
});
console.log(ok + " Tests bestanden.");
