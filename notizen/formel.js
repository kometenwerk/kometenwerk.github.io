// FIDELIA Notizen · Rechen-Maschine für Tabellen (wie Excel)
// Versteht deutsche und englische Funktionsnamen (SUMME = SUM), „;“ oder „,“ zwischen Argumenten,
// Zellbezüge (A1, $B$2, A1:C5, Blatt2!A1), Rechenzeichen + − * / ^ & % und Vergleiche.
// Läuft ohne Browser (Tests mit node).

/* ---------- Zellnamen ---------- */

export function spalteName(i) { let s = ""; i++; while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; }
export function spalteNr(n) { let z = 0; for (const c of n.toUpperCase()) z = z * 26 + (c.charCodeAt(0) - 64); return z - 1; }
export const zelleName = (z, s) => spalteName(s) + (z + 1);
export function zelleLesen(name) { const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(name); return m ? { z: Number(m[2]) - 1, s: spalteNr(m[1]) } : null; }

/* ---------- Fehler ---------- */

export class Fehler { constructor(c) { this.code = c; } toString() { return this.code; } }
const F = { div: new Fehler("#DIV/0!"), name: new Fehler("#NAME?"), wert: new Fehler("#WERT!"), bezug: new Fehler("#BEZUG!"), zyklus: new Fehler("#ZYKLUS!"), nv: new Fehler("#NV"), zahl: new Fehler("#ZAHL!") };
export const istFehler = (v) => v instanceof Fehler;

/* ---------- Eingabe lesen (was jemand in eine Zelle tippt) ---------- */

// Gibt { wert, format } zurück. Zahlen mit Komma, Prozent, Euro und deutsches Datum werden erkannt.
export function eingabeLesen(text) {
  const t = String(text == null ? "" : text).trim();
  if (t === "") return { wert: "" };
  if (/^-?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/.test(t)) return { wert: Number(t.replace(/\./g, "").replace(",", ".")) };
  if (/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(t)) return { wert: Number(t) };
  let m = /^(-?[\d.]*\d(?:,\d+)?)\s*%$/.exec(t); if (m) return { wert: Number(m[1].replace(/\./g, "").replace(",", ".")) / 100, format: "proz" };
  m = /^(-?[\d.]*\d(?:,\d+)?)\s*€$|^€\s*(-?[\d.]*\d(?:,\d+)?)$/.exec(t); if (m) return { wert: Number((m[1] || m[2]).replace(/\./g, "").replace(",", ".")), format: "eur" };
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(t);
  if (m) { let j = Number(m[3]); if (j < 100) j += 2000; const d = Date.UTC(j, Number(m[2]) - 1, Number(m[1])); if (!isNaN(d)) return { wert: datumZuZahl(d), format: "datum" }; }
  if (/^(wahr|true)$/i.test(t)) return { wert: true };
  if (/^(falsch|false)$/i.test(t)) return { wert: false };
  return { wert: t };
}
// Excel zählt Tage ab dem 30.12.1899
export const datumZuZahl = (ms) => ms / 864e5 + 25569;
export const zahlZuDatum = (z) => new Date(Math.round((z - 25569) * 864e5));

/* ---------- Anzeige ---------- */

// Format einer Zelle: selbst gewählt oder aus der Eingabe erkannt („12 €“ → Euro)
export function formatVon(c) {
  if (!c) return null;
  if (c.f && c.f.format) return c.f.format;
  return typeof c.v === "string" && c.v[0] !== "=" ? eingabeLesen(c.v).format || null : null;
}

export function anzeigen(wert, format, stellen) {
  if (istFehler(wert)) return wert.code;
  if (wert === true) return "WAHR"; if (wert === false) return "FALSCH";
  if (typeof wert !== "number") return wert == null ? "" : String(wert);
  if (!isFinite(wert)) return "#ZAHL!";
  const zahl = (v, min, max) => v.toLocaleString("de-DE", { minimumFractionDigits: min, maximumFractionDigits: max });
  const st = stellen == null ? null : stellen;
  if (format === "eur") return zahl(wert, st == null ? 2 : st, st == null ? 2 : st) + " €";
  if (format === "proz") return zahl(wert * 100, st == null ? 0 : st, st == null ? 2 : st) + " %";
  if (format === "datum") { const d = zahlZuDatum(wert); return isNaN(d) ? "#WERT!" : d.toLocaleDateString("de-DE", { timeZone: "UTC" }); }
  if (format === "zahl2") return zahl(wert, 2, 2);
  if (st != null) return zahl(wert, st, st);
  // Standard: bis zu 10 Stellen, aber Rechen-Ungenauigkeiten (0,1+0,2) wegrunden
  return zahl(Number(wert.toPrecision(12)), 0, 10);
}

