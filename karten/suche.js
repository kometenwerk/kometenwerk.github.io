// OMNIVIA Karten – Suche nach Orten, Straßen, Hausnummern und Zielen.
// Läuft komplett auf dem Gerät: Was du suchst, verlässt dein Handy nicht.

export function norm(s) {
  return String(s).toLowerCase().replace(/ß/g, "ss").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/strasse\b/g, "str").replace(/str\./g, "str")
    .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

export function eimerVon(s) {
  const n = norm(s).replace(/ /g, "");
  return n.length >= 2 ? n.slice(0, 2) : (n + "_").slice(0, 2) || "__";
}

const ORT_ART = ["Stadt", "Stadt", "Dorf", "Stadtteil", "Viertel", "Weiler", "Viertel", "Hof"];

function abstand(a, b, c, d) {
  const x = (d - b) * Math.cos(((a + c) / 2) * Math.PI / 180) * 111320, y = (c - a) * 110540;
  return Math.hypot(x, y);
}

export class Suche {
  /** laden(pfad) -> Promise<JSON>; eimerListe: Liste der vorhandenen Eimer; orte: Inhalt von orte.json */
  constructor(laden, eimerListe, orte) {
    this.laden = laden; this.eimer = new Set(eimerListe); this.cache = new Map();
    this.orte = orte.map(o => ({ name: o[0], art: o[1], lat: o[2], lon: o[3], ew: o[4], n: norm(o[0]) }));
  }
  async holen(key) {
    if (!this.eimer.has(key)) return [];
    if (!this.cache.has(key)) this.cache.set(key, this.laden(`suche/${key}.json.gz`).then(l => l.map(e => ({ e, n: norm(e[0]), o: norm(e[1] || "") }))).catch(() => []));
    return this.cache.get(key);
  }

  async suchen(text, { nahe = null, max = 8 } = {}) {
    const q = norm(text);
    if (q.length < 2) return [];
    let woerter = q.split(" ");
    let nummer = null;
    const ni = woerter.findIndex((w, i) => i > 0 && /^\d+[a-z]?$/.test(w));
    if (ni > 0) {
      nummer = woerter[ni];
      if (woerter[ni + 1] && /^[a-z]$/.test(woerter[ni + 1])) { nummer += woerter[ni + 1]; woerter.splice(ni + 1, 1); }
      woerter.splice(ni, 1);
    }
    // PLZ herausnehmen
    const plz = woerter.find(w => /^\d{5}$/.test(w));
    if (plz) woerter = woerter.filter(w => w !== plz);
    if (!woerter.length) return [];
    const treffer = [];
    const passt = (woerterListe, text) => {
      const tok = text.split(" ");
      return woerterListe.every(w => tok.some(t => t.startsWith(w)) || text.includes(w) && w.length > 3);
    };
    const nah = (lat, lon) => nahe ? abstand(nahe.lat, nahe.lon, lat, lon) : 0;

    // 1) Orte
    for (const o of this.orte) {
      if (!o.n.startsWith(woerter[0]) && !(woerter.length === 1 && o.n.includes(" " + woerter[0]))) continue;
      if (!passt(woerter, o.n)) continue;
      let p = 50 - o.art * 6 + Math.log10(1 + o.ew) * 4;
      if (o.n === woerter.join(" ")) p += 30;
      p -= nah(o.lat, o.lon) / 5000;
      treffer.push({ p, titel: o.name, unter: ORT_ART[o.art] || "Ort", lat: o.lat, lon: o.lon, art: "ort", zoom: o.art <= 1 ? 12 : 14 });
    }

    // 2) Straßen und Ziele – Eimer nach dem ersten Wort, bei „Ort Straße“ auch nach dem zweiten
    const startWoerter = [0];
    if (woerter.length > 1 && this.orte.some(o => o.n === woerter[0] || o.n.startsWith(woerter[0] + " "))) startWoerter.push(1);
    for (const si of startWoerter) {
      const kern = woerter.slice(si), rest = woerter.slice(0, si);
      const liste = await this.holen(eimerVon(kern.join(" ")));
      for (const { e, n, o } of liste) {
        if (!n.startsWith(kern[0])) continue;
        // so viele Wörter wie möglich gehören zum Namen, der Rest zum Ort
        let k = kern.length;
        while (k > 1 && !n.startsWith(kern.slice(0, k).join(" ")) && !passt(kern.slice(0, k), n)) k--;
        if (!passt(kern.slice(0, k), n)) continue;
        const ortW = [...rest, ...kern.slice(k)];
        if (ortW.length && !passt(ortW, o + " " + (e[2] || ""))) continue;
        if (plz && e[2] && e[2] !== plz) continue;
        const ziel = e.length > 6;
        let p = ziel ? 36 : 40;
        if (n === kern.slice(0, k).join(" ")) p += 15;
        if (ortW.length) p += 10;
        p -= n.length / 10;
        p -= nah(e[3], e[4]) / 3000;
        let titel = e[0], lat = e[3], lon = e[4], hinweis = "";
        if (nummer && e[5] && e[5].length) {
          const h = e[5].find(x => norm(x[0]).replace(/ /g, "") === nummer) || e[5].find(x => parseInt(x[0]) === parseInt(nummer));
          if (h) { titel = `${e[0]} ${h[0]}`; lat = h[1]; lon = h[2]; p += norm(h[0]).replace(/ /g, "") === nummer ? 12 : 4; if (norm(h[0]).replace(/ /g, "") !== nummer) hinweis = ` (Nr. ${nummer} nicht gefunden)`; }
          else hinweis = ` (Nr. ${nummer} nicht gefunden)`;
        }
        const unter = ziel ? `${e[6]} · ${e[1]}` : [e[2], e[1]].filter(Boolean).join(" ") + hinweis;
        treffer.push({ p, titel, unter, lat, lon, art: ziel ? "ziel" : "strasse", zoom: nummer ? 18 : 16 });
      }
    }
    treffer.sort((a, b) => b.p - a.p);
    const gesehen = new Set();
    return treffer.filter(t => { const k = t.titel + "|" + t.unter; if (gesehen.has(k)) return false; gesehen.add(k); return true; }).slice(0, max);
  }
}
