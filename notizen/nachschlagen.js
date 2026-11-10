// FIDELIA Notizen · Nachschlagen: Formelsammlung, Periodensystem, Einheiten-Umrechner
// Nur Daten und reine Rechnungen (ohne Browser) – wird mit node getestet.

/* ---------- Periodensystem ---------- */

export const ART = { n: "Nichtmetall", e: "Edelgas", a: "Alkalimetall", ea: "Erdalkalimetall", h: "Halbmetall", m: "Metall", x: "Halogen", u: "Übergangsmetall", l: "Lanthanoid", ac: "Actinoid", "?": "unbekannt" };
const ROH = "H|Wasserstoff|1,008|n;He|Helium|4,003|e;Li|Lithium|6,94|a;Be|Beryllium|9,012|ea;B|Bor|10,81|h;C|Kohlenstoff|12,011|n;N|Stickstoff|14,007|n;O|Sauerstoff|15,999|n;F|Fluor|18,998|x;Ne|Neon|20,180|e;Na|Natrium|22,990|a;Mg|Magnesium|24,305|ea;Al|Aluminium|26,982|m;Si|Silicium|28,085|h;P|Phosphor|30,974|n;S|Schwefel|32,06|n;Cl|Chlor|35,45|x;Ar|Argon|39,948|e;K|Kalium|39,098|a;Ca|Calcium|40,078|ea;Sc|Scandium|44,956|u;Ti|Titan|47,867|u;V|Vanadium|50,942|u;Cr|Chrom|51,996|u;Mn|Mangan|54,938|u;Fe|Eisen|55,845|u;Co|Cobalt|58,933|u;Ni|Nickel|58,693|u;Cu|Kupfer|63,546|u;Zn|Zink|65,38|u;Ga|Gallium|69,723|m;Ge|Germanium|72,630|h;As|Arsen|74,922|h;Se|Selen|78,971|n;Br|Brom|79,904|x;Kr|Krypton|83,798|e;Rb|Rubidium|85,468|a;Sr|Strontium|87,62|ea;Y|Yttrium|88,906|u;Zr|Zirconium|91,224|u;Nb|Niob|92,906|u;Mo|Molybdän|95,95|u;Tc|Technetium|98|u;Ru|Ruthenium|101,07|u;Rh|Rhodium|102,91|u;Pd|Palladium|106,42|u;Ag|Silber|107,87|u;Cd|Cadmium|112,41|u;In|Indium|114,82|m;Sn|Zinn|118,71|m;Sb|Antimon|121,76|h;Te|Tellur|127,60|h;I|Iod|126,90|x;Xe|Xenon|131,29|e;Cs|Caesium|132,91|a;Ba|Barium|137,33|ea;La|Lanthan|138,91|l;Ce|Cer|140,12|l;Pr|Praseodym|140,91|l;Nd|Neodym|144,24|l;Pm|Promethium|145|l;Sm|Samarium|150,36|l;Eu|Europium|151,96|l;Gd|Gadolinium|157,25|l;Tb|Terbium|158,93|l;Dy|Dysprosium|162,50|l;Ho|Holmium|164,93|l;Er|Erbium|167,26|l;Tm|Thulium|168,93|l;Yb|Ytterbium|173,05|l;Lu|Lutetium|174,97|l;Hf|Hafnium|178,49|u;Ta|Tantal|180,95|u;W|Wolfram|183,84|u;Re|Rhenium|186,21|u;Os|Osmium|190,23|u;Ir|Iridium|192,22|u;Pt|Platin|195,08|u;Au|Gold|196,97|u;Hg|Quecksilber|200,59|u;Tl|Thallium|204,38|m;Pb|Blei|207,2|m;Bi|Bismut|208,98|m;Po|Polonium|209|m;At|Astat|210|x;Rn|Radon|222|e;Fr|Francium|223|a;Ra|Radium|226|ea;Ac|Actinium|227|ac;Th|Thorium|232,04|ac;Pa|Protactinium|231,04|ac;U|Uran|238,03|ac;Np|Neptunium|237|ac;Pu|Plutonium|244|ac;Am|Americium|243|ac;Cm|Curium|247|ac;Bk|Berkelium|247|ac;Cf|Californium|251|ac;Es|Einsteinium|252|ac;Fm|Fermium|257|ac;Md|Mendelevium|258|ac;No|Nobelium|259|ac;Lr|Lawrencium|266|ac;Rf|Rutherfordium|267|?;Db|Dubnium|268|?;Sg|Seaborgium|269|?;Bh|Bohrium|270|?;Hs|Hassium|277|?;Mt|Meitnerium|278|?;Ds|Darmstadtium|281|?;Rg|Roentgenium|282|?;Cn|Copernicium|285|?;Nh|Nihonium|286|?;Fl|Flerovium|289|?;Mc|Moscovium|290|?;Lv|Livermorium|293|?;Ts|Tenness|294|?;Og|Oganesson|294|?";
// Platz im Periodensystem: Zeile 1–7, Lanthanoide in Zeile 9, Actinoide in Zeile 10 (Spalte 3–17)
export function platz(z) {
  if (z === 1) return { periode: 1, gruppe: 1, zeile: 1, spalte: 1 };
  if (z === 2) return { periode: 1, gruppe: 18, zeile: 1, spalte: 18 };
  const grenzen = [[3, 10, 2], [11, 18, 3]];
  for (const [a, b, p] of grenzen) if (z >= a && z <= b) { const g = z - a < 2 ? z - a + 1 : z - a + 11; return { periode: p, gruppe: g, zeile: p, spalte: g }; }
  if (z <= 36) return { periode: 4, gruppe: z - 18, zeile: 4, spalte: z - 18 };
  if (z <= 54) return { periode: 5, gruppe: z - 36, zeile: 5, spalte: z - 36 };
  if (z <= 56) return { periode: 6, gruppe: z - 54, zeile: 6, spalte: z - 54 };
  if (z <= 71) return { periode: 6, gruppe: 3, zeile: 9, spalte: z - 57 + 3 };
  if (z <= 86) return { periode: 6, gruppe: z - 68, zeile: 6, spalte: z - 68 };
  if (z <= 88) return { periode: 7, gruppe: z - 86, zeile: 7, spalte: z - 86 };
  if (z <= 103) return { periode: 7, gruppe: 3, zeile: 10, spalte: z - 89 + 3 };
  return { periode: 7, gruppe: z - 100, zeile: 7, spalte: z - 100 };
}
export const ELEMENTE = ROH.split(";").map((t, i) => {
  const [sym, name, masse, art] = t.split("|"), z = i + 1, p = platz(z);
  const haupt = p.gruppe <= 2 || p.gruppe >= 13;
  return { z, sym, name, masse, art, artName: ART[art], ...p, aussen: !haupt || art === "l" || art === "ac" ? null : z === 2 ? 2 : p.gruppe <= 2 ? p.gruppe : p.gruppe - 10 };
});
export function elementSuchen(q) {
  const t = String(q || "").trim().toLowerCase(); if (!t) return [];
  if (/^\d+$/.test(t)) return ELEMENTE.filter(e => e.z === Number(t));
  return ELEMENTE.filter(e => e.sym.toLowerCase() === t).concat(ELEMENTE.filter(e => e.sym.toLowerCase() !== t && e.name.toLowerCase().startsWith(t)));
}
// Molare Masse einer Formel wie H2O, Ca(OH)2, CuSO4·5H2O → { masse, teile: {H:2,O:1} } oder null
export function molmasse(formel) {
  const f = String(formel || "").replace(/\s/g, "").replace(/[₀-₉]/g, c => String(c.charCodeAt(0) - 8320));
  if (!f) return null;
  const masse = (s) => { const e = ELEMENTE.find(x => x.sym === s); return e ? Number(e.masse.replace(",", ".")) : null; };
  let i = 0;
  function zahl() { let n = ""; while (i < f.length && /\d/.test(f[i])) n += f[i++]; return n ? Number(n) : 1; }
  function gruppe() {
    const teile = {};
    while (i < f.length && f[i] !== ")" ) {
      if (f[i] === "(") { i++; const innen = gruppe(); if (f[i] !== ")") throw 0; i++; const n = zahl(); for (const [k, v] of Object.entries(innen)) teile[k] = (teile[k] || 0) + v * n; }
      else if (f[i] === "·" || f[i] === "*" || f[i] === ".") { i++; const n = zahl(); const rest = gruppe(); for (const [k, v] of Object.entries(rest)) teile[k] = (teile[k] || 0) + v * n; }
      else { const m = /^[A-Z][a-z]?/.exec(f.slice(i)); if (!m || masse(m[0]) == null) throw 0; i += m[0].length; const n = zahl(); teile[m[0]] = (teile[m[0]] || 0) + n; }
    }
    return teile;
  }
  try { const teile = gruppe(); if (i !== f.length || !Object.keys(teile).length) return null; return { masse: Math.round(Object.entries(teile).reduce((s, [k, v]) => s + masse(k) * v, 0) * 1000) / 1000, teile }; }
  catch (e) { return null; }
}

