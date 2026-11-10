// Tests für Seitenlinks und Tags: node notizen/tests/verknuepfen.test.mjs
import assert from "node:assert/strict";
import * as V from "../verknuepfen.js";
let ok = 0;
function test(n, f) { f(); ok++; console.log("✓ " + n); }
test("#Tags finden", () => {
  assert.deepEqual(V.tagsAusText("Heute #Photosynthese und #klausur, Aufgabe #3 und #3b. E-Mail a#b"), ["photosynthese", "klausur"]);
  assert.deepEqual(V.tagsAusText("#Ökologie (#Wald)"), ["ökologie", "wald"]);
});
test("Verweise und Vorschläge", () => {
  const s = [{ id: "a", titel: "Brüche", text: "" }, { id: "b", titel: "Zellen", html: '<a data-seite="a">Brüche</a>' }, { id: "c", titel: "Bruchrechnung üben", text: "", geaendert: "2" }, { id: "d", titel: "Sonst", text: "mit Bruch drin" }];
  assert.deepEqual(V.verweiseAuf(s, "a").map(x => x.id), ["b"]);
  assert.deepEqual(V.seitenVorschlaege(s, "br", "x").map(x => x.id), ["a", "c", "d"]);
  assert.ok(!V.seitenVorschlaege(s, "", "a").some(x => x.id === "a"));
  assert.ok(V.linkHtml({ id: "a", titel: "<b>" }).includes("&lt;b&gt;"));
});
console.log(ok + " Tests bestanden.");
