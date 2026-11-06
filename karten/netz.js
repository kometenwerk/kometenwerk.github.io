// OMNIVIA Karten – eigenes Straßennetz und eigener Routenplaner (A*-Suche)
// Läuft im Browser und in Node (Tests). Keine fremden Routing-Dienste.
// Daten: © OpenStreetMap-Mitwirkende, ODbL 1.0

export const BIT = { AUTO: 1, RAD: 2, FUSS: 4, WOHN: 8, ENG: 16, LICHT: 32, RADWEG: 64, UNBEF: 128 };
export const BIT2 = { TREPPE: 1, AUTOBAHN: 2, TUNNEL: 4, BRUECKE: 8 };
const MODUS_BIT = { auto: BIT.AUTO, rad: BIT.RAD, fuss: BIT.FUSS };
const VMAX = { auto: 130 / 3.6, rad: 22 / 3.6, fuss: 5.5 / 3.6 };
const NAH_AUTO = 7000;       // so weit um Start und Ziel werden alle Straßen benutzt
const RUND_NAH = 1500;       // so weit um Start/Ziel gibt es keine Wohngebiet-Strafe

export function abstand(la1, lo1, la2, lo2) {
  const x = (lo2 - lo1) * Math.cos(((la1 + la2) / 2) * Math.PI / 180) * 111320;
  const y = (la2 - la1) * 110540;
  return Math.hypot(x, y);
}

export function richtung(la1, lo1, la2, lo2) {
  const x = (lo2 - lo1) * Math.cos(((la1 + la2) / 2) * Math.PI / 180);
  const y = la2 - la1;
  return (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
}

/** Liest eine Netz-Datei (KWN1, KWN2 = mit Tempo-Schildern). */
export function netzLesen(buf) {
  const dv = new DataView(buf);
  const magie = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magie !== "KWN1" && magie !== "KWN2") throw new Error("Keine Netz-Datei");
  const n = dv.getUint32(4, true), m = dv.getUint32(8, true), g = dv.getUint32(12, true), nb = dv.getUint32(16, true);
  let o = 20;
  const feld = (Typ, anzahl) => {
    const a = new Typ(buf, o, anzahl);
    o += anzahl * Typ.BYTES_PER_ELEMENT; o += (4 - (o % 4)) % 4;
    return a;
  };
  const k = {
    n, m,
    ids: feld(Uint32Array, n), lat: feld(Int32Array, n), lon: feld(Int32Array, n), start: feld(Uint32Array, n + 1),
    to: feld(Uint32Array, m), len: feld(Float32Array, m), tla: feld(Int32Array, m), tlo: feld(Int32Array, m),
    gs: feld(Uint32Array, m), gc: feld(Uint16Array, m), nm: feld(Uint16Array, m),
    kl: feld(Uint8Array, m), fl: feld(Uint8Array, m), sp: feld(Uint8Array, m), f2: feld(Uint8Array, m),
    ms: magie === "KWN2" ? feld(Uint8Array, m) : new Uint8Array(m),
    geo: feld(Int32Array, 2 * g),
  };
  k.namen = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, o, nb)));
  const zusammenhaengend = n === 0 || k.ids[n - 1] - k.ids[0] === n - 1;
  if (zusammenhaengend) { const b = n ? k.ids[0] : 0; k.lokal = id => (id >= b && id < b + n ? id - b : -1); }
  else { const map = new Map(); for (let i = 0; i < n; i++) map.set(k.ids[i], i); k.lokal = id => (map.has(id) ? map.get(id) : -1); }
  return k;
}

/** Punkte einer Kante: Startknoten, Zwischenpunkte, Zielknoten – als [lat, lon]. */
export function kantenPunkte(k, lokalVon, e) {
  const p = [[k.lat[lokalVon] / 1e6, k.lon[lokalVon] / 1e6]];
  for (let i = 0; i < k.gc[e]; i++) { const j = 2 * (k.gs[e] + i); p.push([k.geo[j] / 1e6, k.geo[j + 1] / 1e6]); }
  p.push([k.tla[e] / 1e6, k.tlo[e] / 1e6]);
  return p;
}

