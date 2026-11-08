// FIDELIA Notizen · Papierarten
// Jede Papierart wird als SVG in Millimetern gezeichnet und als Hintergrund unter die Seite gelegt –
// so bleibt sie bei jedem Zoom gestochen scharf. Hochformat 210 × 297 mm, Querformat 297 × 210 mm.

const BLAU = "#b9c9e3", BLAU_D = "#93a8cc", ROT = "#ef9a9a", GRAU = "#7d8798", TEXT = "#9aa7bd";

let DICK = 1; // für kleine Vorschaubilder werden Linien kräftiger gezeichnet
const linie = (x1, y1, x2, y2, f = BLAU, b = 0.18) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${f}" stroke-width="${r(b * DICK)}"/>`;
const r = (n) => Math.round(n * 100) / 100;

function liniert(W, H, sp, rand) {
  let s = "";
  for (let y = 20; y <= H - 10; y += sp) s += linie(0, r(y), W, r(y));
  if (rand >= 1) s += linie(25, 0, 25, H, ROT, 0.3);
  if (rand >= 2) s += linie(W - 20, 0, W - 20, H, ROT, 0.3);
  return s;
}
function kariert(W, H, sp, rand) {
  const l = rand >= 1 ? 20 : 0, re = rand >= 2 ? W - 15 : W, o = rand ? 10 : 0, u = rand ? H - 10 : H;
  let s = "";
  for (let x = l; x <= re + 0.01; x += sp) s += linie(r(x), o, r(x), u);
  for (let y = o; y <= u + 0.01; y += sp) s += linie(l, r(y), re, r(y));
  if (rand >= 1) s += linie(l, 0, l, H, ROT, 0.3);
  if (rand >= 2) s += linie(re, 0, re, H, ROT, 0.3);
  return s;
}
function punkte(W, H, sp) {
  let s = "";
  for (let y = sp; y < H; y += sp) for (let x = sp; x < W; x += sp) s += `<circle cx="${r(x)}" cy="${r(y)}" r="${r(0.3 * Math.sqrt(DICK))}" fill="${BLAU_D}"/>`;
  return s;
}
function millimeter(W, H) {
  const o = 10, l = 10, re = W - 10, u = H - 10;
  let s = "";
  for (let x = l, i = 0; x <= re + 0.01; x += 1, i++) s += linie(x, o, x, u, "#e3b98f", i % 10 ? 0.06 : i % 5 ? 0.12 : 0.25);
  for (let y = o, i = 0; y <= u + 0.01; y += 1, i++) s += linie(l, y, re, y, "#e3b98f", i % 10 ? 0.06 : 0.25);
  // 5-mm-Linien etwas kräftiger
  for (let x = l; x <= re + 0.01; x += 5) s += linie(x, o, x, u, "#dca06a", 0.12);
  for (let y = o; y <= u + 0.01; y += 5) s += linie(l, y, re, y, "#dca06a", 0.12);
  return s;
}
function isometrisch(W, H) {
  const sp = 5, dx = sp * Math.sqrt(3) / 2;
  let s = "";
  for (let i = 0, x = 5; x < W; i++, x += dx) for (let y = 5 + (i % 2) * sp / 2; y < H; y += sp) s += `<circle cx="${r(x)}" cy="${r(y)}" r="${r(0.35 * Math.sqrt(DICK))}" fill="${BLAU_D}"/>`;
  return s;
}
function sechsecke(W, H) {
  const a = 5, h = a * Math.sqrt(3);
  let d = "";
  for (let spalte = 0, x = 0; x < W + a; spalte++, x += a * 1.5) {
    for (let y = (spalte % 2) * h / 2; y < H + h; y += h) {
      const p = [0, 1, 2, 3, 4, 5].map(i => { const w = Math.PI / 3 * i; return r(x + a * Math.cos(w)) + "," + r(y + a * Math.sin(w)); });
      d += "M" + p.join("L") + "Z";
    }
  }
  return `<path d="${d}" fill="none" stroke="${BLAU}" stroke-width="${r(0.18 * DICK)}"/>`;
}
function achsen(x0, y0, x1, y1, cx, cy, schritt = 5, beschriften = true) {
  let s = "";
  for (let x = cx; x <= x1 + 0.01; x += schritt) s += linie(r(x), y0, r(x), y1);
  for (let x = cx - schritt; x >= x0 - 0.01; x -= schritt) s += linie(r(x), y0, r(x), y1);
  for (let y = cy; y <= y1 + 0.01; y += schritt) s += linie(x0, r(y), x1, r(y));
  for (let y = cy - schritt; y >= y0 - 0.01; y -= schritt) s += linie(x0, r(y), x1, r(y));
  s += linie(x0, cy, x1, cy, GRAU, 0.35) + linie(cx, y0, cx, y1, GRAU, 0.35);
  s += `<path d="M${x1} ${cy} l-2.5 -1.2 v2.4z M${cx} ${y0} l-1.2 2.5 h2.4z" fill="${GRAU}"/>`;
  s += `<text x="${x1 - 3}" y="${cy + 4}" font-size="3" fill="${GRAU}" font-family="Arial">x</text><text x="${cx + 2}" y="${y0 + 4}" font-size="3" fill="${GRAU}" font-family="Arial">y</text>`;
  if (beschriften) {
    for (let x = cx + 10, n = 1; x < x1 - 4; x += 10, n++) s += `<text x="${r(x)}" y="${cy + 3.6}" font-size="2.4" fill="${TEXT}" text-anchor="middle" font-family="Arial">${n}</text>`;
    for (let x = cx - 10, n = -1; x > x0 + 2; x -= 10, n--) s += `<text x="${r(x)}" y="${cy + 3.6}" font-size="2.4" fill="${TEXT}" text-anchor="middle" font-family="Arial">${n}</text>`;
    for (let y = cy - 10, n = 1; y > y0 + 4; y -= 10, n++) s += `<text x="${cx - 1.5}" y="${r(y + 0.9)}" font-size="2.4" fill="${TEXT}" text-anchor="end" font-family="Arial">${n}</text>`;
    for (let y = cy + 10, n = -1; y < y1 - 2; y += 10, n--) s += `<text x="${cx - 1.5}" y="${r(y + 0.9)}" font-size="2.4" fill="${TEXT}" text-anchor="end" font-family="Arial">${n}</text>`;
  }
  return s;
}
function koordinaten(W, H) { return achsen(10, 10, W - 10, H - 10, W / 2, H / 2); }
function koordinaten4(W, H) {
  const bw = (W - 30) / 2, bh = (H - 30) / 2;
  let s = "";
  for (const [x, y] of [[10, 10], [20 + bw, 10], [10, 20 + bh], [20 + bw, 20 + bh]]) {
    const cx = x + Math.round(bw / 2 / 5) * 5, cy = y + Math.round(bh / 2 / 5) * 5;
    s += achsen(x, y, x + bw, y + bh, cx, cy, 5, true);
  }
  return s;
}
function polar(W, H) {
  const cx = W / 2, cy = H / 2, max = Math.min(W, H) / 2 - 12;
  let s = "";
  for (let rr = 10; rr <= max; rr += 10) s += `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="none" stroke="${BLAU}" stroke-width="${rr % 50 ? 0.18 : 0.3}"/>`;
  for (let w = 0; w < 360; w += 15) {
    const b = w * Math.PI / 180;
    s += linie(cx, cy, r(cx + max * Math.cos(b)), r(cy - max * Math.sin(b)), w % 90 ? BLAU : GRAU, w % 90 ? 0.18 : 0.35);
    if (w % 30 === 0) s += `<text x="${r(cx + (max + 5) * Math.cos(b))}" y="${r(cy - (max + 5) * Math.sin(b) + 1)}" font-size="2.6" fill="${TEXT}" text-anchor="middle" font-family="Arial">${w}°</text>`;
  }
  return s;
}
function system(y, abstand, linien, x0, x1) {
  let s = "";
  for (let i = 0; i < linien; i++) s += linie(x0, r(y + i * abstand), x1, r(y + i * abstand), GRAU, 0.2);
  return s;
}
function noten(W, H, art) {
  const x0 = 15, x1 = W - 12, oben = 22, unten = H - 15;
  let s = "", y = oben;
  if (art === "noten" || art === "notengross") {
    const ab = art === "notengross" ? 2.5 : 2, anzahl = art === "notengross" ? 8 : 12;
    const hoehe = ab * 4, luecke = (unten - oben - anzahl * hoehe) / (anzahl - 1);
    for (let i = 0; i < anzahl; i++, y += hoehe + luecke) s += system(y, ab, 5, x0, x1) + linie(x0, r(y), x0, r(y + hoehe), GRAU, 0.3) + linie(x1, r(y), x1, r(y + hoehe), GRAU, 0.3);
  } else if (art === "klavier") {
    const ab = 2, h = 8, paar = 2 * h + 8, anzahl = Math.floor((unten - oben + 10) / (paar + 10));
    const luecke = (unten - oben - anzahl * paar) / Math.max(1, anzahl - 1);
    for (let i = 0; i < anzahl; i++, y += paar + luecke) {
      s += system(y, ab, 5, x0, x1) + system(y + h + 8, ab, 5, x0, x1);
      s += linie(x0, r(y), x0, r(y + paar), GRAU, 0.35) + linie(x1, r(y), x1, r(y + paar), GRAU, 0.3);
      s += `<path d="M${x0 - 1.5} ${r(y)} q-2.5 ${paar / 4} 0 ${paar / 2} q-2.5 ${paar / 4} 0 ${paar / 2}" fill="none" stroke="${GRAU}" stroke-width="0.45"/>`;
    }
  } else if (art === "tab") {
    const ab = 2.5, h = ab * 5, anzahl = 10, luecke = (unten - oben - anzahl * h) / (anzahl - 1);
    for (let i = 0; i < anzahl; i++, y += h + luecke) {
      s += system(y, ab, 6, x0, x1) + linie(x0, r(y), x0, r(y + h), GRAU, 0.3);
      s += `<text x="${x0 + 1.5}" y="${r(y + h / 2 + 1)}" font-size="3" font-weight="bold" fill="${GRAU}" font-family="Arial">TAB</text>`;
    }
  } else { // Noten + Tabulatur
    const nh = 8, th = 12.5, paar = nh + 5 + th, anzahl = 6, luecke = (unten - oben - anzahl * paar) / (anzahl - 1);
    for (let i = 0; i < anzahl; i++, y += paar + luecke) {
      s += system(y, 2, 5, x0, x1) + system(y + nh + 5, 2.5, 6, x0, x1);
      s += linie(x0, r(y), x0, r(y + paar), GRAU, 0.3);
      s += `<text x="${x0 + 1.5}" y="${r(y + nh + 5 + th / 2 + 1)}" font-size="3" font-weight="bold" fill="${GRAU}" font-family="Arial">TAB</text>`;
    }
  }
  return s;
}
function schreiblern(W, H, u) {
  // Vier Linien pro System: Oberlänge, Mittelband (hellblau), Grundlinie (kräftig), Unterlänge
  let s = "";
  for (let y = 18; y + 3 * u <= H - 10; y += 4 * u) {
    s += `<rect x="0" y="${r(y + u)}" width="${W}" height="${u}" fill="#eef4ff"/>`;
    s += linie(0, r(y), W, r(y), BLAU, 0.15) + linie(0, r(y + u), W, r(y + u), BLAU, 0.18) + linie(0, r(y + 2 * u), W, r(y + 2 * u), BLAU_D, 0.35) + linie(0, r(y + 3 * u), W, r(y + 3 * u), BLAU, 0.15);
  }
  return s + linie(20, 0, 20, H, ROT, 0.3);
}
function cornell(W, H) {
  let s = "";
  for (let y = 33; y <= H - 52; y += 8) s += linie(0, y, W, y);
  s += linie(0, 25, W, 25, BLAU_D, 0.4) + linie(60, 25, 60, H - 48, ROT, 0.35) + linie(0, H - 48, W, H - 48, BLAU_D, 0.4);
  for (let y = H - 40; y <= H - 10; y += 8) s += linie(0, y, W, y);
  s += `<text x="6" y="31" font-size="2.6" fill="${TEXT}" font-family="Arial">Stichworte / Fragen</text><text x="66" y="31" font-size="2.6" fill="${TEXT}" font-family="Arial">Notizen</text>`;
  s += `<text x="6" y="${H - 43}" font-size="2.6" fill="${TEXT}" font-family="Arial">Zusammenfassung</text><text x="6" y="12" font-size="2.6" fill="${TEXT}" font-family="Arial">Thema · Datum</text>`;
  return s;
}
function vokabeln(W, H) {
  let s = "";
  for (let y = 28; y <= H - 10; y += 8) s += linie(0, y, W, y);
  s += linie(W / 2 - 0.6, 12, W / 2 - 0.6, H - 8, ROT, 0.3) + linie(W / 2 + 0.6, 12, W / 2 + 0.6, H - 8, ROT, 0.3);
  s += `<text x="10" y="18" font-size="3" fill="${TEXT}" font-family="Arial">Wort</text><text x="${W / 2 + 8}" y="18" font-size="3" fill="${TEXT}" font-family="Arial">Bedeutung</text>`;
  return s;
}

