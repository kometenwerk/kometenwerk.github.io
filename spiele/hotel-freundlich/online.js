/* Hotel Freundlich – Online mit Freunden
   Räume mit Code, höchstens 4 Spieler, kein Chat, keine öffentliche Liste.
   Der Raum wird gelöscht, sobald der Host das Spiel verlässt.
   Daten liegen unter hotel/<code> in der Firebase-Datenbank von Krawallzoo.
   Mit ?netztest=1 läuft alles über den Browser (nur zum Testen). */
'use strict';

const FB_CFG = { apiKey: 'AIzaSyBaCkktmwGDgr6v_8p85aa2Fl6NsjODFMQ', authDomain: 'krawallzoo.firebaseapp.com', databaseURL: 'https://krawallzoo-default-rtdb.europe-west1.firebasedatabase.app', projectId: 'krawallzoo', appId: '1:780974811882:web:5f6fb526a931ae3715c593' };
const CODE_ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_SPIELER = 4;

function ladeSkript(src) {
  return new Promise((ok, nein) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => nein(new Error('laden')); document.head.append(s); });
}
/* Echte Verbindung */
const NetzFirebase = {
  db: null, uid: null,
  async start() {
    if (this.db) return;
    const B = 'https://cdn.jsdelivr.net/npm/firebase@10.12.2/';
    await ladeSkript(B + 'firebase-app-compat.js'); await ladeSkript(B + 'firebase-auth-compat.js'); await ladeSkript(B + 'firebase-database-compat.js');
    const app = firebase.initializeApp(FB_CFG, 'hotel');
    this.db = app.database();
    const a = await app.auth().signInAnonymously(); this.uid = a.user.uid;
  },
  r(p) { return this.db.ref('hotel/' + p); },
  set(p, v) { return this.r(p).set(v); },
  update(p, v) { return this.r(p).update(v); },
  remove(p) { return this.r(p).remove(); },
  push(p, v) { return this.r(p).push(v); },
  async get(p) { return (await this.r(p).get()).val(); },
  on(p, f) { const r = this.r(p), h = s => f(s.val()); r.on('value', h); return () => r.off('value', h); },
  beimTrennenWeg(p) { return this.r(p).onDisconnect().remove(); }
};
/* Test-Verbindung über den Browser, damit zwei Fenster zusammen spielen können */
const NetzTest = {
  baum: {}, kanal: null, uid: null, hoerer: [],
  async start() {
    if (this.kanal) return;
    this.uid = 'test' + Math.random().toString(36).slice(2, 8);
    this.kanal = new BroadcastChannel('hotel-netztest');
    this.kanal.onmessage = e => {
      const m = e.data;
      if (m.art === 'frag') this.kanal.postMessage({ art: 'alles', baum: this.baum });
      if (m.art === 'alles') { this.baum = Object.assign({}, m.baum, this.baum); this.melde(''); }
      if (m.art === 'set') { this.lokal(m.p, m.v); }
    };
    this.kanal.postMessage({ art: 'frag' });
    await new Promise(r => setTimeout(r, 150));
  },
  teile(p) { return p.split('/').filter(Boolean); },
  lies(p) { let o = this.baum; for (const t of this.teile(p)) { if (o == null) return null; o = o[t]; } return o === undefined ? null : o; },
  lokal(p, v) {
    const t = this.teile(p); let o = this.baum;
    for (let i = 0; i < t.length - 1; i++) { if (typeof o[t[i]] !== 'object' || o[t[i]] === null) o[t[i]] = {}; o = o[t[i]]; }
    if (v === null) delete o[t[t.length - 1]]; else o[t[t.length - 1]] = JSON.parse(JSON.stringify(v));
    this.melde(p);
  },
  melde(p) { this.hoerer.slice().forEach(h => { if (!p || p.startsWith(h.p) || h.p.startsWith(p)) h.f(JSON.parse(JSON.stringify(this.lies(h.p)))); }); },
  schreib(p, v) { this.lokal(p, v); this.kanal.postMessage({ art: 'set', p, v }); },
  set(p, v) { this.schreib(p, v); return Promise.resolve(); },
  update(p, v) { Object.entries(v).forEach(([k, w]) => this.schreib(p + '/' + k, w)); return Promise.resolve(); },
  remove(p) { this.schreib(p, null); return Promise.resolve(); },
  push(p, v) { this.schreib(p + '/k' + Date.now() + Math.random().toString(36).slice(2, 6), v); return Promise.resolve(); },
  get(p) { return Promise.resolve(this.lies(p)); },
  on(p, f) { const h = { p, f }; this.hoerer.push(h); setTimeout(() => f(JSON.parse(JSON.stringify(this.lies(p)))), 0); return () => { this.hoerer = this.hoerer.filter(x => x !== h); }; },
  beimTrennenWeg() { return Promise.resolve(); }
};
const Netz = /[?&]netztest=1\b/.test(location.search) ? NetzTest : NetzFirebase;