/** Teilt eine Linie bei Anteil f (0..1). Gibt [vorher, nachher] zurück. */
export function linieTeilen(p, f) {
  const d = [0];
  for (let i = 1; i < p.length; i++) d.push(d[i - 1] + abstand(p[i - 1][0], p[i - 1][1], p[i][0], p[i][1]));
  const ziel = d[d.length - 1] * Math.max(0, Math.min(1, f));
  for (let i = 1; i < p.length; i++) {
    if (d[i] >= ziel) {
      const t = d[i] === d[i - 1] ? 0 : (ziel - d[i - 1]) / (d[i] - d[i - 1]);
      const q = [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t];
      return [[...p.slice(0, i), q], [q, ...p.slice(i)]];
    }
  }
  return [p.slice(), [p[p.length - 1]]];
}

/** Nächster Punkt auf einer Linie: { abstand, anteil, punkt } */
export function naechsterAufLinie(p, la, lo) {
  let best = { abstand: Infinity, anteil: 0, punkt: p[0] };
  const cos = Math.cos(la * Math.PI / 180);
  let gesamt = 0; const d = [0];
  for (let i = 1; i < p.length; i++) { gesamt += abstand(p[i - 1][0], p[i - 1][1], p[i][0], p[i][1]); d.push(gesamt); }
  for (let i = 1; i < p.length; i++) {
    const ax = p[i - 1][1] * cos, ay = p[i - 1][0], bx = p[i][1] * cos, by = p[i][0], px = lo * cos, py = la;
    const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy;
    const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / l2)) : 0;
    const q = [ay + vy * t, (ax + vx * t) / cos];
    const a = abstand(la, lo, q[0], q[1]);
    if (a < best.abstand) best = { abstand: a, anteil: gesamt ? (d[i - 1] + (d[i] - d[i - 1]) * t) / gesamt : 0, punkt: q };
  }
  return best;
}

class Haufen {
  constructor() { this.f = []; this.v = []; }
  get size() { return this.f.length; }
  push(f, v) {
    const F = this.f, V = this.v; let i = F.length; F.push(f); V.push(v);
    while (i > 0) { const p = (i - 1) >> 1; if (F[p] <= f) break; F[i] = F[p]; V[i] = V[p]; i = p; }
    F[i] = f; V[i] = v;
  }
  pop() {
    const F = this.f, V = this.v, top = V[0], tf = F[0];
    const lf = F.pop(), lv = V.pop();
    if (F.length) {
      let i = 0; const n = F.length;
      for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && F[c + 1] < F[c]) c++; if (F[c] >= lf) break; F[i] = F[c]; V[i] = V[c]; i = c; }
      F[i] = lf; V[i] = lv;
    }
    return [tf, top];
  }
}

/** Echte Fahrzeit einer Kante in Sekunden – ohne Vorlieben wie „ruhige Wege“. */
export function fahrzeit(k, e, modus) {
  const fl = k.fl[e], kl = k.kl[e], f2 = k.f2[e], len = k.len[e], ampeln = f2 >> 4;
  if (modus === "auto") {
    let t = len / (Math.max(5, k.sp[e]) / 3.6);
    if (fl & BIT.UNBEF) t *= 1.5;
    if (kl === 8) t *= 1.3;
    if (kl >= 2) t += 4;
    return t + ampeln * 15;
  }
  if (modus === "rad") {
    let t = len / (16 / 3.6);
    if (f2 & BIT2.TREPPE) t *= 6;
    if (fl & BIT.UNBEF) t *= 1.2;
    return t + ampeln * 12;
  }
  let t = len / (4.8 / 3.6) + ampeln * 15;
  if (f2 & BIT2.TREPPE) t *= 1.4;
  return t;
}