/* ---------- Einheiten ---------- */

export const EINHEITEN = {
  "Länge": { mm: 1e-3, cm: 1e-2, dm: 0.1, m: 1, km: 1000, "Zoll (in)": 0.0254, "Fuß (ft)": 0.3048, "Meile": 1609.344 },
  "Masse": { mg: 1e-6, g: 1e-3, kg: 1, t: 1000, "Pfund (lb)": 0.45359237 },
  "Zeit": { ms: 1e-3, s: 1, min: 60, h: 3600, Tag: 86400, Woche: 604800, Jahr: 31557600 },
  "Fläche": { "mm²": 1e-6, "cm²": 1e-4, "dm²": 1e-2, "m²": 1, a: 100, ha: 1e4, "km²": 1e6 },
  "Volumen": { "mm³": 1e-9, "cm³ = ml": 1e-6, cl: 1e-5, "dm³ = l": 1e-3, hl: 0.1, "m³": 1 },
  "Geschwindigkeit": { "m/s": 1, "km/h": 1 / 3.6, mph: 0.44704, Knoten: 1852 / 3600 },
  "Temperatur": { "°C": "c", K: "k", "°F": "f" },
  "Energie": { J: 1, kJ: 1000, cal: 4.184, kcal: 4184, Wh: 3600, kWh: 3.6e6 },
  "Druck": { Pa: 1, hPa: 100, bar: 1e5, atm: 101325 },
  "Daten": { Bit: 0.125, Byte: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, KiB: 1024, MiB: 1048576, GiB: 1073741824 }
};
export function umrechnen(wert, von, nach, art) {
  const t = EINHEITEN[art]; if (!t || !(von in t) || !(nach in t) || !isFinite(wert)) return null;
  if (art === "Temperatur") {
    const k = von === "°C" ? wert + 273.15 : von === "°F" ? (wert - 32) * 5 / 9 + 273.15 : wert;
    const r = nach === "°C" ? k - 273.15 : nach === "°F" ? (k - 273.15) * 9 / 5 + 32 : k;
    return Math.round(r * 1e10) / 1e10;
  }
  return Number((wert * t[von] / t[nach]).toPrecision(12));
}
export const zahlDe = (x) => { if (x == null) return "–"; const a = Math.abs(x); if (a !== 0 && (a >= 1e12 || a < 1e-6)) return x.toExponential(4).replace(".", ",").replace("e", " · 10^"); return x.toLocaleString("de-DE", { maximumFractionDigits: 10 }); };

