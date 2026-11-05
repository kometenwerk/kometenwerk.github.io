// OMNIVIA Karten – Verkehrsmeldungen der Autobahn GmbH des Bundes und Erklärung der Route.
// Quelle: verkehr.autobahn.de (frei, ohne Anmeldung). Staus auf Landstraßen gibt es dort nicht.

import { abstand, meterText, richtung } from "./netz.js";
import { norm } from "./suche.js";

export const AUTOBAHNEN = ["A5", "A81", "A98", "A860", "A861", "A862", "A864"];
const API = "https://verkehr.autobahn.de/o/autobahn";
const DIENSTE = { warning: "warning", closure: "closure", roadworks: "roadworks" };

function zahl(x) { const n = parseFloat(String(x ?? "").replace(",", ".")); return Number.isFinite(n) ? n : null; }

/** Macht aus den Rohdaten der Autobahn-API eine einfache Liste. bbox = [süd, west, nord, ost] */
/** Fahrtrichtung in Grad aus „A5 | Teningen - Freiburg-Nord“ (der Titel nennt die Stellen in Fahrtrichtung). */
export function fahrtRichtung(titel, lat, lon, anschluss) {
  if (!anschluss) return null;
  const teil = String(titel || "").split("|")[1];
  if (!teil) return null;
  const [a, b] = teil.split(/\s+-\s+/);
  if (!a || !b) return null;
  const naechster = name => {
    const n = norm(name.replace(/\(.*?\)/g, "").replace(/^(AS|AK|AD|Rastanlage|Raststätte|Rasthof|Parkplatz|Tank- und Rastanlage)\s+/i, ""));
    const liste = anschluss[n] || anschluss[n.replace(/ /g, "")] || Object.entries(anschluss).find(([k]) => k.replace(/ /g, "") === n.replace(/ /g, ""))?.[1];
    if (!liste) return null;
    let best = null, bd = 30000;
    for (const p of liste) { const d = abstand(lat, lon, p[0], p[1]); if (d < bd) { bd = d; best = p; } }
    return best;
  };
  const pa = naechster(a), pb = naechster(b);
  if (!pa || !pb || abstand(pa[0], pa[1], pb[0], pb[1]) < 200) return null;
  return richtung(pa[0], pa[1], pb[0], pb[1]);
}

export function meldungenLesen(roh, bbox, anschluss = null) {
  const out = [];
  for (const [dienst, liste] of Object.entries(roh || {})) {
    for (const m of liste || []) {
      const lat = zahl(m.coordinate?.lat), lon = zahl(m.coordinate?.long ?? m.coordinate?.lon);
      if (lat === null || lon === null) continue;
      if (bbox && (lat < bbox[0] || lat > bbox[2] || lon < bbox[1] || lon > bbox[3])) continue;
      const text = [m.title, m.subtitle, ...(Array.isArray(m.description) ? m.description : [m.description])].filter(Boolean).join(" ");
      let minuten = zahl(m.delayTimeValue);
      if (minuten === null) { const t = text.match(/(\d+)\s*Min/i); minuten = t ? +t[1] : null; }
      const gesperrt = String(m.isBlocked) === "true" || dienst === "closure" && !/Fahrstreifen|Auffahrt|Abfahrt|Anschlussstelle|Ausfahrt/i.test(text);
      let art = dienst === "closure" ? "sperrung" : dienst === "roadworks" ? "baustelle" : "warnung";
      if (dienst === "warning" && (/stau|stockend|zähfließend/i.test(text) || m.abnormalTrafficType)) art = "stau";
      const strasse = (String(m.title || "").match(/^\s*(A\s?\d+|B\s?\d+)/) || [])[1]?.replace(" ", "") || "";
      out.push({
        id: m.identifier || `${dienst}-${lat}-${lon}`, art, lat, lon, gesperrt,
        minuten: minuten ?? (art === "stau" ? 10 : art === "baustelle" ? 0.5 : 0),
        titel: String(m.title || "").replace(/\s*\|\s*/g, ": ").trim(), richtung: String(m.subtitle || "").replace("->", "→").trim(),
        text: (Array.isArray(m.description) ? m.description : [m.description]).filter(Boolean).slice(0, 6).join(" ").replace(/\s+/g, " ").trim(),
        strasse, radius: gesperrt ? 250 : 500, grad: fahrtRichtung(m.title, lat, lon, anschluss),
      });
    }
  }
  return out;
}