/** Kosten einer Kante in Sekunden (Infinity = verboten). */
export function kosten(k, e, modus, opt = {}) {
  const fl = k.fl[e];
  if (!(fl & MODUS_BIT[modus])) return Infinity;
  const kl = k.kl[e], f2 = k.f2[e], len = k.len[e], ampeln = f2 >> 4;
  if (modus === "auto") {
    let t = len / (Math.max(5, k.sp[e]) / 3.6);
    if (fl & BIT.UNBEF) t *= 1.5;
    if (kl === 8) t *= 1.3;
    if (kl >= 2) t += 4; // Kreuzungen und Abbiegen
    t += ampeln * 15;    // im Schnitt etwa 15 s Warten pro Ampel
    if (opt.keineEngen && (fl & (BIT.ENG | BIT.UNBEF))) t *= 4;
    if (opt.keineAutobahn && kl === 0) return Infinity;
    return t;
  }
  if (modus === "rad") {
    let t = len / (16 / 3.6);
    if (f2 & BIT2.TREPPE) t *= 6;
    if (fl & BIT.UNBEF) t *= opt.ruhig ? 1.15 : 1.35;
    if (fl & BIT.RADWEG) t *= 0.85;
    else if (kl <= 2) t *= opt.ruhig ? 3 : 1.8;
    else if (kl === 3) t *= opt.ruhig ? 1.8 : 1.3;
    return t + ampeln * 12;
  }
  let t = len / (4.8 / 3.6) + ampeln * 15;
  if (f2 & BIT2.TREPPE) { if (opt.barrierefrei) return Infinity; t *= 1.4; }
  if (opt.barrierefrei && (fl & BIT.UNBEF)) t *= 3;
  if (opt.hell && !(fl & BIT.LICHT) && (kl >= 9 || kl === 5)) t *= 2.5;
  if (kl <= 2) t *= 1.15;
  return t;
}

