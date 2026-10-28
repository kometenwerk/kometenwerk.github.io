/* Inselstadt (FLARESSA Gaming) – Teil A
   Straßen per Antippen (gerade oder Kurve) mit ✓, vier Straßentypen, große Insel mit 5×5 Gebieten,
   die man mit Geld freischaltet. Zonen anmalen, Häuser wachsen. Vorbild: Cities: Skylines. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { mergeGeometries } from "three/addons/BufferGeometryUtils.js";

const $ = (id) => document.getElementById(id);
const lade = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const merke = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* egal */ } };
function zufall(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const farbe = (h) => new THREE.Color(h);
const glatt = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wahl = (r, a) => a[Math.floor(r() * a.length)];
const euro = (n) => Math.round(n).toLocaleString("de-DE") + " €";
const meter = (u) => Math.round(u * 8) + " m";

/* ---------- Grundwerte ---------- */
const G = 0.12, BODEN = G + 0.02, WASSER = -0.3, ZELLE = 1.0, REIHEN = 3;
const KACHEL = 40, KN = 5, HALB = KACHEL * KN / 2;   // 5 × 5 Gebiete à 40 Einheiten
const INSEL_SEED = 20261028, SPEICHER = "inselstadt-v2";
const ZONEN = { 1: { name: "Wohnen", em: "🏠", farbe: 0x4fd27a }, 2: { name: "Läden", em: "🛍️", farbe: 0x4aa8ff }, 3: { name: "Industrie", em: "🏭", farbe: 0xffc23d } };
const TYP = {
  fuss: { name: "Fußweg", em: "🚶", halb: 0.42, fahr: 0, preis: 15, zellen: false, autos: false },
  klein: { name: "Straße", em: "🛣️", halb: 0.8, fahr: 0.55, preis: 60, zellen: true, autos: true, spuren: 1 },
  allee: { name: "Allee", em: "🌳", halb: 1.05, fahr: 0.55, preis: 100, zellen: true, autos: true, spuren: 1 },
  haupt: { name: "Hauptstraße", em: "🚗", halb: 1.35, fahr: 1.05, preis: 160, zellen: true, autos: true, spuren: 2 }
};
const START_GELD = 70000, GEBIET_PREIS = (n) => 15000 + 10000 * n;
const STUFEN = { niedrig: { name: "Niedrig", pr: 1, schatten: 0, autos: 40 }, mittel: { name: "Mittel", pr: 1.5, schatten: 1024, autos: 80 }, hoch: { name: "Hoch", pr: 2, schatten: 2048, autos: 140 } };
let stufe = lade("inselstadt-qualitaet", null) || (Math.min(screen.width, screen.height) < 500 ? "mittel" : "hoch");
if (!STUFEN[stufe]) stufe = "mittel";

/* ---------- Renderer, Szene, Kamera ---------- */
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" }); }
catch (e) { $("fehler").style.display = "grid"; $("laden").classList.add("weg"); throw e; }
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const szene = new THREE.Scene();
szene.fog = new THREE.Fog(0xbfe6ff, 90, 420);
const kamera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.3, 3000);
kamera.position.set(0.7, 1.05, 1).normalize().multiplyScalar(50 * Math.max(1, 0.8 / (innerWidth / innerHeight)));
const steuerung = new OrbitControls(kamera, renderer.domElement);
steuerung.enableDamping = true; steuerung.dampingFactor = 0.1; steuerung.screenSpacePanning = false;
steuerung.minDistance = 7; steuerung.maxDistance = 240; steuerung.minPolarAngle = 0.2; steuerung.maxPolarAngle = 1.25;
steuerung.zoomToCursor = true;
const kameraAbstand = () => kamera.position.distanceTo(steuerung.target);

const himmelLicht = new THREE.HemisphereLight(0xcfe9ff, 0x6b8f5a, 1.0);
const sonne = new THREE.DirectionalLight(0xfff4e0, 2.6);
sonne.shadow.camera.left = -42; sonne.shadow.camera.right = 42; sonne.shadow.camera.top = 42; sonne.shadow.camera.bottom = -42;
sonne.shadow.camera.near = 10; sonne.shadow.camera.far = 240; sonne.shadow.bias = -0.0006; sonne.shadow.normalBias = 0.03;
szene.add(himmelLicht, sonne, sonne.target);
const U = { uTime: { value: 0 }, uNacht: { value: 0 } };

/* ---------- Himmel ---------- */
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
    s.uniforms.uNacht = U.uNacht;
    s.vertexShader = "varying vec3 vWP; varying vec3 vWN;\n" + s.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vWP = (instanceMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(instanceMatrix) * objectNormal);
      #else
        vWP = transformed; vWN = objectNormal;
      #endif`);
    s.fragmentShader = "uniform float uNacht; varying vec3 vWP; varying vec3 vWN;\n" + s.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      {
        float seite = 1.0 - step(0.5, abs(vWN.y));
        vec2 nx = normalize(vWN.xz + vec2(1e-5));
        float hk = dot(vWP.xz, vec2(-nx.y, nx.x));
        vec2 zelle = vec2(hk / 0.3, (vWP.y - ${BODEN.toFixed(3)} - 0.08) / 0.32);
        vec2 f = fract(zelle);
        float fenster = step(0.2, f.x) * step(f.x, 0.8) * step(0.22, f.y) * step(f.y, 0.78) * step(0.0, zelle.y) * seite;
        float h = fract(sin(dot(floor(zelle) + floor(vWP.xz * 0.37) * 3.1, vec2(12.9898, 78.233))) * 43758.5453);
        float an = step(0.6, h) * uNacht;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.22, 0.3), fenster * 0.7 * (1.0 - an));
        totalEmissiveRadiance += fenster * an * mix(vec3(1.0, 0.66, 0.32), vec3(0.75, 0.85, 1.0), step(0.93, h)) * (0.75 + 0.35 * fract(h * 7.0));
      }`);
  };
  mat.customProgramCacheKey = () => "fenster2";
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
  sand: new THREE.MeshStandardMaterial({ color: 0xe8d39a, roughness: 1, flatShading: true }),
  wiese: new THREE.MeshStandardMaterial({ color: 0x86c45c, roughness: 1 }),
  strasse: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
  flach: new THREE.MeshStandardMaterial({ roughness: 0.92 }),
  haus: mitFenstern(new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.02 })),
  dach: new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }),
  baum: mitWind(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 })),
  auto: new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.25 }),
  licht: new THREE.MeshBasicMaterial({ toneMapped: false }),
  zelle: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false }),
  vorschau: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false, toneMapped: false }),
  rauch: new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false }),
  sperre: new THREE.MeshBasicMaterial({ color: 0x0a0d1a, transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false })
};

/* ---------- Geometrien ---------- */
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

/* ---------- Die große Insel ---------- */
const ri = zufall(INSEL_SEED);
const insel = { a0: 86, h: [[2, 6 + ri() * 3, ri() * 6.283], [3, 4 + ri() * 3, ri() * 6.283], [5, 2.5 + ri() * 2, ri() * 6.283], [7, 1.5 + ri() * 1.5, ri() * 6.283], [11, 0.8 + ri(), ri() * 6.283]] };
const radius = (th) => { let r = insel.a0; for (const [k, a, p] of insel.h) r += a * Math.sin(k * th + p); return r; };
const aufLand = (x, z, rand) => Math.hypot(x, z) < radius(Math.atan2(z, x)) - rand;
function form(versatz) {
  const s = new THREE.Shape(), n = 420;
  for (let i = 0; i < n; i++) { const th = i / n * Math.PI * 2, r = radius(th) + versatz; const x = Math.cos(th) * r, y = -Math.sin(th) * r; if (i) s.lineTo(x, y); else s.moveTo(x, y); }
  s.closePath(); return s;
}
function platte(versatz, tiefe, schraege, oben, mat) {
  const g = new THREE.ExtrudeGeometry(form(versatz), { depth: tiefe, bevelEnabled: true, bevelThickness: schraege[0], bevelSize: schraege[1], bevelSegments: schraege[2], curveSegments: 1 });
  g.translate(0, 0, -(tiefe + schraege[0])); g.rotateX(-Math.PI / 2); g.translate(0, oben, 0);
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
}
szene.add(platte(0, 2, [0.7, 2.4, 3], 0, M.sand), platte(-3.0, 0.05, [0.07, 0.5, 2], G, M.wiese));

/* Wasser */
const wasserMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: U.uTime, uNacht: U.uNacht, uTief: { value: farbe(0x1667a3) }, uFlach: { value: farbe(0x3cc9c4) }, uHimmel: { value: farbe(0xbfe6ff) },
    uSonne: { value: new THREE.Vector3(0, 1, 0) }, uSonnenFarbe: { value: farbe(0xffffff) }, uNebel: { value: farbe(0xbfe6ff) }, uNah: { value: 90 }, uFern: { value: 420 },
    uA0: { value: insel.a0 }, uK: { value: insel.h.map((h) => h[0]) }, uA: { value: insel.h.map((h) => h[1]) }, uP: { value: insel.h.map((h) => h[2]) }
  },
  vertexShader: `uniform float uTime; varying vec3 vW;
    void main(){ vec4 w = modelMatrix * vec4(position, 1.0);
      w.y += sin(w.x * 0.33 + uTime * 1.1) * 0.06 + sin(w.z * 0.27 - uTime * 0.9) * 0.05 + sin((w.x + w.z) * 0.6 + uTime * 1.7) * 0.025;
      vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform float uTime, uNacht, uNah, uFern, uA0; uniform float uK[5]; uniform float uA[5]; uniform float uP[5]; uniform vec3 uTief, uFlach, uHimmel, uSonne, uSonnenFarbe, uNebel; varying vec3 vW;
    void main(){
      vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); if (n.y < 0.0) n = -n;
      n = normalize(n + vec3(sin(vW.x * 2.1 + uTime * 2.0) * 0.035 + sin(vW.z * 4.7 + uTime * 3.0) * 0.02, 0.0, cos(vW.z * 2.3 - uTime * 1.7) * 0.035 + cos(vW.x * 5.1 - uTime * 2.6) * 0.02));
      vec3 V = normalize(cameraPosition - vW);
      float th = atan(vW.z, vW.x), R = uA0;
      for (int i = 0; i < 5; i++) R += uA[i] * sin(uK[i] * th + uP[i]);
      float d = length(vW.xz) - R;
      vec3 c = mix(uTief, uFlach, 1.0 - smoothstep(0.8, 14.0, d));
      c = mix(c, uHimmel, pow(1.0 - max(dot(n, V), 0.0), 4.0) * 0.65);
      vec3 H = normalize(normalize(uSonne) + V);
      c += uSonnenFarbe * pow(max(dot(n, H), 0.0), 240.0) * 1.6;
      float schaum = smoothstep(0.55, 0.0, abs(d - 1.5 - 0.25 * sin(uTime * 1.4 + th * 60.0)));
      c = mix(c, vec3(0.92), schaum * 0.7 * (1.0 - uNacht * 0.65));
      c = mix(c, uNebel, smoothstep(uNah, uFern, length(cameraPosition - vW)));
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
});
const wasser = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400, 300, 300).rotateX(-Math.PI / 2), wasserMat);
wasser.position.y = WASSER; szene.add(wasser);

