// OMNIVIA Karten – Navigation während der Fahrt (reine Rechnungen, ohne Bildschirm)
import { abstand, richtung, meterText, drehWort } from "./netz.js";

/** Bereitet eine Route für die Navigation vor: Strecke entlang der Linie und Lage der Abbiegungen. */
export function vorbereiten(route) {
  const p = route.punkte, d = [0];
  for (let i = 1; i < p.length; i++) d.push(d[i - 1] + abstand(p[i - 1][0], p[i - 1][1], p[i][0], p[i][1]));
  const stellen = [];
  let ab = 0;
  for (const s of route.schritte) {
    let best = ab, bd = Infinity;
    for (let i = ab; i < p.length; i++) {
      const x = abstand(p[i][0], p[i][1], s.punkt[0], s.punkt[1]);
      if (x < bd) { bd = x; best = i; }
      if (bd < 1 && i > ab + 2) break;
    }
    stellen.push(d[best]); ab = best;
  }
  return { punkte: p, d, gesamt: d[d.length - 1], schritte: route.schritte, stellen, index: 0 };
}

/** Wo auf der Route bin ich? { neben (m Abstand zur Linie), entlang (m ab Start), index, grad (Richtung der Route hier) } */
export function fortschritt(v, lat, lon) {
  const p = v.punkte, cos = Math.cos(lat * Math.PI / 180);
  const von = Math.max(1, v.index - 20), bis = Math.min(p.length - 1, v.index + 400);
  const suche = (a, b) => {
    let best = { neben: Infinity, entlang: 0, index: a };
    for (let i = a; i <= b; i++) {
      const ax = p[i - 1][1] * cos, ay = p[i - 1][0], bx = p[i][1] * cos, by = p[i][0], px = lon * cos;
      const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy;
      const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * vx + (lat - ay) * vy) / l2)) : 0;
      const q = [ay + vy * t, (ax + vx * t) / cos];
      const n = abstand(lat, lon, q[0], q[1]);
      if (n < best.neben - 0.01) best = { neben: n, entlang: v.d[i - 1] + (v.d[i] - v.d[i - 1]) * t, index: i };
    }
    return best;
  };
  let b = suche(von, bis);
  if (b.neben > 80) { const g = suche(1, p.length - 1); if (g.neben < b.neben) b = g; }
  v.index = b.index;
  const a = p[Math.max(0, b.index - 1)], c = p[b.index];
  b.grad = richtung(a[0], a[1], c[0], c[1]);
  b.rest = Math.max(0, v.gesamt - b.entlang);
  return b;
}

/** Nächste Abbiegung ab einer Stelle: { nr, schritt, bis } – oder null, wenn nur noch das Ziel kommt. */
export function naechste(v, entlang) {
  for (let i = 1; i < v.schritte.length; i++) if (v.stellen[i] > entlang + 3) return { nr: i, schritt: v.schritte[i], bis: v.stellen[i] - entlang };
  return null;
}

function meterSprechen(m) {
  if (m >= 950) { const km = Math.round(m / 100) / 10; return `${String(km).replace(".", ",")} Kilometern`; }
  if (m >= 100) return `${Math.round(m / 50) * 50} Metern`;
  return `${Math.max(10, Math.round(m / 10) * 10)} Metern`;
}

/** Kurzer Text für die Anzeige oben, z. B. „Rechts auf Hauptstraße“. */
export function kurzText(schritt) {
  if (!schritt) return "Ziel";
  const w = drehWort(schritt.dreh);
  const ziel = schritt.name ? (schritt.name.startsWith("die ") ? schritt.name : schritt.name) : "die Straße";
  if (schritt.name === "die Abfahrt") return "Abfahrt nehmen";
  if (!w || w === "geradeaus") return `Weiter auf ${ziel}`;
  if (w === "wenden") return "Wenden";
  return `${w[0].toUpperCase() + w.slice(1)} auf ${ziel}`;
}

/** Gesprochene Ansage: „In 300 Metern rechts abbiegen auf Hauptstraße.“ */
export function ansage(schritt, bis) {
  const vorne = bis < 25 ? "Jetzt" : `In ${meterSprechen(bis)}`;
  if (!schritt) return bis < 25 ? "Du hast dein Ziel erreicht." : `${vorne} hast du dein Ziel erreicht.`;
  if (schritt.name === "die Abfahrt") return `${vorne} die Abfahrt nehmen.`;
  const w = drehWort(schritt.dreh);
  const name = schritt.name ? ` auf ${schritt.name.replace(/ · /g, ", ")}` : "";
  if (!w || w === "geradeaus") return `${vorne} geradeaus weiter${name}.`;
  if (w === "wenden") return `${vorne} bitte wenden.`;
  return `${vorne} ${w} abbiegen${name}.`;
}

/** Bei welchen Entfernungen wird angesagt? */
export function ansageStufen(modus) {
  return modus === "auto" ? [1000, 300, 40] : [200, 25];
}

/** Ist eine Ansage fällig? stufen = bereits gesagte Stufen für diesen Schritt (Set) */
export function faellig(bis, modus, gesagt, tempo = 0) {
  const stufen = ansageStufen(modus);
  for (const s of stufen) {
    if (gesagt.has(s)) continue;
    // bei hohem Tempo etwas früher ansagen
    const vor = s === 40 ? Math.max(40, tempo * 4) : s;
    if (bis <= vor && (s === stufen[0] ? bis > stufen[1] : true)) { stufen.filter(x => x >= s).forEach(x => gesagt.add(x)); return true; }
  }
  return false;
}

export { meterText };
