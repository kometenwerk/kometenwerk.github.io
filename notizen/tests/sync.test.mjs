// Tests für den Abgleich: node notizen/tests/sync.test.mjs
import assert from "node:assert/strict";
import { linkLesen, gewinnt, planerMischen, b64, unb64 } from "../sync.js";
let ok = 0;
function test(n, f) { f(); ok++; console.log("✓ " + n); }
const g = "A".repeat(22), k = "b".repeat(43);
test("Kopplungs-Link lesen", () => {
  assert.deepEqual(linkLesen("https://kometenwerk.github.io/notizen/#koppeln=" + g + "." + k), { g, k });
  assert.equal(linkLesen("https://kometenwerk.github.io/chat/#k=abc"), null);
  assert.equal(linkLesen("#koppeln=kurz.kurz"), null);
});
test("Neuere Version gewinnt, Löschen gewinnt gegen Älteres", () => {
  const alt = { geaendert: "2026-11-08T10:00:00.000Z" }, neu = { geaendert: "2026-11-08T11:00:00.000Z" };
  assert.equal(gewinnt(alt, neu), "fern");
  assert.equal(gewinnt(neu, alt), "lokal");
  assert.equal(gewinnt(null, alt), "fern");
  assert.equal(gewinnt(null, alt, "2026-11-08T10:30:00.000Z"), "lokal");
  assert.equal(gewinnt(null, neu, "2026-11-08T10:30:00.000Z"), "fern");
});
test("Hausaufgaben mischen", () => {
  const a = [{ id: "1", titel: "A", erledigt: false }, { id: "2", titel: "B", erledigt: true }];
  const b = [{ id: "1", titel: "A", erledigt: true }, { id: "3", titel: "C", erledigt: false }];
  const m = planerMischen(a, b);
  assert.deepEqual(m.map(e => e.id), ["1", "2", "3"]);
  assert.equal(m[0].erledigt, true);
  assert.equal(a[0].erledigt, false, "Original bleibt unverändert");
});
test("Base64 hin und zurück", () => {
  const bytes = new Uint8Array([0, 1, 250, 255, 62, 63]);
  assert.deepEqual(Array.from(unb64(b64(bytes))), Array.from(bytes));
});
console.log(ok + " Tests bestanden.");
