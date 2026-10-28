/* Inselstadt – Bau-Test (FLARESSA Gaming)
   Straßen frei mit dem Finger ziehen (auch Kurven), Zonen anmalen, Häuser wachsen von selbst.
   Noch ohne Geld, Strom und Wasser – das kommt in den nächsten Runden. */
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

/* ---------- Grundwerte ---------- */
const G = 0.12;               // Wiese
const BODEN = G + 0.02;       // Unterkante der Häuser
const WASSER = -0.3;
const ZELLE = 1.0;            // Größe eines Baufelds
const GEHWEG = 0.8, FAHRBAHN = 0.55;  // halbe Breiten
const REIHEN = 3;             // Baufelder hintereinander
const INSEL_SEED = 20261028;
const SPEICHER = "inselstadt-bau-v1";
const ZONEN = { 1: { name: "Wohnen", farbe: 0x4fd27a }, 2: { name: "Läden", farbe: 0x4aa8ff }, 3: { name: "Industrie", farbe: 0xffc23d } };
const WZ = { wohnen: 1, laden: 2, industrie: 3 };
const STUFEN = { niedrig: { name: "Niedrig", pr: 1, schatten: 0, autos: 25 }, mittel: { name: "Mittel", pr: 1.5, schatten: 1024, autos: 50 }, hoch: { name: "Hoch", pr: 2, schatten: 2048, autos: 80 } };
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
szene.fog = new THREE.Fog(0xbfe6ff, 70, 300);
const kamera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.3, 1200);
const startAbstand = () => 62 * Math.max(1, 0.8 / (innerWidth / innerHeight));
kamera.position.set(0.8, 1.1, 1).normalize().multiplyScalar(startAbstand());

const steuerung = new OrbitControls(kamera, renderer.domElement);
steuerung.enableDamping = true; steuerung.dampingFactor = 0.1;
steuerung.screenSpacePanning = false;
steuerung.minDistance = 8; steuerung.maxDistance = 150;
steuerung.minPolarAngle = 0.25; steuerung.maxPolarAngle = 1.25;
steuerung.zoomToCursor = true;

const himmelLicht = new THREE.HemisphereLight(0xcfe9ff, 0x6b8f5a, 1.0);
const sonne = new THREE.DirectionalLight(0xfff4e0, 2.6);
sonne.shadow.camera.left = -46; sonne.shadow.camera.right = 46; sonne.shadow.camera.top = 46; sonne.shadow.camera.bottom = -46;
sonne.shadow.camera.near = 10; sonne.shadow.camera.far = 220; sonne.shadow.bias = -0.0006; sonne.shadow.normalBias = 0.03;
szene.add(himmelLicht, sonne, sonne.target);
const U = { uTime: { value: 0 }, uNacht: { value: 0 } };

/* ---------- Himmel ---------- */
const himmel = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({
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
himmel.frustumCulled = false; himmel.renderOrder = -1;
szene.add(himmel);

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
  vorschau: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false }),
  rauch: new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false })
};

