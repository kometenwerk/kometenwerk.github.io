// Tests für OMNIVIA Karten. Aufruf: node --test karten/tests/
// Mit echten Daten (z. B. aus bauen.py mit monaco.osm.pbf): KARTEN_DATEN=/pfad/zu/daten node --test karten/tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { Netz, linieTeilen, naechsterAufLinie, drehWort, meterText, abstand, kosten, netzLesen, BIT } from "../netz.js";
import { Suche, norm, eimerVon } from "../suche.js";
import { meldungenLesen, routeErklaeren, fahrtRichtung } from "../verkehr.js";

test("norm passt zu den Daten", () => {
  assert.equal(norm("Hauptstraße 5"), "hauptstr 5");
  assert.equal(norm("Kaiser-Joseph-Str."), "kaiser joseph str");
  assert.equal(norm("Müllheim"), "muellheim");
  assert.equal(norm("Èze"), "eze");
  assert.equal(eimerVon("Übersee"), "ue");
  assert.equal(eimerVon("A"), "a_");
});

test("Linie teilen und nächster Punkt", () => {
  const p = [[0, 0], [0, 0.001], [0, 0.002]];
  const [a, b] = linieTeilen(p, 0.5);
  assert.ok(Math.abs(a[a.length - 1][1] - 0.001) < 1e-9);
  assert.ok(Math.abs(b[0][1] - 0.001) < 1e-9);
  const r = naechsterAufLinie(p, 0.0001, 0.0015);
  assert.ok(Math.abs(r.anteil - 0.75) < 0.01); assert.ok(r.abstand > 10 && r.abstand < 12);
});

test("Abbiege-Wörter und Meter", () => {
  assert.equal(drehWort(5), "geradeaus");
  assert.equal(drehWort(-90), "links");
  assert.equal(drehWort(40), "leicht rechts");
  assert.equal(drehWort(178), "wenden");
  assert.equal(meterText(123), "120 m");
  assert.equal(meterText(1540), "1,5 km");
  assert.equal(meterText(23400), "23 km");
});

// kleines künstliches Netz: Quadrat mit Abkürzung durch ein Wohngebiet
function kleinesNetz() {
  const knoten = [[47.99, 7.84], [47.99, 7.85], [48.0, 7.85], [48.0, 7.84]]; // 0-1-2-3
  const kanten = [ // von, nach, klasse, tempo, bits
    [0, 1, 3, 70, BIT.AUTO | BIT.RAD | BIT.FUSS], [1, 0, 3, 70, BIT.AUTO | BIT.RAD | BIT.FUSS],
    [1, 2, 3, 70, BIT.AUTO | BIT.RAD | BIT.FUSS], [2, 1, 3, 70, BIT.AUTO | BIT.RAD | BIT.FUSS],
    [0, 3, 6, 30, BIT.AUTO | BIT.RAD | BIT.FUSS | BIT.WOHN], [3, 0, 6, 30, BIT.AUTO | BIT.RAD | BIT.FUSS | BIT.WOHN],
    [3, 2, 6, 30, BIT.AUTO | BIT.FUSS | BIT.WOHN], // Einbahn fürs Auto
  ];
  const n = knoten.length, m = kanten.length;
  const nach = Array.from({ length: n }, () => []);
  kanten.forEach(k => nach[k[0]].push(k));
  const flach = nach.flat();
  const start = [0]; nach.forEach(l => start.push(start[start.length - 1] + l.length));
  const namen = ["B 3", "Gartenweg"];
  const teile = [];
  const kopf = Buffer.alloc(20); kopf.write("KWN1", 0); kopf.writeUInt32LE(n, 4); kopf.writeUInt32LE(m, 8); kopf.writeUInt32LE(0, 12);
  const nb = Buffer.from(JSON.stringify(namen)); kopf.writeUInt32LE(nb.length, 16); teile.push(kopf);
  const feld = (T, w) => { const a = Buffer.from(new T(w).buffer); return Buffer.concat([a, Buffer.alloc((4 - a.length % 4) % 4)]); };
  const L = (a, b) => abstand(knoten[a][0], knoten[a][1], knoten[b][0], knoten[b][1]);
  teile.push(feld(Uint32Array, [0, 1, 2, 3]), feld(Int32Array, knoten.map(k => k[0] * 1e6)), feld(Int32Array, knoten.map(k => k[1] * 1e6)), feld(Uint32Array, start),
    feld(Uint32Array, flach.map(k => k[1])), feld(Float32Array, flach.map(k => L(k[0], k[1]))), feld(Int32Array, flach.map(k => knoten[k[1]][0] * 1e6)), feld(Int32Array, flach.map(k => knoten[k[1]][1] * 1e6)),
    feld(Uint32Array, flach.map(() => 0)), feld(Uint16Array, flach.map(() => 0)), feld(Uint16Array, flach.map(k => (k[2] === 3 ? 0 : 1))),
    feld(Uint8Array, flach.map(k => k[2])), feld(Uint8Array, flach.map(k => k[4])), feld(Uint8Array, flach.map(k => k[3])), feld(Uint8Array, flach.map(() => 0)), nb);
  const buf = Buffer.concat(teile);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
  const key = `${Math.floor(47.99 / 0.05)}_${Math.floor(7.84 / 0.075)}`;
  const index = { kachel: [0.05, 0.075], kacheln: { [key]: [0, n, 1] } };
  return new Netz(index, async () => ab.slice(0));
}

