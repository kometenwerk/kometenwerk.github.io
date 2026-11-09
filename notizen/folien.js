// FIDELIA Notizen · Präsentationen (wie PowerPoint)
// Folien mit Text, Bildern, Formen, Tabellen und Formeln · 8 Designs · Übergänge und Animationen ·
// Vorführen mit Stift, Laserpointer, Notizen und Timer · Folien aus einer Heftseite (KI) · .pptx und PDF.

import * as K from "./folien-kern.js";
import * as KI from "./ki.js";
import * as Editor from "./editor.js";
import * as Extras from "./extras.js";
import { herunterladen } from "./export.js";

const KW = window.KW, esc = KW.esc;
const datum = (iso) => { try { return new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "short" }); } catch (e) { return ""; } };
const UEBERGAENGE = [["", "Keiner"], ["blende", "Überblenden"], ["schieben", "Schieben"], ["zoom", "Zoom"], ["wuerfel", "Kippen"]];
const ANIMATIONEN = [["einblenden", "Einblenden"], ["fliegen", "Hereinfliegen"], ["zoom", "Zoom"], ["wischen", "Wischen"]];

// Formeln hübsch (KaTeX liegt lokal) – synchron, wenn schon geladen
let katexFertig = false;
const katexHtml = (tex) => { try { return katexFertig && window.katex ? window.katex.renderToString(tex, { throwOnError: false, displayMode: false }) : esc(tex); } catch (e) { return esc(tex); } };
function katexLaden() { return Editor.katex().then(() => { katexFertig = true; }).catch(() => {}); }

export function textVon(s) {
  const d = document.createElement("div");
  d.innerHTML = (s.folien || []).map(f => f.el.map(e => e.html || (e.zeilen ? e.zeilen.flat().join(" ") : "") || e.tex || "").join(" ") + " " + (f.notiz || "")).join(" ");
  return d.textContent.replace(/\s+/g, " ").slice(0, 4000);
}

/* ---------- Kleine Vorschau einer Folie ---------- */

function mini(folie, designId, breite) {
  const k = breite / K.W;
  return '<div class="mini-folie" style="width:' + breite + "px;height:" + Math.round(K.H * k) + 'px"><div class="mini-innen" style="transform:scale(' + k + ')">' + K.folieHtml(folie, designId, { katex: katexHtml }) + "</div></div>";
}

/* ---------- Liste ---------- */

export function liste(A, el) {
  katexLaden();
  let q = "";
  function zeichnen() {
    const l = A.aktiv("folien").sort((a, b) => String(b.geaendert).localeCompare(String(a.geaendert))).filter(s => !q || A.seitenText(s).toLowerCase().includes(q.toLowerCase()));
    el.innerHTML = '<div class="kopfzeile"><h2 class="titel">🖥️ Präsentationen</h2><span class="sp"></span>' +
      (A.einst.f.folien && A.einst.f.folien.ki === false ? "" : '<button type="button" class="btn small" id="ausHeft">🤖 Aus Heftseite</button>') +
      '<label class="btn small" title="FIDELIA-Datei öffnen">📥 Öffnen<input type="file" id="oeffnen" accept=".fidelia,.json" hidden></label>' +
      '<button type="button" class="btn primary" id="neu">+ Neue Präsentation</button></div>' +
      '<div class="suche"><input class="inp" type="search" id="q" placeholder="In Präsentationen suchen" aria-label="In Präsentationen suchen" value="' + esc(q) + '"></div>' +
      (l.length ? '<div class="dok-gitter">' + l.map(s => { const f = A.fachInfo(s.fach); return '<a class="card dok-karte" href="#folien/' + s.id + '"><span class="dok-bild">' + (s.folien && s.folien[0] ? mini(s.folien[0], s.design, 200) : "") + "</span><b>" + esc(s.titel || "Präsentation") + '</b><small><span class="punkt" style="background:' + esc(f.farbe) + '"></span>' + esc(f.name) + " · " + (s.folien || []).length + " Folien · " + datum(s.geaendert) + "</small></a>"; }).join("") + "</div>"
        : '<div class="empty"><b>' + (q ? "Nichts gefunden" : "Noch keine Präsentationen") + "</b>" + (q ? "" : "Mach eine neue – oder lass die KI aus einer Heftseite Folien bauen.") + "</div>");
    el.querySelector("#neu").onclick = () => neu(A);
    const ah = el.querySelector("#ausHeft"); if (ah) ah.onclick = () => ausHeft(A);
    el.querySelector("#q").oninput = (e) => { q = e.target.value; const p = e.target.selectionStart; zeichnen(); const i = el.querySelector("#q"); i.focus(); i.setSelectionRange(p, p); };
    el.querySelector("#oeffnen").onchange = (e) => { const d = e.target.files[0]; if (d) Extras.importieren(A, d); };
    katexLaden().then(() => {});
  }
  zeichnen();
}

export function neu(A, fach = "") {
  const d = document.createElement("dialog"); d.className = "sheet breit";
  d.innerHTML = '<div class="sheet-in"><h2>🖥️ Neue Präsentation</h2><p class="muted">Such dir ein Design aus (kannst du später ändern):</p><div class="design-gitter">' +
    Object.entries(K.DESIGNS).map(([id, ds]) => { const f = K.neueFolie("titel"); f.el[0].html = "<p>" + esc(ds.name) + "</p>"; f.el[1].html = "<p>Aa Bb Cc</p>"; return '<button type="button" class="design-knopf" data-d="' + id + '">' + mini(f, id, 200) + "<span>" + esc(ds.name) + "</span></button>"; }).join("") +
    '</div><div class="sheet-foot"><button type="button" class="btn" id="ab">Abbrechen</button></div></div>';
  document.body.appendChild(d);
  d.querySelector("#ab").onclick = () => d.close();
  d.querySelectorAll("[data-d]").forEach(b => b.onclick = async () => {
    const s = await A.seiteNeu({ art: "folien", titel: "Neue Präsentation", fach, raster: "leer", design: b.dataset.d, folien: [K.neueFolie("titel"), K.neueFolie("inhalt")] });
    d.close(); A.gehe("folien/" + s.id);
  });
  d.addEventListener("close", () => d.remove());
  d.showModal();
}

