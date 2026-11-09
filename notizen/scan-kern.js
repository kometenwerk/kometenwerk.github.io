// FIDELIA Notizen · Scan-Kern
// Reine Rechen-Funktionen für den Smart-Scanner (ohne Browser testbar):
// Blatt finden, Ruhe erkennen, Bild gerade ziehen, Schatten entfernen.

// RGBA-Pixel → Graustufen (0–255)
export function grau(rgba, w, h) {
  const g = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8;
  return g;
}

// Otsu: bester Schwellwert zwischen hell (Papier) und dunkel (Tisch)
export function otsu(g) {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < g.length; i++) hist[g[i]]++;
  let summe = 0;
  for (let i = 0; i < 256; i++) summe += i * hist[i];
  let sB = 0, wB = 0, best = 0, schwelle = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = g.length - wB;
    if (!wF) break;
    sB += t * hist[t];
    const mB = sB / wB, mF = (summe - sB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > best) { best = v; schwelle = t; }
  }
  return schwelle;
}

// Fläche eines Vierecks (Ecken in Reihenfolge)
export function flaeche(e) {
  let a = 0;
  for (let i = 0; i < 4; i++) { const p = e[i], q = e[(i + 1) % 4]; a += p.x * q.y - q.x * p.y; }
  return Math.abs(a) / 2;
}

/* ---------- Blatt finden (Version 2) ----------
   1. Maske: hell UND farblos (Papier ist weiß/grau – eine gelbe Tür oder Haut nicht) UND keine starke Kante
      (so wird das Blatt von einer hellen Wand dahinter abgetrennt).
   2. Löcher durch Schrift schließen, Flächen finden.
   3. Für jede große Fläche: Umriss (konvexe Hülle) → bestes Viereck darin.
   4. Prüfen, ob das Viereck wirklich wie ein Blatt aussieht (Winkel, Seitenverhältnis, gefüllt, Ecken im Bild). */

function sobel(g, w, h) {
  const m = new Uint16Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const gx = -g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1] + g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1];
    const gy = -g[i - w - 1] - 2 * g[i - w] - g[i - w + 1] + g[i + w - 1] + 2 * g[i + w] + g[i + w + 1];
    m[i] = Math.min(65535, Math.abs(gx) + Math.abs(gy));
  }
  return m;
}
// Morphologie auf 0/1-Maske (r = Radius, quadratisch, getrennt in x und y)
function morph(m, w, h, r, dehnen) {
  const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = dehnen ? 0 : 1;
    for (let d = -r; d <= r; d++) { const xx = Math.min(w - 1, Math.max(0, x + d)); if (dehnen ? m[y * w + xx] : !m[y * w + xx]) { v = dehnen ? 1 : 0; break; } }
    tmp[y * w + x] = v;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = dehnen ? 0 : 1;
    for (let d = -r; d <= r; d++) { const yy = Math.min(h - 1, Math.max(0, y + d)); if (dehnen ? tmp[yy * w + x] : !tmp[yy * w + x]) { v = dehnen ? 1 : 0; break; } }
    out[y * w + x] = v;
  }
  return out;
}
const kreuz = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
function huelle(pts) {
  pts = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const unten = [], oben = [];
  for (const p of pts) { while (unten.length >= 2 && kreuz(unten[unten.length - 2], unten[unten.length - 1], p) <= 0) unten.pop(); unten.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (oben.length >= 2 && kreuz(oben[oben.length - 2], oben[oben.length - 1], p) <= 0) oben.pop(); oben.push(p); }
  return unten.slice(0, -1).concat(oben.slice(0, -1));
}
const dreieck = (a, b, c) => Math.abs(kreuz(a, b, c)) / 2;
// Größtes Viereck aus Punkten der Hülle (O(n³), n ≤ 60)
export function bestesViereck(h) {
  if (h.length < 4) return null;
  if (h.length > 60) { const s = h.length / 60; h = Array.from({ length: 60 }, (_, i) => h[Math.floor(i * s)]); }
  const n = h.length;
  let best = 0, quad = null;
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    let a1 = 0, k1 = -1; for (let k = i + 1; k < j; k++) { const a = dreieck(h[i], h[k], h[j]); if (a > a1) { a1 = a; k1 = k; } }
    let a2 = 0, l1 = -1; for (let l = j + 1; l < n + i; l++) { const a = dreieck(h[i], h[j], h[l % n]); if (a > a2) { a2 = a; l1 = l % n; } }
    if (k1 >= 0 && l1 >= 0 && a1 + a2 > best) { best = a1 + a2; quad = [h[i], h[k1], h[j], h[l1]]; }
  }
  return quad;
}
// Ecken sortieren: oben links, oben rechts, unten rechts, unten links
export function sortiereEcken(q) {
  const cx = q.reduce((s, p) => s + p.x, 0) / 4, cy = q.reduce((s, p) => s + p.y, 0) / 4;
  const r = q.slice().sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  let start = 0; r.forEach((p, i) => { if (p.x + p.y < r[start].x + r[start].y) start = i; });
  return r.slice(start).concat(r.slice(0, start)).map(p => ({ x: p.x, y: p.y }));
}
// Sieht das Viereck wie ein (evtl. schräg gehaltenes) Blatt aus?
export function blattFoermig(e) {
  for (let i = 0; i < 4; i++) {
    const a = e[(i + 3) % 4], b = e[i], c = e[(i + 1) % 4];
    const v1x = a.x - b.x, v1y = a.y - b.y, v2x = c.x - b.x, v2y = c.y - b.y;
    const w = Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y) || 1)))) * 180 / Math.PI;
    if (w < 45 || w > 135) return false;
  }
  const s = [0, 1, 2, 3].map(i => Math.hypot(e[(i + 1) % 4].x - e[i].x, e[(i + 1) % 4].y - e[i].y));
  const a = (s[0] + s[2]) / 2, b = (s[1] + s[3]) / 2, v = Math.max(a, b) / Math.max(1, Math.min(a, b));
  return v >= 1.0 && v <= 2.3;
}