export class Netz {
  /** index: Inhalt von index.json; laden(pfad) liefert Promise<ArrayBuffer> (schon entpackt) */
  constructor(index, laden) {
    this.index = index; this.laden = laden;
    this.cache = new Map(); this.wartet = new Map();
    this.fern = null;
    const l = Object.entries(index.kacheln).map(([key, [s, a]]) => [s, a, key]).sort((x, y) => x[0] - y[0]);
    this.starts = Uint32Array.from(l.map(x => x[0])); this.anz = l.map(x => x[1]); this.keys = l.map(x => x[2]);
  }
  kachelVon(lat, lon) { return `${Math.floor(lat / this.index.kachel[0])}_${Math.floor(lon / this.index.kachel[1])}`; }
  keyVonKnoten(id) {
    let lo = 0, hi = this.starts.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (this.starts[m] <= id) lo = m; else hi = m - 1; }
    return id - this.starts[lo] < this.anz[lo] ? this.keys[lo] : null;
  }
  async kachel(key) {
    if (this.cache.has(key)) return this.cache.get(key);
    if (!this.index.kacheln[key]) return null;
    if (!this.wartet.has(key)) this.wartet.set(key, this.laden(`netz/${key}.bin.gz`).then(b => { const k = netzLesen(b); k.key = key; this.cache.set(key, k); this.wartet.delete(key); return k; }));
    return this.wartet.get(key);
  }
  async fernNetz() {
    if (!this.fern) this.fern = this.laden("netz/fern.bin.gz").then(b => { const k = netzLesen(b); k.key = "fern"; return k; });
    return this.fern;
  }

  /** Rastet einen Punkt auf die nächste passende Straße ein. */
  async einrasten(lat, lon, modus) {
    const bit = MODUS_BIT[modus];
    const suche = async keys => {
      let best = null;
      for (const key of keys) {
        const k = await this.kachel(key); if (!k) continue;
        for (let i = 0; i < k.n; i++) {
          if (Math.abs(k.lat[i] / 1e6 - lat) > 0.06 || Math.abs(k.lon[i] / 1e6 - lon) > 0.09) continue;
          for (let e = k.start[i]; e < k.start[i + 1]; e++) {
            if (!(k.fl[e] & bit)) continue;
            if (k.f2[e] & BIT2.AUTOBAHN && modus === "auto") { /* erlaubt, aber nur wenn nichts anderes nah ist */ }
            const p = kantenPunkte(k, i, e);
            const r = naechsterAufLinie(p, lat, lon);
            const strafe = (k.f2[e] & BIT2.AUTOBAHN) ? 40 : k.kl[e] === 8 ? 15 : 0;
            if (!best || r.abstand + strafe < best.wert) best = { wert: r.abstand + strafe, abstand: r.abstand, anteil: r.anteil, punkt: r.punkt, k, i, e, von: k.ids[i], nach: k.to[e], linie: p };
          }
        }
      }
      return best;
    };
    const mitte = this.kachelVon(lat, lon);
    let best = await suche([mitte]);
    if (!best || best.abstand > 300) {
      const [y, x] = mitte.split("_").map(Number); const um = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) um.push(`${y + dy}_${x + dx}`);
      const b2 = await suche(um);
      if (b2 && (!best || b2.wert < best.wert)) best = b2;
    }
    if (!best || best.abstand > 5000) return null;
    // Gegenrichtung derselben Strecke suchen
    const kb = await this.kachel(this.keyVonKnoten(best.nach));
    best.rueck = null;
    if (kb) {
      const j = kb.lokal(best.nach);
      for (let e = kb.start[j]; e < kb.start[j + 1]; e++)
        if (kb.to[e] === best.von && Math.abs(kb.len[e] - best.k.len[best.e]) < 0.5 && kb.gc[e] === best.k.gc[best.e]) { best.rueck = { k: kb, e, i: j }; break; }
    }
    return best;
  }

  /** Strafzeit/Sperre durch Verkehrsmeldungen (nur Autobahn/Bundesstraßen, ungefähr). */
  meldungsKosten(k, e, meldungen, i = -1) {
    if (!meldungen?.length || k.kl[e] > 1) return 0;
    const la = k.tla[e] / 1e6, lo = k.tlo[e] / 1e6;
    let plus = 0, grad = null;
    for (const m of meldungen) {
      if (Math.abs(m.lat - la) > 0.01 || Math.abs(m.lon - lo) > 0.015) continue;
      const d = abstand(la, lo, m.lat, m.lon);
      if (d > (m.radius || 400)) continue;
      if (m.grad != null && i >= 0) {
        if (grad === null) grad = richtung(k.lat[i] / 1e6, k.lon[i] / 1e6, la, lo);
        const diff = Math.abs(((grad - m.grad + 540) % 360) - 180);
        if (diff > 80) continue; // Meldung gilt für die Gegenrichtung
      }
      if (m.gesperrt) return Infinity;
      // Verzögerung nach Länge verteilen: wer die Stelle durchfährt, bekommt sie etwa einmal
      const r = m.radius || 400;
      plus = Math.max(plus, (m.minuten || 0) * 60 * Math.min(1, k.len[e] / (2 * r))); // doppelte Meldungen (beide Richtungen) nur einmal
    }
    return plus;
  }

  /**
   * Berechnet eine Route.
   * von/nach: {lat, lon}; opt: { modus: "auto"|"rad"|"fuss", keineSchleichwege, keineEngen, keineAutobahn, ruhig, hell, barrierefrei, meldungen }
   */
  async route(von, nach, opt = {}) {
    const modus = opt.modus || "auto";
    const [s, z] = await Promise.all([this.einrasten(von.lat, von.lon, modus), this.einrasten(nach.lat, nach.lon, modus)]);
    if (!s) return { fehler: "start" };
    if (!z) return { fehler: "ziel" };
    const fern = modus === "auto" && this.index.kacheln && !opt.ohneFern ? await this.fernNetz() : null;
    const ziel = { lat: z.punkt[0], lon: z.punkt[1] };
    const start = { lat: s.punkt[0], lon: s.punkt[1] };
    const gerade = abstand(start.lat, start.lon, ziel.lat, ziel.lon);
    const vmax = VMAX[modus];
    const h = (la, lo) => abstand(la, lo, ziel.lat, ziel.lon) / vmax;

    const kostenVon = (k, i, e) => {
      const la = k.tla[e] / 1e6, lo = k.tlo[e] / 1e6;
      let c = kosten(k, e, modus, opt);
      if (c === Infinity) return c;
      if (modus === "auto") {
        if (opt.keineSchleichwege && (k.fl[e] & BIT.WOHN)) {
          if (abstand(la, lo, start.lat, start.lon) > RUND_NAH && abstand(la, lo, ziel.lat, ziel.lon) > RUND_NAH) c *= 2.2;
        }
        const m = this.meldungsKosten(k, e, opt.meldungen, i);
        if (m === Infinity) return m;
        c += m;
      }
      if (opt.strafe) { const f = opt.strafe.get(k.ids[i] * 2097152 + k.to[e]); if (f) c *= f; }
      return c;
    };

    const g = new Map(), zurueck = new Map(), fertig = new Set();
    const haufen = new Haufen();
    // Startkanten
    const sK = kostenVon(s.k, s.i, s.e);
    if (sK < Infinity) { const c = sK * (1 - s.anteil); g.set(s.nach, c); zurueck.set(s.nach, { start: true, k: s.k, e: s.e, i: s.i, ab: s.anteil }); haufen.push(c + h(s.k.tla[s.e] / 1e6, s.k.tlo[s.e] / 1e6), s.nach); }
    if (s.rueck) {
      const rK = kostenVon(s.rueck.k, s.rueck.i, s.rueck.e);
      if (rK < Infinity) { const c = rK * s.anteil; if (!(g.get(s.von) <= c)) { g.set(s.von, c); zurueck.set(s.von, { start: true, k: s.rueck.k, e: s.rueck.e, i: s.rueck.i, ab: 1 - s.anteil }); haufen.push(c + h(s.k.lat[s.i] / 1e6, s.k.lon[s.i] / 1e6), s.von); } }
    }
    // Zielkanten: von welchem Knoten aus, wie teuer noch
    const zielRest = new Map();
    const zK = kostenVon(z.k, z.i, z.e);
    if (zK < Infinity) zielRest.set(z.von, { c: zK * z.anteil, k: z.k, e: z.e, i: z.i, bis: z.anteil });
    if (z.rueck) {
      const rK = kostenVon(z.rueck.k, z.rueck.i, z.rueck.e);
      if (rK < Infinity) zielRest.set(z.nach, { c: rK * (1 - z.anteil), k: z.rueck.k, e: z.rueck.e, i: z.rueck.i, bis: 1 - z.anteil });
    }
    if (!zielRest.size) return { fehler: "ziel" };

    let bestWert = Infinity, bestKnoten = null;
    // Start und Ziel auf derselben Kante, in Fahrtrichtung
    if (s.von === z.von && s.nach === z.nach && s.e === z.e && s.k === z.k && z.anteil >= s.anteil && sK < Infinity) {
      bestWert = sK * (z.anteil - s.anteil); bestKnoten = "direkt";
    }
    let schritte = 0, geladen = 0;
    while (haufen.size) {
      const [f, u] = haufen.pop();
      if (f >= bestWert) break;
      if (fertig.has(u)) continue;
      fertig.add(u);
      if (++schritte > 3e6 || geladen > 160) break; // Notbremse: nicht das ganze Land laden
      const gu = g.get(u);
      const zr = zielRest.get(u);
      if (zr && gu + zr.c < bestWert) { bestWert = gu + zr.c; bestKnoten = u; }
      // Nachbarn holen
      let k = null, i = -1;
      if (fern) {
        const fi = fern.lokal(u);
        if (fi >= 0) {
          const la = fern.lat[fi] / 1e6, lo = fern.lon[fi] / 1e6;
          if (abstand(la, lo, start.lat, start.lon) > NAH_AUTO && abstand(la, lo, ziel.lat, ziel.lon) > NAH_AUTO) { k = fern; i = fi; }
        }
      }
      if (!k) {
        const key = this.keyVonKnoten(u);
        k = this.cache.get(key) || (geladen++, await this.kachel(key));
        if (!k) continue;
        i = k.lokal(u);
      }
      for (let e = k.start[i]; e < k.start[i + 1]; e++) {
        const v = k.to[e];
        if (fertig.has(v)) continue;
        const la = k.tla[e] / 1e6, lo = k.tlo[e] / 1e6;
        const c = kostenVon(k, i, e);
        if (c === Infinity) continue;
        const ng = gu + c;
        const alt = g.get(v);
        if (alt === undefined || ng < alt) {
          g.set(v, ng); zurueck.set(v, { von: u, k, e, i });
          haufen.push(ng + h(la, lo), v);
        }
      }
    }
    if (bestKnoten === null) return { fehler: "weg", schritte };
    const r = this.zusammenbauen(s, z, bestKnoten, bestWert, zurueck, zielRest, { schritte, geladen, gerade, modus });
    r.kosten = bestWert;
    const echt = this.restKosten(r, 0, { modus, meldungen: opt.meldungen });
    r.sekunden = Number.isFinite(echt) ? echt : bestWert;   // angezeigt wird die echte Fahrzeit
    return r;
  }

  /**
   * Bis zu „anzahl“ wirklich verschiedene Routen. Trick: Straßen der schon gefundenen Routen
   * werden für die nächste Suche teurer gemacht, dann sucht der Planer einen anderen Weg.
   */
  async alternativen(von, nach, opt = {}, anzahl = 3) {
    const erste = await this.route(von, nach, opt);
    if (erste.fehler) return [erste];
    const routen = [erste], strafe = new Map();
    const merken = r => { for (const t of r.teile) { const a = t.k.ids[t.i], b = t.k.to[t.e]; for (const x of [a * 2097152 + b, b * 2097152 + a]) strafe.set(x, (strafe.get(x) || 1) * 1.8); } };
    merken(erste);
    for (let versuch = 0; versuch < anzahl + 2 && routen.length < anzahl; versuch++) {
      const r = await this.route(von, nach, { ...opt, strafe });
      if (r.fehler) break;
      merken(r);
      if (r.sekunden > erste.sekunden * 1.6 + 180) continue;           // viel zu langsam
      if (routen.some(x => gemeinsam(x, r) > 0.72)) continue;           // fast gleich
      routen.push(r);
    }
    routen.sort((a, b) => a.sekunden - b.sekunden);
    return routen;
  }

  /** Wie lange dauert der Rest einer schon berechneten Route – mit den aktuellen Meldungen? */
  restKosten(route, entlang, opt = {}) {
    let acc = 0, sek = 0;
    for (const t of route.teile) {
      const ende = acc + t.meter;
      if (ende > entlang) {
        const anteil = t.meter ? Math.min(1, (ende - entlang) / t.meter) : 1;
        const c = (t.k.fl[t.e] & MODUS_BIT[opt.modus || "auto"]) ? fahrzeit(t.k, t.e, opt.modus || "auto") : Infinity;
        const m = (opt.modus || "auto") === "auto" ? this.meldungsKosten(t.k, t.e, opt.meldungen, t.i ?? -1) : 0;
        if (c === Infinity || m === Infinity) return Infinity;
        sek += c * anteil + m;
      }
      acc = ende;
    }
    return sek;
  }

  zusammenbauen(s, z, bestKnoten, sekunden, zurueck, zielRest, info) {
    const teile = []; // {punkte, k, e, meter}
    if (bestKnoten === "direkt") {
      const p = linieTeilen(linieTeilen(s.linie, s.anteil)[1], (z.anteil - s.anteil) / Math.max(1e-9, 1 - s.anteil))[0];
      teile.push({ punkte: p, k: s.k, e: s.e, i: s.i, meter: s.k.len[s.e] * (z.anteil - s.anteil) });
    } else {
      const zr = zielRest.get(bestKnoten);
      const zp = kantenPunkte(zr.k, zr.i, zr.e);
      teile.push({ punkte: linieTeilen(zp, zr.bis)[0], k: zr.k, e: zr.e, i: zr.i, meter: zr.k.len[zr.e] * zr.bis });
      let u = bestKnoten;
      for (let n = 0; n < 2e6; n++) {
        const r = zurueck.get(u);
        if (!r) break;
        const p = kantenPunkte(r.k, r.i, r.e);
        if (r.start) { teile.push({ punkte: linieTeilen(p, r.ab)[1], k: r.k, e: r.e, i: r.i, meter: r.k.len[r.e] * (1 - r.ab) }); break; }
        teile.push({ punkte: p, k: r.k, e: r.e, i: r.i, meter: r.k.len[r.e] });
        u = r.von;
      }
      teile.reverse();
    }
    const punkte = [];
    for (const t of teile) for (const p of t.punkte) {
      const l = punkte[punkte.length - 1];
      if (!l || l[0] !== p[0] || l[1] !== p[1]) punkte.push(p);
    }
    const meter = teile.reduce((a, t) => a + t.meter, 0);
    return { punkte, meter, sekunden, teile, schritte: anweisungen(teile, info.modus), strassen: hauptStrassen(teile), info };
  }
}

