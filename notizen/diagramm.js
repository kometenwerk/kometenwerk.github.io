// FIDELIA Notizen · Diagramme (Säulen, Balken, Linien, Kreis) als SVG – für Tabellen und Präsentationen

import * as F from "./formel.js";

export const FARBEN = ["#2f6fdb", "#ff8a3c", "#1a8f4c", "#c93a3a", "#6d3fd6", "#0f766e", "#b8235a", "#a36b00"];
export const ARTEN = [["saeule", "📊 Säulen"], ["balken", "📶 Balken"], ["linie", "📈 Linien"], ["kreis", "🥧 Kreis"], ["punkt", "⁘ Punkte (x-y)"]];

// Ausgleichsgerade (lineare Regression): y = m·x + b, dazu das Bestimmtheitsmaß R²
export function trendlinie(punkte) {
  const p = punkte.filter(q => Number.isFinite(q[0]) && Number.isFinite(q[1])), n = p.length;
  if (n < 2) return null;
  const sx = p.reduce((a, q) => a + q[0], 0), sy = p.reduce((a, q) => a + q[1], 0), mx = sx / n, my = sy / n;
  let sxx = 0, sxy = 0, syy = 0; for (const [x, y] of p) { sxx += (x - mx) ** 2; sxy += (x - mx) * (y - my); syy += (y - my) ** 2; }
  if (!sxx) return null;
  const m = sxy / sxx, b = my - m * mx;
  return { m, b, r2: syy ? (sxy * sxy) / (sxx * syy) : 1 };
}
const xWert = (l, i) => { const v = Number(String(l).replace(",", ".")); return Number.isFinite(v) && String(l).trim() !== "" ? v : i + 1; };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Werte aus einem Bereich holen: erste Zeile = Namen der Reihen (wenn Text), erste Spalte = Beschriftungen (wenn Text)
export function datenAusBereich(rechnung, blatt, bereich) {
  const [a, b] = bereich.split(":"), p = F.zelleLesen(a), q = F.zelleLesen(b || a);
  if (!p || !q) return null;
  const z0 = Math.min(p.z, q.z), z1 = Math.max(p.z, q.z), s0 = Math.min(p.s, q.s), s1 = Math.max(p.s, q.s);
  const w = (z, s) => rechnung.wert(blatt, F.zelleName(z, s));
  const kopf = s1 > s0 || z1 > z0 ? Array.from({ length: s1 - s0 + 1 }, (_, i) => w(z0, s0 + i)).slice(1).some(v => typeof v === "string" && v !== "") : false;
  const ersteSpalte = Array.from({ length: z1 - z0 + 1 }, (_, i) => w(z0 + i, s0)).slice(kopf ? 1 : 0);
  // Erste Spalte als Beschriftung: wenn Text – oder aufsteigende Zahlen wie Zeit/Jahr (x-Achse)
  const steigend = ersteSpalte.length > 1 && ersteSpalte.every((v, i) => typeof v === "number" && (i === 0 || v > ersteSpalte[i - 1]));
  const links = s1 > s0 && (ersteSpalte.some(v => typeof v === "string" && v !== "") || steigend);
  const zs = kopf ? z0 + 1 : z0, ss = links ? s0 + 1 : s0;
  const labels = [], reihen = [];
  for (let s = ss; s <= s1; s++) reihen.push({ name: kopf ? String(F.anzeigen(w(z0, s))) : "Reihe " + (s - ss + 1), werte: [] });
  for (let z = zs; z <= z1; z++) {
    labels.push(links ? String(F.anzeigen(w(z, s0))) : String(z - zs + 1));
    reihen.forEach((r, i) => { const v = w(z, ss + i); r.werte.push(typeof v === "number" ? v : null); });
  }
  return { labels, reihen: reihen.filter(r => r.werte.some(v => v !== null)) };
}