// Hauptfunktion. rgba ODER grau (dann kanaele = 1). Gibt { ecken, hinweis } – hinweis: "" | "kein" | "klein" | "rand"
export function analysiereBlatt(daten, w, h, kanaele = 4) {
  const g = kanaele === 4 ? grau(daten, w, h) : daten;
  const sat = new Uint8Array(w * h);
  if (kanaele === 4) {
    // Weißabgleich: die hellsten Stellen (meist das Papier) sollen neutral sein – sonst wirkt Papier unter Lampenlicht „gelb“
    const hist = new Uint32Array(256); for (let j = 0; j < g.length; j++) hist[g[j]]++;
    let grenze = 255, z = 0; while (grenze > 0 && z < g.length * 0.08) z += hist[grenze--];
    let sr = 0, sg = 0, sb = 0, n = 0;
    for (let i = 0, j = 0; j < g.length; i += 4, j++) if (g[j] > grenze) { sr += daten[i]; sg += daten[i + 1]; sb += daten[i + 2]; n++; }
    const m = n ? (sr + sg + sb) / (3 * n) : 1, kr = n && sr ? m * n / sr : 1, kg = n && sg ? m * n / sg : 1, kb = n && sb ? m * n / sb : 1;
    const f = (k) => Math.max(0.6, Math.min(1.7, k));
    const ar = f(kr), ag = f(kg), ab = f(kb);
    for (let i = 0, j = 0; j < sat.length; i += 4, j++) { const r = daten[i] * ar, gg = daten[i + 1] * ag, b = daten[i + 2] * ab; sat[j] = Math.min(255, Math.max(r, gg, b) - Math.min(r, gg, b)); }
  }
  const kanten = sobel(g, w, h);
  const s = otsu(g);
  let hell = 0, dunkel = 0, nh = 0, nd = 0;
  for (let i = 0; i < g.length; i++) { if (g[i] > s) { hell += g[i]; nh++; } else { dunkel += g[i]; nd++; } }
  if (!nh || !nd || hell / nh - dunkel / nd < 35) return { ecken: null, hinweis: "kein" };
  // Mehrere Helligkeits-Schwellen probieren: Ist eine helle Wand hinter dem Blatt, trennt erst eine höhere Schwelle die beiden
  const schwellen = [s];
  for (let i = 0; i < 2; i++) { const o = otsuUeber(g, schwellen[schwellen.length - 1]); if (o > schwellen[schwellen.length - 1] + 6) schwellen.push(o); }
  let bestes = null, hinweis = "kein";
  for (const sw of schwellen) {
    const r = versuch(g, sat, kanten, w, h, sw);
    if (r.hinweis !== "kein" && (hinweis === "kein" || r.hinweis === "rand")) hinweis = r.hinweis;
    if (r.bestes && (!bestes || r.bestes.punkte > bestes.punkte)) bestes = r.bestes;
  }
  if (!bestes) return { ecken: null, hinweis };
  return { ecken: bestes.e, hinweis: bestes.a < w * h * 0.2 ? "klein" : "" };
}

// Otsu nur über den Pixeln heller als „ab“
function otsuUeber(g, ab) {
  const hist = new Array(256).fill(0); let n = 0;
  for (let i = 0; i < g.length; i++) if (g[i] > ab) { hist[g[i]]++; n++; }
  if (n < 100) return ab;
  let summe = 0; for (let i = 0; i < 256; i++) summe += i * hist[i];
  let sB = 0, wB = 0, best = 0, schwelle = ab;
  for (let t = ab + 1; t < 256; t++) {
    wB += hist[t]; if (!wB) continue; const wF = n - wB; if (!wF) break;
    sB += t * hist[t]; const mB = sB / wB, mF = (summe - sB) / wF, v = wB * wF * (mB - mF) ** 2;
    if (v > best) { best = v; schwelle = t; }
  }
  return schwelle;
}

