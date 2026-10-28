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
const KACHEL = 40, KN = 5, HALB = KACHEL * KN / 2;
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
  fuss: { name: "Fußweg", em: "🚶", halb: 0.42, fahr: 0, preis: 15, zellen: false, autos: false, tempo: 0, spuren: [] },
  klein: { name: "Straße", em: "🛣️", halb: 0.68, fahr: 0.42, preis: 60, zellen: true, autos: true, tempo: 2.1, spuren: [0.21] },
  allee: { name: "Allee", em: "🌳", halb: 0.98, fahr: 0.42, preis: 100, zellen: true, autos: true, tempo: 2.1, spuren: [0.21] },
  haupt: { name: "Hauptstraße", em: "🚗", halb: 1.12, fahr: 0.86, preis: 160, zellen: true, autos: true, tempo: 3.1, spuren: [0.22, 0.64] }
};
const KARTEN = {
  insel: { name: "Große Insel", em: "🏝️", text: "Eine große Insel mitten im Meer, mit Leuchtturm und Stränden.", geld: 70000 },
  kueste: { name: "Küste", em: "🏖️", text: "Festland mit langer Küste und einer Bucht. Viel Platz nach hinten.", geld: 70000 },
  seen: { name: "Seenland", em: "🏞️", text: "Wiesen mit vielen Seen. Schön, aber man muss um das Wasser herum planen.", geld: 70000 },
  wald: { name: "Waldtal", em: "🌲", text: "Dichter Wald und zwei Seen. Mehr Startgeld, aber viel zu roden.", geld: 85000 }
};
const MEILEN = [
  { name: "Siedlung", ab: 0, gebiete: 1, geld: 0, frei: [] },
  { name: "Dorf", ab: 200, gebiete: 2, geld: 5000, frei: ["allee"] },
  { name: "Kleinstadt", ab: 600, gebiete: 3, geld: 10000, frei: ["haupt"] },
  { name: "Stadt", ab: 1500, gebiete: 5, geld: 15000, frei: [] },
  { name: "Großstadt", ab: 4000, gebiete: 8, geld: 25000, frei: [] },
  { name: "Metropole", ab: 9000, gebiete: 13, geld: 40000, frei: [] },
  { name: "Weltstadt", ab: 20000, gebiete: 24, geld: 60000, frei: [] }
];
const GEBIET_PREIS = (n) => 15000 + 10000 * n;
const TAG_SEK = 4;   // ein Spieltag dauert bei ▶️ 4 Sekunden
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
function mitFenstern(mat) {
  mat.onBeforeCompile = (s) => {
    s.uniforms.uNacht = U.uNacht; s.uniforms.uDetail = U.uDetail;
    s.vertexShader = "varying vec3 vWP; varying vec3 vWN;\n" + s.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vWP = (instanceMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(instanceMatrix) * objectNormal);
      #else
        vWP = transformed; vWN = objectNormal;
      #endif`);
    s.fragmentShader = "uniform float uNacht; uniform float uDetail; varying vec3 vWP; varying vec3 vWN;\n" + s.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      {
        float seite = 1.0 - step(0.5, abs(vWN.y));
        vec2 nx = normalize(vWN.xz + vec2(1e-5));
        float hk = dot(vWP.xz, vec2(-nx.y, nx.x));
        vec2 zelle = vec2(hk / 0.3, (vWP.y - ${BODEN.toFixed(3)} - 0.08) / 0.36);
        vec2 f = fract(zelle);
        float stock = step(0.0, zelle.y);
        float fenster = step(0.22, f.x) * step(f.x, 0.78) * step(0.24, f.y) * step(f.y, 0.76) * stock * seite;
        float rahmen = step(0.18, f.x) * step(f.x, 0.82) * step(0.19, f.y) * step(f.y, 0.8) * stock * seite * (1.0 - fenster);
        float kreuz = fenster * max(step(abs(f.x - 0.5), 0.02), step(abs(f.y - 0.55), 0.02)) * uDetail;
        vec3 c0 = diffuseColor.rgb;
        float n = fract(sin(dot(floor(vWP * 70.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float ziegel = step(c0.g * 1.15, c0.r) * step(c0.b * 1.25, c0.r) * seite;
        vec2 zq = vec2((hk + step(1.0, mod(floor(vWP.y / 0.034), 2.0)) * 0.04) / 0.08, vWP.y / 0.034);
        float fuge = max(step(fract(zq.x), 0.08), step(fract(zq.y), 0.14));
        float zb = fract(sin(dot(floor(zq), vec2(7.13, 3.71))) * 43758.5);
        diffuseColor.rgb *= mix(1.0, 0.95 + 0.08 * n, uDetail);
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(c0 * (0.82 + 0.26 * zb), vec3(0.8, 0.78, 0.74), fuge), ziegel * uDetail * (1.0 - fenster - rahmen) * 0.9);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.94, 0.93, 0.9), (rahmen * 0.8 + kreuz) * uDetail);
        float sockel = (1.0 - step(0.07, vWP.y - ${BODEN.toFixed(3)})) * seite * uDetail;
        diffuseColor.rgb *= 1.0 - sockel * 0.25;
        float h = fract(sin(dot(floor(zelle) + floor(vWP.xz * 0.37) * 3.1, vec2(12.9898, 78.233))) * 43758.5453);
        float an = step(0.6, h) * uNacht;
        vec3 glas = mix(vec3(0.16, 0.22, 0.3), mix(vec3(0.18, 0.25, 0.34), vec3(0.5, 0.63, 0.76), smoothstep(0.24, 0.76, f.y)), uDetail * 0.55);
        diffuseColor.rgb = mix(diffuseColor.rgb, glas, fenster * (1.0 - kreuz) * 0.78 * (1.0 - an));
        totalEmissiveRadiance += fenster * (1.0 - kreuz) * an * mix(vec3(1.0, 0.66, 0.32), vec3(0.75, 0.85, 1.0), step(0.93, h)) * (0.75 + 0.35 * fract(h * 7.0));
      }`);
  };
  mat.customProgramCacheKey = () => "fenster3";
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
  dach: mitMuster(new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), "dach"),
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
function bunt(g, hex) { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute("uv"); const c = farbe(hex), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } g.setAttribute("color", new THREE.BufferAttribute(a, 3)); return g; }
const G_LAUBBAUM = mergeGeometries([bunt(new THREE.CylinderGeometry(0.05, 0.07, 0.4, 5).translate(0, 0.2, 0), 0x7a5232), bunt(new THREE.IcosahedronGeometry(0.34, 0).scale(1, 1.1, 1).translate(0, 0.62, 0), 0x5fae4a)]);
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
    insel = { a0: 86, h: [[2, 6 + ri() * 3, ri() * 6.283], [3, 4 + ri() * 3, ri() * 6.283], [5, 2.5 + ri() * 2, ri() * 6.283], [7, 1.5 + ri() * 1.5, ri() * 6.283], [11, 0.8 + ri(), ri() * 6.283]] };
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
  const listen = { laub: [], nadel: [] };
  const neu = (x, z, r) => {
    const art = r() < (karte === "wald" ? 0.5 : 0.34) ? "nadel" : "laub", b = { x, z, s: 0.7 + r() * 0.75, ry: r() * 6.28, art, weg: false, c: new THREE.Color(0.82 + r() * 0.18, 0.85 + r() * 0.15, 0.8 + r() * 0.2) };
    b.idx = baeume.length; b.i = listen[art].length; listen[art].push(b); baeume.push(b);
    const k = Math.floor(x / 4) + "," + Math.floor(z / 4); if (!baumRaster.has(k)) baumRaster.set(k, []); baumRaster.get(k).push(b);
  };
  if (karte === "insel") {
    // genau wie in Teil A, damit alte Spielstände passen
    const r = zufall(20261028 + 1);
    for (let gx = -HALB; gx < HALB; gx += 1.5) for (let gz = -HALB; gz < HALB; gz += 1.5) {
      const x = gx + r() * 1.4, z = gz + r() * 1.4; if (!aufLand(x, z, 3.6)) continue;
      const d = 0.5 + 0.5 * Math.sin(x * 0.07 + 1.3) * Math.cos(z * 0.06 - 0.4) + 0.3 * Math.sin((x - z) * 0.13) + 0.15 * Math.sin(x * 0.4 + z * 0.31);
      if (r() > d * 0.85 - 0.12) continue;
      if (Math.abs(x) < 9 && Math.abs(z) < 9 && r() < 0.85) continue;
      neu(x, z, r);
    }
  } else {
    const r = zufall(karte === "kueste" ? 501 : karte === "seen" ? 502 : 503), dicht = karte === "wald" ? 1.1 : karte === "seen" ? 0.68 : 0.8, schritt = karte === "wald" ? 1.7 : 1.7;
    for (let gx = -HALB - 20; gx < HALB + 20; gx += schritt) for (let gz = -HALB - 20; gz < HALB + 20; gz += schritt) {
      const x = gx + r() * schritt * 0.9, z = gz + r() * schritt * 0.9; if (!aufLand(x, z, 3.4)) continue;
      const d = 0.5 + 0.5 * Math.sin(x * 0.06 + 0.7) * Math.cos(z * 0.07 + 1.1) + 0.3 * Math.sin((x + z) * 0.11) + 0.15 * Math.sin(x * 0.37 - z * 0.29);
      if (r() > d * dicht - 0.15) continue;
      if (Math.abs(x) < 9 && Math.abs(z) < 9 && r() < (karte === "wald" ? 0.5 : 0.85)) continue;
      neu(x, z, r);
    }
    // lichter Wald am Horizont
    for (let gx = -190; gx < 190; gx += 4.5) for (let gz = -190; gz < 190; gz += 4.5) {
      if (Math.abs(gx) < HALB + 20 && Math.abs(gz) < HALB + 20) continue;
      const x = gx + r() * 4, z = gz + r() * 4; if (!aufLand(x, z, 3) || r() > 0.38) continue; neu(x, z, r);
    }
  }
  for (const art of ["laub", "nadel"]) {
    const m = new THREE.InstancedMesh(art === "laub" ? G_LAUBBAUM : G_NADELBAUM, M.baum, Math.max(1, listen[art].length));
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
let besitz = new Set(["2,2"]), gekauft = 0, geld = 70000;
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
  const erlaubt = MEILEN[meilenstein].gebiete, preis = GEBIET_PREIS(gekauft);
  for (let i = 0; i < KN; i++) for (let j = 0; j < KN; j++) {
    if (besitz.has(i + "," + j) || !kachelHatLand(i, j)) continue;
    const m = kachelMitte(i, j), p = new THREE.Mesh(sperrGeo, M.sperre); p.position.set(m.x, G + 0.09, m.z); p.renderOrder = 4; sperrFlaechen.add(p);
    if (!kaufbar(i, j)) continue;
    let s;
    if (gekauft >= erlaubt) { const n = MEILEN.find((x) => x.gebiete > gekauft); s = schild("🔒 " + (n ? n.name : "–"), n ? "ab " + zahl(n.ab) + " Einwohnern" : "", false); }
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
function strassenFrei(p, ausser) { let m = 1e9; for (const k of kanten.values()) { if (k === ausser || !nahHuelle(k.h, p, Math.min(m, 5) + 1.5)) continue; m = Math.min(m, abstandZuLinie(p, k.pts) - TYP[k.typ].halb); } return m; }

const SF = { gehweg: farbe(0xcbc6ba), fahrbahn: farbe(0x3b4049), strich: farbe(0xf1eee4), gelb: farbe(0xf2c14e), gruen: farbe(0x7dbb55), weg: farbe(0xd8c7a0) };
function band(pos, col, pts, halb, y, c, versatz) {
  versatz = versatz || 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], anx = -a.tz, anz = a.tx, bnx = -b.tz, bnz = b.tx;
    const alx = a.x + anx * (versatz + halb), alz = a.z + anz * (versatz + halb), arx = a.x + anx * (versatz - halb), arz = a.z + anz * (versatz - halb);
    const blx = b.x + bnx * (versatz + halb), blz = b.z + bnz * (versatz + halb), brx = b.x + bnx * (versatz - halb), brz = b.z + bnz * (versatz - halb);
    pos.push(alx, y, alz, blx, y, blz, arx, y, arz, arx, y, arz, blx, y, blz, brx, y, brz);
    for (let v = 0; v < 6; v++) col.push(c.r, c.g, c.b);
  }
}
function striche(pos, col, k, versatz, c, lang, luecke) { for (let s = 1.0; s < k.len - 1.0; s += lang + luecke) { const a = punktBei(k, s), b = punktBei(k, Math.min(s + lang, k.len - 0.9)); band(pos, col, [a, b], 0.03, G + 0.024, c, versatz); } }
function linie(pos, col, k, versatz, c) { const a = k.pts.filter((p) => p.s > 0.9 && p.s < k.len - 0.9); if (a.length > 1) band(pos, col, a, 0.03, G + 0.024, c, versatz); }
function scheibe(pos, col, x, z, r, y, c) { const n = 24; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2; pos.push(x, y, z, x + Math.cos(b) * r, y, z + Math.sin(b) * r, x + Math.cos(a) * r, y, z + Math.sin(a) * r); for (let v = 0; v < 3; v++) col.push(c.r, c.g, c.b); } }
function geoAus(pos, col) { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g; }
function kantenMesh(k) {
  const T = TYP[k.typ], pos = [], col = [];
  if (k.typ === "fuss") band(pos, col, k.pts, T.halb, G + 0.014, SF.weg);
  else {
    band(pos, col, k.pts, T.halb, G + 0.012, SF.gehweg);
    if (k.typ === "allee") band(pos, col, k.pts, 0.78, G + 0.016, SF.gruen);
    band(pos, col, k.pts, T.fahr, G + 0.02, SF.fahrbahn);
    if (k.typ === "haupt") { linie(pos, col, k, 0.05, SF.gelb); linie(pos, col, k, -0.05, SF.gelb); striche(pos, col, k, 0.43, SF.strich, 0.45, 0.65); striche(pos, col, k, -0.43, SF.strich, 0.45, 0.65); }
    else striche(pos, col, k, 0, SF.strich, 0.5, 0.6);
  }
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
function neueKante(aId, bId, c, typ, id) {
  const a = knoten.get(aId), b = knoten.get(bId), { pts, len } = abtasten(a, c, b);
  const k = { id: id || kId++, a: aId, b: bId, c: { x: c.x, z: c.z }, typ, pts, len, h: huelle(pts, TYP[typ].halb), stau: 0 }; kId = Math.max(kId, k.id + 1);
  k.mesh = kantenMesh(k); szene.add(k.mesh); kanten.set(k.id, k); a.kanten.add(k.id); b.kanten.add(k.id);
  knotenNeuZeichnen(a); knotenNeuZeichnen(b); return k;
}
function kanteWeg(k) {
  szene.remove(k.mesh); k.mesh.geometry.dispose(); kanten.delete(k.id);
  for (const nid of [k.a, k.b]) { const n = knoten.get(nid); if (!n) continue; n.kanten.delete(k.id); if (!n.kanten.size) knotenWeg(n); else knotenNeuZeichnen(n); }
}
function kanteTeilen(k, t) {
  const a = knoten.get(k.a), b = knoten.get(k.b), m = bez(a, k.c, b, t), n = neuerKnoten(m);
  const c1 = lerp(a, k.c, t), c2 = lerp(k.c, b, t), aId = k.a, bId = k.b, typ = k.typ, ax = { x: a.x, z: a.z }, bx = { x: b.x, z: b.z };
  kanteWeg(k); if (!knoten.has(aId)) neuerKnoten(ax, aId); if (!knoten.has(bId)) neuerKnoten(bx, bId);
  const aus = k.aussen; const e1 = neueKante(aId, n.id, c1, typ), e2 = neueKante(n.id, bId, c2, typ); if (aus) e1.aussen = e2.aussen = true; return n;
}
const fangRadius = () => Math.min(3, Math.max(1.1, kameraAbstand() / 32));
function naechsterKnoten(p, r) { let best = null, bd = r; for (const n of knoten.values()) { const d = abst(n, p); if (d < bd) { bd = d; best = n; } } return best; }
function naechsteKante(p, r, filter) { let best = null; for (const k of kanten.values()) { if ((filter && !filter(k)) || !nahHuelle(k.h, p, r)) continue; const e = abstandZuLinie(p, k.pts, true); if (e.d < r && (!best || e.d < best.d)) best = { k, ...e }; } return best; }
function fangen(p) {
  const r = fangRadius();
  const n = naechsterKnoten(p, r); if (n) return { art: "knoten", id: n.id, x: n.x, z: n.z };
  const e = naechsteKante(p, r * 0.8); if (e) return { art: "kante", id: e.k.id, x: e.x, z: e.z };
  return { art: "frei", x: p.x, z: p.z };
}
function knotenFuer(p) {
  const n = naechsterKnoten(p, 0.6); if (n) return n;
  const e = naechsteKante(p, 0.6);
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
    if (k.h.x1 < h.x0 || k.h.x0 > h.x1 || k.h.z1 < h.z0 || k.h.z0 > h.z1) continue;
    for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < k.pts.length - 1; j++) {
      const s = schnitt(pts[i], pts[i + 1], k.pts[j], k.pts[j + 1]);
      if (s && !ausserNah.some((q) => abst(q, s) < 1.0)) liste.push({ t: pts[i].t + (pts[i + 1].t - pts[i].t) * s.ua, x: s.x, z: s.z });
    }
  }
  liste.sort((a, b) => a.t - b.t);
  return liste.filter((q, i) => !liste.slice(0, i).some((o) => abst(o, q) < 1.5));
}
function typFrei(t) { return MEILEN.slice(0, meilenstein + 1).some((m) => m.frei.includes(t)) || t === "fuss" || t === "klein"; }
function planen(A, C, Bp, typ) {
  const T = TYP[typ], { pts, len } = abtasten(A, C, Bp), plan = { A, C, B: Bp, typ, pts, laenge: len, kosten: Math.round(len * T.preis), kreuz: [], ok: true, grund: "" };
  const nein = (g) => { plan.ok = false; plan.grund = plan.grund || g; };
  if (!typFrei(typ)) { const m = MEILEN.find((x) => x.frei.includes(typ)); nein("🔒 Erst ab " + m.name + " (" + zahl(m.ab) + " Einwohner)"); }
  if (len < 1.5) nein("Zu kurz");
  if (len > 90) nein("Zu lang – setz einen Zwischenpunkt");
  for (const q of pts) { if (!aufLand(q.x, q.z, 3.5)) { nein("Zu nah am Wasser"); break; } if (!imBesitz(q.x, q.z)) { nein("Außerhalb deiner Gebiete – kauf erst Land"); break; } }
  for (let i = 1; i < pts.length - 1 && plan.ok; i++) { const a = pts[i - 1], b = pts[i + 1]; if (a.tx * b.tx + a.tz * b.tz < 0.55 && abst(a, b) < 1.2) nein("Kurve zu eng"); }
  if (plan.ok) {
    plan.kreuz = kreuzungen(pts, [A, Bp]);
    const rx = 1.2 + (T.halb + 1.05) * 1.6, frei = (q) => ![A, Bp].concat(plan.kreuz).some((e) => abst(e, q) < rx);
    for (const q of pts) if (frei(q) && strassenFrei(q) < T.halb - 0.15) { nein("Zu nah an einer anderen Straße"); break; }
  }
  if (plan.ok && A.art === "knoten" && Bp.art === "knoten" && A.id === Bp.id) nein("Start und Ende sind gleich");
  if (plan.ok) { let baum = 0; baeumeIn(plan.pts.reduce((m, q) => Math.min(m, q.x), 1e9) - 2, plan.pts.reduce((m, q) => Math.min(m, q.z), 1e9) - 2, plan.pts.reduce((m, q) => Math.max(m, q.x), -1e9) + 2, plan.pts.reduce((m, q) => Math.max(m, q.z), -1e9) + 2, (b) => { if (!b.weg && abstandZuLinie(b, plan.pts) < T.halb + 0.3) baum++; }); plan.baeume = baum; plan.kosten += baum * 5; }
  if (plan.ok && plan.kosten > geld) nein("Nicht genug Geld");
  return plan;
}
function bauen(plan) {
  const typ = plan.typ, n0 = knotenFuer(plan.A), n2 = knotenFuer(plan.B), neu = [];
  if (n0 === n2) return [];
  const { pts } = abtasten(n0, plan.C, n2), C = plan.C;
  const kr = kreuzungen(pts, [n0, n2]).map((q) => ({ t: q.t, n: knotenFuer(q) })).filter((q) => q.n !== n0 && q.n !== n2);
  const ts = [0].concat(kr.map((q) => q.t), [1]), ns = [n0].concat(kr.map((q) => q.n), [n2]);
  for (let j = 0; j < ns.length - 1; j++) {
    const ta = ts[j], tb = ts[j + 1];
    const c = { x: (1 - ta) * (1 - tb) * n0.x + ((1 - ta) * tb + ta * (1 - tb)) * C.x + ta * tb * n2.x, z: (1 - ta) * (1 - tb) * n0.z + ((1 - ta) * tb + ta * (1 - tb)) * C.z + ta * tb * n2.z };
    if (ns[j] === ns[j + 1] || abst(ns[j], ns[j + 1]) < 0.6) continue;
    if ([...ns[j].kanten].some((id) => { const k = kanten.get(id); return (k.a === ns[j].id && k.b === ns[j + 1].id) || (k.b === ns[j].id && k.a === ns[j + 1].id); })) continue;
    neu.push(neueKante(ns[j].id, ns[j + 1].id, c, typ));
  }
  for (const n of [n0, n2]) if (knoten.has(n.id) && !n.kanten.size) knotenWeg(n);
  for (const k of neu) {
    const T = TYP[k.typ];
    for (const z of zellenIn(k.h)) if (abstandZuLinie(z, k.pts) < T.halb + 0.45) zelleWeg(z);
    baeumeFaellen(k.h, (x, z) => abstandZuLinie({ x, z }, k.pts) < T.halb + 0.3);
  }
  for (const k of neu) zellenFuer(k);
  if (neu.length) { geld -= plan.kosten; zeigeWerte(); }
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
  const T = TYP[k.typ]; if (!T.zellen) return;
  const n = Math.floor((k.len - 1.9) / ZELLE); if (n < 1) return;
  const rand = (k.len - n * ZELLE) / 2, g = gId++;
  for (let i = 0; i < n; i++) {
    const p = punktBei(k, rand + (i + 0.5) * ZELLE), nx = -p.tz, nz = p.tx;
    for (const seite of [1, -1]) for (let r = 0; r < REIHEN; r++) {
      const d = T.halb + ZELLE / 2 + 0.02 + r * ZELLE, x = p.x + nx * seite * d, z = p.z + nz * seite * d;
      if (!aufLand(x, z, 3.6) || !imBesitz(x, z) || strassenFrei({ x, z }) < 0.45 || zellenNahe(x, z, 0.86).length || inDienst(x, z, 0.35)) break;
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
const B = {
  haus: becken(G_BOX_UNTEN, M.haus, 9000, true), flach: becken(G_BOX_UNTEN, M.flach, 14000, true), dach: becken(G_DACH, M.dach, 6000, true),
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
function hausTeile(h) {
  const r = zufall(h.variante * 31 + h.stufe * 7919), W = h.w * ZELLE, D = h.d * ZELLE, T = [], vorn = D / 2 - 0.1, Z = ZONEN[h.zone];
  const box = (b, lx, lz, w, hh, d, c, ex) => T.push(Object.assign({ b, lx, ly: 0, lz, sx: w, sy: hh, sz: d, c }, ex || {}));
  const baum = (lx, lz, g, y) => box("garten", lx, lz, g, g, g, null, { rund: true, ly: y || 0 });
  const giebel = (lx, lz, w, d, y, c, quer, hoch) => box("dach", lx, lz, (quer ? d : w) + 0.1, hoch || 0.28 + r() * 0.1, (quer ? w : d) + 0.1, c, { ly: y, ry: quer ? Math.PI / 2 : 0 });
  const walm = (lx, lz, w, d, y, c, hoch) => { const hh = hoch || 0.3; giebel(lx, lz, w, d, y, c, false, hh); giebel(lx, lz, w, d, y, c, true, hh); };
  const flachdach = (lx, lz, w, d, y, c) => box("flach", lx, lz, w + 0.05, 0.035, d + 0.05, c || 0xe5e2da, { ly: y });
  const balkone = (lx, lz, w, d, hh) => { for (let y = 0.3; y < hh - 0.15; y += 0.32) box("flach", lx, lz + d / 2 + 0.035, w * 0.84, 0.025, 0.07, 0xf2efe8, { ly: y }); };
  const markise = (lx, w, c, z) => box("flach", lx, z == null ? vorn - 0.02 : z, w * 0.92, 0.05, 0.18, c, { ly: 0.33 });
  const pool = (lx, lz, w, d) => box("flach", lx, lz, w, 0.014, d, 0x5fc8e8, { ly: 0.002 });
  const schild = (lx, lz, w, c, y) => box("flach", lx, lz, w, 0.1, 0.02, c, { ly: y });
  const parkplatz = (lx, lz, w, d, n) => { box("flach", lx, lz, w, 0.006, d, 0x55595f, { ly: 0.004 }); for (let k = 0; k < n; k++) box("flach", lx - w / 2 + (k + 0.5) * w / n, lz, 0.13, 0.1, 0.22, PAL.auto[(h.variante + k * 3) % PAL.auto.length], { ly: 0.01 }); };
  const zyl = (lx, lz, d, hh, c, ex) => box("zyl", lx, lz, d, hh, d, c, ex);
  const pk = (a) => a[Math.floor(r() * a.length)];
  const HAUS = PAL.haus, DACH = PAL.dach, BLOCK = PAL.block, TURM = PAL.turm, HALLE = PAL.halle, MARK = PAL.markise;
  box("flach", 0, 0, W * 0.97, 0.008, D * 0.97, Z.boden, { fest: true });
  const L = {
    1: [ // Wohnen niedrig
      [() => { const w = 0.6, d = 0.55, hh = 0.42, lz = vorn - d / 2 - 0.1; box("haus", 0, lz, w, hh, d, 0xb98a5e); giebel(0, lz, w, d, hh, 0x5a4636); if (D >= 2) { box("flach", 0.25, lz - d / 2 - 0.45, 0.22, 0.18, 0.2, 0x8a6a4a); baum(-0.25, lz - d / 2 - 0.5, 0.55); } return "Holzhaus"; },
       () => { const n = W >= 2 ? 2 : 1; for (let k = 0; k < n; k++) { const w = 0.62, d = 0.58, hh = 0.46, lx = n === 2 ? (k ? 0.5 : -0.5) : 0, lz = vorn - d / 2 - 0.1; box("haus", lx, lz, w, hh, d, pk(HAUS)); giebel(lx, lz, w, d, hh, pk(DACH), r() < 0.4); if (D >= 2) baum(lx, lz - d / 2 - 0.5, 0.5); } return "Siedlungshaus"; },
       () => { const w = Math.min(W * 0.8, 0.8), d = 0.55, hh = 0.34, lz = vorn - d / 2 - 0.1; box("haus", 0, lz, w, hh, d, pk(HAUS)); flachdach(0, lz, w, d, hh); if (D >= 2) baum(0, lz - d / 2 - 0.5, 0.6); return "Kleiner Bungalow"; }],
      [() => { const w = 0.58, d = 0.6, hh = 0.5, lz = vorn - d / 2 - 0.08, lx = -0.13; box("haus", lx, lz, w, hh, d, pk(HAUS)); giebel(lx, lz, w, d, hh, pk(DACH)); box("flach", lx + w / 2 + 0.16, vorn - 0.25, 0.3, 0.26, 0.42, 0xd9d4ca); if (D >= 2) baum(0, lz - d / 2 - 0.5, 0.6); return "Haus mit Garage"; },
       () => { const w = Math.min(W * 0.86, 1.6), d = 0.64, hh = 0.55, lz = vorn - d / 2 - 0.08; box("haus", -w / 4, lz, w / 2, hh, d, pk(HAUS)); box("haus", w / 4, lz, w / 2, hh, d, pk(HAUS)); giebel(0, lz, w, d, hh, pk(DACH)); if (D >= 2) { baum(-w / 4, lz - d / 2 - 0.5, 0.5); baum(w / 4, lz - d / 2 - 0.55, 0.45); } return "Doppelhaus"; },
       () => { const w = 0.66, d = 0.6, hh = 0.55, lz = vorn - d / 2 - 0.15, c = pk(HAUS); box("haus", 0, lz, w, hh, d, c); giebel(0, lz, w, d, hh, pk(DACH)); box("haus", 0.12, lz + d / 2 + 0.1, 0.28, 0.42, 0.2, c); giebel(0.12, lz + d / 2 + 0.1, 0.28, 0.2, 0.42, pk(DACH), true, 0.18); if (D >= 2) baum(-0.2, lz - d / 2 - 0.5, 0.55); return "Haus mit Erker"; }],
      [() => { const w = Math.min(W * 0.8, 0.95), d = 0.6, hh = 0.36, lz = vorn - d / 2 - 0.1; box("haus", 0, lz, w, hh, d, pk(HAUS)); flachdach(0, lz, w, d, hh); if (D >= 2) { pool(0.15, lz - d / 2 - 0.45, 0.42, 0.3); baum(-0.3, lz - d / 2 - 0.5, 0.55); } return "Bungalow mit Pool"; },
       () => { const w = 0.7, d = 0.62, hh = 0.82, lz = vorn - d / 2 - 0.1; box("haus", 0, lz, w, hh, d, pk(HAUS)); giebel(0, lz, w, d, hh, pk(DACH), false, 0.38); if (D >= 2) baum(0.1, lz - d / 2 - 0.5, 0.6); return "Stadthaus"; },
       () => { const w = 0.62, d = 0.6, hh = 0.56, lz = vorn - d / 2 - 0.1; box("haus", -0.12, lz, w, hh, d, pk(HAUS)); giebel(-0.12, lz, w, d, hh, pk(DACH)); box("flach", 0.34, lz, 0.3, 0.32, 0.45, 0xbfe3ef); if (D >= 2) baum(0, lz - d / 2 - 0.5, 0.6); return "Haus mit Wintergarten"; }],
      [() => { const lz = vorn - 0.38, c = 0xf4f2ee; box("haus", 0, lz, Math.min(W * 0.85, 0.95), 0.4, 0.6, c); flachdach(0, lz, Math.min(W * 0.85, 0.95), 0.6, 0.4, 0xd9d6cf); box("haus", -0.12, lz - 0.05, 0.55, 0.35, 0.45, c, { ly: 0.44 }); flachdach(-0.12, lz - 0.05, 0.55, 0.45, 0.79, 0xd9d6cf); if (D >= 2) { pool(0.05, lz - 0.75, 0.6, 0.3); baum(0.35, lz - 0.8, 0.5); } return "Moderne Villa"; },
       () => { const lz = vorn - 0.32, c = pk(HAUS), dc = pk(DACH); box("haus", 0, lz, Math.min(W * 0.85, 0.9), 0.5, 0.48, c); giebel(0, lz, Math.min(W * 0.85, 0.9), 0.48, 0.5, dc); if (D >= 2) { box("haus", -0.3, lz - 0.5, 0.36, 0.5, 0.55, c); giebel(-0.3, lz - 0.5, 0.36, 0.55, 0.5, dc, true); baum(0.3, lz - 0.7, 0.6); } return "Landhaus"; }],
      [() => { const lz = vorn - 0.4, c = 0xf6f4f0; box("haus", 0, lz, Math.min(W * 0.9, 1.6), 0.42, 0.62, c); flachdach(0, lz, Math.min(W * 0.9, 1.6), 0.62, 0.42, 0xcfcac2); box("haus", W >= 2 ? 0.3 : 0.1, lz, 0.6, 0.38, 0.5, c, { ly: 0.46 }); box("flach", 0, lz + 0.32, Math.min(W * 0.9, 1.6) * 0.8, 0.12, 0.02, 0x7fa3b8, { ly: 0.18 }); if (D >= 2) { pool(-0.1, lz - 0.85, 0.7, 0.32); baum(-W * 0.35, lz - 0.85, 0.6); baum(W * 0.35, lz - 0.9, 0.55); } return "Luxusvilla"; },
       () => { const lz = vorn - 0.35, c = pk(HAUS), dc = pk(DACH); box("haus", -0.1, lz, 0.7, 0.62, 0.55, c); walm(-0.1, lz, 0.7, 0.55, 0.62, dc, 0.3); box("haus", 0.33, lz + 0.1, 0.24, 1.05, 0.24, c); walm(0.33, lz + 0.1, 0.24, 0.24, 1.05, dc, 0.25); if (D >= 2) { baum(-0.3, lz - 0.7, 0.6); pool(0.2, lz - 0.7, 0.4, 0.25); } return "Villa mit Turm"; }]
    ],
    2: [ // Wohnen hoch
      [() => { const w = W * 0.85, d = Math.min(D * 0.6, 1.1), hh = 1.0, lz = vorn - d / 2 - 0.06; box("haus", 0, lz, w, hh, d, pk(BLOCK)); giebel(0, lz, w, d, hh, pk(DACH), false, 0.36); return "Altbau-Mietshaus"; },
       () => { const w = W * 0.85, d = Math.min(D * 0.6, 1.0), hh = 0.95, lz = vorn - d / 2 - 0.06; box("haus", 0, lz, w, hh, d, 0xd8d4c8); flachdach(0, lz, w, d, hh); balkone(0, lz, w, d, hh); return "Plattenbau"; }],
      [() => { const w = W * 0.85, d = Math.min(D * 0.62, 1.2), hh = 1.25, lz = vorn - d / 2 - 0.06; box("haus", 0, lz, w, hh, d, pk(BLOCK)); flachdach(0, lz, w, d, hh); balkone(0, lz, w, d, hh); baum(-W * 0.3, -D / 2 + 0.4, 0.55); return "Mehrfamilienhaus"; },
       () => { const n = Math.max(3, Math.round(W / 0.4)), bw = W * 0.9 / n, d = Math.min(D * 0.55, 0.85), hh = 0.72, lz = vorn - d / 2 - 0.06, dc = pk(DACH); for (let k = 0; k < n; k++) { const lx = -W * 0.45 + bw * (k + 0.5); box("haus", lx, lz, bw - 0.01, hh, d, HAUS[(h.variante + k) % HAUS.length]); box("dach", lx, lz, bw + 0.005, 0.28, d + 0.08, dc, { ly: hh }); } return "Reihenhäuser"; }],
      [() => { const w = W * 0.86, d = D * 0.72, hh = 1.6 + r() * 0.5, lz = vorn - d / 2 - 0.04; box("haus", 0, lz, w, hh, d, pk(BLOCK)); flachdach(0, lz, w, d, hh); balkone(0, lz, w, d, hh); return "Wohnblock"; },
       () => { const c = pk(BLOCK), hh = 1.3 + r() * 0.4, d1 = 0.7, lz1 = vorn - d1 / 2 - 0.04; box("haus", 0, lz1, W * 0.86, hh, d1, c); const wd = Math.max(0.5, D - d1 - 0.3); box("haus", -W * 0.43 + 0.35, lz1 - d1 / 2 - wd / 2, 0.7, hh * 0.85, wd, c); baum(W * 0.2, lz1 - d1 / 2 - 0.6, 0.6); return "Wohnanlage"; }],
      [() => { const s0 = Math.min(W, D) * 0.62, hh = 2.6 + r() * 1.2, lz = vorn - D * 0.42, c = pk(BLOCK); box("haus", 0, lz, s0, hh, s0, c); balkone(0, lz, s0, s0, hh); box("haus", 0, lz, s0 * 0.7, 0.3, s0 * 0.7, c, { ly: hh }); baum(-W * 0.35, vorn - 0.25, 0.45); return "Hochhaus"; },
       () => { const s0 = Math.min(W, D) * 0.6, hh = 2.4 + r() * 1.0, lz = vorn - D * 0.42; box("haus", 0, lz, s0, hh, s0, pk(BLOCK)); flachdach(0, lz, s0, s0, hh, 0x7dbb55); baum(-s0 * 0.25, lz, 0.4, hh + 0.03); baum(s0 * 0.25, lz + 0.1, 0.35, hh + 0.03); return "Wohnturm mit Dachgarten"; }],
      [() => { const s0 = Math.min(W, D) * 0.55, hh = 4.2 + r() * 1.8, lz = vorn - D * 0.42, c = pk(TURM); box("haus", 0, lz, s0, hh, s0, c); box("haus", 0, lz, s0 * 0.7, 0.4, s0 * 0.7, c, { ly: hh }); box("flach", s0 * 0.15, lz, 0.03, 0.8, 0.03, 0xc9ced6, { ly: hh + 0.4 }); return "Wohn-Wolkenkratzer"; },
       () => { const c = pk(TURM); if (W >= 3) { for (const lx of [-W * 0.22, W * 0.22]) { box("haus", lx, vorn - D * 0.42, 0.85, 3.6 + r() * 0.8, 0.85, c); } box("flach", 0, vorn - D * 0.42, W * 0.3, 0.12, 0.3, 0xd9dde2, { ly: 2.0 }); return "Zwillingstürme"; } const s0 = Math.min(W, D) * 0.6; box("haus", 0, vorn - D * 0.42, s0, 3.8, s0, c); return "Wohnturm"; }]
    ],
    3: [ // Gewerbe niedrig
      [() => { const lz = vorn - 0.3; box("haus", 0, lz, 0.4, 0.38, 0.35, 0xf2efe8); markise(0, 0.45, pk(MARK), lz + 0.2); return "Kiosk"; },
       () => { const w = Math.min(W * 0.8, 0.8), d = 0.6, lz = vorn - d / 2 - 0.05; box("haus", 0, lz, w, 0.5, d, 0xe9d8bd); markise(0, w, 0x8a5a3a); schild(0, vorn + 0.01, w * 0.5, 0xf2c14e, 0.42); return "Bäckerei"; },
       () => { const w = Math.min(W * 0.7, 0.75), d = 0.5, hh = 0.48, lz = vorn - d / 2 - 0.32; box("haus", 0, lz, w, hh, d, pk(PAL.laden)); box("flach", 0, lz + d / 2 + 0.06, w * 0.95, 0.04, 0.14, pk(MARK), { ly: 0.3 }); const sc = pk(MARK); for (const px of [-0.28, 0, 0.28]) { box("flach", px, vorn - 0.1, 0.015, 0.22, 0.015, 0xdddddd); box("dach", px, vorn - 0.1, 0.2, 0.06, 0.2, sc, { ly: 0.22 }); } return "Café"; }],
      [() => { const lz = vorn - 0.38, w = Math.min(W * 0.9, 0.95); box("flach", 0, lz, w, 0.05, 0.6, 0xf4f4f4, { ly: 0.42 }); box("flach", 0, lz + 0.31, w, 0.06, 0.02, 0xe8493f, { ly: 0.4 }); for (const px of [-0.35, 0.35]) for (const pz of [-0.22, 0.22]) box("flach", px * Math.min(W, 1), lz + pz, 0.04, 0.42, 0.04, 0xd9d9d9); for (const px of [-0.15, 0.15]) box("flach", px, lz, 0.07, 0.15, 0.1, 0xe8493f); if (D >= 2) box("haus", 0, lz - 0.55, 0.55, 0.36, 0.32, 0xf2efe8); return "Tankstelle"; },
       () => { const w = Math.min(W * 0.8, 0.85), d = 0.62, lz = vorn - d / 2 - 0.25; box("haus", 0, lz, w, 0.52, d, 0xc96f4a); giebel(0, lz, w, d, 0.52, 0x5d6470); zyl(w * 0.3, lz - 0.15, 0.08, 0.95, 0x8a6a5a); const sc = pk(MARK); for (const px of [-0.25, 0.25]) { box("flach", px, vorn - 0.08, 0.015, 0.2, 0.015, 0xdddddd); box("dach", px, vorn - 0.08, 0.18, 0.05, 0.18, sc, { ly: 0.2 }); } return "Restaurant"; },
       () => { const w = Math.min(W * 0.85, 0.85), d = 0.62, lz = vorn - d / 2 - 0.05; box("haus", 0, lz, w, 0.82, d, pk(HAUS)); markise(0, w, pk(MARK)); giebel(0, lz, w, d, 0.82, pk(DACH)); return "Laden mit Wohnung"; }],
      [() => { const w = W * 0.85, d = Math.min(D * 0.75, 0.9), hh = 1.05, lz = vorn - d / 2 - 0.04; box("haus", 0, lz, w, hh, d, pk(PAL.laden)); box("flach", 0, lz + d / 2 + 0.01, w * 0.9, 0.22, 0.02, 0x7fb8e0, { ly: 0.06 }); flachdach(0, lz, w, d, hh); return "Boutiquenhaus"; },
       () => { const w = W * 0.85, d = Math.min(D * 0.75, 0.9), hh = 1.15, lz = vorn - d / 2 - 0.06; box("haus", 0, lz, w, hh, d, pk(BLOCK)); schild(0, lz + d / 2 + 0.01, 0.4, 0xf2c14e, hh - 0.18); box("flach", 0, lz + d / 2 + 0.1, 0.32, 0.04, 0.2, 0x2f3540, { ly: 0.3 }); return "Kleines Hotel"; },
       () => { const n = W >= 2 ? 3 : 2, bw = W * 0.9 / n, d = Math.min(D * 0.75, 0.8), lz = vorn - d / 2 - 0.04; for (let k = 0; k < n; k++) { const lx = -W * 0.45 + bw * (k + 0.5); box("haus", lx, lz, bw - 0.02, 0.62, d, PAL.laden[(h.variante + k) % PAL.laden.length]); markise(lx, bw, MARK[(h.variante + k) % MARK.length]); } return "Ladenzeile"; }]
    ],
    4: [ // Gewerbe hoch
      [() => { const d = Math.min(D * 0.5, 0.9), lz = -D / 2 + d / 2 + 0.12; box("haus", 0, lz, W * 0.9, 0.5, d, 0xeeeae2); schild(0, lz + d / 2 + 0.01, W * 0.6, pk(MARK), 0.34); parkplatz(0, vorn - (D - d - 0.3) / 2, W * 0.9, Math.max(0.4, D - d - 0.3), Math.max(2, Math.floor(W * 2))); return "Supermarkt"; },
       () => { const w = W * 0.86, d = D * 0.7, hh = 1.2 + r() * 0.4, lz = vorn - d / 2 - 0.04; box("haus", 0, lz, w, hh, d, pk(PAL.laden)); markise(0, w, pk(MARK)); flachdach(0, lz, w, d, hh); return "Geschäftshaus"; }],
      [() => { const w = W * 0.88, d = D * 0.75, hh = 1.2 + r() * 0.4, lz = vorn - d / 2 - 0.04; box("haus", 0, lz, w, hh, d, 0xe6dccb); box("flach", 0, lz + d / 2 + 0.01, w * 0.96, 0.16, 0.02, 0x7fb8e0, { ly: 0.25 }); schild(0, lz + d / 2 + 0.01, w * 0.5, pk(MARK), hh - 0.16); return "Kaufhaus"; },
       () => { const w = W * 0.8, d = Math.min(D * 0.7, 1.6), hh = 1.6 + r() * 0.6, lz = vorn - d / 2 - 0.08; box("haus", 0, lz, w, hh, d, pk(BLOCK)); box("flach", 0, lz + d / 2 + 0.1, 0.42, 0.04, 0.22, 0x2f3540, { ly: 0.3 }); schild(0, lz + d / 2 + 0.01, 0.5, 0xf2c14e, hh - 0.2); return "Hotel"; }],
      [() => { const w = W * 0.9, d = D * 0.62, lz = -D / 2 + d / 2 + 0.1; box("haus", 0, lz, w, 0.75, d, 0xe9e4da); box("flach", 0, lz, w * 0.5, 0.18, d * 0.5, 0xa9d4ea, { ly: 0.75 }); schild(0, lz + d / 2 + 0.01, w * 0.4, pk(MARK), 0.55); parkplatz(0, vorn - 0.25, w, 0.4, Math.max(3, Math.floor(W * 2))); return "Einkaufszentrum"; },
       () => { const c = pk(TURM), lz = vorn - D * 0.45; box("haus", 0, lz, W * 0.86, 0.6, D * 0.7, 0xe6dccb); box("haus", 0, lz - 0.1, Math.min(W, D) * 0.5, 2.8 + r() * 1.2, Math.min(W, D) * 0.5, c, { ly: 0.6 }); schild(0, lz + D * 0.35 + 0.01, 0.6, 0xf2c14e, 0.45); return "Hotelturm"; }]
    ],
    5: [ // Büros
      [() => { const w = W * 0.82, d = D * 0.7, hh = 1.0 + r() * 0.3, lz = vorn - d / 2 - 0.06; box("haus", 0, lz, w, hh, d, 0xc9ced3); for (let y = 0.2; y < hh; y += 0.32) box("flach", 0, lz + d / 2 + 0.005, w * 0.98, 0.1, 0.01, 0x6f93ab, { ly: y }); flachdach(0, lz, w, d, hh); return "Bürohaus"; },
       () => { const w = W * 0.82, d = D * 0.7, hh = 1.2 + r() * 0.4, lz = vorn - d / 2 - 0.06; box("haus", 0, lz, w, hh, d, 0x8fb3c9); flachdach(0, lz, w, d, hh, 0xb9c4cc); return "Bürogebäude mit Glasfront"; }],
      [() => { const c = pk(TURM), d = D * 0.36; box("haus", -W * 0.22, vorn - d / 2 - 0.05, W * 0.4, 1.6, d, c); box("haus", W * 0.22, -D / 2 + d / 2 + 0.1, W * 0.4, 1.9, d, c); box("flach", 0, 0, 0.3, 0.12, D * 0.5, 0xd9dde2, { ly: 1.0 }); return "Bürokomplex"; },
       () => { const s0 = Math.min(W, D) * 0.7, hh = 2.0 + r() * 0.6, lz = vorn - D * 0.45; box("haus", 0, lz, s0, hh, s0, pk(TURM)); box("flach", 0, lz, s0 * 0.5, 0.2, s0 * 0.5, 0x9aa0a8, { ly: hh }); return "Glasbürohaus"; }],
      [() => { const s0 = Math.min(W, D) * 0.62, hh = 4.0 + r() * 1.6, lz = vorn - D * 0.45, c = pk(TURM); box("haus", 0, lz, s0, hh, s0, c); box("haus", 0, lz, s0 * 0.72, 0.5, s0 * 0.72, c, { ly: hh }); box("flach", 0, lz, 0.03, 0.9, 0.03, 0xc9ced6, { ly: hh + 0.5 }); return "Wolkenkratzer"; },
       () => { const c = pk(TURM), lz = vorn - D * 0.45; let y = 0, sz = Math.min(W, D) * 0.78; for (let k = 0; k < 4; k++) { const hh = 1.0 + r() * 0.9; box("haus", 0, lz, sz, hh, sz, c, { ly: y }); y += hh; sz *= 0.78; } box("flach", 0, lz, 0.03, 0.6, 0.03, 0xc9ced6, { ly: y }); return "Gestufter Glasturm"; },
       () => { const c = pk(TURM); if (W >= 3) { for (const lx of [-W * 0.22, W * 0.22]) box("haus", lx, vorn - D * 0.45, 0.8, 3.6 + r() * 0.6, 0.8, c); box("flach", 0, vorn - D * 0.45, W * 0.32, 0.14, 0.3, 0xd9dde2, { ly: 2.4 }); return "Zwillingstürme"; } box("haus", 0, vorn - D * 0.45, Math.min(W, D) * 0.6, 3.6, Math.min(W, D) * 0.6, c); return "Büroturm"; }]
    ],
    6: [ // Industrie
      [() => { const w = W * 0.86, d = D * 0.55, lz = vorn - d / 2 - 0.1; box("haus", 0, lz, w, 0.42, d, pk(HALLE)); box("dach", 0, lz, w + 0.04, 0.16, d + 0.04, 0x8b9096, { ly: 0.42 }); return "Werkstatt"; },
       () => { const w = W * 0.86, d = D * 0.62, hh = 0.42, lz = vorn - d / 2 - 0.12, n = Math.max(2, Math.round(d / 0.3)); box("haus", 0, lz, w, hh, d, pk(HALLE)); for (let k = 0; k < n; k++) box("dach", 0, lz - d / 2 + d / n * (k + 0.5), w, 0.16, d / n, 0x9aa1a8, { ly: hh }); return "Lagerhalle"; },
       () => { box("flach", 0, 0, W * 0.9, 0.01, D * 0.85, 0x8c8a84, { ly: 0.004 }); for (let k = 0; k < 6; k++) box("dach", (r() - 0.5) * W * 0.7, (r() - 0.5) * D * 0.6, 0.3 + r() * 0.3, 0.12 + r() * 0.15, 0.3 + r() * 0.3, pk([0x7a5a3a, 0x8a8f96, 0x6d4c3a, 0xa36a3a])); box("haus", W * 0.3, vorn - 0.25, 0.35, 0.3, 0.3, 0xb5b0a5); return "Schrottplatz"; }],
      [() => { const w = W * 0.86, d = D * 0.75, hh = 0.65 + r() * 0.2, lz = vorn - d / 2 - 0.1; box("haus", 0, lz, w, hh, d, pk(HALLE)); box("dach", 0, lz, w + 0.04, 0.16, d + 0.04, 0x8b9096, { ly: hh }); zyl(-w / 2 + 0.2, lz - d / 2 + 0.2, 0.16, 1.3 + r() * 0.4, 0xb5523a, { schlot: true }); return "Fabrikhalle"; },
       () => { const lz = vorn - 0.45; box("haus", -W * 0.28, lz, 0.55, 0.45, 0.55, pk(HALLE)); for (let k = 0; k < Math.min(4, W); k++) zyl(-W * 0.05 + k * 0.38, lz - 0.2, 0.34, 0.9 + r() * 0.3, 0xd8dade); return "Silos"; },
       () => { const w = W * 0.9, d = D * 0.55, lz = -D / 2 + d / 2 + 0.1; box("haus", 0, lz, w, 0.6, d, 0xd0c8b8); for (let k = 0; k < Math.min(4, W); k++) box("flach", -w / 2 + 0.3 + k * 0.45, lz + d / 2 + 0.02, 0.3, 0.32, 0.02, 0x55595f); for (let k = 0; k < 2; k++) box("flach", -w * 0.25 + k * w * 0.5, vorn - 0.3, 0.22, 0.24, 0.55, k ? 0xe8493f : 0x3f7fe8, { ly: 0.01 }); return "Logistikzentrum"; }],
      [() => { const w = W * 0.86, d = D * 0.78, hh = 0.75, lz = vorn - d / 2 - 0.1; box("haus", 0, lz, w, hh, d, pk(HALLE)); box("dach", 0, lz, w + 0.04, 0.16, d + 0.04, 0x8b9096, { ly: hh }); zyl(-w / 2 + 0.2, lz - d / 2 + 0.2, 0.16, 1.5, 0xb5523a, { schlot: true }); zyl(w / 2 - 0.35, lz - d / 2 - 0.3, 0.5, 0.55, 0xc8ccd0); return "Fabrik"; },
       () => { const w = W * 0.86, d = D * 0.78, hh = 0.75, lz = vorn - d / 2 - 0.1; box("haus", -w / 4, lz, w / 2 - 0.05, hh, d, pk(HALLE)); box("haus", w / 4, lz, w / 2 - 0.05, hh * 0.8, d, pk(HALLE)); box("flach", 0, lz, w * 0.9, 0.06, 0.12, 0x6d737a, { ly: hh * 0.7 }); zyl(-w / 2 + 0.25, lz - d / 2 + 0.25, 0.18, 1.8, 0xb5523a, { schlot: true }); zyl(w / 2 - 0.25, lz - d / 2 + 0.25, 0.18, 1.6, 0xb5523a, { schlot: true }); return "Großfabrik"; },
       () => { const lz = vorn - D * 0.4; box("haus", -W * 0.3, vorn - 0.3, 0.6, 0.5, 0.4, pk(HALLE)); for (let k = 0; k < 3; k++) zyl(-W * 0.1 + k * 0.5, lz - 0.2, 0.42, 0.7, 0xe9ecef); box("flach", 0.2, lz + 0.15, W * 0.6, 0.05, 0.05, 0x9aa0a8, { ly: 0.5 }); zyl(W * 0.38, lz + 0.3, 0.14, 1.6, 0xb5523a, { schlot: true }); return "Chemiewerk"; }]
    ],
    7: [[ // Landwirtschaft (nur eine Stufe, wie bei Cities: Skylines)
      () => { const n = Math.max(4, Math.round(D / 0.22)); for (let k = 0; k < n; k++) box("flach", 0, -D / 2 + 0.1 + (D - 0.4) / n * (k + 0.5), W * 0.88, 0.03, (D - 0.4) / n * 0.8, k % 2 ? 0xe2c26a : 0xd4b257, { ly: 0.004 }); box("haus", W * 0.35, vorn - 0.2, 0.42, 0.38, 0.3, 0xa8432f); giebel(W * 0.35, vorn - 0.2, 0.42, 0.3, 0.38, 0x5a4636); return "Getreidefeld"; },
      () => { const n = Math.max(4, Math.round(D / 0.2)); for (let k = 0; k < n; k++) box("flach", 0, -D / 2 + 0.1 + (D - 0.4) / n * (k + 0.5), W * 0.88, 0.045, (D - 0.4) / n * 0.55, 0x4f9a3a, { ly: 0.004 }); box("flach", W * 0.35, vorn - 0.2, 0.35, 0.25, 0.25, 0x9a7a5a); return "Gemüsefeld"; },
      () => { box("haus", -W * 0.25, vorn - 0.35, 0.6, 0.5, 0.45, 0xa8432f); giebel(-W * 0.25, vorn - 0.35, 0.6, 0.45, 0.5, 0x5a4636, false, 0.32); zyl(W * 0.05, vorn - 0.35, 0.3, 1.0, 0xd8dade); box("haus", W * 0.3, vorn - 0.3, 0.4, 0.4, 0.35, 0xf2efe8); giebel(W * 0.3, vorn - 0.3, 0.4, 0.35, 0.4, 0xa8432f); for (let k = 0; k < 5; k++) box("flach", (r() - 0.5) * W * 0.7, -D * 0.25 + (r() - 0.5) * D * 0.3, 0.12, 0.08, 0.06, k % 2 ? 0xf4f4f4 : 0x2c2f36, { ly: 0.01 }); return "Bauernhof"; },
      () => { const n = Math.max(2, Math.min(4, W)); for (let k = 0; k < n; k++) box("flach", -W * 0.45 + W * 0.9 / n * (k + 0.5), -0.1, W * 0.9 / n - 0.08, 0.28, D * 0.7, 0xcfe8ef); return "Gewächshäuser"; }
    ]],
    8: [[ // Forstwirtschaft
      () => { const w = W * 0.6, lz = vorn - 0.4; box("haus", -W * 0.15, lz, w, 0.5, 0.6, 0x9c7a55); box("dach", -W * 0.15, lz, w + 0.06, 0.18, 0.66, 0x5a4636, { ly: 0.5 }); for (let k = 0; k < 3; k++) box("flach", W * 0.3, -D * 0.2 + k * 0.28 - 0.3, 0.5, 0.18, 0.2, 0x8b5a2b); return "Sägewerk"; },
      () => { for (let k = 0; k < 8; k++) box("flach", (r() - 0.5) * W * 0.75, (r() - 0.5) * D * 0.7, 0.5, 0.16 + r() * 0.1, 0.2, 0x8b5a2b, { ry: r() < 0.5 ? 0 : Math.PI / 2 }); box("flach", W * 0.38, vorn - 0.3, 0.05, 1.1, 0.05, 0xf2c14e); box("flach", W * 0.2, vorn - 0.3, 0.45, 0.05, 0.05, 0xf2c14e, { ly: 1.05 }); return "Holzlager"; },
      () => { for (let a = -W * 0.4; a < W * 0.45; a += 0.35) for (let b = -D * 0.4; b < D * 0.35; b += 0.35) baum(a, b, 0.35 + r() * 0.15); box("flach", W * 0.35, vorn - 0.2, 0.3, 0.25, 0.25, 0x9a7a5a); return "Baumschule"; }
    ]]
  };
  const stufen = L[h.zone], liste = stufen[Math.min(h.stufe, stufen.length) - 1];
  h.name = liste[h.variante % liste.length]();
  details(T, h, W, D, vorn, r);
  massstab(T, W, D, vorn);
  return T;
}
/* Kleine Dinge, die Häuser echt wirken lassen: Tür, Einfahrt mit Auto, Hecke oder Zaun, Blumen, Schornstein */
function details(T, h, W, D, vorn, r) {
  const haupt = T.filter((t) => t.b === "haus" && !t.fest && (t.ly || 0) < 0.05).sort((a, b) => (b.lz + b.sz / 2) - (a.lz + a.sz / 2) || b.sx * b.sy - a.sx * a.sy)[0];
  const neu = (o) => T.push(Object.assign({ ly: 0 }, o));
  if (haupt && [1, 2, 3, 4, 5].includes(h.zone)) {
    const vz = haupt.lz + haupt.sz / 2 + 0.006, grosse = h.zone !== 1;
    neu({ b: "flach", lx: haupt.lx + (grosse ? 0 : haupt.sx * 0.22), lz: vz, sx: grosse ? 0.16 : 0.09, sy: grosse ? 0.2 : 0.17, sz: 0.012, c: grosse ? 0x34495a : wahl(r, [0x6b4a2f, 0x3d5a80, 0x2f6b4a, 0x8a2f2f, 0xf2efe8]) });
    neu({ b: "flach", lx: haupt.lx + (grosse ? 0 : haupt.sx * 0.22), lz: vz + 0.04, sx: grosse ? 0.22 : 0.14, sy: 0.012, sz: 0.08, c: 0xb9b4a8 });
  }
  if (h.zone === 1 && haupt) {
    const dach = T.find((t) => t.b === "dach");
    if (dach && r() < 0.7) neu({ b: "flach", lx: dach.lx + (r() - 0.5) * 0.25, lz: dach.lz - 0.06, ly: (dach.ly || 0) + 0.06, sx: 0.06, sy: 0.2, sz: 0.06, c: 0x8a4a3a });
    const seite = haupt.lx + haupt.sx / 2 + 0.2 < W / 2 - 0.05 ? 1 : haupt.lx - haupt.sx / 2 - 0.2 > -W / 2 + 0.05 ? -1 : 0;
    if (seite && r() < 0.8) {
      const ex = haupt.lx + seite * (haupt.sx / 2 + 0.11), lang = vorn + 0.1 - (haupt.lz - haupt.sz * 0.2);
      neu({ b: "flach", lx: ex, lz: vorn + 0.1 - lang / 2, sx: 0.17, sy: 0.006, sz: lang, c: 0xa7a49c, ly: 0.002 });
      if (r() < 0.75) neu({ b: "flach", lx: ex, lz: vorn - 0.2, sx: 0.12, sy: 0.1, sz: 0.22, c: PAL.auto[(h.variante >> 3) % PAL.auto.length], ly: 0.008 });
    }
    for (let k = 0; k < 2; k++) neu({ b: "flach", lx: (r() - 0.5) * W * 0.6, lz: vorn - 0.06, sx: 0.12, sy: 0.03, sz: 0.06, c: wahl(r, [0xe85b9a, 0xf2c14e, 0xe8493f, 0x9a5be8, 0xffffff]), ly: 0.002 });
    const art = h.variante % 3;
    if (art < 2) {
      const c = art === 0 ? 0x4a8a3a : 0xf4f2ee, hh = art === 0 ? 0.11 : 0.07, d = art === 0 ? 0.06 : 0.015;
      for (const sx of [-1, 1]) neu({ b: "flach", lx: sx * (W / 2 - 0.04), lz: 0, sx: d, sy: hh, sz: D * 0.92, c, rand: true, hecke: art === 0 });
      neu({ b: "flach", lx: 0, lz: -D / 2 + 0.04, sx: W * 0.92, sy: hh, sz: d, c, rand: true, hecke: art === 0 });
    }
  }
  if (h.zone === 2) neu({ b: "flach", lx: 0, lz: vorn - 0.02, sx: W * 0.7, sy: 0.08, sz: 0.06, c: 0x4a8a3a, rand: true, hecke: true });
}
/* Gebäude auf echte Größe bringen: Grundstück besser ausfüllen und höher (1 Feld ≈ 8 m, ein Auto ≈ 4,5 m) */
function massstab(T, W, D, vorn) {
  let x0 = 0, x1 = 0, zmin = vorn;
  for (const t of T) { if (t.fest || t.rand) continue; const quer = Math.abs(Math.sin(t.ry || 0)) > 0.7, ex = (quer ? t.sz : t.sx) / 2, ez = (quer ? t.sx : t.sz) / 2; x0 = Math.min(x0, t.lx - ex); x1 = Math.max(x1, t.lx + ex); zmin = Math.min(zmin, t.lz - ez); }
  const fx = klemme(W * 0.47 / Math.max(-x0, x1, 0.01), 1, 1.3), fz = klemme((vorn + D / 2 - 0.06) / Math.max(0.01, vorn - zmin), 1, 1.3), fy = 1.3;
  for (const t of T) {
    if (t.fest || t.rand) continue;
    const quer = Math.abs(Math.sin(t.ry || 0)) > 0.7;
    t.lx *= fx; t.lz = vorn - (vorn - t.lz) * fz; t.ly = (t.ly || 0) * fy;
    if (t.rund) { const f = Math.min(fx, fz) * 1.1; t.sx *= f; t.sy *= f; t.sz *= f; continue; }
    if (quer) { t.sx *= fz; t.sz *= fx; } else { t.sx *= fx; t.sz *= fz; }
    if (t.sy > 0.06) t.sy *= fy;
  }
}
function hausWeg(h) { if (!h) return; for (const id of h.zellen) { const z = zellen.get(id); if (z) z.haus = null; } haeuser.delete(h.id); haeuserNeu = zellenNeu = true; if (ZONEN[h.zone].gruppe === "i") dreckZeichnen(); }
function neuesHaus(d, alt) {
  const h = Object.assign({ id: d.id || hId++, geboren: alt ? -100 : jetztS, simGeboren: alt ? -100 : simZeit, ab: 0, zug: null }, d); hId = Math.max(hId, h.id + 1);
  let x = 0, z = 0, sx = 0, sz = 0; h.zellen.forEach((id) => { const c = zellen.get(id); c.haus = h.id; x += c.x; z += c.z; sx += Math.sin(c.rot); sz += Math.cos(c.rot); });
  h.x = x / h.zellen.length; h.z = z / h.zellen.length; h.rot = Math.atan2(sx, sz);
  h.teile = hausTeile(h); h.box = null; h.hoehe = hoeheVon(h); haeuser.set(h.id, h); haeuserNeu = zellenNeu = true;
  const rr = Math.max(h.w, h.d) * 0.62 + 0.2; baeumeFaellen({ x0: h.x - rr, x1: h.x + rr, z0: h.z - rr, z1: h.z + rr }, (bx, bz) => Math.hypot(bx - h.x, bz - h.z) < rr);
  return h;
}
const leute = (h) => h.verlassen ? 0 : LEUTE[h.zone] ? LEUTE[h.zone][Math.min(h.stufe, 5)] * h.zellen.length : 0;
const jobs = (h) => { if (h.verlassen) return 0; const t = JOBS[h.zone]; return t ? t[Math.min(h.stufe, t.length - 1)] * h.zellen.length : 0; };
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
  if (naechsteKante({ x, z }, 3.2, (k) => k.typ === "allee")) w += 12;
  if (naechsteKante({ x, z }, 2.6, (k) => k.typ === "haupt" && !k.aussen)) w -= 10;
  let laeden = 0; for (const q of ladenListe) if (Math.hypot(q.x - x, q.z - z) < 6) laeden++;
  w += Math.min(14, laeden * 4);
  let park = 0, dienstPlus = 0; const gedeckt = new Set();
  for (const q of dienste.values()) { const D = DIENSTE[q.typ]; if (!D.radius) continue; const e = Math.hypot(q.x - x, q.z - z); if (e >= D.radius) continue; if (D.wert) park += D.wert * (1 - e / D.radius); else gedeckt.add(D.kat); }
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
  const e = naechsteKante(f, 3.5, (k) => TYP[k.typ].autos);
  h.zug = e ? { k: e.k.id, S: e.s } : null; h.zugV = netzVersion; return h.zug;
}
const federn = (t) => { const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
let rauchTeile = [];
function haeuserZeichnen() {
  let anim = false; const n = { haus: 0, flach: 0, dach: 0, zyl: 0, garten: 0 }; rauchTeile = [];
  drehListe = [];
  for (const h of [...haeuser.values(), ...dienste.values(), ...halte.values()]) {
    const p = Math.min(1, Math.max(0, (jetztS - h.geboren) / 0.7)); if (p < 1) anim = true;
    const e = h.ab + (1 - h.ab) * (1 - Math.pow(1 - p, 3)), cs = Math.cos(h.rot), sn = Math.sin(h.rot);
    for (const t of h.teile) {
      const m = B[t.b]; if (n[t.b] >= m.instanceMatrix.count) continue;
      const wx = h.x + t.lx * cs + t.lz * sn, wz = h.z - t.lx * sn + t.lz * cs;
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
const GRAU = new THREE.Color(0x77736c); let drehListe = [];
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
  for (const k of kanten.values()) { if (k.typ !== "allee") continue; for (let s = 1.2; s < k.len - 1.0 && i < 5990; s += 1.6) { const p = punktBei(k, s); for (const sei of [1, -1]) { _o.position.set(p.x - p.tz * 0.6 * sei, G + 0.016, p.z + p.tx * 0.6 * sei); _o.rotation.set(0, s * 3.7, 0); _o.scale.setScalar(0.62 + ((s * 7.3) % 0.2)); _o.updateMatrix(); alleeBaeume.setMatrixAt(i, _o.matrix); alleeBaeume.setColorAt(i, _farbe.setRGB(0.9, 1, 0.9)); i++; } } }
  alleeBaeume.count = i; alleeBaeume.instanceMatrix.needsUpdate = true; if (alleeBaeume.instanceColor) alleeBaeume.instanceColor.needsUpdate = true;
}

/* ================================================================
   Dienste: Strom, Wasser, Müll, Polizei, Feuerwehr, Gesundheit, Bildung, Parks
   ================================================================ */
const DIENST_KAT = {
  strom: { em: "⚡", name: "Strom" }, wasser: { em: "💧", name: "Wasser" }, muell: { em: "🗑️", name: "Müll" },
  polizei: { em: "🚓", name: "Polizei" }, feuer: { em: "🚒", name: "Feuerwehr" }, gesund: { em: "🏥", name: "Gesundheit" }, bildung: { em: "🎓", name: "Bildung" }, park: { em: "🌳", name: "Parks" }
};
const DIENSTE = {
  windrad: { kat: "strom", name: "Windrad", em: "🌬️", preis: 3000, unterhalt: 60, w: 1, d: 1, strom: 90, text: "Sauberer Strom, aber nicht viel." },
  solar: { kat: "strom", name: "Solarpark", em: "☀️", preis: 9000, unterhalt: 140, w: 3, d: 3, strom: 380, ab: 1, text: "Viel sauberer Strom, braucht aber Platz." },
  kohle: { kat: "strom", name: "Kohlekraftwerk", em: "🏭", preis: 16000, unterhalt: 320, w: 4, d: 4, strom: 1500, dreck: 9, ab: 2, text: "Sehr viel Strom – aber Rauch und Dreck." },
  pumpe: { kat: "wasser", name: "Wasserpumpe", em: "🚰", preis: 2500, unterhalt: 50, w: 1, d: 2, wasser: 450, amWasser: true, text: "Pumpt Wasser aus See oder Meer. Muss am Ufer stehen." },
  wasserturm: { kat: "wasser", name: "Wasserturm", em: "🗼", preis: 4500, unterhalt: 90, w: 2, d: 2, wasser: 220, text: "Wasser auch weit weg vom Ufer." },
  klaer: { kat: "wasser", name: "Kläranlage", em: "🚽", preis: 4000, unterhalt: 80, w: 2, d: 3, abwasser: 520, text: "Reinigt das Abwasser der Stadt." },
  deponie: { kat: "muell", name: "Mülldeponie", em: "🗑️", preis: 4000, unterhalt: 100, w: 3, d: 3, muell: 550, dreck: 4, text: "Müllautos holen den Müll bei den Häusern ab." },
  verbrennung: { kat: "muell", name: "Müllverbrennung", em: "♨️", preis: 15000, unterhalt: 260, w: 3, d: 3, muell: 2200, strom: 150, dreck: 5, ab: 3, text: "Verbrennt viel Müll und macht nebenbei Strom." },
  polizei: { kat: "polizei", name: "Polizeiwache", em: "🚓", preis: 6000, unterhalt: 120, w: 2, d: 2, radius: 13, text: "Weniger Kriminalität im Kreis. Streifenwagen fahren Runden." },
  praesidium: { kat: "polizei", name: "Polizeipräsidium", em: "👮", preis: 20000, unterhalt: 340, w: 3, d: 3, radius: 24, ab: 4, text: "Großer Wirkungskreis." },
  feuerwache: { kat: "feuer", name: "Feuerwache", em: "🚒", preis: 6000, unterhalt: 120, w: 2, d: 2, radius: 13, text: "Löschzüge fahren zu Bränden im Kreis." },
  hauptwache: { kat: "feuer", name: "Hauptfeuerwache", em: "🧯", preis: 20000, unterhalt: 340, w: 3, d: 3, radius: 24, ab: 4, text: "Großer Wirkungskreis." },
  arzt: { kat: "gesund", name: "Arztpraxis", em: "🩺", preis: 3000, unterhalt: 70, w: 1, d: 2, radius: 8, text: "Kleine Praxis für die Nachbarschaft." },
  krankenhaus: { kat: "gesund", name: "Krankenhaus", em: "🏥", preis: 15000, unterhalt: 300, w: 3, d: 3, radius: 22, ab: 2, text: "Krankenwagen für die ganze Gegend." },
  grundschule: { kat: "bildung", name: "Grundschule", em: "🏫", preis: 5000, unterhalt: 110, w: 2, d: 3, radius: 11, bildung: 1, text: "Bildung Stufe 1 – Wohnhäuser können auf Stufe 3+ wachsen." },
  gymnasium: { kat: "bildung", name: "Gymnasium", em: "🎒", preis: 12000, unterhalt: 220, w: 3, d: 3, radius: 17, bildung: 2, ab: 2, text: "Bildung Stufe 2 – Stufe 5 und mehr Büros statt Fabriken." },
  uni: { kat: "bildung", name: "Universität", em: "🎓", preis: 30000, unterhalt: 480, w: 4, d: 4, radius: 32, bildung: 3, ab: 4, text: "Bildung Stufe 3 – die klügste Stadt." },
  spielplatz: { kat: "park", name: "Spielplatz", em: "🛝", preis: 600, unterhalt: 10, w: 1, d: 1, radius: 5, wert: 8, text: "Macht die Nachbarschaft schöner." },
  park: { kat: "park", name: "Park", em: "🌳", preis: 1500, unterhalt: 25, w: 2, d: 2, radius: 7, wert: 12, text: "Bäume und Wege – höherer Bodenwert." },
  brunnen: { kat: "park", name: "Brunnenplatz", em: "⛲", preis: 2500, unterhalt: 35, w: 2, d: 2, radius: 7, wert: 14, ab: 1, text: "Ein schöner Platz mit Brunnen." },
  sportplatz: { kat: "park", name: "Sportplatz", em: "⚽", preis: 4000, unterhalt: 60, w: 3, d: 2, radius: 9, wert: 10, ab: 1, text: "Fußball für alle." },
  grosspark: { kat: "park", name: "Großer Park", em: "🏞️", preis: 6000, unterhalt: 80, w: 3, d: 3, radius: 12, wert: 18, ab: 2, text: "Großer Park mit Teich." }
};
const RESSOURCEN = { strom: { em: "⚡", name: "Strom" }, wasser: { em: "💧", name: "Wasser" }, abwasser: { em: "🚽", name: "Abwasser" }, muell: { em: "🗑️", name: "Müllabfuhr" } };
const dienste = new Map(); let dId = 1;
const dienstFrei = (t) => meilenstein >= (DIENSTE[t].ab || 0);
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
    case "spielplatz": boden(0x7fc463); flach(-0.15, 0.1, 0.35, 0.35, 0xe8d39a); box("flach", 0.2, -0.15, 0.04, 0.3, 0.04, 0xe8493f); box("flach", 0.2, 0.05, 0.08, 0.02, 0.4, 0xf2c14e, { ly: 0.15, rx: 0.5 }); box("flach", -0.25, -0.25, 0.4, 0.03, 0.03, 0x3f7fe8, { ly: 0.28 }); box("flach", -0.43, -0.25, 0.03, 0.28, 0.03, 0x3f7fe8); box("flach", -0.07, -0.25, 0.03, 0.28, 0.03, 0x3f7fe8); baum(0.3, 0.32, 0.4); break;
    case "park": boden(0x6fbf55); flach(0, 0, 0.18, D * 0.95, 0xd8c7a0); flach(0, 0, W * 0.95, 0.18, 0xd8c7a0); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) baum(a * W * 0.27, b * D * 0.27, 0.55 + r() * 0.25); box("flach", 0.2, 0.12, 0.2, 0.05, 0.06, 0x8b5a2b, { ly: 0.05 }); break;
    case "brunnen": boden(0xd8d0c0); zyl(0, 0, 0.75, 0.1, 0xb9b4a8); zyl(0, 0, 0.65, 0.01, 0x5fc8e8, { ly: 0.1 }); zyl(0, 0, 0.08, 0.3, 0xb9b4a8); zyl(0, 0, 0.22, 0.04, 0x5fc8e8, { ly: 0.3 }); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) baum(a * W * 0.38, b * D * 0.38, 0.45); break;
    case "sportplatz": boden(0x4f9a3a); flach(0, 0, W * 0.86, D * 0.8, 0x5aa845); box("flach", 0, 0, W * 0.86, 0.002, 0.02, 0xffffff, { ly: 0.017 }); box("flach", 0, 0, 0.02, 0.002, D * 0.8, 0xffffff, { ly: 0.017 }); for (const s of [-1, 1]) { box("flach", s * W * 0.42, 0, 0.02, 0.14, 0.36, 0xffffff); } break;
    case "grosspark": boden(0x6fbf55); flach(W * 0.12, -D * 0.12, 1.1, 0.9, 0x5fb8d8); flach(-W * 0.2, 0.2, 0.16, D * 0.9, 0xd8c7a0); for (let k = 0; k < 9; k++) { const a = (r() - 0.5) * W * 0.85, b = (r() - 0.5) * D * 0.85; if (Math.hypot(a - W * 0.12, b + D * 0.12) > 0.7) baum(a, b, 0.5 + r() * 0.35); } break;
  }
  return T;
}
function inDienst(x, z, rand) {
  rand = rand || 0;
  for (const d of dienste.values()) { const dx = x - d.x, dz = z - d.z, c = Math.cos(d.rot), s = Math.sin(d.rot), lx = dx * c - dz * s, lz = dx * s + dz * c; if (Math.abs(lx) < d.w * ZELLE / 2 + rand && Math.abs(lz) < d.d * ZELLE / 2 + rand) return d; }
  return null;
}
function hoeheVon(h) { let y = 0; for (const t of h.teile) if (!t.fest) y = Math.max(y, (t.ly || 0) + t.sy); return y; }
function neuerDienst(o, alt) {
  const D = DIENSTE[o.typ], d = { id: o.id || dId++, typ: o.typ, x: o.x, z: o.z, rot: o.rot, w: D.w, d: D.d, variante: (o.id || dId) * 7919, geboren: alt ? -100 : jetztS, ab: 0, zug: null, dienst: true, timer: 2 + Math.random() * 4 };
  dId = Math.max(dId, d.id + 1); d.teile = dienstTeile(d); d.hoehe = hoeheVon(d); dienste.set(d.id, d); haeuserNeu = true; versorgungZeit = -99;
  const rr = Math.max(D.w, D.d) * 0.72; baeumeFaellen({ x0: d.x - rr, x1: d.x + rr, z0: d.z - rr, z1: d.z + rr }, (bx, bz) => !!inDienst(bx, bz, 0.15));
  return d;
}
function dienstWeg(d) {
  dienste.delete(d.id); haeuserNeu = true; versorgungZeit = -99;
  const e = naechsteKante(d, 5, (k) => TYP[k.typ].zellen); if (e) { zellenFuer(e.k); }
  dreckZeichnen(); speichernBald();
}
function dienstPlan(p, typ) {
  const D = DIENSTE[typ], W = D.w * ZELLE, Dd = D.d * ZELLE;
  const e = naechsteKante(p, 3 + Dd, (k) => TYP[k.typ].autos);
  if (!e) return { ok: false, grund: "Muss an einer Straße stehen", x: p.x, z: p.z, rot: 0, W, D: Dd, typ };
  const q = punktBei(e.k, e.s), nx = -q.tz, nz = q.tx, seite = ((p.x - q.x) * nx + (p.z - q.z) * nz) >= 0 ? 1 : -1, ab = TYP[e.k.typ].halb + Dd / 2 + 0.06;
  const x = q.x + nx * seite * ab, z = q.z + nz * seite * ab, rot = Math.atan2(-nx * seite, -nz * seite), cs = Math.cos(rot), sn = Math.sin(rot);
  const plan = { ok: true, typ, x, z, rot, W, D: Dd, preis: D.preis, haeuser: 0 };
  let zuNah = false, land = true, bes = true, ufer = 99;
  for (let a = -0.5; a <= 0.501; a += 0.25) for (let b = -0.5; b <= 0.501; b += 0.25) {
    const lx = a * W * 0.94, lz = b * Dd * 0.94, wx = x + lx * cs + lz * sn, wz = z - lx * sn + lz * cs, ab2 = abstand(wx, wz);
    ufer = Math.min(ufer, ab2); if (ab2 < 0.3) land = false; if (!imBesitz(wx, wz)) bes = false;
    if (strassenFrei({ x: wx, z: wz }) < 0.02 || inDienst(wx, wz, 0.02)) zuNah = true;
  }
  const hs = new Set(); for (const c of zellenNahe(x, z, Math.max(W, Dd))) { const dx = c.x - x, dz = c.z - z, lx = dx * cs - dz * sn, lz = dx * sn + dz * cs; if (Math.abs(lx) < W / 2 + 0.3 && Math.abs(lz) < Dd / 2 + 0.3 && c.haus) hs.add(c.haus); }
  plan.haeuser = hs.size;
  const fail = (g) => { plan.ok = false; plan.grund = g; return plan; };
  if (!dienstFrei(typ)) return fail("🔒 Gibt es ab " + MEILEN[D.ab].name);
  if (!bes) return fail("Außerhalb deiner Gebiete");
  if (!land) return fail("Hier ist Wasser");
  if (zuNah) return fail("Zu nah an einer Straße oder einem Gebäude");
  if (D.amWasser && ufer > 2.2) return fail("Muss direkt am Ufer stehen");
  if (geld < D.preis) return fail("Zu wenig Geld (" + euro(D.preis) + ")");
  return plan;
}
function dienstBauen(plan) {
  if (!plan || !plan.ok) return null;
  const D = DIENSTE[plan.typ], cs = Math.cos(plan.rot), sn = Math.sin(plan.rot);
  for (const c of zellenNahe(plan.x, plan.z, Math.max(plan.W, plan.D))) { const dx = c.x - plan.x, dz = c.z - plan.z, lx = dx * cs - dz * sn, lz = dx * sn + dz * cs; if (Math.abs(lx) < plan.W / 2 + 0.35 && Math.abs(lz) < plan.D / 2 + 0.35) { if (c.haus) hausWeg(haeuser.get(c.haus)); zelleWeg(c); } }
  geld -= D.preis; const d = neuerDienst({ typ: plan.typ, x: plan.x, z: plan.z, rot: plan.rot });
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
function bedarfVon(h, r) { const b = leute(h) + jobs(h) * (gruppe(h) === "i" ? 1.0 : 0.6); return r === "abwasser" ? b * 0.9 : r === "muell" ? b * 0.8 : b; }
let versorgung = { strom: [0, 0], wasser: [0, 0], abwasser: [0, 0], muell: [0, 0] }, versorgungZeit = -99, warteListe = [];
function abdeckung(x, z, kat) { let best = 0; for (const d of dienste.values()) { const D = DIENSTE[d.typ]; if (D.kat !== kat || !D.radius) continue; const e = Math.hypot(d.x - x, d.z - z); if (e < D.radius) best = Math.max(best, kat === "bildung" ? D.bildung : 1 - e / D.radius * 0.5); } return best; }
function versorgungRechnen() {
  komponenten();
  const prod = new Map(), RS = ["strom", "wasser", "abwasser", "muell"];
  const gesamt = { strom: [0, 0], wasser: [0, 0], abwasser: [0, 0], muell: [0, 0] };
  for (const d of dienste.values()) { const D = DIENSTE[d.typ]; d.komp = kompVon(d); if (d.komp == null) continue; if (!prod.has(d.komp)) prod.set(d.komp, { strom: 0, wasser: 0, abwasser: 0, muell: 0, q: [] }); const p = prod.get(d.komp); for (const r of RS) if (D[r]) { p[r] += D[r]; gesamt[r][0] += D[r]; } p.q.push(d); }
  const proKomp = new Map();
  for (const h of haeuser.values()) {
    h.hat = h.hat || {}; h.komp = kompVon(h);
    h.abd = { polizei: abdeckung(h.x, h.z, "polizei"), feuer: abdeckung(h.x, h.z, "feuer"), gesund: abdeckung(h.x, h.z, "gesund") }; h.bildung = abdeckung(h.x, h.z, "bildung");
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
}
const PROBLEM_TEXT = { strom: "⚡ Kein Strom", wasser: "💧 Kein Wasser", abwasser: "🚽 Abwasser wird nicht abgeholt", muell: "🗑️ Müll wird nicht abgeholt", feuer: "🔥 Es brennt!", krimi: "🦹 Viel Kriminalität", krank: "🤒 Kranke Bewohner", verlassen: "🏚️ Verlassen" };
let verlassenGemeldet = 0, problemTippZeit = -99;
function dienstTakt(dt) {
  if (simZeit - versorgungZeit > 2) { versorgungZeit = simZeit; versorgungRechnen(); busRechnen(); }
  linienTakt();
  warteListe = warteListe.filter((w) => { if (simZeit >= w.t) { w.fn(); return false; } return true; });
  let probleme = { strom: 0, wasser: 0, abwasser: 0, muell: 0 };
  for (const h of [...haeuser.values()]) {
    if (h.verlassen) { if (simZeit - h.verlassen > 50) hausWeg(h); continue; }
    const hat = h.hat || {}, a = h.abd || {};
    const lebt = leute(h) + jobs(h) > 0, jung = simZeit - (h.simGeboren || 0) < 12;
    h.krimi = a.polizei ? Math.max(0, (h.krimi || 0) - dt * 3) : (h.krimi || 0) + dt * (lebt ? 0.6 + Math.min(1, leute(h) / 40) : 0);
    h.krank = a.gesund ? Math.max(0, (h.krank || 0) - dt * 3) : (h.krank || 0) + dt * (gruppe(h) === "w" ? 0.5 : 0.15);
    let p = null;
    if (h.brand) p = "feuer";
    else if (!jung) for (const r of ["strom", "wasser", "abwasser", "muell"]) if (hat[r] === false) { probleme[r]++; if (!p) p = r; }
    if (!p && h.krimi > 60) p = "krimi"; if (!p && h.krank > 70) p = "krank";
    h.problem = p;
    const not = p && ["strom", "wasser", "abwasser", "muell"].includes(p);
    if (not) { if (h.notSeit == null) h.notSeit = simZeit; } else h.notSeit = null;
    if (h.notSeit != null && simZeit - h.notSeit > 150) { h.verlassen = simZeit; h.notSeit = null; haeuserNeu = true; verlassenGemeldet++; }
    // Brand
    if (h.brand) {
      const b = h.brand;
      if (!b.gerufen && a.feuer) { const w = naechsteWache(h, "feuer"); if (w) { const f = einsatz(w, h, "feuerwehr", () => { if (h.brand) { h.brand = null; tipp("🚒 Feuer gelöscht: " + hausName(h), 2500); } }); if (f) b.gerufen = true; } }
      if (simZeit - b.t > (a.feuer ? 45 : 28)) { tipp("🔥 " + hausName(h) + " ist abgebrannt" + (a.feuer ? "." : " – bau eine Feuerwache in der Nähe!"), 4000); h.brand = null; hausWeg(h); }
    }
  }
  if (verlassenGemeldet && simZeit - problemTippZeit > 25) { problemTippZeit = simZeit; tipp("🏚️ Leute ziehen weg! Häuser ohne Strom, Wasser oder Müllabfuhr werden verlassen.", 5000); verlassenGemeldet = 0; }
  else if (simZeit - problemTippZeit > 40) {
    const top = Object.entries(probleme).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 3) { problemTippZeit = simZeit; const hilfe = { strom: "Bau ein Windrad oder Kraftwerk (🏛️ Dienste → ⚡ Strom).", wasser: "Bau eine Wasserpumpe am Ufer (🏛️ Dienste → 💧 Wasser).", abwasser: "Bau eine Kläranlage am Ufer (🏛️ Dienste → 💧 Wasser).", muell: "Bau eine Mülldeponie (🏛️ Dienste → 🗑️ Müll)." }; tipp(PROBLEM_TEXT[top[0]] + " bei " + top[1] + " Häusern. " + hilfe[top[0]], 6000); }
  }
  // Brände entstehen
  if (haeuser.size > 15 && Math.random() < 0.004 * dt * 2) {
    const L = [...haeuser.values()].filter((h) => !h.brand && !h.verlassen), h = L[Math.floor(Math.random() * L.length)];
    if (h && (!(h.abd && h.abd.feuer) || Math.random() < 0.3)) { h.brand = { t: simZeit, gerufen: false }; if (!(h.abd && h.abd.feuer)) tipp("🔥 Feuer bei " + hausName(h) + "! Ohne Feuerwache brennt es ab.", 4000); }
  }
  // Fahrzeuge der Dienste
  for (const d of dienste.values()) {
    d.timer -= dt; if (d.timer > 0) continue;
    const D = DIENSTE[d.typ];
    if (D.muell) { d.timer = 7; if (eigeneFahrzeuge(d) < 2) { const L = [...haeuser.values()].filter((h) => h.komp === d.komp && !h.verlassen); if (L.length) einsatz(d, wahl(Math.random, L), "muell", null, true); } }
    else if (D.kat === "polizei") { d.timer = 9; if (eigeneFahrzeuge(d) < (D.radius > 15 ? 3 : 2)) { const L = [...haeuser.values()].filter((h) => Math.hypot(h.x - d.x, h.z - d.z) < D.radius); if (L.length) { const h = L.reduce((m, x) => (x.krimi || 0) > (m.krimi || 0) ? x : m, wahl(Math.random, L)); einsatz(d, h, "polizei", () => { h.krimi = 0; }, true); } } }
    else if (D.kat === "gesund" && D.radius > 10) { d.timer = 10; if (eigeneFahrzeuge(d) < 2) { const L = [...haeuser.values()].filter((h) => Math.hypot(h.x - d.x, h.z - d.z) < D.radius && (h.krank || 0) > 20); if (L.length) { const h = wahl(Math.random, L); einsatz(d, h, "kranken", () => { h.krank = 0; }, true); } } }
    else d.timer = 5;
  }
}
const naechsteWache = (h, kat) => { let best = null, bd = 1e9; for (const d of dienste.values()) { const D = DIENSTE[d.typ]; if (D.kat !== kat) continue; const e = Math.hypot(d.x - h.x, d.z - h.z); if (e < D.radius && e < bd) { bd = e; best = d; } } return best; };
const eigeneFahrzeuge = (d) => fahrzeuge.filter((f) => f.dienstId === d.id).length;
function einsatz(d, h, typ, beiAnkunft, zurueck) {
  const za = zufahrt(d), zb = zufahrt(h); if (!za || !zb) return null;
  const f = fahrzeugAusWeg(wegSuchen(za, zb), typ, null, DIENSTE[d.typ].name, hausName(h), "aussen"); if (!f) return null;
  f.dienstId = d.id;
  f.beiAnkunft = () => { if (beiAnkunft) beiAnkunft(); if (zurueck && dienste.has(d.id)) warteListe.push({ t: simZeit + 3, fn: () => { const z1 = zufahrt(h), z2 = zufahrt(d); if (z1 && z2 && dienste.has(d.id)) { const g = fahrzeugAusWeg(wegSuchen(z1, z2), typ, null, hausName(h), DIENSTE[d.typ].name, "haus"); if (g) g.dienstId = d.id; } } }); };
  return f;
}
function dienstKosten() { let s = 0; for (const d of dienste.values()) s += DIENSTE[d.typ].unterhalt; return s; }
/* Warnsymbole über Häusern */
const WARN = { strom: "⚡", wasser: "💧", abwasser: "🚽", muell: "🗑️", feuer: "🔥", krimi: "🦹", krank: "🤒", verlassen: "🏚️" };
const warnMat = {};
for (const k in WARN) { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); g.fillStyle = k === "feuer" ? "#ff6a2a" : k === "verlassen" ? "#6b6b6b" : "#ffffff"; g.beginPath(); g.arc(32, 32, 29, 0, 7); g.fill(); g.lineWidth = 4; g.strokeStyle = k === "feuer" ? "#ffd23d" : "#ff4a3d"; g.stroke(); g.font = "34px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(WARN[k], 32, 35); warnMat[k] = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }); }
const warnSprites = []; for (let i = 0; i < 180; i++) { const s = new THREE.Sprite(warnMat.strom); s.visible = false; s.renderOrder = 8; s.scale.setScalar(0.62); szene.add(s); warnSprites.push(s); }
function warnZeichnen() {
  let i = 0;
  for (const h of haeuser.values()) {
    const w = h.verlassen ? "verlassen" : h.problem; if (!w || i >= warnSprites.length) continue;
    const s = warnSprites[i++]; s.material = warnMat[w]; s.visible = true; s.position.set(h.x, BODEN + (h.hoehe || 0.6) + 0.45 + Math.sin(jetztS * 3 + h.id) * 0.06, h.z);
  }
  for (; i < warnSprites.length; i++) warnSprites[i].visible = false;
}
/* Vorschau beim Bauen */
const geist = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, opacity: 0.4, depthWrite: false })); geist.visible = false; geist.renderOrder = 5; szene.add(geist);
const geistRing = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 72).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false })); geistRing.visible = false; geistRing.renderOrder = 5; szene.add(geistRing);
const geistFlaeche = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false })); geistFlaeche.visible = false; szene.add(geistFlaeche);
let dienstWahl = "windrad", dienstKat = "strom", dienstPlanAktuell = null;
function dienstVorschau(p) {
  const plan = dienstPlan(p, dienstWahl), D = DIENSTE[dienstWahl]; dienstPlanAktuell = plan;
  geist.visible = true; geist.position.set(plan.x, G + 0.01, plan.z); geist.rotation.set(0, plan.rot, 0); geist.scale.set(plan.W, 0.5, plan.D); geist.material.color.setHex(plan.ok ? 0x7dffb0 : 0xff5a5a);
  const rad = D.radius || 0; geistRing.visible = geistFlaeche.visible = rad > 0;
  if (rad) { geistRing.position.set(plan.x, G + 0.06, plan.z); geistRing.scale.setScalar(rad); geistFlaeche.position.set(plan.x, G + 0.055, plan.z); geistFlaeche.scale.setScalar(rad); }
  frage(D.em + " " + D.name + " · " + euro(D.preis) + " · " + euro(D.unterhalt) + "/Wo" + (plan.ok ? (plan.haeuser ? " · reißt " + plan.haeuser + " Haus ab" : "") : " – " + plan.grund), plan.ok, () => {
    merkeRueck(); const d = dienstBauen(dienstPlanAktuell); if (!d) return; geist.visible = geistRing.visible = geistFlaeche.visible = false; frageZu();
    tipp("✅ " + D.name + " gebaut! " + (D.radius ? "Der Kreis zeigt, wie weit es wirkt." : "Strom und Rohre laufen automatisch durch die Straßen."), 3500); versorgungRechnen();
  });
}
function vorschauWeg() { geist.visible = geistRing.visible = geistFlaeche.visible = false; dienstPlanAktuell = null; }
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
  for (const r of ["strom", "wasser", "abwasser", "muell"]) if (D[r]) { const v = versorgung[r]; leistung += `<br>${RESSOURCEN[r].em} ${RESSOURCEN[r].name}: ${zahl(D[r])} · Stadt: ${zahl(v[1])} von ${zahl(v[0])} gebraucht`; }
  if (D.radius) leistung += `<br>⭕ Wirkungskreis: ${D.radius} Felder`;
  if (D.wert) leistung += `<br>💎 Bodenwert +${D.wert} in der Nähe`;
  infoZeigen(`<b>${D.em} ${D.name}</b><small>${DIENST_KAT[D.kat].name} · ${euro(D.unterhalt)} Unterhalt pro Woche</small>${leistung}${d.komp == null ? "<br>⚠️ Nicht an eine Straße angeschlossen" : ""}<br><small>${D.text}</small><br><button class="chip gefahr" type="button" id="dienstAbriss" style="margin-top:6px">🧹 Abreißen (+${euro(D.preis * 0.3)})</button>`, 9000);
  $("dienstAbriss").onclick = () => { merkeRueck(); dienstWeg(d); geld += D.preis * 0.3; $("info").hidden = true; zeigeWerte(); tipp("🧹 " + D.name + " abgerissen.", 2000); };
}

/* ================================================================
   Nahverkehr: Haltestellen und Buslinien
   ================================================================ */
const halte = new Map(), linien = new Map(); let haltId = 1, linieId = 1;
const LINIEN_FARBEN = [0xe8493f, 0x3f7fe8, 0x2fbf6a, 0xf2a93b, 0x9a5be8, 0xe85b9a, 0x2fb8c9, 0x8a6a3a];
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
function linieErreichbar(ids) { for (let i = 0; i < ids.length; i++) { const a = halte.get(ids[i]), b = halte.get(ids[(i + 1) % ids.length]); if (!a || !b || !kanten.has(a.k) || !kanten.has(b.k)) return false; if (!wegSuchen(haltPunkt(a), haltPunkt(b))) return false; } return true; }
function busStarten(L, i) {
  const a = halte.get(L.halte[i % L.halte.length]), b = halte.get(L.halte[(i + 1) % L.halte.length]); if (!a || !b) return null;
  const f = fahrzeugAusWeg(wegSuchen(haltPunkt(a), haltPunkt(b)), "bus", null, "Linie " + L.nr, "Haltestelle", "aussen"); if (!f) return null;
  f.linie = L.id; f.ziel = (i + 1) % L.halte.length; f.farbe = L.farbe; f.nachText = "🚏 Haltestelle " + (f.ziel + 1); f.vonText = "🚌 Linie " + L.nr; return f;
}
function busWeiter(f) {
  const L = linien.get(f.linie); if (!L) { fahrzeugWeg(f); return; }
  const a = halte.get(L.halte[f.ziel % L.halte.length]); if (a) a.wartend = 0;
  const n = (f.ziel + 1) % L.halte.length, b = halte.get(L.halte[n]); if (!a || !b) { fahrzeugWeg(f); return; }
  const kk = kanten.get(f.route[f.ri].k), weg = kk && wegSuchen({ k: kk.id, S: f.route[f.ri].dir > 0 ? f.s : kk.len - f.s }, haltPunkt(b));
  if (!weg) { f.halt = 3; return; }
  Object.assign(f, { route: weg.route, ri: 0, s: weg.s0, sZiel: weg.s1, ziel: n, frei: false, ausparken: true, kurveFuer: -1, warte: 0, parkt: 0, nachText: "🚏 Haltestelle " + (n + 1) });
  spurWaehlen(f);
}
function linienTakt() {
  for (const L of linien.values()) {
    const da = fahrzeuge.filter((f) => f.linie === L.id).length;
    if (da < L.busse) busStarten(L, Math.floor(Math.random() * L.halte.length));
  }
  for (const h of halte.values()) h.wartend = Math.min(5, h.wartend + (h.inLinie ? 0.15 + h.umgebung * 0.004 : 0));
}
/* Wer wohnt oder arbeitet nah an einer Haltestelle mit Linie? */
let busAbdeckung = { leute: 0, jobs: 0, anteil: 0, fahrgaeste: 0 };
function busRechnen() {
  const aktiv = new Set(); for (const L of linien.values()) for (const id of L.halte) aktiv.add(id);
  for (const h of halte.values()) { h.inLinie = aktiv.has(h.id); h.umgebung = 0; }
  let l = 0, j = 0, alle = 0;
  for (const h of haeuser.values()) {
    let nah = null; for (const s of halte.values()) if (s.inLinie && Math.hypot(s.x - h.x, s.z - h.z) < HALT_RADIUS) { nah = s; break; }
    h.bus = !!nah; alle += leute(h); if (nah) { l += leute(h); j += jobs(h); nah.umgebung += leute(h) + jobs(h); }
  }
  busAbdeckung = { leute: l, jobs: j, anteil: alle ? l / alle : 0, fahrgaeste: Math.round(l * 0.6 + j * 0.3) };
}
const busKosten = () => { let b = 0; for (const L of linien.values()) b += L.busse; return b * BUS_UNTERHALT + halte.size * 5; };
const busEinnahmen = () => busAbdeckung.fahrgaeste * 0.8;
/* Linien auf der Karte */
const linienMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
linienMesh.renderOrder = 4; linienMesh.visible = false; szene.add(linienMesh);
let linienNeu = true;
function linienZeichnen() {
  linienNeu = false; const pos = [], col = []; let n = 0;
  for (const L of linien.values()) {
    const c = farbe(L.farbe), off = 0.06 + (n++ % 4) * 0.05;
    for (let i = 0; i < L.halte.length; i++) {
      const a = halte.get(L.halte[i]), b = halte.get(L.halte[(i + 1) % L.halte.length]); if (!a || !b || !kanten.has(a.k) || !kanten.has(b.k)) continue;
      const w = wegSuchen(haltPunkt(a), haltPunkt(b)); if (!w) continue;
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
    const e = naechsteKante(p, 2.2, (k) => TYP[k.typ].autos); if (!e) { tipp("Tipp direkt auf eine Straße mit Autoverkehr.", 2200); return; }
    if (halteBei(punktBei(e.k, e.s), 2.0)) { tipp("Hier ist schon eine Haltestelle.", 2000); return; }
    if (e.s < 0.8 || e.s > e.k.len - 0.8) { tipp("Nicht direkt auf die Kreuzung – etwas weiter in die Straße.", 2200); return; }
    if (geld < HALT_PREIS) { tipp("Zu wenig Geld.", 2000); return; }
    merkeRueck(); geld -= HALT_PREIS; neueHalte({ k: e.k.id, s: e.s }); busRechnen(); zeigeWerte(); speichernBald(); tipp("🚏 Haltestelle gebaut. Verbinde Haltestellen mit „🚌 Neue Linie“.", 3000);
  } else if (busModus === "linie") {
    const h = halteBei(p, 1.6); if (!h) { tipp("Tipp auf eine Haltestelle 🚏.", 2000); return; }
    if (linieBau.length >= 2 && h.id === linieBau[0]) { linieFertig(); return; }
    if (linieBau[linieBau.length - 1] === h.id) return;
    linieBau.push(h.id); linienVorschau();
  } else if (busModus === "weg") {
    const h = halteBei(p, 1.6); if (!h) { tipp("Tipp auf eine Haltestelle 🚏, um sie zu entfernen.", 2000); return; }
    merkeRueck(); halteWeg(h); busRechnen(); speichernBald(); tipp("Haltestelle entfernt.", 1800); unterleiste();
  }
}
function linienVorschau() {
  const n = linieBau.length;
  frage("🚌 Neue Linie: " + n + " Haltestelle" + (n === 1 ? "" : "n") + (n >= 2 ? " – ✓ zum Fertigstellen (oder erste Haltestelle antippen)" : " – tipp die nächste an"), n >= 2, linieFertig);
  linienNeu = true;
}
function linieFertig() {
  if (linieBau.length < 2) return;
  if (!linieErreichbar(linieBau)) { tipp("⚠️ Zwischen den Haltestellen gibt es keinen Weg. Verbinde die Straßen.", 3500); return; }
  merkeRueck();
  const nr = Math.max(0, ...[...linien.values()].map((L) => L.nr)) + 1, L = { id: linieId++, nr, farbe: LINIEN_FARBEN[(nr - 1) % LINIEN_FARBEN.length], halte: linieBau.slice(), busse: Math.max(1, Math.round(linieBau.length / 2)) };
  linien.set(L.id, L); linieBau = []; linieWahl = L.id; frageZu(); busModus = "halt"; busRechnen(); linienNeu = true; speichernBald(); unterleiste();
  tipp("🚌 Linie " + nr + " fährt! Mit + und − änderst du die Zahl der Busse.", 3500);
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
  const nvE = busEinnahmen(), nvK = busKosten(), einnahmen = ein.w + ein.g + ein.b + ein.i + nvE, dk = dienstKosten();
  return { e, jl, jb, ji, j: jl + jb + ji, ein, nvE, nvK, einnahmen, strassen, dienste: dk, ausgaben: strassen + dk + nvK, saldo: einnahmen - strassen - dk - nvK };
}
function bedarfBerechnen() {
  const k = kennzahlen(), arbeiter = k.e * 0.55;
  let w = 22 + (k.j - arbeiter) * 0.9 + (k.e < 40 ? 45 : 0);
  let l = (k.e * 0.22 - k.jl) * 1.5 + 8;
  let bil = 0, bn = 0; for (const h of wohnListe) { bil += (h.bildung || 0) * leute(h); bn += leute(h); } bil = bn ? bil / bn : 0;
  let b = zoneFrei(5) ? (k.e * (0.12 + bil * 0.06) - k.jb) * 1.3 + 10 : -100;
  let i = (arbeiter * (zoneFrei(5) ? 0.36 - bil * 0.06 : 0.42) - k.ji) * 1.2 + (k.e < 60 ? 25 : 0) + k.jl * 0.15;
  const s = (z, v) => (v - (steuern[z] - 9) * 4.5) * (1 - (steuern[z] - 9) * 0.05);
  bedarf = { w: klemme(s("w", w), -100, 100), g: klemme(s("g", l), -100, 100), b: klemme(s("b", b), -100, 100), i: klemme(s("i", i), -100, 100) };
  const balken = document.querySelectorAll("#bedarf i"); ["w", "g", "b", "i"].forEach((z, n) => { if (balken[n]) balken[n].style.height = Math.max(2, bedarf[z] / 100 * 26) + "px"; });
}
function meilensteinPruefen() {
  const e = kennzahlen().e;
  while (meilenstein < MEILEN.length - 1 && e >= MEILEN[meilenstein + 1].ab) {
    meilenstein++; const m = MEILEN[meilenstein]; geld += m.geld;
    const frei = m.frei.map((t) => TYP[t].em + " " + TYP[t].name).concat(Object.values(ZONEN).filter((z) => z.ab === meilenstein).map((z) => z.em + " " + z.name));
    infoZeigen(`<b>🎉 Meilenstein: ${m.name}!</b>Deine Stadt hat ${zahl(m.ab)} Einwohner.<br>+${euro(m.geld)} Belohnung${frei.length ? "<br>Neu: " + frei.join(", ") : ""}<br><small>Jetzt kannst du bis zu ${m.gebiete} Gebiete dazukaufen.</small>`, 7000);
    unterleiste();
  }
}
function wocheTakt() {
  const k = kennzahlen(); geld += k.saldo; letzteWoche = k; zeigeWerte();
  if (geld < 0 && geld - k.saldo >= 0) tipp("⚠️ Dein Geld ist im Minus! Senk die Ausgaben oder erhöh die Steuern.", 5000);
  if (werkzeug === "gebiet") gebieteZeichnen(); if (!$("budget").hidden) budgetZeigen(); speichernBald();
}
function zufriedenheit() {
  let n = 0, sum = 0;
  for (const h of wohnListe) { const a = h.abd || {}; let v = 52 + ((h.wert || 30) - 30) * 0.3 - (h.dreck || 0) * 0.5 + (a.polizei ? 5 : 0) + (a.feuer ? 5 : 0) + (a.gesund ? 5 : 0) + (h.bildung || 0) * 3 + (h.bus ? 3 : 0); if (h.problem) v -= ["krimi", "krank"].includes(h.problem) ? 10 : 25; sum += v * leute(h); n += leute(h); }
  const st = (steuern.w + steuern.g + steuern.b + steuern.i) / 4;
  return Math.round(klemme((n ? sum / n : 70) - (st - 9) * 3, 0, 100));
}
function zeigeWerte() {
  const k = kennzahlen(), d = Math.round(k.saldo);
  $("wGeld").textContent = euro(geld); $("wGeld").style.color = geld < 0 ? "#ff8a8a" : "";
  $("wEinw").textContent = zahl(k.e); $("wJobs").textContent = zahl(k.j);
  const z = zufriedenheit(); $("wFroh").textContent = (z >= 75 ? "😄 " : z >= 55 ? "🙂 " : z >= 35 ? "😐 " : "😟 ") + z + " %";
  const t = $("trend"); t.textContent = (d >= 0 ? "+" : "") + zahl(d) + "/Wo"; t.className = d >= 0 ? "plus" : "minus";
}
function datumZeigen() { const w = Math.floor(tage / 7) + 1, d = Math.floor(tage) % 7; $("datum").textContent = "Woche " + w + " · " + WOCHENTAGE[d]; }
function budgetZeigen() {
  const k = kennzahlen(), el = $("budget"), m = MEILEN[meilenstein], n = MEILEN[meilenstein + 1];
  const zeile = (a, b, cls) => `<div class="zeile ${cls || ""}"><span>${a}</span><span>${b}</span></div>`;
  const regler = (z) => `<div class="steuer" style="--c:${GRUPPEN[z].farbe}"><span>${GRUPPEN[z].em} ${GRUPPEN[z].name}</span><input type="range" min="1" max="29" value="${steuern[z]}" data-steuer="${z}" aria-label="Steuer ${GRUPPEN[z].name}"><b>${steuern[z]} %</b></div>`;
  const GR = ["w", "g", "b", "i"];
  const fort = n ? Math.min(100, (k.e - m.ab) / (n.ab - m.ab) * 100) : 100;
  el.innerHTML = `<h2>💶 Budget &amp; Steuern<button type="button" id="budgetZu" aria-label="Schließen">✕</button></h2>
    <div><h3>Pro Woche</h3>${GR.map((z) => zeile(GRUPPEN[z].em + " Steuern " + GRUPPEN[z].name, "<span class='plus'>+" + euro(k.ein[z]) + "</span>")).join("")}${zeile("🛣️ Unterhalt Straßen", "<span class='minus'>−" + euro(k.strassen) + "</span>")}${k.dienste ? zeile("🏛️ Unterhalt Dienste", "<span class='minus'>−" + euro(k.dienste) + "</span>") : ""}${k.nvK ? zeile("🚌 Nahverkehr (" + zahl(busAbdeckung.fahrgaeste) + " Fahrgäste)", "<span class='" + (k.nvE >= k.nvK ? "plus" : "minus") + "'>" + (k.nvE - k.nvK >= 0 ? "+" : "−") + euro(Math.abs(k.nvE - k.nvK)) + "</span>") : ""}${zeile("Ergebnis", "<span class='" + (k.saldo >= 0 ? "plus" : "minus") + "'>" + (k.saldo >= 0 ? "+" : "−") + euro(Math.abs(k.saldo)) + "</span>", "summe")}</div>
    <div><h3>Steuern</h3><div style="display:grid;gap:10px">${GR.map(regler).join("")}</div><small style="color:var(--leise);display:block;margin-top:8px">Hohe Steuern bringen mehr Geld, aber weniger Zuzug. 9 % ist ausgeglichen.</small></div>
    <div><h3>Versorgung</h3>${Object.keys(RESSOURCEN).map((r) => { const [pr, vb] = versorgung[r], ok = pr >= vb; return zeile(RESSOURCEN[r].em + " " + RESSOURCEN[r].name, `<span class="${ok ? "plus" : "minus"}">${zahl(vb)} / ${zahl(pr)}</span>`); }).join("")}<small style="color:var(--leise)">Gebraucht / vorhanden. Zu wenig? Bau mehr unter 🏛️ Dienste.</small></div>
    <div><h3>Bedarf</h3>${GR.map((z) => zeile(GRUPPEN[z].em + " " + GRUPPEN[z].name, z === "b" && !zoneFrei(5) ? "🔒 ab " + MEILEN[ZONEN[5].ab].name : bedarf[z] > 40 ? "hoch" : bedarf[z] > 10 ? "mittel" : bedarf[z] > 0 ? "wenig" : "keiner")).join("")}</div>
    <div><h3>Meilenstein: ${m.name}</h3>${n ? `<div class="leiste"><i style="width:${fort}%"></i></div><small style="color:var(--leise)">Nächster: <b>${n.name}</b> bei ${zahl(n.ab)} Einwohnern (jetzt ${zahl(k.e)})${(() => { const f = n.frei.map((t) => TYP[t].name).concat(Object.values(ZONEN).filter((z) => z.ab === meilenstein + 1).map((z) => z.name)); return f.length ? " – schaltet " + f.join(", ") + " frei" : ""; })()}</small>` : "<small>Höchster Meilenstein erreicht!</small>"}</div>`;
  el.hidden = false;
  $("budgetZu").onclick = () => { el.hidden = true; };
}
$("budget").addEventListener("input", (e) => { const z = e.target.dataset.steuer; if (!z) return; steuern[z] = +e.target.value; e.target.nextElementSibling.textContent = steuern[z] + " %"; bedarfBerechnen(); zeigeWerte(); speichernBald(); });
$("budget").addEventListener("change", () => budgetZeigen());

/* Wachstum nach Bedarf */
const zk = (g, s, i, r) => zellIndex.get(g + "|" + s + "|" + i + "|" + r);
function freiGleich(id, zone) { const z = id && zellen.get(id); return z && !z.haus && z.zone === zone ? z : null; }
let werteZeit = -99;
const stufeBildungOk = (h) => gruppe(h) !== "w" || ((h.stufe + 1 < 3 || (h.bildung || 0) >= 1) && (h.stufe + 1 < 5 || (h.bildung || 0) >= 2));
function wachsTakt() {
  bedarfBerechnen(); dienstTakt(0.5);
  if (simZeit - werteZeit > 4) { werteZeit = simZeit; werteAuffrischen(); }
  const kand = {};
  for (const z of zellen.values()) if (z.zone && !z.haus && z.r === 0 && zoneFrei(z.zone)) (kand[z.zone] = kand[z.zone] || []).push(z);
  for (const zone of Object.keys(kand).map(Number)) {
    const Z = ZONEN[zone], L = kand[zone], bd = bedarf[Z.gruppe], p = (bd > 0 ? 0.08 + bd / 100 * 0.75 : 0.03) * (zone >= 7 ? 0.7 : 1);
    if (Math.random() > p) continue;
    for (let versuch = 0; versuch < 5; versuch++) {
      const a = L[Math.floor(Math.random() * L.length)], ziel = Z.breite[0] + Math.floor(Math.random() * (Z.breite[1] - Z.breite[0] + 1));
      const spalten = [a]; for (let i = a.i + 1; spalten.length < ziel; i++) { const nb = freiGleich(zk(a.g, a.seite, i, 0), zone); if (!nb) break; spalten.push(nb); }
      for (let i = a.i - 1; spalten.length < Math.min(2, Z.breite[0]); i--) { const nb = freiGleich(zk(a.g, a.seite, i, 0), zone); if (!nb) break; spalten.unshift(nb); }
      if (spalten.length < Math.min(2, Z.breite[0])) continue;
      let tiefe = Z.tiefe; for (const s of spalten) { let t = 1; while (t < tiefe && freiGleich(zk(s.g, s.seite, s.i, t), zone)) t++; tiefe = Math.min(tiefe, t); }
      if (tiefe < (Z.minTiefe || 1)) continue;
      const ids = []; for (const s of spalten) for (let t = 0; t < tiefe; t++) ids.push(zk(s.g, s.seite, s.i, t));
      const h = neuesHaus({ zone, stufe: 1, w: spalten.length, d: tiefe, variante: (Math.random() * 1e6) | 0, zellen: ids });
      const r = bodenwert(h.x, h.z, h); h.wert = r.wert; h.dreck = r.dreck;
      if (gruppe(h) === "i") dreckZeichnen();
      break;
    }
  }
  const liste = [...haeuser.values()].filter((h) => { const Z = ZONEN[h.zone]; return !h.verlassen && !(h.problem && h.problem !== "krimi" && h.problem !== "krank") && stufeBildungOk(h) && h.stufe < Z.max && simZeit - (h.simGeboren || 0) > 25 && bedarf[Z.gruppe] > 5 && (h.wert || 0) >= (BODENWERT_FUER[Z.gruppe][h.stufe + 1] || 0); });
  if (liste.length && Math.random() < 0.45) {
    const h = liste[Math.floor(Math.random() * liste.length)]; h.stufe++; h.geboren = jetztS; h.simGeboren = simZeit; h.ab = 0.35; h.teile = hausTeile(h); h.box = null; haeuserNeu = true;
    h.hoehe = hoeheVon(h); hochZeigen(h, h.hoehe);
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
  bus: { name: "Bus", L: 1.3, B: 0.29, rad: 0.056, achsen: [0.43, -0.36], beschl: 1.5, brems: 5, vf: 0.82, lack: 0xf2c14e, form: { art: "kasten", sill: 0.06, belt: 0.18, roof: 0.4, nase: 0.18, hf: 0.645, wf: 0.635, glasBis: 0.645, band: true, extra: (t) => { t.push(kiste(0, 0.408, 0, 1.0, 0.02, 0.24, 0xd8d8d8), kiste(0.66, 0.36, 0, 0.01, 0.03, 0.14, SCHWARZ)); } } },
  lkw: { name: "Lkw", L: 0.95, B: 0.28, rad: 0.055, achsen: [0.07], beschl: 1.3, brems: 4.5, vf: 0.8, vorneL: 0.15, hintenL: 0.8, form: { art: "kasten", L: 0.27, sill: 0.06, belt: 0.2, roof: 0.36, nase: 0.18, hf: 0.13, wf: 0.115, glasBis: 0.06, extra: (t) => { t.push(kiste(-0.2, 0.065, 0, 0.16, 0.05, 0.2, ZIER), kiste(-0.09, 0.27, 0, 0.04, 0.14, 0.22, ZIER)); } } }
};
for (const [k, t] of Object.entries(FZ)) {
  const f = t.form, o = Object.assign({ L: t.L, B: t.B }, f);
  t.ly = (f.sill + f.nase) / 2 + 0.01; t.lyh = f.art === "kasten" ? f.belt : f.belt - 0.03; t.lx = f.x0 ? f.x0 + o.L / 2 : t.L / 2;
  t.geo = f.art === "pkw" ? pkwGeo(o) : kastenGeo(o);
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
const fzTeile = becken(G_BOX, M.auto, FZ_MAX * 5 + 10, true), fzLicht = becken(G_BOX, M.leuchte, FZ_MAX * 4 + 8, false);
const G_RAD = mergeGeometries([bunt(new THREE.CylinderGeometry(1, 1, 0.04, 12).rotateX(Math.PI / 2), 0x1b1d22), bunt(new THREE.CylinderGeometry(0.58, 0.58, 0.044, 10).rotateX(Math.PI / 2), 0xb9bfc7)]);
const fzRaeder = becken(G_RAD, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), FZ_MAX * 8 + 12, false);
const AUTO_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.36, metalness: 0.18 });
const fzMesh = {}; for (const k in FZ) fzMesh[k] = becken(FZ[k].geo, AUTO_MAT, k === "bus" || k === "muell" || k === "polizei" || k === "kranken" || k === "feuerwehr" ? 40 : FZ_MAX, true);
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
function wegSuchen(start, ziel) {
  const ks = kanten.get(start.k), kz = kanten.get(ziel.k); if (!ks || !kz) return null;
  if (ks === kz) { const dir = ziel.S >= start.S ? 1 : -1; return { route: [{ k: ks.id, dir }], s0: dir > 0 ? start.S : ks.len - start.S, s1: dir > 0 ? ziel.S : ks.len - ziel.S }; }
  const kosten = (k) => k.len / TYP[k.typ].tempo * (1 + k.stau * 2.5);
  const g = new Map(), von = new Map(), offen = [];
  const push = (id, wert, f) => { offen.push({ id, wert, f }); let i = offen.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (offen[p].f <= offen[i].f) break; [offen[p], offen[i]] = [offen[i], offen[p]]; i = p; } };
  const pop = () => { const top = offen[0], last = offen.pop(); if (offen.length) { offen[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < offen.length && offen[l].f < offen[m].f) m = l; if (r < offen.length && offen[r].f < offen[m].f) m = r; if (m === i) break; [offen[m], offen[i]] = [offen[i], offen[m]]; i = m; } } return top; };
  const zx = (knoten.get(kz.a).x + knoten.get(kz.b).x) / 2, zz = (knoten.get(kz.a).z + knoten.get(kz.b).z) / 2, h = (n) => Math.hypot(n.x - zx, n.z - zz) / 3.1;
  const t0 = TYP[ks.typ].tempo;
  const startWert = (nid, w, dir) => { if (w < (g.get(nid) ?? 1e9)) { g.set(nid, w); von.set(nid, { k: ks.id, dir, vor: null }); push(nid, w, w + h(knoten.get(nid))); } };
  startWert(ks.b, (ks.len - start.S) / t0, 1); startWert(ks.a, start.S / t0, -1);
  let bestZiel = null, bestWert = 1e9, schritte = 0;
  while (offen.length && schritte++ < 6000) {
    const { id, wert } = pop(); if (wert > (g.get(id) ?? 1e9)) continue; if (wert >= bestWert) break;
    const n = knoten.get(id);
    if (id === kz.a || id === kz.b) { const dir = id === kz.a ? 1 : -1, w = wert + (dir > 0 ? ziel.S : kz.len - ziel.S) / TYP[kz.typ].tempo; if (w < bestWert) { bestWert = w; bestZiel = { nid: id, dir }; } }
    for (const kid of n.kanten) {
      const k = kanten.get(kid); if (!TYP[k.typ].autos || k === kz) continue;
      const nach = k.a === id ? k.b : k.a, dir = k.a === id ? 1 : -1, w = wert + kosten(k);
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
function zufahrtAussen() { const n = knoten.get(aussenKnoten); if (!n) return null; const k = kanten.get([...n.kanten][0]); if (!k) return null; return { k: k.id, S: k.a === n.id ? 0.3 : k.len - 0.3 }; }
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
    netzGeaendert(); return true;
  }
  return false;
}
const pkwTyp = () => wahl(rv, PKW_TYPEN);
function hausName(h) { return h.name || ZONEN[h.zone].name; }
function auflieger(von, nach) { const q = von || nach; if (q && q.zone === 7) return "getreide"; if (q && q.zone === 8) return "holz"; if (karte === "wald" && rv() < 0.15) return "holz"; return nach && gruppe(nach) === "g" ? (rv() < 0.5 ? "kuehl" : "container") : wahl(rv, ["container", "container", "tank"]); }
function fahrtStarten() {
  if (simZeit - listenZeit > 2) listenAuffrischen();
  if (!wohnListe.length && !arbeitListe.length) return false;
  const r = rv(); let von, nach, typ, anh = null;
  if (aussenKnoten && r < 0.24) {
    // Verkehr von und nach außen: Pendler, Besucher, Lieferungen
    const ziel = rv() < 0.4 && industrieListe.length ? gewichtet(industrieListe, jobs) : arbeitListe.length && rv() < 0.6 ? gewichtet(arbeitListe, jobs) : wohnListe.length ? gewichtet(wohnListe, leute) : null;
    if (!ziel) return false;
    typ = gruppe(ziel) === "i" ? (rv() < 0.6 ? "lkw" : "liefer") : pkwTyp(); if (typ === "lkw") anh = auflieger(ziel, null);
    const za = zufahrtAussen(), zb = zufahrt(ziel); if (!za || !zb) return false;
    const rein = rv() < 0.55;
    return fahrzeugAusWeg(rein ? wegSuchen(za, zb) : wegSuchen(zb, za), typ, anh, rein ? "außerhalb der Stadt" : hausName(ziel), rein ? hausName(ziel) : "außerhalb der Stadt", rein ? "aussen" : "haus");
  }
  if (!wohnListe.length || !arbeitListe.length) return false;
  if (r < 0.38 && industrieListe.length && ladenListe.length) { von = gewichtet(industrieListe, jobs); nach = gewichtet(ladenListe, jobs); typ = rv() < 0.55 ? "lkw" : "liefer"; if (typ === "lkw") anh = auflieger(von, nach); }
  else { von = gewichtet(wohnListe, leute); nach = rv() < 0.25 && ladenListe.length ? gewichtet(ladenListe, jobs) : gewichtet(arbeitListe, jobs); typ = pkwTyp(); if (rv() < 0.5) [von, nach] = [nach, von]; }
  const za = zufahrt(von), zb = zufahrt(nach); if (!za || !zb) return false;
  const weg = wegSuchen(za, zb); if (!weg) { von.keinWeg = true; return false; }
  von.keinWeg = false;
  return fahrzeugAusWeg(weg, typ, anh, hausName(von), hausName(nach), "haus");
}
function fahrzeugAusWeg(weg, typ, anh, vonText, nachText, start) {
  if (!weg) return false;
  const k = kanten.get(weg.route[0].k), spur = TYP[k.typ].spuren.length - 1;
  if (fahrzeuge.some((f) => f.modus === "kante" && f.route[f.ri].k === k.id && f.route[f.ri].dir === weg.route[0].dir && Math.abs(f.s - weg.s0) < 1.4)) return false;
  const D = FZ[typ], amRand = start === "haus";
  { const q = spurPunkt(k, weg.route[0].dir, weg.s0, amRand ? TYP[k.typ].fahr + 0.02 : spurAbstand(k.typ, spur)); for (const g of fahrzeuge) if (g.pos && Math.hypot(g.pos.x - q.x, g.pos.z - q.z) < (g.L + D.L) / 2 + 0.15) return false; }
  const f = { id: fzId++, typ, ...D, farbe: D.lack || wahl(rv, PAL.auto), anh, anhFarbe: wahl(rv, CONTAINER), route: weg.route, ri: 0, s: weg.s0, sZiel: weg.s1, spur,
    off: amRand ? TYP[k.typ].fahr + 0.02 : spurAbstand(k.typ, spur), offV: 0, v: 0, modus: "kante", warte: 0, alter: 0, faktor: (0.88 + rv() * 0.24) * D.vf, roll: 0, nick: 0, blink: 0, bremst: false, frei: false,
    skala: amRand ? 0.01 : 1, parkt: 0, lenk: 0, anhWinkel: null, vonText, nachText, ausparken: amRand,
    zeitluecke: 0.65 + rv() * 0.55, beschl: D.beschl * (0.82 + rv() * 0.36), rueckT: amRand && weg.s0 > 1 && rv() < 0.6 ? 0.55 : 0, block: null };
  spurWaehlen(f); fahrzeuge.push(f); return f;
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
  f.spur = a === "links" || a === "wenden" ? 0 : a === "rechts" ? 1 : (f.spur != null ? Math.min(f.spur, 1) : 1);
}
function ampelZustand(n, kid) {
  const ph = simZeit % 20, gr = n.gruppe.get(kid) || 0;
  if (gr === 0) return ph < 8.5 ? "gruen" : ph < 10 ? "gelb" : "rot";
  return ph >= 10 && ph < 18.5 ? "gruen" : ph >= 18.5 ? "gelb" : "rot";
}
function netzVerkehrVorbereiten() {
  for (const n of knoten.values()) {
    let autoKanten = 0, haupt = false; for (const id of n.kanten) { const k = kanten.get(id); if (TYP[k.typ].autos) { autoKanten++; if (k.typ === "haupt") haupt = true; } }
    if (!n.manuell) n.ampel = autoKanten >= 4 || (autoKanten >= 3 && haupt);
    if (autoKanten < 3) n.ampel = false;
    n.gruppe = new Map(); let ref = null;
    for (const id of n.kanten) { const k = kanten.get(id); if (!TYP[k.typ].autos) continue; const d = richtungAm(k, k.a === n.id ? 1 : -1, true); if (!ref) ref = d; n.gruppe.set(id, Math.abs(ref.x * d.x + ref.z * d.z) > 0.7 ? 0 : 1); }
  }
  ampelnBauen();
}
function darfEinfahren(f, k, st, nx) {
  const n = endKnoten(k, st.dir), k2 = kanten.get(nx.k); if (!k2) return false;
  // ist auf der nächsten Spur Platz?
  const s2 = anfang(k2, nx.dir);
  for (const g of fahrzeuge) if (g !== f && g.modus === "kante" && g.route[g.ri].k === k2.id && g.route[g.ri].dir === nx.dir && g.s < s2 + g.hintenL + f.vorneL + 0.35) return false;
  if (n.ampel) { const z = ampelZustand(n, k.id); if (z === "rot") return false; if (z === "gelb" && !(ende(k, st.dir) - f.s < 0.7 && f.v > 1.2)) return false; if ([...n.drin].some((g) => g.von !== k.id && ampelZustand(n, g.von) !== ampelZustand(n, k.id) && g.trT < 0.6)) return false; return !wegeKreuzen(f, k, st, nx, n); }
  if (n.kanten.size <= 2) return true;
  for (const g of n.drin) if (g.von !== k.id) return false;
  if (n.vorrang && n.vorrang !== f && n.vorrang.route[n.vorrang.ri].k !== k.id) return false;
  if (k.typ !== "haupt") for (const g of n.naht) if (g !== f && kanten.get(g.route[g.ri].k).typ === "haupt" && g.v > 0.3 && g.warte < 3) return false;
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
function fahrzeugWeg(f) { for (const id of [f.tr && f.tr.knoten, f.reserviert]) { const n = id != null && knoten.get(id); if (n) n.drin.delete(f); } f.weg = true; }
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
      if (g === f || g.skala < 0.4) continue;
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
  for (const f of fahrzeuge) {
    if (f.weg) continue;
    f.alter += dt;
    if (f.skala < 1 && !f.parkt) f.skala = Math.min(1, f.skala + dt * 2.5);
    if (f.parkt) { f.parkt += dt; f.v = 0; if (f.parkt > 1.2) f.skala -= dt * 2.5; if (f.skala <= 0) fahrzeugWeg(f); continue; }
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
      for (const sp of f.ist === f.spur ? [f.spur] : [f.spur, f.ist]) { const l = spuren.get(st.k + ":" + st.dir + ":" + sp); if (!l) continue; const i = l.indexOf(f), v = l[i + 1]; if (v) { const lu = v.s - f.s - (v.hintenL + f.vorneL); if (lu < luecke) { luecke = lu; dv = f.v - v.v; vorder = v; } } }
      // Spurwechsel und Ausparken nur, wenn auf der Zielspur Platz ist
      const SP = TYP[kk.typ].spuren; let spurZiel = null;
      if (f.ausparken) { if (!spurFrei(spuren, st, f.ist, f) && Math.abs(f.off - SP[f.ist]) > 0.12) { spurZiel = f.off; vmax = 0; } else spurZiel = SP[f.ist]; }
      else if (f.ist !== f.spur) { const schritt = f.ist + Math.sign(f.spur - f.ist), wechselt = Math.abs(f.off - SP[f.ist]) > 0.08; if (!wechselt && !spurFrei(spuren, st, schritt, f)) { spurZiel = SP[f.ist]; vmax *= 0.8; } else spurZiel = SP[schritt]; }
      if (nx && !f.frei) { if (rest < 0.9 && darfEinfahren(f, kk, st, nx)) { f.frei = true; const n = endKnoten(kk, st.dir); f.von = kk.id; f.trT = 0; f.reserviert = n.id; n.drin.add(f); } if (!f.frei && rest - f.vorneL - 0.05 < luecke) { luecke = rest - f.vorneL - 0.05; dv = f.v; } }
      if (spieler.an) { const p = spurPunkt(kk, st.dir, f.s, f.off), dx = spieler.x - p.x, dz = spieler.z - p.z, vorne = dx * p.tx + dz * p.tz, seit = Math.abs(-dx * p.tz + dz * p.tx); if (vorne > 0 && vorne < 2.4 && seit < 0.4 && vorne - 0.6 < luecke) { luecke = vorne - 0.6; dv = f.v; } }
      if (f.block != null && f.block < luecke) { luecke = f.block; dv = f.v; }
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
      const fe = 9, da = 2 * Math.sqrt(fe);
      f.offV += (fe * (zielOff - f.off) - da * f.offV) * dt; f.offV = klemme(f.offV, -0.6, 0.6); f.off += f.offV * dt;
      if (f.ausparken && Math.abs(f.off - zielOff) < 0.04) f.ausparken = false;
      f.blink = f.ausparken ? -1 : f.ist !== f.spur ? (f.spur < f.ist ? -1 : 1) : nx && (ab === "links" || ab === "rechts") && rest < 4.5 ? (ab === "links" ? -1 : 1) : letzte && rest < 3 ? 1 : 0;
      if (f.s >= e) {
        if (letzte && f.linie) { f.s = e; f.v = 0; f.halt = 2.5; continue; }
        if (letzte) { f.s = e; f.parkt = 0.001; f.blink = 0; if (f.beiAnkunft) { const cb = f.beiAnkunft; f.beiAnkunft = null; cb(f); } continue; }
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
  if (f.modus === "kante") { const kk = kanten.get(f.route[f.ri].k); if (!kk) return null; const p = spurPunkt(kk, f.route[f.ri].dir, f.s, f.off); x = p.x; z = p.z; tx = p.tx; tz = p.tz;
    if (f.v > 0.05) { const q = f.offV / Math.max(f.v, 0.4); const hx = tx - tz * q, hz = tz + tx * q, l = Math.hypot(hx, hz); tx = hx / l; tz = hz / l; } }
  else { const tr = f.tr, t = tr.t, p = bez(tr.p0, tr.c, tr.p2, t), q = bez(tr.p0, tr.c, tr.p2, Math.min(1, t + 0.04)), r = bez(tr.p0, tr.c, tr.p2, Math.max(0, t - 0.04)); x = p.x; z = p.z; tx = q.x - r.x; tz = q.z - r.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; }
  return { x, z, tx, tz };
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
    _m.compose(_v.set(pose.x, G + 0.02, pose.z), _q, _s.set(sk, sk, sk));
    { const m = fzMesh[f.typ]; if (anzahl[f.typ] < m.instanceMatrix.count) { m.setMatrixAt(anzahl[f.typ], _m); m.setColorAt(anzahl[f.typ], _farbe.setHex(f.farbe)); anzahl[f.typ]++; } }
    const r = f.rad; f.achsen.forEach((ax, i) => { for (const rz of [f.B / 2 - 0.012, -f.B / 2 + 0.012]) rad(ax, rz, r, i === 0 ? f.lenk : 0, _m); });
    // Lkw-Auflieger: knickt in Kurven ab
    if (f.anh) {
      const hx = pose.x - pose.tx * 0.12, hz = pose.z - pose.tz * 0.12;
      if (f.anhWinkel == null) f.anhWinkel = kurs;
      let d = Math.atan2(Math.sin(kurs - f.anhWinkel), Math.cos(kurs - f.anhWinkel)); f.anhWinkel += Math.sin(d) * (f.v * dtz) / 0.42; d = Math.atan2(Math.sin(kurs - f.anhWinkel), Math.cos(kurs - f.anhWinkel)); if (Math.abs(d) > 1.2) f.anhWinkel = kurs - Math.sign(d) * 1.2;
      const ax = Math.cos(f.anhWinkel), az = -Math.sin(f.anhWinkel);
      _e.set(f.roll * 0.6, f.anhWinkel, f.nick * 0.5, "YZX"); _q.setFromEuler(_e);
      _m2.compose(_v.set(hx - ax * 0.35, G + 0.02, hz - az * 0.35), _q, _s.set(sk, sk, sk));
      for (const t of AUFLIEGER[f.anh].teile) teil(t, f, _m2);
      for (const axx of [-0.18, -0.28]) for (const rz of [0.128, -0.128]) rad(axx, rz, 0.05, 0, _m2);
      _e.set(f.roll, kurs, f.nick, "YZX"); _q.setFromEuler(_e); _m.compose(_v.set(pose.x, G + 0.02, pose.z), _q, _s.set(sk, sk, sk));
    }
    const L = f.lx + 0.003, Lh = -f.hintenL - 0.004, Bq = f.B * 0.33, D = FZ[f.typ];
    const licht = (lx, ly, lz, c, mat, sx) => { if (li >= fzLicht.instanceMatrix.count) return; _l.compose(_v.set(lx, ly, lz), _q0, _s.set(sx || 0.014, 0.024, 0.05)); fzLicht.setMatrixAt(li, _l.premultiply(mat)); fzLicht.setColorAt(li, c); li++; };
    licht(L, D.ly, Bq, f.blink === -1 && blinkAn ? orange : scheinwerfer, _m); licht(L, D.ly, -Bq, f.blink === 1 && blinkAn ? orange : scheinwerfer, _m);
    const hinten = f.anh ? _m2 : _m, hx2 = f.anh ? -0.325 : Lh, hy = f.anh ? 0.1 : D.lyh, rueckFarbe = f.rueckT > 0 ? weiss : f.bremst ? rueck : rueckSchwach;
    licht(hx2, hy, Bq, f.blink === -1 && blinkAn ? orange : rueckFarbe, hinten); licht(hx2, hy, -Bq, f.blink === 1 && blinkAn ? orange : rueckFarbe, hinten);
    if (D.blau) { const bx = f.typ === "kranken" ? 0.1 : f.typ === "feuerwehr" ? 0.25 : -0.05; licht(bx, D.blau + 0.006, 0.035, blauAn ? blau1 : aus, _m, 0.03); licht(bx, D.blau + 0.006, -0.035, blauAn ? aus : blau1, _m, 0.03); }
  }
  fzTeile.count = ti; fzLicht.count = li; fzRaeder.count = ri2;
  for (const k in fzMesh) { const m = fzMesh[k]; m.count = anzahl[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  fzTeile.instanceMatrix.needsUpdate = fzLicht.instanceMatrix.needsUpdate = fzRaeder.instanceMatrix.needsUpdate = true;
  if (fzTeile.instanceColor) fzTeile.instanceColor.needsUpdate = true; if (fzLicht.instanceColor) fzLicht.instanceColor.needsUpdate = true;
}
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _l = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q0 = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

/* Ampeln */
const ampelMast = becken(G_BOX_UNTEN, M.flach, 1200, true), ampelLicht = becken(G_BOX, M.leuchte, 1200, false);
let ampelListe = [];
function ampelnBauen() {
  ampelListe = []; let i = 0;
  for (const n of knoten.values()) {
    if (!n.ampel) continue;
    for (const id of n.kanten) {
      const k = kanten.get(id); if (!TYP[k.typ].autos) continue;
      const dir = k.b === n.id ? 1 : -1, e = ende(k, dir), p = spurPunkt(k, dir, Math.max(0, e - 0.1), TYP[k.typ].halb - 0.12);
      _o.position.set(p.x, G + 0.012, p.z); _o.rotation.set(0, 0, 0); _o.scale.set(0.045, 0.62, 0.045); _o.updateMatrix(); ampelMast.setMatrixAt(i, _o.matrix); ampelMast.setColorAt(i, _farbe.setHex(0x3a3f47));
      ampelListe.push({ n, k: k.id, x: p.x, z: p.z, rot: Math.atan2(-p.tz, p.tx) }); i++;
    }
  }
  ampelMast.count = i; ampelMast.instanceMatrix.needsUpdate = true; if (ampelMast.instanceColor) ampelMast.instanceColor.needsUpdate = true;
}
function ampelnZeichnen() {
  const rot = new THREE.Color(1, 0.12, 0.08), gelb = new THREE.Color(1, 0.75, 0.05), gruen = new THREE.Color(0.15, 1, 0.35);
  ampelListe.forEach((a, i) => {
    const z = ampelZustand(a.n, a.k);
    _o.position.set(a.x, G + 0.66, a.z); _o.rotation.set(0, a.rot, 0); _o.scale.set(0.08, 0.1, 0.08); _o.updateMatrix(); ampelLicht.setMatrixAt(i, _o.matrix);
    ampelLicht.setColorAt(i, z === "rot" ? rot : z === "gelb" ? gelb : gruen);
  });
  ampelLicht.count = ampelListe.length; ampelLicht.instanceMatrix.needsUpdate = true; if (ampelLicht.instanceColor) ampelLicht.instanceColor.needsUpdate = true;
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
  const ks = [...kanten.values()].filter((k) => !k.aussen); if (!ks.length) { menschen.count = koepfe.count = 0; return; }
  const ziel = Math.min(STUFEN[stufe].leute, Math.round(einwohner / 9 + ks.filter((k) => k.typ === "fuss").length * 2));
  leuteListe = leuteListe.filter((p) => kanten.has(p.k));
  while (leuteListe.length < ziel) { const k = wahl(rv, ks), kind = rv() < 0.12; leuteListe.push({ k: k.id, dir: rv() < 0.5 ? 1 : -1, s: rv() * k.len, v: (kind ? 0.38 : 0.28) + rv() * 0.2, seite: rv() < 0.5 ? 1 : -1, c: wahl(rv, KLEIDUNG), haut: wahl(rv, HAUT), g: kind ? 0.68 : 0.9 + rv() * 0.2, ph: rv() * 6, pause: 0 }); }
  if (leuteListe.length > ziel) leuteListe.length = ziel;
  const lauf = dt * tempo;
  leuteListe.forEach((p, i) => {
    let k = kanten.get(p.k);
    if (p.pause > 0) p.pause -= lauf; else { p.s += p.v * lauf; p.ph += lauf * p.v * 22; if (rv() < lauf * 0.02) p.pause = 1 + rv() * 3; }
    if (p.s > k.len) { p.s -= k.len; const nid = p.dir > 0 ? k.b : k.a, n = knoten.get(nid), w = [...n.kanten].filter((id) => id !== k.id && !kanten.get(id).aussen), nk = kanten.get(w.length ? wahl(rv, w) : k.id); p.k = nk.id; p.dir = nk.a === nid ? 1 : -1; k = nk; }
    const off = k.typ === "fuss" ? 0.17 * p.seite : (TYP[k.typ].halb - 0.14) * p.seite, q = spurPunkt(k, p.dir, Math.min(p.s, k.len), off);
    const geht = p.pause <= 0 && tempo > 0, hub = geht ? Math.abs(Math.sin(p.ph)) * 0.014 : 0, wipp = geht ? Math.sin(p.ph) * 0.09 : 0;
    _o.position.set(q.x, G + 0.012 + hub, q.z); _o.rotation.set(wipp, Math.atan2(-q.tz, q.tx) - Math.PI / 2, 0); _o.rotation.order = "YXZ"; _o.scale.setScalar(p.g); _o.updateMatrix();
    menschen.setMatrixAt(i, _o.matrix); menschen.setColorAt(i, _farbe.setHex(p.c));
    koepfe.setMatrixAt(i, _o.matrix); koepfe.setColorAt(i, _farbe.setHex(p.haut)); _o.rotation.order = "XYZ";
  });
  let mi = leuteListe.length;
  for (const h of halte.values()) { const k = kanten.get(h.k); if (!k) continue; const o = TYP[k.typ].halb - 0.05; for (let j = 0; j < Math.floor(h.wartend) && mi < 118; j++) { const sei = j % 2 ? 1 : -1, cs = Math.cos(h.rot), sn = Math.sin(h.rot), lx = -0.18 + (j >> 1) * 0.14, lz = sei * o; _o.position.set(h.x + lx * cs + lz * sn, G + 0.012, h.z - lx * sn + lz * cs); _o.rotation.set(0, h.rot + (sei > 0 ? Math.PI : 0), 0); _o.scale.setScalar(0.95); _o.updateMatrix(); menschen.setMatrixAt(mi, _o.matrix); menschen.setColorAt(mi, _farbe.setHex(KLEIDUNG[(h.id + j) % KLEIDUNG.length])); koepfe.setMatrixAt(mi, _o.matrix); koepfe.setColorAt(mi, _farbe.setHex(HAUT[(h.id * 3 + j) % HAUT.length])); mi++; } }
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
      const p = punktBei(k, s), o = T.halb - 0.1, x = p.x - p.tz * o, z = p.z + p.tx * o, h = k.typ === "fuss" ? 0.55 : 0.82;
      _o.position.set(x, G + 0.012, z); _o.rotation.set(0, 0, 0); _o.scale.set(0.05, h, 0.05); _o.updateMatrix(); masten.setMatrixAt(i, _o.matrix); masten.setColorAt(i, _farbe.setHex(0x50555e)); i++;
      pos.push(x, G + h + 0.06, z);
    }
  }
  masten.count = i; masten.instanceMatrix.needsUpdate = true; if (masten.instanceColor) masten.instanceColor.needsUpdate = true;
  laternen.geometry.dispose(); laternen.geometry = new THREE.BufferGeometry(); laternen.geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos.length ? pos : [0, -50, 0], 3));
}
const pfeiler = becken(G_BOX_UNTEN, new THREE.MeshStandardMaterial({ color: 0xb9b4a8, roughness: 0.9 }), 400, true);
function brueckenZeichnen() {
  let i = 0;
  for (const k of kanten.values()) for (let s = 1; s < k.len && i < 400; s += 3) { const p = punktBei(k, s); if (abstand(p.x, p.z) > 0.3) continue; _o.position.set(p.x, -2.5, p.z); _o.rotation.set(0, Math.atan2(-p.tz, p.tx), 0); _o.scale.set(0.35, 2.6, TYP[k.typ].halb * 1.6); _o.updateMatrix(); pfeiler.setMatrixAt(i++, _o.matrix); }
  pfeiler.count = i; pfeiler.instanceMatrix.needsUpdate = true;
}
function netzGeaendert() {
  netzVersion++; brueckenZeichnen();
  fahrzeuge.forEach((f) => { if (f.route.some((st) => !kanten.has(st.k))) fahrzeugWeg(f); }); fahrzeuge = fahrzeuge.filter((f) => !f.weg);
  for (const n of knoten.values()) n.drin = new Set([...n.drin].filter((f) => !f.weg));
  netzVerkehrVorbereiten(); laternenBauen(); alleeZeichnen(); halteNeuAnkern(); zellenNeu = true; speichernBald();
}

/* ================================================================
   Spielstände
   ================================================================ */
let platz = 1;
const platzKey = (n) => "inselstadt-v3-" + n;
function zustand() {
  const r = (v) => Math.round(v * 1000) / 1000, k = kennzahlen();
  return {
    v: 3, zonenV: 2, karte, geld: Math.round(geld), besitz: [...besitz], gekauft, steuern, meilenstein, tage: Math.round(tage * 100) / 100, ids: { n: nId, k: kId, z: zId, g: gId, h: hId, d: dId, hs: haltId, l: linieId },
    meta: { einwohner: k.e, gespeichert: Date.now() },
    knoten: [...knoten.values()].map((n) => [n.id, r(n.x), r(n.z), n.manuell ? (n.ampel ? 1 : 0) : -1, n.aussen ? 1 : 0]),
    kanten: [...kanten.values()].map((k) => [k.id, k.a, k.b, r(k.c.x), r(k.c.z), k.typ, k.aussen ? 1 : 0]),
    zellen: [...zellen.values()].map((z) => [z.id, r(z.x), r(z.z), r(z.rot), z.zone, z.g, z.seite, z.i, z.r]),
    haeuser: [...haeuser.values()].map((h) => [h.id, h.zone, h.stufe, h.w, h.d, h.variante, h.zellen]),
    dienste: [...dienste.values()].map((d) => [d.id, d.typ, r(d.x), r(d.z), r(d.rot)]), dienstV: 1,
    halte: [...halte.values()].map((h) => [h.id, h.k, r(h.s)]), linien: [...linien.values()].map((L) => [L.id, L.nr, L.farbe, L.halte, L.busse]),
    baeume: baeume.filter((b) => b.weg).map((b) => b.idx)
  };
}
let speicherTimer = 0, speichernAus = false, spielLaeuft = false;
function speichernBald() { if (!spielLaeuft) return; clearTimeout(speicherTimer); if (!speichernAus) speicherTimer = setTimeout(() => { if (!merke(platzKey(platz), zustand())) tipp("⚠️ Speichern hat nicht geklappt – der Speicher ist voll.", 4000); }, 900); }
function allesLeeren() {
  for (const k of kanten.values()) { szene.remove(k.mesh); k.mesh.geometry.dispose(); }
  for (const n of knoten.values()) if (n.mesh) { szene.remove(n.mesh); n.mesh.geometry.dispose(); }
  aussenKnoten = null; hochListe.length = 0; dienste.clear(); warteListe = []; halte.clear(); linien.clear(); linieBau = []; linieWahl = null; dreckMesh.count = 0; kanten.clear(); knoten.clear(); zellen.clear(); zellIndex.clear(); raster.clear(); haeuser.clear(); fahrzeuge = []; leuteListe = [];
  for (const b of baeume) if (b.weg) { b.weg = false; baumSetzen(b); }
}
function zustandRein(d) {
  geld = d.geld; besitz = new Set(d.besitz); gekauft = d.gekauft || 0; meilenstein = d.meilenstein || 0; tage = d.tage || 0;
  if (d.steuern) steuern = d.steuern.w != null ? Object.assign({ w: 9, g: 9, b: 9, i: 9 }, d.steuern) : { w: d.steuern[1] || 9, g: d.steuern[2] || 9, b: 9, i: d.steuern[3] || 9 };
  if (!d.zonenV) {
    // alte Spielstände: 3 Zonen → neue Zonen wie bei Cities: Skylines
    const um = { 1: 1, 2: 3, 3: 6 }, zz = new Map();
    d.haeuser = d.haeuser.map(([id, zone, stufe, w, dd, variante, ids]) => { let nz = um[zone] || 1, ns = stufe; if (zone === 1 && stufe >= 3) nz = 2; if (zone === 2 && stufe >= 3) { nz = 4; ns = 2; } ns = Math.min(ns, ZONEN[nz].max); ids.forEach((c) => zz.set(c, nz)); return [id, nz, ns, w, dd, variante, ids]; });
    d.zellen = d.zellen.map((c) => { const n = c.slice(); n[4] = zz.get(c[0]) || um[c[4]] || 0; return n; });
  }
  d.knoten.forEach(([id, x, z, am, au]) => { const n = neuerKnoten({ x, z }, id); if (am != null && am >= 0) { n.manuell = true; n.ampel = am === 1; } if (au) { n.aussen = true; aussenKnoten = id; } });
  d.kanten.forEach(([id, a, b, cx, cz, typ, au]) => { if (knoten.has(a) && knoten.has(b)) { const k = neueKante(a, b, { x: cx, z: cz }, TYP[typ] ? typ : "klein", id); if (au) k.aussen = true; } });
  for (const n of [...knoten.values()]) if (!n.kanten.size) knotenWeg(n);
  d.zellen.forEach(([id, x, z, rot, zone, g, seite, i, r]) => neueZelle({ id, x, z, rot, zone, g, seite, i, r }));
  d.haeuser.forEach(([id, zone, stufe, w, dd, variante, ids]) => { if (ids.every((z) => zellen.has(z) && !zellen.get(z).haus)) neuesHaus({ id, zone, stufe, w, d: dd, variante, zellen: ids }, true); });
  d.baeume.forEach((i) => { const b = baeume[i]; if (b) { b.weg = true; baumSetzen(b); } });
  (d.dienste || []).forEach(([id, typ, x, z, rot]) => { if (DIENSTE[typ]) neuerDienst({ id, typ, x, z, rot }, true); });
  if (d.ids.d) dId = Math.max(dId, d.ids.d);
  (d.halte || []).forEach(([id, k, s2]) => { if (kanten.has(k)) neueHalte({ id, k, s: s2 }, true); });
  (d.linien || []).forEach(([id, nr, f, hs, busse]) => { const L = { id, nr, farbe: f, halte: hs.filter((x) => halte.has(x)), busse }; if (L.halte.length >= 2) linien.set(id, L); linieId = Math.max(linieId, id + 1); });
  haltId = Math.max(haltId, d.ids.hs || 1); linieId = Math.max(linieId, d.ids.l || 1); linienNeu = true;
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
  U.uNacht.value = nacht;
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
function tipp(t, ms) { const el = $("tipp"); el.textContent = t; el.classList.remove("weg"); clearTimeout(tippTimer); tippTimer = setTimeout(() => el.classList.add("weg"), ms || 4000); }
let infoTimer = 0;
function infoZeigen(html, ms) { const el = $("info"); el.innerHTML = html; el.hidden = false; clearTimeout(infoTimer); infoTimer = setTimeout(() => { el.hidden = true; }, ms || 5000); }

let strTyp = lade("inselstadt-strtyp", "klein"), strModus = lade("inselstadt-strmodus", "gerade"), zoneWahl = 1, pinsel = "klein";
if (!TYP[strTyp]) strTyp = "klein"; if (!["gerade", "kurve", "ampel"].includes(strModus)) strModus = "gerade";
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
  strasse: () => strModus === "ampel" ? "🚦 Tipp auf eine Kreuzung, um die Ampel ein- oder auszuschalten." : strModus === "gerade" ? "🛣️ Tipp auf den Anfang, dann aufs Ende. Dann ✓ zum Bauen." : "〰️ Tipp auf den Anfang, dann den Kurvenpunkt, dann das Ende. Dann ✓.",
  dienst: "🏛️ Wähl ein Gebäude und tipp neben eine Straße. Dann ✓ zum Bauen.",
  park: "🌳 Wähl einen Park und tipp neben eine Straße. Dann ✓ zum Bauen.",
  verkehr: () => busModus === "halt" ? "🚏 Tipp auf eine Straße, um eine Haltestelle zu bauen (" + HALT_PREIS + " €)." : busModus === "linie" ? "🚌 Tipp die Haltestellen der Reihe nach an. Dann ✓." : "🧹 Tipp auf eine Haltestelle, um sie zu entfernen.",
  zone: () => pinsel === "fuellen" ? "🪣 Tipp neben eine Straße – die ganze Straßenseite wird angemalt." : "🖌️ Wisch über die grauen Felder neben den Straßen, um sie anzumalen.",
  gebiet: "🗺️ Tipp auf ein Preisschild, um das Gebiet zu kaufen.",
  abriss: "🧹 Tipp auf eine Straße, um sie abzureißen. Über Häuser und Zonen wischen löscht sie."
};
/* Fach über der Werkzeugleiste: Karten mit Bild, Name und Preis (wie bei Cities: Skylines) */
const kk = (attr, wert, em, name, preis, an, zu) => `<button class="kk" type="button" ${attr}="${wert}" aria-pressed="${!!an}"${zu ? ' data-zu="1"' : ""}><span class="em">${em}</span><b>${name}</b>${preis ? `<small>${preis}</small>` : ""}</button>`;
const chip = (attr, wert, txt, an) => `<button class="chip" type="button" ${attr}="${wert}" aria-pressed="${!!an}">${txt}</button>`;
const rueckChip = '<button class="chip" type="button" id="rueck">↩️ Rückgängig</button>';
function unterleiste() {
  const u = $("fach"); let kopf = "", karten = "";
  if (werkzeug === "ansehen") {
    kopf = '<span class="ftitel">👆 Ansehen</span><small style="color:var(--leise)">Haus oder Auto antippen für Infos</small>';
    karten = kk("id", "fahrenKnopf", "🚗", "Selbst fahren", "", false) + kk("id", "budgetKarte", "💶", "Budget &amp; Steuern", "", false) + kk("id", "ansichtKarte", "🔍", "Info-Ansichten", "", false);
  } else if (werkzeug === "strasse") {
    kopf = '<span class="ftitel">🛣️ Straßen</span>' + chip("data-modus", "gerade", "📏 Gerade", strModus === "gerade") + chip("data-modus", "kurve", "〰️ Kurve", strModus === "kurve") + chip("data-modus", "ampel", "🚦 Ampeln", strModus === "ampel") + '<span class="trenn"></span>' + rueckChip;
    karten = Object.keys(TYP).map((k) => { const frei = typFrei(k), m = MEILEN.find((x) => x.frei.includes(k)); return kk("data-typ", k, TYP[k].em, TYP[k].name, frei ? TYP[k].preis + " €/Feld" : "ab " + (m ? m.name : ""), k === strTyp, !frei); }).join("");
  } else if (werkzeug === "zone") {
    kopf = '<span class="ftitel">🏘️ Zonen</span>' + chip("data-pinsel", "klein", "🖌️ Klein", pinsel === "klein") + chip("data-pinsel", "gross", "🖌️ Groß", pinsel === "gross") + chip("data-pinsel", "fuellen", "🪣 Füllen", pinsel === "fuellen") + '<span class="trenn"></span>' + rueckChip;
    karten = Object.keys(ZONEN).map(Number).map((z) => { const f = zoneFrei(z), Z = ZONEN[z]; return kk("data-zone", z, Z.em, Z.name, f ? GRUPPEN[Z.gruppe].name : "ab " + MEILEN[Z.ab].name, z === zoneWahl, !f); }).join("") + kk("data-zone", 0, "🧽", "Zone entfernen", "", zoneWahl === 0);
  } else if (werkzeug === "dienst" || werkzeug === "park") {
    if (werkzeug === "dienst") kopf = '<span class="ftitel">🏛️ Dienste</span>' + Object.keys(DIENST_KAT).filter((k) => k !== "park").map((k) => chip("data-dkat", k, DIENST_KAT[k].em + " " + DIENST_KAT[k].name, dienstKat === k)).join("");
    else kopf = '<span class="ftitel">🌳 Parks</span><small style="color:var(--leise)">Parks machen den Boden wertvoller und die Leute froher</small>';
    karten = Object.keys(DIENSTE).filter((k) => DIENSTE[k].kat === dienstKat).map((k) => { const D = DIENSTE[k], f = dienstFrei(k); return kk("data-dienst", k, D.em, D.name, f ? euro(D.preis) : "ab " + MEILEN[D.ab].name, k === dienstWahl, !f); }).join("");
  } else if (werkzeug === "verkehr") {
    const L = linieWahl && linien.get(linieWahl);
    kopf = '<span class="ftitel">🚌 Nahverkehr</span>' + chip("data-bmodus", "halt", "🚏 Haltestelle", busModus === "halt") + chip("data-bmodus", "linie", "🚌 Neue Linie", busModus === "linie") + chip("data-bmodus", "weg", "🧹 Entfernen", busModus === "weg") + '<span class="trenn"></span>' + rueckChip;
    if (L) kopf += `<span class="trenn"></span><span class="ftitel" style="color:#${L.farbe.toString(16).padStart(6, "0")}">Linie ${L.nr}</span><button class="chip" type="button" id="busMinus">−</button><span style="white-space:nowrap">🚌 ${L.busse}</span><button class="chip" type="button" id="busPlus">+</button><button class="chip gefahr" type="button" id="linieLoeschen">🗑️</button>`;
    karten = [...linien.values()].map((x) => kk("data-linie", x.id, `<span style="display:inline-block;width:26px;height:26px;border-radius:50%;background:#${x.farbe.toString(16).padStart(6, "0")};color:#fff;font-size:.9rem;line-height:26px;font-weight:700">${x.nr}</span>`, "Linie " + x.nr, x.halte.length + " Halte · " + x.busse + " 🚌", x.id === linieWahl)).join("") || "";
    if (!karten) karten = `<small style="color:var(--leise);padding:8px">Noch keine Linie. 1. Haltestellen bauen · 2. „Neue Linie“ und Haltestellen antippen · ${zahl(busAbdeckung.fahrgaeste)} Fahrgäste</small>`;
  } else if (werkzeug === "gebiet") {
    const m = MEILEN[meilenstein], frei = m.gebiete - gekauft;
    kopf = '<span class="ftitel">🗺️ Gebiete</span><small style="color:var(--leise)">' + (frei > 0 ? `Du kannst noch ${frei} Gebiet${frei > 1 ? "e" : ""} kaufen · nächstes kostet ${euro(GEBIET_PREIS(gekauft))}` : "Mehr Gebiete beim nächsten Meilenstein") + "</small>";
  } else if (werkzeug === "abriss") {
    kopf = '<span class="ftitel">🧹 Abriss</span><small style="color:var(--leise)">Straße antippen · über Häuser wischen</small><span class="trenn"></span>' + rueckChip;
  }
  u.innerHTML = (kopf ? `<div class="fkopf">${kopf}</div>` : "") + (karten ? `<div class="fkarten">${karten}</div>` : "");
  u.hidden = !kopf && !karten; rueckKnopf();
}
$("fach").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.id === "rueck") { rueckgaengig(); return; }
  if (b.id === "fahrenKnopf") { fahrenStarten(); return; }
  if (b.id === "budgetKarte") { budgetZeigen(); return; }
  if (b.id === "ansichtKarte") { ansichtenAufZu(); return; }
  if (b.dataset.typ) { if (!typFrei(b.dataset.typ)) { const m = MEILEN.find((x) => x.frei.includes(b.dataset.typ)); tipp("🔒 " + TYP[b.dataset.typ].name + " gibt es ab " + (m ? m.name + " (" + zahl(m.ab) + " Einwohner)" : "später") + ".", 3000); return; } strTyp = b.dataset.typ; merke("inselstadt-strtyp", strTyp); planNeu(); }
  if (b.dataset.modus) { strModus = b.dataset.modus; merke("inselstadt-strmodus", strModus); bauAbbrechen(); tipp(TIPPS.strasse(), 3500); }
  if (b.dataset.zone != null) { const z = +b.dataset.zone; if (z && !zoneFrei(z)) { tipp("🔒 " + ZONEN[z].name + " gibt es ab dem Meilenstein " + MEILEN[ZONEN[z].ab].name + " (" + zahl(MEILEN[ZONEN[z].ab].ab) + " Einwohner).", 3500); return; } zoneWahl = z; if (z) tipp(ZONEN[z].em + " " + ZONEN[z].name + ": " + ZONEN_TEXT[z], 4000); }
  if (b.dataset.pinsel) { pinsel = b.dataset.pinsel; tipp(TIPPS.zone(), 3500); }
  if (b.dataset.bmodus) { busModus = b.dataset.bmodus; linieBau = []; frageZu(); linienNeu = true; tipp(TIPPS.verkehr(), 3500); }
  if (b.dataset.linie) { linieWahl = +b.dataset.linie === linieWahl ? null : +b.dataset.linie; }
  if (b.id === "busPlus" || b.id === "busMinus") { const L = linien.get(linieWahl); if (L) { L.busse = klemme(L.busse + (b.id === "busPlus" ? 1 : -1), 1, 12); if (b.id === "busMinus") { const fz = fahrzeuge.filter((f) => f.linie === L.id); if (fz.length > L.busse) fahrzeugWeg(fz[0]); fahrzeuge = fahrzeuge.filter((f) => !f.weg); } speichernBald(); zeigeWerte(); } }
  if (b.id === "linieLoeschen") { const L = linien.get(linieWahl); if (L) { merkeRueck(); linieWeg(L); linieWahl = null; busRechnen(); speichernBald(); } }
  if (b.dataset.dkat) { dienstKat = b.dataset.dkat; dienstWahl = Object.keys(DIENSTE).find((k) => DIENSTE[k].kat === dienstKat); vorschauWeg(); frageZu(); }
  if (b.dataset.dienst) { const k = b.dataset.dienst, D = DIENSTE[k]; if (!dienstFrei(k)) { tipp("🔒 " + D.name + " gibt es ab " + MEILEN[D.ab].name + " (" + zahl(MEILEN[D.ab].ab) + " Einwohner).", 3500); return; } dienstWahl = k; vorschauWeg(); frageZu(); tipp(D.em + " " + D.name + ": " + D.text + " Tipp neben eine Straße.", 4500); }
  unterleiste();
});
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
for (const k of Object.keys(ANSICHTEN)) { const A = ANSICHTEN[k]; if (A.wert) { A.an = () => { wertAnsicht = true; versorgungRechnen(); busRechnen(); listenAuffrischen(); wertZeichnen(); kreiseZeichnen(A.kat); if (k === "bus") { linienMesh.visible = true; linienNeu = true; } }; A.aus = () => { wertAnsicht = false; wertZeichnen(); kreiseZeichnen(null); if (k === "bus") linienMesh.visible = werkzeug === "verkehr"; }; } }
function hausFroh(h) { const a = h.abd || {}; let v = 52 + ((h.wert || 30) - 30) * 0.3 - (h.dreck || 0) * 0.5 + (a.polizei ? 5 : 0) + (a.feuer ? 5 : 0) + (a.gesund ? 5 : 0) + (h.bildung || 0) * 3 + (h.bus ? 3 : 0); if (h.problem) v -= ["krimi", "krank"].includes(h.problem) ? 10 : 25; const st = (steuern.w + steuern.g + steuern.b + steuern.i) / 4; return Math.round(klemme(v - (st - 9) * 3, 0, 100)); }
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
function werkzeugWaehlen(w) {
  werkzeug = w; document.querySelectorAll("#werkzeug button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.w === w)));
  const bauend = w !== "ansehen";
  steuerung.touches.ONE = bauend ? -1 : THREE.TOUCH.PAN; steuerung.mouseButtons.LEFT = bauend ? -1 : THREE.MOUSE.PAN;
  bauAbbrechen(); frageZu(); vorschauWeg(); linieBau = []; linienNeu = true; linienMesh.visible = w === "verkehr" || ansicht === "bus"; $("info").hidden = true; zellenNeu = true; if (w === "park") dienstKat = "park"; else if (w === "dienst" && dienstKat === "park") dienstKat = "strom"; if (DIENSTE[dienstWahl].kat !== dienstKat) dienstWahl = Object.keys(DIENSTE).find((k) => DIENSTE[k].kat === dienstKat); unterleiste(); gebieteZeichnen();
  const t = TIPPS[w]; tipp(typeof t === "function" ? t() : t, 4500);
}
$("werkzeug").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) werkzeugWaehlen(b.dataset.w); });
let frageJa = null;
function frage(text, ok, beiJa) { $("frage").hidden = false; $("frageText").textContent = text; $("frageText").classList.toggle("falsch", !ok); $("ja").disabled = !ok || !beiJa; frageJa = ok ? beiJa : null; }
function frageZu() { $("frage").hidden = true; frageJa = null; }
$("ja").onclick = () => { if (frageJa) frageJa(); };
$("nein").onclick = () => { frageZu(); bauAbbrechen(); vorschauWeg(); linieBau = []; linienNeu = true; };

/* Straßenbau per Antippen */
const bau = { punkte: [], kandidat: null, plan: null };
const vorschau = new THREE.Mesh(new THREE.BufferGeometry(), M.vorschau); vorschau.renderOrder = 3; vorschau.visible = false; szene.add(vorschau);
const markerGeo = new THREE.RingGeometry(0.55, 0.85, 28).rotateX(-Math.PI / 2);
const marker = [0, 1, 2].map(() => { const m = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false })); m.visible = false; m.renderOrder = 4; szene.add(m); return m; });
const hilfslinie = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.4, gapSize: 0.3, transparent: true, opacity: 0.7 })); hilfslinie.visible = false; szene.add(hilfslinie);
function bauAbbrechen() { bau.punkte = []; bau.kandidat = null; bau.plan = null; vorschau.visible = false; marker.forEach((m) => { m.visible = false; }); hilfslinie.visible = false; if (werkzeug === "strasse") frageZu(); }
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
  const n = bau.punkte.length, f = fangen(p);
  if (strModus === "kurve" && n === 1) return winkelFang(bau.punkte[0], p);
  if (f.art !== "frei" || n === 0) return f;
  if (strModus === "gerade") return winkelFang(bau.punkte[0], p);
  return f;
}
function planNeu() {
  if (werkzeug !== "strasse" || strModus === "ampel") return;
  const P = bau.punkte.slice(); if (bau.kandidat) P.push(bau.kandidat);
  const noetig = strModus === "gerade" ? 2 : 3;
  marker.forEach((m, i) => { const q = P[i]; m.visible = !!q && i < noetig; if (q) { m.position.set(q.x, G + 0.06, q.z); m.material.color.setHex(strModus === "kurve" && i === 1 ? 0xffd34d : (q.art && q.art !== "frei" ? 0x7dffb0 : 0xffffff)); } });
  hilfslinie.visible = strModus === "kurve" && P.length >= 2;
  if (hilfslinie.visible) { hilfslinie.geometry.dispose(); hilfslinie.geometry = new THREE.BufferGeometry().setFromPoints(P.map((q) => new THREE.Vector3(q.x, G + 0.07, q.z))); hilfslinie.computeLineDistances(); }
  if (P.length < 2) { vorschau.visible = false; bau.plan = null; if (!P.length) frageZu(); else frage("Jetzt " + (strModus === "kurve" ? "den Kurvenpunkt" : "das Ende") + " antippen", false, null); return; }
  const A = P[0]; let C, Bp;
  if (strModus === "gerade" || P.length === 2) { Bp = P[1]; C = lerp(A, Bp, 0.5); } else { C = { x: P[1].x, z: P[1].z }; Bp = P[2]; }
  const plan = planen(A, C, Bp, strTyp); bau.plan = P.length >= noetig ? plan : null;
  const pos = [], col = [], f = plan.ok ? farbe(0x7fb8ff) : farbe(0xff5a5a);
  band(pos, col, plan.pts, TYP[strTyp].halb, G + 0.04, f);
  for (const k of plan.kreuz) scheibe(pos, col, k.x, k.z, TYP[strTyp].halb * 0.7, G + 0.045, farbe(0xffffff));
  vorschau.geometry.dispose(); vorschau.geometry = geoAus(pos, col); vorschau.visible = true;
  if (!bau.plan) { frage("Jetzt das Ende antippen", false, null); return; }
  frage(TYP[strTyp].em + " " + meter(plan.laenge) + " · " + euro(plan.kosten) + (plan.baeume ? " (" + plan.baeume + " 🌳)" : "") + (plan.ok ? "" : " – " + plan.grund), plan.ok, strasseBestaetigen);
}
function strasseBestaetigen() {
  const plan = bau.plan; if (!plan || !plan.ok) return;
  merkeRueck(); const neu = bauen(plan);
  if (!neu.length) { rueck.pop(); rueckKnopf(); tipp("Hier ist schon eine Straße.", 2000); bauAbbrechen(); return; }
  const endK = naechsterKnoten(plan.B, 0.7);
  bau.punkte = endK ? [{ art: "knoten", id: endK.id, x: endK.x, z: endK.z }] : []; bau.kandidat = null; bau.plan = null;
  planNeu(); tipp("✅ Gebaut! Tipp weiter, um anzuschließen – oder ✕ zum Beenden.", 2600);
}
function ampelUmschalten(p) {
  const n = naechsterKnoten(p, Math.max(1.5, fangRadius()));
  if (!n) { tipp("Tipp genau auf eine Kreuzung.", 2000); return; }
  let deg = 0; for (const id of n.kanten) if (TYP[kanten.get(id).typ].autos) deg++;
  if (deg < 3) { tipp("Ampeln gibt es nur an Kreuzungen mit mindestens drei Straßen.", 2400); return; }
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
  if (werkzeug === "strasse" && strModus !== "ampel") {
    const noetig = strModus === "gerade" ? 2 : 3;
    if (bau.punkte.length >= noetig) bau.punkte.pop();
    bau.kandidat = kandidatAus(p); planNeu();
  } else if (werkzeug === "zone") { merkeRueck(); if (pinsel === "fuellen") fuellen(p); else malen(p, p); }
  else if (werkzeug === "abriss") { merkeRueck(); abreissenStrich(p, p); }
});
renderer.domElement.addEventListener("pointermove", (e) => {
  if (!spielLaeuft || spieler.an) return;
  if (!aktion) {
    if (werkzeug === "strasse" && strModus !== "ampel" && e.pointerType === "mouse" && finger.size === 0 && bau.punkte.length && !bau.plan) { const p = bodenPunkt(e); if (p) { bau.kandidat = kandidatAus(p); planNeu(); } }
    return;
  }
  if (aktion.id !== e.pointerId) return;
  if (Math.hypot(e.clientX - aktion.sx, e.clientY - aktion.sy) > 8) aktion.bewegt = true;
  const p = bodenPunkt(e); if (!p) return;
  if (werkzeug === "strasse" && strModus !== "ampel") { bau.kandidat = kandidatAus(p); planNeu(); }
  else if (werkzeug === "zone" && pinsel !== "fuellen") malen(aktion.letzte, p);
  else if (werkzeug === "abriss") abreissenStrich(aktion.letzte, p);
  aktion.letzte = p;
});
function loslassen(e) {
  finger.delete(e.pointerId);
  if (!aktion || aktion.id !== e.pointerId) return;
  const a = aktion; aktion = null;
  if (werkzeug === "strasse") { if (strModus === "ampel") { if (!a.bewegt) ampelUmschalten(a.letzte); } else { if (bau.kandidat) { bau.punkte.push(bau.kandidat); bau.kandidat = null; } planNeu(); } }
  else if (werkzeug === "abriss" && !a.bewegt) abreissenStrasse(a.letzte);
  else if (werkzeug === "ansehen" && !a.bewegt) { const f = fahrzeugBei(a.letzte), d = inDienst(a.letzte.x, a.letzte.z, 0.1); if (f) fahrzeugInfo(f); else if (d) dienstInfo(d); else hausInfo(a.letzte); }
  else if ((werkzeug === "dienst" || werkzeug === "park") && !a.bewegt) dienstVorschau(a.letzte);
  else if (werkzeug === "verkehr" && !a.bewegt) busTippen(a.letzte);
  else if (werkzeug === "gebiet" && !a.bewegt) gebietAntippen(e);
}
renderer.domElement.addEventListener("pointerup", loslassen);
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
  const wert = g === "w" ? "👥 " + leute(h) + " Bewohner" : "💼 " + jobs(h) + " Arbeitsplätze";
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
  if (gekauft >= MEILEN[meilenstein].gebiete) { const n = MEILEN.find((x) => x.gebiete > gekauft); frage("🔒 Mehr Gebiete gibt es ab " + (n ? n.name + " (" + zahl(n.ab) + " Einwohner)" : "–"), false, null); return; }
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
$("zeitleiste").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; tempo = +b.dataset.t; zeitKnoepfe(); if (!tempo) tipp("⏸️ Pause – du kannst trotzdem bauen.", 2000); });
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
  stufe = neu; merke("inselstadt-qualitaet", stufe); const q = STUFEN[stufe]; U.uDetail.value = q.details; aoMesh.visible = !!q.details; haeuserNeu = true;
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
  ["unten", "oben", "menueKnopf", "ansichtKnopf", "ansichten", "legende"].forEach((id) => { $(id).hidden = true; }); $("fahrpult").hidden = false; $("tacho").hidden = false; $("info").hidden = true; $("budget").hidden = true;
  kamera.position.set(p.x - p.tx * 3, 1.8, p.z - p.tz * 3);
  tipp("🚗 Gas ▲, Bremse/Rückwärts ▼, Lenken ◀ ▶. Zu schnell in die Kurve? Dann driftest du!", 4000);
}
function fahrenBeenden() {
  spieler.an = false; spieler.gruppe.visible = false;
  ["unten", "oben", "menueKnopf", "ansichtKnopf"].forEach((id) => { $(id).hidden = false; }); if (ansicht) $("legende").hidden = false; $("fahrpult").hidden = true; $("tacho").hidden = true;
  steuerung.target.set(spieler.x, 0, spieler.z); kamera.position.set(spieler.x + 10, 14, spieler.z + 14); steuerung.enabled = true; steuerung.update();
}
$("aussteigen").onclick = fahrenBeenden;
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
  infoZeigen(`<b>${f.typ === "lkw" ? "🚛" : f.typ === "bus" ? "🚌" : f.typ === "liefer" ? "🚐" : "🚗"} ${f.name}</b>fährt von <b style="display:inline;font-size:inherit">${f.vonText}</b> nach <b style="display:inline;font-size:inherit">${f.nachText}</b>${ladung}<br><small>Tempo: ${Math.round(f.v * 8 * 3.6)} km/h</small><div style="margin-top:8px"><button class="chip" type="button" data-folgen="${f.id}">📷 Folgen</button></div>`, 7000);
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
    weltBauen(daten ? (daten.karte || "insel") : neueKarte);
    if (daten) zustandRein(daten);
    else { geld = KARTEN[karte].geld; netzGeaendert(); gebieteZeichnen(); bedarfBerechnen(); zeigeWerte(); datumZeigen(); }
    if (!aussenKnoten) aussenBauen();
    spielLaeuft = true; speichernBald(); unterleiste(); zeitKnoepfe(); menueKnoepfe();
    if (!daten) { $("info").hidden = true; infoZeigen(`<b>${KARTEN[karte].em} Willkommen in deiner neuen Stadt!</b>1. 🛣️ Straßen: Anfang antippen, Ende antippen, ✓<br>2. 🏘️ Zonen: Felder neben der Straße anmalen<br>3. Zuschauen: Häuser wachsen, Autos fahren, Steuern bringen Geld<br><small>Tipp oben auf dein Geld für Budget &amp; Steuern.</small>`, 12000); werkzeugWaehlen("strasse"); }
    else tipp("Willkommen zurück!", 2500);
    renderer.setAnimationLoop(schleife);
    setTimeout(() => $("laden").classList.add("weg"), 200);
  }, 60);
}
window.inselstadt = { halte, linien, neueHalte, busTippen, linieFertig, busRechnen, busModus: (m) => { busModus = m; }, linieBau: (ids) => { linieBau = ids; }, abstand: (x, z) => abstand(x, z), dienstPlan, dienstBauen, dienste, versorgung: () => versorgung, versorgungRechnen, dienstTakt, ansichtSetzen, sim: (sek, ziel) => { const ev = new Map(); let tk = 0; for (let t = 0; t < sek; t += 0.05) { simZeit += 0.05; jetztS += 0.05; if (++tk % 10 === 0) dienstTakt(0.5); verkehrTakt(0.05, ziel || 60); fahrzeugeZeichnen(); const F = fahrzeuge.filter((f) => f.pos && f.skala > 0.9 && !f.parkt); for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) { const A = F[i], Bf = F[j]; let hit = false; for (let q = 0; q <= 6 && !hit; q++) { const o = Bf.vorneL - (Bf.vorneL + Bf.hintenL) * q / 6, dx = Bf.pos.x + Bf.pos.tx * o - A.pos.x, dz = Bf.pos.z + Bf.pos.tz * o - A.pos.z, lx = dx * A.pos.tx + dz * A.pos.tz, lz = Math.abs(-dx * A.pos.tz + dz * A.pos.tx); if (lx < A.vorneL * 0.8 && lx > -A.hintenL * 0.8 && lz < (A.B + Bf.B) / 2 * 0.7) hit = true; } if (hit) { const key = A.id + "-" + Bf.id; if (!ev.has(key)) { const d = (f) => f.modus === "kante" ? f.route[f.ri].k + "/" + f.route[f.ri].dir + "/sp" + f.spur + "/off" + f.off.toFixed(2) + "/s" + f.s.toFixed(2) + (f.ausparken ? "/AUS" : "") + (f.frei ? "/FREI" : "") : "KN" + f.tr.knoten + "/t" + f.tr.t.toFixed(2) + "/von" + f.von + "->" + f.route[f.ri + 1].k; ev.set(key, [A.typ, d(A), "blk" + (A.block == null ? "-" : A.block.toFixed(2)) + "w" + A.warte.toFixed(1), Bf.typ, d(Bf), "blk" + (Bf.block == null ? "-" : Bf.block.toFixed(2)) + "w" + Bf.warte.toFixed(1), "t" + t.toFixed(1)]); } } } } return [fahrzeuge.length, ev.size, [...ev.values()].slice(0, 12)]; }, fahrtStarten: () => { try { return fahrtStarten(); } catch (e) { return "FEHLER " + e.message + e.stack; } }, folgen: (f) => folgenStart(f), baeume: () => baeume.length, stufenTest: (st) => { let i = 0; for (const h of haeuser.values()) { h.stufe = Math.min(ZONEN[h.zone].max, st || 1 + (i++ % 5)); h.teile = hausTeile(h); } haeuserNeu = true; }, meilenstein: (m) => { meilenstein = m; unterleiste(); }, zoneWahl: (z) => { zoneWahl = z; }, malen: (a, b) => malen(a, b), werteAuffrischen, hausTeile, bedarf: () => bedarf, wertAnsicht: (v) => { wertAnsicht = v; wertZeichnen(); }, kanten, knoten, zellen, haeuser, planen, bauen, fangen, wachsTakt, werkzeugWaehlen, fahrzeuge: () => fahrzeuge, kennzahlen, starten, setzeGeld: (g) => { geld = g; zeigeWerte(); }, fahrenStarten, fahrenBeenden, spieler, tempo: (t) => { tempo = t; zeitKnoepfe(); } };

/* ================================================================
   Hauptschleife
   ================================================================ */
let jetztS = performance.now() / 1000, letzte = jetztS, takt = 0, stauTakt = 0, fpsZeit = 0, fpsBilder = 0;
function schleife() {
  const t = performance.now() / 1000, dt = Math.min(0.05, t - letzte); letzte = t; jetztS = t;
  const sdt = dt * tempo; simZeit += sdt;
  U.uTime.value = t % 1000;
  if (zeitModus === "auto") zeit = (zeit + sdt / 150) % 1;
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
  rauchZeichnen(); fahrzeugeZeichnen(); ampelnZeichnen(); fussgaengerTakt(dt, kz.e); hochZeichnen(); warnZeichnen(); drehZeichnen(); if (linienNeu && linienMesh.visible) linienZeichnen(); if (ansicht && ansicht !== "verkehr" && jetztS - wertZeit > 2) wertZeichnen();
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
