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
  // Tempo-Schilder entlang der Strecke (aus OpenStreetMap, 0 = unbekannt)
  const schilder = [];
  let acc = 0;
  for (const t of route.teile || []) { acc += t.meter; schilder.push([acc, t.k.ms ? t.k.ms[t.e] : 0]); }
  return { punkte: p, d, gesamt: d[d.length - 1], schritte: route.schritte, stellen, index: 0, schilder };
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

/** Erlaubtes Tempo an dieser Stelle (km/h) oder 0, wenn unbekannt. */
export function tempoSchild(v, entlang) {
  const l = v.schilder || [];
  // Strecke der Teile und der Linie weichen leicht ab – auf die Gesamtlänge umrechnen
  const faktor = l.length ? l[l.length - 1][0] / Math.max(1, v.gesamt) : 1;
  const m = entlang * faktor;
  let lo = 0, hi = l.length - 1;
  while (lo < hi) { const mi = (lo + hi) >> 1; if (l[mi][0] < m) lo = mi + 1; else hi = mi; }
  return l.length ? l[lo][1] : 0;
}

/** Nächste Abbiegung ab einer Stelle: { nr, schritt, bis } – oder null, wenn nur noch das Ziel kommt. */
export function naechste(v, entlang) {
  for (let i = 1; i < v.schritte.length; i++) if (v.stellen[i] > entlang + 3) return { nr: i, schritt: v.schritte[i], bis: v.stellen[i] - entlang };
  return null;
}

function meterSprechen(m) {
  if (m >= 950) { const km = Math.round(m / 100) / 10; return km === 1 ? "1 Kilometer" : `${String(km).replace(".", ",")} Kilometern`; }
  if (m >= 100) return `${Math.round(m / 50) * 50} Metern`;
  return `${Math.max(10, Math.round(m / 10) * 10)} Metern`;
}

const ORD = ["", "erste", "zweite", "dritte", "vierte", "fünfte", "sechste", "siebte"];
const BEI = { Tankstelle: "bei der Tankstelle", Kirche: "bei der Kirche", Supermarkt: "beim Supermarkt", Apotheke: "bei der Apotheke", Rathaus: "beim Rathaus", Bahnhof: "beim Bahnhof", Schule: "bei der Schule" };
const sprechName = n => String(n || "").replace(/ · /g, ", ").replace(/\bB (\d)/g, "B $1").replace(/\bA (\d)/g, "A $1");

/** Wo genau? „an der Ampel“, „die zweite Straße“, „bei der Tankstelle“ */
function wo(s, bis = 999) {
  if (s.ampel) return "an der Ampel";
  if (s.bei && BEI[s.bei.art]) return BEI[s.bei.art];
  if (s.ordinal && bis >= 150) return `die ${ORD[s.ordinal]} Straße`;   // kurz vorher: nur noch „jetzt links“
  return "";
}

/** Kurzer Text für die Anzeige oben, z. B. „Rechts auf Hauptstraße“. */
export function kurzText(schritt) {
  if (!schritt) return "Ziel";
  if (schritt.typ === "zwischenziel") return `Zwischenziel: ${schritt.name || ""}`;
  if (schritt.typ === "kreisel") return `Kreisverkehr: ${schritt.ausfahrt}. Ausfahrt${schritt.name ? " · " + schritt.name : ""}`;
  if (schritt.typ === "abfahrt") return `Abfahrt${schritt.name && schritt.name !== "die Abfahrt" ? " " + schritt.name.replace(/^die Abfahrt /, "") : ""}${schritt.richtungZiel ? " → " + schritt.richtungZiel : ""}`;
  if (schritt.typ === "auffahrt" && schritt.richtungZiel) return `Auffahrt → ${schritt.richtungZiel}`;
  const w = drehWort(schritt.dreh);
  const ziel = schritt.name || "die Straße";
  if (!w || w === "geradeaus") return `Weiter auf ${ziel}`;
  if (w === "wenden") return "Wenden";
  const ort = wo(schritt);
  return `${ort ? ort[0].toUpperCase() + ort.slice(1) + " " + w : w[0].toUpperCase() + w.slice(1)} · ${ziel}`;
}

