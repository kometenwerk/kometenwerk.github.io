// FIDELIA Notizen · Abgleich zwischen deinen Geräten (Handy ↔ Laptop)
// Ablauf: Ein Gerät zeigt einen QR-Code mit einem geheimen Schlüssel, das andere scannt ihn (einmal).
// Danach schickt jedes Gerät Änderungen verschlüsselt (AES-GCM, Web Crypto) über Firebase.
// Der Server sieht nur Datensalat und löscht jedes Päckchen, sobald alle anderen Geräte es abgeholt haben.
// Der Schlüssel steht nur im QR-Code/Link und auf deinen Geräten – nie auf dem Server.

import * as S from "./speicher.js";

const KW = typeof window !== "undefined" ? window.KW : {}, esc = KW.esc;
const GERAET = typeof location !== "undefined" && /[?&]demo=1\b/.test(location.search) ? "-" + (new URLSearchParams(location.search).get("geraet") || "a") : "";
const KEY = "kw-notizen-sync" + GERAET, WEG_KEY = "kw-notizen-weg" + GERAET;
const FB = "https://cdn.jsdelivr.net/npm/firebase@10.12.2/";
const CFG = { apiKey: "AIzaSyBaCkktmwGDgr6v_8p85aa2Fl6NsjODFMQ", authDomain: "krawallzoo.firebaseapp.com", databaseURL: "https://krawallzoo-default-rtdb.europe-west1.firebasedatabase.app", projectId: "krawallzoo", storageBucket: "krawallzoo.firebasestorage.app" };
const MAX_ALTER = 30 * 864e5; // nie abgeholte Päckchen nach 30 Tagen weg
const TE = new TextEncoder(), TD = new TextDecoder();

/* ---------- Reine Helfer (testbar) ---------- */

export function b64(buf) { const b = new Uint8Array(buf); let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
export function unb64(s) { s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const r = atob(s), b = new Uint8Array(r.length); for (let i = 0; i < r.length; i++) b[i] = r.charCodeAt(i); return b; }
const hex = (buf) => Array.from(new Uint8Array(buf), x => x.toString(16).padStart(2, "0")).join("");

// Kopplungs-Link lesen: …#koppeln=<gruppe>.<schlüssel>
export function linkLesen(text) {
  const m = String(text || "").match(/koppeln=([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})/);
  return m ? { g: m[1], k: m[2] } : null;
}

// Wer gewinnt? Die neuere Version (Zeitstempel als ISO-Text). Gelöschtes bleibt gelöscht, wenn das Löschen neuer ist.
export function gewinnt(lokal, fern, geloeschtUm) {
  const z = (x) => String((x && x.geaendert) || "");
  if (geloeschtUm && geloeschtUm >= z(fern)) return "lokal";
  if (!lokal) return "fern";
  return z(fern) > z(lokal) ? "fern" : "lokal";
}

// Hausaufgaben mischen: alles von beiden Geräten, „erledigt“ gewinnt
export function planerMischen(lokal, fern) {
  const out = (lokal || []).map(e => Object.assign({}, e));
  for (const f of fern || []) {
    const l = out.find(e => e.id === f.id);
    if (!l) out.push(Object.assign({}, f));
    else if (f.erledigt && !l.erledigt) l.erledigt = true;
  }
  return out;
}

/* ---------- Zustand ---------- */

let A = null, server = null, schluessel = null, abmelden = [], verbunden = false, letzte = null, fehler = "";
const warten = {}; // Seite/Lernset → Timer (Änderungen sammeln)
let planerStand = "";

const zustand = () => KW.load(KEY, null);
export const gekoppelt = () => !!(zustand() && zustand().g);
const wegListe = () => KW.load(WEG_KEY, {});
function wegMerken(id) { const w = wegListe(); w[id] = new Date().toISOString(); KW.save(WEG_KEY, w); }

/* ---------- Verschlüsselung ---------- */

async function schluesselLaden(k) { return crypto.subtle.importKey("raw", unb64(k), "AES-GCM", false, ["encrypt", "decrypt"]); }
async function schloss(k) { return hex(await crypto.subtle.digest("SHA-256", TE.encode("fidelia-notizen/schloss/" + k))); }
async function zu(obj, zusatz) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: TE.encode(zusatz) }, schluessel, TE.encode(JSON.stringify(obj)));
  return { iv: b64(iv), d: b64(ct) };
}
async function auf(iv, d, zusatz) {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv), additionalData: TE.encode(zusatz) }, schluessel, unb64(d));
  return JSON.parse(TD.decode(pt));
}
const neueId = () => hex(crypto.getRandomValues(new Uint8Array(12)));