/* Zustand: O = mein Platz im Raum, HO = nur beim Host */
let O = null, HO = null, onlineAus = [];

function code6() { let c = ''; for (let i = 0; i < 6; i++) c += CODE_ZEICHEN[Math.floor(Math.random() * CODE_ZEICHEN.length)]; return c; }
function fehlerText(e) {
  const m = String(e && (e.code || e.message) || '');
  if (/permission|PERMISSION/i.test(m)) return 'Online ist noch nicht freigeschaltet. Die Datenbank-Regel fehlt noch.';
  if (/laden|network|Network/i.test(m)) return 'Keine Verbindung. Prüf dein Internet und versuch es noch mal.';
  return 'Das hat nicht geklappt. Versuch es noch mal.';
}
function ichDaten() {
  return { n: gast().slice(0, 12), f: { haar: spar.haar, py: spar.pyjama, haut: spar.haut }, b: spar.beruf || 'wiss', x: 0, z: 0, r: 0 };
}
function figurVon(d) {
  const f = d.f || {}, h = f.haut || 0;
  return { haar: f.haar || 'scheitel', pyjama: PYJAMAS.find(p => p.id === f.py) || PYJAMAS[0], haut: HAUT[h], haarFarbe: ['#3a2316', '#141317', '#c58a35', '#a0432a'][h % 4] };
}
function onlineSchliessen() {
  onlineAus.forEach(f => f()); onlineAus = [];
  if (O) { const o = O; O = null; HO = null; if (o.host) Netz.remove(o.code).catch(() => {}); else Netz.remove(o.code + '/spieler/' + Netz.uid).catch(() => {}); }
  if (WELT) WELT.mitspielerWeg();
}

