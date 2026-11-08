// FIDELIA Notizen · Scan → Word-Seite
// Die Texterkennung liefert jede Zeile mit Position und Größe. Daraus baut diese Datei eine Seite,
// die aussieht wie das Original – aber mit echtem, bearbeitbarem Text:
// Überschriften (größere Schrift), Absätze, Aufzählungen, Ausrichtung (links/Mitte/rechts), Abstände
// und ausgeschnittene Bilder/Zeichnungen an der richtigen Stelle.

const escH = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const median = (a) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const MM_PRO_PT = 0.3528;

// Tesseract-Blöcke → einfache Absätze { x0, y0, x1, y1, zeilen: [{ text, x0, y0, x1, y1, h }] }
export function absaetze(bloecke) {
  const out = [];
  for (const b of bloecke || []) for (const p of b.paragraphs || []) {
    const zeilen = (p.lines || []).map(l => ({ text: String(l.text || "").replace(/\s+/g, " ").trim(), x0: l.bbox.x0, y0: l.bbox.y0, x1: l.bbox.x1, y1: l.bbox.y1, h: l.bbox.y1 - l.bbox.y0, konf: l.confidence }))
      .filter(z => z.text && /[\p{L}\p{N}]/u.test(z.text));
    if (!zeilen.length) continue;
    // Zeilen mit großem Abstand dazwischen sind eigene Absätze (sonst geht der Abstand verloren)
    let gruppe = [zeilen[0]];
    const fertig = () => out.push({ x0: Math.min(...gruppe.map(z => z.x0)), y0: Math.min(...gruppe.map(z => z.y0)), x1: Math.max(...gruppe.map(z => z.x1)), y1: Math.max(...gruppe.map(z => z.y1)), zeilen: gruppe });
    for (let i = 1; i < zeilen.length; i++) {
      const vorher = zeilen[i - 1], z = zeilen[i];
      if (z.y0 - vorher.y1 > Math.max(vorher.h, z.h) * 0.9) { fertig(); gruppe = [z]; } else gruppe.push(z);
    }
    fertig();
  }
  return out.sort((a, b) => a.y0 - b.y0);
}