/* ---------- Server (Firebase, oder ?demo=1 zum Testen ohne Internet) ---------- */

function skript(src) { return new Promise((ok, nein) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = nein; document.head.appendChild(s); }); }

async function firebaseServer() {
  if (!window.firebase) { await skript(FB + "firebase-app-compat.js"); await skript(FB + "firebase-auth-compat.js"); await skript(FB + "firebase-database-compat.js"); }
  if (!firebase.apps.length) firebase.initializeApp(CFG);
  const d = firebase.database(), auth = firebase.auth();
  await new Promise(r => { const un = auth.onAuthStateChanged(() => { un(); r(); }); });
  if (!auth.currentUser) await auth.signInAnonymously();
  return {
    uid: auth.currentUser.uid,
    zeit: firebase.database.ServerValue.TIMESTAMP,
    setzen: (p, w) => d.ref(p).set(w),
    weg: (p) => d.ref(p).remove(),
    lesen: async (p) => (await d.ref(p).once("value")).val(),
    neu: (p, cb) => { const r = d.ref(p), f = r.on("child_added", s => cb(s.key, s.val())); return () => r.off("child_added", f); },
    aenderung: (p, cb) => { const r = d.ref(p), f = r.on("value", s => cb(s.val())); return () => r.off("value", f); }
  };
}

// Test-Server: alle Tabs dieses Browsers teilen sich einen Speicher (localStorage + BroadcastChannel).
// Jeder Pfad ist ein eigener Eintrag, damit sich zwei Tabs nicht gegenseitig überschreiben.
function demoServer() {
  const L = "kw-notizen-demoserver:", kanal = new BroadcastChannel("kw-notizen-demoserver");
  const uid = "demo-" + (new URLSearchParams(location.search).get("geraet") || "a");
  const schluesselUnter = (p) => Object.keys(localStorage).filter(k => k === L + p || k.startsWith(L + p + "/"));
  function hol(p) {
    let wert = null;
    for (const k of schluesselUnter(p).sort((x, y) => x.length - y.length)) {
      const rest = k.slice((L + p).length).split("/").filter(Boolean), v = JSON.parse(localStorage.getItem(k));
      if (!rest.length) { wert = v; continue; }
      if (!wert || typeof wert !== "object") wert = {};
      let x = wert;
      for (let i = 0; i < rest.length - 1; i++) x = x[rest[i]] = (x[rest[i]] && typeof x[rest[i]] === "object") ? x[rest[i]] : {};
      x[rest[rest.length - 1]] = v;
    }
    return wert;
  }
  const hoerer = new Set();
  function setz(p, w) {
    schluesselUnter(p).forEach(k => localStorage.removeItem(k));
    if (w != null) localStorage.setItem(L + p, JSON.stringify(w));
    kanal.postMessage(p); hoerer.forEach(h => h(p));
  }
  kanal.onmessage = (e) => hoerer.forEach(h => h(e.data));
  return {
    uid, zeit: Date.now(),
    setzen: async (p, w) => setz(p, w),
    weg: async (p) => setz(p, null),
    lesen: async (p) => hol(p),
    neu: (p, cb) => {
      const gesehen = new Set();
      const pruefen = () => { const o = hol(p) || {}; for (const k of Object.keys(o)) if (!gesehen.has(k)) { gesehen.add(k); cb(k, o[k]); } };
      // localStorage aus anderen Tabs kommt manchmal etwas später an als die Nachricht → kurz nachschauen
      const h = (q) => { if (q.startsWith(p)) { pruefen(); setTimeout(pruefen, 80); setTimeout(pruefen, 500); } };
      hoerer.add(h); pruefen();
      return () => hoerer.delete(h);
    },
    aenderung: (p, cb) => { const h = (q) => { if (q.startsWith(p)) setTimeout(() => cb(hol(p)), 80); }; hoerer.add(h); cb(hol(p)); return () => hoerer.delete(h); }
  };
}
const DEMO = typeof location !== "undefined" && /[?&]demo=1\b/.test(location.search);
async function serverHolen() { if (!server) server = DEMO ? demoServer() : await firebaseServer(); return server; }

