// FIDELIA Notizen · Digitales Heft
// Fach-Ordner mit Seiten. Jede Seite ist ein DIN-A4-Blatt (210 × 297 mm) mit Karo, Linien oder leer.
// Man kann mit Stift malen (Druckstärke, Textmarker, Radierer) und mit der Tastatur tippen – auf derselben Seite.
// Striche werden in Millimetern gespeichert, damit sie auf jedem Bildschirm gleich aussehen.

import * as Lernen from "./lernen.js";
import * as Planer from "./planer.js";

const KW = window.KW, esc = KW.esc;
const QUELLE = { heft: "✏️", scan: "📷", audio: "🎙️", zettel: "🗒️" };
const FARBEN = [["#101826", "Schwarz"], ["#1f4fd1", "Blau"], ["#c93a3a", "Rot"], ["#1a8f4c", "Grün"], ["#7c3aed", "Lila"]];
const MARKER = [["#ffe14d", "Gelb"], ["#7cf29a", "Grün"], ["#ff9ad5", "Pink"], ["#7cd3ff", "Blau"]];
const DICKE = [[0.35, "Fein"], [0.6, "Mittel"], [1.1, "Dick"]];

function datum(iso) {
  const d = new Date(iso), heute = new Date();
  if (d.toDateString() === heute.toDateString()) return "heute, " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("de-DE", { day: "numeric", month: "short", year: d.getFullYear() === heute.getFullYear() ? undefined : "numeric" });
}

/* ---------- Striche zeichnen (auch für Vorschaubilder) ---------- */

export function zeichneStrich(ctx, st, k) {
  const p = st.p;
  if (!p.length) return;
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (st.art === "marker") { ctx.globalAlpha = 0.38; ctx.globalCompositeOperation = "multiply"; }
  ctx.strokeStyle = st.farbe; ctx.fillStyle = st.farbe;
  if (p.length === 1) {
    ctx.beginPath(); ctx.arc(p[0][0] * k, p[0][1] * k, Math.max(0.5, st.b * k * (st.art === "marker" ? 1 : (0.5 + (p[0][2] || 0.5)))) / 2, 0, 7); ctx.fill();
  } else if (st.art === "marker") {
    ctx.lineWidth = st.b * k; ctx.lineCap = "butt";
    ctx.beginPath(); ctx.moveTo(p[0][0] * k, p[0][1] * k);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0] * k, p[i][1] * k);
    ctx.stroke();
  } else {
    // Stückweise mit wechselnder Dicke (Druckstärke), geglättet über Mittelpunkte
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i], c = p[i + 1];
      ctx.lineWidth = Math.max(0.6, st.b * k * (0.5 + (b[2] == null ? 0.5 : b[2])));
      ctx.beginPath();
      const ax = i === 1 ? a[0] : (a[0] + b[0]) / 2, ay = i === 1 ? a[1] : (a[1] + b[1]) / 2;
      ctx.moveTo(ax * k, ay * k);
      if (c) ctx.quadraticCurveTo(b[0] * k, b[1] * k, (b[0] + c[0]) / 2 * k, (b[1] + c[1]) / 2 * k);
      else ctx.lineTo(b[0] * k, b[1] * k);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function vorschauStriche(canvas, seite) {
  const w = canvas.width, k = w / 210, ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, canvas.height);
  (seite.striche || []).forEach(st => zeichneStrich(ctx, st, k));
}

/* ---------- Liste: Fach-Ordner und Seiten ---------- */

