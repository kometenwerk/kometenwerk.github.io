// FIDELIA Notizen · Formen und Geometrie für den Stift (ohne Browser testbar)
// - Formen-Erkennung: krakeliger Kreis/Dreieck/Rechteck/Linie → saubere Form
// - Lasso: liegt ein Strich in der Schlinge?
// - Verschieben, Drehen, Vergrößern von Strichen
// - Lineal/Geodreieck: Punkte auf eine Kante ziehen
// Punkte sind [x, y, druck] in Millimetern.

const abst = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function laenge(p) { let l = 0; for (let i = 1; i < p.length; i++) l += abst(p[i - 1], p[i]); return l; }

// Abstand eines Punktes zu einer Strecke a–b
export function abstandZurStrecke(q, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  if (!l2) return abst(q, a);
  const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2));
  return Math.hypot(q[0] - (a[0] + t * dx), q[1] - (a[1] + t * dy));
}

// Ramer-Douglas-Peucker: Linie vereinfachen (Ecken finden)
export function vereinfachen(p, eps) {
  if (p.length < 3) return p.slice();
  let max = 0, idx = 0;
  for (let i = 1; i < p.length - 1; i++) { const d = abstandZurStrecke(p[i], p[0], p[p.length - 1]); if (d > max) { max = d; idx = i; } }
  if (max <= eps) return [p[0], p[p.length - 1]];
  const l = vereinfachen(p.slice(0, idx + 1), eps), r = vereinfachen(p.slice(idx), eps);
  return l.slice(0, -1).concat(r);
}

// Gerade Strecke in viele Punkte (damit der Stift-Zeichner glatt malt)
function strecke(a, b, druck = 0.5) {
  const n = Math.max(2, Math.ceil(abst(a, b) / 2)), out = [];
  for (let i = 0; i <= n; i++) out.push([r1(a[0] + (b[0] - a[0]) * i / n), r1(a[1] + (b[1] - a[1]) * i / n), druck]);
  return out;
}
function polygon(ecken, druck) {
  let out = [];
  for (let i = 0; i < ecken.length; i++) { const s = strecke(ecken[i], ecken[(i + 1) % ecken.length], druck); out = out.concat(i ? s.slice(1) : s); }
  return out;
}
const r1 = (n) => Math.round(n * 10) / 10;

// Fast waagerecht/senkrecht? Dann ganz gerade (bis 6°)
function einrasten(a, b) {
  const w = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
  for (const z of [0, 90, 180, -90, -180]) {
    if (Math.abs(w - z) < 6) {
      return z === 0 || Math.abs(z) === 180 ? [a, [b[0], a[1]]] : [a, [a[0], b[1]]];
    }
  }
  return [a, b];
}

// Erkennt eine Form. Gibt { form, p } zurück oder null, wenn es keine klare Form ist.
export function formErkennen(p) {
  if (!p || p.length < 6) return null;
  const L = laenge(p);
  if (L < 8) return null;
  const druck = p.reduce((s, q) => s + (q[2] == null ? 0.5 : q[2]), 0) / p.length;
  const a = p[0], e = p[p.length - 1];
  // Linie: alle Punkte nah an der Verbindung Anfang–Ende
  let maxAbw = 0;
  for (const q of p) maxAbw = Math.max(maxAbw, abstandZurStrecke(q, a, e));
  if (maxAbw < Math.max(1.2, L * 0.035) && abst(a, e) > L * 0.85) {
    const [x, y] = einrasten(a, e);
    return { form: "linie", p: strecke(x, y, druck) };
  }
  // Geschlossene Formen: Ende nah am Anfang
  const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const diag = Math.hypot(maxX - minX, maxY - minY);
  if (abst(a, e) > Math.max(10, diag * 0.3)) return null;
  // Ecken suchen
  let ecken = vereinfachen(p, diag * 0.08);
  if (ecken.length > 2 && abst(ecken[0], ecken[ecken.length - 1]) < diag * 0.25) ecken = ecken.slice(0, -1);
  // Ecken, die fast auf einer Linie liegen, entfernen
  ecken = ecken.filter((q, i) => {
    const v = ecken[(i - 1 + ecken.length) % ecken.length], n = ecken[(i + 1) % ecken.length];
    return abstandZurStrecke(q, v, n) > diag * 0.06;
  });
  // Kreis/Ellipse: Abstand zur Mitte fast gleich
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, rx = (maxX - minX) / 2, ry = (maxY - minY) / 2;
  const norm = p.map(q => Math.hypot((q[0] - cx) / (rx || 1), (q[1] - cy) / (ry || 1)));
  const mittel = norm.reduce((s, x) => s + x, 0) / norm.length;
  const streu = Math.sqrt(norm.reduce((s, x) => s + (x - mittel) ** 2, 0) / norm.length);
  const rund = streu / mittel < 0.09 && ecken.length !== 3;
  if (rund) {
    let RX = rx, RY = ry;
    if (Math.abs(rx - ry) / Math.max(rx, ry) < 0.15) RX = RY = (rx + ry) / 2;
    const n = 72, out = [];
    for (let i = 0; i <= n; i++) { const w = i / n * Math.PI * 2; out.push([r1(cx + RX * Math.cos(w)), r1(cy + RY * Math.sin(w)), druck]); }
    return { form: RX === RY ? "kreis" : "ellipse", p: out };
  }
  if (ecken.length === 3) return { form: "dreieck", p: polygon(ecken, druck) };
  if (ecken.length === 4) {
    // Fast achsenparallel? Dann echtes Rechteck
    const winkel = Math.abs(Math.atan2(ecken[1][1] - ecken[0][1], ecken[1][0] - ecken[0][0]) * 180 / Math.PI) % 90;
    if (winkel < 8 || winkel > 82) return { form: "rechteck", p: polygon([[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]], druck) };
    return { form: "viereck", p: polygon(ecken, druck) };
  }
  if (ecken.length >= 5 && ecken.length <= 8) return { form: "vieleck", p: polygon(ecken, druck) };
  return null;
}

