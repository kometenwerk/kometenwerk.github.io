/* Inselstadt – Aussehen-Test (FLARESSA Gaming)
   Low-Poly-Inselstadt in 3D: Häuser wachsen, Autos fahren, Tag und Nacht.
   Noch keine Spielregeln – hier geht es nur um Look und Geschwindigkeit auf dem Handy. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { mergeGeometries } from "three/addons/BufferGeometryUtils.js";

const $ = (id) => document.getElementById(id);
const lade = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const merke = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* egal */ } };

/* ---------- Grundwerte ---------- */
const SP = 5;              // Abstand der Straßen (Felder)
const N = 7;               // Kreuzungen von -N bis N
const G = 0.12;            // Höhe der Wiese
const STR = G + 0.015;     // Oberkante Straße
const BODEN = G + 0.075;   // Unterkante der Häuser
const WASSER = -0.3;
const STUFEN = {
  niedrig: { name: "Niedrig", pr: 1, schatten: 0, autos: 28 },
  mittel: { name: "Mittel", pr: 1.5, schatten: 1024, autos: 56 },
  hoch: { name: "Hoch", pr: 2, schatten: 2048, autos: 90 }
};
let stufe = lade("inselstadt-qualitaet", null) || (Math.min(screen.width, screen.height) < 500 ? "mittel" : "hoch");
if (!STUFEN[stufe]) stufe = "mittel";

function zufall(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const farbe = (h) => new THREE.Color(h);
const glatt = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ---------- Renderer, Szene, Kamera ---------- */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
} catch (e) { $("fehler").style.display = "grid"; $("laden").classList.add("weg"); throw e; }
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const szene = new THREE.Scene();
szene.fog = new THREE.Fog(0xbfe6ff, 70, 300);
const kamera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.5, 1200);
const hochkant = () => innerHeight > innerWidth;
const startAbstand = () => 80 * Math.max(1, 0.8 / (innerWidth / innerHeight));
kamera.position.set(1, 0.95, 1).normalize().multiplyScalar(startAbstand());

const steuerung = new OrbitControls(kamera, renderer.domElement);
steuerung.enableDamping = true; steuerung.dampingFactor = 0.08;
steuerung.screenSpacePanning = false;
steuerung.minDistance = 12; steuerung.maxDistance = 160;
steuerung.minPolarAngle = 0.32; steuerung.maxPolarAngle = 1.22;
steuerung.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
steuerung.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
steuerung.autoRotate = true; steuerung.autoRotateSpeed = 0.45;
steuerung.addEventListener("start", () => { steuerung.autoRotate = false; tippWeg(4000); });

/* Licht */
const himmelLicht = new THREE.HemisphereLight(0xcfe9ff, 0x6b8f5a, 1.0);
szene.add(himmelLicht);
const sonne = new THREE.DirectionalLight(0xfff4e0, 2.6);
sonne.shadow.camera.left = -46; sonne.shadow.camera.right = 46; sonne.shadow.camera.top = 46; sonne.shadow.camera.bottom = -46;
sonne.shadow.camera.near = 10; sonne.shadow.camera.far = 220; sonne.shadow.bias = -0.0006; sonne.shadow.normalBias = 0.03;
szene.add(sonne, sonne.target);

