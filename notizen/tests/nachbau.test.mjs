// Tests für Scan → Word-Seite: node notizen/tests/nachbau.test.mjs
import assert from "node:assert/strict";
import { absaetze, layoutZuHtml, bildRegionen, textZuSeite, grundgroessePt } from "../nachbau.js";
let ok = 0;
function test(n, f) { f(); ok++; console.log("✓ " + n); }
const zeile = (text, x0, y0, x1, h) => ({ text, bbox: { x0, y0, x1, y1: y0 + h }, confidence: 90 });
const block = (...lines) => ({ paragraphs: [{ lines }] });
const W = 2100, H = 2970; // 10 px pro mm
const bloecke = [
  block(zeile("Die Zelle", 700, 150, 1400, 90)),                                // groß + mittig → Überschrift
  block(zeile("Alle Lebewesen bestehen aus Zellen. Sie sind die kleinste", 200, 350, 1900, 45), zeile("Einheit des Lebens.", 200, 410, 800, 45)),
  block(zeile("• Zellkern", 200, 600, 600, 45)), block(zeile("• Zellwand", 200, 660, 600, 45)),
  block(zeile("Seite 3", 1600, 2800, 1900, 45))                                 // rechts
];
test("Absätze werden sortiert und leere Zeilen entfernt", () => {
  const a = absaetze([block(zeile("  ", 0, 0, 10, 10)), ...bloecke]);
  assert.equal(a.length, 5);
  assert.equal(a[0].zeilen[0].text, "Die Zelle");
});
test("Überschrift, Absatz, Liste und rechtsbündig", () => {
  const html = layoutZuHtml(absaetze(bloecke), W, H);
  assert.match(html, /<h1[^>]*text-align:center[^>]*>Die Zelle<\/h1>/);
  assert.match(html, /<p[^>]*>Alle Lebewesen .* kleinste Einheit des Lebens\.<\/p>/);
  assert.match(html, /<ul[^>]*><li>Zellkern<\/li><li>Zellwand<\/li><\/ul>/);
  assert.match(html, /text-align:right[^>]*>Seite 3/);
  assert.match(html, /margin-top:calc\(var\(--u\)\*\d+\)/); // große Lücke vor „Seite 3“
});
test("Kurze Zeilen behalten ihren Umbruch", () => {
  const html = layoutZuHtml(absaetze([block(zeile("Rosen sind rot", 200, 300, 700, 45), zeile("Veilchen sind blau", 200, 360, 1900, 45), zeile("Ende", 200, 420, 400, 45))]), W, H);
  assert.match(html, /Rosen sind rot<br>Veilchen sind blau Ende/);
});
test("Bilder kommen an die richtige Stelle", () => {
  const html = layoutZuHtml(absaetze(bloecke), W, H, 210, [{ x: 500, y: 450, w: 1000, h: 100, src: "data:image/jpeg;base64,AAA" }]);
  assert.ok(html.indexOf("<img") > html.indexOf("Einheit") && html.indexOf("<img") < html.indexOf("Zellkern"));
  assert.match(html, /width:48%/);
});
test("Gefährliche Zeichen werden entschärft", () => {
  const html = layoutZuHtml(absaetze([block(zeile("<script>alert(1)</script>", 200, 300, 900, 45))]), W, H);
  assert.ok(!html.includes("<script>"));
});
test("Grundschriftgröße wird geschätzt", () => assert.ok(Math.abs(grundgroessePt(absaetze(bloecke), W) - 11) <= 1));
test("Zeichnung wird als Bild gefunden, Text nicht", () => {
  const w = 200, h = 280, g = new Uint8ClampedArray(w * h).fill(250);
  for (let x = 20; x < 120; x++) for (let y = 30; y < 34; y++) g[y * w + x] = 20;      // Textzeile
  for (let i = 0; i < 60; i++) { g[(100 + i) * w + 60 + i] = 20; g[(100 + i) * w + 61 + i] = 20; g[(160) * w + 60 + i] = 20; g[(100 + i) * w + 60] = 20; } // Dreieck
  const r = bildRegionen(g, w, h, [{ x0: 20, y0: 30, x1: 120, y1: 34 }]);
  assert.equal(r.length, 1);
  assert.ok(r[0].y > 90 && r[0].y < 100);
});
test("KI-Text wird zur Seite", () => assert.equal(textZuSeite("# Titel\n\nZeile 1\nZeile 2"), "<h1>Titel</h1><p>Zeile 1<br>Zeile 2</p>"));
console.log(ok + " Tests bestanden.");