/** Gesprochene Ansage, z. B. „In 300 Metern an der Ampel rechts abbiegen auf Hauptstraße. Danach gleich links.“ */
export function ansage(schritt, bis, danach = null) {
  const vorne = bis < 25 ? "Jetzt" : `In ${meterSprechen(bis)}`;
  let t;
  if (!schritt) return bis < 25 ? "Du hast dein Ziel erreicht." : `${vorne} hast du dein Ziel erreicht.`;
  const name = schritt.name ? ` auf ${sprechName(schritt.name)}` : "";
  if (schritt.typ === "zwischenziel") return bis < 25 ? `Du hast dein Zwischenziel erreicht${schritt.name ? ": " + schritt.name : ""}.` : `${vorne} erreichst du dein Zwischenziel.`;
  if (schritt.typ === "kreisel") {
    const aus = `die ${ORD[schritt.ausfahrt] || schritt.ausfahrt + "."} Ausfahrt`;
    t = bis < 25 ? `Im Kreisverkehr ${aus} nehmen${name}.` : `${vorne} in den Kreisverkehr, dann ${aus}${name}.`;
  } else if (schritt.typ === "abfahrt") {
    t = `${vorne} ${sprechName(schritt.name || "die Abfahrt")} nehmen${schritt.richtungZiel ? ", Richtung " + schritt.richtungZiel : ""}.`;
  } else if (schritt.typ === "auffahrt") {
    t = `${vorne} auf ${sprechName(schritt.name || "die Auffahrt").replace(/^die /, "die ")}${schritt.richtungZiel ? ", Richtung " + schritt.richtungZiel : ""}.`;
  } else {
    const w = drehWort(schritt.dreh);
    if (!w || w === "geradeaus") t = `${vorne} geradeaus weiter${name}.`;
    else if (w === "wenden") t = `${vorne} bitte wenden.`;
    else {
      const o = wo(schritt, bis);
      t = o.startsWith("die ") ? `${vorne} ${o} ${w}${name}.` : `${vorne} ${o ? o + " " : ""}${w} abbiegen${name}.`;
    }
  }
  if (danach) {
    const w2 = danach.typ === "kreisel" ? "in den Kreisverkehr" : drehWort(danach.dreh);
    if (w2 && w2 !== "geradeaus") t += ` Danach gleich ${w2}.`;
  }
  return t;
}

/** Symbol für die Anzeige oben */
export function pfeilVon(schritt) {
  if (!schritt) return "🏁";
  if (schritt.typ === "zwischenziel") return "📍";
  if (schritt.typ === "kreisel") return "⟳";
  if (schritt.typ === "abfahrt") return "↗";
  const w = drehWort(schritt.dreh);
  if (w === "wenden") return "↶";
  if (w.startsWith("scharf")) return w.endsWith("links") ? "↙" : "↘";
  if (w.startsWith("leicht")) return w.endsWith("links") ? "↖" : "↗";
  return w.includes("links") ? "↰" : w.includes("rechts") ? "↱" : "↑";
}

/** Steht gleich danach (unter 150 m) noch eine Abbiegung an? */
export function danachVon(v, nr) {
  const a = v.schritte[nr + 1];
  if (!a || a.typ === "zwischenziel") return null;
  if (v.stellen[nr + 1] - v.stellen[nr] > 150) return null;
  return a;
}

/** Bekannte Orte an Abbiegungen eintragen („bei der Tankstelle“). pois: [[name, ort, lat, lon, art], …] */
export function wahrzeichen(schritte, pois) {
  if (!pois?.length) return;
  for (const s of schritte) {
    if (s.typ !== "abbiegen" || s.ampel || !s.punkt) continue;
    const w = drehWort(s.dreh); if (!w || w === "geradeaus") continue;
    let best = null, bd = 35;
    for (const p of pois) {
      if (Math.abs(p[2] - s.punkt[0]) > 0.0005 || Math.abs(p[3] - s.punkt[1]) > 0.0008) continue;
      const d = abstand(p[2], p[3], s.punkt[0], s.punkt[1]);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) s.bei = { art: best[4], name: best[0] };
  }
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