/* Leuchtturm und Boote */
let leuchtturm;
{
  let bestTh = 0, best = 0; for (let t = 0; t < 180; t++) { const th = t / 180 * Math.PI * 2, R = radius(th); if (R > best) { best = R; bestTh = th; } }
  leuchtturm = new THREE.Group(); const lr = best - 0.8; leuchtturm.position.set(Math.cos(bestTh) * lr, 0, Math.sin(bestTh) * lr); leuchtturm.scale.setScalar(1.6);
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
  leuchtturm.add(t1, b1, b2, kopf, hut, strahl); leuchtturm.userData = { strahl, sm, kopf };
  szene.add(leuchtturm);
}
const boote = [];
for (let b = 0; b < 7; b++) {
  const g = new THREE.Group(), fr = wahl(ri, [0xffffff, 0xf2c14e, 0xe8493f, 0x3f7fe8]);
  const rumpf = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 0.5), new THREE.MeshStandardMaterial({ color: fr, roughness: 0.5 })); rumpf.position.y = 0.1;
  const kab = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.38), new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.5 })); kab.position.set(-0.1, 0.38, 0);
  rumpf.castShadow = kab.castShadow = true; g.add(rumpf, kab); g.scale.setScalar(1.4); szene.add(g);
  boote.push({ g, rad: insel.a0 + 16 + ri() * 20, w: ri() * 6.28, v: (0.012 + ri() * 0.015) * (ri() < 0.5 ? 1 : -1), ph: ri() * 6 });
}

/* ---------- Instanz-Becken ---------- */
function becken(geo, mat, max, schatten) {
  const m = new THREE.InstancedMesh(geo, mat, max); m.count = 0; m.frustumCulled = false; m.castShadow = !!schatten; m.receiveShadow = true;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, new THREE.Color(1, 1, 1)); szene.add(m); return m;
}
const B = {
  haus: becken(G_BOX_UNTEN, M.haus, 9000, true), flach: becken(G_BOX_UNTEN, M.flach, 14000, true), dach: becken(G_DACH, M.dach, 6000, true),
  zyl: becken(G_ZYL, M.flach, 3000, true), garten: becken(G_LAUBBAUM, M.baum, 4000, true), rauch: becken(new THREE.IcosahedronGeometry(0.5, 0), M.rauch, 800, false)
};
const alleeBaeume = becken(G_LAUBBAUM, M.baum, 6000, true);
const _o = new THREE.Object3D(), _farbe = new THREE.Color();

/* ---------- Bäume ---------- */
const baeume = [], baumRaster = new Map(), baumMesh = {};
{
  const r = zufall(INSEL_SEED + 1), listen = { laub: [], nadel: [] };
  for (let gx = -HALB; gx < HALB; gx += 1.5) for (let gz = -HALB; gz < HALB; gz += 1.5) {
    const x = gx + r() * 1.4, z = gz + r() * 1.4; if (!aufLand(x, z, 3.6)) continue;
    const d = 0.5 + 0.5 * Math.sin(x * 0.07 + 1.3) * Math.cos(z * 0.06 - 0.4) + 0.3 * Math.sin((x - z) * 0.13) + 0.15 * Math.sin(x * 0.4 + z * 0.31);
    if (r() > d * 0.85 - 0.12) continue;
    if (Math.abs(x) < 9 && Math.abs(z) < 9 && r() < 0.85) continue;
    const art = r() < 0.34 ? "nadel" : "laub", b = { x, z, s: 0.7 + r() * 0.75, ry: r() * 6.28, art, weg: false, c: new THREE.Color(0.82 + r() * 0.18, 0.85 + r() * 0.15, 0.8 + r() * 0.2) };
    b.idx = baeume.length; b.i = listen[art].length; listen[art].push(b); baeume.push(b);
    const k = Math.floor(x / 4) + "," + Math.floor(z / 4); if (!baumRaster.has(k)) baumRaster.set(k, []); baumRaster.get(k).push(b);
  }
  for (const art of ["laub", "nadel"]) {
    const m = new THREE.InstancedMesh(art === "laub" ? G_LAUBBAUM : G_NADELBAUM, M.baum, Math.max(1, listen[art].length));
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; baumMesh[art] = m; szene.add(m);
    listen[art].forEach((b) => { baumSetzen(b); m.setColorAt(b.i, b.c); });
  }
}
function baumSetzen(b) {
  const s = b.weg ? 0.0001 : b.s; _o.position.set(b.x, G, b.z); _o.rotation.set(0, b.ry, 0); _o.scale.set(s, s, s); _o.updateMatrix();
  baumMesh[b.art].setMatrixAt(b.i, _o.matrix); baumMesh[b.art].instanceMatrix.needsUpdate = true;
}
function baeumeIn(x0, z0, x1, z1, f) { for (let i = Math.floor(x0 / 4); i <= Math.floor(x1 / 4); i++) for (let j = Math.floor(z0 / 4); j <= Math.floor(z1 / 4); j++) { const l = baumRaster.get(i + "," + j); if (l) l.forEach(f); } }
function baeumeFaellen(h, test) { baeumeIn(h.x0, h.z0, h.x1, h.z1, (b) => { if (!b.weg && test(b.x, b.z)) { b.weg = true; baumSetzen(b); } }); }

/* ================================================================
   Gebiete (5 × 5) – wie die Kacheln bei Cities: Skylines
   ================================================================ */