function versuch(g, sat, kanten, w, h, s) {
  let m = new Uint8Array(w * h);
  for (let i = 0; i < g.length; i++) m[i] = g[i] > s && sat[i] < Math.max(40, g[i] * 0.22) && kanten[i] < 160 ? 1 : 0;
  // Schrift-Löcher schließen (dehnen, dann schrumpfen)
  const r = Math.max(1, Math.round(w / 160));
  m = morph(morph(m, w, h, r, true), w, h, r + 1, false);
  const marke = new Int32Array(w * h).fill(-1), stapel = new Int32Array(w * h), flaechen = [];
  for (let start = 0; start < m.length; start++) {
    if (!m[start] || marke[start] !== -1) continue;
    let top = 0, n = 0; stapel[top++] = start; marke[start] = start;
    const links = new Int32Array(h).fill(w), rechts = new Int32Array(h).fill(-1);
    while (top) {
      const p = stapel[--top], x = p % w, y = (p / w) | 0; n++;
      if (x < links[y]) links[y] = x; if (x > rechts[y]) rechts[y] = x;
      if (x > 0 && m[p - 1] && marke[p - 1] === -1) { marke[p - 1] = start; stapel[top++] = p - 1; }
      if (x < w - 1 && m[p + 1] && marke[p + 1] === -1) { marke[p + 1] = start; stapel[top++] = p + 1; }
      if (y > 0 && m[p - w] && marke[p - w] === -1) { marke[p - w] = start; stapel[top++] = p - w; }
      if (y < h - 1 && m[p + w] && marke[p + w] === -1) { marke[p + w] = start; stapel[top++] = p + w; }
    }
    if (n >= w * h * 0.06) flaechen.push({ n, links, rechts });
  }
  if (!flaechen.length) return { bestes: null, hinweis: "kein" };
  flaechen.sort((a, b) => b.n - a.n);
  let bestes = null, hinweis = "kein";
  for (const f of flaechen.slice(0, 4)) {
    const pts = []; let gefuellt = 0;
    for (let y = 0; y < h; y++) if (f.rechts[y] >= 0) { pts.push({ x: f.links[y], y }, { x: f.rechts[y] + 1, y: y + 1 }); gefuellt += f.rechts[y] - f.links[y] + 1; }
    const q = bestesViereck(huelle(pts));
    if (!q) continue;
    const e = sortiereEcken(q), a = flaeche(e);
    if (a < w * h * 0.08) { if (hinweis === "kein") hinweis = "klein"; continue; }
    if (gefuellt / a < 0.84 || gefuellt / a > 1.12 || !blattFoermig(e)) continue;
    if (e.some(p => p.x <= 1 || p.y <= 1 || p.x >= w - 2 || p.y >= h - 2)) { hinweis = "rand"; continue; }
    const punkte = a * (gefuellt / a > 1 ? 2 - gefuellt / a : gefuellt / a);
    if (!bestes || punkte > bestes.punkte) bestes = { e, a, punkte };
  }
  return { bestes, hinweis };
}

// Alte Schnittstelle (Graustufen) – für Tests und als Notlösung
export function findeBlatt(g, w, h) { return analysiereBlatt(g, w, h, 1).ecken; }

// Wie weit haben sich die Ecken bewegt? (Anteil der Bild-Diagonale, 0 = gar nicht)
export function bewegung(a, b, w, h) {
  if (!a || !b) return Infinity;
  const d = Math.hypot(w, h);
  let m = 0;
  for (let i = 0; i < 4; i++) m = Math.max(m, Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y));
  return m / d;
}

// Merkt sich, ob das Blatt ruhig liegt. ruhe.neu(ecken, zeit) → true, sobald es lange genug ruhig ist.
export function ruheMesser(w, h, { dauer = 1000, toleranz = 0.02 } = {}) {
  let letzte = null, seit = 0;
  return {
    neu(ecken, zeit) {
      if (!ecken) { letzte = null; seit = 0; return false; }
      if (!letzte || bewegung(ecken, letzte, w, h) > toleranz) { letzte = ecken; seit = zeit; return false; }
      return zeit - seit >= dauer;
    },
    fortschritt(zeit) { return letzte ? Math.min(1, (zeit - seit) / dauer) : 0; },
    zuruecksetzen() { letzte = null; seit = 0; }
  };
}

