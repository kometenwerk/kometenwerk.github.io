// FIDELIA Notizen · Tabellen (wie Excel)
// Zellen mit Formeln, Formaten, Sortieren, Filtern, Fixieren, Ausfüllen, Diagrammen, Vorlagen,
// Excel/CSV speichern und öffnen, Drucken. Gespeichert wie eine Heftseite (art: "tabelle"), damit
// Fächer, Suche, Papierkorb, Sicherung und Geräte-Abgleich automatisch mitgehen.

import * as F from "./formel.js";
import * as D from "./diagramm.js";
import * as X from "./xlsx.js";
import * as Rg from "./tabellen-regeln.js";
import * as KI from "./ki.js";
import * as Extras from "./extras.js";
import { herunterladen } from "./export.js";

const KW = window.KW, esc = KW.esc;
const FFLATE = "../shared/vendor/fflate-0.8.3/fflate.mjs";
const BREITE = 96, ZAHL_BREITE = 46;
const datum = (iso) => { try { return new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "short" }); } catch (e) { return ""; } };
const neuesBlatt = (name) => ({ name, zellen: {}, spalten: {}, fix: { z: 0, s: 0 }, diagramme: [] });

/* ---------- Vorlagen ---------- */

function vorlage(id, A) {
  const z = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" ? { v } : v]));
  const kopf = (t) => ({ v: t, f: { b: 1, bg: "#eef2f8", rahmen: 1 } });
  if (id === "noten") {
    const faecher = (A.einst.faecher || []).map(f => f.name).slice(0, 8);
    const liste = faecher.length ? faecher : ["Deutsch", "Mathe", "Englisch", "Biologie", "Geschichte", "Sport"];
    const zellen = z({ A1: kopf("Fach"), B1: kopf("Schnitt"), C1: kopf("Note 1"), D1: kopf("Note 2"), E1: kopf("Note 3"), F1: kopf("Note 4") });
    liste.forEach((f, i) => { const r = i + 2; zellen["A" + r] = { v: f }; zellen["B" + r] = { v: "=WENNFEHLER(MITTELWERT(C" + r + ":F" + r + ");\"\")", f: { stellen: 2, b: 1 } }; });
    const n = liste.length + 2;
    zellen["A" + n] = { v: "Gesamt", f: { b: 1 } }; zellen["B" + n] = { v: "=WENNFEHLER(MITTELWERT(B2:B" + (n - 1) + ");\"\")", f: { stellen: 2, b: 1, bg: "#fff176" } };
    return { titel: "Notenrechner", blaetter: [Object.assign(neuesBlatt("Noten"), { zellen, spalten: { A: 130 }, fix: { z: 1, s: 0 }, diagramme: [{ id: KW.id(), art: "saeule", bereich: "A1:B" + (n - 1), titel: "Mein Schnitt pro Fach" }] })] };
  }
  if (id === "geld") {
    const zellen = z({ A1: kopf("Datum"), B1: kopf("Was"), C1: kopf("Kategorie"), D1: kopf("Einnahme"), E1: kopf("Ausgabe"), F1: kopf("Kontostand"),
      A2: new Date().toLocaleDateString("de-DE"), B2: "Taschengeld", C2: "Taschengeld", D2: { v: "20", f: { format: "eur" } }, F2: { v: "=D2-E2", f: { format: "eur", b: 1 } },
      H1: kopf("Kategorie"), I1: kopf("Ausgegeben"), H2: "Essen", H3: "Freizeit", H4: "Sachen", H5: "Sonstiges" });
    for (let r = 3; r <= 40; r++) zellen["F" + r] = { v: '=WENN(ANZAHL2(A' + r + ':E' + r + ')=0;"";F' + (r - 1) + "+D" + r + "-E" + r + ")", f: { format: "eur" } };
    for (let r = 2; r <= 5; r++) zellen["I" + r] = { v: "=SUMMEWENN(C2:C40;H" + r + ";E2:E40)", f: { format: "eur" } };
    for (let r = 2; r <= 40; r++) { zellen["D" + r] = zellen["D" + r] || { v: "", f: { format: "eur" } }; zellen["E" + r] = { v: "", f: { format: "eur" } }; }
    return { titel: "Taschengeld", blaetter: [Object.assign(neuesBlatt("Geld"), { zellen, spalten: { B: 140, C: 110, H: 110, I: 110 }, fix: { z: 1, s: 0 }, diagramme: [{ id: KW.id(), art: "kreis", bereich: "H1:I5", titel: "Wofür geht mein Geld weg?" }] })] };
  }
  if (id === "messung") {
    const zellen = z({ A1: { v: "Versuch: ", f: { b: 1, groesse: 14 } }, A3: kopf("Zeit t in s"), B3: kopf("Weg s in m"), C3: kopf("v in m/s") });
    for (let r = 4; r <= 13; r++) { zellen["A" + r] = { v: String(r - 4) }; zellen["C" + r] = { v: '=WENN(ODER(B' + r + '="";A' + r + "=0);\"\";B" + r + "/A" + r + ")", f: { stellen: 2 } }; }
    zellen.A15 = { v: "Mittelwert v", f: { b: 1 } }; zellen.C15 = { v: "=WENNFEHLER(MITTELWERT(C4:C13);\"\")", f: { stellen: 2, b: 1 } };
    return { titel: "Messwerte", blaetter: [Object.assign(neuesBlatt("Messung"), { zellen, spalten: { A: 110, B: 110, C: 110 }, diagramme: [{ id: KW.id(), art: "linie", bereich: "A3:B13", titel: "Weg-Zeit-Diagramm" }] })] };
  }
  if (id === "vokabeln") {
    const zellen = z({ A1: kopf("Deutsch"), B1: kopf("Englisch"), C1: kopf("Kann ich (x)"), E1: kopf("Gelernt"), E2: { v: '=ZÄHLENWENN(C2:C100;"x")&" von "&ANZAHL2(A2:A100)', f: { b: 1 } } });
    return { titel: "Vokabeln", blaetter: [Object.assign(neuesBlatt("Vokabeln"), { zellen, spalten: { A: 160, B: 160, C: 100, E: 120 }, fix: { z: 1, s: 0 } })] };
  }
  if (id === "hausaufgaben") {
    const zellen = z({ A1: kopf("Fach"), B1: kopf("Aufgabe"), C1: kopf("Bis"), D1: kopf("Status") });
    for (let r = 2; r <= 30; r++) zellen["C" + r] = { v: "", f: { format: "datum" } };
    return { titel: "Hausaufgaben", blaetter: [Object.assign(neuesBlatt("Hausaufgaben"), { zellen, spalten: { A: 110, B: 260, C: 100, D: 110 }, fix: { z: 1, s: 0 },
      auswahl: [{ bereich: "D2:D30", werte: ["offen", "angefangen", "erledigt"] }, { bereich: "A2:A30", werte: (A.einst.faecher || []).map(f => f.name).slice(0, 20).concat((A.einst.faecher || []).length ? [] : ["Deutsch", "Mathe", "Englisch"]) }],
      regeln: [{ id: KW.id(), bereich: "D2:D30", art: "gleich", wert: "erledigt", farbe: "#c8e6c9", schrift: "#1b5e20" }, { id: KW.id(), bereich: "D2:D30", art: "gleich", wert: "offen", farbe: "#ffcdd2", schrift: "#b71c1c" }] })] };
  }
  if (id === "reaktion") {
    const zellen = z({ A1: { v: "Reaktionstest", f: { b: 1, groesse: 14 } }, A3: kopf("Versuch"), B3: kopf("Proband 1 (ms)"), C3: kopf("Proband 2 (ms)"), D3: kopf("Proband 3 (ms)") });
    for (let r = 4; r <= 13; r++) zellen["A" + r] = { v: String(r - 3) };
    return { titel: "Reaktionszeiten", blaetter: [Object.assign(neuesBlatt("Messung"), { zellen, spalten: { A: 90, B: 130, C: 130, D: 130 }, fix: { z: 3, s: 0 }, regeln: [{ id: KW.id(), bereich: "B4:D13", art: "skala", umkehren: true }], diagramme: [{ id: KW.id(), art: "saeule", bereich: "A3:D13", titel: "Reaktionszeit pro Versuch" }] })] };
  }
  if (id === "stundenplan") {
    const tage = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"], zellen = z({ A1: kopf("Stunde") });
    tage.forEach((t, i) => { zellen[F.zelleName(0, i + 1)] = kopf(t); });
    for (let r = 2; r <= 11; r++) zellen["A" + r] = { v: String(r - 1) + ".", f: { b: 1, ausr: "c" } };
    return { titel: "Stundenplan", blaetter: [Object.assign(neuesBlatt("Stundenplan"), { zellen, spalten: { A: 70, B: 120, C: 120, D: 120, E: 120, F: 120 }, fix: { z: 1, s: 1 }, auswahl: [{ bereich: "B2:F11", werte: (A.einst.faecher || []).map(f => f.name).slice(0, 25).concat("Pause") }] })] };
  }
  return { titel: "Neue Tabelle", blaetter: [neuesBlatt("Blatt1")] };
}
const VORLAGEN = [["leer", "📄", "Leere Tabelle"], ["noten", "🎓", "Notenrechner"], ["geld", "💶", "Taschengeld"], ["messung", "🔬", "Messwerte (NWT/Physik)"], ["reaktion", "⏱️", "Reaktionszeiten"], ["vokabeln", "🔤", "Vokabel-Liste"], ["hausaufgaben", "📝", "Hausaufgaben-Liste"], ["stundenplan", "🗓️", "Stundenplan"]];

export function textVon(mappe) {
  return mappe.blaetter.map(b => Object.values(b.zellen).map(c => c && typeof c.v === "string" && c.v[0] !== "=" ? c.v : "").filter(Boolean).join(" ")).join(" ").slice(0, 4000);
}

/* ---------- Liste ---------- */

export function liste(A, el) {
  const alle = () => A.aktiv("tabelle").sort((a, b) => String(b.geaendert).localeCompare(String(a.geaendert)));
  let q = "";
  function zeichnen() {
    const l = alle().filter(s => !q || A.seitenText(s).toLowerCase().includes(q.toLowerCase()));
    el.innerHTML = '<div class="kopfzeile"><h2 class="titel">📊 Tabellen</h2><span class="sp"></span>' +
      '<label class="btn small" title="Excel- oder CSV-Datei öffnen">📥 Öffnen<input type="file" id="oeffnen" accept=".xlsx,.csv,.txt,.fidelia,.json" hidden></label>' +
      '<button type="button" class="btn primary" id="neu">+ Neue Tabelle</button></div>' +
      '<div class="suche"><input class="inp" type="search" id="q" placeholder="In Tabellen suchen" aria-label="In Tabellen suchen" value="' + esc(q) + '"></div>' +
      (l.length ? '<div class="dok-gitter">' + l.map(s => {
        const f = A.fachInfo(s.fach);
        return '<a class="card dok-karte" href="#tabelle/' + s.id + '"><span class="dok-bild tab-bild">' + vorschau(s) + '</span><b>' + esc(s.titel || "Tabelle") + '</b><small><span class="punkt" style="background:' + esc(f.farbe) + '"></span>' + esc(f.name) + " · " + datum(s.geaendert) + "</small></a>";
      }).join("") + "</div>" : '<div class="empty"><b>' + (q ? "Nichts gefunden" : "Noch keine Tabellen") + "</b>" + (q ? "" : "Tipp auf „+ Neue Tabelle“ – es gibt fertige Vorlagen wie den Notenrechner.") + "</div>");
    el.querySelector("#neu").onclick = () => neu(A);
    el.querySelector("#q").oninput = (e) => { q = e.target.value; const p = e.target.selectionStart; zeichnen(); const i = el.querySelector("#q"); i.focus(); i.setSelectionRange(p, p); };
    el.querySelector("#oeffnen").onchange = async (e) => { const d = e.target.files[0]; if (d) await oeffnen(A, d); };
  }
  zeichnen();
}

