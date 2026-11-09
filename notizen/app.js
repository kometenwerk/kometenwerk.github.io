// FIDELIA Notizen · Schul-Cockpit
// Hauptteil: Seitenleiste, Navigation, gemeinsame Daten und Hintergrund-Arbeit (Texterkennung, Sortieren).
// Alle Module bekommen dasselbe Objekt "A" und teilen darüber ihre Daten.

import * as S from "./speicher.js";
import * as E from "./einstellungen.js";
import * as KI from "./ki.js";
import * as Heft from "./heft.js";
import * as Scanner from "./scanner.js";
import * as Planer from "./planer.js";
import * as Lernen from "./lernen.js";
import * as Audio from "./audio.js";
import * as Start from "./start.js";
import * as Sync from "./sync.js";
import * as Nachbau from "./nachbau.js";
import * as Tabellen from "./tabellen.js";
import * as Folien from "./folien.js";

const KW = window.KW, esc = KW.esc;

const A = {
  einst: E.laden(),
  seiten: [],
  lern: [],
  esc,
  toast: KW.toast
};
window.FIDELIA_NOTIZEN = A; // zum Ausprobieren in der Konsole

/* ---------- Gemeinsame Daten ---------- */

A.faecher = () => A.einst.faecher;
A.fachFarbe = (name) => { const f = A.einst.faecher.find(x => x.name === name) || E.planerFaecher().find(x => x.name === name); return f ? f.farbe : "#8a94a6"; };
A.fachInfo = (name) => name ? { name, farbe: A.fachFarbe(name) } : { name: "Unsortiert", farbe: "#8a94a6" };

A.seiteNeu = async (werte) => {
  const jetzt = new Date().toISOString();
  const s = Object.assign({ id: KW.id(), fach: "", titel: "", erstellt: jetzt, geaendert: jetzt, quelle: "heft",
    raster: A.einst.f.heft.raster, hoehe: 297, text: "", striche: [], bild: null, ocr: "", vorschlag: null, pin: false }, werte);
  A.seiten.unshift(s);
  await S.lege("seiten", s);
  Sync.melden("seite", s);
  return s;
};
A.seiteSpeichern = async (s) => { s.geaendert = new Date().toISOString(); await S.lege("seiten", s); Sync.melden("seite", s); };
// Löschen = in den Papierkorb (30 Tage), erst „endgültig“ ist wirklich weg
// Nur Heftseiten (art fehlt), oder eine andere Art: "tabelle", "folien"; "*" = alles
A.aktiv = (art = "heft") => A.seiten.filter(s => !s.papierkorb && (art === "*" || (s.art || "heft") === art));
A.link = (s) => (s.art === "tabelle" ? "tabelle/" : s.art === "folien" ? "folien/" : "seite/") + s.id;
A.seiteLoeschen = async (id) => {
  const s = A.seite(id); if (!s) return null;
  s.papierkorb = new Date().toISOString();
  await A.seiteSpeichern(s);
  return s;
};
A.seiteWiederherstellen = async (id) => { const s = A.seite(id); if (!s) return; delete s.papierkorb; await A.seiteSpeichern(s); };
A.seiteEndgueltig = async (id) => {
  const i = A.seiten.findIndex(s => s.id === id);
  if (i < 0) return;
  const [s] = A.seiten.splice(i, 1);
  await S.weg("seiten", id);
  for (const b of [s.bild, s.original]) if (b) await S.weg("bilder", b).catch(() => {});
  Sync.melden("weg", { typ: "seite", id });
};
A.seiteZurueck = async (s, bildBlob) => { // für „Rückgängig“
  if (bildBlob && s.bild) { await S.lege("bilder", bildBlob, s.bild); Sync.melden("bild", { id: s.bild, blob: bildBlob }); }
  s.geaendert = new Date().toISOString();
  A.seiten.unshift(s); await S.lege("seiten", s); Sync.melden("seite", s);
};
A.seite = (id) => A.seiten.find(s => s.id === id);
A.bildSpeichern = async (blob, { ohneAbgleich = false } = {}) => { const id = "b" + KW.id(); await S.lege("bilder", blob, id); if (!ohneAbgleich) Sync.melden("bild", { id, blob }); return id; };
A.bildHolen = (id) => S.hole("bilder", id);
A.bildLoeschen = (id) => S.weg("bilder", id);

A.lernSpeichern = async (set) => { set.geaendert = new Date().toISOString(); const i = A.lern.findIndex(x => x.id === set.id); if (i < 0) A.lern.unshift(set); await S.lege("lern", set); Sync.melden("lern", set); };
A.lernLoeschen = async (id) => { A.lern = A.lern.filter(x => x.id !== id); await S.weg("lern", id); Sync.melden("weg", { typ: "lern", id }); };