function name(t) { return t.k.namen[t.k.nm[t.e]] || ""; }

/** Anteil der Strecke von b, der auch in a vorkommt (0..1). */
export function gemeinsam(a, b) {
  const set = new Set();
  for (const t of a.teile) set.add(t.k.ids[t.i] * 2097152 + t.k.to[t.e]);
  let g = 0, alle = 0;
  for (const t of b.teile) { alle += t.meter; if (set.has(t.k.ids[t.i] * 2097152 + t.k.to[t.e])) g += t.meter; }
  return alle ? g / alle : 1;
}

/** Kurze Beschreibung, wodurch sich eine Route von der schnellsten unterscheidet. */
export function unterschied(r, beste, alle) {
  if (r === beste) return "Schnellste";
  const teile = [];
  const kurz = alle.reduce((a, x) => (x.meter < a.meter ? x : a), alle[0]);
  const autobahnB = beste.teile.some(t => t.k.kl[t.e] === 0), autobahnR = r.teile.some(t => t.k.kl[t.e] === 0);
  if (autobahnB && !autobahnR) teile.push("ohne Autobahn");
  if (r === kurz && r.meter < beste.meter - 300) teile.push("kürzeste Strecke");
  const mass = x => { let m = 0, rw = 0, ub = 0, am = 0, li = 0, wohn = 0;
    for (const t of x.teile) { const fl = t.k.fl[t.e]; m += t.meter; if (fl & BIT.RADWEG) rw += t.meter; if (fl & BIT.UNBEF) ub += t.meter; if (fl & BIT.LICHT) li += t.meter; if (fl & BIT.WOHN) wohn += t.meter; am += t.k.f2[t.e] >> 4; }
    return { rw: rw / m, ub: ub / m, li: li / m, wohn: wohn / m, am }; };
  const a = mass(r), b = mass(beste), modus = r.info?.modus;
  if (modus === "rad" && a.rw > b.rw + 0.12) teile.push("mehr Radwege");
  if (modus !== "auto" && a.ub < b.ub - 0.12) teile.push("weniger Schotter");
  if (modus === "fuss" && a.li > b.li + 0.15) teile.push("heller beleuchtet");
  if (modus !== "fuss" && a.am + 2 < b.am) teile.push("weniger Ampeln");
  if (modus === "auto" && a.wohn + 0.1 < b.wohn) teile.push("weniger Wohngebiet");
  const bekannt = new Set(beste.strassen.map(s => s.name));
  const neu = r.strassen.find(s => !bekannt.has(s.name));
  if (neu) teile.push(`über ${neu.name}`);
  return teile.join(" · ") || "anderer Weg";
}