/* Menü */
async function onlineMenue(meldung) {
  abbrechen(); modus3d(true);
  setzeText('Mit Freunden spielen', meldung || 'Erstelle einen Raum und schick deinen Freunden den Code. Fremde finden den Raum nicht, und es gibt keinen Chat.');
  leere();
  const f = document.createElement('label'); f.className = 'feld';
  f.innerHTML = '<span>Code von Freunden</span><input id="o-code" maxlength="6" autocomplete="off" autocapitalize="characters" placeholder="ABC234">';
  $('eigen').append(f);
  const a = knopf('Raum erstellen'), b = knopf('Mit Code beitreten', { art: 'neben' }), c = knopf('Zurück', { art: 'leise' });
  a.addEventListener('click', () => { Ton.klick(); raumNeu(); });
  b.addEventListener('click', () => { Ton.klick(); raumBei($('o-code').value.trim().toUpperCase()); });
  c.addEventListener('click', () => { Ton.klick(); titel(); });
  $('knoepfe').append(a, b, c);
}
async function raumNeu() {
  setzeText('Mit Freunden spielen', 'Raum wird erstellt ...'); leere();
  try {
    await Netz.start();
    let code = code6();
    for (let i = 0; i < 4 && await Netz.get(code + '/host'); i++) code = code6();
    await Netz.set(code, { host: Netz.uid, spieler: { [Netz.uid]: ichDaten() } });
    await Netz.beimTrennenWeg(code);
    O = { code, host: true, uid: Netz.uid, s: null, sp: {}, n: -1, run: 0, ang: 0 };
    HO = { ziel: 11 };
    raumZeigen();
  } catch (e) { onlineMenue(fehlerText(e)); }
}
async function raumBei(code) {
  if (!/^[A-Z0-9]{6}$/.test(code)) return onlineMenue('Der Code hat 6 Zeichen.');
  setzeText('Mit Freunden spielen', 'Suche den Raum ...'); leere();
  try {
    await Netz.start();
    if (!await Netz.get(code + '/host')) return onlineMenue('Diesen Raum gibt es nicht. Prüf den Code.');
    const sp = await Netz.get(code + '/spieler') || {};
    if (Object.keys(sp).length >= MAX_SPIELER && !sp[Netz.uid]) return onlineMenue('Der Raum ist voll. Es passen 4 Spieler hinein.');
    await Netz.set(code + '/spieler/' + Netz.uid, ichDaten());
    await Netz.beimTrennenWeg(code + '/spieler/' + Netz.uid);
    O = { code, host: false, uid: Netz.uid, s: null, sp: {}, n: -1, run: 0, ang: 0 };
    raumZeigen();
  } catch (e) { onlineMenue(fehlerText(e)); }
}
function raumZeigen() {
  abbrechen(); modus3d(true); document.body.classList.remove('schacht3d'); $('hud').hidden = true;
  if (WELT) { WELT.zustand({}); WELT.figur(figurDaten()); WELT.menu(); WELT.mitspielerWeg(); }
  onlineAus.forEach(f => f()); onlineAus = [];
  const male = () => {
    if (!O) return;
    const namen = Object.values(O.sp).map(p => p.n);
    setzeText(`Raum ${O.code}`, `Schick deinen Freunden diesen Code. Dabei: ${namen.join(', ') || '...'} (${namen.length} von ${MAX_SPIELER})`);
    leere();
    if (O.host) {
      [[11, 'Kurz: 11 Etagen'], [33, 'Mittel: 33 Etagen'], [66, 'Alle 66 Etagen']].forEach(([z, t]) => {
        const b = knopf((HO.ziel === z ? '✓ ' : '') + t, { art: 'neben' }); b.addEventListener('click', () => { Ton.klick(); HO.ziel = z; male(); }); $('knoepfe').append(b);
      });
      const s = knopf('Flucht starten'); s.addEventListener('click', () => { Ton.klick(); fluchtStart(); }); $('knoepfe').prepend(s);
    } else setzeText(`Raum ${O.code}`, `Dabei: ${namen.join(', ')}. Der Host startet gleich die Flucht.`);
    const w = knopf('Raum verlassen', { art: 'leise' }); w.addEventListener('click', () => { Ton.klick(); titel(); }); $('knoepfe').append(w);
  };
  onlineAus.push(Netz.on(O.code + '/host', h => { if (O && !h) { O = null; onlineMenue('Der Raum wurde geschlossen.'); } }));
  onlineAus.push(Netz.on(O.code + '/spieler', sp => {
    if (!O) return; O.sp = sp || {};
    if (O.lauf) { if (WELT) WELT.mitspieler(mitspielerListe()); return; }
    male();
  }));
  onlineAus.push(Netz.on(O.code + '/spiel', s => spielNeu(s)));
  if (O.host) onlineAus.push(Netz.on(O.code + '/aktion', a => aktionenHost(a)));
}
const mitspielerListe = () => Object.entries(O.sp).filter(([u]) => u !== O.uid).map(([u, d]) => ({ id: u, name: d.n, x: d.x || 0, z: d.z || 0, r: d.r || 0, n: d.nr, figur: figurVon(d) }));

