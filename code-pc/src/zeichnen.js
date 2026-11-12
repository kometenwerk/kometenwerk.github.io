// Kometenwerk Code · Zeichner für Schaltplan, Flussdiagramm und technische Zeichnung (Bauplan)
// Du zeichnest selbst – das Programm erzeugt nichts automatisch. Es hilft nur beim Ausrichten (Raster, Einrasten),
// beim Bemaßen und prüft beim Schaltplan, ob die Pins aus deinem Code auch im Plan verbunden sind.

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const r2 = (v) => Math.round(v * 100) / 100;
const zahlDe = (v) => String(r2(v)).replace(".", ",");
// Einheit der technischen Zeichnung: gespeichert wird immer in mm, angezeigt/eingegeben in mm oder cm
let EINH = "mm";
const einhF = () => EINH === "cm" ? 10 : 1;
const masszahl = (mm) => zahlDe(mm / einhF());
export function laengeLesen(t) {   // "12,5" / "12.5 cm" / "120 mm" / "0,3 m" → mm (NaN wenn ungültig)
  const m = /^\s*(-?\d+(?:[.,]\d+)?|-?[.,]\d+)\s*(mm|cm|m)?\s*$/i.exec(String(t)); if (!m) return NaN;
  const v = Number(m[1].replace(",", ".")), e = (m[2] || EINH).toLowerCase();
  return r2(v * (e === "cm" ? 10 : e === "m" ? 1000 : 1));
}
let idZaehler = Date.now() % 100000;
const neueId = () => "e" + (idZaehler++).toString(36);

/* ================= Symbole ================= */
const UNO_L = ["5V", "3.3V", "GND", "GND", "Vin", "A0", "A1", "A2", "A3", "A4", "A5"];
const UNO_R = ["D13", "D12", "~D11", "~D10", "~D9", "D8", "D7", "~D6", "~D5", "D4", "~D3", "D2", "D1", "D0"];
const T = (x, y, t, o = "") => '<text x="' + x + '" y="' + y + '" ' + o + ">" + esc(t) + "</text>";
const mehrzeilig = (x, y, t, gr = 13) => { const z = String(t || "").split("\n"); return z.map((l, i) => T(x, y + (i - (z.length - 1) / 2) * gr * 1.2 + gr * 0.35, l, 'text-anchor="middle" font-size="' + gr + '"')).join(""); };

export const SYM = {
  /* ---- Schaltplan (Einheit: Raster 10) ---- */
  arduino: { modus: "schaltplan", name: "Arduino Uno", w: 140, h: 300,
    pins: [...UNO_L.map((n, i) => [0, 20 + i * 20, n]), ...UNO_R.map((n, i) => [140, 20 + i * 20, n.replace("~", "")])],
    svg: (e) => '<rect x="20" y="0" width="100" height="300" rx="4" class="dick"/>' + UNO_L.map((n, i) => '<path d="M0 ' + (20 + i * 20) + 'h20"/>' + T(24, 24 + i * 20, n, 'font-size="10"')).join("") +
      UNO_R.map((n, i) => '<path d="M120 ' + (20 + i * 20) + 'h20"/>' + T(116, 24 + i * 20, n, 'font-size="10" text-anchor="end"')).join("") + T(70, 292, e.text || "Arduino Uno", 'font-size="11" text-anchor="middle" font-weight="600"'),
    felder: [["text", "Beschriftung"]] },
  led: { modus: "schaltplan", name: "LED", w: 60, h: 20, pins: [[0, 10, "Anode (+)"], [60, 10, "Kathode (−)"]],
    svg: (e) => '<path d="M0 10h20M40 10h20"/><path d="M20 0v20l20-10z" class="voll"/><path d="M40 0v20" class="dick"/><path d="M30 -2l6 -8M36 -2l6 -8"/><path d="M36 -10l-3 1 2 2zM42 -10l-3 1 2 2z" class="voll"/>' + (e.text ? T(30, 34, e.text, 'font-size="11" text-anchor="middle"') : ""),
    felder: [["text", "Beschriftung (z. B. LED rot)"]] },
  widerstand: { modus: "schaltplan", name: "Widerstand", w: 60, h: 20, pins: [[0, 10, "1"], [60, 10, "2"]],
    svg: (e) => '<path d="M0 10h15M45 10h15"/><rect x="15" y="4" width="30" height="12"/>' + T(30, -3, e.text || "220 Ω", 'font-size="11" text-anchor="middle"'),
    felder: [["text", "Wert (z. B. 220 Ω)"]] },
  taster: { modus: "schaltplan", name: "Taster", w: 60, h: 30, pins: [[0, 25, "1"], [60, 25, "2"]],
    svg: (e) => '<path d="M0 25h16M44 25h16"/><circle cx="17" cy="25" r="1.6" class="voll"/><circle cx="43" cy="25" r="1.6" class="voll"/><path d="M17 25L44 15"/><path d="M30 19V4M24 4h12"/>' + (e.text ? T(30, 42, e.text, 'font-size="11" text-anchor="middle"') : ""),
    felder: [["text", "Beschriftung"]] },
  summer: { modus: "schaltplan", name: "Summer (Buzzer)", w: 60, h: 40, pins: [[0, 30, "+"], [60, 30, "−"]],
    svg: (e) => '<path d="M0 30h20M40 30h20M20 30V22h20v8"/><path d="M20 22a10 10 0 0 1 20 0" />' + T(14, 26, "+", 'font-size="10"') + (e.text ? T(30, 48, e.text, 'font-size="11" text-anchor="middle"') : ""),
    felder: [["text", "Beschriftung"]] },
  motor: { modus: "schaltplan", name: "Motor", w: 60, h: 40, pins: [[0, 20, "1"], [60, 20, "2"]],
    svg: (e) => '<path d="M0 20h15M45 20h15"/><circle cx="30" cy="20" r="15"/>' + T(30, 25, "M", 'font-size="14" text-anchor="middle"') + (e.text ? T(30, 50, e.text, 'font-size="11" text-anchor="middle"') : ""),
    felder: [["text", "Beschriftung"]] },
  poti: { modus: "schaltplan", name: "Potentiometer", w: 60, h: 40, pins: [[0, 20, "1"], [60, 20, "3"], [30, 40, "Schleifer"]],
    svg: (e) => '<path d="M0 20h15M45 20h15M30 40V29"/><rect x="15" y="14" width="30" height="12"/><path d="M30 26l-3 5h6z" class="voll"/>' + T(30, 9, e.text || "10 kΩ", 'font-size="11" text-anchor="middle"'),
    felder: [["text", "Wert"]] },
  display: { modus: "schaltplan", name: "Display (I²C)", w: 120, h: 70, pins: [[15, 70, "GND"], [45, 70, "VCC"], [75, 70, "SDA"], [105, 70, "SCL"]],
    svg: (e) => '<rect x="0" y="0" width="120" height="50" class="dick"/><rect x="10" y="8" width="100" height="24"/>' + T(60, 24, e.text || "LCD 16×2", 'font-size="11" text-anchor="middle"') +
      [["GND", 15], ["VCC", 45], ["SDA", 75], ["SCL", 105]].map(([n, x]) => '<path d="M' + x + ' 50v20"/>' + T(x, 45, n, 'font-size="8" text-anchor="middle"')).join(""),
    felder: [["text", "Beschriftung"]] },
  masse: { modus: "schaltplan", name: "Masse (GND)", w: 20, h: 20, pins: [[10, 0, "GND"]], svg: () => '<path d="M10 0v10M0 10h20M4 14h12M8 18h4"/>' },
  plus: { modus: "schaltplan", name: "+5 V", w: 20, h: 20, pins: [[10, 20, "5V"]], svg: (e) => '<path d="M10 20V6M4 6h12"/>' + T(10, 2, e.text || "+5V", 'font-size="10" text-anchor="middle"'), felder: [["text", "Spannung"]] },
  knoten: { modus: "schaltplan", name: "Verbindungspunkt", w: 0, h: 0, pins: [[0, 0, "Knoten"]], svg: () => '<circle cx="0" cy="0" r="3" class="voll"/>' },
  text: { modus: "*", name: "Text", w: 0, h: 0, svg: (e, k = 1) => '<text x="0" y="0" font-size="' + r2((e.groesse || 14) / k) + '" class="txt">' + esc(e.text || "Text") + "</text>", felder: [["text", "Text"], ["groesse", "Schriftgröße", "zahl"]] },

  /* ---- Flussdiagramm (DIN 66001) ---- */
  start: { modus: "fluss", name: "Start / Ende", w: 140, h: 40, form: true, svg: (e) => '<rect x="0" y="0" width="' + e.w + '" height="' + e.h + '" rx="' + e.h / 2 + '"/>' + mehrzeilig(e.w / 2, e.h / 2, e.text ?? "Start"), felder: [["text", "Text", "lang"], ["w", "Breite", "zahl"], ["h", "Höhe", "zahl"]] },
  op: { modus: "fluss", name: "Anweisung", w: 160, h: 50, form: true, svg: (e) => '<rect x="0" y="0" width="' + e.w + '" height="' + e.h + '"/>' + mehrzeilig(e.w / 2, e.h / 2, e.text ?? "Anweisung"), felder: [["text", "Text", "lang"], ["w", "Breite", "zahl"], ["h", "Höhe", "zahl"]] },
  verzweigung: { modus: "fluss", name: "Verzweigung", w: 160, h: 80, form: true, svg: (e) => '<path d="M' + e.w / 2 + ' 0L' + e.w + " " + e.h / 2 + "L" + e.w / 2 + " " + e.h + "L0 " + e.h / 2 + 'z"/>' + mehrzeilig(e.w / 2, e.h / 2, e.text ?? "Bedingung?", 12), felder: [["text", "Bedingung", "lang"], ["w", "Breite", "zahl"], ["h", "Höhe", "zahl"]] },
  ea: { modus: "fluss", name: "Ein-/Ausgabe", w: 160, h: 50, form: true, svg: (e) => '<path d="M15 0H' + e.w + "L" + (e.w - 15) + " " + e.h + 'H0z"/>' + mehrzeilig(e.w / 2, e.h / 2, e.text ?? "Ausgabe"), felder: [["text", "Text", "lang"], ["w", "Breite", "zahl"], ["h", "Höhe", "zahl"]] },
  unter: { modus: "fluss", name: "Unterprogramm", w: 160, h: 50, form: true, svg: (e) => '<rect x="0" y="0" width="' + e.w + '" height="' + e.h + '"/><path d="M10 0v' + e.h + "M" + (e.w - 10) + " 0v" + e.h + '"/>' + mehrzeilig(e.w / 2, e.h / 2, e.text ?? "Unterprogramm"), felder: [["text", "Text", "lang"], ["w", "Breite", "zahl"], ["h", "Höhe", "zahl"]] },
  verbinder: { modus: "fluss", name: "Verbindungsstelle", w: 30, h: 30, form: true, svg: (e) => '<circle cx="' + e.w / 2 + '" cy="' + e.h / 2 + '" r="' + e.w / 2 + '"/>' + mehrzeilig(e.w / 2, e.h / 2, e.text ?? "A", 12), felder: [["text", "Zeichen"]] },

  /* ---- Technische Zeichnung (Einheit: mm) ---- */
  platte: { modus: "bauplan", name: "Platte / Umriss", w: 120, h: 80, form: true, svg: (e, k) => '<rect x="0" y="0" width="' + e.w + '" height="' + e.h + '" rx="' + (e.radius || 0) + '" style="stroke-width:' + r2(0.5 / k) + '"/>',
    felder: [["x", "X links", "laenge"], ["y", "Y oben", "laenge"], ["w", "Breite", "laenge"], ["h", "Höhe", "laenge"], ["radius", "Eckenradius", "laenge"]] },
  ausschnitt: { modus: "bauplan", name: "Ausschnitt (z. B. Display)", w: 72, h: 25, form: true, svg: (e, k) => '<rect x="0" y="0" width="' + e.w + '" height="' + e.h + '" rx="' + (e.radius || 0) + '" style="stroke-width:' + r2(0.5 / k) + '"/>' + (e.mitte !== false ? mittelkreuz(e.w / 2, e.h / 2, e.w / 2, e.h / 2, k) : ""),
    felder: [["x", "X links", "laenge"], ["y", "Y oben", "laenge"], ["w", "Breite", "laenge"], ["h", "Höhe", "laenge"], ["radius", "Eckenradius", "laenge"], ["mitte", "Mittellinien", "janein"]] },
  bohrung: { modus: "bauplan", name: "Bohrung", w: 0, h: 0, d: 5, svg: (e, k) => '<circle cx="0" cy="0" r="' + e.d / 2 + '" style="stroke-width:' + r2(0.5 / k) + '"/>' + (e.mitte !== false ? mittelkreuz(0, 0, e.d / 2, e.d / 2, k) : "") + (e.dmass ? durchmesser(e, k) : ""),
    felder: [["x", "Mitte X", "laenge"], ["y", "Mitte Y", "laenge"], ["d", "Durchmesser", "laenge"], ["mitte", "Mittellinien", "janein"], ["dmass", "⌀ bemaßen", "janein"]] }
};
function mittelkreuz(cx, cy, rx, ry, k) {
  const u = 2 / k, s = 'class="mittel" style="stroke-width:' + r2(0.25 / k) + ";stroke-dasharray:" + [8, 1.5, 1, 1.5].map(v => r2(v / k)).join(" ") + '"';
  return '<path d="M' + r2(cx - rx - u) + " " + cy + "H" + r2(cx + rx + u) + "M" + cx + " " + r2(cy - ry - u) + "V" + r2(cy + ry + u) + '" ' + s + "/>";
}
function pfeilSpitze(x, y, wx, wy, k) {   // Spitze bei (x,y), zeigt in Richtung (wx,wy)
  const l = 2.5 / k, b = 0.6 / k, bx = x - wx * l, by = y - wy * l;
  return '<path d="M' + r2(x) + " " + r2(y) + "L" + r2(bx - wy * b) + " " + r2(by + wx * b) + "L" + r2(bx + wy * b) + " " + r2(by - wx * b) + 'z" class="voll" style="stroke-width:0"/>';
}
function durchmesser(e, k) {
  const r = e.d / 2, a = Math.PI / 4, px = Math.cos(a) * r, py = -Math.sin(a) * r, kx = px + 6 / k, ky = py - 6 / k, t = "⌀" + masszahl(e.d), tw = (t.length * 2.1 + 1) / k;
  return '<g style="stroke-width:' + r2(0.25 / k) + '"><path d="M' + r2(px) + " " + r2(py) + "L" + r2(kx) + " " + r2(ky) + "h" + r2(tw) + '"/>' + pfeilSpitze(px, py, -Math.cos(a), Math.sin(a), k) +
    '<text x="' + r2(kx + 0.5 / k) + '" y="' + r2(ky - 0.8 / k) + '" font-size="' + r2(3.5 / k) + '" class="txt">' + t + "</text></g>";
}