// Text einer Seite für Suche und KI: Getipptes + erkannter Text
A.seitenText = (s) => [s.titel, s.text, s.ocr && s.ocr !== s.text ? s.ocr : ""].filter(Boolean).join("\n");
A.einstSpeichern = () => E.speichern(A.einst);
A.richStil = Heft.richStil;
A.eckenAnpassen = (s) => Scanner.eckenAnpassen(A, s);
A.scanDrehen = (s, grad) => Scanner.scanDrehen(A, s, grad);
// Scan → Word-Seite (Text mit Position, Größe, Überschriften, Listen, Bildern)
A.nachbauen = async (s) => {
  const blob = await A.bildHolen(s.bild);
  if (!blob) return;
  try {
    const r = await Nachbau.ausScan(blob, { quer: !!s.quer });
    s.ocr = r.text; s.unsicher = false;
    if (r.konfidenz >= 60) { s.html = r.html; s.ansicht = "text"; }
    else {
      // Kaum lesbar (z. B. Handschrift, schiefes Foto)? Dann die KI fragen, falls sie Bilder lesen kann.
      // Ohne sichere Erkennung KEIN Text-Salat: Foto bleibt, Hinweis auf der Seite.
      let t = "";
      if (A.einst.ki.art !== "aus") { try { t = (await KI.bildLesen(A.einst.ki, blob)).trim(); } catch (e) {} }
      if (t) { s.html = Nachbau.textZuSeite(t); s.ocr = t; s.ansicht = "text"; }
      else { s.unsicher = true; s.ansicht = "foto"; }
    }
    if (s.html) { const d = document.createElement("div"); d.innerHTML = s.html; s.text = d.textContent; }
  } catch (e) { s.html = s.html || ""; }
  await A.seiteSpeichern(s);
};

/* ---------- Hintergrund: Texterkennung und KI-Sortierung ---------- */

let schlange = Promise.resolve();
A.verarbeiten = (s, { ocr = true, zwingen = false, nurText = false } = {}) => {
  schlange = schlange.then(() => verarbeitenJetzt(s, ocr, zwingen, nurText)).catch(() => {});
  return schlange;
};
async function verarbeitenJetzt(s, ocr, zwingen, nurText) {
  const scanAn = zwingen || (A.einst.an.scanner && A.einst.f.scanner.ocr);
  if (ocr && s.bild && !s.html && !nurText && A.einst.f.scanner.nachbau !== false && scanAn) {
    await A.nachbauen(s);
  } else if (ocr && s.bild && scanAn && !s.ocr) {
    const blob = await A.bildHolen(s.bild);
    if (blob) {
      try {
        if (A.einst.ki.bildModell && A.einst.ki.art !== "aus" && A.einst.ki.art !== "aoris") {
          try { s.ocr = (await KI.abschreiben(A.einst.ki, blob)).trim(); } catch (e) { s.ocr = ""; }
        }
        if (!s.ocr) { await ocrLaden(); s.ocr = (await window.KWOCR.erkenne(blob, "deu+eng")).trim(); }
      } catch (e) { s.ocr = ""; }
      await A.seiteSpeichern(s);
    }
  }
  if (A.einst.an.kisort && !s.fach) {
    const text = A.seitenText(s);
    if (text.replace(/\s/g, "").length < 15) return;
    const r = await KI.sortieren(A.einst.ki, text, A.einst.faecher);
    const titel = A.einst.f.kisort.titel ? r.titel : "";
    if (!r.fach && !titel) return;
    if (A.einst.f.kisort.auto && !A.einst.f.kisort.fragen && r.fach) {
      s.fach = r.fach; if (titel && /^Scan |^Neue Seite|^Mitschrift /.test(s.titel)) s.titel = titel;
      KW.toast("🤖 In „" + r.fach + "“ einsortiert.");
    } else {
      s.vorschlag = { fach: r.fach, titel, wer: r.wer };
    }
    await A.seiteSpeichern(s);
    if (aktuell.modul === "start" || aktuell.modul === "heft") zeigen();
  }
}
let ocrVersprechen = null;
function ocrLaden() {
  if (window.KWOCR) return Promise.resolve();
  if (!ocrVersprechen) ocrVersprechen = new Promise((ok, nein) => {
    const sk = document.createElement("script"); sk.src = "../shared/ocr/kw-ocr.js"; sk.onload = ok; sk.onerror = nein; document.head.appendChild(sk);
  });
  return ocrVersprechen;
}
A.ocrLaden = ocrLaden;

