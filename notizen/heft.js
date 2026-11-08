// FIDELIA Notizen · Digitales Heft
// Fach-Ordner mit Seiten. Jede Seite: Papier (30+ Arten, hoch oder quer), Text wie in Word und eine Stift-Ebene.
// Stift: Kuli, Füller, Bleistift, Textmarker, Radierer, Lasso, Formen-Erkennung, Lineal und Geodreieck, Gesten.
// Striche werden in Millimetern gespeichert, damit sie auf jedem Bildschirm gleich aussehen.

import * as Lernen from "./lernen.js";
import * as Planer from "./planer.js";
import * as Papier from "./papier.js";
import * as Editor from "./editor.js";
import * as F from "./formen.js";
import * as Export from "./export.js";
import * as KI from "./ki.js";

const KW = window.KW, esc = KW.esc;
const QUELLE = { heft: "✏️", scan: "📷", audio: "🎙️", zettel: "🗒️" };
const FARBEN = ["#101826", "#1f4fd1", "#c93a3a", "#1a8f4c", "#7c3aed", "#e8730c"];
const MARKER = ["#ffe14d", "#7cf29a", "#ff9ad5", "#7cd3ff", "#ffb35c"];
const DICKE = [[0.3, "Fein"], [0.5, "Mittel"], [0.9, "Dick"], [1.6, "Extra"]];
const STIFTE = [["kuli", "🖊️", "Kugelschreiber"], ["fueller", "✒️", "Füller"], ["bleistift", "✏️", "Bleistift"], ["marker", "🖍️", "Textmarker"], ["radierer", "🧽", "Radiergummi"], ["lasso", "➰", "Lasso"]];

function datum(iso) {
  const d = new Date(iso), heute = new Date();
  if (d.toDateString() === heute.toDateString()) return "heute, " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("de-DE", { day: "numeric", month: "short", year: d.getFullYear() === heute.getFullYear() ? undefined : "numeric" });
}
const breiteMm = (s) => s.quer ? 297 : 210;
const kachelMm = (s) => s.quer ? 210 : (s.bild && !s.quer && s.hoehe && s.hoehe < 297 ? s.hoehe : 297);

/* ---------- Striche zeichnen (auch für Vorschau, Druck und Word) ---------- */

export function zeichneStrich(ctx, st, k) {
  const p = st.p;
  if (!p || !p.length) return;
  const art = st.art === "stift" ? "kuli" : st.art;
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = st.farbe; ctx.fillStyle = st.farbe;
  if (art === "marker") { ctx.globalAlpha = 0.38; ctx.globalCompositeOperation = "multiply"; }
  if (art === "bleistift") ctx.globalAlpha = 0.72;
  const breite = (a, b) => {
    const druck = b[2] == null ? 0.5 : b[2];
    if (art === "fueller") { const w = Math.atan2(b[1] - a[1], b[0] - a[0]); return st.b * k * (0.35 + 1.15 * Math.abs(Math.sin(w - Math.PI / 4))) * (0.6 + 0.8 * druck); }
    if (art === "bleistift") return st.b * k * 0.75 * (0.6 + 0.8 * druck);
    return st.b * k * (0.6 + 0.8 * druck);
  };
  if (p.length === 1) {
    ctx.beginPath(); ctx.arc(p[0][0] * k, p[0][1] * k, Math.max(0.5, art === "marker" ? st.b * k / 2 : breite(p[0], p[0]) / 2), 0, 7); ctx.fill();
  } else if (art === "marker") {
    ctx.lineWidth = st.b * k; ctx.lineCap = "butt";
    ctx.beginPath(); ctx.moveTo(p[0][0] * k, p[0][1] * k);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0] * k, p[i][1] * k);
    ctx.stroke();
  } else {
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i], c = p[i + 1];
      ctx.lineWidth = Math.max(0.6, breite(a, b));
      ctx.beginPath();
      const ax = i === 1 ? a[0] : (a[0] + b[0]) / 2, ay = i === 1 ? a[1] : (a[1] + b[1]) / 2;
      ctx.moveTo(ax * k, ay * k);
      if (c) ctx.quadraticCurveTo(b[0] * k, b[1] * k, (b[0] + c[0]) / 2 * k, (b[1] + c[1]) / 2 * k);
      else ctx.lineTo(b[0] * k, b[1] * k);
      ctx.stroke();
    }
    if (art === "bleistift" && p.length > 2) { // leicht körnig
      ctx.globalAlpha = 0.25; ctx.lineWidth = Math.max(0.4, st.b * k * 0.4);
      ctx.beginPath(); ctx.moveTo(p[0][0] * k + 0.4, p[0][1] * k + 0.3);
      for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0] * k + 0.4, p[i][1] * k + 0.3);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function vorschauStriche(canvas, seite) {
  const k = canvas.width / breiteMm(seite), ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  (seite.striche || []).forEach(st => zeichneStrich(ctx, st, k));
}

// Abstände und Zeilenhöhe des Textes passend zum Papier (in Seiten-Einheiten --u = 1 mm)
export function richStil(el, s) {
  const p = Papier.info(s.raster);
  const zeile = p.zeile, oben = zeile ? Math.max(4, p.oben - zeile * 0.92) : 15;
  el.style.setProperty("--zeile", zeile ? String(zeile) : "6.2");
  el.style.setProperty("--schrift", String(p.schrift || (zeile ? Math.max(3.4, Math.min(5.4, zeile * 0.58)) : 3.9)));
  el.style.padding = "calc(var(--u) * " + oben + ") calc(var(--u) * " + (p.rechts || 15) + ") calc(var(--u) * 12) calc(var(--u) * " + (p.links || 15) + ")";
  el.classList.toggle("ohne-linien", !zeile);
}

/* ---------- Neue Seite: Papier oder Vorlage wählen ---------- */