/* ---------- Senden ---------- */

async function senden(obj) {
  const z = zustand();
  if (!z || !schluessel || !server) return;
  const pid = neueId(), pfad = "fnotiz/post/" + z.g + "/" + pid;
  const v = await zu(obj, z.g + "/" + pid);
  await server.setzen(pfad, { von: server.uid, iv: v.iv, d: v.d, zeit: server.zeit });
  letzte = new Date();
}

function blobZuText(blob) { return new Promise(ok => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(blob); }); }

// Wird von der App aufgerufen, wenn sich etwas ändert
export function melden(art, wert) {
  if (art === "weg") wegMerken(wert.id);
  if ((art === "seite" || art === "lern") && wegListe()[wert.id]) { const w = wegListe(); delete w[wert.id]; KW.save(WEG_KEY, w); }
  if (!gekoppelt() || !verbunden) return;
  if (art === "seite" || art === "lern") {
    const id = art + ":" + wert.id;
    clearTimeout(warten[id]);
    warten[id] = setTimeout(() => { delete warten[id]; senden({ art, wert }).catch(() => {}); }, 2500);
  } else if (art === "bild") {
    blobZuText(wert.blob).then(d => senden({ art: "bild", id: wert.id, d })).catch(() => {});
  } else if (art === "weg") {
    clearTimeout(warten[wert.typ + ":" + wert.id]);
    senden({ art: "weg", typ: wert.typ, id: wert.id, um: new Date().toISOString() }).catch(() => {});
  }
}

function planerPruefen() {
  if (!verbunden) return;
  const p = KW.load("kw-planer", null);
  const e = p && Array.isArray(p.eintraege) ? p.eintraege : [];
  const stand = JSON.stringify(e);
  if (stand === planerStand) return;
  planerStand = stand;
  senden({ art: "planer", eintraege: e }).catch(() => {});
}

// Alles schicken (beim Koppeln und wenn ein neues Gerät dazukommt)
export async function allesSenden(anzeige) {
  let n = 0;
  const bilder = new Set(A.seiten.map(s => s.bild).filter(Boolean));
  for (const id of bilder) { const b = await S.hole("bilder", id); if (b) { await senden({ art: "bild", id, d: await blobZuText(b) }); n++; anzeige && anzeige(n); } }
  for (const s of A.seiten) { await senden({ art: "seite", wert: s }); n++; anzeige && anzeige(n); }
  for (const l of A.lern) { await senden({ art: "lern", wert: l }); n++; }
  planerStand = ""; planerPruefen();
  return n;
}

/* ---------- Kurze Nachrichten zwischen den Geräten (z. B. Handy-Fernbedienung) ---------- */
const kanalHoerer = new Map();
export const bereit = () => gekoppelt() && verbunden;
export function hoeren(typ, cb) { if (!kanalHoerer.has(typ)) kanalHoerer.set(typ, new Set()); kanalHoerer.get(typ).add(cb); return () => kanalHoerer.get(typ).delete(cb); }
export function blitz(typ, daten) { if (!bereit()) return false; senden({ art: "blitz", typ, daten, um: Date.now() }).catch(() => {}); return true; }

/* ---------- Empfangen ---------- */