test("künstliches Netz: Datei lesen", async () => {
  const netz = kleinesNetz();
  const k = await netz.kachel(Object.keys(netz.index.kacheln)[0]);
  assert.equal(k.n, 4); assert.equal(k.m, 7); assert.deepEqual(k.namen, ["B 3", "Gartenweg"]);
  assert.equal(kosten(k, 6, "rad"), Infinity);
});

test("künstliches Netz: Route und Einbahnstraße", async () => {
  const netz = kleinesNetz();
  // Von Ecke 0 nach Ecke 2: Auto darf 3->2 fahren (Einbahn in diese Richtung)
  const r = await netz.route({ lat: 47.99, lon: 7.8405 }, { lat: 47.9995, lon: 7.85 }, { modus: "auto", ohneFern: true });
  assert.ok(!r.fehler, JSON.stringify(r.fehler));
  assert.ok(r.meter > 1000 && r.meter < 2200);
  // Zurück von 2 nach 0: 2->3 ist für Autos verboten, also über 1
  const z = await netz.route({ lat: 48.0, lon: 7.8495 }, { lat: 47.99, lon: 7.8405 }, { modus: "auto", ohneFern: true });
  assert.ok(z.strassen.some(s => s.name === "B 3"));
  assert.ok(z.schritte.length >= 1);
});

test("künstliches Netz: keine Schleichwege meidet das Wohngebiet", async () => {
  const netz = kleinesNetz();
  const von = { lat: 47.9905, lon: 7.84 }, nach = { lat: 47.9995, lon: 7.84 };
  const normal = await netz.route(von, nach, { modus: "auto", ohneFern: true });
  assert.ok(normal.schritte.every(s => s.name === "Gartenweg"));
});

test("Verkehrsmeldungen lesen", () => {
  const roh = { warning: [{ identifier: "x", title: "A5 | Freiburg-Mitte - Freiburg-Süd", subtitle: "Karlsruhe -> Basel", coordinate: { lat: "47.98", long: "7.80" }, description: ["Stau", "Verzögerung 15 Minuten"], delayTimeValue: "15", display_type: "WARNING", isBlocked: "false" }],
    closure: [{ identifier: "y", title: "A5 | Sperrung", coordinate: { lat: "47.9", long: "7.7" }, description: [], display_type: "CLOSURE", isBlocked: "true" }],
    roadworks: [{ identifier: "z", title: "A98", coordinate: { lat: "60", long: "7.7" }, description: [], display_type: "ROADWORKS", isBlocked: "false" }] };
  const m = meldungenLesen(roh, [47, 7, 48.5, 9]);
  assert.equal(m.length, 2);
  const stau = m.find(x => x.art === "stau");
  assert.equal(stau.minuten, 15); assert.equal(stau.strasse, "A5");
  assert.ok(m.find(x => x.gesperrt));
});