/* ---------- Seitenleiste ---------- */

const MODULE = [
  { id: "start", icon: "🏠", name: "Start" },
  { id: "heft", icon: "📓", name: "Heft" },
  { id: "tabellen", icon: "📊", name: "Tabellen", an: "tabellen" },
  { id: "folien", icon: "🖥️", name: "Präsentationen", an: "folien" },
  { id: "scanner", icon: "📷", name: "Scanner", an: "scanner" },
  { id: "planer", icon: "📅", name: "Planer", an: "planer" },
  { id: "lernen", icon: "🧠", name: "Lern-Center", an: "lernen" },
  { id: "audio", icon: "🎙️", name: "Audio-Scribe", an: "audio" }
];

A.neuAufbauen = () => {
  const nav = document.getElementById("leiste");
  const sichtbar = MODULE.filter(m => !m.an || A.einst.an[m.an]);
  nav.innerHTML = '<ul>' + sichtbar.map(m => '<li><a href="#' + m.id + '" data-m="' + m.id + '"><span class="ico" aria-hidden="true">' + m.icon + '</span><span class="nm">' + m.name + '</span></a></li>').join("") +
    '<li class="trenner" aria-hidden="true"></li>' +
    '<li class="extra"><a href="../form/"><span class="ico" aria-hidden="true">✉️</span><span class="nm">Elternbrief <small>FIDELIA Form ↗</small></span></a></li>' +
    '<li><a href="#einst" data-m="einst"><span class="ico" aria-hidden="true">⚙️</span><span class="nm">Einstellungen</span></a></li></ul>';
  markieren();
};
function markieren() {
  const m = aktuell.modul === "seite" ? "heft" : aktuell.modul === "tabelle" ? "tabellen" : aktuell.modul;
  document.querySelectorAll("#leiste a[data-m]").forEach(a => {
    if (a.dataset.m === m) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
}

/* ---------- Navigation ---------- */

let aktuell = { modul: "start", param: "" }, aufraeumen = null;
A.gehe = (ziel) => { if (location.hash === "#" + ziel) zeigen(); else location.hash = ziel; };

function zeigen() {
  const h = decodeURIComponent(location.hash.slice(1)) || "start";
  const [modul, ...rest] = h.split("/");
  aktuell = { modul, param: rest.join("/") };
  const m = MODULE.find(x => x.id === modul);
  if (m && m.an && !A.einst.an[m.an]) { location.hash = "start"; return; }
  if (aufraeumen) { try { aufraeumen(); } catch (e) {} aufraeumen = null; }
  const el = document.getElementById("ansicht");
  el.className = "ansicht modul-" + modul;
  el.innerHTML = "";
  let r = null;
  if (modul === "heft") r = Heft.liste(A, el, aktuell.param);
  else if (modul === "seite") {
    const s = A.seite(aktuell.param);
    if (s && s.art && s.art !== "heft") { location.replace("#" + A.link(s)); return; }
    r = Heft.seite(A, el, aktuell.param);
  }
  else if (modul === "tabellen") r = Tabellen.liste(A, el);
  else if (modul === "tabelle") r = Tabellen.seite(A, el, aktuell.param);
  else if (modul === "folien" && !aktuell.param) r = Folien.liste(A, el);
  else if (modul === "folien") r = Folien.seite(A, el, aktuell.param);
  else if (modul === "scanner") r = Scanner.zeigen(A, el);
  else if (modul === "planer") r = Planer.zeigen(A, el);
  else if (modul === "lernen") r = Lernen.zeigen(A, el, aktuell.param);
  else if (modul === "audio") r = Audio.zeigen(A, el);
  else if (modul === "einst") E.seite(A, el);
  else { aktuell.modul = "start"; r = Start.zeigen(A, el); }
  if (typeof r === "function") aufraeumen = r;
  markieren();
  window.scrollTo(0, 0);
}
A.zeigen = zeigen;
// Nach Änderungen vom anderen Gerät: Übersichten neu zeichnen (aber nicht die Seite, an der man gerade schreibt)
A.nachAbgleich = () => {
  if (["start", "heft", "planer"].includes(aktuell.modul) || (aktuell.modul === "lernen" && !aktuell.param)) zeigen();
};

/* ---------- Sicherung ---------- */

function alsDataUrl(blob) { return new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); }); }