let neuZaehler = 0, neuTimer = null;
async function empfangen(pid, post) {
  const z = zustand();
  if (!post || post.von === server.uid || (post.ack && post.ack[server.uid])) return;
  let obj;
  try { obj = await auf(post.iv, post.d, z.g + "/" + pid); } catch (e) { return; } // falscher Schlüssel → ignorieren
  const weg = wegListe();
  if (obj.art === "seite" && obj.wert && obj.wert.id) {
    const lokal = A.seiten.find(s => s.id === obj.wert.id);
    if (gewinnt(lokal, obj.wert, weg[obj.wert.id]) === "fern") {
      await S.lege("seiten", obj.wert);
      if (lokal) Object.assign(lokal, obj.wert); else A.seiten.unshift(obj.wert);
      neuZaehler++;
    }
  } else if (obj.art === "lern" && obj.wert && obj.wert.id) {
    const lokal = A.lern.find(s => s.id === obj.wert.id);
    if (gewinnt(lokal, obj.wert, weg[obj.wert.id]) === "fern") {
      await S.lege("lern", obj.wert);
      if (lokal) Object.assign(lokal, obj.wert); else A.lern.unshift(obj.wert);
      neuZaehler++;
    }
  } else if (obj.art === "bild" && obj.id && obj.d) {
    if (!(await S.hole("bilder", obj.id))) await S.lege("bilder", await (await fetch(obj.d)).blob(), obj.id);
  } else if (obj.art === "weg" && obj.id) {
    const liste = obj.typ === "lern" ? A.lern : A.seiten, lokal = liste.find(x => x.id === obj.id);
    if (lokal && String(lokal.geaendert || "") <= obj.um) {
      liste.splice(liste.indexOf(lokal), 1);
      await S.weg(obj.typ === "lern" ? "lern" : "seiten", obj.id);
      if (lokal.bild) await S.weg("bilder", lokal.bild);
      neuZaehler++;
    }
    const w = wegListe(); w[obj.id] = obj.um; KW.save(WEG_KEY, w);
  } else if (obj.art === "blitz" && obj.typ) {
    if (Date.now() - (obj.um || 0) < 120000) (kanalHoerer.get(obj.typ) || []).forEach(cb => { try { cb(obj.daten || {}); } catch (e) {} });
  } else if (obj.art === "planer" && Array.isArray(obj.eintraege)) {
    const p = KW.load("kw-planer", null) || { eintraege: [] };
    if (!Array.isArray(p.eintraege)) p.eintraege = [];
    const neu = planerMischen(p.eintraege, obj.eintraege);
    if (JSON.stringify(neu) !== JSON.stringify(p.eintraege)) { p.eintraege = neu; KW.save("kw-planer", p); neuZaehler++; }
    planerStand = JSON.stringify(p.eintraege);
  }
  letzte = new Date();
  // Abholen quittieren; wenn alle anderen Geräte es haben, Päckchen löschen
  try {
    const pfad = "fnotiz/post/" + z.g + "/" + pid;
    await server.setzen(pfad + "/ack/" + server.uid, true);
    const [ack, mitglieder] = await Promise.all([server.lesen(pfad + "/ack"), server.lesen("fnotiz/mitglied/" + z.g)]);
    if (Object.keys(ack || {}).length >= Object.keys(mitglieder || {}).length - 1) await server.weg(pfad);
  } catch (e) {}
  clearTimeout(neuTimer);
  neuTimer = setTimeout(() => {
    if (!neuZaehler) return;
    KW.toast("📱 " + neuZaehler + (neuZaehler === 1 ? " Änderung" : " Änderungen") + " von deinem anderen Gerät");
    neuZaehler = 0;
    A.nachAbgleich && A.nachAbgleich();
  }, 900);
}

/* ---------- Verbinden, Koppeln, Trennen ---------- */

export async function verbinden() {
  const z = zustand();
  if (!z || verbunden) return;
  try {
    await serverHolen();
    schluessel = await schluesselLaden(z.k);
    // Eigene Mitgliedschaft sicherstellen (nach Neuinstallation oder auf neuem Gerät)
    await server.setzen("fnotiz/mitglied/" + z.g + "/" + server.uid, await schloss(z.k));
    verbunden = true; fehler = "";
    abmelden.push(server.neu("fnotiz/post/" + z.g, (pid, post) => empfangen(pid, post)));
    // Neues Gerät in der Gruppe? Dann bekommt es alles.
    abmelden.push(server.aenderung("fnotiz/mitglied/" + z.g, (m) => {
      const z2 = zustand(); if (!z2 || !m) return;
      const bekannt = z2.bekannt || [], jetzt = Object.keys(m);
      const neu = jetzt.filter(u => u !== server.uid && !bekannt.includes(u));
      z2.bekannt = jetzt; KW.save(KEY, z2);
      if (neu.length && bekannt.length) allesSenden().catch(() => {});
    }));
    // Alte, nie abgeholte Päckchen aufräumen
    server.lesen("fnotiz/post/" + z.g).then(alle => {
      for (const [pid, p] of Object.entries(alle || {})) if (p && typeof p.zeit === "number" && Date.now() - p.zeit > MAX_ALTER) server.weg("fnotiz/post/" + z.g + "/" + pid);
    }).catch(() => {});
    setInterval(planerPruefen, 15000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) planerPruefen(); });
    planerPruefen();
  } catch (e) {
    verbunden = false;
    fehler = /permission|PERMISSION/i.test(String(e && (e.code || e.message))) ? "regeln" : "netz";
  }
}