// Textmarker gerade ziehen (über eine Zeile)
export function markerGerade(p) {
  if (p.length < 2) return p;
  const a = p[0], e = p[p.length - 1], dx = Math.abs(e[0] - a[0]), dy = Math.abs(e[1] - a[1]);
  if (dx < 10 || dy > dx * 0.25) return p;
  const y = r1(p.reduce((s, q) => s + q[1], 0) / p.length);
  return [[a[0], y, 0.5], [e[0], y, 0.5]];
}

/* ---------- Lasso ---------- */

export function punktImPolygon(q, poly) {
  let drin = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > q[1]) !== (yj > q[1]) && q[0] < (xj - xi) * (q[1] - yi) / (yj - yi) + xi) drin = !drin;
  }
  return drin;
}
// Welche Striche liegen (überwiegend) in der Schlinge?
export function imLasso(striche, poly) {
  const out = [];
  striche.forEach((st, i) => {
    const n = st.p.filter(q => punktImPolygon(q, poly)).length;
    if (n && n / st.p.length >= 0.6) out.push(i);
  });
  return out;
}
export function rahmen(striche) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const st of striche) for (const q of st.p) { minX = Math.min(minX, q[0]); minY = Math.min(minY, q[1]); maxX = Math.max(maxX, q[0]); maxY = Math.max(maxY, q[1]); }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}
// Verschieben (dx, dy), vergrößern (s um Mitte), drehen (w in Grad um Mitte)
export function umformen(st, { dx = 0, dy = 0, s = 1, w = 0, cx = 0, cy = 0 }) {
  const b = w * Math.PI / 180, c = Math.cos(b), si = Math.sin(b);
  return Object.assign({}, st, {
    b: st.art === "marker" ? st.b * s : st.b,
    p: st.p.map(q => {
      let x = (q[0] - cx) * s, y = (q[1] - cy) * s;
      const xr = x * c - y * si, yr = x * si + y * c;
      return [r1(xr + cx + dx), r1(yr + cy + dy), q[2]];
    })
  });
}

/* ---------- Lineal und Geodreieck ---------- */

// Kanten eines Werkzeugs in Seiten-Millimetern. werkzeug = { art: "lineal"|"geo", x, y, w (Grad) }
export function kanten(wz) {
  const b = wz.w * Math.PI / 180, c = Math.cos(b), s = Math.sin(b);
  const t = (px, py) => [wz.x + px * c - py * s, wz.y + px * s + py * c];
  if (wz.art === "lineal") {
    const L = 160, H = 30;
    return [[t(0, 0), t(L, 0)], [t(0, H), t(L, H)]];
  }
  // Geodreieck: Hypotenuse 160 mm unten, Spitze 80 mm darüber
  const L = 160, H = 80;
  return [[t(0, H), t(L, H)], [t(0, H), t(L / 2, 0)], [t(L, H), t(L / 2, 0)]];
}
// Kante in der Nähe des Punktes (bis maxAbstand mm) oder null
export function naechsteKante(q, liste, maxAbstand = 5) {
  let best = null, bd = maxAbstand;
  for (const k of liste) { const d = abstandZurStrecke(q, k[0], k[1]); if (d < bd) { bd = d; best = k; } }
  return best;
}
// Punkt auf die Gerade der Kante ziehen
export function aufKante(q, k) {
  const [a, b] = k, dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2;
  return [r1(a[0] + t * dx), r1(a[1] + t * dy), q[2]];
}

/* ---------- Zirkel ---------- */
// Kürzeste Drehung von a nach b in Grad (-180 … 180)
export const winkelDelta = (a, b) => { let d = (b - a) % 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; };
// Punkte eines Kreisbogens um (cx, cy) mit Radius r von Winkel „von“ bis „bis“ (Grad, mathematisch: 0 = rechts, im Uhrzeigersinn auf dem Bildschirm)
export function zirkelBogen(cx, cy, r, von, bis, schritt = 2) {
  const n = Math.max(1, Math.ceil(Math.abs(bis - von) / schritt)), out = [];
  for (let i = 0; i <= n; i++) { const w = (von + (bis - von) * i / n) * Math.PI / 180; out.push([Math.round((cx + r * Math.cos(w)) * 10) / 10, Math.round((cy + r * Math.sin(w)) * 10) / 10, 0.5]); }
  return out;
}
// Scharnier des Zirkels (nur fürs Bild): über der Mitte zwischen Nadel und Mine
export function zirkelScharnier(cx, cy, r, w, bein = 70) {
  const b = w * Math.PI / 180, px = cx + r * Math.cos(b), py = cy + r * Math.sin(b), mx = (cx + px) / 2, my = (cy + py) / 2;
  const h = Math.sqrt(Math.max(36, bein * bein - (r / 2) * (r / 2)));
  let ox = h * Math.sin(b), oy = -h * Math.cos(b);
  if (oy > 0 || (oy === 0 && ox > 0)) { ox = -ox; oy = -oy; } // Scharnier immer nach oben
  return { mine: [px, py], oben: [mx + ox, my + oy] };
}