export function vorschau(s) {
  const b = s.mappe && s.mappe.blaetter[0]; if (!b) return "";
  let h = "<table>";
  for (let z = 0; z < 5; z++) { h += "<tr>"; for (let sp = 0; sp < 4; sp++) { const c = b.zellen[F.zelleName(z, sp)]; h += "<td" + (c && c.f && c.f.bg ? ' style="background:' + esc(c.f.bg) + '"' : "") + ">" + esc(c && typeof c.v === "string" && c.v[0] !== "=" ? c.v.slice(0, 10) : c && c.v ? "ƒ" : "") + "</td>"; } h += "</tr>"; }
  return h + "</table>";
}

export function neu(A, fach = "") {
  const d = document.createElement("dialog"); d.className = "sheet";
  d.innerHTML = '<div class="sheet-in"><h2>📊 Neue Tabelle</h2><div class="vorlagen-gitter">' + VORLAGEN.map(v => '<button type="button" class="card vorlage-knopf" data-v="' + v[0] + '"><span class="gross">' + v[1] + "</span>" + v[2] + "</button>").join("") + '</div><div class="sheet-foot"><button type="button" class="btn" id="ab">Abbrechen</button></div></div>';
  document.body.appendChild(d);
  d.querySelector("#ab").onclick = () => d.close();
  d.querySelectorAll("[data-v]").forEach(b => b.onclick = async () => {
    const v = vorlage(b.dataset.v, A);
    const s = await A.seiteNeu({ art: "tabelle", titel: v.titel, fach, raster: "leer", mappe: { blaetter: v.blaetter } });
    s.text = textVon(s.mappe); d.close(); A.gehe("tabelle/" + s.id);
  });
  d.addEventListener("close", () => d.remove());
  d.showModal();
}

export async function oeffnen(A, datei) {
  const name = datei.name.replace(/\.[^.]+$/, "");
  try {
    if (/\.(fidelia|json)$/i.test(datei.name)) { await Extras.importieren(A, datei); return; }
    let mappe;
    if (/\.xlsx$/i.test(datei.name)) { const fflate = await import(FFLATE); mappe = X.lesen(new Uint8Array(await datei.arrayBuffer()), fflate); }
    else mappe = { blaetter: [X.csvLesen(await datei.text())] };
    mappe.blaetter.forEach(b => { b.diagramme = b.diagramme || []; b.spalten = b.spalten || {}; b.fix = b.fix || { z: 0, s: 0 }; });
    const s = await A.seiteNeu({ art: "tabelle", titel: name, raster: "leer", mappe });
    s.text = textVon(mappe); await A.seiteSpeichern(s);
    KW.toast("✓ „" + name + "“ geöffnet."); A.gehe("tabelle/" + s.id);
  } catch (e) { KW.toast("Diese Datei konnte ich nicht lesen."); }
}

/* ---------- Editor ---------- */

