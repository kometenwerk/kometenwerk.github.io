/* Hotel Freundlich: Die Nacht von Raum 67 – FLARESSA Gaming
   Testversion: 1 Spieler, Rezeption, Raum 67, 10 Schacht-Abschnitte, Endlos-Modus.
   Alle Figuren, Texte, Bilder und Töne sind hier im Code selbst erzeugt. */
'use strict';

/* ---------- Spielstand ---------- */
let WELT = null, aktFertig = null;
const SPEICHER = 'flaressa-hotel-freundlich';
const STANDARD = {
  name: '', haar: 'scheitel', pyjama: 'blau', haut: 1,
  coins: 0, besitz: [], enden: {}, rekord: 0,
  schreck: true, ton: true, musik: true, zeit: 'normal', einfach: false, autoLauf: false
};
let spar = Object.assign({}, STANDARD);
try { spar = Object.assign(spar, JSON.parse(localStorage.getItem(SPEICHER) || '{}')); } catch (e) { /* ohne Speicher spielen */ }
function sichern() { try { localStorage.setItem(SPEICHER, JSON.stringify(spar)); } catch (e) { /* egal */ } }
const RUHIG = matchMedia('(prefers-reduced-motion: reduce)').matches;

const HAARE = [
  { id: 'scheitel', n: 'Scheitel', p: 0 }, { id: 'igel', n: 'Igel', p: 0 }, { id: 'zoepfe', n: 'Zöpfe', p: 0 },
  { id: 'wolke', n: 'Wolke', p: 15 }, { id: 'kamm', n: 'Hahnenkamm', p: 25 }, { id: 'muetze', n: 'Duschhaube', p: 40 }
];
const PYJAMAS = [
  { id: 'blau', n: 'Hotel-Blau', p: 0, f: '#3f6fa8', s: '#2b4f7d' }, { id: 'streifen', n: 'Streifen', p: 0, f: '#e8e2d2', s: '#8a4a5a' },
  { id: 'gruen', n: 'Moosgrün', p: 0, f: '#4f8a5c', s: '#35643f' }, { id: 'pink', n: 'Knallpink', p: 15, f: '#e8589b', s: '#b52f72' },
  { id: 'gold', n: 'Gold', p: 30, f: '#e0ac3f', s: '#a87b1f' }, { id: 'nacht', n: 'Sternennacht', p: 40, f: '#26275e', s: '#f6d27a' }
];
const HAUT = ['#f5d3b5', '#e0ac82', '#b87a4f', '#7a4a2e'];
const BERUFE = {
  wiss: { n: 'Wissenschaftler', f: 'Streicht mit der Ehrlichen Linse 3-mal eine falsche Antwort.', b: 'Sieht vorher, welche Prüfung kommt.' },
  tech: { n: 'Techniker', f: 'Überspringt einmal pro Flucht eine Prüfung.', b: '0,5 Sekunden mehr Zeit bei jeder Prüfung.' },
  body: { n: 'Bodyguard', f: 'Verrammelt einmal pro Flucht das Gitter: Lärm fällt auf 0.', b: 'Ein Extra-Leben.' },
  meme: { n: 'Meme-Influencer', f: 'Lenkt 2-mal ab: Die nächste Prüfung gibt 50 % mehr Zeit.', b: 'Findet mehr Gegenstände und Easter Eggs.' }
};
const DINGE = {
  lampe: { n: 'Taschenlampe', t: 'In dunklen Abschnitten hast du damit die volle Zeit.', frei: true },
  wd40: { n: 'WD-40', t: 'Die nächsten 3 Rutschen sind lautlos.' },
  drink: { n: 'Energy-Drink', t: '1 Sekunde mehr Zeit bei der nächsten Prüfung.' },
  fetzen: { n: 'Kalender-Fetzen', t: 'Verwirrt Herrn Feindlich: 30 weniger Lärm.' }
};
const FRAGEN = [
  ['Was kostet eine Nacht im Hotel Freundlich?', '67,67 € Spielgeld', '6,70 €', '67 Hotel-Coins', 'Ein Lächeln'],
  ['Was besitzt Franz laut Herrn Freundlich?', '3 Euro und einen Knopf', 'Ein Hotel', 'Eine Kuh', 'Paris'],
  ['Warum antwortet die Kuh an der Rezeption nicht?', 'Sie hat heute frei', 'Sie schläft in Raum 67', 'Sie ist ein Hausmeister', 'Sie ist verreist'],
  ['Was ist eine Flitzpiepe?', 'Jemand, der Unsinn macht', 'Ein Musikinstrument', 'Ein Lüftungsrohr', 'Eine Hotelklingel'],
  ['Welches Geräusch macht Herr Freundlich?', 'Ding!', 'Muh!', 'Bumm!', 'Pock!'],
  ['Welche Zahl kommt als Nächstes? 2, 4, 8, 16, ...', '32', '18', '24', '64'],
  ['Wie viel ist 6 × 7?', '42', '67', '36', '48'],
  ['Wie viel ist 67 − 19?', '48', '58', '46', '38'],
  ['Der Aufzug fährt von Etage 67 nach Etage 60. Wie viele Etagen sind das?', '7', '6', '8', '60'],
  ['Wenn gestern Montag war, welcher Tag ist morgen?', 'Mittwoch', 'Dienstag', 'Donnerstag', 'Sonntag'],
  ['Trommel-Toni hat 2 Stöcke. Wie viele Stöcke haben 3 Tonis?', '6', '5', '3', '9'],
  ['Was wiegt mehr: 1 kg Federn oder 1 kg Schrauben?', 'Beides gleich viel', 'Die Schrauben', 'Die Federn', 'Kommt auf das Hotel an'],
  ['Wie viele Monate im Jahr haben mindestens 28 Tage?', 'Alle 12', 'Nur einer', '6', '11'],
  ['Eine Taschenlampe braucht 2 Batterien. Du hast 9. Für wie viele Lampen reicht es?', '4', '5', '3', '18'],
  ['Was ist die Hälfte von 67?', '33,5', '33', '34', '32,5'],
  ['Welcher Monat kommt nach dem November?', 'Dezember', 'Oktober', 'Januar', 'September'],
  ['Du bist in Etage 40. Wie viele Etagen sind es noch bis Etage 1?', '39', '40', '41', '38'],
  ['Wie viele Ecken haben zwei Dreiecke zusammen?', '6', '3', '5', '8'],
  ['Was ist mehr: ein Drittel oder ein Viertel einer Pizza?', 'Ein Drittel', 'Ein Viertel', 'Beides gleich', 'Keins von beiden'],
  ['Welches Wort entsteht aus den Buchstaben L, I, K, N, G, E, L?', 'Klingel', 'Kugel', 'Engel', 'Klinge'],
  ['Wie viele Buchstaben hat das Wort HAUSMEISTER?', '11', '10', '12', '9'],
  ['Welches Wort passt nicht in die Reihe?', 'Kühlschrank', 'Aufzug', 'Rolltreppe', 'Treppe'],
  ['Was brauchst du, um ein Gitter aufzuschrauben?', 'Einen Schraubenzieher', 'Eine Trommel', 'Einen Kalender', 'Ein Kissen'],
  ['Du gibst 70 € für 67,67 €. Wie viel Wechselgeld bekommst du?', '2,33 €', '3,33 €', '2,67 €', '3,67 €']
];

/* ---------- DOM und Grundgerüst ---------- */
const $ = id => document.getElementById(id);
const leinwand = $('bild'), c = leinwand.getContext('2d');
const W = 720, H = 540;
let szene = () => {}, T = 0, wackeln = 0, blendeWert = 0;
let pausiert = false, laufNr = 0, warter = [], offene = [], uhrAktiv = null, hotspots = [];

class Abbruch extends Error {}
function pruefe(nr) { if (nr !== laufNr) throw new Abbruch(); }
function abbrechen() {
  laufNr++;
  warter = []; uhrAktiv = null; tasteFn = null;
  if (WELT) WELT.stopp();
  document.body.classList.remove('laufen', 'schacht3d');
  aktFertig = null;
  const o = offene; offene = [];
  o.forEach(r => r(new Abbruch()));
}
function warte(ms) {
  return new Promise((ok, nein) => {
    const e = { rest: ms / 1000, ok, nein };
    warter.push(e); offene.push(nein);
  });
}
function offen(fn) {
  return new Promise((ok, nein) => { offene.push(nein); fn(ok); });
}
function passeGroesse() {
  const k = Math.min(2.5, (leinwand.clientWidth || W) * (window.devicePixelRatio || 1) / W);
  const b = Math.round(W * k), h = Math.round(H * k);
  if (leinwand.width !== b) { leinwand.width = b; leinwand.height = h; }
}
addEventListener('resize', passeGroesse);

let zuletzt = 0;
function bild(jetzt) {
  const dt = Math.min(0.3, (jetzt - zuletzt) / 1000 || 0); zuletzt = jetzt;
  if (!pausiert) {
    T += dt;
    warter = warter.filter(e => { e.rest -= dt; if (e.rest <= 0) { e.ok(); return false; } return true; });
    if (uhrAktiv) {
      uhrAktiv.rest -= dt;
      const a = Math.max(0, uhrAktiv.rest / uhrAktiv.ganz);
      $('uhr').firstElementChild.style.width = (a * 100) + '%';
      $('uhr').classList.toggle('knapp', a < .3);
      if (uhrAktiv.rest <= 0) { const f = uhrAktiv.fertig; uhrAktiv = null; f(); }
    }
    dingWarnung(dt);
    jagdTick(dt);
  }
  passeGroesse();
  const k = leinwand.width / W;
  c.setTransform(k, 0, 0, k, 0, 0);
  c.save();
  if (wackeln > 0 && !RUHIG && !spar.schreck) { c.translate((Math.random() - .5) * wackeln * 14, (Math.random() - .5) * wackeln * 14); }
  wackeln = Math.max(0, wackeln - dt * 2);
  c.clearRect(0, 0, W, H);
  szene(T);
  zeichneHotspots();
  c.restore();
  $('schwarz').style.opacity = Math.min(1, blendeWert);
  requestAnimationFrame(bild);
}
async function blende(ziel, ms = 400) {
  const nr = laufNr, von = blendeWert, n = Math.max(1, Math.round(ms / 40));
  for (let i = 1; i <= n; i++) { await warte(40); pruefe(nr); blendeWert = von + (ziel - von) * i / n; }
}
function zeichneHotspots() {
  hotspots.forEach(h => {
    if (!h.r) return;
    const [x, y, w, hh] = h.r, p = .5 + .5 * Math.sin(T * 4);
    c.strokeStyle = `rgba(246,210,122,${.45 + p * .5})`; c.lineWidth = 3;
    c.setLineDash([9, 7]); c.strokeRect(x, y, w, hh); c.setLineDash([]);
  });
}
leinwand.addEventListener('click', e => {
  const r = leinwand.getBoundingClientRect();
  const x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
  const h = hotspots.find(o => o.r && x >= o.r[0] && x <= o.r[0] + o.r[2] && y >= o.r[1] && y <= o.r[1] + o.r[3]);
  if (h) h.los();
  else { const w = $('knoepfe').querySelectorAll('button'); if (w.length === 1 && !w[0].disabled) w[0].click(); }
});

/* ---------- Tafel: Texte und Knöpfe ---------- */
function setzeText(wer, text) {
  $('wer').textContent = wer || ''; $('text').textContent = text || '';
}
function leere() { $('knoepfe').innerHTML = ''; $('knoepfe').className = ''; $('eigen').innerHTML = ''; hotspots = []; }
function knopf(t, opt = {}) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'knopf ' + (opt.art || '');
  b.textContent = t;
  if (opt.klein) { const s = document.createElement('small'); s.textContent = opt.klein; b.append(s); }
  if (opt.aria) b.setAttribute('aria-label', opt.aria);
  if (opt.aus) b.disabled = true;
  return b;
}
/* opts: [{t, w, r:[x,y,b,h], art, klein, aus}] – liefert w des gewählten Knopfs */
function wahl(opts, klasse) {
  const nr = laufNr; leere();
  if (klasse) $('knoepfe').className = klasse;
  return offen(ok => {
    const nimm = w => { if (nr !== laufNr) return; hotspots = []; Ton.klick(); ok(w); };
    opts.forEach((o, i) => {
      const b = knopf(o.t, o);
      b.addEventListener('click', () => nimm(o.w === undefined ? i : o.w));
      $('knoepfe').append(b);
      if (o.r) hotspots.push({ r: o.r, los: () => nimm(o.w === undefined ? i : o.w) });
    });
    const e = $('knoepfe').querySelector('button:not(:disabled)');
    if (e && !$('eigen').querySelector('input')) e.focus({ preventScroll: true });
  });
}
async function sag(wer, text, weiter = 'Weiter') {
  setzeText(wer, text);
  await wahl([{ t: weiter, w: 1 }]);
}
const HF = 'Herr Freundlich', HFE = 'Herr Feindlich';

/* ---------- Eingabe ---------- */
let tasteFn = null;
addEventListener('keydown', e => {
  if (pausiert || $('einst').open) return;
  const ziel = e.target;
  if (ziel && ziel.tagName === 'INPUT') return;
  if (tasteFn && tasteFn(e.key.toLowerCase())) { e.preventDefault(); return; }
  if (/^[1-9]$/.test(e.key)) {
    const b = $('knoepfe').querySelectorAll('button')[+e.key - 1];
    if (b && !b.disabled) b.click();
  }
});
$('pause').addEventListener('click', pauseZeigen);
$('duck').addEventListener('click', () => { if (WELT) $('duck').setAttribute('aria-pressed', WELT.ducken() ? 'true' : 'false'); });
document.addEventListener('visibilitychange', () => { if (document.hidden && !pausiert && laufendesSpiel) pauseZeigen(); });
let laufendesSpiel = false;

