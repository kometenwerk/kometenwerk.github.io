// Tests für die Modell-Auswahl – ausführen mit: node ki/tests/motor.test.mjs
import { empfehlung, moeglich, neuerText, ohneDenken, MODELLE } from "../motor.js";

let ok = 0, fehl = 0;
function pruef(name, bed) { if (bed) ok++; else { fehl++; console.error("✗ " + name); } }

pruef("Nano vorhanden → Nano", empfehlung({ nano: true, gpu: true, speicherGB: 8 }) === "nano");
pruef("Starker PC → Gemma", empfehlung({ nano: false, gpu: true, speicherGB: 8, handy: false }) === "gemma-2-2b-it-q4f16_1-MLC");
pruef("Schwaches Handy → klein", empfehlung({ nano: false, gpu: true, speicherGB: 4, handy: true }) === "Qwen2.5-0.5B-Instruct-q4f16_1-MLC");
pruef("Unbekannter Speicher → klein", empfehlung({ nano: false, gpu: true, speicherGB: null, handy: true }) === "Qwen2.5-0.5B-Instruct-q4f16_1-MLC");
pruef("Nichts geht → null", empfehlung({ nano: false, gpu: false }) === null);
pruef("Jede Empfehlung existiert", ["nano", "gemma-2-2b-it-q4f16_1-MLC", "Qwen2.5-0.5B-Instruct-q4f16_1-MLC"].every(id => MODELLE.some(m => m.id === id)));

const nano = MODELLE.find(m => m.art === "nano"), gemma = MODELLE.find(m => m.id.startsWith("gemma"));
pruef("Nano nur mit Nano", !moeglich(nano, { nano: false, gpu: true }) && moeglich(nano, { nano: true }));
pruef("WebLLM nur mit GPU", !moeglich(gemma, { gpu: false, nano: true }) && moeglich(gemma, { gpu: true }));
pruef("Alle WebLLM-Modelle haben f32-Ersatz", MODELLE.filter(m => m.art === "webllm").every(m => m.f32));

pruef("Stream: Stück ist neu", neuerText("Hallo", " Welt") === " Welt");
pruef("Stream: Stück ist ganzer Text", neuerText("Hallo", "Hallo Welt") === " Welt");
pruef("Stream: Anfang", neuerText("", "Hi") === "Hi");

pruef("Denken entfernt", ohneDenken("<think>hmm</think>\n\nZugspitze") === "Zugspitze");
pruef("Offenes Denken versteckt", ohneDenken("<think>noch am denken") === "");
pruef("Normaler Text bleibt", ohneDenken("Die Zugspitze") === "Die Zugspitze");

console.log(`${ok} bestanden, ${fehl} fehlgeschlagen`);
if (fehl) process.exit(1);
