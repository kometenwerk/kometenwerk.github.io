// Tests fürs Nachschlagen – ausführen mit: node ki/tests/wissen.test.mjs
import { suchbegriffe, lohntNachschlagen, kontextBauen, trefferAus } from "../wissen.js";

let ok = 0, fehl = 0;
function pruef(name, bed) { if (bed) ok++; else { fehl++; console.error("✗ " + name); } }

pruef("Berg-Frage → gute Suchbegriffe", suchbegriffe("Was ist der höchste Berg in Deutschland?") === "höchste berg deutschland");
pruef("Umlaute bleiben", suchbegriffe("Wie groß ist München") === "groß münchen");
pruef("Leere Frage", suchbegriffe("") === "");
pruef("Höchstens 8 Wörter", suchbegriffe("a1 b2 c3 d4 e5 f6 g7 h8 i9 j10").split(" ").length === 8);

pruef("Wissensfrage → nachschlagen", lohntNachschlagen("Was ist der höchste Berg in Deutschland?"));
pruef("Gruß → nicht nachschlagen", !lohntNachschlagen("Hallo, wie geht's?"));
pruef("Aufgabe → nicht nachschlagen", !lohntNachschlagen("Stell mir 3 Quizfragen zu Brüchen."));
pruef("Zu kurz → nicht nachschlagen", !lohntNachschlagen("hi"));

const daten = { query: { pages: {
  "1": { index: 2, title: "Liste der Berge", extract: "Eine Liste.", fullurl: "https://de.wikipedia.org/wiki/Liste" },
  "2": { index: 1, title: "Zugspitze", extract: "Die Zugspitze ist mit 2962 m der höchste Gipfel Deutschlands.", fullurl: "https://de.wikipedia.org/wiki/Zugspitze" },
  "3": { index: 3, title: "Berg (Begriffsklärung)", extract: "Berg bezeichnet:" },
  "4": { index: 4, title: "Leer" }
} } };
const t = trefferAus(daten);
pruef("Sortiert nach Relevanz", t[0].titel === "Zugspitze");
pruef("Begriffsklärung und Leeres raus", t.length === 2);
pruef("Leere Antwort", trefferAus(null).length === 0);

const k = kontextBauen(t);
pruef("Kontext nummeriert", k.startsWith("[1] Zugspitze:") && k.includes("[2] Liste der Berge"));
const lang = kontextBauen([{ titel: "A", text: "x".repeat(5000) }, { titel: "B", text: "y".repeat(5000) }, { titel: "C", text: "z".repeat(5000) }]);
pruef("Kontext bleibt kurz", lang.length <= 1700);

console.log(`${ok} bestanden, ${fehl} fehlgeschlagen`);
if (fehl) process.exit(1);