/* Host: Abschnitte auswürfeln und den gemeinsamen Stand führen */
function koopCfg(i) {
  const alle = ['quiz', 'fans', 'hebel']; if (i >= 2) alle.push('toni');
  const t = alle.filter(x => x !== HO.letzter), typ = t[Math.floor(Math.random() * t.length)]; HO.letzter = typ;
  const c = { typ, dunkel: Math.random() < .25 };
  if (typ === 'fans') { c.n = Math.min(6, 3 + Math.floor(i / 11)); c.tempo = { leicht: .9, normal: 1.35, schwer: 1.9 }[spar.zeit]; }
  if (typ === 'toni') Object.assign(c, { trommel: { leicht: 3.4, normal: 2.8, schwer: 2.2 }[spar.zeit], warn: { leicht: .9, normal: .65, schwer: .45 }[spar.zeit], still: { leicht: 1.3, normal: 1.6, schwer: 2 }[spar.zeit] });
  if (typ === 'quiz') {
    if (!HO.fragen || !HO.fragen.length) HO.fragen = mische(FRAGEN);
    const f = HO.fragen.pop(); c.antworten = mische(f.slice(1)); c.richtig = c.antworten.indexOf(f[1]); c.frage = f[0];
  }
  if (typ === 'hebel') { c.folge = Array.from({ length: Math.min(6, 3 + Math.floor(i / 11)) }, () => Math.floor(Math.random() * 4)); c.takt = { leicht: .9, normal: .7, schwer: .5 }[spar.zeit]; }
  return c;
}
function schreibSpiel(extra) {
  const s = { run: HO.run, n: HO.n, c: HO.c, laerm: Math.round(HO.laerm), leben: HO.leben, zu: HO.zu, hebel: HO.hebel, ang: HO.ang, fertig: HO.fertig || '' };
  return Netz.set(O.code + '/spiel', Object.assign(s, extra));
}
function fluchtStart() {
  const zahl = Object.keys(O.sp).length;
  Object.assign(HO, { run: Date.now(), n: 0, laerm: 0, leben: 3 + (Object.values(O.sp).some(p => p.b === 'body') ? 1 : 0), zu: { x: 0 }, hebel: 0, ang: 0, fertig: '', durch: {}, ersterDurch: 0, still: 0, uhr: 0, zahl, letzter: '' });
  HO.c = koopCfg(0); schreibSpiel();
}
function naechster() {
  HO.n++; HO.durch = {}; HO.ersterDurch = 0; HO.hebel = 0; HO.zu = { x: 0 }; HO.laerm = Math.max(0, HO.laerm - 15);
  if (HO.n >= HO.ziel) { HO.fertig = 'gewonnen'; return schreibSpiel(); }
  if (HO.n % 11 === 0) { HO.laerm = 0; HO.leben = Math.min(5, HO.leben + 1); }
  HO.c = koopCfg(HO.n); schreibSpiel();
}
function aktionenHost(a) {
  if (!a || !O || !O.host) return;
  Object.entries(a).forEach(([k, v]) => {
    Netz.remove(O.code + '/aktion/' + k);
    if (HO.gesehen && HO.gesehen[k]) return; (HO.gesehen = HO.gesehen || {})[k] = 1;
    if (HO.fertig || v.n !== HO.n) return;
    if (v.t === 'laerm') HO.laerm = Math.max(0, Math.min(100, HO.laerm + v.v));
    if (v.t === 'still') HO.still = Math.max(HO.still, T + v.s);
    if (v.t === 'falsch') { HO.zu[v.i] = 1; if (!v.frei) HO.laerm = Math.min(100, HO.laerm + fehlerLaerm()); }
    if (v.t === 'hebel') {
      if (HO.hebel < HO.c.folge.length) {
        if (v.i === HO.c.folge[HO.hebel]) HO.hebel++;
        else { HO.hebel = 0; HO.laerm = Math.min(100, HO.laerm + fehlerLaerm()); }
      }
    }
    if (v.t === 'alle') return naechster();
    if (v.t === 'durch') { HO.durch[v.u] = 1; if (!HO.ersterDurch) HO.ersterDurch = T; if (Object.keys(O.sp).every(u => HO.durch[u])) return naechster(); }
    schreibSpiel();
  });
}
function hostTick(dt) {
  if (HO.fertig || HO.n === undefined) return;
  const r = { leicht: .45, normal: .75, schwer: 1.15 }[spar.zeit];
  if (T >= HO.still) HO.laerm = Math.min(100, HO.laerm + r * dt);
  HO.uhr += dt;
  if (HO.laerm >= 100) {
    HO.leben--; HO.laerm = 30; HO.ang++;
    if (HO.leben <= 0) HO.fertig = 'verloren';
    HO.uhr = 0; return schreibSpiel();
  }
  if (HO.ersterDurch && T - HO.ersterDurch > 12) return naechster();
  if (HO.uhr >= 1) { HO.uhr = 0; schreibSpiel(); }
}