// Linien-Arten
export const LINIEN = {
  draht: { modus: "schaltplan", name: "Leitung", viele: true },
  pfeil: { modus: "fluss", name: "Pfeil", viele: true, felder: [["text", "Beschriftung (ja / nein)"]] },
  linie: { modus: "bauplan", name: "Linie", felder: [["stil", "Linienart", "wahl", [["voll", "Volllinie (Kante)"], ["verdeckt", "Strichlinie (verdeckte Kante)"], ["mittel", "Strichpunktlinie (Mittellinie)"], ["schmal", "schmale Volllinie"]]]] },
  kette: { modus: "bauplan", name: "Maßkette", viele: true },
  mass: { modus: "bauplan", name: "Bemaßung", felder: [["abstand", "Abstand zur Kante", "laenge"], ["text", "Maßzahl selbst eintragen (leer = gemessen)"]] }
};

const PALETTE = {
  schaltplan: ["arduino", "led", "widerstand", "taster", "summer", "motor", "poti", "display", "masse", "plus", "knoten", "draht", "text"],
  fluss: ["start", "op", "verzweigung", "ea", "unter", "verbinder", "pfeil", "text"],
  bauplan: ["platte", "ausschnitt", "bohrung", "linie", "mass", "kette", "text"]
};
const TITEL = { schaltplan: "Schaltplan", fluss: "Flussdiagramm", bauplan: "Technische Zeichnung" };
const RASTER = { schaltplan: 10, fluss: 10, bauplan: 1 };