// Gruppe anlegen (erstes Gerät) und Link für das andere Gerät liefern
export async function koppelLink() {
  let z = zustand();
  if (!z) {
    await serverHolen();
    const g = b64(crypto.getRandomValues(new Uint8Array(16))), k = b64(crypto.getRandomValues(new Uint8Array(32)));
    await server.setzen("fnotiz/schloss/" + g, await schloss(k));
    z = { g, k, seit: new Date().toISOString(), bekannt: [server.uid] };
    KW.save(KEY, z);
    await verbinden();
  }
  return location.origin + location.pathname.replace(/index\.html$/, "") + (DEMO ? location.search.replace(/geraet=[^&]*/, "geraet=b") : "") + "#koppeln=" + z.g + "." + z.k;
}

export async function beitreten(text) {
  const c = linkLesen(text);
  if (!c) throw new Error("kein-link");
  const alt = zustand();
  if (alt && alt.g === c.g) return "schon";
  abmelden.forEach(f => f()); abmelden = []; verbunden = false;
  KW.save(KEY, { g: c.g, k: c.k, seit: new Date().toISOString(), bekannt: [] });
  await verbinden();
  if (!verbunden) throw new Error(fehler || "netz");
  await allesSenden();
  return "ok";
}

export async function trennen() {
  const z = zustand();
  try { if (z && server) await server.weg("fnotiz/mitglied/" + z.g + "/" + server.uid); } catch (e) {}
  abmelden.forEach(f => f()); abmelden = []; verbunden = false; schluessel = null;
  localStorage.removeItem(KEY);
}

export function start(app) {
  A = app;
  if (gekoppelt()) verbinden();
}

/* ---------- Einstellungs-Bereich „Geräte verbinden“ ---------- */

function qrMalen(el, text) {
  if (!window.qrcode) { skript("../shared/vendor/qr/qrcode.js").then(() => qrMalen(el, text)); return; }
  const q = window.qrcode(0, "M"); q.addData(text); q.make();
  el.innerHTML = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
}

export function bereich(el) {
  const z = zustand();
  let h = "";
  if (!z) {
    h = '<p>Verbinde dein Handy und deinen Laptop: Was du auf einem Gerät scannst oder schreibst, ist ein paar Sekunden später auch auf dem anderen.</p>' +
      '<div class="row"><button type="button" class="btn primary" id="syQr">📱 QR-Code zeigen</button><button type="button" class="btn" id="syScan">📷 Code scannen</button></div>' +
      '<p class="muted klein">🔒 Alles wird verschlüsselt. Der Schlüssel steckt nur im QR-Code – der Server sieht nur Datensalat und löscht ihn nach dem Abholen.</p>';
  } else {
    const anzahl = Math.max(0, (z.bekannt || []).length - 1);
    h = '<div class="ki-status ' + (verbunden ? "gut" : "mittel") + '">' + (verbunden ? "✅ <b>Verbunden</b> – " + (anzahl ? anzahl + (anzahl === 1 ? " anderes Gerät" : " andere Geräte") : "warte auf das andere Gerät") : fehler === "regeln" ? "⚠️ <b>Der Server lässt noch nicht zu.</b> Die Firebase-Regeln für Notizen fehlen (siehe notizen/FIREBASE_EINFUEGEN.txt)." : "⚠️ <b>Gerade keine Verbindung.</b> Sobald du online bist, gleicht die App wieder ab.") +
      (letzte ? '<br><small>Zuletzt abgeglichen: ' + letzte.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + '</small>' : "") + '</div>' +
      '<div class="row"><button type="button" class="btn" id="syQr">➕ Weiteres Gerät</button><button type="button" class="btn" id="syAlles">🔄 Alles nochmal senden</button><button type="button" class="btn danger" id="syTrennen">Trennen</button></div>';
  }
  h += '<div id="syBox"></div>';
  el.innerHTML = h;
  const box = el.querySelector("#syBox");
  const q = (s) => el.querySelector(s);
  q("#syQr").onclick = async () => {
    box.innerHTML = '<p class="muted">Einen Moment …</p>';
    try {
      const link = await koppelLink();
      box.innerHTML = '<div class="kopplung card"><div class="qr" id="syQrBild"></div><div><b>So geht\'s:</b><ol><li>Öffne auf dem anderen Gerät die <b>Kamera</b>.</li><li>Halte sie auf den Code und tippe auf den Link.</li><li>Fertig – die Geräte gleichen sich ab.</li></ol>' +
        '<p class="muted klein">Zeig den Code niemand anderem: Wer ihn hat, kann dein Heft lesen.</p><button type="button" class="btn small" id="syKopie">Link kopieren</button></div></div>';
      qrMalen(box.querySelector("#syQrBild"), link);
      box.querySelector("#syKopie").onclick = () => { try { navigator.clipboard.writeText(link); KW.toast("Link kopiert – nur an dich selbst schicken!"); } catch (e) {} };
    } catch (e) {
      box.innerHTML = '<p class="muted">Das ging gerade nicht (' + (fehler === "regeln" || /permission/i.test(String(e && (e.code || e.message))) ? "die Server-Regeln fehlen noch" : "keine Verbindung") + ').</p>';
    }
  };
  const scan = q("#syScan");
  if (scan) scan.onclick = () => scannen(box, () => bereich(el));
  const alles = q("#syAlles");
  if (alles) alles.onclick = async () => { alles.disabled = true; const n = await allesSenden(x => { alles.textContent = "🔄 " + x + " gesendet …"; }); KW.toast(n + " Teile gesendet."); bereich(el); };
  const tr = q("#syTrennen");
  if (tr) tr.onclick = async () => { if (!confirm("Dieses Gerät trennen? Deine Daten bleiben hier, werden aber nicht mehr abgeglichen.")) return; await trennen(); KW.toast("Getrennt."); bereich(el); };
}