/* ---------- Zerlegen (Tokenizer) ---------- */

function zerlegen(f) {
  const t = []; let i = 0;
  // Komma: mit „;“ in der Formel ist es immer Dezimalzeichen (deutsch). Ohne „;“ trennt es Argumente
  // in Funktionen (englisch) und ist nur außerhalb von Funktionen ein Dezimalzeichen (=1,5*2).
  const semi = /;/.test(f.replace(/"[^"]*"/g, "")), klammern = [];
  while (i < f.length) {
    const c = f[i];
    const inFn = klammern.length && klammern[klammern.length - 1];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"') { let j = i + 1, s = ""; while (j < f.length) { if (f[j] === '"' && f[j + 1] === '"') { s += '"'; j += 2; continue; } if (f[j] === '"') break; s += f[j++]; } t.push({ a: "text", v: s }); i = j + 1; continue; }
    // Zahl (Komma als Dezimalzeichen nur zwischen Ziffern)
    let m = (semi || !inFn ? /^(\d+(?:[.,]\d+)?(?:e[+-]?\d+)?|\.\d+)/i : /^(\d+(?:\.\d+)?(?:e[+-]?\d+)?|\.\d+)/i).exec(f.slice(i));
    if (m && !/^[A-Za-z$]/.test(f.slice(i + m[0].length))) { t.push({ a: "zahl", v: Number(m[0].replace(",", ".")) }); i += m[0].length; continue; }
    // Bezug, Bereich, Blatt!Bezug, Funktionsname, WAHR/FALSCH
    m = /^(?:('(?:[^']|'')+'|[A-Za-zÄÖÜäöüß_][\wÄÖÜäöüß.]*)!)?(\$?[A-Za-z]{1,3}\$?\d+)(?::(\$?[A-Za-z]{1,3}\$?\d+))?(?![\w(])/.exec(f.slice(i));
    if (m) { t.push({ a: "bezug", blatt: m[1] ? m[1].replace(/^'|'$/g, "").replace(/''/g, "'") : null, von: m[2], bis: m[3] || null, roh: m[0] }); i += m[0].length; continue; }
    m = /^[A-Za-zÄÖÜäöüß_][\wÄÖÜäöüß.]*/.exec(f.slice(i));
    if (m) { t.push({ a: "name", v: m[0].toUpperCase() }); i += m[0].length; continue; }
    const zwei = f.slice(i, i + 2);
    if (["<=", ">=", "<>"].includes(zwei)) { t.push({ a: "op", v: zwei }); i += 2; continue; }
    if ("+-*/^&=<>%".includes(c)) { t.push({ a: "op", v: c }); i++; continue; }
    if (c === "(") { klammern.push(!!(t.length && t[t.length - 1].a === "name")); t.push({ a: c }); i++; continue; }
    if (c === ")") { klammern.pop(); t.push({ a: c }); i++; continue; }
    if (c === ";" || c === ",") { t.push({ a: "sep" }); i++; continue; }
    throw F.name;
  }
  return t;
}

/* ---------- Baum bauen (Parser) ---------- */

export function lesen(formel) {
  const t = zerlegen(formel); let p = 0;
  const sieh = () => t[p], nimm = () => t[p++];
  const op = (...v) => sieh() && sieh().a === "op" && v.includes(sieh().v);
  function vergleich() { let l = verkettung(); while (op("=", "<>", "<", ">", "<=", ">=")) { const o = nimm().v; l = { a: "bin", o, l, r: verkettung() }; } return l; }
  function verkettung() { let l = summe(); while (op("&")) { nimm(); l = { a: "bin", o: "&", l, r: summe() }; } return l; }
  function summe() { let l = produkt(); while (op("+", "-")) { const o = nimm().v; l = { a: "bin", o, l, r: produkt() }; } return l; }
  function produkt() { let l = potenz(); while (op("*", "/")) { const o = nimm().v; l = { a: "bin", o, l, r: potenz() }; } return l; }
  function potenz() { let l = vorzeichen(); while (op("^")) { nimm(); l = { a: "bin", o: "^", l, r: vorzeichen() }; } return l; }
  function vorzeichen() { if (op("-")) { nimm(); return { a: "neg", x: vorzeichen() }; } if (op("+")) { nimm(); return vorzeichen(); } return prozent(); }
  function prozent() { let x = einfach(); while (op("%")) { nimm(); x = { a: "bin", o: "/", l: x, r: { a: "zahl", v: 100 } }; } return x; }
  function einfach() {
    const k = nimm();
    if (!k) throw F.wert;
    if (k.a === "zahl" || k.a === "text") return k;
    if (k.a === "bezug") return k;
    if (k.a === "(") { const x = vergleich(); if (!sieh() || nimm().a !== ")") throw F.wert; return x; }
    if (k.a === "name") {
      if (sieh() && sieh().a === "(") {
        nimm(); const args = [];
        if (sieh() && sieh().a === ")") { nimm(); return { a: "fn", n: k.v, args }; }
        for (;;) {
          if (sieh() && (sieh().a === "sep" || sieh().a === ")")) args.push({ a: "leer" }); else args.push(vergleich());
          const e = nimm(); if (!e) throw F.wert;
          if (e.a === ")") break; if (e.a !== "sep") throw F.wert;
        }
        return { a: "fn", n: k.v, args };
      }
      if (k.v === "WAHR" || k.v === "TRUE") return { a: "bool", v: true };
      if (k.v === "FALSCH" || k.v === "FALSE") return { a: "bool", v: false };
      throw F.name;
    }
    throw F.wert;
  }
  const baum = vergleich();
  if (p < t.length) throw F.wert;
  return baum;
}

/* ---------- Hilfen ---------- */

const flach = (args) => { const out = []; for (const a of args) Array.isArray(a) ? a.forEach(z => Array.isArray(z) ? out.push(...z) : out.push(z)) : out.push(a); return out; };
const istBereich = (v) => Array.isArray(v);
function zahl(v) {
  if (istFehler(v)) throw v;
  if (typeof v === "number") return v;
  if (v === true) return 1; if (v === false || v === "" || v == null) return 0;
  const e = eingabeLesen(v); if (typeof e.wert === "number") return e.wert;
  throw F.wert;
}
const text = (v) => { if (istFehler(v)) throw v; if (v === true) return "WAHR"; if (v === false) return "FALSCH"; if (typeof v === "number") return anzeigen(v); return v == null ? "" : String(v); };
const wahr = (v) => { if (istFehler(v)) throw v; if (typeof v === "string") { if (/^(wahr|true)$/i.test(v)) return true; if (/^(falsch|false)$/i.test(v) || v === "") return false; throw F.wert; } return !!v; };
// Nur echte Zahlen aus Bereichen (wie Excel: Text in Bereichen zählt nicht mit)
function zahlen(args, roh) {
  const out = [];
  args.forEach((a, i) => {
    if (istBereich(a)) flach([a]).forEach(v => { if (istFehler(v)) throw v; if (typeof v === "number") out.push(v); });
    else out.push(zahl(roh ? roh[i] : a));
  });
  return out;
}
// Bedingung wie ">5", "<>0", "Apfel" für ZÄHLENWENN/SUMMEWENN
function bedingung(k) {
  if (typeof k === "number") return (v) => v === k || (typeof v === "string" && eingabeLesen(v).wert === k);
  const m = /^(<=|>=|<>|<|>|=)?(.*)$/.exec(String(k)); const o = m[1] || "=", r = m[2];
  const rz = eingabeLesen(r).wert, istZ = typeof rz === "number";
  const muster = !istZ && /[*?]/.test(r) ? new RegExp("^" + r.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$", "i") : null;
  return (v) => {
    if (istZ) { if (typeof v !== "number") return o === "<>"; return { "=": v === rz, "<>": v !== rz, "<": v < rz, ">": v > rz, "<=": v <= rz, ">=": v >= rz }[o]; }
    const s = String(v == null ? "" : v).toLowerCase(), z = r.toLowerCase();
    if (muster) return o === "<>" ? !muster.test(s) : muster.test(s);
    return { "=": s === z, "<>": s !== z, "<": s < z, ">": s > z, "<=": s <= z, ">=": s >= z }[o];
  };
}
const runden = (v, n) => { const f = Math.pow(10, n); return Math.round((v + Math.sign(v) * 1e-12) * f) / f; };

/* ---------- Funktionen (deutsch + englisch) ---------- */

const FN = {};
const def = (namen, f) => namen.split(" ").forEach(n => FN[n] = f);
def("SUMME SUM", (a) => zahlen(a).reduce((s, v) => s + v, 0));
def("MITTELWERT AVERAGE", (a) => { const z = zahlen(a); if (!z.length) throw F.div; return z.reduce((s, v) => s + v, 0) / z.length; });
def("MIN", (a) => { const z = zahlen(a); return z.length ? Math.min(...z) : 0; });
def("MAX", (a) => { const z = zahlen(a); return z.length ? Math.max(...z) : 0; });
def("ANZAHL COUNT", (a) => flach(a).filter(v => typeof v === "number").length);
def("ANZAHL2 COUNTA", (a) => flach(a).filter(v => v !== "" && v != null).length);
def("ANZAHLLEEREZELLEN COUNTBLANK", (a) => flach(a).filter(v => v === "" || v == null).length);
def("MEDIAN", (a) => { const z = zahlen(a).sort((x, y) => x - y); if (!z.length) throw F.zahl; const m = z.length >> 1; return z.length % 2 ? z[m] : (z[m - 1] + z[m]) / 2; });
def("STABW STDEV STABW.S STDEV.S", (a) => { const z = zahlen(a); if (z.length < 2) throw F.div; const m = z.reduce((s, v) => s + v, 0) / z.length; return Math.sqrt(z.reduce((s, v) => s + (v - m) ** 2, 0) / (z.length - 1)); });
def("PRODUKT PRODUCT", (a) => zahlen(a).reduce((s, v) => s * v, 1));
def("RUNDEN ROUND", ([v, n]) => runden(zahl(v), zahl(n || 0)));
def("AUFRUNDEN ROUNDUP", ([v, n]) => { const f = 10 ** zahl(n || 0), x = zahl(v); return Math.sign(x) * Math.ceil(Math.abs(x) * f - 1e-9) / f; });
def("ABRUNDEN ROUNDDOWN", ([v, n]) => { const f = 10 ** zahl(n || 0), x = zahl(v); return Math.sign(x) * Math.floor(Math.abs(x) * f + 1e-9) / f; });
def("GANZZAHL INT", ([v]) => Math.floor(zahl(v)));
def("ABS", ([v]) => Math.abs(zahl(v)));
def("WURZEL SQRT", ([v]) => { const x = zahl(v); if (x < 0) throw F.zahl; return Math.sqrt(x); });
def("POTENZ POWER", ([a, b]) => zahl(a) ** zahl(b));
def("REST MOD", ([a, b]) => { const y = zahl(b); if (!y) throw F.div; const x = zahl(a); return x - y * Math.floor(x / y); });
def("PI", () => Math.PI);
def("EXP", ([v]) => Math.exp(zahl(v)));
def("LN", ([v]) => { const x = zahl(v); if (x <= 0) throw F.zahl; return Math.log(x); });
def("LOG10", ([v]) => Math.log10(zahl(v)));
def("LOG", ([v, b]) => Math.log(zahl(v)) / Math.log(b == null || b === "" ? 10 : zahl(b)));
def("SIN", ([v]) => Math.sin(zahl(v))); def("COS", ([v]) => Math.cos(zahl(v))); def("TAN", ([v]) => Math.tan(zahl(v)));
def("WENN IF", ([b, ja, nein]) => wahr(b) ? (ja === undefined ? true : ja) : (nein === undefined ? false : nein));
def("WENNFEHLER IFERROR", ([v, alt]) => istFehler(v) ? alt : v);
def("UND AND", (a) => flach(a).every(wahr));
def("ODER OR", (a) => flach(a).some(wahr));
def("NICHT NOT", ([v]) => !wahr(v));
def("ZÄHLENWENN ZAEHLENWENN COUNTIF", ([b, k]) => flach([b]).filter(bedingung(k)).length);
def("SUMMEWENN SUMIF", ([b, k, s]) => { const t = bedingung(k), bb = flach([b]), ss = s ? flach([s]) : bb; return bb.reduce((sum, v, i) => sum + (t(v) && typeof ss[i] === "number" ? ss[i] : 0), 0); });
def("MITTELWERTWENN AVERAGEIF", ([b, k, s]) => { const t = bedingung(k), bb = flach([b]), ss = s ? flach([s]) : bb; const z = bb.map((v, i) => t(v) && typeof ss[i] === "number" ? ss[i] : null).filter(v => v !== null); if (!z.length) throw F.div; return z.reduce((x, y) => x + y, 0) / z.length; });
def("VERKETTEN CONCATENATE CONCAT TEXTKETTE", (a) => flach(a).map(text).join(""));
def("LÄNGE LAENGE LEN", ([v]) => text(v).length);
def("GROSS UPPER", ([v]) => text(v).toLocaleUpperCase("de-DE"));
def("KLEIN LOWER", ([v]) => text(v).toLocaleLowerCase("de-DE"));
def("GLÄTTEN GLAETTEN TRIM", ([v]) => text(v).trim().replace(/\s+/g, " "));
def("LINKS LEFT", ([v, n]) => text(v).slice(0, n == null ? 1 : zahl(n)));
def("RECHTS RIGHT", ([v, n]) => { const s = text(v), k = n == null ? 1 : zahl(n); return k ? s.slice(-k) : ""; });
def("TEIL MID", ([v, s, n]) => text(v).substr(zahl(s) - 1, zahl(n)));
def("HEUTE TODAY", () => { const d = new Date(); return datumZuZahl(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); });
def("JETZT NOW", () => { const d = new Date(); return datumZuZahl(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds())); });
def("DATUM DATE", ([j, m, t]) => datumZuZahl(Date.UTC(zahl(j), zahl(m) - 1, zahl(t))));
def("JAHR YEAR", ([v]) => zahlZuDatum(zahl(v)).getUTCFullYear());
def("MONAT MONTH", ([v]) => zahlZuDatum(zahl(v)).getUTCMonth() + 1);
def("TAG DAY", ([v]) => zahlZuDatum(zahl(v)).getUTCDate());
def("SVERWEIS VLOOKUP", ([such, ber, sp, ungenau]) => {
  if (!istBereich(ber)) throw F.wert;
  const n = zahl(sp) - 1; if (n < 0 || n >= (ber[0] || []).length) throw F.bezug;
  const genau = ungenau !== undefined && ungenau !== "" && !wahr(ungenau);
  if (genau) { const z = ber.find(r => String(r[0]).toLowerCase() === String(such).toLowerCase() || r[0] === such); if (!z) throw F.nv; return z[n]; }
  let treffer = null; for (const r of ber) { if (typeof such === "number" ? r[0] <= such : String(r[0]).toLowerCase() <= String(such).toLowerCase()) treffer = r; else break; }
  if (!treffer) throw F.nv; return treffer[n];
});
def("INDEX", ([ber, z, s]) => { if (!istBereich(ber)) return ber; const r = ber[zahl(z) - 1]; if (!r) throw F.bezug; const v = r[s == null ? 0 : zahl(s) - 1]; if (v === undefined) throw F.bezug; return v; });
def("ISTZAHL ISNUMBER", ([v]) => typeof v === "number");
def("ISTLEER ISBLANK", ([v]) => v === "" || v == null);
def("ISTFEHLER ISERROR", ([v]) => istFehler(v));
def("RANG RANK", ([v, ber, auf]) => { const z = zahlen([ber]), x = zahl(v); return (auf && zahl(auf) ? z.filter(y => y < x) : z.filter(y => y > x)).length + 1; });
// Funktionen, die Fehler als Wert bekommen dürfen
const FEHLER_ERLAUBT = new Set(["WENNFEHLER", "IFERROR", "ISTFEHLER", "ISERROR"]);
// Funktionen, bei denen WENN nur den gewählten Zweig rechnen soll
const FAUL = new Set(["WENN", "IF"]);

export const FUNKTIONEN = Object.keys(FN).filter(n => /[ÄÖÜ]|^[A-Z0-9.]+$/.test(n));

/* ---------- Rechnen ---------- */

// zelle(blatt, z, s) liefert den Wert einer Zelle (schon ausgerechnet)
export function rechnen(baum, zelle, blatt) {
  const r = (k) => rechnen(k, zelle, blatt);
  switch (baum.a) {
    case "zahl": case "text": case "bool": return baum.v;
    case "leer": return "";
    case "neg": { const v = r(baum.x); if (istFehler(v)) return v; try { return -zahl(v); } catch (e) { return e; } }
    case "bezug": {
      const a = zelleLesen(baum.von), b = baum.bis ? zelleLesen(baum.bis) : null, bl = baum.blatt || blatt;
      if (!a || (baum.bis && !b)) return F.bezug;
      if (!b) return zelle(bl, a.z, a.s);
      const out = [];
      for (let z = Math.min(a.z, b.z); z <= Math.max(a.z, b.z); z++) { const reihe = []; for (let s = Math.min(a.s, b.s); s <= Math.max(a.s, b.s); s++) reihe.push(zelle(bl, z, s)); out.push(reihe); }
      return out;
    }
    case "bin": {
      let l = r(baum.l), rr = r(baum.r);
      if (istBereich(l)) l = l[0] ? l[0][0] : ""; if (istBereich(rr)) rr = rr[0] ? rr[0][0] : "";
      if (istFehler(l)) return l; if (istFehler(rr)) return rr;
      try {
        switch (baum.o) {
          case "+": return zahl(l) + zahl(rr);
          case "-": return zahl(l) - zahl(rr);
          case "*": return zahl(l) * zahl(rr);
          case "/": { const d = zahl(rr); if (d === 0) return F.div; return zahl(l) / d; }
          case "^": return zahl(l) ** zahl(rr);
          case "&": return text(l) + text(rr);
          default: {
            let x = l, y = rr;
            if (typeof x === "string" && typeof y === "string") { x = x.toLowerCase(); y = y.toLowerCase(); }
            else if (typeof x === "number" || typeof y === "number") { if (x === "") x = 0; if (y === "") y = 0; if (typeof x !== typeof y) return baum.o === "<>"; }
            return { "=": x === y, "<>": x !== y, "<": x < y, ">": x > y, "<=": x <= y, ">=": x >= y }[baum.o];
          }
        }
      } catch (e) { return istFehler(e) ? e : F.wert; }
    }
    case "fn": {
      const f = FN[baum.n]; if (!f) return F.name;
      try {
        if (FAUL.has(baum.n)) {
          const b = r(baum.args[0]); if (istFehler(b)) return b;
          const nimm = wahr(istBereich(b) ? b[0][0] : b) ? 1 : 2;
          if (!baum.args[nimm]) return nimm === 1;
          const v = r(baum.args[nimm]); return istBereich(v) ? v[0][0] : v;
        }
        const args = baum.args.map(r);
        if (!FEHLER_ERLAUBT.has(baum.n)) for (const a of args) if (istFehler(a)) return a;
        const v = f(args);
        return v === undefined ? "" : v;
      } catch (e) { return istFehler(e) ? e : F.wert; }
    }
  }
  return F.wert;
}

/* ---------- Ganze Arbeitsmappe ausrechnen ---------- */

// mappe: { blaetter: [{ name, zellen: { A1: { v: "=…" } } }] }
// Ergebnis: Map "Blatt!A1" → Wert
export function alleRechnen(mappe) {
  const werte = new Map(), laeuft = new Set(), baeume = new Map();
  const blattVon = (name) => mappe.blaetter.find(b => b.name.toLowerCase() === String(name).toLowerCase());
  function zelle(blattName, z, s) {
    const b = blattVon(blattName); if (!b) return F.bezug;
    const name = zelleName(z, s), key = b.name + "!" + name;
    if (werte.has(key)) return werte.get(key);
    const c = b.zellen[name]; if (!c || c.v === "" || c.v == null) return "";
    let w;
    if (typeof c.v === "string" && c.v[0] === "=" && c.v.length > 1) {
      if (laeuft.has(key)) return F.zyklus;
      laeuft.add(key);
      try { let baum = baeume.get(c.v); if (!baum) { baum = lesen(c.v.slice(1)); baeume.set(c.v, baum); } w = rechnen(baum, zelle, b.name); }
      catch (e) { w = istFehler(e) ? e : F.wert; }
      laeuft.delete(key);
      if (istBereich(w)) w = w[0] && w[0][0] !== undefined ? w[0][0] : "";
    } else w = typeof c.v === "string" ? eingabeLesen(c.v).wert : c.v;
    werte.set(key, w);
    return w;
  }
  for (const b of mappe.blaetter) for (const name of Object.keys(b.zellen)) { const p = zelleLesen(name); if (p) zelle(b.name, p.z, p.s); }
  return { wert: (blatt, name) => { const p = zelleLesen(name); return p ? zelle(blatt, p.z, p.s) : ""; }, werte };
}

/* ---------- Formeln verschieben (beim Kopieren/Ausfüllen) ---------- */

export function verschieben(formel, dz, ds) {
  if (typeof formel !== "string" || formel[0] !== "=") return formel;
  // Text in Anführungszeichen nicht anfassen
  return formel.replace(/("(?:[^"]|"")*")|(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![\w(!])/g, (m, str, d1, sp, d2, z, pos, ganz) => {
    if (str) return str;
    const vor = ganz[pos - 1];
    if (vor && /[\wÄÖÜäöüß]/.test(vor)) return m; // Teil eines Namens
    const s = d1 ? spalteNr(sp) : spalteNr(sp) + ds, zz = d2 ? Number(z) - 1 : Number(z) - 1 + dz;
    if (s < 0 || zz < 0) return "#BEZUG!";
    return d1 + spalteName(s) + d2 + (zz + 1);
  });
}