const dlg = $('einst');
function einstLaden() {
  $('e-auto').checked = spar.autoLauf; $('e-einfach').checked = spar.einfach; $('e-schreck').checked = spar.schreck; $('e-ton').checked = spar.ton; $('e-musik').checked = spar.musik;
  dlg.querySelectorAll('[name=zeit]').forEach(r => { r.checked = r.value === spar.zeit; });
}
dlg.addEventListener('change', () => {
  spar.schreck = $('e-schreck').checked; spar.ton = $('e-ton').checked; spar.musik = $('e-musik').checked;
  const z = dlg.querySelector('[name=zeit]:checked'); if (z) spar.zeit = z.value;
  spar.autoLauf = $('e-auto').checked; spar.einfach = $('e-einfach').checked; if (WELT) WELT.grafik(spar.einfach);
  sichern();
});
$('einst-zu').addEventListener('click', () => dlg.close());
function einstellungen() { einstLaden(); dlg.showModal(); return new Promise(ok => dlg.addEventListener('close', ok, { once: true })); }

function pauseZeigen() {
  if (pausiert) return;
  pausiert = true;
  const alt = [...$('knoepfe').childNodes], klasse = $('knoepfe').className, eigen = [...$('eigen').childNodes];
  const altW = $('wer').textContent, altT = $('text').textContent, altH = hotspots;
  hotspots = []; $('eigen').innerHTML = ''; $('knoepfe').className = ''; $('knoepfe').innerHTML = '';
  setzeText('Pause', 'Die Zeit steht still. Sogar im Hotel Freundlich.');
  const zurueck = () => {
    pausiert = false; $('knoepfe').innerHTML = ''; $('knoepfe').className = klasse;
    alt.forEach(n => $('knoepfe').append(n)); eigen.forEach(n => $('eigen').append(n)); hotspots = altH;
    setzeText(altW, altT);
    const b = $('knoepfe').querySelector('button:not(:disabled)'); if (b) b.focus({ preventScroll: true });
  };
  const a = knopf('Weiterspielen'); a.addEventListener('click', zurueck);
  const b = knopf('Einstellungen', { art: 'neben' }); b.addEventListener('click', () => einstellungen());
  const d = knopf('Zurück zum Titel', { art: 'leise' }); d.addEventListener('click', () => { pausiert = false; titel(); });
  $('knoepfe').append(a, b, d); a.focus({ preventScroll: true });
}

/* ---------- Ton: alles im Browser erzeugt, keine fremden Aufnahmen ---------- */
const Ton = (() => {
  let ac = null, master = null, musikGain = null, musikTimer = null, schritt = 0, verzerrt = false, rausch = null;
  function start() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const K = window.AudioContext || window.webkitAudioContext; if (!K) return;
    ac = new K(); master = ac.createGain(); master.gain.value = .8; master.connect(ac.destination);
    musikGain = ac.createGain(); musikGain.gain.value = .13; musikGain.connect(master);
    rausch = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = rausch.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const an = () => ac && spar.ton;
  function s(f, typ, von, dauer, laut, ziel) {
    if (!an()) return;
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + von;
    o.type = typ; o.frequency.setValueAtTime(f, t); if (ziel) o.frequency.exponentialRampToValueAtTime(ziel, t + dauer);
    g.gain.setValueAtTime(laut, t); g.gain.exponentialRampToValueAtTime(.0008, t + dauer);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dauer + .02);
  }
  function krach(von, dauer, laut, freq, ziel) {
    if (!an()) return;
    const q = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(), t = ac.currentTime + von;
    q.buffer = rausch; q.loop = true; fl.type = 'bandpass'; fl.Q.value = .8;
    fl.frequency.setValueAtTime(freq, t); if (ziel) fl.frequency.exponentialRampToValueAtTime(ziel, t + dauer);
    g.gain.setValueAtTime(.0008, t); g.gain.exponentialRampToValueAtTime(laut, t + Math.min(.08, dauer / 4)); g.gain.exponentialRampToValueAtTime(.0008, t + dauer);
    q.connect(fl); fl.connect(g); g.connect(master); q.start(t); q.stop(t + dauer + .05);
  }
  /* Eigener Walzer in a-Moll, nur für dieses Spiel geschrieben */
  const MELODIE = [69, 0, 72, 76, 0, 74, 72, 0, 71, 69, 0, 0, 67, 0, 71, 74, 0, 72, 71, 0, 69, 68, 0, 0, 69, 0, 72, 77, 0, 76, 74, 0, 72, 71, 0, 69];
  const BASS = [45, 52, 52, 45, 52, 52, 40, 47, 47, 40, 47, 47, 45, 52, 52, 41, 48, 48, 38, 45, 45, 40, 47, 47];
  function musikSchritt() {
    if (!ac || !spar.ton || !spar.musik) return;
    const m = MELODIE[schritt % MELODIE.length], b = BASS[Math.floor(schritt / 1.5) % BASS.length], t = ac.currentTime + .02;
    const hz = n => 440 * Math.pow(2, (n - 69 + (verzerrt ? Math.sin(schritt * .7) * .45 - 1 : 0)) / 12);
    const ton = (n, typ, l, d) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = typ; o.frequency.value = hz(n); g.gain.setValueAtTime(l, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
      o.connect(g); g.connect(musikGain); o.start(t); o.stop(t + d + .02);
    };
    if (m) ton(m, verzerrt ? 'sawtooth' : 'triangle', verzerrt ? .4 : .8, .34);
    if (schritt % 3 === 0) ton(b, 'sine', .8, .4);
    schritt++;
  }
  return {
    start, ding(laut = 1) {
      s(2093, 'sine', 0, 1.1, .22 * laut); s(3320, 'sine', 0, .7, .1 * laut); s(5230, 'sine', 0, .3, .05 * laut);
    },
    schrill() { for (let i = 0; i < 6; i++) { s(2400, 'square', i * .09, .08, spar.schreck ? .025 : .07); } },
    flush() { krach(0, 2.3, .55, 500, 2400); krach(.7, 1.9, .34, 1500, 300); s(150, 'sine', .3, 1.7, .14, 60); },
    bumm(laut = 1) { s(95, 'sine', 0, .34, .55 * laut, 42); krach(0, .09, .12 * laut, 900); },
    pock(laut = 1) { s(170, 'square', 0, .1, .22 * laut, 70); krach(0, .1, .22 * laut, 1100); },
    knack() { krach(0, .06, .14, 3000); krach(.09, .05, .1, 2200); },
    schreck() { const l = spar.schreck ? .25 : 1; krach(0, .7, .5 * l, 1900, 500); s(620, 'sawtooth', 0, .7, .2 * l, 140); },
    rutsch() { krach(0, 1.1, .12, 700, 1800); },
    gut() { s(660, 'triangle', 0, .13, .2); s(880, 'triangle', .1, .2, .2); },
    fehl() { s(170, 'sawtooth', 0, .34, .15, 92); },
    klick() { start(); s(1500, 'sine', 0, .035, .05); },
    hebel(i) { s([330, 415, 494, 587][i], 'triangle', 0, .22, .22); },
    tick() { s(1100, 'square', 0, .03, .04); },
    schritt(metall) { if (metall) { s(240 + Math.random() * 90, 'triangle', 0, .05, .06); krach(0, .04, .03, 1800); } else krach(0, .05, .035, 420); },
    musik(an_, ver) {
      verzerrt = !!ver; if (musikTimer) { clearInterval(musikTimer); musikTimer = null; }
      if (an_) { start(); musikTimer = setInterval(() => { if (!pausiert) musikSchritt(); }, verzerrt ? 400 : 260); }
    }
  };
})();

/* ---------- Zeichnen: Helfer ---------- */
function rr(x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function misch(a, b, t) {
  const p = s => [1, 3, 5].map(i => parseInt(s.substr(i, 2), 16));
  const A = p(a), B = p(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
function schrift(g, f = 'Bungee') { c.font = `${f === 'Bungee' ? 400 : 700} ${g}px '${f}', sans-serif`; }

/* Herr Freundlich / Herr Feindlich: eine sprechende Rezeptionsklingel */
function glocke(x, y, s, o = {}) {
  const f = o.feind || 0, wipp = o.spricht ? Math.abs(Math.sin(T * 9)) * 7 : Math.sin(T * 2) * 1.5;
  c.save(); c.translate(x, y - wipp * s); c.scale(s, s);
  if (o.dreh) c.rotate(o.dreh);
  const hell = misch('#f6d27a', '#3a3440', f), mitte = misch('#d79c33', '#19161f', f), tief = misch('#8d5f18', '#07060a', f);
  c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(0, 7 + wipp, 62, 8, 0, 0, 7); c.fill();
  c.fillStyle = tief; rr(-62, -10, 124, 16, 6); c.fill();
  c.fillStyle = mitte; rr(-56, -15, 112, 8, 4); c.fill();
  c.fillStyle = hell; rr(-7, -112, 14, 14, 4); c.fill();
  c.beginPath(); c.arc(0, -115, 9, 0, 7); c.fillStyle = mitte; c.fill();
  const g = c.createLinearGradient(-48, 0, 48, 0);
  g.addColorStop(0, hell); g.addColorStop(.42, mitte); g.addColorStop(1, tief);
  c.fillStyle = g; c.beginPath(); c.moveTo(-50, -14); c.bezierCurveTo(-52, -82, -24, -104, 0, -104); c.bezierCurveTo(24, -104, 52, -82, 50, -14); c.closePath(); c.fill();
  c.strokeStyle = `rgba(255,255,255,${.45 * (1 - f)})`; c.lineWidth = 5; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-33, -38); c.quadraticCurveTo(-36, -75, -14, -90); c.stroke();
  if (f > .35) {
    c.strokeStyle = `rgba(255,70,50,${(f - .35) * 1.5})`; c.lineWidth = 2.6; c.lineJoin = 'miter';
    [[-28, -90, -14, -72, -24, -58, -9, -46], [30, -84, 16, -66, 27, -52, 15, -38], [-4, -103, 4, -88, -3, -78]].forEach(p => {
      c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.stroke();
    });
  }
  const blink = !o.feind && Math.sin(T * 1.3 + x) > .985;
  if (f < .5) {
    c.fillStyle = '#fff'; [-19, 19].forEach(a => { c.beginPath(); c.ellipse(a, -66, 9.5, blink ? 1.5 : 11, 0, 0, 7); c.fill(); });
    c.fillStyle = '#20140c'; [-18, 20].forEach(a => { c.beginPath(); c.arc(a, -64, blink ? 1 : 4.6, 0, 7); c.fill(); });
    c.fillStyle = '#3a2410'; c.beginPath(); c.moveTo(0, -48);
    c.quadraticCurveTo(-13, -56, -24, -48); c.quadraticCurveTo(-34, -42, -40, -50); c.quadraticCurveTo(-34, -32, -14, -39); c.quadraticCurveTo(-5, -42, 0, -43);
    c.quadraticCurveTo(5, -42, 14, -39); c.quadraticCurveTo(34, -32, 40, -50); c.quadraticCurveTo(34, -42, 24, -48); c.quadraticCurveTo(13, -56, 0, -48); c.fill();
    c.strokeStyle = '#2a170c'; c.lineWidth = 3.4; c.beginPath(); c.arc(0, -46, 30, .38, Math.PI - .38); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-23, -28); c.quadraticCurveTo(0, -13, 23, -28); c.quadraticCurveTo(0, -24, -23, -28); c.fill();
  } else {
    const gl = 10 + Math.sin(T * 12) * 3;
    c.shadowColor = '#ff2a1a'; c.shadowBlur = gl; c.fillStyle = '#ff3a2a';
    c.beginPath(); c.moveTo(-34, -74); c.lineTo(-8, -62); c.lineTo(-30, -56); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(34, -74); c.lineTo(8, -62); c.lineTo(30, -56); c.closePath(); c.fill();
    c.shadowBlur = 0; c.fillStyle = '#ffd9c8'; c.beginPath(); c.moveTo(-34, -40);
    for (let i = 0; i <= 8; i++) c.lineTo(-34 + i * 8.5, i % 2 ? -26 : -40);
    c.lineTo(34, -28); for (let i = 8; i >= 0; i--) c.lineTo(-34 + i * 8.5, i % 2 ? -16 : -28);
    c.closePath(); c.fill();
  }
  c.fillStyle = misch('#8c1f33', '#2a0606', f);
  c.beginPath(); c.moveTo(0, -10); c.lineTo(-19, -19); c.lineTo(-19, 0); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(0, -10); c.lineTo(19, -19); c.lineTo(19, 0); c.closePath(); c.fill();
  c.beginPath(); c.arc(0, -10, 4.5, 0, 7); c.fill();
  c.restore();
}
function namensschild(x, y, wort, kipp = 0) {
  c.save(); c.translate(x, y); c.rotate(kipp);
  c.fillStyle = '#fbeed0'; rr(-74, -14, 148, 28, 4); c.fill();
  c.strokeStyle = '#8d5f18'; c.lineWidth = 3; c.stroke();
  c.fillStyle = '#2a1a14'; schrift(15); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(wort, 0, 1);
  c.restore();
}
function toni(x, y, s, wirbel = 0) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(0, 3, 44, 6, 0, 0, 7); c.fill();
  c.fillStyle = '#1b1b22'; rr(-26, -22, 22, 22, 4); c.fill(); rr(4, -22, 22, 22, 4); c.fill();
  c.fillStyle = '#34495e'; rr(-29, -110, 58, 92, 8); c.fill();
  c.fillStyle = '#26364a'; c.fillRect(-20, -135, 7, 40); c.fillRect(13, -135, 7, 40);
  c.fillStyle = '#8a8d73'; c.beginPath(); c.arc(0, -152, 25, 0, 7); c.fill();
  c.fillStyle = '#1a1d22'; c.beginPath(); c.ellipse(0, -149, 21, 17, 0, 0, 7); c.fill();
  c.fillStyle = '#e8e3c8'; c.beginPath(); c.arc(-8, -149, 3.4, 0, 7); c.arc(8, -149, 3.4, 0, 7); c.fill();
  c.fillStyle = '#2f3e50'; rr(-29, -181, 58, 19, [11, 11, 0, 0]); c.fill(); c.fillRect(-29, -167, 74, 6);
  c.fillStyle = '#f6d27a'; schrift(13); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('T', 0, -172);
  c.fillStyle = '#b5352f'; rr(-43, -86, 86, 46, 7); c.fill();
  c.fillStyle = '#eee3c9'; c.beginPath(); c.ellipse(0, -86, 43, 11, 0, 0, 7); c.fill();
  c.strokeStyle = '#f6d27a'; c.lineWidth = 3; c.beginPath(); c.moveTo(-43, -78); c.lineTo(-22, -44); c.lineTo(0, -78); c.lineTo(22, -44); c.lineTo(43, -78); c.stroke();
  c.lineCap = 'round'; c.strokeStyle = '#d8c39b'; c.lineWidth = 5;
  const a = Math.sin(T * wirbel) * 13;
  c.beginPath(); c.moveTo(-36, -118); c.lineTo(-14, -90 - a); c.moveTo(36, -118); c.lineTo(14, -90 + a); c.stroke();
  c.restore();
}
function figur(x, y, s, o = {}) {
  const py = PYJAMAS.find(p => p.id === (o.pyjama || spar.pyjama)) || PYJAMAS[0];
  const haut = HAUT[o.haut === undefined ? spar.haut : o.haut], haar = o.haar || spar.haar, hinten = o.hinten;
  c.save(); c.translate(x, y); c.scale(s, s);
  if (o.dreh) c.rotate(o.dreh);
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(0, 2, 26, 5, 0, 0, 7); c.fill();
  c.fillStyle = py.f; rr(-19, -56, 16, 54, 6); c.fill(); rr(3, -56, 16, 54, 6); c.fill();
  rr(-23, -100, 46, 54, 11); c.fill();
  if (py.id === 'streifen' || py.id === 'nacht') {
    c.fillStyle = py.s;
    if (py.id === 'streifen') for (let i = -19; i < 21; i += 11) c.fillRect(i, -98, 4, 94);
    else [[-11, -88], [9, -74], [-6, -60], [12, -92]].forEach(p => { c.beginPath(); c.arc(p[0], p[1], 2.3, 0, 7); c.fill(); });
  }
  c.fillStyle = py.s; if (py.id !== 'nacht') c.fillRect(-1, -98, 2, 50);
  c.strokeStyle = py.f; c.lineWidth = 11; c.lineCap = 'round';
  const arm = o.arme ? -1 : 1;
  c.beginPath(); c.moveTo(-23, -88); c.lineTo(-33, -64 * (arm > 0 ? 1 : 1.7)); c.moveTo(23, -88); c.lineTo(33, -64 * (arm > 0 ? 1 : 1.7)); c.stroke();
  c.fillStyle = haut; c.beginPath(); c.arc(0, -120, 24, 0, 7); c.fill();
  const hf = ['#3a2316', '#141317', '#c58a35', '#a0432a'][spar.haut % 4];
  c.fillStyle = hf;
  if (haar === 'scheitel') { c.beginPath(); c.arc(0, -124, 25, Math.PI, 0); c.quadraticCurveTo(10, -128, -5, -136); c.quadraticCurveTo(-16, -126, -25, -124); c.fill(); }
  else if (haar === 'igel') { for (let i = -21; i <= 21; i += 7) { c.beginPath(); c.moveTo(i - 5, -134 + Math.abs(i) * .5); c.lineTo(i, -154 + Math.abs(i) * .5); c.lineTo(i + 5, -134 + Math.abs(i) * .5); c.fill(); } }
  else if (haar === 'zoepfe') { c.beginPath(); c.arc(0, -124, 25, Math.PI, 0); c.fill(); [-1, 1].forEach(a => { c.beginPath(); c.ellipse(a * 28, -106, 7, 17, 0, 0, 7); c.fill(); }); }
  else if (haar === 'wolke') { [[-20, -132, 14], [0, -142, 18], [20, -132, 14], [-27, -116, 10], [27, -116, 10]].forEach(p => { c.beginPath(); c.arc(p[0], p[1], p[2], 0, 7); c.fill(); }); }
  else if (haar === 'kamm') { c.fillStyle = '#e8589b'; for (let i = -14; i <= 14; i += 7) { c.beginPath(); c.moveTo(i - 5, -140); c.lineTo(i, -168); c.lineTo(i + 5, -140); c.fill(); } }
  else if (haar === 'muetze') { c.fillStyle = '#f4f1ff'; c.beginPath(); c.ellipse(0, -136, 31, 18, 0, 0, 7); c.fill(); c.strokeStyle = '#a6a2d6'; c.lineWidth = 2; c.stroke(); }
  if (!hinten) {
    c.fillStyle = '#20140c'; c.beginPath(); c.arc(-9, -120, 3, 0, 7); c.arc(9, -120, 3, 0, 7); c.fill();
    c.strokeStyle = '#20140c'; c.lineWidth = 2.6; c.beginPath();
    if (o.schock) c.arc(0, -108, 5, 0, 7); else c.arc(0, -112, 8, .3, Math.PI - .3); c.stroke();
  } else { c.fillStyle = hf; if (haar !== 'kamm' && haar !== 'muetze') { c.beginPath(); c.arc(0, -120, 24.5, 0, 7); c.fill(); } }
  c.restore();
}