// Viereck etwas nach innen ziehen, damit kein Tischrand mit aufs Bild kommt
export function einruecken(e, anteil) {
  const mx = (e[0].x + e[1].x + e[2].x + e[3].x) / 4, my = (e[0].y + e[1].y + e[2].y + e[3].y) / 4;
  return e.map(p => ({ x: p.x + (mx - p.x) * anteil, y: p.y + (my - p.y) * anteil }));
}

// DIN-A4-Größe passend zur Lage des Blatts (hoch oder quer), Seitenverhältnis 1 : 1,414
export function a4Groesse(e, lang = 1754) {
  const breite = (Math.hypot(e[1].x - e[0].x, e[1].y - e[0].y) + Math.hypot(e[2].x - e[3].x, e[2].y - e[3].y)) / 2;
  const hoehe = (Math.hypot(e[3].x - e[0].x, e[3].y - e[0].y) + Math.hypot(e[2].x - e[1].x, e[2].y - e[1].y)) / 2;
  const kurz = Math.round(lang / Math.SQRT2);
  return breite > hoehe ? { w: lang, h: kurz, quer: true } : { w: kurz, h: lang, quer: false };
}

// Gleichungssystem lösen (Gauß), für die Perspektive
function loese(A, b) {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let max = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[max][i])) max = r;
    [A[i], A[max]] = [A[max], A[i]]; [b[i], b[max]] = [b[max], b[i]];
    if (Math.abs(A[i][i]) < 1e-12) return null;
    for (let r = i + 1; r < n; r++) {
      const f = A[r][i] / A[i][i];
      for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c];
    x[i] = s / A[i][i];
  }
  return x;
}

// Perspektive: rechnet einen Punkt im geraden Bild in einen Punkt im Kamerabild um
export function perspektive(von, nach) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = von[i], { x: u, y: v } = nach[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = loese(A, b);
  if (!h) return null;
  return (x, y) => {
    const z = h[6] * x + h[7] * y + 1;
    return { x: (h[0] * x + h[1] * y + h[2]) / z, y: (h[3] * x + h[4] * y + h[5]) / z };
  };
}

// Zieht das Blatt gerade. quelle: RGBA (sw × sh), ecken im Kamerabild → neues RGBA (zw × zh)
export function geradeZiehen(quelle, sw, sh, ecken, zw, zh) {
  const ziel = [{ x: 0, y: 0 }, { x: zw - 1, y: 0 }, { x: zw - 1, y: zh - 1 }, { x: 0, y: zh - 1 }];
  const f = perspektive(ziel, ecken);
  const out = new Uint8ClampedArray(zw * zh * 4);
  if (!f) return out;
  for (let y = 0; y < zh; y++) {
    for (let x = 0; x < zw; x++) {
      const p = f(x, y);
      const x0 = Math.floor(p.x), y0 = Math.floor(p.y), o = (y * zw + x) * 4;
      if (x0 < 0 || y0 < 0 || x0 >= sw - 1 || y0 >= sh - 1) { out[o] = out[o + 1] = out[o + 2] = 255; out[o + 3] = 255; continue; }
      const fx = p.x - x0, fy = p.y - y0;
      const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
      for (let k = 0; k < 3; k++) {
        const a = quelle[i00 + k] + (quelle[i10 + k] - quelle[i00 + k]) * fx;
        const c = quelle[i01 + k] + (quelle[i11 + k] - quelle[i01 + k]) * fx;
        out[o + k] = a + (c - a) * fy;
      }
      out[o + 3] = 255;
    }
  }
  return out;
}

// Mittelwerte in einem Fenster schnell berechnen (Integralbild)
function integral(g, w, h) {
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y++) {
    let zeile = 0;
    for (let x = 1; x <= w; x++) { zeile += g[(y - 1) * w + x - 1]; I[y * (w + 1) + x] = I[(y - 1) * (w + 1) + x] + zeile; }
  }
  return I;
}