/* ---------- Ausfüllen: Reihen fortsetzen ---------- */

const TAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const TAGE_K = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const LISTEN = [TAGE, TAGE_K, MONATE, MONATE.map(m => m.slice(0, 3))];

// quelle: Liste von Zell-Eingaben (Text), n: wie viele neue; schritt: Abstand der Zellen (für Formeln)
export function fortsetzen(quelle, n, versatz) {
  const out = [];
  const zahlen = quelle.map(q => { const e = eingabeLesen(q); return typeof e.wert === "number" && !(typeof q === "string" && q[0] === "=") ? e : null; });
  if (quelle.length && zahlen.every(Boolean)) {
    const w = zahlen.map(z => z.wert), d = w.length > 1 ? w[w.length - 1] - w[w.length - 2] : (zahlen[0].format === "datum" ? 1 : 0);
    const schritt = w.length > 1 ? d : (zahlen[0].format === "datum" ? 1 : 1);
    for (let i = 1; i <= n; i++) {
      const v = Number((w[w.length - 1] + schritt * i).toPrecision(12));
      out.push(zahlen[0].format === "datum" ? anzeigen(v, "datum") : zahlen[0].format === "proz" ? anzeigen(v, "proz").replace(/\s/g, "") : zahlen[0].format === "eur" ? anzeigen(v, "eur") : String(v).replace(".", ","));
    }
    // Nur eine Zahl ohne Reihe → Excel kopiert sie; wir zählen hoch (wie Strg-Ziehen) nur bei Daten
    if (w.length === 1 && zahlen[0].format !== "datum") return Array.from({ length: n }, () => quelle[0]);
    return out;
  }
  for (const liste of LISTEN) {
    const idx = quelle.map(q => liste.findIndex(x => x.toLowerCase() === String(q).trim().toLowerCase()));
    if (quelle.length && idx.every(i => i >= 0)) {
      const d = idx.length > 1 ? (idx[idx.length - 1] - idx[idx.length - 2] + liste.length) % liste.length || 1 : 1;
      for (let i = 1; i <= n; i++) out.push(liste[(idx[idx.length - 1] + d * i) % liste.length]);
      return out;
    }
  }
  // „Aufgabe 1“ → „Aufgabe 2“
  const m = quelle.length === 1 && /^(.*?)(\d+)$/.exec(String(quelle[0]));
  if (m && m[1] && quelle[0][0] !== "=") { for (let i = 1; i <= n; i++) out.push(m[1] + (Number(m[2]) + i)); return out; }
  // Sonst wiederholen (Formeln dabei verschieben)
  for (let i = 0; i < n; i++) {
    const k = i % quelle.length, runde = Math.floor(i / quelle.length) + 1;
    out.push(verschieben(quelle[k], versatz ? versatz[0] * quelle.length * runde : 0, versatz ? versatz[1] * quelle.length * runde : 0));
  }
  return out;
}