/* ---------- Szenen ---------- */
function tapete(a, b, hoehe) {
  c.fillStyle = a; c.fillRect(0, 0, W, hoehe); c.fillStyle = b;
  for (let x = 0; x < W; x += 44) c.fillRect(x, 0, 16, hoehe);
}
function kachelboden(y, a, b) {
  c.fillStyle = a; c.fillRect(0, y, W, H - y);
  c.fillStyle = b;
  for (let r = 0; r < 5; r++) {
    const y1 = y + (H - y) * Math.pow(r / 5, 1.5), y2 = y + (H - y) * Math.pow((r + 1) / 5, 1.5), n = 12;
    for (let i = -n; i < n; i++) {
      if ((i + r + 100) % 2) continue;
      const s1 = (.65 + .45 * r / 5) * 60, s2 = (.65 + .45 * (r + 1) / 5) * 60;
      c.beginPath(); c.moveTo(W / 2 + i * s1, y1); c.lineTo(W / 2 + (i + 1) * s1, y1); c.lineTo(W / 2 + (i + 1) * s2, y2); c.lineTo(W / 2 + i * s2, y2); c.fill();
    }
  }
}
function lobby(o = {}) {
  const wild = o.wild, flacker = wild ? (Math.sin(T * 23) * Math.sin(T * 7.3) > .25 ? .42 : 0) : 0;
  tapete(wild ? '#3a1621' : '#5b1a2e', wild ? '#32111b' : '#671f35', 330);
  c.fillStyle = '#2d1712'; c.fillRect(0, 328, W, 12);
  kachelboden(340, wild ? '#2a2f2c' : '#0f5257', wild ? '#141716' : '#d9c8a2');
  /* Schild */
  c.save(); c.translate(360, 58); if (wild) c.rotate(.09);
  c.fillStyle = '#20100e'; rr(-205, -33, 410, 66, 5); c.fill();
  c.strokeStyle = '#e0ac3f'; c.lineWidth = 4; c.stroke();
  c.fillStyle = '#f6d27a'; schrift(30); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(wild ? 'HOTEL FEINDLICH' : 'HOTEL FREUNDLICH', 0, 2);
  c.restore();
  /* Schlüsselbrett */
  c.fillStyle = '#3c2115'; rr(250, 110, 220, 118, 5); c.fill();
  for (let i = 0; i < 12; i++) {
    const x = 272 + (i % 6) * 35, y = 128 + Math.floor(i / 6) * 50;
    c.fillStyle = '#e0ac3f'; c.beginPath(); c.arc(x, y, 3.4, 0, 7); c.fill();
    if (i !== 7 && !(wild && i % 3 === 0)) { c.fillStyle = '#d9c8a2'; rr(x - 7, y + 3, 14, 24, 7); c.fill(); }
  }
  /* Aufzug */
  c.fillStyle = '#8d5f18'; c.fillRect(552, 112, 136, 228);
  c.fillStyle = wild ? '#343843' : '#c2c8cd'; c.fillRect(562, 124, 56, 216); c.fillRect(622, 124, 56, 216);
  c.fillStyle = '#20100e'; rr(592, 92, 56, 20, 3); c.fill();
  /* Pflanze */
  c.fillStyle = '#7a3b22'; c.beginPath(); c.moveTo(42, 340); c.lineTo(100, 340); c.lineTo(90, 396); c.lineTo(52, 396); c.fill();
  c.strokeStyle = wild ? '#4e4a30' : '#2f7a52'; c.lineWidth = 8; c.lineCap = 'round';
  [[-46, -112], [-20, -142], [14, -146], [46, -112], [-58, -68], [60, -66]].forEach(([a, b]) => { c.beginPath(); c.moveTo(71, 340); c.quadraticCurveTo(71 + a * .3, 340 + b * .8, 71 + a, 340 + b); c.stroke(); });
  /* Tresen */
  const g = c.createLinearGradient(0, 270, 0, 420); g.addColorStop(0, '#7d4426'); g.addColorStop(1, '#4b2616');
  c.fillStyle = '#e0ac3f'; c.fillRect(148, 262, 424, 12);
  c.fillStyle = g; c.fillRect(160, 274, 400, 138);
  c.strokeStyle = '#311708'; c.lineWidth = 3;
  for (let i = 0; i < 4; i++) c.strokeRect(176 + i * 96, 290, 80, 106);
  if (o.klingel !== false) glocke(360, 262, 1, { spricht: o.spricht, feind: wild ? .85 : 0 });
  if (wild) {
    c.strokeStyle = '#120808'; c.lineWidth = 3; [[186, 288, 230, 380], [470, 280, 520, 402], [300, 300, 268, 410]].forEach(p => { c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo((p[0] + p[2]) / 2 + 12, (p[1] + p[3]) / 2); c.lineTo(p[2], p[3]); c.stroke(); });
    c.fillStyle = '#efe6cf';[[90, 448, .3], [226, 500, -.4], [420, 462, .9], [612, 498, .2], [516, 440, -.7]].forEach(([x, y, d]) => { c.save(); c.translate(x, y); c.rotate(d); c.fillRect(-20, -14, 40, 28); c.restore(); });
    c.fillStyle = `rgba(0,0,0,${flacker})`; c.fillRect(0, 0, W, H);
  }
  namensschild(360, 304, wild ? 'HERR FEINDLICH' : 'HERR FREUNDLICH', wild ? -.1 : 0);
  if (!o.keinSpieler) figur(120, 472, 1.28, { hinten: false });
}
function aussen(o = {}) {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0d1230'); g.addColorStop(.75, '#42214f'); g.addColorStop(1, '#7d3350');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = '#fff'; for (let i = 0; i < 46; i++) { const x = (i * 137.5) % W, y = (i * 71.3) % 280; c.globalAlpha = .35 + .4 * Math.abs(Math.sin(T * .9 + i)); c.fillRect(x, y, 2, 2); }
  c.globalAlpha = 1;
  c.fillStyle = '#f7e9c4'; c.beginPath(); c.arc(622, 84, 38, 0, 7); c.fill();
  c.fillStyle = '#10152f'; c.beginPath(); c.arc(638, 74, 33, 0, 7); c.fill();
  c.fillStyle = '#1c1426'; c.fillRect(150, 54, 420, 486);
  c.fillStyle = '#2c1c36'; c.fillRect(138, 42, 444, 18);
  const raster = (x, y, i) => {
    const an = o.nurZimmer ? (i === 6) : (i * 7 + 3) % 5 < 2;
    c.fillStyle = an ? '#ffd778' : '#2b2340'; c.fillRect(x, y, 36, 40);
    if (i === 6 && o.nurZimmer) { c.fillStyle = '#20100e'; schrift(15); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('67', x + 18, y + 20); }
  };
  let n = 0;
  for (let y = 78; y < 340; y += 62) for (let x = 180; x < 530; x += 76) raster(x, y, n++);
  c.fillStyle = '#0c0a12'; c.fillRect(306, 424, 108, 116);
  c.fillStyle = '#e0ac3f'; c.fillRect(290, 406, 140, 12);
  c.fillStyle = '#f6d27a'; schrift(21); c.textAlign = 'center'; c.fillText('HOTEL', 360, 390);
  c.fillStyle = '#2b1a24'; c.fillRect(0, 520, W, 20);
}
function aufzug(zahl, offenG = 0) {
  c.fillStyle = '#4b2616'; c.fillRect(0, 0, W, H);
  for (let x = 30; x < W; x += 110) { c.fillStyle = '#5c301c'; c.fillRect(x, 50, 84, 400); c.strokeStyle = '#2a1408'; c.lineWidth = 3; c.strokeRect(x, 50, 84, 400); }
  c.fillStyle = '#e0ac3f'; c.fillRect(0, 248, W, 9);
  kachelboden(452, '#20100e', '#3a1621');
  c.fillStyle = '#20100e'; rr(214, 8, 292, 134, 10); c.fill(); c.strokeStyle = '#e0ac3f'; c.lineWidth = 6; c.stroke();
  c.strokeStyle = '#e0ac3f'; c.lineWidth = 3; c.beginPath(); c.arc(360, 136, 92, Math.PI, 0); c.stroke();
  const an = Math.PI + Math.PI * Math.min(1, zahl / 67);
  c.strokeStyle = '#ff6b5e'; c.lineWidth = 5; c.beginPath(); c.moveTo(360, 136); c.lineTo(360 + Math.cos(an) * 84, 136 + Math.sin(an) * 84); c.stroke();
  c.fillStyle = '#f6d27a'; schrift(46); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(zahl), 360, 105);
  figur(360, 500, 1.55);
  if (offenG) { c.fillStyle = `rgba(4,8,14,${offenG})`; c.fillRect(0, 0, W, H); }
}
function zimmer(o = {}) {
  const nacht = o.nacht;
  tapete('#1b4a4e', '#1f5458', 380);
  c.fillStyle = '#2c1a14'; c.fillRect(0, 376, W, 10);
  c.fillStyle = '#3e2a22'; c.fillRect(0, 386, W, H - 386);
  c.strokeStyle = '#33211a'; c.lineWidth = 2; for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(i * 110 - 20, 386); c.lineTo(i * 150 - 180, H); c.stroke(); }
  /* Klo-Tür */
  c.fillStyle = '#efe6cf'; c.fillRect(24, 134, 120, 246); c.fillStyle = '#c4b793'; c.fillRect(32, 142, 104, 238);
  c.fillStyle = '#fff'; rr(62, 300, 58, 48, 12); c.fill(); rr(66, 256, 50, 46, 6); c.fill(); c.fillStyle = '#d9d4c6'; c.fillRect(58, 346, 66, 34);
  c.fillStyle = '#e0ac3f'; schrift(14); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('WC', 84, 158);
  /* Kalender */
  c.fillStyle = '#fff'; c.fillRect(186, 46, 92, 106); c.fillStyle = '#c23b3b'; c.fillRect(186, 46, 92, 26);
  c.fillStyle = '#fff'; schrift(11); c.fillText(o.kalender ? 'NOVEMBER' : 'AUGUST', 232, 60);
  c.fillStyle = '#2a1a14'; schrift(35); c.fillText(o.kalender ? '67' : '30', 232, 111);
  /* Bild mit Versteck */
  c.fillStyle = '#e0ac3f'; c.fillRect(308, 96, 124, 92);
  c.save(); if (o.bildWeg) { c.fillStyle = '#123537'; c.fillRect(316, 104, 108, 76); c.fillStyle = '#efe6cf'; c.fillRect(350, 122, 40, 44); c.fillStyle = '#2a1a14'; c.fillRect(356, 130, 28, 3); c.fillRect(356, 140, 22, 3); }
  else {
    c.fillStyle = '#7fbfa8'; c.fillRect(316, 104, 108, 76); c.fillStyle = '#c23b3b'; c.beginPath(); c.moveTo(322, 180); c.lineTo(368, 128); c.lineTo(420, 180); c.fill();
    c.fillStyle = '#e0ac3f'; c.beginPath(); c.arc(398, 120, 11, 0, 7); c.fill();
  } c.restore();
  /* Bett */
  c.fillStyle = '#5c301c'; rr(432, 256, 262, 62, 9); c.fill(); c.fillRect(432, 310, 262, 88);
  c.fillStyle = '#efe6cf'; rr(448, 272, 88, 44, 12); c.fill();
  c.fillStyle = '#8c1f33'; rr(432, 306, 262, 76, 9); c.fill(); c.fillStyle = '#6b1729'; for (let x = 450; x < 690; x += 36) c.fillRect(x, 306, 12, 76);
  /* Schacht-Gitter */
  c.fillStyle = '#69737c'; c.fillRect(556, 118, 130, 82);
  c.fillStyle = '#2b3138'; for (let y = 128; y < 192; y += 12) c.fillRect(566, y, 110, 6);
  c.fillStyle = '#c2c8cd';[[562, 124], [680, 124], [562, 194], [680, 194]].forEach(([x, y]) => { if (!(o.schrauben !== undefined && [[562, 124], [680, 124], [562, 194], [680, 194]].findIndex(p => p[0] === x && p[1] === y) < o.schrauben)) { c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); } });
  /* Tür mit Spion */
  if (o.tuer) {
    c.fillStyle = '#6b3a20'; c.fillRect(172, 172, 120, 212);
    c.fillStyle = '#e0ac3f'; schrift(16); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('67', 232, 202);
    c.fillStyle = '#20100e'; c.beginPath(); c.arc(232, 244, 7, 0, 7); c.fill(); c.strokeStyle = '#e0ac3f'; c.lineWidth = 3; c.stroke();
    if (o.risse) { c.strokeStyle = '#120808'; c.lineWidth = 4; for (let i = 0; i < o.risse; i++) { c.beginPath(); c.moveTo(182 + i * 24, 180 + (i % 2) * 40); c.lineTo(232 + (i % 3) * 18, 280); c.lineTo(194 + i * 18, 380); c.stroke(); } }
  }
  if (o.spieler !== false) figur(o.sx || 380, 480, 1.25, { schock: o.schock });
  if (nacht) {
    c.fillStyle = 'rgba(6,10,34,.72)'; c.fillRect(0, 0, W, H);
    if (o.tuer) { const g = c.createLinearGradient(0, 330, 0, 400); g.addColorStop(0, 'rgba(255,190,90,0)'); g.addColorStop(1, 'rgba(255,190,90,.35)'); c.fillStyle = g; c.fillRect(172, 330, 120, 70); }
  }
  if (o.bumm) {
    const a = Math.max(0, 1 - (T - o.bumm) * 3);
    c.fillStyle = `rgba(255,190,90,${a * .15})`; c.fillRect(0, 0, W, H);
  }
}
function spion(o = {}) {
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  c.save(); c.beginPath(); c.arc(360, 270, 236, 0, 7); c.clip();
  c.fillStyle = '#2b2118'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#3e2d1c'; c.beginPath(); c.moveTo(124, 34); c.lineTo(310, 200); c.lineTo(410, 200); c.lineTo(596, 34); c.fill();
  c.fillStyle = '#16343a'; c.beginPath(); c.moveTo(60, 520); c.lineTo(310, 320); c.lineTo(410, 320); c.lineTo(660, 520); c.fill();
  c.fillStyle = '#4d1730'; c.beginPath(); c.moveTo(70, 30); c.lineTo(310, 200); c.lineTo(310, 320); c.lineTo(70, 520); c.fill(); c.beginPath(); c.moveTo(650, 30); c.lineTo(410, 200); c.lineTo(410, 320); c.lineTo(650, 520); c.fill();
  c.fillStyle = '#ffc86b'; c.beginPath(); c.ellipse(360, 212, 22, 7, 0, 0, 7); c.fill();
  const g = c.createRadialGradient(360, 230, 20, 360, 260, 250); g.addColorStop(0, 'rgba(255,200,110,.28)'); g.addColorStop(1, 'rgba(0,0,0,.5)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  if (o.figuren) {
    const n = o.nah || 0, s = .75 + n * 1.5, sp = 62 + n * 60;
    toni(360 - sp, 372 + n * 150, s, o.wirbel || 0);
    glocke(360 + sp, 366 + n * 150, s * 1.05, { feind: o.feind || 0, spricht: o.spricht });
    if (o.feind > .6) namensschild(360 + sp, 388 + n * 150, 'FEINDLICH', -.08);
    else if (o.feind !== undefined) namensschild(360 + sp, 388 + n * 150, 'FREUNDLICH');
  }
  if (o.gross) {
    const s = spar.schreck ? 2.3 : 3.5;
    const z = spar.schreck ? 0 : Math.sin(T * 34) * 5;
    toni(190, 620, s * .95, 18);
    glocke(430 + z, 470, s, { feind: 1 });
  }
  c.restore();
  const r = c.createRadialGradient(360, 270, 190, 360, 270, 300); r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(.4, 'rgba(0,0,0,.9)'); r.addColorStop(1, '#000');
  c.fillStyle = r; c.fillRect(0, 0, W, H);
  c.strokeStyle = '#8d5f18'; c.lineWidth = 12; c.beginPath(); c.arc(360, 270, 242, 0, 7); c.stroke();
}
function schacht(o = {}) {
  const off = o.fahrt ? T * o.fahrt : 0, l = o.laerm || 0;
  c.fillStyle = '#10151b'; c.fillRect(0, 0, W, H);
  const mx = 360, my = 214, z = (a, b) => c.lineTo(a, b);
  c.fillStyle = '#242c34'; c.beginPath(); c.moveTo(0, 0); z(mx, my); z(W, 0); c.fill();
  c.fillStyle = '#1a2128'; c.beginPath(); c.moveTo(0, 0); z(mx, my); z(0, H); c.fill(); c.beginPath(); c.moveTo(W, 0); z(mx, my); z(W, H); c.fill();
  c.fillStyle = '#2e3843'; c.beginPath(); c.moveTo(0, H); z(mx, my); z(W, H); c.fill();
  const N = 11;
  for (let k = 0; k < N; k++) {
    const p = ((k + off) % N) / N, s = .03 + p * p * 1.5, b = W * s, h = H * s;
    const x = mx - b / 2, y = my - h / 2;
    c.strokeStyle = misch('#20262d', '#5a6876', p); c.lineWidth = 1 + p * 12; c.strokeRect(x, y, b, h);
    if (p > .28) {
      c.fillStyle = misch('#20262d', '#9aa8b5', p);
      [[x, y], [x + b, y], [x, y + h], [x + b, y + h], [mx, y], [mx, y + h]].forEach(([a, e]) => { c.beginPath(); c.arc(a, e, 1 + p * 5, 0, 7); c.fill(); });
    }
  }
  const g = c.createRadialGradient(mx, my, 2, mx, my, 56); g.addColorStop(0, o.dunkel ? 'rgba(60,70,100,.3)' : 'rgba(255,190,110,.95)'); g.addColorStop(1, 'rgba(255,190,110,0)');
  c.fillStyle = g; c.fillRect(mx - 60, my - 60, 120, 120);
  if (o.dunkel) { c.fillStyle = 'rgba(0,0,6,.62)'; c.fillRect(0, 0, W, H); }
  if (o.anzeige) o.anzeige();
  if (l > 15) {
    const r = c.createRadialGradient(mx, my, 150, mx, my, 470); r.addColorStop(0, 'rgba(255,40,20,0)'); r.addColorStop(1, `rgba(255,40,20,${l / 100 * .55 * (.8 + .2 * Math.sin(T * 7))})`);
    c.fillStyle = r; c.fillRect(0, 0, W, H);
  }
  const wipp = o.fahrt ? Math.sin(T * 13) * 6 : 0;
  figur(360 + wipp, 548, 2.1, { hinten: true, dreh: wipp * .006 });
}
function ventilator(x, y, r, tempo) {
  c.save(); c.translate(x, y);
  c.fillStyle = 'rgba(8,12,16,.72)'; c.beginPath(); c.arc(0, 0, r + 12, 0, 7); c.fill();
  c.strokeStyle = '#c2c8cd'; c.lineWidth = 6; c.beginPath(); c.arc(0, 0, r + 6, 0, 7); c.stroke();
  c.rotate(T * tempo); c.fillStyle = '#9aa8b5';
  for (let i = 0; i < 5; i++) { c.rotate(Math.PI * 2 / 5); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(r * .75, -r * .5, r, -r * .08); c.quadraticCurveTo(r * .55, r * .22, 0, 0); c.fill(); }
  c.fillStyle = '#e0ac3f'; c.beginPath(); c.arc(0, 0, r * .16, 0, 7); c.fill();
  c.restore();
}
function grosserPfeil(r) {
  const w = { o: -Math.PI / 2, u: Math.PI / 2, l: Math.PI, r: 0 }[r];
  c.save(); c.translate(360, 214); c.rotate(w);
  c.fillStyle = '#f6d27a'; c.strokeStyle = '#20100e'; c.lineWidth = 8; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(-82, -32); c.lineTo(10, -32); c.lineTo(10, -76); c.lineTo(92, 0); c.lineTo(10, 76); c.lineTo(10, 32); c.lineTo(-82, 32); c.closePath(); c.stroke(); c.fill();
  c.restore();
}
function feindBricht() {
  schacht({ laerm: 100 });
  c.fillStyle = 'rgba(20,0,0,.5)'; c.fillRect(0, 0, W, H);
  const s = spar.schreck ? 2.2 : 3.2;
  glocke(360, 420, s, { feind: 1 });
}
function titelBild() {
  aussen({ nurZimmer: true });
  glocke(360, 516, .8, { spricht: false });
}
function freiheit() {
  aussen({});
  figur(240, 520, 1.3, { arme: true }); glocke(600, 520, .35, { feind: .1 });
  const farben = ['#f6d27a', '#a9dcc8', '#e8589b', '#fff', '#ff8a7a'];
  for (let i = 0; i < 44; i++) { const y = (T * (60 + i * 3) + i * 47) % 560 - 10, x = (i * 89 + Math.sin(T + i) * 20) % W; c.fillStyle = farben[i % 5]; c.fillRect(x, y, 7, 11); }
  c.fillStyle = '#f6d27a'; c.strokeStyle = '#20100e'; c.lineWidth = 6; schrift(38); c.textAlign = 'center'; c.textBaseline = 'middle'; c.strokeText('FLITZPIEPE ENTKOMMEN', 360, 40, 680); c.fillText('FLITZPIEPE ENTKOMMEN', 360, 40, 680);
}
function figurVorschau() {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5b1a2e'); g.addColorStop(1, '#2a0d17'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  tapete('#5b1a2e', '#671f35', 420); kachelboden(420, '#0f5257', '#d9c8a2');
  figur(360, 480, 2.6);
}