// Mittelwert der Umgebung für jeden Pixel (Hintergrund-Helligkeit)
function umgebung(g, w, h, r = Math.max(8, Math.round(Math.min(w, h) / 20))) {
  const I = integral(g, w, h);
  const m = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y1 = Math.max(0, y - r), y2 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - r), x2 = Math.min(w, x + r + 1);
      m[y * w + x] = (I[y2 * (w + 1) + x2] - I[y1 * (w + 1) + x2] - I[y2 * (w + 1) + x1] + I[y1 * (w + 1) + x1]) / ((x2 - x1) * (y2 - y1));
    }
  }
  return m;
}
// Hintergrund schätzen: helle Stellen zählen mehr als Schrift (Schrift soll den Hintergrund nicht verdunkeln).
// Wird auf einem verkleinerten Bild gerechnet und dann wieder vergrößert – das ist bei 300 dpi viel schneller.
function hintergrundKlein(g, w, h) {
  const m = umgebung(g, w, h), hell = new Float32Array(g.length);
  for (let i = 0; i < g.length; i++) hell[i] = Math.max(g[i], m[i]);
  return umgebung(hell, w, h);
}
function hintergrund(g, w, h) {
  const f = Math.max(1, Math.round(Math.min(w, h) / 360));
  if (f === 1) return hintergrundKlein(g, w, h);
  const kw = Math.ceil(w / f), kh = Math.ceil(h / f), k = new Float32Array(kw * kh);
  for (let y = 0; y < kh; y++) for (let x = 0; x < kw; x++) {
    let s = 0, n = 0;
    for (let yy = y * f; yy < Math.min(h, y * f + f); yy++) for (let xx = x * f; xx < Math.min(w, x * f + f); xx++) { s += g[yy * w + xx]; n++; }
    k[y * kw + x] = s / n;
  }
  const kb = hintergrundKlein(k, kw, kh), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(kh - 1, Math.max(0, (y + 0.5) / f - 0.5)), y0 = Math.floor(fy), y1 = Math.min(kh - 1, y0 + 1), ay = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(kw - 1, Math.max(0, (x + 0.5) / f - 0.5)), x0 = Math.floor(fx), x1 = Math.min(kw - 1, x0 + 1), ax = fx - x0;
      out[y * w + x] = (kb[y0 * kw + x0] * (1 - ax) + kb[y0 * kw + x1] * ax) * (1 - ay) + (kb[y1 * kw + x0] * (1 - ax) + kb[y1 * kw + x1] * ax) * ay;
    }
  }
  return out;
}

// Wo liegen Papier und Schrift? (nach dem Weißmachen; 1 ≈ Papier) – aus dem Histogramm
function pegel(n) {
  const hist = new Uint32Array(256); let alle = 0;
  for (let i = 0; i < n.length; i += 3) { hist[Math.max(0, Math.min(255, Math.round(n[i] / 1.2 * 255)))]++; alle++; }
  const quantil = (q) => { let s = 0; for (let p = 0; p < 256; p++) { s += hist[p]; if (s >= alle * q) return p / 255 * 1.2; } return 1.2; };
  return { papier: quantil(0.5), tinte: quantil(0.005) };
}
// Helligkeit → schön: Papier ganz weiß, Schrift dunkel und kräftig – auch wenn sie im Foto blass war.
// Wichtig: der Weiß-Punkt richtet sich nach dem Bild selbst, damit blasse Schrift nicht verschwindet.
function stufer(n) {
  const { papier, tinte } = pegel(n), kontrast = papier - tinte;
  if (kontrast < 0.035) return (v) => 255 * Math.min(1, v / Math.max(0.5, papier * 0.96)); // fast leeres Blatt: nur sanft aufhellen
  const weiss = papier - kontrast * 0.22, schwarz = Math.max(0, tinte - kontrast * 0.05);
  return (v) => { if (v >= weiss) return 255; const x = Math.max(0, (v - schwarz) / (weiss - schwarz)); return 255 * Math.pow(x, 1.25); };
}

// Schatten weg, Papier weiß. art: "normal" (Graustufen) | "stark" (nur Schwarz/Weiß). Gibt Graustufen zurück.
export function papierweiss(g, w, h, art = "normal") {
  const bg = hintergrund(g, w, h), out = new Uint8ClampedArray(w * h);
  if (art === "stark") {
    const m = umgebung(g, w, h);
    for (let i = 0; i < g.length; i++) out[i] = g[i] < m[i] * 0.86 && g[i] < bg[i] * 0.8 ? 0 : 255;
    return out;
  }
  const n = new Float32Array(w * h);
  for (let i = 0; i < g.length; i++) n[i] = Math.min(1.2, g[i] / Math.max(bg[i], 1));
  const st = stufer(n);
  for (let i = 0; i < g.length; i++) out[i] = st(n[i]);
  return out;
}

// Wie papierweiß, aber in Farbe: Textmarker, rote Korrekturen und Bilder bleiben farbig.
// Jeder Farbkanal bekommt seinen eigenen Hintergrund → gelbes Lampenlicht oder blaues Tageslicht wird weiß (Weißabgleich).
export function farbeWeiss(rgba, w, h) {
  const n = w * h, kanal = [0, 1, 2].map(k => { const c = new Float32Array(n); for (let i = 0; i < n; i++) c[i] = rgba[i * 4 + k]; return c; });
  const bgs = kanal.map(c => hintergrund(c, w, h));
  const norm = kanal.map((c, k) => { const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = Math.min(1.2, c[i] / Math.max(bgs[k][i], 1)); return o; });
  const hell = new Float32Array(n);
  for (let i = 0; i < n; i++) hell[i] = 0.299 * norm[0][i] + 0.587 * norm[1][i] + 0.114 * norm[2][i];
  // Jeder Kanal einzeln: Papier → weiß, Schrift → kräftig, Farben (Marker, Rotstift) bleiben
  const st = stufer(hell), out = new Uint8ClampedArray(rgba.length);
  for (let i = 0, j = 0; i < n; i++, j += 4) { out[j] = st(norm[0][i]); out[j + 1] = st(norm[1][i]); out[j + 2] = st(norm[2][i]); out[j + 3] = 255; }
  return out;
}