export function neueSeite(A, fach, { aendern = null } = {}) {
  return new Promise(fertig => {
    const std = (fach && A.einst.fachPapier && A.einst.fachPapier[fach]) || { raster: Papier.info(A.einst.f.heft.raster).id, quer: false };
    let wahl = aendern ? { raster: Papier.info(aendern.raster).id, quer: !!aendern.quer } : Object.assign({}, std), reiter = "papier";
    const d = document.createElement("dialog");
    d.className = "sheet breit";
    function zeichnen() {
      let h = '<div class="sheet-in"><h2>' + (aendern ? "Papier ändern" : "Neue Seite" + (fach ? " in " + esc(fach) : "")) + '</h2>';
      if (!aendern) h += '<div class="tabs" role="tablist"><button type="button" role="tab" data-r="papier" aria-selected="' + (reiter === "papier") + '">📄 Papier</button><button type="button" role="tab" data-r="vorlage" aria-selected="' + (reiter === "vorlage") + '">📋 Vorlagen</button></div>';
      if (reiter === "papier") {
        h += '<div class="row papier-optionen"><label class="pruef-zeile"><input type="checkbox" id="quer"' + (wahl.quer ? " checked" : "") + '> Querformat</label>' +
          (fach && !aendern ? '<label class="pruef-zeile"><input type="checkbox" id="merken"> Als Standard für ' + esc(fach) + ' merken</label>' : "") + '</div>';
        for (const g of Papier.gruppen()) {
          h += '<h3 class="sec">' + esc(g) + '</h3><div class="papier-gitter">' + Papier.PAPIER.filter(p => p.gruppe === g).map(p =>
            '<button type="button" class="papier-wahl' + (wahl.quer ? " quer" : "") + '" data-p="' + p.id + '" aria-pressed="' + (wahl.raster === p.id) + '"><span class="papier-bild" style="background-image:' + Papier.vorschau(p.id, wahl.quer).replace(/"/g, "&quot;") + '"></span><small>' + esc(p.name) + (std.raster === p.id && !aendern && fach ? " ★" : "") + '</small></button>').join("") + '</div>';
        }
        h += '<div class="sheet-foot klebt"><button type="button" class="btn" id="ab">Abbrechen</button><span class="sp"></span><button type="button" class="btn primary" id="ok">' + (aendern ? "Übernehmen" : "Seite anlegen") + '</button></div>';
      } else {
        h += '<div class="vorlagen-gitter">' + Editor.VORLAGEN.map(v => '<button type="button" class="vorlage card" data-v="' + v.id + '"><span>' + v.icon + '</span><b>' + esc(v.name) + '</b></button>').join("") + '</div>' +
          '<div class="sheet-foot"><button type="button" class="btn" id="ab">Abbrechen</button></div>';
      }
      d.innerHTML = h + '</div>';
      d.querySelectorAll("[data-r]").forEach(b => b.onclick = () => { reiter = b.dataset.r; zeichnen(); });
      d.querySelectorAll("[data-p]").forEach(b => { b.onclick = () => { wahl.raster = b.dataset.p; zeichnen(); }; b.ondblclick = () => d.querySelector("#ok").click(); });
      const q = d.querySelector("#quer"); if (q) q.onchange = () => { wahl.quer = q.checked; zeichnen(); };
      d.querySelector("#ab").onclick = () => d.close();
      const ok = d.querySelector("#ok");
      if (ok) ok.onclick = async () => {
        if (aendern) { ergebnis = wahl; d.close(); return; }
        const m = d.querySelector("#merken");
        if (m && m.checked) { A.einst.fachPapier = A.einst.fachPapier || {}; A.einst.fachPapier[fach] = Object.assign({}, wahl); A.einstSpeichern(); KW.toast("Gemerkt: neue " + fach + "-Seiten haben dieses Papier."); }
        const s = await A.seiteNeu({ fach, raster: wahl.raster, quer: wahl.quer, hoehe: wahl.quer ? 210 : 297, titel: "Neue Seite " + new Date().toLocaleDateString("de-DE") });
        ergebnis = s; d.close();
      };
      d.querySelectorAll("[data-v]").forEach(b => b.onclick = async () => {
        const v = Editor.VORLAGEN.find(x => x.id === b.dataset.v);
        const s = await A.seiteNeu({ fach, raster: v.raster, html: v.html, text: Editor.htmlZuText(v.html), titel: v.name, vorlage: v.id });
        KW.save("kw-notizen-stift-modus", "tippen");
        ergebnis = s; d.close();
      });
      const gewaehlt = d.querySelector('[aria-pressed="true"]'); if (gewaehlt && !d._gescrollt) { d._gescrollt = true; setTimeout(() => gewaehlt.scrollIntoView({ block: "center" }), 30); }
    }
    let ergebnis = null;
    d.addEventListener("close", () => { d.remove(); fertig(ergebnis); });
    document.body.appendChild(d);
    zeichnen(); d.showModal();
  });
}

/* ---------- Liste: Fach-Ordner, Seiten, Papierkorb ---------- */

export function liste(A, el, fach) {
  let suche = "", urls = [];
  const fachWahl = fach || "";
  function karte(s) {
    const f = A.fachInfo(s.fach);
    const vorschauText = (s.text || s.ocr || "").slice(0, 160);
    const B = breiteMm(s);
    return '<a class="seiten-karte" href="#seite/' + s.id + '" style="--f:' + esc(f.farbe) + '">' +
      '<span class="mini" style="background-image:' + (s.bild ? "none" : Papier.vorschau(s.raster, s.quer).replace(/"/g, "&quot;")) + ';background-size:100% ' + (kachelMm(s) / B * 100).toFixed(1) + '%">' +
      (s.bild && !(s.html && s.ansicht !== "foto") ? '<img alt="" data-bild="' + esc(s.bild) + '">' : "") +
      ((s.striche || []).length ? '<canvas width="420" height="' + Math.round(Math.min(s.hoehe || 297, 420) * 420 / B) + '" data-striche="' + s.id + '"></canvas>' : "") +
      (vorschauText && !(s.bild && !(s.html && s.ansicht !== "foto")) ? '<span class="mini-text">' + esc(vorschauText) + '</span>' : "") + '</span>' +
      '<span class="sk-info"><b>' + (s.pin ? "📌 " : "") + esc(s.titel || "Ohne Titel") + '</b>' +
      '<small><span class="punkt" style="background:' + esc(f.farbe) + '"></span>' + esc(f.name) + ' · ' + QUELLE[s.quelle || "heft"] + ' ' + datum(s.geaendert) + '</small>' +
      (s.vorschlag && s.vorschlag.fach ? '<small class="vorschlag-mini">🤖 Vorschlag: ' + esc(s.vorschlag.fach) + '</small>' : "") + '</span></a>';
  }
  function papierkorb() {
    const korb = A.seiten.filter(s => s.papierkorb).sort((a, b) => String(b.papierkorb).localeCompare(String(a.papierkorb)));
    el.innerHTML = '<div class="kopfzeile"><a class="btn small" href="#heft">←</a><h2 class="titel">🗑️ Papierkorb</h2><span class="sp"></span>' +
      (korb.length ? '<button type="button" class="btn danger small" id="leeren">Alles endgültig löschen</button>' : "") + '</div>' +
      '<p class="muted">Gelöschte Seiten bleiben 30 Tage hier, dann sind sie weg.</p>' +
      (korb.length ? '<ul class="korb">' + korb.map(s => {
        const rest = Math.max(0, 30 - Math.floor((Date.now() - new Date(s.papierkorb)) / 864e5));
        return '<li class="card"><span><b>' + esc(s.titel || "Ohne Titel") + '</b><small>' + esc(s.fach || "Unsortiert") + ' · noch ' + rest + ' Tage</small></span>' +
          '<button type="button" class="btn small primary" data-zurueck="' + s.id + '">Wiederherstellen</button><button type="button" class="btn small danger" data-weg="' + s.id + '">Löschen</button></li>';
      }).join("") + '</ul>' : '<div class="empty"><b>Der Papierkorb ist leer</b></div>');
    el.querySelectorAll("[data-zurueck]").forEach(b => b.onclick = async () => { await A.seiteWiederherstellen(b.dataset.zurueck); KW.toast("Wiederhergestellt."); papierkorb(); });
    el.querySelectorAll("[data-weg]").forEach(b => b.onclick = async () => { if (confirm("Endgültig löschen? Das geht nicht rückgängig.")) { await A.seiteEndgueltig(b.dataset.weg); papierkorb(); } });
    const l = el.querySelector("#leeren");
    if (l) l.onclick = async () => { if (!confirm("Alle Seiten im Papierkorb endgültig löschen?")) return; for (const s of korb) await A.seiteEndgueltig(s.id); papierkorb(); };
  }
  if (fachWahl === "*papierkorb") { papierkorb(); return; }
  function zeichnen() {
    urls.forEach(u => URL.revokeObjectURL(u)); urls = [];
    const q = suche.toLowerCase(), aktiv = A.aktiv();
    let liste = aktiv.filter(s => !fachWahl ? true : fachWahl === "*unsortiert" ? !s.fach : s.fach === fachWahl);
    if (q) liste = liste.filter(s => A.seitenText(s).toLowerCase().includes(q));
    const anzahl = (n) => aktiv.filter(s => s.fach === n).length;
    const unsortiert = aktiv.filter(s => !s.fach).length, imKorb = A.seiten.length - aktiv.length;
    const mitVorschlag = aktiv.filter(s => s.vorschlag && s.vorschlag.fach && !s.fach);
    let h = '<div class="kopfzeile"><h2 class="titel">📓 Heft</h2><span class="sp"></span>' +
      (imKorb ? '<a class="btn small" href="#heft/*papierkorb">🗑️ ' + imKorb + '</a>' : "") +
      (fachWahl && fachWahl[0] !== "*" ? '<button type="button" class="btn small" id="fachDruck" title="Ganzes Fach drucken oder als PDF">🖨️ Fach</button>' : "") +
      '<button type="button" class="btn primary" id="neu">+ Neue Seite</button></div>' +
      '<div class="suche"><input class="inp" type="search" id="q" placeholder="In allen Seiten suchen" aria-label="In allen Seiten suchen" value="' + esc(suche) + '"></div>' +
      '<div class="ordner" role="tablist" aria-label="Fach-Ordner">' +
      '<button type="button" role="tab" data-f="" aria-selected="' + (!fachWahl) + '">Alle <small>' + aktiv.length + '</small></button>' +
      A.einst.faecher.map(f => '<button type="button" role="tab" data-f="' + esc(f.name) + '" aria-selected="' + (fachWahl === f.name) + '"><span class="punkt" style="background:' + esc(f.farbe) + '"></span>' + esc(f.name) + ' <small>' + anzahl(f.name) + '</small></button>').join("") +
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
    el.querySelectorAll("img[data-bild]").forEach(async img => { const b = await A.bildHolen(img.dataset.bild); if (b) { const u = URL.createObjectURL(b); urls.push(u); img.src = u; } });
    el.querySelector("#neu").onclick = async () => {
      const s = await neueSeite(A, fachWahl && fachWahl[0] !== "*" ? fachWahl : "");
      if (s) A.gehe("seite/" + s.id);
    };
    const fd = el.querySelector("#fachDruck");
    if (fd) fd.onclick = () => Export.drucken(A, liste.slice().sort((a, b) => String(a.erstellt).localeCompare(String(b.erstellt))));
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

const STANDARD_STIFT = { modus: "stift", typ: "kuli", farbe: FARBEN[0], marker: MARKER[0], dicke: 0.5, radierGroesse: 3, formen: true, finger: true,
  favoriten: [{ typ: "kuli", farbe: "#1f4fd1", dicke: 0.5 }, { typ: "kuli", farbe: "#101826", dicke: 0.5 }, { typ: "fueller", farbe: "#101826", dicke: 0.6 }, { typ: "kuli", farbe: "#c93a3a", dicke: 0.5 }, { typ: "marker", farbe: "#ffe14d", dicke: 5 }] };

export function seite(A, el, id) {
  const s = A.seite(id);
  if (!s || s.papierkorb) { el.innerHTML = '<div class="empty"><b>Seite nicht gefunden</b><a href="#heft">Zurück zum Heft</a></div>'; return; }
  if (s.html == null) s.html = s.text ? Editor.textZuHtml(s.text) : "";
  const HE = A.einst.f.heft;
  const Z = Object.assign({}, STANDARD_STIFT, KW.load("kw-notizen-stift2", {}));
  const modusEinmal = KW.load("kw-notizen-stift-modus", null);
  if (modusEinmal) { Z.modus = modusEinmal; KW.save("kw-notizen-stift-modus", null); }
  if (!HE.marker && Z.typ === "marker") Z.typ = "kuli";
  if (HE.formen === false) Z.formen = false;
  let bildUrl = null, speicherTimer = null, rueck = [], vor = [], stiftGesehen = false, wz = null, auswahl = null;
  const B = breiteMm(s);
  let ansicht = s.bild ? (s.html && s.ansicht !== "foto" ? "text" : "foto") : "text";
  const merken = () => KW.save("kw-notizen-stift2", Z);

  el.innerHTML =
    '<div class="seite-leiste" role="toolbar" aria-label="Werkzeuge">' +
      '<a class="btn small" href="#heft' + (s.fach ? "/" + encodeURIComponent(s.fach) : "") + '" aria-label="Zurück zum Heft">←</a>' +
      '<div class="modus" role="radiogroup" aria-label="Eingabe">' +
        '<button type="button" role="radio" data-modus="stift" aria-label="Mit Stift schreiben" title="Stift">✏️</button>' +
        '<button type="button" role="radio" data-modus="tippen" aria-label="Text wie in Word" title="Text">Aa</button></div>' +
      (s.bild && s.html ? '<div class="modus" role="radiogroup" aria-label="Ansicht"><button type="button" role="radio" data-ansicht="text" title="Als Text (bearbeitbar)">📄</button><button type="button" role="radio" data-ansicht="foto" title="Original-Foto">📷</button></div>' : "") +
      '<span class="zoom-knoepfe"><button type="button" id="zMinus" aria-label="Kleiner">➖</button><button type="button" id="zPlus" aria-label="Größer">➕</button></span>' +
      '<span class="sp"></span>' +
      '<button type="button" id="rueck" aria-label="Rückgängig" title="Rückgängig (Strg+Z)">↶</button><button type="button" id="vor" aria-label="Wiederholen" title="Wiederholen">↷</button>' +
      '<button type="button" class="btn small" id="menueBtn" aria-haspopup="true" aria-expanded="false">⋯ Mehr</button>' +
    '</div>' +
    '<div class="unter-leiste" id="stiftLeiste" role="toolbar" aria-label="Stifte"></div>' +
    '<div class="unter-leiste" id="wortLeiste">' + Editor.leisteHtml() + '</div>' +
    '<div class="seite-kopf">' +
      '<input class="inp titel-inp" id="titel" maxlength="100" aria-label="Titel der Seite" value="' + esc(s.titel) + '" placeholder="Titel">' +
      '<select class="inp" id="fach" aria-label="Fach"><option value="">📥 Unsortiert</option>' + A.einst.faecher.map(f => '<option' + (f.name === s.fach ? " selected" : "") + '>' + esc(f.name) + '</option>').join("") +
        (s.fach && !A.einst.faecher.some(f => f.name === s.fach) ? '<option selected>' + esc(s.fach) + '</option>' : "") + '</select>' +
      '<button type="button" class="btn" id="papierBtn" title="Papier ändern">📄 ' + esc(Papier.info(s.raster).name) + (s.quer ? " · quer" : "") + '</button>' +
    '</div>' +
    '<div id="vorschlag"></div>' +
    '<div class="menue card" id="menue" hidden>' +
      (A.einst.an.lernen ? '<button type="button" data-a="lernen">🧠 Lernkarten & Quiz daraus machen</button>' : "") +
      (A.einst.an.planer && A.einst.f.planer.hausaufgaben ? '<button type="button" data-a="ha">📅 Hausaufgabe eintragen</button>' : "") +
      (s.bild ? '<button type="button" data-a="nachbau">📄 Als Word-Seite nachbauen</button><button type="button" data-a="ocr">🔍 Text erkennen</button>' : "") +
      (s.bild && s.original ? '<button type="button" data-a="ecken">📐 Ecken anpassen</button>' : "") +
      '<button type="button" data-a="word">💾 Als Word-Datei (.docx)</button>' +
      '<button type="button" data-a="druck">🖨️ Drucken / PDF</button>' +
      '<button type="button" data-a="bild">🖼️ Als Bild speichern</button>' +
      '<button type="button" data-a="pin">' + (s.pin ? "📌 Nicht mehr anpinnen" : "📌 Anpinnen") + '</button>' +
      '<button type="button" data-a="weg" class="rot">🗑️ In den Papierkorb</button>' +
    '</div>' +
    '<div class="blatt-rahmen" id="rahmen"><div class="blatt" id="blatt">' +
      (s.bild ? '<img id="scanBild" alt="Eingescanntes Blatt">' : "") +
      '<div class="rich" id="rich" contenteditable="true" spellcheck="true" lang="de" aria-label="Text der Seite" data-leer="' + (s.bild ? "" : "Tippe hier …") + '"></div>' +
      '<canvas id="tinte" aria-label="Zeichenfläche"></canvas>' +
      '<div class="werkzeug-ebene" id="wzEbene"></div>' +
    '</div></div>' +
    '<div class="seite-fuss"><span id="zaehler" class="muted klein"></span><span class="muted klein">Wird automatisch gespeichert · ' + QUELLE[s.quelle || "heft"] + ' angelegt ' + datum(s.erstellt) + '</span></div>' +
    (s.bild || s.ocr ? '<details class="card erkannt"><summary>🔍 Erkannter Text' + (s.ocr ? "" : " (noch keiner)") + '</summary><textarea class="inp" id="ocr" rows="6" aria-label="Erkannter Text">' + esc(s.ocr) + '</textarea></details>' : "");

  const blatt = el.querySelector("#blatt"), rahmenEl = el.querySelector("#rahmen"), canvas = el.querySelector("#tinte"), ctx = canvas.getContext("2d"), rich = el.querySelector("#rich");
  const wzEbene = el.querySelector("#wzEbene");
  rich.innerHTML = s.html;
  richStil(rich, s);
  Editor.formelnVorbereiten(rich);

  /* --- Papier, Größe --- */
  let k = 1;
  function papierZeigen() {
    const foto = s.bild && ansicht === "foto";
    blatt.style.backgroundImage = (foto || (s.bild && !s.html) ? "none" : Papier.hintergrund(s.raster, s.quer)) +
      ", repeating-linear-gradient(to bottom, transparent 0, transparent calc(var(--u) * " + kachelMm(s) + " - 1px), #c5ccd8 calc(var(--u) * " + kachelMm(s) + " - 1px), #c5ccd8 calc(var(--u) * " + kachelMm(s) + "))";
    blatt.style.backgroundSize = "100% calc(var(--u) * " + kachelMm(s) + "), 100% calc(var(--u) * " + kachelMm(s) + ")";
    const img = el.querySelector("#scanBild");
    if (img) img.hidden = !(s.bild && (ansicht === "foto" || !s.html));
    rich.hidden = !!(s.bild && (ansicht === "foto" || !s.html));
    el.querySelectorAll("[data-ansicht]").forEach(b => { b.classList.toggle("an", b.dataset.ansicht === ansicht); b.setAttribute("aria-checked", b.dataset.ansicht === ansicht); });
  }
  function groesse() {
    const breite = blatt.clientWidth;
    k = breite / B;
    blatt.style.setProperty("--u", k + "px");
    const hoehe = (s.hoehe || kachelMm(s)) * k;
    blatt.style.height = hoehe + "px";
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(breite * dpr); canvas.height = Math.round(hoehe * dpr);
    canvas.style.width = breite + "px"; canvas.style.height = hoehe + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    allesZeichnen(); werkzeugZeigen(); auswahlZeigen();
  }
  function allesZeichnen() { ctx.clearRect(0, 0, canvas.width, canvas.height); (s.striche || []).forEach(st => zeichneStrich(ctx, st, k)); }
  // Text länger als die Seite? Dann kommt eine Seite dazu (wie in Word)
  function wachsen() {
    if (rich.hidden || !rich.lastElementChild) return;
    // Höhe des Inhalts (nicht der Mindesthöhe des Feldes)
    let unten = 0;
    for (const c of rich.children) unten = Math.max(unten, c.offsetTop + c.offsetHeight);
    const noetig = unten / k + 15, kachel = kachelMm(s);
    if (noetig > (s.hoehe || kachel) + 0.5) { s.hoehe = Math.ceil(noetig / kachel) * kachel; groesse(); }
  }
  const ro = new ResizeObserver(groesse);
  ro.observe(blatt);
  papierZeigen();
  if (s.bild) A.bildHolen(s.bild).then(b => { if (b) { bildUrl = URL.createObjectURL(b); el.querySelector("#scanBild").src = bildUrl; } });

  /* --- Speichern --- */
  function spaeter() { clearTimeout(speicherTimer); speicherTimer = setTimeout(() => { speicherTimer = null; A.seiteSpeichern(s); }, 600); }
  function textGeaendert() {
    s.html = rich.innerHTML; s.text = Editor.htmlZuText(s.html);
    zaehlen(); wachsen(); spaeter();
  }
  function zaehlen() { const t = s.text || ""; el.querySelector("#zaehler").textContent = Editor.woerter(t) + " Wörter · " + t.replace(/\s/g, "").length + " Zeichen"; }
  zaehlen();
  rich.addEventListener("input", textGeaendert);
  const wort = Editor.leisteBinden(el.querySelector("#wortLeiste"), rich, textGeaendert, { bild: Editor.bildWaehlen, sprachModell: A.einst.f.audio.modell });
  el.querySelector("#titel").oninput = (e) => { s.titel = e.target.value; spaeter(); };
  el.querySelector("#fach").onchange = (e) => { s.fach = e.target.value; s.vorschlag = null; vorschlagZeigen(); spaeter(); };
  el.querySelector("#papierBtn").onclick = async () => {
    const w = await neueSeite(A, s.fach, { aendern: s });
    if (!w) return;
    const querNeu = !!w.quer;
    if (querNeu !== !!s.quer && (s.striche || []).length && !confirm("Beim Wechsel zwischen hoch und quer passen Zeichnungen evtl. nicht mehr ganz drauf. Trotzdem?")) return;
    s.raster = w.raster; s.quer = querNeu; if (!s.bild) s.hoehe = Math.max(querNeu ? 210 : 297, Math.ceil((s.hoehe || 297) / (querNeu ? 210 : 297)) * (querNeu ? 210 : 297));
    await A.seiteSpeichern(s); A.zeigen();
  };
  const ocrTa = el.querySelector("#ocr");
  if (ocrTa) ocrTa.oninput = () => { s.ocr = ocrTa.value; spaeter(); };
  el.querySelectorAll("[data-ansicht]").forEach(b => b.onclick = () => { ansicht = b.dataset.ansicht; s.ansicht = ansicht; papierZeigen(); wachsen(); spaeter(); });

  /* --- KI-Vorschlag (Fach/Titel) --- */
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

  /* --- Stift-Leiste --- */
  function stiftLeiste() {
    const sl = el.querySelector("#stiftLeiste");
    const farbenListe = Z.typ === "marker" ? MARKER : FARBEN, aktFarbe = Z.typ === "marker" ? Z.marker : Z.farbe;
    sl.innerHTML =
      '<span class="favoriten" title="Lieblingsstifte (lange drücken = aktuellen Stift hier speichern)">' + Z.favoriten.map((f, i) =>
        '<button type="button" class="fav" data-fav="' + i + '" aria-label="Lieblingsstift ' + (i + 1) + '" style="--c:' + esc(f.farbe) + '"><i class="fav-' + f.typ + '"></i></button>').join("") + '</span>' +
      '<span class="trenn"></span>' +
      STIFTE.filter(t => t[0] !== "marker" || HE.marker).map(t => '<button type="button" data-typ="' + t[0] + '" aria-label="' + t[2] + '" title="' + t[2] + '" class="' + (Z.typ === t[0] ? "an" : "") + '">' + t[1] + '</button>').join("") +
      '<span class="trenn"></span>' +
      (Z.typ === "radierer" ? '<label class="klein">Größe <select id="radGr">' + [1.5, 3, 6, 12].map(g => '<option value="' + g + '"' + (g === Z.radierGroesse ? " selected" : "") + '>' + g + ' mm</option>').join("") + '</select></label><small class="muted">' + (HE.radierer === "stueck" ? "radiert, wo du wischst" : "löscht ganze Striche") + '</small>' :
        Z.typ === "lasso" ? '<small class="muted">Kreise ein, was du verschieben, drehen, kopieren oder in Text umwandeln willst.</small>' :
        farbenListe.map(f => '<button type="button" class="farbe' + (f === aktFarbe ? " an" : "") + '" data-farbe="' + f + '" style="background:' + f + '" aria-label="Farbe ' + f + '"></button>').join("") +
        '<label class="farbe eigene" title="Eigene Farbe"><input type="color" id="eigeneFarbe" value="' + esc(aktFarbe) + '" aria-label="Eigene Farbe">🎨</label>' +
        (Z.typ !== "marker" ? '<select id="dicke" aria-label="Strichstärke">' + DICKE.map(d => '<option value="' + d[0] + '"' + (d[0] === Z.dicke ? " selected" : "") + '>' + d[1] + '</option>').join("") + '</select>' : "")) +
      '<span class="trenn"></span>' +
      '<button type="button" id="formen" class="' + (Z.formen ? "an" : "") + '" title="Formen erkennen: am Ende kurz halten" aria-label="Formen erkennen">🔺</button>' +
      '<button type="button" id="lineal" class="' + (wz && wz.art === "lineal" ? "an" : "") + '" title="Lineal" aria-label="Lineal">📏</button>' +
      '<button type="button" id="geo" class="' + (wz && wz.art === "geo" ? "an" : "") + '" title="Geodreieck" aria-label="Geodreieck">📐</button>' +
      '<button type="button" id="finger" class="' + (Z.finger ? "an" : "") + '" title="Mit dem Finger malen" aria-label="Mit dem Finger malen">☝️</button>';
    sl.querySelectorAll("[data-typ]").forEach(b => b.onclick = () => { Z.typ = b.dataset.typ; auswahlWeg(); merken(); stiftLeiste(); leiste(); });
    sl.querySelectorAll("[data-farbe]").forEach(b => b.onclick = () => { if (Z.typ === "marker") Z.marker = b.dataset.farbe; else Z.farbe = b.dataset.farbe; merken(); stiftLeiste(); });
    const ef = sl.querySelector("#eigeneFarbe"); if (ef) ef.oninput = () => { if (Z.typ === "marker") Z.marker = ef.value; else Z.farbe = ef.value; merken(); };
    const di = sl.querySelector("#dicke"); if (di) di.onchange = () => { Z.dicke = Number(di.value); merken(); };
    const rg = sl.querySelector("#radGr"); if (rg) rg.onchange = () => { Z.radierGroesse = Number(rg.value); merken(); };
    sl.querySelector("#formen").onclick = () => { Z.formen = !Z.formen; merken(); stiftLeiste(); KW.toast(Z.formen ? "Formen-Erkennung an: am Ende des Strichs kurz halten." : "Formen-Erkennung aus."); };
    sl.querySelector("#finger").onclick = () => { Z.finger = !Z.finger; merken(); stiftLeiste(); leiste(); KW.toast(Z.finger ? "Finger malt mit." : "Finger malt nicht – nur der Stift. Mit dem Finger scrollst du."); };
    sl.querySelector("#lineal").onclick = () => werkzeugUmschalten("lineal");
    sl.querySelector("#geo").onclick = () => werkzeugUmschalten("geo");
    sl.querySelectorAll("[data-fav]").forEach(b => {
      let lang = null;
      b.onpointerdown = () => { lang = setTimeout(() => { lang = "fertig"; Z.favoriten[b.dataset.fav] = { typ: Z.typ === "radierer" || Z.typ === "lasso" ? "kuli" : Z.typ, farbe: Z.typ === "marker" ? Z.marker : Z.farbe, dicke: Z.typ === "marker" ? 5 : Z.dicke }; merken(); stiftLeiste(); KW.toast("Lieblingsstift gespeichert ★"); }, 600); };
      b.onpointerup = b.onpointerleave = () => { if (lang !== "fertig") clearTimeout(lang); };
      b.onclick = () => { if (lang === "fertig") return; const f = Z.favoriten[b.dataset.fav]; Z.typ = f.typ; if (f.typ === "marker") Z.marker = f.farbe; else { Z.farbe = f.farbe; Z.dicke = f.dicke; } merken(); stiftLeiste(); leiste(); };
    });
  }

  function leiste() {
    el.querySelectorAll("[data-modus]").forEach(b => { const an = b.dataset.modus === Z.modus; b.setAttribute("aria-checked", an); b.classList.toggle("an", an); });
    el.querySelector("#stiftLeiste").hidden = Z.modus !== "stift";
    el.querySelector("#wortLeiste").hidden = Z.modus !== "tippen" || rich.hidden;
    blatt.classList.toggle("tippen", Z.modus === "tippen");
    blatt.classList.toggle("stift-modus", Z.modus === "stift");
    blatt.dataset.werkzeug = Z.typ;
    rich.contentEditable = Z.modus === "tippen" ? "true" : "false";
    canvas.style.touchAction = Z.modus === "stift" && Z.finger && !stiftGesehen ? "none" : "pan-x pan-y";
    el.querySelector("#rueck").disabled = !rueck.length && Z.modus === "stift";
    el.querySelector("#vor").disabled = !vor.length && Z.modus === "stift";
  }
  el.querySelectorAll("[data-modus]").forEach(b => b.onclick = () => { Z.modus = b.dataset.modus; merken(); auswahlWeg(); leiste(); if (Z.modus === "tippen") rich.focus(); });
  function sichern() { rueck.push(JSON.stringify(s.striche)); if (rueck.length > 60) rueck.shift(); vor = []; }
  function rueckgaengig() {
    if (Z.modus === "tippen") { document.execCommand("undo"); return; }
    if (!rueck.length) return; vor.push(JSON.stringify(s.striche)); s.striche = JSON.parse(rueck.pop()); auswahlWeg(); allesZeichnen(); spaeter(); leiste();
  }
  function wiederholen() {
    if (Z.modus === "tippen") { document.execCommand("redo"); return; }
    if (!vor.length) return; rueck.push(JSON.stringify(s.striche)); s.striche = JSON.parse(vor.pop()); allesZeichnen(); spaeter(); leiste();
  }
  el.querySelector("#rueck").onclick = rueckgaengig;
  el.querySelector("#vor").onclick = wiederholen;

  /* --- Zoomen: Knöpfe oder zwei Finger --- */
  let zoom = 1;
  function zoomSetzen(z) {
    zoom = Math.max(1, Math.min(4, Math.round(z * 100) / 100));
    blatt.style.width = zoom > 1 ? zoom * 100 + "%" : "";
    blatt.style.maxWidth = zoom > 1 ? "none" : "";
  }
  el.querySelector("#zPlus").onclick = () => zoomSetzen(zoom + 0.5);
  el.querySelector("#zMinus").onclick = () => zoomSetzen(zoom - 0.5);

  /* --- Gesten: zwei Finger tippen = rückgängig, drei = wiederholen, zwei Finger = zoomen, Rand wischen = Seite blättern --- */
  let pinch = null, geste = null;
  const abstand = (ts) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
  blatt.addEventListener("touchstart", (e) => {
    if (!geste) geste = { start: Date.now(), max: 0, bewegt: false, x: e.touches[0].clientX, y: e.touches[0].clientY, rand: false };
    geste.max = Math.max(geste.max, e.touches.length);
    if (e.touches.length === 1) { const r = rahmenEl.getBoundingClientRect(); geste.rand = e.touches[0].clientX - r.left < 26 || r.right - e.touches[0].clientX < 26; }
    if (e.touches.length === 2) {
      pinch = { d: abstand(e.touches), z: zoom };
      if (strich && strich.finger) { strich = null; rueck.pop(); allesZeichnen(); }
    }
  }, { passive: true });
  blatt.addEventListener("touchmove", (e) => {
    if (geste && Math.hypot(e.touches[0].clientX - geste.x, e.touches[0].clientY - geste.y) > 14) geste.bewegt = true;
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    zoomSetzen(pinch.z * abstand(e.touches) / pinch.d);
  }, { passive: false });
  blatt.addEventListener("touchend", (e) => {
    if (e.touches.length < 2) pinch = null;
    if (e.touches.length || !geste) return;
    const g = geste; geste = null;
    const dauer = Date.now() - g.start, dx = (e.changedTouches[0].clientX - g.x);
    if (!g.bewegt && dauer < 300 && g.max === 2) { rueckgaengig(); KW.toast("↶ Rückgängig"); }
    else if (!g.bewegt && dauer < 300 && g.max === 3) { wiederholen(); KW.toast("↷ Wiederholt"); }
    else if (g.rand && g.max === 1 && Math.abs(dx) > 90) blaettern(dx < 0 ? 1 : -1);
  });
  function blaettern(richtung) {
    const reihe = A.aktiv().filter(x => (x.fach || "") === (s.fach || "")).sort((a, b) => String(a.erstellt).localeCompare(String(b.erstellt)));
    const i = reihe.findIndex(x => x.id === s.id), n = reihe[i + richtung];
    if (n) A.gehe("seite/" + n.id); else KW.toast(richtung > 0 ? "Das ist die letzte Seite." : "Das ist die erste Seite.");
  }

  /* --- Lineal und Geodreieck --- */
  function werkzeugUmschalten(art) {
    if (wz && wz.art === art) wz = null;
    else wz = { art, x: 25, y: Math.min(120, (s.hoehe || 297) / 2 - 20), w: 0 };
    werkzeugZeigen(); stiftLeiste();
  }
  function werkzeugSvg(art) {
    if (art === "lineal") {
      let t = '<rect x="0" y="0" width="160" height="30" rx="1.5" fill="rgba(255,255,255,.6)" stroke="#7d8ea8" stroke-width=".3"/>';
      for (let i = 0; i <= 150; i++) { const l = i % 10 ? (i % 5 ? 2 : 3.5) : 5; t += '<line x1="' + (5 + i) + '" y1="0" x2="' + (5 + i) + '" y2="' + l + '" stroke="#36435a" stroke-width=".18"/><line x1="' + (5 + i) + '" y1="30" x2="' + (5 + i) + '" y2="' + (30 - l) + '" stroke="#36435a" stroke-width=".18"/>'; if (i % 10 === 0) t += '<text x="' + (5 + i) + '" y="9" font-size="3" text-anchor="middle" fill="#36435a" font-family="Arial">' + (i / 10) + '</text>'; }
      return { w: 160, h: 30, svg: t, dreh: [150, 15] };
    }
    let t = '<polygon points="0,80 160,80 80,0" fill="rgba(210,235,255,.55)" stroke="#7d8ea8" stroke-width=".35"/>';
    for (let i = -70; i <= 70; i++) { const l = i % 10 ? (i % 5 ? 2 : 3) : 4.5; t += '<line x1="' + (80 + i) + '" y1="80" x2="' + (80 + i) + '" y2="' + (80 - l) + '" stroke="#36435a" stroke-width=".16"/>'; if (i % 10 === 0 && i) t += '<text x="' + (80 + i) + '" y="73" font-size="2.6" text-anchor="middle" fill="#36435a" font-family="Arial">' + Math.abs(i / 10) + '</text>'; }
    for (let w = 10; w <= 170; w += 5) { const b = w * Math.PI / 180, r1 = 52, r2 = w % 10 ? 54 : 56; t += '<line x1="' + (80 + r1 * Math.cos(b)) + '" y1="' + (80 - r1 * Math.sin(b)) + '" x2="' + (80 + r2 * Math.cos(b)) + '" y2="' + (80 - r2 * Math.sin(b)) + '" stroke="#36435a" stroke-width=".16"/>'; if (w % 30 === 0) t += '<text x="' + (80 + 48 * Math.cos(b)) + '" y="' + (80 - 48 * Math.sin(b) + 1) + '" font-size="2.6" text-anchor="middle" fill="#36435a" font-family="Arial">' + w + '</text>'; }
    t += '<circle cx="80" cy="80" r="1" fill="#c93a3a"/>';
    return { w: 160, h: 80, svg: t, dreh: [80, 30] };
  }
  function werkzeugZeigen() {
    if (!wz) { wzEbene.innerHTML = ""; return; }
    const g = werkzeugSvg(wz.art);
    wzEbene.innerHTML = '<div class="werkzeug" id="wz" style="left:' + wz.x * k + 'px;top:' + wz.y * k + 'px;width:' + g.w * k + 'px;height:' + g.h * k + 'px;transform:rotate(' + wz.w + 'deg)">' +
      '<svg viewBox="0 0 ' + g.w + ' ' + g.h + '" width="100%" height="100%">' + g.svg + '</svg>' +
      '<button type="button" class="wz-dreh" style="left:' + g.dreh[0] * k + 'px;top:' + g.dreh[1] * k + 'px" aria-label="Drehen">⟳</button>' +
      '<button type="button" class="wz-zu" aria-label="Wegräumen">✕</button><span class="wz-winkel">' + Math.round(((wz.w % 360) + 360) % 360) + '°</span></div>';
    const w = wzEbene.querySelector("#wz"), finger = new Map();
    let modus = null, start = null;
    w.querySelector(".wz-zu").onclick = () => { wz = null; werkzeugZeigen(); stiftLeiste(); };
    w.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".wz-zu")) return;
      e.preventDefault(); e.stopPropagation(); w.setPointerCapture(e.pointerId);
      finger.set(e.pointerId, [e.clientX, e.clientY]);
      const r = blatt.getBoundingClientRect(), mx = (e.clientX - r.left) / k, my = (e.clientY - r.top) / k;
      if (e.target.closest(".wz-dreh")) { const g = werkzeugSvg(wz.art), c = drehpunkt(g); modus = "dreh"; start = { w: wz.w, a: Math.atan2(my - c[1], mx - c[0]) }; }
      else if (finger.size === 2) { const [a, b] = [...finger.values()]; modus = "zwei"; start = { w: wz.w, a: Math.atan2(b[1] - a[1], b[0] - a[0]), x: wz.x, y: wz.y, m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; }
      else { modus = "zieh"; start = { x: wz.x, y: wz.y, mx, my }; }
    });
    w.addEventListener("pointermove", (e) => {
      if (!modus || !finger.has(e.pointerId)) return;
      finger.set(e.pointerId, [e.clientX, e.clientY]);
      const r = blatt.getBoundingClientRect(), mx = (e.clientX - r.left) / k, my = (e.clientY - r.top) / k;
      if (modus === "zieh") { wz.x = start.x + mx - start.mx; wz.y = start.y + my - start.my; }
      else if (modus === "dreh") { const c = drehpunkt(werkzeugSvg(wz.art)); drehenUm(c, start.w + (Math.atan2(my - c[1], mx - c[0]) - start.a) * 180 / Math.PI); }
      else if (modus === "zwei" && finger.size === 2) {
        const [a, b] = [...finger.values()], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        wz.x = start.x + (m[0] - start.m[0]) / k; wz.y = start.y + (m[1] - start.m[1]) / k;
        drehenUm(drehpunkt(werkzeugSvg(wz.art)), start.w + (Math.atan2(b[1] - a[1], b[0] - a[0]) - start.a) * 180 / Math.PI);
      }
      const ww = wzEbene.querySelector("#wz");
      ww.style.left = wz.x * k + "px"; ww.style.top = wz.y * k + "px"; ww.style.transform = "rotate(" + wz.w + "deg)";
      ww.querySelector(".wz-winkel").textContent = Math.round(((wz.w % 360) + 360) % 360) + "°";
    });
    const los = (e) => { finger.delete(e.pointerId); if (!finger.size) modus = null; };
    w.addEventListener("pointerup", los); w.addEventListener("pointercancel", los);
  }
  // Mittelpunkt des Werkzeugs in Seiten-mm (zum Drehen um die Mitte)
  function drehpunkt(g) { const b = wz.w * Math.PI / 180, cx = g.w / 2, cy = g.h / 2; return [wz.x + cx * Math.cos(b) - cy * Math.sin(b), wz.y + cx * Math.sin(b) + cy * Math.cos(b)]; }
  function drehenUm(c, wNeu) {
    // auf ganze Grad, bei 0/45/90… leicht einrasten
    let w = Math.round(wNeu); for (const z of [0, 45, 90, 135, 180, -45, -90, -135, -180]) if (Math.abs(w - z) < 3) w = z;
    const g = werkzeugSvg(wz.art), b = w * Math.PI / 180, cx = g.w / 2, cy = g.h / 2;
    wz.w = w; wz.x = c[0] - (cx * Math.cos(b) - cy * Math.sin(b)); wz.y = c[1] - (cx * Math.sin(b) + cy * Math.cos(b));
  }

  /* --- Zeichnen: Stift, Maus, Finger --- */
  let strich = null, radiertGerade = false, kante = null, halteTimer = null, lassoPoly = null;
  function punkt(e) {
    const r = canvas.getBoundingClientRect();
    const druck = e.pointerType === "pen" ? (e.pressure || 0.5) : 0.5;
    let p = [Math.round((e.clientX - r.left) / k * 10) / 10, Math.round((e.clientY - r.top) / k * 10) / 10, Math.round(druck * 100) / 100];
    if (kante) p = F.aufKante(p, kante);
    return p;
  }
  function radieren(p) {
    const r = Z.radierGroesse;
    const nah = (q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < r + 0.3;
    if (HE.radierer === "stueck") {
      const neu = []; let geaendert = false;
      for (const st of s.striche) {
        if (!st.p.some(nah)) { neu.push(st); continue; }
        geaendert = true; let teil = [];
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
  function lassoMalen() {
    allesZeichnen();
    if (!lassoPoly || lassoPoly.length < 2) return;
    ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = "#ff8a3c"; ctx.lineWidth = 1.5;
    ctx.beginPath(); lassoPoly.forEach((q, i) => i ? ctx.lineTo(q[0] * k, q[1] * k) : ctx.moveTo(q[0] * k, q[1] * k)); ctx.closePath(); ctx.stroke(); ctx.restore();
  }
  canvas.addEventListener("pointerdown", (e) => {
    if (Z.modus !== "stift") return;
    if (e.pointerType === "pen" && !stiftGesehen) { stiftGesehen = true; if (Z.finger) { Z.finger = false; merken(); stiftLeiste(); KW.toast("Stift erkannt ✏️ – deine Hand malt jetzt nicht mehr mit."); } leiste(); }
    if (e.pointerType === "touch" && (!Z.finger || stiftGesehen)) return;
    const stiftRadierer = e.pointerType === "pen" && (e.button === 5 || e.button === 2 || (e.buttons & 32) || (e.buttons & 2));
    if (e.button > 0 && !stiftRadierer) return;
    if (strich && e.pointerType === "touch") return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    auswahlWeg();
    kante = null;
    const roh = punkt(e);
    const typ = stiftRadierer ? "radierer" : Z.typ;
    if (typ === "lasso") { lassoPoly = [roh]; strich = { lasso: true }; return; }
    sichern();
    if (typ === "radierer") { radiertGerade = radieren(roh); if (radiertGerade) allesZeichnen(); strich = { radierer: true }; return; }
    if (wz) { kante = F.naechsteKante(roh, F.kanten(wz), 6); }
    const p = kante ? F.aufKante(roh, kante) : roh;
    strich = typ === "marker" ? { art: "marker", farbe: Z.marker, b: 5, p: [p] } : { art: typ, farbe: Z.farbe, b: Z.dicke, p: [p] };
    if (e.pointerType === "touch") Object.defineProperty(strich, "finger", { value: true, enumerable: false });
    zeichneStrich(ctx, strich, k);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!strich || pinch) return;
    const ereignisse = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of ereignisse) {
      const p = punkt(ev);
      if (strich.lasso) { lassoPoly.push(p); continue; }
      if (strich.radierer) { if (radieren(p)) { radiertGerade = true; allesZeichnen(); } continue; }
      const l = strich.p[strich.p.length - 1];
      if (Math.hypot(p[0] - l[0], p[1] - l[1]) < 0.25) continue;
      if (strich.form) { strich.form = null; } // weitergemalt: keine Form mehr
      strich.p.push(p);
      zeichneStrich(ctx, { art: strich.art, farbe: strich.farbe, b: strich.b, p: strich.p.slice(-3) }, k);
    }
    if (strich.lasso) { lassoMalen(); return; }
    // Kurz halten am Ende → Form erkennen
    clearTimeout(halteTimer);
    if (Z.formen && !strich.radierer && strich.art !== "marker" && !kante) {
      halteTimer = setTimeout(() => {
        if (!strich || strich.radierer || strich.lasso) return;
        const r = F.formErkennen(strich.p);
        if (r) { strich.p = r.p; strich.form = r.form; allesZeichnen(); zeichneStrich(ctx, strich, k); if (navigator.vibrate) navigator.vibrate(12); }
      }, 550);
    }
  });
  function ende() {
    clearTimeout(halteTimer);
    if (!strich) return;
    if (strich.lasso) {
      const poly = lassoPoly; lassoPoly = null; strich = null; allesZeichnen();
      if (poly && poly.length > 4) { const idx = F.imLasso(s.striche, poly); if (idx.length) { auswahl = { idx }; auswahlZeigen(); } else KW.toast("Nichts eingekreist."); }
      return;
    }
    if (strich.radierer) { if (!radiertGerade) rueck.pop(); radiertGerade = false; }
    else {
      if (strich.art === "marker") strich.p = F.markerGerade(strich.p);
      s.striche.push(strich);
    }
    strich = null; kante = null;
    allesZeichnen(); spaeter(); leiste();
    {
      const letzter = s.striche[s.striche.length - 1];
      if (letzter) { const unten = Math.max(...letzter.p.map(q => q[1])); if (unten > (s.hoehe || kachelMm(s)) - 30 && !s.bild) { s.hoehe = (s.hoehe || kachelMm(s)) + kachelMm(s); groesse(); } }
    }
  }
  canvas.addEventListener("pointerup", ende);
  canvas.addEventListener("pointercancel", ende);

  /* --- Lasso-Auswahl: verschieben, vergrößern, drehen, kopieren, löschen, Farbe, in Text --- */
  function auswahlWeg() { auswahl = null; auswahlZeigen(); }
  function auswahlZeigen() {
    const alt = blatt.querySelector(".auswahl"); if (alt) alt.remove();
    if (!auswahl || !auswahl.idx.length) return;
    const r = F.rahmen(auswahl.idx.map(i => s.striche[i])), rand = 2;
    const box = document.createElement("div");
    box.className = "auswahl";
    box.style.cssText = "left:" + (r.x - rand) * k + "px;top:" + (r.y - rand) * k + "px;width:" + (r.w + 2 * rand) * k + "px;height:" + (r.h + 2 * rand) * k + "px";
    box.innerHTML = '<span class="griff dreh" data-g="dreh" aria-label="Drehen">⟳</span><span class="griff gross" data-g="gross" aria-label="Größe"></span>' +
      '<div class="auswahl-menue card"><button data-m="kopie" title="Kopieren">📋</button><button data-m="farbe" title="Farbe">🎨</button><button data-m="text" title="Handschrift in Text umwandeln">Aa</button><button data-m="weg" title="Löschen">🗑️</button><button data-m="zu" title="Fertig">✓</button></div>';
    blatt.appendChild(box);
    let ziehen = null;
    box.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".auswahl-menue")) return;
      e.preventDefault(); e.stopPropagation(); box.setPointerCapture(e.pointerId);
      const b = blatt.getBoundingClientRect(), mx = (e.clientX - b.left) / k, my = (e.clientY - b.top) / k;
      sichern();
      ziehen = { art: (e.target.dataset && e.target.dataset.g) || "zieh", mx, my, orig: auswahl.idx.map(i => s.striche[i]), r };
    });
    box.addEventListener("pointermove", (e) => {
      if (!ziehen) return;
      const b = blatt.getBoundingClientRect(), mx = (e.clientX - b.left) / k, my = (e.clientY - b.top) / k, R = ziehen.r;
      let t = { cx: R.cx, cy: R.cy };
      if (ziehen.art === "zieh") t = Object.assign(t, { dx: mx - ziehen.mx, dy: my - ziehen.my });
      if (ziehen.art === "gross") t.s = Math.max(0.2, Math.hypot(mx - R.cx, my - R.cy) / Math.max(1, Math.hypot(ziehen.mx - R.cx, ziehen.my - R.cy)));
      if (ziehen.art === "dreh") t.w = (Math.atan2(my - R.cy, mx - R.cx) - Math.atan2(ziehen.my - R.cy, ziehen.mx - R.cx)) * 180 / Math.PI;
      auswahl.idx.forEach((i, j) => { s.striche[i] = F.umformen(ziehen.orig[j], t); });
      allesZeichnen();
      const r2 = F.rahmen(auswahl.idx.map(i => s.striche[i]));
      box.style.left = (r2.x - rand) * k + "px"; box.style.top = (r2.y - rand) * k + "px"; box.style.width = (r2.w + 2 * rand) * k + "px"; box.style.height = (r2.h + 2 * rand) * k + "px";
    });
    box.addEventListener("pointerup", () => { if (ziehen) { ziehen = null; spaeter(); auswahlZeigen(); leiste(); } });
    box.querySelector(".auswahl-menue").onclick = async (e) => {
      const m = e.target.closest("[data-m]"); if (!m) return;
      const a = m.dataset.m;
      if (a === "zu") return auswahlWeg();
      sichern();
      if (a === "weg") { s.striche = s.striche.filter((_, i) => !auswahl.idx.includes(i)); auswahlWeg(); }
      if (a === "kopie") { const neu = auswahl.idx.map(i => F.umformen(s.striche[i], { dx: 8, dy: 8 })); const start = s.striche.length; s.striche.push(...neu); auswahl = { idx: neu.map((_, j) => start + j) }; auswahlZeigen(); }
      if (a === "farbe") { const liste = FARBEN.concat(MARKER), jetzt = s.striche[auswahl.idx[0]].farbe, n = liste[(liste.indexOf(jetzt) + 1) % liste.length]; auswahl.idx.forEach(i => { s.striche[i] = Object.assign({}, s.striche[i], { farbe: n }); }); }
      if (a === "text") { rueck.pop(); await handschriftZuText(); return; }
      allesZeichnen(); spaeter(); leiste();
    };
  }
  async function handschriftZuText() {
    const teil = auswahl.idx.map(i => s.striche[i]), r = F.rahmen(teil), px = 8, rand = 4;
    const c = document.createElement("canvas"); c.width = Math.round((r.w + 2 * rand) * px); c.height = Math.round((r.h + 2 * rand) * px);
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.translate(-(r.x - rand) * px, -(r.y - rand) * px);
    teil.forEach(st => zeichneStrich(g, Object.assign({}, st, { farbe: st.art === "marker" ? st.farbe : "#000" }), px));
    const blob = await new Promise(ok => c.toBlob(ok, "image/png"));
    KW.toast("Die KI liest deine Handschrift …");
    let text = "";
    try { text = (await KI.bildLesen(A.einst.ki, blob)).trim(); }
    catch (e) { KW.toast(e.message === "keine-ki" ? "Dafür braucht es die KI (⚙️ Einstellungen → KI)." : "Handschrift lesen geht nur mit Chrome-KI (Gemini Nano) oder Ollama mit Bild-Modell."); return; }
    if (!text) { KW.toast("Ich konnte nichts lesen."); return; }
    const d = document.createElement("dialog"); d.className = "sheet";
    d.innerHTML = '<form class="sheet-in" method="dialog"><h2>Aa Erkannter Text</h2><textarea class="inp" id="hT" rows="5">' + esc(text) + '</textarea><p class="muted klein">Prüf den Text kurz – die KI kann sich verlesen.</p>' +
      '<div class="sheet-foot"><button type="button" class="btn" id="hAb">Abbrechen</button><span class="sp"></span><button type="button" class="btn" id="hDazu">Text dazu</button><button class="btn primary" id="hErsetzen">Gemaltes ersetzen</button></div></form>';
    document.body.appendChild(d);
    const einfuegen = (ersetzen) => {
      const t = d.querySelector("#hT").value.trim(); if (!t) return;
      sichern();
      rich.insertAdjacentHTML("beforeend", Editor.textZuHtml(t));
      if (ersetzen) { s.striche = s.striche.filter((_, i) => !auswahl.idx.includes(i)); auswahlWeg(); allesZeichnen(); }
      textGeaendert(); d.close(); KW.toast("Als Text eingefügt – unten auf der Seite.");
    };
    d.querySelector("#hAb").onclick = () => d.close();
    d.querySelector("#hDazu").onclick = () => einfuegen(false);
    d.querySelector("#hErsetzen").onclick = (e) => { e.preventDefault(); einfuegen(true); };
    d.addEventListener("close", () => d.remove());
    d.showModal();
  }

  /* --- Tastenkürzel --- */
  function tasten(e) {
    const tippen = document.activeElement && (/TEXTAREA|INPUT|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable);
    if (e.key === "Escape") auswahlWeg();
    if (tippen) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? wiederholen() : rueckgaengig(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); wiederholen(); }
    if ((e.key === "Delete" || e.key === "Backspace") && auswahl) { sichern(); s.striche = s.striche.filter((_, i) => !auswahl.idx.includes(i)); auswahlWeg(); allesZeichnen(); spaeter(); }
  }
  document.addEventListener("keydown", tasten);

  /* --- Menü --- */
  const menue = el.querySelector("#menue"), menueBtn = el.querySelector("#menueBtn");
  menueBtn.onclick = () => { menue.hidden = !menue.hidden; menueBtn.setAttribute("aria-expanded", !menue.hidden); };
  async function jetztSpeichern() { if (speicherTimer) { clearTimeout(speicherTimer); speicherTimer = null; } await A.seiteSpeichern(s); }
  menue.onclick = async (e) => {
    const b = e.target.closest("[data-a]");
    if (!b) return;
    menue.hidden = true; menueBtn.setAttribute("aria-expanded", "false");
    const a = b.dataset.a;
    if (a === "lernen") { await jetztSpeichern(); Lernen.ausSeite(A, s); }
    if (a === "ha") Planer.eintragen(A, { fach: s.fach });
    if (a === "ocr") { KW.toast("Text wird erkannt …"); s.ocr = ""; await A.verarbeiten(s, { zwingen: true, nurText: true }); KW.toast(s.ocr ? "Text erkannt." : "Kein Text gefunden."); A.zeigen(); }
    if (a === "nachbau") { if (s.html && !confirm("Die Word-Seite wird neu aus dem Foto gebaut. Deine Änderungen am Text gehen dabei verloren. Weiter?")) return; KW.toast("📄 Seite wird nachgebaut … (kann etwas dauern)"); await A.nachbauen(s); A.zeigen(); }
    if (a === "ecken") { await jetztSpeichern(); A.eckenAnpassen(s); }
    if (a === "word") { await jetztSpeichern(); Export.alsWord(A, s); }
    if (a === "druck") { await jetztSpeichern(); Export.drucken(A, [s]); }
    if (a === "pin") { s.pin = !s.pin; await A.seiteSpeichern(s); b.textContent = s.pin ? "📌 Nicht mehr anpinnen" : "📌 Anpinnen"; KW.toast(s.pin ? "Angepinnt – steht jetzt oben." : "Nicht mehr angepinnt."); }
    if (a === "bild") alsBild();
    if (a === "weg") {
      await jetztSpeichern();
      await A.seiteLoeschen(s.id);
      A.gehe("heft" + (s.fach ? "/" + s.fach : ""));
      KW.toast("In den Papierkorb gelegt.", "Rückgängig", async () => { await A.seiteWiederherstellen(s.id); A.gehe("seite/" + s.id); });
    }
  };
  document.addEventListener("click", function zu(e) { if (!document.body.contains(menue)) { document.removeEventListener("click", zu); return; } if (!menue.hidden && !menue.contains(e.target) && e.target !== menueBtn) { menue.hidden = true; menueBtn.setAttribute("aria-expanded", "false"); } });

  // Ganze Seite als PNG (Papier + Foto/Text + Striche)
  async function alsBild() {
    const px = 6, W = Math.round(B * px), Hh = Math.round((s.hoehe || kachelMm(s)) * px), c = document.createElement("canvas");
    c.width = W; c.height = Hh;
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, W, Hh);
    const foto = s.bild && (ansicht === "foto" || !s.html);
    if (foto && bildUrl) g.drawImage(el.querySelector("#scanBild"), 0, 0, W, Hh);
    else {
      const p = await new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(Papier.svg(s.raster, s.quer)); });
      if (p) for (let y = 0; y < Hh; y += kachelMm(s) * px) g.drawImage(p, 0, y, W, kachelMm(s) * px);
      // Text: einfache Darstellung Zeile für Zeile
      const st = getComputedStyle(rich), f = px / k;
      g.fillStyle = "#101826"; g.font = (parseFloat(st.fontSize) * f) + "px 'Space Grotesk', Arial, sans-serif";
      const lh = parseFloat(st.lineHeight) * f || parseFloat(st.fontSize) * f * 1.4, links = parseFloat(st.paddingLeft) * f, breit = W - links - parseFloat(st.paddingRight) * f;
      let y = parseFloat(st.paddingTop) * f + lh * 0.75;
      for (const absatz of (s.text || "").split("\n")) {
        let zeile = "";
        for (const w of absatz.split(" ")) { const t = zeile ? zeile + " " + w : w; if (g.measureText(t).width > breit && zeile) { g.fillText(zeile, links, y); y += lh; zeile = w; } else zeile = t; }
        g.fillText(zeile, links, y); y += lh;
      }
    }
    (s.striche || []).forEach(st => zeichneStrich(g, st, px));
    c.toBlob(b => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b); a.download = (s.titel || "seite").replace(/[^\wäöüÄÖÜß -]/g, "") + ".png";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, "image/png");
  }

  stiftLeiste();
  leiste();
  groesse();
  setTimeout(wachsen, 50);
  if (Z.modus === "tippen" && !s.text && !s.bild) rich.focus();

  return () => {
    ro.disconnect();
    document.removeEventListener("keydown", tasten);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    const bm = document.querySelector(".bild-menue"); if (bm) bm.remove();
    if (speicherTimer) { clearTimeout(speicherTimer); A.seiteSpeichern(s); }
    if (bildUrl) URL.revokeObjectURL(bildUrl);
  };
}