/* ---------- Hilfen fürs Spiel ---------- */
function geheHotel(fn) { szene = fn; }
function dingZeigen(wort, g) {
  const d = $('ding'); d.textContent = wort; d.style.fontSize = g + 'px';
  d.classList.remove('an'); void d.offsetWidth; d.classList.add('an');
}
function mische(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }
const gast = () => spar.name || 'Gast';

/* Spielzustand einer Flucht */
let F = null, fragenRest = [], letzteDing = 0, aktuell = null;
function neueFlucht(modus, loop = 0, doku = false) {
  const b = spar.beruf || 'wiss';
  F = {
    modus, loop, doku, beruf: b, leben: b === 'body' ? 4 : 3, laerm: 0, dinge: [], geschafft: 0,
    linse: b === 'wiss' ? 3 : 0, skip: b === 'tech' ? 1 : 0, riegel: b === 'body' ? 1 : 0, ablenkung: b === 'meme' ? 2 : 0,
    bonus: 0, ablenkungAn: false, lautlos: 0, coins: 0, typen: []
  };
  fragenRest = mische(FRAGEN);
}
function dingWarnung(dt) {
  if (!F || !F.imSchacht || F.laerm < 40) return;
  letzteDing += dt;
  const abstand = 7.5 - (F.laerm - 40) / 60 * 5.5;
  if (letzteDing >= abstand) {
    letzteDing = 0; const st = F.laerm / 100;
    Ton.ding(.18 + st * .7);
    dingZeigen(F.laerm > 80 ? 'DING!' : F.laerm > 60 ? 'Ding ...' : 'ding ...', 14 + st * 26);
    if (F.laerm > 70) Ton.bumm(.3);
  }
}
function hudZeigen() {
  const h = $('hud'); h.hidden = !F || !F.imSchacht;
  if (!F) return;
  const et = F.modus === 'story' ? 'Etage ' + etage(F.geschafft) : F.geschafft + ' geschafft';
  $('etage').textContent = et;
  $('leben').textContent = '♥'.repeat(F.leben);
  $('leben').setAttribute('aria-label', F.leben + ' Leben');
  $('laerm').setAttribute('aria-label', 'Lärm ' + Math.round(F.laerm) + ' von 100');
  $('laerm-balken').firstElementChild.style.width = F.laerm + '%';
}
const STOCK = [66, 59, 52, 44, 37, 30, 22, 15, 8, 1];
const etage = i => STOCK[Math.min(i, 9)];
function zeiten() {
  const b = { leicht: { q: 24, r: 2.6, h: 900 }, normal: { q: 16, r: 1.7, h: 680 }, schwer: { q: 10, r: 1.1, h: 480 } }[spar.zeit];
  let k = Math.max(.6, Math.pow(.92, F.loop) * (F.modus === 'endlos' ? Math.pow(.985, F.geschafft) : 1));
  return { q: b.q * k, r: b.r * k, h: b.h * k };
}
function fehlerLaerm() { return { leicht: 26, normal: 34, schwer: 42 }[spar.zeit]; }
function starteUhr(sek, fertig) {
  $('uhr').hidden = false; $('uhr').classList.remove('knapp');
  uhrAktiv = { rest: sek, ganz: sek, fertig };
}
function stoppeUhr() { uhrAktiv = null; $('uhr').hidden = true; }
function zeitBonus(dunkel) {
  let plus = F.beruf === 'tech' ? .5 : 0;
  plus += F.bonus;
  let mal = dunkel && !F.dinge.includes('lampe') ? .8 : 1;
  if (F.ablenkungAn) mal *= 1.5;
  return { plus, mal };
}