// Tafelbild: dunkle Tafel → weißer Hintergrund, Kreide → dunkle Schrift (farbige Kreide bleibt farbig).
// Helle Whiteboards werden wie Papier behandelt.
export function tafelWeiss(rgba, w, h) {
  const g = grau(rgba, w, h), hist = new Uint32Array(256);
  for (let i = 0; i < g.length; i++) hist[g[i]]++;
  let s = 0, median = 0; for (; median < 256; median++) { s += hist[median]; if (s >= g.length / 2) break; }
  if (median > 120) return farbeWeiss(rgba, w, h); // Whiteboard
  // Kreide-Stärke: wie viel heller als die Tafel drumherum
  const inv = new Float32Array(g.length); for (let i = 0; i < g.length; i++) inv[i] = 255 - g[i];
  const bg = hintergrund(inv, w, h), n = new Float32Array(g.length);
  for (let i = 0; i < g.length; i++) n[i] = Math.min(1.2, inv[i] / Math.max(bg[i], 1));
  const st = stufer(n), out = new Uint8ClampedArray(rgba.length);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) {
    const k = 1 - st(n[i]) / 255; // 0 = Tafel, 1 = Kreide
    const r = rgba[j], gg = rgba[j + 1], b = rgba[j + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), sat = mx ? (mx - mn) / mx : 0;
    let tr = 20, tg = 30, tb = 45; // weiße Kreide → fast schwarz
    if (sat > 0.28 && mx > 60) { const f = 150 / mx; tr = r * f; tg = gg * f; tb = b * f; } // farbige Kreide → kräftige Farbe
    out[j] = 255 + (tr - 255) * k; out[j + 1] = 255 + (tg - 255) * k; out[j + 2] = 255 + (tb - 255) * k; out[j + 3] = 255;
  }
  return out;
}

// Mehrere Video-Bilder zu einem rechnen (weniger Rauschen bei Laptop-Kameras). Bilder mit Bewegung werden ausgelassen.
export function bilderMitteln(bilder, w, h) {
  if (!bilder.length) return null;
  const n = w * h, ref = bilder[0], schritt = Math.max(1, Math.floor(Math.sqrt(n / 20000)));
  const gute = [ref];
  for (let k = 1; k < bilder.length; k++) {
    const b = bilder[k]; let d = 0, z = 0;
    for (let y = 0; y < h; y += schritt) for (let x = 0; x < w; x += schritt) { const i = (y * w + x) * 4; d += Math.abs(b[i] - ref[i]) + Math.abs(b[i + 1] - ref[i + 1]); z += 2; }
    if (d / z < 9) gute.push(b);
  }
  if (gute.length === 1) return { daten: ref, anzahl: 1 };
  const summe = new Float32Array(n * 4);
  for (const b of gute) for (let i = 0; i < summe.length; i++) summe[i] += b[i];
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < out.length; i++) out[i] = summe[i] / gute.length;
  return { daten: out, anzahl: gute.length };
}

// Läuft die Schrift waagerecht oder senkrecht?
// Idee: Wörter einer Zeile verschmelzen beim waagerechten Verwischen zu Balken, dazwischen bleiben leere Streifen.
// Einzelne Rausch-Pünktchen werden vorher entfernt. Rückgabe: "waag" | "senk" | null (zu wenig Text)
export function textRichtung(g, w, h) {
  const rx = Math.round(w * 0.04), ry = Math.round(h * 0.04);
  const roh = new Uint8Array(w * h);
  for (let y = ry; y < h - ry; y++) for (let x = rx; x < w - rx; x++) if (g[y * w + x] < 150) roh[y * w + x] = 1;
  // Pünktchen weg: Tinte braucht mindestens 2 Tinten-Nachbarn
  const m = new Uint8Array(w * h); let tinte = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; if (!roh[i]) continue;
    const n = roh[i - 1] + roh[i + 1] + roh[i - w] + roh[i + w] + roh[i - w - 1] + roh[i - w + 1] + roh[i + w - 1] + roh[i + w + 1];
    if (n >= 2) { m[i] = 1; tinte++; }
  }
  if (tinte < w * h * 0.002) return null;
  // Verwischen entlang einer Richtung und Profil quer dazu messen
  const wert = (waagerecht) => {
    const L = waagerecht ? w : h, Q = waagerecht ? h : w, r = Math.max(2, Math.round(L * 0.02));
    const profil = new Float32Array(Q);
    for (let q = 0; q < Q; q++) {
      let lauf = 0, fenster = 0;
      const an = (l) => waagerecht ? m[q * w + l] : m[l * w + q];
      for (let l = 0; l < Math.min(L, r); l++) fenster += an(l);
      for (let l = 0; l < L; l++) { if (l + r < L) fenster += an(l + r); if (l - r - 1 >= 0) fenster -= an(l - r - 1); if (fenster > 0) lauf++; }
      profil[q] = lauf;
    }
    // Wie viel „leer – voll – leer“ gibt es? Summe der Sprünge, bezogen auf die Höhe der Balken
    let max = 0; for (const v of profil) max = Math.max(max, v);
    if (!max) return 0;
    let spruenge = 0, leer = 0;
    for (let q = 1; q < Q; q++) spruenge += Math.abs(profil[q] - profil[q - 1]);
    for (let q = 0; q < Q; q++) if (profil[q] < max * 0.08) leer++;
    return spruenge / max * (0.3 + leer / Q);
  };
  const wa = wert(true), se = wert(false);
  if (wa > se * 1.25) return "waag";
  if (se > wa * 1.25) return "senk";
  return null;
}