/* ================= Geometrie ================= */
function drehen(px, py, e) {          // lokaler Punkt → Welt (mit Drehung um die Mitte)
  const s = SYM[e.typ], w = e.w ?? s.w, h = e.h ?? s.h, r = ((e.rot || 0) % 360) * Math.PI / 180, cx = w / 2, cy = h / 2;
  const dx = px - cx, dy = py - cy;
  return [r2(e.x + cx + dx * Math.cos(r) - dy * Math.sin(r)), r2(e.y + cy + dx * Math.sin(r) + dy * Math.cos(r))];
}
function anschluesse(e) {             // [x, y, name]
  const s = SYM[e.typ]; if (!s) return [];
  if (s.pins) return s.pins.map(([x, y, n]) => [...drehen(x, y, e), n]);
  if (s.modus === "fluss") { const w = e.w, h = e.h; return [[w / 2, 0, "oben"], [w / 2, h, "unten"], [0, h / 2, "links"], [w, h / 2, "rechts"]].map(([x, y, n]) => [r2(e.x + x), r2(e.y + y), n]); }
  if (e.typ === "bohrung") { const r = e.d / 2; return [[e.x, e.y, "Mitte"], [e.x - r, e.y, "links"], [e.x + r, e.y, "rechts"], [e.x, e.y - r, "oben"], [e.x, e.y + r, "unten"]]; }
  if (e.typ === "platte" || e.typ === "ausschnitt") { const { x, y, w, h } = e; return [[x, y], [x + w, y], [x, y + h], [x + w, y + h], [x + w / 2, y], [x + w / 2, y + h], [x, y + h / 2], [x + w, y + h / 2], [x + w / 2, y + h / 2]].map(p => [r2(p[0]), r2(p[1]), ""]); }
  return [];
}
function linieSvg(l, k, modus) {
  const p = l.punkte; if (!p || p.length < 2) return "";
  const d = "M" + p.map(q => q.join(" ")).join("L");
  if (l.typ === "draht") return '<path d="' + d + '" class="draht"/>';
  if (l.typ === "pfeil") { const a = p[p.length - 2], b = p[p.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, m = p[Math.floor((p.length - 1) / 2)], n2 = p[Math.floor((p.length - 1) / 2) + 1];
    return '<path d="' + d + '"/>' + '<path d="M' + b[0] + " " + b[1] + "l" + r2(-(b[0] - a[0]) / L * 10 - (b[1] - a[1]) / L * 4) + " " + r2(-(b[1] - a[1]) / L * 10 + (b[0] - a[0]) / L * 4) + "l" + r2((b[1] - a[1]) / L * 8) + " " + r2(-(b[0] - a[0]) / L * 8) + 'z" class="voll"/>' +
      (l.text ? T(r2((m[0] + n2[0]) / 2 + 6), r2((m[1] + n2[1]) / 2 - 5), l.text, 'font-size="12"') : ""); }
  if (l.typ === "linie") { const st = l.stil || "voll", w = st === "voll" ? 0.5 : 0.25, da = st === "verdeckt" ? [3, 1.5] : st === "mittel" ? [8, 1.5, 1, 1.5] : null;
    return '<path d="' + d + '" style="stroke-width:' + r2(w / k) + (da ? ";stroke-dasharray:" + da.map(v => r2(v / k)).join(" ") : "") + '"/>'; }
  if (l.typ === "mass") return massSvg(l, k);
  if (l.typ === "kette") return '<path d="' + d + '" style="stroke-width:' + r2(0.3 / k) + ";stroke-dasharray:" + r2(1.5 / k) + " " + r2(1 / k) + '"/>' + p.map(q => '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="' + r2(0.9 / k) + '" class="voll"/>').join("");
  return "";
}
function massSvg(l, k) {
  if (l.richtung === "h" || l.richtung === "v") return massKetteSvg(l, k);
  const [p1, p2] = l.punkte, dx = p2[0] - p1[0], dy = p2[1] - p1[1], L = Math.hypot(dx, dy); if (!L) return "";
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux, a = l.abstand ?? 10, sg = a < 0 ? -1 : 1, ue = 2 / k;
  const q1 = [p1[0] + nx * a, p1[1] + ny * a], q2 = [p2[0] + nx * a, p2[1] + ny * a];
  let h = '<g style="stroke-width:' + r2(0.25 / k) + '">';
  h += '<path d="M' + r2(p1[0]) + " " + r2(p1[1]) + "L" + r2(q1[0] + nx * ue * sg) + " " + r2(q1[1] + ny * ue * sg) + "M" + r2(p2[0]) + " " + r2(p2[1]) + "L" + r2(q2[0] + nx * ue * sg) + " " + r2(q2[1] + ny * ue * sg) + '"/>';
  h += '<path d="M' + r2(q1[0]) + " " + r2(q1[1]) + "L" + r2(q2[0]) + " " + r2(q2[1]) + '"/>' + pfeilSpitze(q1[0], q1[1], -ux, -uy, k) + pfeilSpitze(q2[0], q2[1], ux, uy, k);
  let w = Math.atan2(uy, ux) * 180 / Math.PI; if (w >= 89.99) w -= 180; if (w < -90.01) w += 180;
  const t = l.text ? String(l.text) : masszahl(L), rad = w * Math.PI / 180, mx = (q1[0] + q2[0]) / 2 + Math.sin(rad) * 1 / k, my = (q1[1] + q2[1]) / 2 - Math.cos(rad) * 1 / k;
  h += '<text x="' + r2(mx) + '" y="' + r2(my) + '" font-size="' + r2(3.5 / k) + '" text-anchor="middle" class="txt" transform="rotate(' + r2(w) + " " + r2(mx) + " " + r2(my) + ')">' + esc(t) + "</text></g>";
  return h;
}
// Teil einer Maßkette: waagerecht (h) oder senkrecht (v), Maßlinie auf fester Höhe „lage“
function massKetteSvg(l, k) {
  const [p1, p2] = l.punkte, h = l.richtung === "h", ue = 2 / k;
  const a = h ? p1[0] : p1[1], b = h ? p2[0] : p2[1], L = Math.abs(b - a); if (!L) return "";
  const lage = l.lage, sg1 = Math.sign(lage - (h ? p1[1] : p1[0])) || 1, sg2 = Math.sign(lage - (h ? p2[1] : p2[0])) || 1;
  const P = (u, v) => h ? [u, v] : [v, u];
  const q1 = P(a, lage), q2 = P(b, lage), e1 = P(a, lage + sg1 * ue), e2 = P(b, lage + sg2 * ue), dir = Math.sign(b - a);
  let o = '<g style="stroke-width:' + r2(0.25 / k) + '"><path d="M' + r2(p1[0]) + " " + r2(p1[1]) + "L" + r2(e1[0]) + " " + r2(e1[1]) + "M" + r2(p2[0]) + " " + r2(p2[1]) + "L" + r2(e2[0]) + " " + r2(e2[1]) + "M" + r2(q1[0]) + " " + r2(q1[1]) + "L" + r2(q2[0]) + " " + r2(q2[1]) + '"/>';
  o += pfeilSpitze(q1[0], q1[1], h ? -dir : 0, h ? 0 : -dir, k) + pfeilSpitze(q2[0], q2[1], h ? dir : 0, h ? 0 : dir, k);
  const t = l.text ? String(l.text) : masszahl(L), m = (a + b) / 2, tp = h ? [m, lage - 1 / k] : [lage - 1 / k, m];
  o += '<text x="' + r2(tp[0]) + '" y="' + r2(tp[1]) + '" font-size="' + r2(3.5 / k) + '" text-anchor="middle" class="txt"' + (h ? "" : ' transform="rotate(-90 ' + r2(tp[0]) + " " + r2(tp[1]) + ')"') + ">" + esc(t) + "</text></g>";
  return o;
}
function elementSvg(e, k) {
  const s = SYM[e.typ]; if (!s) return "";
  if (s.modus === "bauplan" && e.typ !== "text" || e.typ === "bohrung") return '<g transform="translate(' + e.x + " " + e.y + ')">' + s.svg(e, k) + "</g>";
  if (e.typ === "text") return '<g transform="translate(' + e.x + " " + e.y + ')">' + s.svg(e, k) + "</g>";
  const w = e.w ?? s.w, h = e.h ?? s.h;
  return '<g transform="translate(' + e.x + " " + e.y + ")" + (e.rot ? " rotate(" + e.rot + " " + w / 2 + " " + h / 2 + ")" : "") + '">' + s.svg(Object.assign({ w, h }, e), k) + "</g>";
}

/* ================= Blatt (Rahmen + Schriftfeld) für den Bauplan ================= */
export const BLATT = { w: 297, h: 210 };
export const blattMass = (z) => z && z.blatt === "A3" ? { w: 420, h: 297, name: "A3" } : { w: 297, h: 210, name: "A4" };
function massstabFaktor(m) { const x = /^(\d+(?:[.,]\d+)?)\s*:\s*(\d+(?:[.,]\d+)?)$/.exec(String(m || "1:1").trim()); return x ? Number(x[1].replace(",", ".")) / Number(x[2].replace(",", ".")) || 1 : 1; }
function schriftfeld(sf, B = BLATT) {
  const x0 = B.w - 10 - 180, y0 = B.h - 10 - 28, z = (x, y, w, h) => '<rect x="' + (x0 + x) + '" y="' + (y0 + y) + '" width="' + w + '" height="' + h + '"/>';
  const lab = (x, y, t) => '<text x="' + (x0 + x + 1) + '" y="' + (y0 + y + 2.6) + '" font-size="2">' + esc(t) + "</text>";
  const wert = (x, y, t, g = 3.5) => '<text x="' + (x0 + x + 1.5) + '" y="' + (y0 + y + 6) + '" font-size="' + g + '" class="txt">' + esc(t || "") + "</text>";
  let h = '<g class="sf" style="stroke-width:0.35">' + z(0, 0, 180, 28);
  const sp = [[0, "Name", "name"], [60, "Datum", "datum"], [120, "Maßstab", "massstab"]], sp2 = [[0, "Klasse / Gruppe", "klasse"], [60, "Werkstoff", "werkstoff"], [120, "Blatt", "blatt"]];
  for (const [x, l, k] of sp) h += z(x, 0, 60, 7) + lab(x, 0, l) + wert(x + 14, -1.3, sf[k], 3.2);
  for (const [x, l, k] of sp2) h += z(x, 7, 60, 7) + lab(x, 7, l) + wert(x + 14, 5.7, sf[k], 3.2);
  h += z(0, 14, 130, 14) + lab(0, 14, "Benennung") + wert(0, 17.5, sf.titel, 5) + z(130, 14, 50, 14) + lab(130, 14, "Zeichnungs-Nr.") + wert(130, 17.5, sf.nummer, 3.5);
  return h + "</g>";
}
export function blattSvg(z, mitRaster) {
  const k = massstabFaktor(z.schriftfeld && z.schriftfeld.massstab), B = blattMass(z);
  let h = '<rect x="0" y="0" width="' + B.w + '" height="' + B.h + '" fill="#fff" stroke="none"/>';
  if (mitRaster) h += '<g class="raster">' + Array.from({ length: Math.floor(B.w / (5 * k)) + 1 }, (_, i) => '<path d="M' + r2(i * 5 * k) + ' 0V' + B.h + '"/>').join("") + Array.from({ length: Math.floor(B.h / (5 * k)) + 1 }, (_, i) => '<path d="M0 ' + r2(i * 5 * k) + "H" + B.w + '"/>').join("") + "</g>";
  h += '<rect x="20" y="10" width="' + (B.w - 30) + '" height="' + (B.h - 20) + '" fill="none" style="stroke-width:0.7"/>' + schriftfeld(z.schriftfeld || {}, B);
  return { h, k };
}

/* ================= SVG zum Speichern/Drucken ================= */
const STIL = 'text{font-family:"Open Sans",Arial,sans-serif;fill:#000;stroke:none}.txt{fill:#000}path,rect,circle{fill:none;stroke:#000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}.dick{stroke-width:2}.voll{fill:#000}.draht{stroke-width:1.6}.sf rect{stroke-width:.35}.raster path{stroke:#e3e9ec;stroke-width:inherit}.raster{stroke-width:.15}.ansicht-hilfe path{stroke:#4ea1ff}';
export function svgText(modus, z) {
  EINH = (z && z.einheit) || "mm";
  if (modus === "bauplan") {
    const { h, k } = blattSvg(z, false);
    const inhalt = (z.el || []).map(e => e.punkte ? linieSvg(e, k, modus) : elementSvg(e, k)).join("");
    const B = blattMass(z);
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + B.w + 'mm" height="' + B.h + 'mm" viewBox="0 0 ' + B.w + " " + B.h + '"><style>' + STIL + "path,rect,circle{stroke-width:.35}</style>" + h + '<g transform="scale(' + k + ')">' + inhalt + "</g></svg>";
  }
  const b = grenzen(z); const inhalt = (z.el || []).map(e => e.punkte ? linieSvg(e, 1, modus) : elementSvg(e, 1)).join("") + (z.titel ? T(b.x, b.y - 8, z.titel, 'font-size="16" font-weight="600"') : "");
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + [b.x - 20, b.y - (z.titel ? 34 : 20), b.w + 40, b.h + (z.titel ? 54 : 40)].join(" ") + '" width="' + (b.w + 40) + '" height="' + (b.h + (z.titel ? 54 : 40)) + '"><style>' + STIL + '</style><rect x="-99999" y="-99999" width="199999" height="199999" fill="#fff" stroke="none"/>' + inhalt + "</svg>";
}
function grenzen(z) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  const nimm = (x, y) => { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); };
  for (const e of z.el || []) {
    if (e.punkte) e.punkte.forEach(p => nimm(p[0], p[1]));
    else { const s = SYM[e.typ], w = e.w ?? s.w, h = e.h ?? s.h; nimm(e.x - 20, e.y - 20); nimm(e.x + Math.max(w, h) + 20, e.y + Math.max(w, h) + 20); if (e.typ === "text") nimm(e.x + String(e.text || "").length * 8, e.y); }
  }
  if (a === Infinity) return { x: 0, y: 0, w: 400, h: 300 };
  return { x: a, y: b, w: c - a, h: d - b };
}
export function druckHtml(modus, z) {
  const svg = svgText(modus, z);
  const B = modus === "bauplan" ? blattMass(z) : BLATT;
  return '<!doctype html><html><head><meta charset="utf-8"><style>@page{size:' + (B.name || "A4") + ' landscape;margin:0}html,body{margin:0;padding:0}' + (modus === "bauplan" ? "svg{display:block;width:" + B.w + "mm;height:" + B.h + "mm}" : "body{display:flex;align-items:center;justify-content:center;width:297mm;height:210mm}svg{max-width:277mm;max-height:190mm;width:auto;height:auto}") + "</style></head><body>" + svg + "</body></html>";
}
export function pngAusSvg(svg, breitePx) {
  return new Promise((ok, nein) => {
    const img = new Image();
    img.onload = () => { const s = breitePx / img.width, c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); ok(c.toDataURL("image/png").split(",")[1]); };
    img.onerror = nein;
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.replace(/width="(\d+)mm" height="(\d+)mm"/, (_, w, h) => 'width="' + w * 4 + '" height="' + h * 4 + '"'));
  });
}