/* Prüfungen: liefern true (geschafft) oder false */
function pruefungQuiz(dunkel) {
  const nr = laufNr;
  if (!fragenRest.length) fragenRest = mische(FRAGEN);
  const f = fragenRest.pop(), richtig = f[1], antworten = mische(f.slice(1));
  aktuell = { typ: 'quiz', richtig };
  const { plus, mal } = zeitBonus(dunkel), sek = zeiten().q * mal + plus;
  szene = () => schacht({ laerm: F.laerm, dunkel });
  setzeText('Quiz', f[0]); leere();
  return offen(fertig => {
    let zu = false;
    const ende = w => { if (zu || nr !== laufNr) return; zu = true; stoppeUhr(); fertig(w); };
    antworten.forEach(a => {
      const b = knopf(a); b.dataset.a = a;
      b.addEventListener('click', () => ende(a === richtig));
      $('knoepfe').append(b);
    });
    if (F.linse > 0) {
      const l = knopf(`Ehrliche Linse (${F.linse})`, { art: 'neben' });
      l.addEventListener('click', () => {
        const falsche = [...$('knoepfe').querySelectorAll('button[data-a]')].filter(x => x.dataset.a !== richtig && !x.disabled);
        if (!falsche.length) return;
        const x = falsche[Math.floor(Math.random() * falsche.length)]; x.disabled = true; x.classList.add('falsch');
        F.linse--; l.textContent = `Ehrliche Linse (${F.linse})`; if (!F.linse || falsche.length < 2) l.disabled = true;
      });
      $('knoepfe').append(l);
    }
    $('knoepfe').querySelector('button').focus({ preventScroll: true });
    starteUhr(sek, () => ende(false));
  });
}
const PFEILE = [['o', '↑', 'W', ['w', 'arrowup']], ['l', '←', 'A', ['a', 'arrowleft']], ['u', '↓', 'S', ['s', 'arrowdown']], ['r', '→', 'D', ['d', 'arrowright']]];
async function pruefungReaktion(dunkel) {
  const nr = laufNr, anzahl = 4 + Math.min(2, F.loop);
  const { plus, mal } = zeitBonus(dunkel), sek = zeiten().r * mal + plus;
  let pfeil = null;
  aktuell = { typ: 'reaktion', get pfeil() { return pfeil; } };
  szene = () => schacht({ laerm: F.laerm, dunkel, anzeige: () => { ventilator(360, 214, 120, 18); if (pfeil) grosserPfeil(pfeil); } });
  setzeText('Reaktions-Tasten', 'Ein Ventilator stürzt herab! Drück die richtige Richtung, um auszuweichen.');
  leere(); $('knoepfe').className = 'pfeile';
  const knoepfe = {};
  PFEILE.forEach(([id, z, t]) => {
    const b = knopf(z, { klein: t, aria: { o: 'Hoch', u: 'Runter', l: 'Links', r: 'Rechts' }[id] });
    b.style.gridArea = id; b.dataset.p = id; knoepfe[id] = b; $('knoepfe').append(b);
  });
  await warte(900); pruefe(nr);
  for (let i = 0; i < anzahl; i++) {
    pfeil = PFEILE[Math.floor(Math.random() * 4)][0];
    const ziel = pfeil;
    Ton.tick();
    const ok = await offen(fertig => {
      let zu = false;
      const ende = w => { if (zu) return; zu = true; stoppeUhr(); tasteFn = null; Object.values(knoepfe).forEach(b => { b.onclick = null; }); fertig(w); };
      Object.entries(knoepfe).forEach(([id, b]) => { b.onclick = () => ende(id === ziel); });
      tasteFn = k => { const p = PFEILE.find(q => q[3].includes(k)); if (p) { ende(p[0] === ziel); return true; } return false; };
      starteUhr(sek, () => ende(false));
    });
    pruefe(nr);
    pfeil = null;
    if (!ok) return false;
    Ton.gut();
    await warte(220); pruefe(nr);
  }
  return true;
}
const HEBEL = [['★', 'Stern'], ['●', 'Kreis'], ['▲', 'Dreieck'], ['■', 'Quadrat']];
async function pruefungHebel(dunkel) {
  const nr = laufNr, laenge = 3 + Math.floor(F.geschafft / 3) + Math.min(2, F.loop);
  const folge = Array.from({ length: Math.min(7, laenge) }, () => Math.floor(Math.random() * 4));
  const { plus, mal } = zeitBonus(dunkel), takt = zeiten().h * mal + plus * 200;
  let zeig = -1;
  aktuell = { typ: 'hebel', folge };
  szene = () => schacht({
    laerm: F.laerm, dunkel, anzeige: () => {
      c.fillStyle = '#20100e'; rr(240, 110, 240, 200, 10); c.fill(); c.strokeStyle = '#e0ac3f'; c.lineWidth = 5; c.stroke();
      if (zeig >= 0) { c.fillStyle = '#a9dcc8'; schrift(110, 'Baloo 2'); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(HEBEL[zeig][0], 360, 212); }
    }
  });
  setzeText('Hebel-Hack', 'Merk dir die Anzeige. Danach legst du die Hebel in derselben Reihenfolge um.');
  leere(); $('knoepfe').className = 'hebel';
  const bs = HEBEL.map(([z, n], i) => { const b = knopf(z, { aus: true, aria: 'Hebel ' + n }); b.dataset.h = i; $('knoepfe').append(b); return b; });
  await warte(1000); pruefe(nr);
  for (const h of folge) {
    zeig = h; bs[h].classList.add('leuchte'); Ton.hebel(h);
    await warte(takt); pruefe(nr);
    zeig = -1; bs[h].classList.remove('leuchte');
    await warte(takt * .3); pruefe(nr);
  }
  setzeText('Hebel-Hack', 'Jetzt du! Leg die Hebel in der richtigen Reihenfolge um.');
  bs.forEach(b => { b.disabled = false; }); bs[0].focus({ preventScroll: true });
  return offen(fertig => {
    let pos = 0, zu = false;
    const ende = w => { if (zu) return; zu = true; stoppeUhr(); tasteFn = null; fertig(w); };
    const druck = i => {
      if (zu) return;
      Ton.hebel(i);
      if (i !== folge[pos]) return ende(false);
      pos++; if (pos >= folge.length) ende(true);
    };
    bs.forEach((b, i) => { b.onclick = () => druck(i); });
    tasteFn = k => { const n = '1234'.indexOf(k); if (n >= 0) { druck(n); return true; } return false; };
    starteUhr(Math.max(6, folge.length * 2.4) * mal + plus, () => ende(false));
  });
}
const PRUEF = { quiz: ['Meme-Quiz', pruefungQuiz], reaktion: ['Reaktions-Tasten', pruefungReaktion], hebel: ['Hebel-Hack', pruefungHebel] };
function naechsterTyp() {
  const alle = Object.keys(PRUEF), l = F.typen;
  const t = alle.filter(x => !(l.length >= 2 && l[l.length - 1] === x && l[l.length - 2] === x));
  const w = t[Math.floor(Math.random() * t.length)]; l.push(w); return w;
}

function inventarAnzeigen() {
  const e = $('eigen'); e.innerHTML = '';
  const d = document.createElement('div'); d.className = 'inventar';
  const beschr = F.dinge.length ? F.dinge.map(x => DINGE[x].n).join(', ') : 'nichts';
  d.innerHTML = 'Dabei: <b></b>'; d.querySelector('b').textContent = beschr;
  e.append(d);
}
async function vorbereitung(typ, dunkel, titelText) {
  const nr = laufNr;
  for (;;) {
    pruefe(nr);
    szene = () => schacht({ laerm: F.laerm, dunkel });
    const v = F.beruf === 'wiss' ? ` Deine Forschung sagt: ${PRUEF[typ][0]}.` : '';
    const dk = dunkel ? (F.dinge.includes('lampe') ? ' Es ist dunkel, aber deine Lampe hilft.' : ' Hier ist es dunkel: weniger Zeit.') : '';
    setzeText(titelText, 'Die nächste Prüfung wartet.' + v + dk);
    const o = [{ t: 'Prüfung starten', w: 'los' }];
    F.dinge.forEach((d, i) => { if (!DINGE[d].frei) o.push({ t: DINGE[d].n + ' benutzen', klein: DINGE[d].t, w: 'ding' + i, art: 'neben' }); });
    if (F.skip) o.push({ t: 'Schacht-Abkürzung', klein: 'Überspringt diese Prüfung (1-mal).', w: 'skip', art: 'neben' });
    if (F.riegel) o.push({ t: 'Gitter verrammeln', klein: 'Lärm fällt auf 0 (1-mal).', w: 'riegel', art: 'neben' });
    if (F.ablenkung) o.push({ t: `Flitzpiepen-Ablenkung (${F.ablenkung})`, klein: '50 % mehr Zeit bei der nächsten Prüfung.', w: 'ablenk', art: 'neben', aus: F.ablenkungAn });
    leere(); inventarAnzeigen();
    const w = await wahlOhneLeeren(o);
    pruefe(nr);
    if (w === 'los') return false;
    if (w === 'skip') { F.skip = 0; return true; }
    if (w === 'riegel') { F.riegel = 0; F.laerm = 0; Ton.pock(.7); hudZeigen(); }
    if (w === 'ablenk') { F.ablenkung--; F.ablenkungAn = true; Ton.gut(); }
    if (typeof w === 'string' && w.startsWith('ding')) {
      const i = +w.slice(4), d = F.dinge[i]; F.dinge.splice(i, 1);
      if (d === 'wd40') F.lautlos = 3;
      if (d === 'drink') F.bonus += 1;
      if (d === 'fetzen') { F.laerm = Math.max(0, F.laerm - 30); hudZeigen(); }
      Ton.gut();
    }
  }
}
function wahlOhneLeeren(opts) {
  const nr = laufNr;
  return offen(ok => {
    opts.forEach(o => {
      const b = knopf(o.t, o);
      b.addEventListener('click', () => { if (nr === laufNr) { Ton.klick(); ok(o.w); } });
      $('knoepfe').append(b);
    });
    $('knoepfe').querySelector('button:not(:disabled)').focus({ preventScroll: true });
  });
}
async function gegenstandFinden() {
  const nr = laufNr, chance = F.beruf === 'meme' ? .62 : .42;
  if (Math.random() > chance) return;
  const d = Object.keys(DINGE)[Math.floor(Math.random() * 4)];
  szene = () => schacht({ laerm: F.laerm });
  setzeText('Fund', `Du findest: ${DINGE[d].n}. ${DINGE[d].t}`);
  const o = [];
  if (F.dinge.length < 2) o.push({ t: 'Einstecken', w: 'neu' });
  else F.dinge.forEach((x, i) => o.push({ t: `Gegen ${DINGE[x].n} tauschen`, w: i }));
  o.push({ t: 'Liegen lassen', w: 'nein', art: 'leise' });
  const w = await wahl(o); pruefe(nr);
  if (w === 'neu') F.dinge.push(d); else if (typeof w === 'number') F.dinge[w] = d;
}
async function easterEgg() {
  const nr = laufNr, chance = F.beruf === 'meme' ? .3 : .12;
  if (Math.random() > chance) return;
  const satz = ['An der Wand steht: „Toni war hier. Bumm.“', 'Du findest eine Notiz: „Die Kuh grüßt.“', 'Jemand hat 67 Striche in die Wand geritzt. Es sind 68.', 'Du findest den Knopf von Franz.'];
  F.coins += 5; szene = () => schacht({ laerm: F.laerm });
  await sag('Easter Egg', satz[Math.floor(Math.random() * satz.length)] + ' +5 Hotel-Coins'); pruefe(nr);
}
async function angriff() {
  const nr = laufNr;
  setzeText(HFE, spar.schreck ? 'Knack ... Das Gitter gibt nach.' : ''); leere();
  if (spar.schreck) { Ton.knack(); await warte(900); pruefe(nr); }
  szene = feindBricht; Ton.schreck(); wackeln = 1;
  F.leben--; F.laerm = F.leben > 0 ? 30 : 100; hudZeigen();
  setzeText(HFE, F.leben > 0 ? '„Gefunden, Flitzpiepe! Ding!“ Du verlierst ein Leben und rutschst gerade noch weg.' : '„Gefunden, Flitzpiepe! Ding!“');
  await warte(900); pruefe(nr);
  await wahl([{ t: 'Weiter', w: 1 }]); pruefe(nr);
}
async function schachtFlucht() {
  const nr = laufNr;
  F.imSchacht = true; laufendesSpiel = true;
  Ton.musik(false); letzteDing = 0; hudZeigen();
  const ziel = F.modus === 'story' ? STOCK.length : Infinity;
  while (F.geschafft < ziel) {
    const dunkel = Math.random() < .3;
    const typ = naechsterTyp();
    const tt = F.modus === 'story' ? `Etage ${etage(F.geschafft)}` : `Abschnitt ${F.geschafft + 1}`;
    const skip = await vorbereitung(typ, dunkel, tt); pruefe(nr);
    let ok = skip;
    while (!ok) {
      ok = await PRUEF[typ][1](dunkel); pruefe(nr);
      F.bonus = 0; F.ablenkungAn = false;
      stoppeUhr();
      if (!ok) {
        Ton.fehl();
        F.laerm = Math.min(100, F.laerm + fehlerLaerm()); hudZeigen();
        if (F.laerm >= 100) {
          await angriff(); pruefe(nr);
          if (F.leben <= 0) return false;
        }
        setzeText('Daneben', 'Das war laut. Hör mal: Ding ... Eine neue Aufgabe kommt.');
        await wahl([{ t: 'Noch ein Versuch', w: 1 }]); pruefe(nr);
      }
    }
    Ton.gut(); F.geschafft++; F.coins += 2; hudZeigen();
    if (F.geschafft >= ziel) break;
    /* Rutschen */
    leere(); setzeText('', F.lautlos > 0 ? 'Dank WD-40 rutschst du lautlos weiter ...' : 'Du rutschst weiter nach unten ...');
    Ton.rutsch(); szene = () => schacht({ laerm: F.laerm, fahrt: 4.5 });
    await warte(1300); pruefe(nr);
    if (F.lautlos > 0) F.lautlos--; else { F.laerm = Math.min(95, F.laerm + 6); hudZeigen(); }
    await gegenstandFinden(); pruefe(nr);
    await easterEgg(); pruefe(nr);
  }
  return true;
}
function schachtEnde() { if (F) { F.imSchacht = false; F.jagd = false; } if (WELT) { WELT.beiTreffer = null; $('beutel').innerHTML = ''; } laufendesSpiel = false; $('hud').hidden = true; $('ding').classList.remove('an'); }