/* ---------- Übersetzen für Excel-Dateien ---------- */

const PAARE = [["SUMME","SUM"],["MITTELWERT","AVERAGE"],["ANZAHL","COUNT"],["ANZAHL2","COUNTA"],["ANZAHLLEEREZELLEN","COUNTBLANK"],["STABW","STDEV"],["PRODUKT","PRODUCT"],
  ["RUNDEN","ROUND"],["AUFRUNDEN","ROUNDUP"],["ABRUNDEN","ROUNDDOWN"],["GANZZAHL","INT"],["WURZEL","SQRT"],["POTENZ","POWER"],["REST","MOD"],["WENN","IF"],["WENNFEHLER","IFERROR"],
  ["UND","AND"],["ODER","OR"],["NICHT","NOT"],["ZÄHLENWENN","COUNTIF"],["SUMMEWENN","SUMIF"],["MITTELWERTWENN","AVERAGEIF"],["VERKETTEN","CONCATENATE"],["LÄNGE","LEN"],
  ["GROSS","UPPER"],["KLEIN","LOWER"],["GLÄTTEN","TRIM"],["LINKS","LEFT"],["RECHTS","RIGHT"],["TEIL","MID"],["HEUTE","TODAY"],["JETZT","NOW"],["DATUM","DATE"],["JAHR","YEAR"],
  ["MONAT","MONTH"],["TAG","DAY"],["SVERWEIS","VLOOKUP"],["ISTZAHL","ISNUMBER"],["ISTLEER","ISBLANK"],["ISTFEHLER","ISERROR"],["RANG","RANK"]];