let besitz = new Set(["2,2"]), gekauft = 0, geld = START_GELD;
const kachelVon = (x, z) => [Math.floor((x + HALB) / KACHEL), Math.floor((z + HALB) / KACHEL)];
const imBesitz = (x, z) => { const [i, j] = kachelVon(x, z); return besitz.has(i + "," + j); };
const kachelMitte = (i, j) => ({ x: -HALB + (i + 0.5) * KACHEL, z: -HALB + (j + 0.5) * KACHEL });
function kachelHatLand(i, j) { const m = kachelMitte(i, j); for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (aufLand(m.x + a * 8, m.z + b * 8, 4)) return true; return false; }
function kaufbar(i, j) { if (i < 0 || j < 0 || i >= KN || j >= KN || besitz.has(i + "," + j) || !kachelHatLand(i, j)) return false; return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => besitz.has((i + a) + "," + (j + b))); }
const grenze = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 1.2, gapSize: 0.8, transparent: true, opacity: 0.75, depthWrite: false }));
grenze.renderOrder = 5; szene.add(grenze);
const sperrGeo = new THREE.PlaneGeometry(KACHEL - 0.3, KACHEL - 0.3).rotateX(-Math.PI / 2);
const sperrFlaechen = new THREE.Group(); szene.add(sperrFlaechen);
const preisSchilder = new THREE.Group(); szene.add(preisSchilder);
function schild(text, unter, gut) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 200; const x = c.getContext("2d");
  x.fillStyle = gut ? "rgba(20,24,40,.9)" : "rgba(20,24,40,.72)"; x.beginPath(); if (x.roundRect) x.roundRect(8, 8, 496, 184, 40); else x.rect(8, 8, 496, 184); x.fill();
  x.strokeStyle = gut ? "#4fd27a" : "rgba(255,255,255,.25)"; x.lineWidth = 6; x.stroke();
  x.fillStyle = "#fff"; x.font = "600 70px 'Space Grotesk', Arial"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(text, 256, 82);
  x.fillStyle = gut ? "#b9f5cd" : "#b9b4d6"; x.font = "500 40px 'Space Grotesk', Arial"; x.fillText(unter, 256, 150);
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
  for (let i = 0; i < KN; i++) for (let j = 0; j < KN; j++) {
    if (besitz.has(i + "," + j) || !kachelHatLand(i, j)) continue;
    const m = kachelMitte(i, j), p = new THREE.Mesh(sperrGeo, M.sperre); p.position.set(m.x, G + 0.09, m.z); p.renderOrder = 4; sperrFlaechen.add(p);
    if (kaufbar(i, j)) { const ok = geld >= GEBIET_PREIS(gekauft); const s = schild(euro(GEBIET_PREIS(gekauft)), ok ? "Antippen zum Kaufen" : "Noch zu teuer", ok); s.position.set(m.x, 4, m.z); s.userData = { i, j }; preisSchilder.add(s); }
  }
}

/* ================================================================
   Straßennetz
   ================================================================ */
const knoten = new Map(), kanten = new Map();
let nId = 1, kId = 1, zId = 1, gId = 1, hId = 1;
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
  let best = 1e9, bt = 0, bx = 0, bz = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1e-9;
    const f = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)), x = a.x + dx * f, z = a.z + dz * f, d = Math.hypot(p.x - x, p.z - z);
    if (d < best) { best = d; bt = a.t + (b.t - a.t) * f; bx = x; bz = z; }
  }
  return mitT ? { d: best, t: bt, x: bx, z: bz } : best;
}
function huelle(pts, r) { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const p of pts) { a = Math.min(a, p.x); b = Math.max(b, p.x); c = Math.min(c, p.z); d = Math.max(d, p.z); } r = r || 0; return { x0: a - r, x1: b + r, z0: c - r, z1: d + r }; }
const nahHuelle = (h, p, r) => p.x > h.x0 - r && p.x < h.x1 + r && p.z > h.z0 - r && p.z < h.z1 + r;
function strassenFrei(p, ausser) { let m = 1e9; for (const k of kanten.values()) { if (k === ausser || !nahHuelle(k.h, p, Math.min(m, 5) + 1.5)) continue; m = Math.min(m, abstandZuLinie(p, k.pts) - TYP[k.typ].halb); } return m; }

/* Straßen-Geometrie */
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
    if (k.typ === "allee") band(pos, col, k.pts, 0.88, G + 0.016, SF.gruen);
    band(pos, col, k.pts, T.fahr, G + 0.02, SF.fahrbahn);
    if (k.typ === "haupt") { linie(pos, col, k, 0.07, SF.gelb); linie(pos, col, k, -0.07, SF.gelb); striche(pos, col, k, 0.53, SF.strich, 0.45, 0.65); striche(pos, col, k, -0.53, SF.strich, 0.45, 0.65); }
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
function neuerKnoten(p, id) { const n = { id: id || nId++, x: p.x, z: p.z, kanten: new Set(), mesh: null }; nId = Math.max(nId, n.id + 1); knoten.set(n.id, n); return n; }
function knotenWeg(n) { if (n.mesh) { szene.remove(n.mesh); n.mesh.geometry.dispose(); } knoten.delete(n.id); }
function neueKante(aId, bId, c, typ, id) {
  const a = knoten.get(aId), b = knoten.get(bId), { pts, len } = abtasten(a, c, b);
  const k = { id: id || kId++, a: aId, b: bId, c: { x: c.x, z: c.z }, typ, pts, len, h: huelle(pts, TYP[typ].halb) }; kId = Math.max(kId, k.id + 1);
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
  neueKante(aId, n.id, c1, typ); neueKante(n.id, bId, c2, typ); return n;
}
const fangRadius = () => Math.min(3, Math.max(1.1, kameraAbstand() / 32));
function naechsterKnoten(p, r) { let best = null, bd = r; for (const n of knoten.values()) { const d = abst(n, p); if (d < bd) { bd = d; best = n; } } return best; }
function naechsteKante(p, r) { let best = null; for (const k of kanten.values()) { if (!nahHuelle(k.h, p, r)) continue; const e = abstandZuLinie(p, k.pts, true); if (e.d < r && (!best || e.d < best.d)) best = { k, ...e }; } return best; }
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

