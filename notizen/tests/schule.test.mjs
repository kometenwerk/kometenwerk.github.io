// Tests für die Schul-Helfer: node notizen/tests/schule.test.mjs
import assert from "node:assert/strict";
import * as S from "../schule.js";
let ok = 0;
function test(n, f) { f(); ok++; console.log("✓ " + n); }
test("Lernplan: Seiten verteilt, Karten jeden Tag, Probetest am Tag davor", () => {
  const p = S.lernplanBauen({ heute: "2026-11-09", datum: "2026-11-13", seiten: [{ id: "a", titel: "Brüche" }, { id: "b", titel: "Dezimalzahlen" }, { id: "c", titel: "Prozent" }], sets: [{ id: "k1" }], fach: "Mathe" });
  assert.equal(p.length, 4); assert.equal(p[0].datum, "2026-11-09"); assert.equal(p[3].datum, "2026-11-12");
  assert.equal(p.flatMap(t => t.aufgaben).filter(a => a.art === "seite").length, 3);
  assert.ok(!p[3].aufgaben.some(a => a.art === "seite"), "letzter Tag ohne neuen Stoff");
  assert.ok(p[3].aufgaben.some(a => a.art === "quiz")); assert.ok(p.every(t => t.aufgaben.some(a => a.art === "karten")));
  const ohne = S.lernplanBauen({ heute: "2026-11-09", datum: "2026-11-11", seiten: [], sets: [], fach: "Bio" });
  assert.ok(ohne[0].aufgaben.some(a => a.art === "karten-machen"));
  assert.equal(S.lernplanBauen({ heute: "2026-11-09", datum: "2026-11-09", seiten: [], sets: [] }).length, 1);
});
test("Noten mit Tendenz und Wunschnote", () => {
  assert.equal(S.note("2-"), 2.3); assert.equal(S.note("2+"), 1.7); assert.equal(S.note("2,5"), 2.5); assert.equal(S.note("x"), null);
  const r = S.wunschnote([{ wert: 3, gewicht: 1 }, { wert: 3, gewicht: 1 }], 2.5, 2);
  assert.equal(r.jetzt, 3); assert.equal(r.noetig, 2); assert.ok(r.moeglich);
  assert.equal(S.wunschnote([{ wert: 5, gewicht: 1 }], 1.5, 1).moeglich, false);
});
test("Hausaufgabe aus Tafelfoto-Text erkennen", () => {
  const r = S.hausaufgabenErkennen("Hausaufgabe bis Montag: S. 45 Nr. 3 und 4", "2026-11-09"); // 9.11.2026 ist ein Montag
  assert.equal(r.titel, "S. 45 Nr. 3 und 4"); assert.equal(r.datum, "2026-11-16");
  assert.equal(S.hausaufgabenErkennen("bis morgen AB Brüche fertig machen", "2026-11-09").datum, "2026-11-10");
  assert.equal(S.hausaufgabenErkennen("Buch Seite 12 Aufgabe 5a bis 20.11.", "2026-11-09").datum, "2026-11-20");
  assert.equal(S.hausaufgabenErkennen("Die Photosynthese braucht Licht.", "2026-11-09"), null);
});
test("Lern-Serie und Wochen-Statistik", () => {
  const z = { "2026-11-09": { Mathe: 20 }, "2026-11-08": { Deutsch: 10 }, "2026-11-07": { Mathe: 6 }, "2026-11-05": { Mathe: 30 } };
  assert.equal(S.serie(z, "2026-11-09"), 3); assert.equal(S.serie(z, "2026-11-10"), 3); assert.equal(S.serie(z, "2026-11-11"), 0);
  const w = S.woche(z, "2026-11-09"); assert.equal(w.gesamt, 66); assert.equal(w.proFach.Mathe, 56);
});
test("Welche Stunde ist gerade?", () => {
  const st = [{ stunde: 1, fach: "Deutsch" }, { stunde: 3, fach: "Mathe" }];
  assert.equal(S.jetztStunde(st, "08:00").fach, "Deutsch"); assert.equal(S.jetztStunde(st, "09:00").fach, "Mathe"); assert.equal(S.jetztStunde(st, "09:00").jetzt, false);
  assert.equal(S.jetztStunde(st, "10:00").jetzt, true); assert.equal(S.jetztStunde(st, "12:00"), null);
});
console.log(ok + " Tests bestanden.");
{
  const b = S.stundenBloecke([{ stunde: 2, fach: "Latein" }, { stunde: 1, fach: "Latein" }, { stunde: 3, fach: "Chemie" }, { stunde: 5, fach: "Chemie" }]);
  assert.deepEqual(b.map(x => [x.von, x.bis, x.fach]), [[1, 2, "Latein"], [3, 3, "Chemie"], [5, 5, "Chemie"]]);
  assert.equal(b[0].start, "07:45"); assert.equal(b[0].ende, "09:20");
  console.log("✓ Doppelstunden zusammenfassen");
}