export function liste(A, el, fach) {
  let suche = "", urls = [];
  const fachWahl = fach || "";
  function karte(s) {
    const f = A.fachInfo(s.fach);
    const vorschauText = (s.text || s.ocr || "").slice(0, 160);
    return '<a class="seiten-karte" href="#seite/' + s.id + '" style="--f:' + esc(f.farbe) + '">' +
      '<span class="mini raster-' + (s.bild ? "leer" : esc(s.raster || "leer")) + '">' +
      (s.bild ? '<img alt="" data-bild="' + esc(s.bild) + '">' : "") +
      ((s.striche || []).length ? '<canvas width="420" height="' + Math.round(Math.min(s.hoehe || 297, 400) * 2) + '" data-striche="' + s.id + '"></canvas>' : "") +
      (vorschauText && !s.bild ? '<span class="mini-text">' + esc(vorschauText) + '</span>' : "") + '</span>' +
      '<span class="sk-info"><b>' + (s.pin ? "📌 " : "") + esc(s.titel || "Ohne Titel") + '</b>' +
      '<small><span class="punkt" style="background:' + esc(f.farbe) + '"></span>' + esc(f.name) + ' · ' + QUELLE[s.quelle || "heft"] + ' ' + datum(s.geaendert) + '</small>' +
      (s.vorschlag && s.vorschlag.fach ? '<small class="vorschlag-mini">🤖 Vorschlag: ' + esc(s.vorschlag.fach) + '</small>' : "") + '</span></a>';
  }
  function zeichnen() {
    urls.forEach(u => URL.revokeObjectURL(u)); urls = [];
    const q = suche.toLowerCase();
    let liste = A.seiten.filter(s => fachWahl === "*alle" || !fachWahl ? true : fachWahl === "*unsortiert" ? !s.fach : s.fach === fachWahl);
    if (q) liste = liste.filter(s => A.seitenText(s).toLowerCase().includes(q));
    const anzahl = (n) => A.seiten.filter(s => s.fach === n).length;
    const unsortiert = A.seiten.filter(s => !s.fach).length;
    const mitVorschlag = A.seiten.filter(s => s.vorschlag && s.vorschlag.fach && !s.fach);
    let h = '<div class="kopfzeile"><h2 class="titel">📓 Heft</h2><span class="sp"></span>' +
      '<button type="button" class="btn primary" id="neu">+ Neue Seite</button></div>' +
      '<div class="suche"><input class="inp" type="search" id="q" placeholder="In allen Seiten suchen" aria-label="In allen Seiten suchen" value="' + esc(suche) + '"></div>' +
      '<div class="ordner" role="tablist" aria-label="Fach-Ordner">' +
      '<button type="button" role="tab" data-f="" aria-selected="' + (!fachWahl) + '">Alle <small>' + A.seiten.length + '</small></button>' +
      A.einst.faecher.map(f => '<button type="button" role="tab" data-f="' + esc(f.name) + '" aria-selected="' + (fachWahl === f.name) + '" style="--f:' + esc(f.farbe) + '"><span class="punkt" style="background:' + esc(f.farbe) + '"></span>' + esc(f.name) + ' <small>' + anzahl(f.name) + '</small></button>').join("") +
      '<button type="button" role="tab" data-f="*unsortiert" aria-selected="' + (fachWahl === "*unsortiert") + '">📥 Unsortiert <small>' + unsortiert + '</small></button></div>';
    if (mitVorschlag.length && (!fachWahl || fachWahl === "*unsortiert")) {
      h += '<div class="card vorschlaege"><b>🤖 Sortier-Vorschläge</b>' + mitVorschlag.slice(0, 5).map(s =>
        '<div class="vs-zeile"><span>„' + esc(s.titel || "Ohne Titel") + '“ → <b>' + esc(s.vorschlag.fach) + '</b>' + (s.vorschlag.titel ? ' <small class="muted">(' + esc(s.vorschlag.titel) + ')</small>' : "") + '</span>' +
        '<span><button type="button" class="btn small primary" data-ja="' + s.id + '">Ja</button> <button type="button" class="btn small" data-nein="' + s.id + '">Nein</button></span></div>').join("") +
        (mitVorschlag.length > 1 ? '<button type="button" class="btn small" id="alleJa">Alle übernehmen</button>' : "") + '</div>';
    }
    h += liste.length ? '<div class="seiten-gitter">' + liste.map(karte).join("") + '</div>' :
      '<div class="empty"><b>' + (q ? "Nichts gefunden" : "Noch keine Seiten") + '</b>' + (q ? "Probier ein anderes Wort." : "Tipp auf „+ Neue Seite“ oder scanne ein Arbeitsblatt.") + '</div>';
    el.innerHTML = h;
    el.querySelectorAll("[data-striche]").forEach(c => vorschauStriche(c, A.seite(c.dataset.striche)));
    el.querySelectorAll("img[data-bild]").forEach(async img => {
      const b = await A.bildHolen(img.dataset.bild);
      if (b) { const u = URL.createObjectURL(b); urls.push(u); img.src = u; }
    });
    el.querySelector("#neu").onclick = async () => {
      const f = fachWahl && fachWahl[0] !== "*" ? fachWahl : "";
      const s = await A.seiteNeu({ fach: f, titel: "Neue Seite " + new Date().toLocaleDateString("de-DE") });
      A.gehe("seite/" + s.id);
    };
    const qi = el.querySelector("#q");
    qi.oninput = () => { suche = qi.value; const pos = qi.selectionStart; zeichnen(); const n = el.querySelector("#q"); n.focus(); n.setSelectionRange(pos, pos); };
    el.querySelectorAll("[data-f]").forEach(b => b.onclick = () => A.gehe("heft" + (b.dataset.f ? "/" + b.dataset.f : "")));
    const uebernehmen = async (s) => { s.fach = s.vorschlag.fach; if (s.vorschlag.titel && /^Scan |^Neue Seite|^Mitschrift /.test(s.titel)) s.titel = s.vorschlag.titel; s.vorschlag = null; await A.seiteSpeichern(s); };
    el.querySelectorAll("[data-ja]").forEach(b => b.onclick = async () => { await uebernehmen(A.seite(b.dataset.ja)); zeichnen(); });
    el.querySelectorAll("[data-nein]").forEach(b => b.onclick = async () => { const s = A.seite(b.dataset.nein); s.vorschlag = null; await A.seiteSpeichern(s); zeichnen(); });
    const alle = el.querySelector("#alleJa");
    if (alle) alle.onclick = async () => { for (const s of mitVorschlag) await uebernehmen(s); KW.toast("Alles einsortiert."); zeichnen(); };
  }
  zeichnen();
  return () => urls.forEach(u => URL.revokeObjectURL(u));
}