/* Plan aus den angetippten Punkten */
function planen(A, C, Bp, typ) {
  const T = TYP[typ], { pts, len } = abtasten(A, C, Bp), plan = { A, C, B: Bp, typ, pts, laenge: len, kosten: Math.round(len * T.preis), kreuz: [], ok: true, grund: "" };
  const nein = (g) => { plan.ok = false; plan.grund = plan.grund || g; };
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
      if (!aufLand(x, z, 3.6) || !imBesitz(x, z) || strassenFrei({ x, z }) < 0.45 || zellenNahe(x, z, 0.86).length) break;
      neueZelle({ x, z, rot: Math.atan2(-nx * seite, -nz * seite), g, seite, i, r });
    }
  }
  zellenNeu = true;
}
function verwaisteZellen() { for (const z of [...zellen.values()]) if (strassenFrei(z) > REIHEN * ZELLE + 0.3) zelleWeg(z); }
const zellMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2), M.zelle, 30000);
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
const haeuser = new Map(); let haeuserNeu = true;
const PAL = {
  haus: [0xf3e9d8, 0xf6d7b0, 0xe9b8a0, 0xd9e4ec, 0xf2f0e9, 0xf5e1a4, 0xcfe3c8, 0xe7cfe6], dach: [0xb2513a, 0x8f3f30, 0x5d6470, 0x7a4b3a, 0x3f5566, 0xa8673f],
  block: [0xe8dcc8, 0xd8c3a5, 0xc9a083, 0xf0ebe1, 0xb9c7cf, 0xe3c9a8, 0xd0d6c4], laden: [0xf2efe8, 0xe6dccb, 0xdfe7ee, 0xf3e3d0, 0xe0e0d8],
  markise: [0xe8493f, 0x2f8f6f, 0x3f7fe8, 0xf2a93b, 0x8e5be8, 0xe85b9a], turm: [0x9fb7c9, 0x7fa3b8, 0xc9d6df, 0x6d8aa1, 0xb8c4cc, 0x8fb0a8],
  halle: [0xd9d4c7, 0xc4c9cc, 0xbfb3a0, 0xd0c8b8, 0xaab3b8], auto: [0xe8493f, 0x3f7fe8, 0xf2f2f2, 0x2c2f36, 0xf2c14e, 0x4fbf7a, 0x9a5be8, 0xff8a3c]
};
function hausTeile(h) {
  const r = zufall(h.variante * 31 + h.stufe * 7919), W = h.w * ZELLE, D = h.d * ZELLE, T = [], vorn = D / 2 - 0.12;
  const box = (b, lx, lz, w, hh, d, c, extra) => T.push(Object.assign({ b, lx, ly: 0, lz, sx: w, sy: hh, sz: d, c }, extra || {}));
  box("flach", 0, 0, W * 0.97, 0.008, D * 0.97, h.zone === 1 ? 0x8fcf68 : h.zone === 2 ? 0xd6cfc2 : 0xb5b3ad, { fest: true });
  if (h.zone === 1) {
    if (h.stufe === 1) {
      const n = W >= 2 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const w = 0.66 + r() * 0.16, d = 0.62 + r() * 0.14, hh = 0.48 + r() * 0.16, lx = n === 2 ? (k ? 0.5 : -0.5) : 0, lz = vorn - d / 2 - 0.08;
        box("haus", lx, lz, w, hh, d, wahl(r, PAL.haus)); box("dach", lx, lz, w + 0.1, 0.28 + r() * 0.14, d + 0.1, wahl(r, PAL.dach), { ly: hh });
        if (D >= 2 && r() < 0.8) box("garten", lx + (r() - 0.5) * 0.4, lz - d / 2 - 0.55, 0.5 + r() * 0.35, 0.5 + r() * 0.35, 0.5 + r() * 0.35, null, { rund: true });
      }
    } else if (h.stufe === 2) {
      const w = Math.min(W * 0.82, 1.7), d = Math.min(D * 0.62, 1.15), hh = 0.78 + r() * 0.25, lz = vorn - d / 2 - 0.06;
      box("haus", 0, lz, w, hh, d, wahl(r, PAL.haus));
      if (r() < 0.6) box("dach", 0, lz, w + 0.1, 0.32 + r() * 0.12, d + 0.1, wahl(r, PAL.dach), { ly: hh }); else box("flach", 0, lz, w * 0.4, 0.12, d * 0.4, 0x9aa0a8, { ly: hh });
      if (D >= 2) box("garten", (r() - 0.5) * W * 0.5, lz - d / 2 - 0.45, 0.6, 0.6, 0.6, null, { rund: true });
    } else {
      const w = W * 0.86, d = D * 0.78, hh = 1.3 + r() * 1.1 + (W >= 2 && D >= 3 ? r() * 0.9 : 0), lz = vorn - d / 2 - 0.04;
      box("haus", 0, lz, w, hh, d, wahl(r, PAL.block)); box("flach", (r() - 0.5) * w * 0.4, lz + (r() - 0.5) * d * 0.4, 0.3, 0.16, 0.3, 0x9aa0a8, { ly: hh });
    }
  } else if (h.zone === 2) {
    if (h.stufe === 3 && (W >= 2 || D >= 2)) {
      const w = W * 0.82, d = D * 0.78, hh = 2.2 + r() * 1.8 + (W >= 2 && D >= 2 ? r() * 1.4 : 0), lz = vorn - d / 2 - 0.04, c = wahl(r, PAL.turm);
      box("haus", 0, lz, w, hh, d, c); box("haus", 0, lz, w * 0.7, 0.4 + r() * 0.6, d * 0.7, c, { ly: hh });
    } else {
      const w = W * (0.82 + r() * 0.1), d = Math.min(D, h.stufe === 1 ? 1 : 3) * 0.78, hh = h.stufe === 1 ? 0.55 + r() * 0.15 : 0.95 + r() * 0.6, lz = vorn - d / 2 - 0.04;
      box("haus", 0, lz, w, hh, d, wahl(r, PAL.laden)); box("flach", 0, vorn - 0.02, w * 0.92, 0.05, 0.2, wahl(r, PAL.markise), { ly: 0.34 });
      if (r() < 0.5) box("flach", (r() - 0.5) * w * 0.5, lz, 0.28, 0.14, 0.3, 0xa7abb1, { ly: hh });
    }
  } else {
    const w = W * 0.86, d = D * (h.stufe === 1 ? 0.6 : 0.8), hh = h.stufe === 1 ? 0.42 : 0.6 + r() * 0.25, lz = vorn - d / 2 - 0.1;
    box("haus", 0, lz, w, hh, d, wahl(r, PAL.halle)); box("dach", 0, lz, w + 0.04, 0.16, d + 0.04, 0x8b9096, { ly: hh });
    if (h.stufe >= 2) box("zyl", -w / 2 + 0.2, lz - d / 2 + 0.2, 0.16, 1.2 + r() * 0.5, 0.16, 0xb5523a, { schlot: true });
    if (h.stufe >= 3) { box("zyl", w / 2 - 0.35, lz - d / 2 - 0.35, 0.5, 0.55, 0.5, 0xc8ccd0); if (W >= 2) box("zyl", -w / 2 + 0.55, lz - d / 2 + 0.2, 0.16, 1.5, 0.16, 0xb5523a, { schlot: true }); }
  }
  return T;
}
function hausWeg(h) { if (!h) return; for (const id of h.zellen) { const z = zellen.get(id); if (z) z.haus = null; } haeuser.delete(h.id); haeuserNeu = zellenNeu = true; }
function neuesHaus(d, alt) {
  const h = Object.assign({ id: d.id || hId++, geboren: alt ? -100 : jetztS, ab: 0 }, d); hId = Math.max(hId, h.id + 1);
  let x = 0, z = 0, sx = 0, sz = 0; h.zellen.forEach((id) => { const c = zellen.get(id); c.haus = h.id; x += c.x; z += c.z; sx += Math.sin(c.rot); sz += Math.cos(c.rot); });
  h.x = x / h.zellen.length; h.z = z / h.zellen.length; h.rot = Math.atan2(sx, sz);
  h.teile = hausTeile(h); haeuser.set(h.id, h); haeuserNeu = zellenNeu = true;
  const rr = Math.max(h.w, h.d) * 0.62 + 0.2; baeumeFaellen({ x0: h.x - rr, x1: h.x + rr, z0: h.z - rr, z1: h.z + rr }, (bx, bz) => Math.hypot(bx - h.x, bz - h.z) < rr);
  return h;
}
const federn = (t) => { const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
let rauchTeile = [];
function haeuserZeichnen() {
  let anim = false; const n = { haus: 0, flach: 0, dach: 0, zyl: 0, garten: 0 }; rauchTeile = [];
  for (const h of haeuser.values()) {
    const p = Math.min(1, Math.max(0, (jetztS - h.geboren) / 0.7)); if (p < 1) anim = true;
    const e = h.ab + (1 - h.ab) * (1 - Math.pow(1 - p, 3)), cs = Math.cos(h.rot), sn = Math.sin(h.rot);
    for (const t of h.teile) {
      const m = B[t.b]; if (n[t.b] >= m.instanceMatrix.count) continue;
      const wx = h.x + t.lx * cs + t.lz * sn, wz = h.z - t.lx * sn + t.lz * cs;
      if (t.rund) { const f = p >= 1 ? 1 : (p > 0 ? federn(p) : 0); _o.position.set(wx, BODEN, wz); _o.scale.set(t.sx * f + 1e-4, t.sy * f + 1e-4, t.sz * f + 1e-4); }
      else if (t.fest) { _o.position.set(wx, G + 0.012, wz); _o.scale.set(t.sx, t.sy, t.sz); }
      else { _o.position.set(wx, BODEN + t.ly * e, wz); _o.scale.set(t.sx, Math.max(t.sy * e, 1e-4), t.sz); }
      _o.rotation.set(0, h.rot, 0); _o.updateMatrix(); m.setMatrixAt(n[t.b], _o.matrix);
      if (t.c != null) m.setColorAt(n[t.b], _farbe.setHex(t.c)); else m.setColorAt(n[t.b], _farbe.setRGB(0.85 + (h.variante % 7) * 0.02, 0.9, 0.85));
      n[t.b]++;
      if (t.schlot && p >= 1) rauchTeile.push({ x: wx, y: BODEN + t.sy, z: wz, ph: (h.variante % 100) / 13 });
    }
  }
  for (const k in n) { const m = B[k]; m.count = n[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  haeuserNeu = anim;
}
function rauchZeichnen() {
  let i = 0; const m = B.rauch;
  for (const r of rauchTeile) for (let k = 0; k < 4 && i < 800; k++) {
    const f = ((jetztS * 0.35 + r.ph + k / 4) % 1), s = 0.12 + f * 0.32;
    _o.position.set(r.x + f * 0.5 + Math.sin(jetztS + k) * 0.05, r.y + 0.05 + f * 1.3, r.z + f * 0.2); _o.rotation.set(f, f * 2, 0); _o.scale.set(s, s, s); _o.updateMatrix();
    m.setMatrixAt(i, _o.matrix); m.setColorAt(i, _farbe.setScalar(1 - f * 0.25)); i++;
  }
  m.count = i; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
}
function alleeZeichnen() {
  let i = 0;
  for (const k of kanten.values()) { if (k.typ !== "allee") continue; for (let s = 1.2; s < k.len - 1.0 && i < 5990; s += 1.6) { const p = punktBei(k, s); for (const sei of [1, -1]) { _o.position.set(p.x - p.tz * 0.72 * sei, G + 0.016, p.z + p.tx * 0.72 * sei); _o.rotation.set(0, s * 3.7, 0); _o.scale.setScalar(0.62 + ((s * 7.3) % 0.2)); _o.updateMatrix(); alleeBaeume.setMatrixAt(i, _o.matrix); alleeBaeume.setColorAt(i, _farbe.setRGB(0.9, 1, 0.9)); i++; } } }
  alleeBaeume.count = i; alleeBaeume.instanceMatrix.needsUpdate = true; if (alleeBaeume.instanceColor) alleeBaeume.instanceColor.needsUpdate = true;
}

/* Wachstum */
const zk = (g, s, i, r) => zellIndex.get(g + "|" + s + "|" + i + "|" + r);
function freiGleich(id, zone) { const z = id && zellen.get(id); return z && !z.haus && z.zone === zone ? z : null; }
function wachsTakt() {
  const kand = { 1: [], 2: [], 3: [] };
  for (const z of zellen.values()) if (z.zone && !z.haus && z.r === 0) kand[z.zone].push(z);
  for (const zone of [1, 2, 3]) {
    const L = kand[zone]; if (!L.length || Math.random() > 0.6) continue;
    const a = L[Math.floor(Math.random() * L.length)], spalten = [a], nb = freiGleich(zk(a.g, a.seite, a.i + 1, 0), zone);
    if (nb && Math.random() < (zone === 1 ? 0.3 : zone === 2 ? 0.5 : 0.75)) spalten.push(nb);
    let tiefe = REIHEN; for (const s of spalten) { let t = 1; while (t < REIHEN && freiGleich(zk(s.g, s.seite, s.i, t), zone)) t++; tiefe = Math.min(tiefe, t); }
    const ids = []; for (const s of spalten) for (let t = 0; t < tiefe; t++) ids.push(zk(s.g, s.seite, s.i, t));
    neuesHaus({ zone, stufe: 1, w: spalten.length, d: tiefe, variante: (Math.random() * 1e6) | 0, zellen: ids });
  }
  const liste = [...haeuser.values()].filter((h) => h.stufe < 3 && jetztS - h.geboren > 20 && (h.stufe < 2 || h.d >= 2 || h.zone === 3));
  if (liste.length && Math.random() < 0.5) { const h = liste[Math.floor(Math.random() * liste.length)]; h.stufe++; h.geboren = jetztS; h.ab = 0.35; h.teile = hausTeile(h); haeuserNeu = true; }
  zeigeWerte(); speichernBald();
}
function kennzahlen() {
  let e = 0, j = 0; for (const h of haeuser.values()) { const f = h.zellen.length; if (h.zone === 1) e += [0, 3, 8, 22][h.stufe] * f; else j += (h.zone === 2 ? [0, 2, 5, 14] : [0, 4, 8, 15])[h.stufe] * f; }
  let unterhalt = 0; for (const k of kanten.values()) unterhalt += k.len * TYP[k.typ].preis * 0.004;
  return { e, j, einnahmen: e * 0.9 + j * 0.7, unterhalt };
}
function zeigeWerte() {
  const k = kennzahlen(), d = Math.round(k.einnahmen - k.unterhalt);
  $("wGeld").textContent = euro(geld); $("wEinw").textContent = k.e.toLocaleString("de-DE"); $("wJobs").textContent = k.j.toLocaleString("de-DE");
  const t = $("trend"); t.textContent = (d >= 0 ? "+" : "") + d.toLocaleString("de-DE") + "/Wo"; t.className = d >= 0 ? "plus" : "minus";
}
function wocheTakt() { const k = kennzahlen(); geld += k.einnahmen - k.unterhalt; zeigeWerte(); if (werkzeug === "gebiet") gebieteZeichnen(); speichernBald(); }

/* ================================================================
   Autos und Laternen
   ================================================================ */
const AUTOS_MAX = 160;
const autoKoerper = becken(G_BOX, M.auto, AUTOS_MAX, true), autoKabine = becken(G_BOX, M.auto, AUTOS_MAX, true), autoLicht = becken(G_BOX, M.licht, AUTOS_MAX * 2, false);
let autos = []; const ra = zufall(99);
const autoKanten = () => [...kanten.values()].filter((k) => TYP[k.typ].autos);
function autoNeu(ks) {
  let sum = 0; ks.forEach((k) => { sum += k.len; }); let x = ra() * sum, k = ks[0]; for (const e of ks) { x -= e.len; if (x <= 0) { k = e; break; } }
  return { k: k.id, dir: ra() < 0.5 ? 1 : -1, s: ra() * k.len, v: 1.4 + ra() * 1.2, c: wahl(ra, PAL.auto), spur: ra() < 0.5 ? 0 : 1 };
}
function autosAbgleichen() {
  const ks = autoKanten(); let gesamt = 0; ks.forEach((k) => { gesamt += k.len; });
  const ziel = ks.length ? Math.min(STUFEN[stufe].autos, AUTOS_MAX, Math.floor(gesamt / 5)) : 0;
  autos = autos.filter((a) => kanten.has(a.k) && TYP[kanten.get(a.k).typ].autos).slice(0, ziel);
  while (autos.length < ziel) autos.push(autoNeu(ks));
  autos.forEach((a, i) => { autoKoerper.setColorAt(i, _farbe.setHex(a.c)); autoKabine.setColorAt(i, _farbe.setHex(0x26303d)); autoLicht.setColorAt(i * 2, _farbe.setHex(0xfff3c8)); autoLicht.setColorAt(i * 2 + 1, _farbe.setHex(0xff3b30)); });
  [autoKoerper, autoKabine, autoLicht].forEach((m) => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  autoKoerper.count = autoKabine.count = autos.length; autoLicht.count = autos.length * 2;
}
const _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q0 = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
function autosFahren(dt) {
  autos.forEach((a, i) => {
    let k = kanten.get(a.k); if (!k) return;
    a.s += a.v * dt; let schutz = 0;
    while (a.s >= k.len && schutz++ < 5) {
      a.s -= k.len; const nid = a.dir > 0 ? k.b : k.a, n = knoten.get(nid);
      const weiter = [...n.kanten].filter((id) => id !== k.id && TYP[kanten.get(id).typ].autos);
      const nk = kanten.get(weiter.length ? weiter[Math.floor(ra() * weiter.length)] : k.id);
      a.k = nk.id; a.dir = nk.a === nid ? 1 : -1; k = nk;
    }
    const T = TYP[k.typ], spur = T.spuren === 2 ? (a.spur ? 0.78 : 0.3) : 0.26;
    const p = punktBei(k, a.dir > 0 ? a.s : k.len - a.s), dx = p.tx * a.dir, dz = p.tz * a.dir;
    _q.setFromAxisAngle(_y, Math.atan2(-dz, dx)); _m.compose(_v.set(p.x - dz * spur, G + 0.02, p.z + dx * spur), _q, _s.set(1, 1, 1));
    _l.compose(_v.set(0, 0.1, 0), _q0, _s.set(0.48, 0.13, 0.24)); autoKoerper.setMatrixAt(i, _l.premultiply(_m));
    _l.compose(_v.set(-0.04, 0.2, 0), _q0, _s.set(0.26, 0.1, 0.2)); autoKabine.setMatrixAt(i, _l.premultiply(_m));
    _l.compose(_v.set(0.242, 0.11, 0), _q0, _s.set(0.02, 0.04, 0.2)); autoLicht.setMatrixAt(i * 2, _l.premultiply(_m));
    _l.compose(_v.set(-0.242, 0.11, 0), _q0, _s.set(0.02, 0.04, 0.2)); autoLicht.setMatrixAt(i * 2 + 1, _l.premultiply(_m));
  });
  autoKoerper.instanceMatrix.needsUpdate = autoKabine.instanceMatrix.needsUpdate = autoLicht.instanceMatrix.needsUpdate = true;
}
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
function netzGeaendert() { autosAbgleichen(); laternenBauen(); alleeZeichnen(); zellenNeu = true; speichernBald(); }

/* ================================================================
   Spielstand: speichern, laden, Rückgängig
   ================================================================ */
function zustand() {
  const r = (v) => Math.round(v * 1000) / 1000;
  return {
    v: 2, geld: Math.round(geld), besitz: [...besitz], gekauft, ids: { n: nId, k: kId, z: zId, g: gId, h: hId },
    knoten: [...knoten.values()].map((n) => [n.id, r(n.x), r(n.z)]),
    kanten: [...kanten.values()].map((k) => [k.id, k.a, k.b, r(k.c.x), r(k.c.z), k.typ]),
    zellen: [...zellen.values()].map((z) => [z.id, r(z.x), r(z.z), r(z.rot), z.zone, z.g, z.seite, z.i, z.r]),
    haeuser: [...haeuser.values()].map((h) => [h.id, h.zone, h.stufe, h.w, h.d, h.variante, h.zellen]),
    baeume: baeume.filter((b) => b.weg).map((b) => b.idx)
  };
}
let speicherTimer = 0, speichernAus = false;
function speichernBald() { clearTimeout(speicherTimer); if (!speichernAus) speicherTimer = setTimeout(() => merke(SPEICHER, zustand()), 800); }
function allesLeeren() {
  for (const k of kanten.values()) { szene.remove(k.mesh); k.mesh.geometry.dispose(); }
  for (const n of knoten.values()) if (n.mesh) { szene.remove(n.mesh); n.mesh.geometry.dispose(); }
  kanten.clear(); knoten.clear(); zellen.clear(); zellIndex.clear(); raster.clear(); haeuser.clear(); autos = [];
  for (const b of baeume) if (b.weg) { b.weg = false; baumSetzen(b); }
}
function zustandRein(d) {
  geld = d.geld; besitz = new Set(d.besitz); gekauft = d.gekauft;
  d.knoten.forEach(([id, x, z]) => neuerKnoten({ x, z }, id));
  d.kanten.forEach(([id, a, b, cx, cz, typ]) => { if (knoten.has(a) && knoten.has(b)) neueKante(a, b, { x: cx, z: cz }, TYP[typ] ? typ : "klein", id); });
  for (const n of [...knoten.values()]) if (!n.kanten.size) knotenWeg(n);
  d.zellen.forEach(([id, x, z, rot, zone, g, seite, i, r]) => neueZelle({ id, x, z, rot, zone, g, seite, i, r }));
  d.haeuser.forEach(([id, zone, stufe, w, dd, variante, ids]) => { if (ids.every((z) => zellen.has(z) && !zellen.get(z).haus)) neuesHaus({ id, zone, stufe, w, d: dd, variante, zellen: ids }, true); });
  d.baeume.forEach((i) => { const b = baeume[i]; if (b) { b.weg = true; baumSetzen(b); } });
  nId = Math.max(nId, d.ids.n); kId = Math.max(kId, d.ids.k); zId = Math.max(zId, d.ids.z); gId = Math.max(gId, d.ids.g); hId = Math.max(hId, d.ids.h);
  haeuserNeu = zellenNeu = true; netzGeaendert(); gebieteZeichnen(); zeigeWerte();
}
const rueck = [];
function merkeRueck() { rueck.push(JSON.stringify(zustand())); if (rueck.length > 8) rueck.shift(); rueckKnopf(); }
function rueckgaengig() { if (!rueck.length) return; const d = JSON.parse(rueck.pop()); bauAbbrechen(); allesLeeren(); zustandRein(d); rueckKnopf(); tipp("↩️ Rückgängig gemacht", 1600); }
function rueckKnopf() { const b = $("rueck"); if (b) b.disabled = !rueck.length; }

/* ================================================================
   Tag und Nacht
   ================================================================ */
const ZEITEN = { tag: 0.42, abend: 0.735, nacht: 0.9 };
let zeitModus = lade("inselstadt-bau-zeit", "tag"), zeit = ZEITEN[zeitModus] != null ? ZEITEN[zeitModus] : ZEITEN.tag, zeitZiel = null;
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
  const ka = kameraAbstand(); szene.fog.near = 60 + ka * 0.8; szene.fog.far = 260 + ka * 2.2;
  const wu = wasserMat.uniforms; wu.uNah.value = szene.fog.near; wu.uFern.value = szene.fog.far;
  wu.uTief.value.copy(_c.tief); wu.uFlach.value.copy(_c.flach); wu.uHimmel.value.copy(_c.unten).lerp(_c.oben, 0.4); wu.uNebel.value.copy(_c.unten);
  wu.uSonne.value.copy(mond ? _r : sonnenRichtung); wu.uSonnenFarbe.value.copy(_c.sonne).multiplyScalar(mond ? 0.35 : glatt(-0.02, 0.1, hoehe));
  renderer.toneMappingExposure = 1.0 + nacht * 0.25;
  laternen.material.opacity = glatt(0.15, 0.7, nacht);
  M.licht.color.setScalar(0.25 + 0.75 * nacht);
  const d = leuchtturm.userData; d.sm.opacity = 0.16 * glatt(0.2, 0.8, nacht); d.kopf.material.color.setScalar(0.6 + 0.6 * nacht);
}

/* ================================================================
   Bedienung
   ================================================================ */
const boden = new THREE.Plane(new THREE.Vector3(0, 1, 0), -G), strahl = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _treffer = new THREE.Vector3();
function ndc(e) { const r = renderer.domElement.getBoundingClientRect(); _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); return _ndc; }
function bodenPunkt(e) { strahl.setFromCamera(ndc(e), kamera); return strahl.ray.intersectPlane(boden, _treffer) ? { x: _treffer.x, z: _treffer.z } : null; }
let tippTimer = 0;
function tipp(t, ms) { const el = $("tipp"); el.textContent = t; el.classList.remove("weg"); clearTimeout(tippTimer); tippTimer = setTimeout(() => el.classList.add("weg"), ms || 4000); }

let strTyp = lade("inselstadt-strtyp", "klein"), strModus = lade("inselstadt-strmodus", "gerade"), zoneWahl = 1, pinsel = "klein";
if (!TYP[strTyp]) strTyp = "klein";
const TIPPS = {
  ansehen: "👆 Ein Finger: verschieben · ✌️ Zwei Finger: drehen & zoomen · Haus antippen: Infos",
  strasse: () => strModus === "gerade" ? "🛣️ Tipp auf den Anfang, dann aufs Ende. Dann ✓ zum Bauen." : "〰️ Tipp auf den Anfang, dann den Kurvenpunkt, dann das Ende. Dann ✓.",
  zone: () => pinsel === "fuellen" ? "🪣 Tipp neben eine Straße – die ganze Straßenseite wird angemalt." : "🖌️ Wisch über die grauen Felder neben den Straßen, um sie anzumalen.",
  gebiet: "🗺️ Tipp auf ein Preisschild, um das Gebiet zu kaufen.",
  abriss: "🧹 Tipp auf eine Straße, um sie abzureißen. Über Häuser und Zonen wischen löscht sie."
};
function unterleiste() {
  const u = $("unter"); let h = "";
  const chip = (attr, wert, txt, an) => `<button class="chip" type="button" ${attr}="${wert}" aria-pressed="${an}">${txt}</button>`;
  if (werkzeug === "strasse") {
    h += Object.keys(TYP).map((k) => chip("data-typ", k, TYP[k].em + " " + TYP[k].name + ` <small style="opacity:.7">${TYP[k].preis} €</small>`, k === strTyp)).join("");
    h += '<span class="trenn"></span>' + chip("data-modus", "gerade", "📏 Gerade", strModus === "gerade") + chip("data-modus", "kurve", "〰️ Kurve", strModus === "kurve");
    h += '<span class="trenn"></span><button class="chip" type="button" id="rueck">↩️ Rückgängig</button>';
  } else if (werkzeug === "zone") {
    h += [1, 2, 3].map((z) => chip("data-zone", z, ZONEN[z].em + " " + ZONEN[z].name, z === zoneWahl)).join("");
    h += '<span class="trenn"></span>' + chip("data-pinsel", "klein", "🖌️ Klein", pinsel === "klein") + chip("data-pinsel", "gross", "🖌️ Groß", pinsel === "gross") + chip("data-pinsel", "fuellen", "🪣 Füllen", pinsel === "fuellen");
    h += '<span class="trenn"></span>' + chip("data-zone", 0, "🧽 Entfernen", zoneWahl === 0) + '<button class="chip" type="button" id="rueck">↩️</button>';
  } else if (werkzeug === "abriss" || werkzeug === "gebiet") h = '<button class="chip" type="button" id="rueck">↩️ Rückgängig</button>';
  u.innerHTML = h; u.hidden = !h; rueckKnopf();
}
$("unter").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.id === "rueck") { rueckgaengig(); return; }
  if (b.dataset.typ) { strTyp = b.dataset.typ; merke("inselstadt-strtyp", strTyp); planNeu(); }
  if (b.dataset.modus) { strModus = b.dataset.modus; merke("inselstadt-strmodus", strModus); bauAbbrechen(); tipp(TIPPS.strasse(), 3500); }
  if (b.dataset.zone != null) zoneWahl = +b.dataset.zone;
  if (b.dataset.pinsel) { pinsel = b.dataset.pinsel; tipp(TIPPS.zone(), 3500); }
  unterleiste();
});
function werkzeugWaehlen(w) {
  werkzeug = w; document.querySelectorAll("#werkzeug button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.w === w)));
  const bauend = w !== "ansehen";
  steuerung.touches.ONE = bauend ? -1 : THREE.TOUCH.PAN; steuerung.mouseButtons.LEFT = bauend ? -1 : THREE.MOUSE.PAN;
  bauAbbrechen(); frageZu(); $("info").hidden = true; zellenNeu = true; unterleiste(); gebieteZeichnen();
  const t = TIPPS[w]; tipp(typeof t === "function" ? t() : t, 4500);
}
$("werkzeug").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) werkzeugWaehlen(b.dataset.w); });

