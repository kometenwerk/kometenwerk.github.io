/* Hotel Freundlich – 3D-Welt (Lobby, Aufzug, Flur, Raum 67)
   Alle Modelle und Texturen werden hier im Code erzeugt, nichts ist fremd. */
import * as THREE from '../../shared/vendor/three-0.160.0/three.module.min.js';

const AUGE = 1.6, TEMPO = 2.5;
let augeZiel = AUGE, tempoJetzt = TEMPO, duckt = false, immun = 0, schrittAlt = 0;
let r, szene, kamera, wurzel, uhr, env;
const orte = {};
let ort = 'lobby', frei = false, yaw = 0, pitch = 0, zeit = 0, schritt = 0;
const pos = new THREE.Vector3(0, AUGE, 5);
const tasten = {}, stick = { x: 0, y: 0, id: null }, blick = { id: null, x: 0, y: 0 };
let ziele = [], marken = [], nahId = null, auto = null, titelModus = false;
const tweens = [];
let flacker = [], glocke, toni, lobbyGlocke, nachtModus = false, wild = false;
const E = {};
let einfach = false;

/* ---------- Helfer ---------- */
function zufall(n) { let s = n * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
function tex(w, h, male, rep, farbe = true) {
  const k = document.createElement('canvas'); k.width = w; k.height = h;
  const c = k.getContext('2d'); male(c, w, h);
  const t = new THREE.CanvasTexture(k);
  if (farbe) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (rep) t.repeat.set(rep[0], rep[1]);
  return t;
}
function holz(a, b, n = 7) {
  return (c, w, h) => {
    const z = zufall(n); c.fillStyle = a; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      c.strokeStyle = b; c.globalAlpha = .05 + z() * .22; c.lineWidth = .6 + z() * 2.4;
      const y = z() * h; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(w * .3, y + z() * 10 - 5, w * .6, y + z() * 10 - 5, w, y); c.stroke();
    }
    c.globalAlpha = 1;
  };
}
function tapeteMalen(c, w, h, a, b, d) {
  c.fillStyle = a; c.fillRect(0, 0, w, h);
  c.fillStyle = b; c.fillRect(0, 0, w * .12, h); c.fillRect(w * .5, 0, w * .12, h);
  c.fillStyle = d;
  [[w * .31, h * .25], [w * .81, h * .75], [w * .31, h * 1.25], [w * .81, h * -.25]].forEach(([x, y]) => {
    c.save(); c.translate(x, y);
    for (let i = 0; i < 4; i++) {
      c.rotate(Math.PI / 2);
      c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(18, -14, 24, -44, 0, -66); c.bezierCurveTo(-24, -44, -18, -14, 0, 0); c.fill();
    }
    c.restore();
  });
}
const schild = (text, w, h, grund, farbe, gr, rand) => tex(w, h, (c) => {
  c.fillStyle = grund; c.fillRect(0, 0, w, h);
  if (rand) { c.strokeStyle = rand; c.lineWidth = h * .05; c.strokeRect(h * .05, h * .05, w - h * .1, h - h * .1); }
  c.fillStyle = farbe; c.font = `${gr}px Bungee, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + gr * .06);
});
const M = o => new THREE.MeshStandardMaterial(Object.assign({ envMap: env, envMapIntensity: .7 }, o));
function teil(g, m, x, y, z, eltern, opt = {}) {
  const e = new THREE.Mesh(g, m); e.position.set(x, y, z);
  e.castShadow = opt.schatten !== false; e.receiveShadow = true;
  if (opt.ry) e.rotation.y = opt.ry; if (opt.rx) e.rotation.x = opt.rx; if (opt.rz) e.rotation.z = opt.rz;
  eltern.add(e); return e;
}
const box = (w, h, d, m, x, y, z, p, o) => teil(new THREE.BoxGeometry(w, h, d), m, x, y, z, p, o);
const zyl = (a, b, h, m, x, y, z, p, o) => teil(new THREE.CylinderGeometry(a, b, h, o && o.seg || 28), m, x, y, z, p, o);
const kug = (a, m, x, y, z, p, o) => teil(new THREE.SphereGeometry(a, 24, 18), m, x, y, z, p, o);
function flaeche(w, h, m, x, y, z, p, ru = 1, rv = 1, ry = 0, rx = 0) {
  const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ru, uv.getY(i) * rv);
  const e = new THREE.Mesh(g, m); e.position.set(x, y, z); e.rotation.set(rx, ry, 0, 'YXZ'); e.receiveShadow = true; p.add(e); return e;
}
function raum(p, x0, x1, z0, z1, h, wand, boden, decke, urep = .5) {
  const b = x1 - x0, t = z1 - z0, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  flaeche(b, t, boden, mx, 0, mz, p, b / 2, t / 2, 0, -Math.PI / 2);
  flaeche(b, t, decke, mx, h, mz, p, b / 2, t / 2, 0, Math.PI / 2);
  flaeche(b, h, wand, mx, h / 2, z0, p, b * urep, h * urep);
  flaeche(b, h, wand, mx, h / 2, z1, p, b * urep, h * urep, Math.PI);
  flaeche(t, h, wand, x0, h / 2, mz, p, t * urep, h * urep, Math.PI / 2);
  flaeche(t, h, wand, x1, h / 2, mz, p, t * urep, h * urep, -Math.PI / 2);
}
function vertafelung(p, x0, x1, z0, z1, m, leiste, hoehe = 1) {
  const b = x1 - x0, t = z1 - z0, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, d = .05;
  [[b, mx, z0 + d / 2, 0], [b, mx, z1 - d / 2, 0], [t, x0 + d / 2, mz, 1], [t, x1 - d / 2, mz, 1]].forEach(([l, x, z, q]) => {
    box(q ? d : l, hoehe, q ? l : d, m, x, hoehe / 2, z, p, { schatten: false });
    box(q ? d + .05 : l, .07, q ? l : d + .05, leiste, x, hoehe, z, p, { schatten: false });
    box(q ? d + .03 : l, .12, q ? l : d + .03, leiste, x, .06, z, p, { schatten: false });
  });
}
const gluehTex = tex(128, 128, (c) => {
  const g = c.createRadialGradient(64, 64, 2, 64, 64, 64); g.addColorStop(0, 'rgba(255,240,205,1)'); g.addColorStop(.25, 'rgba(255,205,130,.5)'); g.addColorStop(1, 'rgba(255,180,90,0)');
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
});
function glueh(p, x, y, z, s, farbe = 0xffffff) {
  const m = new THREE.SpriteMaterial({ map: gluehTex, color: farbe, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const e = new THREE.Sprite(m); e.position.set(x, y, z); e.scale.set(s, s, 1); p.add(e); return e;
}
const schattenTex = tex(128, 128, (c) => {
  const g = c.createRadialGradient(64, 64, 8, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,.62)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
});
function bodenSchatten(p, x, z, b, t) {
  const m = new THREE.MeshBasicMaterial({ map: schattenTex, transparent: true, depthWrite: false });
  const e = flaeche(b, t, m, x, .012, z, p, 1, 1, 0, -Math.PI / 2); return e;
}
function punkt(p, x, y, z, st, farbe = 0xffc98a, reich = 9) {
  const l = new THREE.PointLight(farbe, st, reich, 2); l.position.set(x, y, z); p.add(l); return l;
}
function spot(p, x, y, z, tx, ty, tz, st, winkel, farbe = 0xffd9a8) {
  const l = new THREE.SpotLight(farbe, st, 24, winkel, .6, 1.6);
  l.position.set(x, y, z); l.target.position.set(tx, ty, tz); l.castShadow = true;
  l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -.0006; l.shadow.normalBias = .02; l.shadow.camera.near = .4; l.shadow.camera.far = 20;
  p.add(l, l.target); return l;
}
function umgebung() {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x120a08);
  const bm = (f, st) => new THREE.MeshBasicMaterial({ color: new THREE.Color(f).multiplyScalar(st) });
  const add = (w, h, d, f, st, x, y, z) => { const e = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bm(f, st)); e.position.set(x, y, z); s.add(e); };
  add(6, .3, 6, 0xffd9a8, 6, 0, 4, 0); add(.4, 3, 3, 0xffb066, 3, 5, 1, 0); add(.4, 3, 3, 0xffe2c0, 2, -5, 1, 1); add(3, 3, .4, 0x8fb7ff, 1.2, 0, 1, -5); add(9, .2, 9, 0x4a2418, 1, 0, -2, 0);
  const pm = new THREE.PMREMGenerator(r), t = pm.fromScene(s, .04).texture; pm.dispose(); return t;
}

/* ---------- Figuren ---------- */
function baueGlocke() {
  const g = new THREE.Group();
  const riss = tex(512, 256, (c, w, h) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.strokeStyle = '#fff'; c.lineWidth = 5; c.lineJoin = 'miter';
    const z = zufall(4);
    for (let i = 0; i < 16; i++) {
      let x = z() * w, y = 0; c.beginPath(); c.moveTo(x, y);
      while (y < h * (.4 + z() * .6)) { x += (z() - .5) * 60; y += 14 + z() * 30; c.lineTo(x, y); } c.stroke();
    }
  }, null, false);
  const koerperM = M({ color: 0xd9a441, metalness: 1, roughness: .24, emissive: 0xff2a10, emissiveIntensity: 0, emissiveMap: riss, envMapIntensity: 1.5 });
  const pr = [[0, .56], [.035, .555], [.09, .535], [.15, .49], [.195, .42], [.222, .33], [.238, .22], [.262, .11], [.3, .06], [.3, .03], [0, .03]].map(([a, b]) => new THREE.Vector2(a, b)).reverse();
  teil(new THREE.LatheGeometry(pr, 48), koerperM, 0, 0, 0, g);
  const dunkelM = M({ color: 0x8d5f18, metalness: 1, roughness: .34 });
  zyl(.34, .35, .045, dunkelM, 0, .022, 0, g, { seg: 40 });
  zyl(.012, .012, .05, dunkelM, 0, .58, 0, g); kug(.034, koerperM, 0, .62, 0, g);
  const gesicht = new THREE.Group(); g.add(gesicht);
  const weiss = M({ color: 0xffffff, roughness: .3 }), schw = M({ color: 0x140d08, roughness: .25 });
  const lieb = new THREE.Group(), boese = new THREE.Group(); gesicht.add(lieb, boese); boese.visible = false;
  [-1, 1].forEach(s => {
    const a = kug(.052, weiss, s * .082, .375, .185, lieb, { schatten: false }); a.scale.set(1, 1.22, .55);
    kug(.024, schw, s * .08, .37, .222, lieb, { schatten: false });
    const f = new THREE.Shape(); f.moveTo(0, 0); f.bezierCurveTo(s * .05, .03, s * .1, .015, s * .135, .055); f.bezierCurveTo(s * .11, -.03, s * .05, -.035, 0, -.02);
    const b = teil(new THREE.ExtrudeGeometry(f, { depth: .014, bevelEnabled: false }), M({ color: 0x3a2410, roughness: .6 }), 0, .295, .226, lieb, { schatten: false }); b.rotation.y = s * -.25;
    const au = teil(new THREE.ConeGeometry(.05, .11, 3), M({ color: 0xff2410, emissive: 0xff2410, emissiveIntensity: 3 }), s * .085, .385, .2, boese, { schatten: false });
    au.rotation.set(1.4, 0, s * 1.05); au.scale.set(1, 1, .4);
  });
  const lacheln = teil(new THREE.TorusGeometry(.13, .007, 8, 28, Math.PI * .72), schw, 0, .285, .221, lieb, { schatten: false }); lacheln.rotation.z = Math.PI + .44;
  const zaehneM = M({ color: 0xffd9c8, emissive: 0x401008, emissiveIntensity: 1 });
  for (let i = 0; i < 9; i++) {
    const a = (i - 4) * .049, z = .232 - Math.abs(i - 4) * .011;
    const o = teil(new THREE.ConeGeometry(.026, .06, 4), zaehneM, a, .275, z, boese, { schatten: false }); o.rotation.x = Math.PI;
    teil(new THREE.ConeGeometry(.026, .06, 4), zaehneM, a + .022, .225, z + .006, boese, { schatten: false });
  }
  const fliege = M({ color: 0x8c1f33, roughness: .6 });
  [-1, 1].forEach(s => { const k = teil(new THREE.ConeGeometry(.052, .1, 4), fliege, s * .055, .135, .262, g); k.rotation.z = s * Math.PI / 2; });
  kug(.02, fliege, 0, .135, .275, g);
  const schildM = new THREE.MeshBasicMaterial({ map: schild('FREUNDLICH', 512, 96, '#fbeed0', '#2a1a14', 56, '#8d5f18') });
  const sch = flaeche(.5, .09, schildM, 0, .03, .352, g);
  const freund = schildM.map, feind = schild('FEINDLICH', 512, 96, '#2a0a0a', '#ff4a35', 56, '#6b1010');
  return {
    g, wert: 0,
    setz(f) {
      this.wert = f;
      koerperM.color.set(0xd9a441).lerp(new THREE.Color(0x16131a), f);
      koerperM.roughness = .24 + f * .3; dunkelM.color.set(0x8d5f18).lerp(new THREE.Color(0x0b090e), f);
      koerperM.emissiveIntensity = f > .3 ? (f - .3) * 3.2 : 0;
      lieb.visible = f < .55; boese.visible = f >= .55; schildM.map = f < .55 ? freund : feind; schildM.needsUpdate = true;
      sch.rotation.z = f >= .55 ? -.14 : 0;
    }
  };
}
function baueToni() {
  const g = new THREE.Group(), blau = M({ color: 0x34495e, roughness: .8, envMapIntensity: .3 }), blau2 = M({ color: 0x26364a, roughness: .8, envMapIntensity: .3 });
  const beine = [-1, 1].map(s => {
    const b = new THREE.Group(); b.position.set(s * .13, .86, 0); g.add(b);
    teil(new THREE.CapsuleGeometry(.09, .62, 6, 14), blau, 0, -.42, 0, b); box(.17, .1, .3, M({ color: 0x15151b, roughness: .5 }), 0, -.82, .05, b); return b;
  });
  teil(new THREE.CapsuleGeometry(.23, .46, 6, 18), blau, 0, 1.13, 0, g);
  box(.3, .36, .04, blau2, 0, 1.28, .215, g);
  [-1, 1].forEach(s => box(.05, .5, .04, blau2, s * .13, 1.42, .17, g));
  const shirt = M({ color: 0x8a8d73, roughness: .9, envMapIntensity: .2 });
  kug(.2, shirt, 0, 1.52, 0, g);
  const kopf = kug(.15, M({ color: 0x0c0e12, roughness: .9, envMapIntensity: .1 }), 0, 1.72, .01, g);
  const augeM = M({ color: 0xe8e3c8, emissive: 0xe8e3c8, emissiveIntensity: 1.6 });
  kug(.021, augeM, -.056, 1.73, .138, g, { schatten: false }); kug(.021, augeM, .056, 1.73, .138, g, { schatten: false });
  const kappe = M({ color: 0x2f3e50, roughness: .75 });
  const kk = kug(.165, kappe, 0, 1.79, 0, g); kk.scale.y = .62;
  const sc = zyl(.13, .13, .025, kappe, 0, 1.775, .11, g); sc.scale.z = .7;
  const tr = M({ color: 0xb5352f, roughness: .45 }), fell = M({ color: 0xeee3c9, roughness: .8 });
  zyl(.3, .3, .28, tr, 0, 1, .34, g, { seg: 36 }); zyl(.31, .31, .02, fell, 0, 1.15, .34, g, { seg: 36 }); zyl(.31, .31, .02, fell, 0, .85, .34, g, { seg: 36 });
  const messing = M({ color: 0xd9a441, metalness: 1, roughness: .3 });
  for (let i = 0; i < 10; i++) { const w = i / 10 * Math.PI * 2; zyl(.006, .006, .29, messing, Math.sin(w) * .304, 1, .34 + Math.cos(w) * .304, g, { seg: 6, rz: (i % 2 ? .45 : -.45) }); }
  const haut = M({ color: 0xd8c39b, roughness: .7 }), arme = [-1, 1].map(s => {
    const a = new THREE.Group(); a.position.set(s * .3, 1.5, .02); g.add(a);
    const o = teil(new THREE.CapsuleGeometry(.065, .34, 5, 10), shirt, 0, -.2, .1, a); o.rotation.x = -.5;
    const u = teil(new THREE.CapsuleGeometry(.055, .28, 5, 10), haut, -s * .08, -.32, .36, a); u.rotation.x = -1.2; u.rotation.z = s * .5;
    const st = zyl(.012, .017, .46, M({ color: 0xcaa66b, roughness: .5 }), -s * .2, -.34, .62, a, { seg: 8 }); st.rotation.x = 1.8; st.rotation.z = s * .55;
    return a;
  });
  return { g, beine, arme };
}

/* ---------- Orte ---------- */
function baueLobby() {
  const p = new THREE.Group(); orte.lobby = { g: p, frei: [[-7.6, 7.6, -5.6, 5.6]], block: [[-4.1, 4.1, -3.9, -2.75], [-7.9, -5.6, .4, 3.2], [-5.5, -4.5, -2.5, -1.5], [4.5, 5.5, -2.5, -1.5], [-5.5, -4.5, 1.5, 2.5], [4.5, 5.5, 1.5, 2.5]] };
  const wand = M({ map: tex(512, 512, (c, w, h) => tapeteMalen(c, w, h, '#651d33', '#58172a', '#752740')), roughness: .78, envMapIntensity: .25 });
  const boden = M({
    map: tex(512, 512, (c, w, h) => {
      const z = zufall(3), f = ['#e4d6b4', '#0f5257']; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { c.fillStyle = f[(i + j) % 2]; c.fillRect(i * 256, j * 256, 256, 256); }
      c.strokeStyle = 'rgba(70,60,50,.28)'; for (let i = 0; i < 40; i++) { c.lineWidth = .5 + z() * 1.4; c.beginPath(); let x = z() * w, y = z() * h; c.moveTo(x, y); for (let k = 0; k < 5; k++) { x += z() * 60 - 30; y += z() * 60 - 30; c.lineTo(x, y); } c.stroke(); }
      c.strokeStyle = '#332a20'; c.lineWidth = 2; c.strokeRect(0, 0, 256, 256); c.strokeRect(256, 256, 256, 256);
    }), roughness: .22, metalness: .05, envMapIntensity: 1
  });
  const decke = M({ color: 0x4a2a20, roughness: .85, envMapIntensity: .2 });
  raum(p, -8, 8, -6, 6, 4.6, wand, boden, decke);
  const hz = M({ map: tex(512, 256, holz('#5e3019', '#2c1208')), roughness: .42, envMapIntensity: .8 });
  const hz2 = M({ map: tex(512, 256, holz('#7a4426', '#3a180a', 9)), roughness: .3 });
  const mess = M({ color: 0xd9a441, metalness: 1, roughness: .26, envMapIntensity: 1.5 });
  vertafelung(p, -8, 8, -6, 6, hz, hz2, 1.2);
  box(16, .22, .3, mess, 0, 4.48, -5.88, p, { schatten: false });
  [[-5, -2], [5, -2], [-5, 2], [5, 2]].forEach(([x, z]) => {
    zyl(.42, .46, .35, hz2, x, .175, z, p); zyl(.32, .34, 3.8, M({ color: 0x4d1a26, roughness: .2, envMapIntensity: 1.1 }), x, 2.2, z, p); zyl(.46, .36, .4, mess, x, 4.3, z, p);
    bodenSchatten(p, x, z, 2, 2);
  });
  /* Teppich */
  const tp = M({
    map: tex(512, 512, (c, w, h) => {
      c.fillStyle = '#7d1f33'; c.fillRect(0, 0, w, h); c.strokeStyle = '#e0ac3f'; c.lineWidth = 14; c.strokeRect(24, 24, w - 48, h - 48); c.lineWidth = 3; c.strokeRect(50, 50, w - 100, h - 100);
      c.fillStyle = '#0f5257'; for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { c.save(); c.translate(116 + i * 70, 116 + j * 70); c.rotate(Math.PI / 4); c.fillRect(-13, -13, 26, 26); c.restore(); }
    }), roughness: .95, envMapIntensity: .15
  });
  flaeche(5, 6, tp, 0, .01, 1.2, p, 1, 1, 0, -Math.PI / 2);
  /* Tresen */
  box(8, 1.08, .9, hz, 0, .54, -3.3, p);
  box(8.24, .07, 1.08, M({ color: 0x14100e, roughness: .2, envMapIntensity: .8 }), 0, 1.115, -3.3, p);
  box(8.1, .04, .95, mess, 0, 1.06, -3.3, p, { schatten: false });
  for (let i = 0; i < 8; i++) { box(.86, .78, .03, hz2, -3.5 + i, .54, -2.84, p, { schatten: false }); box(.66, .58, .03, hz, -3.5 + i, .54, -2.82, p, { schatten: false }); }
  bodenSchatten(p, 0, -2.5, 10, 2.2);
  /* Schild */
  E.schildF = schild('HOTEL FREUNDLICH', 1024, 160, '#1a0d0a', '#ffd478', 88, '#e0ac3f');
  E.schildW = schild('HOTEL FEINDLICH', 1024, 160, '#120606', '#ff5a3d', 88, '#7c1010');
  E.schildM = new THREE.MeshStandardMaterial({ map: E.schildF, emissive: 0xffffff, emissiveMap: E.schildF, emissiveIntensity: .9, roughness: .5 });
  E.schild = flaeche(6.2, .96, E.schildM, 0, 3.75, -5.92, p);
  glueh(p, 0, 3.75, -5.7, 6.5, 0x664422);
  /* Schlüsselbrett */
  box(4, 1.5, .08, hz2, 0, 2.3, -5.9, p);
  for (let i = 0; i < 18; i++) {
    const x = -1.6 + (i % 6) * .64, y = 2.82 - Math.floor(i / 6) * .5;
    kug(.022, mess, x, y, -5.84, p, { schatten: false });
    if (i !== 7) { const k = zyl(.06, .06, .012, M({ color: 0xd9c8a2, roughness: .55 }), x, y - .13, -5.83, p, { rx: Math.PI / 2, seg: 16, schatten: false }); k.scale.z = 1.5; }
  }
  /* Aufzug rechts */
  const stahl = M({ color: 0xaeb5bb, metalness: 1, roughness: .32, envMapIntensity: 1.3 });
  box(.14, 3, 2.4, mess, 7.92, 1.5, 0, p);
  E.lT = [box(.06, 2.72, .98, stahl, 7.84, 1.36, -.5, p), box(.06, 2.72, .98, stahl, 7.84, 1.36, .5, p)];
  E.anz = flaeche(.86, .34, new THREE.MeshBasicMaterial({ map: schild('1', 256, 96, '#1a0d0a', '#ffd478', 66) }), 7.82, 3.3, 0, p, 1, 1, -Math.PI / 2);
  kug(.05, mess, 7.84, 1.3, 1.4, p, { schatten: false });
  /* Eingang hinten */
  box(3.4, 3.2, .1, hz2, 0, 1.6, 5.94, p);
  [-.8, .8].forEach(x => {
    box(1.46, 2.9, .05, mess, x, 1.5, 5.88, p);
    flaeche(1.3, 2.7, M({ map: tex(128, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0d1230'); g.addColorStop(1, '#42214f'); c.fillStyle = g; c.fillRect(0, 0, w, h); }), roughness: .08, envMapIntensity: 1.5 }), x, 1.5, 5.84, p, 1, 1, Math.PI);
  });
  /* Sofa, Pflanzen, Sessel */
  const samt = M({ color: 0x0f5257, roughness: .85, envMapIntensity: .25 });
  box(1.1, .42, 2.6, samt, -7.25, .34, 1.8, p); box(.32, .86, 2.6, samt, -7.65, .62, 1.8, p); box(1.1, .6, .24, samt, -7.25, .5, .58, p); box(1.1, .6, .24, samt, -7.25, .5, 3.02, p);
  bodenSchatten(p, -7, 1.8, 2.6, 4);
  [[-7.2, -5.2], [7.2, -5.2], [7.2, 5.2], [-7.2, 5.2]].forEach(([x, z]) => {
    zyl(.3, .22, .56, hz2, x, .28, z, p); bodenSchatten(p, x, z, 1.5, 1.5);
    const bl = M({ color: 0x2c6b46, roughness: .55, side: THREE.DoubleSide, envMapIntensity: .4 }), rz = zufall(Math.abs(x * z));
    for (let i = 0; i < 12; i++) {
      const b = new THREE.Mesh(new THREE.ConeGeometry(.1, 1.3, 4), bl); const w = rz() * 6.28, n = .35 + rz() * .55;
      b.position.set(x + Math.sin(w) * n * .55, .95 + rz() * .55, z + Math.cos(w) * n * .55); b.rotation.set(Math.cos(w) * n, 0, -Math.sin(w) * n); b.scale.z = .25; b.castShadow = true; p.add(b);
    }
  });
  /* Kronleuchter */
  const kr = new THREE.Group(); kr.position.set(0, 3.55, .4); p.add(kr);
  zyl(.012, .012, .9, mess, 0, .62, 0, kr, { seg: 8 });
  teil(new THREE.TorusGeometry(.72, .022, 10, 48), mess, 0, 0, 0, kr, { rx: Math.PI / 2 });
  teil(new THREE.TorusGeometry(.4, .018, 10, 32), mess, 0, .3, 0, kr, { rx: Math.PI / 2 });
  const lampe = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.25, .8) });
  for (let i = 0; i < 10; i++) { const w = i / 10 * 6.283, x = Math.sin(w) * .72, z = Math.cos(w) * .72; kug(.05, lampe, x, .05, z, kr, { schatten: false }); glueh(kr, x, .05, z, .62); }
  const sL = spot(p, 0, 4.4, .4, 0, 0, -.8, 62, 1.12);
  punkt(p, 0, 3.2, .4, 11, 0xffc98a, 13);
  [[-7.6, 2.6, -2], [7.6, 2.6, 3], [-7.6, 2.6, 4.2]].forEach(([x, y, z]) => {
    box(.1, .3, .16, mess, x + (x < 0 ? -.3 : .3), y, z, p, { schatten: false }); kug(.09, lampe, x, y + .1, z, p, { schatten: false }); glueh(p, x, y + .1, z, 1.3); punkt(p, x, y, z, 7, 0xffb46b, 7);
  });
  const rez = punkt(p, 0, 2.6, -2.4, 3.2, 0xffd9a8, 8);
  E.lobbyLicht = [sL, rez];
  p.add(new THREE.HemisphereLight(0xffd8b0, 0x2a1408, .42));
  lobbyGlocke = baueGlocke(); lobbyGlocke.g.position.set(0, 1.15, -3.3); p.add(lobbyGlocke.g);
  p.fog = new THREE.Fog(0x1c0f0a, 12, 34);
  E.sonst = { glocke: lobbyGlocke };
}
function baueAufzug() {
  const p = new THREE.Group(); orte.aufzug = { g: p, frei: [[-.8, .8, -.8, .8]], block: [] };
  const hz = M({ map: tex(256, 512, holz('#6d3a20', '#2c1208', 5)), roughness: .3, envMapIntensity: 1 });
  const hz2 = M({ map: tex(256, 256, holz('#4c2615', '#1e0c05', 6)), roughness: .4 });
  const mess = M({ color: 0xd9a441, metalness: 1, roughness: .22, envMapIntensity: 1.6 });
  raum(p, -1.2, 1.2, -1.2, 1.2, 2.7, hz, M({ map: tex(256, 256, (c, w, h) => { c.fillStyle = '#20100e'; c.fillRect(0, 0, w, h); c.fillStyle = '#3a1621'; c.fillRect(0, 0, 128, 128); c.fillRect(128, 128, 128, 128); }), roughness: .35 }), M({ color: 0x3a2015, roughness: .6 }), 1);
  [[0, 1.18, 2.3, 0], [-1.18, 0, 2.3, 1], [1.18, 0, 2.3, 1]].forEach(([x, z, l, q]) => { const b = zyl(.022, .022, l, mess, x, 1, z, p, { seg: 12, schatten: false }); b.rotation.set(q ? Math.PI / 2 : 0, 0, q ? 0 : Math.PI / 2); });
  E.kT = [box(.94, 2.44, .05, M({ color: 0xc9a14a, metalness: 1, roughness: .3 }), -.47, 1.22, -1.15, p), box(.94, 2.44, .05, M({ color: 0xc9a14a, metalness: 1, roughness: .3 }), .47, 1.22, -1.15, p)];
  box(.26, .7, .03, hz2, .98, 1.3, -1.17, p, { schatten: false });
  E.stockT = tex(320, 200, () => {});
  E.stockM = new THREE.MeshBasicMaterial({ map: E.stockT });
  flaeche(1, .625, E.stockM, 0, 2.52 - .24, -1.13, p);
  p.add(new THREE.HemisphereLight(0xffd8b0, 0x301a10, .7));
  punkt(p, 0, 2.5, 0, 9, 0xffd29a, 6);
  glueh(p, 0, 2.62, 0, 1.2);
  const lp = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.3, .9) }); zyl(.28, .28, .03, lp, 0, 2.68, 0, p, { schatten: false });
  p.fog = new THREE.Fog(0x000000, 10, 30);
}
function stock(n) {
  const c = E.stockT.image.getContext('2d'), w = 320, h = 200;
  c.fillStyle = '#1a0d0a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#e0ac3f'; c.lineWidth = 6; c.strokeRect(5, 5, w - 10, h - 10);
  c.lineWidth = 4; c.beginPath(); c.arc(160, 178, 134, Math.PI, 0); c.stroke();
  const a = Math.PI + Math.PI * Math.min(1, n / 67); c.strokeStyle = '#ff6b5e'; c.lineWidth = 6; c.beginPath(); c.moveTo(160, 178); c.lineTo(160 + Math.cos(a) * 122, 178 + Math.sin(a) * 122); c.stroke();
  c.fillStyle = '#ffd478'; c.font = '74px Bungee'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), 160, 122);
  E.stockT.needsUpdate = true;
}
function baueFlur() {
  const p = new THREE.Group(); orte.flur = { g: p, frei: [[-.8, .8, -8.4, 8.2]], block: [] };
  const wand = M({ map: tex(512, 512, (c, w, h) => tapeteMalen(c, w, h, '#1d4e52', '#1a4649', '#266064')), roughness: .75, envMapIntensity: .2 });
  const tp = M({
    map: tex(256, 256, (c, w, h) => {
      c.fillStyle = '#6b1c30'; c.fillRect(0, 0, w, h); c.fillStyle = '#541426'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) c.fillRect(i * 64, j * 64, 64, 64);
      c.strokeStyle = '#c99a3a'; c.lineWidth = 3; c.beginPath(); for (let i = 0; i < 4; i++) { c.moveTo(i * 64 + 32, 0); c.lineTo(i * 64 + 32, 256); } c.stroke();
    }), roughness: .95, envMapIntensity: .1
  });
  raum(p, -1.2, 1.2, -9, 9, 2.8, wand, tp, M({ color: 0x3a342c, roughness: .9, envMapIntensity: .1 }));
  const hz = M({ map: tex(512, 256, holz('#4c2615', '#1e0c05', 8)), roughness: .4 });
  vertafelung(p, -1.2, 1.2, -9, 9, hz, M({ color: 0xa8802f, metalness: .9, roughness: .4 }), .9);
  const tuerM = M({ map: tex(256, 512, holz('#6b3a20', '#2c1208', 4)), roughness: .36 });
  const mess = M({ color: 0xd9a441, metalness: 1, roughness: .28, envMapIntensity: 1.4 });
  const num = ['61', '62', '63', '64', '65', '66'];
  num.forEach((n, i) => {
    const z = 5 - i * 2.4, s = i % 2 ? 1 : -1;
    box(.08, 2.2, 1, tuerM, s * 1.16, 1.1, z, p); box(.09, 2.3, 1.14, hz, s * 1.17, 1.15, z, p, { schatten: false });
    box(.1, 2.2, 1, tuerM, s * 1.16, 1.1, z, p, { schatten: false }); kug(.04, mess, s * 1.08, 1, z + .36, p, { schatten: false });
    flaeche(.3, .16, new THREE.MeshBasicMaterial({ map: schild(n, 128, 64, '#d9a441', '#2a1a14', 44) }), s * 1.105, 1.72, z, p, 1, 1, s > 0 ? -Math.PI / 2 : Math.PI / 2);
  });
  /* Tür 67 am Ende, Flurseite */
  box(1.16, 2.24, .08, tuerM, 0, 1.12, -8.95, p); box(1.34, 2.36, .05, hz, 0, 1.18, -8.97, p, { schatten: false });
  flaeche(.42, .22, new THREE.MeshStandardMaterial({ map: schild('67', 128, 64, '#d9a441', '#2a1a14', 44), metalness: .4, roughness: .3 }), 0, 1.82, -8.9, p);
  kug(.045, mess, .42, 1, -8.87, p, { schatten: false });
  box(1.6, 2.4, .08, M({ color: 0xc9a14a, metalness: 1, roughness: .3 }), 0, 1.2, 8.94, p);
  E.flurL = [];
  const lp = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.15, .75) });
  [6, 1, -4].forEach((z, i) => {
    zyl(.2, .2, .05, lp, 0, 2.77, z, p, { schatten: false }); const gl = glueh(p, 0, 2.7, z, 1.8);
    const l = punkt(p, 0, 2.5, z, 6.5, 0xffc98a, 8); E.flurL.push({ l, gl, st: 6.5, lp });
  });
  E.flurS = spot(p, 0, 2.7, 1, 0, 0, -5, 40, 1);
  E.hemiF = new THREE.HemisphereLight(0xffd8b0, 0x201008, .22); p.add(E.hemiF);
  p.fog = new THREE.Fog(0x0c0705, 5, 20);
}
function baueZimmer() {
  const p = new THREE.Group(); orte.zimmer = { g: p, frei: [[-2.4, 2.4, -14.6, -9.4]], block: [[.9, 2.8, -14.1, -11.7], [1.9, 2.9, -11.2, -9.6], [.5, 1, -13.4, -12.8]] };
  const wand = M({ map: tex(512, 512, (c, w, h) => tapeteMalen(c, w, h, '#2b5a58', '#274f4e', '#35696a')), roughness: .78, envMapIntensity: .2 });
  const boden = M({
    map: tex(512, 512, (c, w, h) => { holz('#6a4228', '#2e170b', 11)(c, w, h); c.strokeStyle = '#1f0f07'; c.lineWidth = 3; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(0, i * 128); c.lineTo(w, i * 128); c.stroke(); } }), roughness: .38, envMapIntensity: .7
  });
  raum(p, -2.75, 2.75, -15, -9, 2.8, wand, boden, M({ color: 0x8c8474, roughness: .9, envMapIntensity: .15 }));
  const hz = M({ map: tex(512, 256, holz('#4c2615', '#1e0c05', 12)), roughness: .38 });
  const hell = M({ map: tex(256, 512, holz('#6d3a20', '#2c1208', 13)), roughness: .34 });
  vertafelung(p, -2.75, 2.75, -15, -9, hz, M({ color: 0xa8802f, metalness: .9, roughness: .42 }), .8);
  const mess = M({ color: 0xd9a441, metalness: 1, roughness: .28, envMapIntensity: 1.4 });
  flaeche(3.2, 3.6, M({ map: tex(256, 256, (c, w, h) => { c.fillStyle = '#6b1c30'; c.fillRect(0, 0, w, h); c.strokeStyle = '#a03a4c'; c.lineWidth = 8; c.strokeRect(14, 14, w - 28, h - 28); }), roughness: .95, envMapIntensity: .1 }), -.6, .012, -12, p, 1, 1, 0, -Math.PI / 2);
  /* Tür innen */
  E.tuer = box(1.16, 2.24, .08, hell, 0, 1.12, -9.06, p); box(1.34, 2.36, .05, hz, 0, 1.18, -9.03, p, { schatten: false });
  kug(.045, mess, .42, 1, -9.14, p, { schatten: false });
  zyl(.03, .03, .03, mess, 0, 1.6, -9.11, p, { rx: Math.PI / 2, seg: 16, schatten: false });
  E.risse = [];
  const rissM = new THREE.MeshBasicMaterial({ color: 0x060302, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) { const z = zufall(i + 3), f = new THREE.Shape(); f.moveTo(0, 0); let x = 0, y = 0; for (let k = 0; k < 5; k++) { x += z() * .22 - .11; y -= .24 + z() * .24; f.lineTo(x, y); } for (let k = 0; k < 5; k++) { x += z() * .08; y += .26; f.lineTo(x + .05, y); } const m = new THREE.Mesh(new THREE.ShapeGeometry(f), rissM); m.position.set(-.42 + i * .17, 2.1 - (i % 3) * .3, -9.105); m.rotation.y = Math.PI; m.visible = false; p.add(m); E.risse.push(m); }
  E.tuerSpalt = flaeche(1.1, .1, new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 1.3, .6), transparent: true, opacity: 0 }), 0, .012, -9.3, p, 1, 1, 0, -Math.PI / 2);
  /* WC-Tür links */
  box(.08, 2.24, 1.1, M({ color: 0xcfc4ab, roughness: .55 }), -2.7, 1.12, -10.5, p);
  kug(.04, mess, -2.62, 1, -10.1, p, { schatten: false });
  flaeche(.26, .16, new THREE.MeshBasicMaterial({ map: schild('WC', 128, 64, '#d9a441', '#2a1a14', 40) }), -2.645, 1.8, -10.5, p, 1, 1, Math.PI / 2);
  /* Kalender */
  E.kal0 = tex(256, 300, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#c23b3b'; c.fillRect(0, 0, w, 72); c.fillStyle = '#fff'; c.font = '34px Bungee'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('AUGUST', w / 2, 38); c.fillStyle = '#2a1a14'; c.font = '124px Bungee'; c.fillText('30', w / 2, 190); });
  E.kal1 = tex(256, 300, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#c23b3b'; c.fillRect(0, 0, w, 72); c.fillStyle = '#fff'; c.font = '30px Bungee'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('NOVEMBER', w / 2, 38); c.fillStyle = '#c23b3b'; c.font = '124px Bungee'; c.fillText('67', w / 2, 190); });
  E.kalM = new THREE.MeshStandardMaterial({ map: E.kal0, roughness: .7 });
  flaeche(.52, .61, E.kalM, -2.72, 1.75, -12.2, p, 1, 1, Math.PI / 2);
  /* Bild mit Versteck */
  box(1.06, .8, .05, mess, -.9, 1.7, -14.96, p, { schatten: false });
  E.blatt = flaeche(.4, .52, M({ map: tex(128, 170, (c, w, h) => { c.fillStyle = '#efe6cf'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a1a14'; for (let i = 0; i < 9; i++) c.fillRect(12, 18 + i * 16, 80 + (i * 37) % 28, 4); }) }), -.9, 1.7, -14.92, p);
  E.bild = new THREE.Group(); E.bild.position.set(-1.38, 2.05, -14.91); p.add(E.bild);
  const gemaelde = flaeche(.96, .7, M({ map: tex(320, 232, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#d9a441'); g.addColorStop(.6, '#a9dcc8'); g.addColorStop(1, '#0f5257'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#5b1a2e'; c.fillRect(120, 66, 80, 150); c.fillStyle = '#ffd778'; for (let i = 0; i < 4; i++) for (let j = 0; j < 7; j++) if ((i + j) % 3) c.fillRect(130 + i * 16, 76 + j * 18, 9, 11);
    c.fillStyle = '#123537'; c.fillRect(0, 214, w, 18);
  }), roughness: .5 }), .48, -.35, 0, E.bild);
  gemaelde.castShadow = true;
  /* Bett */
  box(1.82, .3, 2.4, hz, 1.85, .22, -12.9, p); box(1.82, .24, 2.3, M({ color: 0xefe6cf, roughness: .8 }), 1.85, .5, -12.9, p);
  box(1.86, 1.1, .1, hell, 1.85, .7, -14.12, p);
  const decke = M({ map: tex(256, 256, (c, w, h) => { c.fillStyle = '#8c1f33'; c.fillRect(0, 0, w, h); c.fillStyle = '#6b1729'; for (let i = 0; i < 6; i += 2) c.fillRect(i * 43, 0, 43, h); }), roughness: .85, envMapIntensity: .15 });
  box(1.9, .14, 1.6, decke, 1.85, .66, -12.45, p);
  [1.4, 2.3].forEach(x => { const k = kug(.27, M({ color: 0xf7f1e2, roughness: .9 }), x, .72, -13.75, p); k.scale.set(1.2, .42, .7); });
  bodenSchatten(p, 1.85, -12.9, 3, 3.6);
  /* Nachttisch mit Lampe */
  box(.46, .56, .46, hz, .72, .28, -13.1, p);
  zyl(.03, .1, .3, mess, .72, .72, -13.1, p, { seg: 14 });
  E.schirmM = new THREE.MeshStandardMaterial({ color: 0xf4dcae, emissive: 0xffc070, emissiveIntensity: 1.5, side: THREE.DoubleSide });
  zyl(.13, .2, .22, E.schirmM, .72, .96, -13.1, p, { seg: 22, schatten: false });
  E.lampe = punkt(p, .72, 1.05, -13.1, 3.5, 0xffc070, 6); E.lampeG = glueh(p, .72, .98, -13.1, 1.4);
  /* Schrank */
  box(.86, 2.2, 1.46, hell, 2.3, 1.1, -10.4, p); box(.02, 2, .02, hz, 1.86, 1.1, -10.4, p, { schatten: false });
  /* Fenster mit Mond */
  const nachtT = tex(512, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#080c26'); g.addColorStop(1, '#2d1a44'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff'; const z = zufall(6); for (let i = 0; i < 120; i++) c.fillRect(z() * w, z() * h, 2, 2);
    c.fillStyle = '#f7e9c4'; c.beginPath(); c.arc(330, 150, 56, 0, 7); c.fill(); c.fillStyle = '#1b1438'; for (let i = 0; i < 9; i++) c.fillRect(i * 58, 420 - (i * 37) % 70, 50, 120);
  });
  flaeche(1.6, 1.3, new THREE.MeshBasicMaterial({ map: nachtT }), 1, 1.75, -14.96, p);
  const rahmen = M({ color: 0x3a2015, roughness: .5 });
  [[1, 2.4, 1.7, .08], [1, 1.1, 1.7, .08], [.18, 1.75, .08, 1.36], [1.82, 1.75, .08, 1.36], [1, 1.75, .05, 1.3]].forEach(([x, y, b, h]) => box(b, h, .07, rahmen, x, y, -14.93, p, { schatten: false }));
  [.04, 1.96].forEach(x => box(.38, 1.9, .06, M({ color: 0x8c1f33, roughness: .9 }), x, 1.62, -14.86, p));
  /* Lüftungsgitter */
  const gitter = new THREE.Group(); gitter.position.set(-2.7, .5, -14.1); p.add(gitter); E.gitter = gitter;
  const stahl = M({ color: 0x8c959d, metalness: .9, roughness: .4 });
  box(.05, .6, .9, stahl, 0, 0, 0, gitter);
  for (let i = 0; i < 6; i++) box(.06, .05, .8, M({ color: 0x20262c, roughness: .6 }), .012, -.22 + i * .088, 0, gitter, { schatten: false });
  E.schrauben = [[.26, .4], [.26, -.4], [-.26, .4], [-.26, -.4]].map(([y, z]) => zyl(.022, .022, .03, mess, .035, y, z, gitter, { rz: Math.PI / 2, seg: 10, schatten: false }));
  /* Licht */
  E.zimmerS = spot(p, -.4, 2.74, -12, -.4, 0, -12.2, 34, 1.15);
  E.zimmerP = punkt(p, 0, 2.3, -10.5, 6, 0xffc98a, 8);
  E.mond = spot(p, 1, 2.3, -15.6, -.6, 0, -11, 0, .55, 0x7f9fff);
  E.hemiZ = new THREE.HemisphereLight(0xffe4c0, 0x241410, .34); p.add(E.hemiZ);
}

/* Schacht: wird für jeden Abschnitt neu zusammengebaut */
function baueSchacht() {
  const p = new THREE.Group(); orte.schacht = { g: p, frei: [], block: [] };
  const nieten = (a, b) => (c, w, h) => {
    const z = zufall(5); c.fillStyle = a; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { c.fillStyle = `rgba(255,255,255,${z() * .035})`; c.fillRect(z() * w, z() * h, 1 + z() * 40, 1); c.fillStyle = `rgba(60,30,10,${z() * .06})`; c.fillRect(z() * w, z() * h, 3, 3 + z() * 26); }
    c.strokeStyle = b; c.lineWidth = 5; c.strokeRect(0, 0, w, h); c.fillStyle = '#c7d0d8';
    for (let i = 0; i < 8; i++) for (const [x, y] of [[16 + i * 66, 15], [16 + i * 66, h - 15], [15, 16 + i * 66], [w - 15, 16 + i * 66]]) { c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); }
  };
  const t = tex(512, 512, nieten('#59636d', '#2d343b'));
  E.sW = M({ map: t, bumpMap: t, bumpScale: 1.2, metalness: .75, roughness: .46, envMapIntensity: .5 });
  const t2 = tex(512, 512, nieten('#39414a', '#1c2126'));
  E.sB = M({ map: t2, metalness: .7, roughness: .55, envMapIntensity: .4 });
  E.sR = M({ color: 0x77828d, metalness: .9, roughness: .38 });
  E.sL = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.2, .75) });
  E.sL0 = new THREE.MeshBasicMaterial({ color: 0x14171a });
  E.sLicht = [punkt(p, 0, 1.2, -3, 8, 0xffc98a, 12), punkt(p, 0, 1.2, -9, 8, 0xffc98a, 12), punkt(p, 0, 1.8, -14, 8, 0xffc98a, 13)];
  E.sHemi = new THREE.HemisphereLight(0xbfd2e6, 0x20160f, .3); p.add(E.sHemi);
  E.fackel = new THREE.SpotLight(0xfff0d2, 0, 15, .55, .5, 1.2); E.fackel.position.set(.15, -.1, 0); E.fackel.target.position.set(0, 0, -3);
  kamera.add(E.fackel, E.fackel.target);
  p.fog = new THREE.Fog(0x07090c, 4, 21);
}
function schachtKanal(s, z0, z1, b, h) {
  const l = z0 - z1, m = (z0 + z1) / 2;
  flaeche(b, l, E.sB, 0, 0, m, s, b / 2, l / 2, 0, -Math.PI / 2);
  flaeche(b, l, E.sW, 0, h, m, s, b / 2, l / 2, 0, Math.PI / 2);
  flaeche(l, h, E.sW, -b / 2, h / 2, m, s, l / 2, h / 2, Math.PI / 2);
  flaeche(l, h, E.sW, b / 2, h / 2, m, s, l / 2, h / 2, -Math.PI / 2);
  for (let z = z0 - .6; z > z1; z -= 1.6) {
    box(b, .07, .1, E.sR, 0, h - .035, z, s, { schatten: false }); box(b, .05, .1, E.sR, 0, .025, z, s, { schatten: false });
    box(.07, h, .1, E.sR, -b / 2 + .035, h / 2, z, s, { schatten: false }); box(.07, h, .1, E.sR, b / 2 - .035, h / 2, z, s, { schatten: false });
  }
}
function schachtLampen(s, z0, z1, h, an) {
  for (let z = z0 - 3; z > z1; z -= 6) { zyl(.16, .16, .05, an ? E.sL : E.sL0, 0, h - .03, z, s, { schatten: false }); if (an) glueh(s, 0, h - .1, z, 1.4); }
}
function wandMitLoch(s, z, kammerB, h, lochB, lochH) {
  const seite = (kammerB - lochB) / 2;
  flaeche(seite, h, E.sW, -(lochB + seite) / 2, h / 2, z, s, seite / 2, h / 2, Math.PI);
  flaeche(seite, h, E.sW, (lochB + seite) / 2, h / 2, z, s, seite / 2, h / 2, Math.PI);
  flaeche(lochB, h - lochH, E.sW, 0, (h + lochH) / 2, z, s, lochB / 2, (h - lochH) / 2, Math.PI);
}
function baueFan(r) {
  const g = new THREE.Group(), rot = new THREE.Group(); g.add(rot);
  const blatt = M({ color: 0xb6c0c9, metalness: .9, roughness: .3 });
  teil(new THREE.TorusGeometry(r, .035, 10, 36), M({ color: 0xd9a441, metalness: .9, roughness: .35 }), 0, 0, 0, g, { schatten: false });
  for (let i = 0; i < 4; i++) { const a = new THREE.Group(); a.rotation.z = i * Math.PI / 2; rot.add(a); const b = box(r * .9, r * .32, .025, blatt, r * .5, 0, 0, a, { schatten: false }); b.rotation.x = .55; }
  zyl(r * .17, r * .17, .1, M({ color: 0xd9a441, metalness: 1, roughness: .3 }), 0, 0, 0, g, { rx: Math.PI / 2, seg: 16, schatten: false });
  g.userData.rot = rot; return g;
}
function schildZeile(text, w = 512, h = 170) {
  return tex(w, h, c => {
    c.fillStyle = '#14100c'; c.fillRect(0, 0, w, h); c.strokeStyle = '#e0ac3f'; c.lineWidth = 7; c.strokeRect(5, 5, w - 10, h - 10);
    c.fillStyle = '#fbeed0'; let g = 56; c.textAlign = 'center'; c.textBaseline = 'middle';
    const zeilen = () => { c.font = `800 ${g}px 'Baloo 2', sans-serif`; const o = [[]]; text.split(' ').forEach(t => { const n = [...o[o.length - 1], t].join(' '); if (c.measureText(n).width > w - 44 && o[o.length - 1].length) o.push([t]); else o[o.length - 1].push(t); }); return o; };
    let z = zeilen(); while (g > 24 && (z.length * g * 1.08 > h - 26 || z.some(l => c.measureText(l.join(' ')).width > w - 40))) { g -= 3; z = zeilen(); }
    z.forEach((l, i) => c.fillText(l.join(' '), w / 2, h / 2 + (i - (z.length - 1) / 2) * g * 1.08));
  });
}
function schachtTick(dt) {
  if (immun > 0) immun -= dt;
  (E.fans || []).forEach(f => {
    f.g.userData.rot.rotation.z += dt * 15;
    if (f.art === 'seite') f.g.position.x = Math.sin(zeit * f.w + f.ph) * .62;
    if (auto || immun > 0 || Math.abs(pos.z - f.z) > .42) return;
    const trifft = f.art === 'seite' ? Math.abs(pos.x - f.g.position.x) < f.r + .14 : pos.y > .62;
    if (trifft) { immun = .65; pos.z = Math.min(.5, f.z + 1.9); if (Welt.beiTreffer) Welt.beiTreffer(); }
  });
  if (E.endeZ !== null && E.endeZ !== undefined && pos.z < E.endeZ && Welt.beiEnde) { const f = Welt.beiEnde; Welt.beiEnde = null; f(); }
  if (E.folge) {
    E.fzeit += dt;
    const schrittNr = Math.floor(E.fzeit / E.takt), n = E.folge.length * 2 + 3, i = schrittNr % n;
    if (i !== E.fletzt) { E.fletzt = i; hebelTafel(i % 2 === 0 && i / 2 < E.folge.length ? E.folge[i / 2] : -1, Math.floor(i / 2) + 1); }
  }
  if (E.sG.g.visible && !E.feindNah) E.sG.g.position.y = .08 + Math.abs(Math.sin(zeit * 9)) * .1;
}
const ZEICHEN = ['★', '●', '▲', '■'];
function hebelTafel(sym, nr) {
  const c = E.hbT.image.getContext('2d'), w = 512, h = 256;
  c.fillStyle = '#100b08'; c.fillRect(0, 0, w, h); c.strokeStyle = '#e0ac3f'; c.lineWidth = 8; c.strokeRect(6, 6, w - 12, h - 12);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  if (sym >= 0) { c.fillStyle = '#a9dcc8'; c.font = "800 180px 'Baloo 2', sans-serif"; c.fillText(ZEICHEN[sym], w / 2, h / 2 + 14); c.fillStyle = '#ffd478'; c.font = '30px Bungee'; c.fillText(String(nr), 44, 44); }
  else { c.fillStyle = '#5a5146'; c.font = '36px Bungee'; c.fillText('...', w / 2, h / 2); }
  E.hbT.needsUpdate = true;
}

/* Ziele im Spiel: ort = Markierung, steh = wo man hinläuft, blick = wohin man schaut */
const Z = {
  rezeption: { id: 'rezeption', ort: [0, 1.95, -3.3], steh: [0, -1.9], blick: [0, 1.5, -3.2], weit: 'Zur Rezeption gehen', nah: 'Mit Herrn Freundlich sprechen', r: 2.3 },
  knopf: { id: 'knopf', ort: [.98, 1.75, -1.1], steh: [.45, -.6], blick: [.98, 1.3, -1.17], weit: 'Zum Knopf gehen', nah: 'Knopf 67 drücken', r: 1.4 },
  aussteigen: { id: 'aussteigen', ort: [0, 1.5, -1.1], steh: [0, -.75], blick: [0, 1.5, -1.2], weit: 'Zur Tür gehen', nah: 'Aussteigen', r: 1 },
  aufzug: { id: 'aufzug', ort: [7.6, 2.2, 0], steh: [6.6, 0], blick: [8, 1.5, 0], weit: 'Zum Aufzug gehen', nah: 'Aufzug nehmen', r: 2.3 },
  tuer67: { id: 'tuer67', ort: [0, 2.3, -8.7], steh: [0, -7.6], blick: [0, 1.5, -9], weit: 'Zu Raum 67 gehen', nah: 'Mit dem Schlüssel öffnen', r: 1.9 },
  klo: { id: 'klo', ort: [-2.5, 2.3, -10.5], steh: [-1.7, -10.5], blick: [-2.7, 1.3, -10.5], weit: 'Zum Klo gehen', nah: 'Aufs Klo gehen', r: 1.7 },
  bild: { id: 'bild', ort: [-.9, 2.3, -14.7], steh: [-.9, -13.5], blick: [-.9, 1.7, -15], weit: 'Zum Bild gehen', nah: 'Hinter das Bild schauen', r: 1.7 },
  kalender: { id: 'kalender', ort: [-2.5, 2.3, -12.2], steh: [-1.6, -12.2], blick: [-2.7, 1.75, -12.2], weit: 'Zum Kalender gehen', nah: 'Kalender ansehen', r: 1.7 },
  bett: { id: 'bett', ort: [1.85, 1.5, -12.6], steh: [.45, -12.1], blick: [1.8, .7, -12.7], weit: 'Zum Bett gehen', nah: 'Ins Bett legen', r: 1.8 },
  spion: { id: 'spion', ort: [0, 2.15, -9.3], steh: [0, -10], blick: [0, 1.6, -9], weit: 'Zur Tür gehen', nah: 'Durch den Türspion schauen', r: 1.7 },
  gitter: { id: 'gitter', ort: [-2.4, 1.1, -14.1], steh: [-1.7, -14], blick: [-2.7, .55, -14.1], weit: 'Zum Lüftungsgitter gehen', nah: 'Gitter aufschrauben', r: 1.7 }
};

/* ---------- Eingaben ---------- */
function eingaben(el) {
  const fuer = e => { if (e.pointerType === 'touch') document.body.classList.add('touch'); };
  el.addEventListener('pointerdown', e => {
    fuer(e); el.setPointerCapture(e.pointerId);
    const rb = el.getBoundingClientRect();
    if (e.pointerType === 'touch' && e.clientX - rb.left < rb.width * .45 && e.clientY - rb.top > rb.height * .45 && stick.id === null) {
      stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; return;
    }
    if (blick.id === null) { blick.id = e.pointerId; blick.x = e.clientX; blick.y = e.clientY; }
  });
  el.addEventListener('pointermove', e => {
    if (e.pointerId === stick.id) {
      const dx = e.clientX - stick.ox, dy = e.clientY - stick.oy, n = Math.min(1, Math.hypot(dx, dy) / 50), w = Math.atan2(dy, dx);
      stick.x = Math.cos(w) * n; stick.y = Math.sin(w) * n;
      const k = document.querySelector('#stick i'); if (k) k.style.transform = `translate(${stick.x * 34}px,${stick.y * 34}px)`;
    } else if (e.pointerId === blick.id && frei) {
      yaw -= (e.clientX - blick.x) * .0052; pitch = Math.max(-1.2, Math.min(1.2, pitch - (e.clientY - blick.y) * .0042));
      blick.x = e.clientX; blick.y = e.clientY;
    }
  });
  const los = e => {
    if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; const k = document.querySelector('#stick i'); if (k) k.style.transform = ''; }
    if (e.pointerId === blick.id) blick.id = null;
  };
  el.addEventListener('pointerup', los); el.addEventListener('pointercancel', los);
  addEventListener('keydown', e => { if (e.target && e.target.tagName === 'INPUT') return; tasten[e.key.toLowerCase()] = true; });
  addEventListener('keyup', e => { tasten[e.key.toLowerCase()] = false; });
  addEventListener('blur', () => { for (const k in tasten) tasten[k] = false; });
}
function darf(x, z) {
  const o = orte[ort], R = .28;
  if (!o.frei.some(([a, b, c, d]) => x >= a && x <= b && z >= c && z <= d)) return false;
  return !o.block.some(([a, b, c, d]) => x > a - R && x < b + R && z > c - R && z < d + R);
}
function bewege(dt) {
  let v = 0, s = 0, d = 0;
  if (tasten.w || tasten.arrowup) v += 1; if (tasten.s || tasten.arrowdown) v -= 1;
  if (tasten.a) s -= 1; if (tasten.d) s += 1;
  if (tasten.arrowleft) d += 1; if (tasten.arrowright) d -= 1;
  yaw += d * dt * 1.9;
  v -= stick.y; s += stick.x;
  const n = Math.hypot(v, s); if (n > 1) { v /= n; s /= n; }
  if (n < .03) return false;
  const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = tempoJetzt * dt;
  const dx = (-sy * v + cy * s) * sp, dz = (-cy * v - sy * s) * sp;
  if (darf(pos.x + dx, pos.z)) pos.x += dx;
  if (darf(pos.x, pos.z + dz)) pos.z += dz;
  return true;
}
const winkelNorm = a => Math.atan2(Math.sin(a), Math.cos(a));
const yawZu = (x, z) => Math.atan2(-(x - pos.x), -(z - pos.z));

/* ---------- Hauptschleife ---------- */
function schleife() {
  const dt = Math.min(.12, uhr.getDelta());
  const halt = typeof pausiert !== 'undefined' && pausiert;
  if (!halt) {
    zeit += dt;
    for (let i = tweens.length - 1; i >= 0; i--) {
      const t = tweens[i]; t.a += dt; const k = Math.min(1, t.a / t.d), e = k * k * (3 - 2 * k);
      t.f(e); if (k >= 1) { tweens.splice(i, 1); t.ok(); }
    }
    let lauf = false;
    if (auto) {
      const dx = auto.z[0] - pos.x, dz = auto.z[1] - pos.z, l = Math.hypot(dx, dz);
      const dw = winkelNorm(yawZu(auto.z[0], auto.z[1]) - yaw);
      if (l > .06) yaw += dw * Math.min(1, dt * 6);
      if (l < .07) { const a = auto; auto = null; a.ok(); }
      else { const sp = Math.min(l, TEMPO * 1.25 * dt); pos.x += dx / l * sp; pos.z += dz / l * sp; lauf = true; }
    } else if (frei) lauf = bewege(dt);
    if (lauf) { schritt += dt * 9; if (Math.floor(schritt / Math.PI) !== schrittAlt) { schrittAlt = Math.floor(schritt / Math.PI); if (Welt.beiSchritt) Welt.beiSchritt(ort === 'schacht'); } }
    pos.y += ((ort === 'schacht' ? (duckt || tasten.c || tasten.control ? .42 : .86) : augeZiel) - pos.y) * Math.min(1, dt * 11);
    if (ort === 'schacht') schachtTick(dt);
    if (titelModus) {
      const w = zeit * .13; pos.set(Math.sin(w) * 1.2, 1.5, -1.5 + Math.cos(w) * .3); yaw = yawZu(0, -3.3) ; pitch = -.03;
    }
    kamera.position.set(pos.x, pos.y + (lauf ? Math.sin(schritt) * .022 : 0), pos.z);
    kamera.rotation.set(pitch, yaw, 0, 'YXZ');
    /* Figuren */
    const g = ort === 'lobby' ? lobbyGlocke : glocke;
    if (g) {
      const h = E.spricht ? Math.abs(Math.sin(zeit * 9)) * .05 : Math.sin(zeit * 2) * .004;
      if (g === lobbyGlocke) { g.g.position.y = 1.15 + h; g.g.rotation.z = E.spricht ? Math.sin(zeit * 11) * .05 : 0; }
    }
    if (toni && toni.g.visible) {
      const w = E.tempo || 0;
      toni.arme[0].rotation.x = Math.sin(zeit * w) * .4; toni.arme[1].rotation.x = -Math.sin(zeit * w) * .4;
      const b = E.laeuft ? Math.sin(zeit * 12) * .6 : 0; toni.beine[0].rotation.x = b; toni.beine[1].rotation.x = -b;
    }
    if (glocke && glocke.g.visible && E.laeuft) glocke.g.position.y = .55 + Math.abs(Math.sin(zeit * 12)) * .2;
    /* Flackern */
    if (nachtModus && E.flurL) E.flurL.forEach((f, i) => {
      const a = Math.sin(zeit * 17 + i * 3) * Math.sin(zeit * 5.3 + i) > .28 ? .08 : .55;
      f.l.intensity = f.st * a; f.gl.material.opacity = a;
    });
    if (wild) { const a = Math.sin(zeit * 21) * Math.sin(zeit * 6.7) > .25 ? .3 : 1; E.lobbyLicht.forEach(l => { l.userData.st === undefined && (l.userData.st = l.intensity); l.intensity = l.userData.st * a * .6; }); }
    /* Ziele */
    let beste = null, bd = 9, drin = null;
    ziele.forEach((z, i) => {
      const m = marken[i], d = Math.hypot(z.steh[0] - pos.x, z.steh[1] - pos.z), d2 = Math.hypot(z.ort[0] - pos.x, z.ort[2] - pos.z);
      m.scale.setScalar(.2 + Math.sin(zeit * 4) * .03); m.position.y = z.ort[1] + Math.sin(zeit * 2.6) * .05;
      if (Math.min(d, d2) < z.r && Math.min(d, d2) < bd) { bd = Math.min(d, d2); beste = z.id; }
      if (z.auto && d < .55 && !auto) drin = z.id;
    });
    if (beste !== nahId) { nahId = beste; if (Welt.beiNah) Welt.beiNah(nahId); }
    if (drin && Welt.beiBetreten) Welt.beiBetreten(drin);
  }
  if (document.body.classList.contains('d3')) r.render(szene, kamera);
  requestAnimationFrame(schleife);
}
function groesse() {
  const el = r.domElement.parentElement, w = el.clientWidth || innerWidth, h = el.clientHeight || innerHeight;
  r.setSize(w, h, false); kamera.aspect = w / h; kamera.fov = E.fov || (w < h ? 78 : 66); kamera.updateProjectionMatrix();
}
const markeMat = () => new THREE.SpriteMaterial({
  map: tex(64, 64, (c) => { c.translate(32, 32); c.rotate(Math.PI / 4); c.fillStyle = '#ffd478'; c.strokeStyle = '#20100e'; c.lineWidth = 4; c.fillRect(-15, -15, 30, 30); c.strokeRect(-15, -15, 30, 30); }), depthTest: false, transparent: true
});

/* ---------- Schnittstelle ---------- */
export const Welt = {
  Z, beiNah: null, beiBetreten: null, beiEnde: null, beiTreffer: null, beiSchritt: null,
  start(el, grafikEinfach) {
    einfach = grafikEinfach;
    try { r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
    catch (e) { return false; }
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    Welt.grafik(grafikEinfach);
    el.append(r.domElement);
    szene = new THREE.Scene(); szene.background = new THREE.Color(0);
    kamera = new THREE.PerspectiveCamera(66, 1, .05, 60); uhr = new THREE.Clock();
    env = umgebung();
    szene.add(kamera);
    baueLobby(); baueAufzug(); baueFlur(); baueZimmer(); baueSchacht();
    glocke = baueGlocke(); toni = baueToni();
    E.sG = baueGlocke(); E.sG.setz(1); E.sG.g.visible = false; orte.schacht.g.add(E.sG.g);
    orte.flur.g.add(glocke.g, toni.g); glocke.g.visible = toni.g.visible = false;
    Object.values(orte).forEach(o => { o.g.visible = false; szene.add(o.g); });
    /* Zimmer und Flur gehören zusammen (für den Türspion) */
    eingaben(el); addEventListener('resize', groesse); new ResizeObserver(groesse).observe(el); groesse(); stock(1);
    Welt.ort('lobby', 0, 5.2, 0);
    schleife();
    return true;
  },
  grafik(e) {
    einfach = e; r.setPixelRatio(Math.min(devicePixelRatio || 1, e ? 1 : 1.6));
    if (szene) szene.traverse(o => { if (o.isSpotLight) o.castShadow = !e; });
  },
  ort(n, x, z, ry) {
    ort = n; Object.values(orte).forEach(o => { o.g.visible = false; });
    orte[n].g.visible = true;
    if (n === 'flur' || n === 'zimmer') { orte.flur.g.visible = orte.zimmer.g.visible = true; szene.fog = orte.flur.g.fog; }
    else szene.fog = orte[n].g.fog || null;
    pos.set(x, n === 'schacht' ? .86 : AUGE, z); yaw = ry; pitch = 0; titelModus = false; if (n !== 'flur') E.fov = 0;
    groesse();
  },
  titel() { Welt.ort('lobby', 0, -1.6, 0); titelModus = true; frei = false; },
  frei(b) { frei = b; },
  spricht(b) { E.spricht = b; },
  ziele(l) {
    marken.forEach(m => { m.parent && m.parent.remove(m); }); marken = []; ziele = l; nahId = null;
    l.forEach(z => { const m = new THREE.Sprite(markeMat()); m.position.set(...z.ort); m.renderOrder = 10; orte[ort].g.add(m); marken.push(m); });
  },
  nah() { return nahId; },
  wo() { return [pos.x, pos.z]; },
  stopp() { auto = null; frei = false; tweens.length = 0; Welt.ziele([]); E.spricht = false; E.fans = []; E.endeZ = null; E.folge = null; if (E.sG) Welt.feindWeg(); tempoJetzt = TEMPO; },
  hin(z) { return new Promise(ok => { auto = { z: z.steh, ok }; }); },
  fokus(p, ms = 500) {
    const y0 = yaw, p0 = pitch, ziel = yawZu(p[0], p[2]), dw = winkelNorm(ziel - y0), pz = Math.atan2(p[1] - pos.y, Math.hypot(p[0] - pos.x, p[2] - pos.z));
    return Welt.tween(ms, e => { yaw = y0 + dw * e; pitch = p0 + (pz - p0) * e; });
  },
  tween(ms, f) { return new Promise(ok => tweens.push({ a: 0, d: ms / 1000, f, ok })); },
  stock,
  schachtStart() { Welt.ort('schacht', 0, 0, 0); duckt = false; immun = 0; },
  ducken(b) { duckt = b === undefined ? !duckt : b; return duckt; },
  tempoSetzen(f) { tempoJetzt = TEMPO * f; },
  jaeger(l) {
    const z = pos.z + 1.7 + (100 - l) / 100 * 15;
    E.sG.g.visible = z < .5; E.sG.g.position.x = 0; E.sG.g.position.z = z; E.sG.g.rotation.y = Math.PI;
  },
  feindVorne() {
    E.feindNah = true; const f = 1.35; E.sG.g.visible = true;
    E.sG.g.position.set(pos.x - Math.sin(yaw) * f, .06, pos.z - Math.cos(yaw) * f); E.sG.g.rotation.y = yaw; E.sG.g.scale.setScalar(1.25);
    pitch = 0;
  },
  feindWeg() { E.feindNah = false; E.sG.g.scale.setScalar(1); E.sG.g.visible = false; },
  gitterZu(i) { E.gZu[i].visible = true; E.gSchild[i].material.color.set(0x7a3030); },
  hebel(i) { const a = E.hebelM[i]; return Welt.tween(320, e => { a.rotation.x = -.7 + Math.sin(e * Math.PI) * 1.4; }); },
  lukeAuf() { E.luke.visible = true; },
  abschnitt(c) {
    const o = orte.schacht; auto = null;
    if (E.sek) { o.g.remove(E.sek); E.sek.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material && m.material.map && m.material.frisch) m.material.map.dispose(); }); }
    const s = new THREE.Group(); E.sek = s; o.g.add(s);
    E.fans = []; E.endeZ = null; E.folge = null; E.gZu = []; E.gSchild = []; E.hebelM = [];
    const an = !c.dunkel, st = an ? 5 : 0, D = 2.4, H = 1.5, L = c.typ === 'fans' ? 6 + c.n * 5 : 9;
    E.sLicht.forEach(l => { l.intensity = st; }); E.sLicht[0].position.z = -2; E.sLicht[1].position.z = -L * .55; E.sLicht[2].position.z = -L - 2;
    E.sHemi.intensity = an ? .3 : .045; E.fackel.intensity = c.lampe ? 34 : 0;
    schachtKanal(s, 1, -L, D, H); schachtLampen(s, 1, -L, H, an);
    flaeche(D, H, E.sW, 0, H / 2, 1, s, 1, 1, Math.PI);
    const ziele = [];
    if (c.typ === 'fans') {
      flaeche(D, H, E.sW, 0, H / 2, -L - .8, s, 1, 1);
      schachtKanal(s, -L, -L - .8, D, H);
      const hl = new THREE.MeshBasicMaterial({ color: 0x000000 }); flaeche(2, 1.4, hl, 0, .016, -L - .1, s, 1, 1, 0, -Math.PI / 2);
      box(2.1, .03, .07, M({ color: 0xe0ac3f, roughness: .4 }), 0, .02, -L + .62, s, { schatten: false });
      o.frei = [[-.9, .9, -L - .5, .7]]; o.block = []; E.endeZ = -L + .25;
      ziele.push({ id: 'ausgang', ort: [0, 1, -L], steh: [0, -L], r: .4, weit: 'Zum Ausgang', nah: 'Weiter' });
      for (let i = 0; i < c.n; i++) {
        const z = -5 - i * 5, geduckt = i % 3 === 1;
        if (geduckt) {
          [-.74, 0, .74].forEach(x => { const f = baueFan(.38); f.position.set(x, 1.1, z); s.add(f); E.fans.push({ g: f, z, art: 'oben', r: .38 }); });
          box(D, .04, .08, E.sR, 0, .72, z, s, { schatten: false });
        } else {
          const f = baueFan(.62); f.position.set(0, .75, z); s.add(f); E.fans.push({ g: f, z, art: 'seite', r: .62, w: c.tempo, ph: i * 2.1 });
        }
      }
    } else {
      const Kb = 9.2, Kh = 2.5, z0 = -L, z1 = -L - 6;
      flaeche(Kb, 6, E.sB, 0, 0, z0 - 3, s, Kb / 2, 3, 0, -Math.PI / 2); flaeche(Kb, 6, E.sW, 0, Kh, z0 - 3, s, Kb / 2, 3, 0, Math.PI / 2);
      flaeche(6, Kh, E.sW, -Kb / 2, Kh / 2, z0 - 3, s, 3, Kh / 2, Math.PI / 2); flaeche(6, Kh, E.sW, Kb / 2, Kh / 2, z0 - 3, s, 3, Kh / 2, -Math.PI / 2);
      wandMitLoch(s, z0, Kb, Kh, D, H); flaeche(Kb, Kh, E.sW, 0, Kh / 2, z1, s, Kb / 2, Kh / 2);
      if (an) { zyl(.24, .24, .05, E.sL, 0, Kh - .03, z0 - 3, s, { schatten: false }); glueh(s, 0, Kh - .12, z0 - 3, 2.4); }
      o.frei = [[-.9, .9, z0 - .1, .7], [-4.2, 4.2, z1 + .3, z0 - .1]]; o.block = [];
      if (c.typ === 'quiz') {
        c.antworten.forEach((a, i) => {
          const x = -3.3 + i * 2.2;
          flaeche(1.5, 1.3, new THREE.MeshBasicMaterial({ color: 0x010102 }), x, .66, z1 + .02, s);
          box(1.66, .08, .08, E.sR, x, 1.34, z1 + .05, s, { schatten: false }); box(.08, 1.34, .08, E.sR, x - .8, .67, z1 + .05, s, { schatten: false }); box(.08, 1.34, .08, E.sR, x + .8, .67, z1 + .05, s, { schatten: false });
          const m = new THREE.MeshBasicMaterial({ map: schildZeile(a) }); m.frisch = true;
          const sc = flaeche(1.9, .62, m, x, 1.82, z1 + .03, s); E.gSchild.push(sc);
          const zu = new THREE.Group(); zu.visible = false; zu.position.set(x, .66, z1 + .07); s.add(zu); E.gZu.push(zu);
          for (let k = 0; k < 7; k++) box(.05, 1.3, .05, M({ color: 0x8a2a2a, metalness: .7, roughness: .4 }), -.66 + k * .22, 0, 0, zu, { schatten: false });
          ziele.push({ id: 'a' + i, ort: [x, 1.5, z1 + .3], steh: [x, z1 + .55], r: 1.25, auto: true, weit: 'Zu: ' + a, nah: 'Hier hinein: ' + a });
        });
      } else {
        E.hbT = tex(512, 256, () => {}); const m = new THREE.MeshBasicMaterial({ map: E.hbT }); m.frisch = true; E.fletzt = -1; hebelTafel(-1, 0);
        flaeche(2.6, 1.3, m, 0, 1.75, z1 + .03, s);
        [-3, -1, 1, 3].forEach((x, i) => {
          box(.6, .9, .1, E.sR, x, .7, z1 + .06, s);
          const sch = new THREE.MeshBasicMaterial({ map: tex(128, 128, q => { q.fillStyle = '#14100c'; q.fillRect(0, 0, 128, 128); q.fillStyle = '#a9dcc8'; q.font = "800 96px 'Baloo 2', sans-serif"; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText(ZEICHEN[i], 64, 72); }) }); sch.frisch = true;
          flaeche(.5, .5, sch, x, 1.4, z1 + .04, s);
          const a = new THREE.Group(); a.position.set(x, .5, z1 + .14); a.rotation.x = -.7; s.add(a); E.hebelM.push(a);
          zyl(.03, .03, .55, M({ color: 0xc9d0d6, metalness: 1, roughness: .3 }), 0, .27, 0, a, { seg: 10 }); kug(.075, M({ color: [0xc23b3b, 0xd9a441, 0x2c8a5a, 0x3f6fa8][i], roughness: .35 }), 0, .56, 0, a);
          ziele.push({ id: 'h' + i, ort: [x, 1.5, z1 + .4], steh: [x, z1 + 1], r: 1.15, weit: 'Zu Hebel ' + ZEICHEN[i], nah: 'Hebel ' + ZEICHEN[i] + ' umlegen' });
        });
        E.luke = flaeche(1.6, 1.6, new THREE.MeshBasicMaterial({ color: 0 }), 0, .014, z0 - 2.4, s, 1, 1, 0, -Math.PI / 2); E.luke.visible = false;
        ziele.push({ id: 'luke', ort: [0, 1, z0 - 2.4], steh: [0, z0 - 2.4], r: 1, auto: true, weit: 'Zur Luke', nah: 'In die Luke springen', spaeter: true });
        E.takt = c.takt; E.fzeit = 0; E.folge = c.folge;
      }
    }
    if (c.fund) {
      const sx = c.fund.seite * .78, z = -3;
      box(.34, .24, .26, M({ color: 0xd9a441, metalness: .3, roughness: .45 }), sx, .14, z, s); E.fundG = glueh(s, sx, .32, z, .7, 0x88aa66);
      ziele.push({ id: 'fund', ort: [sx, .62, z], steh: [sx * .5, z], r: 1.15, weit: 'Zu: ' + c.fund.n, nah: c.fund.nah });
    }
    if (c.ei) {
      const m = new THREE.MeshBasicMaterial({ map: tex(128, 128, q => { q.fillStyle = '#efe6cf'; q.fillRect(0, 0, 128, 128); q.fillStyle = '#2a1a14'; for (let i = 0; i < 6; i++) q.fillRect(14, 20 + i * 16, 80 + i * 4, 5); }) }); m.frisch = true;
      flaeche(.34, .34, m, 1.16, .8, -6.5, s, 1, 1, -Math.PI / 2);
      ziele.push({ id: 'ei', ort: [1, 1.2, -6.5], steh: [.5, -6.5], r: 1.05, weit: 'Zur Notiz', nah: 'Notiz lesen' });
    }
    pos.set(0, .86, 0); yaw = 0; pitch = 0; duckt = false;
    return { ziele };
  },
  kabine(auf) { const a = auf ? 0 : 1; return Welt.tween(900, e => { const k = auf ? e : 1 - e; E.kT[0].position.x = -.47 - k * .9; E.kT[1].position.x = .47 + k * .9; }); },
  lobbyTuer(auf) { return Welt.tween(800, e => { const k = auf ? e : 1 - e; E.lT[0].position.z = -.5 - k * .96; E.lT[1].position.z = .5 + k * .96; }); },
  kalender(b) { E.kalM.map = b ? E.kal1 : E.kal0; E.kalM.needsUpdate = true; },
  bildWeg() { return Welt.tween(600, e => { E.bild.rotation.z = -e * 1.25; }); },
  zustand(o) {
    nachtModus = !!o.nacht; wild = !!o.wild;
    E.kalM.map = o.kalender ? E.kal1 : E.kal0; E.kalM.needsUpdate = true;
    E.bild.rotation.z = o.bildWeg ? -1.25 : 0;
    E.risse.forEach(m => { m.visible = false; }); E.schrauben.forEach(m => { m.visible = true; }); E.gitter.rotation.z = 0;
    E.zimmerS.intensity = o.nacht ? 0 : 34; E.zimmerP.intensity = o.nacht ? 0 : 6; E.lampe.intensity = o.nacht ? 0 : 3.5;
    E.lampeG.visible = !o.nacht; E.schirmM.emissiveIntensity = o.nacht ? 0 : 1.5;
    E.mond.intensity = o.nacht ? 40 : 0; E.hemiZ.intensity = o.nacht ? .09 : .34; E.hemiF.intensity = o.nacht ? .07 : .22;
    E.tuerSpalt.material.opacity = o.nacht ? .9 : 0; E.flurS.intensity = o.nacht ? 8 : 40;
    E.flurL.forEach(f => { f.l.intensity = f.st; f.gl.material.opacity = 1; });
    E.schildM.map = E.schildM.emissiveMap = o.wild ? E.schildW : E.schildF; E.schildM.needsUpdate = true; E.schild.rotation.z = o.wild ? .07 : 0;
    lobbyGlocke.setz(o.wild ? .85 : 0);
    if (!o.wild) E.lobbyLicht.forEach(l => { if (l.userData.st !== undefined) l.intensity = l.userData.st; });
    glocke.g.visible = toni.g.visible = false;
  },
  /* Blick durch den Türspion */
  spion(an) {
    document.getElementById('spion3d').classList.toggle('an', an);
    if (an) { E.alt = [pos.x, pos.z, yaw, pitch, ort]; pos.set(0, AUGE, -8.75); yaw = Math.PI; pitch = 0; E.fov = 92; ort = 'flur'; }
    else { pos.set(E.alt[0], AUGE, E.alt[1]); yaw = E.alt[2]; pitch = E.alt[3]; ort = E.alt[4]; E.fov = 0; }
    groesse();
  },
  figuren(z, feind, sichtbar = true) {
    glocke.g.visible = toni.g.visible = sichtbar;
    toni.g.position.set(-.5, 0, z); toni.g.rotation.y = Math.PI;
    glocke.g.position.set(.42, .55, z); glocke.g.rotation.y = Math.PI; glocke.g.scale.setScalar(1.6);
    if (feind !== undefined) glocke.setz(feind);
  },
  schauen(a, b) { toni.g.rotation.y = a; glocke.g.rotation.y = b; },
  tempo(w, l) { E.tempo = w; E.laeuft = l; },
  sprung(sanft) {
    const z = sanft ? -7.1 : -7.8; glocke.setz(1); glocke.g.visible = toni.g.visible = true;
    toni.g.position.set(-.34, sanft ? -.1 : -.1, z); toni.g.rotation.y = Math.PI;
    glocke.g.position.set(.2, sanft ? .62 : .7, z - .1); glocke.g.rotation.y = Math.PI; glocke.g.scale.setScalar(sanft ? 2.1 : 2.3);
    E.tempo = 18; E.laeuft = false;
  },
  figurenWeg() { glocke.g.visible = toni.g.visible = false; },
  wackeln(st) { if (E.tuer) { const x = E.tuer.position.z; Welt.tween(160, e => { E.tuer.position.z = x + Math.sin(e * 18) * .012 * st * (1 - e); }); } },
  risse(n) { E.risse.forEach((m, i) => { m.visible = i < n; }); },
  schraube(n) { E.schrauben.forEach((m, i) => { m.visible = i >= n; }); },
  gitterFaellt() { return Welt.tween(500, e => { E.gitter.rotation.z = e * .5; }); }
};
