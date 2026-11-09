// FIDELIA Notizen · Hilfslinien und Ausrichten (wie die smarten Führungslinien in PowerPoint)
// Rechnet nur mit Rechtecken { x, y, w, h } – läuft auch ohne Browser (Tests mit node).

export function rahmen(liste) {
  if (!liste.length) return null;
  const x0 = Math.min(...liste.map(e => e.x)), y0 = Math.min(...liste.map(e => e.y));
  const x1 = Math.max(...liste.map(e => e.x + e.w)), y1 = Math.max(...liste.map(e => e.y + e.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
const ueberlappt = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > 0;

/* Einrasten beim Verschieben.
   box: bewegtes Rechteck (schon an der Wunschposition), andere: Rechtecke der anderen Elemente,
   opt: { breite, hoehe, fuehrungX: [], fuehrungY: [], raster: 0|Zahl, schwelle: 6, smart: true }
   Ergebnis: { dx, dy, linien: [{ achse: "x"|"y", pos, von, bis }], abstaende: [{ achse, von, bis, quer, wert }] } */
export function einrasten(box, andere, opt = {}) {
  const { breite = 960, hoehe = 540, fuehrungX = [], fuehrungY = [], raster = 0, schwelle = 6, smart = true } = opt;
  const kandX = [], kandY = [];
  if (smart) {
    kandX.push({ pos: 0 }, { pos: breite / 2, mitte: true }, { pos: breite });
    kandY.push({ pos: 0 }, { pos: hoehe / 2, mitte: true }, { pos: hoehe });
    for (const o of andere) {
      kandX.push({ pos: o.x, o }, { pos: o.x + o.w / 2, o }, { pos: o.x + o.w, o });
      kandY.push({ pos: o.y, o }, { pos: o.y + o.h / 2, o }, { pos: o.y + o.h, o });
    }
  }
  fuehrungX.forEach(p => kandX.push({ pos: p, fuehrung: true }));
  fuehrungY.forEach(p => kandY.push({ pos: p, fuehrung: true }));
  const ankerX = [box.x, box.x + box.w / 2, box.x + box.w], ankerY = [box.y, box.y + box.h / 2, box.y + box.h];
  const bester = (anker, kand) => { let b = null; for (const a of anker) for (const k of kand) { const d = k.pos - a; if (Math.abs(d) <= schwelle && (!b || Math.abs(d) < Math.abs(b.d))) b = { d, pos: k.pos }; } return b; };
  const bx = bester(ankerX, kandX), by = bester(ankerY, kandY);
  let dx = bx ? bx.d : 0, dy = by ? by.d : 0;
  const abstaende = [];
  // Gleiche Abstände zu den Nachbarn (links/rechts bzw. oben/unten)
  if (smart && !bx) {
    const zeile = andere.filter(o => ueberlappt(o.y, o.y + o.h, box.y, box.y + box.h));
    const L = zeile.filter(o => o.x + o.w <= box.x + 1).sort((a, b) => (b.x + b.w) - (a.x + a.w))[0];
    const R = zeile.filter(o => o.x >= box.x + box.w - 1).sort((a, b) => a.x - b.x)[0];
    if (L && R) {
      const gl = box.x - (L.x + L.w), gr = R.x - (box.x + box.w);
      if (Math.abs(gl - gr) <= schwelle * 2) { dx = (gr - gl) / 2; const g = (gl + gr) / 2, y = box.y + box.h / 2; abstaende.push({ achse: "x", von: L.x + L.w, bis: L.x + L.w + g, quer: y, wert: Math.round(g) }, { achse: "x", von: R.x - g, bis: R.x, quer: y, wert: Math.round(g) }); }
    }
  }
  if (smart && !by) {
    const spalte = andere.filter(o => ueberlappt(o.x, o.x + o.w, box.x, box.x + box.w));
    const O = spalte.filter(o => o.y + o.h <= box.y + 1).sort((a, b) => (b.y + b.h) - (a.y + a.h))[0];
    const U = spalte.filter(o => o.y >= box.y + box.h - 1).sort((a, b) => a.y - b.y)[0];
    if (O && U) {
      const go = box.y - (O.y + O.h), gu = U.y - (box.y + box.h);
      if (Math.abs(go - gu) <= schwelle * 2) { dy = (gu - go) / 2; const g = (go + gu) / 2, x = box.x + box.w / 2; abstaende.push({ achse: "y", von: O.y + O.h, bis: O.y + O.h + g, quer: x, wert: Math.round(g) }, { achse: "y", von: U.y - g, bis: U.y, quer: x, wert: Math.round(g) }); }
    }
  }
  // Raster nur, wenn nichts anderes eingerastet ist
  if (raster && !bx && !abstaende.some(a => a.achse === "x")) dx = Math.round(box.x / raster) * raster - box.x;
  if (raster && !by && !abstaende.some(a => a.achse === "y")) dy = Math.round(box.y / raster) * raster - box.y;
  // Linien zum Anzeigen: alle Stellen, an denen die verschobene Box jetzt bündig ist
  const fertig = { x: box.x + dx, y: box.y + dy, w: box.w, h: box.h };
  const linien = [];
  const sammeln = (achse, anker, kand) => {
    const gesehen = new Set();
    for (const a of anker) for (const k of kand) {
      if (Math.abs(k.pos - a) > 0.5 || gesehen.has(Math.round(k.pos))) continue;
      gesehen.add(Math.round(k.pos));
      const mit = kand.filter(q => Math.abs(q.pos - k.pos) <= 0.5);
      const teile = [fertig, ...mit.filter(q => q.o).map(q => q.o)];
      const ganz = mit.some(q => !q.o); // Folienrand/-mitte/Führungslinie → über die ganze Folie
      if (achse === "x") linien.push({ achse, pos: k.pos, von: ganz ? 0 : Math.min(...teile.map(t => t.y)), bis: ganz ? hoehe : Math.max(...teile.map(t => t.y + t.h)) });
      else linien.push({ achse, pos: k.pos, von: ganz ? 0 : Math.min(...teile.map(t => t.x)), bis: ganz ? breite : Math.max(...teile.map(t => t.x + t.w)) });
    }
  };
  if (bx || smart) sammeln("x", [fertig.x, fertig.x + fertig.w / 2, fertig.x + fertig.w], kandX);
  if (by || smart) sammeln("y", [fertig.y, fertig.y + fertig.h / 2, fertig.y + fertig.h], kandY);
  return { dx, dy, linien: linien.filter(l => !(l.pos === 0 || l.pos === breite) || l.achse === "y").filter(l => !(l.achse === "y" && (l.pos === 0 || l.pos === hoehe))), abstaende };
}

/* Ausrichten: art = links | mitte | rechts | oben | mittig | unten.
   Bei einem Element: an der Folie, bei mehreren: an ihrem gemeinsamen Rahmen. Ändert die Elemente direkt. */
export function ausrichten(liste, art, breite = 960, hoehe = 540) {
  if (!liste.length) return;
  const r = liste.length === 1 ? { x: 0, y: 0, w: breite, h: hoehe } : rahmen(liste);
  for (const e of liste) {
    if (art === "links") e.x = r.x; else if (art === "rechts") e.x = r.x + r.w - e.w; else if (art === "mitte") e.x = r.x + (r.w - e.w) / 2;
    else if (art === "oben") e.y = r.y; else if (art === "unten") e.y = r.y + r.h - e.h; else if (art === "mittig") e.y = r.y + (r.h - e.h) / 2;
    e.x = Math.round(e.x); e.y = Math.round(e.y);
  }
}

/* Gleichmäßig verteilen (ab 3 Elementen): gleiche Abstände zwischen den Elementen */
export function verteilen(liste, achse) {
  if (liste.length < 3) return false;
  const p = achse === "x" ? "x" : "y", g = achse === "x" ? "w" : "h";
  const sort = liste.slice().sort((a, b) => a[p] - b[p]);
  const start = sort[0][p], ende = sort[sort.length - 1][p] + sort[sort.length - 1][g];
  const summe = sort.reduce((s, e) => s + e[g], 0), luecke = (ende - start - summe) / (sort.length - 1);
  let pos = start;
  for (const e of sort) { e[p] = Math.round(pos); pos += e[g] + luecke; }
  return true;
}

// Drehwinkel einrasten (0, 15, 30 … – und genau 0/90/180/270)
export function winkelEinrasten(w, frei = false) {
  w = ((w % 360) + 360) % 360;
  if (frei) return Math.round(w);
  const z = Math.round(w / 15) * 15;
  return Math.abs(z - w) <= 4 ? z % 360 : Math.round(w);
}