// Baut das HTML. W/H: Bildgröße in Pixel, seiteMm: Breite der Seite (210 hoch, 297 quer), bilder: [{x,y,w,h,src}] in Pixel
export function layoutZuHtml(abs, W, H, seiteMm = 210, bilder = []) {
  const mmProPx = seiteMm / W;
  const hoehen = abs.flatMap(a => a.zeilen.map(z => z.h));
  const normal = median(hoehen) || 20;
  const teile = [];
  for (const a of abs) teile.push({ art: "text", y0: a.y0, y1: a.y1, a });
  for (const b of bilder) teile.push({ art: "bild", y0: b.y, y1: b.y + b.h, b });
  teile.sort((p, q) => p.y0 - q.y0);

  const RAND = 15, GRUND_PT = 11; // so ist eine leere Seite eingestellt (15 mm Rand, 11 pt)
  const ptVon = (hPx) => hPx * mmProPx / MM_PRO_PT * 0.82;
  const em = (hPx) => Math.max(0.6, Math.min(5, ptVon(hPx) / GRUND_PT)).toFixed(2);
  let html = "", liste = null, letzteUnten = null;
  const listeZu = () => { if (liste) { html += "</" + liste + ">"; liste = null; } };
  for (const t of teile) {
    // Abstand zum vorherigen Teil (nur große Lücken übernehmen)
    let abstand = "";
    if (letzteUnten == null) {
      const oben = t.y0 * mmProPx - RAND;
      if (oben > 3) abstand = "margin-top:calc(var(--u)*" + Math.min(120, Math.round(oben)) + ")";
    } else {
      // Lücke im Original minus dem Abstand, den die Zeilenhöhe sowieso schon macht
      const luecke = (t.y0 - letzteUnten) * mmProPx - ptVon(normal) * MM_PRO_PT * 0.5;
      if (luecke > 2.5) abstand = "margin-top:calc(var(--u)*" + Math.min(40, Math.round(luecke)) + ")";
    }
    letzteUnten = Math.max(letzteUnten || 0, t.y1);
    if (t.art === "bild") {
      listeZu();
      const breite = Math.max(10, Math.min(100, Math.round(t.b.w / W * 100)));
      const links = Math.round(t.b.x / W * 100);
      html += '<p style="' + abstand + '"><img class="bild" src="' + escH(t.b.src) + '" alt="" style="width:' + breite + '%;margin-left:' + Math.min(links, 100 - breite) + '%"></p>';
      continue;
    }
    const a = t.a;
    const hz = median(a.zeilen.map(z => z.h)), rel = hz / normal;
    // Ausrichtung: Abstand links/rechts vergleichen
    const lm = a.x0 / W, rm = (W - a.x1) / W, breite = (a.x1 - a.x0) / W;
    let ausr = "";
    if (breite < 0.75 && Math.abs(lm - rm) < 0.07 && lm > 0.12) ausr = "text-align:center";
    else if (rm < 0.12 && lm > 0.35) ausr = "text-align:right";
    const einzug = !ausr && a.x0 * mmProPx - RAND > 3 ? "margin-left:calc(var(--u)*" + Math.round(a.x0 * mmProPx - RAND) + ")" : "";
    const stil = [abstand, ausr, einzug].filter(Boolean).join(";");
    const stilAttr = stil ? ' style="' + stil + '"' : "";
    // Zeilen zusammenfügen: kurze Zeilen (z. B. Gedicht, Adresse) behalten ihren Umbruch
    const pBreite = a.x1 - a.x0;
    const zeilenHtml = (zeilen) => zeilen.map((z, i) => escH(z.text) + (i < zeilen.length - 1 ? ((z.x1 - a.x0) < pBreite * 0.78 ? "<br>" : " ") : "")).join("");
    const erste = a.zeilen[0].text;
    const punkt = erste.match(/^[•·▪◦\-–*]\s+/), nummer = erste.match(/^(\d{1,2})[.)]\s+/);
    if (rel > 1.3 && a.zeilen.length <= 3) {
      listeZu();
      const tag = rel > 1.9 ? "h1" : rel > 1.5 ? "h2" : "h3";
      html += "<" + tag + ' style="' + [stil, "font-size:" + em(hz) + "em"].filter(Boolean).join(";") + '">' + zeilenHtml(a.zeilen) + "</" + tag + ">";
    } else if (punkt || nummer) {
      const art = punkt ? "ul" : "ol";
      if (liste !== art) { listeZu(); html += "<" + art + (abstand ? ' style="' + abstand + '"' : "") + ">"; liste = art; }
      const z = a.zeilen.map((x, i) => i ? x : Object.assign({}, x, { text: x.text.replace(punkt ? /^[•·▪◦\-–*]\s+/ : /^\d{1,2}[.)]\s+/, "") }));
      html += "<li>" + zeilenHtml(z) + "</li>";
    } else {
      listeZu();
      // Schriftgröße wie im Original (gerundet; 11 pt bleibt ohne Angabe)
      // normale Zeilen bekommen alle dieselbe Größe (Zeilen ohne Ober-/Unterlängen messen sonst kleiner)
      const e = rel > 0.72 && rel < 1.3 ? em(normal) : em(hz), groesse = Math.abs(e - 1) > 0.08 ? "font-size:" + e + "em" : "";
      const s2 = [stil, groesse].filter(Boolean).join(";");
      html += "<p" + (s2 ? ' style="' + s2 + '"' : "") + ">" + zeilenHtml(a.zeilen) + "</p>";
    }
  }
  listeZu();
  return html || "<p><br></p>";
}

// Schätzt die normale Schriftgröße in pt (für Info/Tests)
export function grundgroessePt(abs, W, seiteMm = 210) {
  const h = median(abs.flatMap(a => a.zeilen.map(z => z.h)));
  return Math.round(h * seiteMm / W / MM_PRO_PT * 0.85);
}