/* ---------- Eine Seite bearbeiten ---------- */

export function seite(A, el, id) {
  const s = A.seite(id);
  if (!s) { el.innerHTML = '<div class="empty"><b>Seite nicht gefunden</b><a href="#heft">Zurück zum Heft</a></div>'; return; }
  const H = A.einst.f.heft;
  const zustand = KW.load("kw-notizen-stift", { modus: "stift", werkzeug: "stift", farbe: FARBEN[0][0], marker: MARKER[0][0], dicke: 0.6 });
  if (!H.marker && zustand.werkzeug === "marker") zustand.werkzeug = "stift";
  let bildUrl = null, speicherTimer = null, rueck = [], vor = [], stiftGesehen = false;
  const endlos = H.format === "endlos" && !s.bild;

  el.innerHTML =
    '<div class="seite-leiste" role="toolbar" aria-label="Werkzeuge">' +
      '<a class="btn small" href="#heft' + (s.fach ? "/" + encodeURIComponent(s.fach) : "") + '" aria-label="Zurück zum Heft">←</a>' +
      '<div class="modus" role="radiogroup" aria-label="Eingabe">' +
        '<button type="button" role="radio" data-modus="stift" aria-label="Mit Stift schreiben">✏️</button>' +
        '<button type="button" role="radio" data-modus="tippen" aria-label="Mit Tastatur tippen">⌨️</button></div>' +
      '<div class="werkzeuge" id="werkzeuge">' +
        '<button type="button" data-w="stift" aria-label="Stift">🖊️</button>' +
        (H.marker ? '<button type="button" data-w="marker" aria-label="Textmarker">🖍️</button>' : "") +
        '<button type="button" data-w="radierer" aria-label="Radiergummi">🧽</button>' +
        '<span class="farben" id="farben"></span>' +
        '<select id="dicke" aria-label="Strichstärke">' + DICKE.map(d => '<option value="' + d[0] + '">' + d[1] + '</option>').join("") + '</select>' +
        '<button type="button" id="rueck" aria-label="Rückgängig">↶</button><button type="button" id="vor" aria-label="Wiederholen">↷</button>' +
      '</div>' +
      '<span class="sp"></span>' +
      '<button type="button" class="btn small" id="menueBtn" aria-haspopup="true" aria-expanded="false">⋯ Mehr</button>' +
    '</div>' +
    '<div class="seite-kopf">' +
      '<input class="inp titel-inp" id="titel" maxlength="100" aria-label="Titel der Seite" value="' + esc(s.titel) + '" placeholder="Titel">' +
      '<select class="inp" id="fach" aria-label="Fach"><option value="">📥 Unsortiert</option>' + A.einst.faecher.map(f => '<option' + (f.name === s.fach ? " selected" : "") + '>' + esc(f.name) + '</option>').join("") +
        (s.fach && !A.einst.faecher.some(f => f.name === s.fach) ? '<option selected>' + esc(s.fach) + '</option>' : "") + '</select>' +
      (s.bild ? "" : '<select class="inp" id="raster" aria-label="Raster"><option value="karo">Karo</option><option value="linien">Linien</option><option value="leer">Leer</option></select>') +
    '</div>' +
    '<div id="vorschlag"></div>' +
    '<div class="menue card" id="menue" hidden>' +
      (A.einst.an.lernen ? '<button type="button" data-a="lernen">🧠 Lernkarten & Quiz daraus machen</button>' : "") +
      (A.einst.an.planer && A.einst.f.planer.hausaufgaben ? '<button type="button" data-a="ha">📅 Hausaufgabe eintragen</button>' : "") +
      (s.bild ? '<button type="button" data-a="ocr">🔍 Text erkennen</button>' : "") +
      '<button type="button" data-a="pin">' + (s.pin ? "📌 Nicht mehr anpinnen" : "📌 Anpinnen") + '</button>' +
      '<button type="button" data-a="bild">🖼️ Als Bild speichern</button>' +
      '<button type="button" data-a="weg" class="rot">🗑️ Seite löschen</button>' +
    '</div>' +
    '<div class="blatt-rahmen"><div class="blatt raster-' + (s.bild ? "leer" : esc(s.raster)) + '" id="blatt">' +
      (s.bild ? '<img id="scanBild" alt="Eingescanntes Blatt">' : "") +
      '<textarea id="text" spellcheck="true" aria-label="Text auf der Seite" placeholder="' + (s.bild ? "" : "Tippe hier …") + '">' + esc(s.text) + '</textarea>' +
      '<canvas id="tinte" aria-label="Zeichenfläche"></canvas>' +
    '</div></div>' +
    (endlos ? '<div class="mittig"><button type="button" class="btn small" id="mehrPlatz">+ Mehr Platz</button></div>' : "") +
    (s.bild || s.ocr ? '<details class="card erkannt"' + (s.ocr ? "" : "") + '><summary>🔍 Erkannter Text' + (s.ocr ? "" : " (noch keiner)") + '</summary><textarea class="inp" id="ocr" rows="6" aria-label="Erkannter Text">' + esc(s.ocr) + '</textarea></details>' : "") +
    '<p class="muted klein mittig">Wird automatisch gespeichert · ' + QUELLE[s.quelle || "heft"] + ' angelegt ' + datum(s.erstellt) + '</p>';

  const blatt = el.querySelector("#blatt"), canvas = el.querySelector("#tinte"), ctx = canvas.getContext("2d"), ta = el.querySelector("#text");
  const rasterSel = el.querySelector("#raster");
  if (rasterSel) rasterSel.value = s.raster;

  /* --- Vorschlag der KI --- */
  function vorschlagZeigen() {
    const v = el.querySelector("#vorschlag");
    if (!s.vorschlag || (!s.vorschlag.fach && !s.vorschlag.titel)) { v.innerHTML = ""; return; }
    v.innerHTML = '<div class="card vorschlaege"><span>🤖 ' + (s.vorschlag.fach ? 'Ist das <b>' + esc(s.vorschlag.fach) + '</b>?' : "") +
      (s.vorschlag.titel ? ' Titel: „' + esc(s.vorschlag.titel) + '“' : "") + '</span><span><button type="button" class="btn small primary" id="vJa">Ja, übernehmen</button> <button type="button" class="btn small" id="vNein">Nein</button></span></div>';
    v.querySelector("#vJa").onclick = async () => {
      if (s.vorschlag.fach) { s.fach = s.vorschlag.fach; el.querySelector("#fach").value = s.fach; }
      if (s.vorschlag.titel) { s.titel = s.vorschlag.titel; el.querySelector("#titel").value = s.titel; }
      s.vorschlag = null; await A.seiteSpeichern(s); vorschlagZeigen();
    };
    v.querySelector("#vNein").onclick = async () => { s.vorschlag = null; await A.seiteSpeichern(s); vorschlagZeigen(); };
  }
  vorschlagZeigen();

  /* --- Größe und Raster --- */
  let k = 1; // Pixel pro Millimeter
  function groesse() {
    const breite = blatt.clientWidth;
    k = breite / 210;
    blatt.style.setProperty("--u", k + "px");
    blatt.style.height = (s.hoehe || 297) * k + "px";
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(breite * dpr); canvas.height = Math.round((s.hoehe || 297) * k * dpr);
    canvas.style.width = breite + "px"; canvas.style.height = (s.hoehe || 297) * k + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    allesZeichnen();
  }
  function allesZeichnen() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    (s.striche || []).forEach(st => zeichneStrich(ctx, st, k));
  }
  const ro = new ResizeObserver(groesse);
  ro.observe(blatt);

  if (s.bild) A.bildHolen(s.bild).then(b => { if (b) { bildUrl = URL.createObjectURL(b); el.querySelector("#scanBild").src = bildUrl; } });

  /* --- Speichern --- */
  function spaeter() { clearTimeout(speicherTimer); speicherTimer = setTimeout(() => { speicherTimer = null; A.seiteSpeichern(s); }, 500); }
  ta.oninput = () => { s.text = ta.value; spaeter(); };
  el.querySelector("#titel").oninput = (e) => { s.titel = e.target.value; spaeter(); };
  el.querySelector("#fach").onchange = (e) => { s.fach = e.target.value; s.vorschlag = null; vorschlagZeigen(); spaeter(); };
  if (rasterSel) rasterSel.onchange = () => { s.raster = rasterSel.value; blatt.className = "blatt raster-" + s.raster; spaeter(); };
  const ocrTa = el.querySelector("#ocr");
  if (ocrTa) ocrTa.oninput = () => { s.ocr = ocrTa.value; spaeter(); };
  const mehr = el.querySelector("#mehrPlatz");
  if (mehr) mehr.onclick = () => { s.hoehe = (s.hoehe || 297) + 297; groesse(); spaeter(); };

  /* --- Werkzeugleiste --- */
  function leiste() {
    el.querySelectorAll("[data-modus]").forEach(b => { const an = b.dataset.modus === zustand.modus; b.setAttribute("aria-checked", an); b.classList.toggle("an", an); });
    el.querySelector("#werkzeuge").hidden = zustand.modus !== "stift";
    el.querySelectorAll("[data-w]").forEach(b => { const an = b.dataset.w === zustand.werkzeug; b.setAttribute("aria-pressed", an); b.classList.toggle("an", an); });
    const fl = zustand.werkzeug === "marker" ? MARKER : FARBEN, akt = zustand.werkzeug === "marker" ? zustand.marker : zustand.farbe;
    el.querySelector("#farben").innerHTML = zustand.werkzeug === "radierer" ? '<small class="muted">' + (H.radierer === "stueck" ? "Radiert, wo du wischst" : "Löscht ganze Striche") + '</small>' :
      fl.map(f => '<button type="button" class="farbe' + (f[0] === akt ? " an" : "") + '" data-farbe="' + f[0] + '" style="background:' + f[0] + '" aria-label="' + f[1] + '" aria-pressed="' + (f[0] === akt) + '"></button>').join("");
    el.querySelectorAll("[data-farbe]").forEach(b => b.onclick = () => { if (zustand.werkzeug === "marker") zustand.marker = b.dataset.farbe; else zustand.farbe = b.dataset.farbe; merken(); leiste(); });
    el.querySelector("#dicke").value = String(zustand.dicke);
    el.querySelector("#dicke").hidden = zustand.werkzeug !== "stift";
    blatt.classList.toggle("tippen", zustand.modus === "tippen");
    blatt.classList.toggle("stift-modus", zustand.modus === "stift");
    blatt.dataset.werkzeug = zustand.werkzeug;
    canvas.style.touchAction = zustand.modus === "stift" && !stiftGesehen ? "none" : "pan-y";
    el.querySelector("#rueck").disabled = !rueck.length;
    el.querySelector("#vor").disabled = !vor.length;
  }
  function merken() { KW.save("kw-notizen-stift", zustand); }
  el.querySelectorAll("[data-modus]").forEach(b => b.onclick = () => { zustand.modus = b.dataset.modus; merken(); leiste(); if (zustand.modus === "tippen") ta.focus(); });
  el.querySelectorAll("[data-w]").forEach(b => b.onclick = () => { zustand.werkzeug = b.dataset.w; merken(); leiste(); });
  el.querySelector("#dicke").onchange = (e) => { zustand.dicke = Number(e.target.value); merken(); };
  function sichern() { rueck.push(JSON.stringify(s.striche)); if (rueck.length > 40) rueck.shift(); vor = []; }
  el.querySelector("#rueck").onclick = () => { if (!rueck.length) return; vor.push(JSON.stringify(s.striche)); s.striche = JSON.parse(rueck.pop()); allesZeichnen(); spaeter(); leiste(); };
  el.querySelector("#vor").onclick = () => { if (!vor.length) return; rueck.push(JSON.stringify(s.striche)); s.striche = JSON.parse(vor.pop()); allesZeichnen(); spaeter(); leiste(); };

  /* --- Zeichnen mit Stift, Maus oder Finger --- */
  let strich = null, radiertGerade = false;
  function punkt(e) {
    const r = canvas.getBoundingClientRect();
    const druck = e.pointerType === "pen" ? (e.pressure || 0.5) : 0.5;
    return [Math.round((e.clientX - r.left) / k * 10) / 10, Math.round((e.clientY - r.top) / k * 10) / 10, Math.round(druck * 100) / 100];
  }
  function radieren(p) {
    const r = 3; // Millimeter
    const nah = (q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < r + 0.5;
    if (H.radierer === "stueck") {
      const neu = [];
      let geaendert = false;
      for (const st of s.striche) {
        if (!st.p.some(nah)) { neu.push(st); continue; }
        geaendert = true;
        let teil = [];
        for (const q of st.p) { if (nah(q)) { if (teil.length > 1) neu.push(Object.assign({}, st, { p: teil })); teil = []; } else teil.push(q); }
        if (teil.length > 1) neu.push(Object.assign({}, st, { p: teil }));
      }
      if (geaendert) { s.striche = neu; return true; }
      return false;
    }
    const vorher = s.striche.length;
    s.striche = s.striche.filter(st => !st.p.some(nah));
    return s.striche.length !== vorher;
  }
  canvas.addEventListener("pointerdown", (e) => {
    if (zustand.modus !== "stift") return;
    if (e.pointerType === "pen" && !stiftGesehen) { stiftGesehen = true; leiste(); }
    if (e.pointerType === "touch" && stiftGesehen) return; // Hand liegt auf dem Bildschirm, Finger scrollt
    if (e.button > 0) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    sichern();
    const p = punkt(e);
    if (zustand.werkzeug === "radierer") { radiertGerade = radieren(p); if (radiertGerade) allesZeichnen(); strich = { radierer: true }; return; }
    strich = zustand.werkzeug === "marker" ? { art: "marker", farbe: zustand.marker, b: 5, p: [p] } : { art: "stift", farbe: zustand.farbe, b: zustand.dicke, p: [p] };
    zeichneStrich(ctx, strich, k);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!strich) return;
    const ereignisse = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of ereignisse) {
      const p = punkt(ev);
      if (strich.radierer) { if (radieren(p)) { radiertGerade = true; allesZeichnen(); } continue; }
      const l = strich.p[strich.p.length - 1];
      if (Math.hypot(p[0] - l[0], p[1] - l[1]) < 0.25) continue;
      strich.p.push(p);
      // nur das neue Stück zeichnen (schnell)
      zeichneStrich(ctx, { art: strich.art, farbe: strich.farbe, b: strich.b, p: strich.p.slice(-3) }, k);
    }
  });
  function ende() {
    if (!strich) return;
    if (strich.radierer) { if (!radiertGerade) rueck.pop(); radiertGerade = false; }
    else { s.striche.push(strich); }
    strich = null;
    allesZeichnen(); spaeter(); leiste();
    // Endlos-Seite wächst, wenn man unten ankommt
    if (endlos && s.striche.length) {
      const unten = Math.max(...s.striche[s.striche.length - 1].p.map(q => q[1]));
      if (unten > (s.hoehe || 297) - 40) { s.hoehe = (s.hoehe || 297) + 148; groesse(); }
    }
  }
  canvas.addEventListener("pointerup", ende);
  canvas.addEventListener("pointercancel", ende);

  // Tastenkürzel: Strg+Z / Strg+Y (nur wenn man nicht gerade tippt)
  function tasten(e) {
    if (document.activeElement && /TEXTAREA|INPUT|SELECT/.test(document.activeElement.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); el.querySelector(e.shiftKey ? "#vor" : "#rueck").click(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); el.querySelector("#vor").click(); }
  }
  document.addEventListener("keydown", tasten);

  /* --- Menü --- */
  const menue = el.querySelector("#menue"), menueBtn = el.querySelector("#menueBtn");
  menueBtn.onclick = () => { menue.hidden = !menue.hidden; menueBtn.setAttribute("aria-expanded", !menue.hidden); };
  menue.onclick = async (e) => {
    const b = e.target.closest("[data-a]");
    if (!b) return;
    menue.hidden = true; menueBtn.setAttribute("aria-expanded", "false");
    const a = b.dataset.a;
    if (a === "lernen") { if (speicherTimer) { clearTimeout(speicherTimer); speicherTimer = null; await A.seiteSpeichern(s); } Lernen.ausSeite(A, s); }
    if (a === "ha") Planer.eintragen(A, { fach: s.fach });
    if (a === "ocr") {
      KW.toast("Text wird erkannt … (kann kurz dauern)");
      s.ocr = ""; await A.verarbeiten(s, { zwingen: true });
      KW.toast(s.ocr ? "Text erkannt." : "Kein Text gefunden.");
      A.zeigen();
    }
    if (a === "pin") { s.pin = !s.pin; await A.seiteSpeichern(s); b.textContent = s.pin ? "📌 Nicht mehr anpinnen" : "📌 Anpinnen"; KW.toast(s.pin ? "Angepinnt – steht jetzt oben." : "Nicht mehr angepinnt."); }
    if (a === "bild") alsBild();
    if (a === "weg") {
      const blob = s.bild ? await A.bildHolen(s.bild) : null;
      await A.seiteLoeschen(s.id);
      if (s.bild) await A.bildLoeschen(s.bild);
      A.gehe("heft" + (s.fach ? "/" + s.fach : ""));
      KW.toast("Seite gelöscht.", "Rückgängig", async () => { await A.seiteZurueck(s, blob); A.gehe("seite/" + s.id); });
    }
  };

  // Ganze Seite als PNG (Papier + Raster + Text + Striche)
  async function alsBild() {
    const W = 1240, f = W / 210, Hh = Math.round((s.hoehe || 297) * f), c = document.createElement("canvas");
    c.width = W; c.height = Hh;
    const x = c.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, W, Hh);
    if (s.bild && bildUrl) { const img = el.querySelector("#scanBild"); x.drawImage(img, 0, 0, W, Hh); }
    else if (s.raster !== "leer") {
      x.strokeStyle = "#c9d6ea"; x.lineWidth = 1;
      const abst = s.raster === "karo" ? 5 : 8, start = s.raster === "karo" ? 0 : 4;
      for (let y = start; y < (s.hoehe || 297); y += abst) { x.beginPath(); x.moveTo(0, y * f); x.lineTo(W, y * f); x.stroke(); }
      if (s.raster === "karo") for (let xx = 0; xx < 210; xx += 5) { x.beginPath(); x.moveTo(xx * f, 0); x.lineTo(xx * f, Hh); x.stroke(); }
    }
    const st = getComputedStyle(ta), lh = parseFloat(st.lineHeight) / k * f;
    x.fillStyle = "#101826"; x.font = (parseFloat(st.fontSize) / k * f) + "px 'Space Grotesk', Arial, sans-serif";
    const links = parseFloat(st.paddingLeft) / k * f, oben = parseFloat(st.paddingTop) / k * f, breit = W - links - parseFloat(st.paddingRight) / k * f;
    let y = oben + lh * 0.75;
    for (const absatz of (s.text || "").split("\n")) {
      let zeile = "";
      for (const wort of absatz.split(" ")) {
        const t = zeile ? zeile + " " + wort : wort;
        if (x.measureText(t).width > breit && zeile) { x.fillText(zeile, links, y); y += lh; zeile = wort; } else zeile = t;
      }
      x.fillText(zeile, links, y); y += lh;
    }
    (s.striche || []).forEach(strich => zeichneStrich(x, strich, f));
    c.toBlob(b => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b); a.download = (s.titel || "seite").replace(/[^\wäöüÄÖÜß -]/g, "") + ".png";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, "image/png");
  }

  leiste();
  groesse();
  if (zustand.modus === "tippen" && !s.text && !s.bild) ta.focus();

  return () => {
    ro.disconnect();
    document.removeEventListener("keydown", tasten);
    if (speicherTimer) { clearTimeout(speicherTimer); A.seiteSpeichern(s); }
    if (bildUrl) URL.revokeObjectURL(bildUrl);
  };
}