function schritt(max) {
  const roh = max / 5, p = Math.pow(10, Math.floor(Math.log10(roh || 1))), n = roh / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
const zahl = (v) => F.anzeigen(Number(v.toPrecision(10)));

// Ergibt fertigen SVG-Text (Breite/Höhe in px). farbeText für Dunkelmodus anpassbar.
export function svg(daten, art, titel, W = 640, H = 380, { farbeText = "#101826", farbeLinie = "#dfe3ea", farben = FARBEN, trend = true, gleichung = true } = {}) {
  if (!daten || !daten.reihen.length) return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '"><text x="' + W / 2 + '" y="' + H / 2 + '" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#8a94a6">Keine Zahlen im Bereich</text></svg>';
  let o = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" font-family="Space Grotesk, Arial, sans-serif">';
  o += '<rect width="' + W + '" height="' + H + '" fill="#ffffff" rx="8"/>';
  let oben = 16;
  if (titel) { o += '<text x="' + W / 2 + '" y="28" text-anchor="middle" font-size="17" font-weight="600" fill="' + farbeText + '">' + esc(titel) + "</text>"; oben = 44; }
  const legende = daten.reihen.length > 1 || art === "kreis";
  const unten = 34 + (legende ? 26 : 0);
  if (art === "kreis") {
    const r0 = daten.reihen[0], werte = r0.werte.map(v => Math.max(0, v || 0)), summe = werte.reduce((a, b) => a + b, 0) || 1;
    const cx = W / 2, cy = oben + (H - oben - unten + 20) / 2, r = Math.min(W / 2 - 30, (H - oben - unten) / 2);
    let w = -Math.PI / 2;
    werte.forEach((v, i) => {
      const anteil = v / summe, w2 = w + anteil * Math.PI * 2, f = farben[i % farben.length];
      if (anteil >= 0.9999) o += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + f + '"/>';
      else if (anteil > 0) o += '<path d="M' + cx + " " + cy + "L" + (cx + r * Math.cos(w)).toFixed(1) + " " + (cy + r * Math.sin(w)).toFixed(1) + "A" + r + " " + r + " 0 " + (anteil > 0.5 ? 1 : 0) + " 1 " + (cx + r * Math.cos(w2)).toFixed(1) + " " + (cy + r * Math.sin(w2)).toFixed(1) + 'Z" fill="' + f + '" stroke="#fff" stroke-width="2"/>';
      if (anteil > 0.04) { const m = (w + w2) / 2; o += '<text x="' + (cx + r * 0.65 * Math.cos(m)).toFixed(1) + '" y="' + (cy + r * 0.65 * Math.sin(m) + 5).toFixed(1) + '" text-anchor="middle" font-size="13" font-weight="600" fill="#fff">' + Math.round(anteil * 100) + " %</text>"; }
      w = w2;
    });
    o += legendeSvg(daten.labels.map((l, i) => [l, farben[i % farben.length]]), W, H, farbeText);
    return o + "</svg>";
  }
  if (art === "punkt") return o + punkteSvg(daten, W, H, oben, unten, legende, { farbeText, farbeLinie, farben, trend, gleichung }) + "</svg>";
  const alle = daten.reihen.flatMap(r => r.werte).filter(v => v !== null);
  let max = Math.max(0, ...alle), min = Math.min(0, ...alle);
  if (max === min) max = min + 1;
  const st = schritt(max - min); max = Math.ceil(max / st) * st; min = Math.floor(min / st) * st;
  const links = 16 + Math.max(...[max, min].map(v => zahl(v).length)) * 7.5, rechts = 16;
  const pw = W - links - rechts, ph = H - oben - unten;
  const quer = art === "balken";
  const pos = (v) => quer ? links + (v - min) / (max - min) * pw : oben + ph - (v - min) / (max - min) * ph;
  // Raster
  for (let v = min; v <= max + st / 2; v += st) {
    if (quer) o += '<line x1="' + pos(v).toFixed(1) + '" y1="' + oben + '" x2="' + pos(v).toFixed(1) + '" y2="' + (oben + ph) + '" stroke="' + farbeLinie + '"/><text x="' + pos(v).toFixed(1) + '" y="' + (oben + ph + 16) + '" text-anchor="middle" font-size="11" fill="#5b6578">' + zahl(v) + "</text>";
    else o += '<line x1="' + links + '" y1="' + pos(v).toFixed(1) + '" x2="' + (W - rechts) + '" y2="' + pos(v).toFixed(1) + '" stroke="' + farbeLinie + '"/><text x="' + (links - 6) + '" y="' + (pos(v) + 4).toFixed(1) + '" text-anchor="end" font-size="11" fill="#5b6578">' + zahl(v) + "</text>";
  }
  const n = daten.labels.length, feld = (quer ? ph : pw) / Math.max(1, n);
  const kurz = (t) => t.length > 12 ? t.slice(0, 11) + "…" : t;
  daten.labels.forEach((l, i) => {
    if (n > 16 && i % Math.ceil(n / 16)) return;
    if (quer) o += '<text x="' + (links - 6) + '" y="' + (oben + feld * (i + 0.5) + 4).toFixed(1) + '" text-anchor="end" font-size="11" fill="' + farbeText + '">' + esc(kurz(l)) + "</text>";
    else o += '<text x="' + (links + feld * (i + 0.5)).toFixed(1) + '" y="' + (oben + ph + 18) + '" text-anchor="middle" font-size="11" fill="' + farbeText + '">' + esc(kurz(l)) + "</text>";
  });
  const null0 = pos(Math.max(min, Math.min(max, 0)));
  if (art === "linie") {
    daten.reihen.forEach((r, k) => {
      const f = farben[k % farben.length]; let d = "";
      r.werte.forEach((v, i) => { if (v === null) return; const px = links + feld * (i + 0.5), py = pos(v); d += (d ? "L" : "M") + px.toFixed(1) + " " + py.toFixed(1); });
      o += '<path d="' + d + '" fill="none" stroke="' + f + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>';
      r.werte.forEach((v, i) => { if (v !== null) o += '<circle cx="' + (links + feld * (i + 0.5)).toFixed(1) + '" cy="' + pos(v).toFixed(1) + '" r="4" fill="#fff" stroke="' + f + '" stroke-width="2.5"/>'; });
    });
  } else {
    const k = daten.reihen.length, innen = feld * 0.72, b = innen / k;
    daten.reihen.forEach((r, j) => {
      const f = farben[j % farben.length];
      r.werte.forEach((v, i) => {
        if (v === null) return;
        const start = feld * i + (feld - innen) / 2 + b * j, p = pos(v);
        if (quer) o += '<rect x="' + Math.min(p, null0).toFixed(1) + '" y="' + (oben + start).toFixed(1) + '" width="' + Math.abs(p - null0).toFixed(1) + '" height="' + (b - 2).toFixed(1) + '" fill="' + f + '" rx="2"/>';
        else o += '<rect x="' + (links + start).toFixed(1) + '" y="' + Math.min(p, null0).toFixed(1) + '" width="' + (b - 2).toFixed(1) + '" height="' + Math.abs(p - null0).toFixed(1) + '" fill="' + f + '" rx="2"/>';
      });
    });
  }
  o += quer ? '<line x1="' + null0 + '" y1="' + oben + '" x2="' + null0 + '" y2="' + (oben + ph) + '" stroke="#8a94a6"/>' : '<line x1="' + links + '" y1="' + null0.toFixed(1) + '" x2="' + (W - rechts) + '" y2="' + null0.toFixed(1) + '" stroke="#8a94a6"/>';
  if (legende) o += legendeSvg(daten.reihen.map((r, i) => [r.name, farben[i % farben.length]]), W, H, farbeText);
  return o + "</svg>";
}

function achse(min, max) {
  if (max === min) { max += 1; min -= 1; }
  const st = schritt(max - min); return { min: Math.floor(min / st) * st, max: Math.ceil(max / st) * st, st };
}
function punkteSvg(daten, W, H, oben, unten, legende, { farbeText, farbeLinie, farben, trend, gleichung }) {
  const xs = daten.labels.map(xWert), ys = daten.reihen.flatMap(r => r.werte).filter(v => v !== null);
  const ax = achse(Math.min(...xs), Math.max(...xs)), ay = achse(Math.min(0, ...ys), Math.max(...ys));
  const links = 16 + Math.max(zahl(ay.max).length, zahl(ay.min).length) * 7.5, rechts = 16, pw = W - links - rechts, ph = H - oben - unten - (trend && gleichung ? 18 : 0);
  const px = (v) => links + (v - ax.min) / (ax.max - ax.min) * pw, py = (v) => oben + ph - (v - ay.min) / (ay.max - ay.min) * ph;
  let o = "";
  for (let v = ay.min; v <= ay.max + ay.st / 2; v += ay.st) o += '<line x1="' + links + '" y1="' + py(v).toFixed(1) + '" x2="' + (W - rechts) + '" y2="' + py(v).toFixed(1) + '" stroke="' + farbeLinie + '"/><text x="' + (links - 6) + '" y="' + (py(v) + 4).toFixed(1) + '" text-anchor="end" font-size="11" fill="#5b6578">' + zahl(v) + "</text>";
  for (let v = ax.min; v <= ax.max + ax.st / 2; v += ax.st) o += '<line x1="' + px(v).toFixed(1) + '" y1="' + oben + '" x2="' + px(v).toFixed(1) + '" y2="' + (oben + ph) + '" stroke="' + farbeLinie + '" stroke-dasharray="2 3"/><text x="' + px(v).toFixed(1) + '" y="' + (oben + ph + 16) + '" text-anchor="middle" font-size="11" fill="#5b6578">' + zahl(v) + "</text>";
  const gl = [];
  daten.reihen.forEach((r, k) => {
    const f = farben[k % farben.length], pkt = r.werte.map((v, i) => [xs[i], v]).filter(q => q[1] !== null);
    if (trend) { const t = trendlinie(pkt); if (t) { o += '<line x1="' + px(ax.min).toFixed(1) + '" y1="' + py(t.m * ax.min + t.b).toFixed(1) + '" x2="' + px(ax.max).toFixed(1) + '" y2="' + py(t.m * ax.max + t.b).toFixed(1) + '" stroke="' + f + '" stroke-width="2" stroke-dasharray="7 5" clip-path="url(#dgclip)"/>'; gl.push([f, "y = " + zahl(t.m) + "·x " + (t.b < 0 ? "− " : "+ ") + zahl(Math.abs(t.b)) + "   R² = " + zahl(Math.round(t.r2 * 1000) / 1000)]); } }
    for (const [x, y] of pkt) o += '<circle cx="' + px(x).toFixed(1) + '" cy="' + py(y).toFixed(1) + '" r="4.5" fill="' + f + '" stroke="#fff" stroke-width="1.5"/>';
  });
  o = '<defs><clipPath id="dgclip"><rect x="' + links + '" y="' + oben + '" width="' + pw + '" height="' + ph + '"/></clipPath></defs>' + o;
  if (gleichung && gl.length) o += gl.slice(0, 2).map((g, i) => '<text x="' + (links + 4 + i * pw / 2) + '" y="' + (oben + ph + 34) + '" font-size="12" fill="' + g[0] + '">' + esc(g[1]) + "</text>").join("");
  if (legende) o += legendeSvg(daten.reihen.map((r, i) => [r.name, farben[i % farben.length]]), W, H, farbeText);
  return o;
}

function legendeSvg(eintraege, W, H, farbeText) {
  const breite = eintraege.map(e => 26 + Math.min(18, e[0].length) * 7.2);
  const gesamt = breite.reduce((a, b) => a + b, 0);
  let x = Math.max(8, (W - gesamt) / 2), o = "";
  eintraege.forEach((e, i) => {
    if (x > W - 40) return;
    o += '<rect x="' + x.toFixed(1) + '" y="' + (H - 22) + '" width="12" height="12" rx="2" fill="' + e[1] + '"/><text x="' + (x + 17).toFixed(1) + '" y="' + (H - 12) + '" font-size="12" fill="' + farbeText + '">' + esc(e[0].length > 18 ? e[0].slice(0, 17) + "…" : e[0]) + "</text>";
    x += breite[i];
  });
  return o;
}

// SVG → PNG (für Word, PowerPoint, Heft)
export function alsPng(svgText, W, H, faktor = 2) {
  return new Promise((ok, nein) => {
    const img = new Image();
    img.onload = () => { const c = document.createElement("canvas"); c.width = W * faktor; c.height = H * faktor; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); ok(c.toDataURL("image/png")); };
    img.onerror = nein;
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgText);
  });
}