/** Lädt die Meldungen: erst direkt bei der Autobahn GmbH, sonst die Kopie, die GitHub regelmäßig holt. */
export async function meldungenLaden(bbox, { kopie = "daten/verkehr.json", holen = fetch, anschluss = null } = {}) {
  try {
    const roh = { warning: [], closure: [], roadworks: [] };
    const anfragen = [];
    for (const a of AUTOBAHNEN) for (const d of Object.keys(DIENSTE)) {
      anfragen.push(holen(`${API}/${a}/services/${d}`, { signal: AbortSignal.timeout?.(8000) }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(j => { roh[d].push(...(j[d] || j[Object.keys(j)[0]] || [])); }));
    }
    const erg = await Promise.allSettled(anfragen);
    if (erg.filter(e => e.status === "fulfilled").length < anfragen.length / 2) throw new Error("direkt nicht erreichbar");
    return { meldungen: meldungenLesen(roh, bbox, anschluss), stand: new Date().toISOString(), live: true };
  } catch {
    const r = await holen(kopie, { cache: "no-cache" });
    if (!r.ok) throw new Error("Keine Verkehrsdaten");
    const j = await r.json();
    return { meldungen: meldungenLesen(j.roh, bbox, anschluss), stand: j.stand, live: false };
  }
}

/** Welche Meldungen liegen an der Route? */
export function meldungenAnRoute(route, meldungen, weite = 300) {
  if (!route?.punkte?.length) return [];
  const p = route.punkte;
  return meldungen.filter(m => {
    for (let i = 0; i < p.length; i += 1) {
      if (Math.abs(p[i][0] - m.lat) > 0.01) continue;
      if (abstand(p[i][0], p[i][1], m.lat, m.lon) < weite) return true;
    }
    return false;
  });
}

export function zeitText(sek) {
  const min = Math.max(1, Math.round(sek / 60));
  if (min < 60) return `${min} Min.`;
  const h = Math.floor(min / 60), r = min % 60;
  return r ? `${h} Std. ${r} Min.` : `${h} Std.`;
}

const LISTE = l => l.length <= 1 ? l.join("") : `${l.slice(0, -1).join(", ")} und ${l[l.length - 1]}`;

/** Erklärt die Route in normalem Deutsch – ohne KI, nur aus den Fakten. */
export function routeErklaeren(route, anRoute = [], modus = "auto", vergleich = null) {
  const s = [];
  const wie = { auto: "mit dem Auto", rad: "mit dem Fahrrad", fuss: "zu Fuß" }[modus];
  s.push(`${meterText(route.meter)} ${wie}, etwa ${zeitText(route.sekunden).replace(/\.$/, "")}.`);
  const haupt = (route.strassen || []).slice(0, 3).map(x => x.name);
  if (haupt.length) s.push(`Hauptsächlich über ${LISTE(haupt)}.`);
  else if (modus === "auto") s.push("Nur über kleine Straßen.");
  const st = anRoute.filter(m => m.art === "stau"), bs = anRoute.filter(m => m.art === "baustelle"), sp = anRoute.filter(m => m.art === "sperrung"), wa = anRoute.filter(m => m.art === "warnung");
  if (st.length) s.push(`Achtung: ${st.length === 1 ? "Stau" : st.length + " Staus"} auf der Strecke${st[0].strasse ? " (" + st[0].strasse + ")" : ""} – schon eingerechnet, so gut es geht.`);
  if (sp.length) s.push(`${sp.length === 1 ? "Eine Sperrung liegt" : sp.length + " Sperrungen liegen"} in der Nähe der Strecke.`);
  if (bs.length) s.push(`${bs.length === 1 ? "Eine Baustelle" : bs.length + " Baustellen"} auf dem Weg${bs[0].strasse ? " (" + [...new Set(bs.map(b => b.strasse).filter(Boolean))].join(", ") + ")" : ""}.`);
  if (wa.length) s.push(`${wa.length === 1 ? "Eine Warnung" : wa.length + " Warnungen"} unterwegs – unten aufgelistet.`);
  if (vergleich && vergleich.sekunden - route.sekunden > 120) s.push(`Wir haben dich um die Meldungen herumgeführt: ${zeitText(vergleich.sekunden - route.sekunden)} schneller als der direkte Weg heute.`);
  return s.join(" ");
}