/* Bestätigen-Leiste */
let frageJa = null;
function frage(text, ok, beiJa) { $("frage").hidden = false; $("frageText").textContent = text; $("frageText").classList.toggle("falsch", !ok); $("ja").disabled = !ok || !beiJa; frageJa = ok ? beiJa : null; }
function frageZu() { $("frage").hidden = true; frageJa = null; }
$("ja").onclick = () => { if (frageJa) frageJa(); };
$("nein").onclick = () => { frageZu(); bauAbbrechen(); };

/* ---------- Straßenbau per Antippen ---------- */
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
  if (start.art === "kante") { const k = kanten.get(start.id); if (k) { const e = abstandZuLinie(start, k.pts, true), q = punktBei(k, e.t * k.len); refs.push(Math.atan2(q.tz, q.tx)); } }
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
  if (werkzeug !== "strasse") return;
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
  frage(TYP[strTyp].em + " " + meter(plan.laenge) + " · " + euro(plan.kosten) + (plan.ok ? "" : " – " + plan.grund), plan.ok, strasseBestaetigen);
}
function strasseBestaetigen() {
  const plan = bau.plan; if (!plan || !plan.ok) return;
  merkeRueck(); const neu = bauen(plan);
  if (!neu.length) { rueck.pop(); rueckKnopf(); tipp("Hier ist schon eine Straße.", 2000); bauAbbrechen(); return; }
  const endK = naechsterKnoten(plan.B, 0.7);
  bau.punkte = endK ? [{ art: "knoten", id: endK.id, x: endK.x, z: endK.z }] : []; bau.kandidat = null; bau.plan = null;
  planNeu();
  tipp("✅ Gebaut! Tipp weiter, um anzuschließen – oder ✕ zum Beenden.", 2600);
}

