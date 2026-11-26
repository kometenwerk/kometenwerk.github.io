// Kometenwerk Code · Arduino-Boards für den Schaltplan
// Jedes Board gibt es als Schaltzeichen (Kasten mit allen Pins) und „wie das echte Board“ (Pins oben/unten an den richtigen Stellen).
// Alle Anschlüsse liegen auf dem 10er-Raster, damit Leitungen sauber einrasten.

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const A_ = (n) => "A" + n;
const reihe = (von, bis, f = (i) => "D" + i) => { const a = []; if (von <= bis) for (let i = von; i <= bis; i++) a.push(f(i)); else for (let i = von; i >= bis; i--) a.push(f(i)); return a; };

const PWM = {
  uno: new Set(["D3", "D5", "D6", "D9", "D10", "D11"]),
  nano: new Set(["D3", "D5", "D6", "D9", "D10", "D11"]),
  mega: new Set([...reihe(2, 13), "D44", "D45", "D46"])
};
const STROM = ["IOREF", "RESET", "3.3V", "5V", "GND", "GND", "Vin"];

// Seiten: o = oben (links→rechts), u = unten (links→rechts), l = links (oben→unten), r = rechts (oben→unten); null = Lücke
const DEF = {
  uno: {
    name: "Arduino Uno",
    symbol: { l: [...STROM, null, ...reihe(0, 5, A_)], r: ["SCL", "SDA", "AREF", "GND", null, ...reihe(13, 8), null, ...reihe(7, 0)], o: ["USB"], minB: 120 },
    echt: { o: ["SCL", "SDA", "AREF", "GND", ...reihe(13, 8), null, ...reihe(7, 0)], u: [null, ...STROM, null, ...reihe(0, 5, A_)], l: [null, "USB", null, null, null, null, null], minH: 220, chip: true }
  },
  nano: {
    name: "Arduino Nano",
    symbol: { l: ["D13", "3.3V", "AREF", ...reihe(0, 7, A_), "5V", "RESET", "GND", "Vin"], r: [...reihe(12, 2), "GND", "RESET", "D0", "D1"], o: ["USB"], minB: 100 },
    echt: { o: ["D13", "3.3V", "AREF", ...reihe(0, 7, A_), "5V", "RESET", "GND", "Vin"], u: [...reihe(12, 2), "GND", "RESET", "D0", "D1"], l: ["USB"], minH: 170 }
  },
  mega: {
    name: "Arduino Mega",
    symbol: { l: [...STROM, null, ...reihe(0, 15, A_), null, ...reihe(22, 37)], r: ["SCL", "SDA", "AREF", "GND", null, ...reihe(13, 0), null, ...reihe(14, 21), null, ...reihe(38, 53)], o: ["USB"], minB: 140 },
    echt: { o: ["SCL", "SDA", "AREF", "GND", ...reihe(13, 8), null, ...reihe(7, 0), null, ...reihe(14, 21)], u: [null, ...STROM, null, ...reihe(0, 7, A_), null, ...reihe(8, 15, A_)],
      l: [null, "USB", null, null, null, null, null, null], r: ["5V", "5V", ...reihe(22, 53), "GND", "GND"], abst: { r: 10 }, minH: 440, minB: 680, chip: true }
  }
};
export const BRETT_NAMEN = { uno: "Arduino Uno", nano: "Arduino Nano", mega: "Arduino Mega" };

const ST = 20;   // Länge der Anschluss-Stummel
const auf10 = (v) => Math.ceil(v / 10) * 10;

// Lage aller Pins und Maße eines Boards berechnen
export function brettLayout(brett, ansicht) {
  const d = (DEF[brett] || DEF.uno)[ansicht === "echt" ? "echt" : "symbol"], ab = (s) => (d.abst && d.abst[s]) || 20;
  const n = (s) => (d[s] || []).length, laenge = (s) => n(s) ? (n(s) - 1) * ab(s) : 0;
  const unten = ansicht === "echt" ? 0 : 20, bw = auf10(Math.max(d.minB || 100, laenge("o") + 40, laenge("u") + 40)), bh = auf10(Math.max(d.minH || 100, laenge("l") + 40 + unten, laenge("r") + 40 + unten));
  const w = bw + 2 * ST, h = bh + 2 * ST, pins = [];
  const start = (s, koerper) => ST + Math.floor((koerper - laenge(s)) / 2 / 10) * 10;
  (d.l || []).forEach((p, i) => { if (p) pins.push([0, start("l", bh - unten) + i * ab("l"), p, "l"]); });
  (d.r || []).forEach((p, i) => { if (p) pins.push([w, start("r", bh - unten) + i * ab("r"), p, "r"]); });
  (d.o || []).forEach((p, i) => { if (p) pins.push([start("o", bw) + i * ab("o"), 0, p, "o"]); });
  (d.u || []).forEach((p, i) => { if (p) pins.push([start("u", bw) + i * ab("u"), h, p, "u"]); });
  return { w, h, bw, bh, pins, d };
}