const ZU_EN = { ZAEHLENWENN: "COUNTIF", LAENGE: "LEN", GLAETTEN: "TRIM", TEXTKETTE: "CONCATENATE", CONCAT: "CONCATENATE", "STABW.S": "STDEV", "STDEV.S": "STDEV" };
const ZU_DE = { "_XLFN.STDEV.S": "STABW", "STDEV.S": "STABW", "_XLFN.CONCAT": "VERKETTEN", CONCAT: "VERKETTEN" };
for (const [de, en] of PAARE) { ZU_EN[de] = en; ZU_DE[en] = de; }

// Formel so umschreiben, wie Excel sie in der Datei erwartet (englisch, Komma, Punkt)
export function nachExcel(formel) {
  const t = zerlegen(formel.replace(/^=/, ""));
  return t.map(k => k.a === "zahl" ? String(k.v) : k.a === "text" ? '"' + k.v.replace(/"/g, '""') + '"' : k.a === "bezug" ? k.roh : k.a === "name" ? (ZU_EN[k.v] || k.v) : k.a === "sep" ? "," : k.a === "op" ? k.v : k.a).join("")
    .replace(/\b(TRUE|FALSE)\b/g, m => m);
}
// …und zurück (aus einer .xlsx-Datei)
export function vonExcel(f) {
  try {
    const t = zerlegen(f);
    return "=" + t.map(k => k.a === "zahl" ? String(k.v) : k.a === "text" ? '"' + k.v.replace(/"/g, '""') + '"' : k.a === "bezug" ? k.roh : k.a === "name" ? (ZU_DE[k.v] || k.v) : k.a === "sep" ? ";" : k.a === "op" ? k.v : k.a).join("");
  } catch (e) { return "=" + f; }
}

// Alle Zellen, auf die eine Formel zeigt (zum Hervorheben beim Tippen)
export function bezuege(formel) {
  try { return zerlegen(String(formel).replace(/^=/, "")).filter(k => k.a === "bezug").map(k => ({ von: k.von.replace(/\$/g, ""), bis: k.bis ? k.bis.replace(/\$/g, "") : null, blatt: k.blatt })); } catch (e) { return []; }
}
