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

// Sucht das Blatt: größte helle Fläche, die nicht den Bildrand berührt (zu viel).
// Gibt 4 Ecken zurück [oben links, oben rechts, unten rechts, unten links] oder null.
export function findeBlatt(g, w, h) {
  const s = otsu(g);
  // Mindest-Kontrast: Papier muss sich vom Hintergrund abheben
  let hell = 0, dunkel = 0, nh = 0, nd = 0;
  for (let i = 0; i < g.length; i++) { if (g[i] > s) { hell += g[i]; nh++; } else { dunkel += g[i]; nd++; } }
  if (!nh || !nd || hell / nh - dunkel / nd < 40) return null;

  const marke = new Int32Array(w * h).fill(-1);
  const stapel = new Int32Array(w * h);
  let bestePix = null, besteAnzahl = 0;
  for (let start = 0; start < g.length; start++) {
    if (marke[start] !== -1 || g[start] <= s) continue;
    let n = 0, top = 0, randPixel = 0;
    stapel[top++] = start; marke[start] = start;
    const pix = [];
    while (top) {
      const p = stapel[--top]; pix.push(p); n++;
      const x = p % w, y = (p / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) randPixel++;
      if (x > 0 && marke[p - 1] === -1 && g[p - 1] > s) { marke[p - 1] = start; stapel[top++] = p - 1; }
      if (x < w - 1 && marke[p + 1] === -1 && g[p + 1] > s) { marke[p + 1] = start; stapel[top++] = p + 1; }
      if (y > 0 && marke[p - w] === -1 && g[p - w] > s) { marke[p - w] = start; stapel[top++] = p - w; }
      if (y < h - 1 && marke[p + w] === -1 && g[p + w] > s) { marke[p + w] = start; stapel[top++] = p + w; }
    }
    // Fläche, die fast überall am Rand klebt, ist eher heller Hintergrund als ein Blatt
    if (randPixel > (w + h) * 0.9) continue;
    if (n > besteAnzahl) { besteAnzahl = n; bestePix = pix; }
  }
  if (!bestePix || besteAnzahl < w * h * 0.12) return null;

  // Ecken: Extrempunkte entlang der Diagonalen
  let ol = null, or = null, ur = null, ul = null;
  let mOl = Infinity, mOr = -Infinity, mUr = -Infinity, mUl = Infinity;
  for (const p of bestePix) {
    const x = p % w, y = (p / w) | 0;
    if (x + y < mOl) { mOl = x + y; ol = { x, y }; }
    if (x + y > mUr) { mUr = x + y; ur = { x, y }; }
    if (x - y > mOr) { mOr = x - y; or = { x, y }; }
    if (x - y < mUl) { mUl = x - y; ul = { x, y }; }
  }
  const ecken = [ol, or, ur, ul];
  const a = flaeche(ecken);
  if (a < w * h * 0.12) return null;
  // Das Viereck muss gut gefüllt sein, sonst ist es keine Blatt-Form
  if (besteAnzahl / a < 0.82 || besteAnzahl / a > 1.15) return null;
  return ecken;
}

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

// Schatten weg, Papier weiß. stufe: "normal" (Graustufen, weiches Ergebnis) | "stark" (nur Schwarz/Weiß)
// Gibt Graustufen zurück.
export function papierweiss(g, w, h, stufe = "normal") {
  const I = integral(g, w, h), r = Math.max(8, Math.round(Math.min(w, h) / 24));
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const y1 = Math.max(0, y - r), y2 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - r), x2 = Math.min(w, x + r + 1);
      const summe = I[y2 * (w + 1) + x2] - I[y1 * (w + 1) + x2] - I[y2 * (w + 1) + x1] + I[y1 * (w + 1) + x1];
      const mittel = summe / ((x2 - x1) * (y2 - y1));
      const v = g[y * w + x];
      if (stufe === "stark") { out[y * w + x] = v < mittel * 0.86 ? 0 : 255; continue; }
      // Helligkeit durch die Umgebung teilen: Schatten verschwinden, Schrift bleibt dunkel
      let n = (v / Math.max(mittel, 1)) * 255;
      n = n > 232 ? 255 : n * n / 232 * 0.92; // Papier ganz weiß, Schrift kräftiger
      out[y * w + x] = n;
    }
  }
  return out;
}

// Graustufen → RGBA (für das Canvas)
export function graustufenZuRgba(g) {
  const out = new Uint8ClampedArray(g.length * 4);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) { out[j] = out[j + 1] = out[j + 2] = g[i]; out[j + 3] = 255; }
  return out;
}