test("Fahrtrichtung einer Meldung aus den Anschlussstellen", () => {
  const anschluss = { "teningen": [[48.12, 7.80]], "freiburg nord": [[48.03, 7.79], [52, 13]] };
  const g = fahrtRichtung("A5 | Teningen - Freiburg-Nord", 48.07, 7.80, anschluss);
  assert.ok(g > 170 && g < 200, String(g)); // nach Süden
  assert.equal(fahrtRichtung("A5 | Unbekannt - Freiburg-Nord", 48.07, 7.8, anschluss), null);
  const m = meldungenLesen({ warning: [{ title: "A5 | Teningen - Freiburg-Nord", coordinate: { lat: "48.07", long: "7.8" }, description: ["Stau"], delayTimeValue: "9" }] }, null, anschluss);
  assert.ok(m[0].grad > 170 && m[0].grad < 200);
});

test("Route erklären", () => {
  const t = routeErklaeren({ meter: 42000, sekunden: 2100, strassen: [{ name: "A 5", meter: 30000 }, { name: "B 31", meter: 8000 }] }, [{ art: "baustelle", titel: "A5 | Baustelle", strasse: "A5", lat: 0, lon: 0 }], "auto");
  assert.match(t, /A 5/); assert.match(t, /B 31/); assert.match(t, /35 Min/); assert.match(t, /Baustelle/);
});

const DATEN = process.env.KARTEN_DATEN;
const echt = DATEN && fs.existsSync(path.join(DATEN, "index.json"));
test("echte Daten: Routen sind gleich gut wie ein vollständiger Durchlauf", { skip: !echt && "KARTEN_DATEN fehlt" }, async () => {
  const index = JSON.parse(fs.readFileSync(path.join(DATEN, "index.json")));
  const laden = async p => { const b = zlib.gunzipSync(fs.readFileSync(path.join(DATEN, p))); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); };
  const netz = new Netz(index, laden);
  const [s, w, n, o] = index.bbox;
  let zufall = 7; const r = () => (zufall = (zufall * 16807) % 2147483647) / 2147483647;
  let ok = 0;
  for (let i = 0; i < 25; i++) {
    const a = { lat: s + (n - s) * (0.3 + 0.4 * r()), lon: w + (o - w) * (0.3 + 0.4 * r()) };
    const weit = { lat: s + (n - s) * (0.3 + 0.4 * r()), lon: w + (o - w) * (0.3 + 0.4 * r()) };
    const nah = { lat: a.lat + (r() - 0.5) * Math.min(0.1, n - s), lon: a.lon + (r() - 0.5) * Math.min(0.14, o - w) };
    for (const [modus, b] of [["auto", weit], ["fuss", nah]]) {
      const x = await netz.route(a, b, { modus });
      if (x.fehler) continue;
      const y = await netz.route(a, b, { modus, ohneFern: true });
      assert.ok(Math.abs(x.sekunden - y.sekunden) / y.sekunden < 0.25, `${modus} ${x.sekunden} vs ${y.sekunden}`);
      // Punkte hängen zusammen
      for (let j = 1; j < x.punkte.length; j++) assert.ok(abstand(...x.punkte[j - 1], ...x.punkte[j]) < 3000);
      const l = x.punkte.reduce((acc, p, j) => j ? acc + abstand(...x.punkte[j - 1], ...p) : 0, 0);
      assert.ok(Math.abs(l - x.meter) / Math.max(50, x.meter) < 0.05, `Länge ${l} vs ${x.meter}`);
      ok++;
    }
  }
  assert.ok(ok >= 20, `nur ${ok} Routen gefunden`);
});

test("echte Daten: Suche", { skip: !echt && "KARTEN_DATEN fehlt" }, async () => {
  const index = JSON.parse(fs.readFileSync(path.join(DATEN, "index.json")));
  const orte = JSON.parse(fs.readFileSync(path.join(DATEN, "orte.json")));
  const laden = async p => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DATEN, p))).toString());
  const suche = new Suche(laden, index.suche, orte);
  const proben = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DATEN, "suche", index.suche[0] + ".json.gz"))).toString());
  const e = proben.find(x => x[5] && x[5].length) || proben[0];
  const t = await suche.suchen(e[0]);
  assert.ok(t.some(x => x.titel === e[0]), `${e[0]} nicht gefunden: ${JSON.stringify(t.map(x => x.titel))}`);
  if (e[5] && e[5].length) {
    const h = e[5][0];
    const t2 = await suche.suchen(`${e[0]} ${h[0]}`);
    assert.equal(t2[0].titel, `${e[0]} ${h[0]}`);
  }
});

test("Netz-Datei mit falschem Kopf wird abgelehnt", () => {
  assert.throws(() => netzLesen(new ArrayBuffer(24)));
});