/* ---------- Formelsammlung ---------- */
// [Bereich, Name, LaTeX, Erklärung]
export const FORMELN = [
  ["Mathe · Flächen", "Rechteck", "A = a \\cdot b \\quad u = 2a + 2b", "a, b: Seiten"],
  ["Mathe · Flächen", "Quadrat", "A = a^2 \\quad u = 4a", "a: Seite"],
  ["Mathe · Flächen", "Dreieck", "A = \\frac{1}{2} \\cdot g \\cdot h", "g: Grundseite, h: Höhe darauf"],
  ["Mathe · Flächen", "Parallelogramm", "A = g \\cdot h", "g: Grundseite, h: Höhe"],
  ["Mathe · Flächen", "Trapez", "A = \\frac{a + c}{2} \\cdot h", "a, c: parallele Seiten"],
  ["Mathe · Flächen", "Kreis", "A = \\pi r^2 \\quad u = 2 \\pi r", "r: Radius, π ≈ 3,14"],
  ["Mathe · Flächen", "Kreisausschnitt", "A = \\frac{\\alpha}{360^{\\circ}} \\cdot \\pi r^2", "α: Mittelpunktswinkel"],
  ["Mathe · Körper", "Würfel", "V = a^3 \\quad O = 6a^2", "a: Kante"],
  ["Mathe · Körper", "Quader", "V = a \\cdot b \\cdot c \\quad O = 2(ab + ac + bc)", ""],
  ["Mathe · Körper", "Prisma", "V = G \\cdot h", "G: Grundfläche"],
  ["Mathe · Körper", "Zylinder", "V = \\pi r^2 h \\quad O = 2\\pi r^2 + 2\\pi r h", ""],
  ["Mathe · Körper", "Pyramide", "V = \\frac{1}{3} G \\cdot h", "G: Grundfläche"],
  ["Mathe · Körper", "Kegel", "V = \\frac{1}{3} \\pi r^2 h", ""],
  ["Mathe · Körper", "Kugel", "V = \\frac{4}{3} \\pi r^3 \\quad O = 4 \\pi r^2", ""],
  ["Mathe · Algebra", "1. binomische Formel", "(a + b)^2 = a^2 + 2ab + b^2", ""],
  ["Mathe · Algebra", "2. binomische Formel", "(a - b)^2 = a^2 - 2ab + b^2", ""],
  ["Mathe · Algebra", "3. binomische Formel", "(a + b)(a - b) = a^2 - b^2", ""],
  ["Mathe · Algebra", "pq-Formel", "x_{1,2} = -\\frac{p}{2} \\pm \\sqrt{\\left(\\frac{p}{2}\\right)^2 - q}", "für x² + px + q = 0"],
  ["Mathe · Algebra", "Mitternachtsformel", "x_{1,2} = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}", "für ax² + bx + c = 0"],
  ["Mathe · Algebra", "Potenzgesetze", "a^m \\cdot a^n = a^{m+n} \\quad \\frac{a^m}{a^n} = a^{m-n} \\quad (a^m)^n = a^{m \\cdot n}", ""],
  ["Mathe · Algebra", "Prozentrechnung", "W = \\frac{G \\cdot p}{100}", "W: Prozentwert, G: Grundwert, p: Prozentsatz"],
  ["Mathe · Algebra", "Zinsen", "Z = \\frac{K \\cdot p}{100}", "K: Kapital, p: Zinssatz pro Jahr"],
  ["Mathe · Algebra", "Zinseszins", "K_n = K_0 \\cdot \\left(1 + \\frac{p}{100}\\right)^n", "n: Jahre"],
  ["Mathe · Geometrie", "Satz des Pythagoras", "a^2 + b^2 = c^2", "c: Hypotenuse (gegenüber vom rechten Winkel)"],
  ["Mathe · Geometrie", "Winkelsumme Dreieck", "\\alpha + \\beta + \\gamma = 180^{\\circ}", ""],
  ["Mathe · Geometrie", "Sinus, Kosinus, Tangens", "\\sin \\alpha = \\frac{\\text{GK}}{\\text{H}} \\quad \\cos \\alpha = \\frac{\\text{AK}}{\\text{H}} \\quad \\tan \\alpha = \\frac{\\text{GK}}{\\text{AK}}", "GK: Gegenkathete, AK: Ankathete, H: Hypotenuse"],
  ["Mathe · Funktionen", "Lineare Funktion", "y = m x + b", "m: Steigung, b: y-Achsenabschnitt"],
  ["Mathe · Funktionen", "Steigung", "m = \\frac{y_2 - y_1}{x_2 - x_1}", "aus zwei Punkten"],
  ["Mathe · Funktionen", "Scheitelpunktform", "y = a(x - d)^2 + e", "Scheitel S(d | e)"],
  ["Mathe · Statistik", "Mittelwert", "\\bar{x} = \\frac{x_1 + x_2 + \\dots + x_n}{n}", ""],
  ["Mathe · Statistik", "Wahrscheinlichkeit (Laplace)", "P(E) = \\frac{\\text{günstige}}{\\text{mögliche}}", ""],
  ["Physik", "Geschwindigkeit", "v = \\frac{s}{t}", "s: Weg, t: Zeit"],
  ["Physik", "Beschleunigung", "a = \\frac{\\Delta v}{\\Delta t}", ""],
  ["Physik", "Kraft (2. Newton)", "F = m \\cdot a", "in N = kg·m/s²"],
  ["Physik", "Gewichtskraft", "F_G = m \\cdot g", "g ≈ 9,81 N/kg"],
  ["Physik", "Dichte", "\\rho = \\frac{m}{V}", ""],
  ["Physik", "Druck", "p = \\frac{F}{A}", "in Pa = N/m²"],
  ["Physik", "Arbeit", "W = F \\cdot s", "in J = N·m"],
  ["Physik", "Leistung", "P = \\frac{W}{t}", "in W = J/s"],
  ["Physik", "Kinetische Energie", "E_{kin} = \\frac{1}{2} m v^2", ""],
  ["Physik", "Lageenergie", "E_{pot} = m \\cdot g \\cdot h", ""],
  ["Physik", "Hebelgesetz", "F_1 \\cdot a_1 = F_2 \\cdot a_2", "a: Hebelarm"],
  ["Physik", "Ohmsches Gesetz", "U = R \\cdot I", "U: Spannung (V), R: Widerstand (Ω), I: Stromstärke (A)"],
  ["Physik", "Elektrische Leistung", "P = U \\cdot I", ""],
  ["Physik", "Wärme", "Q = c \\cdot m \\cdot \\Delta T", "c: spezifische Wärmekapazität"],
  ["Chemie", "Stoffmenge", "n = \\frac{m}{M}", "M: molare Masse (g/mol)"],
  ["Chemie", "Konzentration", "c = \\frac{n}{V}", "in mol/l"],
  ["Chemie", "Gasgesetz", "p \\cdot V = n \\cdot R \\cdot T", "R = 8,314 J/(mol·K)"],
  ["Chemie", "pH-Wert", "\\mathrm{pH} = -\\log_{10} c(\\mathrm{H_3O^+})", ""]
];
// LaTeX → lesbarer Text zum Einfügen ohne Formel-Editor
export function texZuText(t) {
  let s = String(t).replace(/\^\{\\circ\}/g, "°").replace(/\\cdot/g, "·").replace(/\\pm/g, "±").replace(/\\pi/g, "π").replace(/\\quad/g, " ; ").replace(/\\alpha/g, "α").replace(/\\beta/g, "β").replace(/\\gamma/g, "γ").replace(/\\rho/g, "ρ").replace(/\\Delta\s*/g, "Δ").replace(/\\dots/g, "…").replace(/\\bar\{x\}/g, "x̄").replace(/\\log_\{10\}/g, "log").replace(/\\(sin|cos|tan)/g, "$1");
  for (let i = 0; i < 4; i++) s = s.replace(/\\(?:text|mathrm)\{([^{}]*)\}/g, "$1").replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)").replace(/\\sqrt\{([^{}]*)\}/g, "√($1)").replace(/\\left\(/g, "(").replace(/\\right\)/g, ")");
  s = s.replace(/\(([^()\s]+)\)\/\(([^()\s]+)\)/g, "$1/$2").replace(/\/\(([\w°]+)\)/g, "/$1");
  s = s.replace(/\^\{([^{}]*)\}/g, "^($1)").replace(/\^\(([^()])\)/g, "^$1").replace(/\^2/g, "²").replace(/\^3/g, "³").replace(/_\{([^{}]*)\}/g, "_$1").replace(/[{}]/g, "").replace(/[ \t]+/g, " ").trim();
  return s;
}