/** Fasst gleiche Straßen zusammen und beschreibt die Abbiegungen. */
export function anweisungen(teile, modus = "auto") {
  const out = [];
  for (const t of teile) {
    if (t.meter < 0.5 && out.length) continue;
    const n = name(t);
    const kl = t.k.kl[t.e];
    const l = out[out.length - 1];
    const gleich = l && ((n && l.name === n) || (!n && !l.name && l.klasse === kl));
    if (gleich) { l.meter += t.meter; l.ende = t.punkte[t.punkte.length - 1]; l.letzteRichtung = endRichtung(t.punkte); continue; }
    let dreh = null;
    if (l) {
      const a = l.letzteRichtung, b = startRichtung(t.punkte);
      if (a !== null && b !== null) dreh = ((b - a + 540) % 360) - 180;
    }
    out.push({ name: n, klasse: kl, meter: t.meter, punkt: t.punkte[0], ende: t.punkte[t.punkte.length - 1], dreh, letzteRichtung: endRichtung(t.punkte) });
  }
  // Kurze namenlose Stücke (< 30 m) in die Nachbarn schieben
  const sauber = out.filter((x, i) => !(i > 0 && i < out.length - 1 && !x.name && x.meter < 30));
  // namenlose Stücke an großen Straßen sind Auf- und Abfahrten
  sauber.forEach((x, i) => {
    if (x.name || x.klasse > 3) return;
    const vor = sauber[i - 1], nach = sauber[i + 1];
    if (nach && nach.klasse <= 1 && nach.name) x.name = `die Auffahrt (${nach.name.split(" · ")[0]})`, x.ohneAuf = true;
    else if (vor && vor.klasse <= 1) x.name = "die Abfahrt", x.ohneAuf = true;
    else x.name = "die Verbindungsstraße", x.ohneAuf = true;
  });
  return sauber.map((x, i) => ({ text: anweisungsText(x, i, modus), name: x.name, meter: x.meter, punkt: x.punkt, dreh: x.dreh, klasse: x.klasse }));
}