/* ---------- Geometrien ---------- */
const G_BOX = new THREE.BoxGeometry(1, 1, 1);
const G_BOX_UNTEN = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const G_ZYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 12).translate(0, 0.5, 0);
const G_DACH = (function () {
  const p = [-.5, 0, .5, .5, 0, .5, .5, 1, 0, -.5, 0, .5, .5, 1, 0, -.5, 1, 0,
    .5, 0, -.5, -.5, 0, -.5, -.5, 1, 0, .5, 0, -.5, -.5, 1, 0, .5, 1, 0,
    -.5, 0, -.5, -.5, 0, .5, -.5, 1, 0, .5, 0, .5, .5, 0, -.5, .5, 1, 0];
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

/* ---------- Insel ---------- */
const ri = zufall(INSEL_SEED);
const insel = { a0: 31, amp: [2.4 + ri() * 1.4, 1.2 + ri() * 1.0, 0.6 + ri() * 0.6], ph: [ri() * 6.283, ri() * 6.283, ri() * 6.283] };
const radius = (th) => insel.a0 + insel.amp[0] * Math.sin(3 * th + insel.ph[0]) + insel.amp[1] * Math.sin(5 * th + insel.ph[1]) + insel.amp[2] * Math.sin(7 * th + insel.ph[2]);
const aufLand = (x, z, rand) => Math.hypot(x, z) < radius(Math.atan2(z, x)) - rand;
function form(versatz) {
  const s = new THREE.Shape(), n = 200;
  for (let i = 0; i < n; i++) { const th = i / n * Math.PI * 2, r = radius(th) + versatz; const x = Math.cos(th) * r, y = -Math.sin(th) * r; if (i) s.lineTo(x, y); else s.moveTo(x, y); }
  s.closePath(); return s;
}
function platte(versatz, tiefe, schraege, oben, mat) {
  const g = new THREE.ExtrudeGeometry(form(versatz), { depth: tiefe, bevelEnabled: true, bevelThickness: schraege[0], bevelSize: schraege[1], bevelSegments: schraege[2], curveSegments: 1 });
  g.translate(0, 0, -(tiefe + schraege[0])); g.rotateX(-Math.PI / 2); g.translate(0, oben, 0);
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
}
szene.add(platte(0, 2, [0.7, 1.8, 3], 0, M.sand), platte(-2.4, 0.05, [0.07, 0.4, 2], G, M.wiese));

/* Wasser */
const wasserMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: U.uTime, uNacht: U.uNacht, uTief: { value: farbe(0x1667a3) }, uFlach: { value: farbe(0x3cc9c4) }, uHimmel: { value: farbe(0xbfe6ff) },
    uSonne: { value: new THREE.Vector3(0, 1, 0) }, uSonnenFarbe: { value: farbe(0xffffff) }, uNebel: { value: farbe(0xbfe6ff) }, uNah: { value: 70 }, uFern: { value: 300 },
    uA0: { value: insel.a0 }, uAmp: { value: new THREE.Vector3(...insel.amp) }, uPh: { value: new THREE.Vector3(...insel.ph) }
  },
  vertexShader: `uniform float uTime; varying vec3 vW;
    void main(){ vec4 w = modelMatrix * vec4(position, 1.0);
      w.y += sin(w.x * 0.33 + uTime * 1.1) * 0.06 + sin(w.z * 0.27 - uTime * 0.9) * 0.05 + sin((w.x + w.z) * 0.6 + uTime * 1.7) * 0.025;
      vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform float uTime, uNacht, uNah, uFern, uA0; uniform vec3 uTief, uFlach, uHimmel, uSonne, uSonnenFarbe, uNebel, uAmp, uPh; varying vec3 vW;
    void main(){
      vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); if (n.y < 0.0) n = -n;
      n = normalize(n + vec3(sin(vW.x * 2.1 + uTime * 2.0) * 0.035 + sin(vW.z * 4.7 + uTime * 3.0) * 0.02, 0.0, cos(vW.z * 2.3 - uTime * 1.7) * 0.035 + cos(vW.x * 5.1 - uTime * 2.6) * 0.02));
      vec3 V = normalize(cameraPosition - vW);
      float th = atan(vW.z, vW.x);
      float R = uA0 + uAmp.x * sin(3.0 * th + uPh.x) + uAmp.y * sin(5.0 * th + uPh.y) + uAmp.z * sin(7.0 * th + uPh.z);
      float d = length(vW.xz) - R;
      vec3 c = mix(uTief, uFlach, 1.0 - smoothstep(0.8, 10.0, d));
      c = mix(c, uHimmel, pow(1.0 - max(dot(n, V), 0.0), 4.0) * 0.65);
      vec3 H = normalize(normalize(uSonne) + V);
      c += uSonnenFarbe * pow(max(dot(n, H), 0.0), 240.0) * 1.6;
      float schaum = smoothstep(0.5, 0.0, abs(d - 1.15 - 0.22 * sin(uTime * 1.4 + th * 18.0)));
      c = mix(c, vec3(0.92), schaum * 0.7 * (1.0 - uNacht * 0.65));
      c = mix(c, uNebel, smoothstep(uNah, uFern, length(cameraPosition - vW)));
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
});
const wasser = new THREE.Mesh(new THREE.PlaneGeometry(800, 800, 200, 200).rotateX(-Math.PI / 2), wasserMat);
wasser.position.y = WASSER; szene.add(wasser);

/* Leuchtturm und Boote */
let leuchtturm;
{
  let bestTh = 0, best = 0; for (let t = 0; t < 64; t++) { const th = t / 64 * Math.PI * 2, R = radius(th); if (R > best) { best = R; bestTh = th; } }
  leuchtturm = new THREE.Group(); const lr = best - 0.6; leuchtturm.position.set(Math.cos(bestTh) * lr, 0, Math.sin(bestTh) * lr);
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
for (let b = 0; b < 4; b++) {
  const g = new THREE.Group(), fr = wahl(ri, [0xffffff, 0xf2c14e, 0xe8493f, 0x3f7fe8]);
  const rumpf = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 0.5), new THREE.MeshStandardMaterial({ color: fr, roughness: 0.5 })); rumpf.position.y = 0.1;
  const kab = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.38), new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.5 })); kab.position.set(-0.1, 0.38, 0);
  rumpf.castShadow = kab.castShadow = true; g.add(rumpf, kab); szene.add(g);
  boote.push({ g, rad: insel.a0 + 8 + ri() * 10, w: ri() * 6.28, v: (0.025 + ri() * 0.03) * (ri() < 0.5 ? 1 : -1), ph: ri() * 6 });
}

/* ---------- Instanz-Becken (wachsen mit) ---------- */
function becken(geo, mat, max, schatten) {
  const m = new THREE.InstancedMesh(geo, mat, max); m.count = 0; m.frustumCulled = false; m.castShadow = !!schatten; m.receiveShadow = true;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, new THREE.Color(1, 1, 1)); szene.add(m); return m;
}
const B = {
  haus: becken(G_BOX_UNTEN, M.haus, 6000, true), flach: becken(G_BOX_UNTEN, M.flach, 9000, true), dach: becken(G_DACH, M.dach, 4000, true),
  zyl: becken(G_ZYL, M.flach, 2500, true), garten: becken(G_LAUBBAUM, M.baum, 2500, true), rauch: becken(new THREE.IcosahedronGeometry(0.5, 0), M.rauch, 600, false)
};
const _o = new THREE.Object3D(), _farbe = new THREE.Color();

/* ---------- Bäume der Insel ---------- */
const baeume = [];   // {x,z,s,ry,art,weg}
const baumMesh = { laub: null, nadel: null };
{
  const r = zufall(INSEL_SEED + 1); const listen = { laub: [], nadel: [] };
  for (let t = 0; t < 2600 && baeume.length < 1100; t++) {
    const th = r() * Math.PI * 2, R = radius(th), rr = Math.sqrt(r()) * (R - 2.9);
    const x = Math.cos(th) * rr, z = Math.sin(th) * rr;
    // Wäldchen: mehr Bäume, wo ein Rauschen hoch ist
    const dichte = 0.5 + 0.5 * Math.sin(x * 0.21 + 1.3) * Math.cos(z * 0.17 - 0.4) + 0.25 * Math.sin((x + z) * 0.4);
    if (r() > dichte * 0.9 + 0.12) continue;
    const art = r() < 0.32 ? "nadel" : "laub", b = { x, z, s: 0.7 + r() * 0.7, ry: r() * 6.28, art, weg: false, c: new THREE.Color(0.82 + r() * 0.18, 0.85 + r() * 0.15, 0.8 + r() * 0.2) };
    b.i = listen[art].length; listen[art].push(b); baeume.push(b);
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
function baeumeFaellen(test) { let n = 0; for (const b of baeume) if (!b.weg && test(b.x, b.z)) { b.weg = true; baumSetzen(b); n++; } if (n) speichernBald(); }

/* ================================================================
   Straßennetz: Knoten + Kanten (quadratische Bézier-Kurven)
   ================================================================ */
const knoten = new Map(), kanten = new Map();
let nId = 1, kId = 1, zId = 1, gId = 1;
const bez = (p0, c, p2, t) => { const u = 1 - t; return { x: u * u * p0.x + 2 * u * t * c.x + t * t * p2.x, z: u * u * p0.z + 2 * u * t * c.z + t * t * p2.z }; };
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
const abst = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function abtasten(p0, c, p2) {
  const grob = abst(p0, c) + abst(c, p2), n = Math.max(4, Math.ceil(grob / 0.35)), pts = [];
  let s = 0, vor = null;
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = bez(p0, c, p2, t), tx = 2 * (1 - t) * (c.x - p0.x) + 2 * t * (p2.x - c.x), tz = 2 * (1 - t) * (c.z - p0.z) + 2 * t * (p2.z - c.z), l = Math.hypot(tx, tz) || 1;
    if (vor) s += abst(vor, p);
    pts.push({ x: p.x, z: p.z, t, s, tx: tx / l, tz: tz / l }); vor = p;
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
function huelle(pts) { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const p of pts) { a = Math.min(a, p.x); b = Math.max(b, p.x); c = Math.min(c, p.z); d = Math.max(d, p.z); } return { x0: a, x1: b, z0: c, z1: d }; }
const nahHuelle = (h, p, r) => p.x > h.x0 - r && p.x < h.x1 + r && p.z > h.z0 - r && p.z < h.z1 + r;
function strassenAbstand(p, ausser) {
  let m = 1e9; for (const k of kanten.values()) { if (k === ausser || !nahHuelle(k.h, p, Math.min(m, 4))) continue; m = Math.min(m, abstandZuLinie(p, k.pts)); } return m;
}

/* Straßen-Geometrie: Gehweg, Fahrbahn, Mittelstreifen */
const STR_FARBEN = { gehweg: farbe(0xcbc6ba), fahrbahn: farbe(0x3b4049), strich: farbe(0xf1eee4) };
function band(pos, col, pts, halb, y, c) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const ax = -a.tz * halb, az = a.tx * halb, bx = -b.tz * halb, bz = b.tx * halb;
    pos.push(a.x + ax, y, a.z + az, b.x + bx, y, b.z + bz, a.x - ax, y, a.z - az, a.x - ax, y, a.z - az, b.x + bx, y, b.z + bz, b.x - bx, y, b.z - bz);
    for (let v = 0; v < 6; v++) col.push(c.r, c.g, c.b);
  }
}
function scheibe(pos, col, x, z, r, y, c) { const n = 20; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2; pos.push(x, y, z, x + Math.cos(b) * r, y, z + Math.sin(b) * r, x + Math.cos(a) * r, y, z + Math.sin(a) * r); for (let v = 0; v < 3; v++) col.push(c.r, c.g, c.b); } }
function geoAus(pos, col) { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g; }
function kantenMesh(k) {
  const pos = [], col = [];
  band(pos, col, k.pts, GEHWEG, G + 0.012, STR_FARBEN.gehweg);
  band(pos, col, k.pts, FAHRBAHN, G + 0.02, STR_FARBEN.fahrbahn);
  for (let s = 1.0; s < k.len - 1.0; s += 1.1) {
    const a = punktBei(k, s), b = punktBei(k, Math.min(s + 0.5, k.len - 0.9)); band(pos, col, [a, b], 0.03, G + 0.024, STR_FARBEN.strich);
  }
  const m = new THREE.Mesh(geoAus(pos, col), M.strasse); m.receiveShadow = true; return m;
}
function knotenMesh(n) {
  const pos = [], col = []; scheibe(pos, col, n.x, n.z, GEHWEG, G + 0.0125, STR_FARBEN.gehweg); scheibe(pos, col, n.x, n.z, FAHRBAHN, G + 0.0205, STR_FARBEN.fahrbahn);
  const m = new THREE.Mesh(geoAus(pos, col), M.strasse); m.receiveShadow = true; return m;
}
function neuerKnoten(p, id) { const n = { id: id || nId++, x: p.x, z: p.z, kanten: new Set() }; nId = Math.max(nId, n.id + 1); n.mesh = knotenMesh(n); szene.add(n.mesh); knoten.set(n.id, n); return n; }
function knotenWeg(n) { szene.remove(n.mesh); n.mesh.geometry.dispose(); knoten.delete(n.id); }
function neueKante(aId, bId, c, id) {
  const a = knoten.get(aId), b = knoten.get(bId), { pts, len } = abtasten(a, c, b);
  const k = { id: id || kId++, a: aId, b: bId, c: { x: c.x, z: c.z }, pts, len, h: huelle(pts) }; kId = Math.max(kId, k.id + 1);
  k.mesh = kantenMesh(k); szene.add(k.mesh); kanten.set(k.id, k); a.kanten.add(k.id); b.kanten.add(k.id); return k;
}
function kanteWeg(k) {
  szene.remove(k.mesh); k.mesh.geometry.dispose(); kanten.delete(k.id);
  for (const nid of [k.a, k.b]) { const n = knoten.get(nid); if (!n) continue; n.kanten.delete(k.id); if (!n.kanten.size) knotenWeg(n); }
}
function kanteTeilen(k, t) {
  const a = knoten.get(k.a), b = knoten.get(k.b), m = bez(a, k.c, b, t), n = neuerKnoten(m);
  const c1 = lerp(a, k.c, t), c2 = lerp(k.c, b, t), aId = k.a, bId = k.b;
  kanteWeg(k); if (!knoten.has(aId)) neuerKnoten(a, aId); if (!knoten.has(bId)) neuerKnoten(b, bId);
  neueKante(aId, n.id, c1); neueKante(n.id, bId, c2); return n;
}
function naechsterKnoten(p, r) { let best = null, bd = r; for (const n of knoten.values()) { const d = abst(n, p); if (d < bd) { bd = d; best = n; } } return best; }
function naechsteKante(p, r) { let best = null; for (const k of kanten.values()) { if (!nahHuelle(k.h, p, r)) continue; const e = abstandZuLinie(p, k.pts, true); if (e.d < r && (!best || e.d < best.d)) best = { k, ...e }; } return best; }
function fangen(p) {
  const n = naechsterKnoten(p, 1.1); if (n) return { art: "knoten", id: n.id, x: n.x, z: n.z };
  const e = naechsteKante(p, 0.9); if (e) return { art: "kante", id: e.k.id, x: e.x, z: e.z };
  return { art: "frei", x: p.x, z: p.z };
}
function knotenFuer(p) {
  const n = naechsterKnoten(p, 1.1); if (n) return n;
  const e = naechsteKante(p, 0.9);
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
  return liste.filter((q, i) => !liste.slice(0, i).some((o) => abst(o, q) < 1.2));
}

/* Gezogenen Pfad in Kurvenstücke umwandeln und prüfen */
function planen(pfad, start, ende) {
  const p = pfad.slice(); p[0] = { x: start.x, z: start.z }; p[p.length - 1] = { x: ende.x, z: ende.z };
  const cum = [0]; for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + abst(p[i - 1], p[i]));
  const L = cum[cum.length - 1];
  const bei = (s) => { let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; const f = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); return lerp(p[i - 1], p[i], Math.min(1, Math.max(0, f))); };
  const n = Math.max(1, Math.round(L / 11)), stuecke = [];
  for (let j = 0; j < n; j++) {
    const s0 = L * j / n, s1 = L * (j + 1) / n, A = j ? bei(s0) : p[0], Bp = j === n - 1 ? p[p.length - 1] : bei(s1), Mp = bei((s0 + s1) / 2);
    let c = { x: 2 * Mp.x - (A.x + Bp.x) / 2, z: 2 * Mp.z - (A.z + Bp.z) / 2 };
    const mitte = lerp(A, Bp, 0.5); if (abst(Mp, mitte) < 0.35) c = mitte;
    stuecke.push({ a: A, c, b: Bp });
  }
  let ok = L >= 1.6, pts = [];
  const enden = [start, ende];
  for (const s of stuecke) {
    const t = abtasten(s.a, s.c, s.b); s.pts = t.pts; pts = pts.concat(t.pts);
    if (t.len < 1.2) ok = false;
  }
  if (ok) for (const q of pts) if (!aufLand(q.x, q.z, 3.0)) { ok = false; break; }
  const kreuz = ok ? kreuzungen(pts, enden) : [];
  if (ok) {
    const frei = (q) => !enden.concat(kreuz).some((e) => abst(e, q) < 1.9);
    for (const q of pts) { if (frei(q) && strassenAbstand(q) < 1.45) { ok = false; break; } }
  }
  if (ok && start.art !== "frei" && ende.art !== "frei" && start.id === ende.id && start.art === "knoten") ok = false;
  return { stuecke, ok, pts, kreuz, laenge: L };
}
function bauen(plan, start, ende) {
  let n0 = knotenFuer(start); const neu = [];
  plan.stuecke.forEach((s, i) => {
    const n2 = i === plan.stuecke.length - 1 ? knotenFuer(ende) : knotenFuer(s.b);
    if (n2 === n0) return;
    const { pts } = abtasten(n0, s.c, n2);
    const kr = kreuzungen(pts, [n0, n2]).map((q) => ({ t: q.t, n: knotenFuer(q) })).filter((q) => q.n !== n0 && q.n !== n2);
    const ts = [0].concat(kr.map((q) => q.t), [1]), ns = [n0].concat(kr.map((q) => q.n), [n2]);
    for (let j = 0; j < ns.length - 1; j++) {
      const ta = ts[j], tb = ts[j + 1], P0 = n0, C = s.c, P2 = n2;
      // Kontrollpunkt des Teilstücks (Blüten-Form der Bézier-Kurve)
      const c = { x: (1 - ta) * (1 - tb) * P0.x + ((1 - ta) * tb + ta * (1 - tb)) * C.x + ta * tb * P2.x, z: (1 - ta) * (1 - tb) * P0.z + ((1 - ta) * tb + ta * (1 - tb)) * C.z + ta * tb * P2.z };
      if (ns[j] === ns[j + 1] || abst(ns[j], ns[j + 1]) < 0.6) continue;
      if ([...ns[j].kanten].some((id) => { const k = kanten.get(id); return (k.a === ns[j].id && k.b === ns[j + 1].id) || (k.b === ns[j].id && k.a === ns[j + 1].id); })) continue;
      neu.push(neueKante(ns[j].id, ns[j + 1].id, c));
    }
    n0 = n2;
  });
  // Felder und Bäume, die jetzt auf der Straße liegen, verschwinden
  for (const k of neu) {
    for (const z of [...zellen.values()]) if (nahHuelle(k.h, z, 1.5) && abstandZuLinie(z, k.pts) < 1.2) zelleWeg(z);
    baeumeFaellen((x, z) => nahHuelle(k.h, { x, z }, 1.2) && abstandZuLinie({ x, z }, k.pts) < 1.05);
  }
  for (const k of neu) zellenFuer(k);
  netzGeaendert();
  return neu.length;
}

/* ================================================================
   Baufelder (wie bei Cities: Skylines entlang der Straßen)
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
function neueZelle(d) { const z = Object.assign({ id: d.id || zId++, zone: 0, haus: null }, d); zId = Math.max(zId, z.id + 1); z.key = z.g + "|" + z.seite + "|" + z.i + "|" + z.r; zellen.set(z.id, z); zellIndex.set(z.key, z.id); rasterRein(z); return z; }
function zelleWeg(z) { if (z.haus) hausWeg(haeuser.get(z.haus)); zellen.delete(z.id); zellIndex.delete(z.key); rasterRaus(z); zellenNeu = true; }
function zellenFuer(k) {
  const n = Math.floor((k.len - 1.7) / ZELLE); if (n < 1) return;
  const rand = (k.len - n * ZELLE) / 2, g = gId++;
  for (let i = 0; i < n; i++) {
    const p = punktBei(k, rand + (i + 0.5) * ZELLE), nx = -p.tz, nz = p.tx;
    for (const seite of [1, -1]) for (let r = 0; r < REIHEN; r++) {
      const d = GEHWEG + ZELLE / 2 + 0.02 + r * ZELLE, x = p.x + nx * seite * d, z = p.z + nz * seite * d;
      if (!aufLand(x, z, 3.0) || strassenAbstand({ x, z }) < GEHWEG + 0.45 || zellenNahe(x, z, 0.86).length) break;
      neueZelle({ x, z, rot: Math.atan2(-nx * seite, -nz * seite), g, seite, i, r });
    }
  }
  zellenNeu = true;
}
function verwaisteZellen() { for (const z of [...zellen.values()]) if (strassenAbstand(z) > GEHWEG + REIHEN * ZELLE + 0.3) zelleWeg(z); }

/* Felder-Anzeige */
const zellMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2), M.zelle, 14000);
zellMesh.count = 0; zellMesh.frustumCulled = false; zellMesh.renderOrder = 2; zellMesh.setColorAt(0, new THREE.Color()); szene.add(zellMesh);
let zellenNeu = true, werkzeug = "ansehen";
function zellenZeichnen() {
  zellenNeu = false; let i = 0; const leerSichtbar = werkzeug !== "ansehen";
  for (const z of zellen.values()) {
    if (z.haus) continue; if (!z.zone && !leerSichtbar) continue;
    _o.position.set(z.x, G + 0.03, z.z); _o.rotation.set(0, z.rot, 0); _o.scale.set(1, 1, 1); _o.updateMatrix(); zellMesh.setMatrixAt(i, _o.matrix);
    if (z.zone) _farbe.setHex(ZONEN[z.zone].farbe); else _farbe.setRGB(0.95, 0.95, 0.95).multiplyScalar(0.55);
    zellMesh.setColorAt(i, _farbe); i++;
  }
  zellMesh.count = i; zellMesh.instanceMatrix.needsUpdate = true; if (zellMesh.instanceColor) zellMesh.instanceColor.needsUpdate = true;
}

/* ================================================================
   Häuser
   ================================================================ */
const haeuser = new Map(); let hId = 1, haeuserNeu = true;
const PAL = {
  haus: [0xf3e9d8, 0xf6d7b0, 0xe9b8a0, 0xd9e4ec, 0xf2f0e9, 0xf5e1a4, 0xcfe3c8, 0xe7cfe6], dach: [0xb2513a, 0x8f3f30, 0x5d6470, 0x7a4b3a, 0x3f5566, 0xa8673f],
  block: [0xe8dcc8, 0xd8c3a5, 0xc9a083, 0xf0ebe1, 0xb9c7cf, 0xe3c9a8, 0xd0d6c4], laden: [0xf2efe8, 0xe6dccb, 0xdfe7ee, 0xf3e3d0, 0xe0e0d8],
  markise: [0xe8493f, 0x2f8f6f, 0x3f7fe8, 0xf2a93b, 0x8e5be8, 0xe85b9a], turm: [0x9fb7c9, 0x7fa3b8, 0xc9d6df, 0x6d8aa1, 0xb8c4cc, 0x8fb0a8],
  halle: [0xd9d4c7, 0xc4c9cc, 0xbfb3a0, 0xd0c8b8, 0xaab3b8], auto: [0xe8493f, 0x3f7fe8, 0xf2f2f2, 0x2c2f36, 0xf2c14e, 0x4fbf7a, 0x9a5be8, 0xff8a3c]
};
function hausTeile(h) {
  const r = zufall(h.variante * 31 + h.stufe * 7919), W = h.w * ZELLE, D = h.d * ZELLE, T = [];
  const vorn = D / 2 - 0.12;  // Vorderkante (zur Straße)
  const box = (b, lx, lz, w, hh, d, c, extra) => T.push(Object.assign({ b, lx, ly: 0, lz, sx: w, sy: hh, sz: d, c }, extra || {}));
  const gartenFarbe = h.zone === 1 ? 0x8fcf68 : h.zone === 2 ? 0xd6cfc2 : 0xb5b3ad;
  box("flach", 0, 0, W * 0.97, 0.008, D * 0.97, gartenFarbe, { fest: true });
  if (h.zone === 1) {
    if (h.stufe === 1) {
      const n = W >= 2 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const w = 0.66 + r() * 0.16, d = 0.62 + r() * 0.14, hh = 0.48 + r() * 0.16, lx = n === 2 ? (k ? 0.5 : -0.5) : 0, lz = vorn - d / 2 - 0.08;
        box("haus", lx, lz, w, hh, d, wahl(r, PAL.haus));
        box("dach", lx, lz, w + 0.1, 0.28 + r() * 0.14, d + 0.1, wahl(r, PAL.dach), { ly: hh });
        if (D >= 2 && r() < 0.8) box("garten", lx + (r() - 0.5) * 0.4, lz - d / 2 - 0.55, 0.5 + r() * 0.35, 0.5 + r() * 0.35, 0.5 + r() * 0.35, null, { rund: true });
      }
    } else if (h.stufe === 2) {
      const w = Math.min(W * 0.82, 1.7), d = Math.min(D * 0.62, 1.15), hh = 0.78 + r() * 0.25, lz = vorn - d / 2 - 0.06;
      box("haus", 0, lz, w, hh, d, wahl(r, PAL.haus));
      if (r() < 0.6) box("dach", 0, lz, w + 0.1, 0.32 + r() * 0.12, d + 0.1, wahl(r, PAL.dach), { ly: hh });
      else box("flach", 0, lz, w * 0.4, 0.12, d * 0.4, 0x9aa0a8, { ly: hh });
      if (D >= 2) box("garten", (r() - 0.5) * W * 0.5, lz - d / 2 - 0.45, 0.6, 0.6, 0.6, null, { rund: true });
    } else {
      const w = W * 0.86, d = D * 0.78, hh = 1.3 + r() * 1.1 + (W >= 2 && D >= 3 ? r() * 0.9 : 0), lz = vorn - d / 2 - 0.04, c = wahl(r, PAL.block);
      box("haus", 0, lz, w, hh, d, c);
      box("flach", (r() - 0.5) * w * 0.4, lz + (r() - 0.5) * d * 0.4, 0.3, 0.16, 0.3, 0x9aa0a8, { ly: hh });
    }
  } else if (h.zone === 2) {
    if (h.stufe === 3 && (W >= 2 || D >= 2)) {
      const w = W * 0.82, d = D * 0.78, hh = 2.2 + r() * 1.8 + (W >= 2 && D >= 2 ? r() * 1.4 : 0), lz = vorn - d / 2 - 0.04, c = wahl(r, PAL.turm);
      box("haus", 0, lz, w, hh, d, c); box("haus", 0, lz, w * 0.7, 0.4 + r() * 0.6, d * 0.7, c, { ly: hh });
    } else {
      const w = W * (0.82 + r() * 0.1), d = Math.min(D, h.stufe === 1 ? 1 : 3) * 0.78, hh = h.stufe === 1 ? 0.55 + r() * 0.15 : 0.95 + r() * 0.6, lz = vorn - d / 2 - 0.04;
      box("haus", 0, lz, w, hh, d, wahl(r, PAL.laden));
      box("flach", 0, vorn - 0.02, w * 0.92, 0.05, 0.2, wahl(r, PAL.markise), { ly: 0.34 });
      if (r() < 0.5) box("flach", (r() - 0.5) * w * 0.5, lz, 0.28, 0.14, 0.3, 0xa7abb1, { ly: hh });
    }
  } else {
    const w = W * 0.86, d = D * (h.stufe === 1 ? 0.6 : 0.8), hh = h.stufe === 1 ? 0.42 : 0.6 + r() * 0.25, lz = vorn - d / 2 - 0.1, c = wahl(r, PAL.halle);
    box("haus", 0, lz, w, hh, d, c);
    box("dach", 0, lz, w + 0.04, 0.16, d + 0.04, 0x8b9096, { ly: hh });
    if (h.stufe >= 2) { const kx = -w / 2 + 0.2, kz = lz - d / 2 + 0.2; box("zyl", kx, kz, 0.16, 1.2 + r() * 0.5, 0.16, 0xb5523a, { schlot: true }); }
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
  const rr = Math.max(h.w, h.d) * 0.62 + 0.2; baeumeFaellen((bx, bz) => Math.hypot(bx - h.x, bz - h.z) < rr);
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
      if (t.rund) { const f = p >= 1 ? 1 : federn(p) * (p > 0 ? 1 : 0); _o.position.set(wx, BODEN, wz); _o.scale.set(t.sx * f + 1e-4, t.sy * f + 1e-4, t.sz * f + 1e-4); }
      else if (t.fest) { _o.position.set(wx, G + 0.012, wz); _o.scale.set(t.sx, t.sy, t.sz); }
      else { _o.position.set(wx, BODEN + t.ly * e, wz); _o.scale.set(t.sx, Math.max(t.sy * e, 1e-4), t.sz); }
      _o.rotation.set(0, h.rot, 0); _o.updateMatrix();
      m.setMatrixAt(n[t.b], _o.matrix); if (t.c != null) m.setColorAt(n[t.b], _farbe.setHex(t.c)); else m.setColorAt(n[t.b], _farbe.setRGB(0.85 + (h.variante % 7) * 0.02, 0.9, 0.85));
      n[t.b]++;
      if (t.schlot && p >= 1) rauchTeile.push({ x: wx, y: BODEN + t.sy, z: wz, ph: (h.variante % 100) / 13 });
    }
  }
  for (const k in n) { const m = B[k]; m.count = n[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  haeuserNeu = anim;
}
function rauchZeichnen() {
  let i = 0; const m = B.rauch;
  for (const r of rauchTeile) for (let k = 0; k < 4 && i < 600; k++) {
    const f = ((jetztS * 0.35 + r.ph + k / 4) % 1), s = 0.12 + f * 0.32;
    _o.position.set(r.x + f * 0.5 + Math.sin(jetztS + k) * 0.05, r.y + 0.05 + f * 1.3, r.z + f * 0.2); _o.rotation.set(f, f * 2, 0); _o.scale.set(s, s, s); _o.updateMatrix();
    m.setMatrixAt(i, _o.matrix); m.setColorAt(i, _farbe.setScalar(1 - f * 0.25)); i++;
  }
  m.count = i; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
}

/* Wachstum: leere angemalte Felder bekommen Häuser, Häuser werden größer */
const zk = (g, s, i, r) => zellIndex.get(g + "|" + s + "|" + i + "|" + r);
function freiGleich(id, zone) { const z = id && zellen.get(id); return z && !z.haus && z.zone === zone ? z : null; }
function wachsTakt() {
  const kand = { 1: [], 2: [], 3: [] };
  for (const z of zellen.values()) if (z.zone && !z.haus && z.r === 0) kand[z.zone].push(z);
  for (const zone of [1, 2, 3]) {
    const L = kand[zone]; if (!L.length || Math.random() > 0.65) continue;
    const a = L[Math.floor(Math.random() * L.length)];
    const breitWunsch = Math.random() < (zone === 1 ? 0.3 : zone === 2 ? 0.5 : 0.75);
    const spalten = [a]; const nb = freiGleich(zk(a.g, a.seite, a.i + 1, 0), zone);
    if (breitWunsch && nb) spalten.push(nb);
    let tiefe = REIHEN;
    for (const s of spalten) { let t = 1; while (t < REIHEN && freiGleich(zk(s.g, s.seite, s.i, t), zone)) t++; tiefe = Math.min(tiefe, t); }
    const ids = []; for (const s of spalten) for (let t = 0; t < tiefe; t++) ids.push(zk(s.g, s.seite, s.i, t));
    neuesHaus({ zone, stufe: 1, w: spalten.length, d: tiefe, variante: (Math.random() * 1e6) | 0, zellen: ids });
  }
  // Ausbau
  const liste = [...haeuser.values()].filter((h) => h.stufe < 3 && jetztS - h.geboren > 18 && (h.stufe < 2 || h.d >= 2 || h.zone === 3));
  if (liste.length && Math.random() < 0.55) {
    const h = liste[Math.floor(Math.random() * liste.length)]; h.stufe++; h.geboren = jetztS; h.ab = 0.35; h.teile = hausTeile(h); haeuserNeu = true;
  }
  werteZeigen(); speichernBald();
}
function werteZeigen() {
  let e = 0, j = 0; for (const h of haeuser.values()) { const f = h.zellen.length; if (h.zone === 1) e += [0, 3, 8, 22][h.stufe] * f; else j += (h.zone === 2 ? [0, 2, 5, 14] : [0, 4, 8, 15])[h.stufe] * f; }
  $("wEinw").textContent = e.toLocaleString("de-DE"); $("wJobs").textContent = j.toLocaleString("de-DE"); $("wHaeuser").textContent = haeuser.size.toLocaleString("de-DE");
}

/* ================================================================
   Autos und Laternen
   ================================================================ */
const AUTOS_MAX = 120;
const autoKoerper = becken(G_BOX, M.auto, AUTOS_MAX, true), autoKabine = becken(G_BOX, M.auto, AUTOS_MAX, true), autoLicht = becken(G_BOX, M.licht, AUTOS_MAX * 2, false);
let autos = [];
const ra = zufall(99);
function autoNeu() {
  const ks = [...kanten.values()]; if (!ks.length) return null;
  let sum = 0; ks.forEach((k) => { sum += k.len; }); let x = ra() * sum, k = ks[0]; for (const e of ks) { x -= e.len; if (x <= 0) { k = e; break; } }
  return { k: k.id, dir: ra() < 0.5 ? 1 : -1, s: ra() * k.len, v: 1.5 + ra() * 1.1, c: wahl(ra, PAL.auto) };
}
function autosAbgleichen() {
  let gesamt = 0; for (const k of kanten.values()) gesamt += k.len;
  const ziel = Math.min(STUFEN[stufe].autos, AUTOS_MAX, Math.floor(gesamt / 5));
  autos = autos.filter((a) => kanten.has(a.k)).slice(0, ziel);
  while (autos.length < ziel) { const a = autoNeu(); if (!a) break; autos.push(a); }
  autos.forEach((a, i) => { autoKoerper.setColorAt(i, _farbe.setHex(a.c)); autoKabine.setColorAt(i, _farbe.setHex(0x26303d)); autoLicht.setColorAt(i * 2, _farbe.setHex(0xfff3c8)); autoLicht.setColorAt(i * 2 + 1, _farbe.setHex(0xff3b30)); });
  [autoKoerper, autoKabine, autoLicht].forEach((m) => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  autoKoerper.count = autoKabine.count = autos.length; autoLicht.count = autos.length * 2;
}
const _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q0 = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
function autosFahren(dt) {
  autos.forEach((a, i) => {
    let k = kanten.get(a.k); if (!k) return;
    a.s += a.v * dt;
    let schutz = 0;
    while (a.s >= k.len && schutz++ < 5) {
      a.s -= k.len; const nid = a.dir > 0 ? k.b : k.a, n = knoten.get(nid);
      const weiter = [...n.kanten].filter((id) => id !== k.id); const nk = kanten.get(weiter.length ? weiter[Math.floor(ra() * weiter.length)] : k.id);
      a.k = nk.id; a.dir = nk.a === nid ? 1 : -1; k = nk;
    }
    const p = punktBei(k, a.dir > 0 ? a.s : k.len - a.s), dx = p.tx * a.dir, dz = p.tz * a.dir;
    _q.setFromAxisAngle(_y, Math.atan2(-dz, dx));
    _m.compose(_v.set(p.x - dz * 0.26, G + 0.02, p.z + dx * 0.26), _q, _s.set(1, 1, 1));
    _l.compose(_v.set(0, 0.1, 0), _q0, _s.set(0.48, 0.13, 0.24)); autoKoerper.setMatrixAt(i, _l.premultiply(_m));
    _l.compose(_v.set(-0.04, 0.2, 0), _q0, _s.set(0.26, 0.1, 0.2)); autoKabine.setMatrixAt(i, _l.premultiply(_m));
    _l.compose(_v.set(0.242, 0.11, 0), _q0, _s.set(0.02, 0.04, 0.2)); autoLicht.setMatrixAt(i * 2, _l.premultiply(_m));
    _l.compose(_v.set(-0.242, 0.11, 0), _q0, _s.set(0.02, 0.04, 0.2)); autoLicht.setMatrixAt(i * 2 + 1, _l.premultiply(_m));
  });
  autoKoerper.instanceMatrix.needsUpdate = autoKabine.instanceMatrix.needsUpdate = autoLicht.instanceMatrix.needsUpdate = true;
}
const masten = becken(G_BOX_UNTEN, M.flach, 3000, true);
const laternen = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: glanzTextur, size: 2.0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, color: 0xffd9a0 }));
laternen.frustumCulled = false; szene.add(laternen);
function laternenBauen() {
  const pos = []; let i = 0;
  for (const k of kanten.values()) for (let s = 1.6; s < k.len - 1.0 && i < 3000; s += 5) {
    const p = punktBei(k, s), x = p.x - p.tz * 0.7, z = p.z + p.tx * 0.7;
    _o.position.set(x, G + 0.012, z); _o.rotation.set(0, 0, 0); _o.scale.set(0.05, 0.82, 0.05); _o.updateMatrix(); masten.setMatrixAt(i, _o.matrix); masten.setColorAt(i, _farbe.setHex(0x50555e)); i++;
    pos.push(x, G + 0.88, z);
  }
  masten.count = i; masten.instanceMatrix.needsUpdate = true; if (masten.instanceColor) masten.instanceColor.needsUpdate = true;
  laternen.geometry.dispose(); laternen.geometry = new THREE.BufferGeometry(); laternen.geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos.length ? pos : [0, -50, 0], 3));
}
function netzGeaendert() { autosAbgleichen(); laternenBauen(); zellenNeu = true; speichernBald(); }

/* ================================================================
   Speichern und Laden
   ================================================================ */
let speicherTimer = 0;
function speichernBald() { clearTimeout(speicherTimer); speicherTimer = setTimeout(speichern, 800); }
function speichern() {
  const r = (v) => Math.round(v * 1000) / 1000;
  merke(SPEICHER, {
    v: 1, ids: { n: nId, k: kId, z: zId, g: gId, h: hId },
    knoten: [...knoten.values()].map((n) => [n.id, r(n.x), r(n.z)]),
    kanten: [...kanten.values()].map((k) => [k.id, k.a, k.b, r(k.c.x), r(k.c.z)]),
    zellen: [...zellen.values()].map((z) => [z.id, r(z.x), r(z.z), r(z.rot), z.zone, z.g, z.seite, z.i, z.r]),
    haeuser: [...haeuser.values()].map((h) => [h.id, h.zone, h.stufe, h.w, h.d, h.variante, h.zellen]),
    baeume: baeume.map((b, i) => (b.weg ? i : -1)).filter((i) => i >= 0)
  });
}
function laden() {
  const d = lade(SPEICHER, null); if (!d || d.v !== 1) return false;
  try {
    d.knoten.forEach(([id, x, z]) => neuerKnoten({ x, z }, id));
    d.kanten.forEach(([id, a, b, cx, cz]) => { if (knoten.has(a) && knoten.has(b)) neueKante(a, b, { x: cx, z: cz }, id); });
    d.zellen.forEach(([id, x, z, rot, zone, g, seite, i, r]) => neueZelle({ id, x, z, rot, zone, g, seite, i, r }));
    d.haeuser.forEach(([id, zone, stufe, w, dd, variante, ids]) => { if (ids.every((z) => zellen.has(z) && !zellen.get(z).haus)) neuesHaus({ id, zone, stufe, w, d: dd, variante, zellen: ids }, true); });
    d.baeume.forEach((i) => { const b = baeume[i]; if (b) { b.weg = true; baumSetzen(b); } });
    nId = Math.max(nId, d.ids.n); kId = Math.max(kId, d.ids.k); zId = Math.max(zId, d.ids.z); gId = Math.max(gId, d.ids.g); hId = Math.max(hId, d.ids.h);
    return true;
  } catch (e) { console.warn("Spielstand kaputt", e); return false; }
}

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
  sonne.target.position.copy(steuerung.target); sonne.position.copy(steuerung.target).addScaledVector(_r.normalize(), 110);
  const hu = himmel.material.uniforms; hu.uOben.value.copy(_c.oben); hu.uUnten.value.copy(_c.unten); hu.uSonne.value.copy(sonnenRichtung); hu.uSonnenFarbe.value.copy(_c.sonne); hu.uSicht.value = glatt(-0.08, 0.05, hoehe);
  szene.fog.color.copy(_c.unten);
  const wu = wasserMat.uniforms; wu.uTief.value.copy(_c.tief); wu.uFlach.value.copy(_c.flach); wu.uHimmel.value.copy(_c.unten).lerp(_c.oben, 0.4); wu.uNebel.value.copy(_c.unten);
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
function bodenPunkt(e) {
  const r = renderer.domElement.getBoundingClientRect(); _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  strahl.setFromCamera(_ndc, kamera); return strahl.ray.intersectPlane(boden, _treffer) ? { x: _treffer.x, z: _treffer.z } : null;
}
let tippTimer = 0;
function tipp(t, ms) { const el = $("tipp"); el.textContent = t; el.classList.remove("weg"); clearTimeout(tippTimer); tippTimer = setTimeout(() => el.classList.add("weg"), ms || 4000); }
const TIPPS = {
  ansehen: "👆 Ein Finger: verschieben · ✌️ Zwei Finger: drehen & zoomen",
  strasse: "🛣️ Zieh mit einem Finger eine Straße – Kurven gehen auch. Kreuzungen entstehen von selbst.",
  wohnen: "🏠 Mal die Felder neben den Straßen grün an – dort ziehen Leute ein.",
  laden: "🛍️ Mal Felder blau an – dort entstehen Läden und Büros.",
  industrie: "🏭 Mal Felder gelb an – dort entstehen Werkstätten und Fabriken.",
  abriss: "🧹 Tipp auf eine Straße, um sie abzureißen. Über Häuser und Zonen wischen löscht sie."
};
function werkzeugWaehlen(w) {
  werkzeug = w; document.querySelectorAll("#werkzeug button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.w === w)));
  const bauen = w !== "ansehen";
  steuerung.touches.ONE = bauen ? -1 : THREE.TOUCH.PAN;
  steuerung.mouseButtons.LEFT = bauen ? -1 : THREE.MOUSE.PAN;
  zellenNeu = true; tipp(TIPPS[w], 4500); abbrechen();
}
$("werkzeug").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) werkzeugWaehlen(b.dataset.w); });

/* Vorschau beim Straßenziehen */
const vorschau = new THREE.Mesh(new THREE.BufferGeometry(), M.vorschau); vorschau.renderOrder = 3; vorschau.visible = false; szene.add(vorschau);
const fangRing = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
fangRing.visible = false; fangRing.renderOrder = 4; szene.add(fangRing);
function vorschauZeigen(plan) {
  const pos = [], col = [], c = plan.ok ? farbe(0x7fb8ff) : farbe(0xff5a5a);
  for (const s of plan.stuecke) band(pos, col, s.pts, GEHWEG, G + 0.04, c);
  for (const k of plan.kreuz) scheibe(pos, col, k.x, k.z, 0.5, G + 0.045, farbe(0xffffff));
  vorschau.geometry.dispose(); vorschau.geometry = geoAus(pos, col); vorschau.visible = true;
}

const finger = new Map(); let aktion = null;
function abbrechen() { aktion = null; vorschau.visible = false; fangRing.visible = false; }
renderer.domElement.addEventListener("pointerdown", (e) => {
  finger.set(e.pointerId, e);
  if (finger.size > 1) { abbrechen(); return; }
  if (werkzeug === "ansehen" || (e.pointerType === "mouse" && e.button !== 0)) return;
  const p = bodenPunkt(e); if (!p) return;
  if (werkzeug === "strasse") { const f = fangen(p); aktion = { art: "strasse", start: f, pfad: [{ x: f.x, z: f.z }], id: e.pointerId }; }
  else if (werkzeug === "abriss") { aktion = { art: "abriss", start: p, letzte: p, bewegt: false, id: e.pointerId }; abreissenBei(p, false); }
  else { aktion = { art: "zone", zone: WZ[werkzeug], letzte: p, id: e.pointerId }; malen(p, p, WZ[werkzeug]); }
});
renderer.domElement.addEventListener("pointermove", (e) => {
  if (finger.has(e.pointerId)) finger.set(e.pointerId, e);
  if (!aktion || aktion.id !== e.pointerId) {
    if (werkzeug === "strasse" && !aktion && e.pointerType === "mouse") { const p = bodenPunkt(e); if (p) { const f = fangen(p); fangRing.visible = f.art !== "frei"; fangRing.position.set(f.x, G + 0.05, f.z); } }
    return;
  }
  const p = bodenPunkt(e); if (!p) return;
  if (aktion.art === "strasse") {
    const l = aktion.pfad[aktion.pfad.length - 1]; if (abst(l, p) > 0.3) aktion.pfad.push(p);
    const ende = fangen(p); aktion.ende = ende; fangRing.visible = ende.art !== "frei"; fangRing.position.set(ende.x, G + 0.05, ende.z);
    if (aktion.pfad.length >= 2) { aktion.plan = planen(aktion.pfad.concat([{ x: ende.x, z: ende.z }]), aktion.start, ende); vorschauZeigen(aktion.plan); }
  } else if (aktion.art === "zone") { malen(aktion.letzte, p, aktion.zone); aktion.letzte = p; }
  else if (aktion.art === "abriss") { if (abst(p, aktion.start) > 0.6) aktion.bewegt = true; abreissenStrich(aktion.letzte, p); aktion.letzte = p; }
});
function loslassen(e) {
  finger.delete(e.pointerId);
  if (!aktion || aktion.id !== e.pointerId) return;
  if (aktion.art === "strasse") {
    const plan = aktion.plan;
    if (plan && plan.ok) { bauen(plan, aktion.start, aktion.ende); }
    else if (plan && plan.laenge > 1) tipp(plan.laenge < 1.6 ? "Die Straße ist zu kurz." : "Hier geht keine Straße: zu nah am Wasser oder an einer anderen Straße.", 2600);
  } else if (aktion.art === "abriss" && !aktion.bewegt) abreissenBei(aktion.start, true);
  abbrechen();
}
renderer.domElement.addEventListener("pointerup", loslassen);
renderer.domElement.addEventListener("pointercancel", (e) => { finger.delete(e.pointerId); abbrechen(); });
renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

function malen(a, b, zone) {
  const n = Math.max(1, Math.ceil(abst(a, b) / 0.4)); let geaendert = false;
  for (let i = 0; i <= n; i++) {
    const p = lerp(a, b, i / n);
    for (const z of zellenNahe(p.x, p.z, 0.8)) { if (z.zone === zone) continue; if (z.haus) hausWeg(haeuser.get(z.haus)); z.zone = zone; geaendert = true; }
  }
  if (geaendert) { zellenNeu = true; speichernBald(); }
}
function abreissenStrich(a, b) {
  const n = Math.max(1, Math.ceil(abst(a, b) / 0.4)); let geaendert = false;
  for (let i = 0; i <= n; i++) { const p = lerp(a, b, i / n); for (const z of zellenNahe(p.x, p.z, 0.7)) { if (z.haus) { hausWeg(haeuser.get(z.haus)); geaendert = true; } if (z.zone) { z.zone = 0; geaendert = true; } } }
  if (geaendert) { zellenNeu = true; werteZeigen(); speichernBald(); }
}
function abreissenBei(p, strasseAuch) {
  if (strasseAuch) {
    const e = naechsteKante(p, 0.75);
    if (e) { kanteWeg(e.k); verwaisteZellen(); netzGeaendert(); werteZeigen(); tipp("Straße abgerissen.", 1800); return; }
  }
  abreissenStrich(p, p);
}

/* Menü */
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
  try { localStorage.removeItem(SPEICHER); } catch (x) { /* egal */ } clearTimeout(speicherTimer); speicherTimer = 1e9; location.reload();
};
$("los").onclick = () => { $("start").hidden = true; merke("inselstadt-bau-start", true); werkzeugWaehlen("strasse"); };

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
const geladen = laden();
netzGeaendert(); werteZeigen();
if (!lade("inselstadt-bau-start", false) && !geladen) $("start").hidden = false;
else tipp(geladen ? "Willkommen zurück in deiner Inselstadt!" : TIPPS.ansehen, 4000);
window.inselstadt = { kanten, knoten, zellen, haeuser, planen, bauen, fangen, malen, wachsTakt };   // zum Testen

let letzte = jetztS, takt = 0, fpsZeit = 0, fpsBilder = 0, erstes = true;
const _ziel = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  const t = performance.now() / 1000, dt = Math.min(0.05, t - letzte); letzte = t; jetztS = t;
  U.uTime.value = t % 1000;
  if (zeitModus === "auto") zeit = (zeit + dt / 150) % 1;
  else if (zeitZiel != null) { let d = zeitZiel - zeit; if (d < -0.5) d += 1; if (d > 0.5) d -= 1; zeit = (zeit + Math.sign(d) * Math.min(Math.abs(d), dt * 0.35) + 1) % 1; if (Math.abs(d) < 0.0005) zeitZiel = null; }
  licht(zeit);
  takt += dt; if (takt > 0.45) { takt = 0; wachsTakt(); }
  if (zellenNeu) zellenZeichnen();
  if (haeuserNeu) haeuserZeichnen();
  rauchZeichnen();
  autosFahren(dt);
  boote.forEach((b) => { b.w += b.v * dt; b.g.position.set(Math.cos(b.w) * b.rad, WASSER + 0.02 + Math.sin(t * 1.6 + b.ph) * 0.05, Math.sin(b.w) * b.rad); b.g.rotation.set(Math.sin(t * 1.3 + b.ph) * 0.05, -b.w + (b.v > 0 ? -Math.PI / 2 : Math.PI / 2), 0); });
  leuchtturm.userData.strahl.rotation.y = t * 0.8;
  steuerung.update();
  _ziel.copy(steuerung.target); _ziel.y = 0; const lz = _ziel.length();
  if (lz > 34) { const d = _ziel.clone().multiplyScalar(34 / lz - 1); steuerung.target.add(d); kamera.position.add(d); }
  himmel.position.copy(kamera.position);
  renderer.render(szene, kamera);
  if (erstes) { erstes = false; $("laden").classList.add("weg"); }
  fpsBilder++; fpsZeit += dt; if (fpsZeit >= 0.5) { $("fps").textContent = Math.round(fpsBilder / fpsZeit) + " FPS"; fpsBilder = 0; fpsZeit = 0; }
});