/* Alle: gemeinsamer Stand kommt herein */
function spielNeu(s) {
  if (!O || !s || !s.run) return;
  const neuerLauf = s.run !== O.run;
  O.s = s;
  if (neuerLauf && !s.fertig) { O.run = s.run; O.n = -1; O.ang = s.ang || 0; koopLauf(); return; }
  if (!O.lauf || !F) return;
  F.laerm = s.laerm; F.leben = s.leben; F.geschafft = s.n; hudZeigen();
  if ((s.ang || 0) > O.ang) { O.ang = s.ang; koopAngriff(); }
  if (s.n !== O.n || s.fertig) { if (aktFertig) aktFertig('wechsel'); return; }
  if (O.nochOffen && JSON.stringify([s.zu, s.hebel]) !== O.merk) { O.merk = JSON.stringify([s.zu, s.hebel]); if (aktFertig) aktFertig('neu'); }
}
function schick(a) { if (O) Netz.push(O.code + '/aktion', Object.assign({ n: O.s.n, u: O.uid }, a)); }
function koopAngriff() {
  WELT.feindVorne(); Ton.schreck(); dingZeigen('GEFUNDEN!', 30);
  setTimeout(() => { if (WELT) WELT.feindWeg(); }, spar.schreck ? 900 : 1300);
}
async function koopAbschnitt() {
  const nr = laufNr, s = O.s, c = Object.assign({}, s.c, { lampe: F.dinge.includes('lampe') });
  O.n = s.n; O.nochOffen = false;
  const fundId = Math.random() < (F.beruf === 'meme' ? .62 : .42) ? Object.keys(DINGE3)[Math.floor(Math.random() * 4)] : null;
  if (fundId) { const n = DINGE3[fundId].n; c.fund = { seite: Math.random() < .5 ? -1 : 1, n, nah: F.dinge.length < 2 ? n + ' einstecken' : `${n} gegen ${DINGE3[F.dinge[0]].n} tauschen` }; }
  F.quizAn = c.typ === 'quiz';
  await blende(1, 220); pruefe(nr);
  const info = WELT.abschnitt(c); let ziele = info.ziele.filter(z => !z.spaeter); const luke = info.ziele.find(z => z.spaeter);
  aktuell = { typ: c.typ, richtig: c.richtig, folge: c.folge };
  WELT.mitspieler(mitspielerListe()); beutelZeigen(); hudZeigen();
  await blende(0, 260); pruefe(nr);
  const wo = `Etage ${etage(s.n)}. `;
  const basis = { quiz: `${c.frage} Kriecht durch das richtige Gitter.`, fans: 'Weicht den Ventilatoren aus. Unter den oberen müsst ihr euch ducken.', hebel: 'Legt die Hebel gemeinsam in der Reihenfolge der Tafel um.', toni: 'Lauft nur bei grünem Licht. Bei Rot stehen bleiben!' }[c.typ];
  let hinweis = wo + basis;
  O.nochOffen = true; O.merk = JSON.stringify([s.zu, s.hebel]);
  for (;;) {
    const j = O.s;
    if (j.n !== s.n || j.fertig) return;
    if (c.typ === 'quiz') { ziele = ziele.filter(z => !(/^a\d$/.test(z.id) && j.zu && j.zu[z.id[1]])); Object.keys(j.zu || {}).forEach(k => { if (k !== 'x') WELT.gitterZu(+k); }); }
    if (c.typ === 'hebel' && j.hebel >= c.folge.length && !ziele.includes(luke)) { WELT.lukeAuf(); ziele = [...ziele.filter(z => z.id[0] !== 'h'), luke]; hinweis = 'Die Luke ist offen. Springt hinein!'; }
    else if (c.typ === 'hebel') hinweis = `${wo}${basis} Geschafft: ${j.hebel || 0} von ${c.folge.length}.`;
    const id = await gehe(hinweis, ziele); pruefe(nr);
    if (id === 'wechsel') return;
    if (id === 'neu' || id === 'angriff') continue;
    if (id === 'ende' || id === 'ausgang' || id === 'luke') {
      schick({ t: 'durch' }); O.nochOffen = false;
      leere(); setzeText('', 'Geschafft! Warte auf die anderen ...');
      while (O && O.s.n === s.n && !O.s.fertig) { await warte(150); pruefe(nr); }
      return;
    }
    if (id === 'linse') {
      const off = ziele.filter(z => /^a\d$/.test(z.id) && z.id !== 'a' + c.richtig);
      if (off.length) { const z = off[Math.floor(Math.random() * off.length)]; schick({ t: 'falsch', i: +z.id[1], frei: 1 }); F.linse--; beutelZeigen(); }
      continue;
    }
    if (id === 'fund') { if (F.dinge.length < 2) F.dinge.push(fundId); else F.dinge[0] = fundId; ziele = ziele.filter(z => z.id !== 'fund'); Ton.gut(); beutelZeigen(); continue; }
    if (id[0] === 'a') {
      if (+id[1] === c.richtig) { Ton.gut(); schick({ t: 'alle' }); leere(); setzeText('', 'Richtig! Das Gitter ist offen.'); while (O && O.s.n === s.n && !O.s.fertig) { await warte(150); pruefe(nr); } return; }
      Ton.fehl(); Ton.pock(1); schick({ t: 'falsch', i: +id[1] }); hinweis = `Falsch! Das Gitter knallt zu. ${c.frage}`; continue;
    }
    if (id[0] === 'h') { const i = +id[1]; WELT.hebel(i); Ton.hebel(i); schick({ t: 'hebel', i }); await warte(250); pruefe(nr); }
  }
}
async function koopLauf() {
  abbrechen(); const nr = ++laufNr, ich = O.sp[O.uid] || ichDaten();
  spar.beruf = ich.b; neueFlucht('koop');
  leere(); setzeText('', 'Die Flucht beginnt ...');
  F.imSchacht = true; O.lauf = true; O.pos = 0; laufendesSpiel = true; F.leiseBis = F.stillBis = 0;
  try {
    $('pause').hidden = true; modus3d(true); document.body.classList.add('schacht3d'); Ton.musik(false); letzteDing = 0; WELT.schachtStart(); pfadWeg();
    WELT.beiTreffer = () => { Ton.fehl(); Ton.pock(.8); dingZeigen('AUTSCH', 26); schick({ t: 'laerm', v: fehlerLaerm() * .55 }); };
    WELT.beiBumm = () => Ton.bumm(.45); WELT.beiStill = () => { Ton.knack(); dingZeigen('STOPP!', 30); };
    while (O && !O.s.fertig) { await koopAbschnitt(); pruefe(nr); while (O && !O.s.fertig && O.s.n === O.n) { await warte(100); pruefe(nr); } }
    if (!O) return;
    const sieg = O.s.fertig === 'gewonnen', n = O.s.n;
    O.lauf = false; F.jagd = false; document.body.classList.remove('schacht3d'); WELT.stopp(); schachtEnde(); WELT.mitspielerWeg();
    const bonus = n * 2 + (sieg ? 20 : 0); spar.coins += bonus; sichern();
    await blende(1, 300); pruefe(nr);
    if (sieg) { WELT.figur(figurDaten()); WELT.endeBild('frei'); Ton.musik(true, false); }
    await blende(0, 300); pruefe(nr);
    setzeText(sieg ? 'Geschafft!' : 'Erwischt', (sieg ? 'Ihr seid gemeinsam entkommen!' : `Herr Feindlich hat euch erwischt. Ihr seid bis Etage ${etage(n)} gekommen.`) + ` +${bonus} Hotel-Coins`);
    await wahl([{ t: 'Zurück in den Raum', w: 1 }]); pruefe(nr);
    Ton.musik(false); raumZeigen();
  } catch (e) { if (!(e instanceof Abbruch)) throw e; }
}
/* Läuft in jedem Bild */
let posUhr = 0;
function onlineTick(dt) {
  if (!O) return;
  if (O.lauf && O.host && HO) hostTick(dt);
  if (O.lauf && WELT) {
    WELT.jaeger(F ? F.laerm : 0);
    posUhr += dt;
    if (posUhr > .2) {
      posUhr = 0; const w = WELT.wo(), a = O.ichPos;
      if (!a || Math.abs(a[0] - w[0]) + Math.abs(a[1] - w[1]) + Math.abs(a[2] - w[2]) > .02) {
        O.ichPos = w; Netz.update(O.code + '/spieler/' + O.uid, { x: +w[0].toFixed(2), z: +w[1].toFixed(2), r: +w[2].toFixed(2), nr: O.n }).catch(() => {});
      }
    }
  }
}