/* ---------- Die Geschichte ---------- */
async function rezeption() {
  const nr = laufNr;
  Ton.musik(true, false);
  let spricht = true;
  szene = () => lobby({ spricht });
  await gespraech(b => { spricht = b; });
}
async function gespraech(sp) {
  const nr = laufNr;
  sp(true); Ton.ding();
  await sag(HF, `Willkommen im Hotel Freundlich, ${gast()}! Für Sie ist mir nichts zu viel. Ding!`); pruefe(nr);
  let franz = 0, kuh = 0;
  for (;;) {
    sp(false);
    setzeText(gast(), 'Was möchtest du fragen?');
    const w = await wahl([{ t: 'Was ist das Kapital von Franz?', w: 'f' }, { t: 'Was sagt die Kuh?', w: 'k' }, { t: 'Ich würde gerne einchecken.', w: 'c' }]); pruefe(nr);
    sp(true); Ton.ding(.8);
    if (w === 'f') { await sag(HF, franz++ ? 'Immer noch 3 Euro. Der Knopf ist jetzt weg. Ding!' : 'Franz besitzt 3 Euro und einen Knopf. Ding!'); pruefe(nr); }
    if (w === 'k') { await sag(HF, kuh++ ? 'Sie hat zurückgerufen. Sie sagt: Muh. Ding!' : 'Die Kuh hat heute frei. Möchten Sie eine Nachricht hinterlassen? Ding!'); pruefe(nr); }
    if (w === 'c') break;
  }
  await sag(HF, 'Sehr gern! Das macht genau 67,67 € Spielgeld. Ding!'); pruefe(nr);
  await sag(HF, 'Hier ist Ihr Schlüssel für Raum 67. Schlafen Sie gut. Wirklich sehr gut. Ding!', 'Zum Aufzug'); pruefe(nr);
}
async function aufzugFahrt() {
  const nr = laufNr;
  let zahl = 1, dunkel = 0;
  await blende(1, 300); pruefe(nr);
  szene = () => aufzug(zahl, dunkel);
  await blende(0, 300); pruefe(nr);
  leere(); setzeText('', 'Der Aufzug fährt langsam los ...');
  for (const z of [1, 15, 30, 45, 60, 67]) { zahl = z; Ton.tick(); await warte(780); pruefe(nr); }
  Ton.ding(); Ton.musik(false);
  await sag('', 'Ding! Die Tür geht auf. Der 67. Stock ist dunkel und gähnend leer.', 'Zu Raum 67'); pruefe(nr);
  await blende(1, 400); pruefe(nr);
}
async function raum67() {
  const nr = laufNr;
  let kal = false, bildWeg = false, licht = true, ausR = 0;
  szene = () => zimmer({ kalender: kal, bildWeg, tuer: true });
  await blende(0, 400); pruefe(nr);
  const bild = () => ({ t: 'Bild an der Wand ansehen', w: 'bild', art: 'neben', r: [308, 96, 124, 92] });
  setzeText(gast(), 'Du musst ganz dringend aufs Klo!');
  for (;;) {
    const o = [{ t: 'Aufs Klo gehen', w: 'klo', r: [24, 134, 120, 246] }];
    if (!bildWeg) o.push(bild());
    const w = await wahl(o); pruefe(nr);
    if (w === 'klo') break;
    bildWeg = true; F.doku = true; Ton.knack();
    await sag('Geheimes Dokument', 'Hinter dem Bild klebt ein Blatt aus dem Gästebuch: „Alle Gäste kommen zurück. Wirklich alle. Ding!“'); pruefe(nr);
    setzeText(gast(), 'Komisch. Aber du musst immer noch dringend aufs Klo!');
  }
  leere(); setzeText('', '');
  blendeWert = 1; Ton.flush();
  await warte(2600); pruefe(nr);
  await blende(0, 300); pruefe(nr);
  await sag(gast(), 'Das Licht geht wieder an. Moment mal ... der Wandkalender sieht anders aus.', 'Weiter');  pruefe(nr);
  setzeText(gast(), 'Schau dir den Kalender an.');
  const k = { t: 'Kalender ansehen', w: 1, r: [186, 46, 92, 106] };
  await wahl([k]); pruefe(nr);
  kal = true; Ton.schrill();
  await sag('Kalender', 'Es sind 67 Tage vergangen!'); pruefe(nr);
  await sag('', 'All das Lernen war umsonst ... Du hast die große Mathe-Arbeit verpasst!'); pruefe(nr);
  await sag(gast(), 'Erschöpft willst du nur noch ins Bett.', 'Weiter'); pruefe(nr);
  setzeText(gast(), 'Gute Nacht.');
  await wahl([{ t: 'Ins Bett legen', w: 1, r: [432, 256, 262, 126] }]); pruefe(nr);
  await blende(1, 700); pruefe(nr);
  leere(); setzeText('', '');
  await warte(900); pruefe(nr);
  let bummT = 0;
  szene = () => zimmer({ nacht: true, tuer: true, kalender: kal, bildWeg, bumm: bummT });
  await blende(0, 500); pruefe(nr);
  Ton.musik(true, true);
  for (let i = 0; i < 3; i++) { bummT = T; Ton.bumm(1); await warte(620); pruefe(nr); }
  setzeText('', 'BUMM BUMM BUMM! Draußen auf dem Flur trommelt etwas. Dazu läuft eine schiefe Melodie.');
  await wahl([{ t: 'Durch den Türspion schauen', w: 1, r: [172, 172, 120, 212] }]); pruefe(nr);
}
async function nacht() {
  const nr = laufNr, bildWeg = F.doku, kalender = true;
  let feind = 0, nah = 0, figuren = true, wirbel = 0;
  szene = () => spion({ figuren, feind, nah, wirbel, spricht: true });
  await sag('Durch den Spion', 'Herr Freundlich tuschelt mit Hausmeister Trommel-Toni.'); pruefe(nr);
  leere(); setzeText('Durch den Spion', 'Die Klingel läuft schwarz an. Risse. Dann ein schrilles Klingeln.');
  Ton.schrill();
  for (let i = 1; i <= 25; i++) { feind = i / 25; await warte(60); pruefe(nr); }
  await sag(HFE, 'Das Namensschild kippt um: Aus Freundlich wird Feindlich.'); pruefe(nr);
  leere(); setzeText('', 'Beide drehen sich ruckartig zu dir um und stürmen los!');
  wirbel = 18;
  for (let i = 1; i <= 20; i++) { nah = i / 26; if (i % 5 === 0) Ton.bumm(.6); await warte(45); pruefe(nr); }
  let risse = 0;
  szene = () => zimmer({ nacht: true, tuer: true, kalender, bildWeg, risse, schock: true, sx: 460 });
  for (let i = 0; i < 4; i++) { Ton.pock(1); wackeln = .35; await warte(380); pruefe(nr); }
  await sag('', 'POCK POCK POCK! Die Tür zittert. Dann wird es totenstill.'); pruefe(nr);
  Ton.musik(false);
  await wahl([{ t: 'Noch mal durch den Spion schauen', w: 1 }]); pruefe(nr);
  figuren = false; nah = 0; let gross = false;
  szene = () => spion({ figuren, gross });
  setzeText('Durch den Spion', 'Der Flur ist leer ...'); leere();
  await warte(spar.schreck ? 1500 : 1300); pruefe(nr);
  if (spar.schreck) { Ton.knack(); setzeText('Durch den Spion', 'Knack ...'); await warte(800); pruefe(nr); }
  gross = true; Ton.schreck(); wackeln = 1;
  setzeText('Beide im Chor', '„Wir werden dich finden, du Flitzpiepe!“');
  await warte(1000); pruefe(nr);
  await wahl([{ t: 'Weg von der Tür!', w: 1 }]); pruefe(nr);
  risse = 4; let schr = 0;
  szene = () => zimmer({ nacht: true, tuer: true, kalender, bildWeg, risse, schrauben: schr, schock: true, sx: 610 });
  for (; schr < 4; schr++) {
    setzeText(gast(), 'Die Tür splittert! Schraub das Gitter vom Lüftungsschacht auf!');
    await wahl([{ t: `Schraube lösen (${4 - schr} übrig)`, w: 1, r: [556, 118, 130, 82] }]); pruefe(nr);
    Ton.pock(.5); wackeln = .2;
  }
  leere(); setzeText('', 'Du kletterst hinein und rutschst in die Tiefe ...');
  Ton.rutsch();
  await blende(1, 500); pruefe(nr);
  szene = () => schacht({ fahrt: 7 });
  await blende(0, 300); pruefe(nr);
  await warte(1100); pruefe(nr);
  Ton.bumm(.8);
  await sag('', 'Rumms! Du landest unsanft im 66. Stock. Über dir klingelt es leise. Du musst runter bis zum Ausgang.', 'Los'); pruefe(nr);
}
/* ---------- Die Geschichte in 3D ---------- */
function modus3d(an) { document.body.classList.toggle('d3', !!(an && WELT)); }
const w3 = p => offen(ok => p.then(ok));
let tippGezeigt = false;
function steuerTipp() {
  if (tippGezeigt) return; tippGezeigt = true;
  const d = document.createElement('div'); d.id = 'tipp';
  d.textContent = document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches
    ? 'Links unten laufen, sonst wischen zum Umschauen' : 'W A S D laufen, Maus ziehen zum Umschauen, E benutzen';
  $('buehne').append(d); setTimeout(() => d.remove(), 7000);
}
/* Frei herumlaufen, bis ein Ziel benutzt wird. Der Knopf läuft auf Wunsch automatisch hin. */
function gehe(hinweis, ziele) {
  const nr = laufNr, koerper = document.body.classList;
  leere(); koerper.add('laufen'); setzeText('', hinweis);
  if (matchMedia('(pointer: coarse)').matches) koerper.add('touch');
  WELT.frei(true); WELT.ziele(ziele); steuerTipp();
  const touch = koerper.contains('touch');
  return offen(ok => {
    let zu = false;
    const fertig = id => {
      if (zu || nr !== laufNr) return; zu = true; aktFertig = null;
      tasteFn = null; WELT.beiNah = WELT.beiBetreten = WELT.beiEnde = null; WELT.frei(false); WELT.ziele([]); koerper.remove('laufen'); leere(); ok(id);
    };
    aktFertig = fertig;
    const nutz = knopf(''); nutz.hidden = true; $('knoepfe').append(nutz);
    nutz.addEventListener('click', () => { const id = WELT.nah(); if (id) { Ton.klick(); fertig(id); } });
    const bs = !spar.autoLauf ? [] : ziele.map(z => {
      const b = knopf(z.weit, { art: 'neben' });
      b.addEventListener('click', () => { Ton.klick(); bs.forEach(x => { x.disabled = true; }); WELT.hin(z).then(() => fertig(z.id)); });
      $('knoepfe').append(b); return b;
    });
    WELT.beiNah = id => { const z = ziele.find(q => q.id === id); nutz.hidden = !z; if (z) nutz.textContent = z.nah + (touch ? '' : ' (E)'); };
    WELT.beiBetreten = id => fertig(id);
    WELT.beiEnde = () => fertig('ende');
    tasteFn = k => { if ((k === 'e' || k === 'enter') && WELT.nah()) { Ton.klick(); fertig(WELT.nah()); return true; } return false; };
  });
}
async function story3d() {
  const nr = laufNr, Z = WELT.Z;
  /* Lobby */
  WELT.zustand({}); WELT.ort('lobby', 0, 5.2, 0); Ton.musik(true, false);
  await gehe('Willkommen! Die Rezeption ist direkt vor dir.', [Z.rezeption]); pruefe(nr);
  await w3(WELT.fokus(Z.rezeption.blick)); pruefe(nr);
  await gespraech(b => WELT.spricht(b)); pruefe(nr);
  WELT.spricht(false);
  await gehe('Du hast den Schlüssel. Der Aufzug ist rechts.', [Z.aufzug]); pruefe(nr);
  await w3(WELT.lobbyTuer(true)); pruefe(nr);
  await blende(1, 400); pruefe(nr);
  /* Aufzug */
  WELT.lobbyTuer(false); WELT.stock(1); WELT.ort('aufzug', 0, .35, 0);
  await blende(0, 400); pruefe(nr);
  await gehe('Drück den Knopf für den 67. Stock. Das Feld ist rechts neben der Tür.', [Z.knopf]); pruefe(nr);
  leere(); setzeText('', 'Der Aufzug fährt langsam los ...');
  for (const z of [1, 15, 30, 45, 60, 67]) { WELT.stock(z); Ton.tick(); await warte(780); pruefe(nr); }
  Ton.ding(); Ton.musik(false);
  await w3(WELT.kabine(true)); pruefe(nr);
  await gehe('Ding! Die Tür geht auf. Der 67. Stock ist dunkel und gähnend leer.', [Z.aussteigen]); pruefe(nr);
  await blende(1, 350); pruefe(nr);
  WELT.kabine(false);
  /* Flur */
  WELT.ort('flur', 0, 8, 0);
  await blende(0, 400); pruefe(nr);
  await gehe('Raum 67 liegt ganz am Ende des Flurs.', [Z.tuer67]); pruefe(nr);
  await blende(1, 400); pruefe(nr);
  /* Raum 67 */
  WELT.ort('zimmer', 0, -9.8, 0);
  await blende(0, 400); pruefe(nr);
  let hinweis = 'Du musst ganz dringend aufs Klo!';
  for (;;) {
    const w = await gehe(hinweis, F.doku ? [Z.klo] : [Z.klo, Z.bild]); pruefe(nr);
    if (w === 'klo') break;
    await w3(WELT.fokus(Z.bild.blick)); pruefe(nr);
    F.doku = true; Ton.knack(); await w3(WELT.bildWeg()); pruefe(nr);
    await sag('Geheimes Dokument', 'Hinter dem Bild klebt ein Blatt aus dem Gästebuch: „Alle Gäste kommen zurück. Wirklich alle. Ding!“'); pruefe(nr);
    hinweis = 'Komisch. Aber du musst immer noch dringend aufs Klo!';
  }
  leere(); setzeText('', '');
  blendeWert = 1; Ton.flush();
  await warte(2600); pruefe(nr);
  await blende(0, 300); pruefe(nr);
  await sag(gast(), 'Das Licht geht wieder an. Moment mal ... der Wandkalender sieht anders aus.'); pruefe(nr);
  await gehe('Schau dir den Kalender an.', [Z.kalender]); pruefe(nr);
  await w3(WELT.fokus(Z.kalender.blick)); pruefe(nr);
  WELT.kalender(true); Ton.schrill();
  await sag('Kalender', 'Es sind 67 Tage vergangen!'); pruefe(nr);
  await sag('', 'All das Lernen war umsonst ... Du hast die große Mathe-Arbeit verpasst!'); pruefe(nr);
  await gehe('Erschöpft willst du nur noch ins Bett.', [Z.bett]); pruefe(nr);
  await blende(1, 800); pruefe(nr);
  await warte(1000); pruefe(nr);
  /* Die Nacht */
  const stand = { nacht: true, kalender: true, bildWeg: F.doku };
  WELT.zustand(stand); WELT.ort('zimmer', .4, -11.6, Math.PI * .92);
  WELT.fokus(Z.spion.blick, 1);
  await blende(0, 500); pruefe(nr);
  Ton.musik(true, true);
  for (let i = 0; i < 3; i++) { Ton.bumm(1); await warte(620); pruefe(nr); }
  await gehe('BUMM BUMM BUMM! Draußen auf dem Flur trommelt etwas. Dazu läuft eine schiefe Melodie.', [Z.spion]); pruefe(nr);
  await blende(1, 200); pruefe(nr);
  WELT.spion(true); WELT.figuren(-4.6, 0); WELT.tempo(3, false);
  await blende(0, 250); pruefe(nr);
  await sag('Durch den Spion', 'Herr Freundlich tuschelt mit Hausmeister Trommel-Toni.'); pruefe(nr);
  leere(); setzeText('Durch den Spion', 'Die Klingel läuft schwarz an. Risse. Dann ein schrilles Klingeln.'); Ton.schrill();
  for (let i = 1; i <= 25; i++) { WELT.figuren(-4.6, i / 25); await warte(60); pruefe(nr); }
  await sag(HFE, 'Das Namensschild kippt um: Aus Freundlich wird Feindlich.'); pruefe(nr);
  leere(); setzeText('', 'Beide drehen sich ruckartig zu dir um und stürmen los!');
  WELT.tempo(18, true);
  for (let i = 1; i <= 24; i++) { WELT.figuren(-4.6 - i * .12); if (i % 6 === 0) Ton.bumm(.7); await warte(50); pruefe(nr); }
  blendeWert = 1; WELT.tempo(0, false); WELT.figurenWeg(); WELT.spion(false);
  await warte(120); pruefe(nr); blendeWert = 0;
  await w3(WELT.fokus([0, 1.5, -9], 60)); pruefe(nr);
  for (let i = 0; i < 4; i++) { Ton.pock(1); WELT.wackeln(1); wackeln = .35; await warte(380); pruefe(nr); }
  await sag('', 'POCK POCK POCK! Die Tür zittert. Dann wird es totenstill.'); pruefe(nr);
  Ton.musik(false);
  await gehe('Schau noch mal durch den Spion.', [Z.spion]); pruefe(nr);
  WELT.spion(true);
  setzeText('Durch den Spion', 'Der Flur ist leer ...'); leere();
  await warte(spar.schreck ? 1500 : 1300); pruefe(nr);
  if (spar.schreck) { Ton.knack(); setzeText('Durch den Spion', 'Knack ...'); await warte(800); pruefe(nr); }
  WELT.sprung(spar.schreck); Ton.schreck();
  setzeText('Beide im Chor', '„Wir werden dich finden, du Flitzpiepe!“');
  await warte(1900); pruefe(nr);
  WELT.figurenWeg(); WELT.spion(false); WELT.risse(6); Ton.pock(1); WELT.wackeln(2);
  await gehe('Die Tür splittert! Lauf zum Lüftungsgitter!', [Z.gitter]); pruefe(nr);
  await w3(WELT.fokus(Z.gitter.blick)); pruefe(nr);
  for (let i = 0; i < 4; i++) {
    await gehe('Schraub das Gitter auf, schnell!', [Object.assign({}, Z.gitter, { nah: `Schraube lösen (${4 - i} übrig)` })]); pruefe(nr);
    WELT.schraube(i + 1); Ton.pock(.5); WELT.wackeln(1);
  }
  leere(); setzeText('', 'Du kletterst hinein und rutschst in die Tiefe ...');
  await w3(WELT.gitterFaellt()); pruefe(nr);
  Ton.rutsch();
  await blende(1, 500); pruefe(nr);
  await warte(900); pruefe(nr);
  Ton.bumm(.8);
}
/* ---------- Der Schacht in 3D ---------- */
const BERUFE3 = {
  wiss: { n: 'Wissenschaftler', f: 'Sperrt mit der Ehrlichen Linse 3-mal eine falsche Antwort.', b: 'Weiß vorher, was im nächsten Abschnitt kommt.' },
  tech: { n: 'Techniker', f: 'Überspringt einmal pro Flucht einen Abschnitt.', b: 'Ventilatoren drehen langsamer.' },
  body: { n: 'Bodyguard', f: 'Verrammelt einmal pro Flucht das Gitter: Lärm fällt auf 0.', b: 'Ein Extra-Leben.' },
  meme: { n: 'Meme-Influencer', f: 'Hält Herrn Feindlich 2-mal für 10 Sekunden auf.', b: 'Findet mehr Gegenstände und Notizen.' }
};
const DINGE3 = {
  lampe: { n: 'Taschenlampe', frei: true }, wd40: { n: 'WD-40' }, drink: { n: 'Energy-Drink' }, fetzen: { n: 'Kalender-Fetzen' }
};
function beutelZeigen() {
  const e = $('beutel'); e.innerHTML = '';
  if (!F || !F.imSchacht) return;
  const k = (t, f, aus) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.disabled = !!aus; if (f) b.addEventListener('click', () => { Ton.klick(); f(); beutelZeigen(); hudZeigen(); document.activeElement.blur(); }); e.append(b); };
  F.dinge.forEach((d, i) => {
    if (DINGE3[d].frei) return k(DINGE3[d].n, null, true);
    k(DINGE3[d].n, () => {
      F.dinge.splice(i, 1);
      if (d === 'wd40') F.leiseBis = T + 20;
      if (d === 'drink') { F.schnellBis = T + 15; WELT.tempoSetzen(1.45); }
      if (d === 'fetzen') F.laerm = Math.max(0, F.laerm - 30);
    });
  });
  if (F.skip) k('Abkürzung', () => { F.skip = 0; if (aktFertig) aktFertig('ende'); });
  if (F.riegel) k('Verrammeln', () => { F.riegel = 0; F.laerm = 0; Ton.pock(.7); });
  if (F.ablenkung) k(`Ablenken (${F.ablenkung})`, () => { F.ablenkung--; F.stillBis = T + 10; });
  if (F.linse && F.quizAn) k(`Linse (${F.linse})`, () => { if (aktFertig) aktFertig('linse'); });
}
function jagdTick(dt) {
  if (!F || !F.jagd || !WELT) return;
  const r = { leicht: .45, normal: .75, schwer: 1.15 }[spar.zeit] * (1 + F.loop * .15) * (F.modus === 'endlos' ? 1 + F.geschafft * .03 : 1);
  if (T >= F.leiseBis && T >= F.stillBis) F.laerm = Math.min(100, F.laerm + r * dt);
  if (F.schnellBis && T >= F.schnellBis) { F.schnellBis = 0; WELT.tempoSetzen(1); }
  WELT.jaeger(F.laerm);
  F.hudUhr = (F.hudUhr || 0) + dt;
  if (F.hudUhr > .4) { F.hudUhr = 0; hudZeigen(); }
  if (F.laerm >= 100 && aktFertig) aktFertig('angriff');
}
async function angriff3d() {
  const nr = laufNr; F.jagd = false;
  leere();
  if (spar.schreck) { setzeText(HFE, 'Knack ... Hinter dir klingelt es!'); Ton.knack(); await warte(900); pruefe(nr); }
  WELT.feindVorne(); Ton.schreck();
  F.leben--; F.laerm = F.leben > 0 ? 30 : 100; hudZeigen();
  setzeText(HFE, F.leben > 0 ? '„Gefunden, Flitzpiepe! Ding!“ Du verlierst ein Leben und reißt dich los.' : '„Gefunden, Flitzpiepe! Ding!“');
  await warte(900); pruefe(nr);
  await wahl([{ t: 'Weiter', w: 1 }]); pruefe(nr);
  WELT.feindWeg(); F.jagd = true;
}
function naechsterTyp3() {
  const alle = ['quiz', 'fans', 'hebel'], l = F.typen;
  const t = alle.filter(x => l[l.length - 1] !== x);
  const w = t[Math.floor(Math.random() * t.length)]; l.push(w); return w;
}
async function abschnitt3d() {
  const nr = laufNr, typ = naechsterTyp3(), dunkel = Math.random() < .3;
  const c = { typ, dunkel, lampe: F.dinge.includes('lampe') };
  let frage = null, richtig = -1, antworten = [], folge = [], pos3 = 0;
  if (typ === 'fans') { c.n = Math.min(6, 3 + Math.floor(F.geschafft / 3)); c.tempo = { leicht: .9, normal: 1.35, schwer: 1.9 }[spar.zeit] * (F.beruf === 'tech' ? .8 : 1) * (1 + F.loop * .1); }
  if (typ === 'quiz') {
    if (!fragenRest.length) fragenRest = mische(FRAGEN);
    frage = fragenRest.pop(); antworten = mische(frage.slice(1)); richtig = antworten.indexOf(frage[1]); c.antworten = antworten; F.quizAn = true;
  } else F.quizAn = false;
  if (typ === 'hebel') {
    folge = Array.from({ length: Math.min(6, 3 + Math.floor(F.geschafft / 3) + Math.min(2, F.loop)) }, () => Math.floor(Math.random() * 4));
    c.folge = folge; c.takt = { leicht: .9, normal: .7, schwer: .5 }[spar.zeit];
  }
  const fundId = Math.random() < (F.beruf === 'meme' ? .62 : .42) ? Object.keys(DINGE3)[Math.floor(Math.random() * 4)] : null;
  if (fundId) {
    const n = DINGE3[fundId].n;
    c.fund = { seite: Math.random() < .5 ? -1 : 1, n, nah: F.dinge.length < 2 ? n + ' einstecken' : `${n} gegen ${DINGE3[F.dinge[0]].n} tauschen` };
  }
  c.ei = typ !== 'fans' && Math.random() < (F.beruf === 'meme' ? .3 : .12);
  await blende(1, 220); pruefe(nr);
  const info = WELT.abschnitt(c); let ziele = info.ziele.filter(z => !z.spaeter); const luke = info.ziele.find(z => z.spaeter);
  aktuell = { typ, richtig, folge };
  beutelZeigen(); hudZeigen();
  await blende(0, 260); pruefe(nr);
  F.jagd = true;
  const wo = F.modus === 'story' ? `Etage ${etage(F.geschafft)}. ` : '';
  const kommt = { quiz: 'Am Ende des Rohrs wartet eine Frage.', fans: 'Weich den Ventilatoren aus. Unter den oberen musst du dich ducken.', hebel: 'Hinten zeigt eine Tafel, welche Hebel du nacheinander umlegen musst.' }[typ];
  const hinweis0 = wo + (F.beruf === 'wiss' || typ === 'fans' ? kommt : 'Kriech weiter, Herr Feindlich ist hinter dir.') + (dunkel && !c.lampe ? ' Hier ist es dunkel.' : '');
  let hinweis = typ === 'quiz' ? `${wo}${frage[0]} Kriech durch das richtige Gitter.` : hinweis0;
  for (;;) {
    const id = await gehe(hinweis, ziele); pruefe(nr);
    if (id === 'ende' || id === 'ausgang' || id === 'luke') return true;
    if (id === 'angriff') { await angriff3d(); pruefe(nr); if (F.leben <= 0) return false; continue; }
    if (id === 'linse') {
      const offenG = ziele.filter(z => /^a\d$/.test(z.id) && z.id !== 'a' + richtig);
      if (offenG.length) { const z = offenG[Math.floor(Math.random() * offenG.length)]; WELT.gitterZu(+z.id[1]); ziele = ziele.filter(q => q !== z); F.linse--; beutelZeigen(); }
      continue;
    }
    if (id === 'fund') {
      if (F.dinge.length < 2) F.dinge.push(fundId); else F.dinge[0] = fundId;
      ziele = ziele.filter(z => z.id !== 'fund'); Ton.gut(); beutelZeigen();
      continue;
    }
    if (id === 'ei') {
      const satz = ['„Toni war hier. Bumm.“', '„Die Kuh grüßt.“', '„67 Striche an der Wand. Es sind 68.“', '„Das ist der Knopf von Franz.“'];
      F.coins += 5; ziele = ziele.filter(z => z.id !== 'ei'); hinweis = `Notiz: ${satz[Math.floor(Math.random() * 4)]} +5 Hotel-Coins`; Ton.gut();
      continue;
    }
    if (id[0] === 'a') {
      if (+id[1] === richtig) { Ton.gut(); return true; }
      F.laerm = Math.min(100, F.laerm + fehlerLaerm()); Ton.fehl(); Ton.pock(1); hudZeigen(); WELT.gitterZu(+id[1]);
      ziele = ziele.filter(z => z.id !== id); hinweis = `Falsch! Das Gitter knallt zu. ${frage[0]}`;
      continue;
    }
    if (id[0] === 'h') {
      const i = +id[1]; WELT.hebel(i); Ton.hebel(i);
      if (i === folge[pos3]) {
        pos3++; hinweis = `Richtig! ${pos3} von ${folge.length}.`;
        if (pos3 >= folge.length) { Ton.gut(); WELT.lukeAuf(); ziele = [...ziele.filter(z => z.id[0] !== 'h'), luke]; hinweis = 'Eine Luke ist aufgegangen. Spring hinein!'; }
      } else {
        pos3 = 0; F.laerm = Math.min(100, F.laerm + fehlerLaerm()); Ton.fehl(); Ton.pock(1); hudZeigen(); hinweis = 'Falscher Hebel! Das war laut. Fang von vorn an.';
      }
    }
  }
}
async function schacht3d() {
  const nr = laufNr; let ok = true;
  F.imSchacht = true; F.leiseBis = F.stillBis = 0; laufendesSpiel = true;
  modus3d(true); document.body.classList.add('schacht3d'); Ton.musik(false); letzteDing = 0; WELT.schachtStart(); hudZeigen();
  WELT.beiTreffer = () => { F.laerm = Math.min(100, F.laerm + fehlerLaerm() * .55); Ton.fehl(); Ton.pock(.8); dingZeigen('AUTSCH', 26); hudZeigen(); };
  const ziel = F.modus === 'story' ? STOCK.length : Infinity;
  while (F.geschafft < ziel) {
    if (!(await abschnitt3d())) { ok = false; break; }
    pruefe(nr);
    F.jagd = false; F.geschafft++; F.coins += 2; F.laerm = Math.max(0, F.laerm - 15); hudZeigen();
    if (F.geschafft < ziel) { leere(); setzeText('', 'Du rutschst weiter nach unten ...'); Ton.rutsch(); await warte(420); pruefe(nr); }
  }
  F.jagd = false; document.body.classList.remove('schacht3d'); $('beutel').innerHTML = '';
  WELT.stopp(); await blende(1, 300); pruefe(nr); modus3d(false);
  return ok;
}
async function memeEnde() {
  const nr = laufNr;
  const bonus = 20 + F.coins; spar.coins += bonus; spar.enden.meme = true; sichern();
  await blende(1, 400); pruefe(nr);
  szene = freiheit; Ton.musik(true, false);
  await blende(0, 400); pruefe(nr);
  setzeText('Meme-Ending', `Du brichst durch das letzte Gitter und entkommst in die Nacht! Die Mathe-Arbeit musst du trotzdem nachschreiben. +${bonus} Hotel-Coins`);
  const w = await wahl([{ t: 'Zurück zum Titel', w: 't' }, { t: 'Frisuren und Pyjamas', w: 'f', art: 'neben' }]); pruefe(nr);
  Ton.musik(false);
  w === 'f' ? figurMenue(titel) : titel();
}
async function schleifenEnde(grund) {
  const nr = laufNr;
  const bonus = F.coins; spar.coins += bonus; spar.enden.schleife = true; sichern();
  await blende(1, 700); pruefe(nr);
  szene = () => aussen({ nurZimmer: true });
  await blende(0, 500); pruefe(nr);
  await sag('', grund === 'doku' ? 'Du rennst aus dem Hotel ... und stehst plötzlich wieder davor. Das Gästebuch hatte recht.' : 'Alles wird schwarz. Du wachst vor dem Hotel wieder auf.'); pruefe(nr);
  await blende(1, 400); pruefe(nr);
  Ton.musik(true, true);
  if (WELT) { modus3d(true); WELT.zustand({ wild: true }); WELT.ort('lobby', 0, -1.7, 0); WELT.fokus([0, 1.5, -3.3], 1); WELT.spricht(true); }
  else szene = () => lobby({ wild: true, spricht: true });
  await blende(0, 400); pruefe(nr);
  Ton.ding(.5);
  const stufe = F.loop + 2;
  setzeText(HFE, `„Du warst schon mal hier, Flitzpiepe ...“ Die Zeitschleife beginnt von vorn: Stufe ${stufe}, alles wird schwieriger.${bonus ? ` +${bonus} Hotel-Coins` : ''}`);
  const w = await wahl([{ t: 'Direkt in den Schacht', w: 's' }, { t: 'Alles noch mal von vorn', w: 'a', art: 'neben' }, { t: 'Zurück zum Titel', w: 't', art: 'leise' }]); pruefe(nr);
  Ton.musik(false);
  if (WELT) { WELT.spricht(false); WELT.zustand({}); modus3d(false); }
  const loop = F.loop + 1;
  if (w === 't') return titel();
  neueFlucht('story', loop, false);
  if (w === 's') return schachtTeil();
  storyLauf();
}
async function schachtTeil() {
  const nr = ++laufNr;
  try {
    const ok = await (WELT ? schacht3d() : schachtFlucht()); pruefe(nr);
    schachtEnde();
    if (!ok) return await schleifenEnde('tod');
    if (F.doku) return await schleifenEnde('doku');
    await memeEnde();
  } catch (e) { if (!(e instanceof Abbruch)) throw e; }
}
async function storyLauf() {
  const nr = ++laufNr;
  laufendesSpiel = true; $('pause').hidden = false;
  try {
    if (WELT) { modus3d(true); await story3d(); pruefe(nr); }
    else {
      await rezeption(); pruefe(nr);
      await aufzugFahrt(); pruefe(nr);
      await raum67(); pruefe(nr);
      await nacht(); pruefe(nr);
    }
    const ok = await (WELT ? schacht3d() : schachtFlucht()); pruefe(nr);
    schachtEnde();
    if (!ok) return await schleifenEnde('tod');
    if (F.doku) return await schleifenEnde('doku');
    await memeEnde();
  } catch (e) { if (!(e instanceof Abbruch)) throw e; }
}
async function endlosLauf() {
  const nr = ++laufNr;
  $('pause').hidden = false;
  try {
    await (WELT ? schacht3d() : schachtFlucht()); pruefe(nr);
    schachtEnde(); blendeWert = 0;
    const n = F.geschafft, neu = n > spar.rekord; if (neu) spar.rekord = n;
    spar.coins += F.coins; sichern();
    szene = () => feindBricht();
    setzeText('Erwischt', `Du hast ${n} ${n === 1 ? 'Abschnitt' : 'Abschnitte'} geschafft.${neu ? ' Neuer Rekord!' : ` Dein Rekord: ${spar.rekord}.`} +${F.coins} Hotel-Coins`);
    const w = await wahl([{ t: 'Noch mal', w: 'n' }, { t: 'Zurück zum Titel', w: 't', art: 'leise' }]); pruefe(nr);
    if (w === 'n') { neueFlucht('endlos'); endlosLauf(); } else titel();
  } catch (e) { if (!(e instanceof Abbruch)) throw e; }
}