/* ---------- Zeiger ---------- */
const finger = new Map(); let aktion = null;
renderer.domElement.addEventListener("pointerdown", (e) => {
  finger.set(e.pointerId, true);
  if (finger.size > 1) { aktion = null; if (werkzeug === "strasse") { bau.kandidat = null; planNeu(); } return; }
  if (e.pointerType === "mouse" && e.button !== 0) return;
  $("menue").hidden = true;
  const p = bodenPunkt(e); if (!p) return;
  aktion = { id: e.pointerId, sx: e.clientX, sy: e.clientY, bewegt: false, letzte: p };
  if (werkzeug === "strasse") {
    const noetig = strModus === "gerade" ? 2 : 3;
    if (bau.punkte.length >= noetig) bau.punkte.pop();     // fertiger Plan: letzten Punkt neu setzen
    bau.kandidat = kandidatAus(p); planNeu();
  } else if (werkzeug === "zone") { merkeRueck(); if (pinsel === "fuellen") fuellen(p); else malen(p, p); }
  else if (werkzeug === "abriss") { merkeRueck(); abreissenStrich(p, p); }
});
renderer.domElement.addEventListener("pointermove", (e) => {
  if (!aktion) {
    if (werkzeug === "strasse" && e.pointerType === "mouse" && finger.size === 0 && bau.punkte.length && !bau.plan) { const p = bodenPunkt(e); if (p) { bau.kandidat = kandidatAus(p); planNeu(); } }
    return;
  }
  if (aktion.id !== e.pointerId) return;
  if (Math.hypot(e.clientX - aktion.sx, e.clientY - aktion.sy) > 8) aktion.bewegt = true;
  const p = bodenPunkt(e); if (!p) return;
  if (werkzeug === "strasse") { bau.kandidat = kandidatAus(p); planNeu(); }
  else if (werkzeug === "zone" && pinsel !== "fuellen") malen(aktion.letzte, p);
  else if (werkzeug === "abriss") abreissenStrich(aktion.letzte, p);
  aktion.letzte = p;
});
function loslassen(e) {
  finger.delete(e.pointerId);
  if (!aktion || aktion.id !== e.pointerId) return;
  const a = aktion; aktion = null;
  if (werkzeug === "strasse") { if (bau.kandidat) { bau.punkte.push(bau.kandidat); bau.kandidat = null; } planNeu(); }
  else if (werkzeug === "abriss" && !a.bewegt) abreissenStrasse(a.letzte);
  else if (werkzeug === "ansehen" && !a.bewegt) hausInfo(a.letzte);
  else if (werkzeug === "gebiet" && !a.bewegt) gebietAntippen(e);
}
renderer.domElement.addEventListener("pointerup", loslassen);
renderer.domElement.addEventListener("pointercancel", (e) => { finger.delete(e.pointerId); if (aktion && aktion.id === e.pointerId) { aktion = null; bau.kandidat = null; planNeu(); } });
renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("keydown", (e) => { if (e.key === "Escape") { bauAbbrechen(); frageZu(); } if (e.key === "Enter" && frageJa) frageJa(); if ((e.ctrlKey || e.metaKey) && e.key === "z") rueckgaengig(); });

