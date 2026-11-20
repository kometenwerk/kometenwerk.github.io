// FIDELIA Notizen – Noten-Stempel
// Ein Stempel ist ein „Strich“ mit art "noten": { art, z (Zeichen), farbe, b, i (Position), p: [[x, y], [x, y + a]] }
// p[0] = Ankerpunkt (Notenkopf bzw. oberste Notenlinie), Abstand p[0]→p[1] = Linienabstand a (mm).
// So funktionieren Lasso (verschieben, vergrößern), Radierer, Rückgängig und Export ohne Extra-Code.

export const STEMPEL = [
  ["violin", "𝄞", "Violinschlüssel"], ["bass", "𝄢", "Bassschlüssel"],
  ["n1", "𝅝", "Ganze Note"], ["n2", "𝅗𝅥", "Halbe Note"], ["n4", "♩", "Viertelnote"], ["n8", "♪", "Achtelnote"], ["n16", "𝅘𝅥𝅯", "Sechzehntelnote"],
  ["p1", "𝄻", "Ganze Pause"], ["p2", "𝄼", "Halbe Pause"], ["p4", "𝄽", "Viertelpause"], ["p8", "𝄾", "Achtelpause"],
  ["kreuz", "♯", "Kreuz"], ["be", "♭", "Be"], ["aufl", "♮", "Auflösungszeichen"], ["punkt", "•", "Punkt (Note verlängern)"],
  ["takt", "|", "Taktstrich"], ["ende", "‖", "Schlussstrich"],
  ["t44", "4/4", "4/4-Takt"], ["t34", "3/4", "3/4-Takt"], ["t24", "2/4", "2/4-Takt"], ["t68", "6/8", "6/8-Takt"],
];
const AUF_LINIE = /^(n1|n2|n4|n8|n16|kreuz|be|aufl|punkt)$/; // rasten auf Linie/Zwischenraum ein

// Notensysteme eines Papiers (mm, eine Kachel). Gleiche Rechnung wie in papier.js.
export function systeme(raster, quer) {
  const W = quer ? 297 : 210, H = quer ? 210 : 297, x0 = 15, x1 = W - 12, oben = 22, unten = H - 15, out = [];
  if (raster === "noten" || raster === "notengross") {
    const a = raster === "notengross" ? 2.5 : 2, n = raster === "notengross" ? 8 : 12, h = a * 4, l = (unten - oben - n * h) / (n - 1);
    for (let i = 0; i < n; i++) out.push({ o: oben + i * (h + l), a, x0, x1 });
  } else if (raster === "klavier") {
    const a = 2, h = 8, paar = 2 * h + 8, n = Math.floor((unten - oben + 10) / (paar + 10)), l = (unten - oben - n * paar) / Math.max(1, n - 1);
    for (let i = 0; i < n; i++) { const y = oben + i * (paar + l); out.push({ o: y, a, x0, x1 }, { o: y + h + 8, a, x0, x1 }); }
  } else if (raster === "notentab") {
    const nh = 8, th = 12.5, paar = nh + 5 + th, n = 6, l = (unten - oben - n * paar) / (n - 1);
    for (let i = 0; i < n; i++) out.push({ o: oben + i * (paar + l), a: 2, x0, x1 });
  }
  return out;
}
export const hatNotenlinien = (raster) => /^(noten|notengross|klavier|notentab)$/.test(raster || "");

