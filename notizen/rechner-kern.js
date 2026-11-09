// FIDELIA Notizen · Taschenrechner – die Rechen-Maschine (wie ein Schul-Taschenrechner mit Bruch-Anzeige)
// Rechnet mit exakten Brüchen, solange es geht (¾ + ⅔ = 17⁄12), sonst mit Kommazahlen.
// Eingabe ist eine Zeile wie „3⁄4+√(2)×5^(2)“. Läuft ohne Browser (Tests mit node).

/* ---------- Werte: Bruch { n, d } oder Kommazahl { v } ---------- */

const ggt = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const SICHER = 2 ** 52;
export function bruch(n, d = 1) {
  if (!d) throw new Error("Division durch 0");
  if (!Number.isInteger(n) || !Number.isInteger(d) || Math.abs(n) > SICHER || Math.abs(d) > SICHER) return { v: n / d };
  if (d < 0) { n = -n; d = -d; }
  const g = ggt(n, d) || 1;
  return { n: n / g, d: d / g };
}
const zahl = (x) => "v" in x ? x.v : x.n / x.d;
const istBruch = (x) => !("v" in x);
function ausKomma(v) { // 0,25 → 1⁄4, wenn die Zahl kurz ist
  if (!isFinite(v)) return { v };
  if (Number.isInteger(v)) return bruch(v, 1);
  const s = String(v); const m = /^-?\d+\.(\d{1,9})$/.exec(s);
  if (m) { const f = 10 ** m[1].length; return bruch(Math.round(v * f), f); }
  return { v };
}

const plus = (a, b) => istBruch(a) && istBruch(b) ? bruch(a.n * b.d + b.n * a.d, a.d * b.d) : { v: zahl(a) + zahl(b) };
const minus = (a, b) => plus(a, neg(b));
const mal = (a, b) => istBruch(a) && istBruch(b) ? bruch(a.n * b.n, a.d * b.d) : { v: zahl(a) * zahl(b) };
const durch = (a, b) => { if (zahl(b) === 0) throw new Error("Division durch 0"); return istBruch(a) && istBruch(b) ? bruch(a.n * b.d, a.d * b.n) : { v: zahl(a) / zahl(b) }; };
const neg = (a) => istBruch(a) ? { n: -a.n, d: a.d } : { v: -a.v };
function hoch(a, b) {
  if (istBruch(a) && istBruch(b) && b.d === 1 && Math.abs(b.n) <= 64) {
    const e = Math.abs(b.n); let n = 1, d = 1; for (let i = 0; i < e; i++) { n *= a.n; d *= a.d; }
    if (Math.abs(n) <= SICHER && d <= SICHER) return b.n >= 0 ? bruch(n, d) : bruch(d, n);
  }
  // Wurzeln aus Brüchen exakt, wenn sie aufgehen (z. B. (9⁄4)^(1⁄2) = 3⁄2, (8⁄27)^(2⁄3) = 4⁄9)
  if (istBruch(a) && istBruch(b) && b.d > 1 && b.d <= 12 && a.n >= 0) {
    const wurzel = (z) => { const r = Math.round(Math.pow(z, 1 / b.d)); return r ** b.d === z ? r : null; };
    const wn = wurzel(a.n), wd = wurzel(a.d);
    if (wn !== null && wd !== null) return hoch(bruch(wn, wd), bruch(b.n));
  }
  const x = zahl(a), y = zahl(b);
  if (x < 0 && istBruch(b) && b.d % 2 === 1) return { v: (b.n % 2 ? -1 : 1) * Math.pow(-x, y) };
  const r = Math.pow(x, y);
  if (isNaN(r)) throw new Error("Nicht definiert");
  return glatt(r);
}
// Rechen-Krümel wegräumen (0,1+0,2) und ganze Zahlen als Bruch behalten
function glatt(v) {
  if (!isFinite(v)) return { v };
  const r = Number(v.toPrecision(12));
  if (Number.isInteger(r)) return bruch(r, 1);
  // kurze Kommazahl (sin 30° = 0,5) → als Bruch, damit die Bruch-Anzeige klappt
  const m = /\.(\d+)$/.exec(String(r));
  return m && m[1].length <= 6 && Math.abs(r) < 1e6 ? ausKomma(r) : { v };
}

/* ---------- Einstellungen ---------- */

export const STANDARD = { winkel: "deg", anzeige: "normal", fix: null, bruch: "auto" }; // anzeige: normal | sci ; fix: null | 0..9 ; bruch: auto | komma

/* ---------- Zerlegen ---------- */

const FUNKTIONEN = ["sin⁻¹", "cos⁻¹", "tan⁻¹", "sin", "cos", "tan", "ln", "log", "√", "abs", "round", "ggT", "kgV", "root", "int", "ganz"];
const VARS = ["ans", "x", "y", "z", "t", "a", "b", "c"];

