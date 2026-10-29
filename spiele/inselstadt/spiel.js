/* Inselstadt (FLARESSA Gaming)
   Aufbauspiel nach dem Vorbild von Cities: Skylines – läuft im Browser und auf dem Handy.
   Karten und Spielstände · Straßen per Antippen · Zonen · Häuser wachsen nach Bedarf ·
   Steuern, Budget, Meilensteine · echter Verkehr mit Wegsuche, Kreuzungen, Ampeln und Stau · selbst fahren. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { mergeGeometries } from "three/addons/BufferGeometryUtils.js";

const $ = (id) => document.getElementById(id);
const lade = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const merke = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
function zufall(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const farbe = (h) => new THREE.Color(h);
const glatt = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const klemme = (x, a, b) => Math.max(a, Math.min(b, x));
const wahl = (r, a) => a[Math.floor(r() * a.length)];
const euro = (n) => Math.round(n).toLocaleString("de-DE") + " €";
const zahl = (n) => Math.round(n).toLocaleString("de-DE");
const meter = (u) => Math.round(u * 8) + " m";

/* ---------- Grundwerte ---------- */
const G = 0.12, BODEN = G + 0.02, WASSER = -0.3, ZELLE = 1.0, REIHEN = 4;
const KACHEL = 40, KN = 7, HALB = KACHEL * KN / 2, ALT_HALB = 100;
let grossKarte = true;   // neue Spiele: größere Insel/Seen und Autobahn
const FELD = 400;   // Größe des Geländes (±200)
/* Zonen wie bei Cities: Skylines – Gruppe w/g/b/i für Bedarf und Steuern */
const ZONEN = {
  1: { name: "Wohnen niedrig", kurz: "Wohnen", em: "🏡", farbe: 0x7fe08f, gruppe: "w", max: 5, breite: [1, 2], tiefe: 3, boden: 0x8fcf68 },
  2: { name: "Wohnen hoch", kurz: "Wohnen", em: "🏢", farbe: 0x23a04a, gruppe: "w", max: 5, breite: [2, 4], tiefe: 4, minTiefe: 2, boden: 0x9ccf7c, ab: 2 },
  3: { name: "Gewerbe niedrig", kurz: "Gewerbe", em: "🛍️", farbe: 0x7cc4ff, gruppe: "g", max: 3, breite: [1, 2], tiefe: 2, boden: 0xd6cfc2 },
  4: { name: "Gewerbe hoch", kurz: "Gewerbe", em: "🏬", farbe: 0x2f6fd9, gruppe: "g", max: 3, breite: [2, 4], tiefe: 4, minTiefe: 2, boden: 0xcfc9bd, ab: 2 },
  5: { name: "Büros", kurz: "Büros", em: "💼", farbe: 0x3fd6c9, gruppe: "b", max: 3, breite: [2, 3], tiefe: 3, minTiefe: 2, boden: 0xcdd3d5, ab: 3 },
  6: { name: "Industrie", kurz: "Industrie", em: "🏭", farbe: 0xffc23d, gruppe: "i", max: 3, breite: [2, 4], tiefe: 4, boden: 0xb5b3ad },
  7: { name: "Landwirtschaft", kurz: "Landwirtschaft", em: "🌾", farbe: 0xd9a63a, gruppe: "i", max: 1, breite: [3, 4], tiefe: 4, boden: 0xa98a5a, ab: 1 },
  8: { name: "Forstwirtschaft", kurz: "Forst", em: "🪵", farbe: 0x9c6b3c, gruppe: "i", max: 1, breite: [2, 4], tiefe: 4, boden: 0x9a8a6a, ab: 1 }
};
const GRUPPEN = { w: { name: "Wohnen", em: "🏠", farbe: "#4fd27a" }, g: { name: "Gewerbe", em: "🛍️", farbe: "#4aa8ff" }, b: { name: "Büros", em: "💼", farbe: "#3fd6c9" }, i: { name: "Industrie", em: "🏭", farbe: "#ffc23d" } };
const LEUTE = { 1: [0, 2, 3, 4, 5, 6], 2: [0, 6, 9, 12, 15, 20] };
const JOBS = { 3: [0, 2, 3, 4], 4: [0, 5, 8, 11], 5: [0, 6, 10, 14], 6: [0, 4, 6, 8], 7: [0, 2], 8: [0, 3] };
const BODENWERT_FUER = { w: [0, 0, 22, 38, 54, 70], g: [0, 0, 28, 48], b: [0, 0, 30, 50], i: [0, 0, 0, 0] };
const TYP = {
  gasse: { name: "Gasse", em: "🏘️", halb: 0.5, fahr: 0.3, preis: 40, zellen: true, autos: true, tempo: 1.4, spuren: [0.14], kat: "klein", info: "Schmale Spielstraße, Schrittgeschwindigkeit." },
  parkstr: { name: "Straße mit Parkstreifen", em: "🅿️", halb: 0.74, fahr: 0.42, preis: 75, zellen: true, autos: true, tempo: 2.0, spuren: [0.21], kat: "klein", parken: true, info: "Autos parken am Rand – gut für Läden." },
  land: { name: "Landstraße", em: "🌾", halb: 0.78, fahr: 0.6, preis: 90, zellen: false, autos: true, tempo: 3.6, spuren: [0.28], kat: "autobahn", ohneGehweg: true, rang: 2, info: "Schnell, ohne Häuser am Rand – verbindet Orte." },
  haupt_rad: { name: "Hauptstraße mit Radweg", em: "🚲", halb: 1.32, fahr: 0.86, preis: 190, zellen: true, autos: true, tempo: 3.0, spuren: [0.22, 0.64], rang: 2, kat: "mittel", radweg: true, info: "Rote Radwege an beiden Seiten." },
  haupt_bus: { name: "Hauptstraße mit Busspur", em: "🚌", halb: 1.12, fahr: 0.86, preis: 180, zellen: true, autos: true, tempo: 3.1, spuren: [0.22, 0.64], rang: 2, kat: "mittel", busspur: true, info: "Rechte Spur nur für Busse und Taxis." },
  haupt_gruen: { name: "Hauptstraße mit Grünstreifen", em: "🌿", halb: 1.26, fahr: 0.98, preis: 210, zellen: true, autos: true, tempo: 3.1, spuren: [0.34, 0.76], rang: 2, kat: "mittel", mitte: "gruen", info: "Grüner Mittelstreifen – ruhiger und schöner." },
  haupt_tram: { name: "Hauptstraße mit Straßenbahn", em: "🚋", halb: 1.12, fahr: 0.86, preis: 280, zellen: true, autos: true, tempo: 3.0, spuren: [0.22, 0.64], rang: 2, kat: "mittel", schienen: true, info: "Mit Gleisen für Straßenbahnen." },
  boulevard: { name: "Boulevard", em: "🌳", halb: 1.95, fahr: 1.7, preis: 340, zellen: true, autos: true, tempo: 3.3, spuren: [0.62, 1.04, 1.46], rang: 3, kat: "gross", mitte: "baeume", baeume: [0], info: "Breite Prachtstraße mit Bäumen in der Mitte." },
  gross_tram: { name: "Große Straße mit Straßenbahn", em: "🚊", halb: 1.62, fahr: 1.36, preis: 380, zellen: true, autos: true, tempo: 3.3, spuren: [0.32, 0.74, 1.16], rang: 3, kat: "gross", mitte: "gruen", schienen: true, info: "6 Spuren mit Straßenbahngleisen." },
  einbahn_klein: { name: "Einbahnstraße", em: "➡️", halb: 0.62, fahr: 0.4, preis: 55, zellen: true, autos: true, tempo: 2.1, spuren: [0.12], kat: "einbahn", einbahn: true, info: "Nur in eine Richtung – in Baurichtung." },
  einbahn_gross: { name: "Große Einbahnstraße", em: "⏩", halb: 0.98, fahr: 0.78, preis: 150, zellen: true, autos: true, tempo: 3.0, spuren: [-0.4, 0, 0.4], rang: 2, kat: "einbahn", einbahn: true, info: "3 Spuren in eine Richtung." },
  rampe: { name: "Auf- und Abfahrt", em: "↗️", halb: 0.55, fahr: 0.45, preis: 220, zellen: false, autos: true, tempo: 3.6, spuren: [0], rang: 3, kat: "autobahn", einbahn: true, ohneGehweg: true, info: "Einspurige Rampe zur Autobahn – in Baurichtung." },
  radweg: { name: "Radweg", em: "🚴", halb: 0.32, fahr: 0, preis: 20, zellen: false, autos: false, tempo: 0, spuren: [], kat: "fuss", rad: true, info: "Eigener Weg für Fahrräder." },
  kies: { name: "Kiesweg", em: "🪨", halb: 0.36, fahr: 0, preis: 10, zellen: false, autos: false, tempo: 0, spuren: [], kat: "fuss", kies: true, info: "Weg für Parks und Natur." },
  fuss: { name: "Fußweg", em: "🚶", halb: 0.42, fahr: 0, preis: 15, zellen: false, autos: false, tempo: 0, spuren: [] , kat: "fuss" },
  klein: { name: "Straße", em: "🛣️", halb: 0.68, fahr: 0.42, preis: 60, zellen: true, autos: true, tempo: 2.1, spuren: [0.21] , kat: "klein" },
  allee: { name: "Allee", em: "🌳", baeume: [0.6], halb: 0.98, fahr: 0.42, preis: 100, zellen: true, autos: true, tempo: 2.1, spuren: [0.21] , kat: "klein" },
  haupt: { name: "Hauptstraße", em: "🚗", halb: 1.12, fahr: 0.86, preis: 160, zellen: true, autos: true, tempo: 3.1, spuren: [0.22, 0.64], rang: 2 , kat: "mittel" },
  gross: { name: "Große Straße", em: "🛤", halb: 1.62, fahr: 1.36, preis: 260, zellen: true, autos: true, tempo: 3.4, spuren: [0.32, 0.74, 1.16], rang: 3, mitte: "gruen" , kat: "gross" },
  autobahn: { name: "Autobahn", em: "🛣", halb: 1.55, fahr: 1.45, preis: 400, zellen: false, autos: true, tempo: 5.0, spuren: [0.3, 0.72, 1.14], rang: 4, mitte: "planke", ohneGehweg: true , kat: "autobahn" },
  zone: { name: "Fußgängerzone", em: "🧺", halb: 0.72, fahr: 0, preis: 90, zellen: true, autos: false, tempo: 0, spuren: [], pflaster: true , kat: "fuss" }
};
const rang = (k) => TYP[k.typ].rang || 1;
const KARTEN = {
  insel: { name: "Große Insel", em: "🏝️", text: "Eine große Insel mitten im Meer, mit Leuchtturm und Stränden.", geld: 70000 },
  kueste: { name: "Küste", em: "🏖️", text: "Festland mit langer Küste und einer Bucht. Viel Platz nach hinten.", geld: 70000 },
  seen: { name: "Seenland", em: "🏞️", text: "Wiesen mit vielen Seen. Schön, aber man muss um das Wasser herum planen.", geld: 70000 },
  wald: { name: "Waldtal", em: "🌲", text: "Dichter Wald und zwei Seen. Mehr Startgeld, aber viel zu roden.", geld: 85000 }
};
const MEILEN0 = [
  { name: "Siedlung", ab: 0, gebiete: 1, geld: 0, frei: ["gasse", "parkstr", "einbahn_klein", "radweg", "kies"] },
  { name: "Dorf", ab: 200, gebiete: 2, geld: 5000, frei: ["allee", "land"] },
  { name: "Kleinstadt", ab: 600, gebiete: 3, geld: 10000, frei: ["haupt", "haupt_rad", "haupt_bus", "haupt_gruen", "zone", "autobahn", "rampe", "einbahn_gross"] },
  { name: "Stadt", ab: 1500, gebiete: 5, geld: 15000, frei: ["gross", "boulevard", "haupt_tram"] },
  { name: "Großstadt", ab: 4000, gebiete: 8, geld: 25000, frei: ["gross_tram"] },
  { name: "Metropole", ab: 9000, gebiete: 13, geld: 40000, frei: [] },
  { name: "Weltstadt", ab: 20000, gebiete: 24, geld: 60000, frei: [] }
];
const MEILEN = MEILEN0;
const GEBIET_PREIS = (n) => 15000 + 10000 * n;
/* Fortschritt wie in Cities: Skylines 2: Erfahrungspunkte (XP), 20 Meilensteine, Entwicklungspunkte */
const MS = [["Siedlung", 0, 0, 0, 1, 0], ["Weiler", 120, 0, 3000, 1, 1], ["Dorf", 350, 1, 5000, 2, 1], ["Großes Dorf", 700, 1, 6000, 3, 1], ["Marktflecken", 1200, 1, 8000, 3, 1], ["Kleinstadt", 1900, 2, 10000, 4, 2], ["Landstadt", 2800, 2, 12000, 5, 1], ["Mittelstadt", 3900, 2, 14000, 6, 1], ["Kreisstadt", 5200, 2, 16000, 7, 1], ["Stadt", 6800, 3, 20000, 8, 2], ["Große Stadt", 8800, 3, 22000, 10, 1], ["Regionalzentrum", 11200, 3, 25000, 12, 1], ["Oberzentrum", 14000, 3, 28000, 14, 1], ["Großstadt", 17500, 4, 32000, 16, 2], ["Großstadt mit Flair", 21500, 4, 36000, 18, 1], ["Kulturstadt", 26000, 4, 40000, 21, 1], ["Metropole", 31500, 5, 45000, 24, 2], ["Wirtschaftsmetropole", 38000, 5, 50000, 28, 1], ["Weltstadt-Anwärter", 46000, 5, 55000, 32, 1], ["Weltstadt", 55000, 6, 60000, 40, 2], ["Megacity", 66000, 6, 80000, 49, 3]].map(([name, xp, stufe, geld, gebiete, ep]) => ({ name, xp, stufe, geld, gebiete, ep }));
const ENTW = {
  strom: { name: "Strom", em: "⚡", knoten: [["strom1", "Effizientere Kraftwerke", "+15 % Strom aus allen Kraftwerken", 1], ["strom2", "Stromspeicher", "+15 % Strom zusätzlich", 2]] },
  wasser: { name: "Wasser", em: "💧", knoten: [["wasser1", "Starke Pumpen", "+15 % Wasser", 1], ["wasser2", "Moderne Klärtechnik", "+20 % Abwasser-Leistung", 2]] },
  muell: { name: "Müll", em: "🗑️", knoten: [["muell1", "Größere Müllwagen", "+20 % Müllkapazität", 1], ["muell2", "Mülltrennung", "+15 % Müllkapazität zusätzlich", 2]] },
  polizei: { name: "Polizei", em: "🚓", knoten: [["polizei1", "Mehr Streifen", "+20 % Reichweite der Polizei", 1], ["polizei2", "Nachbarschaftshilfe", "Kriminalität wächst 30 % langsamer", 2]] },
  feuer: { name: "Feuerwehr", em: "🚒", knoten: [["feuer1", "Mehr Löschzüge", "+20 % Reichweite der Feuerwehr", 1], ["feuer2", "Rauchmelder", "Halb so viele Brände", 2]] },
  gesund: { name: "Gesundheit", em: "🏥", knoten: [["gesund1", "Mehr Rettungswagen", "+20 % Reichweite", 1], ["gesund2", "Sportvereine", "Krankheiten 30 % seltener", 2]] },
  bildung: { name: "Bildung", em: "🎓", knoten: [["bildung1", "Schulbusse", "+20 % Reichweite der Schulen", 1], ["bildung2", "Ganztagsschulen", "+25 % Plätze in Schulen", 2]] },
  verkehr: { name: "Verkehr", em: "🛣️", knoten: [["verkehr1", "Günstiger Straßenbau", "Straßen 15 % billiger", 1], ["verkehr2", "Effizienter Nahverkehr", "Busse und Bahnen 20 % billiger im Unterhalt", 2]] },
  wirtschaft: { name: "Wirtschaft", em: "💼", knoten: [["wirt1", "Wirtschaftsförderung", "Mehr Bedarf an Gewerbe und Büros", 1], ["wirt2", "Steuerbüro", "+5 % Steuereinnahmen", 2], ["wirt3", "Stadtmarketing", "Alle sind etwas zufriedener", 2]] }
};
MEILEN.forEach((m, i) => { const q = MS.find((x) => x.stufe === i); if (q) m.ab = q.xp; });
let xp = 0, ms = 0, maxEinw = 0, ep = 0, entw = new Set(), kredite = [], monatXp = 0;
const hatEntw = (id) => entw.has(id);
const gebieteErlaubt = () => MS[ms].gebiete;
const KREDIT_ARTEN = [{ betrag: 25000, zins: 0.05, wochen: 52 }, { betrag: 100000, zins: 0.06, wochen: 104 }, { betrag: 250000, zins: 0.07, wochen: 156 }];
const kreditRaten = () => kredite.reduce((a, k) => a + Math.min(k.rate, k.rest), 0);
function xpPlus(n) { if (n > 0) { xp += n; } }
const TAG_SEK = 12;   // ein Spieltag dauert bei ▶️ 12 Sekunden (ruhiger wie in Cities: Skylines 2)
const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const STUFEN = { niedrig: { name: "Niedrig", pr: 1, schatten: 0, autos: 45, leute: 30, details: 0 }, mittel: { name: "Mittel", pr: 1.5, schatten: 1024, autos: 90, leute: 60, details: 1 }, hoch: { name: "Hoch", pr: 2, schatten: 2048, autos: 150, leute: 100, details: 1 } };
let stufe = lade("inselstadt-qualitaet", null) || (Math.min(screen.width, screen.height) < 500 ? "mittel" : "hoch");
if (!STUFEN[stufe]) stufe = "mittel";

/* ---------- Renderer, Szene, Kamera ---------- */
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" }); }
catch (e) { $("fehler").style.display = "grid"; $("hauptmenue").hidden = true; throw e; }
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const szene = new THREE.Scene();
szene.fog = new THREE.Fog(0xbfe6ff, 90, 420);
const kamera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.25, 3000);
kamera.position.set(0.7, 1.05, 1).normalize().multiplyScalar(48 * Math.max(1, 0.8 / (innerWidth / innerHeight)));
const steuerung = new OrbitControls(kamera, renderer.domElement);
steuerung.enableDamping = true; steuerung.dampingFactor = 0.1; steuerung.screenSpacePanning = false;
steuerung.minDistance = 6; steuerung.maxDistance = 240; steuerung.minPolarAngle = 0.2; steuerung.maxPolarAngle = 1.25;
steuerung.zoomToCursor = true;
const kameraAbstand = () => kamera.position.distanceTo(steuerung.target);

const himmelLicht = new THREE.HemisphereLight(0xcfe9ff, 0x6b8f5a, 1.0);
const sonne = new THREE.DirectionalLight(0xfff4e0, 2.6);
sonne.shadow.camera.left = -42; sonne.shadow.camera.right = 42; sonne.shadow.camera.top = 42; sonne.shadow.camera.bottom = -42;
sonne.shadow.camera.near = 10; sonne.shadow.camera.far = 240; sonne.shadow.bias = -0.0006; sonne.shadow.normalBias = 0.03;
szene.add(himmelLicht, sonne, sonne.target);
const U = { uTime: { value: 0 }, uNacht: { value: 0 }, uDetail: { value: 1 } };

/* Himmel */
const himmel = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { uOben: { value: farbe(0x4aa3f0) }, uUnten: { value: farbe(0xbfe6ff) }, uSonne: { value: new THREE.Vector3(0, 1, 0) }, uSonnenFarbe: { value: farbe(0xfff0d0) }, uSicht: { value: 1 }, uNacht: U.uNacht },
  vertexShader: "varying vec3 vR; void main(){ vR = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }",
  fragmentShader: `uniform vec3 uOben, uUnten, uSonnenFarbe, uSonne; uniform float uSicht, uNacht; varying vec3 vR;
    float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
    void main(){ vec3 r = normalize(vR); float h = clamp(r.y * 1.4 + 0.08, 0.0, 1.0);
      vec3 c = mix(uUnten, uOben, pow(h, 0.75));
      float s = max(dot(r, normalize(uSonne)), 0.0);
      c += uSonnenFarbe * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.35) * uSicht;
      vec3 g = floor(r * 260.0); float st = step(0.9975, hash(g)) * uNacht * smoothstep(0.05, 0.4, r.y);
      c += vec3(st) * (0.6 + 0.4 * hash(g + 1.0));
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
}));
himmel.frustumCulled = false; himmel.renderOrder = -1; szene.add(himmel);

/* ---------- Materialien ---------- */
/* Fassaden: Fenster passen genau auf jede Wand (pro Haus ausgerichtet), je nach Baustil anders */
const ETAGE = 0.36, SOCKEL = 0.08;
const FASSADE = {
  haus: { px: 0.3, code: `
      win = bx(fx, 0.29, 0.71) * bx(fy, 0.22, 0.74); rah = bx(fx, 0.25, 0.75) * bx(fy, 0.18, 0.78) - win;
      bank = bx(fx, 0.23, 0.77) * bx(fy, 0.13, 0.18); kreuz = win * step(abs(fx - 0.5), 0.022);` },
  altbau: { px: 0.34, code: `
      win = bx(fx, 0.32, 0.68) * bx(fy, 0.15, 0.79); rah = bx(fx, 0.28, 0.72) * bx(fy, 0.12, 0.82) - win;
      bank = bx(fx, 0.26, 0.74) * bx(fy, 0.08, 0.12) + bx(fx, 0.27, 0.73) * bx(fy, 0.84, 0.92);
      kreuz = win * max(step(abs(fx - 0.5), 0.02), step(abs(fy - 0.62), 0.02));
      band = (step(fy, 0.035) + step(0.965, fy)) * step(1.0, fi);
      rust = (1.0 - step(1.0, fl)) * step(fract(yy / 0.055), 0.14) * (1.0 - win - rah);` },
  buero: { px: 0.3, code: `
      win = bx(fy, 0.3, 0.88); kreuz = win * step(fract(hk / 0.15), 0.07); rah = bx(fy, 0.26, 0.92) - win; bank = 0.0;` },
  glas: { px: 0.3, code: `
      win = 1.0 - step(fy, 0.07); kreuz = win * step(fract(hk / 0.16), 0.045); rah = 0.0; bank = step(fy, 0.07) * 0.6; glas = 1.0;` },
  laden: { px: 0.55, code: `
      if (fi < 0.5) { win = bx(fx, 0.04, 0.96) * bx(fy, 0.08, 0.76); rah = bx(fx, 0.02, 0.98) * bx(fy, 0.05, 0.79) - win; kreuz = win * step(abs(fx - 0.5), 0.012); bank = step(0.82, fy) * 0.0; schaufenster = 1.0; }
      else { win = bx(fx, 0.3, 0.7) * bx(fy, 0.22, 0.74); rah = bx(fx, 0.26, 0.74) * bx(fy, 0.18, 0.78) - win; bank = 0.0; kreuz = win * step(abs(fx - 0.5), 0.022); }` },
  fachwerk: { px: 0.3, code: `
      win = bx(fx, 0.34, 0.66) * bx(fy, 0.3, 0.7); rah = bx(fx, 0.31, 0.69) * bx(fy, 0.27, 0.73) - win; bank = 0.0; kreuz = win * max(step(abs(fx - 0.5), 0.03), step(abs(fy - 0.5), 0.03));
      float pf = max(step(fx, 0.07), step(0.93, fx)) + max(step(fy, 0.08), step(0.92, fy));
      float sk = (1.0 - bx(fx, 0.28, 0.72) * bx(fy, 0.22, 0.78)) * step(0.45, id) * max(step(abs(fx - fy), 0.06), step(abs(fx - 1.0 + fy), 0.06));
      balken = clamp(pf + sk, 0.0, 1.0) * (1.0 - win - rah);` },
  holz: { px: 0.32, code: `
      win = bx(fx, 0.3, 0.7) * bx(fy, 0.2, 0.74); rah = bx(fx, 0.25, 0.75) * bx(fy, 0.15, 0.79) - win; bank = 0.0; kreuz = win * max(step(abs(fx - 0.5), 0.025), step(abs(fy - 0.47), 0.025));
      bretter = step(fract(hk / 0.045), 0.12) * (1.0 - win - rah);` }
};
function mitFenstern(mat, art) {
  art = art || "haus"; const F = FASSADE[art];
  mat.onBeforeCompile = (s) => {
    s.uniforms.uNacht = U.uNacht; s.uniforms.uDetail = U.uDetail;
    s.vertexShader = "varying vec3 vWP; varying vec3 vWN; varying vec2 vIX; varying float vIY; varying float vBr; varying float vH;\n" + s.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vWP = (instanceMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(instanceMatrix) * objectNormal);
        vIX = instanceMatrix[3].xz; vIY = instanceMatrix[3].y; vH = length(instanceMatrix[1].xyz);
        { vec3 ax = instanceMatrix[0].xyz, az = instanceMatrix[2].xyz; vec2 tg = vec2(-vWN.z, vWN.x); vBr = abs(dot(normalize(ax.xz + vec2(1e-6)), normalize(tg + vec2(1e-6)))) > 0.5 ? length(ax) : length(az); }
      #else
        vWP = transformed; vWN = objectNormal; vIX = vec2(0.0); vIY = 0.0; vBr = 1.0; vH = 1.0;
      #endif`);
    s.fragmentShader = "uniform float uNacht; uniform float uDetail; varying vec3 vWP; varying vec3 vWN; varying vec2 vIX; varying float vIY; varying float vBr; varying float vH;\nfloat bx(float v, float a, float b) { return step(a, v) * step(v, b); }\n" + s.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      {
        float seite = 1.0 - step(0.5, abs(vWN.y));
        vec2 nx = normalize(vWN.xz + vec2(1e-5)), tg = vec2(-nx.y, nx.x);
        float hk = dot(vWP.xz - vIX, tg) + vBr * 0.5, yy = vWP.y - vIY;
        float nF = max(1.0, floor((vH - 0.05) / ${ETAGE.toFixed(3)}));
        float fl = (yy - ${SOCKEL.toFixed(3)}) / ${ETAGE.toFixed(3)}, fi = floor(fl), fy = fract(fl);
        float nX = max(1.0, floor(vBr / ${F.px.toFixed(3)} + 0.5)), cx = clamp(hk, 0.0, vBr) / vBr * nX, fx = fract(cx), ci = floor(cx);
        float id = fract(sin(dot(vec3(ci, fi, vIX.x * 1.37 + vIX.y * 2.11 + vIY), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float stock = step(0.0, fl) * step(fi, nF - 1.0) * seite * step(0.04, hk) * step(hk, vBr - 0.04);
        float win = 0.0, rah = 0.0, bank = 0.0, kreuz = 0.0, band = 0.0, rust = 0.0, balken = 0.0, bretter = 0.0, glas = 0.0, schaufenster = 0.0;
        ${F.code}
        win *= stock; rah *= stock; bank *= stock; kreuz *= uDetail; band *= seite; rust *= seite; balken *= stock; bretter *= seite;
        vec3 c0 = diffuseColor.rgb;
        float n = fract(sin(dot(floor(vWP * 70.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        diffuseColor.rgb *= mix(1.0, 0.95 + 0.08 * n, uDetail);
        float ziegel = step(c0.g * 1.15, c0.r) * step(c0.b * 1.25, c0.r) * seite * (1.0 - glas)${["holz", "fachwerk", "buero"].includes(art) ? " * 0.0" : ""};
        vec2 zq = vec2((hk + step(1.0, mod(floor(yy / 0.034), 2.0)) * 0.04) / 0.08, yy / 0.034);
        float fuge = max(step(fract(zq.x), 0.08), step(fract(zq.y), 0.14));
        float zb = fract(sin(dot(floor(zq), vec2(7.13, 3.71))) * 43758.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(c0 * (0.82 + 0.26 * zb), vec3(0.8, 0.78, 0.74), fuge), ziegel * uDetail * (1.0 - win - rah) * 0.9);
        vec3 hell = mix(c0, vec3(0.97, 0.96, 0.93), 0.55);
        diffuseColor.rgb = mix(diffuseColor.rgb, hell, clamp(band * 0.7 + bank * 0.85, 0.0, 1.0) * uDetail);
        diffuseColor.rgb *= 1.0 - rust * 0.18 * uDetail - bretter * 0.22 * uDetail;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.33, 0.22, 0.14), balken);
        float sockel = (1.0 - step(${SOCKEL.toFixed(3)}, yy)) * seite * uDetail * (1.0 - glas);
        diffuseColor.rgb *= 1.0 - sockel * 0.28;
        vec3 rahmenFarbe = glas > 0.5 ? c0 * 0.55 : schaufenster > 0.5 ? vec3(0.2, 0.22, 0.25) : vec3(0.95, 0.94, 0.91);
        diffuseColor.rgb = mix(diffuseColor.rgb, rahmenFarbe, clamp(rah * 0.85 + kreuz, 0.0, 1.0));
        float an = step(0.58, id) * uNacht;
        vec3 V = normalize(cameraPosition - vWP); float fres = pow(1.0 - max(dot(normalize(vWN), V), 0.0), 3.0);
        vec3 himmelRefl = mix(vec3(0.42, 0.55, 0.68), vec3(0.78, 0.88, 0.97), clamp(fy * 0.7 + fres, 0.0, 1.0));
        vec3 gl = glas > 0.5 ? mix(c0 * 0.62, himmelRefl, 0.38 + 0.3 * fres) : mix(vec3(0.14, 0.19, 0.26), himmelRefl * 0.8, (0.25 + 0.45 * fres) * uDetail);
        if (schaufenster > 0.5) gl = mix(gl, vec3(0.55, 0.5, 0.42), 0.35);
        float w = win * (1.0 - kreuz);
        diffuseColor.rgb = mix(diffuseColor.rgb, gl, w * (1.0 - an * 0.85));
        roughnessFactor = mix(roughnessFactor, 0.16, w); metalnessFactor = mix(metalnessFactor, 0.1, w);
        totalEmissiveRadiance += w * an * mix(vec3(1.0, 0.66, 0.32), vec3(0.75, 0.85, 1.0), step(0.93, id) + glas * 0.6) * (0.7 + 0.35 * fract(id * 7.0)) + w * schaufenster * uNacht * vec3(1.0, 0.8, 0.5) * 0.9;
      }`);
  };
  mat.customProgramCacheKey = () => "fassade-" + art;
  return mat;
}
function mitMuster(mat, art) {
  mat.onBeforeCompile = (s) => {
    s.uniforms.uDetail = U.uDetail;
    s.vertexShader = "varying vec3 vWP; varying vec3 vWN;\n" + s.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vWP = (instanceMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(instanceMatrix) * objectNormal);
      #else
        vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = objectNormal;
      #endif`);
    const code = {
      dach: `float r = vWP.y / 0.038; float fr = fract(r); vec2 nx = normalize(vWN.xz + vec2(1e-5)); float hk = dot(vWP.xz, vec2(-nx.y, nx.x));
        float sp = fract((hk + step(1.0, mod(floor(r), 2.0)) * 0.03) / 0.06); float schraeg = step(0.12, abs(vWN.y)) * (1.0 - step(0.98, abs(vWN.y)));
        float z = fract(sin(dot(floor(vec2(hk / 0.06, r)), vec2(12.9898, 78.233))) * 43758.5453);
        diffuseColor.rgb *= mix(1.0, (0.82 + 0.18 * smoothstep(0.0, 0.35, fr)) * (1.0 - 0.08 * step(sp, 0.08)) * (0.94 + 0.1 * z), schraeg * uDetail);`,
      strasse: `vec3 c = diffuseColor.rgb; float L = dot(c, vec3(0.33)); float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
        float n = fract(sin(dot(floor(vWP.xz * 60.0), vec2(12.9898, 78.233))) * 43758.5453), m = sin(vWP.x * 0.9) * sin(vWP.z * 0.7);
        float asph = 1.0 - step(0.3, L); float geh = step(0.55, L) * (1.0 - step(0.9, L)) * (1.0 - step(0.12, sat));
        vec2 pl = fract(vWP.xz / 0.2); float platte = max(step(pl.x, 0.05), step(pl.y, 0.05));
        diffuseColor.rgb *= mix(1.0, 1.0 + (n - 0.5) * 0.12 * asph + m * 0.04 * asph - platte * 0.1 * geh + (n - 0.5) * 0.05 * geh, uDetail);`,
      wiese: `float n = fract(sin(dot(floor(vWP.xz * 18.0), vec2(12.9898, 78.233))) * 43758.5453);
        float m = sin(vWP.x * 0.21 + sin(vWP.z * 0.13) * 2.0) * sin(vWP.z * 0.17 + 1.3) * 0.5 + sin(vWP.x * 0.9) * sin(vWP.z * 1.1) * 0.2;
        float gras = step(0.15, vWP.y + 0.4) * step(diffuseColor.b * 1.2, diffuseColor.g);
        diffuseColor.rgb *= mix(1.0, 1.0 + (m * 0.09 + (n - 0.5) * 0.06) * gras, uDetail);`
    }[art];
    s.fragmentShader = "uniform float uDetail; varying vec3 vWP; varying vec3 vWN;\n" + s.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n{" + code + "}");
  };
  mat.customProgramCacheKey = () => "muster-" + art;
  return mat;
}
function mitWind(mat) {
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTime = U.uTime;
    s.vertexShader = "uniform float uTime;\n" + s.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float wi = sin(uTime * 1.5 + instanceMatrix[3].x * 0.8 + instanceMatrix[3].z * 0.6) * 0.06 + sin(uTime * 3.1 + instanceMatrix[3].z) * 0.015;
        transformed.x += wi * max(transformed.y - 0.3, 0.0); transformed.z += wi * 0.5 * max(transformed.y - 0.3, 0.0);
      #endif`);
  };
  mat.customProgramCacheKey = () => "wind";
  return mat;
}
const M = {
  gelaende: mitMuster(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), "wiese"),
  wiese: new THREE.MeshStandardMaterial({ color: 0x86c45c, roughness: 1 }),
  strasse: mitMuster(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), "strasse"),
  flach: new THREE.MeshStandardMaterial({ roughness: 0.92 }),
  haus: mitFenstern(new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.02 })),
  dach: mitMuster(new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true, side: THREE.DoubleSide }), "dach"),
  baum: mitWind(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 })),
  auto: new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.3 }),
  leuchte: new THREE.MeshBasicMaterial({ toneMapped: false }),
  zelle: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false }),
  vorschau: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false, toneMapped: false }),
  stau: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }),
  rauch: new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false }),
  sperre: new THREE.MeshBasicMaterial({ color: 0x0a0d1a, transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false }),
  mensch: new THREE.MeshStandardMaterial({ roughness: 0.8 })
};
const G_BOX = new THREE.BoxGeometry(1, 1, 1);
const G_BOX_UNTEN = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const G_ZYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 12).translate(0, 0.5, 0);
const G_DACH = (function () {
  const p = [-.5, 0, .5, .5, 0, .5, .5, 1, 0, -.5, 0, .5, .5, 1, 0, -.5, 1, 0, .5, 0, -.5, -.5, 0, -.5, -.5, 1, 0, .5, 0, -.5, -.5, 1, 0, .5, 1, 0, -.5, 0, -.5, -.5, 0, .5, -.5, 1, 0, .5, 0, .5, .5, 0, -.5, .5, 1, 0];
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return g;
})();
function dreiecke(p) { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return g; }
const quad = (a, b, c, d) => [...a, ...b, ...c, ...a, ...c, ...d];
const G_WALM = dreiecke([...quad([-.5, 0, .5], [.5, 0, .5], [.2, 1, 0], [-.2, 1, 0]), ...quad([.5, 0, -.5], [-.5, 0, -.5], [-.2, 1, 0], [.2, 1, 0]), .5, 0, .5, .5, 0, -.5, .2, 1, 0, -.5, 0, -.5, -.5, 0, .5, -.2, 1, 0]);
const G_ZELT = dreiecke([-.5, 0, .5, .5, 0, .5, 0, 1, 0, .5, 0, .5, .5, 0, -.5, 0, 1, 0, .5, 0, -.5, -.5, 0, -.5, 0, 1, 0, -.5, 0, -.5, -.5, 0, .5, 0, 1, 0]);
const G_PULT = dreiecke([...quad([-.5, 0, .5], [.5, 0, .5], [.5, 1, -.5], [-.5, 1, -.5]), ...quad([.5, 0, -.5], [-.5, 0, -.5], [-.5, 1, -.5], [.5, 1, -.5]), .5, 0, .5, .5, 0, -.5, .5, 1, -.5, -.5, 0, -.5, -.5, 0, .5, -.5, 1, -.5]);
const G_MANSARD = (function () {
  const pr = [[.5, 0], [.4, .68], [.16, 1], [-.16, 1], [-.4, .68], [-.5, 0]], p = [];
  for (let i = 0; i < pr.length - 1; i++) { const [z0, y0] = pr[i], [z1, y1] = pr[i + 1]; p.push(...quad([-.5, y0, z0], [.5, y0, z0], [.5, y1, z1], [-.5, y1, z1])); }
  for (const x of [-.5, .5]) for (let i = 0; i < pr.length - 1; i++) p.push(x, 0, 0, x, pr[i][1], pr[i][0], x, pr[i + 1][1], pr[i + 1][0]);
  return dreiecke(p);
})();
function bunt(g, hex) { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute("uv"); const c = farbe(hex), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } g.setAttribute("color", new THREE.BufferAttribute(a, 3)); return g; }
const G_LAUBBAUM = mergeGeometries([bunt(new THREE.CylinderGeometry(0.05, 0.07, 0.4, 5).translate(0, 0.2, 0), 0x7a5232), bunt(new THREE.IcosahedronGeometry(0.34, 0).scale(1, 1.1, 1).translate(0, 0.62, 0), 0x5fae4a)]);
const G_BIRKE = mergeGeometries([bunt(new THREE.CylinderGeometry(0.03, 0.045, 0.62, 5).translate(0, 0.31, 0), 0xe8e4dc), bunt(new THREE.IcosahedronGeometry(0.26, 0).scale(0.85, 1.35, 0.85).translate(0, 0.78, 0), 0x8cc65a)]);
const G_PAPPEL = mergeGeometries([bunt(new THREE.CylinderGeometry(0.04, 0.06, 0.35, 5).translate(0, 0.17, 0), 0x6e4a2c), bunt(new THREE.IcosahedronGeometry(0.22, 1).scale(0.75, 2.6, 0.75).translate(0, 0.85, 0), 0x4f9a3f)]);
const G_KUGELBAUM = mergeGeometries([bunt(new THREE.CylinderGeometry(0.045, 0.06, 0.42, 5).translate(0, 0.21, 0), 0x7a5232), bunt(new THREE.IcosahedronGeometry(0.33, 1).translate(0, 0.66, 0), 0x3f8f3a)]);
const G_NADELBAUM = mergeGeometries([bunt(new THREE.CylinderGeometry(0.045, 0.06, 0.3, 5).translate(0, 0.15, 0), 0x6e4a2c), bunt(new THREE.ConeGeometry(0.3, 0.7, 6).translate(0, 0.6, 0), 0x3f8a4e), bunt(new THREE.ConeGeometry(0.21, 0.5, 6).translate(0, 0.95, 0), 0x47995a)]);
const glanzTextur = (function () {
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,230,180,1)"); g.addColorStop(0.25, "rgba(255,200,120,.55)"); g.addColorStop(1, "rgba(255,180,90,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
function becken(geo, mat, max, schatten) {
  const m = new THREE.InstancedMesh(geo, mat, max); m.count = 0; m.frustumCulled = false; m.castShadow = !!schatten; m.receiveShadow = true;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, new THREE.Color(1, 1, 1)); szene.add(m); return m;
}
const _o = new THREE.Object3D(), _farbe = new THREE.Color();

/* ================================================================
   Karten: Gelände, Wasser, Bäume
   ================================================================ */
let karte = "insel", abstand = () => 100;   // Abstand zum Wasser (positiv = Land)
const aufLand = (x, z, rand) => abstand(x, z) > rand;
let insel = null, leuchtturm = null;
const boote = [], baeume = [], baumRaster = new Map(), baumMesh = {};

function kartenFunktion(typ) {
  if (typ === "insel") {
    const ri = zufall(20261028);
    insel = { a0: grossKarte ? 116 : 86, h: [[2, 6 + ri() * 3, ri() * 6.283], [3, 4 + ri() * 3, ri() * 6.283], [5, 2.5 + ri() * 2, ri() * 6.283], [7, 1.5 + ri() * 1.5, ri() * 6.283], [11, 0.8 + ri(), ri() * 6.283]] };
    const radius = (th) => { let r = insel.a0; for (const [k, a, p] of insel.h) r += a * Math.sin(k * th + p); return r; };
    insel.radius = radius;
    return (x, z) => radius(Math.atan2(z, x)) - Math.hypot(x, z);
  }
  if (typ === "kueste") {
    const r = zufall(7331), p = [r() * 6.3, r() * 6.3, r() * 6.3], bx = 46;
    const linie = (x) => 46 + 10 * Math.sin(0.031 * x + p[0]) + 5 * Math.sin(0.083 * x + p[1]) + 2.5 * Math.sin(0.17 * x + p[2]) - 36 * Math.exp(-Math.pow((x - bx) / 17, 2));
    const halbinsel = (x, z) => 9 - Math.hypot((x + 55) * 0.8, z - 70);   // kleine Landzunge
    return (x, z) => Math.max(linie(x) - z, halbinsel(x, z));
  }
  const r = zufall(typ === "seen" ? 4242 : 9191), seen = [];
  const anzahl = typ === "seen" ? 9 : 3;
  for (let i = 0; seen.length < anzahl && i < 400; i++) {
    const a = r() * 6.283, d = 34 + r() * 72, x = Math.cos(a) * d, z = Math.sin(a) * d, rad = typ === "seen" ? 7 + r() * 11 : 10 + r() * 9;
    if (Math.max(Math.abs(x), Math.abs(z)) - rad < 26) continue;
    if (seen.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + rad + 8)) continue;
    seen.push({ x, z, r: rad, w: [r() * 6.3, r() * 6.3, 0.12 + r() * 0.12] });
  }
  if (grossKarte) { const r2 = zufall(typ === "seen" ? 777 : 778), ziel = seen.length + (typ === "seen" ? 6 : 3); for (let i = 0; seen.length < ziel && i < 400; i++) { const a = r2() * 6.283, d = 118 + r2() * 40, x = Math.cos(a) * d, z = Math.sin(a) * d, rad = 8 + r2() * 10; if (Math.abs(x) < 30 || Math.abs(z) < 30) continue; if (seen.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + rad + 8)) continue; seen.push({ x, z, r: rad, w: [r2() * 6.3, r2() * 6.3, 0.12 + r2() * 0.12] }); } }
  return (x, z) => {
    let m = 60;
    for (const s of seen) { const th = Math.atan2(z - s.z, x - s.x), rr = s.r * (1 + s.w[2] * Math.sin(3 * th + s.w[0]) + 0.08 * Math.sin(5 * th + s.w[1])); m = Math.min(m, Math.hypot(x - s.x, z - s.z) - rr); }
    return m;
  };
}
function gelaendeBauen() {
  const n = 300, g = new THREE.PlaneGeometry(FELD, FELD, n, n).rotateX(-Math.PI / 2), pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  const gras = farbe(0x86c45c), gras2 = farbe(0x79b852), sand = farbe(0xe8d39a), nass = farbe(0xb8a77a), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), d = abstand(x, z);
    let y; if (d >= 2.8) y = G; else if (d >= -2.5) y = -0.9 + (G + 0.9) * glatt(0, 1, (d + 2.5) / 5.3); else y = -0.9 - Math.min(3, (-2.5 - d) * 0.35);
    pos.setY(i, y);
    if (d >= 3.1) c.copy(gras).lerp(gras2, 0.5 + 0.5 * Math.sin(x * 0.11 + Math.cos(z * 0.09) * 2));
    else if (d >= 0.2) c.copy(sand); else c.copy(nass);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, M.gelaende); m.receiveShadow = true; szene.add(m);
  // Land außerhalb des Geländes (bei Festland-Karten)
  const rand = (x0, x1, z0, z1) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), M.wiese); p.position.set((x0 + x1) / 2, G - 0.002, (z0 + z1) / 2); szene.add(p); };
  const H = FELD / 2;
  if (karte === "kueste") { const zl = Math.min(abstandZ(-H), abstandZ(H)); rand(-3000, -H, -3000, zl); rand(H, 3000, -3000, zl); rand(-H, H, -3000, -H); }
  else if (karte !== "insel") { rand(-3000, -H, -3000, 3000); rand(H, 3000, -3000, 3000); rand(-H, H, -3000, -H); rand(-H, H, H, 3000); }
}
function abstandZ(x) { let z = -200; while (z < 200 && abstand(x, z) > 0) z += 2; return z - 4; }   // Küstenlinie am Rand (für den Randstreifen)

/* Wasser mit Abstands-Textur (Ufer, Schaum, flaches Wasser) */
const wasserMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: U.uTime, uNacht: U.uNacht, uTief: { value: farbe(0x1667a3) }, uFlach: { value: farbe(0x3cc9c4) }, uHimmel: { value: farbe(0xbfe6ff) },
    uSonne: { value: new THREE.Vector3(0, 1, 0) }, uSonnenFarbe: { value: farbe(0xffffff) }, uNebel: { value: farbe(0xbfe6ff) }, uNah: { value: 90 }, uFern: { value: 420 },
    uAbst: { value: null }, uFeld: { value: FELD }
  },
  vertexShader: `uniform float uTime; varying vec3 vW;
    void main(){ vec4 w = modelMatrix * vec4(position, 1.0);
      w.y += sin(w.x * 0.33 + uTime * 1.1) * 0.06 + sin(w.z * 0.27 - uTime * 0.9) * 0.05 + sin((w.x + w.z) * 0.6 + uTime * 1.7) * 0.025;
      vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform float uTime, uNacht, uNah, uFern, uFeld; uniform sampler2D uAbst; uniform vec3 uTief, uFlach, uHimmel, uSonne, uSonnenFarbe, uNebel; varying vec3 vW;
    void main(){
      vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); if (n.y < 0.0) n = -n;
      n = normalize(n + vec3(sin(vW.x * 2.1 + uTime * 2.0) * 0.035 + sin(vW.z * 4.7 + uTime * 3.0) * 0.02, 0.0, cos(vW.z * 2.3 - uTime * 1.7) * 0.035 + cos(vW.x * 5.1 - uTime * 2.6) * 0.02));
      vec3 V = normalize(cameraPosition - vW);
      vec2 uv = vW.xz / uFeld + 0.5;
      float d = (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) ? -24.0 : texture2D(uAbst, uv).r * 48.0 - 24.0;
      vec3 c = mix(uTief, uFlach, 1.0 - smoothstep(0.0, 13.0, -d));
      c = mix(c, uHimmel, pow(1.0 - max(dot(n, V), 0.0), 4.0) * 0.65);
      vec3 H = normalize(normalize(uSonne) + V);
      c += uSonnenFarbe * pow(max(dot(n, H), 0.0), 240.0) * 1.6;
      float schaum = smoothstep(0.55, 0.0, abs(d + 0.1 - 0.22 * sin(uTime * 1.4 + (vW.x + vW.z) * 0.9)));
      c = mix(c, vec3(0.92), schaum * 0.7 * (1.0 - uNacht * 0.65));
      c = mix(c, uNebel, smoothstep(uNah, uFern, length(cameraPosition - vW)));
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
});
const wasser = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400, 300, 300).rotateX(-Math.PI / 2), wasserMat);
wasser.position.y = WASSER; szene.add(wasser);
function wasserTextur() {
  const N = 256, daten = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = -FELD / 2 + (i + 0.5) * FELD / N, z = -FELD / 2 + (j + 0.5) * FELD / N; daten[j * N + i] = Math.round(klemme((abstand(x, z) + 24) / 48, 0, 1) * 255); }
  const t = new THREE.DataTexture(daten, N, N, THREE.RedFormat, THREE.UnsignedByteType); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  wasserMat.uniforms.uAbst.value = t;
}
function baeumeBauen() {
  const listen = { laub: [], nadel: [], birke: [], pappel: [], kugel: [] };
  const neu = (x, z, r) => {
    let art = r() < (karte === "wald" ? 0.5 : 0.34) ? "nadel" : "laub"; if (art === "laub") { const q = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1; art = q < 0.14 ? "birke" : q < 0.24 ? "pappel" : q < 0.38 ? "kugel" : "laub"; } const b = { x, z, s: 0.7 + r() * 0.75, ry: r() * 6.28, art, weg: false, c: new THREE.Color(0.82 + r() * 0.18, 0.85 + r() * 0.15, 0.8 + r() * 0.2) };
    b.idx = baeume.length; b.i = listen[art].length; listen[art].push(b); baeume.push(b);
    const k = Math.floor(x / 4) + "," + Math.floor(z / 4); if (!baumRaster.has(k)) baumRaster.set(k, []); baumRaster.get(k).push(b);
  };
  if (karte === "insel") {
    // genau wie in Teil A, damit alte Spielstände passen
    const r = zufall(20261028 + 1);
    for (let gx = -ALT_HALB; gx < ALT_HALB; gx += 1.5) for (let gz = -ALT_HALB; gz < ALT_HALB; gz += 1.5) {
      const x = gx + r() * 1.4, z = gz + r() * 1.4; if (!aufLand(x, z, 3.6)) continue;
      const d = 0.5 + 0.5 * Math.sin(x * 0.07 + 1.3) * Math.cos(z * 0.06 - 0.4) + 0.3 * Math.sin((x - z) * 0.13) + 0.15 * Math.sin(x * 0.4 + z * 0.31);
      if (r() > d * 0.85 - 0.12) continue;
      if (Math.abs(x) < 9 && Math.abs(z) < 9 && r() < 0.85) continue;
      neu(x, z, r);
    }
    if (grossKarte) { const r2 = zufall(20261029); for (let gx = -150; gx < 150; gx += 1.6) for (let gz = -150; gz < 150; gz += 1.6) { if (Math.abs(gx) < ALT_HALB && Math.abs(gz) < ALT_HALB) continue; const x = gx + r2() * 1.4, z = gz + r2() * 1.4; if (!aufLand(x, z, 3.6)) continue; const d = 0.5 + 0.5 * Math.sin(x * 0.07 + 1.3) * Math.cos(z * 0.06 - 0.4) + 0.3 * Math.sin((x - z) * 0.13); if (r2() > d * 0.85 - 0.12) continue; neu(x, z, r2); } }
  } else {
    const r = zufall(karte === "kueste" ? 501 : karte === "seen" ? 502 : 503), dicht = karte === "wald" ? 1.1 : karte === "seen" ? 0.68 : 0.8, schritt = karte === "wald" ? 1.7 : 1.7;
    for (let gx = -ALT_HALB - 20; gx < ALT_HALB + 20; gx += schritt) for (let gz = -ALT_HALB - 20; gz < ALT_HALB + 20; gz += schritt) {
      const x = gx + r() * schritt * 0.9, z = gz + r() * schritt * 0.9; if (!aufLand(x, z, 3.4)) continue;
      const d = 0.5 + 0.5 * Math.sin(x * 0.06 + 0.7) * Math.cos(z * 0.07 + 1.1) + 0.3 * Math.sin((x + z) * 0.11) + 0.15 * Math.sin(x * 0.37 - z * 0.29);
      if (r() > d * dicht - 0.15) continue;
      if (Math.abs(x) < 9 && Math.abs(z) < 9 && r() < (karte === "wald" ? 0.5 : 0.85)) continue;
      neu(x, z, r);
    }
    // lichter Wald am Horizont
    for (let gx = -190; gx < 190; gx += 4.5) for (let gz = -190; gz < 190; gz += 4.5) {
      if (Math.abs(gx) < ALT_HALB + 20 && Math.abs(gz) < ALT_HALB + 20) continue;
      const x = gx + r() * 4, z = gz + r() * 4; if (!aufLand(x, z, 3) || r() > (Math.max(Math.abs(gx), Math.abs(gz)) < HALB ? 0.62 : 0.38)) continue; neu(x, z, r);
    }
  }
  for (const art of Object.keys(listen)) {
    const m = new THREE.InstancedMesh({ laub: G_LAUBBAUM, nadel: G_NADELBAUM, birke: G_BIRKE, pappel: G_PAPPEL, kugel: G_KUGELBAUM }[art], M.baum, Math.max(1, listen[art].length));
    m.castShadow = stufe === "hoch"; m.receiveShadow = true; m.frustumCulled = false; baumMesh[art] = m; szene.add(m);
    listen[art].forEach((b) => { baumSetzen(b); m.setColorAt(b.i, b.c); });
  }
}
function baumSetzen(b) {
  const s = b.weg ? 0.0001 : b.s; _o.position.set(b.x, G, b.z); _o.rotation.set(0, b.ry, 0); _o.scale.set(s, s, s); _o.updateMatrix();
  baumMesh[b.art].setMatrixAt(b.i, _o.matrix); baumMesh[b.art].instanceMatrix.needsUpdate = true;
}
function baeumeIn(x0, z0, x1, z1, f) { for (let i = Math.floor(x0 / 4); i <= Math.floor(x1 / 4); i++) for (let j = Math.floor(z0 / 4); j <= Math.floor(z1 / 4); j++) { const l = baumRaster.get(i + "," + j); if (l) l.forEach(f); } }
function baeumeFaellen(h, test) { let n = 0; baeumeIn(h.x0, h.z0, h.x1, h.z1, (b) => { if (!b.weg && test(b.x, b.z)) { b.weg = true; baumSetzen(b); n++; } }); return n; }
function leuchtturmUndBoote() {
  let best = null;
  if (karte === "insel") { let bt = 0, br = 0; for (let t = 0; t < 180; t++) { const th = t / 180 * Math.PI * 2, R = insel.radius(th); if (R > br) { br = R; bt = th; } } best = { x: Math.cos(bt) * (br - 0.8), z: Math.sin(bt) * (br - 0.8) }; }
  if (karte === "kueste") best = { x: -55, z: 77 };
  if (best) {
    leuchtturm = new THREE.Group(); leuchtturm.position.set(best.x, 0, best.z); leuchtturm.scale.setScalar(1.6);
    const weiss = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.7 }), rot = new THREE.MeshStandardMaterial({ color: 0xd2433a, roughness: 0.7 });
    const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.55, 3.2, 12), weiss); t1.position.y = 1.6;
    const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.5, 0.45, 12), rot); b1.position.y = 1.0;
    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.43, 0.45, 12), rot); b2.position.y = 2.4;
    const kopf = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.45, 10), new THREE.MeshBasicMaterial({ color: 0xfff1c2, toneMapped: false })); kopf.position.y = 3.45;
    const hut = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.5, 10), rot); hut.position.y = 3.92;
    [t1, b1, b2, hut].forEach((m) => { m.castShadow = true; });
    const strahl = new THREE.Group(); strahl.position.y = 3.45;
    const sg = new THREE.ConeGeometry(1.6, 22, 20, 1, true).translate(0, -11, 0).rotateZ(Math.PI / 2);
    const sm = new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    strahl.add(new THREE.Mesh(sg, sm)); const s2 = new THREE.Mesh(sg, sm); s2.rotation.y = Math.PI; strahl.add(s2);
    leuchtturm.add(t1, b1, b2, kopf, hut, strahl); leuchtturm.userData = { strahl, sm, kopf }; szene.add(leuchtturm);
  }
  const r = zufall(77), anzahl = karte === "seen" ? 5 : karte === "wald" ? 2 : 7;
  for (let v = 0; v < 600 && boote.length < anzahl; v++) {
    const x = (r() - 0.5) * 340, z = (r() - 0.5) * 340, rad = karte === "seen" || karte === "wald" ? 2.5 + r() * 3 : 10 + r() * 18;
    let ok = abstand(x, z) < -(rad + 3); for (let k = 0; k < 12 && ok; k++) { const a = k / 12 * 6.283; if (abstand(x + Math.cos(a) * rad, z + Math.sin(a) * rad) > -3) ok = false; }
    if (!ok) continue;
    const g = new THREE.Group(), fr = wahl(r, [0xffffff, 0xf2c14e, 0xe8493f, 0x3f7fe8]);
    const rumpf = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 0.5), new THREE.MeshStandardMaterial({ color: fr, roughness: 0.5 })); rumpf.position.y = 0.1;
    const kab = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.38), new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.5 })); kab.position.set(-0.1, 0.38, 0);
    rumpf.castShadow = kab.castShadow = true; g.add(rumpf, kab); g.scale.setScalar(rad < 6 ? 0.9 : 1.4); szene.add(g);
    boote.push({ g, mx: x, mz: z, rad, w: r() * 6.28, v: (0.25 / rad + 0.01) * (r() < 0.5 ? 1 : -1), ph: r() * 6 });
  }
}
function weltBauen(typ) {
  karte = typ; abstand = kartenFunktion(typ);
  gelaendeBauen(); wasserTextur(); baeumeBauen(); leuchtturmUndBoote();
}

/* ================================================================
   Gebiete (5 × 5)
   ================================================================ */
const START_KACHEL = Math.floor(KN / 2) + "," + Math.floor(KN / 2);
let besitz = new Set([START_KACHEL]), gekauft = 0, geld = 70000;
const kachelVon = (x, z) => [Math.floor((x + HALB) / KACHEL), Math.floor((z + HALB) / KACHEL)];
const imBesitz = (x, z) => { const [i, j] = kachelVon(x, z); return besitz.has(i + "," + j); };
const kachelMitte = (i, j) => ({ x: -HALB + (i + 0.5) * KACHEL, z: -HALB + (j + 0.5) * KACHEL });
function kachelHatLand(i, j) { const m = kachelMitte(i, j); for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (aufLand(m.x + a * 8, m.z + b * 8, 4)) return true; return false; }
function nachbar(i, j) { return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => besitz.has((i + a) + "," + (j + b))); }
function kaufbar(i, j) { return i >= 0 && j >= 0 && i < KN && j < KN && !besitz.has(i + "," + j) && kachelHatLand(i, j) && nachbar(i, j); }
const grenze = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 1.2, gapSize: 0.8, transparent: true, opacity: 0.75, depthWrite: false }));
grenze.renderOrder = 5; szene.add(grenze);
const sperrGeo = new THREE.PlaneGeometry(KACHEL - 0.3, KACHEL - 0.3).rotateX(-Math.PI / 2);
const sperrFlaechen = new THREE.Group(), preisSchilder = new THREE.Group(); szene.add(sperrFlaechen, preisSchilder);
function schild(text, unter, gut) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 200; const x = c.getContext("2d");
  x.fillStyle = gut ? "rgba(20,24,40,.9)" : "rgba(20,24,40,.72)"; x.beginPath(); if (x.roundRect) x.roundRect(8, 8, 496, 184, 40); else x.rect(8, 8, 496, 184); x.fill();
  x.strokeStyle = gut ? "#4fd27a" : "rgba(255,255,255,.25)"; x.lineWidth = 6; x.stroke();
  x.fillStyle = "#fff"; x.font = "600 66px 'Space Grotesk', Arial"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(text, 256, 82);
  x.fillStyle = gut ? "#b9f5cd" : "#b9b4d6"; x.font = "500 38px 'Space Grotesk', Arial"; x.fillText(unter, 256, 150);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.renderOrder = 6; return s;
}
function gebieteZeichnen() {
  const pos = [];
  for (let i = 0; i < KN; i++) for (let j = 0; j < KN; j++) {
    if (!besitz.has(i + "," + j)) continue;
    const x0 = -HALB + i * KACHEL, z0 = -HALB + j * KACHEL, x1 = x0 + KACHEL, z1 = z0 + KACHEL, y = G + 0.08;
    if (!besitz.has(i + "," + (j - 1))) pos.push(x0, y, z0, x1, y, z0);
    if (!besitz.has(i + "," + (j + 1))) pos.push(x0, y, z1, x1, y, z1);
    if (!besitz.has((i - 1) + "," + j)) pos.push(x0, y, z0, x0, y, z1);
    if (!besitz.has((i + 1) + "," + j)) pos.push(x1, y, z0, x1, y, z1);
  }
  grenze.geometry.dispose(); grenze.geometry = new THREE.BufferGeometry(); grenze.geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); grenze.computeLineDistances();
  sperrFlaechen.clear(); preisSchilder.children.forEach((s) => { s.material.map.dispose(); s.material.dispose(); }); preisSchilder.clear();
  if (werkzeug !== "gebiet") return;
  const erlaubt = gebieteErlaubt(), preis = GEBIET_PREIS(gekauft);
  for (let i = 0; i < KN; i++) for (let j = 0; j < KN; j++) {
    if (besitz.has(i + "," + j) || !kachelHatLand(i, j)) continue;
    const m = kachelMitte(i, j), p = new THREE.Mesh(sperrGeo, M.sperre); p.position.set(m.x, G + 0.09, m.z); p.renderOrder = 4; sperrFlaechen.add(p);
    if (!kaufbar(i, j)) continue;
    let s;
    if (gekauft >= erlaubt) { const n = MS.find((x) => x.gebiete > gekauft) && { name: MS.find((x) => x.gebiete > gekauft).name, ab: MS.find((x) => x.gebiete > gekauft).xp }; s = schild("🔒 " + (n ? n.name : "–"), n ? "ab " + zahl(n.ab) + " XP" : "", false); }
    else { const ok = geld >= preis; s = schild(euro(preis), ok ? "Antippen zum Kaufen" : "Noch zu teuer", ok); }
    s.position.set(m.x, 4, m.z); s.userData = { i, j }; preisSchilder.add(s);
  }
}

/* ================================================================
   Straßennetz
   ================================================================ */
const knoten = new Map(), kanten = new Map();
let nId = 1, kId = 1, zId = 1, gId = 1, hId = 1, netzVersion = 0;
const bez = (p0, c, p2, t) => { const u = 1 - t; return { x: u * u * p0.x + 2 * u * t * c.x + t * t * p2.x, z: u * u * p0.z + 2 * u * t * c.z + t * t * p2.z }; };
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
const abst = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function abtasten(p0, c, p2) {
  const grob = abst(p0, c) + abst(c, p2), n = Math.max(4, Math.ceil(grob / 0.35)), pts = []; let s = 0, vor = null;
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = bez(p0, c, p2, t), tx = 2 * (1 - t) * (c.x - p0.x) + 2 * t * (p2.x - c.x), tz = 2 * (1 - t) * (c.z - p0.z) + 2 * t * (p2.z - c.z), l = Math.hypot(tx, tz) || 1;
    if (vor) s += abst(vor, p); pts.push({ x: p.x, z: p.z, t, s, tx: tx / l, tz: tz / l }); vor = p;
  }
  return { pts, len: s };
}
function punktBei(k, s) {
  const p = k.pts; if (s <= 0) return p[0]; if (s >= k.len) return p[p.length - 1];
  let lo = 0, hi = p.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p[m].s < s) lo = m; else hi = m; }
  const a = p[lo], b = p[hi], f = (s - a.s) / ((b.s - a.s) || 1);
  return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, tx: a.tx + (b.tx - a.tx) * f, tz: a.tz + (b.tz - a.tz) * f, t: a.t + (b.t - a.t) * f };
}
function abstandZuLinie(p, pts, mitT) {
  let best = 1e9, bt = 0, bs = 0, bx = 0, bz = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1e-9;
    const f = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)), x = a.x + dx * f, z = a.z + dz * f, d = Math.hypot(p.x - x, p.z - z);
    if (d < best) { best = d; bt = a.t + (b.t - a.t) * f; bs = a.s + (b.s - a.s) * f; bx = x; bz = z; }
  }
  return mitT ? { d: best, t: bt, s: bs, x: bx, z: bz } : best;
}
function huelle(pts, r) { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const p of pts) { a = Math.min(a, p.x); b = Math.max(b, p.x); c = Math.min(c, p.z); d = Math.max(d, p.z); } r = r || 0; return { x0: a - r, x1: b + r, z0: c - r, z1: d + r }; }
const nahHuelle = (h, p, r) => p.x > h.x0 - r && p.x < h.x1 + r && p.z > h.z0 - r && p.z < h.z1 + r;
function strassenFrei(p, ausser, ohneEbene) { let m = 1e9; for (const k of kanten.values()) { if (k === ausser || k.ebene < 0 || (ohneEbene && k.ebene) || !nahHuelle(k.h, p, Math.min(m, 5) + 1.5)) continue; m = Math.min(m, abstandZuLinie(p, k.pts) - TYP[k.typ].halb); } return m; }

const SF = { gehweg: farbe(0xcbc6ba), fahrbahn: farbe(0x3b4049), strich: farbe(0xf1eee4), gelb: farbe(0xf2c14e), gruen: farbe(0x7dbb55), weg: farbe(0xd8c7a0) };
/* Brücken (ebene +1) und Tunnel (ebene −1): Höhe entlang der Straße mit sanften Rampen */
const tunnelR = (k) => Math.min(1.6, k.len / 2 - 0.6);
function ebeneY(k, S) {
  if (!k || !k.ebene) return 0;
  if (k.ebene < 0) { const t = klemme((Math.min(S, k.len - S) - tunnelR(k)) / 0.35, 0, 1); return -0.75 * t; }
  const r = Math.min(3.2, k.len / 2), t = klemme(Math.min(S, k.len - S) / r, 0, 1), g = t * t * (3 - 2 * t); return 0.78 * g;
}
function band(pos, col, pts, halb, y, c, versatz) {
  versatz = versatz || 0;
  if (typeof y === "function") { for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], ya = y(a), yb = y(b), anx = -a.tz, anz = a.tx, bnx = -b.tz, bnz = b.tx;
    pos.push(a.x + anx * (versatz + halb), ya, a.z + anz * (versatz + halb), b.x + bnx * (versatz + halb), yb, b.z + bnz * (versatz + halb), a.x + anx * (versatz - halb), ya, a.z + anz * (versatz - halb), a.x + anx * (versatz - halb), ya, a.z + anz * (versatz - halb), b.x + bnx * (versatz + halb), yb, b.z + bnz * (versatz + halb), b.x + bnx * (versatz - halb), yb, b.z + bnz * (versatz - halb));
    for (let v = 0; v < 6; v++) col.push(c.r, c.g, c.b); } return; }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], anx = -a.tz, anz = a.tx, bnx = -b.tz, bnz = b.tx;
    const alx = a.x + anx * (versatz + halb), alz = a.z + anz * (versatz + halb), arx = a.x + anx * (versatz - halb), arz = a.z + anz * (versatz - halb);
    const blx = b.x + bnx * (versatz + halb), blz = b.z + bnz * (versatz + halb), brx = b.x + bnx * (versatz - halb), brz = b.z + bnz * (versatz - halb);
    pos.push(alx, y, alz, blx, y, blz, arx, y, arz, arx, y, arz, blx, y, blz, brx, y, brz);
    for (let v = 0; v < 6; v++) col.push(c.r, c.g, c.b);
  }
}
function striche(pos, col, k, versatz, c, lang, luecke) { const y = k.ebene ? (p) => G + 0.024 + ebeneY(k, p.s) : G + 0.024; for (let s = 1.0; s < k.len - 1.0; s += lang + luecke) { const a = Object.assign({ s }, punktBei(k, s)), s2 = Math.min(s + lang, k.len - 0.9), b = Object.assign({ s: s2 }, punktBei(k, s2)); band(pos, col, [a, b], 0.03, y, c, versatz); } }
function linie(pos, col, k, versatz, c) { const a = k.pts.filter((p) => p.s > 0.9 && p.s < k.len - 0.9); if (a.length > 1) band(pos, col, a, 0.03, k.ebene ? (p) => G + 0.024 + ebeneY(k, p.s) : G + 0.024, c, versatz); }
function wand(pos, col, pts, off, y0, y1, c) { for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], ax = a.x - a.tz * off, az = a.z + a.tx * off, bx = b.x - b.tz * off, bz = b.z + b.tx * off, a0 = y0(a), a1 = y1(a), b0 = y0(b), b1 = y1(b); pos.push(ax, a0, az, bx, b0, bz, ax, a1, az, ax, a1, az, bx, b0, bz, bx, b1, bz); for (let v = 0; v < 6; v++) col.push(c.r, c.g, c.b); } }
function scheibe(pos, col, x, z, r, y, c) { const n = 24; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2; pos.push(x, y, z, x + Math.cos(b) * r, y, z + Math.sin(b) * r, x + Math.cos(a) * r, y, z + Math.sin(a) * r); for (let v = 0; v < 3; v++) col.push(c.r, c.g, c.b); } }
function geoAus(pos, col) { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g; }
function kantenMesh(k) {
  const T = TYP[k.typ], pos = [], col = [], Y = (d) => k.ebene ? (p) => G + d + ebeneY(k, p.s) : G + d;
  if (k.typ === "fuss") band(pos, col, k.pts, T.halb, Y(0.014), SF.weg);
  else if (T.kies) band(pos, col, k.pts, T.halb, Y(0.014), farbe(0xcbbf9f));
  else if (T.rad) { band(pos, col, k.pts, T.halb, Y(0.013), SF.gehweg); band(pos, col, k.pts, T.halb - 0.06, Y(0.015), farbe(0xc9553f)); striche(pos, col, k, 0, SF.strich, 0.3, 0.4); }
  else if (T.pflaster) { band(pos, col, k.pts, T.halb, Y(0.014), farbe(0xd8cbb0)); band(pos, col, k.pts, 0.12, Y(0.016), farbe(0xb9a98a)); }
  else {
    band(pos, col, k.pts, T.halb, Y(0.012), T.ohneGehweg ? SF.gruen : SF.gehweg);
    if (k.typ === "allee") band(pos, col, k.pts, 0.78, Y(0.016), SF.gruen);
    if (T.radweg) band(pos, col, k.pts, T.fahr + 0.2, Y(0.017), farbe(0xc9553f));
    band(pos, col, k.pts, T.fahr, Y(0.02), SF.fahrbahn);
    const sp = T.spuren;
    if (sp.length > 1) {
      if (T.mitte === "gruen") band(pos, col, k.pts, 0.1, Y(0.024), SF.gruen); else if (T.mitte === "baeume") { band(pos, col, k.pts, 0.38, Y(0.025), farbe(0xc9c3b6)); band(pos, col, k.pts, 0.32, Y(0.027), SF.gruen); } else if (T.mitte === "planke") band(pos, col, k.pts, 0.05, Y(0.03), farbe(0xc9ced6)); else if (T.einbahn) {} else { linie(pos, col, k, 0.05, SF.gelb); linie(pos, col, k, -0.05, SF.gelb); }
      for (let i = 0; i < sp.length - 1; i++) { const o = (sp[i] + sp[i + 1]) / 2; striche(pos, col, k, o, SF.strich, 0.45, 0.65); striche(pos, col, k, -o, SF.strich, 0.45, 0.65); }
      if (T.ohneGehweg) for (const sei of [1, -1]) linie(pos, col, k, sei * (T.fahr - 0.04), SF.strich);
    }
    else if (!k.einbahn && !T.einbahn) striche(pos, col, k, 0, SF.strich, 0.5, 0.6);
    if (T.ohneGehweg && sp.length === 1) for (const sei of [1, -1]) linie(pos, col, k, sei * (T.fahr - 0.04), SF.strich);
  }
  if (k.busspur) { const o = T.spuren[T.spuren.length - 1]; for (const sei of [1, -1]) band(pos, col, k.pts, 0.2, Y(0.0205), farbe(0x8a3a3a), sei * o); }
  if (k.schienen) { const o = TYP[k.typ].spuren[TYP[k.typ].spuren.length - 1], c = farbe(0xb9bfc7); for (const sei of [1, -1]) for (const d of [0.085, -0.085]) band(pos, col, k.pts, 0.012, Y(0.027), c, sei * o + d); }
  if (!k.ebene && k.pts.some((q) => abstand(q.x, q.z) < T.halb + 2.4)) { const c = farbe(0xa9a49a), unten = () => G - 1.1, oben = () => G + 0.013; for (const sei of [1, -1]) wand(pos, col, k.pts, sei * T.halb, unten, oben, c); }
  if (k.ebene > 0) { const c = farbe(0xb9b4a8), unten = (p) => G - 0.1 + ebeneY(k, p.s), oben = (p) => G + 0.09 + ebeneY(k, p.s); for (const sei of [1, -1]) wand(pos, col, k.pts, sei * T.halb, unten, oben, c); band(pos, col, k.pts, T.halb, unten, farbe(0x8c877c)); }
  if (k.einbahn) { const w = farbe(0xffffff); for (let s2 = 1.6; s2 < k.len - 1.4; s2 += 2.4) { const S = k.einbahn > 0 ? s2 : k.len - s2, p = punktBei(k, S), tx = p.tx * k.einbahn, tz = p.tz * k.einbahn, y = G + 0.025 + ebeneY(k, S); for (const off of TYP[k.typ].spuren.length > 1 ? [0.22, 0.64, -0.22, -0.64] : [0.21, -0.21]) { const cx = p.x - tz * off, cz = p.z + tx * off; pos.push(cx + tx * 0.22, y, cz + tz * 0.22, cx - tx * 0.05 - tz * 0.1, y, cz - tz * 0.05 + tx * 0.1, cx - tx * 0.05 + tz * 0.1, y, cz - tz * 0.05 - tx * 0.1); for (let v = 0; v < 3; v++) col.push(w.r, w.g, w.b); pos.push(cx - tx * 0.05 - tz * 0.035, y, cz - tz * 0.05 + tx * 0.035, cx - tx * 0.25 - tz * 0.035, y, cz - tz * 0.25 + tx * 0.035, cx - tx * 0.05 + tz * 0.035, y, cz - tz * 0.05 - tx * 0.035, cx - tx * 0.05 + tz * 0.035, y, cz - tz * 0.05 - tx * 0.035, cx - tx * 0.25 - tz * 0.035, y, cz - tz * 0.25 + tx * 0.035, cx - tx * 0.25 + tz * 0.035, y, cz - tz * 0.25 - tx * 0.035); for (let v = 0; v < 6; v++) col.push(w.r, w.g, w.b); } } }
  const m = new THREE.Mesh(geoAus(pos, col), M.strasse); m.receiveShadow = true; return m;
}
function knotenMesh(n) {
  let halb = 0.42, fahr = 0, nurWeg = true;
  for (const id of n.kanten) { const k = kanten.get(id); if (!k) continue; const T = TYP[k.typ]; halb = Math.max(halb, T.halb); fahr = Math.max(fahr, T.fahr); if (k.typ !== "fuss") nurWeg = false; }
  const pos = [], col = [];
  if (nurWeg) scheibe(pos, col, n.x, n.z, halb, G + 0.0145, SF.weg);
  else { scheibe(pos, col, n.x, n.z, halb, G + 0.0125, SF.gehweg); scheibe(pos, col, n.x, n.z, fahr, G + 0.0205, SF.fahrbahn); }
  const m = new THREE.Mesh(geoAus(pos, col), M.strasse); m.receiveShadow = true; return m;
}
function knotenNeuZeichnen(n) { if (n.mesh) { szene.remove(n.mesh); n.mesh.geometry.dispose(); } n.mesh = knotenMesh(n); szene.add(n.mesh); }
function neuerKnoten(p, id) { const n = { id: id || nId++, x: p.x, z: p.z, kanten: new Set(), mesh: null, drin: new Set(), naht: [], ampel: false, manuell: false, gruppe: new Map() }; nId = Math.max(nId, n.id + 1); knoten.set(n.id, n); return n; }
function knotenWeg(n) { if (n.mesh) { szene.remove(n.mesh); n.mesh.geometry.dispose(); } knoten.delete(n.id); }
function neueKante(aId, bId, c, typ, id, opt) {
  const a = knoten.get(aId), b = knoten.get(bId), { pts, len } = abtasten(a, c, b);
  const k = Object.assign({ id: id || kId++, a: aId, b: bId, c: { x: c.x, z: c.z }, typ, pts, len, h: huelle(pts, TYP[typ].halb), stau: 0 }, opt || {}); kId = Math.max(kId, k.id + 1);
  k.mesh = kantenMesh(k); szene.add(k.mesh); kanten.set(k.id, k); a.kanten.add(k.id); b.kanten.add(k.id);
  knotenNeuZeichnen(a); knotenNeuZeichnen(b); return k;
}
function kanteNeuZeichnen(k) { szene.remove(k.mesh); k.mesh.geometry.dispose(); k.mesh = kantenMesh(k); szene.add(k.mesh); }
function kanteWeg(k) {
  szene.remove(k.mesh); k.mesh.geometry.dispose(); kanten.delete(k.id);
  for (const nid of [k.a, k.b]) { const n = knoten.get(nid); if (!n) continue; n.kanten.delete(k.id); if (!n.kanten.size) knotenWeg(n); else knotenNeuZeichnen(n); }
}
function kanteTeilen(k, t) {
  const a = knoten.get(k.a), b = knoten.get(k.b), m = bez(a, k.c, b, t), n = neuerKnoten(m);
  const c1 = lerp(a, k.c, t), c2 = lerp(k.c, b, t), aId = k.a, bId = k.b, typ = k.typ, ax = { x: a.x, z: a.z }, bx = { x: b.x, z: b.z };
  kanteWeg(k); if (!knoten.has(aId)) neuerKnoten(ax, aId); if (!knoten.has(bId)) neuerKnoten(bx, bId);
  const opt = { aussen: k.aussen, einbahn: k.einbahn, ring: k.ring, kreisel: k.kreisel, busspur: k.busspur, schienen: k.schienen, parken: k.parken }, e1 = neueKante(aId, n.id, c1, typ, null, opt), e2 = neueKante(n.id, bId, c2, typ, null, opt); return n;
}
const fangRadius = () => Math.min(3, Math.max(1.1, kameraAbstand() / 32));
function naechsterKnoten(p, r) { let best = null, bd = r; for (const n of knoten.values()) { const d = abst(n, p); if (d < bd) { bd = d; best = n; } } return best; }
function naechsteKante(p, r, filter) { let best = null; for (const k of kanten.values()) { if ((filter && !filter(k)) || !nahHuelle(k.h, p, r)) continue; const e = abstandZuLinie(p, k.pts, true); if (e.d < r && (!best || e.d < best.d)) best = { k, ...e }; } return best; }
function fangen(p) {
  const r = fangRadius();
  const n = naechsterKnoten(p, r); if (n) return { art: "knoten", id: n.id, x: n.x, z: n.z };
  const e = naechsteKante(p, r * 0.8, (k) => !k.ebene); if (e) return { art: "kante", id: e.k.id, x: e.x, z: e.z };
  return { art: "frei", x: p.x, z: p.z };
}
function knotenFuer(p) {
  const n = naechsterKnoten(p, 0.6); if (n) return n;
  const e = naechsteKante(p, 0.6, (k) => !k.ebene);
  if (e) { const a = knoten.get(e.k.a), b = knoten.get(e.k.b); if (abst(a, e) < 1.0) return a; if (abst(b, e) < 1.0) return b; return kanteTeilen(e.k, e.t); }
  return neuerKnoten(p);
}
function schnitt(p1, p2, p3, p4) {
  const d = (p2.x - p1.x) * (p4.z - p3.z) - (p2.z - p1.z) * (p4.x - p3.x); if (Math.abs(d) < 1e-9) return null;
  const ua = ((p3.x - p1.x) * (p4.z - p3.z) - (p3.z - p1.z) * (p4.x - p3.x)) / d, ub = ((p3.x - p1.x) * (p2.z - p1.z) - (p3.z - p1.z) * (p2.x - p1.x)) / d;
  if (ua < 0 || ua > 1 || ub < 0 || ub > 1) return null; return { ua, x: p1.x + ua * (p2.x - p1.x), z: p1.z + ua * (p2.z - p1.z) };
}
function kreuzungen(pts, ausserNah) {
  const h = huelle(pts), liste = [];
  for (const k of kanten.values()) {
    if (k.ebene || k.h.x1 < h.x0 || k.h.x0 > h.x1 || k.h.z1 < h.z0 || k.h.z0 > h.z1) continue;
    for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < k.pts.length - 1; j++) {
      const s = schnitt(pts[i], pts[i + 1], k.pts[j], k.pts[j + 1]);
      if (s && !ausserNah.some((q) => abst(q, s) < 1.0)) liste.push({ t: pts[i].t + (pts[i + 1].t - pts[i].t) * s.ua, x: s.x, z: s.z });
    }
  }
  liste.sort((a, b) => a.t - b.t);
  return liste.filter((q, i) => !liste.slice(0, i).some((o) => abst(o, q) < 1.5));
}
function typFrei(t) { return MEILEN.slice(0, meilenstein + 1).some((m) => m.frei.includes(t)) || t === "fuss" || t === "klein"; }
function planen(A, C, Bp, typ, ebene) {
  ebene = ebene || 0;
  const T = TYP[typ], { pts, len } = abtasten(A, C, Bp), plan = { A, C, B: Bp, typ, pts, laenge: len, kosten: Math.round(len * T.preis * (ebene > 0 ? 3 : ebene < 0 ? 4 : 1) * (hatEntw("verkehr1") ? 0.85 : 1)), kreuz: [], ok: true, grund: "", ebene };
  const kk = { ebene, len }, ey = (q) => ebeneY(kk, q.s);
  const nein = (g) => { plan.ok = false; plan.grund = plan.grund || g; };
  if (!typFrei(typ)) { const m = MEILEN.find((x) => x.frei.includes(typ)); nein("🔒 Erst ab " + m.name + " (" + zahl(m.ab) + " XP)"); }
  if (len < 1.5) nein("Zu kurz");
  if (len > 90) nein("Zu lang – setz einen Zwischenpunkt");
  if (ebene && len < 7) nein(ebene > 0 ? "Brücken müssen mindestens 7 Felder lang sein" : "Tunnel müssen mindestens 7 Felder lang sein");
  for (const q of pts) { if (!aufLand(q.x, q.z, ebene && Math.abs(ey(q)) > 0.3 ? -99 : ebene ? 1.5 : T.halb + 0.9)) { if (!ebene) plan.wasser = true; nein(ebene ? "Die Enden müssen auf festem Land liegen" : "Zu nah am Wasser – bau eine 🌉 Brücke"); break; } if (!imBesitz(q.x, q.z)) { nein("Außerhalb deiner Gebiete – kauf erst Land"); break; } }
  for (let i = 1; i < pts.length - 1 && plan.ok; i++) { const a = pts[i - 1], b = pts[i + 1]; if (a.tx * b.tx + a.tz * b.tz < 0.55 && abst(a, b) < 1.2) nein("Kurve zu eng"); }
  if (plan.ok) {
    plan.kreuz = ebene ? [] : kreuzungen(pts, [A, Bp]);
    const rx = 1.2 + (T.halb + 1.05) * 1.6, frei = (q) => ![A, Bp].concat(plan.kreuz).some((e) => abst(e, q) < rx);
    for (const q of pts) if ((!ebene || Math.abs(ey(q)) < 0.3) && frei(q) && strassenFrei(q, null, true) < T.halb - 0.15) { nein("Zu nah an einer anderen Straße"); break; }
  }
  if (plan.ok && A.art === "knoten" && Bp.art === "knoten" && A.id === Bp.id) nein("Start und Ende sind gleich");
  if (plan.ok && ebene < 0) plan.baeume = 0;
  else if (plan.ok) { let baum = 0; baeumeIn(plan.pts.reduce((m, q) => Math.min(m, q.x), 1e9) - 2, plan.pts.reduce((m, q) => Math.min(m, q.z), 1e9) - 2, plan.pts.reduce((m, q) => Math.max(m, q.x), -1e9) + 2, plan.pts.reduce((m, q) => Math.max(m, q.z), -1e9) + 2, (b) => { if (!b.weg && abstandZuLinie(b, plan.pts) < T.halb + 0.3) baum++; }); plan.baeume = baum; plan.kosten += baum * 5; }
  if (plan.ok && plan.kosten > geld) nein("Nicht genug Geld");
  return plan;
}
function bauen(plan) {
  const typ = plan.typ, n0 = knotenFuer(plan.A), n2 = knotenFuer(plan.B), neu = [];
  if (n0 === n2) return [];
  const { pts } = abtasten(n0, plan.C, n2), C = plan.C;
  const kr = plan.ebene ? [] : kreuzungen(pts, [n0, n2]).map((q) => ({ t: q.t, n: knotenFuer(q) })).filter((q) => q.n !== n0 && q.n !== n2);
  const ts = [0].concat(kr.map((q) => q.t), [1]), ns = [n0].concat(kr.map((q) => q.n), [n2]);
  for (let j = 0; j < ns.length - 1; j++) {
    const ta = ts[j], tb = ts[j + 1];
    const c = { x: (1 - ta) * (1 - tb) * n0.x + ((1 - ta) * tb + ta * (1 - tb)) * C.x + ta * tb * n2.x, z: (1 - ta) * (1 - tb) * n0.z + ((1 - ta) * tb + ta * (1 - tb)) * C.z + ta * tb * n2.z };
    if (ns[j] === ns[j + 1] || abst(ns[j], ns[j + 1]) < 0.6) continue;
    if ([...ns[j].kanten].some((id) => { const k = kanten.get(id); return (k.a === ns[j].id && k.b === ns[j + 1].id) || (k.b === ns[j].id && k.a === ns[j + 1].id); })) continue;
    const T0 = TYP[typ], opt = {}; if (plan.ebene) opt.ebene = plan.ebene; if (T0.einbahn) opt.einbahn = 1; if (T0.busspur) opt.busspur = true; if (T0.schienen) opt.schienen = true; if (T0.parken) opt.parken = true;
    neu.push(neueKante(ns[j].id, ns[j + 1].id, c, typ, null, opt));
  }
  for (const n of [n0, n2]) if (knoten.has(n.id) && !n.kanten.size) knotenWeg(n);
  for (const k of neu) {
    const T = TYP[k.typ], unterirdisch = (x, z) => { if (k.ebene >= 0) return false; const e = abstandZuLinie({ x, z }, k.pts, true); return ebeneY(k, e.s) < -0.3; };
    for (const z of zellenIn(k.h)) if (abstandZuLinie(z, k.pts) < T.halb + 0.45 && !unterirdisch(z.x, z.z)) zelleWeg(z);
    baeumeFaellen(k.h, (x, z) => abstandZuLinie({ x, z }, k.pts) < T.halb + 0.3 && !unterirdisch(x, z));
  }
  for (const k of neu) zellenFuer(k);
  if (neu.length) { geld -= plan.kosten; if (plan.kosten > 0) xpPlus(Math.round(plan.laenge * 0.5)); zeigeWerte(); }
  netzGeaendert(); return neu;
}

/* ================================================================
   Baufelder
   ================================================================ */
const zellen = new Map(), zellIndex = new Map(), raster = new Map();
const rk = (x, z) => Math.floor(x) + "," + Math.floor(z);
function rasterRein(z) { const k = rk(z.x, z.z); if (!raster.has(k)) raster.set(k, new Set()); raster.get(k).add(z.id); }
function rasterRaus(z) { const s = raster.get(rk(z.x, z.z)); if (s) s.delete(z.id); }
function zellenNahe(x, z, r) {
  const out = []; for (let i = Math.floor(x - r); i <= Math.floor(x + r); i++) for (let j = Math.floor(z - r); j <= Math.floor(z + r); j++) {
    const s = raster.get(i + "," + j); if (s) for (const id of s) { const c = zellen.get(id); if (Math.hypot(c.x - x, c.z - z) <= r) out.push(c); }
  } return out;
}
function zellenIn(h) { const out = []; for (let i = Math.floor(h.x0 - 1); i <= Math.floor(h.x1 + 1); i++) for (let j = Math.floor(h.z0 - 1); j <= Math.floor(h.z1 + 1); j++) { const s = raster.get(i + "," + j); if (s) for (const id of s) out.push(zellen.get(id)); } return out; }
function neueZelle(d) { const z = Object.assign({ id: d.id || zId++, zone: 0, haus: null }, d); zId = Math.max(zId, z.id + 1); z.key = z.g + "|" + z.seite + "|" + z.i + "|" + z.r; zellen.set(z.id, z); zellIndex.set(z.key, z.id); rasterRein(z); return z; }
function zelleWeg(z) { if (!zellen.has(z.id)) return; if (z.haus) hausWeg(haeuser.get(z.haus)); zellen.delete(z.id); zellIndex.delete(z.key); rasterRaus(z); zellenNeu = true; }
function zellenFuer(k) {
  if (k.ebene || k.ring) return;
  const T = TYP[k.typ]; if (!T.zellen) return;
  const n = Math.floor((k.len - 1.9) / ZELLE); if (n < 1) return;
  const rand = (k.len - n * ZELLE) / 2, g = gId++;
  for (let i = 0; i < n; i++) {
    const p = punktBei(k, rand + (i + 0.5) * ZELLE), nx = -p.tz, nz = p.tx;
    for (const seite of [1, -1]) for (let r = 0; r < REIHEN; r++) {
      const d = T.halb + ZELLE / 2 + 0.02 + r * ZELLE, x = p.x + nx * seite * d, z = p.z + nz * seite * d;
      if (!aufLand(x, z, 3.6) || !imBesitz(x, z) || strassenFrei({ x, z }) < 0.45 || zellenNahe(x, z, 0.86).length || inDienst(x, z, 0.35) || aufGleis(x, z)) break;
      neueZelle({ x, z, rot: Math.atan2(-nx * seite, -nz * seite), g, seite, i, r });
    }
  }
  zellenNeu = true;
}
function verwaisteZellen() { for (const z of [...zellen.values()]) if (strassenFrei(z) > REIHEN * ZELLE + 0.3) zelleWeg(z); }
const zellMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2), M.zelle, 40000);
zellMesh.count = 0; zellMesh.frustumCulled = false; zellMesh.renderOrder = 2; zellMesh.setColorAt(0, new THREE.Color()); szene.add(zellMesh);
let zellenNeu = true, werkzeug = "ansehen";
function zellenZeichnen() {
  zellenNeu = false; let i = 0; const leer = werkzeug === "zone" || werkzeug === "strasse";
  for (const z of zellen.values()) {
    if (z.haus || (!z.zone && !leer)) continue;
    _o.position.set(z.x, G + 0.03, z.z); _o.rotation.set(0, z.rot, 0); _o.scale.set(1, 1, 1); _o.updateMatrix(); zellMesh.setMatrixAt(i, _o.matrix);
    if (z.zone) _farbe.setHex(ZONEN[z.zone].farbe); else _farbe.setRGB(0.52, 0.52, 0.52);
    zellMesh.setColorAt(i, _farbe); i++;
  }
  zellMesh.count = i; zellMesh.instanceMatrix.needsUpdate = true; if (zellMesh.instanceColor) zellMesh.instanceColor.needsUpdate = true;
}

/* ================================================================
   Häuser
   ================================================================ */
const LAMPEN_MAT = new THREE.MeshBasicMaterial({ color: 0x4a443a, toneMapped: false });
const B = {
  haus: becken(G_BOX_UNTEN, M.haus, 7000, true), flach: becken(G_BOX_UNTEN, M.flach, 32000, true), dach: becken(G_DACH, M.dach, 6000, true),
  walm: becken(G_WALM, M.dach, 3000, true), pult: becken(G_PULT, M.dach, 3000, true), mansard: becken(G_MANSARD, M.dach, 1500, true), zelt: becken(G_ZELT, M.dach, 1500, true),
  altbau: becken(G_BOX_UNTEN, mitFenstern(new THREE.MeshStandardMaterial({ roughness: 0.8 }), "altbau"), 3000, true), buero: becken(G_BOX_UNTEN, mitFenstern(new THREE.MeshStandardMaterial({ roughness: 0.6 }), "buero"), 3000, true),
  glas: becken(G_BOX_UNTEN, mitFenstern(new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.15 }), "glas"), 3000, true), laden: becken(G_BOX_UNTEN, mitFenstern(new THREE.MeshStandardMaterial({ roughness: 0.6 }), "laden"), 2500, true),
  lampe: becken(G_BOX_UNTEN, LAMPEN_MAT, 5000, false),
  fachwerk: becken(G_BOX_UNTEN, mitFenstern(new THREE.MeshStandardMaterial({ roughness: 0.85 }), "fachwerk"), 1500, true), holz: becken(G_BOX_UNTEN, mitFenstern(new THREE.MeshStandardMaterial({ roughness: 0.85 }), "holz"), 1500, true),
  zyl: becken(G_ZYL, M.flach, 3000, true), garten: becken(G_LAUBBAUM, M.baum, 4000, true), rauch: becken(new THREE.IcosahedronGeometry(0.5, 0), M.rauch, 800, false)
};
const alleeBaeume = becken(G_LAUBBAUM, M.baum, 6000, true);
const haeuser = new Map(); let haeuserNeu = true;
const PAL = {
  haus: [0xf3e9d8, 0xf6d7b0, 0xe9b8a0, 0xd9e4ec, 0xf2f0e9, 0xf5e1a4, 0xcfe3c8, 0xe7cfe6], dach: [0xb2513a, 0x8f3f30, 0x5d6470, 0x7a4b3a, 0x3f5566, 0xa8673f],
  block: [0xe8dcc8, 0xd8c3a5, 0xc9a083, 0xf0ebe1, 0xb9c7cf, 0xe3c9a8, 0xd0d6c4], laden: [0xf2efe8, 0xe6dccb, 0xdfe7ee, 0xf3e3d0, 0xe0e0d8],
  markise: [0xe8493f, 0x2f8f6f, 0x3f7fe8, 0xf2a93b, 0x8e5be8, 0xe85b9a], turm: [0x9fb7c9, 0x7fa3b8, 0xc9d6df, 0x6d8aa1, 0xb8c4cc, 0x8fb0a8],
  halle: [0xd9d4c7, 0xc4c9cc, 0xbfb3a0, 0xd0c8b8, 0xaab3b8], auto: [0xe8493f, 0x3f7fe8, 0xf2f2f2, 0x2c2f36, 0xf2c14e, 0x4fbf7a, 0x9a5be8, 0xff8a3c, 0x8a96a3, 0x1f4e8c]
};
/* ================================================================
   Gebäude-Baukasten: echte Dachformen, Fenster, Balkone, Eingänge,
   Schaufenster, Dachaufbauten – alles selbst gebaut, über 140 Gebäude
   ================================================================ */
const STIL = {
  putz: [0xf3e9d8, 0xf6d7b0, 0xe9c4a8, 0xdfe7ec, 0xf2f0e9, 0xf5e1a4, 0xd9e6cf, 0xeadbe8, 0xfbfaf6, 0xe8d9c4],
  klinker: [0xa9533b, 0x9a4632, 0xb8653f, 0x8c3f2f, 0xa0573f],
  altbau: [0xe8dcc8, 0xf0e2c4, 0xdccfb8, 0xe6c9a8, 0xc9d2d6, 0xf2e6d0, 0xd8c3a5, 0xb9c7cf, 0xe4d2bf],
  modern: [0xf4f4f2, 0xe8e8e6, 0xd6d8da, 0x4a4e55, 0xc9b79c, 0x9aa0a6, 0xefe9df],
  holz: [0x8a2f24, 0x2f3a40, 0x4a5a3a, 0xd9c7a0, 0x6b4a2f, 0x3d5a80, 0xe8d9b5],
  ziegel: [0xb2513a, 0x9a4230, 0xa8673f, 0x8f3f30, 0xb86a48],
  schiefer: [0x3f4650, 0x4d5560, 0x5d6470, 0x2f343b],
  glas: [0x8fb3c9, 0x7fa3b8, 0x9fc0d2, 0x6d8aa1, 0x86a8a0, 0xa9b8c4, 0x5f7f99, 0x7f9aa8],
  buero: [0xd6d8da, 0xc9ced3, 0xe2ddd3, 0xb8bec4, 0xeeeae2],
  halle: [0xd9d4c7, 0xc4c9cc, 0xbfb3a0, 0xd0c8b8, 0xaab3b8, 0x9fb0a0],
  laden: [0xf2efe8, 0xe6dccb, 0xdfe7ee, 0xf3e3d0, 0xe0e0d8, 0xf6e7c8]
};
const _hc = new THREE.Color(), _hw = new THREE.Color(0xffffff), _hs = new THREE.Color(0x000000);
const hell = (c, f) => _hc.setHex(c == null ? 0xdddddd : c).lerp(_hw, f == null ? 0.4 : f).getHex();
const dunkel = (c, f) => _hc.setHex(c == null ? 0x888888 : c).lerp(_hs, f == null ? 0.35 : f).getHex();
const detailStufe = () => stufe === "niedrig" ? 0 : stufe === "mittel" ? 1 : 2;
const geschossH = (n) => SOCKEL + n * ETAGE + 0.03;

function baukasten(T, r, W, D, vorn, variante, DS) {
  const E = ETAGE, SO = SOCKEL;
  const add = (b, lx, lz, w, hh, d, c, ex) => { T.push(Object.assign({ b, lx, ly: 0, lz, sx: w, sy: hh, sz: d, c }, ex || {})); return T[T.length - 1]; };
  const klein = (b, lx, lz, w, hh, d, c, ex) => { if (DS >= 1) add(b, lx, lz, w, hh, d, c, ex); };
  const fein = (b, lx, lz, w, hh, d, c, ex) => { if (DS >= 2) add(b, lx, lz, w, hh, d, c, ex); };
  const pk = (a) => a[Math.floor(r() * a.length)];
  const zw = (a, b) => a + r() * (b - a), zi = (a, b) => a + Math.floor(r() * (b - a + 1));
  const baum = (lx, lz, g, y) => add("garten", lx, lz, g, g, g, null, { rund: true, ly: y || 0 });
  const zyl = (lx, lz, d, hh, c, ex) => add("zyl", lx, lz, d, hh, d, c, ex);
  const flaeche = (lx, lz, w, d, c, y) => add("flach", lx, lz, w, 0.008, d, c, { ly: y == null ? 0.003 : y });
  const auto = (lx, lz, quer, i, ly) => { (T.plaetze = T.plaetze || []).push({ lx, lz, rot: quer ? 0 : Math.PI / 2, ly: ly || 0 }); if (DS >= 1) add("flach", lx, lz, quer ? 0.3 : 0.16, 0.003, quer ? 0.16 : 0.3, 0x6d7178, { ly: (ly || 0) + 0.004 }); };

  /* --- Dächer --- */
  function attika(lx, lz, w, d, y, c) { if (DS < 1) return; const t = 0.025, hh = 0.055; add("flach", lx, lz + d / 2 - t / 2, w, hh, t, c, { ly: y }); add("flach", lx, lz - d / 2 + t / 2, w, hh, t, c, { ly: y }); add("flach", lx - w / 2 + t / 2, lz, t, hh, d - 2 * t, c, { ly: y }); add("flach", lx + w / 2 - t / 2, lz, t, hh, d - 2 * t, c, { ly: y }); }
  function dach(typ, lx, lz, w, d, y, c, o) {
    o = o || {}; const ww = o.quer ? d : w, dd = o.quer ? w : d, ry = o.quer ? Math.PI / 2 : 0, ue = o.ue == null ? 0.07 : o.ue;
    const H = o.h != null ? o.h : typ === "flach" ? 0 : typ === "pult" ? dd * 0.24 : typ === "mansard" ? dd * 0.48 : typ === "zelt" ? Math.min(w, d) * 0.55 : dd * (o.steil ? 0.62 : 0.42) + 0.03;
    if (typ === "sattel") add("dach", lx, lz, ww + ue, H, dd + ue, c, { ly: y, ry });
    else if (typ === "walm") add("walm", lx, lz, ww + ue, H, dd + ue, c, { ly: y, ry });
    else if (typ === "mansard") add("mansard", lx, lz, ww + 0.03, H, dd + 0.05, c, { ly: y, ry });
    else if (typ === "pult") add("pult", lx, lz, ww + ue, H, dd + ue, c, { ly: y, ry: ry + (o.dreh ? Math.PI : 0) });
    else if (typ === "zelt") add("zelt", lx, lz, w + ue, H, d + ue, c, { ly: y });
    else { add("flach", lx, lz, w + 0.02, 0.03, d + 0.02, c == null ? 0xcfcbc3 : c, { ly: y }); if (o.attika !== false) attika(lx, lz, w + 0.02, d + 0.02, y + 0.03, o.ac == null ? 0xd8d4cc : o.ac); return 0.03; }
    return H;
  }
  function gauben(lx, lz, w, d, top, H, k, c, dc) {
    for (let i = 0; i < k; i++) {
      const x = lx - w / 2 + w / k * (i + 0.5), gz = lz + d * 0.24, y = top + H * 0.12, gh = Math.min(0.2, H * 0.5);
      add("flach", x, gz, 0.17, gh, 0.2, c, { ly: y }); fein("flach", x, gz + 0.101, 0.11, gh * 0.62, 0.006, 0x2a3644, { ly: y + gh * 0.2 }); fein("flach", x, gz + 0.104, 0.13, 0.015, 0.012, 0xf2f0ea, { ly: y + gh * 0.14 });
      dach("sattel", x, gz, 0.17, 0.2, y + gh, dc, { quer: true, h: 0.08, ue: 0.04 });
    }
  }
  function solar(lx, lz, w, d, top, H, typ, quer) {
    if (typ === "sattel" && !quer) { const neig = Math.atan2(H, d / 2), len = Math.hypot(H, d / 2) * 0.62, n = Math.max(1, Math.floor(w / 0.28)); for (let i = 0; i < n; i++) add("flach", lx - w / 2 + w / n * (i + 0.5), lz + d * 0.25, w / n * 0.86, 0.012, len, 0x1f3a6b, { ly: top + H * 0.5 + 0.012, rx: neig }); }
    else if (!typ || typ === "flach") { const rows = Math.max(1, Math.floor(d / 0.32)), n = Math.max(1, Math.floor(w / 0.3)); for (let a = 0; a < rows; a++) for (let i = 0; i < n; i++) add("flach", lx - w / 2 + w / n * (i + 0.5), lz - d / 2 + d / rows * (a + 0.5), w / n * 0.8, 0.012, 0.16, 0x1f3a6b, { ly: top + 0.06, rx: -0.45 }); }
  }
  function technik(lx, lz, w, d, top, viel) {
    if (DS < 1) return; const n = Math.min(6, Math.max(1, Math.round(w * d * (viel || 1) * 1.2)));
    for (let i = 0; i < n; i++) add("flach", lx + (r() - 0.5) * w * 0.7, lz + (r() - 0.5) * d * 0.7, 0.12 + r() * 0.1, 0.07 + r() * 0.05, 0.1 + r() * 0.08, pk([0xb9bec4, 0xd2d5d8, 0x9aa0a8]), { ly: top });
    if (w * d > 0.6) add("flach", lx - w * 0.22, lz - d * 0.18, Math.min(0.36, w * 0.3), 0.2, Math.min(0.3, d * 0.3), 0xc9c6bf, { ly: top });
    if (viel > 1 && DS >= 2) { zyl(lx + w * 0.25, lz - d * 0.2, 0.18, 0.22, 0x8a8f96, { ly: top }); add("flach", lx + w * 0.3, lz + d * 0.2, 0.02, 0.5, 0.02, 0xc9ced6, { ly: top }); }
  }
  function dachgarten(lx, lz, w, d, top) { add("flach", lx, lz, w * 0.9, 0.02, d * 0.9, 0x6fae4a, { ly: top }); if (DS >= 1) { const n = Math.max(1, Math.round(w * d * 3)); for (let i = 0; i < Math.min(n, 6); i++) baum(lx + (r() - 0.5) * w * 0.7, lz + (r() - 0.5) * d * 0.7, 0.22 + r() * 0.15, top + 0.02); } }
  /* --- Fassadenteile --- */
  function eingang(x, front, art, c, ly) {
    ly = ly || 0; if (DS >= 1) add("lampe", x + (art === "glas" ? 0.13 : 0.08), front + 0.016, 0.035, 0.045, 0.018, 0xffffff, { ly: ly + 0.2 });
    if (art === "glas") { add("flach", x, front + 0.006, 0.2, 0.25, 0.012, 0x2a3a48, { ly: ly + 0.01 }); klein("flach", x, front + 0.07, 0.34, 0.025, 0.14, 0xd8dade, { ly: ly + 0.3 }); }
    else if (art === "portal") { klein("flach", x, front + 0.006, 0.2, 0.3, 0.012, hell(c, 0.5), { ly }); add("flach", x, front + 0.01, 0.12, 0.25, 0.012, 0x5a3a24, { ly }); fein("flach", x, front + 0.03, 0.2, 0.02, 0.06, 0xb9b4a8, { ly }); }
    else { add("flach", x, front + 0.006, 0.1, 0.2, 0.012, pk([0x6b4a2f, 0x3d5a80, 0x2f6b4a, 0x8a2f2f, 0xf2efe8, 0x3a3d42]), { ly }); klein("flach", x, front + 0.05, 0.18, 0.02, 0.09, hell(c, 0.3), { ly: ly + 0.24 }); fein("flach", x, front + 0.04, 0.16, 0.02, 0.07, 0xb9b4a8, { ly }); }
  }
  function balkone(lx, front, w, n, ly, art, bc, von) {
    if (DS < 1 || n < 2) return; const k = Math.max(1, Math.floor(w / (art === "loggia" ? 0.5 : 0.6))), max = DS >= 2 ? 70 : 26; let z = 0;
    for (let f = von || 1; f < n; f++) for (let i = 0; i < k; i++) {
      if (z++ > max) return; const x = lx - w / 2 + w / k * (i + 0.5), y = ly + SO + f * E, bw = Math.min(0.42, w / k * 0.8);
      if (art === "franz") { add("flach", x, front + 0.012, bw * 0.55, 0.09, 0.012, bc == null ? 0x3a3d42 : bc, { ly: y + 0.06 }); continue; }
      if (art === "loggia") { add("flach", x, front + 0.004, bw, 0.27, 0.01, 0x4a4f57, { ly: y + 0.03 }); add("flach", x, front + 0.012, bw, 0.11, 0.014, bc == null ? 0xe8ecef : bc, { ly: y }); continue; }
      add("flach", x, front + 0.06, bw, 0.025, 0.12, art === "beton" ? 0xd8d6d0 : 0xe9e7e2, { ly: y });
      add("flach", x, front + 0.115, bw, 0.1, 0.012, bc == null ? 0x9fbfd0 : bc, { ly: y + 0.025 });
    }
  }
  function laubengang(lx, front, w, n, ly, c) { if (DS < 1) return; for (let f = 1; f < n; f++) { const y = ly + SO + f * E; add("flach", lx, front + 0.07, w, 0.03, 0.14, 0xd8d6d0, { ly: y }); add("flach", lx, front + 0.135, w, 0.1, 0.012, c == null ? 0x5d6470 : c, { ly: y + 0.03 }); } }
  function markise(x, front, w, c, y) { add("flach", x, front + 0.08, w, 0.035, 0.17, c, { ly: (y || 0) + SO + E * 0.86, rx: 0.32 }); }
  function schild(x, front, w, c, y) { add("flach", x, front + 0.012, w, 0.075, 0.014, c, { ly: y }); }
  function gesims(lx, lz, w, d, y, c) { klein("flach", lx, lz, w + 0.05, 0.035, d + 0.05, c, { ly: y - 0.035 }); }
  function baender(lx, front, w, n, ly, c) { if (DS < 2) return; for (let f = 1; f < n; f++) add("flach", lx, front + 0.008, w + 0.01, 0.022, 0.018, c, { ly: ly + SO + f * E - 0.012 }); }

  /* Der Kern: ein Gebäudekörper mit allem drum und dran */
  function bau(o) {
    const lx = o.lx || 0, lz = o.lz, w = o.w, d = o.d, n = o.n || 1, ly = o.ly || 0, c = o.c, art = o.art || "haus";
    const hh = o.hh || geschossH(n), top = ly + hh, front = lz + d / 2;
    if (o.laden) { add("laden", lx, lz, w, SO + E, d, o.lc == null ? c : o.lc, { ly }); if (n > 1 || hh > SO + E + 0.05) add(art, lx, lz, w, hh - SO - E, d, c, { ly: ly + SO + E }); markise(lx, front, w * 0.92, o.laden, ly); schild(lx, front, Math.min(w * 0.55, 0.6), o.sc == null ? 0xf2f0ea : o.sc, ly + SO + E - 0.04); if (DS >= 1) add("lampe", lx, front + 0.02, Math.min(w * 0.5, 0.55), 0.01, 0.008, 0xffffff, { ly: ly + SO + E + 0.04 }); }
    else add(art, lx, lz, w, hh, d, c, { ly });
    if (o.gesims) gesims(lx, lz, w, d, top, o.gc == null ? hell(c, 0.5) : o.gc);
    if (o.baender) baender(lx, front, w, n, ly, o.gc == null ? hell(c, 0.5) : o.gc);
    if (o.eingang !== false && ly < 0.01 && !o.laden) eingang(lx + (o.ex || 0), front, o.eingang || (art === "glas" || art === "buero" ? "glas" : art === "altbau" ? "portal" : "tuer"), c);
    if (o.laden && o.eingang !== false && DS >= 1) add("flach", lx + w * 0.36, front + 0.008, 0.12, 0.23, 0.012, 0x2f3540, { ly: ly + 0.01 });
    if (o.balkon) balkone(lx, front, w, n, ly, o.balkon, o.bc, o.laden ? 1 : 1);
    else if (DS >= 2 && n >= 2 && (art === "haus" || art === "altbau" || art === "fachwerk") && r() < 0.6) { const k = Math.max(1, Math.round(w / 0.3)); for (let i = 0; i < k; i++) if (r() < 0.6) { const x = lx - w / 2 + w / k * (i + 0.5); add("flach", x, front + 0.02, 0.1, 0.025, 0.035, 0x8b5a2b, { ly: ly + SO + E + 0.04 }); add("flach", x, front + 0.02, 0.09, 0.02, 0.03, pk([0xe8493f, 0xe85b9a, 0xf2c14e, 0x9a5be8]), { ly: ly + SO + E + 0.065 }); } }
    if (o.laubengang) laubengang(lx, front, w, n, ly, o.bc);
    if (o.erker && n >= 3 && DS >= 1) { const ew = Math.min(0.34, w * 0.3), ex = o.erkerX || 0; add(art, lx + ex, front + 0.07, ew, (n - 1) * E - 0.04, 0.14, c, { ly: ly + SO + E }); if (o.erkerDach === "zelt") dach("zelt", lx + ex, front + 0.07, ew, 0.14, ly + SO + n * E - 0.04, o.dc, { h: 0.22, ue: 0.03 }); else add("flach", lx + ex, front + 0.07, ew + 0.03, 0.03, 0.17, hell(c, 0.5), { ly: ly + SO + n * E - 0.04 }); }
    let H = 0;
    if (o.dach) H = dach(o.dach, lx, lz, w, d, top, o.dc, { quer: o.quer, h: o.dachH, attika: o.attika, steil: o.steil, dreh: o.dreh });
    if (DS >= 2 && (o.dach === "sattel" || o.dach === "walm") && !o.quer) for (const sz of [1, -1]) add("flach", lx, lz + sz * (d / 2 + 0.035), w + 0.06, 0.018, 0.022, 0x8a8f96, { ly: top - 0.012 });
    if (o.gauben && (o.dach === "sattel" || o.dach === "mansard" || o.dach === "walm") && !o.quer && DS >= 1) gauben(lx, lz, w, d, top, H, o.gauben, o.gaubeC == null ? hell(c, 0.2) : o.gaubeC, o.dc);
    if (o.kamin && H > 0.05 && DS >= 1) add("flach", lx + w * 0.26 * (o.kamin < 0 ? -1 : 1), lz - d * 0.1, 0.07, H * 0.85 + 0.12, 0.07, o.kc == null ? 0x8a4a3a : o.kc, { ly: top });
    if (o.solar && DS >= 1) solar(lx, lz, w, d, top, H, o.dach, o.quer);
    if (o.technik && (!o.dach || o.dach === "flach")) technik(lx, lz, w, d, top + 0.03, o.technik);
    if (o.garten && (!o.dach || o.dach === "flach")) dachgarten(lx, lz, w, d, top + 0.03);
    return top + H;
  }
  /* Grundstücke */
  function gartenDetails() {
    if (DS < 1) return; const hinten = -D / 2 + 0.3, w2 = (Math.random, r());
    add("flach", W / 2 - 0.12, vorn - 0.03, 0.03, 0.09, 0.03, 0x3a3d42); add("flach", W / 2 - 0.12, vorn - 0.03, 0.05, 0.04, 0.035, pk([0xe8493f, 0xf2c14e, 0x3d5a80, 0x2f6b4a]), { ly: 0.09 });
    for (let k = 0; k < 2; k++) add("flach", -W / 2 + 0.1 + k * 0.06, vorn - 0.08, 0.045, 0.07, 0.045, k ? 0x3a6b3a : 0x3a3d42);
    if (D < 1.9) return;
    if (w2 < 0.3) { zyl(W * 0.25, hinten + 0.1, 0.28, 0.06, 0x2c2f36, { ly: 0.06 }); zyl(W * 0.25, hinten + 0.1, 0.3, 0.012, 0x3f7fe8, { ly: 0.115 }); }
    else if (w2 < 0.55) { add("flach", -W * 0.28, hinten + 0.08, 0.26, 0.2, 0.2, pk([0x8b5a2b, 0x6b4a2f, 0x9a7a55])); dach("sattel", -W * 0.28, hinten + 0.08, 0.26, 0.2, 0.2, 0x5a4636, { h: 0.08, ue: 0.03 }); }
    else if (w2 < 0.8 && DS >= 2) { for (const sx of [-1, 1]) add("flach", sx * 0.25, hinten + 0.15, 0.015, 0.2, 0.015, 0x9aa0a8); add("flach", 0, hinten + 0.15, 0.5, 0.004, 0.004, 0xd8d8d8, { ly: 0.18 }); for (let k = 0; k < 4; k++) add("flach", -0.15 + k * 0.1, hinten + 0.15, 0.05, 0.06, 0.004, pk([0xffffff, 0xe85b9a, 0x3f7fe8, 0xf2c14e]), { ly: 0.12 }); }
    else { add("flach", W * 0.2, hinten + 0.1, 0.24, 0.012, 0.18, 0xc9b79c, { ly: 0.003 }); add("flach", W * 0.2, hinten + 0.1, 0.1, 0.07, 0.1, 0xf2f0ea, { ly: 0.015 }); }
  }
  function garten(viel) {
    const hinten = -D / 2 + 0.35;
    if (D >= 1.9) for (let i = 0; i < (viel || 2); i++) baum((r() - 0.5) * W * 0.75, hinten + r() * 0.3, 0.42 + r() * 0.25);
    else if (r() < 0.6) baum(W * (r() < 0.5 ? -0.36 : 0.36), vorn - 0.12, 0.3);
    if (DS >= 1) for (let k = 0; k < 3; k++) add("flach", (r() - 0.5) * W * 0.7, vorn - 0.05, 0.11, 0.03, 0.06, pk([0xe85b9a, 0xf2c14e, 0xe8493f, 0x9a5be8, 0xffffff]), { ly: 0.002 });
  }
  function einfahrt(x, bis, mitAuto) { if (!T.park) T.park = { lx: x, lz: Math.min(vorn - 0.12, bis + 0.06) }; add("flach", x, (vorn + 0.06 + bis) / 2, 0.17, 0.006, Math.max(0.1, vorn + 0.06 - bis), 0xa7a49c, { ly: 0.002 }); if (mitAuto) auto(x, vorn - 0.2, false); }
  function weg(x, bis) { klein("flach", x, (vorn + 0.06 + bis) / 2, 0.08, 0.006, Math.max(0.05, vorn + 0.06 - bis), 0xc9c3b6, { ly: 0.003 }); }
  function zaun(art) {
    if (DS < 1) return; const c = art === 0 ? 0x4a8a3a : art === 1 ? 0xf4f2ee : 0x6b4a2f, hh = art === 0 ? 0.11 : 0.07, d = art === 0 ? 0.06 : 0.015;
    for (const sx of [-1, 1]) add("flach", sx * (W / 2 - 0.04), 0, d, hh, D * 0.92, c, { rand: true, hecke: art === 0 });
    add("flach", 0, -D / 2 + 0.04, W * 0.92, hh, d, c, { rand: true, hecke: art === 0 });
  }
  function terrasse(x, z, w, d) { klein("flach", x, z, w, 0.014, d, 0xc9b79c, { ly: 0.003 }); fein("flach", x + w * 0.25, z, 0.1, 0.07, 0.1, 0xf2f0ea, { ly: 0.017 }); }
  function pool(x, z, w, d) { add("flach", x, z, w + 0.06, 0.014, d + 0.06, 0xe8e4dc, { ly: 0.002 }); add("flach", x, z, w, 0.016, d, 0x4fc3e8, { ly: 0.003 }); }
  function parkplatz(x, z, w, d, n, quer) { if (!T.park) T.park = { lx: x + w * 0.3, lz: z }; flaeche(x, z, w, d, 0x55595f); for (let k = 0; k < n; k++) { auto(x - w / 2 + (k + 0.5) * w / n, z, quer, k); if (DS >= 1 && k) add("flach", x - w / 2 + k * w / n, z, 0.012, 0.004, quer ? 0.12 : 0.3, 0xe8e8e8, { ly: 0.012 }); } }
  function vorplatz(c) { flaeche(0, vorn - 0.12, W * 0.96, 0.3, c == null ? 0xc9c3b6 : c); }
  function fahrraeder(x, z, n) { if (DS < 2) return; for (let k = 0; k < n; k++) add("flach", x + k * 0.07, z, 0.02, 0.06, 0.12, pk([0x3f7fe8, 0xe8493f, 0x2c2f36, 0x4fbf7a]), { ly: 0.005 }); }
  function bank(x, z) { klein("flach", x, z, 0.16, 0.05, 0.05, 0x8b5a2b, { ly: 0.02 }); }
  function container(x, z, quer) { add("flach", x, z, quer ? 0.48 : 0.2, 0.2, quer ? 0.2 : 0.48, CONTAINER[(variante + Math.floor(x * 10)) % CONTAINER.length], { ly: 0.005 }); }
  function lkw(x, z) { add("flach", x, z, 0.16, 0.18, 0.62, pk([0xf4f4f4, 0xe8493f, 0x3f7fe8]), { ly: 0.01 }); add("flach", x, z + 0.37, 0.16, 0.15, 0.12, 0x2f3540, { ly: 0.01 }); }
  const VORNE = (d, ab) => vorn - d / 2 - (ab == null ? 0.12 : ab);

  return { gartenDetails, E, SO, add, klein, fein, pk, zw, zi, baum, zyl, flaeche, auto, attika, dach, gauben, solar, technik, dachgarten, eingang, balkone, laubengang, markise, schild, gesims, baender, bau, garten, einfahrt, weg, zaun, terrasse, pool, parkplatz, vorplatz, fahrraeder, bank, container, lkw, VORNE };
}
function hausTeile(h) {
  const r = zufall(h.variante * 31 + h.stufe * 7919), W = h.w * ZELLE, D = h.d * ZELLE, T = [], vorn = D / 2 - 0.06, Z = ZONEN[h.zone], DS = detailStufe();
  const { gartenDetails, E, SO, add, klein, fein, pk, zw, zi, baum, zyl, flaeche, auto, attika, dach, gauben, solar, technik, dachgarten, eingang, balkone, laubengang, markise, schild, gesims, baender, bau, garten, einfahrt, weg, zaun, terrasse, pool, parkplatz, vorplatz, fahrraeder, bank, container, lkw, VORNE } = baukasten(T, r, W, D, vorn, h.variante, DS);
  const L = {
    1: [ // Wohnen niedrig – 5 Stufen
      [() => { const w = Math.min(W * 0.62, 0.62), d = 0.56, lz = VORNE(d, 0.22); bau({ lz, w, d, n: 1, c: pk(STIL.putz), dach: "sattel", dc: pk(STIL.ziegel), kamin: 1 }); weg(0, lz + d / 2); einfahrt(w / 2 + 0.14, lz, r() < 0.7); garten(2); zaun(h.variante % 3); return "Siedlungshaus"; },
       () => { const w = Math.min(W * 0.6, 0.62), d = 0.56, lz = VORNE(d, 0.24); bau({ lz, w, d, n: 1, art: "holz", c: pk(STIL.holz.slice(0, 3)), dach: "sattel", dc: 0x2f343b, steil: true }); klein("flach", 0, lz + d / 2 + 0.08, w * 0.9, 0.02, 0.16, 0x8b6a4a, { ly: 0.04 }); weg(0, lz + d / 2); garten(3); zaun(2); return "Schwedenhaus"; },
       () => { const w = Math.min(W * 0.78, 0.8), d = 0.58, lz = VORNE(d, 0.2); bau({ lz, w, d, n: 1, c: pk(STIL.modern), dach: "flach" }); einfahrt(-w / 2 - 0.12 > -W / 2 ? -w / 2 - 0.1 : 0.3, lz, true); garten(2); zaun(1); return "Kleiner Bungalow"; },
       () => { const w = Math.min(W * 0.6, 0.6), d = 0.58, lz = VORNE(d, 0.2); bau({ lz, w, d, n: 2, c: 0xf6f5f1, dach: "sattel", dc: 0x3a3d42, quer: r() < 0.3, solar: true }); einfahrt(w / 2 + 0.13, lz, true); garten(1); return "Fertighaus"; },
       () => { const w = 0.42, d = 0.36, lz = VORNE(d, 0.35); bau({ lz, w, d, n: 1, art: "holz", c: pk(STIL.holz), dach: "pult", dc: 0x4a4e55 }); terrasse(0, lz + d / 2 + 0.1, w, 0.14); garten(3); return "Tiny House"; },
       () => { const w = Math.min(W * 0.6, 0.62), d = 0.56, lz = VORNE(d, 0.22); bau({ lz, w, d, n: 1, c: pk(STIL.klinker), dach: "sattel", dc: 0x6b5a3a, steil: true, gauben: 1, kamin: -1 }); weg(0, lz + d / 2); garten(2); zaun(0); return "Friesenhaus"; },
       () => { const w = Math.min(W * 0.5, 0.5), d = 0.5, lz = VORNE(d, 0.25); bau({ lz, w, d, n: 2, c: pk(STIL.modern), dach: "flach", attika: false }); einfahrt(w / 2 + 0.13, lz, r() < 0.5); garten(2); return "Würfelhaus"; }],
      [() => { const w = Math.min(W * 0.55, 0.6), d = 0.6, lz = VORNE(d, 0.2), lx = -0.12; bau({ lx, lz, w, d, n: 2, c: pk(STIL.putz), dach: "sattel", dc: pk(STIL.ziegel), kamin: 1 }); add("flach", lx + w / 2 + 0.17, vorn - 0.32, 0.3, 0.3, 0.42, 0xdcd8cf); dach("flach", lx + w / 2 + 0.17, vorn - 0.32, 0.3, 0.42, 0.3, 0xbfbab1, { attika: false }); einfahrt(lx + w / 2 + 0.17, vorn - 0.1, false); garten(2); zaun(h.variante % 3); return "Haus mit Garage"; },
       () => { const w = Math.min(W * 0.86, 1.5), d = 0.62, lz = VORNE(d, 0.18), c = pk(STIL.putz), dc = pk(STIL.ziegel); bau({ lx: -w / 4, lz, w: w / 2, d, n: 2, c, dach: "sattel", dc, quer: false, eingang: "tuer" }); bau({ lx: w / 4, lz, w: w / 2, d, n: 2, c: pk(STIL.putz), dach: "sattel", dc, eingang: "tuer" }); garten(2); return "Doppelhaus"; },
       () => { const w = Math.min(W * 0.62, 0.66), d = 0.6, lz = VORNE(d, 0.22), c = pk(STIL.putz); bau({ lz, w, d, n: 2, c, dach: "sattel", dc: pk(STIL.ziegel), erker: false, kamin: 1 }); add("haus", 0.13, lz + d / 2 + 0.08, 0.26, geschossH(1) + 0.05, 0.16, c); dach("sattel", 0.13, lz + d / 2 + 0.08, 0.26, 0.16, geschossH(1) + 0.05, pk(STIL.ziegel), { quer: true, h: 0.14 }); garten(2); zaun(h.variante % 3); return "Haus mit Erker"; },
       () => { const w = Math.min(W * 0.62, 0.68), d = 0.62, lz = VORNE(d, 0.2); bau({ lz, w, d, n: 2, c: pk(STIL.putz), dach: "walm", dc: pk(STIL.schiefer.concat(STIL.ziegel)) }); einfahrt(w / 2 + 0.12, lz, true); garten(2); zaun(h.variante % 3); return "Walmdachhaus"; },
       () => { const w = Math.min(W * 0.6, 0.64), d = 0.56, lz = VORNE(d, 0.2); bau({ lz, w, d, n: 2, art: "fachwerk", c: pk([0xf4efe2, 0xf2e8d0, 0xe9e2d4]), dach: "sattel", dc: pk(STIL.ziegel), steil: true, kamin: 1 }); weg(0, lz + d / 2); garten(3); zaun(0); return "Fachwerkhaus"; },
       () => { const w = Math.min(W * 0.66, 0.7), d = 0.56, lz = VORNE(d, 0.2); bau({ lz, w, d, n: 2, c: pk(STIL.modern), dach: "pult", dc: 0x4a4e55, solar: true }); einfahrt(-w / 2 - 0.1, lz, true); garten(1); zaun(1); return "Pultdachhaus"; },
       () => { const w = Math.min(W * 0.9, 1.0), d = 0.56, lz = VORNE(d, 0.18), c = pk(STIL.klinker); bau({ lz, w, d, n: 2, c, dach: "sattel", dc: 0x3f4650, eingang: false }); for (const x of [-w / 4, w / 4]) eingang(x, lz + d / 2, "tuer", c); garten(2); return "Reihenendhaus"; }],
      [() => { const w = Math.min(W * 0.66, 0.72), d = 0.66, lz = VORNE(d, 0.22); bau({ lz, w, d, n: 2, c: pk(STIL.putz), dach: "walm", dc: pk(STIL.schiefer), gauben: 2, gesims: true }); einfahrt(w / 2 + 0.12, lz, true); garten(3); zaun(1); return "Stadtvilla"; },
       () => { const w = Math.min(W * 0.8, 0.95), d = 0.6, lz = VORNE(d, 0.16); bau({ lz, w, d, n: 1, c: pk(STIL.modern), dach: "flach" }); if (D >= 1.9) { pool(0.12, lz - d / 2 - 0.42, 0.44, 0.28); terrasse(-0.25, lz - d / 2 - 0.12, 0.4, 0.2); } garten(2); zaun(0); return "Bungalow mit Pool"; },
       () => { const w = Math.min(W * 0.58, 0.62), d = 0.6, lz = VORNE(d, 0.2), lx = -0.13; bau({ lx, lz, w, d, n: 2, c: pk(STIL.putz), dach: "sattel", dc: pk(STIL.ziegel), kamin: -1 }); add("glas", lx + w / 2 + 0.16, lz, 0.3, geschossH(1), 0.45, 0xbfe3ef); dach("pult", lx + w / 2 + 0.16, lz, 0.3, 0.45, geschossH(1), 0xd8dade, { quer: true, h: 0.08, ue: 0.02 }); garten(3); zaun(h.variante % 3); return "Haus mit Wintergarten"; },
       () => { const c = pk(STIL.putz), dc = pk(STIL.ziegel), lz = VORNE(0.5, 0.18); bau({ lz, w: Math.min(W * 0.84, 0.9), d: 0.5, n: 2, c, dach: "sattel", dc }); if (D >= 1.9) bau({ lx: -0.3, lz: lz - 0.5, w: 0.36, d: 0.55, n: 1, c, dach: "sattel", dc, quer: true, eingang: false }); garten(2); zaun(0); return "Landhaus"; },
       () => { const w = Math.min(W * 0.64, 0.7), d = 0.6, lz = VORNE(d, 0.2), c = pk(STIL.klinker); bau({ lz, w, d, n: 2, c, dach: "sattel", dc: 0x2f343b, gauben: 1, baender: true, gc: 0xf2f0ea }); einfahrt(w / 2 + 0.12, lz, true); garten(2); zaun(0); return "Klinkerhaus"; },
       () => { const w = Math.min(W * 0.62, 0.68), d = 0.62, lz = VORNE(d, 0.2); bau({ lz, w, d, n: 2, art: "altbau", c: pk(STIL.altbau), dach: "mansard", dc: pk(STIL.schiefer), gauben: 2, gesims: true }); garten(3); zaun(1); return "Mansardhaus"; },
       () => { const w = Math.min(W * 0.66, 0.7), d = 0.58, lz = VORNE(d, 0.26); bau({ lz, w, d, n: 2, art: "holz", c: pk(STIL.holz), dach: "sattel", dc: 0x3a3d42 }); klein("flach", 0, lz + d / 2 + 0.1, w, 0.02, 0.2, 0x9a7a55, { ly: 0.04 }); fein("flach", 0, lz + d / 2 + 0.1, w + 0.02, 0.02, 0.22, 0x5a4636, { ly: geschossH(1) - 0.04 }); garten(3); zaun(2); return "Holzhaus mit Veranda"; }],
      [() => { const lz = VORNE(0.6, 0.14), c = 0xf6f5f1, w = Math.min(W * 0.86, 1.05); bau({ lz, w, d: 0.6, n: 1, c, art: "glas", dach: "flach", eingang: "glas" }); bau({ lx: -0.12, lz: lz - 0.06, w: w * 0.62, d: 0.5, n: 1, c, ly: geschossH(1), dach: "flach", eingang: false }); if (D >= 1.9) pool(0.05, lz - 0.72, 0.6, 0.3); garten(2); zaun(0); return "Moderne Villa"; },
       () => { const lz = VORNE(0.55, 0.16), c = 0xfbfaf6; bau({ lz, w: Math.min(W * 0.8, 0.9), d: 0.55, n: 2, c, art: "buero", dach: "flach" }); add("flach", 0.25, lz + 0.31, 0.32, 0.02, 0.16, c, { ly: geschossH(1) }); garten(2); zaun(1); return "Bauhaus-Villa"; },
       () => { const w = Math.min(W * 0.72, 0.8), d = 0.62, lz = VORNE(d, 0.2); bau({ lz, w, d, n: 2, c: pk([0xf0d9a8, 0xe9c79a, 0xf2e2c0]), dach: "walm", dc: 0xc0653f, dachH: 0.22 }); klein("flach", 0, lz + d / 2 + 0.12, w * 0.6, 0.02, 0.2, 0xd8c7a0, { ly: geschossH(1) - 0.05 }); if (D >= 1.9) pool(0, lz - d / 2 - 0.4, 0.5, 0.26); garten(3); baum(-W * 0.4, vorn - 0.1, 0.32); return "Toskana-Villa"; },
       () => { const c = pk(STIL.putz), dc = pk(STIL.ziegel), lz = VORNE(0.55, 0.16); bau({ lx: -0.15, lz, w: 0.66, d: 0.55, n: 2, c, dach: "sattel", dc, kamin: 1 }); bau({ lx: W * 0.32, lz: lz - 0.1, w: 0.4, d: 0.62, n: 1, art: "holz", c: 0x8a2f24, dach: "sattel", dc: 0x5d6470, quer: true, eingang: false }); garten(3); zaun(2); return "Landhaus mit Scheune"; },
       () => { const w = Math.min(W * 0.66, 0.72), d = 0.64, lz = VORNE(d, 0.2), c = pk(STIL.altbau), dc = pk(STIL.schiefer); bau({ lz, w, d, n: 3, art: "altbau", c, dach: "mansard", dc, gauben: 2, gesims: true, erker: true, erkerX: w * 0.22, erkerDach: "zelt" }); garten(3); zaun(1); return "Jugendstilvilla"; },
       () => { const lz = VORNE(0.6, 0.18), c = pk(STIL.modern); bau({ lz, w: Math.min(W * 0.78, 0.85), d: 0.6, n: 2, art: "glas", c, dach: "pult", dc: 0x3a3d42, dachH: 0.2, eingang: "glas" }); garten(3); zaun(0); return "Architektenhaus"; }],
      [() => { const lz = VORNE(0.66, 0.14), c = 0xf6f4f0, w = Math.min(W * 0.9, 1.6); bau({ lz, w, d: 0.66, n: 1, c, art: "glas", dach: "flach", eingang: "glas" }); bau({ lx: W >= 2 ? 0.28 : 0.1, lz, w: Math.min(0.75, w * 0.6), d: 0.52, n: 1, c, ly: geschossH(1), dach: "flach", garten: true, eingang: false }); if (D >= 1.9) { pool(-0.1, lz - 0.9, 0.72, 0.32); terrasse(0.3, lz - 0.55, 0.4, 0.2); } garten(3); zaun(0); return "Luxusvilla"; },
       () => { const lz = VORNE(0.56, 0.16), c = pk(STIL.putz), dc = pk(STIL.schiefer); bau({ lx: -0.1, lz, w: 0.72, d: 0.56, n: 2, c, dach: "walm", dc, gauben: 1 }); bau({ lx: 0.36, lz: lz + 0.06, w: 0.26, d: 0.26, n: 3, c, dach: "zelt", dc, dachH: 0.32, eingang: false }); if (D >= 1.9) pool(0.1, lz - 0.68, 0.42, 0.26); garten(3); zaun(1); return "Villa mit Turm"; },
       () => { const lz = VORNE(0.62, 0.22), c = pk(STIL.altbau), dc = pk(STIL.schiefer), w = Math.min(W * 0.62, 1.1); bau({ lz, w, d: 0.62, n: 2, art: "altbau", c, dach: "mansard", dc, gauben: 3, gesims: true, kamin: 1 }); for (const s of [-1, 1]) if (W >= 1.9) bau({ lx: s * (w / 2 + 0.17), lz: lz - 0.05, w: 0.32, d: 0.5, n: 1, art: "altbau", c, dach: "walm", dc, eingang: false }); flaeche(0, vorn - 0.1, 0.5, 0.18, 0xd8cbb0); garten(4); zaun(0); return "Herrenhaus"; },
       () => { const lz = VORNE(0.62, 0.16), w = Math.min(W * 0.86, 1.2); bau({ lz, w, d: 0.62, n: 2, art: "glas", c: pk(STIL.glas), dach: "flach", technik: 0.3, eingang: "glas" }); if (D >= 1.9) pool(0, lz - 0.8, 0.8, 0.3); garten(2); zaun(0); return "Glasvilla"; },
       () => { const lz = VORNE(0.6, 0.18), c = 0xffffff, w = Math.min(W * 0.84, 1.1); bau({ lz, w, d: 0.6, n: 2, c, dach: "flach", balkon: "kragen", bc: 0xbfe3ef }); add("flach", 0, lz + 0.4, w * 0.7, 0.025, 0.18, 0xe9e7e2, { ly: geschossH(1) }); if (D >= 1.9) pool(-0.15, lz - 0.75, 0.5, 0.3); garten(2); zaun(1); return "Strandvilla"; },
       () => { const lz = VORNE(0.7, 0.2), c = pk(STIL.putz), dc = pk(STIL.ziegel.concat(STIL.schiefer)), w = Math.min(W * 0.7, 1.2); bau({ lz, w, d: 0.7, n: 2, c, dach: "walm", dc, gauben: 2, kamin: 1, solar: false }); if (W >= 1.9) { add("flach", -W * 0.38, vorn - 0.3, 0.32, 0.3, 0.44, hell(c, 0.1)); dach("walm", -W * 0.38, vorn - 0.3, 0.32, 0.44, 0.3, dc, { h: 0.14 }); } if (D >= 1.9) { pool(0.15, lz - 0.85, 0.5, 0.28); flaeche(-0.3, -D / 2 + 0.35, 0.5, 0.36, 0xc26a4a); } garten(4); zaun(0); return "Anwesen"; }]
    ],
    2: [ // Wohnen hoch – 5 Stufen
      [() => { const w = W * 0.995, d = Math.min(D * 0.6, 1.0), lz = VORNE(d, 0.02), c = pk(STIL.altbau); bau({ lz, w, d, n: zi(3, 4), art: "altbau", c, dach: "mansard", dc: pk(STIL.schiefer), gauben: Math.max(1, Math.round(w / 0.4)), gesims: true, balkon: "franz" }); garten(2); return "Altbau-Mietshaus"; },
       () => { const w = W * 0.995, d = Math.min(D * 0.62, 1.0), lz = VORNE(d, 0.02), c = pk(STIL.altbau); bau({ lz, w, d, n: 4, art: "altbau", c, dach: "sattel", dc: pk(STIL.ziegel), gauben: 2, gesims: true, baender: true, erker: true, erkerX: -w * 0.2 }); garten(2); return "Gründerzeithaus"; },
       () => { const w = W * 0.995, d = Math.min(D * 0.6, 0.95), lz = VORNE(d, 0.06), c = pk(STIL.klinker); bau({ lz, w, d, n: 3, c, dach: "sattel", dc: pk(STIL.schiefer), balkon: "kragen", bc: 0xf2f0ea }); garten(2); return "Klinker-Mehrfamilienhaus"; },
       () => { const n = Math.max(3, Math.round(W / 0.42)), bw = W * 0.94 / n, d = Math.min(D * 0.55, 0.8), lz = VORNE(d, 0.14), dc = pk(STIL.ziegel); for (let k = 0; k < n; k++) { const lx = -W * 0.47 + bw * (k + 0.5); bau({ lx, lz, w: bw - 0.008, d, n: 2, c: STIL.putz[(h.variante + k) % STIL.putz.length], dach: "sattel", dc, ue: 0.0 }); } garten(3); return "Reihenhäuser"; },
       () => { const w = W * 0.995, d = Math.min(D * 0.58, 0.9), lz = VORNE(d, 0.1); bau({ lz, w, d, n: 4, c: pk([0xd8d4c8, 0xe2dccd, 0xcfd4d6]), dach: "flach", balkon: "loggia" }); garten(2); fahrraeder(-W * 0.3, vorn - 0.05, 4); return "Plattenbau"; },
       () => { const w = Math.min(W * 0.5, 0.55), d = Math.min(D * 0.62, 0.9), lz = VORNE(d, 0.04); bau({ lx: -W * 0.2, lz, w, d, n: 3, art: "altbau", c: pk(STIL.altbau), dach: "pult", dc: 0x4a4e55, gesims: true }); bau({ lx: W * 0.24, lz, w: Math.min(W * 0.4, 0.5), d, n: 3, c: pk(STIL.putz), dach: "sattel", dc: pk(STIL.ziegel) }); garten(2); return "Stadthäuser"; }],
      [() => { const w = W * 0.995, d = Math.min(D * 0.62, 1.1), lz = VORNE(d, 0.08); bau({ lz, w, d, n: 5, c: pk(STIL.putz), dach: "flach", balkon: "kragen", technik: 0.5 }); garten(2); fahrraeder(W * 0.25, vorn - 0.05, 5); return "Mehrfamilienhaus"; },
       () => { const w = W * 0.995, d = Math.min(D * 0.55, 0.8), lz = VORNE(d, 0.16); bau({ lz, w, d, n: 4, c: pk([0xe8dcc8, 0xd6d8da, 0xefe9df]), dach: "flach", laubengang: true, bc: pk([0x3f7fe8, 0x2f8f6f, 0xe8493f]) }); garten(2); return "Laubenganghaus"; },
       () => { const w = W * 0.995, d = Math.min(D * 0.62, 1.0), lz = VORNE(d, 0.02), c = pk(STIL.altbau), dc = pk(STIL.schiefer); bau({ lz, w, d, n: 5, art: "altbau", c, dach: "mansard", dc, gauben: 2, gesims: true, erker: true, erkerX: w * 0.25, erkerDach: "zelt", balkon: "franz" }); garten(2); return "Jugendstilhaus"; },
       () => { const w = W * 0.88, d = Math.min(D * 0.62, 1.0), lz = VORNE(d, 0.08); bau({ lz, w, d, n: 5, c: pk(STIL.modern), dach: "flach", garten: true, balkon: "kragen", bc: 0xbfe3ef }); garten(2); return "Wohnhaus mit Dachgarten"; },
       () => { const n = Math.max(3, Math.round(W / 0.45)), bw = W * 0.94 / n, d = Math.min(D * 0.6, 0.85), lz = VORNE(d, 0.12); for (let k = 0; k < n; k++) bau({ lx: -W * 0.47 + bw * (k + 0.5), lz, w: bw - 0.01, d, n: 3, c: [0xf4f4f2, 0x4a4e55, 0xc9b79c, 0xe8e8e6][(h.variante + k) % 4], dach: "flach", attika: true }); garten(3); return "Townhouses"; },
       () => { const c = pk(STIL.altbau), dc = pk(STIL.schiefer), d1 = Math.min(D * 0.45, 0.75), lz = VORNE(d1, 0.02); bau({ lz, w: W * 0.995, d: d1, n: 5, art: "altbau", c, dach: "mansard", dc, gesims: true, balkon: "franz", laden: pk(STIL.ziegel.concat([0x2f8f6f, 0x3d5a80])) }); if (D >= 1.9) bau({ lx: -W * 0.46 + 0.3, lz: lz - d1 / 2 - (D * 0.4) / 2, w: 0.55, d: D * 0.4, n: 5, art: "altbau", c, dach: "mansard", dc, quer: true, eingang: false }); return "Eckhaus mit Läden"; }],
      [() => { const w = W * 0.995, d = Math.min(D * 0.7, 1.4), lz = VORNE(d, 0.06); bau({ lz, w, d, n: zi(6, 8), c: pk(STIL.putz.concat(STIL.modern)), dach: "flach", balkon: "kragen", technik: 1 }); garten(2); fahrraeder(-W * 0.3, vorn - 0.05, 6); return "Wohnblock"; },
       () => { const c = pk(STIL.putz), n = zi(5, 6), d1 = 0.62, lz1 = VORNE(d1, 0.04), wd = Math.max(0.5, D - d1 - 0.3); bau({ lz: lz1, w: W * 0.9, d: d1, n, c, dach: "flach", balkon: "kragen" }); bau({ lx: -W * 0.45 + 0.32, lz: lz1 - d1 / 2 - wd / 2, w: 0.62, d: wd, n, c, dach: "flach", eingang: false }); baum(W * 0.15, lz1 - d1 / 2 - 0.5, 0.55); return "Wohnanlage"; },
       () => { const c = pk(STIL.modern), d0 = Math.min(D * 0.8, 1.6), lz0 = VORNE(d0, 0.04), n = 3; let y = 0; for (let k = 0; k < n; k++) { const d = d0 * (1 - k * 0.28), lz = lz0 - (d0 - d) / 2; y = bau({ lz, w: W * 0.9, d, n: 2, c, ly: y, dach: "flach", eingang: k === 0 ? "glas" : false }); klein("flach", 0, lz + d / 2 - 0.08, W * 0.86, 0.025, 0.12, 0x6fae4a, { ly: y }); y -= 0.03; } return "Terrassenhaus"; },
       () => { const w = W * 0.995, d = Math.min(D * 0.66, 1.3), lz = VORNE(d, 0.06); bau({ lz, w, d, n: 6, c: pk(STIL.klinker), dach: "flach", balkon: "kragen", bc: 0xf2f0ea, baender: true, gc: 0xe9e4da }); garten(2); return "Klinkerblock"; },
       () => { const s0 = Math.min(W, D) * 0.62, lz = VORNE(s0, 0.12); bau({ lz, w: s0, d: s0, n: zi(8, 10), c: pk(STIL.putz), dach: "flach", balkon: "kragen", technik: 1 }); garten(3); return "Punkthaus"; },
       () => { const c = pk(STIL.altbau), n = 5, d1 = Math.min(0.6, D * 0.35), lz = VORNE(d1, 0.02); bau({ lz, w: W * 0.995, d: d1, n, art: "altbau", c, dach: "sattel", dc: pk(STIL.ziegel), gesims: true }); if (D >= 1.9) for (const s of [-1, 1]) bau({ lx: s * (W * 0.46 - 0.28), lz: lz - d1 / 2 - (D * 0.5) / 2, w: 0.55, d: D * 0.5, n, art: "altbau", c, dach: "sattel", dc: pk(STIL.ziegel), quer: true, eingang: false }); baum(0, -D * 0.15, 0.6); return "Wohnhof"; }],
      [() => { const s0 = Math.min(W, D) * 0.64, lz = VORNE(s0, 0.12), c = pk(STIL.putz.concat(STIL.modern)); bau({ lz, w: s0, d: s0, n: zi(14, 18), c, dach: "flach", balkon: "kragen", technik: 2 }); garten(2); return "Hochhaus"; },
       () => { const s0 = Math.min(W, D) * 0.6, lz = VORNE(s0, 0.12); bau({ lz, w: s0, d: s0, n: zi(12, 15), c: pk(STIL.modern), dach: "flach", garten: true, balkon: "kragen", bc: 0xbfe3ef }); garten(2); return "Wohnturm mit Dachgarten"; },
       () => { const w = W * 0.995, d = Math.min(D * 0.45, 0.8), lz = VORNE(d, 0.1); bau({ lz, w, d, n: zi(11, 13), c: pk([0xe8e4dc, 0xd8d4c8, 0xcfd4d6]), dach: "flach", balkon: "loggia", bc: pk([0xe8493f, 0x3f7fe8, 0xf2c14e, 0x2f8f6f]), technik: 1 }); garten(2); return "Scheibenhochhaus"; },
       () => { const lz0 = VORNE(D * 0.8, 0.04), c = pk(STIL.modern); bau({ lz: lz0, w: W * 0.9, d: D * 0.8, n: 2, c, laden: pk(STIL.ziegel.concat([0x3d5a80])), dach: "flach" }); const s0 = Math.min(W, D) * 0.55; bau({ lz: lz0 - 0.1, w: s0, d: s0, n: zi(12, 16), c: pk(STIL.putz), ly: geschossH(2), dach: "flach", balkon: "kragen", technik: 1, eingang: false }); return "Turm mit Sockel"; },
       () => { const c = pk(STIL.modern), lz = VORNE(Math.min(W, D) * 0.72, 0.1); let y = 0, s = Math.min(W, D) * 0.72; for (let k = 0; k < 3; k++) { y = bau({ lz, w: s, d: s, n: zi(4, 6), c, ly: y, dach: "flach", balkon: "kragen", eingang: k ? false : "glas", garten: k < 2 }); s *= 0.78; } return "Stufenhochhaus"; },
       () => { const s0 = Math.min(W, D) * 0.62, lz = VORNE(s0, 0.12); bau({ lz, w: s0, d: s0, n: zi(10, 13), art: "holz", c: pk([0xb08a5a, 0x9a7a55, 0xc9a77a]), dach: "flach", garten: true, balkon: "kragen", bc: 0xe8ecef }); garten(3); return "Holzhochhaus"; }],
      [() => { const s0 = Math.min(W, D) * 0.56, lz = VORNE(s0, 0.14), c = pk(STIL.glas); const y = bau({ lz, w: s0, d: s0, n: zi(18, 24), art: "glas", c, dach: "flach", eingang: "glas" }); add("glas", 0, lz, s0 * 0.7, 0.45, s0 * 0.7, c, { ly: y }); add("flach", s0 * 0.15, lz, 0.03, 0.9, 0.03, 0xc9ced6, { ly: y + 0.45 }); return "Wohn-Wolkenkratzer"; },
       () => { const c = pk(STIL.glas); if (W >= 2.9) { const s = Math.min(0.85, W * 0.28); for (const lx of [-W * 0.23, W * 0.23]) bau({ lx, lz: VORNE(s, 0.12), w: s, d: s, n: zi(20, 24), art: "glas", c, dach: "flach", technik: 1, eingang: "glas" }); add("glas", 0, VORNE(s, 0.12), W * 0.3, 0.3, 0.3, c, { ly: 4.2 }); return "Zwillingstürme"; } const s0 = Math.min(W, D) * 0.6; bau({ lz: VORNE(s0, 0.12), w: s0, d: s0, n: 22, art: "glas", c, dach: "flach", technik: 1 }); return "Wohnturm"; },
       () => { const c = pk(STIL.modern), s0 = Math.min(W, D) * 0.52, lz = VORNE(s0, 0.2); let y = 0; for (let k = 0; k < 9; k++) { add("haus", 0, lz, s0, 3 * ETAGE, s0, c, { ly: y, ry: k * 0.09 }); fein("flach", 0, lz, s0 + 0.08, 0.03, s0 + 0.08, 0xe9e7e2, { ly: y, ry: k * 0.09 }); y += 3 * ETAGE; } dach("flach", 0, lz, s0, s0, y, null, {}); eingang(0, lz + s0 / 2, "glas", c); return "Gedrehter Turm"; },
       () => { const s0 = Math.min(W, D) * 0.58, lz = VORNE(s0, 0.14), c = pk(STIL.altbau); const y = bau({ lz, w: s0, d: s0, n: zi(20, 26), art: "altbau", c, dach: "flach", gesims: true, baender: true, attika: false, eingang: "portal" }); bau({ lz, w: s0 * 0.7, d: s0 * 0.7, n: 2, art: "altbau", c, ly: y, dach: "zelt", dc: 0x5f8f7a, dachH: 0.7, eingang: false }); return "Luxusturm mit Krone"; },
       () => { const c = pk(STIL.modern), lz = VORNE(Math.min(W, D) * 0.66, 0.12); let y = 0, s = Math.min(W, D) * 0.66; for (let k = 0; k < 4; k++) { y = bau({ lz, w: s, d: s, n: zi(6, 8), c, ly: y, dach: "flach", balkon: "kragen", bc: 0xbfe3ef, garten: true, eingang: k ? false : "glas" }); s *= 0.84; } return "Wolkenkratzer mit Terrassen"; },
       () => { const c = pk(STIL.glas); bau({ lz: VORNE(D * 0.8, 0.04), w: W * 0.995, d: D * 0.8, n: 2, art: "glas", c: pk(STIL.modern), dach: "flach", eingang: "glas" }); const s = Math.min(0.62, W * 0.26); [[-W * 0.28, 0.1], [0.05, -D * 0.2], [W * 0.3, 0.05]].forEach(([lx, lz], i) => bau({ lx, lz, w: s, d: s, n: [18, 26, 14][i], art: i === 1 ? "glas" : "haus", c: i === 1 ? c : pk(STIL.modern), ly: geschossH(2), dach: "flach", balkon: i === 1 ? null : "kragen", technik: 1, eingang: false })); return "Turmensemble"; }]
    ],
    3: [ // Gewerbe niedrig – 3 Stufen
      [() => { const lz = vorn - 0.28; add("laden", 0, lz, 0.42, SOCKEL + ETAGE, 0.34, 0xf2efe8); dach("flach", 0, lz, 0.42, 0.34, SOCKEL + ETAGE, 0xe8493f, { attika: false }); markise(0, lz + 0.17, 0.45, pk(PAL.markise)); vorplatz(); bank(-0.3, vorn - 0.05); return "Kiosk"; },
       () => { const w = Math.min(W * 0.84, 0.86), d = 0.6, lz = VORNE(d, 0.06); bau({ lz, w, d, n: 2, c: pk(STIL.putz), laden: 0x8a5a3a, sc: 0xf2c14e, dach: "sattel", dc: pk(STIL.ziegel) }); vorplatz(); return "Bäckerei"; },
       () => { const w = Math.min(W * 0.75, 0.78), d = 0.5, lz = VORNE(d, 0.32); bau({ lz, w, d, n: 1, c: pk(STIL.laden), laden: pk(PAL.markise), dach: "flach" }); vorplatz(0xd8cbb0); const sc = pk(PAL.markise); for (const px of [-0.28, 0, 0.28]) { klein("flach", px, vorn - 0.12, 0.015, 0.22, 0.015, 0xdddddd); klein("dach", px, vorn - 0.12, 0.2, 0.06, 0.2, sc, { ly: 0.22 }); klein("flach", px, vorn - 0.12, 0.14, 0.012, 0.14, 0xf2f0ea, { ly: 0.1 }); } return "Café"; },
       () => { const w = Math.min(W * 0.7, 0.72), d = 0.5, lz = VORNE(d, 0.18); bau({ lz, w, d, n: 1, c: pk([0xf6d7e2, 0xd9f0e8, 0xfff0c8]), laden: pk([0xe85b9a, 0x4fbf7a, 0xf2a93b]), dach: "flach" }); vorplatz(); zyl(w * 0.45, vorn - 0.08, 0.1, 0.32, 0xf2c14e); return "Eisdiele"; },
       () => { const w = Math.min(W * 0.75, 0.8), d = 0.55, lz = VORNE(d, 0.14); bau({ lz, w, d, n: 2, c: pk(STIL.putz), laden: 0x2f8f6f, dach: "sattel", dc: pk(STIL.ziegel) }); vorplatz(); for (let k = 0; k < 5; k++) add("flach", -w / 2 + 0.08 + k * 0.12, vorn - 0.06, 0.09, 0.07, 0.07, pk([0xe85b9a, 0xf2c14e, 0xe8493f, 0x9a5be8, 0xffffff]), { ly: 0.005 }); return "Blumenladen"; },
       () => { const w = Math.min(W * 0.66, 0.7), d = 0.48, lz = VORNE(d, 0.24); bau({ lz, w, d, n: 1, c: 0xf2efe8, laden: 0xe8493f, sc: 0xf2c14e, dach: "flach", technik: 0.4 }); vorplatz(); bank(0.3, vorn - 0.05); return "Imbiss"; },
       () => { const w = Math.min(W * 0.84, 0.86), d = 0.6, lz = VORNE(d, 0.06); bau({ lz, w, d, n: 2, c: pk(STIL.altbau), art: "altbau", laden: 0x3a3d42, sc: 0xffffff, dach: "sattel", dc: pk(STIL.schiefer), gesims: true }); vorplatz(); return "Friseur"; },
       () => { const w = Math.min(W * 0.84, 0.86), d = 0.6, lz = VORNE(d, 0.06); bau({ lz, w, d, n: 2, c: 0xf4f4f2, laden: 0x2f8f6f, sc: 0xd9302f, dach: "flach" }); vorplatz(); return "Apotheke"; },
       () => { const w = Math.min(W * 0.8, 0.84), d = 0.56, lz = VORNE(d, 0.1); bau({ lz, w, d, n: 1, c: pk(STIL.klinker), laden: 0x3d5a80, dach: "pult", dc: 0x4a4e55 }); vorplatz(); fahrraeder(-0.3, vorn - 0.08, 6); return "Fahrradladen"; },
       () => { const w = Math.min(W * 0.84, 0.86), d = 0.6, lz = VORNE(d, 0.06); bau({ lz, w, d, n: 2, art: "fachwerk", c: 0xf4efe2, laden: 0x8a2f2f, dach: "sattel", dc: pk(STIL.ziegel), steil: true }); vorplatz(); return "Metzgerei"; }],
      [() => { const lz = vorn - 0.38, w = Math.min(W * 0.9, 0.95); add("flach", 0, lz, w, 0.05, 0.6, 0xf4f4f4, { ly: 0.46 }); add("flach", 0, lz + 0.31, w, 0.07, 0.02, 0xe8493f, { ly: 0.44 }); for (const px of [-0.35, 0.35]) for (const pz of [-0.22, 0.22]) add("flach", px * Math.min(W, 1), lz + pz, 0.04, 0.46, 0.04, 0xd9d9d9); for (const px of [-0.15, 0.15]) add("flach", px, lz, 0.07, 0.16, 0.1, 0xe8493f); flaeche(0, lz, w, 0.7, 0x6d7178); if (D >= 2) bau({ lz: lz - 0.6, w: 0.6, d: 0.34, n: 1, c: 0xf2efe8, laden: 0xe8493f, dach: "flach" }); add("flach", -W * 0.42, vorn - 0.08, 0.05, 0.6, 0.05, 0xd9d9d9); add("flach", -W * 0.42, vorn - 0.08, 0.2, 0.22, 0.03, 0xe8493f, { ly: 0.55 }); return "Tankstelle"; },
       () => { const w = Math.min(W * 0.8, 0.86), d = 0.62, lz = VORNE(d, 0.26); bau({ lz, w, d, n: 1, art: "altbau", c: pk([0xc96f4a, 0xd8c3a5, 0xe9d8bd]), laden: 0x5a3a24, dach: "sattel", dc: 0x5d6470, kamin: 1 }); vorplatz(0xd8cbb0); const sc = pk(PAL.markise); for (const px of [-0.25, 0.25]) { klein("flach", px, vorn - 0.1, 0.015, 0.2, 0.015, 0xdddddd); klein("dach", px, vorn - 0.1, 0.2, 0.05, 0.2, sc, { ly: 0.2 }); } return "Restaurant"; },
       () => { const w = Math.min(W * 0.8, 0.86), d = 0.58, lz = VORNE(d, 0.2); bau({ lz, w, d, n: 2, c: pk([0xf0d9a8, 0xe9c79a]), laden: 0x2f8f6f, sc: 0xe8493f, dach: "walm", dc: 0xc0653f, dachH: 0.18 }); vorplatz(0xd8cbb0); return "Pizzeria"; },
       () => { const w = Math.min(W * 0.86, 0.9), d = 0.62, lz = VORNE(d, 0.04); bau({ lz, w, d, n: 3, art: "altbau", c: pk(STIL.altbau), laden: pk(PAL.markise), dach: "mansard", dc: pk(STIL.schiefer), gauben: 2, gesims: true, balkon: "franz" }); vorplatz(); return "Laden mit Wohnung"; },
       () => { const w = Math.min(W * 0.84, 0.86), d = 0.6, lz = VORNE(d, 0.05); bau({ lz, w, d, n: 3, art: "fachwerk", c: 0xf2e8d0, laden: 0x3d5a80, dach: "sattel", dc: pk(STIL.ziegel), steil: true, gauben: 1 }); vorplatz(); return "Buchhandlung"; },
       () => { const w = Math.min(W * 0.84, 0.9), d = 0.6, lz = VORNE(d, 0.1); bau({ lz, w, d, n: 1, art: "holz", c: 0x9a7a55, laden: 0x4f9a3a, dach: "pult", dc: 0x4a5a3a, solar: true }); vorplatz(); for (let k = 0; k < 4; k++) add("flach", -0.3 + k * 0.2, vorn - 0.06, 0.14, 0.06, 0.08, pk([0x4f9a3a, 0xe8493f, 0xf2c14e]), { ly: 0.04 }); return "Bioladen"; },
       () => { const w = Math.min(W * 0.84, 0.86), d = 0.6, lz = VORNE(d, 0.05); bau({ lz, w, d, n: 2, art: "fachwerk", c: 0xf4efe2, laden: 0x6b2f3a, dach: "sattel", dc: pk(STIL.ziegel), steil: true }); vorplatz(0xd8cbb0); return "Weinstube"; },
       () => { const lz = VORNE(0.5, 0.42); bau({ lz, w: Math.min(W * 0.7, 0.75), d: 0.5, n: 1, c: 0xf2efe8, laden: 0xe8493f, sc: 0xf2c14e, dach: "flach", technik: 0.6 }); flaeche(0, vorn - 0.18, W * 0.95, 0.34, 0x6d7178); auto(-0.25, vorn - 0.18, true, 1); return "Burger-Restaurant"; }],
      [() => { const w = W * 0.88, d = Math.min(D * 0.75, 0.9), lz = VORNE(d, 0.04); bau({ lz, w, d, n: 3, c: pk(STIL.laden), laden: pk(PAL.markise), dach: "flach", balkon: "franz" }); vorplatz(); return "Boutiquenhaus"; },
       () => { const w = W * 0.86, d = Math.min(D * 0.75, 0.9), lz = VORNE(d, 0.08), c = pk(STIL.altbau); bau({ lz, w, d, n: 3, art: "altbau", c, dach: "mansard", dc: pk(STIL.schiefer), gauben: 2, gesims: true, balkon: "franz", eingang: "portal" }); schild(0, lz + d / 2, 0.4, 0xf2c14e, geschossH(3) - 0.16); klein("flach", 0, lz + d / 2 + 0.1, 0.32, 0.04, 0.2, 0x2f3540, { ly: 0.3 }); return "Kleines Hotel"; },
       () => { const n = W >= 2 ? 3 : 2, bw = W * 0.995 / n, d = Math.min(D * 0.75, 0.8), lz = VORNE(d, 0.04); for (let k = 0; k < n; k++) bau({ lx: -W * 0.46 + bw * (k + 0.5), lz, w: bw - 0.01, d, n: 1, c: STIL.laden[(h.variante + k) % STIL.laden.length], laden: PAL.markise[(h.variante + k) % PAL.markise.length], dach: "flach" }); vorplatz(); return "Ladenzeile"; },
       () => { const w = W * 0.995, d = Math.min(D * 0.7, 0.95), lz = VORNE(d, 0.02), c = pk(STIL.altbau); bau({ lz, w, d, n: 3, art: "altbau", c, dach: "sattel", dc: pk(STIL.ziegel), gesims: true, eingang: false, laden: 0x3a3d42 }); if (DS >= 1) for (let k = 0; k < Math.floor(w / 0.3); k++) add("flach", -w / 2 + 0.15 + k * 0.3, lz + d / 2 + 0.1, 0.05, SOCKEL + ETAGE, 0.05, hell(c, 0.4)); klein("flach", 0, lz + d / 2 + 0.1, w, 0.04, 0.22, hell(c, 0.3), { ly: SOCKEL + ETAGE }); return "Geschäftshaus mit Arkaden"; },
       () => { const w = W * 0.84, d = Math.min(D * 0.7, 0.9), lz = VORNE(d, 0.1); bau({ lz, w, d, n: 2, art: "glas", c: pk(STIL.glas), dach: "flach", eingang: "glas" }); vorplatz(0xe8e4dc); return "Galerie"; },
       () => { const w = W * 0.86, d = Math.min(D * 0.72, 0.95), lz = VORNE(d, 0.06); bau({ lz, w, d, n: 3, art: "buero", c: pk(STIL.buero), dach: "flach", technik: 0.5 }); vorplatz(); schild(0, lz + d / 2, 0.3, 0x2f8f6f, geschossH(1) - 0.06); return "Ärztehaus"; },
       () => { const w = W * 0.88, d = Math.min(D * 0.7, 0.9), lz = VORNE(d, 0.3); bau({ lz, w, d, n: 2, c: pk(STIL.putz), laden: pk(PAL.markise), dach: "sattel", dc: pk(STIL.ziegel), quer: true }); vorplatz(0xd8cbb0); for (const px of [-0.3, 0, 0.3]) { klein("flach", px, vorn - 0.12, 0.13, 0.012, 0.13, 0xf2f0ea, { ly: 0.1 }); klein("flach", px, vorn - 0.12, 0.015, 0.1, 0.015, 0x5d6470); } return "Bistro am Platz"; }]
    ],
    4: [ // Gewerbe hoch
      [() => { const d = Math.min(D * 0.5, 0.9), lz = -D / 2 + d / 2 + 0.1; bau({ lz, w: W * 0.92, d, n: 1, c: 0xeeeae2, laden: pk(PAL.markise), dach: "flach", technik: 1, hh: 0.55 }); parkplatz(0, vorn - (D - d - 0.3) / 2, W * 0.9, Math.max(0.4, D - d - 0.3), Math.max(2, Math.floor(W * 2.4))); return "Supermarkt"; },
       () => { const d = Math.min(D * 0.45, 0.8), lz = -D / 2 + d / 2 + 0.12; bau({ lz, w: W * 0.88, d, n: 1, c: pk([0xf2c14e, 0x3d5a80, 0xe8493f]), laden: 0xf4f4f4, dach: "flach", technik: 0.6, hh: 0.5 }); parkplatz(0, vorn - (D - d - 0.3) / 2, W * 0.9, Math.max(0.4, D - d - 0.3), Math.max(2, Math.floor(W * 2.4))); return "Discounter"; },
       () => { const d = Math.min(D * 0.55, 0.9), lz = -D / 2 + d / 2 + 0.12; bau({ lz, w: W * 0.85, d, n: 1, c: 0xf4f4f2, laden: 0xd9302f, sc: 0xffffff, dach: "flach", technik: 0.5 }); parkplatz(0, vorn - (D - d - 0.3) / 2, W * 0.9, Math.max(0.4, D - d - 0.3), Math.max(2, Math.floor(W * 2))); return "Drogeriemarkt"; },
       () => { const w = W * 0.88, d = D * 0.7, lz = VORNE(d, 0.04); bau({ lz, w, d, n: zi(3, 4), c: pk(STIL.laden), laden: pk(PAL.markise), dach: "flach", technik: 0.6, baender: true }); return "Geschäftshaus"; },
       () => { const d = Math.min(D * 0.6, 1.0), lz = -D / 2 + d / 2 + 0.12; bau({ lz, w: W * 0.88, d, n: 1, c: 0x3a3d42, laden: 0xe8493f, sc: 0xffffff, dach: "flach", technik: 0.8, hh: 0.6 }); parkplatz(0, vorn - (D - d - 0.3) / 2, W * 0.9, Math.max(0.4, D - d - 0.3), Math.max(2, Math.floor(W * 2))); return "Elektromarkt"; }],
      [() => { const w = W * 0.9, d = D * 0.76, lz = VORNE(d, 0.04), c = pk([0xe6dccb, 0xd8c3a5, 0xefe9df]); bau({ lz, w, d, n: 4, art: "altbau", c, laden: 0x2f3540, dach: "flach", gesims: true, technik: 0.8 }); schild(0, lz + d / 2, w * 0.4, pk(PAL.markise), geschossH(4) - 0.15); return "Kaufhaus"; },
       () => { const w = W * 0.82, d = Math.min(D * 0.7, 1.6), lz = VORNE(d, 0.1); bau({ lz, w, d, n: zi(6, 8), c: pk(STIL.putz), dach: "flach", balkon: "franz", technik: 1, eingang: "glas" }); klein("flach", 0, lz + d / 2 + 0.12, 0.5, 0.04, 0.24, 0x2f3540, { ly: 0.32 }); schild(0, lz + d / 2, 0.5, 0xf2c14e, geschossH(7) - 0.2); return "Hotel"; },
       () => { const w = W * 0.9, d = D * 0.75, lz = VORNE(d, 0.1); bau({ lz, w, d, n: 1, c: 0x2f343b, laden: 0x8a2f2f, sc: 0xf2c14e, dach: "flach", hh: 0.9, technik: 0.5 }); add("flach", 0, lz + d / 2 + 0.02, w * 0.7, 0.18, 0.03, 0xf4f4f4, { ly: 0.6 }); vorplatz(); return "Kino"; },
       () => { const d = Math.min(D * 0.6, 1.1), lz = -D / 2 + d / 2 + 0.1; bau({ lz, w: W * 0.9, d, n: 1, c: 0xf2a93b, laden: 0x3d5a80, dach: "sattel", dc: 0x8b9096, dachH: 0.18, hh: 0.6 }); parkplatz(0, vorn - (D - d - 0.3) / 2, W * 0.9, Math.max(0.4, D - d - 0.3), Math.max(2, Math.floor(W * 2))); return "Baumarkt"; },
       () => { const w = W * 0.9, d = D * 0.72, lz = VORNE(d, 0.08), c = pk(STIL.klinker); bau({ lz, w, d, n: 2, art: "altbau", c, dach: "sattel", dc: 0x5d6470, quer: false, eingang: "portal" }); klein("glas", 0, lz, w * 0.3, 0.12, d * 0.6, 0xbfe3ef, { ly: geschossH(2) + 0.2 }); vorplatz(0xd8cbb0); return "Markthalle"; }],
      [() => { const w = W * 0.92, d = D * 0.62, lz = -D / 2 + d / 2 + 0.08; bau({ lz, w, d, n: 2, c: 0xe9e4da, laden: pk(PAL.markise), dach: "flach", technik: 1.2 }); add("glas", 0, lz, w * 0.4, 0.2, d * 0.5, 0xa9d4ea, { ly: geschossH(2) }); parkplatz(0, vorn - 0.25, w, 0.4, Math.max(3, Math.floor(W * 2.4))); return "Einkaufszentrum"; },
       () => { const c = pk(STIL.glas), lz = VORNE(D * 0.7, 0.06); bau({ lz, w: W * 0.88, d: D * 0.7, n: 2, c: pk(STIL.laden), laden: 0x2f3540, dach: "flach" }); const s = Math.min(W, D) * 0.5; const y = bau({ lz: lz - 0.1, w: s, d: s, n: zi(14, 20), art: "glas", c, ly: geschossH(2), dach: "flach", technik: 1, eingang: false }); schild(0, lz - 0.1 + s / 2, s * 0.6, 0xf2c14e, y - 0.2); return "Hotelturm"; },
       () => { const d = Math.min(D * 0.6, 1.1), lz = -D / 2 + d / 2 + 0.1; bau({ lz, w: W * 0.92, d, n: 2, c: pk([0x3d5a80, 0xf2c14e, 0xf4f4f2]), art: "buero", dach: "flach", technik: 1, eingang: "glas" }); parkplatz(0, vorn - (D - d - 0.3) / 2, W * 0.9, Math.max(0.4, D - d - 0.3), Math.max(2, Math.floor(W * 2.4))); return "Möbelhaus"; },
       () => { const w = W * 0.88, d = D * 0.72, lz = VORNE(d, 0.12); bau({ lz, w, d, n: 3, art: "glas", c: pk(STIL.glas), dach: "flach", eingang: "glas" }); add("dach", 0, lz, w + 0.1, 0.35, d + 0.1, 0xc9ced6, { ly: geschossH(3) }); vorplatz(0xe8e4dc); return "Eventhalle"; },
       () => { const c = pk(STIL.glas); bau({ lz: VORNE(D * 0.8, 0.04), w: W * 0.92, d: D * 0.8, n: 3, c: pk(STIL.laden), laden: pk(PAL.markise), dach: "flach", baender: true }); const s = Math.min(W, D) * 0.48; let y = geschossH(3), sz = s; for (let k = 0; k < 3; k++) { y = bau({ lz: VORNE(D * 0.8, 0.04) - 0.1, w: sz, d: sz, n: zi(5, 7), art: "glas", c, ly: y, dach: "flach", eingang: false }); sz *= 0.82; } return "Shopping-Tower"; }]
    ],
    5: [ // Büros
      [() => { const w = W * 0.84, d = D * 0.7, lz = VORNE(d, 0.08); bau({ lz, w, d, n: zi(3, 4), art: "buero", c: pk(STIL.buero), dach: "flach", technik: 0.6 }); vorplatz(); return "Bürohaus"; },
       () => { const w = Math.min(W * 0.7, 0.8), d = 0.62, lz = VORNE(d, 0.2); bau({ lz, w, d, n: 2, art: "altbau", c: pk(STIL.altbau), dach: "walm", dc: pk(STIL.schiefer), gauben: 2, gesims: true }); garten(2); parkplatz(W * 0.3, -D / 2 + 0.25, 0.5, 0.3, 2); return "Bürovilla"; },
       () => { const w = W * 0.86, d = D * 0.7, lz = VORNE(d, 0.06); bau({ lz, w, d, n: 4, art: "altbau", c: pk(STIL.klinker), dach: "sattel", dc: 0x3f4650, quer: false, baender: true, gc: 0xd8cbb0 }); vorplatz(); return "Backstein-Loft"; },
       () => { const w = W * 0.84, d = D * 0.68, lz = VORNE(d, 0.08); bau({ lz, w, d, n: 3, c: pk(STIL.modern), dach: "flach", eingang: "glas", baender: true }); vorplatz(); return "Kanzleihaus"; },
       () => { const w = W * 0.86, d = D * 0.65, lz = VORNE(d, 0.12), n = Math.max(2, Math.round(W / 0.5)), bw = w / n; for (let k = 0; k < n; k++) bau({ lx: -w / 2 + bw * (k + 0.5), lz, w: bw - 0.02, d, n: 2 + (k % 2), art: "holz", c: pk(STIL.holz), dach: "flach", eingang: k === 0 ? "glas" : false }); vorplatz(); return "Gründerzentrum"; },
       () => { const w = W * 0.82, d = D * 0.7, lz = VORNE(d, 0.08); bau({ lz, w, d, n: zi(3, 5), art: "glas", c: pk(STIL.glas), dach: "flach", technik: 0.6 }); vorplatz(); return "Bürogebäude mit Glasfront"; }],
      [() => { const c = pk(STIL.buero), d = D * 0.36; bau({ lx: -W * 0.22, lz: vorn - d / 2 - 0.06, w: W * 0.4, d, n: 5, art: "buero", c, dach: "flach", technik: 0.5 }); bau({ lx: W * 0.22, lz: -D / 2 + d / 2 + 0.1, w: W * 0.4, d, n: 6, art: "buero", c, dach: "flach", technik: 0.5, eingang: false }); klein("glas", 0, 0, 0.3, 0.14, D * 0.5, 0x9fc0d2, { ly: geschossH(3) }); vorplatz(); return "Bürokomplex"; },
       () => { const s0 = Math.min(W, D) * 0.72, lz = VORNE(s0, 0.1); bau({ lz, w: s0, d: s0, n: zi(6, 8), art: "glas", c: pk(STIL.glas), dach: "flach", technik: 1 }); vorplatz(0xe8e4dc); return "Glasbürohaus"; },
       () => { const w = W * 0.86, d = D * 0.68, lz = VORNE(d, 0.16), c = pk(STIL.altbau); bau({ lz, w, d, n: 4, art: "altbau", c, dach: "flach", gesims: true, eingang: "portal", attika: false }); if (DS >= 1) for (let k = 0; k < 4; k++) zyl(-w * 0.3 + k * w * 0.2, lz + d / 2 + 0.08, 0.06, geschossH(2), hell(c, 0.4)); klein("flach", 0, lz + d / 2 + 0.08, w * 0.75, 0.06, 0.12, hell(c, 0.4), { ly: geschossH(2) }); vorplatz(0xd8cbb0); return "Bankgebäude"; },
       () => { const w = W * 0.9, d = D * 0.72, lz = VORNE(d, 0.1); bau({ lz, w, d, n: 2, art: "glas", c: pk(STIL.glas), dach: "flach", garten: true, eingang: "glas" }); vorplatz(); baum(-W * 0.4, vorn - 0.1, 0.35); return "Tech-Campus"; },
       () => { const w = W * 0.86, d = D * 0.6, lz = VORNE(d, 0.1); bau({ lz, w, d, n: zi(5, 7), art: "buero", c: pk(STIL.buero), dach: "flach", technik: 1, baender: false }); vorplatz(); return "Verwaltungsgebäude"; },
       () => { const lz = VORNE(D * 0.6, 0.1), c = pk(STIL.modern); bau({ lz, w: W * 0.5, d: D * 0.6, n: 3, art: "buero", c, dach: "flach", lx: -W * 0.2 }); bau({ lx: W * 0.08, lz: lz + 0.05, w: W * 0.7, d: D * 0.5, n: 2, art: "glas", c: pk(STIL.glas), ly: geschossH(3), dach: "flach", eingang: false, technik: 0.5 }); vorplatz(); return "Medienhaus"; }],
      [() => { const s0 = Math.min(W, D) * 0.62, lz = VORNE(s0, 0.12), c = pk(STIL.glas); const y = bau({ lz, w: s0, d: s0, n: zi(18, 26), art: "glas", c, dach: "flach", eingang: "glas" }); add("glas", 0, lz, s0 * 0.72, 0.5, s0 * 0.72, c, { ly: y }); add("flach", 0, lz, 0.03, 0.9, 0.03, 0xc9ced6, { ly: y + 0.5 }); vorplatz(0xe8e4dc); return "Wolkenkratzer"; },
       () => { const c = pk(STIL.glas), lz = VORNE(Math.min(W, D) * 0.78, 0.1); let y = 0, sz = Math.min(W, D) * 0.78; for (let k = 0; k < 4; k++) { y = bau({ lz, w: sz, d: sz, n: zi(4, 7), art: "glas", c, ly: y, dach: "flach", eingang: k ? false : "glas" }); sz *= 0.8; } add("flach", 0, lz, 0.03, 0.7, 0.03, 0xc9ced6, { ly: y }); return "Gestufter Glasturm"; },
       () => { const c = pk(STIL.glas); if (W >= 2.9) { const s = Math.min(0.8, W * 0.27); for (const lx of [-W * 0.23, W * 0.23]) bau({ lx, lz: VORNE(s, 0.12), w: s, d: s, n: zi(24, 28), art: "glas", c, dach: "flach", technik: 1, eingang: "glas" }); add("glas", 0, VORNE(s, 0.12), W * 0.3, 0.32, 0.3, c, { ly: 3.4 }); return "Zwillingstürme"; } const s0 = Math.min(W, D) * 0.6; bau({ lz: VORNE(s0, 0.12), w: s0, d: s0, n: 24, art: "glas", c, dach: "flach", technik: 1 }); return "Büroturm"; },
       () => { const c = pk(STIL.glas), s0 = Math.min(W, D) * 0.55, lz = VORNE(s0 * 1.2, 0.12), n = zi(20, 26); for (const ry of [0, Math.PI / 4]) add("glas", 0, lz, s0, geschossH(n), s0, c, { ry }); dach("flach", 0, lz, s0, s0, geschossH(n), null, { attika: false }); eingang(0, lz + s0 * 0.7, "glas", c); vorplatz(0xe8e4dc); return "Achteckturm"; },
       () => { const c = pk(STIL.glas), s0 = Math.min(W, D) * 0.58, lz = VORNE(s0, 0.12); const y = bau({ lz, w: s0, d: s0, n: zi(20, 28), art: "glas", c, dach: "flach", attika: false, eingang: "glas" }); dach("zelt", 0, lz, s0, s0, y, dunkel(c, 0.2), { h: 0.9, ue: 0 }); add("flach", 0, lz, 0.025, 1.2, 0.025, 0xd9dde2, { ly: y + 0.85 }); return "Bankenturm mit Spitze"; },
       () => { const c = pk(STIL.glas), s0 = Math.min(W, D) * 0.6, lz = VORNE(s0, 0.12); const y = bau({ lz, w: s0, d: s0, n: zi(24, 30), art: "buero", c: pk(STIL.buero), dach: "flach", technik: 0.4, eingang: "glas" }); zyl(0, lz, s0 * 0.7, 0.03, 0x4a4e55, { ly: y + 0.02 }); add("flach", 0, lz, 0.25, 0.005, 0.04, 0xffffff, { ly: y + 0.052 }); add("flach", 0, lz, 0.04, 0.005, 0.25, 0xffffff, { ly: y + 0.052 }); return "Turm mit Hubschrauberplatz"; },
       () => { const c = pk(STIL.glas); bau({ lz: VORNE(D * 0.75, 0.06), w: W * 0.92, d: D * 0.75, n: 3, art: "glas", c: pk(STIL.buero), dach: "flach", garten: true, eingang: "glas" }); const s = Math.min(W, D) * 0.5; bau({ lx: W * 0.15, lz: -D * 0.1, w: s, d: s, n: zi(18, 24), art: "glas", c, ly: geschossH(3), dach: "flach", technik: 1, eingang: false }); return "Konzernzentrale"; }]
    ],
    6: [ // Industrie
      [() => { const w = W * 0.86, d = D * 0.55, lz = VORNE(d, 0.1); bau({ lz, w, d, n: 1, c: pk(STIL.halle), dach: "sattel", dc: 0x8b9096, dachH: 0.14, hh: 0.5, eingang: false }); add("flach", 0, lz + d / 2 + 0.006, w * 0.4, 0.32, 0.012, 0x6d737a); flaeche(0, vorn - 0.06, W * 0.95, 0.2, 0x6d7178); return "Werkstatt"; },
       () => { const w = W * 0.88, d = D * 0.65, lz = VORNE(d, 0.12); bau({ lz, w, d, n: 1, c: pk(STIL.halle), dach: "sattel", dc: 0x9aa1a8, dachH: 0.16, hh: 0.55, quer: d > w, eingang: false }); for (let k = 0; k < Math.min(4, Math.floor(w / 0.4)); k++) add("flach", -w / 2 + 0.25 + k * 0.4, lz + d / 2 + 0.006, 0.28, 0.34, 0.012, 0x55595f); flaeche(0, vorn - 0.06, W * 0.95, 0.2, 0x6d7178); return "Lagerhalle"; },
       () => { flaeche(0, 0, W * 0.9, D * 0.85, 0x8c8a84); for (let k = 0; k < 7; k++) add("dach", (r() - 0.5) * W * 0.7, (r() - 0.5) * D * 0.6, 0.3 + r() * 0.3, 0.12 + r() * 0.15, 0.3 + r() * 0.3, pk([0x7a5a3a, 0x8a8f96, 0x6d4c3a, 0xa36a3a]), { ry: r() * 3 }); bau({ lx: W * 0.3, lz: vorn - 0.25, w: 0.35, d: 0.3, n: 1, c: 0xb5b0a5, dach: "flach" }); return "Schrottplatz"; },
       () => { const w = W * 0.84, d = D * 0.55, lz = VORNE(d, 0.2); bau({ lz, w, d, n: 1, c: 0xf4f4f4, dach: "flach", hh: 0.55, eingang: false }); for (let k = 0; k < 2; k++) add("flach", -w * 0.25 + k * w * 0.5, lz + d / 2 + 0.006, w * 0.35, 0.34, 0.012, 0x3a3d42); schild(0, lz + d / 2, w * 0.5, 0x3d5a80, 0.46); flaeche(0, vorn - 0.1, W * 0.95, 0.28, 0x6d7178); auto(-0.2, vorn - 0.1, true, 2); auto(0.2, vorn - 0.1, true, 5); return "Autowerkstatt"; }],
      [() => { const w = W * 0.88, d = D * 0.75, lz = VORNE(d, 0.1), hh = 0.7; add("haus", 0, lz, w, hh, d, pk(STIL.halle)); const n = Math.max(2, Math.round(d / 0.32)); for (let k = 0; k < n; k++) add("pult", 0, lz - d / 2 + d / n * (k + 0.5), w, 0.2, d / n, 0x9aa1a8, { ly: hh, ry: Math.PI }); zyl(-w / 2 + 0.2, lz - d / 2 + 0.2, 0.16, 1.5, 0xb5523a, { schlot: true }); return "Fabrikhalle mit Sheddach"; },
       () => { const lz = vorn - 0.45; bau({ lx: -W * 0.28, lz, w: 0.55, d: 0.55, n: 1, c: pk(STIL.halle), dach: "pult", dc: 0x8b9096, eingang: false }); for (let k = 0; k < Math.min(4, W); k++) { zyl(-W * 0.05 + k * 0.38, lz - 0.2, 0.34, 1.0 + r() * 0.3, 0xd8dade); dach("zelt", -W * 0.05 + k * 0.38, lz - 0.2, 0.34, 0.34, 1.3, 0xb9bec4, { h: 0.12, ue: 0 }); } return "Silos"; },
       () => { const w = W * 0.9, d = D * 0.55, lz = -D / 2 + d / 2 + 0.1; bau({ lz, w, d, n: 1, c: 0xd0c8b8, dach: "flach", hh: 0.65, eingang: false, technik: 0.4 }); for (let k = 0; k < Math.min(5, Math.floor(w / 0.42)); k++) add("flach", -w / 2 + 0.3 + k * 0.42, lz + d / 2 + 0.006, 0.28, 0.34, 0.012, 0x55595f); for (let k = 0; k < 2; k++) lkw(-w * 0.25 + k * w * 0.5, vorn - 0.35); flaeche(0, vorn - 0.3, W * 0.95, 0.6, 0x6d7178); return "Logistikzentrum"; },
       () => { const w = W * 0.84, d = D * 0.62, lz = VORNE(d, 0.12); bau({ lz, w, d, n: 2, art: "altbau", c: pk(STIL.klinker), dach: "sattel", dc: 0x5d6470, eingang: false }); zyl(w / 2 - 0.2, lz - d / 2 + 0.1, 0.2, 2.0, 0xa9533b, { schlot: true }); for (let k = 0; k < 4; k++) add("flach", -w * 0.3 + k * 0.15, vorn - 0.12, 0.12, 0.12, 0.12, 0xb8653f, { ly: 0.005 }); return "Ziegelei"; }],
      [() => { const w = W * 0.86, d = D * 0.78, hh = 0.85, lz = VORNE(d, 0.1); bau({ lz, w, d, n: 2, hh, c: pk(STIL.halle), dach: "sattel", dc: 0x8b9096, dachH: 0.2, eingang: false }); zyl(-w / 2 + 0.2, lz - d / 2 + 0.2, 0.16, 1.7, 0xb5523a, { schlot: true }); zyl(w / 2 - 0.35, lz - d / 2 - 0.3, 0.5, 0.6, 0xc8ccd0); container(-w * 0.3, vorn - 0.12, true); return "Fabrik"; },
       () => { const w = W * 0.86, d = D * 0.78, hh = 0.8, lz = VORNE(d, 0.1); add("haus", -w / 4, lz, w / 2 - 0.05, hh, d, pk(STIL.halle)); add("haus", w / 4, lz, w / 2 - 0.05, hh * 0.8, d, pk(STIL.halle)); dach("sattel", -w / 4, lz, w / 2 - 0.05, d, hh, 0x8b9096, { h: 0.18, quer: true }); dach("flach", w / 4, lz, w / 2 - 0.05, d, hh * 0.8, 0x9aa0a8, {}); add("flach", 0, lz, w * 0.9, 0.06, 0.12, 0x6d737a, { ly: hh * 0.7 }); zyl(-w / 2 + 0.25, lz - d / 2 + 0.25, 0.18, 1.9, 0xb5523a, { schlot: true }); zyl(w / 2 - 0.25, lz - d / 2 + 0.25, 0.18, 1.7, 0xb5523a, { schlot: true }); return "Großfabrik"; },
       () => { const lz = vorn - D * 0.4; bau({ lx: -W * 0.3, lz: vorn - 0.3, w: 0.6, d: 0.4, n: 2, art: "buero", c: pk(STIL.halle), dach: "flach" }); for (let k = 0; k < 3; k++) { zyl(-W * 0.1 + k * 0.5, lz - 0.2, 0.42, 0.75, 0xe9ecef); dach("zelt", -W * 0.1 + k * 0.5, lz - 0.2, 0.42, 0.42, 0.75, 0xd8dade, { h: 0.1, ue: 0 }); } add("flach", 0.2, lz + 0.15, W * 0.6, 0.05, 0.05, 0x9aa0a8, { ly: 0.5 }); zyl(W * 0.38, lz + 0.3, 0.14, 1.7, 0xb5523a, { schlot: true }); return "Chemiewerk"; },
       () => { const w = W * 0.9, d = D * 0.7, lz = VORNE(d, 0.1); bau({ lz, w, d, n: 3, hh: 1.1, c: 0x6d737a, dach: "sattel", dc: 0x4a4e55, dachH: 0.25, eingang: false }); zyl(-w * 0.35, lz - d / 2 - 0.1, 0.3, 2.3, 0x8a8f96, { schlot: true }); zyl(-w * 0.1, lz - d / 2 - 0.1, 0.3, 2.3, 0x8a8f96, { schlot: true }); add("flach", w * 0.3, lz + d / 2 + 0.1, 0.12, 0.6, 0.12, 0xe8493f); container(w * 0.1, vorn - 0.12, true); return "Stahlwerk"; }]
    ],
    7: [[ // Landwirtschaft
      () => { const n = Math.max(4, Math.round(D / 0.22)); for (let k = 0; k < n; k++) add("flach", 0, -D / 2 + 0.1 + (D - 0.4) / n * (k + 0.5), W * 0.88, 0.03, (D - 0.4) / n * 0.8, k % 2 ? 0xe2c26a : 0xd4b257, { ly: 0.004 }); bau({ lx: W * 0.35, lz: vorn - 0.2, w: 0.42, d: 0.3, n: 1, c: 0xa8432f, dach: "sattel", dc: 0x5a4636, eingang: false }); return "Getreidefeld"; },
      () => { const n = Math.max(4, Math.round(D / 0.2)); for (let k = 0; k < n; k++) add("flach", 0, -D / 2 + 0.1 + (D - 0.4) / n * (k + 0.5), W * 0.88, 0.045, (D - 0.4) / n * 0.55, 0x4f9a3a, { ly: 0.004 }); add("flach", W * 0.35, vorn - 0.2, 0.35, 0.25, 0.25, 0x9a7a5a); return "Gemüsefeld"; },
      () => { bau({ lx: -W * 0.25, lz: vorn - 0.35, w: 0.6, d: 0.45, n: 1, art: "holz", c: 0xa8432f, dach: "sattel", dc: 0x5a4636, steil: true, eingang: false }); zyl(W * 0.05, vorn - 0.35, 0.3, 1.0, 0xd8dade); dach("zelt", W * 0.05, vorn - 0.35, 0.3, 0.3, 1.0, 0x8a8f96, { h: 0.12, ue: 0 }); bau({ lx: W * 0.3, lz: vorn - 0.3, w: 0.4, d: 0.35, n: 1, art: "fachwerk", c: 0xf2efe8, dach: "sattel", dc: 0xa8432f }); for (let k = 0; k < 5; k++) add("flach", (r() - 0.5) * W * 0.7, -D * 0.25 + (r() - 0.5) * D * 0.3, 0.12, 0.08, 0.06, k % 2 ? 0xf4f4f4 : 0x2c2f36, { ly: 0.01 }); return "Bauernhof"; },
      () => { const n = Math.max(2, Math.min(4, W)); for (let k = 0; k < n; k++) { const x = -W * 0.45 + W * 0.9 / n * (k + 0.5), bw = W * 0.9 / n - 0.08; add("glas", x, -0.1, bw, 0.22, D * 0.7, 0xcfe8ef); dach("sattel", x, -0.1, bw, D * 0.7, 0.22, 0xdff0f4, { quer: true, h: 0.12, ue: 0 }); } return "Gewächshäuser"; },
      () => { flaeche(0, 0, W * 0.9, D * 0.85, 0x7fc463); zaun(1); for (let k = 0; k < 6; k++) { const x = (r() - 0.5) * W * 0.7, z = (r() - 0.5) * D * 0.6; add("flach", x, z, 0.08, 0.08, 0.16, k % 2 ? 0xf4f4f4 : 0x5a3a24, { ly: 0.03, ry: r() * 3 }); } bau({ lx: W * 0.3, lz: vorn - 0.25, w: 0.4, d: 0.32, n: 1, art: "holz", c: 0x8a2f24, dach: "sattel", dc: 0x5a4636, eingang: false }); return "Kuhweide"; }
    ]],
    8: [[ // Forstwirtschaft
      () => { const w = W * 0.6, lz = vorn - 0.4; bau({ lx: -W * 0.15, lz, w, d: 0.6, n: 1, art: "holz", c: 0x9c7a55, dach: "sattel", dc: 0x5a4636, eingang: false }); for (let k = 0; k < 3; k++) add("flach", W * 0.3, -D * 0.2 + k * 0.28 - 0.3, 0.5, 0.18, 0.2, 0x8b5a2b); return "Sägewerk"; },
      () => { for (let k = 0; k < 8; k++) add("flach", (r() - 0.5) * W * 0.75, (r() - 0.5) * D * 0.7, 0.5, 0.16 + r() * 0.1, 0.2, 0x8b5a2b, { ry: r() < 0.5 ? 0 : Math.PI / 2 }); add("flach", W * 0.38, vorn - 0.3, 0.05, 1.1, 0.05, 0xf2c14e); add("flach", W * 0.2, vorn - 0.3, 0.45, 0.05, 0.05, 0xf2c14e, { ly: 1.05 }); return "Holzlager"; },
      () => { for (let a = -W * 0.4; a < W * 0.45; a += 0.35) for (let b = -D * 0.4; b < D * 0.35; b += 0.35) baum(a, b, 0.35 + r() * 0.15); add("flach", W * 0.35, vorn - 0.2, 0.3, 0.25, 0.25, 0x9a7a5a); return "Baumschule"; },
      () => { bau({ lz: vorn - 0.35, w: 0.6, d: 0.5, n: 2, art: "holz", c: 0x6b4a2f, dach: "sattel", dc: 0x4a5a3a, steil: true }); for (let k = 0; k < 4; k++) baum((r() - 0.5) * W * 0.8, -D * 0.3 + r() * 0.2, 0.5); add("flach", W * 0.3, vorn - 0.15, 0.24, 0.14, 0.12, 0x4a5a3a, { ly: 0.01 }); return "Försterei"; }
    ]]
  };
  const stufen = L[h.zone], liste = stufen[Math.min(h.stufe, stufen.length) - 1];
  h.name = liste[h.variante % liste.length]();
  if (h.zone === 1) gartenDetails();
  if (h.zone === 1 && !(T.plaetze && T.plaetze.length)) { add("flach", 0, vorn - 0.06, Math.min(W * 0.8, 0.62), 0.006, 0.17, 0xa7a49c, { ly: 0.002 }); auto(0, vorn - 0.06, true, 0); if (!T.park) T.park = { lx: 0, lz: vorn - 0.06 }; }
  if (!T.park) {
    if ([2, 4, 5].includes(h.zone) && W >= 1.5) { const x = W / 2 - 0.17; add("flach", x, vorn - 0.04, 0.2, 0.012, 0.16, 0x3a3e46, { ly: 0.004 }); klein("flach", x, vorn - 0.1, 0.24, 0.03, 0.06, 0xd8dade, { ly: 0.2 }); klein("flach", x, vorn + 0.02, 0.2, 0.004, 0.02, 0xf2c14e, { ly: 0.017 }); T.park = { lx: x, lz: vorn - 0.12, tief: true }; T.plaetze = T.plaetze || []; const n = h.zone === 2 ? 4 + h.stufe * 2 : 4 + h.stufe; for (let i = 0; i < n; i++) T.plaetze.push({ lx: x, lz: vorn - 0.12, rot: Math.PI / 2, tief: true }); }
    else T.park = { lx: h.zone >= 6 ? 0 : W * 0.3, lz: vorn - (h.zone >= 6 ? 0.25 : 0.06) };
  }
  return T;
}
const KATALOG_ANZAHL = () => 145;

function hausWeg(h) { if (!h) return; parkenWeg(h); for (const id of h.zellen) { const z = zellen.get(id); if (z) z.haus = null; } haeuser.delete(h.id); haeuserNeu = zellenNeu = true; if (ZONEN[h.zone].gruppe === "i") dreckZeichnen(); }
function neuesHaus(d, alt) {
  const h = Object.assign({ id: d.id || hId++, geboren: alt ? -100 : jetztS, simGeboren: alt ? -100 : simZeit, ab: 0, zug: null }, d); hId = Math.max(hId, h.id + 1);
  let x = 0, z = 0, sx = 0, sz = 0; h.zellen.forEach((id) => { const c = zellen.get(id); c.haus = h.id; x += c.x; z += c.z; sx += Math.sin(c.rot); sz += Math.cos(c.rot); });
  h.x = x / h.zellen.length; h.z = z / h.zellen.length; h.rot = Math.atan2(sx, sz);
  h.teile = hausTeile(h); h.box = null; h.hoehe = hoeheVon(h); haeuser.set(h.id, h); if (h.bau) { h.bauT = bauTeile(h, 0, h.bau.art); h.bau.ph = 0; } haeuserNeu = zellenNeu = true; parkenNeu(h);
  const rr = Math.max(h.w, h.d) * 0.62 + 0.2; baeumeFaellen({ x0: h.x - rr, x1: h.x + rr, z0: h.z - rr, z1: h.z + rr }, (bx, bz) => Math.hypot(bx - h.x, bz - h.z) < rr);
  return h;
}
/* Baustellen: Grube → Rohbau mit Gerüst und Kran → fertiges Haus; beim Aufstieg ein Gerüst */
function bauTeile(h, ph, art) {
  const b = boxVon(h) || { x0: -0.4, x1: 0.4, z0: -0.4, z1: 0.4 }, w = b.x1 - b.x0, d = b.z1 - b.z0, mx = (b.x0 + b.x1) / 2, mz = (b.z0 + b.z1) / 2, H = Math.max(0.4, h.hoehe || 1);
  const T = art === "aufstieg" ? h.teile.slice() : [], a = (bb, lx, lz, sx, sy, sz, c, ly) => T.push({ b: bb, lx, lz, sx, sy, sz, c, ly: ly || 0 });
  const geruest = (hoch, rundum) => {
    const seiten = rundum ? [[0, 1], [0, -1], [1, 0], [-1, 0]] : [[0, 1]];
    for (const [sx, sz] of seiten) {
      const lang = sx ? d : w, cx = mx + sx * (w / 2 + 0.05), cz = mz + sz * (d / 2 + 0.05), n = Math.max(2, Math.round(lang / 0.35));
      for (let i = 0; i <= n; i++) { const t = -lang / 2 + lang * i / n; a("flach", cx + (sx ? 0 : t), cz + (sz ? 0 : t), 0.012, hoch + 0.1, 0.012, 0x9aa0a8); }
      for (let y = ETAGE; y < hoch + 0.05; y += ETAGE) a("flach", cx, cz, sx ? 0.07 : lang, 0.01, sx ? lang : 0.07, 0xb08a5a, y);
      if (rundum && sz === 1) a("flach", cx, cz + 0.01, lang * 0.98, hoch * 0.9, 0.004, 0x5f8f6a, 0.05);
    }
  };
  if (art === "aufstieg") { geruest(H, true); return T; }
  a("flach", mx, mz, w + 0.3, 0.004, d + 0.3, 0x8a7458, 0.002);
  for (const [sx, sz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const lang = (sx ? d : w) + 0.34; a("flach", mx + sx * (w / 2 + 0.17), mz + sz * (d / 2 + 0.17), sx ? 0.012 : lang, 0.12, sx ? lang : 0.012, 0xe8e8e8); a("flach", mx + sx * (w / 2 + 0.17), mz + sz * (d / 2 + 0.172), sx ? 0.014 : lang, 0.03, sx ? lang : 0.014, 0xe8742a, 0.06); }
  a("flach", mx + w / 2 - 0.12, mz - d / 2 + 0.1, 0.22, 0.1, 0.1, 0x3d6fb0);
  if (ph === 0) {
    a("flach", mx, mz, w * 0.9, 0.006, d * 0.9, 0x5a4632, 0.004);
    const bx = mx - w * 0.2, bz = mz + d * 0.1; a("flach", bx, bz, 0.14, 0.04, 0.1, 0x2c2f36); a("flach", bx, bz, 0.12, 0.08, 0.09, 0xf2b630, 0.04); a("flach", bx - 0.03, bz, 0.05, 0.06, 0.06, 0x3a4a5a, 0.12); a("flach", bx + 0.13, bz, 0.16, 0.025, 0.025, 0xf2b630, 0.12);
    a("flach", mx + w * 0.25, mz - d * 0.15, 0.18, 0.05, 0.12, 0x8a6a4a, 0.004);
    return T;
  }
  const hoch = ph === 1 ? H * 0.5 : H * 0.95;
  a("haus", mx, mz, w, 0.05, d, 0xa8a49c);
  if (ph === 1) {
    for (let y = ETAGE; y < hoch; y += ETAGE) a("flach", mx, mz, w, 0.03, d, 0xb8b4ac, y);
    for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) a("flach", mx + sx * (w / 2 - 0.03), mz + sz * (d / 2 - 0.03), 0.04, hoch, 0.04, 0xb8b4ac);
  } else a("haus", mx, mz, w * 0.98, hoch, d * 0.98, 0xb3aea4);
  geruest(hoch, ph === 2);
  if (H > 0.9) { const kx = mx - w / 2 - 0.25, kz = mz, kh = H + 0.5, arm = Math.max(w, d) * 0.9 + 0.3; a("flach", kx, kz, 0.06, kh, 0.06, 0xf2b630); a("flach", kx + arm / 2 - 0.15, kz, arm, 0.04, 0.05, 0xf2b630, kh); a("flach", kx - 0.25, kz, 0.14, 0.08, 0.1, 0x6d7178, kh - 0.04); a("flach", kx + arm * 0.55, kz, 0.004, kh - hoch - 0.1, 0.004, 0x2c2f36, hoch + 0.1); a("flach", kx, kz, 0.2, 0.04, 0.2, 0x8c8f94); }
  return T;
}
function bauTakt() {
  for (const h of haeuser.values()) {
    if (!h.bau) continue; const q = (simZeit - h.bau.start) / h.bau.dauer;
    if (q >= 1) { const neu = h.bau.art === "neu"; h.bau = null; h.bauT = null; if (neu) { h.geboren = jetztS; h.ab = 0.6; parkenNeu(h); } haeuserNeu = true; continue; }
    const ph = h.bau.art === "neu" ? Math.min(2, Math.floor(q * 3)) : 0;
    if (ph !== h.bau.ph) { h.bau.ph = ph; h.bauT = bauTeile(h, ph, h.bau.art); haeuserNeu = true; }
  }
}
const imBau = (h) => h.bau && h.bau.art === "neu";
const leute = (h) => h.verlassen || imBau(h) ? 0 : LEUTE[h.zone] ? LEUTE[h.zone][Math.min(h.stufe, 5)] * h.zellen.length : 0;
const jobs = (h) => { if (h.verlassen || imBau(h)) return 0; const t = JOBS[h.zone]; return t ? t[Math.min(h.stufe, t.length - 1)] * h.zellen.length : 0; };
const gruppe = (h) => ZONEN[h.zone].gruppe;
const zoneFrei = (z) => meilenstein >= (ZONEN[z].ab || 0);
/* Bodenwert (0–100): Bäume, Alleen, Wasser und Läden heben ihn – Hauptstraßen und Dreck senken ihn */
function dreckBei(x, z, ohne) {
  let d = 0;
  for (const q of industrieListe) { if (q === ohne) continue; const r = q.zone === 6 ? 5 + q.stufe : q.zone === 7 ? 3 : 4, e = Math.hypot(q.x - x, q.z - z); if (e < r) d += (1 - e / r) * (q.zone === 6 ? 45 : 18); }
  for (const q of dienste.values()) { const r = DIENSTE[q.typ].dreck; if (!r) continue; const e = Math.hypot(q.x - x, q.z - z); if (e < r) d += (1 - e / r) * 50; }
  return Math.min(100, d);
}
function bodenwert(x, z, ohne) {
  let w = 24, b = 0;
  baeumeIn(x - 3, z - 3, x + 3, z + 3, (t) => { if (!t.weg && Math.hypot(t.x - x, t.z - z) < 3) b++; });
  w += Math.min(22, b * 1.6);
  const a = abstand(x, z); if (a < 9) w += 24 * (1 - Math.max(0, a - 3) / 6);
  if (naechsteKante({ x, z }, 3.2, (k) => !!TYP[k.typ].baeume)) w += 12;
  if (naechsteKante({ x, z }, 3.2, (k) => rang(k) >= 2 && !k.aussen)) w -= 10;
  if (naechsteKante({ x, z }, 3.2, (k) => k.parken)) w += 4;
  let laeden = 0; for (const q of ladenListe) if (Math.hypot(q.x - x, q.z - z) < 6) laeden++;
  w += Math.min(14, laeden * 4);
  let park = 0, dienstPlus = 0; const gedeckt = new Set();
  for (const q of dienste.values()) { const D = DIENSTE[q.typ]; if (!D.radius) continue; if (D.wert) { const e = Math.hypot(q.x - x, q.z - z); if (e < D.radius) park += D.wert * (1 - e / D.radius); } else if (!gedeckt.has(D.kat) && abdeckung(x, z, D.kat) > 0) gedeckt.add(D.kat); }
  w += Math.min(26, park) + gedeckt.size * 3;
  for (const s of halte.values()) if (s.inLinie && Math.hypot(s.x - x, s.z - z) < HALT_RADIUS) { w += 4; break; }
  const dreck = dreckBei(x, z, ohne);
  return { wert: klemme(Math.round(w - dreck * 0.9), 0, 100), dreck: Math.round(dreck) };
}
function werteAuffrischen() { listenAuffrischen(); for (const h of haeuser.values()) { const r = bodenwert(h.x, h.z, h); h.wert = r.wert; h.dreck = r.dreck; } }
/* Dreck-Flecken um Industrie */
const dreckTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), v = g.createRadialGradient(32, 32, 2, 32, 32, 32); v.addColorStop(0, "rgba(255,255,255,1)"); v.addColorStop(0.6, "rgba(255,255,255,.6)"); v.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = v; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const dreckMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: dreckTex, transparent: true, opacity: 0.5, depthWrite: false, color: 0xffffff }), 800);
dreckMesh.count = 0; dreckMesh.frustumCulled = false; dreckMesh.renderOrder = 1; dreckMesh.setColorAt(0, new THREE.Color()); szene.add(dreckMesh);
function dreckZeichnen() {
  let i = 0;
  for (const h of haeuser.values()) {
    if (gruppe(h) !== "i" || i >= 800) continue;
    const r = h.zone === 6 ? 5 + h.stufe : h.zone === 7 ? 3 : 4;
    _o.position.set(h.x, G + 0.006, h.z); _o.rotation.set(0, h.variante % 6, 0); _o.scale.set(r, 1, r); _o.updateMatrix(); dreckMesh.setMatrixAt(i, _o.matrix);
    dreckMesh.setColorAt(i, _farbe.setHex(h.zone === 6 ? 0x6b5233 : h.zone === 7 ? 0x8a6a3a : 0x6d5a3a)); i++;
  }
  for (const h of dienste.values()) {
    const r = DIENSTE[h.typ].dreck; if (!r || i >= 800) continue;
    _o.position.set(h.x, G + 0.006, h.z); _o.rotation.set(0, h.variante % 6, 0); _o.scale.set(r, 1, r); _o.updateMatrix(); dreckMesh.setMatrixAt(i, _o.matrix);
    dreckMesh.setColorAt(i, _farbe.setHex(0x5a4a33)); i++;
  }
  dreckMesh.count = i; dreckMesh.instanceMatrix.needsUpdate = true; if (dreckMesh.instanceColor) dreckMesh.instanceColor.needsUpdate = true;
}
/* ⬆️ beim Aufstieg */
const hochTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); g.fillStyle = "#2fbf5a"; g.beginPath(); g.arc(32, 32, 28, 0, 7); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.moveTo(32, 12); g.lineTo(50, 34); g.lineTo(39, 34); g.lineTo(39, 52); g.lineTo(25, 52); g.lineTo(25, 34); g.lineTo(14, 34); g.closePath(); g.fill(); return new THREE.CanvasTexture(c); })();
const hochSprites = [], hochListe = [];
for (let i = 0; i < 16; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: hochTex, transparent: true, depthTest: false })); sp.visible = false; sp.renderOrder = 9; sp.scale.setScalar(0.9); szene.add(sp); hochSprites.push(sp); }
function hochZeigen(h, y) { hochListe.push({ x: h.x, z: h.z, y, t: jetztS }); if (hochListe.length > 16) hochListe.shift(); }
function hochZeichnen() {
  for (let i = 0; i < 16; i++) {
    const sp = hochSprites[i], q = hochListe[i];
    if (!q || jetztS - q.t > 2.4) { sp.visible = false; continue; }
    const f = (jetztS - q.t) / 2.4; sp.visible = true; sp.position.set(q.x, BODEN + q.y + 0.4 + f * 1.2, q.z); sp.material.opacity = f < 0.75 ? 1 : (1 - f) * 4;
  }
}
/* Bodenwert-Ansicht */
const wertMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.92, 0.92).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }), 40000);
wertMesh.count = 0; wertMesh.frustumCulled = false; wertMesh.renderOrder = 3; wertMesh.setColorAt(0, new THREE.Color()); wertMesh.visible = false; szene.add(wertMesh);
let wertAnsicht = false, wertZeit = -9;
function wertFarbe(v) { const rot = farbe(0xff4a3d), gelb = farbe(0xffd23d), gruen = farbe(0x2fd66b); return v < 50 ? rot.lerp(gelb, v / 50) : gelb.lerp(gruen, (v - 50) / 50); }
function wertFarbeU(v) { const a = farbe(0x8a5a2b), b2 = farbe(0xffd23d), c = farbe(0x2fd66b); return v < 50 ? a.lerp(b2, v / 50) : b2.lerp(c, (v - 50) / 50); }
function wertZeichnen() {
  wertMesh.visible = wertAnsicht; if (!wertAnsicht) return; wertZeit = jetztS; listenAuffrischen();
  let i = 0;
  for (const z of zellen.values()) {
    const h = z.haus && haeuser.get(z.haus), A = ansicht && ANSICHTEN[ansicht], v = A && A.wert ? A.wert(z, h) : h ? (h.wert ?? 0) : bodenwert(z.x, z.z).wert;
    if (v == null) continue;
    _o.position.set(z.x, h ? BODEN + 0.02 : G + 0.04, z.z); _o.rotation.set(0, z.rot, 0); _o.scale.set(1, 1, 1); _o.updateMatrix(); wertMesh.setMatrixAt(i, _o.matrix); wertMesh.setColorAt(i, A && A.umgekehrt ? wertFarbeU(v) : wertFarbe(v)); i++;
  }
  wertMesh.count = i; wertMesh.instanceMatrix.needsUpdate = true; if (wertMesh.instanceColor) wertMesh.instanceColor.needsUpdate = true;
}
/* Zufahrt eines Hauses (Punkt auf der nächsten befahrbaren Straße) */
function zufahrt(h) {
  if (h.zug && h.zugV === netzVersion) return h.zug;
  const f = { x: h.x + Math.sin(h.rot) * (h.d * ZELLE / 2 + 0.3), z: h.z + Math.cos(h.rot) * (h.d * ZELLE / 2 + 0.3) };
  const e = naechsteKante(f, 3.5, (k) => TYP[k.typ].autos && !k.ring && !k.ebene);
  h.zug = e ? { k: e.k.id, S: e.s } : null; h.zugV = netzVersion; return h.zug;
}
const federn = (t) => { const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
let rauchTeile = [];
function haeuserZeichnen() {
  let anim = false; const n = {}; for (const k in B) if (k !== "rauch") n[k] = 0; rauchTeile = [];
  drehListe = []; torListe = [];
  for (const h of [...haeuser.values(), ...dienste.values(), ...halte.values()]) {
    const p = Math.min(1, Math.max(0, (jetztS - h.geboren) / 0.7)); if (p < 1) anim = true;
    const e = h.ab + (1 - h.ab) * (1 - Math.pow(1 - p, 3)), cs = Math.cos(h.rot), sn = Math.sin(h.rot);
    for (const t of h.bauT || h.teile) {
      const m = B[t.b]; if (n[t.b] >= m.instanceMatrix.count) continue;
      const wx = h.x + t.lx * cs + t.lz * sn, wz = h.z - t.lx * sn + t.lz * cs;
      if (t.tor) { torListe.push({ d: h, t, x: wx, z: wz, rot: h.rot }); continue; }
      if (t.rund) { const f = p >= 1 ? 1 : (p > 0 ? federn(p) : 0); _o.position.set(wx, BODEN + (t.ly || 0) * e, wz); _o.scale.set(t.sx * f + 1e-4, t.sy * f + 1e-4, t.sz * f + 1e-4); }
      else if (t.fest) { _o.position.set(wx, G + 0.012, wz); _o.scale.set(t.sx, t.sy, t.sz); }
      else { _o.position.set(wx, BODEN + t.ly * e, wz); _o.scale.set(t.sx, Math.max(t.sy * e, 1e-4), t.sz); }
      _o.rotation.set(t.rx || 0, h.rot + (t.ry || 0), t.rz || 0, "YXZ"); _o.updateMatrix(); m.setMatrixAt(n[t.b], _o.matrix);
      if (t.dreh) drehListe.push({ m, i: n[t.b], h, t, x: _o.position.x, y: _o.position.y, z: _o.position.z });
      if (t.c != null) _farbe.setHex(t.c); else _farbe.setRGB(0.85 + (h.variante % 7) * 0.02, 0.9, 0.85);
      if (h.verlassen) _farbe.lerp(GRAU, 0.65); m.setColorAt(n[t.b], _farbe);
      n[t.b]++;
      if (t.schlot && p >= 1) rauchTeile.push({ x: wx, y: BODEN + t.sy, z: wz, ph: (h.variante % 100) / 13 });
    }
  }
  for (const k in n) { const m = B[k]; m.count = n[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  _o.rotation.order = "XYZ"; haeuserNeu = anim;
  let ai = 0;
  if (aoMesh.visible) for (const h of [...haeuser.values(), ...dienste.values()]) {
    if (ai >= 6000) break; const b = h.box || (h.box = boxVon(h)); if (!b) continue;
    const cs = Math.cos(h.rot), sn = Math.sin(h.rot), mx = (b.x0 + b.x1) / 2, mz = (b.z0 + b.z1) / 2;
    _o.position.set(h.x + mx * cs + mz * sn, G + 0.021, h.z - mx * sn + mz * cs); _o.rotation.set(0, h.rot, 0); _o.scale.set((b.x1 - b.x0) * 1.35 + 0.15, 1, (b.z1 - b.z0) * 1.35 + 0.15); _o.updateMatrix(); aoMesh.setMatrixAt(ai++, _o.matrix);
  }
  aoMesh.count = ai; aoMesh.instanceMatrix.needsUpdate = true;
}
const GRAU = new THREE.Color(0x77736c); let drehListe = [], torListe = [];
const torPool = becken(G_BOX_UNTEN, M.flach, 600, true);
function toreZeichnen(dt) {
  let i = 0;
  for (const g of torListe) {
    let ziel = 0; for (const f of fahrzeuge) if (f.dienstId === g.d.id && f.pos && Math.abs(f.pos.x - g.x) < 1.6 && Math.abs(f.pos.z - g.z) < 1.6 && Math.hypot(f.pos.x - g.x, f.pos.z - g.z) < 1.4) { ziel = 1; break; }
    g.t.auf = (g.t.auf || 0) + klemme(ziel - (g.t.auf || 0), -dt * 1.5, dt * 1.5); const a = g.t.auf * 0.9;
    if (i >= 600) break; _o.position.set(g.x, BODEN + g.t.ly + g.t.sy * a, g.z); _o.rotation.set(0, g.rot, 0); _o.scale.set(g.t.sx, Math.max(0.004, g.t.sy * (1 - a)), g.t.sz); _o.updateMatrix(); torPool.setMatrixAt(i, _o.matrix); torPool.setColorAt(i++, _farbe.setHex(g.t.c));
  }
  torPool.count = i; torPool.instanceMatrix.needsUpdate = true; if (torPool.instanceColor) torPool.instanceColor.needsUpdate = true;
}
const aoTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), v = g.createRadialGradient(32, 32, 6, 32, 32, 32); v.addColorStop(0, "rgba(0,0,0,0.9)"); v.addColorStop(0.55, "rgba(0,0,0,0.55)"); v.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = v; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const aoMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, opacity: 0.42, depthWrite: false }), 6000);
aoMesh.count = 0; aoMesh.frustumCulled = false; aoMesh.renderOrder = 1; szene.add(aoMesh);
function boxVon(h) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const t of h.teile) { if (t.fest || t.rand || t.b === "flach" && t.sy < 0.05 || t.rund) continue; const q = Math.abs(Math.sin(t.ry || 0)) > 0.7, ex = (q ? t.sz : t.sx) / 2, ez = (q ? t.sx : t.sz) / 2; x0 = Math.min(x0, t.lx - ex); x1 = Math.max(x1, t.lx + ex); z0 = Math.min(z0, t.lz - ez); z1 = Math.max(z1, t.lz + ez); } return x0 < x1 ? { x0, x1, z0, z1 } : null; }
function drehZeichnen() {
  for (const e of drehListe) { _o.position.set(e.x, e.y, e.z); _o.rotation.set(e.t.rx || 0, e.h.rot + (e.t.ry || 0), (e.t.rz || 0) + jetztS * e.t.dreh, "YXZ"); _o.scale.set(e.t.sx, e.t.sy, e.t.sz); _o.updateMatrix(); e.m.setMatrixAt(e.i, _o.matrix); e.m.instanceMatrix.needsUpdate = true; }
  _o.rotation.order = "XYZ";
}
function rauchZeichnen() {
  let i = 0; const m = B.rauch;
  for (const r of rauchTeile) for (let k = 0; k < 4 && i < 800; k++) {
    const f = ((jetztS * 0.35 + r.ph + k / 4) % 1), s = 0.12 + f * 0.32;
    _o.position.set(r.x + f * 0.5 + Math.sin(jetztS + k) * 0.05, r.y + 0.05 + f * 1.3, r.z + f * 0.2); _o.rotation.set(f, f * 2, 0); _o.scale.set(s, s, s); _o.updateMatrix();
    m.setMatrixAt(i, _o.matrix); m.setColorAt(i, _farbe.setScalar(1 - f * 0.25)); i++;
  }
  for (const h of haeuser.values()) {
    if (!h.brand) continue;
    for (let k = 0; k < 10 && i < 800; k++) {
      const f = ((jetztS * (k < 5 ? 1.4 : 0.5) + k / 5 + h.id * 0.13) % 1), feuer = k < 5, s = feuer ? 0.25 * (1 - f) + 0.08 : 0.2 + f * 0.45;
      _o.position.set(h.x + Math.sin(k * 2.1 + jetztS) * 0.18, BODEN + (feuer ? (h.hoehe || 0.6) * 0.5 + f * 0.7 : (h.hoehe || 0.6) + 0.3 + f * 1.6), h.z + Math.cos(k * 1.7) * 0.18); _o.rotation.set(f, f * 2, 0); _o.scale.set(s, s, s); _o.updateMatrix();
      m.setMatrixAt(i, _o.matrix); m.setColorAt(i, feuer ? _farbe.setRGB(1, 0.35 + f * 0.4, 0.05) : _farbe.setRGB(0.25, 0.24, 0.24)); i++;
    }
  }
  m.count = i; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
}
function alleeZeichnen() {
  let i = 0;
  for (const k of kanten.values()) { const T = TYP[k.typ]; if (!T.baeume) continue; for (let s2 = 1.2; s2 < k.len - 1.0 && i < 5990; s2 += 1.6) { const p = punktBei(k, s2); for (const o of T.baeume) for (const sei of o ? [1, -1] : [1]) { _o.position.set(p.x - p.tz * o * sei, G + 0.016 + ebeneY(k, s2), p.z + p.tx * o * sei); _o.rotation.set(0, s2 * 3.7, 0); _o.scale.setScalar(0.85); _o.updateMatrix(); alleeBaeume.setMatrixAt(i, _o.matrix); alleeBaeume.setColorAt(i++, _farbe.setRGB(0.9, 1, 0.9)); } } }
  alleeBaeume.count = i; alleeBaeume.instanceMatrix.needsUpdate = true; if (alleeBaeume.instanceColor) alleeBaeume.instanceColor.needsUpdate = true;
}

/* ================================================================
   Dienste: Strom, Wasser, Müll, Polizei, Feuerwehr, Gesundheit, Bildung, Parks
   ================================================================ */
const DIENST_KAT = {
  verkehr: { em: "🚆", name: "Bahn & Hafen" }, freizeit: { em: "🎡", name: "Freizeit" }, wahrzeichen: { em: "🗼", name: "Wahrzeichen" },
  strom: { em: "⚡", name: "Strom" }, wasser: { em: "💧", name: "Wasser" }, muell: { em: "🗑️", name: "Müll" },
  polizei: { em: "🚓", name: "Polizei" }, feuer: { em: "🚒", name: "Feuerwehr" }, gesund: { em: "🏥", name: "Gesundheit" }, bildung: { em: "🎓", name: "Bildung" }, park: { em: "🌳", name: "Parks" }
};
const DIENSTE = {
  windrad: { kat: "strom", name: "Windrad", em: "🌬️", preis: 3000, unterhalt: 60, w: 1, d: 1, strom: 250, text: "Sauberer Strom, aber nicht viel." },
  solar: { kat: "strom", name: "Solarpark", em: "☀️", preis: 9000, unterhalt: 140, w: 3, d: 3, strom: 900, ab: 1, text: "Viel sauberer Strom, braucht aber Platz." },
  kohle: { kat: "strom", name: "Kohlekraftwerk", em: "🏭", preis: 16000, unterhalt: 320, w: 4, d: 4, strom: 3500, dreck: 9, ab: 2, text: "Sehr viel Strom – aber Rauch und Dreck." },
  gas: { kat: "strom", name: "Gaskraftwerk", em: "🔥", preis: 22000, unterhalt: 380, w: 3, d: 3, strom: 4500, dreck: 4, ab: 2, text: "Viel Strom, weniger Dreck als Kohle." },
  geothermie: { kat: "strom", name: "Geothermie", em: "🌋", preis: 20000, unterhalt: 260, w: 2, d: 2, strom: 2400, ab: 3, text: "Wärme aus der Erde – sauber und zuverlässig." },
  wasserkraft: { kat: "strom", name: "Wasserkraftwerk", em: "🌊", preis: 26000, unterhalt: 300, w: 3, d: 2, strom: 3600, amWasser: true, ab: 3, text: "Sauberer Strom aus Wasser. Muss am Ufer stehen." },
  atom: { kat: "strom", name: "Atomkraftwerk", em: "☢️", preis: 60000, unterhalt: 900, w: 4, d: 4, strom: 14000, ab: 5, text: "Riesig viel Strom für eine Metropole." },
  pumpe: { kat: "wasser", name: "Wasserpumpe", em: "🚰", preis: 2500, unterhalt: 50, w: 1, d: 2, wasser: 1200, amWasser: true, text: "Pumpt Wasser aus See oder Meer. Muss am Ufer stehen." },
  wasserturm: { kat: "wasser", name: "Wasserturm", em: "🗼", preis: 4500, unterhalt: 90, w: 2, d: 2, wasser: 600, text: "Wasser auch weit weg vom Ufer." },
  wasserwerk: { kat: "wasser", name: "Großes Wasserwerk", em: "🏭", preis: 15000, unterhalt: 250, w: 3, d: 3, wasser: 4500, amWasser: true, ab: 3, text: "Sehr viel Wasser. Muss am Ufer stehen." },
  klaer: { kat: "wasser", name: "Kläranlage", em: "🚽", preis: 4000, unterhalt: 80, w: 2, d: 3, abwasser: 1200, text: "Reinigt das Abwasser der Stadt." },
  aufbereitung: { kat: "wasser", name: "Wasseraufbereitung", em: "💠", preis: 12000, unterhalt: 200, w: 2, d: 2, abwasser: 2000, ab: 2, text: "Reinigt Abwasser besonders sauber – kein Dreck." },
  grossklaer: { kat: "wasser", name: "Großkläranlage", em: "🛢️", preis: 18000, unterhalt: 280, w: 3, d: 3, abwasser: 4500, ab: 3, text: "Für sehr große Städte." },
  deponie: { kat: "muell", name: "Mülldeponie", em: "🗑️", preis: 4000, unterhalt: 100, w: 3, d: 3, muell: 1200, dreck: 4, text: "Müllautos holen den Müll bei den Häusern ab." },
  recycling: { kat: "muell", name: "Recyclinghof", em: "♻️", preis: 9000, unterhalt: 150, w: 2, d: 2, muell: 1500, ab: 2, recycling: true, text: "Weniger Müll in der ganzen Stadt (−10 % je Hof)." },
  verbrennung: { kat: "muell", name: "Müllverbrennung", em: "♨️", preis: 15000, unterhalt: 260, w: 3, d: 3, muell: 4500, strom: 300, dreck: 5, ab: 3, text: "Verbrennt viel Müll und macht nebenbei Strom." },
  muellheiz: { kat: "muell", name: "Müllheizkraftwerk", em: "🏭", preis: 30000, unterhalt: 450, w: 3, d: 3, muell: 9000, strom: 900, dreck: 6, ab: 4, text: "Riesige Anlage: Müll wird zu Strom." },
  polizei: { kat: "polizei", name: "Polizeiwache", em: "🚓", preis: 6000, unterhalt: 120, w: 2, d: 2, radius: 13, kap: 1800, text: "Weniger Kriminalität. Streifenwagen fahren Runden." },
  praesidium: { kat: "polizei", name: "Polizeipräsidium", em: "👮", preis: 20000, unterhalt: 340, w: 3, d: 3, radius: 24, kap: 7000, ab: 4, text: "Große Reichweite und viel Platz." },
  polizeiheli: { kat: "polizei", name: "Polizei-Hubschrauber", em: "🚁", preis: 25000, unterhalt: 400, w: 2, d: 2, radius: 40, kap: 6000, luft: true, ab: 4, text: "Fliegt über alles – wirkt im großen Kreis." },
  gefaengnis: { kat: "polizei", name: "Gefängnis", em: "⛓️", preis: 18000, unterhalt: 300, w: 3, d: 3, gefaengnis: true, ab: 3, text: "Weniger Kriminalität in der ganzen Stadt." },
  feuerklein: { kat: "feuer", name: "Kleine Feuerwache", em: "🧯", preis: 3000, unterhalt: 60, w: 1, d: 2, radius: 8, kap: 800, zuege: 1, text: "Klein und günstig für Wohngebiete." },
  feuerwache: { kat: "feuer", name: "Feuerwache", em: "🚒", preis: 6000, unterhalt: 120, w: 2, d: 2, radius: 13, kap: 2500, zuege: 2, text: "Löschzüge fahren zu Bränden." },
  hauptwache: { kat: "feuer", name: "Hauptfeuerwache", em: "🚒", preis: 20000, unterhalt: 340, w: 3, d: 3, radius: 24, kap: 8000, zuege: 5, ab: 4, text: "Große Reichweite und Drehleiter für Hochhäuser." },
  waldbrand: { kat: "feuer", name: "Waldbrand-Wache", em: "🌲", preis: 6000, unterhalt: 90, w: 2, d: 2, radius: 18, kap: 1200, zuege: 1, luft: true, ab: 1, text: "Schützt Felder, Wälder und Außenbezirke im großen Kreis." },
  loeschheli: { kat: "feuer", name: "Löschhubschrauber", em: "🚁", preis: 25000, unterhalt: 400, w: 2, d: 2, radius: 40, kap: 6000, zuege: 2, luft: true, ab: 4, text: "Löscht von oben – wirkt im großen Kreis." },
  arzt: { kat: "gesund", name: "Arztpraxis", em: "🩺", preis: 3000, unterhalt: 70, w: 1, d: 2, radius: 8, kap: 700, text: "Kleine Praxis für die Nachbarschaft." },
  kinderarzt: { kat: "gesund", name: "Kinderarzt", em: "🧸", preis: 3500, unterhalt: 70, w: 1, d: 2, radius: 9, kap: 800, text: "Für Familien – macht Wohngebiete beliebter." },
  krankenhaus: { kat: "gesund", name: "Krankenhaus", em: "🏥", preis: 15000, unterhalt: 300, w: 3, d: 3, radius: 22, kap: 5000, ab: 2, text: "Krankenwagen für die ganze Gegend." },
  altenheim: { kat: "gesund", name: "Altenheim", em: "👵", preis: 6000, unterhalt: 120, w: 2, d: 2, radius: 10, kap: 900, ab: 1, text: "Für ältere Leute – macht die Gegend zufriedener." },
  rettungsheli: { kat: "gesund", name: "Rettungshubschrauber", em: "🚁", preis: 25000, unterhalt: 400, w: 2, d: 2, radius: 40, kap: 6000, luft: true, ab: 4, text: "Hilft schnell im großen Kreis." },
  friedhof: { kat: "gesund", name: "Friedhof", em: "🪦", preis: 4000, unterhalt: 60, w: 2, d: 3, froh: 2, einzig: true, ab: 1, text: "Ein ruhiger Ort – die Stadt ist etwas zufriedener." },
  krematorium: { kat: "gesund", name: "Krematorium", em: "⚱️", preis: 9000, unterhalt: 120, w: 2, d: 2, froh: 2, einzig: true, dreck: 3, ab: 3, text: "Die Stadt ist etwas zufriedener." },
  kindergarten: { kat: "bildung", name: "Kindergarten", em: "🧒", preis: 3000, unterhalt: 70, w: 1, d: 2, radius: 8, bildung: 1, kap: 250, text: "Für die Kleinsten – Bildung Stufe 1." },
  grundschule: { kat: "bildung", name: "Grundschule", em: "🏫", preis: 5000, unterhalt: 110, w: 2, d: 3, radius: 11, bildung: 1, kap: 400, text: "Bildung Stufe 1 – Wohnhäuser können auf Stufe 3+ wachsen." },
  bibliothek: { kat: "bildung", name: "Bibliothek", em: "📚", preis: 6000, unterhalt: 100, w: 2, d: 2, radius: 14, bildung: 1, kap: 1500, wert: 5, ab: 1, text: "Bildung Stufe 1 für viele – und schöner Wohnen." },
  gymnasium: { kat: "bildung", name: "Gymnasium", em: "🎒", preis: 12000, unterhalt: 220, w: 3, d: 3, radius: 17, bildung: 2, kap: 1000, ab: 2, text: "Bildung Stufe 2 – Stufe 5 und mehr Büros statt Fabriken." },
  berufsschule: { kat: "bildung", name: "Berufsschule", em: "🛠️", preis: 10000, unterhalt: 190, w: 3, d: 2, radius: 16, bildung: 2, kap: 800, ab: 2, text: "Bildung Stufe 2 mit Werkstätten." },
  uni: { kat: "bildung", name: "Universität", em: "🎓", preis: 30000, unterhalt: 480, w: 4, d: 4, radius: 32, bildung: 3, kap: 3000, ab: 4, text: "Bildung Stufe 3 – die klügste Stadt." },
  spielplatz: { kat: "park", name: "Spielplatz", em: "🛝", preis: 600, unterhalt: 10, w: 1, d: 1, radius: 5, wert: 8, text: "Macht die Nachbarschaft schöner." },
  park: { kat: "park", name: "Park", em: "🌳", preis: 1500, unterhalt: 25, w: 2, d: 2, radius: 7, wert: 12, text: "Bäume und Wege – höherer Bodenwert." },
  brunnen: { kat: "park", name: "Brunnenplatz", em: "⛲", preis: 2500, unterhalt: 35, w: 2, d: 2, radius: 7, wert: 14, ab: 1, text: "Ein schöner Platz mit Brunnen." },
  sportplatz: { kat: "park", name: "Sportplatz", em: "⚽", preis: 4000, unterhalt: 60, w: 3, d: 2, radius: 9, wert: 10, ab: 1, text: "Fußball für alle." },
  grosspark: { kat: "park", name: "Großer Park", em: "🏞️", preis: 6000, unterhalt: 80, w: 3, d: 3, radius: 12, wert: 18, ab: 2, text: "Großer Park mit Teich." },
  schwimmbad: { kat: "freizeit", name: "Schwimmbad", em: "🏊", preis: 8000, unterhalt: 120, w: 3, d: 2, radius: 12, wert: 12, ab: 1, text: "Abkühlung für die ganze Gegend." },
  rathaus: { kat: "freizeit", name: "Rathaus", em: "🏛️", preis: 15000, unterhalt: 150, w: 3, d: 3, radius: 15, wert: 10, froh: 3, einzig: true, ab: 1, text: "Das Herz der Stadt – alle sind etwas zufriedener." },
  museum: { kat: "freizeit", name: "Museum", em: "🖼️", preis: 20000, unterhalt: 250, w: 3, d: 3, radius: 18, wert: 16, ab: 2, text: "Kultur – und Touristen kommen." },
  stadion: { kat: "freizeit", name: "Stadion", em: "🏟️", preis: 40000, unterhalt: 500, w: 4, d: 4, radius: 25, wert: 15, froh: 2, ab: 3, text: "Großer Sport – die ganze Stadt jubelt." },
  zoo: { kat: "freizeit", name: "Zoo", em: "🦁", preis: 30000, unterhalt: 400, w: 4, d: 4, radius: 20, wert: 18, ab: 3, text: "Tiere ansehen – sehr beliebt bei Familien." },
  freizeitpark: { kat: "freizeit", name: "Freizeitpark", em: "🎢", preis: 45000, unterhalt: 550, w: 4, d: 4, radius: 22, wert: 20, froh: 2, ab: 4, text: "Achterbahn und Spaß für alle." },
  leuchtturm: { kat: "wahrzeichen", name: "Leuchtturm", em: "🗼", preis: 20000, unterhalt: 100, w: 2, d: 2, radius: 15, wert: 12, froh: 2, einzig: true, amWasser: true, ab: 1, text: "Wahrzeichen am Ufer." },
  riesenrad: { kat: "wahrzeichen", name: "Riesenrad", em: "🎡", preis: 30000, unterhalt: 200, w: 3, d: 3, radius: 20, wert: 15, froh: 2, einzig: true, ab: 2, text: "Wahrzeichen – man sieht es von überall." },
  fernsehturm: { kat: "wahrzeichen", name: "Fernsehturm", em: "📡", preis: 50000, unterhalt: 300, w: 2, d: 2, radius: 30, wert: 15, froh: 3, einzig: true, ab: 3, text: "Das höchste Gebäude der Stadt." },
  busdepot: { kat: "verkehr", name: "Busdepot", em: "🅿️", preis: 8000, unterhalt: 120, w: 3, d: 3, depot: "bus", text: "Hier starten die Busse. Ohne Depot fahren keine Busse." },
  tramdepot: { kat: "verkehr", name: "Straßenbahn-Depot", em: "🚋", preis: 15000, unterhalt: 200, w: 3, d: 3, depot: "tram", ab: 3, text: "Hier starten die Straßenbahnen." },
  bahnhof: { kat: "verkehr", name: "Bahnhof", em: "🚆", preis: 25000, unterhalt: 300, w: 3, d: 3, ab: 2, text: "Züge bringen Pendler und Touristen – mehr Bedarf an Wohnungen und Läden." },
  parkplatz: { kat: "verkehr", name: "Parkplatz", em: "🅿️", preis: 2500, unterhalt: 20, w: 2, d: 2, radius: 8, wert: 5, text: "Kunden finden einen Parkplatz – Läden und Büros in der Nähe werden wertvoller." },
  parkhaus: { kat: "verkehr", name: "Parkhaus", em: "🏢", preis: 12000, unterhalt: 90, w: 2, d: 2, radius: 13, wert: 8, ab: 3, text: "Viele Parkplätze auf wenig Platz – gut für die Innenstadt." },
  hafen: { kat: "verkehr", name: "Frachthafen", em: "🚢", preis: 30000, unterhalt: 350, w: 4, d: 3, ab: 1, amWasser: true, dreck: 5, text: "Schiffe bringen Waren – mehr Bedarf an Industrie, Lkw fahren vom Hafen los. Muss am Ufer stehen." }
};
const RESSOURCEN = { strom: { em: "⚡", name: "Strom" }, wasser: { em: "💧", name: "Wasser" }, abwasser: { em: "🚽", name: "Abwasser" }, muell: { em: "🗑️", name: "Müllabfuhr" } };
const dienste = new Map(); let dId = 1;
const PARK_KATS = ["park", "freizeit", "wahrzeichen"];
const budgetBereich = { strom: 100, wasser: 100, muell: 100, polizei: 100, feuer: 100, gesund: 100, bildung: 100, park: 100 };
const bKat = (kat) => PARK_KATS.includes(kat) || kat === "verkehr" ? "park" : kat;
const ausbauFak = (d) => 1 + 0.6 * (d.ausbau || 0), budgetFak = (kat) => (budgetBereich[bKat(kat)] || 100) / 100;
const entwLeistung = (r) => r === "strom" ? (hatEntw("strom1") ? 1.15 : 1) * (hatEntw("strom2") ? 1.15 : 1) : r === "wasser" ? (hatEntw("wasser1") ? 1.15 : 1) : r === "abwasser" ? (hatEntw("wasser2") ? 1.2 : 1) : r === "muell" ? (hatEntw("muell1") ? 1.2 : 1) * (hatEntw("muell2") ? 1.15 : 1) : 1;
const entwReich = (kat) => hatEntw(kat + "1") && ["polizei", "feuer", "gesund", "bildung"].includes(kat) ? 1.2 : 1;
const leistungVon = (d, r) => (DIENSTE[d.typ][r] || 0) * ausbauFak(d) * budgetFak(DIENSTE[d.typ].kat) * entwLeistung(r);
const kapVon = (d) => (DIENSTE[d.typ].kap || 0) * ausbauFak(d) * budgetFak(DIENSTE[d.typ].kat) * (DIENSTE[d.typ].kat === "bildung" && hatEntw("bildung2") ? 1.25 : 1);
const reichVon = (d) => DIENSTE[d.typ].radius * (1 + 0.15 * (d.ausbau || 0)) * Math.sqrt(budgetFak(DIENSTE[d.typ].kat)) * entwReich(DIENSTE[d.typ].kat);
const unterhaltVon = (d) => DIENSTE[d.typ].unterhalt * (1 + 0.5 * (d.ausbau || 0)) * budgetFak(DIENSTE[d.typ].kat);
const ausbaubar = (D) => !PARK_KATS.includes(D.kat) && D.kat !== "verkehr" && !D.einzig && !D.gefaengnis;
const globalFroh = () => { let f = 0; for (const d of dienste.values()) f += DIENSTE[d.typ].froh || 0; return Math.min(12, f) + (hatEntw("wirt3") ? 4 : 0); };
const dienstFrei = (t) => meilenstein >= (DIENSTE[t].ab || 0);
/* Dienstgebäude aus dem Gebäude-Baukasten – mit Toren für die Fahrzeuge */
const DIENST_NEU = (function () {
  const POL = 0x1f4fbf, ROT = 0xc23b2f, WEISS = 0xf2f4f6;
  return {
    setup(K, o) {
      const { add, klein, fein, bau, flaeche, zyl, baum, schild, dach } = K, { W, D, vorn, r, DS } = o;
      const tor = (x, front, w, hh, c) => { (o.tore = o.tore || []).push({ lx: x, lz: front - 0.18 }); add("flach", x, front + 0.008, w, hh, 0.014, c == null ? 0x8a9099 : c, { ly: 0.004, tor: true }); if (DS >= 1) for (let k = 1; k < 4; k++) add("flach", x, front + 0.016, w, 0.006, 0.004, 0x5d6470, { ly: 0.004 + hh * k / 4 }); klein("flach", x, front + 0.01, w + 0.04, 0.025, 0.02, 0xd8dade, { ly: hh + 0.004 }); };
      const hof = (x, z, w, d, c) => flaeche(x, z, w, d, c == null ? 0x6d7178 : c);
      const fahne = (x, z, c) => { if (DS < 1) return; add("flach", x, z, 0.015, 0.75, 0.015, 0xd9dde2); add("flach", x + 0.07, z, 0.13, 0.08, 0.006, c, { ly: 0.64 }); };
      const blaulichtAuto = (x, z, c, quer, licht) => { add("flach", x, z, quer ? 0.26 : 0.14, 0.1, quer ? 0.14 : 0.26, c, { ly: 0.01 }); klein("flach", x, z, quer ? 0.05 : 0.1, 0.02, quer ? 0.1 : 0.05, licht == null ? 0x2f6bff : licht, { ly: 0.11 }); };
      const lkwAuto = (x, z, c) => { add("flach", x, z, 0.16, 0.17, 0.48, c, { ly: 0.01 }); klein("flach", x, z - 0.05, 0.12, 0.03, 0.3, 0xd8dade, { ly: 0.18 }); };
      const kreuz = (x, z, y, s, c) => { add("flach", x, z, s, s * 0.32, 0.02, c, { ly: y }); add("flach", x, z, s * 0.32, s, 0.02, c, { ly: y - s * 0.34 }); };
      const hPlatz = (x, z, y, s) => { zyl(x, z, s, 0.03, 0x3a3e46, { ly: y }); add("flach", x - s * 0.18, z, 0.04, 0.006, s * 0.5, 0xffffff, { ly: y + 0.03 }); add("flach", x + s * 0.18, z, 0.04, 0.006, s * 0.5, 0xffffff, { ly: y + 0.03 }); add("flach", x, z, s * 0.36, 0.006, 0.04, 0xffffff, { ly: y + 0.03 }); };
      const saeulen = (x, front, w, hh, c, n) => { if (DS < 1) return; for (let k = 0; k < n; k++) zyl(x - w / 2 + w / (n - 1 || 1) * k, front + 0.09, 0.07, hh, c); add("flach", x, front + 0.09, w + 0.12, 0.05, 0.16, c, { ly: hh }); dach("sattel", x, front + 0.09, w + 0.12, 0.16, hh + 0.05, c, { quer: false, h: 0.14, ue: 0 }); flaeche(x, front + 0.12, w + 0.16, 0.22, 0xd8d4cc, 0.005); };
      const wache = (n, w0) => { // Feuerwache mit n Toren
        const w = Math.min(W * 0.92, n * 0.36 + 0.1), d = Math.min(D * 0.6, 0.85), lz = vorn - d / 2 - 0.36, lx = -W / 2 + w / 2 + 0.04, front = lz + d / 2;
        bau({ lx, lz, w, d, n: 1, hh: 0.5, c: ROT, dach: "flach", eingang: false, attika: true });
        for (let k = 0; k < n; k++) tor(lx - w / 2 + w / n * (k + 0.5), front, w / n * 0.78, 0.38, 0xd9302f);
        const bw = W - w - 0.12; if (bw > 0.3) bau({ lx: W / 2 - bw / 2 - 0.04, lz: lz + 0.05, w: bw, d: d * 0.85, n: n > 3 ? 3 : 2, c: 0xe9e4da, dach: "flach", technik: 0.3 });
        schild(lx, front, Math.min(w * 0.6, 0.7), 0xffffff, 0.42);
        bau({ lx: lx - w / 2 + 0.12, lz: lz - d / 2 + 0.12, w: 0.2, d: 0.2, n: 4, c: ROT, dach: "zelt", dc: 0x5d6470, eingang: false });
        hof(lx, vorn - 0.15, w, 0.36, 0x6d7178); if (DS >= 1) for (let k = 0; k < n; k++) add("flach", lx - w / 2 + w / n * (k + 0.5), vorn - 0.15, w / n * 0.6, 0.004, 0.3, 0xf2c14e, { ly: 0.009 });
        return ROT;
      };
      return { tor, hof, fahne, blaulichtAuto, lkwAuto, kreuz, hPlatz, saeulen, wache, POL, ROT, WEISS };
    },
    polizei(K, o, X) { const { bau, schild, add } = K, { W, D, vorn } = o, d = 0.68, lz = vorn - d / 2 - 0.16, w = W * 0.56, lx = -W * 0.2; bau({ lx, lz, w, d, n: 2, art: "buero", c: 0xeef1f4, dach: "flach", technik: 0.4, eingang: "glas" }); add("flach", lx, lz + d / 2 + 0.008, w, 0.05, 0.012, X.POL, { ly: geschossH(1) - 0.02 }); schild(lx, lz + d / 2, w * 0.5, X.POL, geschossH(2) - 0.12); const gw = W * 0.36, gx = W / 2 - gw / 2 - 0.05; bau({ lx: gx, lz: lz - 0.04, w: gw, d: d * 0.9, n: 1, hh: 0.42, c: 0xdfe3e8, dach: "flach", eingang: false }); X.tor(gx, lz - 0.04 + d * 0.45, gw * 0.8, 0.32); X.hof(0, -D / 2 + 0.3, W * 0.9, 0.45); X.blaulichtAuto(-0.25, -D / 2 + 0.3, X.WEISS, true); X.blaulichtAuto(0.2, -D / 2 + 0.3, X.WEISS, true); X.fahne(-W * 0.45, vorn - 0.1, 0x2f6b3a); return 0xeef1f4; },
    praesidium(K, o, X) { const { bau, schild, add } = K, { W, D, vorn } = o, d = 0.8, lz = vorn - d / 2 - 0.15, c = 0xe8dcc8; bau({ lz, w: W * 0.86, d, n: 4, art: "altbau", c, dach: "mansard", dc: 0x3f4650, gesims: true, baender: true, eingang: "portal", gauben: 3 }); add("flach", 0, lz + d / 2 + 0.008, W * 0.86, 0.05, 0.012, X.POL, { ly: geschossH(1) - 0.02 }); schild(0, lz + d / 2, 0.8, X.POL, geschossH(1) - 0.12); bau({ lx: -W * 0.3, lz: lz - d / 2 - 0.45, w: 0.55, d: 0.8, n: 3, art: "altbau", c, dach: "flach", eingang: false }); bau({ lx: W * 0.3, lz: -D / 2 + 0.3, w: 0.8, d: 0.45, n: 1, hh: 0.42, c: 0xdfe3e8, dach: "flach", eingang: false }); for (let k = 0; k < 2; k++) X.tor(W * 0.3 - 0.2 + k * 0.4, -D / 2 + 0.525, 0.3, 0.32); X.hof(W * 0.15, -D * 0.05, W * 0.5, 0.6); for (let k = 0; k < 3; k++) X.blaulichtAuto(W * 0.02 + k * 0.2, -D * 0.05, X.WEISS, false); for (const s of [-1, 1]) X.fahne(s * W * 0.42, vorn - 0.08, s < 0 ? 0x2f6b3a : 0xf2c14e); return c; },
    polizeiheli(K, o, X) { return DIENST_NEU.heli(K, o, X, X.POL); }, loeschheli(K, o, X) { return DIENST_NEU.heli(K, o, X, 0xd9302f); }, rettungsheli(K, o, X) { return DIENST_NEU.heli(K, o, X, 0xf2f4f6); },
    heli(K, o, X, c) { const { bau, add } = K, { W, D, vorn } = o; X.hof(0, -0.15, W * 0.9, D * 0.6, 0x8c8a84); X.hPlatz(-W * 0.18, -0.2, 0.004, 0.75); add("flach", -W * 0.18, -0.2, 0.42, 0.08, 0.1, c, { ly: 0.04 }); add("flach", -W * 0.18, -0.2, 0.7, 0.01, 0.03, 0x3a3e46, { ly: 0.14, dreh: 6 }); bau({ lx: W * 0.28, lz: vorn - 0.35, w: 0.55, d: 0.55, n: 1, hh: 0.5, c: 0xdfe3e8, dach: "sattel", dc: 0x8b9096, dachH: 0.14, eingang: false }); X.tor(W * 0.28, vorn - 0.075, 0.42, 0.36, 0xd8dade); bau({ lx: -W * 0.32, lz: vorn - 0.2, w: 0.45, d: 0.35, n: 2, art: "glas", c: 0x9fc0d2, dach: "flach", eingang: "glas", technik: 0.5 }); return 0xdfe3e8; },
    gefaengnis(K, o, X) { const { bau, add, flaeche } = K, { W, D, vorn, DS } = o; flaeche(0, 0, W * 0.94, D * 0.94, 0x9a9a92); for (const s of [-1, 1]) { add("flach", s * W * 0.47, 0, 0.05, 0.55, D * 0.94, 0xb5b0a5); add("flach", 0, s * D * 0.47, W * 0.94, 0.55, 0.05, 0xb5b0a5); } if (DS >= 1) for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bau({ lx: sx * W * 0.44, lz: sz * D * 0.44, w: 0.18, d: 0.18, n: 3, c: 0xb5b0a5, dach: "zelt", dc: 0x5d6470, eingang: false }); bau({ lz: -0.1, w: W * 0.55, d: D * 0.32, n: 4, c: 0xc4b8a8, dach: "flach", eingang: false }); bau({ lx: -W * 0.22, lz: -D * 0.3, w: 0.35, d: D * 0.35, n: 3, c: 0xc4b8a8, dach: "flach", eingang: false }); flaeche(W * 0.2, -D * 0.28, W * 0.3, D * 0.25, 0x8fb06a); bau({ lz: vorn - 0.12, w: 0.5, d: 0.2, n: 2, art: "buero", c: 0xd8dade, dach: "flach", eingang: "glas" }); return 0xc4b8a8; },
    feuerklein(K, o, X) { return X.wache(2); }, feuerwache(K, o, X) { return X.wache(3); },
    hauptwache(K, o, X) { const c = X.wache(5); const { bau, flaeche, add } = K, { W, D } = o; flaeche(W * 0.15, -D * 0.32, W * 0.55, D * 0.3, 0x6d7178); bau({ lx: W * 0.32, lz: -D * 0.32, w: 0.24, d: 0.24, n: 4, art: "haus", c: 0xb5b0a5, dach: "flach", eingang: false }); for (let k = 0; k < 2; k++) X.lkwAuto(-W * 0.05 + k * 0.25, -D * 0.32, 0xd9302f); return c; },
    waldbrand(K, o, X) { const { bau, add, baum } = K, { W, D, vorn } = o; bau({ lx: -W * 0.12, lz: vorn - 0.4, w: W * 0.65, d: 0.55, n: 1, hh: 0.5, art: "holz", c: 0x8a5a3a, dach: "sattel", dc: ROT_DACH, eingang: false }); for (let k = 0; k < 2; k++) X.tor(-W * 0.12 - 0.2 + k * 0.4, vorn - 0.125, 0.3, 0.36, 0xd9302f); add("flach", W * 0.35, -D * 0.25, 0.04, 1.4, 0.04, 0x6b4a2f); add("flach", W * 0.35, -D * 0.25, 0.28, 0.22, 0.28, 0x8a5a3a, { ly: 1.4 }); K.dach("zelt", W * 0.35, -D * 0.25, 0.28, 0.28, 1.62, 0x5d6470, { h: 0.18 }); for (let k = 0; k < 4; k++) baum(-W * 0.4 + k * 0.25, -D * 0.38, 0.45); return 0x8a5a3a; },
    arzt(K, o, X) { const { bau, schild, add } = K, { W, D, vorn } = o, d = 0.6, lz = vorn - d / 2 - 0.15; bau({ lz, w: W * 0.8, d, n: 2, c: 0xf6f6f4, dach: "flach", eingang: "glas" }); X.kreuz(-W * 0.25, lz + d / 2 + 0.012, geschossH(2) - 0.04, 0.14, 0xd9302f); K.parkplatz(0, -D / 2 + 0.3, W * 0.85, 0.36, 3, false); return 0xf6f6f4; },
    kinderarzt(K, o, X) { const { bau } = K, { W, D, vorn } = o, d = 0.6, lz = vorn - d / 2 - 0.15; bau({ lz, w: W * 0.8, d, n: 2, c: 0xf6e3a8, dach: "pult", dc: 0x3f7fe8, eingang: "tuer" }); X.kreuz(W * 0.25, lz + d / 2 + 0.012, geschossH(1) + 0.18, 0.12, 0x4fbf7a); K.garten(2); K.parkplatz(0, -D / 2 + 0.25, W * 0.85, 0.3, 2, false); return 0xf6e3a8; },
    krankenhaus(K, o, X) { const { bau, schild, add, baum } = K, { W, D, vorn } = o, d = 0.75, lz = vorn - d / 2 - 0.3; const y = bau({ lx: -W * 0.08, lz, w: W * 0.7, d, n: 6, art: "buero", c: 0xf6f6f4, dach: "flach", eingang: false }); X.hPlatz(-W * 0.08, lz, y, 0.55); X.kreuz(-W * 0.08, lz + d / 2 + 0.012, y - 0.15, 0.24, 0xd9302f); bau({ lx: W * 0.36, lz: lz - 0.25, w: 0.5, d: 1.1, n: 4, art: "buero", c: 0xeef1f4, dach: "flach", technik: 1, eingang: false }); bau({ lx: -W * 0.22, lz: -D / 2 + 0.35, w: W * 0.45, d: 0.5, n: 3, c: 0xe9e4da, dach: "flach", eingang: false, balkon: "kragen" }); add("flach", -W * 0.08, lz + d / 2 + 0.16, 0.7, 0.03, 0.3, 0xd8dade, { ly: 0.33 }); for (const s of [-1, 1]) add("flach", -W * 0.08 + s * 0.33, lz + d / 2 + 0.28, 0.03, 0.33, 0.03, 0xd8dade); add("flach", -W * 0.08, lz + d / 2 + 0.006, 0.5, 0.06, 0.012, 0xd9302f, { ly: 0.38 }); K.eingang(-W * 0.08, lz + d / 2, "glas", 0xf6f6f4); for (let k = 0; k < 2; k++) X.tor(W * 0.36 - 0.12 + k * 0.24, lz - 0.25 + 0.55, 0.2, 0.3, 0xd8dade); X.blaulichtAuto(W * 0.36, vorn - 0.25, 0xf6f6f4, false, 0x2f6bff); K.flaeche(-W * 0.08, vorn - 0.16, W * 0.6, 0.3, 0x8c8f94); baum(-W * 0.44, vorn - 0.15, 0.4); return 0xf6f6f4; },
    altenheim(K, o, X) { const { bau, baum, bank } = K, { W, D, vorn } = o, d = 0.7, lz = vorn - d / 2 - 0.2; bau({ lz, w: W * 0.82, d, n: 3, c: 0xf2e6d0, dach: "walm", dc: 0xb2513a, balkon: "kragen", bc: 0xf2f0ea }); K.garten(4); bank(-0.3, -D / 2 + 0.4); bank(0.2, -D / 2 + 0.35); K.flaeche(0, vorn - 0.1, 0.4, 0.18, 0xd8cbb0); return 0xf2e6d0; },
    krematorium(K, o, X) { const { bau, zyl, baum } = K, { W, D, vorn } = o; bau({ lz: vorn - 0.45, w: W * 0.7, d: 0.6, n: 1, hh: 0.62, art: "altbau", c: 0xd8d0c0, dach: "flach", gesims: true, eingang: "portal" }); zyl(W * 0.3, -D * 0.3, 0.14, 1.25, 0x9aa0a8, { schlot: true }); for (let k = 0; k < 4; k++) baum(-W * 0.4 + k * 0.28, -D * 0.38, 0.5); return 0xd8d0c0; },
    friedhof(K, o, X) { const { bau, add, baum, flaeche } = K, { W, D, vorn, DS } = o; flaeche(0, 0, W * 0.94, D * 0.94, 0x6fa855); flaeche(0, 0, 0.12, D * 0.9, 0xd8cbb0); for (let a = 0; a < 4; a++) for (let b = 0; b < 6; b++) { add("flach", -W * 0.34 + a * W * 0.2 + (a > 1 ? 0.08 : -0.02), -D * 0.38 + b * D * 0.12, 0.08, 0.1, 0.03, 0x9aa0a8); if (DS >= 2) add("flach", -W * 0.34 + a * W * 0.2 + (a > 1 ? 0.08 : -0.02), -D * 0.38 + b * D * 0.12 + 0.07, 0.1, 0.01, 0.12, 0x5a8a3a); } bau({ lz: vorn - 0.22, w: 0.4, d: 0.3, n: 1, art: "altbau", c: 0xd8d0c0, dach: "sattel", dc: 0x5d6470, quer: true, eingang: "portal" }); bau({ lz: vorn - 0.38, w: 0.14, d: 0.14, n: 3, art: "altbau", c: 0xd8d0c0, dach: "zelt", dc: 0x5d6470, eingang: false }); K.zaun(0); for (let k = 0; k < 5; k++) baum(W * 0.44, -D * 0.4 + k * D * 0.2, 0.45); return 0xd8d0c0; },
    kindergarten(K, o, X) { const { bau, add, flaeche } = K, { W, D, vorn } = o; bau({ lz: vorn - 0.4, w: W * 0.82, d: 0.55, n: 1, art: "holz", c: 0xf3d58a, dach: "pult", dc: 0xe8493f, eingang: "tuer" }); flaeche(0, -D * 0.22, W * 0.8, D * 0.42, 0x7fc463); flaeche(-0.15, -D * 0.25, 0.3, 0.3, 0xe8d39a); add("flach", 0.2, -D * 0.3, 0.04, 0.28, 0.04, 0xe8493f); add("flach", 0.2, -D * 0.18, 0.07, 0.02, 0.36, 0xf2c14e, { ly: 0.14, rx: 0.5 }); add("flach", -0.2, -D * 0.4, 0.36, 0.03, 0.03, 0x3f7fe8, { ly: 0.26 }); K.zaun(1); return 0xf3d58a; },
    grundschule(K, o, X) { const { bau, flaeche, baum, add } = K, { W, D, vorn } = o, c = 0xf3d58a, d = 0.6, lz = vorn - d / 2 - 0.18; bau({ lz, w: W * 0.86, d, n: 2, c, dach: "sattel", dc: 0xb2513a, eingang: "portal" }); bau({ lx: -W * 0.3, lz: lz - d / 2 - 0.5, w: 0.5, d: 1.0, n: 2, c, dach: "sattel", dc: 0xb2513a, quer: true, eingang: false }); bau({ lx: W * 0.25, lz: -D / 2 + 0.4, w: 0.75, d: 0.6, n: 1, hh: 0.55, c: 0xe9e4da, dach: "pult", dc: 0x8b9096, eingang: false }); flaeche(W * 0.15, -D * 0.1, W * 0.55, D * 0.3, 0xc9c3b6); baum(W * 0.1, -D * 0.05, 0.5); add("flach", W * 0.3, -D * 0.1, 0.2, 0.004, 0.2, 0xffffff, { ly: 0.012 }); return c; },
    gymnasium(K, o, X) { const { bau, flaeche, add, baum } = K, { W, D, vorn } = o, c = 0xe3c9a8, d = 0.7, lz = vorn - d / 2 - 0.15; bau({ lz, w: W * 0.88, d, n: 3, art: "altbau", c, dach: "mansard", dc: 0x5d6470, gesims: true, eingang: "portal", gauben: 3 }); bau({ lx: W * 0.3, lz: lz - d / 2 - 0.4, w: 0.7, d: 0.7, n: 3, art: "glas", c: 0x9fc0d2, dach: "flach", eingang: false }); flaeche(-W * 0.15, -D * 0.28, W * 0.55, D * 0.36, 0x4f9a3a); add("flach", -W * 0.15, -D * 0.28, W * 0.5, 0.004, 0.02, 0xffffff, { ly: 0.013 }); add("flach", -W * 0.15, -D * 0.28, 0.02, 0.004, D * 0.32, 0xffffff, { ly: 0.013 }); bau({ lx: W * 0.32, lz: -D / 2 + 0.3, w: 0.8, d: 0.45, n: 1, hh: 0.6, c: 0xd8d4cc, dach: "sattel", dc: 0x8b9096, dachH: 0.12, eingang: false }); baum(-W * 0.45, vorn - 0.12, 0.4); return c; },
    berufsschule(K, o, X) { const { bau, add } = K, { W, D, vorn } = o, d = 0.6, lz = vorn - d / 2 - 0.12; bau({ lz, w: W * 0.6, d, lx: -W * 0.18, n: 3, art: "buero", c: 0xd0c8b8, dach: "flach", technik: 0.5, eingang: "glas" }); const hw = W * 0.34, hx = W / 2 - hw / 2 - 0.04, hz = -D * 0.1, hd = D * 0.7, hh = 0.55; add("haus", hx, hz, hw, hh, hd, 0xc4c9cc); const n = 3; for (let k = 0; k < n; k++) add("pult", hx, hz - hd / 2 + hd / n * (k + 0.5), hw, 0.16, hd / n, 0x9aa1a8, { ly: hh, ry: Math.PI }); X.tor(hx, hz + hd / 2, hw * 0.6, 0.36); return 0xd0c8b8; },
    bibliothek(K, o, X) { const { bau } = K, { W, D, vorn } = o, d = 0.8, lz = vorn - d / 2 - 0.3, c = 0xe3d6bf; bau({ lz, w: W * 0.8, d, n: 2, hh: geschossH(2) + 0.1, art: "altbau", c, dach: "flach", gesims: true, eingang: "portal", attika: false }); X.saeulen(0, lz + d / 2, W * 0.4, geschossH(2) - 0.05, 0xefe7d6, 4); K.bank(-0.4, vorn - 0.1); K.bank(0.4, vorn - 0.1); return c; },
    uni(K, o, X) { const { bau, zyl, dach, flaeche, baum } = K, { W, D, vorn } = o, c = 0xe8dcc8, d = 0.9, lz = vorn - d / 2 - 0.35; const y = bau({ lz, w: W * 0.7, d, n: 3, art: "altbau", c, dach: "flach", gesims: true, baender: true, eingang: "portal", attika: false }); X.saeulen(0, lz + d / 2, 0.8, geschossH(2), 0xefe7d6, 6); zyl(0, lz, 0.7, 0.35, c, { ly: y }); dach("zelt", 0, lz, 0.72, 0.72, y + 0.35, 0x5f8f7a, { h: 0.4, ue: 0 }); bau({ lx: -W * 0.32, lz: -D * 0.25, w: 0.9, d: 0.8, n: 3, art: "glas", c: 0x9fc0d2, dach: "flach", garten: true, eingang: "glas" }); bau({ lx: W * 0.32, lz: -D * 0.22, w: 0.8, d: 1.0, n: 4, c: 0xa9533b, dach: "sattel", dc: 0x3f4650, quer: true, eingang: false }); flaeche(0, -D * 0.12, 0.16, D * 0.5, 0xd8cbb0); flaeche(0, -D * 0.12, W * 0.4, 0.16, 0xd8cbb0); for (let k = 0; k < 6; k++) baum((o.r() - 0.5) * W * 0.3, -D * 0.4 + o.r() * D * 0.3, 0.5); return c; },
    rathaus(K, o, X) { const { bau, dach, add, zyl, flaeche } = K, { W, D, vorn, DS } = o, c = 0xe9dcc4, d = 0.9, lz = vorn - d / 2 - 0.3; const y = bau({ lz, w: W * 0.84, d, n: 3, art: "altbau", c, dach: "mansard", dc: 0x5d6470, gesims: true, baender: true, eingang: "portal", gauben: 4 }); const ty = bau({ lz: lz + 0.05, w: 0.4, d: 0.4, n: 8, art: "altbau", c, dach: false, eingang: false, gesims: true }); if (DS >= 1) for (const s of [1]) { zyl(0, lz + 0.26, 0.2, 0.012, 0xf6f4ee, { ly: ty - 0.32, rx: Math.PI / 2 }); add("flach", 0, lz + 0.262, 0.012, 0.08, 0.004, 0x2a2d33, { ly: ty - 0.4 }); } dach("zelt", 0, lz + 0.05, 0.42, 0.42, ty, 0x5f8f7a, { h: 0.5, ue: 0.02 }); flaeche(0, vorn - 0.14, W * 0.7, 0.3, 0xd8cbb0); zyl(W * 0.28, vorn - 0.14, 0.26, 0.06, 0xb9b4a8); zyl(W * 0.28, vorn - 0.14, 0.2, 0.005, 0x5fc8e8, { ly: 0.06 }); for (const s of [-1, 1]) X.fahne(s * W * 0.42, vorn - 0.1, s < 0 ? 0xf2c14e : 0x2f8f6f); return c; },
    museum(K, o, X) { const { bau, flaeche } = K, { W, D, vorn } = o, c = 0xf2efe8, d = 1.1, lz = vorn - d / 2 - 0.35; bau({ lz, w: W * 0.84, d, n: 2, hh: 0.95, art: "altbau", c, dach: "flach", gesims: true, eingang: "portal", attika: false }); X.saeulen(0, lz + d / 2, W * 0.5, 0.88, 0xf6f2e6, 6); bau({ lz: lz - 0.1, w: W * 0.3, d: 0.5, n: 1, art: "glas", c: 0x9fc0d2, ly: 0.95, dach: "flach", eingang: false }); flaeche(0, vorn - 0.14, W * 0.8, 0.3, 0xd8cbb0); K.bank(-W * 0.3, vorn - 0.1); K.bank(W * 0.3, vorn - 0.1); return c; },
    schwimmbad(K, o, X) { const { bau, add, flaeche, pool } = K, { W, D, vorn } = o; bau({ lx: W * 0.22, lz: vorn - 0.45, w: W * 0.5, d: 0.75, n: 1, hh: 0.6, art: "glas", c: 0x9fd0e0, dach: "sattel", dc: 0xd8dade, dachH: 0.18, quer: true, eingang: "glas" }); pool(-W * 0.18, -D * 0.05, W * 0.48, D * 0.45); for (let k = 0; k < 3; k++) add("flach", -W * 0.18 - W * 0.16 + k * W * 0.16, -D * 0.05, 0.004, 0.003, D * 0.45, 0xffffff, { ly: 0.02 }); flaeche(-W * 0.18, -D * 0.38, W * 0.5, 0.25, 0x7fc463); for (let k = 0; k < 5; k++) add("flach", -W * 0.38 + k * 0.18, -D * 0.38, 0.08, 0.02, 0.16, [0xe8493f, 0x3f7fe8, 0xf2c14e][k % 3], { ly: 0.01 }); return 0x9fd0e0; },
    parkplatz(K, o, X) { const { flaeche, add, baum } = K, { W, D, vorn, DS } = o; flaeche(0, 0, W * 0.96, D * 0.96, 0x55585e); for (let rz = 0; rz < 2; rz++) K.parkplatz(0, vorn - 0.45 - rz * 0.85, W * 0.9, 0.36, 6, false); if (DS >= 1) add("flach", 0, vorn - 0.87, W * 0.9, 0.004, 0.04, 0xe8e8e8, { ly: 0.012 }); baum(-W * 0.44, -D * 0.44, 0.35); baum(W * 0.44, -D * 0.44, 0.35); add("flach", W * 0.42, vorn - 0.08, 0.03, 0.3, 0.03, 0x9aa0a8); add("flach", W * 0.42, vorn - 0.08, 0.14, 0.14, 0.02, 0x1f4fbf, { ly: 0.3 }); return 0x55585e; },
    parkhaus(K, o, X) { const { add, flaeche } = K, { W, D, vorn } = o, w = W * 0.86, dd = D * 0.8, lz = vorn - dd / 2 - 0.04; flaeche(0, 0, W * 0.96, D * 0.96, 0x8c8f94); for (let e = 0; e < 4; e++) { add("haus", 0, lz, w, 0.05, dd, 0xb8bcc2, { ly: e * 0.38 }); for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) add("flach", sx * w * 0.45, lz + sz * dd * 0.45, 0.05, 0.38, 0.05, 0x9aa0a8, { ly: e * 0.38 }); for (const sz of [-1, 1]) add("flach", 0, lz + sz * (dd / 2 - 0.01), w, 0.09, 0.02, 0xd8dade, { ly: e * 0.38 + 0.05 }); for (let k = 0; k < 4; k++) for (const sz of [-0.2, 0.2]) K.auto(-w * 0.36 + k * w * 0.24, lz + sz, false, k, e * 0.38 + 0.05); } add("haus", 0, lz, w, 0.06, dd, 0x9aa0a8, { ly: 1.52 }); add("flach", w / 2 - 0.12, lz + dd / 2 + 0.01, 0.22, 0.22, 0.02, 0x1f4fbf, { ly: 1.1 }); add("flach", -w * 0.3, vorn - 0.05, 0.02, 0.1, 0.25, 0xe8493f, { ly: 0.1 }); return 0xb8bcc2; },
    busdepot(K, o, X) { return DIENST_NEU.depot(K, o, X, false); }, tramdepot(K, o, X) { return DIENST_NEU.depot(K, o, X, true); },
    depot(K, o, X, tram) { const { bau, add, flaeche } = K, { W, D, vorn, DS } = o, c = tram ? 0xa9533b : 0xc4c9cc, hw = W * 0.86, hd = D * 0.55, hz = -D / 2 + hd / 2 + 0.06; bau({ lz: hz, w: hw, d: hd, n: 1, hh: 0.62, art: tram ? "altbau" : "haus", c, dach: "sattel", dc: 0x5d6470, dachH: 0.14, quer: false, eingang: false }); const n = 4; for (let k = 0; k < n; k++) X.tor(-hw / 2 + hw / n * (k + 0.5), hz + hd / 2, hw / n * 0.75, 0.46, tram ? 0x6d4a3a : 0x8a9099); flaeche(0, vorn - (vorn - hz - hd / 2) / 2, W * 0.9, vorn - hz - hd / 2, 0x6d7178); if (tram && DS >= 1) for (let k = 0; k < n; k++) for (const s of [-0.05, 0.05]) add("flach", -hw / 2 + hw / n * (k + 0.5) + s, vorn - 0.3, 0.012, 0.004, 0.6, 0x9aa0a8, { ly: 0.012 }); for (let k = 0; k < 2; k++) add("flach", -W * 0.2 + k * W * 0.4, vorn - 0.25, tram ? 0.2 : 0.2, 0.24, tram ? 0.8 : 0.6, LINIEN_FARBEN[k], { ly: 0.01 }); bau({ lx: W * 0.36, lz: vorn - 0.2, w: 0.3, d: 0.25, n: 2, art: "buero", c: 0xe9e4da, dach: "flach", eingang: "glas" }); return c; }
  };
})();
const ROT_DACH = 0x8f3f30;
function dienstTeile(d) {
  const D0 = DIENSTE[d.typ], W = D0.w * ZELLE, D = D0.d * ZELLE, vorn = D / 2 - 0.08, T = [], r = zufall(d.id * 977 + 13);
  const box = (b, lx, lz, w, hh, dd, c, ex) => T.push(Object.assign({ b, lx, ly: 0, lz, sx: w, sy: hh, sz: dd, c }, ex || {}));
  const zyl = (lx, lz, dm, hh, c, ex) => box("zyl", lx, lz, dm, hh, dm, c, ex);
  const baum = (lx, lz, g) => box("garten", lx, lz, g, g, g, null, { rund: true });
  const boden = (c) => box("flach", 0, 0, W * 0.98, 0.008, D * 0.98, c, { fest: true });
  const flach = (lx, lz, w, dd, c, y) => box("flach", lx, lz, w, 0.012, dd, c, { ly: y || 0.003 });
  const dach = (lx, lz, w, dd, y, c) => box("flach", lx, lz, w + 0.04, 0.04, dd + 0.04, c || 0xd9d6cf, { ly: y });
  const zaun = (c) => { for (const s of [-1, 1]) { box("flach", s * W * 0.47, 0, 0.02, 0.14, D * 0.94, c); box("flach", 0, s * D * 0.47, W * 0.94, 0.14, 0.02, c); } };
  const autos = (lx, lz, n, c) => { for (let k = 0; k < n; k++) box("flach", lx + (k - (n - 1) / 2) * 0.2, lz, 0.13, 0.11, 0.24, c || PAL.auto[(d.id + k) % PAL.auto.length], { ly: 0.01 }); };
  const kreuz = (lx, lz, y, s, c) => { box("flach", lx, lz, s, s * 0.32, 0.02, c, { ly: y }); box("flach", lx, lz, s * 0.32, s, 0.02, c, { ly: y - s * 0.34 }); };
  if (DIENST_NEU[d.typ]) {
    const DS = detailStufe(), K = baukasten(T, r, W, D, vorn, d.id, DS), o = { W, D, vorn, r, DS }, X = DIENST_NEU.setup(K, o);
    boden(D0.kat === "bildung" || D0.kat === "freizeit" ? 0xc9c3b6 : D0.kat === "gesund" ? 0xb9c4a8 : 0xb5b3ad);
    const c = DIENST_NEU[d.typ](K, o, X); T.tor = o.tore && o.tore.length ? o.tore[Math.floor(o.tore.length / 2)] : { lx: 0, lz: vorn - 0.25 };
    if (d.ausbau && ausbaubar(D0)) for (let i = 0; i < d.ausbau; i++) K.bau({ lx: (i ? 1 : -1) * (W / 2 - Math.min(0.55, W * 0.3) / 2 - 0.04), lz: -D / 2 + 0.26, w: Math.min(0.55, W * 0.3), d: 0.4, n: 1 + i, c, dach: "flach", eingang: false, technik: 0.3 });
    return T;
  }
  switch (d.typ) {
    case "windrad": boden(0x8fcf68); zyl(0, 0, 0.12, 2.4, 0xf2f4f6); box("haus", 0, 0.06, 0.13, 0.13, 0.28, 0xf2f4f6, { ly: 2.34 }); for (let i = 0; i < 3; i++) box("flach", 0, 0.21, 0.07, 1.0, 0.02, 0xf7f8fa, { ly: 2.41, rz: i * 2.094, dreh: 1.4 }); break;
    case "solar": boden(0xa9a693); for (let zz = -D / 2 + 0.35; zz < D / 2 - 0.35; zz += 0.4) box("flach", -0.1, zz, W * 0.78, 0.02, 0.3, 0x1f3a6b, { ly: 0.13, rx: -0.55 }); box("haus", W * 0.4, vorn - 0.18, 0.28, 0.26, 0.26, 0xe6e6e6); break;
    case "kohle": boden(0x8c8a84); box("haus", -W * 0.18, vorn - 0.75, W * 0.55, 0.95, 1.3, 0x9a8f86); dach(-W * 0.18, vorn - 0.75, W * 0.55, 1.3, 0.95, 0x6d737a); zyl(W * 0.28, -D * 0.22, 1.25, 1.5, 0xd6d8da); zyl(W * 0.28, -D * 0.22, 1.0, 0.04, 0x9aa0a8, { ly: 1.5 }); zyl(-W * 0.38, -D * 0.32, 0.22, 2.8, 0xb5523a, { schlot: true }); zyl(-W * 0.12, -D * 0.32, 0.22, 2.8, 0xb5523a, { schlot: true }); for (let k = 0; k < 3; k++) box("dach", -W * 0.3 + k * 0.5, D * 0.08, 0.45, 0.22, 0.4, 0x2a2a2a); break;
    case "pumpe": boden(0xb5b3ad); box("haus", 0, vorn - 0.28, 0.62, 0.42, 0.46, 0xdfe7ee); dach(0, vorn - 0.28, 0.62, 0.46, 0.42, 0x3f7fe8); box("flach", 0, -0.35, 0.12, 0.1, 1.0, 0x5a7fa8, { ly: 0.02 }); zyl(0, -D / 2 + 0.12, 0.22, 0.25, 0x5a7fa8); break;
    case "wasserturm": boden(0xb5b3ad); zyl(0, 0, 0.24, 1.7, 0xcfd4d8); zyl(0, 0, 0.85, 0.55, 0x6fa8dc, { ly: 1.7 }); zyl(0, 0, 0.9, 0.06, 0xdfe7ee, { ly: 2.25 }); break;
    case "klaer": boden(0xb5b3ad); zyl(-0.42, -0.45, 0.8, 0.14, 0xa8b0a8); zyl(-0.42, -0.45, 0.68, 0.01, 0x6f9a7f, { ly: 0.14 }); zyl(0.42, -0.45, 0.8, 0.14, 0xa8b0a8); zyl(0.42, -0.45, 0.68, 0.01, 0x7faa8f, { ly: 0.14 }); box("haus", 0, vorn - 0.25, W * 0.6, 0.4, 0.4, 0xe9e4da); dach(0, vorn - 0.25, W * 0.6, 0.4, 0.4); break;
    case "deponie": boden(0x8a7a5a); zaun(0x6d737a); for (let k = 0; k < 7; k++) box("dach", (r() - 0.5) * W * 0.65, -D * 0.12 + (r() - 0.5) * D * 0.5, 0.5 + r() * 0.5, 0.18 + r() * 0.25, 0.5 + r() * 0.4, wahl(r, [0x6d5a3a, 0x7a6a4a, 0x5d6470, 0x8a7a5a])); box("haus", W * 0.3, vorn - 0.25, 0.5, 0.32, 0.35, 0xd9d4c7); break;
    case "verbrennung": boden(0x9a9a92); box("haus", -W * 0.12, vorn - 0.7, W * 0.65, 0.8, 1.2, 0xc4c9cc); dach(-W * 0.12, vorn - 0.7, W * 0.65, 1.2, 0.8, 0x6d737a); zyl(W * 0.32, -D * 0.25, 0.28, 3.0, 0xd9d9d9, { schlot: true }); box("flach", W * 0.32, -D * 0.25, 0.3, 0.06, 0.3, 0xe8493f, { ly: 2.6 }); break;
    case "polizei": case "praesidium": { const gr = d.typ === "praesidium", hh = gr ? 1.5 : 0.8, w = W * 0.82, dd = gr ? 1.4 : 0.9, lz = vorn - dd / 2 - 0.05; boden(0xb5b3ad); box("haus", 0, lz, w, hh, dd, 0xf2f4f7); dach(0, lz, w, dd, hh); box("flach", 0, lz + dd / 2 + 0.006, w, 0.09, 0.01, 0x1f4fbf, { ly: hh * 0.62 }); box("flach", 0, lz + dd / 2 + 0.01, 0.3, 0.1, 0.02, 0x1f4fbf, { ly: hh - 0.18 }); autos(0, -D / 2 + 0.3, gr ? 4 : 2, 0xf2f4f7); break; }
    case "feuerwache": case "hauptwache": { const gr = d.typ === "hauptwache", w = W * 0.84, dd = gr ? 1.4 : 1.0, lz = vorn - dd / 2 - 0.08, n = gr ? 4 : 3; boden(0xb5b3ad); box("haus", 0, lz, w, 0.7, dd, 0xc23b2f); dach(0, lz, w, dd, 0.7, 0x5d6470); for (let k = 0; k < n; k++) box("flach", -w / 2 + w / n * (k + 0.5), lz + dd / 2 + 0.006, w / n * 0.7, 0.45, 0.01, 0x2a2d33); box("haus", w / 2 - 0.15, lz - dd / 2 + 0.15, 0.24, 1.5, 0.24, 0xc23b2f); break; }
    case "arzt": boden(0xb5b3ad); box("haus", 0, vorn - 0.42, 0.75, 0.62, 0.7, 0xf6f6f6); dach(0, vorn - 0.42, 0.75, 0.7, 0.62); kreuz(0, vorn - 0.06, 0.5, 0.2, 0xd9302f); baum(0, -0.6, 0.5); break;
    case "krankenhaus": boden(0xc8c8c0); box("haus", 0, vorn - 0.8, W * 0.86, 1.4, 1.3, 0xf6f6f6); box("haus", -W * 0.25, -D * 0.22, W * 0.36, 0.9, 1.0, 0xeef1f4); dach(0, vorn - 0.8, W * 0.86, 1.3, 1.4); flach(0, vorn - 0.8, 0.7, 0.7, 0x3f7f4a, 1.45); box("flach", 0, vorn - 0.8, 0.08, 0.02, 0.4, 0xffffff, { ly: 1.47 }); box("flach", 0, vorn - 0.8, 0.3, 0.02, 0.08, 0xffffff, { ly: 1.47 }); kreuz(0, vorn - 0.14, 1.15, 0.3, 0xd9302f); break;
    case "grundschule": case "gymnasium": { const gr = d.typ === "gymnasium", c = gr ? 0xe3c9a8 : 0xf3d58a; boden(0xb9b49f); box("haus", 0, vorn - 0.35, W * 0.84, gr ? 1.0 : 0.65, 0.6, c); dach(0, vorn - 0.35, W * 0.84, 0.6, gr ? 1.0 : 0.65, 0xb2513a); box("haus", -W * 0.3, -0.1, W * 0.26, gr ? 1.0 : 0.65, D * 0.45, c); dach(-W * 0.3, -0.1, W * 0.26, D * 0.45, gr ? 1.0 : 0.65, 0xb2513a);
      if (gr) { flach(W * 0.15, -D * 0.28, W * 0.5, D * 0.36, 0x4f9a3a); box("flach", W * 0.15, -D * 0.28, W * 0.46, 0.002, 0.02, 0xffffff, { ly: 0.017 }); } else { flach(W * 0.15, -D * 0.25, W * 0.45, D * 0.3, 0xd8c7a0); baum(W * 0.3, -D * 0.38, 0.45); } break; }
    case "uni": boden(0x8fcf68); box("haus", 0, vorn - 0.45, W * 0.8, 1.1, 0.8, 0xe8dcc8); dach(0, vorn - 0.45, W * 0.8, 0.8, 1.1); zyl(0, vorn - 0.45, 0.6, 0.5, 0xe8dcc8, { ly: 1.1 }); zyl(0, vorn - 0.45, 0.66, 0.06, 0x7fa3b8, { ly: 1.6 }); box("haus", -W * 0.3, -D * 0.25, 0.9, 1.3, 0.9, 0xd8c3a5); box("haus", W * 0.3, -D * 0.25, 0.9, 0.9, 0.9, 0xd8c3a5); flach(0, -0.1, 0.2, D * 0.6, 0xd8c7a0); for (let k = 0; k < 4; k++) baum((r() - 0.5) * W * 0.8, (r() - 0.3) * D * 0.4, 0.5); break;
    case "busdepot": case "tramdepot": { const tr = d.typ === "tramdepot"; boden(0x9a9a92); box("haus", 0, -0.2, W * 0.86, 0.75, D * 0.6, tr ? 0xd8c3a5 : 0xc4c9cc); box("dach", 0, -0.2, W * 0.9, 0.25, D * 0.64, 0x5d6470, { ly: 0.75 }); for (let k = 0; k < 4; k++) box("flach", -W * 0.32 + k * W * 0.21, -0.2 + D * 0.3 + 0.006, W * 0.16, 0.5, 0.01, 0x2a2d33); for (let k = 0; k < 3; k++) box("flach", -W * 0.25 + k * W * 0.25, vorn - 0.25, 0.22, 0.28, tr ? 0.9 : 0.6, LINIEN_FARBEN[k], { ly: 0.01 }); break; }
    case "bahnhof": boden(0xb5b3ad); box("haus", 0, vorn - 0.45, W * 0.8, 0.75, 0.75, 0xd8c3a5); box("dach", 0, vorn - 0.45, W * 0.84, 0.3, 0.8, 0x5d6470, { ly: 0.75 }); box("haus", 0, vorn - 0.06, 0.4, 1.15, 0.2, 0xd8c3a5); box("flach", 0, vorn + 0.05, 0.22, 0.22, 0.02, 0xf4f4f4, { ly: 0.8 }); box("flach", 0, -D * 0.2, W * 0.9, 0.04, D * 0.5, 0x6d737a, { ly: 0.55 }); for (const sx of [-1, 1]) for (const sz of [-0.38, 0]) box("flach", sx * W * 0.4, sz, 0.05, 0.55, 0.05, 0x6d737a); flach(0, -D * 0.2, W * 0.86, D * 0.5, 0x9a9a92); break;
    case "hafen": boden(0x8c8a84); for (let k = 0; k < 6; k++) box("flach", -W * 0.32 + (k % 3) * 0.5, vorn - 0.6 - Math.floor(k / 3) * 0.32, 0.42, 0.14 * (1 + (k % 2)), 0.24, CONTAINER[(d.id + k) % CONTAINER.length]); box("haus", W * 0.33, vorn - 0.4, 0.6, 0.45, 0.5, 0xd9d4c7); for (const sx of [-0.25, 0.35]) { box("flach", sx * W, -D * 0.38, 0.06, 1.3, 0.06, 0xf2c14e); box("flach", sx * W, -D * 0.38 - 0.25, 0.06, 0.06, 0.8, 0xf2c14e, { ly: 1.25 }); } box("flach", 0, -D / 2 + 0.08, W * 0.98, 0.1, 0.2, 0x7a7a72); break;
    case "spielplatz": boden(0x7fc463); flach(-0.15, 0.1, 0.35, 0.35, 0xe8d39a); box("flach", 0.2, -0.15, 0.04, 0.3, 0.04, 0xe8493f); box("flach", 0.2, 0.05, 0.08, 0.02, 0.4, 0xf2c14e, { ly: 0.15, rx: 0.5 }); box("flach", -0.25, -0.25, 0.4, 0.03, 0.03, 0x3f7fe8, { ly: 0.28 }); box("flach", -0.43, -0.25, 0.03, 0.28, 0.03, 0x3f7fe8); box("flach", -0.07, -0.25, 0.03, 0.28, 0.03, 0x3f7fe8); baum(0.3, 0.32, 0.4); break;
    case "park": boden(0x6fbf55); flach(0, 0, 0.18, D * 0.95, 0xd8c7a0); flach(0, 0, W * 0.95, 0.18, 0xd8c7a0); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) baum(a * W * 0.27, b * D * 0.27, 0.55 + r() * 0.25); box("flach", 0.2, 0.12, 0.2, 0.05, 0.06, 0x8b5a2b, { ly: 0.05 }); break;
    case "brunnen": boden(0xd8d0c0); zyl(0, 0, 0.75, 0.1, 0xb9b4a8); zyl(0, 0, 0.65, 0.01, 0x5fc8e8, { ly: 0.1 }); zyl(0, 0, 0.08, 0.3, 0xb9b4a8); zyl(0, 0, 0.22, 0.04, 0x5fc8e8, { ly: 0.3 }); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) baum(a * W * 0.38, b * D * 0.38, 0.45); break;
    case "sportplatz": boden(0x4f9a3a); flach(0, 0, W * 0.86, D * 0.8, 0x5aa845); box("flach", 0, 0, W * 0.86, 0.002, 0.02, 0xffffff, { ly: 0.017 }); box("flach", 0, 0, 0.02, 0.002, D * 0.8, 0xffffff, { ly: 0.017 }); for (const s of [-1, 1]) { box("flach", s * W * 0.42, 0, 0.02, 0.14, 0.36, 0xffffff); } break;
    case "gas": boden(0x9a9a92); box("haus", -W * 0.15, vorn - 0.5, W * 0.6, 0.7, 0.9, 0xc4c9cc); dach(-W * 0.15, vorn - 0.5, W * 0.6, 0.9, 0.7, 0x6d737a); zyl(W * 0.32, -D * 0.25, 0.7, 0.5, 0xe9ecef); zyl(W * 0.32, -D * 0.25, 0.74, 0.05, 0xd8dade, { ly: 0.5 }); zyl(-W * 0.3, -D * 0.3, 0.14, 2.2, 0xd9d9d9, { schlot: true }); zyl(-W * 0.1, -D * 0.3, 0.14, 2.2, 0xd9d9d9); break;
    case "geothermie": boden(0x8a7a6a); box("haus", 0, vorn - 0.35, W * 0.7, 0.55, 0.55, 0xe6dccb); dach(0, vorn - 0.35, W * 0.7, 0.55, 0.55, 0xb2513a); zyl(-0.35, -0.4, 0.22, 1.4, 0xf2f2f2, { schlot: true }); box("flach", 0.1, -0.35, 0.8, 0.08, 0.08, 0x9aa0a8, { ly: 0.3 }); zyl(0.4, -0.4, 0.3, 0.3, 0x9aa0a8); break;
    case "wasserkraft": boden(0x9a9a92); box("haus", 0, -D * 0.3, W * 0.96, 0.9, 0.45, 0xb9b4a8); for (let k = 0; k < 3; k++) box("flach", -W * 0.3 + k * W * 0.3, -D / 2 + 0.05, 0.3, 0.6, 0.06, 0x5fb8d8); box("haus", 0, vorn - 0.3, W * 0.5, 0.5, 0.4, 0xd9d4c7); dach(0, vorn - 0.3, W * 0.5, 0.4, 0.5); break;
    case "atom": boden(0xa9a9a0); for (const sx of [-1, 1]) { zyl(sx * W * 0.25, -D * 0.2, 1.4, 2.0, 0xe6e8ea); zyl(sx * W * 0.25, -D * 0.2, 1.15, 0.04, 0xa9adb3, { ly: 2.0 }); } zyl(0, vorn - 0.6, 0.9, 0.9, 0xd9dde2); zyl(0, vorn - 0.6, 0.62, 0.25, 0xd9dde2, { ly: 0.9 }); zyl(0, vorn - 0.6, 0.3, 0.15, 0xd9dde2, { ly: 1.15 }); box("haus", W * 0.32, vorn - 0.45, 0.8, 0.6, 0.7, 0xc4c9cc); break;
    case "wasserwerk": boden(0xb5b3ad); for (let k = 0; k < 3; k++) { zyl(-W * 0.3 + k * W * 0.3, -D * 0.2, 0.7, 0.18, 0xa8b0a8); zyl(-W * 0.3 + k * W * 0.3, -D * 0.2, 0.6, 0.01, 0x5fb8d8, { ly: 0.18 }); } box("haus", 0, vorn - 0.35, W * 0.7, 0.6, 0.55, 0xdfe7ee); dach(0, vorn - 0.35, W * 0.7, 0.55, 0.6, 0x3f7fe8); break;
    case "aufbereitung": boden(0xb5b3ad); zyl(-0.35, -0.35, 0.6, 0.3, 0xdfe7ee); zyl(0.35, -0.35, 0.6, 0.3, 0xdfe7ee); box("haus", 0, vorn - 0.3, W * 0.7, 0.45, 0.45, 0xf2f4f7); dach(0, vorn - 0.3, W * 0.7, 0.45, 0.45, 0x2fb8c9); break;
    case "grossklaer": boden(0xb5b3ad); for (let k = 0; k < 4; k++) { const x = (k % 2 ? 0.45 : -0.45) * W * 0.6, z = (k < 2 ? -0.5 : 0.25); zyl(x, z, 0.85, 0.14, 0xa8b0a8); zyl(x, z, 0.74, 0.01, 0x6f9a7f, { ly: 0.14 }); } box("haus", W * 0.35, vorn - 0.25, 0.6, 0.4, 0.4, 0xe9e4da); break;
    case "recycling": boden(0x9a9a92); box("haus", -0.2, vorn - 0.4, W * 0.55, 0.5, 0.6, 0x4f9a5a); dach(-0.2, vorn - 0.4, W * 0.55, 0.6, 0.5, 0x2f6b3a); for (let k = 0; k < 4; k++) box("flach", -0.6 + k * 0.4, -D * 0.32, 0.3, 0.22, 0.3, [0x3f7fe8, 0xf2c14e, 0x4fbf7a, 0x8a96a3][k]); break;
    case "muellheiz": boden(0x9a9a92); box("haus", -W * 0.12, vorn - 0.7, W * 0.7, 1.0, 1.2, 0xd9dde2); dach(-W * 0.12, vorn - 0.7, W * 0.7, 1.2, 1.0, 0x5d6470); zyl(W * 0.33, -D * 0.25, 0.32, 3.4, 0xe9ecef, { schlot: true }); box("flach", W * 0.33, -D * 0.25, 0.34, 0.08, 0.34, 0x2fbf6a, { ly: 3.0 }); break;
    case "polizeiheli": case "loeschheli": case "rettungsheli": { const c = d.typ === "polizeiheli" ? 0x1f4fbf : d.typ === "loeschheli" ? 0xd9302f : 0xf6f6f6; boden(0x8c8a84); flach(0, -0.1, 1.2, 1.2, 0x3a3f47); box("flach", 0, -0.1, 0.1, 0.012, 0.6, 0xffffff, { ly: 0.016 }); box("flach", 0, -0.1, 0.4, 0.012, 0.1, 0xffffff, { ly: 0.016 }); box("haus", W * 0.32, vorn - 0.2, 0.5, 0.45, 0.35, c); box("flach", -0.45, -0.1, 0.42, 0.15, 0.14, c, { ly: 0.04 }); box("flach", -0.45, -0.1, 0.8, 0.01, 0.04, 0x2a2d33, { ly: 0.22, ry: 0.5, dreh: 0 }); break; }
    case "gefaengnis": boden(0x9a9a92); zaun(0x6d737a); for (const s2 of [-1, 1]) box("flach", s2 * W * 0.47, 0, 0.04, 0.5, D * 0.94, 0x8a8f96); box("haus", 0, -0.1, W * 0.6, 0.8, D * 0.5, 0xc4b8a8); dach(0, -0.1, W * 0.6, D * 0.5, 0.8, 0x6d737a); box("haus", W * 0.4, D * 0.4, 0.25, 1.0, 0.25, 0x8a8f96); break;
    case "feuerklein": boden(0xb5b3ad); box("haus", 0, vorn - 0.42, 0.78, 0.55, 0.7, 0xc23b2f); dach(0, vorn - 0.42, 0.78, 0.7, 0.55, 0x5d6470); box("flach", 0, vorn - 0.06, 0.4, 0.35, 0.01, 0x2a2d33); break;
    case "waldbrand": boden(0x8a7a5a); box("haus", 0, vorn - 0.35, W * 0.6, 0.5, 0.5, 0x9c7a55); box("dach", 0, vorn - 0.35, W * 0.64, 0.25, 0.55, 0xc23b2f, { ly: 0.5 }); box("haus", -W * 0.32, -D * 0.25, 0.22, 1.6, 0.22, 0x8b5a2b); box("haus", -W * 0.32, -D * 0.25, 0.4, 0.2, 0.4, 0x9c7a55, { ly: 1.6 }); break;
    case "kinderarzt": case "altenheim": { const k2 = d.typ === "kinderarzt"; boden(0xb9b49f); box("haus", 0, vorn - 0.42, W * 0.82, k2 ? 0.55 : 0.75, 0.7, k2 ? 0xf3d58a : 0xe9e4da); dach(0, vorn - 0.42, W * 0.82, 0.7, k2 ? 0.55 : 0.75, k2 ? 0x3f7fe8 : 0xb2513a); baum(-W * 0.25, -D * 0.3, 0.5); baum(W * 0.25, -D * 0.32, 0.45); break; }
    case "friedhof": boden(0x6fa855); zaun(0x6d737a); for (let a2 = 0; a2 < 4; a2++) for (let b2 = 0; b2 < 5; b2++) box("flach", -W * 0.32 + a2 * W * 0.2, -D * 0.35 + b2 * D * 0.15, 0.1, 0.1, 0.04, 0x9aa0a8); baum(W * 0.38, -D * 0.38, 0.55); box("haus", 0, vorn - 0.15, 0.4, 0.35, 0.25, 0xd8d0c0); break;
    case "krematorium": boden(0xb5b3ad); box("haus", 0, vorn - 0.4, W * 0.7, 0.55, 0.6, 0xd8d0c0); dach(0, vorn - 0.4, W * 0.7, 0.6, 0.55, 0x5d6470); zyl(W * 0.3, -D * 0.3, 0.14, 1.2, 0x9aa0a8, { schlot: true }); baum(-W * 0.3, -D * 0.3, 0.5); break;
    case "kindergarten": boden(0x7fc463); box("haus", 0, vorn - 0.4, 0.8, 0.45, 0.6, 0xf3d58a); dach(0, vorn - 0.4, 0.8, 0.6, 0.45, 0xe8493f); flach(0, -0.5, 0.6, 0.5, 0xe8d39a); box("flach", 0.2, -0.5, 0.04, 0.25, 0.04, 0x3f7fe8); break;
    case "bibliothek": boden(0xd8d0c0); box("haus", 0, vorn - 0.45, W * 0.8, 0.85, 0.75, 0xe3c9a8); dach(0, vorn - 0.45, W * 0.8, 0.75, 0.85); for (let k = 0; k < 4; k++) zyl(-W * 0.3 + k * W * 0.2, vorn - 0.04, 0.08, 0.7, 0xf2efe8); baum(0, -D * 0.3, 0.5); break;
    case "berufsschule": boden(0xb9b49f); box("haus", 0, vorn - 0.35, W * 0.84, 0.8, 0.6, 0xd0c8b8); dach(0, vorn - 0.35, W * 0.84, 0.6, 0.8, 0x5d6470); box("haus", W * 0.25, -D * 0.25, W * 0.4, 0.5, D * 0.35, 0xc4c9cc); box("dach", W * 0.25, -D * 0.25, W * 0.42, 0.18, D * 0.37, 0x8b9096, { ly: 0.5 }); break;
    case "schwimmbad": boden(0xd8d0c0); flach(-W * 0.12, -0.1, W * 0.6, D * 0.55, 0x4fc0e8); box("flach", -W * 0.12, -0.1, W * 0.6, 0.002, 0.02, 0xffffff, { ly: 0.018 }); box("haus", W * 0.36, vorn - 0.35, 0.6, 0.45, 0.5, 0xf2f4f7); box("flach", -W * 0.4, -D * 0.3, 0.05, 0.3, 0.05, 0xe8493f); break;
    case "rathaus": boden(0xd8d0c0); box("haus", 0, vorn - 0.6, W * 0.84, 1.0, 1.0, 0xe9dcc4); dach(0, vorn - 0.6, W * 0.84, 1.0, 1.0); box("haus", 0, vorn - 0.6, 0.45, 1.9, 0.45, 0xe9dcc4); box("dach", 0, vorn - 0.6, 0.5, 0.4, 0.5, 0x3f7f6a, { ly: 1.9 }); box("flach", 0, vorn - 0.37, 0.18, 0.18, 0.02, 0xffffff, { ly: 1.55 }); for (let k = 0; k < 5; k++) zyl(-W * 0.3 + k * W * 0.15, vorn - 0.06, 0.08, 0.8, 0xf2efe8); break;
    case "museum": boden(0xd8d0c0); box("haus", 0, vorn - 0.6, W * 0.84, 0.95, 1.1, 0xf2efe8); box("dach", 0, vorn - 0.6, W * 0.88, 0.35, 1.15, 0xd8d0c0, { ly: 0.95 }); for (let k = 0; k < 6; k++) zyl(-W * 0.36 + k * W * 0.144, vorn - 0.02, 0.09, 0.9, 0xffffff); box("flach", 0, -D * 0.3, 0.5, 0.5, 0.5, 0x2f6fd9); break;
    case "stadion": boden(0x9a9a92); zyl(0, -0.1, Math.min(W, D) * 0.95, 0.7, 0xd9dde2); zyl(0, -0.1, Math.min(W, D) * 0.72, 0.02, 0x4f9a3a, { ly: 0.7 }); zyl(0, -0.1, Math.min(W, D) * 0.98, 0.05, 0xe8493f, { ly: 0.7 }); for (let k = 0; k < 4; k++) box("flach", Math.cos(k * 1.57 + 0.78) * W * 0.46, -0.1 + Math.sin(k * 1.57 + 0.78) * D * 0.46, 0.05, 1.5, 0.05, 0x9aa0a8); break;
    case "zoo": boden(0x7fb85a); zaun(0x8b5a2b); flach(-W * 0.2, -D * 0.2, 1.2, 0.9, 0x5fb8d8); flach(W * 0.22, D * 0.1, 1.1, 1.0, 0xd9c08a); for (let k = 0; k < 8; k++) baum((r() - 0.5) * W * 0.85, (r() - 0.5) * D * 0.85, 0.45 + r() * 0.3); for (let k = 0; k < 4; k++) box("flach", W * 0.22 + (r() - 0.5) * 0.7, D * 0.1 + (r() - 0.5) * 0.6, 0.18, 0.14, 0.08, wahl(r, [0xe8b04a, 0x8a8f96, 0x2c2f36])); box("haus", -W * 0.35, vorn - 0.25, 0.6, 0.4, 0.35, 0xe6dccb); break;
    case "freizeitpark": boden(0x9fd27a); for (let k = 0; k < 10; k++) box("flach", -W * 0.4 + k * W * 0.09, -D * 0.25 + Math.sin(k * 0.9) * 0.4, 0.06, 0.4 + Math.abs(Math.sin(k * 0.7)) * 1.2, 0.06, 0xe8493f); box("flach", 0, -D * 0.25, W * 0.85, 0.04, 0.1, 0xf2c14e, { ly: 1.2 }); zyl(W * 0.3, D * 0.15, 0.9, 0.12, 0x9a5be8); box("dach", W * 0.3, D * 0.15, 0.9, 0.5, 0.9, 0xe85b9a, { ly: 0.12 }); box("haus", -W * 0.35, vorn - 0.25, 0.5, 0.4, 0.35, 0xf2c14e); break;
    case "leuchtturm": boden(0xd8d0c0); zyl(0, -0.1, 0.42, 2.4, 0xf2f2f2); for (let k = 0; k < 3; k++) zyl(0, -0.1, 0.44, 0.3, 0xe8493f, { ly: 0.4 + k * 0.7 }); zyl(0, -0.1, 0.36, 0.3, 0xffe9a0, { ly: 2.4 }); box("dach", 0, -0.1, 0.46, 0.25, 0.46, 0xe8493f, { ly: 2.7 }); box("haus", 0.45, vorn - 0.2, 0.4, 0.3, 0.3, 0xf2f2f2); break;
    case "riesenrad": { boden(0xd8d0c0); for (const s2 of [-1, 1]) for (const zz of [-0.18, 0.02]) box("flach", s2 * 0.32, zz, 0.05, 1.5, 0.05, 0xc9ced6, { rz: s2 * 0.22 }); const R = 1.05; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; box("flach", 0, -0.08, 0.025, R, 0.025, 0xe8e8e8, { ly: 1.5, rz: a }); box("flach", -Math.sin(a) * R, -0.08, 0.13, 0.13, 0.13, PAL.markise[k % PAL.markise.length], { ly: 1.44 + Math.cos(a) * R }); } zyl(0, -0.08, 0.14, 0.14, 0x9aa0a8, { ly: 1.43, rx: Math.PI / 2 }); break; }
    case "fernsehturm": boden(0xd8d0c0); zyl(0, 0, 0.32, 4.6, 0xd9dde2); zyl(0, 0, 0.9, 0.4, 0xc9ced6, { ly: 3.6 }); zyl(0, 0, 0.7, 0.3, 0x9aa0a8, { ly: 3.3 }); zyl(0, 0, 0.5, 0.2, 0x7fa3b8, { ly: 4.0 }); zyl(0, 0, 0.06, 1.4, 0xe8493f, { ly: 4.6 }); break;
    case "grosspark": boden(0x6fbf55); flach(W * 0.12, -D * 0.12, 1.1, 0.9, 0x5fb8d8); flach(-W * 0.2, 0.2, 0.16, D * 0.9, 0xd8c7a0); for (let k = 0; k < 9; k++) { const a = (r() - 0.5) * W * 0.85, b = (r() - 0.5) * D * 0.85; if (Math.hypot(a - W * 0.12, b + D * 0.12) > 0.7) baum(a, b, 0.5 + r() * 0.35); } break;
  }
  if (PARK_KATS.includes(D0.kat) && detailStufe() >= 1 && !["leuchtturm", "fernsehturm", "riesenrad", "stadion"].includes(d.typ)) { const n = Math.round(W * D * 1.2); for (let k = 0; k < n; k++) { const x = (r() - 0.5) * W * 0.8, z = (r() - 0.5) * D * 0.8; if (k % 2) { box("flach", x, z, 0.16, 0.045, 0.05, 0x8b5a2b, { ly: 0.02 }); box("flach", x, z - 0.025, 0.16, 0.05, 0.012, 0x8b5a2b, { ly: 0.06 }); } else { box("flach", x, z, 0.018, 0.4, 0.018, 0x3a3d42); box("flach", x, z, 0.06, 0.03, 0.06, 0xfff2c8, { ly: 0.4 }); } } for (let k = 0; k < Math.round(W * D * 0.6); k++) box("flach", (r() - 0.5) * W * 0.8, (r() - 0.5) * D * 0.8, 0.18, 0.03, 0.12, wahl(r, [0xe85b9a, 0xf2c14e, 0xe8493f, 0x9a5be8, 0xffffff]), { ly: 0.004 }); }
  if (d.ausbau && ausbaubar(D0)) for (let i = 0; i < d.ausbau; i++) { box("haus", -W * 0.36 + i * 0.36, -D / 2 + 0.25, 0.3, 0.35 + 0.15 * i, 0.3, 0xd9d4c7); box("flach", -W * 0.36 + i * 0.36, -D / 2 + 0.25, 0.06, 0.06, 0.06, 0xf2c14e, { ly: 0.42 + 0.15 * i }); }
  return T;
}
function inDienst(x, z, rand) {
  rand = rand || 0;
  for (const d of dienste.values()) { const dx = x - d.x, dz = z - d.z, c = Math.cos(d.rot), s = Math.sin(d.rot), lx = dx * c - dz * s, lz = dx * s + dz * c; if (Math.abs(lx) < d.w * ZELLE / 2 + rand && Math.abs(lz) < d.d * ZELLE / 2 + rand) return d; }
  return null;
}
function hoeheVon(h) { let y = 0; for (const t of h.teile) if (!t.fest) y = Math.max(y, (t.ly || 0) + t.sy); return y; }
function neuerDienst(o, alt) {
  const D = DIENSTE[o.typ], d = { id: o.id || dId++, typ: o.typ, x: o.x, z: o.z, rot: o.rot, w: D.w, d: D.d, ausbau: o.ausbau || 0, variante: (o.id || dId) * 7919, geboren: alt ? -100 : jetztS, ab: 0, zug: null, dienst: true, timer: 2 + Math.random() * 4 };
  dId = Math.max(dId, d.id + 1); d.teile = dienstTeile(d); parkenNeu(d); d.hoehe = hoeheVon(d); dienste.set(d.id, d); haeuserNeu = true; versorgungZeit = -99;
  const rr = Math.max(D.w, D.d) * 0.72; baeumeFaellen({ x0: d.x - rr, x1: d.x + rr, z0: d.z - rr, z1: d.z + rr }, (bx, bz) => !!inDienst(bx, bz, 0.15));
  return d;
}
function dienstWeg(d) { parkenWeg(d);
  dienste.delete(d.id); haeuserNeu = true; versorgungZeit = -99; if (d.typ === "bahnhof") bahnGleiseZeichnen();
  const e = naechsteKante(d, 5, (k) => TYP[k.typ].zellen); if (e) { zellenFuer(e.k); }
  dreckZeichnen(); speichernBald();
}
function dienstPlan(p, typ) {
  const D = DIENSTE[typ], W = D.w * ZELLE, Dd = D.d * ZELLE;
  const e = naechsteKante(p, 3 + Dd, (k) => TYP[k.typ].autos);
  if (!e) return { ok: false, grund: "Muss an einer Straße stehen", x: p.x, z: p.z, rot: 0, W, D: Dd, typ };
  const q = punktBei(e.k, e.s), nx = -q.tz, nz = q.tx, seite = ((p.x - q.x) * nx + (p.z - q.z) * nz) >= 0 ? 1 : -1, ab = TYP[e.k.typ].halb + Dd / 2 + 0.06;
  const x = q.x + nx * seite * ab, z = q.z + nz * seite * ab, rot = Math.atan2(-nx * seite, -nz * seite), cs = Math.cos(rot), sn = Math.sin(rot);
  const plan = { ok: true, typ, x, z, rot, W, D: Dd, preis: D.preis, haeuser: 0, zug: { k: e.k.id, S: e.s } };
  let zuNah = false, land = true, bes = true, ufer = 99;
  for (let a = -0.5; a <= 0.501; a += 0.25) for (let b = -0.5; b <= 0.501; b += 0.25) {
    const lx = a * W * 0.94, lz = b * Dd * 0.94, wx = x + lx * cs + lz * sn, wz = z - lx * sn + lz * cs, ab2 = abstand(wx, wz);
    ufer = Math.min(ufer, ab2); if (ab2 < 0.3 && !(D.amWasser && b < 0.15)) land = false; if (!imBesitz(wx, wz)) bes = false;
    if (strassenFrei({ x: wx, z: wz }) < 0.02 || inDienst(wx, wz, 0.02)) zuNah = true;
  }
  const hs = new Set(); for (const c of zellenNahe(x, z, Math.max(W, Dd))) { const dx = c.x - x, dz = c.z - z, lx = dx * cs - dz * sn, lz = dx * sn + dz * cs; if (Math.abs(lx) < W / 2 + 0.3 && Math.abs(lz) < Dd / 2 + 0.3 && c.haus) hs.add(c.haus); }
  plan.haeuser = hs.size;
  const fail = (g) => { plan.ok = false; plan.grund = g; return plan; };
  if (!dienstFrei(typ)) return fail("🔒 Gibt es ab " + MEILEN[D.ab].name);
  if (D.einzig && [...dienste.values()].some((x) => x.typ === typ)) return fail("Das gibt es nur einmal in der Stadt");
  if (!bes) return fail("Außerhalb deiner Gebiete");
  if (!land) return fail("Hier ist Wasser");
  if (zuNah) return fail("Zu nah an einer Straße oder einem Gebäude");
  if (D.amWasser && ufer > 2.2) return fail("Muss direkt am Ufer stehen – die Rückseite muss ans Wasser");
  if (geld < D.preis) return fail("Zu wenig Geld (" + euro(D.preis) + ")");
  return plan;
}
function dienstBauen(plan) {
  if (!plan || !plan.ok) return null;
  const D = DIENSTE[plan.typ], cs = Math.cos(plan.rot), sn = Math.sin(plan.rot);
  for (const c of zellenNahe(plan.x, plan.z, Math.max(plan.W, plan.D))) { const dx = c.x - plan.x, dz = c.z - plan.z, lx = dx * cs - dz * sn, lz = dx * sn + dz * cs; if (Math.abs(lx) < plan.W / 2 + 0.35 && Math.abs(lz) < plan.D / 2 + 0.35) { if (c.haus) hausWeg(haeuser.get(c.haus)); zelleWeg(c); } }
  geld -= D.preis; xpPlus(Math.round(D.preis / 400)); const d = neuerDienst({ typ: plan.typ, x: plan.x, z: plan.z, rot: plan.rot });
  if (plan.gk != null) { d.gk = plan.gk; d.gs = plan.gs; }
  if (d.typ === "bahnhof" && plan.gk == null) { for (const c of [...zellen.values()]) if (aufGleis(c.x, c.z)) { if (c.haus) hausWeg(haeuser.get(c.haus)); zelleWeg(c); } const g = gleisVon(d); baeumeFaellen({ x0: Math.min(g.p0.x, g.p0.x + g.dx * 240) - 1, x1: Math.max(g.p0.x, g.p0.x + g.dx * 240) + 1, z0: Math.min(g.p0.z, g.p0.z + g.dz * 240) - 1, z1: Math.max(g.p0.z, g.p0.z + g.dz * 240) + 1 }, (bx, bz) => aufGleis(bx, bz)); bahnGleiseZeichnen(); }
  zellenNeu = true; dreckZeichnen(); zeigeWerte(); speichernBald(); return d;
}
/* Netz: welche Straßen hängen zusammen? (Strom und Rohre laufen unter den Straßen) */
let netzKomp = new Map(), kompVersion = -1;
function komponenten() {
  if (kompVersion === netzVersion) return; kompVersion = netzVersion;
  const el = new Map(), f = (a) => { while (el.get(a) !== a) { el.set(a, el.get(el.get(a))); a = el.get(a); } return a; };
  for (const n of knoten.values()) el.set(n.id, n.id);
  for (const k of kanten.values()) { const a = f(k.a), b = f(k.b); if (a !== b) el.set(a, b); }
  netzKomp = new Map(); for (const k of kanten.values()) netzKomp.set(k.id, f(k.a));
}
const kompVon = (o) => { const z = zufahrt(o); return z ? netzKomp.get(z.k) : null; };
let recyclingFak = 1;
function bedarfVon(h, r) { const b = leute(h) + jobs(h) * (gruppe(h) === "i" ? 1.0 : 0.6); return r === "abwasser" ? b * 0.9 : r === "muell" ? b * 0.8 * recyclingFak : b; }
let versorgung = { strom: [0, 0], wasser: [0, 0], abwasser: [0, 0], muell: [0, 0] }, versorgungZeit = -99, warteListe = [];
/* Reichweite über die Straßen (wie bei Cities: Skylines): Wie weit kommen die Fahrzeuge in einer bestimmten Zeit? */
const STRASSEN_DIENST = new Set(["polizei", "feuer", "gesund", "bildung"]), REICH_FAKTOR = 2.0 / 2.1;
const autoKante = (k) => TYP[k.typ].autos && !k.ring && !k.ebene;
function reichweite(start, T) {
  const k0 = kanten.get(start.k), r = { T, t: new Map(), k0: start.k, S: start.S }; if (!k0) return r;
  const zeit = new Map(), h = [], push = (id, w) => { h.push([w, id]); let i = h.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; } }, pop = () => { const top = h[0], last = h.pop(); if (h.length) { h[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, q = l + 1; let m = i; if (l < h.length && h[l][0] < h[m][0]) m = l; if (q < h.length && h[q][0] < h[m][0]) m = q; if (m === i) break; [h[m], h[i]] = [h[i], h[m]]; i = m; } } return top; };
  const v0 = TYP[k0.typ].tempo; zeit.set(k0.a, start.S / v0); zeit.set(k0.b, (k0.len - start.S) / v0); push(k0.a, start.S / v0); push(k0.b, (k0.len - start.S) / v0);
  while (h.length) { const [w, id] = pop(); if (w > (zeit.get(id) ?? 1e9) || w > T) continue; const n = knoten.get(id); if (!n) continue; for (const kid of n.kanten) { const k = kanten.get(kid); if (!k || !TYP[k.typ].autos) continue; const nach = k.a === id ? k.b : k.a, w2 = w + k.len / TYP[k.typ].tempo; if (w2 < (zeit.get(nach) ?? 1e9)) { zeit.set(nach, w2); push(nach, w2); } } }
  for (const k of kanten.values()) { if (!TYP[k.typ].autos) continue; const a = zeit.get(k.a) ?? 1e9, b = zeit.get(k.b) ?? 1e9; if (a <= T || b <= T) r.t.set(k.id, [a, b]); }
  return r;
}
function zeitBis(r, k, S) { const v = TYP[k.typ].tempo; let t = 1e9; if (k.id === r.k0) t = Math.abs(S - r.S) / v; const e = r.t.get(k.id); if (e) t = Math.min(t, e[0] + S / v, e[1] + (k.len - S) / v); return t; }
let reichCache = { key: "", m: new Map() };
function reichAktuell() {
  const key = netzVersion + "|" + [...dienste.values()].map((d) => d.id + ":" + (d.ausbau || 0)).join(",") + "|" + Object.values(budgetBereich).join(","); if (reichCache.key === key) return reichCache.m;
  const m = new Map(); for (const d of dienste.values()) { const D = DIENSTE[d.typ]; if (!STRASSEN_DIENST.has(D.kat) || !D.radius || D.luft) continue; const z = zufahrt(d); if (z) m.set(d.id, reichweite(z, reichVon(d) * REICH_FAKTOR)); }
  reichCache = { key, m }; return m;
}
function abdeckungStrasse(k, S, kat, nur) {
  if (!k) return 0; let best = 0; const m = reichAktuell();
  for (const d of dienste.values()) { const D = DIENSTE[d.typ]; if (D.kat !== kat || (nur && d !== nur)) continue; if (D.luft) { const T = reichVon(d), p = punktBei(k, S), e = Math.hypot(d.x - p.x, d.z - p.z); if (e <= T) best = Math.max(best, kat === "bildung" ? D.bildung : 1 - e / T * 0.5); continue; } const r = m.get(d.id); if (!r) continue; const t = zeitBis(r, k, S); if (t <= r.T) best = Math.max(best, kat === "bildung" ? D.bildung : 1 - t / r.T * 0.5); }
  return best;
}
const abdHaus = (h, kat, nur) => { const z = zufahrt(h); return z ? abdeckungStrasse(kanten.get(z.k), z.S, kat, nur) : 0; };
function abdeckung(x, z, kat) {
  if (STRASSEN_DIENST.has(kat)) { const e = naechsteKante({ x, z }, 3.5, autoKante); return e ? abdeckungStrasse(e.k, e.s, kat) : 0; }
  return abdeckungKreis(x, z, kat);
}
function abdeckungKreis(x, z, kat) { let best = 0; for (const d of dienste.values()) { const D = DIENSTE[d.typ]; if (D.kat !== kat || !D.radius) continue; const e = Math.hypot(d.x - x, d.z - z); if (e < D.radius) best = Math.max(best, kat === "bildung" ? D.bildung : 1 - e / D.radius * 0.5); } return best; }
function versorgungRechnen() {
  komponenten();
  recyclingFak = 1 - Math.min(0.3, 0.1 * [...dienste.values()].filter((d) => DIENSTE[d.typ].recycling).length);
  const prod = new Map(), RS = ["strom", "wasser", "abwasser", "muell"];
  const gesamt = { strom: [0, 0], wasser: [0, 0], abwasser: [0, 0], muell: [0, 0] };
  for (const d of dienste.values()) { const D = DIENSTE[d.typ]; d.komp = kompVon(d); if (d.komp == null) continue; if (!prod.has(d.komp)) prod.set(d.komp, { strom: 0, wasser: 0, abwasser: 0, muell: 0, q: [] }); const p = prod.get(d.komp); for (const r of RS) if (D[r]) { const l = leistungVon(d, r); p[r] += l; gesamt[r][0] += l; } p.q.push(d); }
  const proKomp = new Map();
  for (const h of haeuser.values()) {
    h.hat = h.hat || {}; h.komp = kompVon(h);
    if (h.verlassen) continue;
    if (h.komp == null) { for (const r of RS) { h.hat[r] = false; gesamt[r][1] += bedarfVon(h, r); } continue; }
    if (!proKomp.has(h.komp)) proKomp.set(h.komp, []); proKomp.get(h.komp).push(h);
  }
  for (const [c, L] of proKomp) {
    const p = prod.get(c) || { strom: 0, wasser: 0, abwasser: 0, muell: 0, q: [] };
    for (const r of RS) {
      const quellen = p.q.filter((d) => DIENSTE[d.typ][r]), dist = new Map();
      for (const h of L) { let m = 1e9; for (const d of quellen) m = Math.min(m, Math.hypot(d.x - h.x, d.z - h.z)); dist.set(h, m); }
      L.sort((a, b) => dist.get(a) - dist.get(b));
      let rest = p[r];
      for (const h of L) { const bed = bedarfVon(h, r); gesamt[r][1] += bed; const ok = rest >= bed - 0.01; if (ok) rest -= bed; h.hat[r] = ok; }
    }
  }
  versorgung = gesamt;
  for (const kat of ["polizei", "feuer", "gesund", "bildung"]) zuteilen(kat);
  for (const d of dienste.values()) { const D = DIENSTE[d.typ]; if (d.komp == null) continue; const p = prod.get(d.komp); for (const r of RS) if (D[r] && p) { let used = 0; for (const h of proKomp.get(d.komp) || []) if (h.hat[r]) used += bedarfVon(h, r); d.last = p[r] ? Math.min(1.5, used / p[r]) : 0; } }
  auslastungWarnen();
}
/* Kapazität: Dienste versorgen die nächsten Häuser zuerst, bis sie voll sind */
const SCHUELER = { 1: 0.22, 2: 0.12, 3: 0.08 };
function bedarfDienst(h, kat) { return kat === "gesund" ? leute(h) + jobs(h) * 0.2 : leute(h) + jobs(h); }
function zuteilen(kat) {
  const ds = [...dienste.values()].filter((d) => DIENSTE[d.typ].kat === kat && DIENSTE[d.typ].radius), m = reichAktuell(), paare = [];
  for (const d of ds) { d.genutzt = 0; d.kapazitaet = kapVon(d); }
  for (const h of haeuser.values()) {
    if (kat === "bildung") { h.bildung = 0; h.bl = {}; } else { h.abd = h.abd || {}; h.abd[kat] = 0; }
    if (h.verlassen) continue; const z = zufahrt(h), k = z && kanten.get(z.k);
    for (const d of ds) { const D = DIENSTE[d.typ]; let t; if (D.luft) { const T = reichVon(d), e = Math.hypot(d.x - h.x, d.z - h.z); if (e > T) continue; t = e / T; } else { const r = m.get(d.id); if (!r || !k) continue; const tt = zeitBis(r, k, z.S); if (tt > r.T) continue; t = tt / r.T; } paare.push([t, d, h]); }
  }
  paare.sort((a, b) => a[0] - b[0]);
  for (const [t, d, h] of paare) {
    const D = DIENSTE[d.typ];
    if (kat === "bildung") { const L = D.bildung; if (h.bl[L] || !leute(h)) continue; const bed = leute(h) * SCHUELER[L]; if (d.genutzt + bed > d.kapazitaet) continue; d.genutzt += bed; h.bl[L] = true; h.bildung = Math.max(h.bildung, L); }
    else { if (h.abd[kat]) continue; const bed = bedarfDienst(h, kat); if (d.genutzt + bed > d.kapazitaet) continue; d.genutzt += bed; h.abd[kat] = 1 - t * 0.5; }
  }
  for (const d of ds) d.last = d.kapazitaet ? d.genutzt / d.kapazitaet : 0;
}
let warnZeiten = {};
function auslastungWarnen() {
  for (const r of ["strom", "wasser", "abwasser", "muell"]) {
    const [pr, vb] = versorgung[r]; if (!vb) continue; const q = pr ? vb / pr : 9;
    if (q > 0.9 && q <= 1 && simZeit - (warnZeiten[r] || -99) > 60) { warnZeiten[r] = simZeit; tipp(RESSOURCEN[r].em + " " + RESSOURCEN[r].name + " fast aufgebraucht (" + Math.round(q * 100) + " %) – bau bald mehr oder bau aus.", 4500); }
  }
  const kopf = $("versorgungKopf"); if (kopf) kopf.innerHTML = Object.keys(RESSOURCEN).map((r) => { const [pr, vb] = versorgung[r], q = pr ? vb / pr : vb ? 9 : 0; return `<span class="vk ${q > 1 ? "rot" : q > 0.9 ? "gelb" : "gruen"}" title="${RESSOURCEN[r].name}: ${zahl(vb)} von ${zahl(pr)}">${RESSOURCEN[r].em}</span>`; }).join("");
}
const PROBLEM_TEXT = { strom: "⚡ Kein Strom", wasser: "💧 Kein Wasser", abwasser: "🚽 Abwasser wird nicht abgeholt", muell: "🗑️ Müll wird nicht abgeholt", feuer: "🔥 Es brennt!", krimi: "🦹 Viel Kriminalität", krank: "🤒 Kranke Bewohner", verlassen: "🏚️ Verlassen" };
let verlassenGemeldet = 0, problemTippZeit = -99, gefaengnisFak = 1;
function dienstTakt(dt) {
  gefaengnisFak = 1 - Math.min(0.6, 0.3 * [...dienste.values()].filter((d) => DIENSTE[d.typ].gefaengnis).length);
  if (simZeit - versorgungZeit > 2) { versorgungZeit = simZeit; versorgungRechnen(); busRechnen(); }
  linienTakt();
  warteListe = warteListe.filter((w) => { if (simZeit >= w.t) { w.fn(); return false; } return true; });
  let probleme = { strom: 0, wasser: 0, abwasser: 0, muell: 0 };
  for (const h of [...haeuser.values()]) {
    if (h.verlassen) { if (simZeit - h.verlassen > 50) hausWeg(h); continue; }
    const hat = h.hat || {}, a = h.abd || {};
    const lebt = leute(h) + jobs(h) > 0, jung = simZeit - (h.simGeboren || 0) < TAG_SEK * 7;
    h.krimi = a.polizei ? Math.max(0, (h.krimi || 0) - dt * 3) : (h.krimi || 0) + dt * (lebt ? 0.25 + Math.min(0.5, leute(h) / 80) : 0) * gefaengnisFak * (hatEntw("polizei2") ? 0.7 : 1);
    h.krank = a.gesund ? Math.max(0, (h.krank || 0) - dt * 3) : (h.krank || 0) + dt * (gruppe(h) === "w" ? 0.25 : 0.08) * (hatEntw("gesund2") ? 0.7 : 1);
    let p = null;
    if (h.brand) p = "feuer";
    else if (!jung) for (const r of ["strom", "wasser", "abwasser", "muell"]) if (hat[r] === false) { probleme[r]++; if (!p) p = r; }
    if (!p && h.krimi > 90) p = "krimi"; if (!p && h.krank > 100) p = "krank";
    h.problem = p;
    const not = p && ["strom", "wasser", "abwasser", "muell"].includes(p);
    if (not) { if (h.notSeit == null) h.notSeit = simZeit; } else h.notSeit = null;
    const nd = h.notSeit != null ? simZeit - h.notSeit : 0, T7 = TAG_SEK * 7, alt = h.pStufe || 0;
    h.pStufe = h.brand ? 3 : not ? (nd < TAG_SEK * 3 ? 0 : nd < T7 * 2 ? 1 : nd < T7 * 3 ? 2 : 3) : p ? (h.krimi > 160 || h.krank > 180 ? 2 : 1) : 0;
    if (h.pStufe > alt) h.pZeit = jetztS;
    if (h.notSeit != null && simZeit - h.notSeit > T7 * 6) { h.verlassen = simZeit; h.notSeit = null; haeuserNeu = true; verlassenGemeldet++; }
    // Brand
    if (h.brand) {
      const b = h.brand;
      if (!b.gerufen && a.feuer) { const w = naechsteWache(h, "feuer"); if (w) { const f = einsatz(w, h, DIENSTE[w.typ].radius > 15 && (h.hoehe || 0) > 1.2 ? "drehleiter" : "feuerwehr", () => { if (h.brand) { h.brand = null; tipp("🚒 Feuer gelöscht: " + hausName(h), 2500); } }); if (f) b.gerufen = true; } }
      if (simZeit - b.t > (a.feuer ? 90 : 60)) { tipp("🔥 " + hausName(h) + " ist abgebrannt" + (a.feuer ? "." : " – bau eine Feuerwache in der Nähe!"), 4000); h.brand = null; hausWeg(h); }
    }
  }
  if (verlassenGemeldet && simZeit - problemTippZeit > 60) { problemTippZeit = simZeit; tipp("🏚️ Leute ziehen weg! Häuser ohne Strom, Wasser oder Müllabfuhr werden verlassen.", 5000); verlassenGemeldet = 0; }
  else if (simZeit - problemTippZeit > 180) {
    probleme = { strom: 0, wasser: 0, abwasser: 0, muell: 0 }; for (const h of haeuser.values()) if (h.problem && probleme[h.problem] != null && (h.pStufe || 0) >= 2) probleme[h.problem]++;
    const top = Object.entries(probleme).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 3) { problemTippZeit = simZeit; const hilfe = { strom: "Bau ein Windrad oder Kraftwerk (🏛️ Dienste → ⚡ Strom).", wasser: "Bau eine Wasserpumpe am Ufer (🏛️ Dienste → 💧 Wasser).", abwasser: "Bau eine Kläranlage am Ufer (🏛️ Dienste → 💧 Wasser).", muell: "Bau eine Mülldeponie (🏛️ Dienste → 🗑️ Müll)." }; tipp(PROBLEM_TEXT[top[0]] + " bei " + top[1] + " Häusern. " + hilfe[top[0]], 6000); }
  }
  // Brände entstehen
  if (haeuser.size > 40 && Math.random() < 0.0015 * dt * Math.min(2, haeuser.size / 150) * (hatEntw("feuer2") ? 0.5 : 1)) {
    const L = [...haeuser.values()].filter((h) => !h.brand && !h.verlassen), h = L[Math.floor(Math.random() * L.length)];
    if (h && (!(h.abd && h.abd.feuer) || Math.random() < 0.3)) { h.brand = { t: simZeit, gerufen: false }; if (!(h.abd && h.abd.feuer)) tipp("🔥 Feuer bei " + hausName(h) + "! Ohne Feuerwache brennt es ab.", 4000); }
  }
  // Fahrzeuge der Dienste
  for (const d of dienste.values()) {
    d.timer -= dt; if (d.timer > 0) continue;
    const D = DIENSTE[d.typ];
    if (D.muell) { d.timer = 7; if (eigeneFahrzeuge(d) < 3) { const L = [...haeuser.values()].filter((h) => h.komp === d.komp && !h.verlassen); if (L.length) einsatz(d, wahl(Math.random, L), Math.random() < 0.2 ? "kehrmaschine" : "muell", null, true); } }
    else if (D.kat === "polizei") { d.timer = 9; if (eigeneFahrzeuge(d) < (D.radius > 15 ? 3 : 2)) { const L = [...haeuser.values()].filter((h) => abdHaus(h, "polizei", d) > 0); if (L.length) { const h = L.reduce((m, x) => (x.krimi || 0) > (m.krimi || 0) ? x : m, wahl(Math.random, L)); einsatz(d, h, D.radius > 15 && Math.random() < 0.4 ? "polizeivan" : "polizei", () => { h.krimi = 0; }, true); } } }
    else if (D.kat === "gesund") { d.timer = D.radius > 10 ? 10 : 16; if (eigeneFahrzeuge(d) < (D.radius > 10 ? 2 : 1)) { const L = [...haeuser.values()].filter((h) => (h.krank || 0) > 20 && abdHaus(h, "gesund", d) > 0); if (L.length) { const h = wahl(Math.random, L); einsatz(d, h, D.radius > 10 ? "kranken" : "notarzt", () => { h.krank = 0; }, true); } } }
    else d.timer = 5;
  }
}
const naechsteWache = (h, kat) => { const z = zufahrt(h), k = z && kanten.get(z.k); if (!k) return null; const m = reichAktuell(); let best = null, bd = 1e9; for (const d of dienste.values()) { const D = DIENSTE[d.typ], r = m.get(d.id); if (D.kat !== kat || !r || D.luft) continue; if (eigeneFahrzeuge(d) >= (D.zuege || 2) * ausbauFak(d)) continue; const t = zeitBis(r, k, z.S); if (t <= r.T && t < bd) { bd = t; best = d; } } return best; };
const eigeneFahrzeuge = (d) => fahrzeuge.filter((f) => f.dienstId === d.id).length;
function einsatz(d, h, typ, beiAnkunft, zurueck) {
  const za = zufahrt(d), zb = zufahrt(h); if (!za || !zb) return null;
  const torP = d.teile && d.teile.tor ? hausPunkt(d, d.teile.tor) : null;
  const f = fahrzeugAusWeg(wegSuchen(za, zb), typ, null, DIENSTE[d.typ].name, hausName(h), torP ? "haus" : "aussen", torP ? { vonP: torP } : null); if (!f) return null;
  f.alarm = !!FZ[typ].blau; if (f.alarm) f.faktor *= 1.15;
  f.dienstId = d.id;
  f.beiAnkunft = () => { if (beiAnkunft) beiAnkunft(); if (zurueck && dienste.has(d.id)) warteListe.push({ t: simZeit + 3, fn: () => { const z1 = zufahrt(h), z2 = zufahrt(d); if (z1 && z2 && dienste.has(d.id)) { const g = fahrzeugAusWeg(wegSuchen(z1, z2), typ, null, hausName(h), DIENSTE[d.typ].name, "haus", d.teile && d.teile.tor ? { nachP: hausPunkt(d, d.teile.tor) } : null); if (g) g.dienstId = d.id; } } }); };
  return f;
}
function dienstKosten() { let s = 0; for (const d of dienste.values()) s += unterhaltVon(d); return s; }
/* Warnsymbole über Häusern */
const WARN = { strom: "⚡", wasser: "💧", abwasser: "🚽", muell: "🗑️", feuer: "🔥", krimi: "🦹", krank: "🤒", verlassen: "🏚️" };
/* Selbst gezeichnete Problem-Nadeln: Farbe = Dringlichkeit (blau Hinweis, orange Warnung, rot dringend) */
const NADEL_FARBE = ["#2f8fe8", "#2f8fe8", "#f29a1b", "#e8493f"], NADEL_BILD = {
  strom: (g) => { g.fillStyle = "#f2b31b"; const q = new Path2D("M3 -12 L-6 2 L0 2 L-3 12 L7 -3 L1 -3 L4 -12 Z"); g.fill(q); g.stroke(q); },
  wasser: (g) => { g.fillStyle = "#2f8fe8"; const q = new Path2D("M0 -12 C5 -4 9 1 9 5 A9 9 0 0 1 -9 5 C-9 1 -5 -4 0 -12 Z"); g.fill(q); g.stroke(q); },
  abwasser: (g) => { g.fillStyle = "#8a6a3a"; const q = new Path2D("M0 -12 C5 -4 9 1 9 5 A9 9 0 0 1 -9 5 C-9 1 -5 -4 0 -12 Z"); g.fill(q); g.stroke(q); g.strokeStyle = "#ffffff"; g.beginPath(); g.moveTo(-5, 5); g.quadraticCurveTo(-2, 2, 0, 5); g.quadraticCurveTo(2, 8, 5, 5); g.stroke(); },
  muell: (g) => { g.fillStyle = "#7a8a96"; g.beginPath(); g.rect(-8, -4, 16, 13); g.fill(); g.stroke(); g.beginPath(); g.moveTo(-10, -4); g.lineTo(10, -4); g.moveTo(-3, -8); g.lineTo(3, -8); g.lineTo(3, -4); g.moveTo(-3, -8); g.lineTo(-3, -4); g.stroke(); g.strokeStyle = "#ffffff"; g.lineWidth = 1.3; g.beginPath(); for (const x of [-3, 0, 3]) { g.moveTo(x, -1); g.lineTo(x, 6); } g.stroke(); },
  feuer: (g) => { g.fillStyle = "#ff7a1a"; const q = new Path2D("M0 -12 C6 -5 9 -1 8 4 C7 9 3 11 0 11 C-4 11 -8 8 -8 3 C-8 -1 -5 -3 -4 -7 C-2 -4 -1 -3 0 -3 C1 -6 0 -9 0 -12 Z"); g.fill(q); g.stroke(q); g.fillStyle = "#ffd23d"; g.fill(new Path2D("M0 2 C2 4 3 6 2 8 C1 10 -2 10 -3 8 C-3 6 -1 4 0 2 Z")); },
  krimi: (g) => { g.fillStyle = "#3d5a80"; const q = new Path2D("M0 -12 L9 -8 V0 C9 6 5 10 0 12 C-5 10 -9 6 -9 0 V-8 Z"); g.fill(q); g.stroke(q); g.fillStyle = "#f2c14e"; g.fill(new Path2D("M0 -6 L1.8 -2 L6 -1.6 L2.8 1.2 L3.8 5.4 L0 3.2 L-3.8 5.4 L-2.8 1.2 L-6 -1.6 L-1.8 -2 Z")); },
  krank: (g) => { g.fillStyle = "#ffffff"; g.beginPath(); g.roundRect(-9, -9, 18, 18, 4); g.fill(); g.stroke(); g.fillStyle = "#e8493f"; g.fill(new Path2D("M-2.5 -6 H2.5 V-2.5 H6 V2.5 H2.5 V6 H-2.5 V2.5 H-6 V-2.5 H-2.5 Z")); },
  verlassen: (g) => { g.fillStyle = "#c4b8a8"; const q = new Path2D("M-9 10 V-2 L0 -10 L9 -2 V10 Z"); g.fill(q); g.stroke(q); g.strokeStyle = "#5a3a24"; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-4, 0); g.lineTo(4, 8); g.moveTo(4, 0); g.lineTo(-4, 8); g.stroke(); }
};
const warnMat = {};
function nadelMat(art, stufe) {
  const key = art + ":" + stufe; if (warnMat[key]) return warnMat[key];
  const c = document.createElement("canvas"); c.width = 128; c.height = 160; const g = c.getContext("2d");
  g.translate(64, 62); g.lineJoin = "round"; g.lineWidth = 6; g.strokeStyle = "#1b1e24";
  g.fillStyle = art === "verlassen" ? "#6b6f78" : art === "feuer" ? "#e8493f" : NADEL_FARBE[stufe];
  const pin = new Path2D("M0 92 C-14 64 -48 46 -48 0 A48 48 0 1 1 48 0 C48 46 14 64 0 92 Z"); g.fill(pin); g.stroke(pin);
  g.fillStyle = "#ffffff"; g.beginPath(); g.arc(0, 0, 34, 0, Math.PI * 2); g.fill();
  g.save(); g.scale(2.15, 2.15); g.lineWidth = 1.5; g.strokeStyle = "#1b1e24"; g.lineJoin = "round"; (NADEL_BILD[art] || NADEL_BILD.strom)(g); g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (warnMat[key] = new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
}
const warnSprites = []; for (let i = 0; i < 220; i++) { const s = new THREE.Sprite(nadelMat("strom", 1)); s.center.set(0.5, 0.02); s.visible = false; s.renderOrder = 8; szene.add(s); warnSprites.push(s); }
function warnZeichnen() {
  let i = 0; const ka = kameraAbstand(), basis = 0.8 * klemme(ka / 14, 0.9, 4.5);
  for (const h of haeuser.values()) {
    const w = h.verlassen ? "verlassen" : (h.pStufe || 0) >= 1 ? h.problem : null; if (!w || i >= warnSprites.length) continue;
    const st = h.verlassen ? 3 : h.pStufe || 1, s = warnSprites[i++]; s.material = nadelMat(w, st); s.visible = true;
    const pop = h.pZeit ? 1 + 0.6 * Math.exp(-Math.max(0, jetztS - h.pZeit) * 4) : 1, sc = basis * pop * (st >= 3 ? 1.1 : st === 2 ? 1 : 0.85);
    s.scale.set(sc * 0.8, sc, 1); s.position.set(h.x, BODEN + (h.hoehe || 0.6) + 0.15 + Math.sin(jetztS * 2.6 + h.id) * 0.04 * basis, h.z);
  }
  for (; i < warnSprites.length; i++) warnSprites[i].visible = false;
}
/* Vorschau beim Bauen */
const geist = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, opacity: 0.4, depthWrite: false })); geist.visible = false; geist.renderOrder = 5; szene.add(geist);
const geistRing = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 72).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false })); geistRing.visible = false; geistRing.renderOrder = 5; szene.add(geistRing);
const geistFlaeche = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false })); geistFlaeche.visible = false; szene.add(geistFlaeche);
let dienstWahl = "windrad", dienstKat = "strom", dienstPlanAktuell = null;
/* Vorschau: das echte Gebäude halb durchsichtig an der Stelle, wo es hinkommt */
const geistModell = new THREE.Group(); geistModell.visible = false; szene.add(geistModell); let geistTyp = null;
const GEIST_GEO = { dach: G_DACH, walm: G_WALM, pult: G_PULT, mansard: G_MANSARD, zelt: G_ZELT, zyl: G_ZYL, garten: G_LAUBBAUM };
const geistMat = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.78, roughness: 0.7, depthWrite: true, side: THREE.DoubleSide });
function geistBauen(typ) {
  if (geistTyp === typ) return; geistTyp = typ;
  for (const c of [...geistModell.children]) { geistModell.remove(c); c.dispose && c.dispose(); }
  const T = dienstTeile({ typ, id: 1, ausbau: 0, x: 0, z: 0, rot: 0 }), gruppen = {};
  for (const t of T) { if (t.fest) continue; (gruppen[GEIST_GEO[t.b] ? t.b : "box"] = gruppen[GEIST_GEO[t.b] ? t.b : "box"] || []).push(t); }
  for (const k in gruppen) {
    const L = gruppen[k], m = new THREE.InstancedMesh(GEIST_GEO[k] || G_BOX_UNTEN, geistMat, L.length);
    L.forEach((t, i) => { _o.position.set(t.lx, BODEN - G + (t.ly || 0), t.lz); _o.rotation.set(t.rx || 0, t.ry || 0, t.rz || 0, "YXZ"); _o.scale.set(t.sx, Math.max(t.sy, 1e-3), t.sz); _o.updateMatrix(); m.setMatrixAt(i, _o.matrix); m.setColorAt(i, _farbe.setHex(t.c == null ? 0x6fae4a : t.c)); });
    _o.rotation.order = "XYZ"; m.renderOrder = 6; geistModell.add(m);
  }
}
function dienstVorschau(p) {
  const plan = dienstWahl === "bahnhof" ? bahnhofPlan(p) : dienstPlan(p, dienstWahl), D = DIENSTE[dienstWahl]; dienstPlanAktuell = plan;
  geist.visible = true; geist.position.set(plan.x, G + 0.01, plan.z); geist.rotation.set(0, plan.rot, 0); geist.scale.set(plan.W, 0.03, plan.D); geist.material.color.setHex(plan.ok ? 0x7dffb0 : 0xff5a5a); geist.material.opacity = 0.55;
  if (dienstWahl !== "bahnhof") { geistBauen(dienstWahl); geistModell.visible = true; geistModell.position.set(plan.x, G, plan.z); geistModell.rotation.set(0, plan.rot, 0); geistMat.emissive.setHex(plan.ok ? 0x000000 : 0x661010); geistMat.opacity = plan.ok ? 0.8 : 0.55; }
  const strasse = STRASSEN_DIENST.has(D.kat), rad = strasse ? 0 : D.radius || 0; geistRing.visible = geistFlaeche.visible = rad > 0;
  reichZeichnen(strasse && plan.zug ? D.kat : null, strasse && plan.zug ? reichweite(plan.zug, D.radius * REICH_FAKTOR) : null);
  if (rad) { geistRing.position.set(plan.x, G + 0.06, plan.z); geistRing.scale.setScalar(rad); geistFlaeche.position.set(plan.x, G + 0.055, plan.z); geistFlaeche.scale.setScalar(rad); }
  frage(D.em + " " + D.name + " · " + euro(D.preis) + " · " + euro(D.unterhalt) + "/Wo" + (plan.ok ? (plan.haeuser ? " · reißt " + plan.haeuser + " Haus ab" : "") : " – " + plan.grund), plan.ok, () => {
    merkeRueck(); const d = dienstBauen(dienstPlanAktuell); if (!d) return; geist.visible = geistRing.visible = geistFlaeche.visible = geistModell.visible = false; frageZu();
    tipp("✅ " + D.name + " gebaut! " + (D.depot ? "Jetzt fahren die Fahrzeuge deiner Linien los." : D.kat === "verkehr" ? "" : D.radius ? "Die eingefärbten Straßen zeigen, wie weit es wirkt." : "Strom und Rohre laufen automatisch durch die Straßen."), 3500); versorgungRechnen();
    if (werkzeug === "verkehr") { busModus = "halt"; unterleiste(); } else if (werkzeug === "gleis") { gleisModus = "gerade"; unterleiste(); }
  });
}
function vorschauWeg() { geist.visible = geistRing.visible = geistFlaeche.visible = false; if (typeof geistModell !== "undefined") geistModell.visible = false; dienstPlanAktuell = null; if (!(ansicht && ANSICHTEN[ansicht] && STRASSEN_DIENST.has(ANSICHTEN[ansicht].kat))) reichZeichnen(null); }
/* Erreichte Straßen einfärben */
const reichMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false })); reichMesh.renderOrder = 4; reichMesh.visible = false; szene.add(reichMesh);
function reichZeichnen(kat, extra) {
  if (!kat) { reichMesh.visible = false; return; }
  const pos = [], col = [], c = new THREE.Color(), rot = farbe(0xff4a3d), gelb = farbe(0xffd23d), gruen = farbe(0x2fd66b), m = extra ? null : reichAktuell();
  for (const k of kanten.values()) {
    if (!TYP[k.typ].autos) continue;
    for (let i = 0; i < k.pts.length - 1; i += 1) {
      const a = k.pts[i], b = k.pts[i + 1], S = (a.s + b.s) / 2; let v = 0;
      if (extra) { const t = zeitBis(extra, k, S); v = t <= extra.T ? 1 - t / extra.T * 0.5 : 0; } else v = Math.min(1, abdeckungStrasse(k, S, kat) / (kat === "bildung" ? 3 : 1));
      if (v <= 0) continue; c.copy(gelb).lerp(gruen, klemme((v - 0.5) * 2, 0, 1)); if (v < 0.5) c.copy(rot).lerp(gelb, v * 2);
      band(pos, col, [a, b], TYP[k.typ].fahr + 0.1, (q) => G + 0.05 + ebeneY(k, q.s), c);
    }
  }
  reichMesh.geometry.dispose(); reichMesh.geometry = pos.length ? geoAus(pos, col) : new THREE.BufferGeometry(); reichMesh.visible = true;
}
/* Wirkungskreise in den Info-Ansichten */
const kreise = new THREE.InstancedMesh(new THREE.RingGeometry(0.975, 1, 72).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }), 200);
kreise.count = 0; kreise.frustumCulled = false; kreise.renderOrder = 4; kreise.setColorAt(0, new THREE.Color()); szene.add(kreise);
function kreiseZeichnen(kat) {
  let i = 0;
  if (kat) for (const d of dienste.values()) { const D = DIENSTE[d.typ]; if (D.kat !== kat || !D.radius || i >= 200) continue; _o.position.set(d.x, G + 0.07, d.z); _o.rotation.set(0, 0, 0); _o.scale.setScalar(D.radius); _o.updateMatrix(); kreise.setMatrixAt(i, _o.matrix); kreise.setColorAt(i, _farbe.setHex(0xffffff)); i++; }
  kreise.count = i; kreise.instanceMatrix.needsUpdate = true; if (kreise.instanceColor) kreise.instanceColor.needsUpdate = true;
}
function dienstInfo(d) {
  const D = DIENSTE[d.typ];
  let leistung = "";
  const balken = (q) => `<div class="leiste" style="margin:4px 0 2px"><i style="width:${Math.min(100, q * 100)}%;background:${q > 1 ? "#ff6b6b" : q > 0.9 ? "#ffd23d" : "#4fd27a"}"></i></div><small>Auslastung ${Math.round(q * 100)} %</small>`;
  if (d.slots && d.slots.length && (d.typ === "parkplatz" || d.typ === "parkhaus")) { const bel = d.slots.filter((q) => q.auto).length; leistung += `<br>🅿️ ${bel} von ${d.slots.length} Plätzen belegt${balken(bel / d.slots.length)}`; }
  for (const r of ["strom", "wasser", "abwasser", "muell"]) if (D[r]) { const v = versorgung[r]; leistung += `<br>${RESSOURCEN[r].em} ${RESSOURCEN[r].name}: ${zahl(leistungVon(d, r))} · Stadt: ${zahl(v[1])} von ${zahl(v[0])} gebraucht${balken(v[0] ? v[1] / v[0] : 0)}`; }
  if (D.kap) leistung += `<br>👥 Kapazität: ${zahl(d.genutzt || 0)} von ${zahl(kapVon(d))}${D.zuege ? " · 🚒 " + Math.round(D.zuege * ausbauFak(d)) + " Löschzüge" : ""}${balken(d.last || 0)}`;
  if (D.radius) leistung += STRASSEN_DIENST.has(D.kat) && !D.luft ? `<br>🛣️ Reichweite: ca. ${Math.round(reichVon(d) * 2)} Felder über die Straßen (Hauptstraßen weiter)` : `<br>⭕ Wirkungskreis: ${Math.round(D.luft ? reichVon(d) : D.radius)} Felder`;
  if (D.froh) leistung += `<br>😊 Ganze Stadt +${D.froh} % zufriedener`;
  if (D.wert) leistung += `<br>💎 Bodenwert +${D.wert} in der Nähe`;
  const aus = d.ausbau || 0, ausPreis = Math.round(D.preis * 0.6 * (aus + 1));
  const ausKnopf = ausbaubar(D) ? (aus < 2 ? `<button class="chip" type="button" id="dienstAusbau" style="margin-top:6px;margin-right:6px">⬆️ Ausbauen auf Stufe ${aus + 2} (${euro(ausPreis)})</button>` : `<small>⭐ Voll ausgebaut</small><br>`) : "";
  infoZeigen(`<b>${D.em} ${D.name}${aus ? " ⭐".repeat(aus) : ""}</b><small>${DIENST_KAT[D.kat].name}${ausbaubar(D) ? " · Stufe " + (aus + 1) + "/3" : ""} · ${euro(unterhaltVon(d))} Unterhalt pro Woche</small>${leistung}${d.komp == null ? "<br>⚠️ Nicht an eine Straße angeschlossen" : ""}<br><small>${D.text}</small><br>${ausKnopf}<button class="chip gefahr" type="button" id="dienstAbriss" style="margin-top:6px">🧹 Abreißen (+${euro(D.preis * 0.3)})</button>`, 9000);
  if ($("dienstAusbau")) $("dienstAusbau").onclick = () => { if (geld < ausPreis) { tipp("Zu wenig Geld für den Ausbau.", 2000); return; } merkeRueck(); geld -= ausPreis; d.ausbau = aus + 1; d.teile = dienstTeile(d); d.box = null; d.hoehe = hoeheVon(d); d.geboren = jetztS; d.ab = 0.6; haeuserNeu = true; versorgungZeit = -99; versorgungRechnen(); zeigeWerte(); speichernBald(); hochZeigen(d, d.hoehe); tipp("⬆️ " + D.name + " ausgebaut: mehr Leistung und Reichweite!", 2600); dienstInfo(d); };
  $("dienstAbriss").onclick = () => { merkeRueck(); dienstWeg(d); geld += D.preis * 0.3; $("info").hidden = true; zeigeWerte(); tipp("🧹 " + D.name + " abgerissen.", 2000); };
}

/* ================================================================
   Nahverkehr: Haltestellen und Buslinien
   ================================================================ */
const halte = new Map(), linien = new Map(); let haltId = 1, linieId = 1;
const LINIEN_FARBEN = [0xe8493f, 0x3f7fe8, 0x2fbf6a, 0xf2a93b, 0x9a5be8, 0xe85b9a, 0x2fb8c9, 0x8a6a3a];
const BUS_MODELLE = { mix: "🔀 Gemischt", bus: "🚌 Stadtbus", gelenkbus: "🚍 Gelenkbus", doppeldecker: "🚌 Doppeldecker", ebus: "⚡ Elektrobus", minibus: "🚐 Kleinbus" };
const HALT_PREIS = 300, BUS_UNTERHALT = 120, HALT_RADIUS = 6;
function haltTeile(h) {
  const k = kanten.get(h.k), o = k ? TYP[k.typ].halb - 0.13 : 0.55, T = [];
  for (const s of [1, -1]) {
    const z = s * o;
    T.push({ b: "flach", lx: 0, ly: 0, lz: z, sx: 0.5, sy: 0.26, sz: 0.012, c: 0x9fc3d6 });
    T.push({ b: "flach", lx: 0, ly: 0.26, lz: z + s * 0.05, sx: 0.56, sy: 0.025, sz: 0.2, c: 0x3a3f47 });
    T.push({ b: "flach", lx: -0.25, ly: 0, lz: z + s * 0.08, sx: 0.02, sy: 0.26, sz: 0.02, c: 0x3a3f47 }, { b: "flach", lx: 0.25, ly: 0, lz: z + s * 0.08, sx: 0.02, sy: 0.26, sz: 0.02, c: 0x3a3f47 });
    T.push({ b: "flach", lx: 0.36, ly: 0, lz: z + s * 0.1, sx: 0.02, sy: 0.38, sz: 0.02, c: 0x9aa0a8 }, { b: "flach", lx: 0.36, ly: 0.33, lz: z + s * 0.1, sx: 0.12, sy: 0.12, sz: 0.015, c: 0xf2c14e });
    T.push({ b: "flach", lx: 0, ly: 0.05, lz: z + s * 0.06, sx: 0.4, sy: 0.02, sz: 0.06, c: 0x8b5a2b });
  }
  return T;
}
function haltPose(h) { const k = kanten.get(h.k); if (!k) return false; const p = punktBei(k, klemme(h.s, 0.5, k.len - 0.5)); h.x = p.x; h.z = p.z; h.rot = Math.atan2(-p.tz, p.tx); h.teile = haltTeile(h); h.hoehe = 0.4; return true; }
function neueHalte(o, alt) { const h = { id: o.id || haltId++, k: o.k, s: o.s, geboren: alt ? -100 : jetztS, ab: 0, variante: 1, wartend: 0 }; haltId = Math.max(haltId, h.id + 1); if (!haltPose(h)) return null; halte.set(h.id, h); haeuserNeu = true; linienNeu = true; return h; }
function halteWeg(h) { halte.delete(h.id); for (const L of [...linien.values()]) { L.halte = L.halte.filter((id) => id !== h.id); if (L.halte.length < 2) linieWeg(L); } haeuserNeu = true; linienNeu = true; }
function halteBei(p, r) { let best = null, bd = r || 1.2; for (const h of halte.values()) { const d = Math.hypot(h.x - p.x, h.z - p.z); if (d < bd) { bd = d; best = h; } } return best; }
function halteNeuAnkern() {
  for (const h of [...halte.values()]) {
    if (kanten.has(h.k)) { haltPose(h); continue; }
    const e = naechsteKante(h, 1.5, (k) => TYP[k.typ].autos); if (!e) { halteWeg(h); continue; }
    h.k = e.k.id; h.s = e.s; haltPose(h);
  }
  haeuserNeu = true; linienNeu = true;
}
function linieWeg(L) { linien.delete(L.id); for (const f of fahrzeuge) if (f.linie === L.id) fahrzeugWeg(f); fahrzeuge = fahrzeuge.filter((f) => !f.weg); linienNeu = true; }
const haltPunkt = (h) => ({ k: h.k, S: klemme(h.s, 0.6, kanten.get(h.k).len - 0.6) });
function linieErreichbar(ids, tram) { for (let i = 0; i < ids.length; i++) { const a = halte.get(ids[i]), b = halte.get(ids[(i + 1) % ids.length]); if (!a || !b || !kanten.has(a.k) || !kanten.has(b.k)) return false; if (tram && (!kanten.get(a.k).schienen || !kanten.get(b.k).schienen)) return false; if (!wegSuchen(haltPunkt(a), haltPunkt(b), tram)) return false; } return true; }
let ticketPreis = 1.5, nvWoche = { fahrten: 0, einnahmen: 0 }, nvLetzte = { fahrten: 0, einnahmen: 0 };
const ticketFak = () => klemme(1.6 - ticketPreis * 0.4, 0.3, 1.4);
function depotFuer(L, nahe) { let best = null, bd = 1e9; for (const d of dienste.values()) { if (DIENSTE[d.typ].depot !== (L.art === "tram" ? "tram" : "bus")) continue; const e = Math.hypot(d.x - nahe.x, d.z - nahe.z); if (e < bd) { bd = e; best = d; } } return best; }
function umlaufZeit(L) { let len = 0; for (let i = 0; i < L.halte.length; i++) { const a = halte.get(L.halte[i]), b = halte.get(L.halte[(i + 1) % L.halte.length]); if (!a || !b || !kanten.has(a.k) || !kanten.has(b.k)) continue; const w = wegSuchen(haltPunkt(a), haltPunkt(b), L.art === "tram"); if (w) for (const st of w.route) len += kanten.get(st.k).len; } return len / 1.7 + L.halte.length * 3.5; }
const tramW = (L) => L && L.art === "tram";
function busseFuer(L) { if (L.umlaufV !== netzVersion) { L.umlauf = umlaufZeit(L); L.umlaufV = netzVersion; } return klemme(Math.ceil(L.umlauf / (L.takt || 40)), 1, 24); }
function busStarten(L, i) {
  const a = halte.get(L.halte[i % L.halte.length]); if (!a) return null;
  const dep = depotFuer(L, a); L.keinDepot = !dep; if (!dep) return null;
  const za = zufahrt(dep); if (!za) return null;
  const tram = L.art === "tram", mod = L.modell && L.modell !== "mix" ? L.modell : wahl(Math.random, ["bus", "bus", "gelenkbus", "doppeldecker", "ebus", "minibus"]), f = fahrzeugAusWeg(wegSuchen(za, haltPunkt(a)), tram ? "tram" : mod, null, DIENSTE[dep.typ].name, "Haltestelle", "haus"); if (!f) return null;
  f.linie = L.id; f.ziel = i % L.halte.length; f.farbe = L.farbe; f.insassen = 0; f.nachText = "🚏 Haltestelle " + (f.ziel + 1); f.vonText = (tram ? "🚋" : "🚌") + " Linie " + L.nr; return f;
}
function haltestelleBedienen(f) {
  const L = linien.get(f.linie), h = L && halte.get(L.halte[f.ziel % L.halte.length]); if (!h) return 2;
  const kap = PLAETZE[f.typ] || 50; f.insassen = f.insassen || 0;
  const aus = Math.round(f.insassen * (0.3 + Math.random() * 0.4)); f.insassen -= aus;
  const ein = Math.max(0, Math.min(Math.floor(h.wartend), kap - f.insassen)); h.wartend -= ein; f.insassen += ein;
  L.fahrgaeste = (L.fahrgaeste || 0) + ein; L.plaetzeSumme = (L.plaetzeSumme || 0) + kap; L.besetztSumme = (L.besetztSumme || 0) + f.insassen;
  nvWoche.fahrten += ein; nvWoche.einnahmen += ein * ticketPreis; geld += ein * ticketPreis;
  return 1.6 + (ein + aus) * 0.02;
}
function busWeiter(f) {
  const L = linien.get(f.linie); if (!L) { fahrzeugWeg(f); return; }
  const a = halte.get(L.halte[f.ziel % L.halte.length]);
  const n = (f.ziel + 1) % L.halte.length, b = halte.get(L.halte[n]); if (!a || !b) { fahrzeugWeg(f); return; }
  const kk = kanten.get(f.route[f.ri].k), weg = kk && wegSuchen({ k: kk.id, S: f.route[f.ri].dir > 0 ? f.s : kk.len - f.s }, haltPunkt(b), L.art === "tram" && kk.schienen);
  if (!weg) { f.halt = 3; return; }
  Object.assign(f, { route: weg.route, ri: 0, s: weg.s0, sZiel: weg.s1, ziel: n, frei: false, ausparken: true, kurveFuer: -1, warte: 0, parkt: 0, nachText: "🚏 Haltestelle " + (n + 1) });
  spurWaehlen(f);
}
function linienTakt() {
  for (const L of linien.values()) {
    L.busse = busseFuer(L);
    const da = fahrzeuge.filter((f) => f.linie === L.id), n = da.length;
    if (n < L.busse && (!L.letzterStart || simZeit - L.letzterStart > (L.takt || 40) * 0.6)) { if (busStarten(L, n % L.halte.length)) L.letzterStart = simZeit; }
    if (n > L.busse + 1) { fahrzeugWeg(da[0]); fahrzeuge = fahrzeuge.filter((f) => !f.weg); }
  }
  for (const h of halte.values()) h.wartend = Math.min(150, h.wartend + (h.inLinie ? 0.05 + h.umgebung * 0.0025 * ticketFak() : 0));
}
/* Wer wohnt oder arbeitet nah an einer Haltestelle mit Linie? */
let busAbdeckung = { leute: 0, jobs: 0, anteil: 0, fahrgaeste: 0 };
function busRechnen() {
  const aktiv = new Set(), tram = new Set(); for (const L of linien.values()) for (const id of L.halte) { aktiv.add(id); if (L.art === "tram") tram.add(id); }
  for (const h of halte.values()) { h.inLinie = aktiv.has(h.id); h.tram = tram.has(h.id); h.umgebung = 0; }
  let l = 0, j = 0, alle = 0;
  for (const h of haeuser.values()) {
    let nah = null; for (const s of halte.values()) if (s.inLinie && Math.hypot(s.x - h.x, s.z - h.z) < (s.tram ? HALT_RADIUS + 2.5 : HALT_RADIUS)) { nah = s; break; }
    if (!nah) for (const L of zuglinien.values()) for (const id of L.st) { const d = dienste.get(id); if (d && Math.hypot(d.x - h.x, d.z - h.z) < 10) { nah = { umgebung: 0 }; break; } }
    h.bus = !!nah; alle += leute(h); if (nah) { l += leute(h); j += jobs(h); nah.umgebung += leute(h) + jobs(h); }
  }
  let tramPlus = 0; for (const L of linien.values()) if (L.art === "tram") tramPlus += L.busse;
  busAbdeckung = { leute: l, jobs: j, anteil: alle ? Math.min(1, l / alle * (1 + Math.min(0.4, tramPlus * 0.08))) : 0, fahrgaeste: Math.round((l * 0.6 + j * 0.3) * (1 + Math.min(0.5, tramPlus * 0.1))) };
}
const busKosten = () => { let b = 0; for (const L of linien.values()) b += (L.busse || 1) * (L.art === "tram" ? 2 : 1); return b * BUS_UNTERHALT + halte.size * 5; };
const busEinnahmen = () => 0;   // Tickets werden direkt beim Einsteigen bezahlt
/* Linien auf der Karte */
const linienMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
linienMesh.renderOrder = 4; linienMesh.visible = false; szene.add(linienMesh);
let linienNeu = true;
const gleiseMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.6 })); gleiseMesh.receiveShadow = true; szene.add(gleiseMesh);
function gleiseZeichnen() {
  const pos = [], col = [], c = farbe(0xb9bfc7), fertig = new Set();
  for (const L of linien.values()) {
    if (L.art !== "tram") continue;
    for (let i = 0; i < L.halte.length; i++) {
      const a = halte.get(L.halte[i]), b = halte.get(L.halte[(i + 1) % L.halte.length]); if (!a || !b || !kanten.has(a.k) || !kanten.has(b.k)) continue;
      const w = wegSuchen(haltPunkt(a), haltPunkt(b)); if (!w) continue;
      for (const st of w.route) { const key = st.k + ":" + st.dir; if (fertig.has(key)) continue; fertig.add(key); const k = kanten.get(st.k); if (!k) continue; const pts = []; for (let S = 0; S <= k.len + 1e-6; S += 0.4) { const q = spurPunkt(k, st.dir, Math.min(S, k.len), spurAbstand(k.typ, TYP[k.typ].spuren.length - 1)); pts.push({ x: q.x, z: q.z, tx: q.tx, tz: q.tz, s: st.dir > 0 ? S : k.len - S }); }
        const y = k.ebene ? (q) => G + 0.027 + ebeneY(k, q.s) : G + 0.027; band(pos, col, pts, 0.012, y, c, 0.085); band(pos, col, pts, 0.012, y, c, -0.085); }
    }
  }
  gleiseMesh.geometry.dispose(); gleiseMesh.geometry = pos.length ? geoAus(pos, col) : new THREE.BufferGeometry();
}
function linienZeichnen() {
  linienNeu = false; const pos = [], col = []; let n = 0;
  for (const L of linien.values()) {
    const c = farbe(L.farbe), off = 0.06 + (n++ % 4) * 0.05;
    for (let i = 0; i < L.halte.length; i++) {
      const a = halte.get(L.halte[i]), b = halte.get(L.halte[(i + 1) % L.halte.length]); if (!a || !b || !kanten.has(a.k) || !kanten.has(b.k)) continue;
      const w = wegSuchen(haltPunkt(a), haltPunkt(b), L.art === "tram"); if (!w) continue;
      w.route.forEach((st, ri) => {
        const k = kanten.get(st.k); if (!k) return;
        const s0 = ri === 0 ? w.s0 : 0, s1 = ri === w.route.length - 1 ? w.s1 : k.len, pts = [];
        for (let s = s0; s <= s1 + 1e-6; s += 0.5) pts.push(spurPunkt(k, st.dir, Math.min(s, s1), off));
        if (pts.length > 1) band(pos, col, pts.map((q) => ({ x: q.x, z: q.z, tx: q.tx, tz: q.tz })), 0.045, G + 0.06, c);
      });
    }
    for (const id of L.halte) { const h = halte.get(id); if (h) scheibe(pos, col, h.x, h.z, 0.32, G + 0.065, c); }
  }
  for (const id of linieBau) { const h = halte.get(id); if (h) scheibe(pos, col, h.x, h.z, 0.42, G + 0.07, farbe(0xffffff)); }
  linienMesh.geometry.dispose(); linienMesh.geometry = pos.length ? geoAus(pos, col) : new THREE.BufferGeometry();
}
let busModus = "halt", linieBau = [], linieWahl = null;
function busTippen(p) {
  if (busModus === "halt") {
    const e = naechsteKante(p, 2.2, (k) => TYP[k.typ].autos && !k.ring && !k.ebene); if (!e) { tipp("Tipp direkt auf eine Straße mit Autoverkehr.", 2200); return; }
    if (halteBei(punktBei(e.k, e.s), 2.0)) { tipp("Hier ist schon eine Haltestelle.", 2000); return; }
    if (e.s < 0.8 || e.s > e.k.len - 0.8) { tipp("Nicht direkt auf die Kreuzung – etwas weiter in die Straße.", 2200); return; }
    if (geld < HALT_PREIS) { tipp("Zu wenig Geld.", 2000); return; }
    merkeRueck(); geld -= HALT_PREIS; neueHalte({ k: e.k.id, s: e.s }); busRechnen(); zeigeWerte(); speichernBald(); tipp("🚏 Haltestelle gebaut. Verbinde Haltestellen mit „🚌 Neue Linie“.", 3000);
  } else if (busModus === "bau") {
    dienstVorschau(p);
  } else if (busModus === "bearbeiten") {
    const L = linien.get(linieWahl), h = halteBei(p, Math.max(1.8, fangRadius())); if (!L) { busModus = "halt"; return; } if (!h) { tipp("Tipp auf eine Haltestelle: dazu oder weg.", 2000); return; }
    merkeRueck();
    if (L.halte.includes(h.id)) { if (L.halte.length <= 2) { tipp("Eine Linie braucht mindestens 2 Haltestellen.", 2000); return; } L.halte = L.halte.filter((x) => x !== h.id); tipp("➖ Haltestelle aus Linie " + L.nr + " entfernt.", 1800); }
    else { let best = 0, bk = 1e9; for (let i = 0; i < L.halte.length; i++) { const a = halte.get(L.halte[i]), b = halte.get(L.halte[(i + 1) % L.halte.length]); const k = Math.hypot(a.x - h.x, a.z - h.z) + Math.hypot(b.x - h.x, b.z - h.z) - Math.hypot(a.x - b.x, a.z - b.z); if (k < bk) { bk = k; best = i + 1; } } L.halte.splice(best, 0, h.id); if (!linieErreichbar(L.halte, L.art === "tram")) { L.halte.splice(best, 1); tipp("⚠️ Diese Haltestelle ist nicht mit der Linie verbunden.", 2500); return; } tipp("➕ Haltestelle zu Linie " + L.nr + " hinzugefügt.", 1800); }
    L.umlaufV = -1; for (const f of fahrzeuge) if (f.linie === L.id) f.ziel = Math.min(f.ziel, L.halte.length - 1); busRechnen(); linienNeu = true; speichernBald(); unterleiste();
  } else if (busModus === "linie" || busModus === "tram") {
    const h = halteBei(p, Math.max(1.8, fangRadius())); if (!h) { tipp("Tipp auf eine Haltestelle 🚏.", 2000); return; }
    if (linieBau.length >= 2 && h.id === linieBau[0]) { linieFertig(); return; }
    if (linieBau[linieBau.length - 1] === h.id) return;
    linieBau.push(h.id); linienVorschau();
  } else if (busModus === "weg") {
    const h = halteBei(p, Math.max(1.8, fangRadius())); if (!h) { tipp("Tipp auf eine Haltestelle 🚏, um sie zu entfernen.", 2000); return; }
    merkeRueck(); halteWeg(h); busRechnen(); speichernBald(); tipp("Haltestelle entfernt.", 1800); unterleiste();
  }
}
function haltInfo(h) {
  const ls = [...linien.values()].filter((L) => L.halte.includes(h.id));
  infoZeigen(`<b>🚏 Haltestelle</b>🧍 ${Math.floor(h.wartend)} warten${ls.length ? "<br>Linien: " + ls.map((L) => `<span style="color:#${L.farbe.toString(16).padStart(6, "0")};font-weight:700">${L.art === "tram" ? "🚋" : "🚌"} ${L.nr}</span>`).join(" ") : "<br><small>Noch keine Linie hält hier.</small>"}<br><small>👥 ${zahl(h.umgebung || 0)} Leute wohnen oder arbeiten in der Nähe</small>`, 6000);
}
function linienVorschau() {
  const n = linieBau.length;
 frage((busModus === "tram" ? "🚋 Neue Straßenbahn: " : "🚌 Neue Linie: ") + n + " Haltestelle" + (n === 1 ? "" : "n") + (n >= 2 ? " – ✓ zum Fertigstellen (oder erste Haltestelle antippen)" : " – tipp die nächste an"), n >= 2, linieFertig);
  linienNeu = true;
}
function linieFertig() {
  if (linieBau.length < 2) return;
  if (!linieErreichbar(linieBau, busModus === "tram")) { tipp(busModus === "tram" ? "⚠️ Straßenbahnen brauchen 🚋 Schienen auf allen Straßen dazwischen (🛣️ → 🚋 Schienen)." : "⚠️ Zwischen den Haltestellen gibt es keinen Weg. Verbinde die Straßen.", 4500); return; }
  merkeRueck();
  const nr = Math.max(0, ...[...linien.values()].map((L) => L.nr)) + 1, tram = busModus === "tram", L = { id: linieId++, nr, takt: 40, art: tram ? "tram" : "bus", farbe: LINIEN_FARBEN[(nr - 1) % LINIEN_FARBEN.length], halte: linieBau.slice(), busse: Math.max(1, Math.round(linieBau.length / (tram ? 3 : 2))) };

  linien.set(L.id, L); linieBau = []; linieWahl = L.id; frageZu(); busModus = "halt"; busRechnen(); linienNeu = true; speichernBald(); unterleiste();
  const dep = depotFuer(L, halte.get(L.halte[0]));
  tipp(dep ? (tram ? "🚋 Straßenbahn " : "🚌 Linie ") + nr + " fährt! Mit + und − änderst du den Takt." : "⚠️ Linie " + nr + " ist fertig – bau noch ein " + (tram ? "Straßenbahn-Depot" : "Busdepot") + ", dann fahren die Fahrzeuge los.", 4500);
}



/* ================================================================
   Wirtschaft: Bedarf, Steuern, Budget, Meilensteine
   ================================================================ */
let steuern = { w: 9, g: 9, b: 9, i: 9 }, meilenstein = 0, tempo = 1, simZeit = 0, tage = 0, letzteWoche = null;
let bedarf = { w: 60, g: 20, b: 0, i: 40 };
function kennzahlen() {
  let e = 0, jl = 0, jb = 0, ji = 0; for (const h of haeuser.values()) { const g = gruppe(h); if (g === "w") e += leute(h); else if (g === "g") jl += jobs(h); else if (g === "b") jb += jobs(h); else ji += jobs(h); }
  const ein = { w: e * 2.0 * steuern.w / 9, g: jl * 2.6 * steuern.g / 9, b: jb * 3.2 * steuern.b / 9, i: ji * 2.4 * steuern.i / 9 };
  let strassen = 0; for (const k of kanten.values()) strassen += k.len * TYP[k.typ].preis * 0.012;
  if (hatEntw("wirt2")) for (const z in ein) ein[z] *= 1.05;
  const nvE = busEinnahmen() + anzahlTyp("bahnhof") * 220 + anzahlTyp("hafen") * 320, nvK = busKosten() * (hatEntw("verkehr2") ? 0.8 : 1), einnahmen = ein.w + ein.g + ein.b + ein.i + nvE, dk = dienstKosten(), kr = kreditRaten();
  return { e, jl, jb, ji, j: jl + jb + ji, ein, nvE, nvK, einnahmen, strassen, dienste: dk, kredit: kr, ausgaben: strassen + dk + nvK + kr, saldo: einnahmen - strassen - dk - nvK - kr };
}
function bedarfBerechnen() {
  const k = kennzahlen(), arbeiter = k.e * 0.55;
  let w = 22 + (k.j - arbeiter) * 0.9 + (k.e < 40 ? 45 : 0);
  let l = (k.e * 0.22 - k.jl) * 1.5 + 8;
  let bil = 0, bn = 0; for (const h of wohnListe) { bil += (h.bildung || 0) * leute(h); bn += leute(h); } bil = bn ? bil / bn : 0;
  let b = zoneFrei(5) ? (k.e * (0.12 + bil * 0.06) - k.jb) * 1.3 + 10 : -100;
  let i = (arbeiter * (zoneFrei(5) ? 0.36 - bil * 0.06 : 0.42) - k.ji) * 1.2 + (k.e < 60 ? 25 : 0) + k.jl * 0.15;
  const nb = [...dienste.values()].filter((d) => d.typ === "bahnhof" && (d.gk == null || simZeit - (d.zugDa ?? -999) < 150)).length, nh = anzahlTyp("hafen"); w += 8 * nb; l += 10 * nb + 4 * nh; i += 14 * nh;
  const s = (z, v) => (v - (steuern[z] - 9) * 4.5) * (1 - (steuern[z] - 9) * 0.05);
  if (hatEntw("wirt1")) { l += 10; b += 10; }
  bedarf = { w: klemme(s("w", w), -100, 100), g: klemme(s("g", l), -100, 100), b: klemme(s("b", b), -100, 100), i: klemme(s("i", i), -100, 100) };
  const balken = document.querySelectorAll("#bedarf i"); ["w", "g", "b", "i"].forEach((z, n) => { if (balken[n]) balken[n].style.height = Math.max(2, bedarf[z] / 100 * 26) + "px"; });
}
function meilensteinPruefen() {
  const e = kennzahlen().e; if (e > maxEinw) { xpPlus((e - maxEinw) * 2); maxEinw = e; }
  while (ms < MS.length - 1 && xp >= MS[ms + 1].xp) {
    ms++; const m = MS[ms], alt = meilenstein; geld += m.geld; ep += m.ep; meilenstein = Math.max(meilenstein, m.stufe);
    let frei = [];
    if (meilenstein > alt) for (let i = alt + 1; i <= meilenstein; i++) frei = frei.concat(MEILEN[i].frei.map((t) => TYP[t].em + " " + TYP[t].name), Object.values(ZONEN).filter((z) => z.ab === i).map((z) => z.em + " " + z.name), Object.values(DIENSTE).filter((D) => D.ab === i).map((D) => D.em + " " + D.name));
    infoZeigen(`<b>🎉 Meilenstein ${ms}: ${m.name}!</b>+${euro(m.geld)} · +${m.ep} Entwicklungspunkt${m.ep > 1 ? "e" : ""} · bis zu ${m.gebiete} Gebiete${frei.length ? "<br>Neu: " + frei.slice(0, 10).join(", ") + (frei.length > 10 ? " …" : "") : ""}<br><small>Tipp auf 📈 Fortschritt, um Entwicklungspunkte auszugeben.</small>`, 8000);
    unterleiste();
  }
  xpZeigen();
}
function xpZeigen() { const el = $("xpBalken"); if (!el) return; const a = MS[ms], n = MS[ms + 1]; el.style.width = (n ? Math.min(100, (xp - a.xp) / (n.xp - a.xp) * 100) : 100) + "%"; $("xpName").textContent = a.name + (ep ? " · " + ep + " ⭐" : ""); }
function wocheTakt() {
  nvLetzte = nvWoche; nvWoche = { fahrten: 0, einnahmen: 0 }; for (const L of linien.values()) { L.letzteWoche = L.fahrgaeste || 0; L.auslastung = L.plaetzeSumme ? L.besetztSumme / L.plaetzeSumme : 0; L.fahrgaeste = 0; L.plaetzeSumme = L.besetztSumme = 0; }
  const k = kennzahlen(); geld += k.saldo; letzteWoche = k;
  for (const kr of kredite) kr.rest -= Math.min(kr.rate, kr.rest); if (kredite.some((kr) => kr.rest <= 0.5)) { kredite = kredite.filter((kr) => kr.rest > 0.5); tipp("🏦 Ein Kredit ist abbezahlt!", 3000); }
  if (++monatXp >= 4) { monatXp = 0; xpPlus(Math.round(k.e * 0.02 * zufriedenheit() / 100)); }
  zeigeWerte();
  if (geld < 0 && geld - k.saldo >= 0) tipp("⚠️ Dein Geld ist im Minus! Senk die Ausgaben oder erhöh die Steuern.", 5000);
  if (werkzeug === "gebiet") gebieteZeichnen(); if (!$("budget").hidden) ($("budget").dataset.modus === "f" ? fortschrittZeigen : budgetZeigen)(); speichernBald();
}
let frohGlatt = null;
function zufriedenheit() {
  let n = 0, sum = 0;
  for (const h of wohnListe) { const a = h.abd || {}; let v = 52 + ((h.wert || 30) - 30) * 0.3 - (h.dreck || 0) * 0.5 + (a.polizei ? 5 : 0) + (a.feuer ? 5 : 0) + (a.gesund ? 5 : 0) + (h.bildung || 0) * 3 + (h.bus ? 3 : 0) + globalFroh(); if (h.problem) v -= ["krimi", "krank"].includes(h.problem) ? 4 + 4 * (h.pStufe || 0) : [0, 5, 12, 25][h.pStufe || 0]; sum += v * leute(h); n += leute(h); }
  const st = (steuern.w + steuern.g + steuern.b + steuern.i) / 4;
  return Math.round(klemme((n ? sum / n : 70) - (st - 9) * 3, 0, 100));
}
function zeigeWerte() {
  const k = kennzahlen(), d = Math.round(k.saldo);
  $("wGeld").textContent = euro(geld); $("wGeld").style.color = geld < 0 ? "#ff8a8a" : "";
  $("wEinw").textContent = zahl(k.e); $("wJobs").textContent = zahl(k.j);
  frohGlatt = frohGlatt == null ? zufriedenheit() : frohGlatt + (zufriedenheit() - frohGlatt) * 0.2; const z = Math.round(frohGlatt); $("wFroh").textContent = (z >= 75 ? "😄 " : z >= 55 ? "🙂 " : z >= 35 ? "😐 " : "😟 ") + z + " %";
  const t = $("trend"); t.textContent = (d >= 0 ? "+" : "") + zahl(d) + "/Wo"; t.className = d >= 0 ? "plus" : "minus";
}
function datumZeigen() { xpZeigen(); const w = Math.floor(tage / 7) + 1, d = Math.floor(tage) % 7; $("datum").textContent = "Woche " + w + " · " + WOCHENTAGE[d]; }
function fortschrittZeigen() {
  const el = $("budget"), a = MS[ms], n = MS[ms + 1], fort = n ? Math.min(100, (xp - a.xp) / (n.xp - a.xp) * 100) : 100;
  const baum = (k) => { const E = ENTW[k]; return `<div class="ebaum"><b>${E.em} ${E.name}</b>${E.knoten.map(([id, name, text, kosten], i) => { const offen = hatEntw(id), vor = i === 0 || hatEntw(E.knoten[i - 1][0]), geht = !offen && vor && ep >= kosten; return `<button type="button" class="eknoten${offen ? " an" : ""}" data-entw="${id}" ${geht ? "" : "data-zu=\"1\""}><span>${offen ? "✅" : vor ? "⭐".repeat(kosten) : "🔒"} ${name}</span><small>${text}</small></button>`; }).join("")}</div>`; };
  el.innerHTML = `<h2>📈 Fortschritt<button type="button" id="budgetZu" aria-label="Schließen">✕</button></h2>
    <div><h3>Meilenstein ${ms} von ${MS.length - 1}: ${a.name}</h3><div class="leiste"><i style="width:${fort}%"></i></div><small style="color:var(--leise)">${zahl(Math.round(xp))} XP${n ? ` · nächster: <b>${n.name}</b> bei ${zahl(n.xp)} XP – Belohnung ${euro(n.geld)}, +${n.ep} ⭐, bis zu ${n.gebiete} Gebiete` : " · höchster Meilenstein erreicht!"}</small>
    <small style="color:var(--leise);display:block;margin-top:6px">XP gibt es für neue Einwohner, neue Straßen und Gebäude und jeden Monat für zufriedene Bürger.</small></div>
    <div><h3>Entwicklungspunkte: ${ep} ⭐</h3><small style="color:var(--leise);display:block;margin-bottom:8px">Jeder Meilenstein bringt Punkte. Gib sie für dauerhafte Verbesserungen aus.</small><div class="ebaeume">${Object.keys(ENTW).map(baum).join("")}</div></div>
    <div><h3>Alle Meilensteine</h3><div class="mliste">${MS.slice(1).map((m, i) => `<div class="${i + 1 <= ms ? "an" : ""}"><span>${i + 1 <= ms ? "✅" : i + 1 === ms + 1 ? "▶️" : "⬜"} ${i + 1}. ${m.name}</span><small>${zahl(m.xp)} XP</small></div>`).join("")}</div></div>`;
  el.hidden = false; el.dataset.modus = "f"; $("budgetZu").onclick = () => { el.hidden = true; };
}
$("budget").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.entw) { const id = b.dataset.entw, k = Object.values(ENTW).find((E) => E.knoten.some((q) => q[0] === id)), i = k.knoten.findIndex((q) => q[0] === id), [, name, , kosten] = k.knoten[i]; if (hatEntw(id)) return; if (i > 0 && !hatEntw(k.knoten[i - 1][0])) { tipp("🔒 Erst die Stufe davor freischalten.", 2000); return; } if (ep < kosten) { tipp("Dafür brauchst du " + kosten + " ⭐ – die gibt es bei Meilensteinen.", 2500); return; } ep -= kosten; entw.add(id); versorgungZeit = -99; tipp("✅ " + name + " freigeschaltet!", 2500); xpZeigen(); speichernBald(); fortschrittZeigen(); return; }
  if (b.dataset.kredit != null) { const K = KREDIT_ARTEN[+b.dataset.kredit]; if (kredite.length >= 3) { tipp("Du kannst höchstens 3 Kredite gleichzeitig haben.", 2500); return; } const gesamt = K.betrag * (1 + K.zins * K.wochen / 52); kredite.push({ betrag: K.betrag, rest: gesamt, rate: gesamt / K.wochen }); geld += K.betrag; zeigeWerte(); tipp("🏦 Kredit über " + euro(K.betrag) + " aufgenommen.", 2500); speichernBald(); budgetZeigen(); return; }
  if (b.dataset.tilgen != null) { const kr = kredite[+b.dataset.tilgen]; if (!kr) return; if (geld < kr.rest) { tipp("Zu wenig Geld, um den Kredit ganz zu bezahlen (" + euro(kr.rest) + ").", 2500); return; } geld -= kr.rest; kredite.splice(+b.dataset.tilgen, 1); zeigeWerte(); tipp("🏦 Kredit abbezahlt!", 2500); speichernBald(); budgetZeigen(); return; }
});
function budgetZeigen() {
  const k = kennzahlen(), el = $("budget"), m = MEILEN[meilenstein], n = MEILEN[meilenstein + 1];
  const zeile = (a, b, cls) => `<div class="zeile ${cls || ""}"><span>${a}</span><span>${b}</span></div>`;
  const regler = (z) => `<div class="steuer" style="--c:${GRUPPEN[z].farbe}"><span>${GRUPPEN[z].em} ${GRUPPEN[z].name}</span><input type="range" min="1" max="29" value="${steuern[z]}" data-steuer="${z}" aria-label="Steuer ${GRUPPEN[z].name}"><b>${steuern[z]} %</b></div>`;
  const GR = ["w", "g", "b", "i"];
  const fort = n ? Math.min(100, (k.e - m.ab) / (n.ab - m.ab) * 100) : 100;
  el.innerHTML = `<h2>💶 Budget &amp; Steuern<button type="button" id="budgetZu" aria-label="Schließen">✕</button></h2>
    <div><h3>Pro Woche</h3>${GR.map((z) => zeile(GRUPPEN[z].em + " Steuern " + GRUPPEN[z].name, "<span class='plus'>+" + euro(k.ein[z]) + "</span>")).join("")}${zeile("🛣️ Unterhalt Straßen", "<span class='minus'>−" + euro(k.strassen) + "</span>")}${k.kredit ? zeile("🏦 Kreditraten", "<span class='minus'>−" + euro(k.kredit) + "</span>") : ""}${k.dienste ? zeile("🏛️ Unterhalt Dienste", "<span class='minus'>−" + euro(k.dienste) + "</span>") : ""}${k.nvK || k.nvE ? zeile("🚌 Nahverkehr, Bahn & Hafen (" + zahl(nvLetzte.fahrten) + " Fahrgäste, Tickets +" + euro(nvLetzte.einnahmen) + ")", "<span class='" + (k.nvE >= k.nvK ? "plus" : "minus") + "'>" + (k.nvE - k.nvK >= 0 ? "+" : "−") + euro(Math.abs(k.nvE - k.nvK)) + "</span>") : ""}${zeile("Ergebnis", "<span class='" + (k.saldo >= 0 ? "plus" : "minus") + "'>" + (k.saldo >= 0 ? "+" : "−") + euro(Math.abs(k.saldo)) + "</span>", "summe")}</div>
    <div><h3>Pro Monat (4 Wochen)</h3>${zeile("Einnahmen", "<span class='plus'>+" + euro(k.einnahmen * 4) + "</span>")}${zeile("Ausgaben", "<span class='minus'>−" + euro(k.ausgaben * 4) + "</span>")}${zeile("<b>Ergebnis</b>", "<b class='" + (k.saldo >= 0 ? "plus" : "minus") + "'>" + (k.saldo >= 0 ? "+" : "−") + euro(Math.abs(k.saldo * 4)) + "</b>")}</div>
    <div><h3>🏦 Kredite</h3>${kredite.length ? kredite.map((kr, i) => zeile(euro(kr.betrag) + " · noch " + euro(kr.rest), `<span class="minus">−${euro(kr.rate)}/Wo</span> <button type="button" class="chip" data-tilgen="${i}" style="min-height:28px;padding:2px 8px">Ablösen</button>`)).join("") : "<small style='color:var(--leise)'>Keine Kredite.</small>"}<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${KREDIT_ARTEN.map((K, i) => `<button type="button" class="chip" data-kredit="${i}">+${euro(K.betrag)}<br><small>${Math.round(K.zins * 100)} % · ${Math.round(K.wochen / 4)} Monate</small></button>`).join("")}</div><small style="color:var(--leise)">Die Rate wird jede Woche abgezogen. Zinsen machen den Kredit teurer.</small></div>
    <div><h3>Steuern</h3><div style="display:grid;gap:10px">${GR.map(regler).join("")}</div><small style="color:var(--leise);display:block;margin-top:8px">Hohe Steuern bringen mehr Geld, aber weniger Zuzug. 9 % ist ausgeglichen.</small></div>
    <div><h3>Budget pro Bereich</h3><div style="display:grid;gap:8px">${Object.keys(budgetBereich).map((k) => `<div class="steuer" style="--c:#a66bff"><span>${DIENST_KAT[k].em} ${DIENST_KAT[k].name}</span><input type="range" min="50" max="150" step="5" value="${budgetBereich[k]}" data-dbudget="${k}" aria-label="Budget ${DIENST_KAT[k].name}"><b>${budgetBereich[k]} %</b></div>`).join("")}</div><small style="color:var(--leise);display:block;margin-top:6px">Mehr Geld = mehr Leistung und weitere Reichweite, aber höhere Kosten.</small></div>
    <div><h3>Versorgung</h3>${Object.keys(RESSOURCEN).map((r) => { const [pr, vb] = versorgung[r], ok = pr >= vb; return zeile(RESSOURCEN[r].em + " " + RESSOURCEN[r].name, `<span class="${ok ? "plus" : "minus"}">${zahl(vb)} / ${zahl(pr)}</span>`); }).join("")}<small style="color:var(--leise)">Gebraucht / vorhanden. Zu wenig? Bau mehr unter 🏛️ Dienste.</small></div>
    <div><h3>Bedarf</h3>${GR.map((z) => zeile(GRUPPEN[z].em + " " + GRUPPEN[z].name, z === "b" && !zoneFrei(5) ? "🔒 ab " + MEILEN[ZONEN[5].ab].name : bedarf[z] > 40 ? "hoch" : bedarf[z] > 10 ? "mittel" : bedarf[z] > 0 ? "wenig" : "keiner")).join("")}</div>
    <div><h3>Meilenstein ${ms}: ${MS[ms].name}</h3><button type="button" class="chip" id="zumFortschritt">📈 Fortschritt &amp; Entwicklungspunkte (${ep} ⭐)</button></div>`;
  el.hidden = false;
  el.dataset.modus = "b"; $("budgetZu").onclick = () => { el.hidden = true; }; if ($("zumFortschritt")) $("zumFortschritt").onclick = fortschrittZeigen;
}
$("budget").addEventListener("input", (e) => { const db = e.target.dataset.dbudget; if (db) { budgetBereich[db] = +e.target.value; e.target.nextElementSibling.textContent = budgetBereich[db] + " %"; versorgungZeit = -99; zeigeWerte(); speichernBald(); return; } const z = e.target.dataset.steuer; if (!z) return; steuern[z] = +e.target.value; e.target.nextElementSibling.textContent = steuern[z] + " %"; bedarfBerechnen(); zeigeWerte(); speichernBald(); });
$("budget").addEventListener("change", () => budgetZeigen());
$("xp").onclick = () => fortschrittZeigen();

/* Wachstum nach Bedarf */
const zk = (g, s, i, r) => zellIndex.get(g + "|" + s + "|" + i + "|" + r);
function freiGleich(id, zone) { const z = id && zellen.get(id); return z && !z.haus && z.zone === zone ? z : null; }
let werteZeit = -99;
const stufeBildungOk = (h) => gruppe(h) !== "w" || ((h.stufe + 1 < 3 || (h.bildung || 0) >= 1) && (h.stufe + 1 < 5 || (h.bildung || 0) >= 2));
function wachsTakt() {
  bauTakt(); bedarfBerechnen(); dienstTakt(0.5);
  if (simZeit - werteZeit > 4) { werteZeit = simZeit; werteAuffrischen(); }
  const kand = {};
  for (const z of zellen.values()) if (z.zone && !z.haus && z.r === 0 && zoneFrei(z.zone)) (kand[z.zone] = kand[z.zone] || []).push(z);
  for (const zone of Object.keys(kand).map(Number)) {
    const Z = ZONEN[zone], L = kand[zone], bd = bedarf[Z.gruppe], p = (bd > 0 ? 0.04 + bd / 100 * 0.3 : 0.012) * (zone >= 7 ? 0.7 : 1);
    if (Math.random() > p) continue;
    for (let versuch = 0; versuch < 5; versuch++) {
      const a = L[Math.floor(Math.random() * L.length)], ziel = Z.breite[0] + Math.floor(Math.random() * (Z.breite[1] - Z.breite[0] + 1));
      const spalten = [a]; for (let i = a.i + 1; spalten.length < ziel; i++) { const nb = freiGleich(zk(a.g, a.seite, i, 0), zone); if (!nb) break; spalten.push(nb); }
      for (let i = a.i - 1; spalten.length < Math.min(2, Z.breite[0]); i--) { const nb = freiGleich(zk(a.g, a.seite, i, 0), zone); if (!nb) break; spalten.unshift(nb); }
      if (spalten.length < Math.min(2, Z.breite[0])) continue;
      let tiefe = Z.tiefe; for (const s of spalten) { let t = 1; while (t < tiefe && freiGleich(zk(s.g, s.seite, s.i, t), zone)) t++; tiefe = Math.min(tiefe, t); }
      if (tiefe < (Z.minTiefe || 1)) continue;
      const ids = []; for (const s of spalten) for (let t = 0; t < tiefe; t++) ids.push(zk(s.g, s.seite, s.i, t));
      const h = neuesHaus({ zone, stufe: 1, w: spalten.length, d: tiefe, variante: (Math.random() * 1e6) | 0, zellen: ids, bau: { start: simZeit, dauer: 16 + Math.random() * 8, art: "neu", ph: -1 } });
      const r = bodenwert(h.x, h.z, h); h.wert = r.wert; h.dreck = r.dreck;
      if (gruppe(h) === "i") dreckZeichnen();
      break;
    }
  }
  const liste = [...haeuser.values()].filter((h) => { const Z = ZONEN[h.zone]; return !h.verlassen && !(h.problem && h.problem !== "krimi" && h.problem !== "krank") && stufeBildungOk(h) && h.stufe < Z.max && simZeit - (h.simGeboren || 0) > 25 && bedarf[Z.gruppe] > 5 && (h.wert || 0) >= (BODENWERT_FUER[Z.gruppe][h.stufe + 1] || 0); });
  if (liste.length && Math.random() < 0.18) {
    const h = liste[Math.floor(Math.random() * liste.length)]; h.stufe++; h.geboren = jetztS; h.simGeboren = simZeit; h.ab = 0.35; h.teile = hausTeile(h); h.box = null; haeuserNeu = true; parkenNeu(h);
    h.hoehe = hoeheVon(h); h.bau = { start: simZeit, dauer: 9, art: "aufstieg", ph: 0 }; h.bauT = bauTeile(h, 0, "aufstieg"); hochZeigen(h, h.hoehe);
    if (gruppe(h) === "i") dreckZeichnen();
  }
  zeigeWerte(); meilensteinPruefen(); speichernBald();
}

/* ================================================================
   Verkehr
   ================================================================ */
/* Fahrzeuge: Teile [x, y, Länge, Höhe, Breite, Farbe] – "f" = Lackfarbe, "g" = Glas */
const GLAS = 0x2b3a4d;
/* Automodelle: Seitenprofil wird zur Karosserie mit runden Kanten.
   Weiße Teile bekommen die Lackfarbe, alles andere behält seine Farbe. */
const LACK = 0xffffff, SCHEIBE = 0x2a3644, ZIER = 0x2a2d33, SCHWARZ = 0x15171b;
function profil(pts, breite, hex, rund) {
  const b = Math.min(rund == null ? 0.012 : rund, breite * 0.2), sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.002, breite - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b * 0.7, bevelOffset: -b * 0.7, bevelSegments: 2, curveSegments: 2 });
  g.translate(0, 0, -Math.max(0.002, breite - 2 * b) / 2); return bunt(g, hex);
}
const kiste = (x, y, z, l, h, b, hex) => bunt(new THREE.BoxGeometry(l, h, b).translate(x, y, z), hex);
function pkwGeo(o) {
  const { L, B, sill, belt, roof, nase, hf, wf, rt, rb } = o, h = L / 2, t = [];
  t.push(profil([[-h, sill + 0.015], [-h + 0.015, sill], [h - 0.02, sill], [h, sill + 0.025], [h, nase], [hf, belt], [-h + 0.02, belt], [-h, belt - 0.025]], B, LACK, 0.016));
  t.push(profil([[rb, belt - 0.004], [hf + 0.004, belt - 0.004], [wf, roof - 0.004], [rt, roof - 0.004]], B * 0.86, SCHEIBE, 0.01));
  t.push(profil([[rt - 0.004, roof - 0.016], [wf + 0.006, roof - 0.016], [wf - 0.004, roof + 0.004], [rt + 0.004, roof + 0.004]], B * 0.88, LACK, 0.008));
  if (wf - rt > 0.12) t.push(kiste((rt + wf) / 2 - 0.012, (belt + roof) / 2, 0, 0.022, roof - belt - 0.01, B * 0.872, LACK));
  t.push(kiste(h - 0.004, sill + 0.022, 0, 0.022, 0.032, B * 1.01, ZIER), kiste(-h + 0.004, sill + 0.022, 0, 0.022, 0.032, B * 1.01, ZIER));
  t.push(kiste(h + 0.002, (sill + nase) / 2 + 0.006, 0, 0.006, 0.022, B * 0.42, SCHWARZ), kiste(-h - 0.003, sill + 0.05, 0, 0.004, 0.02, 0.09, 0xf4f4f4));
  for (const sei of [1, -1]) t.push(kiste(hf - 0.012, belt + 0.018, sei * (B / 2 + 0.01), 0.024, 0.02, 0.022, LACK));
  if (o.extra) o.extra(t, o);
  return mergeGeometries(t);
}
function kastenGeo(o) {
  const { L, B, sill, belt, roof, nase, hf, wf } = o, h = L / 2, x0 = o.x0 || 0, gb = o.glasBis, t = [], sx = (a) => a.map(([x, y]) => [x + x0, y]);
  t.push(profil(sx([[-h, sill], [h - 0.02, sill], [h, sill + 0.03], [h, nase], [hf, belt], [wf, roof], [-h + 0.01, roof], [-h, roof - 0.01]]), B, LACK, 0.018));
  t.push(profil(sx([[gb, belt + 0.012], [hf + 0.006, belt + 0.012], [wf + 0.006, roof - 0.016], [gb, roof - 0.016]]), B + 0.008, SCHEIBE, 0.004));
  if (o.band) t.push(profil(sx([[-h + 0.04, belt + 0.03], [gb - 0.03, belt + 0.03], [gb - 0.03, roof - 0.035], [-h + 0.04, roof - 0.035]]), B + 0.008, SCHEIBE, 0.003));
  t.push(kiste(x0 + h - 0.004, sill + 0.022, 0, 0.022, 0.034, B * 1.01, ZIER), kiste(x0 - h + 0.004, sill + 0.022, 0, 0.022, 0.034, B * 1.01, ZIER));
  for (const sei of [1, -1]) t.push(kiste(x0 + hf - 0.012, belt + 0.02, sei * (B / 2 + 0.012), 0.024, 0.024, 0.024, ZIER));
  if (o.extra) o.extra(t, o);
  return mergeGeometries(t);
}
function fzZusatz(k, t, f) {
  const g = [], vorne = f.x0 ? f.x0 + (f.L || t.L) / 2 : t.L / 2, hinten = -t.L / 2, B = t.B;
  g.push(kiste(vorne + 0.003, f.sill + 0.03, 0, 0.004, 0.024, 0.075, 0xf4f4f4));
  if (!f.x0) g.push(kiste(hinten - 0.003, f.sill + 0.035, 0, 0.004, 0.024, 0.075, 0xf4f4f4));
  if (f.band) {
    const n = t.L > 1.5 ? 3 : 2, hoch = f.roof - f.sill - 0.09;
    for (let i = 0; i < n; i++) g.push(kiste(vorne - 0.16 - i * (t.L - 0.36) / (n - 1), f.sill + 0.02 + hoch / 2, B / 2 + 0.003, 0.12, hoch, 0.006, SCHEIBE), kiste(vorne - 0.16 - i * (t.L - 0.36) / (n - 1), f.sill + 0.02 + hoch / 2, B / 2 + 0.005, 0.006, hoch, 0.006, 0x9aa0a8));
    g.push(kiste(vorne + 0.004, f.roof - 0.035, 0, 0.004, 0.034, B * 0.72, 0xffa020), kiste(hinten - 0.004, f.roof - 0.035, 0, 0.004, 0.03, B * 0.4, 0xffa020));
    if (k === "tram") { g.push(kiste(0, f.roof + 0.012, 0, 0.18, 0.02, 0.14, 0x3a3e46)); for (const s2 of [1, -1]) g.push(bunt(new THREE.BoxGeometry(0.16, 0.008, 0.01).rotateZ(s2 * 0.75).translate(s2 * 0.05, f.roof + 0.075, 0), 0x3a3e46)); g.push(kiste(0, f.roof + 0.13, 0, 0.012, 0.008, 0.16, 0x3a3e46)); }
  }
  const streifen = { kranken: 0xd9302f, notarzt: 0xd9302f, polizei: 0x1f4fbf, polizeivan: 0x1f4fbf, feuerwehr: 0xf2f2f2, drehleiter: 0xf2f2f2 }[k];
  if (streifen != null) for (const s2 of [1, -1]) g.push(kiste((vorne + hinten) / 2, f.belt - 0.04, s2 * (B / 2 + 0.003), (vorne - hinten) * 0.94, 0.026, 0.004, streifen));
  if (k === "feuerwehr") for (const s2 of [1, -1]) for (let i = 0; i < 3; i++) g.push(kiste(-0.26 + i * 0.13, f.sill + 0.13, s2 * (B / 2 + 0.004), 0.11, 0.16, 0.004, 0xb5b9bf));
  if (k === "kranken") g.push(kiste(-0.05, f.roof + 0.003, 0, 0.12, 0.004, 0.04, 0xd9302f), kiste(-0.05, f.roof + 0.003, 0, 0.04, 0.004, 0.12, 0xd9302f));
  return g;
}
const blaulichtBalken = (x, y) => (t) => { t.push(kiste(x, y + 0.012, 0, 0.05, 0.022, 0.13, 0x1d2430)); };
const FZ = {
  klein: { name: "Kleinwagen", L: 0.42, B: 0.22, rad: 0.04, achsen: [0.135, -0.135], beschl: 2.6, brems: 7, vf: 0.95, form: { art: "pkw", sill: 0.045, belt: 0.145, roof: 0.235, nase: 0.105, hf: 0.1, wf: 0.03, rt: -0.12, rb: -0.19 } },
  limo: { name: "Limousine", L: 0.52, B: 0.24, rad: 0.044, achsen: [0.17, -0.165], beschl: 2.6, brems: 7, vf: 1.0, form: { art: "pkw", sill: 0.045, belt: 0.15, roof: 0.24, nase: 0.105, hf: 0.11, wf: 0.0, rt: -0.12, rb: -0.19 } },
  kombi: { name: "Kombi", L: 0.54, B: 0.24, rad: 0.045, achsen: [0.175, -0.175], beschl: 2.5, brems: 7, vf: 1.0, form: { art: "pkw", sill: 0.045, belt: 0.15, roof: 0.245, nase: 0.105, hf: 0.12, wf: 0.01, rt: -0.22, rb: -0.255 } },
  suv: { name: "SUV", L: 0.52, B: 0.26, rad: 0.054, achsen: [0.165, -0.165], beschl: 2.4, brems: 6.5, vf: 1.0, form: { art: "pkw", sill: 0.065, belt: 0.19, roof: 0.295, nase: 0.15, hf: 0.12, wf: 0.05, rt: -0.2, rb: -0.245 } },
  pickup: { name: "Pickup", L: 0.56, B: 0.26, rad: 0.052, achsen: [0.18, -0.17], beschl: 2.3, brems: 6.5, vf: 0.95, form: { art: "pkw", sill: 0.065, belt: 0.18, roof: 0.285, nase: 0.145, hf: 0.13, wf: 0.06, rt: -0.06, rb: -0.07, extra: (t, o) => { t.push(kiste(-0.17, o.belt + 0.002, 0, 0.18, 0.006, 0.21, ZIER)); } } },
  sport: { name: "Sportwagen", L: 0.5, B: 0.25, rad: 0.042, achsen: [0.165, -0.155], beschl: 3.6, brems: 8, vf: 1.12, form: { art: "pkw", sill: 0.035, belt: 0.115, roof: 0.185, nase: 0.075, hf: 0.07, wf: -0.04, rt: -0.11, rb: -0.21, extra: (t) => { t.push(kiste(-0.235, 0.15, 0, 0.04, 0.008, 0.22, SCHWARZ)); } } },
  taxi: { name: "Taxi", L: 0.52, B: 0.24, rad: 0.044, achsen: [0.17, -0.165], beschl: 2.6, brems: 7, vf: 1.02, lack: 0xf2c14e, form: { art: "pkw", sill: 0.045, belt: 0.15, roof: 0.24, nase: 0.105, hf: 0.11, wf: 0.0, rt: -0.12, rb: -0.19, extra: (t) => { t.push(kiste(-0.05, 0.256, 0, 0.07, 0.026, 0.1, LACK), kiste(-0.05, 0.256, 0, 0.072, 0.012, 0.102, SCHWARZ)); } } },
  polizei: { name: "Polizei", L: 0.52, B: 0.24, rad: 0.044, achsen: [0.17, -0.165], beschl: 2.8, brems: 7.5, vf: 1.05, lack: 0xf2f4f7, blau: 0.262, form: { art: "pkw", sill: 0.045, belt: 0.15, roof: 0.24, nase: 0.105, hf: 0.11, wf: 0.0, rt: -0.12, rb: -0.19, extra: (t) => { t.push(kiste(-0.02, 0.105, 0, 0.36, 0.032, 0.244, 0x1f4fbf), kiste(0.2, 0.128, 0, 0.12, 0.006, 0.2, 0x1f4fbf)); blaulichtBalken(-0.05, 0.24)(t); } } },
  liefer: { name: "Transporter", L: 0.58, B: 0.26, rad: 0.048, achsen: [0.19, -0.18], beschl: 2.0, brems: 6, vf: 0.92, form: { art: "kasten", sill: 0.055, belt: 0.17, roof: 0.37, nase: 0.15, hf: 0.2, wf: 0.13, glasBis: 0.07 } },
  kranken: { name: "Krankenwagen", L: 0.62, B: 0.27, rad: 0.05, achsen: [0.2, -0.19], beschl: 2.2, brems: 6.5, vf: 1.0, lack: 0xf6f6f6, blau: 0.42, form: { art: "kasten", sill: 0.055, belt: 0.17, roof: 0.4, nase: 0.15, hf: 0.22, wf: 0.15, glasBis: 0.09, extra: (t) => { t.push(kiste(-0.02, 0.2, 0, 0.56, 0.035, 0.276, 0xd9302f), kiste(-0.02, 0.15, 0, 0.56, 0.012, 0.276, 0xf2c14e)); blaulichtBalken(0.1, 0.4)(t); } } },
  muell: { name: "Müllwagen", L: 0.84, B: 0.28, rad: 0.056, achsen: [0.28, -0.14, -0.26], beschl: 1.4, brems: 5, vf: 0.78, lack: 0xf28c28, form: { art: "kasten", L: 0.24, x0: 0.3, sill: 0.06, belt: 0.2, roof: 0.38, nase: 0.17, hf: 0.1, wf: 0.07, glasBis: -0.04, extra: (t) => { t.push(profil([[-0.42, 0.07], [0.17, 0.07], [0.17, 0.43], [-0.36, 0.43], [-0.42, 0.37]], 0.28, LACK, 0.02), kiste(-0.12, 0.25, 0, 0.5, 0.02, 0.284, ZIER), kiste(-0.43, 0.2, 0, 0.02, 0.24, 0.26, ZIER), kiste(0.0, 0.07, 0, 0.6, 0.04, 0.22, ZIER)); } } },
  feuerwehr: { name: "Löschzug", L: 0.74, B: 0.29, rad: 0.056, achsen: [0.24, -0.2], beschl: 1.9, brems: 6, vf: 1.05, lack: 0xd9302f, blau: 0.43, form: { art: "kasten", sill: 0.06, belt: 0.2, roof: 0.42, nase: 0.18, hf: 0.3, wf: 0.27, glasBis: 0.17, extra: (t) => { t.push(kiste(-0.06, 0.18, 0, 0.62, 0.025, 0.296, 0xf2f2f2), kiste(-0.08, 0.44, 0, 0.5, 0.025, 0.12, 0xb9bfc7)); blaulichtBalken(0.25, 0.42)(t); } } },
  tram: { name: "Straßenbahn", L: 1.8, B: 0.28, rad: 0.04, achsen: [0.7, 0.25, -0.25, -0.7], beschl: 1.4, brems: 5, vf: 0.8, lack: 0xe8493f, form: { art: "kasten", sill: 0.05, belt: 0.17, roof: 0.4, nase: 0.2, hf: 0.895, wf: 0.86, glasBis: 0.895, band: true, extra: (t) => { t.push(kiste(0, 0.22, 0, 0.06, 0.34, 0.286, ZIER), kiste(0.3, 0.42, 0, 0.3, 0.04, 0.16, 0x5d6470), kiste(0.3, 0.47, 0, 0.02, 0.06, 0.2, 0x2a2d33)); } } },
  gelenkbus: { name: "Gelenkbus", L: 1.9, B: 0.29, rad: 0.056, achsen: [0.66, 0.05, -0.68], beschl: 1.3, brems: 5, vf: 0.8, max: 40, form: { art: "kasten", sill: 0.06, belt: 0.18, roof: 0.4, nase: 0.18, hf: 0.945, wf: 0.935, glasBis: 0.945, band: true, extra: (t) => { t.push(kiste(-0.1, 0.22, 0, 0.1, 0.36, 0.3, SCHWARZ), kiste(0.4, 0.408, 0, 0.6, 0.02, 0.24, 0xd8d8d8)); } } },
  doppeldecker: { name: "Doppeldecker", L: 1.3, B: 0.29, rad: 0.056, achsen: [0.43, -0.36], beschl: 1.4, brems: 5, vf: 0.8, max: 40, form: { art: "kasten", sill: 0.06, belt: 0.18, roof: 0.62, nase: 0.18, hf: 0.645, wf: 0.635, glasBis: 0.645, band: true, extra: (t) => { t.push(kiste(0, 0.4, 0, 1.24, 0.06, 0.302, LACK), kiste(0.66, 0.36, 0, 0.01, 0.03, 0.14, SCHWARZ)); } } },
  ebus: { name: "Elektrobus", L: 1.3, B: 0.29, rad: 0.056, achsen: [0.43, -0.36], beschl: 1.8, brems: 5, vf: 0.82, max: 40, form: { art: "kasten", sill: 0.06, belt: 0.18, roof: 0.4, nase: 0.18, hf: 0.645, wf: 0.635, glasBis: 0.645, band: true, extra: (t) => { t.push(kiste(-0.1, 0.43, 0, 0.8, 0.05, 0.22, 0xd8d8d8), kiste(0, 0.13, 0, 1.2, 0.03, 0.296, 0x2fbf6a)); } } },
  minibus: { name: "Kleinbus", L: 0.74, B: 0.27, rad: 0.048, achsen: [0.24, -0.22], beschl: 2.0, brems: 6, vf: 0.9, max: 40, form: { art: "kasten", sill: 0.055, belt: 0.17, roof: 0.37, nase: 0.15, hf: 0.23, wf: 0.16, glasBis: 0.11, band: true } },
  polizeivan: { name: "Mannschaftswagen", L: 0.68, B: 0.27, rad: 0.05, achsen: [0.22, -0.21], beschl: 2.2, brems: 6.5, vf: 1.0, lack: 0xf2f4f7, blau: 0.4, blauX: 0.12, max: 40, form: { art: "kasten", sill: 0.055, belt: 0.17, roof: 0.39, nase: 0.15, hf: 0.24, wf: 0.17, glasBis: 0.12, band: true, extra: (t) => { t.push(kiste(-0.02, 0.15, 0, 0.62, 0.035, 0.276, 0x1f4fbf)); blaulichtBalken(0.12, 0.39)(t); } } },
  drehleiter: { name: "Drehleiter", L: 0.92, B: 0.29, rad: 0.056, achsen: [0.3, -0.18, -0.3], beschl: 1.6, brems: 5.5, vf: 1.0, lack: 0xd9302f, blau: 0.43, blauX: 0.34, max: 40, form: { art: "kasten", L: 0.3, x0: 0.31, sill: 0.06, belt: 0.2, roof: 0.42, nase: 0.18, hf: 0.12, wf: 0.1, glasBis: -0.05, extra: (t) => { t.push(kiste(-0.15, 0.17, 0, 0.62, 0.22, 0.29, LACK), kiste(-0.36, 0.3, 0, 0.12, 0.08, 0.14, 0x9aa0a8), kiste(-0.05, 0.36, 0, 0.96, 0.035, 0.11, 0xc9ced6), kiste(-0.05, 0.395, 0, 0.96, 0.01, 0.11, 0x9aa0a8)); blaulichtBalken(0.34, 0.42)(t); } } },
  notarzt: { name: "Notarzt", L: 0.52, B: 0.26, rad: 0.054, achsen: [0.165, -0.165], beschl: 2.8, brems: 7, vf: 1.1, lack: 0xf6f6f6, blau: 0.31, max: 40, form: { art: "pkw", sill: 0.065, belt: 0.19, roof: 0.295, nase: 0.15, hf: 0.12, wf: 0.05, rt: -0.2, rb: -0.245, extra: (t) => { t.push(kiste(0, 0.15, 0, 0.5, 0.03, 0.264, 0xd9302f)); blaulichtBalken(-0.05, 0.295)(t); } } },
  kehrmaschine: { name: "Kehrmaschine", L: 0.5, B: 0.23, rad: 0.04, achsen: [0.14, -0.15], beschl: 1.4, brems: 6, vf: 0.6, lack: 0xf28c28, max: 40, form: { art: "kasten", sill: 0.05, belt: 0.15, roof: 0.3, nase: 0.13, hf: 0.17, wf: 0.13, glasBis: 0.05, extra: (t) => { for (const s of [1, -1]) t.push(kiste(0.27, 0.03, s * 0.09, 0.06, 0.03, 0.06, SCHWARZ)); t.push(kiste(-0.1, 0.32, 0, 0.04, 0.04, 0.04, 0xf2c14e)); } } },
  lkw2: { name: "Lkw", L: 0.95, B: 0.28, rad: 0.055, achsen: [0.07], beschl: 1.3, brems: 4.5, vf: 0.82, vorneL: 0.15, hintenL: 0.8, max: 60, form: { art: "kasten", L: 0.28, sill: 0.06, belt: 0.21, roof: 0.43, nase: 0.2, hf: 0.135, wf: 0.12, glasBis: 0.05, extra: (t) => { t.push(kiste(0.142, 0.12, 0, 0.01, 0.08, 0.2, 0xc9ced6), kiste(-0.2, 0.065, 0, 0.16, 0.05, 0.2, ZIER), kiste(0.0, 0.46, 0, 0.2, 0.05, 0.26, LACK)); } } },
  kipper: { name: "Kipper", L: 0.82, B: 0.28, rad: 0.056, achsen: [0.27, -0.14, -0.27], beschl: 1.3, brems: 4.8, vf: 0.8, max: 60, form: { art: "kasten", L: 0.26, x0: 0.28, sill: 0.06, belt: 0.2, roof: 0.38, nase: 0.18, hf: 0.11, wf: 0.09, glasBis: -0.04, extra: (t) => { t.push(profil([[-0.41, 0.1], [0.13, 0.1], [0.13, 0.33], [-0.41, 0.37]], 0.28, 0x9aa0a8, 0.015), kiste(-0.14, 0.08, 0, 0.56, 0.04, 0.22, ZIER)); } } },
  bus: { name: "Bus", L: 1.3, B: 0.29, rad: 0.056, achsen: [0.43, -0.36], beschl: 1.5, brems: 5, vf: 0.82, lack: 0xf2c14e, form: { art: "kasten", sill: 0.06, belt: 0.18, roof: 0.4, nase: 0.18, hf: 0.645, wf: 0.635, glasBis: 0.645, band: true, extra: (t) => { t.push(kiste(0, 0.408, 0, 1.0, 0.02, 0.24, 0xd8d8d8), kiste(0.66, 0.36, 0, 0.01, 0.03, 0.14, SCHWARZ)); } } },
  lkw: { name: "Lkw", L: 0.95, B: 0.28, rad: 0.055, achsen: [0.07], beschl: 1.3, brems: 4.5, vf: 0.8, vorneL: 0.15, hintenL: 0.8, form: { art: "kasten", L: 0.27, sill: 0.06, belt: 0.2, roof: 0.36, nase: 0.18, hf: 0.13, wf: 0.115, glasBis: 0.06, extra: (t) => { t.push(kiste(-0.2, 0.065, 0, 0.16, 0.05, 0.2, ZIER), kiste(-0.09, 0.27, 0, 0.04, 0.14, 0.22, ZIER)); } } }
};
const PLAETZE = { bus: 50, gelenkbus: 90, doppeldecker: 80, ebus: 50, minibus: 20, tram: 150 };
for (const [k, t] of Object.entries(FZ)) {
  const f = t.form, o = Object.assign({ L: t.L, B: t.B }, f);
  t.ly = (f.sill + f.nase) / 2 + 0.01; t.lyh = f.art === "kasten" ? f.belt : f.belt - 0.03; t.lx = f.x0 ? f.x0 + o.L / 2 : t.L / 2;
  t.geo = f.art === "pkw" ? pkwGeo(o) : kastenGeo(o);
  t.geo = mergeGeometries([t.geo, ...fzZusatz(k, t, f)]);
}
const AUFLIEGER = {
  container: { name: "Container", teile: [[0, 0.2, 0.64, 0.3, 0.28, "c"]] },
  tank: { name: "Tank (Öl)", teile: [[0, 0.09, 0.64, 0.04, 0.26, 0x4a4d52], [0, 0.2, 0.6, 0.2, 0.24, 0xc9ced6]] },
  kuehl: { name: "Kühlware", teile: [[0, 0.2, 0.64, 0.3, 0.28, 0xf4f4f4], [0, 0.26, 0.64, 0.04, 0.285, 0x3f7fe8]] },
  holz: { name: "Holz", teile: [[0, 0.09, 0.64, 0.04, 0.28, 0x4a4d52], [0, 0.17, 0.6, 0.12, 0.22, 0x8b5a2b]] },
  getreide: { name: "Getreide", teile: [[0, 0.09, 0.64, 0.04, 0.28, 0x4a4d52], [0, 0.17, 0.62, 0.15, 0.27, 0x2f6db5], [0, 0.245, 0.58, 0.01, 0.24, 0xe2c26a]] }
};
const CONTAINER = [0xd9502f, 0x2f7fd9, 0x3fae5a, 0xe0a52a, 0x7a4fd1, 0xc8ccd0];
for (const t of Object.values(FZ)) { if (t.vorneL == null) t.vorneL = t.L / 2; if (t.hintenL == null) t.hintenL = t.L / 2; }
const PKW_TYPEN = ["klein", "klein", "limo", "limo", "kombi", "kombi", "suv", "suv", "pickup", "sport", "taxi", "liefer"];
const FZ_MAX = 170;
const fzTeile = becken(G_BOX, M.auto, FZ_MAX * 6 + 10, true), fzLicht = becken(G_BOX, M.leuchte, FZ_MAX * 4 + 8, false);
const G_RAD = mergeGeometries([bunt(new THREE.CylinderGeometry(1, 1, 0.04, 12).rotateX(Math.PI / 2), 0x1b1d22), bunt(new THREE.CylinderGeometry(0.58, 0.58, 0.044, 10).rotateX(Math.PI / 2), 0xb9bfc7)]);
const fzRaeder = becken(G_RAD, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), FZ_MAX * 8 + 12, false);
const AUTO_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.36, metalness: 0.18 });
const fzMesh = {}; for (const k in FZ) fzMesh[k] = becken(FZ[k].geo, AUTO_MAT, FZ[k].max || (k === "bus" || k === "tram" || k === "muell" || k === "polizei" || k === "kranken" || k === "feuerwehr" ? 40 : FZ_MAX), true);

/* ================================================================
   Bahn und Hafen: Züge und Schiffe kommen von außerhalb
   ================================================================ */
const vorne = (d) => ({ x: Math.sin(d.rot), z: Math.cos(d.rot) });
function gleisVon(d) { const f = vorne(d), D = d.d * ZELLE, p0 = { x: d.x - f.x * D * 0.05, z: d.z - f.z * D * 0.05 }; return { p0, dx: -f.x, dz: -f.z }; }
function wasserRichtung(d) { let best = null, bw = 1e9; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a); let w = 0; for (const r of [4, 7, 11]) w += abstand(d.x + dx * r, d.z + dz * r); if (w < bw) { bw = w; best = { dx, dz }; } } return best; }
function aufGleis(x, z) { for (const d of dienste.values()) { if (d.typ !== "bahnhof" || d.gk != null) continue; const g = gleisVon(d), vx = x - g.p0.x, vz = z - g.p0.z, u = vx * g.dx + vz * g.dz; if (u > 0 && Math.abs(-vx * g.dz + vz * g.dx) < 0.7) return true; } return false; }
const gleisBahnMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })); gleisBahnMesh.receiveShadow = true; szene.add(gleisBahnMesh);
function bahnGleiseZeichnen() {
  const pos = [], col = [], schotter = farbe(0x8a8378), schwelle = farbe(0x5a4636), schiene = farbe(0xc9ced6);
  for (const d of dienste.values()) {
    if (d.typ !== "bahnhof" || d.gk != null) continue;
    const g = gleisVon(d), pts = []; for (let u = 0; u <= 240; u += 2) pts.push({ x: g.p0.x + g.dx * u, z: g.p0.z + g.dz * u, tx: g.dx, tz: g.dz });
    band(pos, col, pts, 0.24, G + 0.016, schotter);
    for (let u = 0.2; u < 240; u += 0.32) { const a = { x: g.p0.x + g.dx * u, z: g.p0.z + g.dz * u, tx: g.dx, tz: g.dz }, b = { x: a.x + g.dx * 0.07, z: a.z + g.dz * 0.07, tx: g.dx, tz: g.dz }; band(pos, col, [a, b], 0.17, G + 0.022, schwelle); }
    band(pos, col, pts, 0.012, G + 0.032, schiene, 0.1); band(pos, col, pts, 0.012, G + 0.032, schiene, -0.1);
  }
  gleisBahnMesh.geometry.dispose(); gleisBahnMesh.geometry = pos.length ? geoAus(pos, col) : new THREE.BufferGeometry();
}
const ZUG_LOK = kastenGeo({ L: 1.3, B: 0.3, sill: 0.08, belt: 0.24, roof: 0.44, nase: 0.3, hf: 0.58, wf: 0.48, glasBis: 0.42, extra: (t) => { t.push(kiste(0, 0.2, 0, 1.24, 0.04, 0.305, 0xe8493f)); } });
const ZUG_WAGEN = kastenGeo({ L: 1.3, B: 0.3, sill: 0.08, belt: 0.2, roof: 0.44, nase: 0.42, hf: 0.645, wf: 0.645, glasBis: -0.65, band: true, extra: (t) => { t.push(kiste(0, 0.17, 0, 1.24, 0.03, 0.305, 0xe8493f)); } });
const SCHIFF = mergeGeometries([profil([[-1.3, -0.12], [1.0, -0.12], [1.45, 0.2], [-1.35, 0.2]], 0.62, 0x22324a, 0.03), kiste(0, 0.21, 0, 2.6, 0.02, 0.6, 0x8a2f2f), kiste(-1.05, 0.42, 0, 0.35, 0.42, 0.56, 0xf4f4f4), kiste(-1.05, 0.66, 0, 0.36, 0.05, 0.58, 0x2a3644),
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => kiste(-0.62 + (i % 4) * 0.42, 0.31 + Math.floor(i / 4) * 0.16, 0, 0.38, 0.15, 0.5, CONTAINER[i % CONTAINER.length]))]);
const lokMesh = becken(ZUG_LOK, AUTO_MAT, 40, true), wagenMesh = becken(ZUG_WAGEN, AUTO_MAT, 240, true), schiffMesh = becken(SCHIFF, AUTO_MAT, 20, true);
function bahnHafenZeichnen(dt) {
  let [li, wi] = zuegeZeichnen(), si = 0;
  for (const d of dienste.values()) {
    if (d.typ === "bahnhof" && d.gk == null) {
      d.bt = ((d.bt ?? d.id * 7.3) + dt) % 60; const t = d.bt;
      const u = t < 22 ? 0.6 + 240 * Math.pow(1 - t / 22, 2) : t < 30 ? 0.6 : t < 50 ? 0.6 + 240 * Math.pow((t - 30) / 20, 2) : -1;
      d.zugDa = t >= 22 && t < 30; if (u < 0) continue;
      const g = gleisVon(d), kurs = Math.atan2(g.dz, -g.dx);
      for (let i = 0; i < 4; i++) { const ui = u + 0.65 + i * 1.36; if (ui > 238) continue; _o.position.set(g.p0.x + g.dx * ui, G + 0.03, g.p0.z + g.dz * ui); _o.rotation.set(0, kurs, 0); _o.scale.setScalar(1); _o.updateMatrix(); const m = i === 0 ? lokMesh : wagenMesh, n = i === 0 ? li++ : wi++; if (n >= m.instanceMatrix.count) continue; m.setMatrixAt(n, _o.matrix); m.setColorAt(n, _farbe.setHex(0xf2f2f2)); }
    }
    if (d.typ === "hafen") {
      const D = d.d * ZELLE;
      if (!d.wr) { d.wr = wasserRichtung(d); let u0 = 0; while (u0 < 30 && abstand(d.x + d.wr.dx * (D / 2 + u0), d.z + d.wr.dz * (D / 2 + u0)) > -0.7) u0 += 0.25; d.dockU = u0 + 1.0; }
      d.st = ((d.st ?? d.id * 11.1) + dt) % 80; const t = d.st, U0 = d.dockU;
      const u = t < 30 ? U0 + 180 * Math.pow(1 - t / 30, 2) : t < 45 ? U0 : t < 70 ? U0 + 180 * Math.pow((t - 45) / 25, 2) : -1;
      d.schiffDa = t >= 30 && t < 45; if (u < 0) continue;
      const x = d.x + d.wr.dx * (D / 2 + u), z = d.z + d.wr.dz * (D / 2 + u); if (abstand(x, z) > -0.4) continue;
      _o.position.set(x, WASSER + 0.08 + Math.sin(jetztS * 1.3 + d.id) * 0.02, z); _o.rotation.set(Math.sin(jetztS * 0.9) * 0.02, Math.atan2(d.wr.dz, -d.wr.dx), 0); _o.scale.setScalar(1); _o.updateMatrix();
      if (si < 20) { schiffMesh.setMatrixAt(si, _o.matrix); schiffMesh.setColorAt(si++, _farbe.setHex(0xffffff)); }
    }
  }
  for (const [m, n] of [[lokMesh, li], [wagenMesh, wi], [schiffMesh, si]]) { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
}
const anzahlTyp = (t) => { let n = 0; for (const d of dienste.values()) if (d.typ === t) n++; return n; };
/* ================================================================
   Eisenbahn: Gleise selbst legen, Bahnhöfe, Züge, Bahnübergänge
   ================================================================ */
const gKnoten = new Map(), gKanten = new Map(); let gnId = 1, gkId = 1, gleisVersion = 0;
const GLEIS_PREIS = 120, zuglinien = new Map(); let zlId = 1;
function neuerGKnoten(p, id) { const n = { id: id || gnId++, x: p.x, z: p.z, kanten: new Set(), aussen: false }; gnId = Math.max(gnId, n.id + 1); gKnoten.set(n.id, n); return n; }
function gleisMesh(k) {
  const pos = [], col = [], Y = (d) => (p) => G + d + ebeneY(k, p.s);
  if (k.ebene >= 0) {
    band(pos, col, k.pts, 0.3, Y(0.016), farbe(0x8a8378));
    for (let s = 0.2; s < k.len; s += 0.32) { const a = Object.assign({ s }, punktBei(k, s)), s2 = Math.min(k.len, s + 0.07), b = Object.assign({ s: s2 }, punktBei(k, s2)); band(pos, col, [a, b], 0.18, Y(0.022), farbe(0x5a4636)); }
    band(pos, col, k.pts, 0.013, Y(0.034), farbe(0xc9ced6), 0.1); band(pos, col, k.pts, 0.013, Y(0.034), farbe(0xc9ced6), -0.1);
    if (k.ebene > 0) { const c = farbe(0xb9b4a8), unten = (p) => G - 0.1 + ebeneY(k, p.s), oben = (p) => G + 0.08 + ebeneY(k, p.s); for (const sei of [1, -1]) wand(pos, col, k.pts, sei * 0.34, unten, oben, c); band(pos, col, k.pts, 0.34, unten, farbe(0x8c877c)); }
  } else {
    const teil = k.pts.filter((p) => ebeneY(k, p.s) > -0.05); if (teil.length > 1) { band(pos, col, k.pts.filter((p) => p.s < k.len / 2 && ebeneY(k, p.s) > -0.05), 0.3, Y(0.016), farbe(0x8a8378)); band(pos, col, k.pts.filter((p) => p.s > k.len / 2 && ebeneY(k, p.s) > -0.05), 0.3, Y(0.016), farbe(0x8a8378)); }
  }
  const m = new THREE.Mesh(geoAus(pos, col), M.strasse); m.receiveShadow = true; return m;
}
function neueGKante(aId, bId, c, id, opt) {
  const a = gKnoten.get(aId), b = gKnoten.get(bId), { pts, len } = abtasten(a, c, b);
  const k = Object.assign({ id: id || gkId++, a: aId, b: bId, c: { x: c.x, z: c.z }, pts, len, h: huelle(pts, 0.4), gleis: true, ebene: 0 }, opt || {}); gkId = Math.max(gkId, k.id + 1);
  k.mesh = gleisMesh(k); szene.add(k.mesh); gKanten.set(k.id, k); a.kanten.add(k.id); b.kanten.add(k.id); return k;
}
function gKanteWeg(k) { szene.remove(k.mesh); k.mesh.geometry.dispose(); gKanten.delete(k.id); for (const nid of [k.a, k.b]) { const n = gKnoten.get(nid); if (!n) continue; n.kanten.delete(k.id); if (!n.kanten.size) gKnoten.delete(nid); } }
function gKanteTeilen(k, t) {
  const a = gKnoten.get(k.a), b = gKnoten.get(k.b), m = bez(a, k.c, b, t), n = neuerGKnoten(m), c1 = lerp(a, k.c, t), c2 = lerp(k.c, b, t), aId = k.a, bId = k.b, ax = { x: a.x, z: a.z }, bx = { x: b.x, z: b.z }, opt = { aussen: k.aussen };
  gKanteWeg(k); if (!gKnoten.has(aId)) neuerGKnoten(ax, aId); if (!gKnoten.has(bId)) neuerGKnoten(bx, bId);
  neueGKante(aId, n.id, c1, null, opt); neueGKante(n.id, bId, c2, null, opt); return n;
}
function naechstesGleis(p, r, filter) { let best = null; for (const k of gKanten.values()) { if ((filter && !filter(k)) || !nahHuelle(k.h, p, r)) continue; const e = abstandZuLinie(p, k.pts, true); if (e.d < r && (!best || e.d < best.d)) best = { k, ...e }; } return best; }
function naechsterGKnoten(p, r) { let best = null, bd = r; for (const n of gKnoten.values()) { const d = abst(n, p); if (d < bd) { bd = d; best = n; } } return best; }
function gleisFangen(p) { const r = fangRadius(), n = naechsterGKnoten(p, r); if (n) return { art: "gknoten", id: n.id, x: n.x, z: n.z }; const e = naechstesGleis(p, r * 0.8, (k) => !k.ebene); if (e) return { art: "gkante", id: e.k.id, x: e.x, z: e.z }; return { art: "frei", x: p.x, z: p.z }; }
function gKnotenFuer(p) { const n = naechsterGKnoten(p, 0.6); if (n) return n; const e = naechstesGleis(p, 0.6, (k) => !k.ebene); if (e) { const a = gKnoten.get(e.k.a), b = gKnoten.get(e.k.b); if (abst(a, e) < 1.0) return a; if (abst(b, e) < 1.0) return b; return gKanteTeilen(e.k, e.t); } return neuerGKnoten(p); }
function gleisKreuzungen(pts, ausserNah) {
  const h = huelle(pts), liste = [];
  for (const k of gKanten.values()) { if (k.ebene || k.h.x1 < h.x0 || k.h.x0 > h.x1 || k.h.z1 < h.z0 || k.h.z0 > h.z1) continue; for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < k.pts.length - 1; j++) { const s = schnitt(pts[i], pts[i + 1], k.pts[j], k.pts[j + 1]); if (s && !ausserNah.some((q) => abst(q, s) < 1.0)) liste.push({ t: pts[i].t + (pts[i + 1].t - pts[i].t) * s.ua, x: s.x, z: s.z }); } }
  liste.sort((a, b) => a.t - b.t); return liste.filter((q, i) => !liste.slice(0, i).some((o) => abst(o, q) < 1.5));
}
function gleisPlanen(A, C, Bp, ebene) {
  const { pts, len } = abtasten(A, C, Bp), plan = { A, C, B: Bp, pts, laenge: len, kosten: Math.round(len * GLEIS_PREIS * (ebene > 0 ? 3 : ebene < 0 ? 4 : 1)), ok: true, grund: "", ebene, kreuz: [], gleis: true };
  const nein = (g) => { plan.ok = false; plan.grund = plan.grund || g; }, kk = { ebene, len }, ey = (q) => ebeneY(kk, q.s);
  if (len < 2) nein("Zu kurz"); if (len > 120) nein("Zu lang – setz einen Zwischenpunkt"); if (ebene && len < 7) nein("Brücken und Tunnel brauchen mindestens 7 Felder");
  for (const q of pts) { if (!aufLand(q.x, q.z, ebene && Math.abs(ey(q)) > 0.3 ? -99 : ebene ? 1.5 : 3.0)) { if (!ebene) plan.wasser = true; nein(ebene ? "Die Enden müssen auf festem Land liegen" : "Zu nah am Wasser – bau eine 🌉 Brücke"); break; } if (!imBesitz(q.x, q.z)) { nein("Außerhalb deiner Gebiete"); break; } }
  for (let i = 3; i < pts.length - 3 && plan.ok; i++) { const a = pts[i - 3], b = pts[i + 3]; if (a.tx * b.tx + a.tz * b.tz < 0.8) nein("Kurve zu eng für Züge – mach sie weiter"); }
  if (plan.ok && !ebene) { plan.kreuz = gleisKreuzungen(pts, [A, Bp]); for (const q of pts) { const n = naechsterKnoten(q, 1.6); if (n && [...n.kanten].length > 2) { nein("Gleise dürfen nicht über eine Straßenkreuzung"); break; } } }
  if (plan.ok && plan.kosten > geld) nein("Nicht genug Geld");
  return plan;
}
function gleisBauen(plan) {
  const n0 = gKnotenFuer(plan.A), n2 = gKnotenFuer(plan.B), neu = []; if (n0 === n2) return [];
  const { pts } = abtasten(n0, plan.C, n2), C = plan.C;
  const kr = plan.ebene ? [] : gleisKreuzungen(pts, [n0, n2]).map((q) => ({ t: q.t, n: gKnotenFuer(q) })).filter((q) => q.n !== n0 && q.n !== n2);
  const ts = [0].concat(kr.map((q) => q.t), [1]), ns = [n0].concat(kr.map((q) => q.n), [n2]);
  for (let j = 0; j < ns.length - 1; j++) { const ta = ts[j], tb = ts[j + 1], c = { x: (1 - ta) * (1 - tb) * n0.x + ((1 - ta) * tb + ta * (1 - tb)) * C.x + ta * tb * n2.x, z: (1 - ta) * (1 - tb) * n0.z + ((1 - ta) * tb + ta * (1 - tb)) * C.z + ta * tb * n2.z }; if (ns[j] === ns[j + 1] || abst(ns[j], ns[j + 1]) < 0.6) continue; neu.push(neueGKante(ns[j].id, ns[j + 1].id, c, null, plan.ebene ? { ebene: plan.ebene } : (plan.aussen ? { aussen: true } : null))); }
  for (const k of neu) { const unter = (x, z) => k.ebene < 0 && ebeneY(k, abstandZuLinie({ x, z }, k.pts, true).s) < -0.3; for (const z of zellenIn(k.h)) if (abstandZuLinie(z, k.pts) < 0.85 && !unter(z.x, z.z)) zelleWeg(z); baeumeFaellen(k.h, (x, z) => abstandZuLinie({ x, z }, k.pts) < 0.5 && !unter(x, z)); }
  if (neu.length && plan.kosten) { geld -= plan.kosten; zeigeWerte(); }
  gleisGeaendert(); return neu;
}
function gleisGeaendert() { gleisVersion++; uebergaengeBerechnen(); brueckenZeichnen(); zellenNeu = true; speichernBald(); }
function aussenGleisBauen() {
  if ([...gKanten.values()].some((k) => k.aussen)) return;
  const n = knoten.get(aussenKnoten); if (!n) return; const l = Math.hypot(n.x, n.z) || 1, dx = n.x / l, dz = n.z / l, px = -dz, pz = dx;
  let seite = 7; if (karte !== "insel" && abstand(dx * 60 + px * 7, dz * 60 + pz * 7) < 4) seite = -7;
  const punkte = [19, 60, 100, 140, 180, 214];
  for (let i = 0; i < punkte.length - 1; i++) { const A = { x: dx * punkte[i] + px * seite, z: dz * punkte[i] + pz * seite }, B = { x: dx * punkte[i + 1] + px * seite, z: dz * punkte[i + 1] + pz * seite }; const ueber = [...kanten.values()].some((k) => k.typ === "autobahn" && kreuztKante(A, B, k)); gleisBauen({ A, B, C: lerp(A, B, 0.5), kosten: 0, ebene: ueber ? 1 : 0, aussen: true }); }
  for (const k of gKanten.values()) k.aussen = true;
}
function kreuztKante(A, B, k) { for (let i = 0; i < k.pts.length - 1; i++) { const p = k.pts[i], q = k.pts[i + 1], d = (B.x - A.x) * (q.z - p.z) - (B.z - A.z) * (q.x - p.x); if (Math.abs(d) < 1e-9) continue; const ua = ((p.x - A.x) * (q.z - p.z) - (p.z - A.z) * (q.x - p.x)) / d, ub = ((p.x - A.x) * (B.z - A.z) - (p.z - A.z) * (B.x - A.x)) / d; if (ua > 0 && ua < 1 && ub >= 0 && ub <= 1) return true; } return false; }
const randGleis = () => { let best = null, bd = -1; for (const n of gKnoten.values()) { const d = Math.hypot(n.x, n.z); if (d > bd) { bd = d; best = n; } } return best && bd > 150 ? best : null; };
/* Wegsuche auf den Gleisen → Linienzug zum Fahren */
function gleisWeg(start, ziel) {
  const ks = gKanten.get(start.k), kz = gKanten.get(ziel.k); if (!ks || !kz) return null;
  const stueck = (k, s0, s1) => { const out = [], d = s1 >= s0 ? 1 : -1; for (let s = s0; d > 0 ? s <= s1 : s >= s1; s += 0.4 * d) { const p = punktBei(k, s); out.push({ x: p.x, z: p.z, y: ebeneY(k, s) }); } const p = punktBei(k, s1); out.push({ x: p.x, z: p.z, y: ebeneY(k, s1) }); return out; };
  if (ks === kz) return stueck(ks, start.S, ziel.S);
  const g = new Map(), von = new Map(), offen = [[0, ks.a, null], [0, ks.b, null]]; g.set(ks.a, start.S); g.set(ks.b, ks.len - start.S); offen[0][0] = start.S; offen[1][0] = ks.len - start.S;
  let schritt = 0;
  while (offen.length && schritt++ < 5000) { offen.sort((a, b) => a[0] - b[0]); const [w, id] = offen.shift(); if (w > (g.get(id) ?? 1e9)) continue; const n = gKnoten.get(id); if (!n) continue; for (const kid of n.kanten) { const k = gKanten.get(kid); if (k === ks) continue; const nach = k.a === id ? k.b : k.a, w2 = w + k.len; if (w2 < (g.get(nach) ?? 1e9)) { g.set(nach, w2); von.set(nach, { k, von: id }); offen.push([w2, nach]); } } }
  const ende = [[kz.a, ziel.S], [kz.b, kz.len - ziel.S]].filter(([nid]) => g.has(nid)).sort((a, b) => (g.get(a[0]) + a[1]) - (g.get(b[0]) + b[1]))[0]; if (!ende) return null;
  const kette = []; let nid = ende[0]; while (von.has(nid)) { const v = von.get(nid); kette.unshift({ k: v.k, von: v.von, nach: nid }); nid = v.von; }
  if (nid !== ks.a && nid !== ks.b) return null;
  let pts = stueck(ks, start.S, nid === ks.a ? 0 : ks.len);
  for (const st of kette) pts = pts.concat(stueck(st.k, st.k.a === st.von ? 0 : st.k.len, st.k.a === st.von ? st.k.len : 0).slice(1));
  pts = pts.concat(stueck(kz, ende[0] === kz.a ? 0 : kz.len, ziel.S).slice(1));
  return pts;
}
function pfadVorbereiten(pts) { let d = 0; pts[0].d = 0; for (let i = 1; i < pts.length; i++) { d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); pts[i].d = d; } return { pts, len: d }; }
function pfadPunkt(P, u) { const pts = P.pts; u = klemme(u, 0, P.len); let lo = 0, hi = pts.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].d <= u) lo = m; else hi = m; } const a = pts[lo], b = pts[hi], t = (u - a.d) / Math.max(1e-6, b.d - a.d), dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; return { x: a.x + dx * t, z: a.z + dz * t, y: a.y + (b.y - a.y) * t, tx: dx / l, tz: dz / l }; }
/* Bahnhöfe auf Gleisen */
function bahnhofPlan(p) {
  const D = DIENSTE.bahnhof, W = D.w * ZELLE, Dd = D.d * ZELLE, e = naechstesGleis(p, 4, (k) => !k.ebene);
  if (!e) return { ok: false, grund: "Muss direkt an einem Gleis stehen", x: p.x, z: p.z, rot: 0, W, D: Dd, typ: "bahnhof" };
  const q = punktBei(e.k, e.s), nx = -q.tz, nz = q.tx, seite = ((p.x - q.x) * nx + (p.z - q.z) * nz) >= 0 ? 1 : -1, ab = 0.38 + Dd / 2 + 0.05;
  const x = q.x + nx * seite * ab, z = q.z + nz * seite * ab, fx = nx * seite, fz = nz * seite, rot = Math.atan2(fx, fz), cs = Math.cos(rot), sn = Math.sin(rot);
  const plan = { ok: true, typ: "bahnhof", x, z, rot, W, D: Dd, preis: D.preis, haeuser: 0, gk: e.k.id, gs: e.s };
  const fail = (g) => { plan.ok = false; plan.grund = g; return plan; };
  if (!dienstFrei("bahnhof")) return fail("🔒 Gibt es ab " + MEILEN[D.ab].name);
  if (e.s < W / 2 + 0.2 || e.s > e.k.len - W / 2 - 0.2) return fail("Das Gleis ist hier zu kurz – mehr Platz zur Weiche");
  for (let a = -0.5; a <= 0.501; a += 0.25) for (let b = -0.5; b <= 0.501; b += 0.25) { const lx = a * W * 0.94, lz = b * Dd * 0.94, wx = x + lx * cs + lz * sn, wz = z - lx * sn + lz * cs; if (!aufLand(wx, wz, 0.3)) return fail("Hier ist Wasser"); if (!imBesitz(wx, wz)) return fail("Außerhalb deiner Gebiete"); if (strassenFrei({ x: wx, z: wz }) < 0.02 || inDienst(wx, wz, 0.02)) return fail("Zu nah an einer Straße oder einem Gebäude"); }
  if (!naechsteKante({ x: x + fx * (Dd / 2 + 0.7), z: z + fz * (Dd / 2 + 0.7) }, 2.2, autoKante)) return fail("Braucht vorne eine Straße für die Fahrgäste");
  if (geld < D.preis) return fail("Zu wenig Geld (" + euro(D.preis) + ")");
  return plan;
}
const neueBahnhoefe = () => [...dienste.values()].filter((d) => d.typ === "bahnhof" && d.gk != null && gKanten.has(d.gk));
const bahnhofPunkt = (d) => ({ k: d.gk, S: d.gs });
function bahnhofAnkern() { for (const d of dienste.values()) { if (d.typ !== "bahnhof" || d.gk == null || gKanten.has(d.gk)) continue; const e = naechstesGleis(d, 2.5, (k) => !k.ebene); if (e) { d.gk = e.k.id; d.gs = e.s; } else d.gk = -1; } }
/* Züge */
let zuege = [], zugNr = 1, fernZeit = 0, gueterZeit = 0;
function zugStarten(art, pts, ziel, opt) {
  if (!pts || pts.length < 2) return null; const P = pfadVorbereiten(pts); if (P.len < 2) return null;
  const z = Object.assign({ id: zugNr++, art, P, u: Math.min(P.len, 1.36 * 4), v: 0, ziel, halt: 0, warte: 0, wagen: art === "gueter" ? 6 : 4, farbe: art === "gueter" ? 0x3a3f47 : 0xf2f2f2 }, opt || {});
  if (art === "fern" || art === "gueter") z.u = Math.min(P.len, 1.36 * (z.wagen + 1));
  zuege.push(z); return z;
}
function zugTakt(dt) {
  if (dt <= 0) return;
  const bh = neueBahnhoefe(), rand = randGleis(), randK = rand && [...rand.kanten][0], randPunkt = randK != null ? { k: randK, S: gKanten.get(randK).a === rand.id ? 0.2 : gKanten.get(randK).len - 0.2 } : null;
  fernZeit -= dt; gueterZeit -= dt;
  if (randPunkt && bh.length && fernZeit <= 0 && zuege.filter((z) => z.art === "fern").length < Math.min(4, bh.length * 2)) { fernZeit = 30; const d = wahl(Math.random, bh), w = gleisWeg(randPunkt, bahnhofPunkt(d)); if (w) zugStarten("fern", w, d, { zurueck: true }); }
  if (randPunkt && bh.length && gueterZeit <= 0 && (industrieListe.length || anzahlTyp("hafen")) && zuege.filter((z) => z.art === "gueter").length < 2) { gueterZeit = 55; const d = wahl(Math.random, bh), w = gleisWeg(randPunkt, bahnhofPunkt(d)); if (w) zugStarten("gueter", w, d, { zurueck: true }); }
  for (const L of zuglinien.values()) { const da = zuege.filter((z) => z.linie === L.id).length; if (da < 2 && L.st.length >= 2 && (!L.letzterStart || simZeit - L.letzterStart > 20)) { const i = da % L.st.length, a = dienste.get(L.st[i]), b = dienste.get(L.st[(i + 1) % L.st.length]); if (a && b && a.gk != null && b.gk != null) { const w = gleisWeg(bahnhofPunkt(a), bahnhofPunkt(b)); if (w) { zugStarten("linie", w, b, { linie: L.id, i: (i + 1) % L.st.length, farbe: L.farbe }); L.letzterStart = simZeit; } } } }
  for (const z of zuege) {
    if (z.weg) continue;
    if (z.halt > 0) { z.halt -= dt; if (z.halt <= 0) zugWeiter(z, randPunkt); continue; }
    const rest = z.P.len - z.u; let vmax = Math.min(4.2, Math.sqrt(2 * 1.4 * Math.max(0, rest)) + 0.05);
    const kopf = pfadPunkt(z.P, z.u);
    for (const o of zuege) { if (o === z || o.weg || !o.pos) continue; for (const q of o.pos) { const dx = q.x - kopf.x, dz = q.z - kopf.z, vor = dx * kopf.tx + dz * kopf.tz; if (vor > 0 && vor < 3.4 && Math.abs(-dx * kopf.tz + dz * kopf.tx) < 0.5) vmax = Math.min(vmax, Math.max(0, (vor - 1.6) * 1.5)); } }
    const a = vmax > z.v ? 1.1 : -2.2; z.v = klemme(z.v + a * dt, 0, Math.max(vmax, 0)); if (vmax < z.v) z.v = vmax; z.u += z.v * dt;
    z.warte = z.v < 0.05 && rest > 0.3 ? z.warte + dt : 0; if (z.warte > 15) z.weg = true;
    if (rest < 0.05) { z.u = z.P.len; z.v = 0; z.halt = z.ziel === "rand" ? 0.01 : 6; if (z.ziel && z.ziel !== "rand") z.ziel.zugDa = simZeit; }
  }
  zuege = zuege.filter((z) => !z.weg);
}
function zugWeiter(z, randPunkt) {
  if (z.ziel === "rand") { z.weg = true; return; }
  const hier = z.ziel; if (!dienste.has(hier.id) || hier.gk == null || !gKanten.has(hier.gk)) { z.weg = true; return; }
  if (z.linie) { const L = zuglinien.get(z.linie); if (!L) { z.weg = true; return; } const n = (z.i + 1) % L.st.length, b = dienste.get(L.st[n]); const w = b && b.gk != null && gleisWeg(bahnhofPunkt(hier), bahnhofPunkt(b)); if (!w) { z.weg = true; return; } z.P = pfadVorbereiten(w); z.u = Math.min(z.P.len, 0.3); z.i = n; z.ziel = b; return; }
  if (z.zurueck && randPunkt) { const w = gleisWeg(bahnhofPunkt(hier), randPunkt); if (!w) { z.weg = true; return; } z.P = pfadVorbereiten(w); z.u = 0.3; z.ziel = "rand"; return; }
  z.weg = true;
}
function zuegeZeichnen() {
  let li = 0, wi = 0;
  for (const z of zuege) {
    z.pos = [];
    for (let i = 0; i < z.wagen; i++) {
      const p = pfadPunkt(z.P, z.u - 0.65 - i * 1.36); z.pos.push(p);
      if (z.u - 0.65 - i * 1.36 < -0.2 && z.ziel !== "rand") continue;
      _o.position.set(p.x, G + 0.035 + p.y, p.z); _o.rotation.set(0, Math.atan2(-p.tz, p.tx), 0); _o.scale.setScalar(1); _o.updateMatrix();
      const m = i === 0 ? lokMesh : wagenMesh, n = i === 0 ? li++ : wi++; if (n >= m.instanceMatrix.count) continue; m.setMatrixAt(n, _o.matrix); m.setColorAt(n, _farbe.setHex(i === 0 ? (z.art === "gueter" ? 0xd9302f : 0xf2f2f2) : z.art === "gueter" ? CONTAINER[(z.id + i) % CONTAINER.length] : z.farbe));
    }
  }
  return [li, wi];
}
/* Bahnübergänge mit Schranken */
let uebergaenge = [], uebergangNachKante = new Map();
function uebergaengeBerechnen() {
  uebergaenge = []; uebergangNachKante = new Map();
  for (const g of gKanten.values()) { if (g.ebene) continue; for (const k of kanten.values()) { if (k.ebene || !nahHuelle(k.h, { x: (g.h.x0 + g.h.x1) / 2, z: (g.h.z0 + g.h.z1) / 2 }, Math.max(g.h.x1 - g.h.x0, g.h.z1 - g.h.z0) / 2 + 2)) continue;
    for (let i = 0; i < g.pts.length - 1; i++) for (let j = 0; j < k.pts.length - 1; j++) { const s = schnitt(g.pts[i], g.pts[i + 1], k.pts[j], k.pts[j + 1]); if (!s) continue; const S = k.pts[j].s + (k.pts[j + 1].s - k.pts[j].s) * (1 - (1 - 0)) ; const e = abstandZuLinie(s, k.pts, true), q = punktBei(k, e.s), gq = g.pts[i]; const u = { k: k.id, S: e.s, x: s.x, z: s.z, tx: q.tx, tz: q.tz, gx: gq.tx, gz: gq.tz, halb: TYP[k.typ].halb, zu: false, w: 1.4 }; uebergaenge.push(u); if (!uebergangNachKante.has(k.id)) uebergangNachKante.set(k.id, []); uebergangNachKante.get(k.id).push(u); void S; } } }
}
const schranken = becken(G_BOX_UNTEN, M.flach, 800, true);
function schrankenZeichnen(dt) {
  let i = 0; const ax = new THREE.Vector3();
  for (const u of uebergaenge) {
    let nah = false; for (const z of zuege) if (z.pos) for (const p of z.pos) if (Math.hypot(p.x - u.x, p.z - u.z) < 4.2) { nah = true; break; }
    u.zu = nah; u.w += ((nah ? 0 : 1.45) - u.w) * Math.min(1, dt * 2.5);
    const nx = -u.tz, nz = u.tx;
    for (const sei of [1, -1]) {
      if (i + 2 > 800) break;
      const px = u.x - nx * sei * (u.halb + 0.08) - u.gx * sei * 0.55, pz = u.z - nz * sei * (u.halb + 0.08) - u.gz * sei * 0.55;
      _o.position.set(px, G, pz); _o.rotation.set(0, 0, 0); _o.scale.set(0.06, 0.32, 0.06); _o.updateMatrix(); schranken.setMatrixAt(i, _o.matrix); schranken.setColorAt(i++, _farbe.setHex(0xf2f2f2));
      ax.set(u.tx, 0, u.tz); _q.setFromAxisAngle(ax, sei * (Math.PI / 2 - u.w)); _m.compose(_v.set(px, G + 0.26, pz), _q, _s.set(0.035, u.halb * 0.98, 0.035)); schranken.setMatrixAt(i, _m); schranken.setColorAt(i++, _farbe.setHex(0xe8493f));
    }
  }
  schranken.count = i; schranken.instanceMatrix.needsUpdate = true; if (schranken.instanceColor) schranken.instanceColor.needsUpdate = true;
}
/* Werkzeug: Gleise */
let gleisModus = "gerade", zuglinieBau = [], zuglinieWahl = null;
function gleisTippen(p) {
  if (gleisModus === "entfernen") { const e = naechstesGleis(p, Math.max(0.9, fangRadius() * 0.6)); if (!e) { tipp("Tipp genau auf ein Gleis.", 1800); return; } if (e.k.aussen) { tipp("Der Bahnanschluss nach außen bleibt.", 2200); return; } merkeRueck(); geld += e.k.len * GLEIS_PREIS * 0.3; gKanteWeg(e.k); bahnhofAnkern(); gleisGeaendert(); zeigeWerte(); tipp("Gleis abgerissen.", 1600); return; }
  if (gleisModus === "bahnhof") { dienstVorschau(p); return; }
  if (gleisModus === "zuglinie") {
    const d = [...dienste.values()].find((x) => x.typ === "bahnhof" && x.gk != null && Math.hypot(x.x - p.x, x.z - p.z) < 2.6); if (!d) { tipp("Tipp auf einen Bahnhof 🚆, der an deinen Gleisen steht.", 2200); return; }
    if (zuglinieBau.length >= 2 && d.id === zuglinieBau[0]) { zuglinieFertig(); return; } if (zuglinieBau[zuglinieBau.length - 1] === d.id) return;
    zuglinieBau.push(d.id); frage("🚆 Zuglinie: " + zuglinieBau.length + " Bahnhöfe" + (zuglinieBau.length >= 2 ? " – ✓ zum Fertigstellen" : " – tipp den nächsten"), zuglinieBau.length >= 2, zuglinieFertig);
  }
}
function zuglinieFertig() {
  if (zuglinieBau.length < 2) return;
  for (let i = 0; i < zuglinieBau.length; i++) { const a = dienste.get(zuglinieBau[i]), b = dienste.get(zuglinieBau[(i + 1) % zuglinieBau.length]); if (!gleisWeg(bahnhofPunkt(a), bahnhofPunkt(b))) { tipp("⚠️ Zwischen diesen Bahnhöfen gibt es kein Gleis.", 3000); return; } }
  merkeRueck(); const nr = Math.max(0, ...[...zuglinien.values()].map((L) => L.nr)) + 1, L = { id: zlId++, nr, farbe: LINIEN_FARBEN[(nr + 3) % LINIEN_FARBEN.length], st: zuglinieBau.slice() };
  zuglinien.set(L.id, L); zuglinieBau = []; zuglinieWahl = L.id; frageZu(); gleisModus = "gerade"; busRechnen(); speichernBald(); unterleiste(); tipp("🚆 Zuglinie " + nr + " fährt!", 2500);
}
let fahrzeuge = [], fzId = 1;
const rv = zufall(4711);
function knotenR(n) {
  let r = 0, deg = 0; for (const id of n.kanten) { const k = kanten.get(id); if (k && TYP[k.typ].autos) { r = Math.max(r, TYP[k.typ].halb); deg++; } }
  return deg >= 3 ? r + 0.2 : deg === 2 ? 0.3 : 0.6;
}
function endKnoten(k, dir) { return knoten.get(dir > 0 ? k.b : k.a); }
function anfang(k, dir) { return Math.min(k.len * 0.45, knotenR(knoten.get(dir > 0 ? k.a : k.b))); }
function ende(k, dir) { return k.len - Math.min(k.len * 0.45, knotenR(endKnoten(k, dir))); }
function spurPunkt(k, dir, s, off) { const S = dir > 0 ? s : k.len - s, p = punktBei(k, S), tx = p.tx * dir, tz = p.tz * dir; return { x: p.x - tz * off, z: p.z + tx * off, tx, tz }; }
function spurAbstand(typ, spur) { const sp = TYP[typ].spuren; return sp[Math.min(spur, sp.length - 1)] || 0.27; }
function richtungAm(k, dir, amAnfang) { const p = amAnfang ? (dir > 0 ? k.pts[0] : k.pts[k.pts.length - 1]) : (dir > 0 ? k.pts[k.pts.length - 1] : k.pts[0]); return { x: p.tx * dir, z: p.tz * dir }; }
function abbiegen(k, dir, naechster) {
  const k2 = kanten.get(naechster.k); if (!k2) return "gerade";
  const a = richtungAm(k, dir, false), b = richtungAm(k2, naechster.dir, true), d = a.x * b.x + a.z * b.z, c = a.x * b.z - a.z * b.x;
  if (d < -0.6) return "wenden"; if (d > 0.82) return "gerade"; return c > 0 ? "rechts" : "links";
}
/* Wegsuche (A*) im Straßennetz */
function wegSuchen(start, ziel, nurSchienen) {
  const ks = kanten.get(start.k), kz = kanten.get(ziel.k); if (!ks || !kz) return null;
  if (ks === kz) { const dir = ziel.S >= start.S ? 1 : -1; if (!ks.einbahn || ks.einbahn === dir) return { route: [{ k: ks.id, dir }], s0: dir > 0 ? start.S : ks.len - start.S, s1: dir > 0 ? ziel.S : ks.len - ziel.S }; }
  const kosten = (k) => k.len / TYP[k.typ].tempo * (1 + k.stau * 2.5);
  const g = new Map(), von = new Map(), offen = [];
  const push = (id, wert, f) => { offen.push({ id, wert, f }); let i = offen.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (offen[p].f <= offen[i].f) break; [offen[p], offen[i]] = [offen[i], offen[p]]; i = p; } };
  const pop = () => { const top = offen[0], last = offen.pop(); if (offen.length) { offen[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < offen.length && offen[l].f < offen[m].f) m = l; if (r < offen.length && offen[r].f < offen[m].f) m = r; if (m === i) break; [offen[m], offen[i]] = [offen[i], offen[m]]; i = m; } } return top; };
  const zx = (knoten.get(kz.a).x + knoten.get(kz.b).x) / 2, zz = (knoten.get(kz.a).z + knoten.get(kz.b).z) / 2, h = (n) => Math.hypot(n.x - zx, n.z - zz) / 3.1;
  const t0 = TYP[ks.typ].tempo;
  const startWert = (nid, w, dir) => { if (w < (g.get(nid) ?? 1e9)) { g.set(nid, w); von.set(nid, { k: ks.id, dir, vor: null }); push(nid, w, w + h(knoten.get(nid))); } };
  if (ks.einbahn !== -1) startWert(ks.b, (ks.len - start.S) / t0, 1); if (ks.einbahn !== 1) startWert(ks.a, start.S / t0, -1);
  let bestZiel = null, bestWert = 1e9, schritte = 0;
  while (offen.length && schritte++ < 6000) {
    const { id, wert } = pop(); if (wert > (g.get(id) ?? 1e9)) continue; if (wert >= bestWert) break;
    const n = knoten.get(id);
    if ((id === kz.a && kz.einbahn !== -1) || (id === kz.b && kz.einbahn !== 1)) { const dir = id === kz.a ? 1 : -1, w = wert + (dir > 0 ? ziel.S : kz.len - ziel.S) / TYP[kz.typ].tempo; if (w < bestWert) { bestWert = w; bestZiel = { nid: id, dir }; } }
    for (const kid of n.kanten) {
      const k = kanten.get(kid); if (!TYP[k.typ].autos || k === kz) continue;
      const nach = k.a === id ? k.b : k.a, dir = k.a === id ? 1 : -1, w = wert + kosten(k);
      if (k.einbahn && k.einbahn !== dir) continue;
      if (nurSchienen && !k.schienen) continue;
      if (w < (g.get(nach) ?? 1e9)) { g.set(nach, w); von.set(nach, { k: k.id, dir, vor: id }); push(nach, w, w + h(knoten.get(nach))); }
    }
  }
  if (!bestZiel) return null;
  const route = [{ k: kz.id, dir: bestZiel.dir }]; let nid = bestZiel.nid, schutz = 0;
  while (schutz++ < 2000) { const v = von.get(nid); route.unshift({ k: v.k, dir: v.dir }); if (v.vor == null) break; nid = v.vor; }
  const erste = route[0];
  return { route, s0: erste.dir > 0 ? start.S : ks.len - start.S, s1: bestZiel.dir > 0 ? ziel.S : kz.len - ziel.S };
}
/* Fahrten erzeugen */
let wohnListe = [], arbeitListe = [], ladenListe = [], industrieListe = [], listenZeit = -1;
function listenAuffrischen() {
  wohnListe = []; arbeitListe = []; ladenListe = []; industrieListe = [];
  for (const h of haeuser.values()) { if (h.verlassen) continue; const g = gruppe(h); if (g === "w") wohnListe.push(h); else { arbeitListe.push(h); if (g === "g") ladenListe.push(h); else if (g === "i") industrieListe.push(h); } }
  listenZeit = simZeit;
}
const gewichtet = (liste, f) => { let s = 0; for (const x of liste) s += f(x); let r = rv() * s; for (const x of liste) { r -= f(x); if (r <= 0) return x; } return liste[liste.length - 1]; };
function berufsverkehr() { const h = ((zeit + 0.25) % 1) * 24; let f = h < 5 ? 0.25 : h < 6.5 ? 0.6 : h < 9 ? 1.7 : h < 16 ? 1.0 : h < 18.5 ? 1.7 : h < 22 ? 0.8 : 0.35; return f; }
let aussenKnoten = null;
const AUSSEN = { aussen: true };
const aussenListe = () => [...knoten.values()].filter((n) => n.aussen && n.kanten.size);
function zufahrtAussen(n) { if (!n) { const L = aussenListe(); n = L.length ? gewichtet(L, (q) => [...q.kanten].some((id) => kanten.get(id).typ === "autobahn") ? 1.4 : 1) : knoten.get(aussenKnoten); } if (!n) return null; const k = kanten.get([...n.kanten][0]); if (!k) return null; return { k: k.id, S: k.a === n.id ? 0.3 : k.len - 0.3 }; }
function aussenBauen() {
  const richtungen = karte === "kueste" ? [[0, -1]] : [[1, 0], [0, 1], [-1, 0], [0, -1]];
  for (const [dx, dz] of richtungen) {
    let ok = true;
    for (let s = 17; s <= 205 && ok; s += 2) { const d = abstand(dx * s, dz * s); if (karte !== "insel" && d < 3.5) ok = false; }
    if (!ok) continue;
    const punkte = [17, 52, 92, 132, 172, 212], neu = [];
    for (let i = 0; i < punkte.length - 1; i++) {
      const A = { art: "frei", x: dx * punkte[i], z: dz * punkte[i] }, Bp = { art: "frei", x: dx * punkte[i + 1], z: dz * punkte[i + 1] };
      neu.push(...bauen({ A, B: Bp, C: lerp(A, Bp, 0.5), typ: "haupt", kosten: 0 }));
    }
    neu.forEach((k) => { k.aussen = true; });
    const n = naechsterKnoten({ x: dx * 212, z: dz * 212 }, 1); if (n) { n.aussen = true; aussenKnoten = n.id; }
    if (grossKarte) autobahnBauen(dx, dz);
    netzGeaendert(); return true;
  }
  return false;
}
function autobahnBauen(dx, dz) {
  // Autobahn quer durch die Karte – sie kreuzt die Landstraße bei 70 Feldern: das ist die Abfahrt in die Stadt
  const px = -dz, pz = dx, mx = dx * 70, mz = dz * 70, t = [-212, -150, -90, -36, 36, 90, 150, 212], neu = [];
  const pkt = (v) => ({ art: "frei", x: mx + px * v, z: mz + pz * v });
  neu.push(...bauen({ A: pkt(t[3]), B: pkt(t[4]), C: lerp(pkt(t[3]), pkt(t[4]), 0.5), typ: "autobahn", kosten: 0 }));
  for (let i = 0; i < t.length - 1; i++) if (i !== 3) { const A = naechsterKnoten(pkt(t[i]), 0.5) ? { art: "frei", ...pkt(t[i]) } : pkt(t[i]); neu.push(...bauen({ A, B: pkt(t[i + 1]), C: lerp(pkt(t[i]), pkt(t[i + 1]), 0.5), typ: "autobahn", kosten: 0 })); }
  for (const k of kanten.values()) if (k.typ === "autobahn") k.aussen = true;
  for (const v of [t[0], t[t.length - 1]]) { const n = naechsterKnoten(pkt(v), 1); if (n) n.aussen = true; }
  const ab = naechsterKnoten({ x: mx, z: mz }, 1.5); if (ab) ab.abfahrt = true;
}
const pkwTyp = () => wahl(rv, PKW_TYPEN);
/* Echtes Parken: jedes Auto gehört einem Haus, steht sichtbar auf einem Stellplatz und fährt von dort los */
const autos = new Map(); let autoId = 1, parkNeu = true;
const PARK_TYPEN = ["klein", "klein", "limo", "kombi", "kombi", "suv", "suv", "pickup", "sport"];
const stunde = () => ((zeit + 0.25) % 1) * 24, SEK_PRO_STUNDE = 15;
function parkenNeu(b) {
  const alt = (b.slots || []).filter((q) => q.auto).map((q) => q.auto);
  b.slots = (b.teile.plaetze || []).map((p, i) => { const w = hausPunkt(b, p); return { b, i, x: w.x, z: w.z, rot: b.rot + p.rot, ly: p.ly || 0, tief: !!p.tief, auto: null, res: null }; });
  for (const a of alt) { const q = b.slots.find((x) => !x.auto && !x.res); if (q) { q.auto = a; a.wo = q; if (a.heim === b.id) a.heimSlot = q; } else autoHeimholen(a.id); }
  if (!b.dienst && !imBau(b) && haeuser.has(b.id) && gruppe(b) === "w") {
    const soll = Math.min(b.slots.length, b.zone === 1 ? b.slots.length : Math.ceil(leute(b) / 5)); let ist = 0; for (const a of autos.values()) if (a.heim === b.id) ist++;
    for (const q of b.slots) { if (ist >= soll) break; if (q.auto || q.res) continue; const a = { id: autoId++, typ: wahl(Math.random, PARK_TYPEN), farbe: wahl(Math.random, PAL.auto), heim: b.id, wo: q, heimSlot: q, bis: Infinity }; q.auto = a; autos.set(a.id, a); ist++; }
  }
  parkNeu = true;
}
function parkenWeg(b) {
  const slots = b.slots || []; b.slots = [];
  for (const q of slots) { const a = q.auto; q.auto = null; if (a && a.heim !== b.id) { a.wo = null; autoHeimholen(a.id); } }
  for (const a of [...autos.values()]) if (a.heim === b.id) { autos.delete(a.id); if (a.wo) a.wo.auto = null; }
  parkNeu = true;
}
function autoHeimholen(id) {
  const a = autos.get(id); if (!a) return; if (a.wo && a.wo.auto === a) a.wo.auto = null;
  const h = haeuser.get(a.heim), S = h && h.slots;
  const q = S && (a.heimSlot && S.includes(a.heimSlot) && (!a.heimSlot.auto || a.heimSlot.auto === a) ? a.heimSlot : S.find((x) => !x.auto && (!x.res || x.res === a.id)));
  if (!q) { autos.delete(id); parkNeu = true; return; }
  q.auto = a; q.res = null; a.wo = q; a.heimSlot = q; a.bis = Infinity; parkNeu = true;
}
const slotFrei = (q) => !q.auto && !q.res;
function zielPlatz(nach) {
  const eigen = (nach.slots || []).find(slotFrei); if (eigen) return eigen;
  let best = null, bd = 7; for (const d of dienste.values()) { if (d.typ !== "parkplatz" && d.typ !== "parkhaus") continue; const e = Math.hypot(d.x - nach.x, d.z - nach.z); if (e < bd) { const q = (d.slots || []).find(slotFrei); if (q) { best = q; bd = e; } } }
  if (best) return best;
  const z = zufahrt(nach); if (z) { const k = kanten.get(z.k); if (k && k.slots) { let b2 = null, bd2 = 3; for (const q of k.slots) if (slotFrei(q) && Math.abs(q.s - z.S) < bd2) { bd2 = Math.abs(q.s - z.S); b2 = q; } if (b2) return b2; } }
  return null;
}
const slotZiel = (q) => ({ x: q.x, z: q.z, rot: q.rot, ly: q.ly, tief: q.tief });
const slotStart = (q, b) => q && !q.tief ? { x: q.x, z: q.z } : hausPunkt(b, (b.teile && b.teile.park) || { lx: 0, lz: 0 });
function autoLosfahren(a, von, nach, zweck) {
  const ziel = zielPlatz(nach), zb = ziel && ziel.b && ziel.b !== nach && ziel.b.dienst ? zufahrt(ziel.b) : zufahrt(nach), za = zufahrt(von); if (!za || !zb) return false;
  const weg = wegSuchen(za, zb); if (!weg) { von.keinWeg = true; return false; }
  const start = a.wo; const f = fahrzeugAusWeg(weg, a.typ, null, hausName(von), hausName(nach), "haus", { vonP: slotStart(start, von), nachP: ziel ? slotZiel(ziel) : null });
  if (!f) return false;
  f.farbe = a.farbe; f.autoId = a.id; f.zielSlot = ziel; f.zweck = zweck; if (ziel) ziel.res = a.id;
  if (start) { start.auto = null; if (start === a.heimSlot) start.res = a.id; } a.wo = null; parkNeu = true; return f;
}
function autoAngekommen(f) {
  const a = autos.get(f.autoId); if (!a) return; const q = f.zielSlot;
  if (q && (q.res === a.id || !q.auto) && (q.b ? (q.b.slots || []).includes(q) : true)) { q.auto = a; q.res = null; a.wo = q; } else { autoHeimholen(a.id); return; }
  const daheim = q.b && q.b.id === a.heim && !q.b.dienst, h = stunde();
  a.bis = daheim ? Infinity : simZeit + (f.zweck === "arbeit" ? Math.max(2, h < 17 ? 17 - h : 2 + Math.random() * 2) : 0.7 + Math.random() * 1.6) * SEK_PRO_STUNDE;
  parkNeu = true;
}
let rueckZeit = 0;
function rueckTakt() {
  if (simZeit - rueckZeit < 0.7) return; rueckZeit = simZeit; let n = 0;
  for (const a of autos.values()) {
    if (n >= 2) break; const w = a.wo; if (!w || a.bis > simZeit || a.heim == null) continue; if (w.b && w.b.id === a.heim && !w.b.dienst) continue;
    const h = haeuser.get(a.heim); if (!h) { autos.delete(a.id); w.auto = null; continue; }
    if (w.kante && !kanten.has(w.k)) { autoHeimholen(a.id); continue; }
    const b = w.kante ? null : w.b, za = w.kante ? { k: w.k, S: w.s } : zufahrt(b), zb = zufahrt(h); if (!za || !zb) { a.bis = simZeit + 5; continue; }
    const weg = wegSuchen(za, zb); if (!weg) { a.bis = simZeit + 8; continue; }
    const hq = a.heimSlot && h.slots.includes(a.heimSlot) ? a.heimSlot : h.slots.find((x) => !x.auto && (!x.res || x.res === a.id));
    const f = fahrzeugAusWeg(weg, a.typ, null, b ? hausName(b) : "Parkstreifen", hausName(h), "haus", { vonP: w.kante ? { x: w.x, z: w.z } : slotStart(w, b), nachP: hq ? slotZiel(hq) : null });
    if (!f) { a.bis = simZeit + 2; continue; }
    f.farbe = a.farbe; f.autoId = a.id; f.zielSlot = hq; f.zweck = "heim"; if (hq) hq.res = a.id; w.auto = null; a.wo = null; n++; parkNeu = true;
  }
}
const parkFz = {}, PARK_MAX = 900; let parkRaeder = null;
function geparkteZeichnen() {
  if (!parkNeu) return; parkNeu = false;
  if (!parkRaeder) { for (const k of new Set(PARK_TYPEN)) parkFz[k] = becken(FZ[k].geo, AUTO_MAT, PARK_MAX, true); parkRaeder = becken(G_RAD, fzRaeder.material, PARK_MAX * 4, false); }
  const n = {}; for (const k in parkFz) n[k] = 0; let ri = 0; const up = new THREE.Vector3(0, 1, 0);
  const alle = []; for (const b of haeuser.values()) if (b.slots) alle.push(...b.slots); for (const b of dienste.values()) if (b.slots) alle.push(...b.slots); for (const k of kanten.values()) if (k.slots) alle.push(...k.slots);
  for (const q of alle) {
    const a = q.auto; if (!a || q.tief) continue; const P = parkFz[a.typ]; if (!P || n[a.typ] >= PARK_MAX) continue; const D = FZ[a.typ];
    _q.setFromAxisAngle(up, q.rot); _m.compose(_v.set(q.x, G + 0.02 + q.ly, q.z), _q, _s.set(1, 1, 1)); P.setMatrixAt(n[a.typ], _m); P.setColorAt(n[a.typ]++, _farbe.setHex(a.farbe));
    if (ri < PARK_MAX * 4 - 4) for (const ax of [D.achsen[0], D.achsen[D.achsen.length - 1]]) for (const rz of [D.B / 2 - 0.012, -D.B / 2 + 0.012]) { _l.compose(_v.set(ax, D.rad, rz), _q0, _s.set(D.rad, D.rad, 1)); parkRaeder.setMatrixAt(ri++, _l.premultiply(_m)); }
  }
  for (const k in parkFz) { const P = parkFz[k]; P.count = n[k]; P.instanceMatrix.needsUpdate = true; if (P.instanceColor) P.instanceColor.needsUpdate = true; }
  parkRaeder.count = ri; parkRaeder.instanceMatrix.needsUpdate = true;
}

const lkwWahl = () => { const r = rv(); return r < 0.45 ? "lkw" : r < 0.85 ? "lkw2" : "kipper"; }, mitAuflieger = (t) => t === "lkw" || t === "lkw2";
function hausName(h) { return h.name || ZONEN[h.zone].name; }
function auflieger(von, nach) { const q = von || nach; if (q && q.zone === 7) return "getreide"; if (q && q.zone === 8) return "holz"; if (karte === "wald" && rv() < 0.15) return "holz"; return nach && gruppe(nach) === "g" ? (rv() < 0.5 ? "kuehl" : "container") : wahl(rv, ["container", "container", "tank"]); }
function fahrtStarten() {
  if (simZeit - listenZeit > 2) listenAuffrischen();
  if (!wohnListe.length && !arbeitListe.length) return false;
  const r = rv(); let von, nach, typ, anh = null;
  if (r < 0.1 && (industrieListe.length || ladenListe.length)) { const hs = [...dienste.values()].filter((d) => d.typ === "hafen"); if (hs.length) { const h = wahl(rv, hs), ziel = industrieListe.length && rv() < 0.6 ? gewichtet(industrieListe, jobs) : ladenListe.length ? gewichtet(ladenListe, jobs) : null; const za = zufahrt(h), zb = ziel && zufahrt(ziel); if (za && zb) return fahrzeugAusWeg(wegSuchen(za, zb), rv() < 0.5 ? "lkw" : "lkw2", "container", "🚢 Frachthafen", hausName(ziel), "aussen"); } }
  if (aussenKnoten && r < 0.3) {
    const AL = aussenListe();
    if (AL.length > 1 && rv() < 0.3) { const a = wahl(rv, AL), b = wahl(rv, AL.filter((q) => q !== a)), za = zufahrtAussen(a), zb = zufahrtAussen(b); if (!za || !zb) return false; const t = rv() < 0.35 ? lkwWahl() : pkwTyp(); return fahrzeugAusWeg(wegSuchen(za, zb), t, mitAuflieger(t) ? auflieger(null, null) : null, "außerhalb der Stadt", "außerhalb der Stadt", "aussen"); }
    // Verkehr von und nach außen: Pendler, Besucher, Lieferungen
    const ziel = rv() < 0.4 && industrieListe.length ? gewichtet(industrieListe, jobs) : arbeitListe.length && rv() < 0.6 ? gewichtet(arbeitListe, jobs) : wohnListe.length ? gewichtet(wohnListe, leute) : null;
    if (!ziel) return false;
    typ = gruppe(ziel) === "i" ? (rv() < 0.6 ? lkwWahl() : "liefer") : pkwTyp(); if (mitAuflieger(typ)) anh = auflieger(ziel, null);
    const za = zufahrtAussen(), zb = zufahrt(ziel); if (!za || !zb) return false;
    const rein = rv() < 0.55;
    return fahrzeugAusWeg(rein ? wegSuchen(za, zb) : wegSuchen(zb, za), typ, anh, rein ? "außerhalb der Stadt" : hausName(ziel), rein ? hausName(ziel) : "außerhalb der Stadt", rein ? "aussen" : "haus", rein ? { nach: ziel } : { von: ziel });
  }
  if (!wohnListe.length || !arbeitListe.length) return false;
  if (r < 0.38 && industrieListe.length && ladenListe.length) { von = gewichtet(industrieListe, jobs); nach = gewichtet(ladenListe, jobs); typ = rv() < 0.55 ? lkwWahl() : "liefer"; if (mitAuflieger(typ)) anh = auflieger(von, nach); }
  else {
    const h = stunde(), anteilArbeit = h >= 5 && h < 10 ? 0.85 : h < 16 ? 0.35 : h < 21 ? 0.15 : 0.3;
    von = gewichtet(wohnListe, leute); const arbeit = rv() < anteilArbeit || !ladenListe.length; nach = arbeit ? gewichtet(arbeitListe, jobs) : gewichtet(ladenListe, jobs);
    const a = [...autos.values()].find((x) => x.heim === von.id && x.wo && x.wo.b === von);
    if (a) return autoLosfahren(a, von, nach, arbeit ? "arbeit" : "einkauf");
    if ([...autos.values()].some((x) => x.heim === von.id)) return false;
    typ = pkwTyp(); if (rv() < 0.5) [von, nach] = [nach, von];
  }
  const za = zufahrt(von), zb = zufahrt(nach); if (!za || !zb) return false;
  const weg = wegSuchen(za, zb); if (!weg) { von.keinWeg = true; return false; }
  von.keinWeg = false;
  return fahrzeugAusWeg(weg, typ, anh, hausName(von), hausName(nach), "haus", { von, nach });
}
const hausPunkt = (h, p) => { const cs = Math.cos(h.rot), sn = Math.sin(h.rot); return { x: h.x + p.lx * cs + p.lz * sn, z: h.z - p.lx * sn + p.lz * cs }; };
function hofKurve(p0, c, p2) { let len = 0, a = p0; for (let i = 1; i <= 8; i++) { const b = bez(p0, c, p2, i / 8); len += abst(a, b); a = b; } return { p0, c, p2, t: 0, len: Math.max(0.15, len) }; }
function fahrzeugAusWeg(weg, typ, anh, vonText, nachText, start, hs) {
  if (!weg) return false;
  const k = kanten.get(weg.route[0].k), spur = TYP[k.typ].spuren.length - 1;
  if (fahrzeuge.some((f) => f.modus === "kante" && f.route[f.ri].k === k.id && f.route[f.ri].dir === weg.route[0].dir && Math.abs(f.s - weg.s0) < 1.4)) return false;
  const D = FZ[typ], amRand = start === "haus";
  { const q = spurPunkt(k, weg.route[0].dir, weg.s0, amRand ? TYP[k.typ].fahr + 0.02 : spurAbstand(k.typ, spur)); for (const g of fahrzeuge) if (g.pos && Math.hypot(g.pos.x - q.x, g.pos.z - q.z) < (g.L + D.L) / 2 + 0.15) return false; }
  const f = { id: fzId++, typ, ...D, farbe: D.lack || wahl(rv, PAL.auto), anh, anhFarbe: wahl(rv, CONTAINER), route: weg.route, ri: 0, s: weg.s0, sZiel: weg.s1, spur,
    off: amRand ? TYP[k.typ].fahr + 0.02 : spurAbstand(k.typ, spur), offV: 0, v: 0, modus: "kante", warte: 0, alter: 0, faktor: (0.88 + rv() * 0.24) * D.vf, roll: 0, nick: 0, blink: 0, bremst: false, frei: false,
    skala: amRand ? 0.01 : 1, parkt: 0, lenk: 0, anhWinkel: null, vonText, nachText, ausparken: amRand,
    zeitluecke: 0.65 + rv() * 0.55, beschl: D.beschl * (0.82 + rv() * 0.36), rueckT: amRand && weg.s0 > 1 && rv() < 0.6 ? 0.55 : 0, block: null };
  spurWaehlen(f);
  if (hs && hs.nach && hs.nach.teile && hs.nach.teile.park) f.nachHaus = hs.nach;
  if (hs && hs.nachP) f.nachP = hs.nachP;
  const vonP = hs && (hs.vonP || (hs.von && hs.von.teile && hs.von.teile.park && haeuser.has(hs.von.id) ? hausPunkt(hs.von, hs.von.teile.park) : null));
  if (amRand && vonP) {
    const fahr = TYP[k.typ].fahr + 0.02, dir = weg.route[0].dir, s1 = Math.min(k.len - 0.05, weg.s0 + 0.5);
    const P0 = vonP; if (fahrzeuge.some((g) => g.modus === "hof" && g.hof && g.hof.raus && abst(g.hof.p0, P0) < 0.4)) return false;
    if (s1 > weg.s0 + 0.2) { f.hof = hofKurve(P0, spurPunkt(k, dir, weg.s0, fahr), spurPunkt(k, dir, s1, fahr)); f.hof.raus = true; f.modus = "hof"; f.s = s1; f.skala = 1; f.rueckT = 0; f.v = 0.1; }
  }
  fahrzeuge.push(f); return f;
}
function spurIst(typ, off) { const sp = TYP[typ].spuren; let b = 0; for (let i = 1; i < sp.length; i++) if (Math.abs(sp[i] - off) < Math.abs(sp[b] - off)) b = i; return b; }
function spurFrei(spuren, st, sp, f) {
  const l = spuren.get(st.k + ":" + st.dir + ":" + sp); if (!l) return true;
  for (const g of l) if (g !== f && g.s > f.s - f.hintenL - g.vorneL - 0.3 - g.v * 0.6 && g.s < f.s + f.vorneL + g.hintenL + 0.3) return false;
  return true;
}
function spurWaehlen(f) {
  const st = f.route[f.ri], k = kanten.get(st.k); if (!k) return;
  const n = TYP[k.typ].spuren.length; if (n < 2) { f.spur = 0; return; }
  const nx = f.route[f.ri + 1]; const a = nx ? abbiegen(k, st.dir, nx) : "rechts";
  f.spur = a === "links" || a === "wenden" ? 0 : a === "rechts" ? n - 1 : (f.spur != null ? Math.min(Math.max(f.spur, n > 2 ? 1 : 0), n - 1) : Math.min(1, n - 1));
  if (k.busspur && !(f.linie || FZ[f.typ].blau || f.typ === "taxi")) f.spur = Math.min(f.spur, n - 2);
}
function ampelZustand(n, kid) {
  const ph = simZeit % 22, gr = n.gruppe.get(kid) || 0;
  if (gr === 0) return ph < 8.5 ? "gruen" : ph < 10 ? "gelb" : ph < 21.2 ? "rot" : "rotgelb";
  return ph < 10.2 ? "rot" : ph < 11 ? "rotgelb" : ph < 19.5 ? "gruen" : ph < 21 ? "gelb" : "rot";
}
function netzVerkehrVorbereiten() {
  for (const n of knoten.values()) {
    let autoKanten = 0, haupt = false; for (const id of n.kanten) { const k = kanten.get(id); if (TYP[k.typ].autos) { autoKanten++; if (rang(k) >= 2) haupt = true; } }
    if (!n.manuell) n.ampel = (autoKanten >= 4 || (autoKanten >= 3 && haupt)) && ![...n.kanten].some((id) => kanten.get(id).typ === "autobahn");
    if (autoKanten < 3 || [...n.kanten].some((id) => kanten.get(id).ring)) n.ampel = false;
    n.gruppe = new Map(); let ref = null;
    for (const id of n.kanten) { const k = kanten.get(id); if (!TYP[k.typ].autos) continue; const d = richtungAm(k, k.a === n.id ? 1 : -1, true); if (!ref) ref = d; n.gruppe.set(id, Math.abs(ref.x * d.x + ref.z * d.z) > 0.7 ? 0 : 1); }
  }
  ampelnBauen();
}
function darfEinfahren(f, k, st, nx) {
  const n = endKnoten(k, st.dir), k2 = kanten.get(nx.k); if (!k2) return false;
  // ist auf der nächsten Spur Platz?
  const s2 = anfang(k2, nx.dir);
  for (const g of fahrzeuge) if (g !== f && g.modus === "kante" && g.route[g.ri].k === k2.id && g.route[g.ri].dir === nx.dir && g.s < s2 + g.hintenL + f.vorneL + 0.35 && !(f.alarm && g.weicht)) return false;
  if (f.alarm) { for (const g of n.drin) if (g.von !== k.id && g.trT < 0.75) return false; return true; }
  if (n.naht && n.naht.some((g) => g.alarm && g !== f && g.route[g.ri] && g.route[g.ri].k !== k.id)) return false;
  if (n.ampel) { const z = ampelZustand(n, k.id); if (z === "rot" || z === "rotgelb") return false; if (z === "gelb" && !(ende(k, st.dir) - f.s < 0.7 && f.v > 1.2)) return false; if ([...n.drin].some((g) => g.von !== k.id && ampelZustand(n, g.von) !== ampelZustand(n, k.id) && g.trT < 0.6)) return false; return !wegeKreuzen(f, k, st, nx, n); }
  if (n.kanten.size <= 2) return true;
  for (const g of n.drin) if (g.von !== k.id) return false;
  if (!k.ring && k2.ring) {
    // Einfahren in den Kreisverkehr: Wer drin ist, hat Vorfahrt – und der Kreis darf nicht volllaufen
    for (const g of n.naht) if (g !== f && kanten.get(g.route[g.ri].k).ring) return false;
    let ringZahl = 0; for (const e of kanten.values()) if (e.ring && e.kreisel === k2.kreisel) ringZahl++;
    const cap = Math.max(2, ringZahl - 3);
    let drin = 0; for (const g of fahrzeuge) { const e = kanten.get(g.modus === "kante" ? g.route[g.ri].k : g.von); if (e && e.ring && e.kreisel === k2.kreisel) drin++; }
    return drin < cap;
  }
  if (k.ring) return true;
  if ([...n.kanten].some((id) => kanten.get(id).ring)) return true;
  if (n.vorrang && n.vorrang !== f && n.vorrang.route[n.vorrang.ri].k !== k.id) return false;
  for (const g of n.naht) if (g !== f && rang(kanten.get(g.route[g.ri].k)) > rang(k) && g.v > 0.3 && g.warte < 3) return false;
  return true;
}
/* Kreuzen sich die Wege zweier Autos auf der Kreuzung? (z. B. Linksabbieger und Gegenverkehr bei Grün) */
function kurvePunkte(f, k, st, nx) { if (f.tr) return [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => bez(f.tr.p0, f.tr.c, f.tr.p2, Math.max(f.tr.t, i / 8))); const g = uebergangGeometrie(f, k, st, nx); return [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => bez(g.p0, g.c, g.p2, i / 8)); }
function wegeKreuzen(f, k, st, nx, n) {
  let meine = null;
  for (const g of n.drin) {
    if (g === f || g.von === k.id) continue;
    const gk = kanten.get(g.von), gst = g.tr ? null : g.route[g.ri], gnx = g.route[g.ri + 1]; if (!gk || !gnx) continue;
    if (!meine) meine = kurvePunkte(f, k, st, nx);
    const seine = kurvePunkte(g, gk, gst || g.route[g.ri], gnx), r = (f.B + g.B) / 2 + 0.1 + Math.max(0, (f.L + g.L - 1) * 0.15);
    for (const a of meine) for (const b of seine) if (Math.hypot(a.x - b.x, a.z - b.z) < r) return true;
  }
  return false;
}
function uebergangGeometrie(f, k, st, nx) {
  const n = endKnoten(k, st.dir), k2 = kanten.get(nx.k), e = ende(k, st.dir);
  const p0 = spurPunkt(k, st.dir, e, spurAbstand(k.typ, f.spur));
  const altRi = f.ri, altSpur = f.spur; f.ri++; spurWaehlen(f); const spurNeu = f.spur; f.ri = altRi; f.spur = altSpur;
  const s2 = anfang(k2, nx.dir), off2 = spurAbstand(k2.typ, spurNeu), p2 = spurPunkt(k2, nx.dir, s2, off2);
  const d = p0.tx * p2.tx + p0.tz * p2.tz;
  let c;
  if (d < -0.6) { const r = Math.max(0.5, abst(p0, p2)); c = { x: n.x + p0.tx * (r + 0.6), z: n.z + p0.tz * (r + 0.6) }; }
  else {
    // Schnittpunkt der beiden Fahrtrichtungen → saubere Kurve wie auf echten Kreuzungen
    const den = p0.tx * p2.tz - p0.tz * p2.tx;
    if (Math.abs(den) > 0.15) { const t = ((p2.x - p0.x) * p2.tz - (p2.z - p0.z) * p2.tx) / den; c = { x: p0.x + p0.tx * t, z: p0.z + p0.tz * t }; if (t < 0 || t > 6) c = null; }
    if (!c) { const r = Math.max(0.3, abst(p0, p2) * 0.5); c = { x: (p0.x + p0.tx * r + p2.x - p2.tx * r) / 2, z: (p0.z + p0.tz * r + p2.z - p2.tz * r) / 2 }; }
  }
  return { n, k2, p0, c, p2, s2, spurNeu, off2 };
}
function uebergangStarten(f, k, st, nx) {
  const g = uebergangGeometrie(f, k, st, nx);
  let len = 0, vor = g.p0; for (let i = 1; i <= 10; i++) { const q = bez(g.p0, g.c, g.p2, i / 10); len += abst(vor, q); vor = q; }
  f.tr = { p0: g.p0, c: g.c, p2: g.p2, len: Math.max(0.2, len), t: 0, s2: g.s2, spurNeu: g.spurNeu, off2: g.off2, knoten: g.n.id, vKurve: Math.max(0.6, Math.min(TYP[k.typ].tempo, kurvenTempo(g.p0, g.c, g.p2))) };
  f.off = spurAbstand(k.typ, f.spur); f.offV = 0;
  f.modus = "knoten"; f.von = k.id; f.trT = 0; g.n.drin.add(f);
}
function fahrzeugWeg(f) { if (f.autoId && !f.weg) autoHeimholen(f.autoId); for (const id of [f.tr && f.tr.knoten, f.reserviert]) { const n = id != null && knoten.get(id); if (n) n.drin.delete(f); } f.weg = true; }
const _e = new THREE.Euler(0, 0, 0, "YZX");
/* Kurvenradius aus drei Punkten → sicheres Tempo (Fliehkraft) */
const QUER = 1.6;   // höchste Querbeschleunigung (Einheiten/s²)
function kurvenTempo(p0, c, p2) {
  const a = Math.atan2(c.z - p0.z, c.x - p0.x), b = Math.atan2(p2.z - c.z, p2.x - c.x), w = Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
  if (w < 0.08) return 9; const R = Math.max(0.15, abst(p0, p2) / (2 * Math.sin(w / 2)));
  return Math.sqrt(QUER * R);
}
function kantenKruemmung(k, dir, s) { const a = spurPunkt(k, dir, s, 0), b = spurPunkt(k, dir, Math.min(k.len, s + 1.2), 0), d = Math.abs(Math.atan2(a.tx * b.tz - a.tz * b.tx, a.tx * b.tx + a.tz * b.tz)); return d / 1.2; }
/* Notfall-Abstandshalter: schaut vor jedes Auto, ob dort ein anderes steht – egal ob Kreuzung, Spurwechsel oder Parken */
function blockadenMessen() {
  const L = fahrzeuge.filter((f) => f.pos && !f.weg);
  for (const f of L) { f.block = null; f.blocker = null; }
  for (const f of L) {
    if (f.parkt || f.skala < 0.6) continue;
    const p = f.pos, blick = f.vorneL + 0.3 + f.v * 0.55;
    for (const g of L) {
      if (g === f || g.skala < 0.4 || (f.alarm && g.weicht === f)) continue;
      const dx = g.pos.x - p.x, dz = g.pos.z - p.z; if (dx * dx + dz * dz > (blick + g.L + 0.6) ** 2) continue;
      if (f.modus === "kante" && g.modus === "kante" && f.route[f.ri].k === g.route[g.ri].k && f.route[f.ri].dir !== g.route[g.ri].dir) continue;   // Gegenverkehr auf eigener Spur
      const gl = g.vorneL + g.hintenL, n = Math.max(2, Math.ceil(gl / 0.16)), breit = (f.B + g.B) / 2 + 0.015;
      for (let i = 0; i <= n; i++) {
        const o = g.vorneL - g.B / 2 - (gl - g.B) * i / n, qx = dx + g.pos.tx * o, qz = dz + g.pos.tz * o;
        const vor = qx * p.tx + qz * p.tz, seit = -qx * p.tz + qz * p.tx;
        if (vor <= 0 || Math.abs(seit) > breit) continue;
        const d = vor - f.vorneL - g.B / 2 - 0.04; if (d < blick && (f.block == null || d < f.block)) { f.block = Math.max(0, d); f.blocker = g; }
      }
    }
  }
  // gegenseitig blockiert? Dann darf einer fahren, damit nichts für immer steht
  for (const f of L) { const g = f.blocker; if (g && ((g.blocker === f && f.id < g.id && f.warte > 1.2) || f.warte > 8)) { f.block = null; f.blocker = null; } }
}
function verkehrTakt(dt, ziel) {
  if (dt <= 0) return;
  blockadenMessen();
  for (let i = 0; i < 3 && fahrzeuge.length < ziel; i++) fahrtStarten();
  if (fahrzeuge.length < ziel + 10) rueckTakt();
  const spuren = new Map();
  for (const n of knoten.values()) { n.naht = []; n.vorrang = null; }
  for (const f of fahrzeuge) {
    if (f.modus !== "kante" || f.parkt) continue;
    const st = f.route[f.ri], kk = kanten.get(st.k); if (!kk) { f.weg = true; continue; }
    f.ist = spurIst(kk.typ, f.off);
    for (const sp of f.ist === f.spur ? [f.spur] : [f.spur, f.ist]) { const key = st.k + ":" + st.dir + ":" + sp; if (!spuren.has(key)) spuren.set(key, []); spuren.get(key).push(f); }
    if (f.ri < f.route.length - 1 && ende(kk, st.dir) - f.s < 3.5) { const n = endKnoten(kk, st.dir); n.naht.push(f); if (f.warte > 4 && (!n.vorrang || f.warte > n.vorrang.warte)) n.vorrang = f; }
  }
  for (const l of spuren.values()) l.sort((a, b) => a.s - b.s);
  // Rettungsgasse: Autos vor einem Einsatzfahrzeug mit Blaulicht machen Platz
  for (const f of fahrzeuge) { f.weicht = null; f.gasse = false; }
  for (const a of fahrzeuge) { if (!a.alarm || a.modus !== "kante") continue; const st = a.route[a.ri], pre = st.k + ":" + st.dir + ":"; for (const [key, l] of spuren) if (key.startsWith(pre)) for (const g of l) if (g !== a && !g.alarm && g.s > a.s && g.s - a.s < 4.5) { g.weicht = a; a.gasse = true; } }
  for (const f of fahrzeuge) {
    if (f.weg) continue;
    f.alter += dt;
    if (f.skala < 1 && !f.parkt) f.skala = Math.min(1, f.skala + dt * 2.5);
    if (f.parkt) { f.parkt += dt; f.v = 0; if (f.parkt > 1.2) f.skala -= dt * 2.5; if (f.skala <= 0) fahrzeugWeg(f); continue; }
    if (f.modus === "hof") {
      const h = f.hof, vZ = h.raus && h.t > 0.5 ? 0.4 : 0.55; f.v = Math.max(0.05, f.v + klemme(vZ - f.v, -2 * dt, 1.2 * dt)); f.a = 0; f.bremst = f.v < 0.2; f.blink = h.raus ? -1 : 1;
      let stop = false; if (h.raus && h.t > 0.4) for (const g of fahrzeuge) if (g !== f && g.pos && !g.parkt && Math.abs(g.pos.x - h.p2.x) < 0.6 && Math.abs(g.pos.z - h.p2.z) < 0.6 && Math.hypot(g.pos.x - h.p2.x, g.pos.z - h.p2.z) < 0.55 + g.L / 2) { stop = true; break; }
      if (stop) { f.v = 0; f.warte += dt; if (f.warte > 25) fahrzeugWeg(f); continue; } f.warte = 0;
      h.t = Math.min(1, h.t + f.v * dt / h.len);
      if (h.t >= 1) { if (h.raus) { f.modus = "kante"; f.hof = null; f.ausparken = true; } else if (f.autoId && f.zielSlot) { autoAngekommen(f); f.autoId = null; fahrzeugWeg(f); } else { f.parkt = 1.0; f.blink = 0; } }
      continue;
    }
    if (f.modus === "kante" && f.halt > 0) { f.halt -= dt; f.v = 0; f.bremst = true; f.blink = 1; if (f.halt <= 0) busWeiter(f); continue; }
    if (f.modus === "kante" && f.rueckT > 0) { f.rueckT -= dt; f.s = Math.max(0.2, f.s - 0.16 * dt); f.v = 0; f.blink = -1; continue; }   // kurz zurücksetzen beim Ausparken
    if (f.modus === "kante") {
      const st = f.route[f.ri], kk = kanten.get(st.k); if (!kk) { fahrzeugWeg(f); continue; }
      const letzte = f.ri === f.route.length - 1, e = letzte ? f.sZiel : ende(kk, st.dir), nx = f.route[f.ri + 1], rest = e - f.s;
      let vmax = TYP[kk.typ].tempo * f.faktor;
      // Fliehkraft auf kurvigen Straßen
      const kr = kantenKruemmung(kk, st.dir, f.s); if (kr > 0.02) vmax = Math.min(vmax, Math.sqrt(QUER / kr));
      // vor der Kreuzung auf Kurventempo abbremsen
      const ab = nx ? abbiegen(kk, st.dir, nx) : "gerade";
      if (nx && rest < 7) {
        if (f.kurveFuer !== f.ri) { f.kurveFuer = f.ri; const vor = uebergangGeometrie(f, kk, st, nx); f.kurveV = Math.min(TYP[kk.typ].tempo, kurvenTempo(vor.p0, vor.c, vor.p2)) * (0.9 + f.faktor * 0.1); }
        vmax = Math.min(vmax, Math.sqrt(f.kurveV * f.kurveV + 2 * 2.2 * Math.max(0, rest)));
      }
      if (letzte) vmax = Math.min(vmax, Math.sqrt(2 * 1.6 * Math.max(0, rest)) + 0.05);
      // Vordermann
      let luecke = 1e9, dv = 0, vorder = null;
      for (const sp of f.ist === f.spur ? [f.spur] : [f.spur, f.ist]) { const l = spuren.get(st.k + ":" + st.dir + ":" + sp); if (!l) continue; const i = l.indexOf(f); let j = i + 1; while (f.alarm && l[j] && l[j].weicht === f) j++; const v = l[j]; if (v) { const lu = v.s - f.s - (v.hintenL + f.vorneL); if (lu < luecke) { luecke = lu; dv = f.v - v.v; vorder = v; } } }
      // Spurwechsel und Ausparken nur, wenn auf der Zielspur Platz ist
      const SP = TYP[kk.typ].spuren; let spurZiel = null;
      if (f.weicht && !f.alarm) vmax = Math.min(vmax, SP.length >= 2 ? 0.6 : (f.s - f.weicht.s < 2.8 ? 0.02 : 0.5));
      if (f.ausparken) { if (!spurFrei(spuren, st, f.ist, f) && Math.abs(f.off - SP[f.ist]) > 0.12) { spurZiel = f.off; vmax = 0; } else spurZiel = SP[f.ist]; }
      else if (f.ist !== f.spur) { const schritt = f.ist + Math.sign(f.spur - f.ist), wechselt = Math.abs(f.off - SP[f.ist]) > 0.08; if (!wechselt && !spurFrei(spuren, st, schritt, f)) { spurZiel = SP[f.ist]; vmax *= 0.8; } else spurZiel = SP[schritt]; }
      if (nx && !f.frei) { if (rest < 0.9 && darfEinfahren(f, kk, st, nx)) { f.frei = true; const n = endKnoten(kk, st.dir); f.von = kk.id; f.trT = 0; f.reserviert = n.id; n.drin.add(f); } if (!f.frei && rest - f.vorneL - 0.05 < luecke) { luecke = rest - f.vorneL - 0.05; dv = f.v; } }
      if (spieler.an) { const p = spurPunkt(kk, st.dir, f.s, f.off), dx = spieler.x - p.x, dz = spieler.z - p.z, vorne = dx * p.tx + dz * p.tz, seit = Math.abs(-dx * p.tz + dz * p.tx); if (vorne > 0 && vorne < 2.4 && seit < 0.4 && vorne - 0.6 < luecke) { luecke = vorne - 0.6; dv = f.v; } }
      if (f.block != null && f.block < luecke) { luecke = f.block; dv = f.v; }
      const ues = uebergangNachKante.get(kk.id); if (ues) for (const u of ues) { if (!u.zu && u.w > 0.6) continue; const sc = st.dir > 0 ? u.S : kk.len - u.S, g2 = sc - f.s - f.vorneL - 0.32; if (g2 > -0.05 && g2 < luecke) { luecke = Math.max(0, g2); dv = f.v; } }
      if (f.ausparken && Math.abs(f.off - spurAbstand(kk.typ, f.spur)) > 0.08) vmax = Math.min(vmax, 0.9);
      // Fahren wie echte Fahrer (Abstandsregel): sanft anfahren, früh und weich bremsen, Abstand halten
      const vm = Math.max(0.05, vmax), bq = f.brems * 0.45, sStern = 0.1 + Math.max(0, f.v * f.zeitluecke + f.v * dv / (2 * Math.sqrt(f.beschl * bq)));
      let a = f.beschl * (1 - Math.pow(Math.min(1.6, f.v / vm), 4)) - f.beschl * Math.pow(sStern / Math.max(0.01, luecke), 2);
      a = Math.max(luecke < 0.04 ? -f.brems * 3 : -f.brems * 1.6, Math.min(a, f.beschl));
      f.v = Math.max(0, f.v + a * dt); if (luecke < 0.02) f.v = 0; f.a = a; f.bremst = a < -0.5 || f.v < 0.05;
      f.s += f.v * dt; f.warte = f.v < 0.1 ? f.warte + dt : 0;
      if (vorder) f.s = Math.max(f.s - f.v * dt, Math.min(f.s, vorder.s - vorder.hintenL - f.vorneL - 0.02));   // nie in den Vordermann
      // Spurwechsel als weiche S-Kurve (gedämpfte Feder)
      let zielOff = spurZiel != null ? spurZiel : spurAbstand(kk.typ, f.spur);
      if (letzte && rest < 2.4 && f.sZiel < kk.len - 0.5) zielOff = TYP[kk.typ].fahr + 0.02;   // zum Parken an den Rand
      if (f.weicht && !f.alarm) zielOff = SP.length >= 2 ? (f.ist === 0 ? SP[0] - 0.13 : SP[SP.length - 1] + 0.1) : TYP[kk.typ].fahr - 0.03;
      else if (f.alarm && f.gasse) zielOff = SP.length >= 2 ? (SP[0] + SP[SP.length - 1]) / 2 : SP[0] - 0.07;
      const fe = 9, da = 2 * Math.sqrt(fe);
      f.offV += (fe * (zielOff - f.off) - da * f.offV) * dt; f.offV = klemme(f.offV, -0.6, 0.6); f.off += f.offV * dt;
      if (f.ausparken && Math.abs(f.off - zielOff) < 0.04) f.ausparken = false;
      f.blink = f.weicht && !f.alarm ? 2 : f.ausparken ? -1 : f.ist !== f.spur ? (f.spur < f.ist ? -1 : 1) : nx && (ab === "links" || ab === "rechts") && rest < 4.5 ? (ab === "links" ? -1 : 1) : letzte && rest < 3 ? 1 : 0;
      if (f.s >= e) {
        if (letzte && f.linie) { f.s = e; f.v = 0; f.halt = haltestelleBedienen(f); continue; }
        if (letzte) { f.s = e; f.parkt = 0.001; f.blink = 0; if (f.beiAnkunft) { const cb = f.beiAnkunft; f.beiAnkunft = null; cb(f); } if (f.autoId && !f.nachP) { autoHeimholen(f.autoId); f.autoId = null; }
          const nh = f.nachHaus, zielP = f.nachP || (nh && haeuser.has(nh.id) && nh.teile && nh.teile.park ? hausPunkt(nh, nh.teile.park) : null); if (zielP) { const p0 = spurPunkt(kk, st.dir, f.s, f.off), c = spurPunkt(kk, st.dir, Math.min(kk.len, f.s + 0.35), TYP[kk.typ].fahr + 0.02); f.hof = hofKurve(p0, c, zielP); f.hof.raus = false; f.modus = "hof"; f.parkt = 0; f.v = Math.max(0.2, Math.min(f.v, 0.5)); }
          continue; }
        if (f.frei) { uebergangStarten(f, kk, st, nx); f.frei = false; } else f.s = e;
      }
      if (f.warte > 40) fahrzeugWeg(f);
    } else {
      const tr = f.tr; let vZiel = tr.vKurve * f.faktor;
      if (f.block != null) vZiel = Math.min(vZiel, f.block < 0.03 ? 0 : Math.sqrt(2 * f.brems * 0.5 * f.block));
      const n = knoten.get(tr.knoten);
      for (const g of n ? n.drin : []) if (g !== f && g.tr && g.tr.t > tr.t && g.route[g.ri + 1] && f.route[f.ri + 1] && g.route[g.ri + 1].k === f.route[f.ri + 1].k) { const pg = bez(g.tr.p0, g.tr.c, g.tr.p2, g.tr.t), pf = bez(tr.p0, tr.c, tr.p2, tr.t); if (abst(pg, pf) < (g.L + f.L) / 2 + 0.15) vZiel = 0; }
      const a = klemme((vZiel - f.v) / dt, -f.brems, f.beschl); f.v = Math.max(0, f.v + a * dt); f.a = a; f.bremst = a < -0.6;
      tr.t = Math.min(1, tr.t + f.v * dt / tr.len); f.trT = tr.t;
      if (tr.t >= 1) { if (n) n.drin.delete(f); f.reserviert = null; f.ri++; f.s = tr.s2; f.spur = tr.spurNeu; f.off = tr.off2; f.offV = 0; f.modus = "kante"; f.tr = null; }
    }
  }
  fahrzeuge = fahrzeuge.filter((f) => !f.weg);
  if (folgen && folgen.weg) folgenEnde("🏁 Angekommen: " + folgen.nachText);
}
function fahrzeugPose(f) {
  let x, z, tx, tz;
  if (f.modus === "hof") { const h = f.hof; if (!h) return f.pos || null; const t = h.t, p = bez(h.p0, h.c, h.p2, t), q = bez(h.p0, h.c, h.p2, Math.min(1, t + 0.05)), r = bez(h.p0, h.c, h.p2, Math.max(0, t - 0.05)); let dx = q.x - r.x, dz = q.z - r.z; const l = Math.hypot(dx, dz) || 1; return { x: p.x, z: p.z, tx: dx / l, tz: dz / l, y: 0 }; }
  if (f.modus === "kante") { const kk = kanten.get(f.route[f.ri].k); if (!kk) return null; const p = spurPunkt(kk, f.route[f.ri].dir, f.s, f.off); x = p.x; z = p.z; tx = p.tx; tz = p.tz;
    if (f.v > 0.05) { const q = f.offV / Math.max(f.v, 0.4); const hx = tx - tz * q, hz = tz + tx * q, l = Math.hypot(hx, hz); tx = hx / l; tz = hz / l; } }
  else { const tr = f.tr, t = tr.t, p = bez(tr.p0, tr.c, tr.p2, t), q = bez(tr.p0, tr.c, tr.p2, Math.min(1, t + 0.04)), r = bez(tr.p0, tr.c, tr.p2, Math.max(0, t - 0.04)); x = p.x; z = p.z; tx = q.x - r.x; tz = q.z - r.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; }
  let y = 0; if (f.modus === "kante") { const kk = kanten.get(f.route[f.ri].k); if (kk && kk.ebene) y = ebeneY(kk, f.route[f.ri].dir > 0 ? f.s : kk.len - f.s); }
  return { x, z, tx, tz, y };
}
let letzterZeichenTakt = 0;
function fahrzeugeZeichnen() {
  const dtz = Math.min(0.1, jetztS - letzterZeichenTakt) * (tempo || 0); letzterZeichenTakt = jetztS;
  let ti = 0, li = 0, ri2 = 0; const nacht = U.uNacht.value, blinkAn = (jetztS * 2.2) % 1 < 0.5;
  const scheinwerfer = new THREE.Color(1, 0.95, 0.8).multiplyScalar(0.3 + 0.9 * nacht), rueck = new THREE.Color(0.9, 0.08, 0.06), rueckSchwach = rueck.clone().multiplyScalar(0.3 + 0.4 * nacht), orange = new THREE.Color(1, 0.55, 0.05);
  const teil = (t, f, mat) => { _l.compose(_v.set(t[0], t[1], 0), _q0, _s.set(t[2], t[3], t[4])); fzTeile.setMatrixAt(ti, _l.premultiply(mat)); fzTeile.setColorAt(ti, _farbe.setHex(t[5] === "f" ? f.farbe : t[5] === "g" ? GLAS : t[5] === "c" ? f.anhFarbe : t[5])); ti++; };
  const rad = (x, z, r, lenk, mat) => { _e.set(0, lenk, 0, "YZX"); _q2.setFromEuler(_e); _l.compose(_v.set(x, r, z), _q2, _s.set(r, r, 1)); fzRaeder.setMatrixAt(ri2++, _l.premultiply(mat)); };
  const anzahl = {}; for (const k in FZ) anzahl[k] = 0;
  const blau1 = new THREE.Color(0.25, 0.45, 1).multiplyScalar(1.4), aus = new THREE.Color(0.1, 0.12, 0.2), blauAn = (jetztS * 3.1) % 1 < 0.5, weiss = new THREE.Color(1, 1, 1);
  for (const f of fahrzeuge) {
    const pose = fahrzeugPose(f); if (!pose) continue;
    const kurs = Math.atan2(-pose.tz, pose.tx);
    // Lenkwinkel aus der Kursänderung, Neigung aus Querbeschleunigung, Nicken aus Bremsen
    if (f.kursAlt != null && dtz > 0) {
      let dk = Math.atan2(Math.sin(kurs - f.kursAlt), Math.cos(kurs - f.kursAlt)); const weg = Math.max(1e-3, f.v * dtz);
      f.lenk += (klemme(Math.atan(0.32 * dk / weg), -0.55, 0.55) - f.lenk) * Math.min(1, dtz * 10);
      f.roll += (klemme(-(dk / dtz) * f.v * 0.045, -0.1, 0.1) - f.roll) * Math.min(1, dtz * 6);
    }
    f.kursAlt = kurs; f.nick += (klemme(-(f.a || 0) * 0.008, -0.045, 0.035) - f.nick) * Math.min(1, dtz * 6 + 0.02);
    f.pos = pose;
    const sk = f.skala; _e.set(f.roll, kurs, f.nick, "YZX"); _q.setFromEuler(_e);
    _m.compose(_v.set(pose.x, G + 0.02 + pose.y, pose.z), _q, _s.set(sk, sk, sk));
    { const m = fzMesh[f.typ]; if (anzahl[f.typ] < m.instanceMatrix.count) { m.setMatrixAt(anzahl[f.typ], _m); m.setColorAt(anzahl[f.typ], _farbe.setHex(f.farbe)); anzahl[f.typ]++; } }
    const r = f.rad; f.achsen.forEach((ax, i) => { for (const rz of [f.B / 2 - 0.012, -f.B / 2 + 0.012]) rad(ax, rz, r, i === 0 ? f.lenk : 0, _m); });
    // Lkw-Auflieger: knickt in Kurven ab
    if (f.anh) {
      const hx = pose.x - pose.tx * 0.12, hz = pose.z - pose.tz * 0.12;
      if (f.anhWinkel == null) f.anhWinkel = kurs;
      let d = Math.atan2(Math.sin(kurs - f.anhWinkel), Math.cos(kurs - f.anhWinkel)); f.anhWinkel += Math.sin(d) * (f.v * dtz) / 0.42; d = Math.atan2(Math.sin(kurs - f.anhWinkel), Math.cos(kurs - f.anhWinkel)); if (Math.abs(d) > 1.2) f.anhWinkel = kurs - Math.sign(d) * 1.2;
      const ax = Math.cos(f.anhWinkel), az = -Math.sin(f.anhWinkel);
      _e.set(f.roll * 0.6, f.anhWinkel, f.nick * 0.5, "YZX"); _q.setFromEuler(_e);
      _m2.compose(_v.set(hx - ax * 0.35, G + 0.02 + pose.y, hz - az * 0.35), _q, _s.set(sk, sk, sk));
      for (const t of AUFLIEGER[f.anh].teile) teil(t, f, _m2);
      for (const axx of [-0.18, -0.28]) for (const rz of [0.128, -0.128]) rad(axx, rz, 0.05, 0, _m2);
      _e.set(f.roll, kurs, f.nick, "YZX"); _q.setFromEuler(_e); _m.compose(_v.set(pose.x, G + 0.02 + pose.y, pose.z), _q, _s.set(sk, sk, sk));
    }
    const L = f.lx + 0.003, Lh = -f.hintenL - 0.004, Bq = f.B * 0.33, D = FZ[f.typ];
    const licht = (lx, ly, lz, c, mat, sx) => { if (li >= fzLicht.instanceMatrix.count) return; _l.compose(_v.set(lx, ly, lz), _q0, _s.set(sx || 0.014, 0.024, 0.05)); fzLicht.setMatrixAt(li, _l.premultiply(mat)); fzLicht.setColorAt(li, c); li++; };
    const bl = (f.blink === -1 || f.blink === 2) && blinkAn, br = (f.blink === 1 || f.blink === 2) && blinkAn;
    licht(L, D.ly, -Bq, bl ? orange : scheinwerfer, _m); licht(L, D.ly, Bq, br ? orange : scheinwerfer, _m);
    const hinten = f.anh ? _m2 : _m, hx2 = f.anh ? -0.325 : Lh, hy = f.anh ? 0.1 : D.lyh, rueckFarbe = f.rueckT > 0 ? weiss : f.bremst ? rueck : rueckSchwach;
    licht(hx2, hy, -Bq, bl ? orange : rueckFarbe, hinten); licht(hx2, hy, Bq, br ? orange : rueckFarbe, hinten);
    if (D.blau && (f.alarm || !f.dienstId)) { const bx = D.blauX != null ? D.blauX : f.typ === "kranken" ? 0.1 : f.typ === "feuerwehr" ? 0.25 : -0.05; licht(bx, D.blau + 0.006, 0.035, blauAn ? blau1 : aus, _m, 0.03); licht(bx, D.blau + 0.006, -0.035, blauAn ? aus : blau1, _m, 0.03); }
  }
  fzTeile.count = ti; fzLicht.count = li; fzRaeder.count = ri2;
  for (const k in fzMesh) { const m = fzMesh[k]; m.count = anzahl[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  fzTeile.instanceMatrix.needsUpdate = fzLicht.instanceMatrix.needsUpdate = fzRaeder.instanceMatrix.needsUpdate = true;
  if (fzTeile.instanceColor) fzTeile.instanceColor.needsUpdate = true; if (fzLicht.instanceColor) fzLicht.instanceColor.needsUpdate = true;
}
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _l = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q0 = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

/* Ampeln: Mast mit Ausleger, Gehäuse mit drei Lichtern, Fußgängerampel, Haltelinie und Zebrastreifen */
const ampelMast = becken(G_BOX_UNTEN, M.flach, 4000, true), ampelLicht = becken(G_BOX, M.leuchte, 5000, false);
const markPool = becken(G_BOX, new THREE.MeshLambertMaterial({ color: 0xffffff }), 9000, false); markPool.castShadow = false;
let ampelListe = [];
function ampelnBauen() {
  ampelListe = []; let i = 0, mi = 0;
  const box = (x, y, z, rot, sx, sy, sz, c) => { if (i >= 4000) return; _o.position.set(x, y, z); _o.rotation.set(0, rot, 0); _o.scale.set(sx, sy, sz); _o.updateMatrix(); ampelMast.setMatrixAt(i, _o.matrix); ampelMast.setColorAt(i++, _farbe.setHex(c)); };
  const mark = (x, z, rot, sx, sz, c) => { if (mi >= 9000) return; _o.position.set(x, G + 0.0235, z); _o.rotation.set(0, rot, 0); _o.scale.set(sx, 0.002, sz); _o.updateMatrix(); markPool.setMatrixAt(mi, _o.matrix); markPool.setColorAt(mi++, _farbe.setHex(c == null ? 0xf2f2f2 : c)); };
  for (const n of knoten.values()) {
    if (!n.ampel) continue;
    for (const id of n.kanten) {
      const k = kanten.get(id); if (!TYP[k.typ].autos || k.ebene) continue;
      const T = TYP[k.typ], dir = k.b === n.id ? 1 : -1, e = ende(k, dir), sp = T.spuren, mitte = (sp[0] + sp[sp.length - 1]) / 2, rand = T.halb - 0.1;
      const p = spurPunkt(k, dir, Math.max(0, e - 0.12), rand), rot = Math.atan2(-p.tz, p.tx), Rx = -p.tz, Rz = p.tx;
      box(p.x, G + 0.012, p.z, rot, 0.035, 0.7, 0.035, 0x3a3f47);
      const L = rand - mitte + 0.05; box(p.x - Rx * L / 2, G + 0.68, p.z - Rz * L / 2, rot, 0.022, 0.022, L, 0x3a3f47);
      const hx = p.x - Rx * (rand - mitte), hz = p.z - Rz * (rand - mitte);
      box(hx, G + 0.5, hz, rot, 0.05, 0.17, 0.06, 0x1f2329); box(hx - p.tx * 0.03, G + 0.66, hz - p.tz * 0.03, rot, 0.02, 0.012, 0.065, 0x1f2329);
      box(p.x - Rx * 0.035, G + 0.28, p.z - Rz * 0.035, rot, 0.045, 0.13, 0.05, 0x1f2329);
      box(p.x - p.tx * 0.03, G + 0.38, p.z - p.tz * 0.03, rot + Math.PI / 2, 0.04, 0.08, 0.035, 0x1f2329);
      ampelListe.push({ n, k: k.id, haengend: { x: hx - p.tx * 0.027, z: hz - p.tz * 0.027, y: G + 0.5 }, mast: { x: p.x - Rx * 0.035 - p.tx * 0.024, z: p.z - Rz * 0.035 - p.tz * 0.024, y: G + 0.28 }, fuss: { x: p.x - p.tx * 0.03 - Rx * 0.018, z: p.z - p.tz * 0.03 - Rz * 0.018, y: G + 0.38 }, rot });
      if (stufe !== "niedrig") {
        const sh = spurPunkt(k, dir, Math.max(0, e - 0.42), mitte); mark(sh.x, sh.z, rot, 0.05, sp[sp.length - 1] - sp[0] + 0.36, 0xf2f2f2);
        for (let o = -T.fahr + 0.05; o < T.fahr - 0.02; o += 0.1) { const q = spurPunkt(k, dir, Math.max(0, e - 0.2), o); mark(q.x, q.z, rot, 0.16, 0.05); }
        if (sp.length > 1) { const q = spurPunkt(k, dir, Math.max(0, e - 0.9), sp[0]); mark(q.x, q.z, rot, 0.16, 0.02); mark(q.x - p.tx * 0.06 + Rx * 0.03, q.z - p.tz * 0.06 + Rz * 0.03, rot + 0.7, 0.06, 0.02); }
      }
    }
  }
  ampelMast.count = i; ampelMast.instanceMatrix.needsUpdate = true; if (ampelMast.instanceColor) ampelMast.instanceColor.needsUpdate = true;
  markPool.count = mi; markPool.instanceMatrix.needsUpdate = true; if (markPool.instanceColor) markPool.instanceColor.needsUpdate = true;
  schilderBauen();
}
function ampelnZeichnen() {
  const R = new THREE.Color(1, 0.12, 0.08), Y = new THREE.Color(1, 0.72, 0.05), Gn = new THREE.Color(0.15, 1, 0.35), aus = new THREE.Color(0.12, 0.12, 0.13), rA = new THREE.Color(0.25, 0.05, 0.04), yA = new THREE.Color(0.25, 0.18, 0.03), gA = new THREE.Color(0.04, 0.2, 0.08);
  let i = 0;
  const l = (q, dy, rot, c) => { if (i >= 5000) return; _o.position.set(q.x, q.y + dy, q.z); _o.rotation.set(0, rot, 0); _o.scale.set(0.012, 0.038, 0.038); _o.updateMatrix(); ampelLicht.setMatrixAt(i, _o.matrix); ampelLicht.setColorAt(i++, c); };
  for (const a of ampelListe) {
    const z = ampelZustand(a.n, a.k), r = z === "rot" || z === "rotgelb", y = z === "gelb" || z === "rotgelb", g = z === "gruen";
    for (const q of [a.haengend, a.mast]) { l(q, 0.05, a.rot, r ? R : rA); l(q, 0, a.rot, y ? Y : yA); l(q, -0.05, a.rot, g ? Gn : gA); }
    const fz = { x: a.fuss.x, y: a.fuss.y, z: a.fuss.z }; l(fz, 0.018, a.rot + Math.PI / 2, r ? aus : R); l(fz, -0.018, a.rot + Math.PI / 2, r ? Gn : aus);
  }
  ampelLicht.count = i; ampelLicht.instanceMatrix.needsUpdate = true; if (ampelLicht.instanceColor) ampelLicht.instanceColor.needsUpdate = true;
}
/* Verkehrsschilder: Vorfahrt, Vorfahrt gewähren, Stopp */
const SCHILD_GEO = { dreieck: new THREE.CylinderGeometry(0.5, 0.5, 0.06, 3).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), raute: new THREE.CylinderGeometry(0.5, 0.5, 0.06, 4).rotateX(Math.PI / 2).rotateY(Math.PI / 2), acht: new THREE.CylinderGeometry(0.5, 0.5, 0.06, 8).rotateX(Math.PI / 2).rotateZ(Math.PI / 8).rotateY(Math.PI / 2) };
const schildPool = {}; for (const k in SCHILD_GEO) schildPool[k] = becken(SCHILD_GEO[k], new THREE.MeshLambertMaterial({ color: 0xffffff }), 1500, false);
function schilderBauen() {
  const z = { dreieck: 0, raute: 0, acht: 0 }; let mi = ampelMast.count;
  const setz = (art, x, y, zz, rot, s, c) => { const P = schildPool[art]; if (z[art] >= 1500) return; _o.position.set(x, y, zz); _o.rotation.set(0, rot, 0); _o.scale.setScalar(s); _o.updateMatrix(); P.setMatrixAt(z[art], _o.matrix); P.setColorAt(z[art]++, _farbe.setHex(c)); };
  if (stufe !== "niedrig") for (const n of knoten.values()) {
    if (n.ampel) continue; const ks = [...n.kanten].map((id) => kanten.get(id)).filter((k) => k && TYP[k.typ].autos && !k.ebene && !k.aussen); if (ks.length < 3 || ks.some((k) => k.ring)) continue;
    const max = Math.max(...ks.map(rang)), min = Math.min(...ks.map(rang)); if (max === min) continue;
    for (const k of ks) {
      const T = TYP[k.typ], dir = k.b === n.id ? 1 : -1, e = ende(k, dir), p = spurPunkt(k, dir, Math.max(0, e - 0.25), T.halb - 0.06), rot = Math.atan2(-p.tz, p.tx);
      if (mi < 4000) { _o.position.set(p.x, G + 0.012, p.z); _o.rotation.set(0, 0, 0); _o.scale.set(0.018, 0.4, 0.018); _o.updateMatrix(); ampelMast.setMatrixAt(mi, _o.matrix); ampelMast.setColorAt(mi++, _farbe.setHex(0x9aa0a8)); }
      const fx = p.x - p.tx * 0.012, fz = p.z - p.tz * 0.012;
      if (rang(k) === max) { setz("raute", fx, G + 0.4, fz, rot, 0.13, 0xffffff); setz("raute", fx - p.tx * 0.004, G + 0.4, fz - p.tz * 0.004, rot, 0.085, 0xf2c14e); }
      else if (rang(k) === min && max - min >= 2) setz("acht", fx, G + 0.4, fz, rot, 0.12, 0xd9302f);
      else { setz("dreieck", fx, G + 0.4, fz, rot, 0.15, 0xd9302f); setz("dreieck", fx - p.tx * 0.004, G + 0.405, fz - p.tz * 0.004, rot, 0.095, 0xffffff); }
    }
  }
  ampelMast.count = mi; ampelMast.instanceMatrix.needsUpdate = true; if (ampelMast.instanceColor) ampelMast.instanceColor.needsUpdate = true;
  for (const k in schildPool) { const P = schildPool[k]; P.count = z[k]; P.instanceMatrix.needsUpdate = true; if (P.instanceColor) P.instanceColor.needsUpdate = true; }
}
/* Stau-Messung und Verkehrs-Ansicht */
let verkehrsAnsicht = false, stauZeit = 0;
const stauMesh = new THREE.Mesh(new THREE.BufferGeometry(), M.stau); stauMesh.renderOrder = 3; stauMesh.visible = false; szene.add(stauMesh);
function stauMessen() {
  const n = new Map(), v = new Map();
  for (const f of fahrzeuge) { if (f.modus !== "kante") continue; const id = f.route[f.ri].k; n.set(id, (n.get(id) || 0) + 1); v.set(id, (v.get(id) || 0) + f.v / TYP[kanten.get(id).typ].tempo); }
  for (const k of kanten.values()) {
    if (!TYP[k.typ].autos) continue;
    const c = n.get(k.id) || 0, dichte = c / (k.len * TYP[k.typ].spuren.length * 2) * 1.6, langsam = c ? 1 - v.get(k.id) / c : 0;
    k.stau = k.stau * 0.6 + klemme(dichte * 0.7 + langsam * dichte * 2.2, 0, 1) * 0.4;
  }
  if (verkehrsAnsicht) {
    const pos = [], col = [], c = new THREE.Color(), gruen = farbe(0x3ddc6b), gelb = farbe(0xffd23d), rot = farbe(0xff3b30);
    for (const k of kanten.values()) { if (!TYP[k.typ].autos) continue; const s = k.stau; c.copy(gruen).lerp(gelb, klemme(s * 2.5, 0, 1)).lerp(rot, klemme(s * 2.5 - 1, 0, 1)); band(pos, col, k.pts, TYP[k.typ].fahr + 0.06, G + 0.05, c); }
    stauMesh.geometry.dispose(); stauMesh.geometry = geoAus(pos, col); stauMesh.visible = true;
  } else stauMesh.visible = false;
}
/* Fußgänger */
const menschen = becken(new THREE.CapsuleGeometry(0.032, 0.075, 2, 6).translate(0, 0.075, 0), M.mensch, 120, true);
const koepfe = becken(new THREE.SphereGeometry(0.027, 8, 6).translate(0, 0.165, 0), M.mensch, 120, false);
const HAUT = [0xf6d2b8, 0xeac09a, 0xd9a47a, 0xb97d55, 0x8d5a3b, 0x5e3b26];
const KLEIDUNG = [0xe85b4a, 0x4a7fe8, 0xf2c14e, 0x4fbf7a, 0xf2f2f2, 0x9a5be8, 0x2c2f36, 0xff8a3c, 0x3fb0c9, 0x8a96a3];
let leuteListe = [];
function fussgaengerTakt(dt, einwohner) {
  const ks = [...kanten.values()].filter((k) => !k.aussen && !TYP[k.typ].ohneGehweg && !k.ebene); if (!ks.length) { menschen.count = koepfe.count = 0; return; }
  const ziel = Math.min(STUFEN[stufe].leute, Math.round(einwohner / 9 + ks.filter((k) => k.typ === "fuss").length * 2 + ks.filter((k) => k.typ === "zone").length * 6));
  leuteListe = leuteListe.filter((p) => kanten.has(p.k));
  while (leuteListe.length < ziel) { const k = wahl(rv, ks), kind = rv() < 0.12; leuteListe.push({ o: rv(), k: k.id, dir: rv() < 0.5 ? 1 : -1, s: rv() * k.len, v: (kind ? 0.38 : 0.28) + rv() * 0.2, seite: rv() < 0.5 ? 1 : -1, c: wahl(rv, KLEIDUNG), haut: wahl(rv, HAUT), g: kind ? 0.68 : 0.9 + rv() * 0.2, ph: rv() * 6, pause: 0 }); }
  if (leuteListe.length > ziel) leuteListe.length = ziel;
  const lauf = dt * tempo;
  leuteListe.forEach((p, i) => {
    let k = kanten.get(p.k);
    if (p.pause > 0) p.pause -= lauf; else { p.s += p.v * lauf; p.ph += lauf * p.v * 22; if (rv() < lauf * 0.02) p.pause = 1 + rv() * 3; }
    if (p.s > k.len) { p.s -= k.len; const nid = p.dir > 0 ? k.b : k.a, n = knoten.get(nid), w = [...n.kanten].filter((id) => id !== k.id && !kanten.get(id).aussen), nk = kanten.get(w.length ? wahl(rv, w) : k.id); p.k = nk.id; p.dir = nk.a === nid ? 1 : -1; k = nk; }
    const off = k.typ === "fuss" ? 0.17 * p.seite : TYP[k.typ].pflaster ? (0.1 + (p.o || 0.5) * 0.45) * p.seite : (TYP[k.typ].halb - 0.14) * p.seite, q = spurPunkt(k, p.dir, Math.min(p.s, k.len), off);
    const geht = p.pause <= 0 && tempo > 0, hub = geht ? Math.abs(Math.sin(p.ph)) * 0.014 : 0, wipp = geht ? Math.sin(p.ph) * 0.09 : 0;
    _o.position.set(q.x, G + 0.012 + hub + ebeneY(k, p.dir > 0 ? Math.min(p.s, k.len) : k.len - Math.min(p.s, k.len)), q.z); _o.rotation.set(wipp, Math.atan2(-q.tz, q.tx) - Math.PI / 2, 0); _o.rotation.order = "YXZ"; _o.scale.setScalar(p.g); _o.updateMatrix();
    menschen.setMatrixAt(i, _o.matrix); menschen.setColorAt(i, _farbe.setHex(p.c));
    koepfe.setMatrixAt(i, _o.matrix); koepfe.setColorAt(i, _farbe.setHex(p.haut)); _o.rotation.order = "XYZ";
  });
  let mi = leuteListe.length;
  for (const h of halte.values()) { const k = kanten.get(h.k); if (!k) continue; const o = TYP[k.typ].halb - 0.05; for (let j = 0; j < Math.min(8, Math.ceil(h.wartend / 6)) && mi < 118; j++) { const sei = j % 2 ? 1 : -1, cs = Math.cos(h.rot), sn = Math.sin(h.rot), lx = -0.18 + (j >> 1) * 0.14, lz = sei * o; _o.position.set(h.x + lx * cs + lz * sn, G + 0.012, h.z - lx * sn + lz * cs); _o.rotation.set(0, h.rot + (sei > 0 ? Math.PI : 0), 0); _o.scale.setScalar(0.95); _o.updateMatrix(); menschen.setMatrixAt(mi, _o.matrix); menschen.setColorAt(mi, _farbe.setHex(KLEIDUNG[(h.id + j) % KLEIDUNG.length])); koepfe.setMatrixAt(mi, _o.matrix); koepfe.setColorAt(mi, _farbe.setHex(HAUT[(h.id * 3 + j) % HAUT.length])); mi++; } }
  menschen.count = koepfe.count = mi; menschen.instanceMatrix.needsUpdate = koepfe.instanceMatrix.needsUpdate = true; if (menschen.instanceColor) menschen.instanceColor.needsUpdate = true; if (koepfe.instanceColor) koepfe.instanceColor.needsUpdate = true;
}

/* Laternen */
const masten = becken(G_BOX_UNTEN, M.flach, 5000, true);
const laternen = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: glanzTextur, size: 2.0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, color: 0xffd9a0 }));
laternen.frustumCulled = false; szene.add(laternen);
function laternenBauen() {
  const pos = []; let i = 0;
  for (const k of kanten.values()) {
    const T = TYP[k.typ];
    for (let s = 1.6; s < k.len - 1.0 && i < 5000; s += k.typ === "fuss" ? 4 : 5) {
      const p = punktBei(k, s), o = T.halb - 0.1, x = p.x - p.tz * o, z = p.z + p.tx * o, h = k.typ === "fuss" ? 0.55 : 0.82, ey = ebeneY(k, s);
      if (ey < -0.05) continue;
      _o.position.set(x, G + 0.012 + ey, z); _o.rotation.set(0, 0, 0); _o.scale.set(0.03, h, 0.03); _o.updateMatrix(); masten.setMatrixAt(i, _o.matrix); masten.setColorAt(i, _farbe.setHex(0x50555e)); i++;
      const arm = k.typ === "fuss" ? 0 : 0.2, rot = Math.atan2(-p.tz, p.tx), lx = x + p.tz * arm, lz = z - p.tx * arm;
      if (arm && i < 4998) { _o.position.set(x + p.tz * arm / 2, G + 0.012 + ey + h - 0.02, z - p.tx * arm / 2); _o.rotation.set(0, rot, 0); _o.scale.set(0.02, 0.02, arm); _o.updateMatrix(); masten.setMatrixAt(i, _o.matrix); masten.setColorAt(i++, _farbe.setHex(0x50555e)); }
      if (i < 4999) { _o.position.set(lx, G + 0.012 + ey + h - 0.035, lz); _o.rotation.set(0, rot, 0); _o.scale.set(arm ? 0.09 : 0.06, 0.025, arm ? 0.05 : 0.06); _o.updateMatrix(); masten.setMatrixAt(i, _o.matrix); masten.setColorAt(i++, _farbe.setHex(0xe9e4d4)); }
      pos.push(lx, G + h - 0.06 + ey, lz);
    }
  }
  masten.count = i; masten.instanceMatrix.needsUpdate = true; if (masten.instanceColor) masten.instanceColor.needsUpdate = true;
  laternen.geometry.dispose(); laternen.geometry = new THREE.BufferGeometry(); laternen.geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos.length ? pos : [0, -50, 0], 3));
}
const pfeiler = becken(G_BOX_UNTEN, new THREE.MeshStandardMaterial({ color: 0xb9b4a8, roughness: 0.9 }), 1500, true);
const tunnelMesh = becken(G_BOX_UNTEN, new THREE.MeshBasicMaterial({ color: 0x0b0d10 }), 200, false); let tunnelMund = [];
function brueckenZeichnen() {
  let i = 0; tunnelMund = [];
  const box = (x, y, z, rot, sx, sy, sz) => { if (i >= 1500) return; _o.position.set(x, y, z); _o.rotation.set(0, rot, 0); _o.scale.set(sx, sy, sz); _o.updateMatrix(); pfeiler.setColorAt(i, _farbe.setHex(0xffffff)); pfeiler.setMatrixAt(i++, _o.matrix); };
  for (const k of kanten.values()) {
    if (k.ebene > 0) for (let s = 2.5; s < k.len - 1; s += 2.6) { const p = punktBei(k, s), ey = ebeneY(k, s); if (ey < 0.3) continue; const wasser = abstand(p.x, p.z) < 0.3, y0 = wasser ? -2.5 : G; box(p.x, y0, p.z, Math.atan2(-p.tz, p.tx), 0.28, G - 0.1 + ey - y0, TYP[k.typ].halb * 1.4); }
    if (k.ebene < 0) for (const S of [0, 1]) { const s2 = S ? k.len - tunnelR(k) - 0.2 : tunnelR(k) + 0.2, p = punktBei(k, s2), rot = Math.atan2(-p.tz, p.tx), H = TYP[k.typ].halb + 0.1; for (const sei of [1, -1]) box(p.x - p.tz * H * sei, G, p.z + p.tx * H * sei, rot, 0.62, 0.42, 0.2); box(p.x, G + 0.32, p.z, rot, 0.62, 0.14, H * 2 + 0.2); tunnelMund.push({ x: p.x, z: p.z, rot, b: TYP[k.typ].fahr * 2 + 0.2 }); }
  }
  for (const k of gKanten.values()) {
    if (k.ebene > 0) for (let s = 2.5; s < k.len - 1; s += 2.6) { const p = punktBei(k, s), ey = ebeneY(k, s); if (ey < 0.3) continue; const wasser = abstand(p.x, p.z) < 0.3, y0 = wasser ? -2.5 : G; box(p.x, y0, p.z, Math.atan2(-p.tz, p.tx), 0.26, G - 0.1 + ey - y0, 0.5); }
    if (k.ebene < 0) for (const S of [0, 1]) { const s2 = S ? k.len - tunnelR(k) - 0.2 : tunnelR(k) + 0.2, p = punktBei(k, s2), rot = Math.atan2(-p.tz, p.tx), H = 0.42; for (const sei of [1, -1]) box(p.x - p.tz * H * sei, G, p.z + p.tx * H * sei, rot, 0.62, 0.48, 0.2); box(p.x, G + 0.38, p.z, rot, 0.62, 0.14, H * 2 + 0.2); tunnelMund.push({ x: p.x, z: p.z, rot, b: 0.66 }); }
  }
  for (const k of kanten.values()) for (let s = 1; s < k.len && i < 1500; s += 3) { if (k.ebene) break; const p = punktBei(k, s); if (abstand(p.x, p.z) > 0.3) continue; _o.position.set(p.x, -2.5, p.z); _o.rotation.set(0, Math.atan2(-p.tz, p.tx), 0); _o.scale.set(0.35, 2.6, TYP[k.typ].halb * 1.6); _o.updateMatrix(); pfeiler.setColorAt(i, _farbe.setHex(0xffffff)); pfeiler.setMatrixAt(i++, _o.matrix); }
  let ti = 0; for (const m of tunnelMund) { if (ti >= 200) break; _o.position.set(m.x, G + 0.005, m.z); _o.rotation.set(0, m.rot, 0); _o.scale.set(0.66, 0.32, m.b); _o.updateMatrix(); tunnelMesh.setMatrixAt(ti++, _o.matrix); } tunnelMesh.count = ti; tunnelMesh.instanceMatrix.needsUpdate = true;
  pfeiler.count = i; pfeiler.instanceMatrix.needsUpdate = true; if (pfeiler.instanceColor) pfeiler.instanceColor.needsUpdate = true;
  let gi = 0;
  for (const k of [...kanten.values(), ...gKanten.values()]) { if (!(k.ebene > 0)) continue; const hb = k.typ ? TYP[k.typ].halb : 0.42; for (let s2 = 0.25; s2 < k.len - 0.2 && gi < 5998; s2 += 0.5) { const p = punktBei(k, s2), ey = ebeneY(k, s2); if (ey < 0.05) continue; const rot = Math.atan2(-p.tz, p.tx); for (const sei of [1, -1]) { _o.position.set(p.x - p.tz * hb * sei, G + ey + 0.02, p.z + p.tx * hb * sei); _o.rotation.set(0, rot, 0); _o.scale.set(0.52, 0.07, 0.02); _o.updateMatrix(); gelaender.setMatrixAt(gi++, _o.matrix); } } }
  gelaender.count = gi; gelaender.instanceMatrix.needsUpdate = true;
}
const gelaender = becken(G_BOX_UNTEN, new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.5, metalness: 0.4 }), 6000, false);
function netzGeaendert() {
  netzVersion++; brueckenZeichnen(); if (typeof parkenZeichnen === "function") { parkenZeichnen(); moebelZeichnen(); }
  fahrzeuge.forEach((f) => { if (f.route.some((st) => !kanten.has(st.k))) fahrzeugWeg(f); }); fahrzeuge = fahrzeuge.filter((f) => !f.weg);
  for (const n of knoten.values()) n.drin = new Set([...n.drin].filter((f) => !f.weg));
  netzVerkehrVorbereiten(); laternenBauen(); alleeZeichnen(); kreiselZeichnen(); halteNeuAnkern(); uebergaengeBerechnen(); zellenNeu = true; speichernBald();
}

/* ================================================================
   Spielstände
   ================================================================ */
let platz = 1;
const platzKey = (n) => "inselstadt-v3-" + n;
function zustand() {
  const r = (v) => Math.round(v * 1000) / 1000, k = kennzahlen();
  return {
    v: 3, zonenV: 2, fortschritt: { xp: Math.round(xp), ms, maxEinw, ep, entw: [...entw], kredite, monatXp }, karte, kn: KN, gross: grossKarte ? 1 : 0, geld: Math.round(geld), besitz: [...besitz], gekauft, steuern, meilenstein, tage: Math.round(tage * 100) / 100, ids: { n: nId, k: kId, z: zId, g: gId, h: hId, d: dId, hs: haltId, l: linieId },
    meta: { einwohner: k.e, gespeichert: Date.now() },
    knoten: [...knoten.values()].map((n) => [n.id, r(n.x), r(n.z), n.manuell ? (n.ampel ? 1 : 0) : -1, n.aussen ? 1 : 0]),
    kanten: [...kanten.values()].map((k) => [k.id, k.a, k.b, r(k.c.x), r(k.c.z), k.typ, k.aussen ? 1 : 0, k.einbahn || 0, k.ebene || 0, k.ring ? 1 : 0, k.busspur ? 1 : 0, k.schienen ? 1 : 0, k.parken ? 1 : 0]), kreisel,
    zellen: [...zellen.values()].map((z) => [z.id, r(z.x), r(z.z), r(z.rot), z.zone, z.g, z.seite, z.i, z.r]),
    haeuser: [...haeuser.values()].map((h) => [h.id, h.zone, h.stufe, h.w, h.d, h.variante, h.zellen]),
    dienste: [...dienste.values()].map((d) => [d.id, d.typ, r(d.x), r(d.z), r(d.rot), d.ausbau || 0, d.gk ?? null, d.gs != null ? r(d.gs) : null]),
    gknoten: [...gKnoten.values()].map((n) => [n.id, r(n.x), r(n.z)]), gkanten: [...gKanten.values()].map((k) => [k.id, k.a, k.b, r(k.c.x), r(k.c.z), k.ebene || 0, k.aussen ? 1 : 0]), zuglinien: [...zuglinien.values()].map((L) => [L.id, L.nr, L.farbe, L.st]), dienstV: 2, budgetBereich,
    halte: [...halte.values()].map((h) => [h.id, h.k, r(h.s)]), linien: [...linien.values()].map((L) => [L.id, L.nr, L.farbe, L.halte, L.busse, L.art, L.modell || "mix", L.takt || 40]), ticketPreis,
    baeume: baeume.filter((b) => b.weg).map((b) => b.idx)
  };
}
let speicherTimer = 0, speichernAus = false, spielLaeuft = false;
function speichernBald() { if (!spielLaeuft) return; clearTimeout(speicherTimer); if (!speichernAus) speicherTimer = setTimeout(() => { if (!merke(platzKey(platz), zustand())) tipp("⚠️ Speichern hat nicht geklappt – der Speicher ist voll.", 4000); }, 900); }
function allesLeeren() {
  for (const k of kanten.values()) { szene.remove(k.mesh); k.mesh.geometry.dispose(); }
  for (const n of knoten.values()) if (n.mesh) { szene.remove(n.mesh); n.mesh.geometry.dispose(); }
  aussenKnoten = null; kreisel.length = 0; for (const k of gKanten.values()) { szene.remove(k.mesh); k.mesh.geometry.dispose(); } gKanten.clear(); gKnoten.clear(); zuege = []; zuglinien.clear(); uebergaenge = []; uebergangNachKante = new Map(); hochListe.length = 0; dienste.clear(); bahnGleiseZeichnen(); warteListe = []; halte.clear(); linien.clear(); linieBau = []; linieWahl = null; dreckMesh.count = 0; kanten.clear(); knoten.clear(); zellen.clear(); zellIndex.clear(); raster.clear(); haeuser.clear(); fahrzeuge = []; leuteListe = [];
  for (const b of baeume) if (b.weg) { b.weg = false; baumSetzen(b); }
}
function zustandRein(d) {
  geld = d.geld; besitz = new Set(d.kn ? d.besitz : d.besitz.map((t) => { const [i, j] = t.split(",").map(Number), o = (KN - 5) / 2; return (i + o) + "," + (j + o); })); gekauft = d.gekauft || 0; meilenstein = d.meilenstein || 0; tage = d.tage || 0;
  if (d.fortschritt) { const f = d.fortschritt; xp = f.xp || 0; ms = f.ms || 0; maxEinw = f.maxEinw || 0; ep = f.ep || 0; entw = new Set(f.entw || []); kredite = f.kredite || []; monatXp = f.monatXp || 0; }
  else { const st = d.meilenstein || 0; ms = Math.max(0, MS.findIndex((x) => x.stufe === st)); xp = MS[ms].xp; ep = MS.slice(1, ms + 1).reduce((a, x) => a + x.ep, 0); maxEinw = (d.haeuser || []).length * 10; }
  if (d.steuern) steuern = d.steuern.w != null ? Object.assign({ w: 9, g: 9, b: 9, i: 9 }, d.steuern) : { w: d.steuern[1] || 9, g: d.steuern[2] || 9, b: 9, i: d.steuern[3] || 9 };
  if (!d.zonenV) {
    // alte Spielstände: 3 Zonen → neue Zonen wie bei Cities: Skylines
    const um = { 1: 1, 2: 3, 3: 6 }, zz = new Map();
    d.haeuser = d.haeuser.map(([id, zone, stufe, w, dd, variante, ids]) => { let nz = um[zone] || 1, ns = stufe; if (zone === 1 && stufe >= 3) nz = 2; if (zone === 2 && stufe >= 3) { nz = 4; ns = 2; } ns = Math.min(ns, ZONEN[nz].max); ids.forEach((c) => zz.set(c, nz)); return [id, nz, ns, w, dd, variante, ids]; });
    d.zellen = d.zellen.map((c) => { const n = c.slice(); n[4] = zz.get(c[0]) || um[c[4]] || 0; return n; });
  }
  d.knoten.forEach(([id, x, z, am, au]) => { const n = neuerKnoten({ x, z }, id); if (am != null && am >= 0) { n.manuell = true; n.ampel = am === 1; } if (au) { n.aussen = true; aussenKnoten = id; } });
  d.kanten.forEach(([id, a, b, cx, cz, typ, au, eb, ebe, ri, bs, sch, pa]) => { if (knoten.has(a) && knoten.has(b)) neueKante(a, b, { x: cx, z: cz }, TYP[typ] ? typ : "klein", id, { aussen: !!au, einbahn: eb || 0, ebene: ebe || 0, ring: !!ri, busspur: !!bs, schienen: !!sch, parken: !!pa }); });
  kreisel.length = 0; (d.kreisel || []).forEach((q) => kreisel.push(q));
  for (const k of kanten.values()) if (k.ring) { let bi = 0, bd = 1e9; kreisel.forEach((q, i) => { const e = Math.hypot(k.c.x - q.x, k.c.z - q.z); if (e < bd) { bd = e; bi = i; } }); k.kreisel = bi; }
  for (const n of [...knoten.values()]) if (!n.kanten.size) knotenWeg(n);
  d.zellen.forEach(([id, x, z, rot, zone, g, seite, i, r]) => neueZelle({ id, x, z, rot, zone, g, seite, i, r }));
  d.haeuser.forEach(([id, zone, stufe, w, dd, variante, ids]) => { if (ids.every((z) => zellen.has(z) && !zellen.get(z).haus)) neuesHaus({ id, zone, stufe, w, d: dd, variante, zellen: ids }, true); });
  d.baeume.forEach((i) => { const b = baeume[i]; if (b) { b.weg = true; baumSetzen(b); } });
  (d.gknoten || []).forEach(([id, x, z]) => neuerGKnoten({ x, z }, id));
  (d.gkanten || []).forEach(([id, a, b, cx, cz, eb, au]) => { if (gKnoten.has(a) && gKnoten.has(b)) neueGKante(a, b, { x: cx, z: cz }, id, { ebene: eb || 0, aussen: !!au }); });
  (d.dienste || []).forEach(([id, typ, x, z, rot, aus, gk, gs]) => { if (DIENSTE[typ]) { const dd = neuerDienst({ id, typ, x, z, rot, ausbau: aus || 0 }, true); if (gk != null) { dd.gk = gk; dd.gs = gs; } } });
  (d.zuglinien || []).forEach(([id, nr, f, st]) => { zuglinien.set(id, { id, nr, farbe: f, st }); zlId = Math.max(zlId, id + 1); });
  uebergaengeBerechnen();
  if (d.budgetBereich) Object.assign(budgetBereich, d.budgetBereich); else for (const k in budgetBereich) budgetBereich[k] = 100; bahnGleiseZeichnen();
  if (d.ids.d) dId = Math.max(dId, d.ids.d);
  (d.halte || []).forEach(([id, k, s2]) => { if (kanten.has(k)) neueHalte({ id, k, s: s2 }, true); });
  if (d.ticketPreis != null) ticketPreis = d.ticketPreis;
  (d.linien || []).forEach(([id, nr, f, hs, busse, art, modell, takt]) => { const L = { id, nr, farbe: f, halte: hs.filter((x) => halte.has(x)), busse, art: art || "bus", modell: modell || "mix", takt: takt || 40 }; if (L.halte.length >= 2) linien.set(id, L); linieId = Math.max(linieId, id + 1); });
  haltId = Math.max(haltId, d.ids.hs || 1); linieId = Math.max(linieId, d.ids.l || 1); linienNeu = true;
  for (const L of linien.values()) if (L.art === "tram" && !linieErreichbar(L.halte, true)) { for (let i = 0; i < L.halte.length; i++) { const a = halte.get(L.halte[i]), b = halte.get(L.halte[(i + 1) % L.halte.length]); const w = a && b && wegSuchen(haltPunkt(a), haltPunkt(b)); if (w) for (const st of w.route) { const k = kanten.get(st.k); if (k && !k.schienen) { k.schienen = true; kanteNeuZeichnen(k); } } } }
  if (linien.size && ![...dienste.values()].some((x) => DIENSTE[x.typ].depot)) warteListe.push({ t: simZeit + 1, fn: () => infoZeigen("<b>🅿️ Neu: Depots!</b>Busse und Straßenbahnen starten jetzt im Depot.<br>Bau ein Busdepot (🚌 → Karten), sonst fahren deine Linien nicht.", 10000) });
  if (!d.dienstV && d.haeuser.length > 8) { geld += 20000; warteListe.push({ t: simZeit + 0.5, fn: () => infoZeigen("<b>🏛️ Neu: Dienste!</b>Deine Häuser brauchen jetzt Strom, Wasser, Abwasser und Müllabfuhr – sonst ziehen die Leute weg.<br>Du bekommst <b>20.000 €</b> Zuschuss, um sie zu bauen.<br><small>Unten: 🏛️ Dienste und 🌳 Parks</small>", 12000) }); }
  nId = Math.max(nId, d.ids.n); kId = Math.max(kId, d.ids.k); zId = Math.max(zId, d.ids.z); gId = Math.max(gId, d.ids.g); hId = Math.max(hId, d.ids.h);
  haeuserNeu = zellenNeu = true; netzGeaendert(); gebieteZeichnen(); werteAuffrischen(); dreckZeichnen(); bedarfBerechnen(); zeigeWerte(); datumZeigen();
}
const rueck = [];
function merkeRueck() { rueck.push(JSON.stringify(zustand())); if (rueck.length > 8) rueck.shift(); rueckKnopf(); }
function rueckgaengig() { if (!rueck.length) return; const d = JSON.parse(rueck.pop()); bauAbbrechen(); allesLeeren(); zustandRein(d); rueckKnopf(); tipp("↩️ Rückgängig gemacht", 1600); }
function rueckKnopf() { const b = $("rueck"); if (b) b.disabled = !rueck.length; }

/* ================================================================
   Tag und Nacht
   ================================================================ */
const ZEITEN = { tag: 0.42, abend: 0.735, nacht: 0.9 };
let zeitModus = lade("inselstadt-bau-zeit", "auto"), zeit = ZEITEN[zeitModus] != null ? ZEITEN[zeitModus] : 0.36, zeitZiel = null;
const F = {
  tag: { oben: farbe(0x3d97ec), unten: farbe(0xc4e7ff), sonne: farbe(0xfff1dc), hs: farbe(0xd4ecff), hb: farbe(0x6f8f5c), tief: farbe(0x1667a3), flach: farbe(0x3cc9c4) },
  abend: { oben: farbe(0x34509a), unten: farbe(0xffa86b), sonne: farbe(0xff9c55), hs: farbe(0xffc8a0), hb: farbe(0x5a4a5a), tief: farbe(0x1d4f86), flach: farbe(0x3f8fa6) },
  nacht: { oben: farbe(0x040916), unten: farbe(0x13213f), sonne: farbe(0x8fa8ff), hs: farbe(0x2c3c68), hb: farbe(0x0c121e), tief: farbe(0x061a33), flach: farbe(0x0c3346) }
};
const _c = {}; Object.keys(F.tag).forEach((k) => { _c[k] = new THREE.Color(); });
const sonnenRichtung = new THREE.Vector3(), _r = new THREE.Vector3();
function licht(z) {
  const w = (z - 0.25) * Math.PI * 2, hoehe = Math.sin(w);
  sonnenRichtung.set(Math.cos(w) * 0.85, hoehe, 0.5).normalize();
  const abend = 1 - glatt(0.04, 0.42, hoehe), nacht = glatt(0.1, -0.12, hoehe);
  for (const k in _c) _c[k].copy(F.tag[k]).lerp(F.abend[k], abend).lerp(F.nacht[k], nacht);
  U.uNacht.value = nacht; LAMPEN_MAT.color.setRGB(0.29 + nacht * 0.71, 0.27 + nacht * 0.6, 0.23 + nacht * 0.35);
  const mond = hoehe < -0.02; _r.copy(sonnenRichtung); if (mond) { _r.negate(); _r.y = Math.max(_r.y, 0.35); }
  sonne.color.copy(_c.sonne);
  sonne.intensity = mond ? 0.42 * glatt(-0.02, -0.2, hoehe) : 2.7 * glatt(-0.02, 0.18, hoehe) * (1 - abend * 0.35);
  himmelLicht.color.copy(_c.hs); himmelLicht.groundColor.copy(_c.hb); himmelLicht.intensity = 1.05 - nacht * 0.62;
  sonne.target.position.copy(steuerung.target); sonne.position.copy(steuerung.target).addScaledVector(_r.normalize(), 120);
  const hu = himmel.material.uniforms; hu.uOben.value.copy(_c.oben); hu.uUnten.value.copy(_c.unten); hu.uSonne.value.copy(sonnenRichtung); hu.uSonnenFarbe.value.copy(_c.sonne); hu.uSicht.value = glatt(-0.08, 0.05, hoehe);
  szene.fog.color.copy(_c.unten);
  const ka = spieler.an ? 10 : kameraAbstand(); szene.fog.near = 60 + ka * 0.8; szene.fog.far = 260 + ka * 2.2;
  const wu = wasserMat.uniforms; wu.uNah.value = szene.fog.near; wu.uFern.value = szene.fog.far;
  wu.uTief.value.copy(_c.tief); wu.uFlach.value.copy(_c.flach); wu.uHimmel.value.copy(_c.unten).lerp(_c.oben, 0.4); wu.uNebel.value.copy(_c.unten);
  wu.uSonne.value.copy(mond ? _r : sonnenRichtung); wu.uSonnenFarbe.value.copy(_c.sonne).multiplyScalar(mond ? 0.35 : glatt(-0.02, 0.1, hoehe));
  renderer.toneMappingExposure = 1.0 + nacht * 0.25;
  laternen.material.opacity = glatt(0.15, 0.7, nacht);
  if (leuchtturm) { const d = leuchtturm.userData; d.sm.opacity = 0.16 * glatt(0.2, 0.8, nacht); d.kopf.material.color.setScalar(0.6 + 0.6 * nacht); }
}

/* ================================================================
   Bedienung
   ================================================================ */
const boden = new THREE.Plane(new THREE.Vector3(0, 1, 0), -G), strahl = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _treffer = new THREE.Vector3();
function ndc(e) { const r = renderer.domElement.getBoundingClientRect(); _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); return _ndc; }
function bodenPunkt(e) { strahl.setFromCamera(ndc(e), kamera); return strahl.ray.intersectPlane(boden, _treffer) ? { x: _treffer.x, z: _treffer.z } : null; }
let tippTimer = 0;
function tippEinmal(key, t, ms) { const k = "inselstadt-gesehen-" + key; if (lade(k, false)) return; merke(k, true); tipp(t, ms); }
function tipp(t, ms) { const el = $("tipp"); el.textContent = t; el.classList.remove("weg"); clearTimeout(tippTimer); tippTimer = setTimeout(() => el.classList.add("weg"), ms || 4000); }
let infoTimer = 0;
function infoZeigen(html, ms) { const el = $("info"); el.innerHTML = html; el.hidden = false; clearTimeout(infoTimer); infoTimer = setTimeout(() => { el.hidden = true; }, ms || 5000); }

let strTyp = lade("inselstadt-strtyp", "klein"), strModus = lade("inselstadt-strmodus", "gerade"), zoneWahl = 1, pinsel = "klein";
let ebeneWahl = 0, kreiselGr = 1, parallelAn = false;
const KREISEL_R = [2.3, 3.2, 4.2, 5.5], KREISEL_NAME = ["Mini", "Klein", "Mittel", "Groß"], RASTER = 10;
if (!TYP[strTyp]) strTyp = "klein"; if (strModus === "bruecke" || strModus === "tunnel") strModus = "gerade";
if (!["gerade", "kurve", "raster", "ersetzen", "parken", "ampel", "einbahn", "kreisel", "busspur", "schienen"].includes(strModus)) strModus = "gerade";
function schienenUmschalten(p) {
  const e = naechsteKante(p, Math.max(0.9, fangRadius() * 0.6), (k) => TYP[k.typ].autos); if (!e) { tipp("Tipp genau auf eine Straße.", 1800); return; }
  const k = e.k, preis = Math.round(k.len * 120); if (!k.schienen && geld < preis) { tipp("Schienen kosten hier " + euro(preis) + ".", 2000); return; }
  merkeRueck(); k.schienen = !k.schienen; if (k.schienen) geld -= preis; else geld += preis * 0.3; kanteNeuZeichnen(k); netzGeaendert(); zeigeWerte();
  tipp(k.schienen ? "🚋 Schienen verlegt (" + euro(preis) + "). Straßenbahnen fahren nur auf Straßen mit Schienen." : "Schienen entfernt.", 2600);
}
function busspurUmschalten(p) {
  const e = naechsteKante(p, Math.max(0.9, fangRadius() * 0.6), (k) => TYP[k.typ].autos); if (!e) { tipp("Tipp genau auf eine Hauptstraße.", 1800); return; }
  if (TYP[e.k.typ].spuren.length < 2 || e.k.typ === "autobahn") { tipp("🚌 Busspuren gibt es nur auf Haupt- und großen Straßen.", 2600); return; }
  merkeRueck(); e.k.busspur = !e.k.busspur; kanteNeuZeichnen(e.k); netzGeaendert(); tipp(e.k.busspur ? "🚌 Busspur: Die rechte Spur ist nur für Busse, Taxis und Einsatzfahrzeuge." : "Busspur entfernt.", 2600);
}
const modus = () => werkzeug === "gleis" ? gleisModus : strModus, istBau = () => werkzeug === "strasse" || werkzeug === "gleis";
const zweiPunkte = () => modus() === "gerade", tippModus = () => ["ampel", "einbahn", "kreisel", "busspur", "schienen", "ersetzen", "parken", "entfernen", "zuglinie", "bahnhof"].includes(modus());
const ebeneModus = () => ebeneWahl;
const ebeneBox = () => `<div class="zeilebox" title="Höhe"><button class="chip" type="button" id="ebeneRunter" aria-label="tiefer">▼</button><span style="min-width:74px;text-align:center">${ebeneWahl > 0 ? "🌉 Brücke" : ebeneWahl < 0 ? "🚇 Tunnel" : "⬛ Boden"}</span><button class="chip" type="button" id="ebeneHoch" aria-label="höher">▲</button></div>`;
function ersetzenTippen(p) {
  const e = naechsteKante(p, Math.max(0.9, fangRadius() * 0.6), (k) => !k.aussen); if (!e) { tipp("Tipp genau auf eine Straße.", 1800); return; }
  const k = e.k, alt = TYP[k.typ], neu = TYP[strTyp]; if (k.typ === strTyp) { tipp("Das ist schon eine " + neu.name + ". Wähl unten einen anderen Straßentyp.", 2400); return; }
  if (!typFrei(strTyp)) { tipp("🔒 " + neu.name + " ist noch gesperrt.", 2000); return; }
  if (k.ring && !neu.autos) { tipp("Im Kreisverkehr müssen Autos fahren können.", 2200); return; }
  const diff = Math.round(k.len * (neu.preis - alt.preis) * (k.ebene > 0 ? 3 : k.ebene < 0 ? 4 : 1)), preis = diff > 0 ? diff : 0;
  if (preis > geld) { tipp("Das kostet " + euro(preis) + ".", 2000); return; }
  merkeRueck(); geld -= preis; if (diff < 0) geld += Math.round(-diff * 0.3);
  k.typ = strTyp; k.h = huelle(k.pts, neu.halb); if (!neu.autos) { k.busspur = false; k.schienen = false; k.parken = false; k.einbahn = 0; } if (neu.spuren.length < 2) k.busspur = false; if (strTyp === "autobahn") k.parken = false; if (neu.einbahn && !k.einbahn) k.einbahn = 1; if (!neu.einbahn && alt.einbahn) k.einbahn = 0; if (neu.busspur) k.busspur = true; if (neu.schienen) k.schienen = true; if (neu.parken) k.parken = true;
  for (const f of fahrzeuge) if (f.route.some((st) => st.k === k.id)) fahrzeugWeg(f); fahrzeuge = fahrzeuge.filter((f) => !f.weg);
  for (const z of zellenIn(k.h)) if (abstandZuLinie(z, k.pts) < neu.halb + 0.45) zelleWeg(z);
  if (neu.zellen) zellenFuer(k); kanteNeuZeichnen(k); const a = knoten.get(k.a), b = knoten.get(k.b); if (a) knotenNeuZeichnen(a); if (b) knotenNeuZeichnen(b);
  netzGeaendert(); zeigeWerte(); tipp("🔁 Ersetzt durch " + neu.em + " " + neu.name + (preis ? " (" + euro(preis) + ")" : diff < 0 ? " (+" + euro(Math.round(-diff * 0.3)) + " zurück)" : ""), 2400);
}
function parkenTippen(p) {
  const e = naechsteKante(p, Math.max(0.9, fangRadius() * 0.6), (k) => TYP[k.typ].autos); if (!e) { tipp("Tipp genau auf eine Straße.", 1800); return; }
  const k = e.k; if (k.typ === "autobahn" || k.ring || k.ebene || k.aussen) { tipp("Hier kann man nicht parken.", 2000); return; }
  const preis = Math.round(k.len * 10); if (!k.parken && geld < preis) { tipp("Parkstreifen kosten hier " + euro(preis) + ".", 2000); return; }
  merkeRueck(); k.parken = !k.parken; if (k.parken) geld -= preis; parkenZeichnen(); zeigeWerte(); speichernBald(); werteAuffrischen();
  tipp(k.parken ? "🅿️ Parkstreifen angelegt – Läden an dieser Straße bekommen mehr Kunden." : "Parkstreifen entfernt.", 2400);
}
const parkAuto = becken(G_BOX_UNTEN, new THREE.MeshLambertMaterial({ color: 0xffffff }), 2500, true), parkDach = becken(G_BOX_UNTEN, new THREE.MeshLambertMaterial({ color: 0x2b3440 }), 2500, false);
const moebel = becken(G_BOX_UNTEN, new THREE.MeshLambertMaterial({ color: 0xffffff }), 6000, false);
function moebelZeichnen() {
  let i = 0; const setz = (x, y, z, rot, sx, sy, sz, c) => { if (i >= 6000) return; _o.position.set(x, y, z); _o.rotation.set(0, rot, 0); _o.scale.set(sx, sy, sz); _o.updateMatrix(); moebel.setMatrixAt(i, _o.matrix); moebel.setColorAt(i++, _farbe.setHex(c)); };
  if (stufe !== "niedrig") for (const k of kanten.values()) {
    const T = TYP[k.typ]; if (!T.zellen || k.aussen || k.ebene || k.ring || k.typ === "fuss") continue; const r = zufall(k.id * 977 + 3), zone = T.pflaster;
    for (let s = 2.2; s < k.len - 2.2; s += zone ? 2.2 : 4.2) for (const sei of zone ? [1, -1] : [r() < 0.5 ? 1 : -1]) {
      const p = punktBei(k, s), off = (zone ? T.halb - 0.16 : T.halb - 0.07) * sei, x = p.x - p.tz * off, z = p.z + p.tx * off, rot = Math.atan2(-p.tz, p.tx), w = r();
      if (w < 0.4 || zone) { setz(x, G, z, rot, 0.2, 0.045, 0.055, 0x8b5a2b); setz(x - p.tz * 0.03 * sei, G + 0.045, z + p.tx * 0.03 * sei, rot, 0.2, 0.05, 0.012, 0x8b5a2b); if (zone) { const x2 = x + p.tx * 0.6, z2 = z + p.tz * 0.6; setz(x2, G, z2, rot, 0.16, 0.08, 0.16, 0x9a9a92); setz(x2, G + 0.08, z2, rot, 0.13, 0.02, 0.13, 0x5a8a3a); } }
      else if (w < 0.75) setz(x, G, z, rot, 0.05, 0.08, 0.05, 0x2f5a3a);
      else if (w < 0.85) setz(x, G, z, rot, 0.035, 0.07, 0.035, 0xd9302f);
      else for (let q = 0; q < 3; q++) setz(x + p.tx * (q - 1) * 0.06, G, z + p.tz * (q - 1) * 0.06, rot + Math.PI / 2, 0.012, 0.055, 0.1, 0x6d737a);
    }
  }
  moebel.count = i; moebel.instanceMatrix.needsUpdate = true; if (moebel.instanceColor) moebel.instanceColor.needsUpdate = true;
}
function parkenZeichnen() {
  for (const k of kanten.values()) {
    if (!k.parken) { if (k.slots) { for (const q of k.slots) if (q.auto) { const a = q.auto; q.auto = null; a.wo = null; if (a.heim != null) autoHeimholen(a.id); else autos.delete(a.id); } k.slots = null; } continue; }
    if (k.slots && k.slotsLen === k.len) continue;
    const alt = k.slots || [], T = TYP[k.typ], r = zufall(k.id * 31 + 7), neu = [];
    for (const sei of [1, -1]) for (let s2 = 1.0; s2 < k.len - 1.0; s2 += 0.6) { const p = punktBei(k, s2), off = (T.fahr + 0.06) * sei; neu.push({ kante: true, k: k.id, s: s2, x: p.x - p.tz * off, z: p.z + p.tx * off, rot: Math.atan2(-p.tz, p.tx) + (sei < 0 ? Math.PI : 0), ly: ebeneY(k, s2), auto: null, res: null }); }
    for (const q of neu) { const o = alt.find((x) => x.auto && Math.abs(x.s - q.s) < 0.3 && Math.sign(x.rot - q.rot) === Math.sign(0)); if (o) { q.auto = o.auto; q.auto.wo = q; } else if (!alt.length && r() < 0.35) { const a = { id: autoId++, typ: wahl(r, PARK_TYPEN), farbe: wahl(r, PAL.auto), heim: null, wo: q, bis: Infinity }; q.auto = a; autos.set(a.id, a); } }
    k.slots = neu; k.slotsLen = k.len;
  }
  parkNeu = true; parkAuto.count = parkDach.count = 0;
}
const ZONEN_TEXT = {
  1: "Einfamilienhäuser und Villen – wird bei hohem Bodenwert immer schöner (5 Stufen).",
  2: "Mehrfamilienhäuser bis Wolkenkratzer – viele Einwohner auf wenig Platz.",
  3: "Kioske, Cafés, Bäckereien – kleine Läden für die Nachbarschaft.",
  4: "Supermärkte, Kaufhäuser, Hotels – braucht viele Kunden.",
  5: "Bürohäuser und Glastürme – Arbeitsplätze ganz ohne Dreck.",
  6: "Fabriken und Lagerhallen – viele Jobs, aber Dreck senkt den Bodenwert.",
  7: "Felder, Bauernhöfe und Gewächshäuser – Lkw bringen Getreide in die Stadt.",
  8: "Sägewerke und Holzlager – Lkw fahren Holz zu den Läden."
};
const TIPPS = {
  ansehen: "👆 Ein Finger: verschieben · ✌️ Zwei Finger: drehen & zoomen · Haus antippen: Infos",
  strasse: () => strModus === "raster" ? "▦ Raster: 1. Ecke antippen · 2. Länge und Richtung · 3. Tiefe. Dann ✓ – ein ganzes Straßennetz auf einmal." : strModus === "ersetzen" ? "🔁 Wähl unten den neuen Straßentyp und tipp eine Straße an – sie wird umgebaut." : strModus === "parken" ? "🅿️ Tipp auf eine Straße, um Parkstreifen anzulegen (10 €/Feld)." : strModus === "schienen" ? "🚋 Tipp auf eine Straße, um Straßenbahn-Schienen zu verlegen (120 €/Feld)." : strModus === "busspur" ? "🚌 Tipp auf eine Hauptstraße, um eine Busspur ein- oder auszuschalten." : strModus === "ampel" ? "🚦 Tipp auf eine Kreuzung, um die Ampel ein- oder auszuschalten." : strModus === "einbahn" ? "➡️ Tipp auf eine Straße: Einbahnstraße in eine Richtung, nochmal tippen dreht sie um, beim dritten Mal wieder normal." : strModus === "kreisel" ? "⭕ Tipp auf eine Kreuzung mit 3 oder mehr Straßen, um einen Kreisverkehr zu bauen." : strModus === "bruecke" ? "🌉 Brücke: Anfang und Ende antippen. Sie führt über Wasser und über andere Straßen." : strModus === "tunnel" ? "🚇 Tunnel: Anfang und Ende antippen. Er führt unter allem hindurch." : strModus === "gerade" ? "🛣️ Tipp auf den Anfang, dann aufs Ende. Dann ✓ zum Bauen." : "〰️ Tipp auf den Anfang, dann den Kurvenpunkt, dann das Ende. Dann ✓.",
  gleis: () => gleisModus === "entfernen" ? "🧹 Tipp auf ein Gleis, um es abzureißen." : gleisModus === "zuglinie" ? "🚆 Tipp die Bahnhöfe der Reihe nach an. Dann ✓." : gleisModus === "bahnhof" ? "🚆 Tipp direkt neben ein Gleis. Vorne muss eine Straße sein." : gleisModus === "bruecke" ? "🌉 Gleis-Brücke: Anfang und Ende antippen." : gleisModus === "tunnel" ? "🚇 Gleis-Tunnel: Anfang und Ende antippen." : "🛤️ Tipp auf den Anfang, dann aufs Ende (" + GLEIS_PREIS + " €/Feld). Fang am besten am Bahnanschluss am Kartenrand an.",
  dienst: "🏛️ Wähl ein Gebäude und tipp neben eine Straße. Dann ✓ zum Bauen.",
  park: "🌳 Wähl einen Park und tipp neben eine Straße. Dann ✓ zum Bauen.",
  verkehr: () => busModus === "bearbeiten" ? "✏️ Tipp auf eine Haltestelle: ist sie in der Linie, fliegt sie raus – sonst kommt sie dazu." : busModus === "bau" ? "Tipp neben eine Straße, um zu bauen." : busModus === "tram" ? "🚋 Tipp die Haltestellen der Reihe nach an. Die Straßenbahn bekommt Schienen auf der Straße. Dann ✓." : busModus === "halt" ? "🚏 Tipp auf eine Straße, um eine Haltestelle zu bauen (" + HALT_PREIS + " €)." : busModus === "linie" ? "🚌 Tipp die Haltestellen der Reihe nach an. Dann ✓." : "🧹 Tipp auf eine Haltestelle, um sie zu entfernen.",
  zone: () => pinsel === "fuellen" ? "🪣 Tipp neben eine Straße – die ganze Straßenseite wird angemalt." : "🖌️ Wisch über die grauen Felder neben den Straßen, um sie anzumalen.",
  gebiet: "🗺️ Tipp auf ein Preisschild, um das Gebiet zu kaufen.",
  abriss: "🧹 Tipp auf eine Straße, um sie abzureißen. Über Häuser und Zonen wischen löscht sie."
};
/* Fach über der Werkzeugleiste: Karten mit Bild, Name und Preis (wie bei Cities: Skylines) */
const kk = (attr, wert, em, name, preis, an, zu, vb) => { const url = vb ? vorschauBild(vb) : null; return `<button class="kk${vb ? " mitbild" : ""}" type="button" ${attr}="${wert}" aria-pressed="${!!an}"${zu ? ' data-zu="1"' : ""}${vb ? ` data-info="${vb}"` : ""}>${vb ? `<img data-vb="${vb}" alt=""${url ? ` src="${url}"` : " hidden"}>` : ""}<span class="em"${url ? " hidden" : ""}>${em}</span><b>${name}</b>${preis ? `<small>${preis}</small>` : ""}</button>`; };
/* Vorschaubilder: das Spiel rendert jedes Teil selbst (Straße, Gebäude, Zone) als kleines Bild */
const vorschauBilder = new Map(), vbWarte = []; let vbTimer = 0, vbR = null, vbSzene = null, vbKamera = null;
function vorschauBild(key) { if (vorschauBilder.has(key)) return vorschauBilder.get(key); if (!vbWarte.includes(key)) vbWarte.push(key); if (!vbTimer) vbTimer = setTimeout(vbArbeiten, 60); return null; }
function vbArbeiten() {
  vbTimer = 0; const t0 = performance.now();
  while (vbWarte.length && performance.now() - t0 < 45) { const key = vbWarte.shift(); if (vorschauBilder.has(key)) continue; let url = null; try { url = vbRendern(key); } catch (e) { console.warn("Vorschau", key, e); } vorschauBilder.set(key, url); if (url) document.querySelectorAll(`img[data-vb="${key}"]`).forEach((im) => { im.src = url; im.hidden = false; const em = im.nextElementSibling; if (em && em.classList.contains("em")) em.hidden = true; }); }
  if (vbWarte.length) vbTimer = setTimeout(vbArbeiten, 30);
}
function teileGruppe(g, T) {
  const gr = {}; for (const t of T) (gr[t.b] = gr[t.b] || []).push(t);
  for (const b in gr) { const P = B[b]; if (!P) continue; const L = gr[b], m = new THREE.InstancedMesh(P.geometry, P.material, L.length); L.forEach((t, i) => { _o.position.set(t.lx, t.fest ? 0.004 : 0.02 + (t.ly || 0), t.lz); _o.rotation.set(t.rx || 0, t.ry || 0, t.rz || 0, "YXZ"); _o.scale.set(t.sx, Math.max(t.sy, 1e-3), t.sz); _o.updateMatrix(); m.setMatrixAt(i, _o.matrix); m.setColorAt(i, _farbe.setHex(t.c == null ? 0x6fae4a : t.c)); }); _o.rotation.order = "XYZ"; m.castShadow = true; g.add(m); }
  let x = 0.5, y = 0.3; for (const t of T) { x = Math.max(x, Math.abs(t.lx) + t.sx / 2, Math.abs(t.lz) + t.sz / 2); y = Math.max(y, (t.ly || 0) + t.sy); } return { r: x, h: y };
}
function vbRendern(key) {
  if (!vbR) {
    const c = document.createElement("canvas"); c.width = 176; c.height = 120;
    vbR = new THREE.WebGLRenderer({ canvas: c, antialias: true, preserveDrawingBuffer: true, alpha: true }); vbR.toneMapping = THREE.ACESFilmicToneMapping; vbR.outputColorSpace = THREE.SRGBColorSpace; vbR.shadowMap.enabled = true;
    vbSzene = new THREE.Scene(); vbSzene.add(new THREE.HemisphereLight(0xdfefff, 0x6a7a5a, 1.6)); const l = new THREE.DirectionalLight(0xfff2dc, 2.4); l.position.set(4, 7, 3); l.castShadow = true; l.shadow.mapSize.set(512, 512); const sc = l.shadow.camera; sc.left = sc.bottom = -4; sc.right = sc.top = 4; vbSzene.add(l);
    vbKamera = new THREE.PerspectiveCamera(28, 176 / 120, 0.05, 200);
  }
  const g = new THREE.Group(), [art, id] = key.split(":"); let r = 1, h = 0.4, boden = 0x86c45c;
  if (art === "str") {
    const T = TYP[id], A = { x: -2.2, z: 0 }, C = { x: 0, z: 0 }, Bp = { x: 2.2, z: 0 }, { pts, len } = abtasten(A, C, Bp);
    const k = { typ: id, pts, len, ebene: 0, einbahn: T.einbahn ? 1 : 0, busspur: !!T.busspur, schienen: !!T.schienen, parken: !!T.parken };
    const m = kantenMesh(k); m.position.y = -G; g.add(m);
    if (T.baeume) for (let s2 = -1.6; s2 <= 1.7; s2 += 1.6) for (const o of T.baeume) for (const sei of o ? [1, -1] : [1]) { const b = new THREE.Mesh(G_LAUBBAUM, M.baum); b.position.set(s2, 0.004, o * sei); b.scale.setScalar(0.85); g.add(b); }
    if (T.autos) T.spuren.slice(0, 2).forEach((o, i) => { const f = FZ[["limo", "suv", "klein"][i % 3]], car = new THREE.Mesh(f.geo, M.auto); car.position.set(i ? 0.7 : -0.4, 0.02, o); car.rotation.y = 0; g.add(car); });
    r = Math.max(0.75, T.halb + 0.2); h = 0.3;
  } else if (art === "zone") { const z = +id, T = hausTeile({ zone: z, stufe: Math.min(ZONEN[z].max, z <= 2 ? 3 : 2), variante: 7, w: 2, d: 2 }); const q = teileGruppe(g, T); r = q.r; h = q.h; boden = ZONEN[z].boden; }
  else if (art === "d") { const T = dienstTeile({ typ: id, id: 5, ausbau: 0 }); const q = teileGruppe(g, T); r = q.r; h = q.h; }
  const bo = new THREE.Mesh(new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: boden, roughness: 1 })); bo.receiveShadow = true; g.add(bo);
  vbSzene.add(g);
  const d = art === "str" ? r * 2.1 + 0.6 : Math.max(r * 2.3, h * 1.6, 1.6); vbKamera.position.set(d * 0.75, d * 0.62 + h * 0.4, d * 0.95); vbKamera.lookAt(0, h * 0.32, 0);
  vbR.render(vbSzene, vbKamera); const url = vbR.domElement.toDataURL("image/png");
  vbSzene.remove(g); bo.geometry.dispose(); bo.material.dispose(); g.traverse((o) => { if (o.isInstancedMesh) o.dispose(); if (o.isMesh && art === "str" && o.geometry !== G_LAUBBAUM && !Object.values(FZ).some((f) => f.geo === o.geometry)) o.geometry.dispose(); });
  return url;
}
/* Infokarte zu einem Teil im Baumenü */
const STR_KAT = { klein: "Klein", mittel: "Mittel", gross: "Groß", einbahn: "Einbahn", autobahn: "Autobahn & Land", fuss: "Fuß & Rad" };
const ZONEN_REITER = { w: ["Wohnen", [1, 2]], g: ["Gewerbe", [3, 4]], b: ["Büro", [5]], i: ["Industrie", [6, 7, 8]] };
const VERKEHR_REITER = { fahrzeuge: ["🚌 Depots & Bahnhof", ["busdepot", "tramdepot", "bahnhof", "hafen"]], parken: ["🅿️ Parken", ["parkplatz", "parkhaus"]] };
let strReiter = null, zoneReiter = "w", verkehrReiter = "fahrzeuge", infoTimer2 = 0;
const kmh = (t) => Math.round(t * 24 / 10) * 10;
function infoKarte(key) {
  const el = $("infokarte"); if (!el || !key) return; const [art, id] = key.split(":"); let html = "";
  const zeile = (a, b) => `<span>${a}</span><b>${b}</b>`;
  if (art === "str") { const T = TYP[id], m = MEILEN.find((x) => x.frei.includes(id)); html = `<h4>${T.em} ${T.name}</h4><p>${T.info || (T.autos ? "Straße für Autos, Busse und Lkw." : "Nur für Fußgänger.")}</p><div class="iz">${T.autos ? zeile("Spuren", T.einbahn ? T.spuren.length + " in eine Richtung" : T.spuren.length + " pro Richtung") + zeile("Tempo", kmh(T.tempo) + " km/h") : ""}${zeile("Preis", T.preis + " € pro Feld")}${zeile("Häuser am Rand", T.zellen ? "ja" : "nein")}${m ? zeile("Frei ab", m.name) : ""}</div>`; }
  else if (art === "zone") { const Z = ZONEN[+id]; html = `<h4>${Z.em} ${Z.name}</h4><p>${ZONEN_TEXT[+id] || ""}</p><div class="iz">${zeile("Stufen", Z.max)}${Z.ab ? zeile("Frei ab", MEILEN[Z.ab].name) : ""}</div>`; }
  else if (art === "d") { const D = DIENSTE[id], lst = ["strom", "wasser", "abwasser", "muell"].filter((r) => D[r]).map((r) => zeile(RESSOURCEN[r].em + " " + RESSOURCEN[r].name, zahl(D[r]))).join(""); html = `<h4>${D.em} ${D.name}</h4><p>${D.text || ""}</p><div class="iz">${zeile("Preis", euro(D.preis))}${zeile("Unterhalt", euro(D.unterhalt) + " pro Woche")}${lst}${D.kap ? zeile("Kapazität", zahl(D.kap)) : ""}${D.radius ? zeile("Reichweite", Math.round(D.radius * 8) + " m") : ""}${zeile("Größe", D.w + " × " + D.d + " Felder")}${D.ab ? zeile("Frei ab", MEILEN[D.ab].name) : ""}</div>`; }
  el.innerHTML = html; el.hidden = !html; clearTimeout(infoTimer2); if (matchMedia("(pointer:coarse)").matches) infoTimer2 = setTimeout(() => { el.hidden = true; }, 4500);
}
const chip = (attr, wert, txt, an) => `<button class="chip" type="button" ${attr}="${wert}" aria-pressed="${!!an}">${txt}</button>`;
const rueckChip = '<button class="chip" type="button" id="rueck">↩️ Rückgängig</button>';
let fachZu = false;
function unterleiste() {
  const u = $("fach"); let kopf = "", karten = "", reiter = "";
  if (werkzeug === "ansehen") {
    kopf = '<span class="ftitel">👆 Ansehen</span><small style="color:var(--leise)">Haus oder Auto antippen für Infos</small>';
    karten = kk("id", "fahrenKnopf", "🚗", "Selbst fahren", "", false) + kk("id", "budgetKarte", "💶", "Budget &amp; Steuern", "", false) + kk("id", "ansichtKarte", "🔍", "Info-Ansichten", "", false) + kk("id", "fortschrittKarte", "📈", "Fortschritt", ep ? ep + " ⭐" : "", false);
  } else if (werkzeug === "strasse") {
    kopf = '<span class="ftitel">🛣️ Straßen</span>' + chip("data-modus", "gerade", "📏 Gerade", strModus === "gerade") + chip("data-modus", "kurve", "〰️ Kurve", strModus === "kurve") + chip("data-modus", "raster", "▦ Raster", strModus === "raster") + (["gerade", "kurve"].includes(strModus) ? chip("data-parallel", "1", "⇉ Parallel", parallelAn) : "") + (["gerade", "kurve"].includes(strModus) ? ebeneBox() : "") + '<span class="trenn"></span>' + chip("data-modus", "ersetzen", "🔁 Ersetzen", strModus === "ersetzen") + chip("data-modus", "einbahn", "➡️ Einbahn", strModus === "einbahn") + chip("data-modus", "kreisel", "⭕ Kreisverkehr", strModus === "kreisel") + (strModus === "kreisel" ? KREISEL_R.map((R, i) => chip("data-kreisel", i, KREISEL_NAME[i], kreiselGr === i)).join("") : "") + chip("data-modus", "parken", "🅿️ Parkstreifen", strModus === "parken") + chip("data-modus", "busspur", "🚌 Busspur", strModus === "busspur") + chip("data-modus", "schienen", "🚋 Schienen", strModus === "schienen") + chip("data-modus", "ampel", "🚦 Ampeln", strModus === "ampel") + '<span class="trenn"></span>' + rueckChip;
    if (!strReiter) strReiter = TYP[strTyp].kat || "klein";
    reiter = Object.keys(STR_KAT).map((k) => chip("data-sreiter", k, STR_KAT[k], strReiter === k)).join("");
    karten = Object.keys(TYP).filter((k) => (TYP[k].kat || "klein") === strReiter).map((k) => { const frei = typFrei(k), m = MEILEN.find((x) => x.frei.includes(k)); return kk("data-typ", k, TYP[k].em, TYP[k].name, frei ? TYP[k].preis + " €/Feld" : "ab " + (m ? m.name : ""), k === strTyp, !frei, "str:" + k); }).join("");
  } else if (werkzeug === "zone") {
    kopf = '<span class="ftitel">🏘️ Zonen</span>' + chip("data-pinsel", "klein", "🖌️ Klein", pinsel === "klein") + chip("data-pinsel", "gross", "🖌️ Groß", pinsel === "gross") + chip("data-pinsel", "fuellen", "🪣 Füllen", pinsel === "fuellen") + '<span class="trenn"></span>' + rueckChip;
    reiter = Object.keys(ZONEN_REITER).map((k) => chip("data-zreiter", k, ZONEN_REITER[k][0], zoneReiter === k)).join("");
    karten = ZONEN_REITER[zoneReiter][1].map((z) => { const f = zoneFrei(z), Z = ZONEN[z]; return kk("data-zone", z, Z.em, Z.name, f ? GRUPPEN[Z.gruppe].name : "ab " + MEILEN[Z.ab].name, z === zoneWahl, !f, "zone:" + z); }).join("") + kk("data-zone", 0, "🧽", "Zone entfernen", "", zoneWahl === 0);
  } else if (werkzeug === "dienst" || werkzeug === "park") {
    if (werkzeug === "dienst") reiter = Object.keys(DIENST_KAT).filter((k) => !PARK_KATS.includes(k) && k !== "verkehr").map((k) => chip("data-dkat", k, DIENST_KAT[k].em + " " + DIENST_KAT[k].name, dienstKat === k)).join("");
    else reiter = PARK_KATS.map((k) => chip("data-dkat", k, DIENST_KAT[k].em + " " + DIENST_KAT[k].name, dienstKat === k)).join("");
    karten = Object.keys(DIENSTE).filter((k) => DIENSTE[k].kat === dienstKat).map((k) => { const D = DIENSTE[k], f = dienstFrei(k); return kk("data-dienst", k, D.em, D.name, f ? euro(D.preis) : "ab " + MEILEN[D.ab].name, k === dienstWahl, !f, "d:" + k); }).join("");
  } else if (werkzeug === "gleis") {
    kopf = '<span class="ftitel">🛤️ Gleise</span>' + chip("data-gmodus", "gerade", "📏 Gerade", gleisModus === "gerade") + chip("data-gmodus", "kurve", "〰️ Kurve", gleisModus === "kurve") + (["gerade", "kurve"].includes(gleisModus) ? ebeneBox() : "") + chip("data-gmodus", "entfernen", "🧹 Entfernen", gleisModus === "entfernen") + chip("data-gmodus", "zuglinie", "🚆 Neue Zuglinie", gleisModus === "zuglinie") + '<span class="trenn"></span>' + rueckChip;
    const ZL = zuglinieWahl && zuglinien.get(zuglinieWahl);
    if (ZL) kopf += `<span class="trenn"></span><span class="ftitel" style="color:#${ZL.farbe.toString(16).padStart(6, "0")}">Zuglinie ${ZL.nr}</span><span style="white-space:nowrap;color:var(--leise)">${ZL.st.length} Bahnhöfe</span><button class="chip gefahr" type="button" id="zuglinieLoeschen">🗑️</button>`;
    const D = DIENSTE.bahnhof, fr = dienstFrei("bahnhof");
    karten = kk("data-gmodus", "bahnhof", D.em, D.name, fr ? euro(D.preis) : "ab " + MEILEN[D.ab].name, gleisModus === "bahnhof", !fr) + [...zuglinien.values()].map((L) => kk("data-zlinie", L.id, `<span style="display:inline-block;width:26px;height:26px;border-radius:50%;background:#${L.farbe.toString(16).padStart(6, "0")};color:#fff;font-size:.9rem;line-height:26px;font-weight:700">${L.nr}</span>`, "Zuglinie " + L.nr, L.st.length + " Bahnhöfe", L.id === zuglinieWahl)).join("");
    karten += `<small style="color:var(--leise);padding:8px;max-width:260px">Züge kommen über den Bahnanschluss am Kartenrand. Verbinde ihn mit deinen Bahnhöfen.</small>`;
  } else if (werkzeug === "verkehr") {
    const L = linieWahl && linien.get(linieWahl);
    kopf = '<span class="ftitel">🚌 Nahverkehr</span>' + chip("data-bmodus", "halt", "🚏 Haltestelle", busModus === "halt") + chip("data-bmodus", "linie", "🚌 Neue Buslinie", busModus === "linie") + chip("data-bmodus", "tram", (meilenstein >= 3 ? "🚋" : "🔒") + " Neue Straßenbahn", busModus === "tram") + chip("data-bmodus", "weg", "🧹 Entfernen", busModus === "weg") + '<span class="trenn"></span>' + rueckChip;
    kopf += `<span class="trenn"></span><div class="zeilebox"><button class="chip" type="button" id="ticketMinus">−</button><span>🎫 ${ticketPreis.toFixed(2).replace(".", ",")} €</span><button class="chip" type="button" id="ticketPlus">+</button></div>`;
    if (L) kopf += `<span class="trenn"></span><span class="ftitel" style="color:#${L.farbe.toString(16).padStart(6, "0")}">Linie ${L.nr}</span>${L.keinDepot ? `<span style="color:#ff9b9b;white-space:nowrap">⚠️ Kein ${L.art === "tram" ? "Straßenbahn-Depot" : "Busdepot"}!</span>` : ""}<div class="zeilebox"><button class="chip" type="button" id="busMinus">−</button><span>⏱️ ${L.takt || 40} s · ${L.art === "tram" ? "🚋" : "🚌"} ${L.busse || 1}</span><button class="chip" type="button" id="busPlus">+</button></div><span style="white-space:nowrap;color:var(--leise)">👥 ${zahl(L.letzteWoche || 0)}/Wo · ${Math.round((L.auslastung || 0) * 100)} % voll</span>${chip("data-bmodus", "bearbeiten", "✏️ Bearbeiten", busModus === "bearbeiten")}${L.art !== "tram" ? `<button class="chip" type="button" id="busModell">${BUS_MODELLE[L.modell || "mix"]}</button>` : ""}<button class="chip gefahr" type="button" id="linieLoeschen">🗑️</button>`;
    reiter = Object.keys(VERKEHR_REITER).map((k) => chip("data-vreiter", k, VERKEHR_REITER[k][0], verkehrReiter === k)).join("");
    karten = VERKEHR_REITER[verkehrReiter][1].map((k) => { const D = DIENSTE[k], f = dienstFrei(k); return kk("data-dienst", k, D.em, D.name, f ? euro(D.preis) : "ab " + MEILEN[D.ab].name, busModus === "bau" && dienstWahl === k, !f, "d:" + k); }).join("") + [...linien.values()].map((x) => kk("data-linie", x.id, `<span style="display:inline-block;width:26px;height:26px;border-radius:50%;background:#${x.farbe.toString(16).padStart(6, "0")};color:#fff;font-size:.9rem;line-height:26px;font-weight:700">${x.nr}</span>`, "Linie " + x.nr, x.halte.length + " Halte · " + x.busse + " 🚌", x.id === linieWahl)).join("") || "";
    if (!linien.size) karten += `<small style="color:var(--leise);padding:8px">Noch keine Linie. 1. Haltestellen bauen · 2. „Neue Linie“ und Haltestellen antippen · ${zahl(busAbdeckung.fahrgaeste)} Fahrgäste</small>`;
  } else if (werkzeug === "gebiet") {
    const m = MEILEN[meilenstein], frei = m.gebiete - gekauft;
    kopf = '<span class="ftitel">🗺️ Gebiete</span><small style="color:var(--leise)">' + (frei > 0 ? `Du kannst noch ${frei} Gebiet${frei > 1 ? "e" : ""} kaufen · nächstes kostet ${euro(GEBIET_PREIS(gekauft))}` : "Mehr Gebiete beim nächsten Meilenstein") + "</small>";
  } else if (werkzeug === "abriss") {
    kopf = '<span class="ftitel">🧹 Abriss</span><small style="color:var(--leise)">Straße antippen · über Häuser wischen</small><span class="trenn"></span>' + rueckChip;
  }
  const o = $("optionen");
  o.innerHTML = kopf ? kopf.replace('<span class="ftitel">', '<span class="ftitel"><button class="chip" type="button" id="hilfeKnopf" style="float:right;min-height:24px;padding:0 7px;margin-left:6px">?</button>') : ""; o.hidden = !kopf || werkzeug === "ansehen";
  u.innerHTML = karten ? (reiter ? `<div class="freiter">${reiter}</div>` : "") + `<div class="fkarten">${karten}</div>` : "";
  u.hidden = fachZu || !karten; rueckKnopf();
}
$("optionen").addEventListener("click", (e) => { if (e.target.closest("#hilfeKnopf")) { const t = TIPPS[werkzeug]; tipp(typeof t === "function" ? t() : t, 6000); return; } fachKlick(e); });
$("fach").addEventListener("click", (e) => fachKlick(e));
$("fach").addEventListener("mouseover", (e) => { const b = e.target.closest("[data-info]"); if (b && !matchMedia("(pointer:coarse)").matches) infoKarte(b.dataset.info); });
$("fach").addEventListener("mouseleave", () => { const el = $("infokarte"); if (el && !matchMedia("(pointer:coarse)").matches) el.hidden = true; });
function fachKlick(e) {
  const b = e.target.closest("button"); if (!b) return;
  if (b.id === "rueck") { rueckgaengig(); return; }
  if (b.dataset.sreiter) { strReiter = b.dataset.sreiter; unterleiste(); return; }
  if (b.dataset.zreiter) { zoneReiter = b.dataset.zreiter; unterleiste(); return; }
  if (b.dataset.vreiter) { verkehrReiter = b.dataset.vreiter; unterleiste(); return; }
  if (b.dataset.info) infoKarte(b.dataset.info);
  if (b.id === "fahrenKnopf") { fahrenStarten(); return; }
  if (b.id === "budgetKarte") { budgetZeigen(); return; }
  if (b.id === "ansichtKarte") { ansichtenAufZu(); return; }
  if (b.id === "fortschrittKarte") { fortschrittZeigen(); return; }
  if (b.dataset.typ) { if (!typFrei(b.dataset.typ)) { const m = MEILEN.find((x) => x.frei.includes(b.dataset.typ)); tipp("🔒 " + TYP[b.dataset.typ].name + " gibt es ab " + (m ? m.name + " (" + zahl(m.ab) + " XP)" : "später") + ".", 3000); return; } strTyp = b.dataset.typ; merke("inselstadt-strtyp", strTyp); planNeu(); }
  if (b.id === "ebeneHoch" || b.id === "ebeneRunter") { ebeneWahl = klemme(ebeneWahl + (b.id === "ebeneHoch" ? 1 : -1), -1, 1); planNeu(); tippEinmal("ebene", "▲▼ Höhe: Brücken führen über Wasser, Straßen und Gleise. Tunnel gehen unten durch. Über Wasser baut sich die Brücke von selbst.", 4500); }
  if (b.dataset.parallel) { parallelAn = !parallelAn; planNeu(); if (parallelAn) tippEinmal("parallel", "⇉ Parallel: Es wird gleich eine zweite Straße im Abstand von " + RASTER + " Feldern mitgebaut – perfekt für Wohnblöcke.", 4000); }
  if (b.dataset.kreisel != null) { kreiselGr = +b.dataset.kreisel; tipp("⭕ " + KREISEL_NAME[kreiselGr] + "er Kreisverkehr – ca. " + euro(Math.round(2 * Math.PI * KREISEL_R[kreiselGr] * 80 + 600)) + ". Tipp auf eine Kreuzung.", 2600); }
  if (b.dataset.modus) { strModus = b.dataset.modus; merke("inselstadt-strmodus", strModus); bauAbbrechen(); tippEinmal("m-" + strModus, TIPPS.strasse(), 3500); }
  if (b.dataset.zone != null) { const z = +b.dataset.zone; if (z && !zoneFrei(z)) { tipp("🔒 " + ZONEN[z].name + " gibt es ab dem Meilenstein " + MEILEN[ZONEN[z].ab].name + " (" + zahl(MEILEN[ZONEN[z].ab].ab) + " XP).", 3500); return; } zoneWahl = z; if (z) tippEinmal("z-" + z, ZONEN[z].em + " " + ZONEN[z].name + ": " + ZONEN_TEXT[z], 4000); }
  if (b.dataset.pinsel) { pinsel = b.dataset.pinsel; tippEinmal("p-" + pinsel, TIPPS.zone(), 3500); }
  if (b.dataset.gmodus) { if (b.dataset.gmodus === "bahnhof" && !dienstFrei("bahnhof")) { tipp("🔒 Bahnhöfe gibt es ab " + MEILEN[DIENSTE.bahnhof.ab].name + ".", 2500); return; } gleisModus = b.dataset.gmodus; zuglinieBau = []; bauAbbrechen(); vorschauWeg(); if (gleisModus === "bahnhof") dienstWahl = "bahnhof"; tippEinmal("g-" + gleisModus, TIPPS.gleis(), 3500); }
  if (b.dataset.zlinie) zuglinieWahl = +b.dataset.zlinie === zuglinieWahl ? null : +b.dataset.zlinie;
  if (b.id === "zuglinieLoeschen") { const L = zuglinien.get(zuglinieWahl); if (L) { merkeRueck(); zuglinien.delete(L.id); zuege = zuege.filter((z) => z.linie !== L.id); zuglinieWahl = null; busRechnen(); speichernBald(); } }
  if (b.dataset.bmodus === "tram" && meilenstein < 3) { tipp("🔒 Straßenbahnen gibt es ab " + MEILEN[3].name + " (" + zahl(MEILEN[3].ab) + " XP).", 3000); return; }
  if (b.dataset.bmodus) { busModus = b.dataset.bmodus; vorschauWeg(); linieBau = []; frageZu(); linienNeu = true; tippEinmal("b-" + busModus, TIPPS.verkehr(), 3500); }
  if (b.dataset.linie) { linieWahl = +b.dataset.linie === linieWahl ? null : +b.dataset.linie; }
  if (b.id === "busPlus" || b.id === "busMinus") { const L = linien.get(linieWahl); if (L) { L.takt = klemme((L.takt || 40) + (b.id === "busPlus" ? -10 : 10), 10, 180); L.busse = busseFuer(L); speichernBald(); zeigeWerte(); tipp("⏱️ Linie " + L.nr + ": alle " + L.takt + " s ein Fahrzeug (" + L.busse + " unterwegs)", 2200); } }
  if (b.id === "ticketPlus" || b.id === "ticketMinus") { ticketPreis = klemme(Math.round((ticketPreis + (b.id === "ticketPlus" ? 0.25 : -0.25)) * 100) / 100, 0, 4); tipp("🎫 Ticket: " + ticketPreis.toFixed(2).replace(".", ",") + " € – " + (ticketPreis <= 1 ? "billig, mehr Fahrgäste" : ticketPreis >= 2.5 ? "teuer, weniger Fahrgäste" : "normal"), 2200); speichernBald(); }
  if (b.id === "busModell") { const L = linien.get(linieWahl); if (L) { const ks = Object.keys(BUS_MODELLE), i = ks.indexOf(L.modell || "mix"); L.modell = ks[(i + 1) % ks.length]; for (const f of fahrzeuge) if (f.linie === L.id) fahrzeugWeg(f); fahrzeuge = fahrzeuge.filter((f) => !f.weg); tipp("Linie " + L.nr + ": " + BUS_MODELLE[L.modell], 2000); speichernBald(); } }
  if (b.id === "linieLoeschen") { const L = linien.get(linieWahl); if (L) { merkeRueck(); linieWeg(L); linieWahl = null; busRechnen(); speichernBald(); } }
  if (b.dataset.dkat) { dienstKat = b.dataset.dkat; dienstWahl = Object.keys(DIENSTE).find((k) => DIENSTE[k].kat === dienstKat); vorschauWeg(); frageZu(); }
  if (b.dataset.dienst) { const k = b.dataset.dienst, D = DIENSTE[k]; if (!dienstFrei(k)) { tipp("🔒 " + D.name + " gibt es ab " + MEILEN[D.ab].name + " (" + zahl(MEILEN[D.ab].ab) + " XP).", 3500); return; } dienstWahl = k; if (werkzeug === "verkehr") busModus = "bau"; vorschauWeg(); frageZu(); tipp(D.em + " " + D.name + ": " + D.text, 3500); }
  unterleiste();
}
/* Info-Ansichten (oben rechts) */
const ANSICHTEN = {
  verkehr: { em: "🚦", name: "Verkehr", legende: ["#3ddc6b", "#ffd23d", "#ff3b30", "frei", "Stau"], an: () => { verkehrsAnsicht = true; stauMessen(); }, aus: () => { verkehrsAnsicht = false; stauMessen(); } },
  wert: { em: "💎", name: "Bodenwert", legende: ["#ff4a3d", "#ffd23d", "#2fd66b", "wenig wert", "wertvoll"], an: () => { wertAnsicht = true; werteAuffrischen(); wertZeichnen(); }, aus: () => { wertAnsicht = false; wertZeichnen(); } }
};
const ROT_GRUEN = ["#ff4a3d", "#ffd23d", "#2fd66b"];
const versorgt = (r) => (z, h) => h ? (h.verlassen ? null : (h.hat && h.hat[r]) ? 100 : 0) : null;
const deckung = (kat) => (z, h) => Math.round(Math.min(1, abdeckung(z.x, z.z, kat) * 1.4) * 100);
Object.assign(ANSICHTEN, {
  strom: { em: "⚡", name: "Strom", legende: [...ROT_GRUEN, "kein Strom", "versorgt"], wert: versorgt("strom") },
  wasser: { em: "💧", name: "Wasser", legende: [...ROT_GRUEN, "kein Wasser", "versorgt"], wert: versorgt("wasser") },
  abwasser: { em: "🚽", name: "Abwasser", legende: [...ROT_GRUEN, "fehlt", "versorgt"], wert: versorgt("abwasser") },
  muell: { em: "🗑️", name: "Müllabfuhr", legende: [...ROT_GRUEN, "fehlt", "versorgt"], wert: versorgt("muell") },
  polizei: { em: "🚓", name: "Polizei", legende: [...ROT_GRUEN, "keine", "sicher"], wert: deckung("polizei"), kat: "polizei" },
  feuer: { em: "🚒", name: "Feuerwehr", legende: [...ROT_GRUEN, "keine", "geschützt"], wert: deckung("feuer"), kat: "feuer" },
  gesund: { em: "🏥", name: "Gesundheit", legende: [...ROT_GRUEN, "keine", "gut"], wert: deckung("gesund"), kat: "gesund" },
  bildung: { em: "🎓", name: "Bildung", legende: [...ROT_GRUEN, "keine", "Uni"], wert: (z) => Math.round(abdeckung(z.x, z.z, "bildung") / 3 * 100), kat: "bildung" },
  froh: { em: "😊", name: "Zufriedenheit", legende: [...ROT_GRUEN, "unzufrieden", "glücklich"], wert: (z, h) => h && gruppe(h) === "w" ? hausFroh(h) : null },
  dreck: { em: "🟤", name: "Dreck", legende: ["#2fd66b", "#ffd23d", "#8a5a2b", "sauber", "dreckig"], wert: (z, h) => 100 - Math.min(100, dreckBei(z.x, z.z, h) * 1.5), umgekehrt: true },
  bus: { em: "🚌", name: "Nahverkehr", legende: [...ROT_GRUEN, "keine Haltestelle", "nah am Bus"], wert: (z) => { let b = 0; for (const s of halte.values()) if (s.inLinie) b = Math.max(b, 1 - Math.hypot(s.x - z.x, s.z - z.z) / HALT_RADIUS); return Math.round(b * 100); } },
  park: { em: "🌳", name: "Parks", legende: [...ROT_GRUEN, "keine", "viel Grün"], wert: deckung("park"), kat: "park" }
});
for (const k of Object.keys(ANSICHTEN)) { const A = ANSICHTEN[k]; if (A.wert) { A.an = () => { wertAnsicht = true; versorgungRechnen(); busRechnen(); listenAuffrischen(); wertZeichnen(); if (STRASSEN_DIENST.has(A.kat)) reichZeichnen(A.kat); else kreiseZeichnen(A.kat); if (k === "bus") { linienMesh.visible = true; linienNeu = true; } }; A.aus = () => { wertAnsicht = false; wertZeichnen(); kreiseZeichnen(null); reichZeichnen(null); if (k === "bus") linienMesh.visible = werkzeug === "verkehr"; }; } }
function hausFroh(h) { const a = h.abd || {}; let v = 52 + ((h.wert || 30) - 30) * 0.3 - (h.dreck || 0) * 0.5 + (a.polizei ? 5 : 0) + (a.feuer ? 5 : 0) + (a.gesund ? 5 : 0) + (h.bildung || 0) * 3 + (h.bus ? 3 : 0) + globalFroh(); if (h.problem) v -= ["krimi", "krank"].includes(h.problem) ? 4 + 4 * (h.pStufe || 0) : [0, 5, 12, 25][h.pStufe || 0]; const st = (steuern.w + steuern.g + steuern.b + steuern.i) / 4; return Math.round(klemme(v - (st - 9) * 3, 0, 100)); }
let ansicht = null;
function ansichtSetzen(n) {
  if (ansicht && ANSICHTEN[ansicht]) ANSICHTEN[ansicht].aus();
  ansicht = n && n !== ansicht ? n : null;
  if (ansicht) ANSICHTEN[ansicht].an();
  const l = $("legende"), A = ansicht && ANSICHTEN[ansicht];
  if (A && A.legende) { const [a, b2, c, t1, t2] = A.legende; l.innerHTML = `<b>${A.em} ${A.name}</b><small>${t1}</small><span class="farbband" style="background:linear-gradient(90deg,${a},${b2},${c})"></span><small>${t2}</small><button class="chip" type="button" id="legendeZu" style="min-height:30px;padding:3px 8px">✕</button>`; l.hidden = false; $("legendeZu").onclick = () => ansichtSetzen(null); } else l.hidden = true;
  $("ansichtKnopf").setAttribute("aria-pressed", String(!!ansicht)); ansichtListe();
}
function ansichtListe() { $("ansichtListe").innerHTML = Object.entries(ANSICHTEN).map(([k, A]) => chip("data-ansicht", k, A.em + " " + A.name, ansicht === k)).join(""); }
function ansichtenAufZu() { const p = $("ansichten"); p.hidden = !p.hidden; if (!p.hidden) { ansichtListe(); $("menue").hidden = true; } }
$("ansichtKnopf").onclick = ansichtenAufZu;
$("ansichten").addEventListener("click", (e) => { const b = e.target.closest("[data-ansicht]"); if (b) { ansichtSetzen(b.dataset.ansicht); } });
function werkzeugWaehlen(w) { if ($("infokarte")) $("infokarte").hidden = true;
  werkzeug = w; document.querySelectorAll("#werkzeug button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.w === w)));
  const bauend = w !== "ansehen";
  steuerung.touches.ONE = bauend ? -1 : THREE.TOUCH.PAN; steuerung.mouseButtons.LEFT = bauend ? -1 : THREE.MOUSE.PAN;
  bauAbbrechen(); frageZu(); vorschauWeg(); linieBau = []; zuglinieBau = []; if (w === "gleis") { aussenGleisBauen(); if (gleisModus === "bahnhof") dienstWahl = "bahnhof"; } linienNeu = true; linienMesh.visible = w === "verkehr" || ansicht === "bus"; $("info").hidden = true; zellenNeu = true; if (w === "park") { if (!PARK_KATS.includes(dienstKat)) dienstKat = "park"; } else if (w === "dienst" && (PARK_KATS.includes(dienstKat) || dienstKat === "verkehr")) dienstKat = "strom"; if (DIENSTE[dienstWahl].kat !== dienstKat) dienstWahl = Object.keys(DIENSTE).find((k) => DIENSTE[k].kat === dienstKat); unterleiste(); gebieteZeichnen();
  const t = TIPPS[w]; tippEinmal("w-" + w, typeof t === "function" ? t() : t, 5000);
}
$("werkzeug").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.w === werkzeug && werkzeug !== "ansehen") { fachZu = !fachZu; unterleiste(); return; } fachZu = false; werkzeugWaehlen(b.dataset.w); });
let frageJa = null;
let letzterTipp = null;
function frage(text, ok, beiJa) {
  const el = $("frage"); el.hidden = false;
  if (letzterTipp && performance.now() - letzterTipp.t < 4000) { el.classList.add("blase"); requestAnimationFrame(() => { const w = el.offsetWidth, h = el.offsetHeight; let x = letzterTipp.x - w / 2, y = letzterTipp.y - h - 46; if (y < 70) y = letzterTipp.y + 40; el.style.left = klemme(x, 8, innerWidth - w - 8) + "px"; el.style.top = klemme(y, 60, innerHeight - h - 70) + "px"; }); }
  else { el.classList.remove("blase"); el.style.left = el.style.top = ""; } $("frageText").textContent = text; $("frageText").classList.toggle("falsch", !ok); $("ja").disabled = !ok || !beiJa; frageJa = ok ? beiJa : null; }
function frageZu() { $("frage").hidden = true; frageJa = null; }
$("ja").onclick = () => { if (frageJa) frageJa(); };
$("nein").onclick = () => { frageZu(); bauAbbrechen(); vorschauWeg(); linieBau = []; zuglinieBau = []; linienNeu = true; };

/* Straßenbau per Antippen */
const bau = { punkte: [], kandidat: null, plan: null };
const vorschau = new THREE.Mesh(new THREE.BufferGeometry(), M.vorschau); vorschau.renderOrder = 3; vorschau.visible = false; szene.add(vorschau);
const markerGeo = new THREE.RingGeometry(0.55, 0.85, 28).rotateX(-Math.PI / 2);
const marker = [0, 1, 2].map(() => { const m = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false })); m.visible = false; m.renderOrder = 4; szene.add(m); return m; });
const hilfslinie = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.4, gapSize: 0.3, transparent: true, opacity: 0.7 })); hilfslinie.visible = false; szene.add(hilfslinie);
const fuehrung = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xbfe3ff, dashSize: 0.5, gapSize: 0.35, transparent: true, opacity: 0.55, depthWrite: false })); fuehrung.visible = false; fuehrung.renderOrder = 4; szene.add(fuehrung);
function bauAbbrechen() { bau.punkte = []; bau.kandidat = null; bau.plan = null; bau.plan2 = null; vorschau.visible = false; marker.forEach((m) => { m.visible = false; }); hilfslinie.visible = fuehrung.visible = false; if (istBau()) frageZu(); }
const rasterAbst = () => Math.round((2 * (TYP[strTyp].halb + REIHEN * ZELLE) + 0.4) * 2) / 2;
function refRichtungen(start) {
  const r = [];
  if (start.art === "knoten") { const n = knoten.get(start.id); if (n) for (const id of n.kanten) { const k = kanten.get(id), q = k.a === n.id ? k.pts[Math.min(2, k.pts.length - 1)] : k.pts[Math.max(0, k.pts.length - 3)]; r.push(Math.atan2(q.z - n.z, q.x - n.x)); } }
  if (start.art === "kante") { const k = kanten.get(start.id); if (k) { const e = abstandZuLinie(start, k.pts, true), q = punktBei(k, e.s); r.push(Math.atan2(q.tz, q.tx)); } }
  return r;
}
function fuehrungZeigen(A, B) {
  const refs = refRichtungen(A); if (!refs.length || !B) { fuehrung.visible = false; return ""; }
  const pts = [], L = 14; for (const a of [refs[0], refs[0] + Math.PI / 2]) pts.push(new THREE.Vector3(A.x - Math.cos(a) * L, G + 0.08, A.z - Math.sin(a) * L), new THREE.Vector3(A.x + Math.cos(a) * L, G + 0.08, A.z + Math.sin(a) * L));
  fuehrung.geometry.dispose(); fuehrung.geometry = new THREE.BufferGeometry().setFromPoints(pts); fuehrung.computeLineDistances(); fuehrung.visible = true;
  const a = Math.atan2(B.z - A.z, B.x - A.x); let best = 999;
  for (const r of refs) { let d = Math.abs(Math.atan2(Math.sin(a - r), Math.cos(a - r))) * 180 / Math.PI; if (A.art === "kante") d = Math.min(d, 180 - d); if (d < best) best = d; }
  return " · ∠ " + Math.round(best) + "°";
}
function rasterLinien(A, B, C) {
  const ux = B.x - A.x, uz = B.z - A.z, L = Math.hypot(ux, uz); if (L < 2) return [];
  const ex = ux / L, ez = uz / L, nx = -ez, nz = ex, st = rasterAbst(), n = Math.max(1, Math.round(L / st)), sp = L / n;
  if (!C) return [[A, B]];
  const d = (C.x - A.x) * nx + (C.z - A.z) * nz, sg = d < 0 ? -1 : 1, m = Math.max(1, Math.round(Math.abs(d) / st)), dd = m * st * sg, liste = [];
  for (let j = 0; j <= m; j++) { const o = j * st * sg; liste.push([{ art: "frei", x: A.x + nx * o, z: A.z + nz * o }, { art: "frei", x: B.x + nx * o, z: B.z + nz * o }]); }
  for (let i = 0; i <= n; i++) { const x = A.x + ex * i * sp, z = A.z + ez * i * sp; liste.push([{ art: "frei", x, z }, { art: "frei", x: x + nx * dd, z: z + nz * dd }]); }
  return liste;
}
const fangOderFrei = (q) => { if (q.art && q.art !== "frei") return q; const f = fangen(q); return f.art !== "frei" && abst(f, q) < 0.9 ? f : q; };
function parallelPlan(A, C, Bp) {
  const L = Math.hypot(Bp.x - A.x, Bp.z - A.z) || 1, nx = -(Bp.z - A.z) / L, nz = (Bp.x - A.x) / L; let erst = null;
  for (const o of [rasterAbst(), -rasterAbst()]) { const v = (q) => ({ art: "frei", x: q.x + nx * o, z: q.z + nz * o }), pl = planen(fangOderFrei(v(A)), { x: C.x + nx * o, z: C.z + nz * o }, fangOderFrei(v(Bp)), strTyp, ebeneModus()); if (pl.ok) return pl; erst = erst || pl; }
  return erst;
}
function winkelFang(start, p) {
  const dx = p.x - start.x, dz = p.z - start.z, L = Math.hypot(dx, dz); if (L < 0.6) return { art: "frei", x: p.x, z: p.z };
  let a = Math.atan2(dz, dx); const refs = [0];
  if (start.art === "knoten") { const n = knoten.get(start.id); if (n) for (const id of n.kanten) { const k = kanten.get(id), q = k.a === n.id ? k.pts[0] : k.pts[k.pts.length - 1]; refs.push(Math.atan2(q.tz, q.tx)); } }
  if (start.art === "kante") { const k = kanten.get(start.id); if (k) { const e = abstandZuLinie(start, k.pts, true), q = punktBei(k, e.s); refs.push(Math.atan2(q.tz, q.tx)); } }
  let best = null, bd = 0.13;
  for (const r of refs) for (let i = 0; i < 8; i++) { const c = r + i * Math.PI / 4, d = Math.abs(Math.atan2(Math.sin(a - c), Math.cos(a - c))); if (d < bd) { bd = d; best = c; } }
  if (best != null) a = best;
  const Ls = Math.max(1, Math.round(L)); return { art: "frei", x: start.x + Math.cos(a) * Ls, z: start.z + Math.sin(a) * Ls };
}
function kandidatAus(p) {
  const n = bau.punkte.length, f = werkzeug === "gleis" ? gleisFangen(p) : fangen(p);
  if (modus() === "raster" && n === 1) return winkelFang(bau.punkte[0], p);
  if (modus() === "raster" && n === 2) { const A = bau.punkte[0], B = bau.punkte[1], L = abst(A, B) || 1, nx = -(B.z - A.z) / L, nz = (B.x - A.x) / L, d = (p.x - A.x) * nx + (p.z - A.z) * nz, st = rasterAbst(), m = Math.max(1, Math.round(Math.abs(d) / st)) * st * (d < 0 ? -1 : 1); return { art: "frei", x: A.x + nx * m, z: A.z + nz * m }; }
  if (modus() === "kurve" && n === 1) return winkelFang(bau.punkte[0], p);
  if (f.art !== "frei" || n === 0) return f;
  if (zweiPunkte()) return winkelFang(bau.punkte[0], p);
  return f;
}
function planNeu() {
  if (!istBau() || tippModus()) return;
  const P = bau.punkte.slice(); if (bau.kandidat) P.push(bau.kandidat);
  const noetig = zweiPunkte() ? 2 : 3;
  fuehrung.visible = false;
  marker.forEach((m, i) => { const q = P[i]; m.visible = !!q && i < noetig; if (q) { m.position.set(q.x, G + 0.06, q.z); m.material.color.setHex(modus() === "kurve" && i === 1 ? 0xffd34d : (q.art && q.art !== "frei" ? 0x7dffb0 : 0xffffff)); } });
  hilfslinie.visible = modus() === "kurve" && P.length >= 2;
  if (hilfslinie.visible) { hilfslinie.geometry.dispose(); hilfslinie.geometry = new THREE.BufferGeometry().setFromPoints(P.map((q) => new THREE.Vector3(q.x, G + 0.07, q.z))); hilfslinie.computeLineDistances(); }
  if (P.length < 2) { vorschau.visible = false; fuehrung.visible = false; bau.plan = null; if (!P.length) frageZu(); else frage("Jetzt " + (modus() === "kurve" ? "den Kurvenpunkt" : modus() === "raster" ? "die zweite Ecke" : "das Ende") + " antippen", false, null); return; }
  if (modus() === "raster" && werkzeug === "strasse") { rasterPlanen(P); return; }
  const A = P[0]; let C, Bp;
  if (zweiPunkte() || P.length === 2) { Bp = P[1]; C = lerp(A, Bp, 0.5); } else { C = { x: P[1].x, z: P[1].z }; Bp = P[2]; }
  const gl = werkzeug === "gleis"; let plan = gl ? gleisPlanen(A, C, Bp, ebeneModus()) : planen(A, C, Bp, strTyp, ebeneModus());
  if (!plan.ok && plan.wasser && !ebeneModus() && plan.pts.some((q) => abstand(q.x, q.z) < 0.3)) { const p2 = gl ? gleisPlanen(A, C, Bp, 1) : planen(A, C, Bp, strTyp, 1); if (p2.ok || plan.laenge >= 7) { plan = p2; plan.auto = true; } }
  bau.plan = P.length >= noetig ? plan : null;
  const winkelTxt = fuehrungZeigen(A, P.length === 2 ? P[1] : C);
  let p2 = null; if (!gl && parallelAn && plan.ok && P.length >= noetig) { p2 = parallelPlan(A, C, Bp); if (p2.ok && p2.kosten + plan.kosten > geld) { p2.ok = false; p2.grund = "Nicht genug Geld"; } } bau.plan2 = p2;
  const pos = [], col = [], f = plan.ok ? farbe(0x7fb8ff) : farbe(0xff5a5a), hw = gl ? 0.32 : TYP[strTyp].halb;
  band(pos, col, plan.pts, hw, G + 0.04, f);
  for (const k of plan.kreuz) scheibe(pos, col, k.x, k.z, hw * 0.7, G + 0.045, farbe(0xffffff));
  if (p2) band(pos, col, p2.pts, hw, G + 0.04, p2.ok ? farbe(0x9fd0ff) : farbe(0xff8a5a));
  vorschau.geometry.dispose(); vorschau.geometry = geoAus(pos, col); vorschau.visible = true;
  if (!bau.plan) { frage("Jetzt das Ende antippen", false, null); return; }
  if (gl) { frage((plan.ebene > 0 ? "🌉 " : plan.ebene < 0 ? "🚇 " : "") + "🛤️ Gleis " + meter(plan.laenge) + winkelTxt + " · " + euro(plan.kosten) + (plan.ok ? "" : " – " + plan.grund), plan.ok, gleisBestaetigen); return; }
  const ok = plan.ok && (!p2 || p2.ok);
  frage((plan.ebene > 0 ? "🌉 " : plan.ebene < 0 ? "🚇 " : "") + (plan.auto ? "Brücke · " : "") + TYP[strTyp].em + " " + meter(plan.laenge) + winkelTxt + " · " + euro(plan.kosten + (p2 ? p2.kosten : 0)) + (p2 ? " (2 Straßen)" : "") + (plan.baeume ? " (" + plan.baeume + " 🌳)" : "") + (plan.ok ? (p2 && !p2.ok ? " – Parallele: " + p2.grund : "") : " – " + plan.grund), ok, strasseBestaetigen);
}
function gleisBestaetigen() {
  const plan = bau.plan; if (!plan || !plan.ok) return;
  merkeRueck(); const neu = gleisBauen(plan); if (!neu.length) { rueck.pop(); rueckKnopf(); tipp("Hier liegt schon ein Gleis.", 2000); bauAbbrechen(); return; }
  bahnhofAnkern(); const endK = naechsterGKnoten(plan.B, 0.7); bau.punkte = endK ? [{ art: "gknoten", id: endK.id, x: endK.x, z: endK.z }] : []; bau.kandidat = null; bau.plan = null;
  planNeu(); tipp("✅ Gleis gebaut! Tipp weiter – oder ✕ zum Beenden. Bahnhöfe stellst du direkt neben ein Gleis.", 3000);
}
function rasterPlanen(P) {
  const linien = rasterLinien(P[0], P[1], P[2]), pos = [], col = [], hw = TYP[strTyp].halb; let kosten = 0, grund = "", ok = P.length >= 3;
  for (const [a, b] of linien) { const pl = planen(fangOderFrei(a), lerp(a, b, 0.5), fangOderFrei(b), strTyp, 0); kosten += pl.kosten; if (!pl.ok && pl.grund !== "Nicht genug Geld") { ok = false; grund = grund || pl.grund; } band(pos, col, pl.pts, hw, G + 0.04, pl.ok || pl.grund === "Nicht genug Geld" ? farbe(0x7fb8ff) : farbe(0xff5a5a)); }
  if (ok && kosten > geld) { ok = false; grund = "Nicht genug Geld"; }
  vorschau.geometry.dispose(); vorschau.geometry = geoAus(pos, col); vorschau.visible = true;
  bau.plan = P.length >= 3 ? { raster: linien, ok, kosten } : null;
  if (P.length < 3) { frage("▦ " + meter(abst(P[0], P[1])) + fuehrungZeigen(P[0], P[1]) + " – jetzt die Tiefe antippen", false, null); return; }
  fuehrung.visible = false;
  const n = linien.length; frage("▦ Raster · " + n + " Straßen · " + euro(kosten) + (ok ? "" : " – " + grund), ok, rasterBestaetigen);
}
function rasterBestaetigen() {
  const plan = bau.plan; if (!plan || !plan.raster || !plan.ok) return;
  merkeRueck(); let n = 0;
  for (const [a, b] of plan.raster) { const pl = planen(fangOderFrei(a), lerp(a, b, 0.5), fangOderFrei(b), strTyp, 0); if (pl.ok && bauen(pl).length) n++; }
  bauAbbrechen(); tipp("▦ " + n + " Straßen gebaut! Jetzt Zonen anmalen.", 2800);
}
function strasseBestaetigen() {
  const plan = bau.plan; if (!plan || !plan.ok) return;
  if (bau.plan2 && !bau.plan2.ok) return;
  merkeRueck(); const neu = bauen(plan);
  if (bau.plan2 && neu.length) { const q = bau.plan2, p3 = planen(fangOderFrei(q.A), q.C, fangOderFrei(q.B), strTyp, q.ebene); if (p3.ok) bauen(p3); bau.plan2 = null; }
  if (!neu.length) { rueck.pop(); rueckKnopf(); tipp("Hier ist schon eine Straße.", 2000); bauAbbrechen(); return; }
  const endK = naechsterKnoten(plan.B, 0.7);
  bau.punkte = endK ? [{ art: "knoten", id: endK.id, x: endK.x, z: endK.z }] : []; bau.kandidat = null; bau.plan = null;
  planNeu(); tipp("✅ Gebaut! Tipp weiter, um anzuschließen – oder ✕ zum Beenden.", 2600);
}
function einbahnUmschalten(p) {
  const e = naechsteKante(p, Math.max(0.9, fangRadius() * 0.6), (k) => TYP[k.typ].autos); if (!e) { tipp("Tipp genau auf eine Straße.", 1800); return; }
  const k = e.k; if (k.ring) { tipp("Im Kreisverkehr fährt man immer in eine Richtung.", 2200); return; } if (k.aussen) { tipp("Die Verbindung nach außen bleibt in beide Richtungen offen.", 2200); return; }
  merkeRueck(); k.einbahn = !k.einbahn ? 1 : k.einbahn === 1 ? -1 : 0; kanteNeuZeichnen(k);
  for (const f of fahrzeuge) if (f.route.some((st) => st.k === k.id && k.einbahn && st.dir !== k.einbahn)) fahrzeugWeg(f);
  fahrzeuge = fahrzeuge.filter((f) => !f.weg); netzGeaendert();
  tipp(k.einbahn ? "➡️ Einbahnstraße – die Pfeile zeigen die Richtung. Nochmal tippen dreht sie um." : "↔️ Wieder in beide Richtungen befahrbar.", 2600);
}
const kreisel = [];
const kreiselMesh = new THREE.Mesh(new THREE.BufferGeometry(), M.strasse); kreiselMesh.receiveShadow = true; szene.add(kreiselMesh);
function kreiselZeichnen() {
  const pos = [], col = [];
  for (const q of kreisel) { scheibe(pos, col, q.x, q.z, q.R - 0.45, G + 0.026, farbe(0xd8d4c8)); scheibe(pos, col, q.x, q.z, q.R - 0.56, G + 0.03, SF.gruen); }
  kreiselMesh.geometry.dispose(); kreiselMesh.geometry = pos.length ? geoAus(pos, col) : new THREE.BufferGeometry();
  let i = alleeBaeume.count; for (const q of kreisel) { if (i >= 5990) break; _o.position.set(q.x, G + 0.03, q.z); _o.rotation.set(0, q.x, 0); _o.scale.setScalar(0.9); _o.updateMatrix(); alleeBaeume.setMatrixAt(i, _o.matrix); alleeBaeume.setColorAt(i++, _farbe.setRGB(0.9, 1, 0.9)); }
  alleeBaeume.count = i; alleeBaeume.instanceMatrix.needsUpdate = true; if (alleeBaeume.instanceColor) alleeBaeume.instanceColor.needsUpdate = true;
}
function kreiselBauen(p) {
  const n = naechsterKnoten(p, Math.max(1.5, fangRadius())); if (!n) { tipp("Tipp genau auf eine Kreuzung.", 2000); return; }
  const ein = [...n.kanten].map((id) => kanten.get(id)).filter((k) => k && TYP[k.typ].autos);
  if (ein.length < 3) { tipp("Kreisverkehre gehen nur an Kreuzungen mit mindestens 3 Straßen.", 2600); return; }
  if (ein.some((k) => k.ring || k.ebene)) { tipp("Hier geht kein Kreisverkehr.", 2000); return; }
  const R = KREISEL_R[kreiselGr] || 2.3; if (ein.some((k) => k.len < R + 1.8)) { tipp("Die Straßen an dieser Kreuzung sind zu kurz für einen Kreisverkehr.", 2600); return; }
  for (let a = 0; a < 16; a++) { const x = n.x + (R + 1.0) * Math.cos(a / 16 * 6.283), z = n.z + (R + 1.0) * Math.sin(a / 16 * 6.283); if (!imBesitz(x, z) || !aufLand(x, z, 1.5)) { tipp("Dafür ist hier nicht genug Platz.", 2200); return; } }
  const preis = Math.round(2 * Math.PI * R * 80 + 600); if (geld < preis) { tipp("Dieser Kreisverkehr kostet " + euro(preis) + ".", 2200); return; }
  merkeRueck(); geld -= preis;
  const winkel = ein.map((k) => { const q = k.a === n.id ? k.pts[2] : k.pts[k.pts.length - 3]; return Math.atan2(q.z - n.z, q.x - n.x); });
  let phi = winkel[0] + Math.PI / 4; for (let v = 0; v < 8; v++) { const nah = winkel.some((w) => [0, 1, 2, 3].some((q) => Math.abs(Math.atan2(Math.sin(phi + q * Math.PI / 2 - w), Math.cos(phi + q * Math.PI / 2 - w))) < 0.47)); if (!nah) break; phi += Math.PI / 16; }
  const cx = n.x, cz = n.z, ring = [];
  for (let q = 0; q < 4; q++) {
    const a0 = phi + q * Math.PI / 2, a1 = a0 + Math.PI / 2, am = a0 + Math.PI / 4, c = R * (2 - Math.SQRT1_2);
    ring.push(...bauen({ A: { art: "frei", x: cx + R * Math.cos(a0), z: cz + R * Math.sin(a0) }, B: { art: "frei", x: cx + R * Math.cos(a1), z: cz + R * Math.sin(a1) }, C: { x: cx + c * Math.cos(am), z: cz + c * Math.sin(am) }, typ: "klein", kosten: 0 }));
  }
  const mitte = knoten.get(n.id); if (mitte) for (const id of [...mitte.kanten]) { const k = kanten.get(id); if (k) kanteWeg(k); }
  for (const k of kanten.values()) { const a = knoten.get(k.a), b = knoten.get(k.b); if (Math.hypot(a.x - cx, a.z - cz) < R * 1.15 && Math.hypot(b.x - cx, b.z - cz) < R * 1.15 && Math.hypot(k.c.x - cx, k.c.z - cz) > R * 0.6) { const cr = (a.x - cx) * (b.z - a.z) - (a.z - cz) * (b.x - a.x); k.ring = true; k.kreisel = kreisel.length; k.einbahn = cr < 0 ? 1 : -1; kanteNeuZeichnen(k); } }
  for (const z of zellenNahe(cx, cz, R + 1.3)) zelleWeg(z);
  kreisel.push({ x: cx, z: cz, R }); kreiselZeichnen(); netzGeaendert(); zeigeWerte();
  tipp("⭕ Kreisverkehr gebaut! Wer im Kreis fährt, hat Vorfahrt.", 2800);
}
function ampelUmschalten(p) {
  const n = naechsterKnoten(p, Math.max(1.5, fangRadius()));
  if (!n) { tipp("Tipp genau auf eine Kreuzung.", 2000); return; }
  let deg = 0; for (const id of n.kanten) if (TYP[kanten.get(id).typ].autos) deg++;
  if (deg < 3) { tipp("Ampeln gibt es nur an Kreuzungen mit mindestens drei Straßen.", 2400); return; }
  if ([...n.kanten].some((id) => kanten.get(id).ring)) { tipp("Im Kreisverkehr gibt es keine Ampeln.", 2000); return; }
  merkeRueck(); n.manuell = true; n.ampel = !n.ampel; netzVerkehrVorbereiten(); speichernBald();
  tipp(n.ampel ? "🚦 Ampel eingeschaltet." : "Ampel aus – jetzt gilt: Hauptstraße hat Vorfahrt, sonst wer zuerst kommt.", 2600);
}

/* Zeiger */
const finger = new Map(); let aktion = null;
renderer.domElement.addEventListener("pointerdown", (e) => {
  if (!spielLaeuft || spieler.an || folgen) return;
  finger.set(e.pointerId, true);
  if (finger.size > 1) { aktion = null; if (werkzeug === "strasse") { bau.kandidat = null; planNeu(); } return; }
  if (e.pointerType === "mouse" && e.button !== 0) return;
  $("menue").hidden = true; $("ansichten").hidden = true;
  const p = bodenPunkt(e); if (!p) return;
  aktion = { id: e.pointerId, sx: e.clientX, sy: e.clientY, bewegt: false, letzte: p };
  if (istBau() && !tippModus()) {
    const noetig = zweiPunkte() ? 2 : 3;
    if (bau.punkte.length >= noetig) bau.punkte.pop();
    bau.kandidat = kandidatAus(p); planNeu();
  } else if (werkzeug === "zone") { merkeRueck(); if (pinsel === "fuellen") fuellen(p); else malen(p, p); }
  else if (werkzeug === "abriss") { merkeRueck(); abreissenStrich(p, p); }
});
renderer.domElement.addEventListener("pointermove", (e) => {
  if (!spielLaeuft || spieler.an) return;
  if (!aktion) {
    if (istBau() && !tippModus() && e.pointerType === "mouse" && finger.size === 0 && bau.punkte.length && !bau.plan) { const p = bodenPunkt(e); if (p) { bau.kandidat = kandidatAus(p); planNeu(); } }
    return;
  }
  if (aktion.id !== e.pointerId) return;
  if (Math.hypot(e.clientX - aktion.sx, e.clientY - aktion.sy) > 8) aktion.bewegt = true;
  const p = bodenPunkt(e); if (!p) return;
  if (istBau() && !tippModus()) { bau.kandidat = kandidatAus(p); planNeu(); }
  else if (werkzeug === "zone" && pinsel !== "fuellen") malen(aktion.letzte, p);
  else if (werkzeug === "abriss") abreissenStrich(aktion.letzte, p);
  aktion.letzte = p;
});
function loslassen(e) {
  finger.delete(e.pointerId);
  if (!aktion || aktion.id !== e.pointerId) return;
  const a = aktion; aktion = null;
  if (werkzeug === "gleis" && tippModus()) { if (!a.bewegt) gleisTippen(a.letzte); }
  else if (istBau()) { if (tippModus()) { if (!a.bewegt) (strModus === "ampel" ? ampelUmschalten : strModus === "einbahn" ? einbahnUmschalten : strModus === "busspur" ? busspurUmschalten : strModus === "schienen" ? schienenUmschalten : strModus === "ersetzen" ? ersetzenTippen : strModus === "parken" ? parkenTippen : kreiselBauen)(a.letzte); } else { if (bau.kandidat) { bau.punkte.push(bau.kandidat); bau.kandidat = null; } planNeu(); } }
  else if (werkzeug === "abriss" && !a.bewegt) abreissenStrasse(a.letzte);
  else if (werkzeug === "ansehen" && !a.bewegt) { const f = fahrzeugBei(a.letzte), d = inDienst(a.letzte.x, a.letzte.z, 0.1), hs = halteBei(a.letzte, 0.7); if (f) fahrzeugInfo(f); else if (hs) haltInfo(hs); else if (d) dienstInfo(d); else hausInfo(a.letzte); }
  else if ((werkzeug === "dienst" || werkzeug === "park") && !a.bewegt) dienstVorschau(a.letzte);
  else if (werkzeug === "verkehr" && !a.bewegt) busTippen(a.letzte);
  else if (werkzeug === "gebiet" && !a.bewegt) gebietAntippen(e);
}
renderer.domElement.addEventListener("pointerup", (e) => { letzterTipp = { x: e.clientX, y: e.clientY, t: performance.now() }; loslassen(e); });
renderer.domElement.addEventListener("pointercancel", (e) => { finger.delete(e.pointerId); if (aktion && aktion.id === e.pointerId) { aktion = null; bau.kandidat = null; planNeu(); } });
renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

function malen(a, b) {
  if (zoneWahl && !zoneFrei(zoneWahl)) return;
  const r = pinsel === "gross" ? 1.7 : 0.75, n = Math.max(1, Math.ceil(abst(a, b) / 0.4)); let geaendert = false;
  for (let i = 0; i <= n; i++) {
    const p = lerp(a, b, i / n);
    for (const z of zellenNahe(p.x, p.z, r)) { if (z.zone === zoneWahl) continue; if (z.haus) hausWeg(haeuser.get(z.haus)); z.zone = zoneWahl; geaendert = true; }
  }
  if (geaendert) { zellenNeu = true; dreckZeichnen(); zeigeWerte(); speichernBald(); }
}
function fuellen(p) {
  const nah = zellenNahe(p.x, p.z, 1.5).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  if (!nah) { tipp("Tipp direkt auf die Felder neben einer Straße.", 2000); return; }
  if (zoneWahl && !zoneFrei(zoneWahl)) return;
  for (const z of zellen.values()) if (z.g === nah.g && z.seite === nah.seite && z.zone !== zoneWahl) { if (z.haus) hausWeg(haeuser.get(z.haus)); z.zone = zoneWahl; }
  zellenNeu = true; zeigeWerte(); speichernBald();
}
function abreissenStrich(a, b) {
  const n = Math.max(1, Math.ceil(abst(a, b) / 0.4)); let geaendert = false;
  for (let i = 0; i <= n; i++) { const p = lerp(a, b, i / n); const dd = inDienst(p.x, p.z); if (dd) { geld += DIENSTE[dd.typ].preis * 0.3; dienstWeg(dd); geaendert = true; } for (const z of zellenNahe(p.x, p.z, 0.7)) { if (z.haus) { hausWeg(haeuser.get(z.haus)); geaendert = true; } if (z.zone) { z.zone = 0; geaendert = true; } } }
  if (geaendert) { zellenNeu = true; zeigeWerte(); speichernBald(); }
}
function abreissenStrasse(p) {
  const e = naechsteKante(p, Math.max(0.9, fangRadius() * 0.6));
  if (!e) return;
  if (e.k.aussen) { tipp("🛣️ Die Verbindung nach außen kann man nicht abreißen – über sie kommen Besucher, Pendler und Lieferungen.", 3200); return; }
  const erstattung = Math.round(e.k.len * TYP[e.k.typ].preis * 0.3);
  kanteWeg(e.k); verwaisteZellen(); geld += erstattung; netzGeaendert(); zeigeWerte(); tipp("Straße abgerissen (+" + euro(erstattung) + " zurück).", 2000);
}
function hausInfo(p) {
  const z = zellenNahe(p.x, p.z, 0.8).find((c) => c.haus);
  if (!z) { $("info").hidden = true; return; }
  const h = haeuser.get(z.haus);
  const Z = ZONEN[h.zone], g = Z.gruppe; listenAuffrischen(); const bw = bodenwert(h.x, h.z, h); h.wert = bw.wert; h.dreck = bw.dreck;
  const wert = imBau(h) ? "🏗️ Baustelle – fertig in " + Math.max(1, Math.ceil(h.bau.start + h.bau.dauer - simZeit)) + " s" : g === "w" ? "👥 " + leute(h) + " Bewohner" : "💼 " + jobs(h) + " Arbeitsplätze";
  const noetig = BODENWERT_FUER[g][h.stufe + 1] || 0;
  const naechst = !stufeBildungOk(h) ? "🎓 Für Stufe " + (h.stufe + 1) + " braucht es " + (h.stufe + 1 >= 5 ? "ein Gymnasium" : "eine Grundschule") + " in der Nähe" : h.stufe >= Z.max ? (Z.max === 1 ? "Spezial-Industrie hat nur eine Stufe" : "⭐ Höchste Stufe erreicht") : h.wert < noetig ? "⬆️ Für Stufe " + (h.stufe + 1) + " braucht es Bodenwert " + noetig + " (Bäume, Alleen, Wasser, weniger Dreck)" : "⬆️ Steigt auf Stufe " + (h.stufe + 1) + ", wenn Bedarf da ist";
  const sterne = "★".repeat(h.stufe) + "☆".repeat(Z.max - h.stufe);
  const hat = h.hat || {}, ab = h.abd || {}, ja = (x) => x ? "✅" : "❌";
  const dienstZeile = `<br><small>⚡${ja(hat.strom)} 💧${ja(hat.wasser)} 🚽${ja(hat.abwasser)} 🗑️${ja(hat.muell)} · 🚓${ja(ab.polizei)} 🚒${ja(ab.feuer)} 🏥${ja(ab.gesund)} 🎓${h.bildung || 0} 🚌${ja(h.bus)}</small>`;
  const prob = h.verlassen ? "<br>🏚️ <b style='display:inline'>Verlassen</b> – wird bald abgerissen" : h.problem ? "<br>⚠️ " + PROBLEM_TEXT[h.problem] + (h.notSeit != null ? " – die Leute ziehen bald weg!" : "") : "";
  const warn = dienstZeile + prob + (!zufahrt(h) ? "<br>⚠️ Keine Straße mit Autoverkehr in der Nähe" : h.keinWeg ? "<br>⚠️ Kein Weg zu den anderen Zonen – verbinde die Straßen" : "");
  infoZeigen(`<b>${Z.em} ${hausName(h)}</b><small>${Z.name} · ${sterne} Stufe ${h.stufe}/${Z.max} · ${h.w}×${h.d} Felder</small><br>${wert}<br>💎 Bodenwert ${h.wert}${h.dreck > 4 ? " · 🟤 Dreck " + h.dreck : ""}<br><small>${naechst}</small>${warn}`, 7000);
}
function gebietAntippen(e) {
  strahl.setFromCamera(ndc(e), kamera);
  let ziel = null; const t = strahl.intersectObjects(preisSchilder.children); if (t.length) ziel = t[0].object.userData;
  if (!ziel) { const p = bodenPunkt(e); if (p) { const [i, j] = kachelVon(p.x, p.z); if (kaufbar(i, j)) ziel = { i, j }; } }
  if (!ziel) { tipp("Du kannst nur Gebiete kaufen, die an dein Land grenzen.", 2200); return; }
  if (gekauft >= gebieteErlaubt()) { const n = MS.find((x) => x.gebiete > gekauft) && { name: MS.find((x) => x.gebiete > gekauft).name, ab: MS.find((x) => x.gebiete > gekauft).xp }; frage("🔒 Mehr Gebiete gibt es ab " + (n ? n.name + " (" + zahl(n.ab) + " XP)" : "–"), false, null); return; }
  const preis = GEBIET_PREIS(gekauft);
  if (geld < preis) { frage("Das Gebiet kostet " + euro(preis) + " – dir fehlen noch " + euro(preis - geld), false, null); return; }
  frage("Gebiet kaufen für " + euro(preis) + "?", true, () => {
    merkeRueck(); geld -= preis; gekauft++; besitz.add(ziel.i + "," + ziel.j); frageZu(); gebieteZeichnen(); zeigeWerte();
    const m = kachelMitte(ziel.i, ziel.j), h = { x0: m.x - KACHEL / 2, x1: m.x + KACHEL / 2, z0: m.z - KACHEL / 2, z1: m.z + KACHEL / 2 };
    for (const k of [...kanten.values()]) if (!(k.h.x1 < h.x0 || k.h.x0 > h.x1 || k.h.z1 < h.z0 || k.h.z0 > h.z1)) zellenFuer(k);
    speichernBald();
    tipp("🎉 Neues Gebiet gekauft! Jetzt kannst du dort bauen.", 2600);
  });
}

/* Zeitleiste und Menü */
function zeitKnoepfe() { document.querySelectorAll("#zeitleiste button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.t === tempo))); }
$("zeitleiste").addEventListener("click", (e) => { const b = e.target.closest("button[data-t]"); if (!b) return; tempo = +b.dataset.t; zeitKnoepfe(); if (!tempo) tipp("⏸️ Pause – du kannst trotzdem bauen.", 2000); });
$("kopf").onclick = () => { if ($("budget").hidden) budgetZeigen(); else $("budget").hidden = true; };
const menue = $("menue");
$("menueKnopf").onclick = () => { $("ansichten").hidden = true; menue.hidden = !menue.hidden; $("menueKnopf").setAttribute("aria-expanded", String(!menue.hidden)); };
$("budgetKnopf").onclick = () => { menue.hidden = true; budgetZeigen(); };
$("hauptmenueKnopf").onclick = () => { if (spielLaeuft) { clearTimeout(speicherTimer); merke(platzKey(platz), zustand()); } location.href = location.pathname; };
function menueKnoepfe() {
  document.querySelectorAll("#zeiten button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.zeit === zeitModus)));
  document.querySelectorAll("#grafik button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.q === stufe)));
}
$("zeiten").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; zeitModus = b.dataset.zeit; merke("inselstadt-bau-zeit", zeitModus); zeitZiel = zeitModus === "auto" ? null : ZEITEN[zeitModus]; menueKnoepfe(); };
$("grafik").onclick = (e) => { const b = e.target.closest("button"); if (b) { qualitaet(b.dataset.q); menueKnoepfe(); } };
let loeschBereit = 0;
$("neuAnfangen").onclick = () => {
  if (Date.now() - loeschBereit > 3000) { loeschBereit = Date.now(); $("neuAnfangen").textContent = "Wirklich löschen?"; setTimeout(() => { $("neuAnfangen").textContent = "🗑️ Diese Stadt löschen"; }, 3000); return; }
  speichernAus = true; clearTimeout(speicherTimer); try { localStorage.removeItem(platzKey(platz)); } catch (x) { /* egal */ } location.href = location.pathname;
};
function qualitaet(neu) {
  const alt = stufe; stufe = neu; merke("inselstadt-qualitaet", stufe); if (alt !== neu) { for (const h of haeuser.values()) { h.teile = hausTeile(h); h.box = null; parkenNeu(h); } for (const d of dienste.values()) { d.teile = dienstTeile(d); d.box = null; parkenNeu(d); } } const q = STUFEN[stufe]; U.uDetail.value = q.details; aoMesh.visible = !!q.details; haeuserNeu = true;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.pr));
  const vorher = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = q.schatten > 0; sonne.castShadow = q.schatten > 0;
  if (q.schatten) { sonne.shadow.mapSize.set(q.schatten, q.schatten); if (sonne.shadow.map) { sonne.shadow.map.dispose(); sonne.shadow.map = null; } }
  for (const m of Object.values(baumMesh)) m.castShadow = stufe === "hoch";
  if (vorher !== renderer.shadowMap.enabled) szene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
}
addEventListener("resize", () => { kamera.aspect = innerWidth / innerHeight; kamera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

/* ================================================================
   Selbst fahren – mit echter Fahrphysik (Haftung, Driften, Federung, Zusammenstöße)
   ================================================================ */
const spieler = { an: false, x: 0, z: 0, rot: 0, vx: 0, vz: 0, gier: 0, lenk: 0, nick: 0, roll: 0, gas: false, bremse: false, links: false, rechts: false, gruppe: null, kamera: "hinten", wackeln: 0 };
const spurenMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.05, 0.09).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x15161a, transparent: true, opacity: 0.55, depthWrite: false }), 700);
spurenMesh.count = 0; spurenMesh.frustumCulled = false; spurenMesh.renderOrder = 2; szene.add(spurenMesh);
let reifenSpuren = [];
{
  const g = new THREE.Group(), lack = new THREE.MeshStandardMaterial({ color: 0xa66bff, roughness: 0.35, metalness: 0.4 }), glas = new THREE.MeshStandardMaterial({ color: 0x1d2633, roughness: 0.2, metalness: 0.5 });
  const koerper = new THREE.Group(); g.add(koerper);
  lack.vertexColors = true; void glas;
  const k = new THREE.Mesh(FZ.sport.geo, lack); const c = new THREE.Object3D();
  const lv = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.022, 0.19), new THREE.MeshBasicMaterial({ color: 0xfff3c8, toneMapped: false })); lv.position.set(0.252, FZ.sport.ly, 0);
  const lh = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.022, 0.19), new THREE.MeshBasicMaterial({ color: 0xff3b30, toneMapped: false })); lh.position.set(-0.252, FZ.sport.lyh, 0);
  [k, c].forEach((m) => { m.castShadow = true; }); koerper.add(k, c, lv, lh);
  const radGeo = G_RAD.clone().scale(0.044, 0.044, 1.1), radMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), raeder = [];
  for (const [x, z] of [[0.165, 0.113], [0.165, -0.113], [-0.155, 0.113], [-0.155, -0.113]]) { const r = new THREE.Mesh(radGeo, radMat); r.position.set(x, 0.044, z); g.add(r); raeder.push(r); }
  g.visible = false; g.userData = { lh, koerper, raeder }; szene.add(g); spieler.gruppe = g;
}
function fahrenStarten() {
  const ks = [...kanten.values()].filter((k) => TYP[k.typ].autos);
  if (!ks.length) { tipp("Bau zuerst eine Straße, dann kannst du losfahren.", 2500); return; }
  folgenEnde();
  const e = naechsteKante(steuerung.target, 400, (k) => TYP[k.typ].autos), p = spurPunkt(e.k, 1, e.s, TYP[e.k.typ].spuren[0]);
  Object.assign(spieler, { an: true, x: p.x, z: p.z, rot: Math.atan2(-p.tz, p.tx), vx: 0, vz: 0, gier: 0, lenk: 0 });
  spieler.gruppe.visible = true; steuerung.enabled = false;
  ["unten", "oben", "menueKnopf", "ansichtKnopf", "vollKnopf", "ansichten", "legende", "optionen"].forEach((id) => { $(id).hidden = true; }); $("fahrpult").hidden = false; $("tacho").hidden = false; $("info").hidden = true; $("budget").hidden = true;
  kamera.position.set(p.x - p.tx * 3, 1.8, p.z - p.tz * 3);
  tipp("🚗 Gas ▲, Bremse/Rückwärts ▼, Lenken ◀ ▶. Zu schnell in die Kurve? Dann driftest du!", 4000);
}
function fahrenBeenden() {
  spieler.an = false; spieler.gruppe.visible = false;
  ["unten", "oben", "menueKnopf", "ansichtKnopf", "vollKnopf"].forEach((id) => { $(id).hidden = false; }); unterleiste(); if (ansicht) $("legende").hidden = false; $("fahrpult").hidden = true; $("tacho").hidden = true;
  steuerung.target.set(spieler.x, 0, spieler.z); kamera.position.set(spieler.x + 10, 14, spieler.z + 14); steuerung.enabled = true; steuerung.update();
}
$("aussteigen").onclick = fahrenBeenden;
/* Vollbild und Querformat auf dem Handy */
async function vollbildQuer() {
  try { if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({ navigationUI: "hide" }); } catch (e) { /* nicht erlaubt */ }
  try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock("landscape"); } catch (e) { /* geht nur im Vollbild oder gar nicht */ }
}
$("vollKnopf").onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else vollbildQuer(); };
$("drehVoll").onclick = vollbildQuer;
document.addEventListener("fullscreenchange", () => { $("vollKnopf").textContent = document.fullscreenElement ? "🗗" : "⛶"; setTimeout(() => dispatchEvent(new Event("resize")), 200); });
$("kameraWechsel").onclick = () => { spieler.kamera = spieler.kamera === "hinten" ? "innen" : "hinten"; };
document.querySelectorAll("#fahrpult button").forEach((b) => {
  const an = (v) => (e) => { e.preventDefault(); spieler[b.dataset.f] = v; b.classList.toggle("an", v); };
  b.addEventListener("pointerdown", an(true)); ["pointerup", "pointerleave", "pointercancel"].forEach((t) => b.addEventListener(t, an(false)));
});
const TASTEN = { ArrowUp: "gas", KeyW: "gas", ArrowDown: "bremse", KeyS: "bremse", ArrowLeft: "links", KeyA: "links", ArrowRight: "rechts", KeyD: "rechts" };
addEventListener("keydown", (e) => {
  if (spieler.an && TASTEN[e.code]) { spieler[TASTEN[e.code]] = true; e.preventDefault(); return; }
  if (spieler.an && e.code === "KeyC") { spieler.kamera = spieler.kamera === "hinten" ? "innen" : "hinten"; return; }
  if (spieler.an && e.key === "Escape") { fahrenBeenden(); return; }
  if (folgen && e.key === "Escape") { folgenEnde(); return; }
  if (e.key === "Escape") { bauAbbrechen(); frageZu(); $("budget").hidden = true; } if (e.key === "Enter" && frageJa) frageJa(); if ((e.ctrlKey || e.metaKey) && e.key === "z") rueckgaengig();
  if (e.key === " " && spielLaeuft && document.activeElement === document.body) { tempo = tempo ? 0 : 1; zeitKnoepfe(); e.preventDefault(); }
});
addEventListener("keyup", (e) => { if (TASTEN[e.code]) spieler[TASTEN[e.code]] = false; });
const _blick = new THREE.Vector3(), _soll = new THREE.Vector3();
function hindernis(x, z) {
  // Häuser
  for (const c of zellenNahe(x, z, 0.62)) if (c.haus) return { x: c.x, z: c.z, r: 0.62 };
  // Bäume
  let b = null; baeumeIn(x - 0.5, z - 0.5, x + 0.5, z + 0.5, (t) => { if (!t.weg && !b && Math.hypot(t.x - x, t.z - z) < 0.26) b = { x: t.x, z: t.z, r: 0.26 }; });
  if (b) return b;
  // andere Autos
  for (const f of fahrzeuge) {
    if (!f.pos || f.skala < 0.5) continue;
    const dx = x - f.pos.x, dz = z - f.pos.z, lx = dx * f.pos.tx + dz * f.pos.tz, lz = -dx * f.pos.tz + dz * f.pos.tx;
    if (Math.abs(lx) < f.L / 2 + 0.24 && Math.abs(lz) < f.B / 2 + 0.11) { f.v = 0; f.warte += 0.2; return { x: f.pos.x, z: f.pos.z, r: 0.3 }; }
  }
  return null;
}
function fahrenTakt(dt) {
  const s = spieler, fx = Math.cos(s.rot), fz = -Math.sin(s.rot), rx = -fz, rz = fx;
  let vF = s.vx * fx + s.vz * fz, vR = s.vx * rx + s.vz * rz;
  const aufStrasse = !!naechsteKante(s, 0.95, (k) => k.typ !== "fuss"), grip = aufStrasse ? 1 : 0.55, vmax = aufStrasse ? 3.6 : 1.9;
  // Antrieb, Bremse, Luft- und Rollwiderstand
  let a = 0;
  if (s.gas) a += vF < -0.05 ? 7 : 3.0 * (1 - Math.max(0, vF) / (vmax + 0.6));
  if (s.bremse) a -= vF > 0.05 ? 7.5 * grip : 2.0;
  a -= vF * 0.22 + Math.sign(vF) * 0.25 + (vF > vmax ? (vF - vmax) * 3 : 0);
  if (!s.gas && !s.bremse && Math.abs(vF) < 0.08) { vF = 0; a = 0; }
  vF = klemme(vF + a * dt, -1.4, 5);
  // Lenkung: weniger Einschlag bei hohem Tempo
  const lenkZiel = ((s.links ? 1 : 0) - (s.rechts ? 1 : 0)) * 0.6 / (1 + Math.abs(vF) * 0.35);
  s.lenk += (lenkZiel - s.lenk) * Math.min(1, dt * 8);
  const radstand = 0.32, gierWunsch = vF * Math.tan(s.lenk) / radstand;
  // Haftung: wird die Querkraft zu groß, rutscht das Auto (Driften)
  const quer = Math.abs(gierWunsch * vF), haftGrenze = 3.4 * grip, rutscht = quer > haftGrenze || Math.abs(vR) > 0.5;
  s.gier += ((rutscht ? gierWunsch * 0.75 : gierWunsch) - s.gier) * Math.min(1, dt * (rutscht ? 4 : 12));
  s.rot += s.gier * dt;
  const haft = (rutscht ? 1.6 : 11) * grip; vR *= Math.exp(-haft * dt);
  if (rutscht) vR -= Math.sign(gierWunsch) * Math.min(quer - haftGrenze * 0.8, 3) * 0.25 * dt * Math.sign(vF || 1);
  const nfx = Math.cos(s.rot), nfz = -Math.sin(s.rot);
  s.vx = nfx * vF + -nfz * vR; s.vz = nfz * vF + nfx * vR;
  // Bewegen mit Zusammenstößen
  let nx = s.x + s.vx * dt, nz = s.z + s.vz * dt;
  let h = hindernis(nx, nz);
  if (h && hindernis(s.x, s.z) && Math.hypot(nx - h.x, nz - h.z) > Math.hypot(s.x - h.x, s.z - h.z)) h = null;   // schon drin: wegfahren erlaubt
  if (h || !aufLand(nx, nz, 1.1) || Math.abs(nx) > HALB + 30 || Math.abs(nz) > HALB + 30) {
    let n = h ? { x: nx - h.x, z: nz - h.z } : { x: -nx, z: -nz }; const l = Math.hypot(n.x, n.z) || 1; n.x /= l; n.z /= l;
    const vn = s.vx * n.x + s.vz * n.z; if (vn < 0) { s.vx -= 1.35 * vn * n.x; s.vz -= 1.35 * vn * n.z; }
    if (Math.abs(vn) > 0.8) { s.wackeln = Math.min(0.25, Math.abs(vn) * 0.06); if (navigator.vibrate) try { navigator.vibrate(40); } catch (e) { /* egal */ } }
    nx = s.x + s.vx * dt; nz = s.z + s.vz * dt; if ((hindernis(nx, nz) && !hindernis(s.x, s.z)) || !aufLand(nx, nz, 1.1)) { nx = s.x; nz = s.z; }
  }
  s.x = nx; s.z = nz;
  // Reifenspuren beim Driften oder Vollbremsung
  if ((rutscht && Math.abs(vF) > 1) || (s.bremse && vF > 2.2)) for (const sei of [0.115, -0.115]) reifenSpuren.push({ x: s.x - nfx * 0.16 - nfz * sei * -1, z: s.z - nfz * 0.16 + nfx * sei, rot: s.rot, t: jetztS });
  reifenSpuren = reifenSpuren.filter((r) => jetztS - r.t < 14).slice(-700);
  reifenSpuren.forEach((r, i) => { const f = 1 - (jetztS - r.t) / 14; _o.position.set(r.x, G + 0.026, r.z); _o.rotation.set(0, r.rot + Math.PI / 2, 0); _o.scale.set(1, 1, f); _o.updateMatrix(); spurenMesh.setMatrixAt(i, _o.matrix); });
  spurenMesh.count = reifenSpuren.length; spurenMesh.instanceMatrix.needsUpdate = true;
  // Federung: Nicken beim Bremsen/Beschleunigen, Neigen in Kurven
  s.nick += (klemme(-a * 0.01, -0.06, 0.04) - s.nick) * Math.min(1, dt * 6); s.roll += (klemme(-s.gier * vF * 0.035, -0.12, 0.12) - s.roll) * Math.min(1, dt * 6);
  const g = s.gruppe, d = g.userData; g.position.set(s.x, G + 0.02, s.z); g.rotation.set(0, s.rot, 0); d.koerper.rotation.set(s.roll, 0, s.nick, "YZX");
  d.raeder[0].rotation.y = d.raeder[1].rotation.y = s.lenk;
  d.lh.material.color.setHex(s.bremse && vF > 0.1 ? 0xff2a20 : 0x7a1410);
  // Kamera
  s.wackeln *= Math.exp(-dt * 8); const w = s.wackeln * Math.sin(jetztS * 60);
  if (s.kamera === "innen") { _soll.set(s.x + nfx * 0.02, G + 0.25 + w * 0.2, s.z + nfz * 0.02); kamera.position.copy(_soll); _blick.set(s.x + nfx * 3, G + 0.2, s.z + nfz * 3); }
  else { _soll.set(s.x - nfx * 3.0, G + 1.45, s.z - nfz * 3.0); kamera.position.lerp(_soll, 1 - Math.exp(-dt * 5)); kamera.position.y += w; _blick.set(s.x + nfx * 1.6, G + 0.35, s.z + nfz * 1.6); }
  kamera.lookAt(_blick);
  steuerung.target.set(s.x, 0, s.z);
  $("kmh").textContent = Math.round(Math.abs(vF) * 8 * 3.6);
}

/* ================================================================
   Auto antippen und folgen (wie bei Cities: Skylines)
   ================================================================ */
let folgen = null;
function fahrzeugBei(p) { let best = null, bd = Math.max(0.5, fangRadius() * 0.45); for (const f of fahrzeuge) { if (!f.pos) continue; const d = Math.hypot(f.pos.x - p.x, f.pos.z - p.z); if (d < bd) { bd = d; best = f; } } return best; }
function fahrzeugInfo(f) {
  const ladung = f.anh ? "<br>📦 Ladung: " + AUFLIEGER[f.anh].name : f.typ === "liefer" ? "<br>📦 Lieferung" : "";
  infoZeigen(`<b>${mitAuflieger(f.typ) || f.typ === "kipper" ? "🚛" : f.linie ? (f.typ === "tram" ? "🚋" : "🚌") : FZ[f.typ].blau ? "🚨" : f.typ === "liefer" ? "🚐" : "🚗"} ${f.name}</b>fährt von <b style="display:inline;font-size:inherit">${f.vonText}</b> nach <b style="display:inline;font-size:inherit">${f.nachText}</b>${ladung}${f.linie ? "<br>🧍 " + (f.insassen || 0) + " / " + (PLAETZE[f.typ] || 50) + " Fahrgäste" : ""}<br><small>Tempo: ${Math.round(f.v * 8 * 3.6)} km/h</small><div style="margin-top:8px"><button class="chip" type="button" data-folgen="${f.id}">📷 Folgen</button></div>`, 7000);
}
$("info").addEventListener("click", (e) => { const b = e.target.closest("[data-folgen]"); if (!b) return; const f = fahrzeuge.find((x) => x.id === +b.dataset.folgen); if (f) folgenStart(f); });
function folgenStart(f) {
  folgen = f; steuerung.enabled = false; $("info").hidden = true; $("unten").hidden = true;
  let el = $("folgenLeiste"); if (!el) { el = document.createElement("div"); el.id = "folgenLeiste"; el.className = "glas"; el.style.cssText = "position:fixed;left:50%;bottom:max(16px,env(safe-area-inset-bottom));transform:translateX(-50%);padding:8px 8px 8px 16px;z-index:6;display:flex;gap:12px;align-items:center"; document.body.appendChild(el); }
  el.innerHTML = `<span>📷 ${f.name} → ${f.nachText}</span><button class="chip" type="button" id="folgenAus">✕ Beenden</button>`; el.hidden = false;
  $("folgenAus").onclick = () => folgenEnde();
}
function folgenEnde(text) {
  if (!folgen) return; const p = folgen.pos; folgen = null; const el = $("folgenLeiste"); if (el) el.hidden = true; $("unten").hidden = false;
  if (p) { steuerung.target.set(p.x, 0, p.z); kamera.position.set(p.x + 8, 10, p.z + 10); }
  steuerung.enabled = true; steuerung.update(); if (text) tipp(text, 2500);
}
function folgenTakt(dt) {
  const f = folgen; if (!f || !f.pos) return;
  const p = f.pos, hx = p.tx, hz = p.tz;
  _soll.set(p.x - hx * 2.6, G + 1.3, p.z - hz * 2.6); kamera.position.lerp(_soll, 1 - Math.exp(-dt * 4.5));
  _blick.set(p.x + hx * 1.2, G + 0.3, p.z + hz * 1.2); kamera.lookAt(_blick); steuerung.target.set(p.x, 0, p.z);
}

/* ================================================================
   Hauptmenü und Start
   ================================================================ */
function platzLaden(n) { const d = lade(platzKey(n), null); return d && d.v === 3 ? d : null; }
(function altenStandUebernehmen() { if (platzLaden(1)) return; const alt = lade("inselstadt-v2", null); if (alt && alt.v === 2) { alt.v = 3; alt.karte = "insel"; alt.meta = { einwohner: 0, gespeichert: Date.now() }; merke(platzKey(1), alt); } })();
function hauptmenue(ansicht) {
  const box = $("hmBox"); const kopf = `<div class="titel"><img src="../../shared/marken/flaressa-zeichen.webp" alt=""><div><h1>Inselstadt</h1><p>Baue deine eigene Stadt – ein Spiel von FLARESSA Gaming</p></div></div>`;
  if (ansicht && ansicht.neu) {
    box.innerHTML = kopf + `<h3>Neue Stadt auf Platz ${ansicht.neu} – wähle eine Karte</h3><div class="karten">${Object.keys(KARTEN).map((k) => `<button class="karte" type="button" data-karte="${k}"><span class="em">${KARTEN[k].em}</span><b>${KARTEN[k].name}</b><small>${KARTEN[k].text}</small><small>Startgeld: ${euro(KARTEN[k].geld)}</small></button>`).join("")}</div><button class="zurueck" type="button" id="hmZurueck">‹ Zurück</button>`;
    box.querySelectorAll("[data-karte]").forEach((b) => { b.onclick = () => starten(ansicht.neu, null, b.dataset.karte); });
    $("hmZurueck").onclick = () => hauptmenue();
    return;
  }
  let h = kopf + "<h3>Deine Städte</h3>";
  for (let n = 1; n <= 3; n++) {
    const d = platzLaden(n);
    if (d) { const K = KARTEN[d.karte] || KARTEN.insel, w = Math.floor((d.tage || 0) / 7) + 1; h += `<div class="platz glas"><span class="em">${K.em}</span><div class="was"><b>${K.name}</b><small>👥 ${zahl(d.meta ? d.meta.einwohner : 0)} Einwohner · Woche ${w} · ${MEILEN[d.meilenstein || 0].name}</small></div><button class="weg" type="button" data-weg="${n}" aria-label="Löschen">🗑️</button><button class="los" type="button" data-los="${n}">Weiterspielen</button></div>`; }
    else h += `<div class="platz glas"><span class="em">➕</span><div class="was"><b>Freier Platz ${n}</b><small>Starte eine neue Stadt</small></div><button class="los" type="button" data-neu="${n}">Neue Stadt</button></div>`;
  }
  h += `<p style="font-size:.85rem">Tipp: Alles wird automatisch auf diesem Gerät gespeichert. Steuerung: zwei Finger drehen und zoomen.</p>`;
  box.innerHTML = h;
  box.querySelectorAll("[data-los]").forEach((b) => { b.onclick = () => { const n = +b.dataset.los; starten(n, platzLaden(n)); }; });
  box.querySelectorAll("[data-neu]").forEach((b) => { b.onclick = () => hauptmenue({ neu: +b.dataset.neu }); });
  box.querySelectorAll("[data-weg]").forEach((b) => { let bereit = 0; b.onclick = () => { if (Date.now() - bereit > 3000) { bereit = Date.now(); b.textContent = "Sicher?"; return; } try { localStorage.removeItem(platzKey(+b.dataset.weg)); } catch (e) { /* egal */ } hauptmenue(); }; });
}
function starten(n, daten, neueKarte) {
  platz = n; $("hauptmenue").hidden = true; $("laden").classList.remove("weg");
  setTimeout(() => {
    grossKarte = daten ? !!daten.gross : true; weltBauen(daten ? (daten.karte || "insel") : neueKarte);
    if (daten) { zustandRein(daten); if (!daten.fortschritt) maxEinw = kennzahlen().e; }
    else { geld = KARTEN[karte].geld; netzGeaendert(); gebieteZeichnen(); bedarfBerechnen(); zeigeWerte(); datumZeigen(); }
    if (!aussenKnoten) aussenBauen(); aussenGleisBauen();
    spielLaeuft = true; document.body.classList.add("laeuft"); if (matchMedia("(pointer:coarse)").matches) vollbildQuer(); speichernBald(); unterleiste(); zeitKnoepfe(); menueKnoepfe();
    if (!daten) { $("info").hidden = true; infoZeigen(`<b>${KARTEN[karte].em} Willkommen in deiner neuen Stadt!</b>1. 🛣️ Straßen: Anfang antippen, Ende antippen, ✓<br>2. 🏘️ Zonen: Felder neben der Straße anmalen<br>3. Zuschauen: Häuser wachsen, Autos fahren, Steuern bringen Geld<br><small>Tipp oben auf dein Geld für Budget &amp; Steuern.</small>`, 12000); werkzeugWaehlen("strasse"); }
    else tipp("Willkommen zurück!", 2500);
    renderer.setAnimationLoop(schleife);
    setTimeout(() => $("laden").classList.add("weg"), 200);
  }, 60);
}
window.inselstadt = { parkInfo: () => { const st = { autos: autos.size, daheim: 0, weg: 0, fahrend: 0, aufParkplatz: 0, strasse: 0 }; for (const a of autos.values()) { if (!a.wo) st.fahrend++; else if (a.wo.kante) st.strasse++; else if (a.wo.b && a.wo.b.dienst) st.aufParkplatz++; else if (a.wo.b && a.wo.b.id === a.heim) st.daheim++; else st.weg++; } st.stunde = Math.round(stunde()); return st; }, zeitSetzen: (z) => { zeit = z; }, warnDebug: () => warnSprites.filter((x) => x.visible).slice(0, 3).map((x) => [x.position.x, x.position.y, x.position.z, x.scale.x, x.scale.y, x.material.map.image.width]), alarmTest: (dtyp, ftyp) => { const d = [...dienste.values()].find((q) => q.typ === dtyp); if (!d) return 'kein dienst'; const hs = [...haeuser.values()].sort((a, b) => Math.hypot(b.x - d.x, b.z - d.z) - Math.hypot(a.x - d.x, a.z - d.z)); const f = einsatz(d, hs[0], ftyp, null, true); return f ? [f.id, f.modus, !!f.alarm] : 'kein fz'; }, dienstTest: () => { const f = []; for (const typ in DIENSTE) for (const a of [0, 2]) { try { const T = dienstTeile({ typ, id: 7, ausbau: a }); for (const t of T) if (![t.lx, t.lz, t.sx, t.sy, t.sz, t.ly || 0].every(Number.isFinite) || !B[t.b]) { f.push(typ + ' ' + t.b); break; } } catch (e) { f.push(typ + ' ' + e.message); } } return f; }, katalogTest: () => { const fehler = [], namen = new Set(); let teile = 0; for (const z of [1, 2, 3, 4, 5, 6, 7, 8]) for (let st = 1; st <= ZONEN[z].max; st++) for (let v = 0; v < 12; v++) for (const [w, d] of [[1, 2], [2, 2], [2, 3], [3, 4], [4, 4]]) { try { const h = { zone: z, stufe: st, variante: v, w, d }; const T = hausTeile(h); teile = Math.max(teile, T.length); namen.add(z + ":" + h.name); for (const t of T) if (![t.lx, t.lz, t.sx, t.sy, t.sz, t.ly || 0].every(Number.isFinite) || !B[t.b]) { fehler.push(z + "/" + st + "/" + h.name + " " + t.b); break; } } catch (e) { fehler.push(z + "/" + st + "/" + v + " " + e.message); } } return { namen: namen.size, teile, fehler: [...new Set(fehler)].slice(0, 20) }; }, hausStufe: (f) => { for (const h of haeuser.values()) { const r = f(h); if (r) { h.stufe = r[0]; if (r[1] != null) h.variante = r[1]; h.teile = hausTeile(h); h.box = null; h.hoehe = hoeheVon(h); } } haeuserNeu = true; }, zustandHolen: () => zustand(), kreiselGroesse: (i) => { kreiselGr = i; }, rasterTest: (A, B, C, t) => { strTyp = t || "klein"; const ls = rasterLinien(A, B, C); let n = 0; for (const [a, b] of ls) { const pl = planen(fangOderFrei(a), lerp(a, b, 0.5), fangOderFrei(b), strTyp, 0); if (pl.ok && bauen(pl).length) n++; else if (!pl.ok) console.log("raster", pl.grund); } return [ls.length, n]; }, ersetzen: (p, t) => { strTyp = t; ersetzenTippen(p); }, parken: (p) => parkenTippen(p), autoBruecke: (A, B) => { const pl = planen(fangen(A), lerp(A, B, 0.5), fangen(B), "klein", 0); if (!pl.ok && pl.wasser && pl.pts.some((q) => abstand(q.x, q.z) < 0.3)) { const p2 = planen(fangen(A), lerp(A, B, 0.5), fangen(B), "klein", 1); return [pl.grund, p2.ok, p2.grund]; } return [pl.ok, pl.grund]; }, bildschirm: (x, z) => { const v = new THREE.Vector3(x, G, z).project(kamera), r = renderer.domElement.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; }, linienListe: () => [...linien.values()].map((L) => ({ nr: L.nr, art: L.art, halte: L.halte.length, busse: L.busse, keinDepot: L.keinDepot })), gleisPlanen, gleisBauen, bahnhofPlan, gKanten, gKnoten, zuege: () => zuege, zuglinien, uebergaenge: () => uebergaenge, gleisModus: (m) => { gleisModus = m; }, zuglinieBau: (ids) => { zuglinieBau = ids; }, zuglinieFertig, schienenUmschalten, aussenGleisBauen, zugTakt, modellTest: () => { const ks = Object.keys(FZ); let n = 0; for (const k of kanten.values()) { if (!autoKante(k) || k.aussen || k.len < 8) continue; for (let s = 1.5; s < k.len - 1.5 && n < ks.length; s += 2.2) { const f = fahrzeugAusWeg({ route: [{ k: k.id, dir: 1 }], s0: s, s1: k.len - 0.5 }, ks[n], mitAuflieger(ks[n]) ? "container" : null, "Test", "Test", "aussen"); if (f) { f.farbe = PAL.auto[n % PAL.auto.length]; f.v = 0; n++; } } } return n; }, allesBesitzen: () => { for (let i = 0; i < KN; i++) for (let j = 0; j < KN; j++) besitz.add(i + "," + j); gebieteZeichnen(); }, kameraAuf: (x, z, d) => { steuerung.target.set(x, 0, z); kamera.position.set(x + d * 0.55, d * 0.75, z + d * 0.65); steuerung.update(); }, dbgF: (id) => { const f = fahrzeuge.find((x) => x.id === id); if (!f || f.modus !== "kante") return null; const st = f.route[f.ri], k = kanten.get(st.k), nx = f.route[f.ri + 1]; if (!nx) return "letzte"; const n = endKnoten(k, st.dir), k2 = kanten.get(nx.k), s2 = anfang(k2, nx.dir); return { rest: +(ende(k, st.dir) - f.s).toFixed(2), frei: f.frei, darf: darfEinfahren(f, k, st, nx), k2: k2.id + (k2.ring ? "R" : ""), platz: fahrzeuge.filter((g) => g !== f && g.modus === "kante" && g.route[g.ri].k === k2.id && g.route[g.ri].dir === nx.dir && g.s < s2 + g.hintenL + f.vorneL + 0.35).map((g) => g.id + ":" + g.s.toFixed(2) + ":w" + g.warte.toFixed(0)), drin: [...n.drin].map((g) => g.id + (g.tr ? "t" + g.tr.t.toFixed(2) : "res") + " von" + g.von), naht: n.naht.map((g) => g.id), luecke: f.block }; }, kreiselBauen, einbahnUmschalten, strModus: (m) => { strModus = m; }, halte, linien, neueHalte, busTippen, linieFertig, busRechnen, busModus: (m) => { busModus = m; }, linieBau: (ids) => { linieBau = ids; }, abstand: (x, z) => abstand(x, z), dienstPlan, dienstBauen, dienste, versorgung: () => versorgung, versorgungRechnen, dienstTakt, ansichtSetzen, sim: (sek, ziel) => { const ev = new Map(); let tk = 0; for (let t = 0; t < sek; t += 0.05) { simZeit += 0.05; jetztS += 0.05; if (++tk % 10 === 0) dienstTakt(0.5); verkehrTakt(0.05, ziel || 60); fahrzeugeZeichnen(); const F = fahrzeuge.filter((f) => f.pos && f.skala > 0.9 && !f.parkt); for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) { const A = F[i], Bf = F[j]; let hit = false; for (let q = 0; q <= 6 && !hit; q++) { const o = Bf.vorneL - (Bf.vorneL + Bf.hintenL) * q / 6, dx = Bf.pos.x + Bf.pos.tx * o - A.pos.x, dz = Bf.pos.z + Bf.pos.tz * o - A.pos.z, lx = dx * A.pos.tx + dz * A.pos.tz, lz = Math.abs(-dx * A.pos.tz + dz * A.pos.tx); if (lx < A.vorneL * 0.8 && lx > -A.hintenL * 0.8 && lz < (A.B + Bf.B) / 2 * 0.7) hit = true; } if (hit) { const key = A.id + "-" + Bf.id; if (!ev.has(key)) { const d = (f) => f.modus === "hof" ? "HOF" + (f.hof && f.hof.raus ? "raus" : "rein") : f.modus === "kante" ? f.route[f.ri].k + "/" + f.route[f.ri].dir + "/sp" + f.spur + "/off" + f.off.toFixed(2) + "/s" + f.s.toFixed(2) + (f.ausparken ? "/AUS" : "") + (f.frei ? "/FREI" : "") : "KN" + f.tr.knoten + "/t" + f.tr.t.toFixed(2) + "/von" + f.von + "->" + f.route[f.ri + 1].k; ev.set(key, [A.typ, d(A), "blk" + (A.block == null ? "-" : A.block.toFixed(2)) + "w" + A.warte.toFixed(1), Bf.typ, d(Bf), "blk" + (Bf.block == null ? "-" : Bf.block.toFixed(2)) + "w" + Bf.warte.toFixed(1), "t" + t.toFixed(1)]); } } } } return [fahrzeuge.length, ev.size, [...ev.values()].slice(0, 12)]; }, fahrtStarten: () => { try { return fahrtStarten(); } catch (e) { return "FEHLER " + e.message + e.stack; } }, folgen: (f) => folgenStart(f), baeume: () => baeume.length, stufenTest: (st) => { let i = 0; for (const h of haeuser.values()) { h.stufe = Math.min(ZONEN[h.zone].max, st || 1 + (i++ % 5)); h.teile = hausTeile(h); } haeuserNeu = true; }, meilenstein: (m) => { meilenstein = m; unterleiste(); }, zoneWahl: (z) => { zoneWahl = z; }, malen: (a, b) => malen(a, b), werteAuffrischen, hausTeile, bedarf: () => bedarf, wertAnsicht: (v) => { wertAnsicht = v; wertZeichnen(); }, kanten, knoten, zellen, haeuser, planen, bauen, fangen, wachsTakt, werkzeugWaehlen, fahrzeuge: () => fahrzeuge, kennzahlen, starten, setzeGeld: (g) => { geld = g; zeigeWerte(); }, fahrenStarten, fahrenBeenden, spieler, tempo: (t) => { tempo = t; zeitKnoepfe(); } };

/* ================================================================
   Hauptschleife
   ================================================================ */
let jetztS = performance.now() / 1000, letzte = jetztS, takt = 0, stauTakt = 0, fpsZeit = 0, fpsBilder = 0;
function schleife() {
  const t = performance.now() / 1000, dt = Math.min(0.05, t - letzte); letzte = t; jetztS = t;
  const sdt = dt * tempo; simZeit += sdt;
  U.uTime.value = t % 1000;
  if (zeitModus === "auto") zeit = (zeit + sdt / 360) % 1;
  else if (zeitZiel != null) { let d = zeitZiel - zeit; if (d < -0.5) d += 1; if (d > 0.5) d -= 1; zeit = (zeit + Math.sign(d) * Math.min(Math.abs(d), dt * 0.35) + 1) % 1; if (Math.abs(d) < 0.0005) zeitZiel = null; }
  licht(zeit);
  if (sdt > 0) {
    const vorTag = Math.floor(tage); tage += sdt / TAG_SEK;
    if (Math.floor(tage) !== vorTag) { datumZeigen(); if (Math.floor(tage) % 7 === 0) wocheTakt(); }
    takt += sdt; if (takt > 0.5) { takt = 0; wachsTakt(); }
  }
  // Verkehr in kleinen Schritten (auch bei ⏭️ stabil)
  const kz = kennzahlen(), autoZiel = Math.min(STUFEN[stufe].autos, FZ_MAX, Math.round((kz.e * 0.07 + kz.j * 0.035) * berufsverkehr() * (1 - 0.35 * busAbdeckung.anteil)) + fahrzeuge.filter((f) => f.linie).length);
  let rest = sdt; while (rest > 0) { const h = Math.min(rest, 0.05); verkehrTakt(h, autoZiel); rest -= h; }
  stauTakt += dt; if (stauTakt > 1) { stauTakt = 0; stauMessen(); }
  if (zellenNeu) zellenZeichnen();
  if (haeuserNeu) haeuserZeichnen();
  document.body.classList.toggle("baut", (istBau() && bau.punkte.length > 0) || !!dienstPlanAktuell || linieBau.length > 0 || zuglinieBau.length > 0);
  rauchZeichnen(); fahrzeugeZeichnen(); geparkteZeichnen(); ampelnZeichnen(); toreZeichnen(dt); fussgaengerTakt(dt, kz.e); hochZeichnen(); warnZeichnen(); drehZeichnen(); if (linienNeu) linienZeichnen(); zugTakt(dt * (tempo || 0)); bahnHafenZeichnen(dt * (tempo || 0)); schrankenZeichnen(dt); if (ansicht && ansicht !== "verkehr" && jetztS - wertZeit > 2) wertZeichnen();
  boote.forEach((b) => { b.w += b.v * dt; b.g.position.set(b.mx + Math.cos(b.w) * b.rad, WASSER + 0.02 + Math.sin(t * 1.6 + b.ph) * 0.05, b.mz + Math.sin(b.w) * b.rad); b.g.rotation.set(Math.sin(t * 1.3 + b.ph) * 0.05, -b.w + (b.v > 0 ? -Math.PI / 2 : Math.PI / 2), 0); });
  if (leuchtturm) leuchtturm.userData.strahl.rotation.y = t * 0.8;
  if (spieler.an) fahrenTakt(dt);
  else if (folgen) folgenTakt(dt);
  else {
    steuerung.update();
    const tz = steuerung.target; if (Math.abs(tz.x) > HALB || Math.abs(tz.z) > HALB) { const d = new THREE.Vector3(klemme(tz.x, -HALB, HALB) - tz.x, 0, klemme(tz.z, -HALB, HALB) - tz.z); tz.add(d); kamera.position.add(d); }
  }
  himmel.position.copy(kamera.position);
  if (preisSchilder.children.length) { const ka = kameraAbstand(); preisSchilder.children.forEach((s) => { s.scale.set(ka * 0.16, ka * 0.0625, 1); s.position.y = 2 + ka * 0.04; }); }
  renderer.render(szene, kamera);
  fpsBilder++; fpsZeit += dt; if (fpsZeit >= 0.5) { $("fps").textContent = Math.round(fpsBilder / fpsZeit) + " FPS"; fpsBilder = 0; fpsZeit = 0; }
}

/* Los geht's */
qualitaet(stufe);
hauptmenue();