// Alle Papierarten. zeile/oben/links/rechts: wo getippter Text hingehört (mm)
export const PAPIER = [
  { id: "leer", gruppe: "Leer", name: "Leer", malen: () => "" },
  { id: "lin6", gruppe: "Liniert", name: "Eng (6 mm)", zeile: 6, oben: 20, links: 12, rechts: 12, malen: (W, H) => liniert(W, H, 6, 0) },
  { id: "lin8", gruppe: "Liniert", name: "Normal (8 mm)", zeile: 8, oben: 20, links: 12, rechts: 12, malen: (W, H) => liniert(W, H, 8, 0) },
  { id: "lin10", gruppe: "Liniert", name: "Weit (10 mm)", zeile: 10, oben: 20, links: 12, rechts: 12, malen: (W, H) => liniert(W, H, 10, 0) },
  { id: "lin6-r", gruppe: "Liniert", name: "Eng mit Rand", zeile: 6, oben: 20, links: 28, rechts: 12, malen: (W, H) => liniert(W, H, 6, 1) },
  { id: "lin8-r", gruppe: "Liniert", name: "Normal mit Rand", zeile: 8, oben: 20, links: 28, rechts: 12, malen: (W, H) => liniert(W, H, 8, 1) },
  { id: "lin10-r", gruppe: "Liniert", name: "Weit mit Rand", zeile: 10, oben: 20, links: 28, rechts: 12, malen: (W, H) => liniert(W, H, 10, 1) },
  { id: "lin8-rr", gruppe: "Liniert", name: "Rand beidseitig", zeile: 8, oben: 20, links: 28, rechts: 23, malen: (W, H) => liniert(W, H, 8, 2) },
  { id: "schreib1", gruppe: "Schreiblern-Linien", name: "Klasse 1", zeile: 24, oben: 18, links: 23, rechts: 10, malen: (W, H) => schreiblern(W, H, 6) },
  { id: "schreib2", gruppe: "Schreiblern-Linien", name: "Klasse 2", zeile: 20, oben: 18, links: 23, rechts: 10, malen: (W, H) => schreiblern(W, H, 5) },
  { id: "schreib3", gruppe: "Schreiblern-Linien", name: "Klasse 3", zeile: 16, oben: 18, links: 23, rechts: 10, malen: (W, H) => schreiblern(W, H, 4) },
  { id: "schreib4", gruppe: "Schreiblern-Linien", name: "Klasse 4", zeile: 14, oben: 18, links: 23, rechts: 10, malen: (W, H) => schreiblern(W, H, 3.5) },
  { id: "karo5", gruppe: "Kariert", name: "5 mm", zeile: 10, schrift: 4.2, oben: 10, links: 10, rechts: 10, malen: (W, H) => kariert(W, H, 5, 0) },
  { id: "karo5-r", gruppe: "Kariert", name: "5 mm mit Rand", zeile: 10, schrift: 4.2, oben: 15, links: 25, rechts: 10, malen: (W, H) => kariert(W, H, 5, 1) },
  { id: "karo5-rr", gruppe: "Kariert", name: "5 mm Rand beidseitig", zeile: 10, schrift: 4.2, oben: 15, links: 25, rechts: 20, malen: (W, H) => kariert(W, H, 5, 2) },
  { id: "karo4", gruppe: "Kariert", name: "4 mm", zeile: 8, schrift: 3.9, oben: 8, links: 8, rechts: 8, malen: (W, H) => kariert(W, H, 4, 0) },
  { id: "karo4-r", gruppe: "Kariert", name: "4 mm mit Rand", zeile: 8, schrift: 3.9, oben: 18, links: 24, rechts: 8, malen: (W, H) => kariert(W, H, 4, 1) },
  { id: "karo10", gruppe: "Kariert", name: "1 cm", zeile: 10, schrift: 4.6, oben: 10, links: 10, rechts: 10, malen: (W, H) => kariert(W, H, 10, 0) },
  { id: "punkte5", gruppe: "Punkte & Millimeter", name: "Punkte 5 mm", zeile: 10, schrift: 4.2, oben: 10, links: 10, rechts: 10, malen: (W, H) => punkte(W, H, 5) },
  { id: "punkte10", gruppe: "Punkte & Millimeter", name: "Punkte 1 cm", zeile: 10, oben: 10, links: 10, rechts: 10, malen: (W, H) => punkte(W, H, 10) },
  { id: "mm", gruppe: "Punkte & Millimeter", name: "Millimeterpapier", malen: millimeter },
  { id: "iso", gruppe: "Geometrie", name: "Isometrisch (3D)", malen: isometrisch },
  { id: "hex", gruppe: "Geometrie", name: "Sechsecke (Chemie)", malen: sechsecke },
  { id: "koord", gruppe: "Geometrie", name: "Koordinatensystem", malen: koordinaten },
  { id: "koord4", gruppe: "Geometrie", name: "4 Koordinatensysteme", malen: koordinaten4 },
  { id: "polar", gruppe: "Geometrie", name: "Polar (Kreis)", malen: polar },
  { id: "noten", gruppe: "Noten", name: "Notenlinien", malen: (W, H) => noten(W, H, "noten") },
  { id: "notengross", gruppe: "Noten", name: "Notenlinien groß", malen: (W, H) => noten(W, H, "notengross") },
  { id: "klavier", gruppe: "Noten", name: "Klavier", malen: (W, H) => noten(W, H, "klavier") },
  { id: "tab", gruppe: "Noten", name: "Gitarren-Tabulatur", malen: (W, H) => noten(W, H, "tab") },
  { id: "notentab", gruppe: "Noten", name: "Noten + Tabulatur", malen: (W, H) => noten(W, H, "notentab") },
  { id: "cornell", gruppe: "Lernen", name: "Cornell-Notizen", zeile: 8, oben: 33, links: 63, rechts: 8, malen: cornell },
  { id: "vokabel", gruppe: "Lernen", name: "Vokabeln (2 Spalten)", zeile: 8, oben: 28, links: 10, rechts: 10, malen: vokabeln }
];

// Alte Namen aus der ersten Version
const ALT = { karo: "karo5", linien: "lin8-r" };
export function info(id) { id = ALT[id] || id; return PAPIER.find(p => p.id === id) || PAPIER[0]; }

const cache = {};
export function svg(id, quer) {
  const p = info(id), W = quer ? 297 : 210, H = quer ? 210 : 297;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm">${p.malen(W, H)}</svg>`;
}
// CSS-Hintergrund für eine Seite (eine Kachel = eine Blatthöhe, wiederholt bei langen Seiten)
export function hintergrund(id, quer) {
  const k = (info(id).id) + (quer ? "-q" : "");
  if (!(k in cache)) cache[k] = info(id).id === "leer" ? "none" : 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(id, quer)) + '")';
  return cache[k];
}
// Kleines Vorschaubild (kräftigere Linien, damit man bei 60 px Breite etwas erkennt)
const vcache = {};
export function vorschau(id, quer) {
  const k = info(id).id + (quer ? "-q" : "");
  if (!(k in vcache)) { DICK = 4; vcache[k] = info(id).id === "leer" ? "none" : 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(id, quer)) + '")'; DICK = 1; }
  return vcache[k];
}
export const gruppen = () => [...new Set(PAPIER.map(p => p.gruppe))];