function zerlegen(text) {
  const t = String(text).replace(/\s+/g, "").replace(/−/g, "-").replace(/·/g, "×").replace(/\*/g, "×").replace(/:/g, "÷").replace(/\//g, "÷").replace(/ⁿ√/g, "root");
  const out = []; let i = 0;
  while (i < t.length) {
    const r = t.slice(i);
    let m = /^(\d+[.,]?\d*|[.,]\d+)/.exec(r);
    if (m) { out.push({ a: "zahl", v: m[0].replace(",", ".") }); i += m[0].length; continue; }
    const fn = FUNKTIONEN.find(f => r.startsWith(f + "("));
    if (fn) { out.push({ a: "fn", v: fn }); i += fn.length + 1; continue; } // die Klammer gehört zur Funktion
    if (r.startsWith("nCr") || r.startsWith("nPr")) { out.push({ a: "op", v: r.slice(0, 3) }); i += 3; continue; }
    if (r.startsWith("⁻¹")) { out.push({ a: "post", v: "inv" }); i += 2; continue; }
    if (r[0] === "²") { out.push({ a: "post", v: "quad" }); i++; continue; }
    if (r[0] === "³") { out.push({ a: "post", v: "kubik" }); i++; continue; }
    if (r[0] === "!") { out.push({ a: "post", v: "fak" }); i++; continue; }
    if (r[0] === "%") { out.push({ a: "post", v: "proz" }); i++; continue; }
    if (r[0] === "π") { out.push({ a: "konst", v: "pi" }); i++; continue; }
    if (r[0] === "ℯ" || (r[0] === "e" && !/^e[a-z]/i.test(r))) { out.push({ a: "konst", v: "e" }); i++; continue; }
    if (r[0] === "E" || r.startsWith("×10^")) { out.push({ a: "op", v: "EE" }); i += r[0] === "E" ? 1 : 4; continue; }
    const v = r.startsWith("ans") ? "ans" : VARS.includes(r[0]) ? r[0] : null;
    if (v) { out.push({ a: "var", v }); i += v.length; continue; }
    if ("+-×÷^⁄(),;".includes(r[0])) { out.push({ a: r[0] === "," || r[0] === ";" ? "sep" : r[0] === "(" || r[0] === ")" ? r[0] : "op", v: r[0] }); i++; continue; }
    throw new Error("Unbekanntes Zeichen: " + r[0]);
  }
  // Mal-Zeichen ergänzen: 2π, 3(…), 2x, )( , 2√(…)
  const z = [];
  for (const k of out) {
    const v = z[z.length - 1];
    if (v && (v.a === "zahl" || v.a === "konst" || v.a === "var" || v.a === ")" || v.a === "post") && (k.a === "zahl" || k.a === "konst" || k.a === "var" || k.a === "(" || k.a === "fn")) z.push({ a: "op", v: "×" });
    z.push(k);
  }
  return z;
}

/* ---------- Rechnen ---------- */

const RAD = (x, e) => e.winkel === "deg" ? x * Math.PI / 180 : x;
const GRAD = (x, e) => e.winkel === "deg" ? x * 180 / Math.PI : x;
function trig(f, x, e) {
  const w = RAD(x, e);
  // exakte Werte bei 0/90/180 … (sin 180° = 0, nicht 1,2e-16)
  const r = f(w);
  return glatt(Math.abs(r) < 1e-12 ? 0 : Math.abs(r - Math.round(r)) < 1e-12 ? Math.round(r) : r);
}
function fakultaet(a) {
  const x = zahl(a); if (!Number.isInteger(x) || x < 0) throw new Error("Fakultät nur für 0, 1, 2, …"); if (x > 170) throw new Error("Zahl zu groß");
  let r = 1; for (let i = 2; i <= x; i++) r *= i; return glatt(r);
}

export function rechnen(text, speicher = {}, einst = STANDARD) {
  const e = Object.assign({}, STANDARD, einst);
  const t = zerlegen(text); let p = 0;
  if (!t.length) throw new Error("Leer");
  const sieh = () => t[p], nimm = () => t[p++];
  const istOp = (...v) => sieh() && sieh().a === "op" && v.includes(sieh().v);
  function summe() { let l = produkt(); while (istOp("+", "-")) { const o = nimm().v, r = produkt(); l = o === "+" ? plus(l, r) : minus(l, r); } return l; }
  function produkt() {
    let l = vorzeichen();
    while (istOp("×", "÷", "nCr", "nPr")) {
      const o = nimm().v, r = vorzeichen();
      if (o === "×") l = mal(l, r); else if (o === "÷") l = durch(l, r);
      else { const n = zahl(l), k = zahl(r); if (!Number.isInteger(n) || !Number.isInteger(k) || k < 0 || n < 0) throw new Error("nCr/nPr nur mit ganzen Zahlen"); if (k > n) { l = bruch(0); continue; } let v = 1; for (let i = 0; i < k; i++) v *= (n - i); if (o === "nCr") for (let i = 2; i <= k; i++) v /= i; l = glatt(Math.round(v)); }
    }
    return l;
  }
  function vorzeichen() { if (istOp("-")) { nimm(); return neg(vorzeichen()); } if (istOp("+")) { nimm(); return vorzeichen(); } return potenz(); }
  function potenz() {
    const b = bruchStrich();
    if (istOp("^")) { nimm(); const ex = vorzeichen(); return hoch(b, ex); }
    return b;
  }
  // „3⁄4“ – der Bruchstrich bindet stärker als × und ÷
  function bruchStrich() { let l = ee(); while (istOp("⁄")) { nimm(); l = durch(l, ee()); } return l; }
  function ee() { let l = nachgestellt(); while (istOp("EE")) { nimm(); const neg2 = istOp("-") ? (nimm(), true) : false; const r = nachgestellt(); l = mal(l, hoch(bruch(10), neg2 ? neg(r) : r)); } return l; }
  function nachgestellt() {
    let x = einfach();
    while (sieh() && sieh().a === "post") {
      const o = nimm().v;
      if (o === "quad") x = mal(x, x); else if (o === "kubik") x = mal(mal(x, x), x);
      else if (o === "inv") x = durch(bruch(1), x); else if (o === "fak") x = fakultaet(x); else if (o === "proz") x = durch(x, bruch(100));
    }
    return x;
  }
  function argumente() {
    const args = [summe()];
    while (sieh() && sieh().a === "sep") { nimm(); args.push(summe()); }
    if (sieh() && sieh().a === ")") nimm(); // fehlende Klammer am Ende ist erlaubt (wie beim Taschenrechner)
    else if (sieh()) throw new Error("Klammer fehlt");
    return args;
  }
  function einfach() {
    const k = nimm();
    if (!k) throw new Error("Da fehlt noch etwas");
    if (k.a === "zahl") return ausKomma(Number(k.v));
    if (k.a === "konst") return { v: k.v === "pi" ? Math.PI : Math.E };
    if (k.a === "var") { const w = speicher[k.v]; if (w === undefined) return bruch(0); return w; }
    if (k.a === "(") { const x = summe(); if (sieh() && sieh().a === ")") nimm(); else if (sieh()) throw new Error("Klammer fehlt"); return x; }
    if (k.a === "fn") {
      const args = argumente(), x = args[0], v = zahl(x);
      switch (k.v) {
        case "sin": return trig(Math.sin, v, e);
        case "cos": return trig(Math.cos, v, e);
        case "tan": { if (e.winkel === "deg" && Math.abs((v % 180 + 180) % 180 - 90) < 1e-12) throw new Error("tan ist hier nicht definiert"); return trig(Math.tan, v, e); }
        case "sin⁻¹": if (Math.abs(v) > 1) throw new Error("Nur Werte von −1 bis 1"); return glatt(GRAD(Math.asin(v), e));
        case "cos⁻¹": if (Math.abs(v) > 1) throw new Error("Nur Werte von −1 bis 1"); return glatt(GRAD(Math.acos(v), e));
        case "tan⁻¹": return glatt(GRAD(Math.atan(v), e));
        case "ln": if (v <= 0) throw new Error("ln nur für positive Zahlen"); return glatt(Math.log(v));
        case "log": if (v <= 0) throw new Error("log nur für positive Zahlen"); return glatt(Math.log10(v));
        case "√": if (v < 0) throw new Error("Keine Wurzel aus negativen Zahlen"); return hoch(x, bruch(1, 2));
        case "root": { if (args.length < 2) throw new Error("ⁿ√(n;x)"); return hoch(args[1], durch(bruch(1), args[0])); }
        case "abs": return v < 0 ? neg(x) : x;
        case "round": { const n = args[1] ? zahl(args[1]) : 0, f = 10 ** n; return ausKomma(Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f); }
        case "int": case "ganz": return bruch(Math.floor(v));
        case "ggT": return bruch(args.map(zahl).reduce((a, b) => ggt(Math.round(a), Math.round(b))));
        case "kgV": return bruch(args.map(zahl).reduce((a, b) => Math.abs(Math.round(a) * Math.round(b)) / (ggt(Math.round(a), Math.round(b)) || 1)));
      }
    }
    throw new Error("Da stimmt etwas nicht");
  }
  const r = summe();
  if (p < t.length) throw new Error(t[p].a === ")" ? "Eine Klammer zu viel" : "Da stimmt etwas nicht");
  if (!isFinite(zahl(r))) throw new Error("Überlauf");
  return r;
}

/* ---------- Anzeige ---------- */

const HOCH = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
const hochzahl = (n) => String(n).split("").map(c => HOCH[c] || c).join("");
const komma = (s) => s.replace(".", ",");

// Zahl als Text. art: "bruch" (wenn möglich ¾), "gemischt" (1 5⁄12), "komma"
export function formatieren(x, einst = STANDARD, art = null) {
  const e = Object.assign({}, STANDARD, einst);
  const v = zahl(x);
  art = art || (e.bruch === "komma" ? "komma" : "bruch");
  if ((art === "bruch" || art === "gemischt") && istBruch(x) && x.d !== 1 && x.d <= 100000 && e.fix === null && e.anzeige !== "sci") {
    if (art === "gemischt" && Math.abs(x.n) > x.d) { const g = Math.trunc(x.n / x.d), r = Math.abs(x.n % x.d); return g + " " + r + "⁄" + x.d; }
    return x.n + "⁄" + x.d;
  }
  if (e.anzeige === "sci" || (v !== 0 && (Math.abs(v) >= 1e10 || Math.abs(v) < 1e-9))) {
    const ex = v === 0 ? 0 : Math.floor(Math.log10(Math.abs(v))), m = v / 10 ** ex;
    return komma(e.fix !== null ? m.toFixed(e.fix) : String(Number(m.toPrecision(10)))) + "×10" + hochzahl(ex);
  }
  if (e.fix !== null) return komma(v.toFixed(e.fix));
  return komma(String(Number(v.toPrecision(10))));
}

// Rechnung hübsch als HTML (Brüche übereinander, Wurzel mit Strich, Hochzahlen)
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export function schoen(text) {
  let s = esc(text).replace(/\*/g, "×").replace(/\//g, "÷").replace(/-/g, "−").replace(/\./g, ",");
  // Klammerinhalte nach Hochzahl: ^(…) → <sup>…</sup>, ^2 → <sup>2</sup>
  const klammer = (str, ab) => { let tiefe = 0; for (let i = ab; i < str.length; i++) { if (str[i] === "(") tiefe++; else if (str[i] === ")") { tiefe--; if (!tiefe) return i; } } return str.length; };
  for (let n = 0; n < 30; n++) {
    let i = s.indexOf("^(");
    if (i < 0) break;
    const e = klammer(s, i + 1);
    s = s.slice(0, i) + "<sup>" + s.slice(i + 2, e) + "</sup>" + s.slice(e + 1);
  }
  s = s.replace(/\^(−?[\d,]+|[a-zπ])/g, "<sup>$1</sup>");
  for (let n = 0; n < 30; n++) {
    let i = s.indexOf("√(");
    if (i < 0) break;
    const e = klammer(s, i + 1);
    s = s.slice(0, i) + '<span class="wurzel">√<span class="unter">' + s.slice(i + 2, e) + "</span></span>" + s.slice(e + 1);
  }
  // einfache Brüche a⁄b übereinander
  s = s.replace(/(−?[\d,]+|[a-zπ]|\))⁄([\d,]+|[a-zπ])/g, (m, a, b) => a === ")" ? m : '<span class="bruch"><span>' + a + "</span><span>" + b + "</span></span>");
  return s;
}

/* ---------- Wertetabelle und Statistik ---------- */

export function tabelle(fx, start, schritt, anzahl = 10, einst = STANDARD) {
  const out = [];
  for (let i = 0; i < anzahl; i++) {
    const x = Number((start + i * schritt).toPrecision(12));
    let y; try { y = formatieren(rechnen(fx, { x: ausKomma(x) }, einst), einst, "komma"); } catch (e) { y = "–"; }
    out.push([komma(String(x)), y]);
  }
  return out;
}

export function statistik(werte) {
  const z = werte.filter(v => isFinite(v)); const n = z.length;
  if (!n) return null;
  const s = z.reduce((a, b) => a + b, 0), m = s / n, sort = z.slice().sort((a, b) => a - b);
  const med = n % 2 ? sort[n >> 1] : (sort[n / 2 - 1] + sort[n / 2]) / 2;
  const q = z.reduce((a, b) => a + (b - m) ** 2, 0);
  return { n, summe: s, mittel: m, median: med, min: sort[0], max: sort[n - 1], sx: n > 1 ? Math.sqrt(q / (n - 1)) : 0, sigma: Math.sqrt(q / n), quadSumme: z.reduce((a, b) => a + b * b, 0) };
}

export { zahl, istBruch, ausKomma };