// Aus einer Heftseite Folien machen (mit KI, sonst nach Überschriften und Absätzen)
export function ausHeft(A, vorgabe = null) {
  const seiten = A.aktiv().filter(s => (s.html || s.ocr || "").replace(/<[^>]+>/g, "").trim().length > 20).sort((a, b) => String(b.geaendert).localeCompare(String(a.geaendert)));
  if (!seiten.length) { KW.toast("Keine Heftseite mit Text gefunden."); return; }
  const d = document.createElement("dialog"); d.className = "sheet";
  d.innerHTML = '<div class="sheet-in"><h2>🤖 Folien aus Heftseite</h2><label class="feld"><span>Welche Seite?</span><select class="inp" id="hs">' +
    seiten.slice(0, 80).map(s => '<option value="' + s.id + '"' + (vorgabe === s.id ? " selected" : "") + ">" + esc((s.titel || "Ohne Titel") + (s.fach ? " · " + s.fach : "")) + "</option>").join("") + "</select></label>" +
    '<label class="feld"><span>Design</span><select class="inp" id="hd">' + Object.entries(K.DESIGNS).map(([id, ds]) => '<option value="' + id + '">' + esc(ds.name) + "</option>").join("") + "</select></label>" +
    '<p class="muted klein" id="hinfo">Die KI auf deinem Gerät fasst die Seite in Stichpunkten zusammen. Ohne KI werden Überschriften zu Folien.</p>' +
    '<div class="sheet-foot"><button type="button" class="btn" id="ab">Abbrechen</button><span class="sp"></span><button type="button" class="btn" id="ohne">Ohne KI</button><button type="button" class="btn primary" id="mit">🤖 Mit KI</button></div></div>';
  document.body.appendChild(d);
  d.querySelector("#ab").onclick = () => d.close();
  const bauen = async (mitKi) => {
    const quelle = A.seite(d.querySelector("#hs").value);
    const html = quelle.html || Editor.textZuHtml(quelle.ocr || "");
    let gl = null;
    if (mitKi) {
      d.querySelector("#hinfo").textContent = "🤖 Die KI denkt nach … (das kann eine Minute dauern)";
      d.querySelectorAll("button").forEach(b => b.disabled = true);
      try {
        const ohne = document.createElement("div"); ohne.innerHTML = html; ohne.querySelectorAll(".fussnoten, .quellen, sup.fn").forEach(n => n.remove());
        const antwort = await KI.fragen(A.einst.ki, { system: K.KI_ANWEISUNG, text: "Titel: " + (quelle.titel || "") + "\n\n" + Editor.htmlZuText(ohne.innerHTML).slice(0, 6000), json: true }, (p) => { d.querySelector("#hinfo").textContent = "🤖 KI lädt … " + (p && p.text ? p.text : ""); });
        gl = K.gliederungPruefen(KI.jsonAusText(antwort));
      } catch (e) { KW.toast(e.message === "keine-ki" ? "Keine KI eingerichtet – ich mache es ohne KI." : "Die KI hat nicht geklappt – ich mache es ohne KI."); }
    }
    if (!gl) gl = K.gliederungAusHtml(html, quelle.titel, (h) => { const x = document.createElement("div"); x.innerHTML = h; x.querySelectorAll(".fussnoten, .quellen, sup.fn, img").forEach(n => n.remove()); return x; });
    const s = await A.seiteNeu({ art: "folien", titel: quelle.titel || "Präsentation", fach: quelle.fach || "", raster: "leer", design: d.querySelector("#hd").value, folien: K.folienAusGliederung(gl) });
    s.text = textVon(s); await A.seiteSpeichern(s);
    d.close(); KW.toast("✓ " + s.folien.length + " Folien gebaut – prüf sie kurz."); A.gehe("folien/" + s.id);
  };
  d.querySelector("#ohne").onclick = () => bauen(false);
  d.querySelector("#mit").onclick = () => bauen(true);
  d.addEventListener("close", () => d.remove());
  d.showModal();
}

/* ---------- Editor ---------- */