export function brettSvg(brett, ansicht, text) {
  const L = brettLayout(brett, ansicht), { w, h, pins, d } = L, echt = ansicht === "echt", pwm = PWM[brett] || PWM.uno;
  const beschr = (p) => (pwm.has(p) ? "~" : "") + p;
  let o = "";
  if (echt) {
    o += '<rect x="' + ST + '" y="' + ST + '" width="' + L.bw + '" height="' + L.bh + '" rx="8" style="fill:#d9eef4;stroke-width:2"/>';
    // Steckleisten (schwarze Leisten unter den Pins)
    for (const s of ["o", "u", "l", "r"]) {
      const ps = pins.filter(p => p[3] === s && p[2] !== "USB"); if (!ps.length) continue;
      if (s === "o" || s === "u") { const y = s === "o" ? ST + 2 : h - ST - 10, x0 = Math.min(...ps.map(p => p[0])) - 6, x1 = Math.max(...ps.map(p => p[0])) + 6; o += '<rect x="' + x0 + '" y="' + y + '" width="' + (x1 - x0) + '" height="8" class="voll"/>'; }
      else { const x = s === "l" ? ST + 2 : w - ST - 10, y0 = Math.min(...ps.map(p => p[1])) - 5, y1 = Math.max(...ps.map(p => p[1])) + 5; o += '<rect x="' + x + '" y="' + y0 + '" width="8" height="' + (y1 - y0) + '" class="voll"/>'; }
    }
    const usb = pins.find(p => p[2] === "USB");
    if (usb) o += '<rect x="' + (ST - 8) + '" y="' + (usb[1] - 14) + '" width="' + (brett === "nano" ? 30 : 40) + '" height="28" rx="2" style="fill:#c4ccd0"/>' + T(ST + 6, usb[1] + 3, "USB", 'font-size="8"');
    if (brett !== "nano") o += '<rect x="' + (ST - 4) + '" y="' + (h - ST - 70) + '" width="44" height="34" rx="3" style="fill:#2b2b2b"/>' + T(ST + 18, h - ST - 49, "9V", 'font-size="8" text-anchor="middle" style="fill:#fff"');
    if (d.chip) o += '<rect x="' + (w / 2 - 20) + '" y="' + (h - ST - 60) + '" width="' + Math.min(150, L.bw / 2.6) + '" height="22" rx="2" style="fill:#2b2b2b"/>';
    else o += '<rect x="' + (w / 2 + 60) + '" y="' + (h / 2 - 14) + '" width="28" height="28" style="fill:#2b2b2b"/>';
    o += T(w / 2, d.chip ? h / 2 - 6 : h / 2 + 5, text || (DEF[brett] || DEF.uno).name, 'font-size="14" font-weight="700" text-anchor="middle"');
  } else {
    o += '<rect x="' + ST + '" y="' + ST + '" width="' + L.bw + '" height="' + L.bh + '" rx="4" class="dick"/>';
    o += T(w / 2, h - ST - 8, text || (DEF[brett] || DEF.uno).name, 'font-size="11" text-anchor="middle" font-weight="600"');
  }
  // Pins mit Beschriftung
  for (const [x, y, p, s] of pins) {
    const klein = s === "r" && (d.abst && d.abst.r) === 10, fs = klein ? 7 : 9;
    if (s === "l") o += '<path d="M0 ' + y + "h" + ST + '"/>' + (p === "USB" && echt ? "" : T(ST + (echt ? 14 : 4), y + 3, beschr(p), 'font-size="' + fs + '"'));
    if (s === "r") o += '<path d="M' + (w - ST) + " " + y + "h" + ST + '"/>' + T(w - ST - (echt ? 14 : 4), y + (klein ? 2.5 : 3), beschr(p), 'font-size="' + fs + '" text-anchor="end"');
    if (s === "o") o += '<path d="M' + x + " 0v" + ST + '"/>' + T(x + 3, ST + (echt ? 14 : 4), beschr(p), 'font-size="' + fs + '" transform="rotate(90 ' + (x + 3) + " " + (ST + (echt ? 14 : 4)) + ')"');
    if (s === "u") o += '<path d="M' + x + " " + (h - ST) + "v" + ST + '"/>' + T(x + 3, h - ST - (echt ? 14 : 4), beschr(p), 'font-size="' + fs + '" transform="rotate(-90 ' + (x + 3) + " " + (h - ST - (echt ? 14 : 4)) + ')"');
  }
  return o;
}
function T(x, y, t, o = "") { return '<text x="' + x + '" y="' + y + '" ' + o + ">" + esc(t) + "</text>"; }
