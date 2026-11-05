// Holt die Verkehrsmeldungen der Autobahn GmbH (verkehr.autobahn.de) für Südbaden
// und speichert eine schlanke Kopie in karten/daten/verkehr.json – für den Fall,
// dass der Browser die Daten nicht direkt abrufen darf.
// Aufruf: node karten/werkzeug/verkehr.mjs
import fs from "node:fs";
import { AUTOBAHNEN } from "../verkehr.js";

const API = "https://verkehr.autobahn.de/o/autobahn";
const DIENSTE = ["warning", "closure", "roadworks"];
const BBOX = [47.4, 7.4, 48.75, 9.0];
const ZIEL = new URL("../daten/verkehr.json", import.meta.url);
const FELDER = ["identifier", "title", "subtitle", "description", "coordinate", "isBlocked", "display_type", "delayTimeValue", "abnormalTrafficType", "averageSpeed", "startTimestamp"];

const roh = { warning: [], closure: [], roadworks: [] };
let ok = 0;
for (const a of AUTOBAHNEN) for (const d of DIENSTE) {
  try {
    const r = await fetch(`${API}/${a}/services/${d}`, { headers: { "User-Agent": "OMNIVIA-Karten (kometenwerk.github.io)" }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    for (const m of j[d] || []) {
      const lat = parseFloat(m.coordinate?.lat), lon = parseFloat(m.coordinate?.long);
      if (!(lat >= BBOX[0] && lat <= BBOX[2] && lon >= BBOX[1] && lon <= BBOX[3])) continue;
      if (m.future === true) continue;
      const x = {}; for (const f of FELDER) if (m[f] !== undefined) x[f] = m[f];
      roh[d].push(x);
    }
    ok++;
  } catch (e) { console.warn(a, d, String(e)); }
}
if (ok < AUTOBAHNEN.length * DIENSTE.length / 2) { console.error("Zu viele Fehler – nichts gespeichert."); process.exit(1); }
for (const d of DIENSTE) roh[d].sort((x, y) => String(x.identifier).localeCompare(String(y.identifier)));
let alt = null;
try { alt = JSON.parse(fs.readFileSync(ZIEL, "utf8")); } catch {}
if (alt && JSON.stringify(alt.roh) === JSON.stringify(roh)) { console.log("Keine neuen Meldungen."); process.exit(0); }
fs.writeFileSync(ZIEL, JSON.stringify({ stand: new Date().toISOString(), quelle: "Autobahn GmbH des Bundes, verkehr.autobahn.de", roh }));
console.log("Gespeichert:", DIENSTE.map(d => `${d} ${roh[d].length}`).join(", "));