// Tipp-Position → Stempel. kachel = Höhe einer Papier-Kachel (mm); Systeme wiederholen sich je Kachel.
export function stempel(z, x, y, { raster, quer, kachel, farbe }) {
  const sys = systeme(raster, quer), t = kachel ? Math.floor(y / kachel) * kachel : 0;
  let best = null, abst = Infinity;
  for (const s of sys) { const d = Math.abs(y - (t + s.o + 2 * s.a)); if (d < abst) { abst = d; best = s; } }
  const imSystem = best && abst < best.a * 6;
  const a = imSystem ? best.a : 2, o = imSystem ? t + best.o : y - 2 * a;
  const r = (v) => Math.round(v * 100) / 100;
  if (AUF_LINIE.test(z)) {
    const i = Math.max(-6, Math.min(14, Math.round((y - o) / (a / 2))));
    const ny = o + i * a / 2;
    return { st: { art: "noten", z, farbe, b: 1, i, p: [[r(x), r(ny)], [r(x), r(ny + a)]] }, eingerastet: imSystem };
  }
  return { st: { art: "noten", z, farbe, b: 1, p: [[r(x), r(o)], [r(x), r(o + a)]] }, eingerastet: imSystem };
}

// Zeichnen auf ein Canvas (k = Pixel pro mm)
export function zeichne(ctx, st, k) {
  const [p0, p1] = st.p; if (!p0) return;
  const a = (p1 ? Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) : 2) * k || 2 * k;
  const x = p0[0] * k, y = p0[1] * k, z = st.z;
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle = st.farbe || "#1b2333";
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const linie = (x1, y1, x2, y2, w) => { ctx.lineWidth = Math.max(0.6, w * a); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };

  if (/^n/.test(z) || /^(kreuz|be|aufl|punkt)$/.test(z)) {
    const i = st.i == null ? 4 : st.i, o = y - i * a / 2;
    if (/^n/.test(z)) {
      // Hilfslinien über/unter dem System
      const breit = (z === "n1" ? 1.0 : 0.85) * a;
      for (let j = -2; j >= i; j -= 2) linie(x - breit, o + j * a / 2, x + breit, o + j * a / 2, 0.11);
      for (let j = 10; j <= i; j += 2) linie(x - breit, o + j * a / 2, x + breit, o + j * a / 2, 0.11);
      // Notenkopf
      const rx = (z === "n1" ? 0.72 : 0.62) * a, ry = 0.45 * a, voll = !/^(n1|n2)$/.test(z);
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.35);
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      if (voll) ctx.fill(); else { ctx.lineWidth = Math.max(0.6, 0.16 * a); ctx.stroke(); }
      ctx.restore();
      if (z !== "n1") {
        const hoch = i >= 4, sx = hoch ? x + rx * 0.92 : x - rx * 0.92, ende = hoch ? y - 3.4 * a : y + 3.4 * a;
        linie(sx, y + (hoch ? -0.15 : 0.15) * a, sx, ende, 0.12);
        const faehnchen = z === "n8" ? 1 : z === "n16" ? 2 : 0, r = hoch ? 1 : -1;
        for (let f = 0; f < faehnchen; f++) {
          const fy = ende + r * f * 0.8 * a;
          ctx.lineWidth = Math.max(0.6, 0.18 * a); ctx.beginPath(); ctx.moveTo(sx, fy);
          ctx.bezierCurveTo(sx + 0.2 * a, fy + r * 0.9 * a, sx + 1.3 * a, fy + r * 1.2 * a, sx + 0.9 * a, fy + r * 2.3 * a); ctx.stroke();
        }
      }
    } else if (z === "punkt") {
      const dy = st.i != null && st.i % 2 === 0 ? -a / 2 : 0; // auf einer Linie: Punkt in den Zwischenraum darüber
      ctx.beginPath(); ctx.arc(x, y + dy, 0.2 * a, 0, Math.PI * 2); ctx.fill();
    } else if (z === "kreuz") {
      linie(x - 0.25 * a, y - 1.3 * a, x - 0.25 * a, y + 1.4 * a, 0.09); linie(x + 0.25 * a, y - 1.4 * a, x + 0.25 * a, y + 1.3 * a, 0.09);
      linie(x - 0.6 * a, y - 0.25 * a, x + 0.6 * a, y - 0.55 * a, 0.22); linie(x - 0.6 * a, y + 0.55 * a, x + 0.6 * a, y + 0.25 * a, 0.22);
    } else if (z === "be") {
      linie(x - 0.35 * a, y - 2.2 * a, x - 0.35 * a, y + 0.6 * a, 0.1);
      ctx.lineWidth = Math.max(0.6, 0.18 * a); ctx.beginPath(); ctx.moveTo(x - 0.35 * a, y - 0.1 * a);
      ctx.bezierCurveTo(x + 0.3 * a, y - 0.7 * a, x + 0.9 * a, y - 0.2 * a, x - 0.35 * a, y + 0.6 * a); ctx.stroke();
    } else if (z === "aufl") {
      linie(x - 0.3 * a, y - 1.5 * a, x - 0.3 * a, y + 0.6 * a, 0.09); linie(x + 0.3 * a, y - 0.6 * a, x + 0.3 * a, y + 1.5 * a, 0.09);
      linie(x - 0.3 * a, y - 0.15 * a, x + 0.3 * a, y - 0.4 * a, 0.22); linie(x - 0.3 * a, y + 0.55 * a, x + 0.3 * a, y + 0.3 * a, 0.22);
    }
  } else {
    const o = y; // oberste Linie des Systems
    if (z === "violin" || z === "bass") {
      // Zeichen aus der Schrift, auf die richtige Höhe gebracht (Schriften sind unterschiedlich groß)
      const zeichen = z === "violin" ? "𝄞" : "𝄢", oben = z === "violin" ? o - 1.6 * a : o - 0.05 * a, hoehe = z === "violin" ? 7.4 * a : 3.3 * a;
      ctx.font = "100px 'Segoe UI Symbol','Noto Music','Bravura Text','Apple Symbols',serif";
      ctx.textBaseline = "alphabetic";
      const m = ctx.measureText(zeichen), mh = (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) || 100, f = hoehe / mh;
      ctx.translate(x - (m.width * f) / 2, oben + m.actualBoundingBoxAscent * f);
      ctx.scale(f, f); ctx.fillText(zeichen, 0, 0);
    } else if (z === "p1") {
      ctx.fillRect(x - 0.6 * a, o + a, 1.2 * a, 0.5 * a);
    } else if (z === "p2") {
      ctx.fillRect(x - 0.6 * a, o + 1.5 * a, 1.2 * a, 0.5 * a);
    } else if (z === "p4") {
      ctx.lineWidth = Math.max(0.6, 0.2 * a); ctx.beginPath();
      ctx.moveTo(x - 0.3 * a, o + 0.5 * a); ctx.lineTo(x + 0.35 * a, o + 1.3 * a); ctx.lineTo(x - 0.25 * a, o + 2.0 * a);
      ctx.lineTo(x + 0.35 * a, o + 2.7 * a); ctx.quadraticCurveTo(x - 0.6 * a, o + 2.5 * a, x + 0.05 * a, o + 3.5 * a); ctx.stroke();
    } else if (z === "p8") {
      ctx.beginPath(); ctx.arc(x - 0.35 * a, o + 1.55 * a, 0.25 * a, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = Math.max(0.6, 0.13 * a); ctx.beginPath(); ctx.moveTo(x - 0.35 * a, o + 1.7 * a);
      ctx.quadraticCurveTo(x + 0.1 * a, o + 1.8 * a, x + 0.45 * a, o + 1.35 * a); ctx.lineTo(x - 0.1 * a, o + 3.0 * a); ctx.stroke();
    } else if (z === "takt") {
      linie(x, o, x, o + 4 * a, 0.1);
    } else if (z === "ende") {
      linie(x - 0.5 * a, o, x - 0.5 * a, o + 4 * a, 0.1); linie(x + 0.1 * a, o, x + 0.1 * a, o + 4 * a, 0.35);
    } else if (/^t\d\d$/.test(z)) {
      ctx.font = "bold " + (2.4 * a).toFixed(1) + "px Georgia,'Times New Roman',serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(z[1], x, o + 1.05 * a); ctx.fillText(z[2], x, o + 3.05 * a);
    }
  }
  ctx.restore();
}