// Bilder/Zeichnungen finden: dunkle Flächen, die kein Text sind. g: Graustufen (klein), Textkästen in denselben Koordinaten.
export function bildRegionen(g, w, h, textKaesten) {
  const maske = new Uint8Array(w * h);
  for (let i = 0; i < g.length; i++) maske[i] = g[i] < 170 ? 1 : 0;
  // Text wegmaskieren (etwas größer, damit Ober-/Unterlängen mit weg sind)
  for (const k of textKaesten) {
    const p = Math.max(2, Math.round((k.y1 - k.y0) * 0.3));
    for (let y = Math.max(0, k.y0 - p); y < Math.min(h, k.y1 + p); y++) for (let x = Math.max(0, k.x0 - p); x < Math.min(w, k.x1 + p); x++) maske[y * w + x] = 0;
  }
  // Nahe Striche zusammenfassen (Zeichnungen bestehen aus vielen Linien)
  const r = Math.max(2, Math.round(w / 60)), dick = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (maske[y * w + x]) {
    for (let yy = Math.max(0, y - r); yy <= Math.min(h - 1, y + r); yy++) for (let xx = Math.max(0, x - r); xx <= Math.min(w - 1, x + r); xx++) dick[yy * w + xx] = 1;
  }
  const marke = new Int32Array(w * h).fill(-1), out = [];
  const stapel = [];
  for (let s = 0; s < w * h; s++) {
    if (!dick[s] || marke[s] !== -1) continue;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, n = 0, tinte = 0;
    stapel.push(s); marke[s] = s;
    while (stapel.length) {
      const q = stapel.pop(), x = q % w, y = (q / w) | 0;
      n++; if (maske[q]) tinte++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const nb of [q - 1, q + 1, q - w, q + w]) {
        if (nb < 0 || nb >= w * h || marke[nb] !== -1 || !dick[nb]) continue;
        if ((nb === q - 1 && x === 0) || (nb === q + 1 && x === w - 1)) continue;
        marke[nb] = s; stapel.push(nb);
      }
    }
    const bw = x1 - x0, bh = y1 - y0;
    // Klein, dünn oder kaum Tinte → kein Bild (z. B. Linien, Flecken, Ränder)
    if (bw < w * 0.06 || bh < w * 0.04 || tinte < 40) continue;
    if (bw > w * 0.97 && bh < w * 0.02) continue;
    out.push({ x: x0, y: y0, w: bw, h: bh });
  }
  return out;
}

/* ---------- Im Browser: Blob eines Scans → { html, text, konfidenz } ---------- */

function bildLaden(blob) { return createImageBitmap(blob); }

export async function ausScan(blob, { quer = false, fortschritt } = {}) {
  if (!window.KWOCR) await new Promise((ok, nein) => { const s = document.createElement("script"); s.src = "../shared/ocr/kw-ocr.js"; s.onload = ok; s.onerror = nein; document.head.appendChild(s); });
  const r = await window.KWOCR.erkenneBloecke(blob, "deu+eng", fortschritt);
  const abs = absaetze(r.bloecke);
  // Bilder suchen (auf kleinem Graustufenbild), dann aus dem Original ausschneiden
  const bmp = await bildLaden(blob);
  const kw = 500, kh = Math.round(kw * bmp.height / bmp.width), c = document.createElement("canvas");
  c.width = kw; c.height = kh;
  const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(bmp, 0, 0, kw, kh);
  const d = x.getImageData(0, 0, kw, kh).data, g = new Uint8ClampedArray(kw * kh);
  for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
  const f = kw / r.breite;
  const kaesten = abs.flatMap(a => a.zeilen.map(z => ({ x0: Math.round(z.x0 * f), y0: Math.round(z.y0 * f), x1: Math.round(z.x1 * f), y1: Math.round(z.y1 * f) })));
  const regionen = bildRegionen(g, kw, kh, kaesten).slice(0, 8);
  const bilder = regionen.map(rg => {
    const sx = bmp.width / kw, pad = 4;
    const bx = Math.max(0, (rg.x - pad) * sx), by = Math.max(0, (rg.y - pad) * sx), bw = Math.min(bmp.width - bx, (rg.w + 2 * pad) * sx), bh = Math.min(bmp.height - by, (rg.h + 2 * pad) * sx);
    const m = Math.min(1, 1000 / Math.max(bw, bh)), k = document.createElement("canvas");
    k.width = Math.round(bw * m); k.height = Math.round(bh * m);
    k.getContext("2d").drawImage(bmp, bx, by, bw, bh, 0, 0, k.width, k.height);
    const rf = r.breite / bmp.width;
    return { x: bx * rf, y: by * rf, w: bw * rf, h: bh * rf, src: k.toDataURL("image/jpeg", 0.85) };
  });
  return { html: layoutZuHtml(abs, r.breite, r.hoehe, quer ? 297 : 210, bilder), text: r.text.trim(), konfidenz: r.konfidenz, bilder: bilder.length };
}

// Text (z. B. von der KI aus Handschrift) → einfache Seite
export function textZuSeite(text) {
  return String(text || "").split(/\n{2,}/).map(abs => {
    const z = abs.trim(); if (!z) return "";
    if (/^#{1,3}\s/.test(z)) { const n = z.match(/^#+/)[0].length; return "<h" + n + ">" + escH(z.replace(/^#+\s*/, "")) + "</h" + n + ">"; }
    return "<p>" + escH(z).replace(/\n/g, "<br>") + "</p>";
  }).join("") || "<p><br></p>";
}