export function seite(A, el, id) {
  const s = A.seite(id);
  if (!s || s.art !== "tabelle") { el.innerHTML = '<div class="empty"><b>Tabelle nicht gefunden</b><a class="btn" href="#tabellen">Zu den Tabellen</a></div>'; return; }
  if (!s.mappe || !s.mappe.blaetter || !s.mappe.blaetter.length) s.mappe = { blaetter: [neuesBlatt("Blatt1")] };
  s.mappe.blaetter.forEach(b => { b.zellen = b.zellen || {}; b.spalten = b.spalten || {}; b.fix = b.fix || { z: 0, s: 0 }; b.diagramme = b.diagramme || []; });
  let bi = 0, sel = { a: { z: 0, s: 0 }, b: { z: 0, s: 0 } }, rech = F.alleRechnen(s.mappe), bearb = null, speicherTimer = null;
  let verlauf = [], wieder = [], filterAn = false, ablage = null;
  const blatt = () => s.mappe.blaetter[bi];
  const band = KW.load("kw-tabelle-band", "start");

  el.innerHTML =
    '<div class="seite-leiste tab-leiste" role="toolbar" aria-label="Tabelle">' +
      '<a class="btn small" href="#tabellen" aria-label="Zurück zu den Tabellen">←</a>' +
      '<input class="inp titel-inp" id="titel" maxlength="100" aria-label="Titel" value="' + esc(s.titel) + '">' +
      '<select class="inp" id="fach" aria-label="Fach"><option value="">📥 Unsortiert</option>' + A.einst.faecher.map(f => "<option" + (f.name === s.fach ? " selected" : "") + ">" + esc(f.name) + "</option>").join("") + "</select>" +
      '<span class="sp"></span><button type="button" id="rueck" aria-label="Rückgängig" title="Rückgängig (Strg+Z)">↶</button><button type="button" id="vor" aria-label="Wiederholen" title="Wiederholen (Strg+Y)">↷</button>' +
      '<button type="button" class="btn small" id="menueBtn" aria-haspopup="true" aria-expanded="false">⋯ Mehr</button>' +
    "</div>" +
    '<div class="seiten-menue card" id="menue" hidden>' +
      '<button type="button" data-a="xlsx">📗 Als Excel speichern (.xlsx)</button><button type="button" data-a="csv">📄 Als CSV speichern</button>' +
      '<button type="button" data-a="druck">🖨️ Drucken / PDF</button><button type="button" data-a="teilen">📤 An Mitschüler schicken</button>' +
      '<button type="button" data-a="versionen">🕘 Ältere Versionen</button><button type="button" data-a="weg" class="rot">🗑️ In den Papierkorb</button>' +
    "</div>" +
    '<div class="unter-leiste tab-band" id="band">' +
      '<div class="band-reiter" role="tablist">' + [["start", "Start"], ["daten", "Daten"], ["einfuegen", "Einfügen"]].map(b => '<button type="button" role="tab" data-band="' + b[0] + '">' + b[1] + "</button>").join("") + "</div>" +
      '<div class="wort-leiste" data-band="' + esc(band) + '">' +
        '<span class="gruppe" data-gruppe="start">' +
          '<button type="button" data-f="b" title="Fett (Strg+B)" aria-label="Fett"><b>F</b></button><button type="button" data-f="i" title="Kursiv (Strg+I)" aria-label="Kursiv"><i>K</i></button><button type="button" data-f="u" title="Unterstrichen (Strg+U)" aria-label="Unterstrichen"><u>U</u></button>' +
          '<label class="farb-knopf" title="Schriftfarbe"><span aria-hidden="true">A</span><input type="color" id="farbe" value="#101826" aria-label="Schriftfarbe"></label>' +
          '<label class="farb-knopf fuell" title="Füllfarbe"><span aria-hidden="true">🪣</span><input type="color" id="bg" value="#fff176" aria-label="Füllfarbe"></label><button type="button" id="bgWeg" title="Keine Füllung" aria-label="Keine Füllung">⊘</button>' +
          '<span class="trenn"></span><button type="button" data-ausr="l" title="Links" aria-label="Linksbündig">⯇</button><button type="button" data-ausr="c" title="Mitte" aria-label="Zentriert">≡</button><button type="button" data-ausr="r" title="Rechts" aria-label="Rechtsbündig">⯈</button>' +
          '<button type="button" data-f="umbruch" title="Zeilenumbruch in der Zelle" aria-label="Zeilenumbruch">↵</button><button type="button" data-f="rahmen" title="Rahmen" aria-label="Rahmen">▦</button>' +
          '<span class="trenn"></span><select id="format" aria-label="Zahlformat" title="Zahlformat"><option value="">Standard</option><option value="zahl2">Zahl 0,00</option><option value="eur">Euro €</option><option value="proz">Prozent %</option><option value="datum">Datum</option></select>' +
          '<button type="button" id="stMehr" title="Mehr Nachkommastellen" aria-label="Mehr Nachkommastellen">,0+</button><button type="button" id="stWeniger" title="Weniger Nachkommastellen" aria-label="Weniger Nachkommastellen">,0−</button>' +
          '<select id="groesse" aria-label="Schriftgröße" title="Schriftgröße">' + [9, 10, 11, 12, 14, 16, 18, 24].map(g => "<option" + (g === 11 ? " selected" : "") + ">" + g + "</option>").join("") + "</select>" +
          '<button type="button" id="leeren" title="Inhalt löschen (Entf)" aria-label="Inhalt löschen">⌫</button>' +
        "</span>" +
        '<span class="gruppe" data-gruppe="daten">' +
          '<button type="button" data-sort="auf" title="Aufsteigend sortieren">A→Z Sortieren</button><button type="button" data-sort="ab" title="Absteigend sortieren">Z→A</button>' +
          '<button type="button" id="filter" title="Filter an/aus">⏷ Filter</button>' +
          '<button type="button" id="bedingt" title="Bedingte Formatierung: Zellen färben sich nach Regeln">🎨 Bedingt</button><button type="button" id="ddListe" title="Auswahlliste (Dropdown) für die markierten Zellen">▾ Auswahlliste</button>' +
          '<select id="fix" aria-label="Fixieren" title="Zeilen/Spalten fixieren"><option value="0,0">📌 Nichts fixiert</option><option value="1,0">📌 Erste Zeile</option><option value="0,1">📌 Erste Spalte</option><option value="1,1">📌 Zeile + Spalte</option></select>' +
          '<button type="button" id="fuellUnten" title="Nach unten ausfüllen (Strg+D)">⬇ Ausfüllen</button><button type="button" id="fuellRechts" title="Nach rechts ausfüllen (Strg+R)">➡ Ausfüllen</button>' +
          '<span class="trenn"></span><button type="button" id="zeilePlus" title="Zeile darüber einfügen">+ Zeile</button><button type="button" id="zeileMinus" title="Zeile löschen">− Zeile</button><button type="button" id="spaltePlus" title="Spalte links einfügen">+ Spalte</button><button type="button" id="spalteMinus" title="Spalte löschen">− Spalte</button>' +
        "</span>" +
        '<span class="gruppe" data-gruppe="einfuegen">' +
          '<button type="button" id="summe" title="Summe (Alt+=)">Σ Summe</button><button type="button" id="fxBtn" title="Funktion einfügen">ƒx Funktion</button>' +
          D.ARTEN.map(a => '<button type="button" data-diagramm="' + a[0] + '" title="Diagramm aus der Markierung">' + a[1] + "</button>").join("") +
          '<button type="button" id="hand" title="Mit dem Stift in die Zelle schreiben">✏️ Handschrift</button>' +
        "</span>" +
      "</div>" +
    "</div>" +
    '<div class="formel-leiste"><input class="inp" id="nameBox" aria-label="Zelle" value="A1"><span class="fx" aria-hidden="true">ƒx</span><input class="inp" id="fx" aria-label="Inhalt der Zelle" autocomplete="off" spellcheck="false"></div>' +
    '<div class="gitter-box" id="box" tabindex="0" aria-label="Tabelle – mit Pfeiltasten bewegen, tippen zum Schreiben"><table class="gitter" id="gitter"></table><input class="zell-edit" id="edit" hidden autocomplete="off" spellcheck="false"><div class="griff" id="griff" title="Ziehen zum Ausfüllen"></div></div>' +
    '<div class="blatt-reiter" id="reiter"></div>' +
    '<div class="tab-status muted klein" id="status"></div>' +
    '<div class="diagramme" id="diagramme"></div>';

  const box = el.querySelector("#box"), gitter = el.querySelector("#gitter"), edit = el.querySelector("#edit"), fx = el.querySelector("#fx"), griff = el.querySelector("#griff");
  const leiste = el.querySelector("#band .wort-leiste");

  /* --- Band --- */
  const bandSetzen = (b) => { leiste.dataset.band = b; KW.save("kw-tabelle-band", b); leiste.querySelectorAll(".gruppe").forEach(g => g.hidden = g.dataset.gruppe !== b); el.querySelectorAll(".band-reiter [data-band]").forEach(x => { x.classList.toggle("an", x.dataset.band === b); x.setAttribute("aria-selected", x.dataset.band === b); }); };
  el.querySelectorAll(".band-reiter [data-band]").forEach(b => b.onclick = () => bandSetzen(b.dataset.band));
  bandSetzen(band);
  el.querySelectorAll("#band button, #band select").forEach(b => b.addEventListener("mousedown", e => { if (b.tagName === "BUTTON") e.preventDefault(); }));

  /* --- Größe des Gitters --- */
  let zeilen = 0, spalten = 0;
  function benutzt() { let mz = -1, ms = -1; for (const n of Object.keys(blatt().zellen)) { const p = F.zelleLesen(n); if (p) { mz = Math.max(mz, p.z); ms = Math.max(ms, p.s); } } return { mz, ms }; }
  const breite = (sp) => blatt().spalten[F.spalteName(sp)] || BREITE;

  /* --- Zeichnen --- */
  function aufbauen() {
    const u = benutzt();
    zeilen = Math.max(60, u.mz + 30, sel.b.z + 10); spalten = Math.max(Math.ceil((box.clientWidth || 900) / BREITE), u.ms + 6, sel.b.s + 3, 12);
    let h = "<colgroup><col style=\"width:" + ZAHL_BREITE + 'px">' + Array.from({ length: spalten }, (_, i) => '<col style="width:' + breite(i) + 'px">').join("") + "</colgroup>";
    h += '<thead><tr><th class="ecke" aria-label="Alles markieren"></th>' + Array.from({ length: spalten }, (_, i) => '<th data-sk="' + i + '">' + F.spalteName(i) + '<span class="breite-griff" data-breite="' + i + '"></span></th>').join("") + "</tr>";
    if (filterAn) h += '<tr class="filter-zeile"><th>⏷</th>' + Array.from({ length: spalten }, (_, i) => '<th><input class="inp" data-filter="' + i + '" value="' + esc((blatt().filter || {})[i] || "") + '" aria-label="Filter Spalte ' + F.spalteName(i) + '" placeholder="Filter"></th>').join("") + "</tr>";
    h += "</thead><tbody>";
    for (let z = 0; z < zeilen; z++) { h += '<tr data-z="' + z + '"><th data-zk="' + z + '">' + (z + 1) + "</th>"; for (let sp = 0; sp < spalten; sp++) h += '<td data-z="' + z + '" data-s="' + sp + '"></td>'; h += "</tr>"; }
    gitter.innerHTML = h + "</tbody>";
    gitter.style.width = (ZAHL_BREITE + Array.from({ length: spalten }, (_, i) => breite(i)).reduce((a, b) => a + b, 0)) + "px";
    for (let z = 0; z < zeilen; z++) for (let sp = 0; sp < spalten; sp++) zelleZeigen(z, sp);
    fixieren(); filtern(); markieren(); reiterZeigen(); diagrammeZeigen();
    gitter.querySelectorAll("[data-filter]").forEach(i => i.oninput = () => { blatt().filter = blatt().filter || {}; blatt().filter[i.dataset.filter] = i.value; filtern(); spaeter(); });
  }
  const td = (z, sp) => gitter.tBodies[0] && gitter.tBodies[0].rows[z] ? gitter.tBodies[0].rows[z].cells[sp + 1] : null;
  function zelleZeigen(z, sp) {
    const t = td(z, sp); if (!t) return;
    const name = F.zelleName(z, sp), c = blatt().zellen[name];
    const dd = (blatt().auswahl || []).length && Rg.auswahlFuer(blatt(), z, sp) ? "dropdown" : "";
    if (!c) { if (t.textContent || t.getAttribute("style") || t.className !== dd) { t.textContent = ""; t.removeAttribute("style"); t.className = dd; } return; }
    const w = rech.wert(blatt().name, name), f = c.f || {};
    const txt = F.anzeigen(w, F.formatVon(c), f.stellen);
    t.textContent = txt;
    let st = "";
    if (f.b) st += "font-weight:700;"; if (f.i) st += "font-style:italic;"; if (f.u) st += "text-decoration:underline;";
    if (f.farbe) st += "color:" + f.farbe + ";"; if (f.bg) st += "background:" + f.bg + ";";
    if (f.groesse && f.groesse !== 11) st += "font-size:" + (f.groesse / 11).toFixed(3) + "em;";
    const ausr = f.ausr || (typeof w === "number" ? "r" : typeof w === "boolean" || F.istFehler(w) ? "c" : "l");
    st += "text-align:" + { l: "left", c: "center", r: "right" }[ausr] + ";";
    if (f.umbruch) st += "white-space:normal;";
    if ((blatt().regeln || []).length) st += Rg.stilFuer(blatt(), z, sp, w, rech);
    t.setAttribute("style", st);
    t.className = (f.rahmen ? "rahmen " : "") + (F.istFehler(w) ? "fehler " : "") + (typeof c.v === "string" && c.v[0] === "=" ? "formel " : "") + dd;
  }
  function alleZeigen() {
    rech = F.alleRechnen(s.mappe);
    for (let z = 0; z < zeilen; z++) for (let sp = 0; sp < spalten; sp++) zelleZeigen(z, sp);
    filtern(); diagrammeZeigen(); statusZeigen();
  }

  /* --- Fixieren und Filtern --- */
  function fixieren() {
    const fix = blatt().fix || { z: 0, s: 0 };
    el.querySelector("#fix").value = (fix.z ? 1 : 0) + "," + (fix.s ? 1 : 0);
    gitter.querySelectorAll(".fixiert").forEach(x => { x.classList.remove("fixiert", "fix-z", "fix-s"); x.style.top = ""; x.style.left = ""; });
    const kopfH = gitter.tHead.offsetHeight;
    if (fix.z) for (let z = 0; z < fix.z; z++) { const r = gitter.tBodies[0].rows[z]; Array.from(r.cells).forEach(c => { c.classList.add("fixiert", "fix-z"); c.style.top = kopfH + "px"; }); }
    if (fix.s) for (const r of gitter.rows) { const c = r.cells[1]; if (c && r.parentElement.tagName === "TBODY") { c.classList.add("fixiert", "fix-s"); c.style.left = ZAHL_BREITE + "px"; } }
  }
  function filtern() {
    const fl = blatt().filter || {}, aktiv = filterAn && Object.values(fl).some(v => v && v.trim());
    const kopf = 0;
    gitter.tBodies[0] && Array.from(gitter.tBodies[0].rows).forEach((r, z) => {
      if (!aktiv || z <= kopf) { r.hidden = false; return; }
      let zeigen = true; const hatInhalt = Array.from({ length: spalten }, (_, sp) => blatt().zellen[F.zelleName(z, sp)]).some(c => c && c.v !== "");
      for (const [sp, v] of Object.entries(fl)) {
        if (!v || !v.trim()) continue;
        const t = (td(z, Number(sp)) || {}).textContent || "", such = v.trim().toLowerCase();
        const m = /^(<=|>=|<>|<|>|=)\s*(.+)$/.exec(such);
        if (m) { const a = F.eingabeLesen(t).wert, b = F.eingabeLesen(m[2]).wert; if (typeof a !== "number" || typeof b !== "number" || !{ "<": a < b, ">": a > b, "<=": a <= b, ">=": a >= b, "=": a === b, "<>": a !== b }[m[1]]) zeigen = false; }
        else if (!t.toLowerCase().includes(such)) zeigen = false;
      }
      r.hidden = !zeigen || !hatInhalt;
    });
  }

  /* --- Markierung --- */
  const bereich = () => ({ z0: Math.min(sel.a.z, sel.b.z), z1: Math.max(sel.a.z, sel.b.z), s0: Math.min(sel.a.s, sel.b.s), s1: Math.max(sel.a.s, sel.b.s) });
  const bereichText = () => { const r = bereich(); return F.zelleName(r.z0, r.s0) + (r.z0 === r.z1 && r.s0 === r.s1 ? "" : ":" + F.zelleName(r.z1, r.s1)); };
  function markieren() {
    gitter.querySelectorAll(".mark, .aktiv, .kopf-an").forEach(x => x.classList.remove("mark", "aktiv", "kopf-an", "ref"));
    const r = bereich();
    for (let z = r.z0; z <= r.z1; z++) for (let sp = r.s0; sp <= r.s1; sp++) { const t = td(z, sp); if (t) t.classList.add("mark"); }
    const a = td(sel.b.z, sel.b.s) || td(sel.a.z, sel.a.s); const akt = td(sel.a.z, sel.a.s); if (akt) akt.classList.add("aktiv");
    for (let sp = r.s0; sp <= r.s1; sp++) { const h = gitter.tHead.rows[0].cells[sp + 1]; if (h) h.classList.add("kopf-an"); }
    for (let z = r.z0; z <= r.z1; z++) { const h = gitter.tBodies[0].rows[z] && gitter.tBodies[0].rows[z].cells[0]; if (h) h.classList.add("kopf-an"); }
    // Griff unten rechts
    const unten = td(r.z1, r.s1);
    if (unten && !bearb) { griff.hidden = false; griff.style.left = (unten.offsetLeft + unten.offsetWidth - 5) + "px"; griff.style.top = (unten.offsetTop + unten.offsetHeight - 5) + "px"; } else griff.hidden = true;
    el.querySelector("#nameBox").value = bereichText();
    const c = blatt().zellen[F.zelleName(sel.a.z, sel.a.s)];
    if (!bearb) fx.value = c ? eingabeText(c) : "";
    leisteZeigen(c);
    statusZeigen();
    if (a) sichtbar(a);
    ddZeigen();
  }
  // Auswahlliste: kleines Menü an der Zelle
  function ddZeigen() {
    const alt = box.querySelector(".dd-wahl"); if (alt) alt.remove();
    if (bearb) return;
    const werte = (blatt().auswahl || []).length && Rg.auswahlFuer(blatt(), sel.a.z, sel.a.s); if (!werte) return;
    const t = td(sel.a.z, sel.a.s); if (!t) return;
    const c = blatt().zellen[F.zelleName(sel.a.z, sel.a.s)], jetzt = c ? String(c.v) : "";
    const w = document.createElement("select"); w.className = "dd-wahl"; w.setAttribute("aria-label", "Auswahl");
    w.innerHTML = '<option value="">▾</option>' + werte.map(v => '<option' + (v === jetzt ? " selected" : "") + ">" + esc(v) + "</option>").join("");
    w.style.left = (t.offsetLeft + t.offsetWidth - 22) + "px"; w.style.top = t.offsetTop + "px"; w.style.height = t.offsetHeight + "px";
    w.onchange = () => { sichern(); setzen(sel.a.z, sel.a.s, w.value); geaendert(); markieren(); box.focus(); };
    box.appendChild(w);
  }
  function sichtbar(t) {
    const fixZ = (blatt().fix || {}).z ? (td(0, 0) || {}).offsetHeight || 0 : 0;
    const kopf = gitter.tHead.offsetHeight + fixZ, links = ZAHL_BREITE + ((blatt().fix || {}).s ? breite(0) : 0);
    if (t.offsetTop - kopf < box.scrollTop) box.scrollTop = t.offsetTop - kopf;
    else if (t.offsetTop + t.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = t.offsetTop + t.offsetHeight - box.clientHeight;
    if (t.offsetLeft - links < box.scrollLeft) box.scrollLeft = t.offsetLeft - links;
    else if (t.offsetLeft + t.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollLeft = t.offsetLeft + t.offsetWidth - box.clientWidth;
  }
  // Was in der Bearbeiten-Zeile steht (Datum lesbar statt Zahl)
  const eingabeText = (c) => { if (!c) return ""; const v = c.v; if (typeof v === "number") return String(v).replace(".", ","); return v == null ? "" : String(v); };
  function leisteZeigen(c) {
    const f = (c && c.f) || {};
    leiste.querySelectorAll("[data-f]").forEach(b => b.classList.toggle("an", !!f[b.dataset.f]));
    leiste.querySelectorAll("[data-ausr]").forEach(b => b.classList.toggle("an", f.ausr === b.dataset.ausr));
    el.querySelector("#format").value = F.formatVon(c) || "";
    el.querySelector("#groesse").value = String(f.groesse || 11);
    if (f.farbe) el.querySelector("#farbe").value = f.farbe;
  }
  function statusZeigen() {
    const r = bereich(), z = [];
    for (let a = r.z0; a <= r.z1; a++) for (let b = r.s0; b <= r.s1; b++) { const w = rech.wert(blatt().name, F.zelleName(a, b)); if (typeof w === "number") z.push(w); }
    const st = el.querySelector("#status");
    st.textContent = z.length > 1 ? "Summe: " + F.anzeigen(z.reduce((x, y) => x + y, 0)) + " · Mittelwert: " + F.anzeigen(z.reduce((x, y) => x + y, 0) / z.length) + " · Anzahl: " + z.length : "Tipp: Doppelklick oder F2 = bearbeiten · „=“ startet eine Formel · Griff unten rechts ziehen = ausfüllen";
  }
  function gehe(z, sp, erweitern) {
    z = Math.max(0, z); sp = Math.max(0, sp);
    if (z >= zeilen - 5 || sp >= spalten - 2) { sel.b = { z, s: sp }; if (!erweitern) sel.a = { z, s: sp }; aufbauen(); return; }
    if (erweitern) sel.b = { z, s: sp }; else sel = { a: { z, s: sp }, b: { z, s: sp } };
    markieren();
  }

  /* --- Verlauf --- */
  function sichern() { verlauf.push(JSON.stringify(s.mappe.blaetter)); if (verlauf.length > 80) verlauf.shift(); wieder = []; }
  function rueckgaengig() { if (!verlauf.length) return; wieder.push(JSON.stringify(s.mappe.blaetter)); s.mappe.blaetter = JSON.parse(verlauf.pop()); bi = Math.min(bi, s.mappe.blaetter.length - 1); aufbauen(); geaendert(true); }
  function wiederholen() { if (!wieder.length) return; verlauf.push(JSON.stringify(s.mappe.blaetter)); s.mappe.blaetter = JSON.parse(wieder.pop()); aufbauen(); geaendert(true); }
  el.querySelector("#rueck").onclick = rueckgaengig; el.querySelector("#vor").onclick = wiederholen;

  /* --- Speichern --- */
  function spaeter() { clearTimeout(speicherTimer); speicherTimer = setTimeout(() => { speicherTimer = null; s.text = textVon(s.mappe); A.seiteSpeichern(s); }, 600); }
  function geaendert(ohneRechnen) { if (!ohneRechnen) alleZeigen(); else { rech = F.alleRechnen(s.mappe); } spaeter(); }
  el.querySelector("#titel").oninput = (e) => { s.titel = e.target.value; spaeter(); };
  el.querySelector("#fach").onchange = (e) => { s.fach = e.target.value; spaeter(); };

  /* --- Werte setzen --- */
  function setzen(z, sp, text) {
    const name = F.zelleName(z, sp), b = blatt();
    const c = b.zellen[name] || {};
    let v = String(text);
    // „=summe(a1:a3)“ → Großbuchstaben bei Funktionen und Bezügen
    if (v[0] === "=") v = v.replace(/("(?:[^"]|"")*")|([A-Za-zÄÖÜäöüß_][\wÄÖÜäöüß.]*)(?=\()|(\$?[a-z]{1,3}\$?\d+)/g, (m, str, fn, ref) => str || (fn ? fn.toUpperCase() : ref.toUpperCase()));
    if (v === "" && !c.f) delete b.zellen[name]; else { c.v = v; b.zellen[name] = c; }
  }
  function formatSetzen(werte) {
    sichern();
    const r = bereich(), b = blatt();
    for (let z = r.z0; z <= r.z1; z++) for (let sp = r.s0; sp <= r.s1; sp++) {
      const n = F.zelleName(z, sp), c = b.zellen[n] || { v: "" };
      c.f = Object.assign({}, c.f, typeof werte === "function" ? werte(c.f || {}) : werte);
      for (const k of Object.keys(c.f)) if (c.f[k] === null || c.f[k] === undefined || c.f[k] === false || c.f[k] === 0 && k !== "stellen") delete c.f[k];
      if (!Object.keys(c.f).length) delete c.f;
      if (c.v === "" && !c.f) delete b.zellen[n]; else b.zellen[n] = c;
    }
    alleZeigen(); markieren(); spaeter();
  }
  const aktuell = () => (blatt().zellen[F.zelleName(sel.a.z, sel.a.s)] || {}).f || {};
  leiste.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { const an = !aktuell()[b.dataset.f]; formatSetzen({ [b.dataset.f]: an ? 1 : null }); });
  leiste.querySelectorAll("[data-ausr]").forEach(b => b.onclick = () => formatSetzen({ ausr: aktuell().ausr === b.dataset.ausr ? null : b.dataset.ausr }));
  el.querySelector("#farbe").onchange = (e) => formatSetzen({ farbe: e.target.value });
  el.querySelector("#bg").onchange = (e) => formatSetzen({ bg: e.target.value });
  el.querySelector("#bgWeg").onclick = () => formatSetzen({ bg: null });
  el.querySelector("#format").onchange = (e) => formatSetzen({ format: e.target.value || null, stellen: null });
  el.querySelector("#groesse").onchange = (e) => formatSetzen({ groesse: Number(e.target.value) === 11 ? null : Number(e.target.value) });
  const stellenAendern = (d) => formatSetzen((f) => { const w = rech.wert(blatt().name, F.zelleName(sel.a.z, sel.a.s)); const jetzt = f.stellen != null ? f.stellen : f.format === "eur" || f.format === "zahl2" ? 2 : typeof w === "number" ? Math.min(6, (String(Number(w.toPrecision(10))).split(".")[1] || "").length) : 0; return { stellen: Math.max(0, Math.min(8, jetzt + d)) }; });
  el.querySelector("#stMehr").onclick = () => stellenAendern(1);
  el.querySelector("#stWeniger").onclick = () => stellenAendern(-1);
  function inhaltLeeren() { sichern(); const r = bereich(); for (let z = r.z0; z <= r.z1; z++) for (let sp = r.s0; sp <= r.s1; sp++) { const n = F.zelleName(z, sp), c = blatt().zellen[n]; if (c) { if (c.f) c.v = ""; else delete blatt().zellen[n]; } } geaendert(); markieren(); }
  el.querySelector("#leeren").onclick = inhaltLeeren;

  /* --- Bearbeiten --- */
  function bearbeiten(start, quelle = "zelle") {
    const t = td(sel.a.z, sel.a.s); if (!t) return;
    const c = blatt().zellen[F.zelleName(sel.a.z, sel.a.s)];
    bearb = { z: sel.a.z, s: sel.a.s, alt: c ? eingabeText(c) : "" };
    griff.hidden = true;
    if (quelle === "fx") { fx.focus(); return; }
    edit.hidden = false;
    edit.style.left = t.offsetLeft + "px"; edit.style.top = t.offsetTop + "px";
    edit.style.minWidth = t.offsetWidth + "px"; edit.style.height = t.offsetHeight + "px";
    edit.style.fontWeight = (c && c.f && c.f.b) ? "700" : "";
    edit.value = start != null ? start : bearb.alt;
    fx.value = edit.value;
    edit.focus();
    const l = edit.value.length; edit.setSelectionRange(l, l);
  }
  function fertig(speichern, weiter) {
    if (!bearb) return;
    const wert = edit.hidden ? fx.value : edit.value;
    const { z, s: sp, alt } = bearb;
    bearb = null; edit.hidden = true; refMarken([]);
    if (speichern && wert !== alt) { sichern(); setzen(z, sp, wert); geaendert(); const liste = (blatt().auswahl || []).length && Rg.auswahlFuer(blatt(), z, sp); if (liste && wert !== "" && !liste.includes(wert)) KW.toast("„" + wert + "“ steht nicht in der Auswahlliste."); }
    else fx.value = alt;
    if (weiter) gehe(z + weiter[0], sp + weiter[1]); else markieren();
    box.focus({ preventScroll: true });
  }
  edit.addEventListener("input", () => { fx.value = edit.value; refZeigen(edit.value); });
  fx.addEventListener("focus", () => { if (!bearb) { bearb = { z: sel.a.z, s: sel.a.s, alt: fx.value }; griff.hidden = true; } });
  fx.addEventListener("input", () => { if (!edit.hidden) edit.value = fx.value; refZeigen(fx.value); });
  [edit, fx].forEach(inp => inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); fertig(true, [e.shiftKey ? -1 : 1, 0]); }
    else if (e.key === "Tab") { e.preventDefault(); fertig(true, [0, e.shiftKey ? -1 : 1]); }
    else if (e.key === "Escape") { e.preventDefault(); fertig(false); }
    else if (inp === edit && !/^=/.test(edit.value) && ["ArrowUp", "ArrowDown"].includes(e.key)) { e.preventDefault(); fertig(true, [e.key === "ArrowUp" ? -1 : 1, 0]); }
  }));
  fx.addEventListener("blur", () => { setTimeout(() => { if (bearb && edit.hidden && document.activeElement !== fx && !refZiehen) fertig(true); }, 150); });
  edit.addEventListener("blur", () => { setTimeout(() => { if (bearb && !edit.hidden && document.activeElement !== edit && document.activeElement !== fx && !refZiehen) fertig(true); }, 150); });
  // Bezüge in der Formel farbig zeigen
  const REF_FARBEN = ["#2f6fdb", "#c93a3a", "#1a8f4c", "#6d3fd6", "#ff8a3c"];
  function refMarken(liste) { gitter.querySelectorAll(".ref").forEach(x => { x.classList.remove("ref"); x.style.outline = ""; }); liste.forEach(([z, sp, f]) => { const t = td(z, sp); if (t) { t.classList.add("ref"); t.style.outline = "2px dashed " + f; } }); }
  function refZeigen(v) {
    if (!/^=/.test(v)) { refMarken([]); return; }
    const out = [];
    F.bezuege(v).forEach((r, i) => {
      if (r.blatt && r.blatt.toLowerCase() !== blatt().name.toLowerCase()) return;
      const a = F.zelleLesen(r.von), b = F.zelleLesen(r.bis || r.von); if (!a || !b) return;
      for (let z = Math.min(a.z, b.z); z <= Math.min(Math.max(a.z, b.z), a.z + 200); z++) for (let sp = Math.min(a.s, b.s); sp <= Math.max(a.s, b.s); sp++) out.push([z, sp, REF_FARBEN[i % REF_FARBEN.length]]);
    });
    refMarken(out);
  }

  /* --- Maus/Finger im Gitter --- */
  let ziehen = false, refZiehen = null, letzterTipp = null;
  const zelleAus = (e) => { const t = e.target.closest && e.target.closest("td[data-z]"); return t ? { z: Number(t.dataset.z), s: Number(t.dataset.s) } : null; };
  const eingabe = () => edit.hidden ? fx : edit;
  // Beim Formel-Tippen auf eine Zelle tippen → Bezug einfügen (wie in Excel)
  const refErlaubt = () => { if (!bearb) return false; const i = eingabe(), v = i.value, p = i.selectionStart; return v[0] === "=" && /[=(;,+\-*/^&<>:]$/.test(v.slice(0, p).trimEnd()) || (refZiehen && refZiehen.aktiv); };
  gitter.addEventListener("pointerdown", (e) => {
    const k = e.target.closest("th[data-sk], th[data-zk], th.ecke"), br = e.target.closest("[data-breite]");
    if (br) { breiteZiehen(e, Number(br.dataset.breite)); return; }
    if (k && !bearb) {
      if (k.classList.contains("ecke")) { const u = benutzt(); sel = { a: { z: 0, s: 0 }, b: { z: Math.max(0, u.mz), s: Math.max(0, u.ms) } }; }
      else if (k.dataset.sk) { const sp = Number(k.dataset.sk); sel = e.shiftKey ? { a: sel.a, b: { z: zeilen - 1, s: sp } } : { a: { z: 0, s: sp }, b: { z: zeilen - 1, s: sp } }; }
      else { const z = Number(k.dataset.zk); sel = { a: { z, s: 0 }, b: { z, s: spalten - 1 } }; }
      markieren(); box.focus({ preventScroll: true }); return;
    }
    const p = zelleAus(e); if (!p) return;
    if (bearb && refErlaubt()) {
      e.preventDefault();
      const i = eingabe(), start = i.selectionStart;
      const ref = F.zelleName(p.z, p.s);
      const vor = refZiehen && refZiehen.aktiv ? i.value.slice(0, refZiehen.start) : i.value.slice(0, start), nach = refZiehen && refZiehen.aktiv ? i.value.slice(refZiehen.ende) : i.value.slice(i.selectionEnd);
      i.value = vor + ref + nach; refZiehen = { aktiv: true, start: vor.length, ende: vor.length + ref.length, von: p };
      if (i === edit) fx.value = i.value; else if (!edit.hidden) edit.value = i.value;
      i.focus(); i.setSelectionRange(refZiehen.ende, refZiehen.ende); refZeigen(i.value);
      return;
    }
    if (bearb) fertig(true);
    if (e.pointerType === "touch") {
      // Finger: tippen = auswählen, auf die markierte Zelle nochmal tippen = bearbeiten
      const jetzt = Date.now();
      if (letzterTipp && letzterTipp.z === p.z && letzterTipp.s === p.s && sel.a.z === p.z && sel.a.s === p.s && jetzt - letzterTipp.t < 3000) { bearbeiten(); letzterTipp = null; return; }
      letzterTipp = { ...p, t: jetzt }; gehe(p.z, p.s); return;
    }
    e.preventDefault(); box.focus({ preventScroll: true });
    if (e.shiftKey) { sel.b = p; markieren(); } else { sel = { a: p, b: p }; markieren(); }
    ziehen = true; gitter.setPointerCapture && gitter.setPointerCapture(e.pointerId);
  });
  gitter.addEventListener("pointermove", (e) => {
    const t = document.elementFromPoint(e.clientX, e.clientY), p = t && t.closest ? zelleAus({ target: t }) : null;
    if (refZiehen && refZiehen.aktiv && e.buttons && p) {
      const i = eingabe(), a = refZiehen.von, ref = F.zelleName(Math.min(a.z, p.z), Math.min(a.s, p.s)) + (a.z === p.z && a.s === p.s ? "" : ":" + F.zelleName(Math.max(a.z, p.z), Math.max(a.s, p.s)));
      i.value = i.value.slice(0, refZiehen.start) + ref + i.value.slice(refZiehen.ende); refZiehen.ende = refZiehen.start + ref.length;
      if (i === edit) fx.value = i.value; else if (!edit.hidden) edit.value = i.value;
      i.setSelectionRange(refZiehen.ende, refZiehen.ende); refZeigen(i.value); return;
    }
    if (!ziehen || !p) return;
    if (p.z !== sel.b.z || p.s !== sel.b.s) { sel.b = p; markieren(); }
  });
  const loslassen = () => { ziehen = false; if (refZiehen) { refZiehen.aktiv = false; const i = eingabe(); setTimeout(() => i.focus(), 0); } };
  gitter.addEventListener("pointerup", loslassen); gitter.addEventListener("pointercancel", loslassen);
  // Neues Tippen beendet den Bezug-Modus
  [edit, fx].forEach(i => i.addEventListener("keydown", () => { if (refZiehen) refZiehen = null; }));
  gitter.addEventListener("dblclick", (e) => { const p = zelleAus(e); if (p) { sel = { a: p, b: p }; markieren(); bearbeiten(); } });

  function breiteZiehen(e, sp) {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, w0 = breite(sp), col = gitter.querySelectorAll("col")[sp + 1];
    sichern();
    const mv = (ev) => { const w = Math.max(30, Math.round(w0 + ev.clientX - x0)); col.style.width = w + "px"; blatt().spalten[F.spalteName(sp)] = w; };
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); aufbauen(); spaeter(); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  }

  /* --- Ausfüllen (Griff) --- */
  griff.addEventListener("pointerdown", (e) => {
    e.preventDefault(); e.stopPropagation();
    const r = bereich(); let ziel = null;
    const mv = (ev) => {
      const t = document.elementFromPoint(ev.clientX, ev.clientY), p = t && t.closest ? zelleAus({ target: t }) : null; if (!p) return;
      const dz = p.z - r.z1, ds = p.s - r.s1;
      ziel = dz >= ds && dz > 0 ? { z: p.z, s: r.s1, richtung: "unten" } : ds > 0 ? { z: r.z1, s: p.s, richtung: "rechts" } : null;
      gitter.querySelectorAll(".fuell").forEach(x => x.classList.remove("fuell"));
      if (ziel) for (let z = r.z0; z <= ziel.z; z++) for (let sp = r.s0; sp <= ziel.s; sp++) { const x = td(z, sp); if (x) x.classList.add("fuell"); }
    };
    const up = () => {
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up);
      gitter.querySelectorAll(".fuell").forEach(x => x.classList.remove("fuell"));
      if (ziel) ausfuellen(ziel.richtung, ziel.richtung === "unten" ? ziel.z - r.z1 : ziel.s - r.s1);
    };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  });
  function ausfuellen(richtung, n) {
    const r = bereich(); if (n <= 0) return;
    sichern();
    const b = blatt();
    if (richtung === "unten") {
      for (let sp = r.s0; sp <= r.s1; sp++) {
        const q = []; for (let z = r.z0; z <= r.z1; z++) q.push((b.zellen[F.zelleName(z, sp)] || {}).v || "");
        const neu = F.fortsetzen(q, n, [1, 0]), fq = (b.zellen[F.zelleName(r.z1, sp)] || {}).f;
        neu.forEach((v, i) => { const nm = F.zelleName(r.z1 + 1 + i, sp); b.zellen[nm] = Object.assign({}, fq ? { f: Object.assign({}, fq) } : {}, { v }); if (v === "" && !fq) delete b.zellen[nm]; });
      }
      sel.b = { z: r.z1 + n, s: r.s1 };
    } else {
      for (let z = r.z0; z <= r.z1; z++) {
        const q = []; for (let sp = r.s0; sp <= r.s1; sp++) q.push((b.zellen[F.zelleName(z, sp)] || {}).v || "");
        const neu = F.fortsetzen(q, n, [0, 1]), fq = (b.zellen[F.zelleName(z, r.s1)] || {}).f;
        neu.forEach((v, i) => { const nm = F.zelleName(z, r.s1 + 1 + i); b.zellen[nm] = Object.assign({}, fq ? { f: Object.assign({}, fq) } : {}, { v }); if (v === "" && !fq) delete b.zellen[nm]; });
      }
      sel.b = { z: r.z1, s: r.s1 + n };
    }
    sel.a = { z: r.z0, s: r.s0 };
    aufbauen(); geaendert();
  }
  // Strg+D / Strg+R: obere bzw. linke Zelle der Markierung nach unten/rechts kopieren
  function kopierenNach(richtung) {
    const r = bereich(); sichern(); const b = blatt();
    if (richtung === "unten") { if (r.z1 === r.z0) return; for (let sp = r.s0; sp <= r.s1; sp++) { const q = b.zellen[F.zelleName(r.z0, sp)]; for (let z = r.z0 + 1; z <= r.z1; z++) { const n = F.zelleName(z, sp); if (q) b.zellen[n] = { v: F.verschieben(q.v, z - r.z0, 0), ...(q.f ? { f: { ...q.f } } : {}) }; else delete b.zellen[n]; } } }
    else { if (r.s1 === r.s0) return; for (let z = r.z0; z <= r.z1; z++) { const q = b.zellen[F.zelleName(z, r.s0)]; for (let sp = r.s0 + 1; sp <= r.s1; sp++) { const n = F.zelleName(z, sp); if (q) b.zellen[n] = { v: F.verschieben(q.v, 0, sp - r.s0), ...(q.f ? { f: { ...q.f } } : {}) }; else delete b.zellen[n]; } } }
    geaendert();
  }
  el.querySelector("#fuellUnten").onclick = () => { const r = bereich(); if (r.z0 === r.z1) ausfuellen("unten", 5); else kopierenNach("unten"); };
  el.querySelector("#fuellRechts").onclick = () => { const r = bereich(); if (r.s0 === r.s1) ausfuellen("rechts", 3); else kopierenNach("rechts"); };

  /* --- Tastatur --- */
  box.addEventListener("keydown", (e) => {
    if (bearb || e.target !== box) return;
    const st = e.ctrlKey || e.metaKey, k = e.key;
    const pfeile = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (pfeile[k]) {
      e.preventDefault();
      let [dz, ds] = pfeile[k];
      const von = e.shiftKey ? sel.b : sel.a;
      if (st) { // bis zum Rand der Daten springen
        let z = von.z, sp = von.s; const voll = (a, b) => !!(blatt().zellen[F.zelleName(a, b)] || {}).v;
        while (z + dz >= 0 && sp + ds >= 0 && z + dz < zeilen && sp + ds < spalten) { z += dz; sp += ds; if (voll(z, sp) !== voll(von.z, von.s) || !voll(z, sp)) { if (voll(von.z, von.s) && !voll(z, sp)) { z -= dz; sp -= ds; } break; } }
        gehe(z, sp, e.shiftKey); return;
      }
      gehe(von.z + dz, von.s + ds, e.shiftKey); return;
    }
    if (k === "Enter") { e.preventDefault(); gehe(sel.a.z + (e.shiftKey ? -1 : 1), sel.a.s); return; }
    if (k === "Tab") { e.preventDefault(); gehe(sel.a.z, sel.a.s + (e.shiftKey ? -1 : 1)); return; }
    if (k === "F2") { e.preventDefault(); bearbeiten(); return; }
    if (k === "Delete" || k === "Backspace") { e.preventDefault(); inhaltLeeren(); return; }
    if (k === "Home") { e.preventDefault(); gehe(st ? 0 : sel.a.z, 0); return; }
    if (k === "PageDown" || k === "PageUp") { e.preventDefault(); gehe(sel.a.z + (k === "PageDown" ? 20 : -20), sel.a.s); return; }
    if (st) {
      const t = k.toLowerCase();
      if (t === "z") { e.preventDefault(); e.shiftKey ? wiederholen() : rueckgaengig(); }
      else if (t === "y") { e.preventDefault(); wiederholen(); }
      else if (t === "b" || t === "i" || t === "u") { e.preventDefault(); formatSetzen({ [t]: aktuell()[t] ? null : 1 }); }
      else if (t === "d") { e.preventDefault(); kopierenNach("unten"); }
      else if (t === "r") { e.preventDefault(); kopierenNach("rechts"); }
      else if (t === "a") { e.preventDefault(); const u = benutzt(); sel = { a: { z: 0, s: 0 }, b: { z: Math.max(0, u.mz), s: Math.max(0, u.ms) } }; markieren(); }
      return;
    }
    if (e.altKey && (k === "=" || k === "0")) { e.preventDefault(); autoSumme(); return; }
    if (k.length === 1 && !e.altKey) { e.preventDefault(); bearbeiten(k); }
  });

  /* --- Kopieren / Einfügen --- */
  function markiertAlsText() {
    const r = bereich(), z = [];
    for (let a = r.z0; a <= r.z1; a++) { const reihe = []; for (let b = r.s0; b <= r.s1; b++) reihe.push((td(a, b) || {}).textContent || ""); z.push(reihe.join("\t")); }
    return z.join("\n");
  }
  function kopieren(e, ausschneiden) {
    if (bearb) return;
    const r = bereich(), b = blatt(), feld = [];
    for (let a = r.z0; a <= r.z1; a++) { const reihe = []; for (let c = r.s0; c <= r.s1; c++) { const z = b.zellen[F.zelleName(a, c)]; reihe.push(z ? JSON.parse(JSON.stringify(z)) : null); } feld.push(reihe); }
    const text = markiertAlsText();
    ablage = { feld, text, z: r.z0, s: r.s0, aus: ausschneiden ? { bi, r } : null };
    e.clipboardData.setData("text/plain", text); e.preventDefault();
    KW.toast(ausschneiden ? "Ausgeschnitten – jetzt Ziel wählen und einfügen." : "Kopiert.");
  }
  box.addEventListener("copy", (e) => kopieren(e, false));
  box.addEventListener("cut", (e) => kopieren(e, true));
  box.addEventListener("paste", (e) => {
    if (bearb) return;
    e.preventDefault();
    const text = (e.clipboardData.getData("text/plain") || "").replace(/\r/g, "").replace(/\n$/, "");
    sichern();
    const b = blatt(), z0 = sel.a.z, s0 = sel.a.s;
    if (ablage && ablage.text.replace(/\r/g, "") === text) {
      if (ablage.aus) { const q = s.mappe.blaetter[ablage.aus.bi], r = ablage.aus.r; for (let a = r.z0; a <= r.z1; a++) for (let c = r.s0; c <= r.s1; c++) delete q.zellen[F.zelleName(a, c)]; }
      ablage.feld.forEach((reihe, i) => reihe.forEach((c, j) => {
        const n = F.zelleName(z0 + i, s0 + j);
        if (!c) { delete b.zellen[n]; return; }
        b.zellen[n] = { ...c, v: ablage.aus ? c.v : F.verschieben(c.v, z0 - ablage.z, s0 - ablage.s) };
      }));
      if (ablage.aus) ablage = null;
      sel.b = { z: z0 + (ablage ? ablage.feld.length : 1) - 1, s: s0 + (ablage ? ablage.feld[0].length : 1) - 1 };
    } else {
      const reihen = text.split("\n").map(l => l.split("\t"));
      reihen.forEach((reihe, i) => reihe.forEach((v, j) => setzen(z0 + i, s0 + j, v.trim())));
      sel.b = { z: z0 + reihen.length - 1, s: s0 + Math.max(...reihen.map(r => r.length)) - 1 };
    }
    aufbauen(); geaendert();
  });

  /* --- Zeilen und Spalten einfügen/löschen (Formeln passen sich an) --- */
  function verschiebenAb(art, ab, d) {
    sichern();
    s.mappe.blaetter.forEach(b => {
      const neu = {};
      for (const [n, c] of Object.entries(b.zellen)) {
        const p = F.zelleLesen(n);
        let { z, s: sp } = p;
        if (art === "z") { if (d < 0 && z === ab) continue; if (z >= ab + (d < 0 ? 1 : 0)) z += d; }
        else { if (d < 0 && sp === ab) continue; if (sp >= ab + (d < 0 ? 1 : 0)) sp += d; }
        neu[F.zelleName(z, sp)] = c;
      }
      // Bezüge in allen Formeln anpassen (nur aufs eigene Blatt, einfach gehalten)
      for (const c of Object.values(neu)) if (typeof c.v === "string" && c.v[0] === "=" && b === blatt()) c.v = c.v.replace(/("(?:[^"]|"")*")|(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![\w(!])/g, (m, str, d1, spn, d2, zz, pos, ganz) => {
        if (str) return str; const vor = ganz[pos - 1]; if (vor && /[\wÄÖÜäöüß!]/.test(vor)) return m;
        let sNr = F.spalteNr(spn), zNr = Number(zz) - 1;
        if (art === "z" && zNr >= ab + (d < 0 ? 1 : 0)) zNr += d; else if (art === "z" && d < 0 && zNr === ab) return "#BEZUG!";
        if (art === "s" && sNr >= ab + (d < 0 ? 1 : 0)) sNr += d; else if (art === "s" && d < 0 && sNr === ab) return "#BEZUG!";
        return d1 + F.spalteName(sNr) + d2 + (zNr + 1);
      });
      if (b === blatt()) b.zellen = neu;
    });
    aufbauen(); geaendert();
  }
  el.querySelector("#zeilePlus").onclick = () => verschiebenAb("z", bereich().z0, 1);
  el.querySelector("#zeileMinus").onclick = () => verschiebenAb("z", bereich().z0, -1);
  el.querySelector("#spaltePlus").onclick = () => verschiebenAb("s", bereich().s0, 1);
  el.querySelector("#spalteMinus").onclick = () => verschiebenAb("s", bereich().s0, -1);

  /* --- Sortieren --- */
  function sortieren(auf) {
    const b = blatt(); let r = bereich();
    if (r.z0 === r.z1) { const u = benutzt(); r = { z0: 0, z1: u.mz, s0: 0, s1: u.ms }; }
    if (r.z1 <= r.z0) return;
    const sp = sel.a.s;
    // Kopfzeile? (erste Zeile fett oder Text über Zahlen)
    const c0 = b.zellen[F.zelleName(r.z0, sp)], w0 = rech.wert(b.name, F.zelleName(r.z0, sp)), w1 = rech.wert(b.name, F.zelleName(r.z0 + 1, sp));
    const kopf = (c0 && c0.f && c0.f.b) || (typeof w0 === "string" && w0 !== "" && typeof w1 === "number");
    const start = kopf ? r.z0 + 1 : r.z0;
    const reihen = [];
    for (let z = start; z <= r.z1; z++) { const zellen = []; for (let x = r.s0; x <= r.s1; x++) zellen.push(b.zellen[F.zelleName(z, x)]); reihen.push({ z, zellen, w: rech.wert(b.name, F.zelleName(z, sp)) }); }
    const leer = (w) => w === "" || w == null;
    reihen.sort((a, c) => {
      if (leer(a.w) !== leer(c.w)) return leer(a.w) ? 1 : -1;
      let v;
      if (typeof a.w === "number" && typeof c.w === "number") v = a.w - c.w;
      else if (typeof a.w === "number") v = -1; else if (typeof c.w === "number") v = 1;
      else v = String(a.w).localeCompare(String(c.w), "de", { numeric: true });
      return auf ? v : leer(a.w) ? 0 : -v;
    });
    sichern();
    reihen.forEach((reihe, i) => {
      const ziel = start + i;
      reihe.zellen.forEach((c, j) => { const n = F.zelleName(ziel, r.s0 + j); if (c) b.zellen[n] = { ...c, v: F.verschieben(c.v, ziel - reihe.z, 0) }; else delete b.zellen[n]; });
    });
    geaendert(); KW.toast("Sortiert nach Spalte " + F.spalteName(sp) + (kopf ? " (Kopfzeile bleibt oben)" : "") + ".");
  }
  el.querySelectorAll("[data-sort]").forEach(b => b.onclick = () => sortieren(b.dataset.sort === "auf"));
  el.querySelector("#bedingt").onclick = () => Rg.regelnDialog(blatt(), bereichText(), () => { sichern(); alleZeigen(); geaendert(); });
  el.querySelector("#ddListe").onclick = () => Rg.auswahlDialog(blatt(), bereichText(), () => { sichern(); alleZeigen(); markieren(); geaendert(); });
  el.querySelector("#filter").onclick = () => { filterAn = !filterAn; el.querySelector("#filter").classList.toggle("an", filterAn); aufbauen(); };
  el.querySelector("#fix").onchange = (e) => { const [z, sp] = e.target.value.split(",").map(Number); sichern(); blatt().fix = { z, s: sp }; fixieren(); spaeter(); };

  /* --- Summe und Funktionen --- */
  function autoSumme() {
    const r = bereich(), b = blatt(); sichern();
    if (r.z0 === r.z1 && r.s0 === r.s1) {
      // Zahlen darüber (oder links) suchen
      let z = r.z0 - 1; while (z >= 0 && typeof rech.wert(b.name, F.zelleName(z, r.s0)) === "number") z--;
      if (z < r.z0 - 1) setzen(r.z0, r.s0, "=SUMME(" + F.zelleName(z + 1, r.s0) + ":" + F.zelleName(r.z0 - 1, r.s0) + ")");
      else { let sp = r.s0 - 1; while (sp >= 0 && typeof rech.wert(b.name, F.zelleName(r.z0, sp)) === "number") sp--; if (sp < r.s0 - 1) setzen(r.z0, r.s0, "=SUMME(" + F.zelleName(r.z0, sp + 1) + ":" + F.zelleName(r.z0, r.s0 - 1) + ")"); else { verlauf.pop(); bearbeiten("=SUMME("); return; } }
    } else for (let sp = r.s0; sp <= r.s1; sp++) setzen(r.z1 + 1, sp, "=SUMME(" + F.zelleName(r.z0, sp) + ":" + F.zelleName(r.z1, sp) + ")");
    geaendert(); markieren();
  }
  el.querySelector("#summe").onclick = autoSumme;
  const HILFE = [["SUMME", "Zählt Zahlen zusammen", "=SUMME(A1:A10)"], ["MITTELWERT", "Durchschnitt, z. B. Notenschnitt", "=MITTELWERT(B2:B8)"], ["MIN", "Kleinster Wert", "=MIN(A1:A10)"], ["MAX", "Größter Wert", "=MAX(A1:A10)"],
    ["ANZAHL", "Wie viele Zahlen", "=ANZAHL(A1:A10)"], ["ANZAHL2", "Wie viele Zellen nicht leer sind", "=ANZAHL2(A1:A10)"], ["RUNDEN", "Runden auf Stellen", "=RUNDEN(A1;2)"], ["WENN", "Wenn … dann … sonst", '=WENN(A1>=5;"bestanden";"nicht")'],
    ["ZÄHLENWENN", "Zählt, was passt", '=ZÄHLENWENN(A1:A20;"x")'], ["SUMMEWENN", "Summe, wenn etwas passt", '=SUMMEWENN(A1:A20;"Essen";B1:B20)'], ["SVERWEIS", "In einer Tabelle nachschlagen", "=SVERWEIS(E1;A1:B20;2;FALSCH)"],
    ["WURZEL", "Quadratwurzel", "=WURZEL(16)"], ["POTENZ", "Hoch-Zahl", "=POTENZ(2;10)"], ["MEDIAN", "Wert in der Mitte", "=MEDIAN(A1:A9)"], ["STABW", "Standardabweichung (Streuung)", "=STABW(A1:A10)"],
    ["HEUTE", "Datum von heute", "=HEUTE()"], ["VERKETTEN", "Text zusammenfügen (oder &)", '=VERKETTEN(A1;" ";B1)'], ["WENNFEHLER", "Fehler durch etwas anderes ersetzen", '=WENNFEHLER(A1/B1;"")'], ["UND", "Alle Bedingungen wahr?", "=UND(A1>0;B1>0)"], ["ODER", "Eine Bedingung wahr?", "=ODER(A1>0;B1>0)"]];
  el.querySelector("#fxBtn").onclick = () => {
    const d = document.createElement("dialog"); d.className = "sheet";
    const mitKI = A.einst.ki && A.einst.ki.art !== "aus";
    d.innerHTML = '<div class="sheet-in"><h2>ƒx Funktion einfügen</h2>' +
      (mitKI ? '<div class="fx-ki"><label class="field"><span>✨ Sag einfach, was die Formel machen soll</span><input class="inp" id="fki" placeholder="z. B. Durchschnitt der Noten in Spalte B"></label><button type="button" class="btn small primary" id="fkiLos">Formel bauen</button><div id="fkiErg" aria-live="polite"></div></div>' : "") +
      '<input class="inp" id="fq" placeholder="Suchen …" aria-label="Funktion suchen"><div class="fn-liste" id="fl"></div><p class="muted klein">Zwischen den Teilen steht „;“. Mit „$“ bleibt ein Bezug beim Kopieren fest ($A$1).</p><div class="sheet-foot"><button type="button" class="btn" id="ab">Schließen</button></div></div>';
    document.body.appendChild(d);
    const zeichne = (q) => { d.querySelector("#fl").innerHTML = HILFE.filter(h => !q || (h[0] + h[1]).toLowerCase().includes(q.toLowerCase())).map(h => '<button type="button" class="fn-z" data-fn="' + h[0] + '"><b>' + h[0] + "</b><span>" + esc(h[1]) + "</span><code>" + esc(h[2]) + "</code></button>").join(""); d.querySelectorAll("[data-fn]").forEach(b => b.onclick = () => { d.close(); bearbeiten("=" + b.dataset.fn + "("); }); };
    zeichne(""); d.querySelector("#fq").oninput = (e) => zeichne(e.target.value);
    if (mitKI) {
      const los = async () => {
        const w = d.querySelector("#fki").value.trim(), erg = d.querySelector("#fkiErg"); if (!w) return;
        const b = s.mappe.blaetter[bi], kopf = [];
        for (let sp = 0; sp < 12; sp++) { const c = b.zellen && b.zellen[F.zelleName(0, sp)]; if (c && c.v != null && c.v !== "") kopf.push(F.spalteName(sp) + "=" + String(c.v).slice(0, 20)); }
        const kontext = "Ausgewählte Zelle: " + F.zelleName(sel.a.z, sel.a.s) + (sel.a.z !== sel.b.z || sel.a.s !== sel.b.s ? ", markierter Bereich " + F.zelleName(sel.a.z, sel.a.s) + ":" + F.zelleName(sel.b.z, sel.b.s) : "") + (kopf.length ? ". Überschriften in Zeile 1: " + kopf.join(", ") : "");
        erg.innerHTML = '<p class="muted">✨ Baut die Formel …</p>';
        try {
          const KIH = await import("./ki-helfer.js"), r = await KIH.formelVorschlag(A, w, kontext);
          erg.innerHTML = '<div class="fx-vorschlag"><code>' + esc(r.formel) + '</code>' + (r.erklaerung ? '<small>' + esc(r.erklaerung) + '</small>' : "") + '<button type="button" class="btn small primary" id="fkiRein">In ' + F.zelleName(sel.a.z, sel.a.s) + ' einsetzen</button></div>';
          erg.querySelector("#fkiRein").onclick = () => { d.close(); bearbeiten(r.formel); };
        } catch (e) { const KIH = await import("./ki-helfer.js"); erg.innerHTML = '<p>' + esc(e.message === "keine-formel" ? "Daraus konnte ich keine Formel bauen. Beschreib es etwas genauer (welche Spalten, welche Zeilen?)." : KIH.kiFehlerText(e)) + '</p>'; }
      };
      d.querySelector("#fkiLos").onclick = los; d.querySelector("#fki").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); los(); } };
    }
    d.querySelector("#ab").onclick = () => d.close(); d.addEventListener("close", () => d.remove()); d.showModal();
  };
  el.querySelector("#nameBox").onkeydown = (e) => { if (e.key !== "Enter") return; e.preventDefault(); const [a, b] = e.target.value.trim().toUpperCase().split(":"), p = F.zelleLesen(a), q = F.zelleLesen(b || a); if (p && q) { sel = { a: p, b: q }; if (q.z >= zeilen - 5 || q.s >= spalten - 2) aufbauen(); else markieren(); box.focus(); } };

  /* --- Handschrift --- */
  el.querySelector("#hand").onclick = () => {
    const d = document.createElement("dialog"); d.className = "sheet";
    d.innerHTML = '<div class="sheet-in"><h2>✏️ In ' + F.zelleName(sel.a.z, sel.a.s) + ' schreiben</h2><canvas id="hc" width="900" height="300" class="hand-feld" aria-label="Schreibfeld"></canvas><p class="muted klein">Mit Stift oder Finger schreiben. Die KI auf deinem Gerät liest es.</p><div class="sheet-foot"><button type="button" class="btn" id="hLeer">Leeren</button><span class="sp"></span><button type="button" class="btn" id="ab">Abbrechen</button><button type="button" class="btn primary" id="hOk">Lesen</button></div></div>';
    document.body.appendChild(d);
    const c = d.querySelector("#hc"), g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.lineWidth = 6; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#101826";
    let malt = false; const pt = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
    c.onpointerdown = (e) => { malt = true; c.setPointerCapture(e.pointerId); const p = pt(e); g.beginPath(); g.moveTo(p[0], p[1]); };
    c.onpointermove = (e) => { if (!malt) return; const p = pt(e); g.lineTo(p[0], p[1]); g.stroke(); };
    c.onpointerup = () => { malt = false; };
    d.querySelector("#hLeer").onclick = () => { g.fillRect(0, 0, c.width, c.height); };
    d.querySelector("#ab").onclick = () => d.close();
    d.querySelector("#hOk").onclick = async () => {
      const blob = await new Promise(r => c.toBlob(r, "image/png"));
      d.querySelector("#hOk").textContent = "Liest …";
      try {
        const t = (await KI.bildLesen(A.einst.ki, blob)).trim().split("\n")[0];
        if (!t) throw new Error("leer");
        sichern(); setzen(sel.a.z, sel.a.s, t); geaendert(); markieren(); d.close(); KW.toast("✓ „" + t + "“ eingetragen.");
      } catch (e) { d.querySelector("#hOk").textContent = "Lesen"; KW.toast(e.message === "keine-ki" ? "Dafür braucht es die KI (⚙️ Einstellungen → KI)." : "Handschrift lesen geht mit Chrome-KI (Gemini Nano) oder Ollama mit Bild-Modell."); }
    };
    d.addEventListener("close", () => d.remove()); d.showModal();
  };

  /* --- Diagramme --- */
  function diagrammeZeigen() {
    const box2 = el.querySelector("#diagramme"), b = blatt();
    if (!b.diagramme.length) { box2.innerHTML = ""; return; }
    box2.innerHTML = b.diagramme.map(dg => {
      const daten = D.datenAusBereich(rech, b.name, dg.bereich);
      return '<figure class="card diagramm-karte" data-id="' + dg.id + '"><div class="dg-svg">' + D.svg(daten, dg.art, dg.titel, 640, 360, { trend: dg.trend !== false }) + "</div>" +
        '<figcaption><input class="inp" data-dt="titel" value="' + esc(dg.titel || "") + '" placeholder="Titel" aria-label="Diagramm-Titel">' +
        '<select class="inp" data-dt="art" aria-label="Diagramm-Art">' + D.ARTEN.map(a => '<option value="' + a[0] + '"' + (a[0] === dg.art ? " selected" : "") + ">" + a[1] + "</option>").join("") + "</select>" +
        (dg.art === "punkt" ? '<label class="klein"><input type="checkbox" data-dt="trend"' + (dg.trend !== false ? " checked" : "") + "> Trendlinie</label>" : "") +
        '<span class="muted klein">' + esc(dg.bereich) + '</span><button type="button" class="btn small" data-dt="bereich" title="Bereich = aktuelle Markierung">↻ Markierung</button>' +
        '<button type="button" class="btn small" data-dt="png" title="Als Bild speichern">🖼️</button><button type="button" class="btn small danger" data-dt="weg" aria-label="Diagramm löschen">🗑</button></figcaption></figure>';
    }).join("");
    box2.querySelectorAll(".diagramm-karte").forEach(k => {
      const dg = b.diagramme.find(x => x.id === k.dataset.id);
      k.querySelector('[data-dt="titel"]').onchange = (e) => { sichern(); dg.titel = e.target.value; diagrammeZeigen(); spaeter(); };
      k.querySelector('[data-dt="art"]').onchange = (e) => { sichern(); dg.art = e.target.value; diagrammeZeigen(); spaeter(); };
      const tr = k.querySelector('[data-dt="trend"]'); if (tr) tr.onchange = () => { sichern(); dg.trend = tr.checked; diagrammeZeigen(); spaeter(); };
      k.querySelector('[data-dt="bereich"]').onclick = () => { sichern(); dg.bereich = bereichText(); diagrammeZeigen(); spaeter(); };
      k.querySelector('[data-dt="weg"]').onclick = () => { sichern(); b.diagramme = b.diagramme.filter(x => x !== dg); diagrammeZeigen(); spaeter(); };
      k.querySelector('[data-dt="png"]').onclick = async () => { const url = await D.alsPng(D.svg(D.datenAusBereich(rech, b.name, dg.bereich), dg.art, dg.titel, 640, 360, { trend: dg.trend !== false }), 640, 360); const a = document.createElement("a"); a.href = url; a.download = (dg.titel || "Diagramm") + ".png"; a.click(); };
    });
  }
  el.querySelectorAll("[data-diagramm]").forEach(btn => btn.onclick = () => {
    let r = bereich();
    if (r.z0 === r.z1 && r.s0 === r.s1) { const u = benutzt(); if (u.mz < 0) { KW.toast("Erst Zahlen eintragen und markieren."); return; } r = { z0: 0, z1: u.mz, s0: 0, s1: u.ms }; }
    sichern();
    const ber = F.zelleName(r.z0, r.s0) + ":" + F.zelleName(r.z1, r.s1);
    blatt().diagramme.push({ id: KW.id(), art: btn.dataset.diagramm, bereich: ber, titel: "" });
    diagrammeZeigen(); spaeter();
    setTimeout(() => el.querySelector("#diagramme").lastElementChild.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  });

  /* --- Blätter --- */
  function reiterZeigen() {
    const r = el.querySelector("#reiter");
    r.innerHTML = s.mappe.blaetter.map((b, i) => '<button type="button" class="' + (i === bi ? "an" : "") + '" data-bi="' + i + '" title="Doppelklick = umbenennen">' + esc(b.name) + "</button>").join("") + '<button type="button" id="blattNeu" aria-label="Neues Blatt" title="Neues Blatt">+</button>' +
      (s.mappe.blaetter.length > 1 ? '<button type="button" id="blattWeg" aria-label="Blatt löschen" title="Dieses Blatt löschen">🗑</button>' : "");
    r.querySelectorAll("[data-bi]").forEach(b => {
      b.onclick = () => { if (bearb) fertig(true); bi = Number(b.dataset.bi); sel = { a: { z: 0, s: 0 }, b: { z: 0, s: 0 } }; aufbauen(); };
      b.ondblclick = () => { const n = prompt("Name des Blatts:", blatt().name); if (n && n.trim() && !s.mappe.blaetter.some((x, j) => j !== bi && x.name.toLowerCase() === n.trim().toLowerCase())) { sichern(); blatt().name = n.trim().slice(0, 31); reiterZeigen(); geaendert(); } };
    });
    r.querySelector("#blattNeu").onclick = () => { sichern(); let n = s.mappe.blaetter.length + 1; while (s.mappe.blaetter.some(b => b.name === "Blatt" + n)) n++; s.mappe.blaetter.push(neuesBlatt("Blatt" + n)); bi = s.mappe.blaetter.length - 1; aufbauen(); spaeter(); };
    const w = r.querySelector("#blattWeg");
    if (w) w.onclick = () => { if (!confirm("Blatt „" + blatt().name + "“ löschen?")) return; sichern(); s.mappe.blaetter.splice(bi, 1); bi = Math.max(0, bi - 1); aufbauen(); geaendert(); };
  }

  /* --- Menü --- */
  const menue = el.querySelector("#menue"), mb = el.querySelector("#menueBtn");
  mb.onclick = (e) => { e.stopPropagation(); menue.hidden = !menue.hidden; mb.setAttribute("aria-expanded", !menue.hidden); };
  const zu = (e) => { if (!menue.contains(e.target) && e.target !== mb) { menue.hidden = true; mb.setAttribute("aria-expanded", "false"); } };
  document.addEventListener("click", zu);
  const name = () => (s.titel || "Tabelle").replace(/[\\/:*?"<>|]/g, "").slice(0, 60);
  menue.onclick = async (e) => {
    const a = e.target.closest("[data-a]"); if (!a) return; menue.hidden = true;
    const w = a.dataset.a;
    if (w === "xlsx") { try { const fflate = await import(FFLATE); herunterladen(new Blob([X.schreiben(s.mappe, fflate)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), name() + ".xlsx"); KW.toast("✓ Excel-Datei gespeichert."); } catch (err) { KW.toast("Speichern hat nicht geklappt."); } }
    if (w === "csv") herunterladen(new Blob([X.csvSchreiben(blatt(), s.mappe)], { type: "text/csv;charset=utf-8" }), name() + (s.mappe.blaetter.length > 1 ? " – " + blatt().name : "") + ".csv");
    if (w === "druck") drucken(A, s, bi);
    if (w === "teilen") Extras.teilen(A, s);
    if (w === "versionen") Extras.versionen(A, s, () => A.zeigen());
    if (w === "weg") { await A.seiteLoeschen(s.id); KW.toast("In den Papierkorb gelegt.", "Rückgängig", async () => { await A.seiteWiederherstellen(s.id); A.gehe("tabelle/" + s.id); }); A.gehe("tabellen"); }
  };

  const ro = new ResizeObserver(() => { if (!bearb && gitter.rows.length && box.clientWidth > (gitter.offsetWidth - 50)) aufbauen(); });
  // Ergebnis aus dem Taschenrechner in die markierte Zelle (bzw. Wertetabelle ab hier)
  const vomRechner = (e) => {
    if (!document.body.contains(box) || (e.detail.ziel !== box && !box.contains(e.detail.ziel))) return;
    e.preventDefault(); sichern();
    if (e.detail.tabelle) e.detail.tabelle.forEach((r, i) => r.forEach((c, j) => setzen(sel.a.z + i, sel.a.s + j, c)));
    else setzen(sel.a.z, sel.a.s, e.detail.text.replace(/⁄/g, "/").replace(/^(-?\d+)\/(\d+)$/, "=$1/$2"));
    geaendert(); markieren(); box.focus({ preventScroll: true });
  };
  window.addEventListener("fidelia-einfuegen", vomRechner);
  if (A.einst.f.tabellen && A.einst.f.tabellen.hand === false) el.querySelector("#hand").remove();
  if (A.einst.f.tabellen && A.einst.f.tabellen.diagramme === false) el.querySelectorAll("[data-diagramm]").forEach(b => b.remove());
  aufbauen();
  ro.observe(box);
  box.focus({ preventScroll: true });
  Extras.versionMerken(A, s);
  return () => { ro.disconnect(); window.removeEventListener("fidelia-einfuegen", vomRechner); document.removeEventListener("click", zu); if (bearb) fertig(true); if (speicherTimer) { clearTimeout(speicherTimer); s.text = textVon(s.mappe); A.seiteSpeichern(s); } Extras.versionMerken(A, s); };
}

/* ---------- Drucken ---------- */

export function tabelleHtml(mappe, bi, rech = F.alleRechnen(mappe)) {
  const b = mappe.blaetter[bi];
  let mz = -1, ms = -1; for (const n of Object.keys(b.zellen)) { const p = F.zelleLesen(n); if (p && b.zellen[n].v !== "") { mz = Math.max(mz, p.z); ms = Math.max(ms, p.s); } }
  if (mz < 0) return "<p>(leer)</p>";
  let h = '<table class="druck-tabelle"><colgroup>' + Array.from({ length: ms + 1 }, (_, i) => '<col style="width:' + (b.spalten[F.spalteName(i)] || BREITE) + 'px">').join("") + "</colgroup>";
  for (let z = 0; z <= mz; z++) {
    h += "<tr>";
    for (let sp = 0; sp <= ms; sp++) {
      const n = F.zelleName(z, sp), c = b.zellen[n], f = (c && c.f) || {}, w = c ? rech.wert(b.name, n) : "";
      const ausr = f.ausr || (typeof w === "number" ? "r" : "l");
      h += '<td style="text-align:' + { l: "left", c: "center", r: "right" }[ausr] + ";" + (f.b ? "font-weight:700;" : "") + (f.i ? "font-style:italic;" : "") + (f.farbe ? "color:" + f.farbe + ";" : "") + (f.bg ? "background:" + f.bg + ";" : "") + '">' + esc(c ? F.anzeigen(w, F.formatVon(c), f.stellen) : "") + "</td>";
    }
    h += "</tr>";
  }
  return h + "</table>";
}

function drucken(A, s, bi) {
  const rech = F.alleRechnen(s.mappe), b = s.mappe.blaetter[bi];
  const alt = document.getElementById("druck"); if (alt) alt.remove();
  const box = document.createElement("div"); box.id = "druck";
  const breit = Object.keys(b.zellen).some(n => (F.zelleLesen(n) || {}).s > 6);
  box.innerHTML = '<div class="druck-frei' + (breit ? " quer" : "") + '"><h1>' + esc(s.titel || "Tabelle") + (s.mappe.blaetter.length > 1 ? " – " + esc(b.name) : "") + "</h1>" + tabelleHtml(s.mappe, bi, rech) +
    b.diagramme.map(dg => '<div class="druck-dg">' + D.svg(D.datenAusBereich(rech, b.name, dg.bereich), dg.art, dg.titel, 640, 360) + "</div>").join("") + "</div>";
  document.body.appendChild(box); document.body.classList.add("druckt");
  const fertig = () => { document.body.classList.remove("druckt"); box.remove(); window.removeEventListener("afterprint", fertig); };
  window.addEventListener("afterprint", fertig);
  setTimeout(() => window.print(), 200);
}
