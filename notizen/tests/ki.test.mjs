// Tests für die KI-Helfer: node notizen/tests/ki.test.mjs
import assert from "node:assert/strict";
import { jsonAusText, lernstoffPruefen, fachRaten, sortierungPruefen, stuecke, modellWaehlen, kartenAusMuster, quizAusKarten } from "../ki.js";
let ok = 0;
function test(n, f) { f(); ok++; console.log("✓ " + n); }
const F = ["Mathe", "Deutsch", "Geschichte", "Biologie"].map(name => ({ name }));

test("JSON aus Text mit Gerede drumherum", () => {
  assert.deepEqual(jsonAusText('Klar! ```json\n{"fach":"Mathe","titel":"Brüche {kürzen}"}\n``` Viel Erfolg'), { fach: "Mathe", titel: "Brüche {kürzen}" });
  assert.equal(jsonAusText("kein json"), null);
  assert.equal(jsonAusText('{"kaputt": '), null);
  assert.deepEqual(jsonAusText('<think>{"x":1}</think>{"y":2}'), { y: 2 });
});
test("Lernstoff: kaputte Fragen fliegen raus", () => {
  const r = lernstoffPruefen({
    karten: [{ vorne: "Zelle", hinten: "Kleinste Einheit des Lebens" }, { vorne: "Zelle", hinten: "doppelt" }, { vorne: "", hinten: "leer" }, { begriff: "Organ", erklaerung: "Verband aus Geweben" }],
    fragen: [
      { frage: "Was ist 2+2?", optionen: ["3", "4", "5", "6"], richtig: 1 },
      { frage: "Nur drei?", optionen: ["a", "b", "c"], richtig: 0 },
      { frage: "Doppelt", optionen: ["a", "a", "b", "c"], richtig: 0 },
      { frage: "Falscher Index", optionen: ["a", "b", "c", "d"], richtig: 7 },
      { frage: "Antwort als Text", optionen: ["Rom", "Paris", "Bonn", "Wien"], richtig: "Paris" }
    ]
  });
  assert.equal(r.karten.length, 2);
  assert.equal(r.karten[1].vorne, "Organ");
  assert.equal(r.fragen.length, 2);
  assert.equal(r.fragen[1].richtig, 1);
  assert.deepEqual(lernstoffPruefen(null), { karten: [], fragen: [] });
});
test("Fach raten mit Schlagwörtern", () => {
  assert.equal(fachRaten("Berechne die Fläche vom Dreieck und löse die Gleichung", F).fach, "Mathe");
  assert.equal(fachRaten("Im Mittelalter regierte der König, später kam die Revolution", F).fach, "Geschichte");
  assert.equal(fachRaten("Einkaufsliste: Milch", F), null);
});
test("Sortierung: nur Fächer aus der Liste", () => {
  assert.deepEqual(sortierungPruefen({ fach: "mathe", titel: "„Brüche“" }, F), { fach: "Mathe", titel: "Brüche" });
  assert.equal(sortierungPruefen({ fach: "Astrologie" }, F).fach, "");
  assert.equal(sortierungPruefen({ fach: "Bio" }, F).fach, "Biologie");
  assert.equal(sortierungPruefen(null, F).fach, "");
});
test("Text in Stücke teilen", () => {
  const t = Array.from({ length: 300 }, (_, i) => "Satz Nummer " + i + " ist hier.").join(" ");
  const s = stuecke(t, 1000);
  assert.ok(s.length > 3 && s.every(x => x.length <= 1000));
  assert.equal(s.join(" ").replace(/\s+/g, " "), t);
  assert.deepEqual(stuecke(""), []);
});
test("Modell wählen", () => {
  const m = [{ name: "llama3.2:3b" }, { name: "gemma3:4b" }];
  assert.equal(modellWaehlen(m, ""), "gemma3:4b");
  assert.equal(modellWaehlen(m, "llama3.2:3b"), "llama3.2:3b");
  assert.equal(modellWaehlen([], ""), "");
});
test("Karteikarten ohne KI aus Mustern", () => {
  const k = kartenAusMuster("Die Zelle\nZellkern: Steuerzentrale der Zelle\n- Mitochondrien – Kraftwerke der Zelle\n2. Ribosomen = bauen Eiweiße\nHausaufgabe: S. 12\nUm 10:30 ist Pause\nDas ist ein ganz langer Satz mit sehr vielen Wörtern: und noch mehr\nZellkern: doppelt");
  assert.deepEqual(k.map(x => x.vorne), ["Zellkern", "Mitochondrien", "Ribosomen"]);
  assert.equal(k[1].hinten, "Kraftwerke der Zelle");
  assert.deepEqual(kartenAusMuster(""), []);
});
test("Quiz ohne KI aus Karten", () => {
  const karten = [["A", "eins"], ["B", "zwei"], ["C", "drei"], ["D", "vier"], ["E", "fünf"]].map(([vorne, hinten]) => ({ vorne, hinten }));
  const q = quizAusKarten(karten);
  assert.equal(q.length, 5);
  q.forEach((f, i) => { assert.equal(f.optionen.length, 4); assert.equal(f.optionen[f.richtig], karten[i].hinten); assert.equal(new Set(f.optionen).size, 4); });
  assert.deepEqual(quizAusKarten(karten.slice(0, 3)), []);
});
console.log(ok + " Tests bestanden.");