/* ---------- Menüs ---------- */
function titel() {
  abbrechen(); F = null; laufendesSpiel = false; $('beutel').innerHTML = ''; $('hud').hidden = true; $('pause').hidden = true; stoppeUhr();
  blendeWert = 0; Ton.musik(false);
  szene = titelBild;
  if (WELT) WELT.beiSchritt = metall => Ton.schritt(metall);
  if (WELT) { WELT.zustand({}); WELT.titel(); modus3d(true); }
  const enden = Object.keys(spar.enden).length;
  setzeText('Hotel Freundlich', 'Die Nacht von Raum 67. Check ein, versuch zu schlafen und flieh durch den Lüftungsschacht.');
  leere(); $('knoepfe').className = 'titel';
  const eins = (t, f, o) => { const b = knopf(t, o); b.addEventListener('click', () => { Ton.klick(); f(); }); $('knoepfe').append(b); return b; };
  eins('Geschichte spielen', () => figurMenue(() => berufMenue('story')), { klein: enden ? `Enden gefunden: ${enden} von 2` : 'Etwa 20 Minuten' });
  eins('Endlos-Schacht', () => figurMenue(() => berufMenue('endlos')), { art: 'neben', klein: spar.rekord ? `Rekord: ${spar.rekord}` : 'Wie weit kommst du?' });
  eins('Einstellungen', () => einstellungen(), { art: 'neben', klein: 'Schreck-Schutz: ' + (spar.schreck ? 'an' : 'aus') });
  pfadWeg();
  const p = document.createElement('p'); p.className = 'pfad'; p.id = 'pfad';
  p.innerHTML = 'Testversion, empfohlen ab 12 Jahren. <a href="../">Zurück zu den Spielen</a>';
  $('knoepfe').after(p);
  $('knoepfe').querySelector('button').focus({ preventScroll: true });
}
function pfadWeg() { const p = $('pfad'); if (p) p.remove(); }
function figurMenue(weiter) {
  pfadWeg(); abbrechen(); modus3d(false);
  szene = figurVorschau;
  const zeichne = () => {
    setzeText('Deine Figur', `Hotel-Coins: ${spar.coins}. Du verdienst sie nur beim Spielen.`);
    leere();
    const e = $('eigen');
    const f = document.createElement('label'); f.className = 'feld';
    f.innerHTML = '<span>Name</span><input id="f-name" maxlength="12" autocomplete="off" placeholder="Gast">';
    const i = f.querySelector('input'); i.value = spar.name; i.addEventListener('input', () => { spar.name = i.value.trim(); sichern(); });
    e.append(f);
    const reihe = (titelT, liste, wert, setz) => {
      const fs = document.createElement('fieldset'); fs.className = 'reihe';
      const l = document.createElement('legend'); l.textContent = titelT; fs.append(l);
      const k = document.createElement('div'); k.className = 'chips';
      liste.forEach(o => {
        const hat = !o.p || spar.besitz.includes(o.id);
        const b = document.createElement('button'); b.type = 'button'; b.className = 'chip';
        b.setAttribute('aria-pressed', wert === o.id ? 'true' : 'false');
        b.textContent = o.n + ' ';
        if (!hat) { const s = document.createElement('small'); s.textContent = o.p + ' Coins'; b.append(s); if (spar.coins < o.p) b.disabled = true, b.style.opacity = .55; }
        b.addEventListener('click', () => {
          if (!hat) { spar.coins -= o.p; spar.besitz.push(o.id); }
          setz(o.id); sichern(); zeichne();
        });
        k.append(b);
      });
      fs.append(k); e.append(fs);
    };
    reihe('Frisur', HAARE, spar.haar, v => { spar.haar = v; });
    reihe('Pyjama', PYJAMAS, spar.pyjama, v => { spar.pyjama = v; });
    reihe('Hautton', HAUT.map((h, x) => ({ id: x, n: 'Ton ' + (x + 1) })), spar.haut, v => { spar.haut = v; });
    const b = knopf('Weiter'); b.addEventListener('click', () => { Ton.klick(); weiter(); });
    $('knoepfe').append(b);
  };
  zeichne();
}
function berufMenue(modus) {
  abbrechen(); modus3d(false);
  szene = figurVorschau;
  setzeText('Dein Beruf', 'Wähle, womit du den Schacht überleben willst.');
  leere();
  Object.entries(WELT ? BERUFE3 : BERUFE).forEach(([id, b]) => {
    const k = knopf(b.n, { klein: `${b.f} ${b.b}`, art: spar.beruf === id ? '' : 'neben' });
    k.addEventListener('click', () => {
      Ton.klick(); spar.beruf = id; sichern();
      neueFlucht(modus);
      if (modus === 'story') storyLauf(); else endlosLauf();
    });
    $('knoepfe').append(k);
  });
  $('knoepfe').querySelector('button').focus({ preventScroll: true });
}

/* ---------- Start ---------- */
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
passeGroesse();
requestAnimationFrame(bild);
(document.fonts && document.fonts.ready ? document.fonts.load('40px Bungee') : Promise.resolve()).catch(() => {})
  .then(() => import('./welt.js'))
  .then(m => { if (m.Welt.start($('welt'), spar.einfach)) WELT = m.Welt; })
  .catch(() => { /* Ohne WebGL läuft die 2D-Fassung */ })
  .then(() => titel());
