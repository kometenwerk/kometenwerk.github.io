// Tests für die Ehrliche Linse – ausführen mit: node ki/tests/linse.test.mjs
import { herkunftLesen, urteilBilden, kiWertAus, LINSE } from "../linse.js";

let ok = 0, fehl = 0;
function pruef(name, bed) { if (bed) { ok++; } else { fehl++; console.error("✗ " + name); } }
const bytes = s => new Uint8Array([...s].map(c => c.charCodeAt(0) & 255));
const zufall = n => { const b = new Uint8Array(n); for (let i = 0; i < n; i++) b[i] = (i * 2654435761 >>> 13) & 255; return b; };

// Herkunft
let h = herkunftLesen(zufall(200000));
pruef("Zufallsdaten: keine KI-Spur", !h.kiKennung && !h.programme.length && !h.c2pa);
pruef("Zufallsdaten: Hinweis auf fehlende Daten", h.funde.length === 1 && /Keine Herkunftsdaten/.test(h.funde[0].text));

h = herkunftLesen(bytes("xxx<Iptc4xmpExt:DigitalSourceType>http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia</x>"));
pruef("IPTC-KI-Kennung erkannt", h.kiKennung);

h = herkunftLesen(bytes("tEXtparameters\0a cat, Steps: 20, Sampler: Euler a, CFG scale: 7"));
pruef("Stable-Diffusion-Parameter erkannt", h.programme.includes("Stable Diffusion"));

h = herkunftLesen(bytes("....jumb....jumdc2pa....OpenAI...."));
pruef("C2PA erkannt", h.c2pa);
pruef("OpenAI erkannt", h.programme.includes("OpenAI"));

h = herkunftLesen(bytes("\xff\xd8\xff\xe1..Exif\0\0MM.*..Canon"));
pruef("EXIF erkannt", h.exif && h.funde.some(f => /Kamera-Daten/.test(f.text)));

h = herkunftLesen(bytes("...flux...gemini...imagen..."));
pruef("Kurze Wörter lösen keinen Fehlalarm aus", !h.programme.length);

// Modell-Ausgabe deuten
pruef("Deepfake-Label", kiWertAus([{ label: "Deepfake", score: 0.9 }, { label: "Realism", score: 0.1 }]) === 0.9);
pruef("Nur Realism-Label", Math.abs(kiWertAus([{ label: "Realism", score: 0.7 }]) - 0.3) < 1e-9);
pruef("artificial/human", kiWertAus([{ label: "human", score: 0.2 }, { label: "artificial", score: 0.8 }]) === 0.8);
pruef("Unbekannte Labels → null", kiWertAus([{ label: "katze", score: 1 }]) === null);
pruef("Leere Ausgabe → null", kiWertAus([]) === null);

// Urteil
const leer = { kiKennung: false, programme: [] };
pruef("Hoher Wert → KI", urteilBilden(0.95, leer).stufe === "ki");
pruef("Niedriger Wert → echt", urteilBilden(0.05, leer).stufe === "echt");
pruef("Mittlerer Wert → unsicher", urteilBilden(0.5, leer).stufe === "unsicher");
pruef("Grenze KI genau", urteilBilden(LINSE.grenzeKI, leer).stufe === "ki");
pruef("Kein Wert → unsicher", urteilBilden(null, leer).stufe === "unsicher");
pruef("KI-Kennung schlägt Erkenner", urteilBilden(0.01, { kiKennung: true, programme: [] }).stufe === "ki");
pruef("Nie 100 % – Titel sagt immer wahrscheinlich/unsicher", ["ki", "echt"].every(st => /Wahrscheinlich/.test(urteilBilden(st === "ki" ? 1 : 0, leer).titel)));

console.log(`${ok} bestanden, ${fehl} fehlgeschlagen`);
if (fehl) process.exit(1);