/* ================= Pins aus dem Code (nur zum Vergleichen) ================= */
export function pinsAusCode(code) {
  const ohne = String(code).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ""), werte = {};
  for (const m of ohne.matchAll(/(?:const\s+)?(?:int|byte|long)\s+([A-Za-z_]\w*)\s*=\s*(A?\d+)\s*;/g)) werte[m[1]] = m[2];
  for (const m of ohne.matchAll(/#define\s+([A-Za-z_]\w*)\s+(A?\d+)/g)) werte[m[1]] = m[2];
  const pins = new Map(), zeilen = String(code).split("\n");
  const name = (a) => { a = a.trim(); a = werte[a] || a; if (/^A\d$/.test(a)) return a; if (/^\d+$/.test(a)) return Number(a) >= 14 && Number(a) <= 19 ? "A" + (Number(a) - 14) : "D" + a; return null; };
  const regeln = [[/pinMode\s*\(\s*([\w]+)\s*,\s*(OUTPUT|INPUT_PULLUP|INPUT)/g, (m) => m[2] === "OUTPUT" ? "Ausgang" : m[2] === "INPUT_PULLUP" ? "Eingang (Pull-up)" : "Eingang"], [/digitalWrite\s*\(\s*([\w]+)\s*,/g, () => "schreibt HIGH/LOW"], [/digitalRead\s*\(\s*([\w]+)\s*\)/g, () => "liest"], [/analogRead\s*\(\s*([\w]+)\s*\)/g, () => "liest analog"], [/analogWrite\s*\(\s*([\w]+)\s*,/g, () => "PWM"], [/\b(?:no)?[Tt]one\s*\(\s*([\w]+)/g, () => "Ton"]];
  zeilen.forEach((z, i) => { const zz = z.replace(/\/\/.*$/, ""); for (const [re, art] of regeln) for (const m of zz.matchAll(re)) { const p = name(m[1]); if (!p) continue; const x = pins.get(p) || { pin: p, arten: new Set(), zeilen: new Set() }; x.arten.add(art(m)); x.zeilen.add(i + 1); pins.set(p, x); } });
  return [...pins.values()].map(x => ({ pin: x.pin, arten: [...x.arten], zeilen: [...x.zeilen] })).sort((a, b) => a.pin.localeCompare(b.pin, "de", { numeric: true }));
}
export function verbundenePins(z) {
  const enden = []; for (const l of z.el || []) if (l.typ === "draht" && l.punkte) { enden.push(l.punkte[0], l.punkte[l.punkte.length - 1]); }
  const aus = new Set();
  for (const e of z.el || []) if (e.typ === "arduino") for (const [x, y, n] of anschluesse(e)) if (enden.some(p => Math.abs(p[0] - x) < 0.6 && Math.abs(p[1] - y) < 0.6)) aus.add(n);
  return aus;
}

/* ================= Der Zeichner ================= */
export function leer(modus) { return modus === "bauplan" ? { el: [], schriftfeld: { titel: "Deckplatte", massstab: "1:1", blatt: "1/1", datum: new Date().toLocaleDateString("de-DE"), werkstoff: "" } } : { el: [], titel: "" }; }

export function oeffnen(modus, daten, { speichern, code, KC, toast, name }) {
  let z = JSON.parse(JSON.stringify(daten || leer(modus))); if (!z.el) z.el = [];
  const verlauf = [JSON.stringify(z)]; let vPos = 0;
  let eigenschaftenAus = false, werkzeug = "auswahl", auswahl = null, entwurf = null, ziehen = null, zoom = modus === "bauplan" ? 3.2 : 1, raster = true;
  const R = () => modus === "bauplan" ? (z.raster || 1) : RASTER[modus];
  const k = () => modus === "bauplan" ? massstabFaktor(z.schriftfeld && z.schriftfeld.massstab) : 1;

  const box = document.createElement("div"); box.className = "zeichner"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", TITEL[modus]);
  box.innerHTML = '<div class="z-kopf"><b>' + TITEL[modus] + '</b><span class="leise z-name"></span><span class="sp"></span>' +
    '<button type="button" class="z-k" data-a="rueck" title="Rückgängig (Strg+Z)">↶</button><button type="button" class="z-k" data-a="vor" title="Wiederholen (Strg+Y)">↷</button>' +
    '<button type="button" class="z-k" data-a="drehen" title="Drehen (R)">⟳ Drehen</button><button type="button" class="z-k" data-a="loeschen" title="Löschen (Entf)">🗑 Löschen</button>' +
    '<button type="button" class="z-k" data-a="raster" title="Raster ein/aus">▦ Raster</button><button type="button" class="z-k" data-a="zoom-" title="Verkleinern">−</button><span class="z-zoom"></span><button type="button" class="z-k" data-a="zoom+" title="Vergrößern">+</button>' +
    (modus === "bauplan" ? '<button type="button" class="z-k" data-a="sf">Schriftfeld …</button>' : '<button type="button" class="z-k" data-a="titel">Überschrift …</button>') +
    '<button type="button" class="z-k" data-a="png">PNG</button><button type="button" class="z-k" data-a="svg">SVG</button><button type="button" class="z-k" data-a="pdf">PDF</button><button type="button" class="z-k" data-a="druck">🖨 Drucken</button>' +
    '<button type="button" class="pill klein" data-a="zu">FERTIG</button></div>' +
    '<div class="z-haupt"><div class="z-palette"></div><div class="z-flaeche"><svg class="z-svg" xmlns="http://www.w3.org/2000/svg"></svg></div><div class="z-seite"><div class="z-eig"></div><div class="z-extra"></div></div></div>' +
    '<div class="z-fuss leise"></div>';
  document.body.appendChild(box);
  const svg = box.querySelector(".z-svg"), fuss = box.querySelector(".z-fuss");
  box.querySelector(".z-name").textContent = name ? " · " + name : "";

  // Palette
  const pal = box.querySelector(".z-palette");
  pal.innerHTML = '<button type="button" data-w="auswahl" class="an">⬉ Auswählen</button>' + PALETTE[modus].map(t => '<button type="button" data-w="' + t + '">' + vorschau(t) + "<span>" + esc((SYM[t] || LINIEN[t]).name) + "</span></button>").join("");
  pal.querySelectorAll("[data-w]").forEach(b => b.onclick = () => werkzeugSetzen(b.dataset.w));
  function vorschau(t) {
    if (LINIEN[t]) return '<svg viewBox="0 0 40 20"><path d="M4 16L20 16L20 4L36 4" fill="none" stroke="currentColor" stroke-width="1.6"/>' + (t === "pfeil" || t === "mass" ? '<path d="M36 4l-5-3v6z" fill="currentColor"/>' : "") + "</svg>";
    const s = SYM[t]; if (t === "text") return '<svg viewBox="0 0 40 20"><text x="10" y="15" font-size="14" fill="currentColor">Aa</text></svg>';
    const w = s.w || 10, h = s.h || 10, e = { typ: t, w, h, d: s.d || 5, x: 0, y: 0, mitte: false }, pad = s.modus === "bauplan" ? 4 : 8;
    const bx = t === "bohrung" ? [-4, -4, 8, 8] : t === "knoten" ? [-5, -5, 10, 10] : [-pad, -pad - (t === "led" ? 10 : 0), w + 2 * pad, h + 2 * pad + (t === "led" ? 10 : 0)];
    return '<svg viewBox="' + bx.join(" ") + '" class="z-vor">' + s.svg(e, 1).replace(/<text[\s\S]*?<\/text>/g, "") + "</svg>";
  }
  function werkzeugSetzen(w) { werkzeug = w; entwurf = null; pal.querySelectorAll("[data-w]").forEach(b => b.classList.toggle("an", b.dataset.w === w)); fussText(); malen(); }
  function fussText() {
    const t = { auswahl: "Klick auf ein Teil, um es auszuwählen und zu verschieben. Entf = löschen, R = drehen, Strg+D = verdoppeln.", draht: "Leitung: Klick auf einen Anschluss, dann weitere Punkte; Klick auf einen anderen Anschluss beendet sie. Esc bricht ab.", pfeil: "Pfeil: Klick am Startpunkt (z. B. unten an einem Kasten), dann weitere Punkte; Klick auf einen Anschluss oder Doppelklick beendet ihn.", linie: "Linie: Anfangs- und Endpunkt anklicken. Rastet an Ecken, Mitten und Bohrungen ein.", mass: "Bemaßung: 1. Punkt, 2. Punkt anklicken, dann mit dem dritten Klick festlegen, wo die Maßlinie liegt.", kette: "Maßkette: Punkte nacheinander anklicken (rastet an Kanten, Bohrungen, Mitten ein). Doppelklick dort, wo die Maßlinie liegen soll. Esc bricht ab." };
    fuss.textContent = t[werkzeug] || (SYM[werkzeug] ? "Klick auf die Fläche, um „" + SYM[werkzeug].name + "“ einzusetzen." : "");
  }
  function merken() { const s = JSON.stringify(z); if (s === verlauf[vPos]) return; verlauf.splice(vPos + 1); verlauf.push(s); if (verlauf.length > 80) verlauf.shift(); vPos = verlauf.length - 1; speichern(JSON.parse(s)); }
  function zurueck(d) { const n = vPos + d; if (n < 0 || n >= verlauf.length) return; vPos = n; z = JSON.parse(verlauf[vPos]); auswahl = null; speichern(JSON.parse(verlauf[vPos])); malen(); }

  // Koordinaten
  function punkt(ev) { const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return [q.x / k(), q.y / k()]; }
  const einrasten = (v) => raster ? Math.round(v / R()) * R() : r2(v);
  function fang(p, ohneId) {
    const rad = modus === "bauplan" ? 2.5 / k() : 9; let best = null, bd = rad;
    for (const e of z.el) { if (e.id === ohneId) continue; const liste = e.punkte ? (modus === "bauplan" ? e.punkte : []) : anschluesse(e); for (const q of liste) { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = q; } } }
    return best ? { p: [best[0], best[1]], pin: true } : { p: [einrasten(p[0]), einrasten(p[1])], pin: false };
  }

  /* ---- Zeichnen ---- */
  function malen() {
    const kk = k(); EINH = z.einheit || "mm";
    let w, h, vb;
    if (modus === "bauplan") { const B = blattMass(z); vb = [0, 0, B.w, B.h]; w = B.w * zoom; h = B.h * zoom; }
    else { const b = grenzen(z); vb = [Math.min(0, b.x - 100), Math.min(0, b.y - 100), Math.max(1200, b.x + b.w + 300), Math.max(800, b.y + b.h + 300)]; vb[2] -= vb[0]; vb[3] -= vb[1]; w = vb[2] * zoom; h = vb[3] * zoom; }
    svg.setAttribute("viewBox", vb.join(" ")); svg.setAttribute("width", w); svg.setAttribute("height", h); svg.style.width = w + "px"; svg.style.height = h + "px";
    let o = "<style>" + STIL + (modus === "bauplan" ? "path,rect,circle{stroke-width:.35}" : "") + "</style>";
    if (modus === "bauplan") o += blattSvg(z, raster).h;
    else { o += '<rect x="' + vb[0] + '" y="' + vb[1] + '" width="' + vb[2] + '" height="' + vb[3] + '" fill="#fff" stroke="none"/>'; if (raster) o += '<g class="raster" style="stroke-width:.8">' + punkteRaster(vb) + "</g>"; if (z.titel) { const b = grenzen(z); o += T(b.x, b.y - 8, z.titel, 'font-size="16" font-weight="600"'); } }
    o += '<g transform="scale(' + kk + ')">';
    for (const e of z.el) {
      const inhalt = e.punkte ? linieSvg(e, kk, modus) : elementSvg(e, kk);
      const treff = e.punkte ? '<path d="M' + e.punkte.map(q => q.join(" ")).join("L") + '" class="treffer" style="stroke-width:' + (modus === "bauplan" ? 3 / kk : 10) + '"/>' : trefferFlaeche(e, kk);
      o += '<g data-id="' + e.id + '" class="teil' + (e.id === auswahl ? " gewaehlt" : "") + '">' + treff + inhalt + "</g>";
    }
    // Hilfslinien für die Ansichten: Kanten des gewählten Teils über das ganze Blatt verlängert (werden nicht gedruckt)
    if (modus === "bauplan" && z.hilfslinien !== false) {
      const g2 = z.el.find(e => e.id === auswahl && !e.punkte && e.typ !== "text");
      if (g2) { const B = blattMass(z), W = B.w / kk, H = B.h / kk, xs = g2.typ === "bohrung" ? [g2.x - g2.d / 2, g2.x, g2.x + g2.d / 2] : [g2.x, g2.x + g2.w], ys = g2.typ === "bohrung" ? [g2.y - g2.d / 2, g2.y, g2.y + g2.d / 2] : [g2.y, g2.y + g2.h];
        o += '<g class="ansicht-hilfe" style="stroke-width:' + r2(0.2 / kk) + ";stroke-dasharray:" + r2(2 / kk) + " " + r2(1.5 / kk) + '">' + xs.map(x2 => '<path d="M' + x2 + " 0V" + H + '"/>').join("") + ys.map(y2 => '<path d="M0 ' + y2 + "H" + W + '"/>').join("") + "</g>"; }
    }
    // Anschlüsse zeigen, wenn man Linien zieht
    if (LINIEN[werkzeug] || (ziehen && ziehen.griff != null)) for (const e of z.el) if (!e.punkte) for (const q of anschluesse(e)) o += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="' + (modus === "bauplan" ? 0.8 / kk : 3.5) + '" class="anschluss"/>';
    // Griffe an der gewählten Linie
    const g = z.el.find(e => e.id === auswahl); if (g && g.punkte) g.punkte.forEach((q, i) => { o += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="' + (modus === "bauplan" ? 1.4 / kk : 5) + '" class="griff" data-griff="' + i + '"/>'; });
    if (entwurf) { const vorl = Object.assign({}, entwurf, { punkte: [...entwurf.punkte, entwurf.maus || entwurf.punkte[entwurf.punkte.length - 1]] }); if (entwurf.typ === "mass" && entwurf.punkte.length === 2 && entwurf.maus) { vorl.punkte = entwurf.punkte; vorl.abstand = abstandAus(entwurf.punkte, entwurf.maus); } o += '<g class="entwurf">' + linieSvg(vorl, kk, modus) + (vorl.punkte.length >= 2 ? "" : "") + "</g>"; }
    o += "</g>";
    svg.innerHTML = o;
    box.querySelector(".z-zoom").textContent = Math.round(zoom * (modus === "bauplan" ? 100 / 3.2 : 100)) + " %";
    if (!eigenschaftenAus) eigenschaften();
    if (modus === "bauplan") { const ok = passtAufsBlatt(); fuss.classList.toggle("warnung", !ok); if (!ok) fuss.innerHTML = '⚠ Die Zeichnung ist größer als das Blatt oder liegt auf dem Schriftfeld. <button type="button" class="pill klein" id="zFit2">📐 EINPASSEN</button>'; else if (fuss.querySelector("#zFit2")) fussText(); const f2 = fuss.querySelector("#zFit2"); if (f2) f2.onclick = einpassen; }
  }
  function punkteRaster(vb) { let s = ""; const st = 20; for (let x = Math.ceil(vb[0] / st) * st; x < vb[0] + vb[2]; x += st) s += '<path d="M' + x + " " + vb[1] + "V" + (vb[1] + vb[3]) + '"/>'; for (let y = Math.ceil(vb[1] / st) * st; y < vb[1] + vb[3]; y += st) s += '<path d="M' + vb[0] + " " + y + "H" + (vb[0] + vb[2]) + '"/>'; return s; }
  function trefferFlaeche(e, kk) {
    const s = SYM[e.typ];
    if (e.typ === "bohrung") return '<circle cx="' + e.x + '" cy="' + e.y + '" r="' + Math.max(e.d / 2, 2) + '" class="treffer f"/>';
    if (e.typ === "text") { const g = (e.groesse || 14) / kk; return '<rect x="' + e.x + '" y="' + (e.y - g) + '" width="' + Math.max(10, String(e.text || "Text").length * g * 0.6) + '" height="' + g * 1.3 + '" class="treffer f"/>'; }
    if (e.typ === "knoten") return '<circle cx="' + e.x + '" cy="' + e.y + '" r="7" class="treffer f"/>';
    const w = e.w ?? s.w, h = e.h ?? s.h;
    if (s.modus === "bauplan") return '<rect x="' + e.x + '" y="' + e.y + '" width="' + w + '" height="' + h + '" class="treffer' + (e.typ === "platte" ? "" : " f") + '" style="stroke-width:' + 3 / kk + '"/>';
    return '<g transform="translate(' + e.x + " " + e.y + ")" + (e.rot ? " rotate(" + e.rot + " " + w / 2 + " " + h / 2 + ")" : "") + '"><rect x="-4" y="-4" width="' + (w + 8) + '" height="' + (h + 8) + '" class="treffer f"/></g>';
  }
  function abstandAus([p1, p2], m) { const dx = p2[0] - p1[0], dy = p2[1] - p1[1], L = Math.hypot(dx, dy) || 1; return r2(((m[0] - p1[0]) * -dy + (m[1] - p1[1]) * dx) / L); }

  /* ---- Technische Zeichnung: passt sie aufs Blatt? ---- */
  const nutz = () => { const B = blattMass(z); return { x0: 25, y0: 15, x1: B.w - 15, y1: B.h - 42, w: B.w, h: B.h }; };   // Innenbereich des Rahmens über dem Schriftfeld (mm auf dem Papier)
  function bauBox() {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; const n = (x, y) => { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); };
    for (const e of z.el) {
      if (e.punkte && e.richtung) { e.punkte.forEach(p => n(p[0], p[1])); if (e.richtung === "h") { n(e.punkte[0][0], e.lage - 6); n(e.punkte[1][0], e.lage + 3); } else { n(e.lage - 6, e.punkte[0][1]); n(e.lage + 3, e.punkte[1][1]); } }
      else if (e.punkte) { e.punkte.forEach(p => n(p[0], p[1])); if (e.typ === "mass" && e.punkte.length === 2) { const [p1, p2] = e.punkte, L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1, nx = -(p2[1] - p1[1]) / L, ny = (p2[0] - p1[0]) / L, ab = (e.abstand ?? 10) + Math.sign(e.abstand ?? 10) * 6; n(p1[0] + nx * ab, p1[1] + ny * ab); n(p2[0] + nx * ab, p2[1] + ny * ab); } }
      else if (e.typ === "bohrung") { n(e.x - e.d / 2 - 3, e.y - e.d / 2 - 3); n(e.x + e.d / 2 + 3, e.y + e.d / 2 + 3); if (e.dmass) n(e.x + e.d / 2 + 20, e.y - e.d / 2 - 8); }
      else if (e.typ === "text") { n(e.x, e.y - 6); n(e.x + String(e.text || "").length * (e.groesse || 5) * 0.6, e.y); }
      else n(e.x, e.y), n(e.x + (e.w || 0), e.y + (e.h || 0));
    }
    return a === Infinity ? null : { x: a, y: b, w: c - a, h: d - b };
  }
  function passtAufsBlatt() { const b = bauBox(); if (!b) return true; const kk = k(), N = nutz(); return b.x * kk >= N.x0 - 5 && b.y * kk >= N.y0 - 5 && (b.x + b.w) * kk <= N.w - 10 && (b.y + b.h) * kk <= N.h - 10 && !((b.x + b.w) * kk > N.w - 190 && (b.y + b.h) * kk > N.h - 38); }
  function einpassen() {
    const b = bauBox(); if (!b) { toast("Erst etwas zeichnen."); return; }
    const NUTZ = nutz(), W = NUTZ.x1 - NUTZ.x0, H = NUTZ.y1 - NUTZ.y0, noetig = Math.min(W / b.w, H / b.h);
    const STUFEN = [[2, "2:1"], [1, "1:1"], [0.5, "1:2"], [0.4, "1:2,5"], [0.2, "1:5"], [0.1, "1:10"], [0.05, "1:20"]];
    const [kk, text] = STUFEN.find(([f]) => f <= noetig) || STUFEN[STUFEN.length - 1];
    z.schriftfeld = z.schriftfeld || {}; z.schriftfeld.massstab = text;
    // in die Mitte des freien Bereichs schieben (in echten mm)
    const zielX = (NUTZ.x0 + (W - b.w * kk) / 2) / kk, zielY = (NUTZ.y0 + (H - b.h * kk) / 2) / kk, dx = r2(zielX - b.x), dy = r2(zielY - b.y);
    for (const e of z.el) { if (e.punkte) { e.punkte = e.punkte.map(p => [r2(p[0] + dx), r2(p[1] + dy)]); if (e.richtung) e.lage = r2(e.lage + (e.richtung === "h" ? dy : dx)); } else { e.x = r2(e.x + dx); e.y = r2(e.y + dy); } }
    merken(); malen(); toast("Maßstab " + text + " – die Zeichnung passt jetzt aufs Blatt.");
  }

  /* ---- Eigenschaften rechts ---- */
  function eigenschaften() {
    const e = z.el.find(x => x.id === auswahl), ziel = box.querySelector(".z-eig");
    if (!e) { ziel.innerHTML = '<h3>Eigenschaften</h3><p class="leise">Nichts ausgewählt.</p>'; extra(); return; }
    const def = SYM[e.typ] || LINIEN[e.typ], felder = e.typ === "mass" && e.richtung ? [["lage", "Lage der Maßlinie (" + (e.richtung === "h" ? "Y" : "X") + ")", "laenge"], ["text", "Maßzahl selbst eintragen (leer = gemessen)"]] : def.felder || [];
    ziel.innerHTML = "<h3>" + esc(def.name) + "</h3>" + felder.map(([k2, label, art, opt]) => '<label class="z-feld"><span>' + esc(label) + "</span>" +
      (art === "lang" ? '<textarea data-f="' + k2 + '" rows="2">' + esc(e[k2] ?? (SYM[e.typ] && SYM[e.typ].form ? "" : "")) + "</textarea>"
        : art === "janein" ? '<input type="checkbox" data-f="' + k2 + '"' + (e[k2] !== false && (e[k2] || k2 === "mitte") ? " checked" : "") + ">"
        : art === "wahl" ? '<select data-f="' + k2 + '">' + opt.map(([v, t]) => '<option value="' + v + '"' + ((e[k2] || opt[0][0]) === v ? " selected" : "") + ">" + esc(t) + "</option>").join("") + "</select>"
        : art === "laenge" ? '<span class="z-mass"><input data-f="' + k2 + '" inputmode="decimal" value="' + esc(e[k2] == null ? "" : masszahl(e[k2])) + '"><i>' + EINH + "</i></span>"
        : '<input data-f="' + k2 + '" ' + (art === "zahl" ? 'type="number" step="any"' : "") + ' value="' + esc(e[k2] ?? "") + '">') + "</label>").join("") +
      (e.typ === "mass" ? '<p class="leise">Gemessen: ' + masszahl(e.richtung === "h" ? Math.abs(e.punkte[1][0] - e.punkte[0][0]) : e.richtung === "v" ? Math.abs(e.punkte[1][1] - e.punkte[0][1]) : Math.hypot(e.punkte[1][0] - e.punkte[0][0], e.punkte[1][1] - e.punkte[0][1])) + " " + EINH + "</p>" : "") +
      (!e.punkte && SYM[e.typ].pins ? '<p class="leise">Tipp: Leitungen rasten an den Anschlüssen ein.</p>' : "");
    ziel.querySelectorAll("[data-f]").forEach(f => {
      const art = (felder.find(x => x[0] === f.dataset.f) || [])[2];
      if (art === "laenge") {
        // erst übernehmen, wenn die Eingabe eine gültige Zahl ist (Komma geht auch, „cm“/„mm“ dahinter auch)
        const nehmen = (endgueltig) => {
          const v = laengeLesen(f.value);
          if (!Number.isFinite(v)) { f.classList.toggle("falsch", f.value.trim() !== ""); if (endgueltig) { f.value = e[f.dataset.f] == null ? "" : masszahl(e[f.dataset.f]); f.classList.remove("falsch"); } return; }
          f.classList.remove("falsch");
          if (["w", "h", "d"].includes(f.dataset.f) && !(v > 0)) return;
          e[f.dataset.f] = v; malenOhneEig(); if (endgueltig) { f.value = masszahl(v); merken(); }
        };
        f.oninput = () => nehmen(false); f.onchange = () => nehmen(true); f.onblur = () => nehmen(true);
        f.onkeydown = (ev) => { if (ev.key === "Enter") { nehmen(true); f.blur(); } };
        return;
      }
      f.onchange = f.oninput = () => {
        const v = art === "janein" ? f.checked : art === "zahl" ? (f.value === "" ? undefined : Number(f.value)) : f.value;
        if (v === undefined) delete e[f.dataset.f]; else e[f.dataset.f] = v;
        if (art === "zahl" && ["w", "h", "d"].includes(f.dataset.f) && !(v > 0)) e[f.dataset.f] = f.dataset.f === "d" ? 1 : 10;
        if (f.dataset.f === "text" && e.typ === "mass" && !f.value) delete e.text;
        malenOhneEig(); if (f.type !== "text" && f.tagName !== "TEXTAREA") merken();
      };
      f.onblur = () => merken();
    });
    extra();
  }
  function malenOhneEig() { eigenschaftenAus = true; malen(); eigenschaftenAus = false; extra(); }
  function extra() {
    const x = box.querySelector(".z-extra");
    if (modus !== "schaltplan") { x.innerHTML = modus === "bauplan" ? '<h3>Einheit und Raster</h3><label class="z-feld"><span>Maße eingeben und anzeigen in</span><select id="zE"><option value="mm">mm (wie in der Norm)</option><option value="cm">cm</option></select></label><label class="z-feld"><span>Einrasten alle</span><select id="zR"><option value="0.5">0,5 mm</option><option value="1">1 mm</option><option value="5">5 mm (0,5 cm)</option><option value="10">10 mm (1 cm)</option></select></label>' +
        '<h3>Blatt</h3><label class="z-feld"><span>Blattgröße</span><select id="zB"><option value="A4">A4 quer</option><option value="A3">A3 quer (für große Teile)</option></select></label><label class="check"><input type="checkbox" id="zH"' + (z.hilfslinien !== false ? " checked" : "") + '> Hilfslinien für Ansichten</label><p class="leise">Maßstab jetzt: <b>' + esc((z.schriftfeld && z.schriftfeld.massstab) || "1:1") + '</b></p><button type="button" class="pill hell klein" id="zFit">📐 AUFS BLATT EINPASSEN</button><p class="leise">Wählt den passenden Maßstab (1:1, 1:2, 1:5 …) und schiebt die Zeichnung in den Rahmen. Die Maßzahlen bleiben die echten Maße. Du kannst auch „12,5 cm“ oder „120 mm“ eintippen. Beim Drucken „Tatsächliche Größe / 100 %“ wählen.</p>' : '<p class="leise">Symbole nach DIN 66001. Tipp: Verzweigung hat zwei Ausgänge – beschrifte die Pfeile mit „ja“ und „nein“.</p>';
      const r = x.querySelector("#zR"); if (r) { r.value = String(z.raster || 1); r.onchange = () => { z.raster = Number(r.value); merken(); }; }
      const ei = x.querySelector("#zE"); if (ei) { ei.value = z.einheit || "mm"; ei.onchange = () => { z.einheit = ei.value; if (ei.value === "cm" && (z.raster || 1) < 5) z.raster = 5; merken(); malen(); }; }
      const fit = x.querySelector("#zFit"); if (fit) fit.onclick = einpassen;
      const bl = x.querySelector("#zB"); if (bl) { bl.value = z.blatt || "A4"; bl.onchange = () => { z.blatt = bl.value; einpassenFenster(); merken(); malen(); }; }
      const hl = x.querySelector("#zH"); if (hl) hl.onchange = () => { z.hilfslinien = hl.checked; merken(); malen(); };
      return; }
    const imCode = pinsAusCode(code ? code() : ""), imPlan = verbundenePins(z), hatUno = z.el.some(e => e.typ === "arduino");
    let h = "<h3>Pins: Code ↔ Plan</h3>";
    if (!hatUno) h += '<p class="leise">Setz einen Arduino Uno ein, dann vergleicht das Programm hier, ob die Pins aus deinem Code im Plan verbunden sind.</p>';
    else {
      h += imCode.length ? '<table class="z-pins">' + imCode.map(p => "<tr><td><b>" + p.pin + "</b></td><td>" + esc(p.arten.join(", ")) + '<small> · Zeile ' + p.zeilen.join(", ") + "</small></td><td>" + (imPlan.has(p.pin) ? '<span class="ok-z">✔ im Plan</span>' : '<span class="nein-z">✖ fehlt im Plan</span>') + "</td></tr>").join("") + "</table>" : '<p class="leise">In deinem Code wird noch kein Pin benutzt.</p>';
      const nurPlan = [...imPlan].filter(p => /^[AD]\d+$/.test(p) && !imCode.some(c => c.pin === p));
      if (nurPlan.length) h += '<p class="leise">Im Plan verbunden, aber nicht im Code: ' + nurPlan.join(", ") + "</p>";
      h += '<p class="leise">Das ist nur eine Kontrolle – zeichnen musst du selbst.</p>';
    }
    x.innerHTML = h;
  }

  /* ---- Maus ---- */
  let letzterDruck = { t: 0, x: 0, y: 0 };
  svg.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0) return;
    const p = punkt(ev);
    // Doppelklick selbst erkennen (das Bild wird bei jedem Klick neu gezeichnet, dann kommt kein echtes dblclick)
    const doppel = ev.timeStamp - letzterDruck.t < 400 && Math.hypot(ev.clientX - letzterDruck.x, ev.clientY - letzterDruck.y) < 6;
    letzterDruck = { t: ev.timeStamp, x: ev.clientX, y: ev.clientY };
    if (doppel && entwurf && LINIEN[entwurf.typ] && LINIEN[entwurf.typ].viele) { if (entwurf.typ === "kette") { entwurf.punkte = entwurf.punkte.slice(0, -1).length >= 2 && entwurf.zuletzt ? entwurf.punkte.slice(0, -1) : entwurf.punkte; ketteFertig(p); } else fertigLinie(); return; }
    if (werkzeug === "auswahl") {
      const gr = ev.target.closest("[data-griff]");
      if (gr) { ziehen = { griff: Number(gr.dataset.griff), id: auswahl }; svg.setPointerCapture(ev.pointerId); return; }
      const t = ev.target.closest("[data-id]");
      auswahl = t ? t.dataset.id : null;
      if (t) { const e = z.el.find(x => x.id === auswahl); ziehen = { id: auswahl, start: p, orig: JSON.parse(JSON.stringify(e)), bewegt: false }; svg.setPointerCapture(ev.pointerId); }
      malen(); return;
    }
    if (SYM[werkzeug]) {
      const s = SYM[werkzeug], e = { id: neueId(), typ: werkzeug, x: einrasten(p[0] - (s.form && s.modus !== "bauplan" ? s.w / 2 : 0)), y: einrasten(p[1] - (s.form && s.modus !== "bauplan" ? s.h / 2 : 0)) };
      if (s.form) { e.w = s.w; e.h = s.h; }
      if (werkzeug === "bohrung") e.d = s.d;
      if (werkzeug === "text") e.text = modus === "bauplan" ? "Draufsicht" : "Text";
      if (werkzeug === "text" && modus === "bauplan") e.groesse = 5;
      z.el.push(e); auswahl = e.id; merken(); werkzeugSetzen("auswahl"); return;
    }
    if (LINIEN[werkzeug]) {
      const f = fang(p);
      if (!entwurf) { entwurf = { id: neueId(), typ: werkzeug, punkte: [f.p], maus: f.p }; malen(); return; }
      if (werkzeug === "mass") {
        if (entwurf.punkte.length === 1) { entwurf.punkte.push(f.p); malen(); return; }
        entwurf.abstand = abstandAus(entwurf.punkte, p); delete entwurf.maus; z.el.push(entwurf); auswahl = entwurf.id; entwurf = null; merken(); malen(); return;
      }
      let q = f.p; const letzte = entwurf.punkte[entwurf.punkte.length - 1];
      if (werkzeug === "kette") { entwurf.zuletzt = q[0] !== letzte[0] || q[1] !== letzte[1]; if (entwurf.zuletzt) entwurf.punkte.push(q); malen(); return; }
      if (LINIEN[werkzeug].viele && !ev.shiftKey && letzte[0] !== q[0] && letzte[1] !== q[1]) entwurf.punkte.push([q[0], letzte[1]]);   // rechtwinklig
      if (q[0] !== letzte[0] || q[1] !== letzte[1]) entwurf.punkte.push(q);
      if (!LINIEN[werkzeug].viele || (f.pin && entwurf.punkte.length > 1)) fertigLinie(); else malen();
    }
  });
  svg.addEventListener("pointermove", (ev) => {
    const p = punkt(ev);
    if (entwurf) { entwurf.maus = entwurf.typ === "mass" && entwurf.punkte.length === 2 ? p : fang(p).p; malen(); return; }
    if (!ziehen) return;
    const e = z.el.find(x => x.id === ziehen.id); if (!e) return;
    if (ziehen.griff != null) { e.punkte[ziehen.griff] = fang(p, e.id).p; malen(); return; }
    const dx = p[0] - ziehen.start[0], dy = p[1] - ziehen.start[1]; if (!ziehen.bewegt && Math.hypot(dx, dy) < (modus === "bauplan" ? 0.5 : 3)) return;
    ziehen.bewegt = true;
    if (e.punkte && e.richtung) { e.lage = einrasten(ziehen.orig.lage + (e.richtung === "h" ? dy : dx)); malen(); return; }
    if (e.punkte) e.punkte = ziehen.orig.punkte.map(q => [einrasten(q[0] + dx), einrasten(q[1] + dy)]);
    else { e.x = einrasten(ziehen.orig.x + dx); e.y = einrasten(ziehen.orig.y + dy); drahtMitziehen(ziehen.orig, e); }
    malen();
  });
  svg.addEventListener("pointerup", () => { if (ziehen) { ziehen = null; merken(); malen(); } });
  svg.addEventListener("dblclick", (ev) => { if (entwurf && entwurf.typ === "kette") { ketteFertig(punkt(ev)); return; } if (entwurf && LINIEN[entwurf.typ].viele) fertigLinie(); });
  // Maßkette in einzelne Maße zerlegen: alle auf derselben Linie (waagerecht oder senkrecht – je nach den ersten beiden Punkten)
  function ketteFertig(maus) {
    const p = entwurf.punkte.filter((q, i, a) => i === 0 || q[0] !== a[i - 1][0] || q[1] !== a[i - 1][1]);
    if (p.length < 2) { toast("Mindestens zwei Punkte anklicken."); return; }
    const h = Math.abs(p[1][0] - p[0][0]) >= Math.abs(p[1][1] - p[0][1]), lage = einrasten(h ? maus[1] : maus[0]);
    const sortiert = p.slice().sort((a, b) => h ? a[0] - b[0] : a[1] - b[1]);
    for (let i = 0; i < sortiert.length - 1; i++) { const a = sortiert[i], b = sortiert[i + 1]; if ((h ? b[0] - a[0] : b[1] - a[1]) < 0.01) continue; z.el.push({ id: neueId(), typ: "mass", richtung: h ? "h" : "v", lage, punkte: [a, b] }); }
    entwurf = null; merken(); malen(); toast("Maßkette mit " + (sortiert.length - 1) + " Maßen.");
  }
  // hängende Leitungen/Pfeile mitnehmen, wenn ein Teil verschoben wird
  function drahtMitziehen(alt, neu) {
    if (modus === "bauplan") return;
    const a = anschluesse(alt), b = anschluesse(neu);
    for (const l of z.el) if (l.punkte && l.typ !== "mass") for (const ende of [0, l.punkte.length - 1]) {
      const orig = (ziehen.linien || (ziehen.linien = {}))[l.id + ":" + ende] || (ziehen.linien[l.id + ":" + ende] = l.punkte[ende].slice());
      const i = a.findIndex(q => Math.abs(q[0] - orig[0]) < 0.6 && Math.abs(q[1] - orig[1]) < 0.6);
      if (i >= 0) { const nb = ende === 0 ? 1 : l.punkte.length - 2, alte = l.punkte[ende]; l.punkte[ende] = [b[i][0], b[i][1]]; if (l.punkte.length > 2 && nb > 0 && nb < l.punkte.length - 1) { const nachbar = l.punkte[nb]; if (Math.abs(nachbar[1] - alte[1]) < 0.6) nachbar[1] = b[i][1]; else if (Math.abs(nachbar[0] - alte[0]) < 0.6) nachbar[0] = b[i][0]; } }
    }
  }
  function fertigLinie() { if (!entwurf) return; if (entwurf.typ === "kette") { ketteFertig(entwurf.maus || entwurf.punkte[entwurf.punkte.length - 1]); return; } delete entwurf.maus; if (entwurf.punkte.length >= 2) { z.el.push(entwurf); auswahl = entwurf.id; merken(); } entwurf = null; malen(); }

  /* ---- Knöpfe und Tasten ---- */
  function loeschen() { if (!auswahl) return; z.el = z.el.filter(e => e.id !== auswahl); auswahl = null; merken(); malen(); }
  function drehenAus() { const e = z.el.find(x => x.id === auswahl); if (!e || e.punkte || SYM[e.typ].modus !== "schaltplan") { if (e) toast("Nur Schaltplan-Symbole lassen sich drehen."); return; } const alt = JSON.parse(JSON.stringify(e)); e.rot = ((e.rot || 0) + 90) % 360; ziehen = { linien: {} }; drahtMitziehen(alt, e); ziehen = null; merken(); malen(); }
  function verdoppeln() { const e = z.el.find(x => x.id === auswahl); if (!e) return; const n = JSON.parse(JSON.stringify(e)); n.id = neueId(); const d = modus === "bauplan" ? 10 : 20; if (n.punkte) n.punkte = n.punkte.map(q => [q[0] + d, q[1] + d]); else { n.x += d; n.y += d; } z.el.push(n); auswahl = n.id; merken(); malen(); }
  async function exportieren(art) {
    const datei = (name || "projekt").replace(/[^\w-]+/g, "_") + "_" + modus;
    if (!KC) { toast("Exportieren geht nur im PC-Programm."); return; }
    const s = svgText(modus, z);
    let ziel = null;
    if (art === "svg") ziel = await KC.exportSpeichern({ name: datei + ".svg", art: "svg", text: s });
    if (art === "png") ziel = await KC.exportSpeichern({ name: datei + ".png", art: "png", base64: await pngAusSvg(s, modus === "bauplan" ? 3508 : 2400) });
    if (art === "pdf") ziel = await KC.pdfSpeichern({ html: druckHtml(modus, z), name: datei + ".pdf", quer: true });
    if (art === "druck") { await KC.drucken({ html: druckHtml(modus, z) }); return; }
    if (art === "notizen") {
      if (!KC.anNotizen) { toast("Geht erst mit der neuesten Version."); return; }
      const png = await pngAusSvg(s, modus === "bauplan" ? 2480 : 2000);
      const r = await KC.anNotizen({ name: TITEL[modus] + (name ? " – " + name : ""), bild: "data:image/png;base64," + png, fach: "NWT" });
      if (r && r.ok) toast("FIDELIA Notizen öffnet sich im Browser und legt die Zeichnung im Fach NWT ab. Falls nicht: Die Datei liegt auch in Dokumente › Kometenwerk Code › Für Notizen.", 9000);
      return;
    }
    if (ziel) toast("Gespeichert: " + ziel);
  }
  function schriftfeldDialog() {
    const d = document.createElement("dialog"); d.className = "dialog"; const sf = z.schriftfeld || (z.schriftfeld = {});
    const F = [["titel", "Benennung (z. B. Deckplatte Reaktionstester)"], ["name", "Name"], ["klasse", "Klasse / Gruppe"], ["datum", "Datum"], ["massstab", "Maßstab (z. B. 1:1 oder 1:2)"], ["werkstoff", "Werkstoff (z. B. Sperrholz 4 mm)"], ["blatt", "Blatt"], ["nummer", "Zeichnungs-Nr."]];
    d.innerHTML = "<h2>Schriftfeld</h2>" + F.map(([k2, l]) => '<label class="z-feld breit"><span>' + l + '</span><input data-s="' + k2 + '" value="' + esc(sf[k2] || "") + '"></label>').join("") + '<div class="dialog-fuss"><button type="button" class="pill" data-ok>OK</button></div>';
    box.appendChild(d); d.showModal();
    d.querySelector("[data-ok]").onclick = () => { d.querySelectorAll("[data-s]").forEach(i => { sf[i.dataset.s] = i.value.trim(); }); if (sf.massstab && !/^\s*\d+(?:[.,]\d+)?\s*:\s*\d+(?:[.,]\d+)?\s*$/.test(sf.massstab)) toast("Maßstab bitte wie „1:2“ schreiben."); d.close(); d.remove(); merken(); malen(); };
  }
  const AKT = {
    rueck: () => zurueck(-1), vor: () => zurueck(1), drehen: drehenAus, loeschen, raster: () => { raster = !raster; malen(); },
    "zoom+": () => { zoom *= 1.25; malen(); }, "zoom-": () => { zoom /= 1.25; malen(); },
    sf: schriftfeldDialog, titel: () => { const t = prompt("Überschrift über der Zeichnung:", z.titel || ""); if (t != null) { z.titel = t.trim(); merken(); malen(); } },
    png: () => exportieren("png"), svg: () => exportieren("svg"), notizen: () => exportieren("notizen"), pdf: () => exportieren("pdf"), druck: () => exportieren("druck"), zu: schliessen
  };
  box.querySelectorAll(".z-kopf [data-a]").forEach(b => b.onclick = () => AKT[b.dataset.a]());
  function taste(ev) {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || box.querySelector("dialog[open]")) return;
    const strg = ev.ctrlKey || ev.metaKey, t = ev.key.toLowerCase();
    if (ev.key === "Escape") { if (entwurf) { entwurf = null; malen(); } else if (werkzeug !== "auswahl") werkzeugSetzen("auswahl"); else if (auswahl) { auswahl = null; malen(); } ev.preventDefault(); }
    else if (ev.key === "Enter" && entwurf) fertigLinie();
    else if (ev.key === "Delete" || ev.key === "Backspace") { ev.preventDefault(); loeschen(); }
    else if (strg && t === "z") { ev.preventDefault(); zurueck(ev.shiftKey ? 1 : -1); }
    else if (strg && t === "y") { ev.preventDefault(); zurueck(1); }
    else if (strg && t === "d") { ev.preventDefault(); verdoppeln(); }
    else if (!strg && t === "r") drehenAus();
    else if (auswahl && /^Arrow/.test(ev.key)) { ev.preventDefault(); const e = z.el.find(x => x.id === auswahl), s = (ev.shiftKey ? 10 : 1) * (modus === "bauplan" ? (z.raster || 1) : 10), dx = ev.key === "ArrowLeft" ? -s : ev.key === "ArrowRight" ? s : 0, dy = ev.key === "ArrowUp" ? -s : ev.key === "ArrowDown" ? s : 0; if (e.punkte) { e.punkte = e.punkte.map(q => [r2(q[0] + dx), r2(q[1] + dy)]); if (e.richtung) e.lage = r2(e.lage + (e.richtung === "h" ? dy : dx)); } else { const alt = JSON.parse(JSON.stringify(e)); e.x = r2(e.x + dx); e.y = r2(e.y + dy); ziehen = { linien: {} }; drahtMitziehen(alt, e); ziehen = null; } merken(); malen(); }
  }
  document.addEventListener("keydown", taste, true);
  function schliessen() { merken(); document.removeEventListener("keydown", taste, true); box.remove(); }
  // Blatt ganz sichtbar machen (passend zum Fenster)
  const einpassenFenster = () => { const fl = box.querySelector(".z-flaeche"), B = blattMass(z); zoom = Math.max(0.8, Math.min(4, (fl.clientWidth - 44) / B.w, (fl.clientHeight - 44) / B.h)); };
  if (modus === "bauplan") einpassenFenster();
  fussText(); malen();
  return { schliessen, get daten() { return z; } };
}
