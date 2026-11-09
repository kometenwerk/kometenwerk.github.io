// Tests für den Scan-Kern: node notizen/tests/scan.test.mjs
import assert from "node:assert/strict";
import { analysiereBlatt, findeBlatt, ruheMesser, perspektive, geradeZiehen, papierweiss, a4Groesse, bewegung, farbeWeiss, schaerfe, schaerfen, textRichtung, drehen, bilderMitteln, tafelWeiss } from "../scan-kern.js";

function bild(w, h, ecken, hell = 230, dunkel = 60) {
  const g = new Uint8ClampedArray(w * h).fill(dunkel);
  const drin = (x, y) => { let s = 0; for (let i = 0; i < 4; i++) { const a = ecken[i], b = ecken[(i + 1) % 4]; const k = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x); if (k !== 0) { if (s === 0) s = Math.sign(k); else if (Math.sign(k) !== s) return false; } } return true; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (drin(x, y)) g[y * w + x] = hell;
  return g;
}
let ok = 0;
function test(name, f) { f(); ok++; console.log("✓ " + name); }

test("findet ein schräges Blatt", () => {
  const e = [{ x: 60, y: 20 }, { x: 150, y: 35 }, { x: 135, y: 140 }, { x: 45, y: 125 }];
  const r = findeBlatt(bild(200, 160, e), 200, 160);
  assert.ok(r);
  r.forEach((p, i) => assert.ok(Math.hypot(p.x - e[i].x, p.y - e[i].y) < 4, "Ecke " + i));
});
test("kein Blatt auf leerem Tisch", () => {
  assert.equal(findeBlatt(new Uint8ClampedArray(200 * 160).fill(80), 200, 160), null);
});
test("zu kleines Blatt zählt nicht", () => {
  const e = [{ x: 90, y: 70 }, { x: 110, y: 70 }, { x: 110, y: 95 }, { x: 90, y: 95 }];
  assert.equal(findeBlatt(bild(200, 160, e), 200, 160), null);
});
test("Ruhe wird erst nach 1 Sekunde erkannt", () => {
  const r = ruheMesser(200, 160);
  const e = [{ x: 60, y: 20 }, { x: 150, y: 20 }, { x: 150, y: 140 }, { x: 60, y: 140 }];
  assert.equal(r.neu(e, 0), false);
  assert.equal(r.neu(e, 500), false);
  assert.equal(r.neu(e.map(p => ({ x: p.x + 1, y: p.y })), 900), false); // winziges Zittern ist okay
  assert.equal(r.neu(e, 1001), true);
  const weg = e.map(p => ({ x: p.x + 30, y: p.y }));
  assert.equal(r.neu(weg, 1100), false); // Blatt bewegt → von vorn
  assert.equal(r.neu(null, 1200), false);
});
test("Perspektive trifft die Ecken", () => {
  const von = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 141 }, { x: 0, y: 141 }];
  const nach = [{ x: 10, y: 5 }, { x: 90, y: 12 }, { x: 95, y: 130 }, { x: 4, y: 120 }];
  const f = perspektive(von, nach);
  von.forEach((p, i) => { const q = f(p.x, p.y); assert.ok(Math.abs(q.x - nach[i].x) < 1e-6 && Math.abs(q.y - nach[i].y) < 1e-6); });
});
test("A4-Format hoch und quer", () => {
  const hoch = a4Groesse([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 141 }, { x: 0, y: 141 }]);
  assert.equal(hoch.quer, false); assert.ok(Math.abs(hoch.h / hoch.w - 1.414) < 0.01);
  assert.equal(a4Groesse([{ x: 0, y: 0 }, { x: 141, y: 0 }, { x: 141, y: 100 }, { x: 0, y: 100 }]).quer, true);
});
test("Gerade ziehen füllt das Ziel mit dem Blatt", () => {
  const w = 120, h = 100, rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { const x = i % w, y = (i / w) | 0, inn = x >= 20 && x < 100 && y >= 10 && y < 90; rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = inn ? 200 : 30; rgba[i * 4 + 3] = 255; }
  const out = geradeZiehen(rgba, w, h, [{ x: 21, y: 11 }, { x: 98, y: 11 }, { x: 98, y: 88 }, { x: 21, y: 88 }], 50, 70);
  let dunkel = 0; for (let i = 0; i < out.length; i += 4) if (out[i] < 100) dunkel++;
  assert.equal(dunkel, 0);
});
test("Papierweiß entfernt Schatten, Schrift bleibt", () => {
  const w = 200, h = 200, g = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = 120 + x * 0.5; // Schatten-Verlauf
  for (let x = 50; x < 150; x++) for (let y = 98; y < 102; y++) g[y * w + x] = 30; // Strich
  const out = papierweiss(g, w, h);
  assert.equal(out[10 * w + 10], 255); assert.equal(out[10 * w + 190], 255);
  assert.ok(out[100 * w + 100] < 80);
  const s = papierweiss(g, w, h, "stark");
  assert.equal(s[100 * w + 100], 0); assert.equal(s[10 * w + 10], 255);
});
test("Bewegung ohne Ecken ist unendlich", () => assert.equal(bewegung(null, [], 1, 1), Infinity));
test("Farbe bleibt beim Weißmachen erhalten", () => {
  const w = 120, h = 120, rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { const x = i % w; rgba[i * 4] = 150 + x * 0.6; rgba[i * 4 + 1] = 145 + x * 0.6; rgba[i * 4 + 2] = 140 + x * 0.6; rgba[i * 4 + 3] = 255; }
  for (let y = 50; y < 60; y++) for (let x = 40; x < 80; x++) { const i = (y * w + x) * 4; rgba[i] = 230; rgba[i + 1] = 220; rgba[i + 2] = 60; } // gelber Marker
  const o = farbeWeiss(rgba, w, h);
  assert.equal(o[(10 * w + 10) * 4], 255); // Papier weiß
  const m = (55 * w + 60) * 4; assert.ok(o[m + 2] < o[m] - 60, "Gelb bleibt gelb");
});
test("Schärfe: scharfes Bild hat höheren Wert als unscharfes", () => {
  const w = 60, h = 60, scharf = new Uint8ClampedArray(w * h), weich = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { scharf[y * w + x] = (x % 6 < 3) ? 30 : 220; weich[y * w + x] = 125 + 90 * Math.sin(x / 6 * Math.PI * 2 / 2); }
  assert.ok(schaerfe(scharf, w, h) > schaerfe(weich, w, h) * 5);
  const s = schaerfen(weich, w, h); assert.equal(s.length, weich.length);
});
// Szene wie beim Laptop: gelbe Tür links, Person in der Mitte, weißes Blatt mit Schrift rechts
function szene(w, h, blattEcken) {
  const d = new Uint8ClampedArray(w * h * 4);
  const drin = (x, y, e) => { let s = 0; for (let i = 0; i < 4; i++) { const a = e[i], b = e[(i + 1) % 4]; const k = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x); if (k !== 0) { if (!s) s = Math.sign(k); else if (Math.sign(k) !== s) return false; } } return true; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; let f;
    if (x < w * 0.45) f = [235, 205, 95];                       // gelbe Tür (hell, aber farbig)
    else if (x < w * 0.62) f = [60, 80, 110];                   // Person
    else f = [215, 210, 200];                                   // helle Wand
    if (drin(x, y, blattEcken)) { f = [245, 245, 240]; if (y % 9 < 2 && x % 7 > 1) f = [40, 40, 60]; } // Blatt mit Schrift
    d[i] = f[0]; d[i + 1] = f[1]; d[i + 2] = f[2]; d[i + 3] = 255;
  }
  // dunkler Schatten-Rand um das Blatt (wie in echt)
  return d;
}
test("Laptop-Szene: findet das Blatt, nicht die gelbe Tür", () => {
  const w = 320, h = 240, e = [{ x: 205, y: 30 }, { x: 300, y: 42 }, { x: 290, y: 210 }, { x: 195, y: 200 }];
  const d = szene(w, h, e);
  // leichter Schatten zwischen Wand und Blatt
  const r = analysiereBlatt(d, w, h);
  assert.ok(r.ecken, "Blatt gefunden (" + r.hinweis + ")");
  r.ecken.forEach((p, i) => assert.ok(Math.hypot(p.x - e[i].x, p.y - e[i].y) < 8, "Ecke " + i + ": " + JSON.stringify(p)));
});
test("Blatt ragt aus dem Bild → kein Scan, Hinweis „rand“", () => {
  const w = 320, h = 240, e = [{ x: 205, y: 30 }, { x: 340, y: 42 }, { x: 330, y: 260 }, { x: 195, y: 200 }];
  const r = analysiereBlatt(szene(w, h, e), w, h);
  assert.equal(r.ecken, null);
});
// Ein Blatt mit Textzeilen (Wörter = dunkle Kästchen), waagerecht
function textBlatt(w, h) {
  const g = new Uint8ClampedArray(w * h).fill(235);
  for (let z = 0; z < 14; z++) { const y0 = 30 + z * 24; let x = 30; while (x < w - 60) { const lw = 12 + ((x * 7 + z * 13) % 40); for (let y = y0; y < y0 + 11; y++) for (let xx = x; xx < Math.min(w - 30, x + lw); xx++) if ((xx + y) % 3) g[y * w + xx] = 40; x += lw + 9; } }
  return g;
}
test("Textrichtung: waagerechte Zeilen und um 90° gedrehtes Blatt", () => {
  const w = 300, h = 400, g = textBlatt(w, h);
  assert.equal(textRichtung(g, w, h), "waag");
  const rgba = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) { rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = g[i]; rgba[i * 4 + 3] = 255; }
  const d = drehen(rgba, w, h, 90), g2 = new Uint8ClampedArray(d.w * d.h); for (let i = 0; i < g2.length; i++) g2[i] = d.daten[i * 4];
  assert.equal(d.w, h); assert.equal(textRichtung(g2, d.w, d.h), "senk");
  assert.equal(textRichtung(new Uint8ClampedArray(w * h).fill(240), w, h), null);
});
test("Drehen: 4× 90° ergibt wieder das Original", () => {
  const w = 5, h = 3, a = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < a.length; i++) a[i] = i % 251;
  let d = { daten: a, w, h }; for (let k = 0; k < 4; k++) d = drehen(d.daten, d.w, d.h, 90);
  assert.deepEqual(Array.from(d.daten), Array.from(a));
  const r = drehen(a, w, h, 180); assert.equal(r.daten[0], a[(w * h - 1) * 4]);
});
test("Gelbes Lampenlicht wird weiß, Schrift wird kräftig", () => {
  const w = 160, h = 160, rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { rgba[i * 4] = 225; rgba[i * 4 + 1] = 200; rgba[i * 4 + 2] = 120; rgba[i * 4 + 3] = 255; } // gelbstichiges Papier
  for (let y = 70; y < 76; y++) for (let x = 30; x < 130; x++) { const i = (y * w + x) * 4; rgba[i] = 150; rgba[i + 1] = 132; rgba[i + 2] = 80; } // blasse Schrift
  const o = farbeWeiss(rgba, w, h), p = (10 * w + 10) * 4, s = (72 * w + 80) * 4;
  assert.ok(o[p] === 255 && o[p + 1] === 255 && o[p + 2] === 255, "Papier ist neutral weiß");
  assert.ok(o[s] < 70 && o[s + 2] < 70, "blasse Schrift wird dunkel");
  assert.ok(Math.abs(o[s] - o[s + 2]) < 25, "Schrift ohne Gelbstich");
});
test("Tafelbild: dunkle Tafel wird weiß, Kreide dunkel", () => {
  const w = 160, h = 120, rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { rgba[i * 4] = 40; rgba[i * 4 + 1] = 60; rgba[i * 4 + 2] = 50; rgba[i * 4 + 3] = 255; }
  for (let y = 50; y < 56; y++) for (let x = 20; x < 140; x++) { const i = (y * w + x) * 4; rgba[i] = rgba[i + 1] = rgba[i + 2] = 210; }
  const o = tafelWeiss(rgba, w, h);
  assert.ok(o[(5 * w + 5) * 4] > 245, "Tafel → weiß"); assert.ok(o[(53 * w + 80) * 4] < 70, "Kreide → dunkel");
});
test("Mehrere Bilder mitteln, verwackelte Bilder weglassen", () => {
  const w = 40, h = 30, mk = (v) => { const a = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < a.length; i++) a[i] = v + ((i * 37) % 7) - 3; return a; };
  const anders = new Uint8ClampedArray(w * h * 4).fill(0);
  const r = bilderMitteln([mk(120), mk(122), mk(118), anders], w, h);
  assert.equal(r.anzahl, 3); assert.ok(Math.abs(r.daten[0] - 120) < 4);
});
console.log(ok + " Tests bestanden.");