/* ---------- Zonen ---------- */
function malen(a, b) {
  const r = pinsel === "gross" ? 1.7 : 0.75, n = Math.max(1, Math.ceil(abst(a, b) / 0.4)); let geaendert = false;
  for (let i = 0; i <= n; i++) {
    const p = lerp(a, b, i / n);
    for (const z of zellenNahe(p.x, p.z, r)) { if (z.zone === zoneWahl) continue; if (z.haus) hausWeg(haeuser.get(z.haus)); z.zone = zoneWahl; geaendert = true; }
  }
  if (geaendert) { zellenNeu = true; zeigeWerte(); speichernBald(); }
}
function fuellen(p) {
  const nah = zellenNahe(p.x, p.z, 1.5).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  if (!nah) { tipp("Tipp direkt auf die Felder neben einer Straße.", 2000); return; }
  for (const z of zellen.values()) if (z.g === nah.g && z.seite === nah.seite && z.zone !== zoneWahl) { if (z.haus) hausWeg(haeuser.get(z.haus)); z.zone = zoneWahl; }
  zellenNeu = true; zeigeWerte(); speichernBald();
}
function abreissenStrich(a, b) {
  const n = Math.max(1, Math.ceil(abst(a, b) / 0.4)); let geaendert = false;
  for (let i = 0; i <= n; i++) { const p = lerp(a, b, i / n); for (const z of zellenNahe(p.x, p.z, 0.7)) { if (z.haus) { hausWeg(haeuser.get(z.haus)); geaendert = true; } if (z.zone) { z.zone = 0; geaendert = true; } } }
  if (geaendert) { zellenNeu = true; zeigeWerte(); speichernBald(); }
}
function abreissenStrasse(p) {
  const e = naechsteKante(p, Math.max(0.9, fangRadius() * 0.6));
  if (!e) return;
  const erstattung = Math.round(e.k.len * TYP[e.k.typ].preis * 0.3);
  kanteWeg(e.k); verwaisteZellen(); geld += erstattung; netzGeaendert(); zeigeWerte(); tipp("Straße abgerissen (+" + euro(erstattung) + " zurück).", 2000);
}