A.sicherungSpeichern = async () => {
  KW.toast("Sicherung wird gepackt …");
  const bilder = {};
  for (const k of await S.schluessel("bilder")) { const b = await S.hole("bilder", k); if (b) bilder[k] = await alsDataUrl(b); }
  KW.backup("notizen", { version: 2, einst: A.einst, seiten: A.seiten, lern: A.lern, bilder });
};
A.sicherungLaden = () => {
  KW.restore("notizen", async (d) => {
    if (!confirm("Die Sicherung ersetzt alles, was gerade in der App ist. Weiter?")) return;
    if (Array.isArray(d.notizen)) { // alte Sicherung von FIDELIA Notizen (vor dem Cockpit)
      await S.leeren("seiten"); A.seiten = [];
      await alteNotizenUebernehmen(d.notizen);
    } else {
      await S.leeren("seiten"); await S.leeren("lern"); await S.leeren("bilder");
      for (const s of d.seiten || []) await S.lege("seiten", s);
      for (const l of d.lern || []) await S.lege("lern", l);
      for (const [k, url] of Object.entries(d.bilder || {})) await S.lege("bilder", await (await fetch(url)).blob(), k);
      if (d.einst) { A.einst = Object.assign(A.einst, d.einst); E.speichern(A.einst); }
    }
    KW.toast("Sicherung geladen."); setTimeout(() => location.reload(), 600);
  });
};
A.platzText = async (el) => {
  const p = await S.platz();
  if (el && p && p.quota) el.textContent = "Belegt: " + (p.usage / 1048576).toFixed(1) + " MB von etwa " + Math.round(p.quota / 1048576) + " MB · " + A.seiten.length + " Seiten";
};

/* ---------- Alte Notizen übernehmen (FIDELIA Notizen vor dem Cockpit) ---------- */

async function alteNotizenUebernehmen(liste) {
  for (const n of liste) {
    const text = n.typ === "liste" ? (n.punkte || []).map(p => (p.ok ? "☑ " : "☐ ") + (p.t || p.text || "")).join("\n") : (n.text || "");
    await A.seiteNeu({ id: n.id || KW.id(), titel: n.titel || "Notiz", text, quelle: "zettel", raster: "leer", pin: !!n.pin,
      erstellt: n.geaendert || new Date().toISOString(), geaendert: n.geaendert || new Date().toISOString() });
  }
}

/* ---------- Start ---------- */

async function starten() {
  E.themaSetzen(A.einst.thema);
  try {
    A.seiten = await S.alle("seiten");
    A.lern = await S.alle("lern");
  } catch (e) {
    document.getElementById("ansicht").innerHTML = '<div class="empty"><b>Speicher nicht verfügbar</b>Dein Browser erlaubt dieser Seite keinen Speicher (privater Modus?). Öffne die App normal.</div>';
    return;
  }
  if (!A.einst.migriert) {
    const alt = KW.load("kw-notizen", null);
    if (alt && Array.isArray(alt.notizen)) {
      const echte = alt.notizen.filter(n => !/^Willkommen bei FIDELIA Notizen/.test(n.titel || ""));
      if (echte.length && !A.seiten.length) await alteNotizenUebernehmen(echte);
    }
    A.einst.migriert = true; E.speichern(A.einst);
  }
  for (const s of A.seiten.slice()) if (s.papierkorb && Date.now() - new Date(s.papierkorb) > 30 * 864e5) await A.seiteEndgueltig(s.id);
  A.seiten.sort((a, b) => (b.pin - a.pin) || String(b.geaendert).localeCompare(String(a.geaendert)));
  A.lern.sort((a, b) => String(b.erstellt).localeCompare(String(a.erstellt)));
  if (!A.einst.fertig) await E.assistent(A.einst);
  S.dauerhaft();
  Sync.start(A);
  // Mit dem Handy-Kamera-QR-Code geöffnet? → Geräte verbinden
  const kopplung = Sync.linkLesen(location.hash);
  if (kopplung) {
    history.replaceState(null, "", location.pathname + location.search + "#start");
    if (confirm("Dieses Gerät mit deinem anderen Gerät verbinden? Dann gleichen sich Heft, Scans, Lernkarten und Hausaufgaben ab.")) {
      KW.toast("Verbinde …");
      Sync.beitreten("koppeln=" + kopplung.g + "." + kopplung.k)
        .then(r => KW.toast(r === "schon" ? "Schon verbunden." : "✅ Verbunden! Dein Heft wird abgeglichen."))
        .catch(e => KW.toast(e.message === "regeln" ? "Der Server lässt noch nicht zu (Regeln fehlen)." : "Verbinden hat nicht geklappt. Versuch es nochmal."));
    }
  }
  A.neuAufbauen();
  window.addEventListener("hashchange", zeigen);
  zeigen();
}

document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", starten) : starten();
