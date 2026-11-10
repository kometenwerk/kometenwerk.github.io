// Tests für die KI-Helfer (ohne KI): node notizen/tests/ki-helfer.test.mjs
import assert from "node:assert/strict";
import * as H from "../ki-helfer.js";
let ok = 0;
function test(n, f) { f(); ok++; console.log("✓ " + n); }
test("Antworten aufräumen", () => {
  assert.equal(H.antwortSaeubern("Hier ist der verbesserte Text:\n„Die Katze schläft.“"), "Die Katze schläft.");
  assert.equal(H.antwortSaeubern("**Photosynthese** ist wichtig."), "Photosynthese ist wichtig.");
  assert.equal(H.antwortSaeubern("```\nHallo\n```"), "Hallo");
  assert.equal(H.antwortSaeubern("Klar! Hier: The cat sleeps."), "Klar! Hier: The cat sleeps.".replace(/^Klar! Hier:\s*/, "")); // „Klar …:“ wird abgeschnitten
});
test("Synonyme lesen (JSON und Liste)", () => {
  assert.deepEqual(H.synonymeLesen('{"woerter": ["schnell", "flink", "rasch", "schnell"]}', "schnell"), ["flink", "rasch"]);
  assert.deepEqual(H.synonymeLesen("1. groß\n2. riesig\n- gewaltig", "dick"), ["groß", "riesig", "gewaltig"]);
});
test("Formel aus KI-Antwort holen und prüfen", () => {
  assert.equal(H.formelAusAntwort('{"formel": "=SUMME(B2:B10)", "erklaerung": "Zählt alles zusammen."}').formel, "=SUMME(B2:B10)");
  assert.equal(H.formelAusAntwort('{"formel": "=summe(B2:B10)"}').formel, "=SUMME(B2:B10)");
  assert.equal(H.formelAusAntwort("Du kannst `=AVERAGE(A1:A5, 3)` nehmen.").formel, "=MITTELWERT(A1:A5;3)");
  assert.equal(H.formelAusAntwort('{"formel": "=WENN(B2>=4;\\"bestanden\\";\\"nicht\\")"}').formel, '=WENN(B2>=4;"bestanden";"nicht")');
  assert.equal(H.formelAusAntwort('{"formel": "=ZAUBERN(A1)"}'), null);
  assert.equal(H.formelAusAntwort("Weiß ich nicht."), null);
});
console.log(ok + " Tests bestanden.");