/* ---------- Infos und Gebiete ---------- */
function hausInfo(p) {
  const z = zellenNahe(p.x, p.z, 0.8).find((c) => c.haus); const el = $("info");
  if (!z) { el.hidden = true; return; }
  const h = haeuser.get(z.haus), f = h.zellen.length;
  const art = h.zone === 1 ? ["Einfamilienhaus", "Mehrfamilienhaus", "Wohnblock"][h.stufe - 1] : h.zone === 2 ? ["Kleiner Laden", "Geschäftshaus", "Büroturm"][h.stufe - 1] : ["Werkstatt", "Fabrikhalle", "Fabrik"][h.stufe - 1];
  const zahl = h.zone === 1 ? "👥 " + [0, 3, 8, 22][h.stufe] * f + " Bewohner" : "💼 " + (h.zone === 2 ? [0, 2, 5, 14] : [0, 4, 8, 15])[h.stufe] * f + " Arbeitsplätze";
  el.innerHTML = `<b>${ZONEN[h.zone].em} ${art}</b>${zahl}<br><small>Stufe ${h.stufe} von 3 · ${h.w}×${h.d} Felder${h.stufe < 3 ? " · wird mit der Zeit größer" : ""}</small>`;
  el.hidden = false; clearTimeout(hausInfo.t); hausInfo.t = setTimeout(() => { el.hidden = true; }, 5000);
}
function gebietAntippen(e) {
  strahl.setFromCamera(ndc(e), kamera);
  let ziel = null; const t = strahl.intersectObjects(preisSchilder.children); if (t.length) ziel = t[0].object.userData;
  if (!ziel) { const p = bodenPunkt(e); if (p) { const [i, j] = kachelVon(p.x, p.z); if (kaufbar(i, j)) ziel = { i, j }; } }
  if (!ziel) { tipp("Du kannst nur Gebiete kaufen, die an dein Land grenzen.", 2200); return; }
  const preis = GEBIET_PREIS(gekauft);
  if (geld < preis) { frage("Das Gebiet kostet " + euro(preis) + " – dir fehlen noch " + euro(preis - geld), false, null); return; }
  frage("Gebiet kaufen für " + euro(preis) + "?", true, () => {
    merkeRueck(); geld -= preis; gekauft++; besitz.add(ziel.i + "," + ziel.j); frageZu(); gebieteZeichnen(); zeigeWerte(); speichernBald();
    tipp("🎉 Neues Gebiet gekauft! Jetzt kannst du dort bauen.", 2600);
  });
}

/* ---------- Menü ---------- */
const menue = $("menue");
$("menueKnopf").onclick = () => { menue.hidden = !menue.hidden; $("menueKnopf").setAttribute("aria-expanded", String(!menue.hidden)); };
function menueKnoepfe() {
  document.querySelectorAll("#zeiten button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.zeit === zeitModus)));
  document.querySelectorAll("#grafik button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.q === stufe)));
}
$("zeiten").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; zeitModus = b.dataset.zeit; merke("inselstadt-bau-zeit", zeitModus); zeitZiel = zeitModus === "auto" ? null : ZEITEN[zeitModus]; menueKnoepfe(); };
$("grafik").onclick = (e) => { const b = e.target.closest("button"); if (b) { qualitaet(b.dataset.q); menueKnoepfe(); } };
let loeschBereit = 0;
$("neuAnfangen").onclick = () => {
  if (Date.now() - loeschBereit > 3000) { loeschBereit = Date.now(); $("neuAnfangen").textContent = "Wirklich alles löschen?"; setTimeout(() => { $("neuAnfangen").textContent = "🗑️ Neu anfangen"; }, 3000); return; }
  speichernAus = true; clearTimeout(speicherTimer); try { localStorage.removeItem(SPEICHER); } catch (x) { /* egal */ } location.reload();
};
$("los").onclick = () => { $("start").hidden = true; merke("inselstadt-start2", true); werkzeugWaehlen("strasse"); };
function qualitaet(neu) {
  stufe = neu; merke("inselstadt-qualitaet", stufe); const q = STUFEN[stufe];
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.pr));
  const vorher = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = q.schatten > 0; sonne.castShadow = q.schatten > 0;
  if (q.schatten) { sonne.shadow.mapSize.set(q.schatten, q.schatten); if (sonne.shadow.map) { sonne.shadow.map.dispose(); sonne.shadow.map = null; } }
  if (vorher !== renderer.shadowMap.enabled) szene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
  autosAbgleichen();
}
addEventListener("resize", () => { kamera.aspect = innerWidth / innerHeight; kamera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

/* ================================================================
   Los
   ================================================================ */
let jetztS = performance.now() / 1000;
qualitaet(stufe); menueKnoepfe();
const gespeichert = lade(SPEICHER, null);
if (gespeichert && gespeichert.v === 2) { try { zustandRein(gespeichert); } catch (e) { console.warn("Spielstand kaputt", e); allesLeeren(); netzGeaendert(); gebieteZeichnen(); } }
else { netzGeaendert(); gebieteZeichnen(); }
zeigeWerte(); unterleiste();
if (!lade("inselstadt-start2", false)) $("start").hidden = false;
else tipp(gespeichert ? "Willkommen zurück in deiner Inselstadt!" : TIPPS.ansehen, 4000);
window.inselstadt = { kanten, knoten, zellen, haeuser, planen, bauen, fangen, wachsTakt, werkzeugWaehlen, geld: () => geld, besitz: () => besitz };   // zum Testen

let letzte = jetztS, takt = 0, woche = 0, fpsZeit = 0, fpsBilder = 0, erstes = true;
const _ziel = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  const t = performance.now() / 1000, dt = Math.min(0.05, t - letzte); letzte = t; jetztS = t;
  U.uTime.value = t % 1000;
  if (zeitModus === "auto") zeit = (zeit + dt / 150) % 1;
  else if (zeitZiel != null) { let d = zeitZiel - zeit; if (d < -0.5) d += 1; if (d > 0.5) d -= 1; zeit = (zeit + Math.sign(d) * Math.min(Math.abs(d), dt * 0.35) + 1) % 1; if (Math.abs(d) < 0.0005) zeitZiel = null; }
  licht(zeit);
  takt += dt; if (takt > 0.5) { takt = 0; wachsTakt(); }
  woche += dt; if (woche > 6) { woche = 0; wocheTakt(); }
  if (zellenNeu) zellenZeichnen();
  if (haeuserNeu) haeuserZeichnen();
  rauchZeichnen(); autosFahren(dt);
  boote.forEach((b) => { b.w += b.v * dt; b.g.position.set(Math.cos(b.w) * b.rad, WASSER + 0.02 + Math.sin(t * 1.6 + b.ph) * 0.05, Math.sin(b.w) * b.rad); b.g.rotation.set(Math.sin(t * 1.3 + b.ph) * 0.05, -b.w + (b.v > 0 ? -Math.PI / 2 : Math.PI / 2), 0); });
  leuchtturm.userData.strahl.rotation.y = t * 0.8;
  steuerung.update();
  _ziel.copy(steuerung.target);
  if (Math.abs(_ziel.x) > HALB || Math.abs(_ziel.z) > HALB) { const d = new THREE.Vector3(Math.max(-HALB, Math.min(HALB, _ziel.x)) - _ziel.x, 0, Math.max(-HALB, Math.min(HALB, _ziel.z)) - _ziel.z); steuerung.target.add(d); kamera.position.add(d); }
  himmel.position.copy(kamera.position);
  if (preisSchilder.children.length) { const ka = kameraAbstand(); preisSchilder.children.forEach((s) => { s.scale.set(ka * 0.16, ka * 0.0625, 1); s.position.y = 2 + ka * 0.04; }); }
  renderer.render(szene, kamera);
  if (erstes) { erstes = false; $("laden").classList.add("weg"); }
  fpsBilder++; fpsZeit += dt; if (fpsZeit >= 0.5) { $("fps").textContent = Math.round(fpsBilder / fpsZeit) + " FPS"; fpsBilder = 0; fpsZeit = 0; }
});