// RGBA-Bild um 90/180/270° im Uhrzeigersinn drehen
export function drehen(rgba, w, h, grad) {
  grad = ((grad % 360) + 360) % 360;
  if (!grad) return { daten: rgba, w, h };
  const nw = grad === 180 ? w : h, nh = grad === 180 ? h : w, out = new Uint8ClampedArray(rgba.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let nx, ny;
    if (grad === 90) { nx = h - 1 - y; ny = x; } else if (grad === 180) { nx = w - 1 - x; ny = h - 1 - y; } else { nx = y; ny = w - 1 - x; }
    const a = (y * w + x) * 4, b = (ny * nw + nx) * 4;
    out[b] = rgba[a]; out[b + 1] = rgba[a + 1]; out[b + 2] = rgba[a + 2]; out[b + 3] = rgba[a + 3];
  }
  return { daten: out, w: nw, h: nh };
}

// Nachschärfen (Unscharf-Maskierung) – macht Schrift knackiger. Für Graustufen oder RGBA (kanaele = 1 oder 4)
export function schaerfen(d, w, h, kanaele = 1, staerke = 0.6) {
  const out = new Uint8ClampedArray(d.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    for (let k = 0; k < Math.min(kanaele, 3); k++) {
      const i = (y * w + x) * kanaele + k;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { out[i] = d[i]; continue; }
      const blur = (d[i - kanaele] + d[i + kanaele] + d[i - w * kanaele] + d[i + w * kanaele] + 4 * d[i]) / 8;
      out[i] = d[i] + (d[i] - blur) * staerke * 2;
    }
    if (kanaele === 4) out[(y * w + x) * 4 + 3] = 255;
  }
  return out;
}

// Wie scharf ist das Bild? (Varianz des Laplace-Filters – je höher, desto schärfer)
export function schaerfe(g, w, h, bereich) {
  const x0 = Math.max(1, bereich ? Math.floor(bereich.x0) : 1), y0 = Math.max(1, bereich ? Math.floor(bereich.y0) : 1);
  const x1 = Math.min(w - 1, bereich ? Math.ceil(bereich.x1) : w - 1), y1 = Math.min(h - 1, bereich ? Math.ceil(bereich.y1) : h - 1);
  let s = 0, s2 = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = y * w + x, l = g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * g[i];
    s += l; s2 += l * l; n++;
  }
  return n ? s2 / n - (s / n) ** 2 : 0;
}

// Graustufen → RGBA (für das Canvas)
export function graustufenZuRgba(g) {
  const out = new Uint8ClampedArray(g.length * 4);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) { out[j] = out[j + 1] = out[j + 2] = g[i]; out[j + 3] = 255; }
  return out;
}

/* ---------- Schärfe-Ampel ---------- */