function startRichtung(p) {
  for (let i = 1; i < p.length; i++) if (abstand(p[0][0], p[0][1], p[i][0], p[i][1]) > 3) return richtung(p[0][0], p[0][1], p[i][0], p[i][1]);
  return null;
}
function endRichtung(p) {
  const n = p.length - 1;
  for (let i = n - 1; i >= 0; i--) if (abstand(p[i][0], p[i][1], p[n][0], p[n][1]) > 3) return richtung(p[i][0], p[i][1], p[n][0], p[n][1]);
  return null;
}

export function drehWort(d) {
  if (d === null || d === undefined) return "";
  const a = Math.abs(d);
  if (a < 25) return "geradeaus";
  const s = d < 0 ? "links" : "rechts";
  if (a < 60) return `leicht ${s}`;
  if (a < 135) return s;
  if (a < 170) return `scharf ${s}`;
  return "wenden";
}

export function meterText(m) {
  if (m < 950) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(m < 9950 ? 1 : 0).replace(".", ",")} km`;
}

function strassenName(x) {
  if (x.name) return x.name;
  return { 8: "die Zufahrt", 9: "den Feldweg", 10: "den Radweg", 11: "den Fußweg" }[x.klasse] || "die Straße";
}

function anweisungsText(x, i, modus) {
  const was = strassenName(x);
  const auf = x.ohneAuf ? `auf ${x.name}` : x.name ? `auf ${x.name}` : `auf ${was}`;
  const weiter = modus === "fuss" ? "Geh" : modus === "rad" ? "Fahr" : "Fahr";
  if (i === 0) return `${weiter} los ${auf}`;
  if (x.name === "die Abfahrt") return "Nimm die Abfahrt";
  const w = drehWort(x.dreh);
  if (!w || w === "geradeaus") return `Weiter geradeaus ${auf}`;
  if (w === "wenden") return `Wenden und weiter ${auf}`;
  return `${w[0].toUpperCase() + w.slice(1)} abbiegen ${auf}`;
}

/** Die wichtigsten Straßen der Route (für die Erklärung). */
export function hauptStrassen(teile) {
  const summe = new Map();
  for (const t of teile) {
    const n = name(t); if (!n) continue;
    const kl = t.k.kl[t.e]; if (kl > 3) continue;
    const ref = n.split(" · ")[0];
    const e = summe.get(ref) || { name: ref, meter: 0, klasse: kl };
    e.meter += t.meter; e.klasse = Math.min(e.klasse, kl); summe.set(ref, e);
  }
  return [...summe.values()].filter(e => e.meter > 800).sort((a, b) => b.meter - a.meter);
}