export function seite(A, el, id) {
  const s = A.seite(id);
  if (!s || s.art !== "folien") { el.innerHTML = '<div class="empty"><b>Präsentation nicht gefunden</b><a class="btn" href="#folien">Zu den Präsentationen</a></div>'; return; }
  if (!Array.isArray(s.folien) || !s.folien.length) s.folien = [K.neueFolie("titel")];
  let fi = 0, gewaehlt = null, bearbText = null, speicherTimer = null, verlauf = [], wieder = [];
  const folie = () => s.folien[fi];
  const band = KW.load("kw-folien-band", "start");
  katexLaden().then(() => { if (document.body.contains(el)) { zeichneBuehne(); zeichneListe(); } });

  el.innerHTML =
    '<div class="seite-leiste fol-leiste" role="toolbar" aria-label="Präsentation">' +
      '<a class="btn small" href="#folien" aria-label="Zurück zu den Präsentationen">←</a>' +
      '<input class="inp titel-inp" id="titel" maxlength="100" aria-label="Titel" value="' + esc(s.titel) + '">' +
      '<select class="inp" id="fach" aria-label="Fach"><option value="">📥 Unsortiert</option>' + A.einst.faecher.map(f => "<option" + (f.name === s.fach ? " selected" : "") + ">" + esc(f.name) + "</option>").join("") + "</select>" +
      '<span class="sp"></span><button type="button" id="rueck" aria-label="Rückgängig" title="Rückgängig (Strg+Z)">↶</button><button type="button" id="vor" aria-label="Wiederholen" title="Wiederholen (Strg+Y)">↷</button>' +
      '<button type="button" class="btn primary small" id="zeigen" title="Vorführen (F5)">▶ Vorführen</button>' +
      '<button type="button" class="btn small" id="menueBtn" aria-haspopup="true" aria-expanded="false">⋯ Mehr</button>' +
    "</div>" +
    '<div class="seiten-menue card" id="menue" hidden>' +
      '<button type="button" data-a="ab1">▶ Ab Folie 1 vorführen</button><button type="button" data-a="pptx">📙 Als PowerPoint speichern (.pptx)</button><button type="button" data-a="druck">🖨️ Drucken / PDF</button>' +
      '<button type="button" data-a="teilen">📤 An Mitschüler schicken</button><button type="button" data-a="versionen">🕘 Ältere Versionen</button><button type="button" data-a="weg" class="rot">🗑️ In den Papierkorb</button>' +
    "</div>" +
    '<div class="unter-leiste fol-band" id="band">' +
      '<div class="band-reiter" role="tablist">' + [["start", "Start"], ["einfuegen", "Einfügen"], ["design", "Design"], ["uebergang", "Übergänge"], ["animation", "Animation"]].map(b => '<button type="button" role="tab" data-band="' + b[0] + '">' + b[1] + "</button>").join("") + "</div>" +
      '<div class="wort-leiste" data-band="' + esc(band) + '">' +
        '<span class="gruppe" data-gruppe="start">' +
          '<select id="neueFolie" aria-label="Neue Folie" title="Neue Folie"><option value="">＋ Neue Folie …</option>' + Object.entries(K.LAYOUTS).map(([k, l]) => '<option value="' + k + '">' + esc(l.name) + "</option>").join("") + "</select>" +
          '<button type="button" id="dupl" title="Folie verdoppeln">⧉ Doppeln</button><button type="button" id="folieWeg" title="Folie löschen">🗑 Folie</button><span class="trenn"></span>' +
          '<button type="button" data-c="bold" title="Fett" aria-label="Fett"><b>F</b></button><button type="button" data-c="italic" title="Kursiv" aria-label="Kursiv"><i>K</i></button><button type="button" data-c="underline" title="Unterstrichen" aria-label="Unterstrichen"><u>U</u></button>' +
          '<button type="button" id="kleiner" title="Schrift kleiner" aria-label="Schrift kleiner">A−</button><button type="button" id="groesser" title="Schrift größer" aria-label="Schrift größer">A+</button>' +
          '<label class="farb-knopf" title="Schriftfarbe"><span aria-hidden="true">A</span><input type="color" id="farbe" value="#c93a3a" aria-label="Schriftfarbe"></label>' +
          '<label class="farb-knopf fuell" title="Füllfarbe (Form/Textfeld)"><span aria-hidden="true">🪣</span><input type="color" id="fuell" value="#2f6fdb" aria-label="Füllfarbe"></label>' +
          '<button type="button" data-ausr="l" title="Links" aria-label="Links">⯇</button><button type="button" data-ausr="c" title="Mitte" aria-label="Mitte">≡</button><button type="button" data-ausr="r" title="Rechts" aria-label="Rechts">⯈</button>' +
          '<button type="button" data-c="insertUnorderedList" title="Aufzählung" aria-label="Aufzählung">•≡</button><button type="button" data-c="insertOrderedList" title="Nummerierung" aria-label="Nummerierung">1.</button>' +
          '<span class="trenn"></span><button type="button" id="vorne" title="Nach vorne">⬆ Vorne</button><button type="button" id="hinten" title="Nach hinten">⬇ Hinten</button><button type="button" id="elWeg" title="Element löschen (Entf)">✕ Element</button>' +
        "</span>" +
        '<span class="gruppe" data-gruppe="einfuegen">' +
          '<button type="button" id="tText">🔤 Textfeld</button><button type="button" id="tBild">🖼️ Bild</button>' +
          '<select id="tForm" aria-label="Form einfügen"><option value="">⬟ Form …</option>' + K.FORMEN.map(f => '<option value="' + f[0] + '">' + f[1] + "</option>").join("") + "</select>" +
          '<button type="button" id="tTab">⊞ Tabelle</button><button type="button" id="tFormel">∑ Formel</button>' +
          '<button type="button" id="tPlot" title="Funktionsgraph zeichnen">📈 Funktion</button><button type="button" id="tMind" title="Mindmap">🧠 Mindmap</button>' +
          (A.einst.f.folien && A.einst.f.folien.ki === false ? "" : '<button type="button" id="tKi" title="Folien aus Heftseite anhängen">🤖 Aus Heft</button>') +
        "</span>" +
        '<span class="gruppe" data-gruppe="design">' + Object.entries(K.DESIGNS).map(([k, d]) => '<button type="button" class="design-mini" data-design="' + k + '" title="' + esc(d.name) + '" style="background:linear-gradient(135deg,' + d.hg + " 55%," + d.akzent + ")\"><span style=\"color:" + d.titel + '">Aa</span></button>').join("") +
          '<span class="trenn"></span><label class="farb-knopf" title="Eigener Hintergrund für diese Folie"><span aria-hidden="true">🎨</span><input type="color" id="hg" value="#ffffff" aria-label="Hintergrund dieser Folie"></label><button type="button" id="hgWeg" title="Hintergrund vom Design">↺ Design-Hintergrund</button>' +
        "</span>" +
        '<span class="gruppe" data-gruppe="uebergang">' + UEBERGAENGE.map(u => '<button type="button" data-ueber="' + u[0] + '">' + u[1] + "</button>").join("") + '<span class="trenn"></span><button type="button" id="ueberAlle">Für alle Folien</button></span>' +
        '<span class="gruppe" data-gruppe="animation"><span class="muted klein">Element:</span><button type="button" data-anim="">Keine</button>' + ANIMATIONEN.map(a => '<button type="button" data-anim="' + a[0] + '">' + a[1] + "</button>").join("") + '<span class="muted klein" id="animInfo"></span></span>' +
      "</div>" +
    "</div>" +
    '<div class="fol-arbeit"><div class="fol-liste" id="liste" aria-label="Folien"></div>' +
      '<div class="fol-mitte"><div class="buehne-rahmen" id="rahmen"><div class="buehne" id="buehne"></div></div>' +
      '<label class="fol-notiz"><span>📝 Notizen für dich (sieht nur du beim Vorführen)</span><textarea class="inp" id="notiz" rows="2" placeholder="Was du zu dieser Folie sagen willst …"></textarea></label></div></div>' +
    '<input type="file" id="bildWahl" accept="image/*" hidden>';

  const buehne = el.querySelector("#buehne"), rahmen = el.querySelector("#rahmen"), leiste = el.querySelector("#band .wort-leiste");

  /* --- Band --- */
  const bandSetzen = (b) => { leiste.dataset.band = b; KW.save("kw-folien-band", b); leiste.querySelectorAll(".gruppe").forEach(g => g.hidden = g.dataset.gruppe !== b); el.querySelectorAll(".band-reiter [data-band]").forEach(x => { x.classList.toggle("an", x.dataset.band === b); x.setAttribute("aria-selected", x.dataset.band === b); }); bandZustand(); };
  el.querySelectorAll(".band-reiter [data-band]").forEach(b => b.onclick = () => bandSetzen(b.dataset.band));
  el.querySelectorAll("#band button").forEach(b => b.addEventListener("mousedown", e => e.preventDefault()));

  /* --- Speichern und Verlauf --- */
  function spaeter() { clearTimeout(speicherTimer); speicherTimer = setTimeout(() => { speicherTimer = null; s.text = textVon(s); A.seiteSpeichern(s); }, 700); }
  function sichern() { verlauf.push(JSON.stringify({ folien: s.folien, design: s.design })); if (verlauf.length > 60) verlauf.shift(); wieder = []; }
  function herstellen(json) { const d = JSON.parse(json); s.folien = d.folien; s.design = d.design; fi = Math.min(fi, s.folien.length - 1); gewaehlt = null; alles(); spaeter(); }
  const rueck = () => { textFertig(); if (!verlauf.length) return; wieder.push(JSON.stringify({ folien: s.folien, design: s.design })); herstellen(verlauf.pop()); };
  const vor = () => { if (!wieder.length) return; verlauf.push(JSON.stringify({ folien: s.folien, design: s.design })); herstellen(wieder.pop()); };
  el.querySelector("#rueck").onclick = rueck; el.querySelector("#vor").onclick = vor;
  el.querySelector("#titel").oninput = (e) => { s.titel = e.target.value; spaeter(); };
  el.querySelector("#fach").onchange = (e) => { s.fach = e.target.value; spaeter(); };

  /* --- Größe der Bühne --- */
  let k = 1;
  function skalieren() { const b = rahmen.clientWidth; k = b / K.W; buehne.style.transform = "scale(" + k + ")"; rahmen.style.height = Math.round(K.H * k) + "px"; }

  /* --- Zeichnen --- */
  function zeichneBuehne() {
    buehne.innerHTML = K.folieHtml(folie(), s.design, { bearbeiten: true, katex: katexHtml });
    el.querySelector("#notiz").value = folie().notiz || "";
    buehne.querySelectorAll("[data-bild-platz]").forEach(b => b.onclick = (e) => { e.stopPropagation(); gewaehlt = b.dataset.bildPlatz; bildWaehlen(); });
    auswahlZeigen();
  }
  function zeichneListe() {
    const l = el.querySelector("#liste");
    l.innerHTML = s.folien.map((f, i) => '<div class="fol-karte' + (i === fi ? " an" : "") + '" data-fi="' + i + '" draggable="true" tabindex="0" role="button" aria-label="Folie ' + (i + 1) + '"><span class="nr">' + (i + 1) + (f.ueber ? " ✦" : "") + "</span>" + mini(f, s.design, 150) + "</div>").join("") +
      '<button type="button" class="fol-plus" id="plusFolie" aria-label="Neue Folie">＋</button>';
    l.querySelectorAll("[data-fi]").forEach(c => {
      c.onclick = () => { textFertig(); fi = Number(c.dataset.fi); gewaehlt = null; alles(); };
      c.onkeydown = (e) => { if (e.key === "Enter") c.click(); if (e.key === "Delete") folieLoeschen(Number(c.dataset.fi)); };
      c.ondragstart = (e) => { e.dataTransfer.setData("text/plain", c.dataset.fi); };
      c.ondragover = (e) => e.preventDefault();
      c.ondrop = (e) => { e.preventDefault(); const von = Number(e.dataTransfer.getData("text/plain")), nach = Number(c.dataset.fi); if (von === nach || isNaN(von)) return; sichern(); const [f] = s.folien.splice(von, 1); s.folien.splice(nach, 0, f); fi = nach; alles(); spaeter(); };
    });
    l.querySelector("#plusFolie").onclick = () => folieNeu("inhalt");
  }
  function alles() { zeichneBuehne(); zeichneListe(); bandZustand(); }
  const liesteAktualisieren = () => { const c = el.querySelector('.fol-karte[data-fi="' + fi + '"]'); if (c) c.innerHTML = '<span class="nr">' + (fi + 1) + (folie().ueber ? " ✦" : "") + "</span>" + mini(folie(), s.design, 150); };

  /* --- Folien --- */
  function folieNeu(layout) { textFertig(); sichern(); s.folien.splice(fi + 1, 0, K.neueFolie(layout)); fi++; gewaehlt = null; alles(); spaeter(); const c = el.querySelector('.fol-karte[data-fi="' + fi + '"]'); if (c) c.scrollIntoView({ block: "nearest" }); }
  function folieLoeschen(i) { if (s.folien.length < 2) { KW.toast("Die letzte Folie bleibt."); return; } textFertig(); sichern(); s.folien.splice(i, 1); fi = Math.min(fi, s.folien.length - 1); gewaehlt = null; alles(); spaeter(); }
  el.querySelector("#neueFolie").onchange = (e) => { if (e.target.value) folieNeu(e.target.value); e.target.value = ""; };
  el.querySelector("#dupl").onclick = () => { textFertig(); sichern(); const kopie = JSON.parse(JSON.stringify(folie())); kopie.id = K.neueId(); kopie.el.forEach(x => x.id = K.neueId()); s.folien.splice(fi + 1, 0, kopie); fi++; alles(); spaeter(); };
  el.querySelector("#folieWeg").onclick = () => folieLoeschen(fi);
  el.querySelector("#notiz").oninput = (e) => { folie().notiz = e.target.value; spaeter(); };

  /* --- Elemente auswählen, verschieben, Größe ändern --- */
  const element = (eid) => folie().el.find(x => x.id === eid);
  function auswahlZeigen() {
    buehne.querySelectorAll(".griffe").forEach(g => g.remove());
    buehne.querySelectorAll(".el.gewaehlt").forEach(x => x.classList.remove("gewaehlt"));
    const e = gewaehlt && element(gewaehlt);
    if (!e) { gewaehlt = null; bandZustand(); return; }
    const d = buehne.querySelector('.el[data-id="' + e.id + '"]'); if (!d) return;
    d.classList.add("gewaehlt");
    const g = document.createElement("div"); g.className = "griffe"; g.style.cssText = "left:" + e.x + "px;top:" + e.y + "px;width:" + e.w + "px;height:" + e.h + "px;--k:" + (1 / k);
    g.innerHTML = ["nw", "n", "ne", "e", "se", "s", "sw", "w"].map(r => '<span class="gr gr-' + r + '" data-gr="' + r + '"></span>').join("");
    buehne.querySelector(".folie").appendChild(g);
    bandZustand();
  }
  function bandZustand() {
    const e = gewaehlt && element(gewaehlt);
    el.querySelectorAll("[data-ueber]").forEach(b => b.classList.toggle("an", (folie().ueber || "") === b.dataset.ueber));
    el.querySelectorAll("[data-design]").forEach(b => b.classList.toggle("an", (s.design || "klar") === b.dataset.design));
    el.querySelectorAll("[data-anim]").forEach(b => { b.disabled = !e; b.classList.toggle("an", !!e && (e.anim ? (e.animArt || "einblenden") === b.dataset.anim : b.dataset.anim === "")); });
    const info = el.querySelector("#animInfo"); info.textContent = e ? (e.anim ? "Erscheint als " + (folie().el.filter(x => x.anim).sort((a, b) => a.anim - b.anim).indexOf(e) + 1) + ". beim Klicken" : "") : "Erst ein Element antippen";
    el.querySelectorAll("[data-ausr]").forEach(b => b.classList.toggle("an", !!e && (e.ausr || "l") === b.dataset.ausr));
  }
  const punkt = (ev) => { const r = buehne.getBoundingClientRect(); return { x: (ev.clientX - r.left) / k, y: (ev.clientY - r.top) / k }; };
  buehne.addEventListener("pointerdown", (ev) => {
    if (ev.target.closest(".bild-platz")) return;
    const gr = ev.target.closest("[data-gr]"), d = ev.target.closest(".el");
    if (bearbText && d && d.dataset.id === bearbText) return; // im Text klicken
    textFertig();
    if (!gr && !d) { gewaehlt = null; auswahlZeigen(); return; }
    const e = gr ? element(gewaehlt) : element(d.dataset.id); if (!e) return;
    if (!gr && gewaehlt !== e.id) { gewaehlt = e.id; auswahlZeigen(); }
    ev.preventDefault();
    const start = punkt(ev), alt = { x: e.x, y: e.y, w: e.w, h: e.h }; let bewegt = false;
    const richt = gr ? gr.dataset.gr : null;
    const mv = (m) => {
      const p = punkt(m), dx = p.x - start.x, dy = p.y - start.y;
      if (!bewegt && Math.hypot(dx, dy) < 3) return;
      if (!bewegt) { sichern(); bewegt = true; }
      if (!richt) {
        let nx = Math.round(alt.x + dx), ny = Math.round(alt.y + dy);
        // An der Mitte und an den Rändern einrasten
        const mx = nx + e.w / 2, my = ny + e.h / 2;
        if (Math.abs(mx - K.W / 2) < 8) nx = Math.round(K.W / 2 - e.w / 2); if (Math.abs(my - K.H / 2) < 8) ny = Math.round(K.H / 2 - e.h / 2);
        if (Math.abs(nx - 60) < 6) nx = 60; if (Math.abs(ny - 36) < 6) ny = 36;
        e.x = nx; e.y = ny;
        hilfslinien(Math.abs(e.x + e.w / 2 - K.W / 2) < 1, Math.abs(e.y + e.h / 2 - K.H / 2) < 1);
      } else {
        let { x, y, w, h } = alt;
        if (richt.includes("e")) w = Math.max(20, alt.w + dx);
        if (richt.includes("s")) h = Math.max(16, alt.h + dy);
        if (richt.includes("w")) { w = Math.max(20, alt.w - dx); x = alt.x + alt.w - w; }
        if (richt.includes("n")) { h = Math.max(16, alt.h - dy); y = alt.y + alt.h - h; }
        if ((e.typ === "bild" || m.shiftKey) && richt.length === 2 && alt.h) { const v = alt.w / alt.h; if (w / h > v) w = h * v; else h = w / v; if (richt.includes("w")) x = alt.x + alt.w - w; if (richt.includes("n")) y = alt.y + alt.h - h; }
        Object.assign(e, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
      }
      const dom = buehne.querySelector('.el[data-id="' + e.id + '"]');
      if (dom) { dom.style.left = e.x + "px"; dom.style.top = e.y + "px"; dom.style.width = e.w + "px"; dom.style.height = e.h + "px"; if (e.typ === "form") dom.querySelector(".form-svg").outerHTML = K.formSvg(e); }
      const g = buehne.querySelector(".griffe"); if (g) { g.style.left = e.x + "px"; g.style.top = e.y + "px"; g.style.width = e.w + "px"; g.style.height = e.h + "px"; }
    };
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); hilfslinien(false, false); if (bewegt) { spaeter(); liesteAktualisieren(); } };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  });
  function hilfslinien(v, h) {
    buehne.querySelectorAll(".hilfslinie").forEach(x => x.remove());
    const f = buehne.querySelector(".folie"); if (!f) return;
    if (v) f.insertAdjacentHTML("beforeend", '<div class="hilfslinie senk"></div>');
    if (h) f.insertAdjacentHTML("beforeend", '<div class="hilfslinie waag"></div>');
  }
  // Doppelklick: Text bearbeiten (Textfelder, Formen) – Tabelle/Formel öffnen ihren Dialog
  buehne.addEventListener("dblclick", (ev) => {
    const d = ev.target.closest(".el"); if (!d) return;
    const e = element(d.dataset.id); if (!e) return;
    if (e.typ === "text" || (e.typ === "form" && e.art !== "linie")) textStart(e, d, ev);
    else if (e.typ === "tabelle") tabelleDialog(e);
    else if (e.typ === "formel") formelBearbeiten(e);
    else if (e.typ === "bild") { gewaehlt = e.id; bildWaehlen(); }
  });
  function textStart(e, d, ev) {
    gewaehlt = e.id; auswahlZeigen(); sichern();
    const inh = d.querySelector(".el-inhalt"); if (!inh) return;
    bearbText = e.id; d.classList.add("tippt");
    inh.contentEditable = "true"; inh.focus();
    try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (x) {}
    const r = ev && document.caretRangeFromPoint ? document.caretRangeFromPoint(ev.clientX, ev.clientY) : null;
    const sel = getSelection(); sel.removeAllRanges();
    if (r && inh.contains(r.startContainer)) sel.addRange(r); else { const rr = document.createRange(); rr.selectNodeContents(inh); sel.addRange(rr); }
    inh.oninput = () => { e.html = inh.innerHTML; spaeter(); };
    inh.onkeydown = (k2) => { if (k2.key === "Escape") { k2.preventDefault(); textFertig(); } };
    inh.onpaste = (p) => { const h = p.clipboardData && p.clipboardData.getData("text/html"); if (!h) return; p.preventDefault(); document.execCommand("insertHTML", false, Editor.saeubern(h)); };
  }
  function textFertig() {
    if (!bearbText) return;
    const d = buehne.querySelector('.el[data-id="' + bearbText + '"]'), e = element(bearbText);
    if (d) { const inh = d.querySelector(".el-inhalt"); if (inh) { inh.contentEditable = "false"; if (e) e.html = inh.innerHTML; } d.classList.remove("tippt"); }
    bearbText = null; liesteAktualisieren(); spaeter();
  }

  /* --- Text formatieren (im Textfeld oder ganzes Element) --- */
  el.querySelectorAll("[data-c]").forEach(b => b.onclick = () => {
    if (bearbText) { document.execCommand("styleWithCSS", false, true); document.execCommand(b.dataset.c); const e = element(bearbText), inh = buehne.querySelector('.el[data-id="' + bearbText + '"] .el-inhalt'); if (e && inh) { e.html = inh.innerHTML; spaeter(); } return; }
    const e = gewaehlt && element(gewaehlt); if (!e || !("html" in e)) { KW.toast("Erst ein Textfeld antippen."); return; }
    sichern(); const t = document.createElement("div"); t.innerHTML = e.html || "";
    if (b.dataset.c === "bold" || b.dataset.c === "italic" || b.dataset.c === "underline") { const tag = { bold: "b", italic: "i", underline: "u" }[b.dataset.c]; const schon = t.children.length && Array.from(t.querySelectorAll("p,li")).every(p => p.firstElementChild && p.firstElementChild.tagName.toLowerCase() === tag && p.firstElementChild.textContent === p.textContent); t.querySelectorAll("p,li").forEach(p => { if (schon) p.innerHTML = p.firstElementChild.innerHTML; else p.innerHTML = "<" + tag + ">" + p.innerHTML + "</" + tag + ">"; }); }
    else if (b.dataset.c === "insertUnorderedList" || b.dataset.c === "insertOrderedList") { const tag = b.dataset.c === "insertUnorderedList" ? "ul" : "ol"; const zeilen = Array.from(t.querySelectorAll("p,li")).map(p => p.innerHTML); const liste = t.querySelector(tag); t.innerHTML = liste && !t.querySelector("p") ? zeilen.map(z => "<p>" + z + "</p>").join("") : "<" + tag + ">" + zeilen.map(z => "<li>" + z + "</li>").join("") + "</" + tag + ">"; }
    e.html = t.innerHTML; zeichneBuehne(); liesteAktualisieren(); spaeter();
  });
  const groesseAendern = (f) => {
    const e = gewaehlt && element(gewaehlt); if (!e) return;
    sichern(); const g0 = e.groesse || (e.typ === "text" ? K.GROESSE[e.rolle] || K.GROESSE.frei : e.typ === "formel" ? 32 : e.typ === "tabelle" ? 18 : 22);
    e.groesse = Math.max(8, Math.min(120, Math.round(g0 * f))); if (bearbText) textFertig(); zeichneBuehne(); liesteAktualisieren(); spaeter();
  };
  el.querySelector("#kleiner").onclick = () => groesseAendern(1 / 1.15);
  el.querySelector("#groesser").onclick = () => groesseAendern(1.15);
  el.querySelector("#farbe").onchange = (ev) => {
    if (bearbText) { document.execCommand("styleWithCSS", false, true); document.execCommand("foreColor", false, ev.target.value); const e = element(bearbText), inh = buehne.querySelector('.el[data-id="' + bearbText + '"] .el-inhalt'); if (e && inh) { e.html = inh.innerHTML; spaeter(); } return; }
    const e = gewaehlt && element(gewaehlt); if (!e) return; sichern();
    if (e.typ === "form" && e.art === "linie") e.rand = ev.target.value; else e.farbe = ev.target.value;
    zeichneBuehne(); liesteAktualisieren(); spaeter();
  };
  el.querySelector("#fuell").onchange = (ev) => { const e = gewaehlt && element(gewaehlt); if (!e || !["form", "text"].includes(e.typ)) { KW.toast("Erst eine Form oder ein Textfeld antippen."); return; } sichern(); if (e.typ === "form" && e.art === "linie") e.rand = ev.target.value; else e.fuell = ev.target.value; textFertig(); zeichneBuehne(); liesteAktualisieren(); spaeter(); };
  el.querySelectorAll("[data-ausr]").forEach(b => b.onclick = () => { const e = gewaehlt && element(gewaehlt); if (!e) return; sichern(); e.ausr = b.dataset.ausr; textFertig(); zeichneBuehne(); liesteAktualisieren(); spaeter(); });
  const ebene = (d) => { const e = gewaehlt && element(gewaehlt); if (!e) return; sichern(); const l = folie().el, i = l.indexOf(e); l.splice(i, 1); if (d > 0) l.push(e); else l.unshift(e); zeichneBuehne(); liesteAktualisieren(); spaeter(); };
  el.querySelector("#vorne").onclick = () => ebene(1); el.querySelector("#hinten").onclick = () => ebene(-1);
  const elementWeg = () => { const e = gewaehlt && element(gewaehlt); if (!e) return; sichern(); folie().el = folie().el.filter(x => x !== e); gewaehlt = null; zeichneBuehne(); liesteAktualisieren(); spaeter(); };
  el.querySelector("#elWeg").onclick = elementWeg;

  /* --- Einfügen --- */
  function dazu(e) { textFertig(); sichern(); folie().el.push(e); gewaehlt = e.id; zeichneBuehne(); liesteAktualisieren(); spaeter(); return e; }
  el.querySelector("#tText").onclick = () => { const e = dazu({ id: K.neueId(), typ: "text", rolle: "frei", x: 280, y: 220, w: 400, h: 90, html: "<p>Text</p>" }); const d = buehne.querySelector('.el[data-id="' + e.id + '"]'); textStart(e, d); };
  el.querySelector("#tForm").onchange = (ev) => { const art = ev.target.value; ev.target.value = ""; if (!art) return; const d = K.design(s.design); dazu({ id: K.neueId(), typ: "form", art, x: 380, y: 190, w: art === "linie" ? 240 : 200, h: art === "linie" ? 20 : art === "pfeil" ? 100 : 160, fuell: art === "linie" ? "none" : d.akzent, rand: art === "linie" ? d.text : "none", randBreite: art === "linie" ? 4 : 0, html: "" }); };
  const bildDatei = el.querySelector("#bildWahl");
  function bildWaehlen() { bildDatei.value = ""; bildDatei.click(); }
  el.querySelector("#tBild").onclick = () => { gewaehlt = null; bildWaehlen(); };
  bildDatei.onchange = async () => {
    const f = bildDatei.files[0]; if (!f) return;
    const src = await bildVerkleinern(f); if (!src) { KW.toast("Dieses Bild konnte ich nicht öffnen."); return; }
    const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
    const platz = gewaehlt && element(gewaehlt);
    if (platz && platz.typ === "bild") { sichern(); platz.src = src; zeichneBuehne(); liesteAktualisieren(); spaeter(); return; }
    const v = img ? img.width / img.height : 4 / 3; let w = 480, h = w / v; if (h > 400) { h = 400; w = h * v; }
    dazu({ id: K.neueId(), typ: "bild", x: Math.round((K.W - w) / 2), y: Math.round((K.H - h) / 2 + 20), w: Math.round(w), h: Math.round(h), src });
  };
  el.querySelector("#tTab").onclick = () => tabelleDialog(null);
  el.querySelector("#tFormel").onclick = async () => { const tex = await Editor.formelDialog(""); if (tex) dazu({ id: K.neueId(), typ: "formel", tex, x: 280, y: 220, w: 400, h: 90, ausr: "c" }); };
  el.querySelector("#tPlot").onclick = async () => { const P = await import("./plotter.js"); const r = await P.dialog(); if (r) dazu({ id: K.neueId(), typ: "bild", x: 230, y: 110, w: 500, h: Math.round(500 * r.h / r.w), src: r.png, plot: r.daten }); };
  el.querySelector("#tMind").onclick = async () => { const M = await import("./mindmap.js"); const r = await M.dialog(); if (r) dazu({ id: K.neueId(), typ: "bild", x: 130, y: 70, w: 700, h: Math.round(700 * r.h / r.w), src: r.png, mindmap: r.daten }); };
  const tk = el.querySelector("#tKi"); if (tk) tk.onclick = () => ausHeft(A);
  async function formelBearbeiten(e) { const tex = await Editor.formelDialog(e.tex); if (tex) { sichern(); e.tex = tex; zeichneBuehne(); liesteAktualisieren(); spaeter(); } }
  function tabelleDialog(e) {
    const zeilen = e ? e.zeilen.map(r => r.slice()) : [["", "", ""], ["", "", ""], ["", "", ""]];
    const d = document.createElement("dialog"); d.className = "sheet breit";
    const zeichne = () => {
      d.innerHTML = '<div class="sheet-in"><h2>⊞ Tabelle</h2><div class="tab-dlg"><table>' + zeilen.map((r, i) => "<tr>" + r.map((c, j) => '<td><input class="inp" data-i="' + i + '" data-j="' + j + '" value="' + esc(c) + '" aria-label="Zeile ' + (i + 1) + " Spalte " + (j + 1) + '"></td>').join("") + "</tr>").join("") + "</table></div>" +
        '<div class="teilen-knoepfe"><button type="button" class="btn small" data-t="z+">+ Zeile</button><button type="button" class="btn small" data-t="z-">− Zeile</button><button type="button" class="btn small" data-t="s+">+ Spalte</button><button type="button" class="btn small" data-t="s-">− Spalte</button></div>' +
        '<label class="wahl-zeile"><input type="checkbox" id="kopf"' + (!e || e.kopf !== false ? " checked" : "") + '> <span>Erste Zeile als Kopfzeile</span></label>' +
        '<div class="sheet-foot"><button type="button" class="btn" id="ab">Abbrechen</button><button type="button" class="btn primary" id="ok">Fertig</button></div></div>';
      d.querySelectorAll("[data-i]").forEach(i => i.oninput = () => { zeilen[i.dataset.i][i.dataset.j] = i.value; });
      d.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { const t = b.dataset.t; if (t === "z+") zeilen.push(zeilen[0].map(() => "")); if (t === "z-" && zeilen.length > 1) zeilen.pop(); if (t === "s+") zeilen.forEach(r => r.push("")); if (t === "s-" && zeilen[0].length > 1) zeilen.forEach(r => r.pop()); zeichne(); });
      d.querySelector("#ab").onclick = () => d.close();
      d.querySelector("#ok").onclick = () => {
        const kopf = d.querySelector("#kopf").checked;
        if (e) { sichern(); e.zeilen = zeilen; e.kopf = kopf; e.h = Math.max(e.h, zeilen.length * 40); zeichneBuehne(); liesteAktualisieren(); spaeter(); }
        else dazu({ id: K.neueId(), typ: "tabelle", zeilen, kopf, x: 120, y: 140, w: 720, h: Math.min(380, zeilen.length * 46) });
        d.close();
      };
    };
    zeichne(); document.body.appendChild(d); d.addEventListener("close", () => d.remove()); d.showModal();
  }

  /* --- Design, Übergänge, Animation --- */
  el.querySelectorAll("[data-design]").forEach(b => b.onclick = () => { sichern(); s.design = b.dataset.design; alles(); spaeter(); });
  el.querySelector("#hg").onchange = (e) => { sichern(); folie().hg = e.target.value; zeichneBuehne(); liesteAktualisieren(); spaeter(); };
  el.querySelector("#hgWeg").onclick = () => { sichern(); delete folie().hg; zeichneBuehne(); liesteAktualisieren(); spaeter(); };
  el.querySelectorAll("[data-ueber]").forEach(b => b.onclick = () => { sichern(); folie().ueber = b.dataset.ueber; zeichneListe(); bandZustand(); spaeter(); if (b.dataset.ueber) vorschauUebergang(b.dataset.ueber); });
  el.querySelector("#ueberAlle").onclick = () => { sichern(); s.folien.forEach(f => f.ueber = folie().ueber || ""); zeichneListe(); spaeter(); KW.toast("Übergang für alle Folien gesetzt."); };
  function vorschauUebergang(u) { const f = buehne.querySelector(".folie"); if (!f) return; f.classList.remove("ueber-" + u); void f.offsetWidth; f.classList.add("ueber-" + u); }
  el.querySelectorAll("[data-anim]").forEach(b => b.onclick = () => {
    const e = gewaehlt && element(gewaehlt); if (!e) return; sichern();
    if (!b.dataset.anim) { delete e.anim; delete e.animArt; }
    else { if (!e.anim) e.anim = Math.max(0, ...folie().el.map(x => x.anim || 0)) + 1; e.animArt = b.dataset.anim; }
    // Nummern lückenlos halten
    folie().el.filter(x => x.anim).sort((a, c) => a.anim - c.anim).forEach((x, i) => x.anim = i + 1);
    zeichneBuehne(); spaeter();
    if (e.anim) { const d = buehne.querySelector('.el[data-id="' + e.id + '"]'); if (d) { d.classList.add("anim-" + e.animArt); setTimeout(() => d.classList.remove("anim-" + e.animArt), 900); } }
  });

  /* --- Tastatur --- */
  const tasten = (ev) => {
    if (!document.body.contains(el)) return;
    if (ev.target.closest && ev.target.closest("input, textarea, select, dialog, [contenteditable=true]")) return;
    const st = ev.ctrlKey || ev.metaKey;
    if (ev.key === "F5") { ev.preventDefault(); vorfuehren(A, s, ev.shiftKey ? fi : 0); return; }
    if (st && ev.key.toLowerCase() === "z") { ev.preventDefault(); ev.shiftKey ? vor() : rueck(); return; }
    if (st && ev.key.toLowerCase() === "y") { ev.preventDefault(); vor(); return; }
    const e = gewaehlt && element(gewaehlt);
    if (st && ev.key.toLowerCase() === "d" && e) { ev.preventDefault(); const kopie = JSON.parse(JSON.stringify(e)); kopie.id = K.neueId(); kopie.x += 20; kopie.y += 20; delete kopie.anim; dazu(kopie); return; }
    if (!e) { if (ev.key === "PageDown" || ev.key === "ArrowDown") { fi = Math.min(s.folien.length - 1, fi + 1); alles(); } if (ev.key === "PageUp" || ev.key === "ArrowUp") { fi = Math.max(0, fi - 1); alles(); } return; }
    if (ev.key === "Delete" || ev.key === "Backspace") { ev.preventDefault(); elementWeg(); return; }
    if (ev.key === "Enter" && (e.typ === "text" || e.typ === "form")) { ev.preventDefault(); textStart(e, buehne.querySelector('.el[data-id="' + e.id + '"]')); return; }
    if (ev.key === "Escape") { gewaehlt = null; auswahlZeigen(); return; }
    const pf = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
    if (pf) { ev.preventDefault(); sichern(); const n = ev.shiftKey ? 10 : 2; e.x += pf[0] * n; e.y += pf[1] * n; zeichneBuehne(); spaeter(); }
  };
  document.addEventListener("keydown", tasten);

  /* --- Menü --- */
  const menue = el.querySelector("#menue"), mb = el.querySelector("#menueBtn");
  mb.onclick = (e) => { e.stopPropagation(); menue.hidden = !menue.hidden; mb.setAttribute("aria-expanded", !menue.hidden); };
  const zu = (e) => { if (!menue.contains(e.target) && e.target !== mb) { menue.hidden = true; mb.setAttribute("aria-expanded", "false"); } };
  document.addEventListener("click", zu);
  el.querySelector("#zeigen").onclick = () => { textFertig(); vorfuehren(A, s, fi); };
  menue.onclick = async (e) => {
    const a = e.target.closest("[data-a]"); if (!a) return; menue.hidden = true; textFertig();
    const w = a.dataset.a;
    if (w === "ab1") vorfuehren(A, s, 0);
    if (w === "pptx") { try { KW.toast("PowerPoint-Datei wird gebaut …"); const P = await import("./pptx.js"); herunterladen(await P.alsPptx(A, s), (s.titel || "Präsentation").replace(/[\\/:*?"<>|]/g, "").slice(0, 60) + ".pptx"); KW.toast("✓ PowerPoint-Datei gespeichert."); } catch (err) { console.error(err); KW.toast("Speichern hat nicht geklappt."); } }
    if (w === "druck") drucken(s);
    if (w === "teilen") Extras.teilen(A, s);
    if (w === "versionen") Extras.versionen(A, s, () => A.zeigen());
    if (w === "weg") { await A.seiteLoeschen(s.id); KW.toast("In den Papierkorb gelegt.", "Rückgängig", async () => { await A.seiteWiederherstellen(s.id); A.gehe("folien/" + s.id); }); A.gehe("folien"); }
  };

  const ro = new ResizeObserver(() => { skalieren(); auswahlZeigen(); });
  ro.observe(rahmen);
  bandSetzen(band);
  skalieren(); alles();
  Extras.versionMerken(A, s);
  return () => { ro.disconnect(); document.removeEventListener("keydown", tasten); document.removeEventListener("click", zu); textFertig(); if (speicherTimer) { clearTimeout(speicherTimer); s.text = textVon(s); A.seiteSpeichern(s); } Extras.versionMerken(A, s); };
}

// Bilder klein halten (Folien werden mit abgeglichen)
function bildVerkleinern(datei, max = 1600) {
  return new Promise(ok => {
    const u = URL.createObjectURL(datei), i = new Image();
    i.onload = () => { const f = Math.min(1, max / Math.max(i.width, i.height)), c = document.createElement("canvas"); c.width = Math.round(i.width * f); c.height = Math.round(i.height * f); c.getContext("2d").drawImage(i, 0, 0, c.width, c.height); URL.revokeObjectURL(u); ok(datei.type === "image/png" && datei.size < 600000 ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.85)); };
    i.onerror = () => { URL.revokeObjectURL(u); ok(null); };
    i.src = u;
  });
}

/* ---------- Vorführen ---------- */

export function vorfuehren(A, s, start = 0) {
  let fi = start, schritt = 0, stiftAn = false, laserAn = false, notizAn = false;
  const beginn = Date.now();
  const erlaubt = !(A.einst.f.folien && A.einst.f.folien.laser === false);
  const v = document.createElement("div"); v.className = "vorfuehrung"; v.tabIndex = -1;
  v.innerHTML = '<div class="v-buehne" id="vb"></div><canvas class="v-stift" id="vs"></canvas><div class="v-laser" id="vl" hidden></div>' +
    '<div class="v-leiste" id="vleiste"><button type="button" data-v="zurueck" aria-label="Zurück">◀</button><span id="vnr"></span><button type="button" data-v="weiter" aria-label="Weiter">▶</button>' +
    (erlaubt ? '<button type="button" data-v="stift" aria-label="Stift" title="Stift (P)">✏️</button><button type="button" data-v="laser" aria-label="Laserpointer" title="Laserpointer (L)">🔴</button><button type="button" data-v="leeren" aria-label="Gemaltes löschen" title="Gemaltes löschen (E)">🧽</button>' : "") +
    '<button type="button" data-v="notiz" aria-label="Notizen und Timer" title="Notizen und Timer (N)">📝</button><button type="button" data-v="ende" aria-label="Beenden" title="Beenden (Esc)">✕</button></div>' +
    '<div class="v-notiz" id="vn" hidden><div class="v-zeit" id="vz">0:00</div><div id="vnt"></div><div class="v-naechste" id="vnext"></div></div>';
  document.body.appendChild(v);
  const vb = v.querySelector("#vb"), canvas = v.querySelector("#vs"), g = canvas.getContext("2d"), laser = v.querySelector("#vl");
  if (v.requestFullscreen) v.requestFullscreen().catch(() => {});
  const anzahlSchritte = (f) => f.el.filter(e => e.anim).length;
  let k = 1;
  function groesse() {
    const bw = window.innerWidth, bh = window.innerHeight; k = Math.min(bw / K.W, bh / K.H);
    vb.style.transform = "translate(" + ((bw - K.W * k) / 2) + "px," + ((bh - K.H * k) / 2) + "px) scale(" + k + ")";
    canvas.width = bw * devicePixelRatio; canvas.height = bh * devicePixelRatio; canvas.style.width = bw + "px"; canvas.style.height = bh + "px";
    g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }
  function zeigen(neu, uebergang) {
    vb.innerHTML = K.folieHtml(s.folien[fi], s.design, { schritt, neu, katex: katexHtml });
    const f = vb.querySelector(".folie");
    if (uebergang && s.folien[fi].ueber) f.classList.add("ueber-" + s.folien[fi].ueber);
    v.querySelector("#vnr").textContent = (fi + 1) + " / " + s.folien.length;
    v.querySelector("#vnt").textContent = s.folien[fi].notiz || "(keine Notizen zu dieser Folie)";
    const n = s.folien[fi + 1]; v.querySelector("#vnext").textContent = n ? "Als Nächstes: " + (n.el.find(e => e.rolle === "titel") ? Editor.htmlZuText(n.el.find(e => e.rolle === "titel").html) : "Folie " + (fi + 2)) : "Letzte Folie";
  }
  function weiter() {
    if (schritt < anzahlSchritte(s.folien[fi])) { schritt++; zeigen(true, false); return; }
    if (fi < s.folien.length - 1) { fi++; schritt = 0; leeren(); zeigen(false, true); return; }
    vb.innerHTML = '<div class="folie v-ende"><p>Ende der Präsentation</p><small>Tippen oder Esc zum Beenden</small></div>'; fi = s.folien.length;
  }
  function zurueck() {
    if (fi >= s.folien.length) { fi = s.folien.length - 1; schritt = anzahlSchritte(s.folien[fi]); zeigen(false, false); return; }
    if (schritt > 0) { schritt--; zeigen(false, false); return; }
    if (fi > 0) { fi--; schritt = anzahlSchritte(s.folien[fi]); leeren(); zeigen(false, false); }
  }
  function leeren() { g.clearRect(0, 0, canvas.width, canvas.height); }
  function ende() { clearInterval(uhr); document.removeEventListener("keydown", taste); window.removeEventListener("resize", groesse); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); v.remove(); }
  const taste = (e) => {
    if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); if (fi >= s.folien.length) ende(); else weiter(); }
    else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); zurueck(); }
    else if (e.key === "Escape") ende();
    else if (e.key === "Home") { fi = 0; schritt = 0; leeren(); zeigen(false, false); }
    else if (e.key === "End") { fi = s.folien.length - 1; schritt = anzahlSchritte(s.folien[fi]); leeren(); zeigen(false, false); }
    else if (erlaubt && e.key.toLowerCase() === "p") knopf("stift");
    else if (erlaubt && e.key.toLowerCase() === "l") knopf("laser");
    else if (erlaubt && e.key.toLowerCase() === "e") leeren();
    else if (e.key.toLowerCase() === "n") knopf("notiz");
    else if (e.key.toLowerCase() === "b") { vb.style.visibility = vb.style.visibility === "hidden" ? "" : "hidden"; }
  };
  document.addEventListener("keydown", taste);
  window.addEventListener("resize", groesse);
  function knopf(w) {
    if (w === "weiter") { if (fi >= s.folien.length) ende(); else weiter(); }
    if (w === "zurueck") zurueck();
    if (w === "ende") ende();
    if (w === "leeren") leeren();
    if (w === "stift") { stiftAn = !stiftAn; laserAn = false; }
    if (w === "laser") { laserAn = !laserAn; stiftAn = false; }
    if (w === "notiz") { notizAn = !notizAn; v.querySelector("#vn").hidden = !notizAn; }
    v.classList.toggle("stift", stiftAn); v.classList.toggle("laser", laserAn); laser.hidden = !laserAn;
    v.querySelectorAll("[data-v]").forEach(b => b.classList.toggle("an", (b.dataset.v === "stift" && stiftAn) || (b.dataset.v === "laser" && laserAn) || (b.dataset.v === "notiz" && notizAn)));
  }
  v.querySelector("#vleiste").onclick = (e) => { const b = e.target.closest("[data-v]"); if (b) { e.stopPropagation(); knopf(b.dataset.v); } };
  // Klicken = weiter, Stift = malen, Laser = roter Punkt
  let malt = false, letzter = null, tippStart = null;
  canvas.addEventListener("pointerdown", (e) => {
    if (stiftAn) { malt = true; canvas.setPointerCapture(e.pointerId); letzter = [e.clientX, e.clientY]; g.strokeStyle = "#e5262b"; g.lineWidth = 4; g.lineCap = "round"; g.beginPath(); g.arc(e.clientX, e.clientY, 2, 0, 7); g.fillStyle = "#e5262b"; g.fill(); return; }
    tippStart = { x: e.clientX, t: Date.now() };
  });
  canvas.addEventListener("pointermove", (e) => {
    if (laserAn) { laser.style.left = e.clientX + "px"; laser.style.top = e.clientY + "px"; }
    if (malt) { g.beginPath(); g.moveTo(letzter[0], letzter[1]); g.lineTo(e.clientX, e.clientY); g.stroke(); letzter = [e.clientX, e.clientY]; }
  });
  canvas.addEventListener("pointerup", (e) => {
    if (malt) { malt = false; return; }
    if (laserAn || !tippStart) return;
    const dx = e.clientX - tippStart.x; tippStart = null;
    if (Math.abs(dx) > 60) { dx < 0 ? weiter() : zurueck(); return; } // wischen
    if (fi >= s.folien.length) { ende(); return; }
    e.clientX < window.innerWidth * 0.25 ? zurueck() : weiter();
  });
  const uhr = setInterval(() => { const sek = Math.floor((Date.now() - beginn) / 1000); v.querySelector("#vz").textContent = Math.floor(sek / 60) + ":" + String(sek % 60).padStart(2, "0"); }, 1000);
  groesse(); zeigen(false, true); v.focus();
}

/* ---------- Drucken / PDF ---------- */

function drucken(s) {
  const alt = document.getElementById("druck"); if (alt) alt.remove();
  const box = document.createElement("div"); box.id = "druck";
  box.innerHTML = s.folien.map(f => '<div class="druck-folie"><div class="druck-folie-innen">' + K.folieHtml(f, s.design, { katex: katexHtml }) + "</div></div>").join("");
  document.body.appendChild(box); document.body.classList.add("druckt");
  const fertig = () => { document.body.classList.remove("druckt"); box.remove(); window.removeEventListener("afterprint", fertig); };
  window.addEventListener("afterprint", fertig);
  setTimeout(() => window.print(), 300);
}