/* gemeinsame Uniforms für alle Shader */
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
        float hk = abs(vWN.x) > 0.5 ? vWP.z : vWP.x;
        vec2 zelle = vec2(hk / 0.3, (vWP.y - ${BODEN.toFixed(3)} - 0.08) / 0.32);
        vec2 f = fract(zelle);
        float fenster = step(0.2, f.x) * step(f.x, 0.8) * step(0.22, f.y) * step(f.y, 0.78) * step(0.0, zelle.y) * seite;
        float h = fract(sin(dot(floor(zelle) + floor(vWP.xz * 0.37) * 3.1, vec2(12.9898, 78.233))) * 43758.5453);
        float an = step(0.6, h) * uNacht;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.22, 0.3), fenster * 0.7 * (1.0 - an));
        totalEmissiveRadiance += fenster * an * mix(vec3(1.0, 0.66, 0.32), vec3(0.75, 0.85, 1.0), step(0.93, h)) * (0.75 + 0.35 * fract(h * 7.0));
      }`);
  };
  mat.customProgramCacheKey = () => "fenster";
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
  flach: new THREE.MeshStandardMaterial({ roughness: 0.95 }),
  haus: mitFenstern(new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.02 })),
  dach: new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }),
  baum: mitWind(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 })),
  auto: new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.25 }),
  licht: new THREE.MeshBasicMaterial({ toneMapped: false }),
  teich: new THREE.MeshStandardMaterial({ color: 0x3fb6d6, roughness: 0.15, metalness: 0.1 })
};

/* ---------- Geometrien ---------- */
const G_BOX = new THREE.BoxGeometry(1, 1, 1);
const G_BOX_UNTEN = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const G_DACH = (function () {
  const p = [-.5, 0, .5, .5, 0, .5, .5, 1, 0, -.5, 0, .5, .5, 1, 0, -.5, 1, 0,
    .5, 0, -.5, -.5, 0, -.5, -.5, 1, 0, .5, 0, -.5, -.5, 1, 0, .5, 1, 0,
    -.5, 0, -.5, -.5, 0, .5, -.5, 1, 0, .5, 0, .5, .5, 0, -.5, .5, 1, 0];
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return g;
})();
function bunt(g, hex) { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute("uv"); const c = farbe(hex), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } g.setAttribute("color", new THREE.BufferAttribute(a, 3)); return g; }
const G_LAUBBAUM = mergeGeometries([
  bunt(new THREE.CylinderGeometry(0.05, 0.07, 0.4, 5).translate(0, 0.2, 0), 0x7a5232),
  bunt(new THREE.IcosahedronGeometry(0.34, 0).scale(1, 1.1, 1).translate(0, 0.62, 0), 0x5fae4a)
]);
const G_NADELBAUM = mergeGeometries([
  bunt(new THREE.CylinderGeometry(0.045, 0.06, 0.3, 5).translate(0, 0.15, 0), 0x6e4a2c),
  bunt(new THREE.ConeGeometry(0.3, 0.7, 6).translate(0, 0.6, 0), 0x3f8a4e),
  bunt(new THREE.ConeGeometry(0.21, 0.5, 6).translate(0, 0.95, 0), 0x47995a)
]);

/* ---------- Leuchtpunkte (Laternen) ---------- */
const glanzTextur = (function () {
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,230,180,1)"); g.addColorStop(0.25, "rgba(255,200,120,.55)"); g.addColorStop(1, "rgba(255,180,90,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

/* ---------- Wasser ---------- */
const wasserMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: U.uTime, uNacht: U.uNacht,
    uTief: { value: farbe(0x1667a3) }, uFlach: { value: farbe(0x3cc9c4) }, uHimmel: { value: farbe(0xbfe6ff) },
    uSonne: { value: new THREE.Vector3(0, 1, 0) }, uSonnenFarbe: { value: farbe(0xffffff) },
    uNebel: { value: farbe(0xbfe6ff) }, uNah: { value: 70 }, uFern: { value: 300 },
    uA0: { value: 30 }, uAmp: { value: new THREE.Vector3() }, uPh: { value: new THREE.Vector3() }
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
      float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
      c = mix(c, uHimmel, fres * 0.65);
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
wasser.position.y = WASSER; wasser.receiveShadow = false;
szene.add(wasser);



/* ---------- Die Stadt ---------- */
let welt = null, insel = null, teile = [], wachsStart = 0, wachsFertig = false, autos = null, boote = [], leuchtturm = null, laternen = null;
const radius = (I, th) => I.a0 + I.amp[0] * Math.sin(3 * th + I.ph[0]) + I.amp[1] * Math.sin(5 * th + I.ph[1]) + I.amp[2] * Math.sin(7 * th + I.ph[2]);
const innen = (x, z, rand) => Math.hypot(x, z) < radius(insel, Math.atan2(z, x)) - rand;

function form(I, versatz) {
  const s = new THREE.Shape(), n = 180;
  for (let i = 0; i < n; i++) { const th = i / n * Math.PI * 2, r = radius(I, th) + versatz; const x = Math.cos(th) * r, y = -Math.sin(th) * r; if (i) s.lineTo(x, y); else s.moveTo(x, y); }
  s.closePath(); return s;
}
function platte(I, versatz, tiefe, schraege, oben, mat) {
  const g = new THREE.ExtrudeGeometry(form(I, versatz), { depth: tiefe, bevelEnabled: true, bevelThickness: schraege[0], bevelSize: schraege[1], bevelSegments: schraege[2], curveSegments: 1 });
  g.translate(0, 0, -(tiefe + schraege[0])); g.rotateX(-Math.PI / 2); g.translate(0, oben, 0);
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
}

/* Sammler für instanzierte Kisten */
function sammler(geo, mat, schatten) { return { geo, mat, schatten, liste: [] }; }
function instanzen(s) {
  if (!s.liste.length) return null;
  const m = new THREE.InstancedMesh(s.geo, s.mat, s.liste.length), o = new THREE.Object3D();
  s.liste.forEach((e, i) => {
    o.position.set(e.x, e.y, e.z); o.rotation.set(0, e.ry || 0, 0); o.scale.set(e.sx, e.sy, e.sz); o.updateMatrix(); m.setMatrixAt(i, o.matrix);
    if (e.c != null) m.setColorAt(i, e.c instanceof THREE.Color ? e.c : farbe(e.c));
    e.mesh = m; e.idx = i;
  });
  m.castShadow = !!s.schatten; m.receiveShadow = true; m.frustumCulled = false;
  return m;
}

const PALETTE = {
  haus: [0xf3e9d8, 0xf6d7b0, 0xe9b8a0, 0xd9e4ec, 0xf2f0e9, 0xf5e1a4, 0xcfe3c8, 0xe7cfe6],
  dach: [0xb2513a, 0x8f3f30, 0x5d6470, 0x7a4b3a, 0x3f5566, 0xa8673f],
  mittel: [0xe8dcc8, 0xd8c3a5, 0xc9a083, 0xf0ebe1, 0xb9c7cf, 0xe3c9a8, 0xd0d6c4],
  turm: [0x9fb7c9, 0x7fa3b8, 0xc9d6df, 0x6d8aa1, 0xb8c4cc, 0x8fb0a8, 0xa3a9c9],
  auto: [0xe8493f, 0x3f7fe8, 0xf2f2f2, 0x2c2f36, 0xf2c14e, 0x4fbf7a, 0x9a5be8, 0xff8a3c]
};
const wahl = (r, a) => a[Math.floor(r() * a.length)];

function bauen(seed) {
  if (welt) { welt.traverse((o) => { if (o.isInstancedMesh) o.dispose(); if (o.geometry && o.geometry.userData.eigen) o.geometry.dispose(); }); szene.remove(welt); }
  welt = new THREE.Group(); szene.add(welt); teile = []; boote = [];
  const r = zufall(seed);
  insel = { a0: 30.5, amp: [2.4 + r() * 1.4, 1.2 + r() * 1.0, 0.6 + r() * 0.6], ph: [r() * 6.283, r() * 6.283, r() * 6.283] };
  wasserMat.uniforms.uA0.value = insel.a0; wasserMat.uniforms.uAmp.value.set(...insel.amp); wasserMat.uniforms.uPh.value.set(...insel.ph);

  /* Boden */
  const sand = platte(insel, 0, 2, [0.7, 1.8, 3], 0, M.sand); sand.geometry.userData.eigen = true;
  const wiese = platte(insel, -2.4, 0.05, [0.07, 0.4, 2], G, M.wiese); wiese.geometry.userData.eigen = true;
  welt.add(sand, wiese);

  /* Straßennetz */
  const knoten = {}, k = (i, j) => i + "," + j;
  for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) if (innen(i * SP, j * SP, 6.2)) knoten[k(i, j)] = [i, j];
  const da = (i, j) => !!knoten[k(i, j)];
  const strasse = sammler(G_BOX, M.flach), striche = sammler(G_BOX, M.flach), gehweg = sammler(G_BOX, M.flach), flaeche = sammler(G_BOX, M.flach);
  const nachbarn = {};
  Object.values(knoten).forEach(([i, j]) => {
    nachbarn[k(i, j)] = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => da(i + a, j + b)).map(([a, b]) => [i + a, j + b]);
    if (da(i + 1, j)) {
      strasse.liste.push({ x: (i + 0.5) * SP, y: STR - 0.01, z: j * SP, sx: SP + 1, sy: 0.02, sz: 1, c: 0x3b4049 });
      for (let s = 0; s < 3; s++) striche.liste.push({ x: i * SP + 1.25 + s * 1.25, y: STR + 0.001, z: j * SP, sx: 0.55, sy: 0.004, sz: 0.06, c: 0xf1eee4 });
    }
    if (da(i, j + 1)) {
      strasse.liste.push({ x: i * SP, y: STR - 0.01, z: (j + 0.5) * SP, sx: 1, sy: 0.02, sz: SP + 1, c: 0x3b4049 });
      for (let s = 0; s < 3; s++) striche.liste.push({ x: i * SP, y: STR + 0.001, z: j * SP + 1.25 + s * 1.25, sx: 0.06, sy: 0.004, sz: 0.55, c: 0xf1eee4 });
    }
  });

  /* Grundstücke */
  const haeuser = sammler(G_BOX_UNTEN, M.haus, true), daecher = sammler(G_DACH, M.dach, true), kleinteile = sammler(G_BOX_UNTEN, M.flach, true);
  const laub = sammler(G_LAUBBAUM, M.baum, true), nadel = sammler(G_NADELBAUM, M.baum, true), teiche = sammler(new THREE.CylinderGeometry(1, 1, 1, 18), M.teich);
  const RMAX = insel.a0;
  const verz = (x, z) => 0.35 + Math.hypot(x, z) * 0.055 + r() * 0.45;
  function teil(s, e) { e.y = e.y == null ? BODEN : e.y; e.e = 0; s.liste.push(e); teile.push(e); return e; }
  function baum(x, z, gr, y) { const e = { x, z, y: y == null ? BODEN : y, sx: gr, sy: gr, sz: gr, ry: r() * 6.28, c: new THREE.Color(0.82 + r() * 0.18, 0.85 + r() * 0.15, 0.8 + r() * 0.2), d: verz(x, z) + 0.3, rund: true }; teil(r() < 0.3 ? nadel : laub, e); }

  let mitte = null, mitteD = 1e9;
  Object.values(knoten).forEach(([i, j]) => { if (!(da(i + 1, j) && da(i, j + 1) && da(i + 1, j + 1))) return; const cx = (i + 0.5) * SP, cz = (j + 0.5) * SP, d = Math.hypot(cx, cz); if (d < mitteD) { mitteD = d; mitte = [cx, cz]; } });

  Object.values(knoten).forEach(([i, j]) => {
    if (!(da(i + 1, j) && da(i, j + 1) && da(i + 1, j + 1))) return;
    const cx = (i + 0.5) * SP, cz = (j + 0.5) * SP, abst = Math.hypot(cx, cz) / RMAX;
    gehweg.liste.push({ x: cx, y: G + 0.03, z: cz, sx: 4, sy: 0.06, sz: 4, c: 0xcfc9bb });
    const p = 1 - abst + (r() - 0.5) * 0.28;
    const istMitte = mitte && cx === mitte[0] && cz === mitte[1];
    let art = istMitte ? "platz" : r() < 0.09 ? "park" : p > 0.66 ? "turm" : p > 0.42 ? "mittel" : "haeuser";
    const innenFarbe = art === "haeuser" || art === "park" ? 0x8fcf68 : 0xd9d2c3;
    flaeche.liste.push({ x: cx, y: G + 0.0675, z: cz, sx: 3.5, sy: 0.015, sz: 3.5, c: innenFarbe });

    if (art === "platz") {
      teil(kleinteile, { x: cx, z: cz, sx: 1.4, sy: 0.18, sz: 1.4, c: 0xbfb6a6, d: 0.2 });
      teil(teiche, { x: cx, z: cz, y: BODEN + 0.1, sx: 0.6, sy: 0.1, sz: 0.6, d: 0.3 });
      teil(kleinteile, { x: cx, z: cz, sx: 0.12, sy: 0.55, sz: 0.12, c: 0xe9e4da, d: 0.35 });
      [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]].forEach(([a, b]) => baum(cx + a, cz + b, 1.1));
    } else if (art === "park") {
      if (r() < 0.5) teil(teiche, { x: cx + (r() - 0.5), z: cz + (r() - 0.5), y: BODEN - 0.005, sx: 0.9 + r() * 0.3, sy: 0.02, sz: 0.7 + r() * 0.3, d: 0.3 });
      const n = 6 + Math.floor(r() * 5);
      for (let t = 0; t < n; t++) baum(cx + (r() - 0.5) * 3, cz + (r() - 0.5) * 3, 0.8 + r() * 0.6);
    } else if (art === "turm") {
      const zwei = r() < 0.45;
      const plaetze = zwei ? [[-0.85, 0, 1.45, 3.1], [0.85, 0, 1.45, 3.1]] : [[0, 0, 2.3 + r() * 0.6, 2.3 + r() * 0.6]];
      plaetze.forEach(([ox, oz, w, d]) => {
        if (zwei && r() < 0.5) { const t = w; w = d; d = t; [ox, oz] = [oz, ox]; }
        const h = 3.2 + (1 - abst) * 7 * (0.55 + r() * 0.6), c = wahl(r, PALETTE.turm), dl = verz(cx, cz);
        const basis = teil(haeuser, { x: cx + ox, z: cz + oz, sx: w, sy: h, sz: d, c, d: dl });
        if (r() < 0.7) teil(haeuser, { x: cx + ox, z: cz + oz, sx: w * 0.72, sy: 0.5 + r() * 0.9, sz: d * 0.72, c, d: dl + 0.55, auf: basis });
        if (r() < 0.6) teil(kleinteile, { x: cx + ox + (r() - 0.5) * w * 0.4, z: cz + oz + (r() - 0.5) * d * 0.4, sx: 0.3, sy: 0.18, sz: 0.3, c: 0x9aa0a8, d: dl + 0.9, auf: basis });
      });
    } else if (art === "mittel") {
      const vier = r() < 0.55, plaetze = vier ? [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]] : [[-0.85, 0], [0.85, 0]];
      const quer = r() < 0.5;
      plaetze.forEach(([ox, oz]) => {
        if (quer && !vier) [ox, oz] = [oz, ox];
        const w = vier ? 1.45 : (quer ? 3.1 : 1.45), d = vier ? 1.45 : (quer ? 1.45 : 3.1);
        const h = 0.75 + r() * (1.3 + (1 - abst) * 1.6), dl = verz(cx, cz);
        const b = teil(haeuser, { x: cx + ox, z: cz + oz, sx: w * (0.88 + r() * 0.1), sy: h, sz: d * (0.88 + r() * 0.1), c: wahl(r, PALETTE.mittel), d: dl });
        if (r() < 0.5) teil(kleinteile, { x: cx + ox + (r() - 0.5) * 0.5, z: cz + oz + (r() - 0.5) * 0.5, sx: 0.28, sy: 0.14, sz: 0.36, c: 0xa7abb1, d: dl + 0.7, auf: b });
      });
      if (!vier && r() < 0.5) baum(cx + (quer ? 1.5 : 0), cz + (quer ? 0 : 1.5), 0.8);
    } else {
      [[-0.88, -0.88], [0.88, -0.88], [-0.88, 0.88], [0.88, 0.88]].forEach(([ox, oz]) => {
        if (r() < 0.08) { baum(cx + ox, cz + oz, 0.9 + r() * 0.4); return; }
        const w = 0.78 + r() * 0.32, d = 0.78 + r() * 0.32, h = 0.5 + r() * 0.3, dl = verz(cx, cz);
        const x = cx + ox + (r() - 0.5) * 0.18, z = cz + oz + (r() - 0.5) * 0.18, dreh = r() < 0.5;
        const b = teil(haeuser, { x, z, sx: w, sy: h, sz: d, c: wahl(r, PALETTE.haus), d: dl });
        teil(daecher, { x, z, sx: (dreh ? d : w) + 0.12, sy: 0.32 + r() * 0.18, sz: (dreh ? w : d) + 0.12, ry: dreh ? Math.PI / 2 : 0, c: wahl(r, PALETTE.dach), d: dl + 0.45, auf: b });
        if (r() < 0.35) teil(kleinteile, { x: x + w * 0.25, z: z + d * 0.2, sx: 0.1, sy: 0.32, sz: 0.1, c: 0x8a6a5a, d: dl + 0.75, auf: b, ueber: 0.1 });
        if (r() < 0.55) baum(cx + ox + Math.sign(ox) * 0.62, cz + oz - Math.sign(oz) * 0.55, 0.55 + r() * 0.3);
      });
    }
  });

  /* Bäume zwischen Stadt und Strand */
  for (let t = 0; t < 700; t++) {
    const th = r() * Math.PI * 2, R = radius(insel, th), rr = R - 2.9 - r() * (R * 0.25);
    const x = Math.cos(th) * rr, z = Math.sin(th) * rr;
    // nicht auf Straßen oder Grundstücke
    const i = Math.round(x / SP), j = Math.round(z / SP);
    const naheStrasse = (Math.abs(x - i * SP) < 0.9 && (da(i, Math.floor(z / SP)) || da(i, Math.ceil(z / SP)))) || (Math.abs(z - j * SP) < 0.9 && (da(Math.floor(x / SP), j) || da(Math.ceil(x / SP), j)));
    const fi = Math.floor(x / SP), fj = Math.floor(z / SP), aufLos = da(fi, fj) && da(fi + 1, fj) && da(fi, fj + 1) && da(fi + 1, fj + 1);
    if (naheStrasse || aufLos || rr > R - 2.8) continue;
    baum(x, z, 0.75 + r() * 0.7, G);
  }

  /* Laternen an den Kreuzungen */
  const masten = sammler(G_BOX_UNTEN, M.flach, true), lp = [];
  Object.values(knoten).forEach(([i, j]) => { const x = i * SP + 0.66, z = j * SP + 0.66; masten.liste.push({ x, y: G + 0.06, z, sx: 0.05, sy: 0.85, sz: 0.05, c: 0x50555e }); lp.push(x, G + 0.95, z); });
  const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(lp, 3)); lg.userData.eigen = true;
  laternen = new THREE.Points(lg, new THREE.PointsMaterial({ map: glanzTextur, size: 2.2, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, color: 0xffd9a0 }));
  laternen.frustumCulled = false;

  [strasse, striche, gehweg, flaeche, haeuser, daecher, kleinteile, laub, nadel, teiche, masten].forEach((s) => { const m = instanzen(s); if (m) welt.add(m); });
  welt.add(laternen);

  /* Häuser erst mal unsichtbar – sie wachsen gleich */
  teile.forEach((e) => setzen(e, 0));
  wachsStart = performance.now() / 1000; wachsFertig = false;

  /* Leuchtturm */
  let bestTh = 0, best = 0; for (let t = 0; t < 64; t++) { const th = t / 64 * Math.PI * 2, R = radius(insel, th); if (R > best) { best = R; bestTh = th; } }
  leuchtturm = new THREE.Group();
  const lr = best - 0.6; leuchtturm.position.set(Math.cos(bestTh) * lr, 0, Math.sin(bestTh) * lr);
  const weiss = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.7 }), rot = new THREE.MeshStandardMaterial({ color: 0xd2433a, roughness: 0.7 });
  const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.55, 3.2, 12), weiss); t1.position.y = 1.6;
  const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.5, 0.45, 12), rot); b1.position.y = 1.0;
  const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.43, 0.45, 12), rot); b2.position.y = 2.4;
  const kopf = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.45, 10), new THREE.MeshBasicMaterial({ color: 0xfff1c2, toneMapped: false })); kopf.position.y = 3.45;
  const hut = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.5, 10), rot); hut.position.y = 3.92;
  [t1, b1, b2, hut].forEach((m) => { m.castShadow = true; m.geometry.userData.eigen = true; });
  const strahl = new THREE.Group(); strahl.position.y = 3.45;
  const sg = new THREE.ConeGeometry(1.6, 22, 20, 1, true).translate(0, -11, 0).rotateZ(Math.PI / 2); sg.userData.eigen = true;
  const sm = new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  strahl.add(new THREE.Mesh(sg, sm)); const s2 = new THREE.Mesh(sg, sm); s2.rotation.y = Math.PI; strahl.add(s2);
  leuchtturm.add(t1, b1, b2, kopf, hut, strahl); leuchtturm.userData = { strahl, sm, kopf };
  welt.add(leuchtturm);

  /* Boote */
  for (let b = 0; b < 4; b++) {
    const g = new THREE.Group(), farbeR = wahl(r, [0xffffff, 0xf2c14e, 0xe8493f, 0x3f7fe8]);
    const rumpf = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 0.5), new THREE.MeshStandardMaterial({ color: farbeR, roughness: 0.5 })); rumpf.position.y = 0.1;
    const kab = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.38), new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.5 })); kab.position.set(-0.1, 0.38, 0);
    rumpf.castShadow = kab.castShadow = true; g.add(rumpf, kab); welt.add(g);
    boote.push({ g, rad: radius(insel, 0) + 8 + r() * 10, w: r() * 6.28, v: (0.025 + r() * 0.03) * (r() < 0.5 ? 1 : -1), ph: r() * 6 });
  }

  /* Autos */
  autosBauen(knoten, nachbarn, r);
}

/* Teil (Haus, Dach, Baum …) mit Wachs-Fortschritt e setzen */
const _o = new THREE.Object3D();
function setzen(e, f) {
  e.e = f;
  let y = e.y;
  if (e.auf) y = e.auf.y + e.auf.sy * e.auf.e - (e.ueber ? 0 : 0) + (e.ueber || 0);
  _o.position.set(e.x, y, e.z); _o.rotation.set(0, e.ry || 0, 0);
  if (e.rund) _o.scale.set(e.sx * f, e.sy * f, e.sz * f); else _o.scale.set(e.sx, Math.max(e.sy * f, 0.0001), e.sz);
  _o.updateMatrix(); e.mesh.setMatrixAt(e.idx, _o.matrix); e.mesh.instanceMatrix.needsUpdate = true;
}
const federn = (t) => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
function wachsen(jetzt) {
  if (wachsFertig) return;
  const t = jetzt - wachsStart; let offen = false;
  for (const e of teile) {
    const p = Math.min(1, Math.max(0, (t - e.d) / 0.6));
    if (p < 1) offen = true;
    const f = p <= 0 ? 0 : p >= 1 ? 1 : (e.rund ? federn(p) : 1 - Math.pow(1 - p, 3));
    if (f !== e.e || e.auf) setzen(e, f);
  }
  if (!offen) wachsFertig = true;
}

/* ---------- Autos ---------- */
function autosBauen(knoten, nachbarn, r) {
  const liste = Object.values(knoten).filter(([i, j]) => nachbarn[i + "," + j].length);
  const n = liste.length ? STUFEN[stufe].autos : 0;
  const koerper = new THREE.InstancedMesh(G_BOX, M.auto, Math.max(n, 1)), kabine = new THREE.InstancedMesh(G_BOX, M.auto, Math.max(n, 1)), lichter = new THREE.InstancedMesh(G_BOX, M.licht, Math.max(n * 2, 1));
  [koerper, kabine].forEach((m) => { m.castShadow = true; m.frustumCulled = false; }); lichter.frustumCulled = false;
  const daten = [];
  for (let a = 0; a < n; a++) {
    const s = wahl(r, liste), nb = nachbarn[s[0] + "," + s[1]];
    daten.push({ a: s, b: wahl(r, nb), t: r(), v: 1.6 + r() * 1.2 });
    koerper.setColorAt(a, farbe(wahl(r, PALETTE.auto))); kabine.setColorAt(a, farbe(0x26303d));
    lichter.setColorAt(a * 2, farbe(0xfff3c8)); lichter.setColorAt(a * 2 + 1, farbe(0xff3b30));
  }
  if (autos) { autos.koerper.dispose(); autos.kabine.dispose(); autos.lichter.dispose(); welt.remove(autos.koerper, autos.kabine, autos.lichter); }
  autos = { koerper, kabine, lichter, daten, nachbarn, n, r, knoten };
  welt.add(koerper, kabine, lichter);
}
const _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
function autosFahren(dt) {
  if (!autos || !autos.n) return;
  const { koerper, kabine, lichter, daten, nachbarn, r } = autos;
  daten.forEach((c, i) => {
    c.t += dt * c.v / SP;
    while (c.t >= 1) {
      c.t -= 1; const nb = nachbarn[c.b[0] + "," + c.b[1]];
      const weiter = nb.filter((p) => p[0] !== c.a[0] || p[1] !== c.a[1]);
      const neu = weiter.length ? wahl(r, weiter) : c.a; c.a = c.b; c.b = neu;
    }
    const dx = c.b[0] - c.a[0], dz = c.b[1] - c.a[1];
    const x = (c.a[0] + dx * c.t) * SP - dz * 0.24, z = (c.a[1] + dz * c.t) * SP + dx * 0.24;
    _q.setFromAxisAngle(_y, Math.atan2(-dz, dx));
    _m.compose(_v.set(x, STR, z), _q, _s.set(1, 1, 1));
    _l.compose(_v.set(0, 0.1, 0), _q.identity(), _s.set(0.48, 0.13, 0.24)); koerper.setMatrixAt(i, _l.premultiply(_m));
    _l.compose(_v.set(-0.04, 0.2, 0), _q.identity(), _s.set(0.26, 0.1, 0.2)); kabine.setMatrixAt(i, _l.premultiply(_m));
    _l.compose(_v.set(0.242, 0.11, 0), _q.identity(), _s.set(0.02, 0.04, 0.2)); lichter.setMatrixAt(i * 2, _l.premultiply(_m));
    _l.compose(_v.set(-0.242, 0.11, 0), _q.identity(), _s.set(0.02, 0.04, 0.2)); lichter.setMatrixAt(i * 2 + 1, _l.premultiply(_m));
  });
  koerper.instanceMatrix.needsUpdate = kabine.instanceMatrix.needsUpdate = lichter.instanceMatrix.needsUpdate = true;
}

/* ---------- Tag und Nacht ---------- */
const ZEITEN = { tag: 0.42, abend: 0.735, nacht: 0.9 };
let zeitModus = lade("inselstadt-zeit", "auto"), zeit = ZEITEN.abend - 0.06, zeitZiel = null;
if (zeitModus !== "auto" && ZEITEN[zeitModus] != null) zeit = ZEITEN[zeitModus];
const F = {
  tag: { oben: farbe(0x3d97ec), unten: farbe(0xc4e7ff), sonne: farbe(0xfff1dc), hs: farbe(0xd4ecff), hb: farbe(0x6f8f5c), tief: farbe(0x1667a3), flach: farbe(0x3cc9c4) },
  abend: { oben: farbe(0x34509a), unten: farbe(0xffa86b), sonne: farbe(0xff9c55), hs: farbe(0xffc8a0), hb: farbe(0x5a4a5a), tief: farbe(0x1d4f86), flach: farbe(0x3f8fa6) },
  nacht: { oben: farbe(0x040916), unten: farbe(0x13213f), sonne: farbe(0x8fa8ff), hs: farbe(0x2c3c68), hb: farbe(0x0c121e), tief: farbe(0x061a33), flach: farbe(0x0c3346) }
};
const _c = {}; ["oben", "unten", "sonne", "hs", "hb", "tief", "flach"].forEach((k) => { _c[k] = new THREE.Color(); });
const sonnenRichtung = new THREE.Vector3();
function licht(z) {
  const w = (z - 0.25) * Math.PI * 2, hoehe = Math.sin(w);
  sonnenRichtung.set(Math.cos(w) * 0.85, hoehe, 0.5).normalize();
  const abend = 1 - glatt(0.04, 0.42, hoehe), nacht = glatt(0.1, -0.12, hoehe);
  for (const k in _c) { _c[k].copy(F.tag[k]).lerp(F.abend[k], abend).lerp(F.nacht[k], nacht); }
  U.uNacht.value = nacht;
  const mond = hoehe < -0.02, richtung = mond ? sonnenRichtung.clone().negate() : sonnenRichtung;
  if (mond) richtung.y = Math.max(richtung.y, 0.35);
  sonne.color.copy(_c.sonne);
  sonne.intensity = mond ? 0.42 * glatt(-0.02, -0.2, hoehe) : 2.7 * glatt(-0.02, 0.18, hoehe) * (1 - abend * 0.35);
  himmelLicht.color.copy(_c.hs); himmelLicht.groundColor.copy(_c.hb); himmelLicht.intensity = 1.05 - nacht * 0.62;
  sonne.target.position.copy(steuerung.target); sonne.position.copy(steuerung.target).addScaledVector(richtung.clone().normalize(), 110);
  const hu = himmel.material.uniforms; hu.uOben.value.copy(_c.oben); hu.uUnten.value.copy(_c.unten); hu.uSonne.value.copy(sonnenRichtung); hu.uSonnenFarbe.value.copy(_c.sonne); hu.uSicht.value = glatt(-0.08, 0.05, hoehe);
  szene.fog.color.copy(_c.unten);
  const wu = wasserMat.uniforms; wu.uTief.value.copy(_c.tief); wu.uFlach.value.copy(_c.flach); wu.uHimmel.value.copy(_c.unten).lerp(_c.oben, 0.4); wu.uNebel.value.copy(_c.unten);
  wu.uSonne.value.copy(mond ? richtung : sonnenRichtung); wu.uSonnenFarbe.value.copy(_c.sonne).multiplyScalar(mond ? 0.35 : glatt(-0.02, 0.1, hoehe));
  renderer.toneMappingExposure = 1.0 + nacht * 0.25;
  if (laternen) laternen.material.opacity = glatt(0.15, 0.7, nacht);
  M.licht.color.setScalar(0.25 + 0.75 * nacht);
  if (leuchtturm) { const d = leuchtturm.userData; d.sm.opacity = 0.16 * glatt(0.2, 0.8, nacht); d.kopf.material.color.setScalar(0.6 + 0.6 * nacht); }
}

/* ---------- Qualität ---------- */
function qualitaet(neu, ansage) {
  stufe = neu; merke("inselstadt-qualitaet", stufe);
  const q = STUFEN[stufe];
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.pr));
  const vorher = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = q.schatten > 0; sonne.castShadow = q.schatten > 0;
  if (q.schatten) { sonne.shadow.mapSize.set(q.schatten, q.schatten); if (sonne.shadow.map) { sonne.shadow.map.dispose(); sonne.shadow.map = null; } }
  if (vorher !== renderer.shadowMap.enabled) szene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
  $("qualitaet").textContent = "⚙️ " + q.name;
  if (autos && autos.knoten) autosBauen(autos.knoten, autos.nachbarn, zufall(Date.now() & 0xffff));
  if (ansage) tipp(ansage);
}

/* ---------- Bedienung ---------- */
let tippTimer = 0;
function tipp(t, ms) { const el = $("tipp"); el.textContent = t; el.classList.remove("weg"); clearTimeout(tippTimer); tippTimer = setTimeout(() => el.classList.add("weg"), ms || 3500); }
function tippWeg(ms) { clearTimeout(tippTimer); tippTimer = setTimeout(() => $("tipp").classList.add("weg"), ms); }
function zeitKnoepfe() { document.querySelectorAll("[data-zeit]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.zeit === zeitModus))); }
$("leiste").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.zeit) { zeitModus = b.dataset.zeit; merke("inselstadt-zeit", zeitModus); zeitZiel = zeitModus === "auto" ? null : ZEITEN[zeitModus]; zeitKnoepfe(); }
  else if (b.id === "qualitaet") { const s = ["niedrig", "mittel", "hoch"]; qualitaet(s[(s.indexOf(stufe) + 1) % 3], "Grafik: " + STUFEN[s[(s.indexOf(stufe) + 1) % 3]].name); }
  else if (b.id === "neu") { bauen((Math.random() * 1e9) | 0); tipp("🏗️ Eine neue Inselstadt entsteht …", 2500); }
});
zeitKnoepfe();
renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("resize", () => { kamera.aspect = innerWidth / innerHeight; kamera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
if (!matchMedia("(pointer: coarse)").matches) $("tipp").textContent = "🖱️ Ziehen: verschieben · Rechte Maustaste: drehen · Mausrad: zoomen";

/* ---------- Los ---------- */
qualitaet(stufe);
bauen(20261027);
let letzte = performance.now() / 1000, fpsZeit = 0, fpsBilder = 0, ersteSekunden = [], erstesBild = true, geprueft = false;
const _ziel = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  const jetzt = performance.now() / 1000, dt = Math.min(0.05, jetzt - letzte); letzte = jetzt;
  U.uTime.value = jetzt % 1000;
  // Zeit
  if (zeitModus === "auto") zeit = (zeit + dt / 120) % 1;
  else if (zeitZiel != null) { let d = zeitZiel - zeit; if (d < -0.5) d += 1; if (d > 0.5) d -= 1; zeit = (zeit + Math.sign(d) * Math.min(Math.abs(d), dt * 0.35) + 1) % 1; if (Math.abs(d) < 0.0005) zeitZiel = null; }
  licht(zeit);
  wachsen(jetzt);
  autosFahren(dt);
  boote.forEach((b) => { b.w += b.v * dt; const x = Math.cos(b.w) * b.rad, z = Math.sin(b.w) * b.rad; b.g.position.set(x, WASSER + 0.02 + Math.sin(jetzt * 1.6 + b.ph) * 0.05, z); b.g.rotation.set(Math.sin(jetzt * 1.3 + b.ph) * 0.05, -b.w + (b.v > 0 ? -Math.PI / 2 : Math.PI / 2), 0); });
  if (leuchtturm) leuchtturm.userData.strahl.rotation.y = jetzt * 0.8;
  steuerung.update();
  // Kamera nicht von der Insel wegschieben
  _ziel.copy(steuerung.target); _ziel.y = 0; const lz = _ziel.length();
  if (lz > 34) { const d = _ziel.clone().multiplyScalar(34 / lz - 1); steuerung.target.add(d); kamera.position.add(d); }
  himmel.position.copy(kamera.position);
  renderer.render(szene, kamera);
  if (erstesBild) { erstesBild = false; $("laden").classList.add("weg"); tippWeg(7000); }
  // FPS
  fpsBilder++; fpsZeit += dt;
  if (fpsZeit >= 0.5) {
    const fps = fpsBilder / fpsZeit; $("fps").textContent = Math.round(fps) + " FPS"; fpsBilder = 0; fpsZeit = 0;
    if (!geprueft && jetzt - wachsStart > 2) { ersteSekunden.push(fps); if (ersteSekunden.length >= 8) { geprueft = true; const s = ersteSekunden.reduce((a, b) => a + b, 0) / ersteSekunden.length; if (s < 30 && stufe !== "niedrig") qualitaet(stufe === "hoch" ? "mittel" : "niedrig", "Grafik automatisch auf „" + STUFEN[stufe === "hoch" ? "mittel" : "niedrig"].name + "“ gestellt, damit es flüssiger läuft."); } }
  }
});