// Kann man die Schrift lesen? Misst, wie steil die Kanten der Schrift sind (bezogen auf den Kontrast).
// Scharfe Schrift: Hell→Dunkel in 1–2 Pixeln (Wert hoch). Verschwommen: über viele Pixel (Wert niedrig).
// g: Graustufen, bereich: { x0, y0, x1, y1 } (optional). Rückgabe: { kante, kontrast }
export function lesbarkeit(g, w, h, bereich) {
  const x0 = Math.max(1, Math.floor(bereich ? bereich.x0 : 1)), y0 = Math.max(1, Math.floor(bereich ? bereich.y0 : 1));
  const x1 = Math.min(w - 1, Math.ceil(bereich ? bereich.x1 : w - 1)), y1 = Math.min(h - 1, Math.ceil(bereich ? bereich.y1 : h - 1));
  const hist = new Uint32Array(256), grad = new Uint32Array(256); let n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = y * w + x; hist[g[i]]++; n++;
    const gx = Math.abs(g[i + 1] - g[i - 1]) / 2, gy = Math.abs(g[i + w] - g[i - w]) / 2;
    grad[Math.min(255, Math.round(Math.max(gx, gy)))]++;
  }
  if (!n) return { kante: 0, kontrast: 0 };
  const quantil = (hh, q) => { let s = 0; for (let p = 0; p < 256; p++) { s += hh[p]; if (s >= n * q) return p; } return 255; };
  const papier = quantil(hist, 0.6), tinte = quantil(hist, 0.01), kontrast = Math.max(1, papier - tinte);
  return { kante: quantil(grad, 0.997) / kontrast, kontrast };
}
// Ampel: dichte = Pixel pro mm auf dem Blatt, k = lesbarkeit(...)
export function ampel(dichte, k) {
  if (k.kontrast < 25) return { farbe: "rot", grund: "kontrast" };
  if (k.kante < 0.2) return { farbe: "rot", grund: "unscharf" };
  if (dichte < 2.6) return { farbe: "rot", grund: "klein" };
  if (k.kante < 0.3 || dichte < 3.8) return { farbe: "gelb", grund: k.kante < 0.3 ? "unscharf" : "klein" };
  return { farbe: "gruen", grund: "" };
}

/* ---------- Puzzle-Scan: zwei Teilbilder zusammensetzen ---------- */

function verkleinern(g, w, h, f) {
  const kw = Math.max(1, Math.floor(w / f)), kh = Math.max(1, Math.floor(h / f)), out = new Float32Array(kw * kh);
  for (let y = 0; y < kh; y++) for (let x = 0; x < kw; x++) { let s = 0; for (let yy = 0; yy < f; yy++) for (let xx = 0; xx < f; xx++) s += g[(y * f + yy) * w + x * f + xx]; out[y * kw + x] = s / (f * f); }
  return { d: out, w: kw, h: kh };
}
// Wie gut passt b (verschoben um dx,dy, vergrößert um s) auf a? Normierte Korrelation im Überlappungsbereich
function passung(a, b, s, dx, dy, schritt = 1) {
  let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, n = 0;
  for (let y = 0; y < b.h; y += schritt) {
    const ay = Math.round(dy + y * s); if (ay < 0 || ay >= a.h) continue;
    for (let x = 0; x < b.w; x += schritt) {
      const ax = Math.round(dx + x * s); if (ax < 0 || ax >= a.w) continue;
      const va = a.d[ay * a.w + ax], vb = b.d[y * b.w + x];
      sa += va; sb += vb; saa += va * va; sbb += vb * vb; sab += va * vb; n++;
    }
  }
  if (n * schritt * schritt < a.w * a.h * 0.12) return -1;
  const kov = sab / n - (sa / n) * (sb / n), va = saa / n - (sa / n) ** 2, vb = sbb / n - (sb / n) ** 2;
  return va > 1 && vb > 1 ? kov / Math.sqrt(va * vb) : -1;
}
// Findet, wo Bild b (untere Hälfte) in Bild a (obere Hälfte) weitergeht: { s, dx, dy, guete } in Pixeln von a
export function versatzFinden(ga, gb, w, h) {
  const f1 = Math.max(1, Math.round(w / 96)), A1 = verkleinern(ga, w, h, f1), B1 = verkleinern(gb, w, h, f1);
  let best = { g: -2 };
  for (let s = 0.85; s <= 1.151; s += 0.025)
    for (let dy = Math.round(A1.h * 0.15); dy <= A1.h * 0.92; dy++)
      for (let dx = -Math.round(A1.w * 0.2); dx <= A1.w * 0.2; dx++) { const q = passung(A1, B1, s, dx, dy, 2); if (q > best.g) best = { g: q, s, dx, dy }; }
  // Feiner nachsuchen
  const f2 = Math.max(1, Math.round(w / 320)), A2 = verkleinern(ga, w, h, f2), B2 = verkleinern(gb, w, h, f2), r = f1 / f2;
  let fein = { g: -2 };
  for (let s = best.s - 0.02; s <= best.s + 0.0201; s += 0.005)
    for (let dy = Math.round(best.dy * r - r * 1.5); dy <= best.dy * r + r * 1.5; dy++)
      for (let dx = Math.round(best.dx * r - r * 1.5); dx <= best.dx * r + r * 1.5; dx++) { const q = passung(A2, B2, s, dx, dy, 2); if (q > fein.g) fein = { g: q, s, dx, dy }; }
  return { s: fein.s, dx: fein.dx * f2, dy: fein.dy * f2, guete: fein.g };
}