// QR-Code mit der Kamera lesen (oder Link einfügen)
function scannen(box, fertig) {
  box.innerHTML = '<div class="kopplung card"><video id="syVideo" playsinline muted aria-label="Kamerabild"></video><div><p>Halte die Kamera auf den QR-Code vom anderen Gerät.</p>' +
    '<label class="field"><span>Oder Link einfügen</span><input class="inp" id="syLink" placeholder="https://…#koppeln=…"></label><button type="button" class="btn small primary" id="syOk">Verbinden</button></div></div>';
  let strom = null, timer = null;
  const stopp = () => { clearInterval(timer); if (strom) strom.getTracks().forEach(t => t.stop()); strom = null; };
  async function los(text) {
    stopp();
    box.innerHTML = '<p class="muted">Verbinde und schicke dein Heft rüber …</p>';
    try { await beitreten(text); KW.toast("✅ Verbunden!"); fertig(); }
    catch (e) { box.innerHTML = '<p class="muted">' + (e.message === "kein-link" ? "Das ist kein FIDELIA-Notizen-Code." : e.message === "regeln" ? "Der Server lässt noch nicht zu (Firebase-Regeln fehlen)." : "Keine Verbindung. Versuch es nochmal.") + '</p>'; }
  }
  box.querySelector("#syOk").onclick = () => los(box.querySelector("#syLink").value);
  (async () => {
    try {
      strom = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
      const v = box.querySelector("#syVideo"); v.srcObject = strom; await v.play();
      let leser = null;
      if ("BarcodeDetector" in window) { try { leser = new window.BarcodeDetector({ formats: ["qr_code"] }); } catch (e) {} }
      if (!leser && !window.jsQR) await skript("../shared/vendor/qr/jsQR.js");
      const c = document.createElement("canvas"), g = c.getContext("2d", { willReadFrequently: true });
      timer = setInterval(async () => {
        if (!v.videoWidth || !document.body.contains(v)) { if (!document.body.contains(v)) stopp(); return; }
        let text = "";
        if (leser) { const r = await leser.detect(v).catch(() => []); text = r[0] ? r[0].rawValue : ""; }
        else { const w = 480, h = Math.round(480 * v.videoHeight / v.videoWidth); c.width = w; c.height = h; g.drawImage(v, 0, 0, w, h); const r = window.jsQR(g.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" }); text = r ? r.data : ""; }
        if (linkLesen(text)) los(text);
      }, 300);
    } catch (e) { /* keine Kamera – Link einfügen geht trotzdem */ }
  })();
}
