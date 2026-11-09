// FIDELIA Notizen · Excel-Dateien (.xlsx) schreiben und lesen – komplett im Browser
// Office-Open-XML von Hand gebaut und mit fflate gepackt. Formeln werden für Excel übersetzt (SUMME → SUM).

import * as F from "./formel.js";

const x = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
const hex6 = (f) => { if (!f) return ""; const m = /^#?([0-9a-f]{6})$/i.exec(f); return m ? m[1].toUpperCase() : ""; };

const FORMATE = { eur: '#,##0.00\\ "€"', datum: "DD.MM.YYYY" };

/* ---------- Schreiben ---------- */

// mappe: { blaetter: [{ name, zellen, spalten: {A: px}, fix: {z, s} }] }, fflate: das fflate-Modul
export function schreiben(mappe, fflate) {
  const rechnung = F.alleRechnen(mappe);
  // Stile sammeln: jede Kombination aus Schrift, Füllung, Ausrichtung, Zahlformat bekommt eine Nummer
  const schriften = ['<font><sz val="11"/><name val="Calibri"/></font>'], fuellungen = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'], xfIndex = new Map();
  const numFmtId = (f) => {
    if (!f || (!f.format && f.stellen == null)) return 0;
    if (f.format === "proz") return f.stellen ? pruef("0." + "0".repeat(f.stellen) + "%") : 9;
    if (f.format === "zahl2") return 2;
    if (f.format === "eur" || f.format === "datum") return pruef(FORMATE[f.format]);
    if (f.stellen != null) return f.stellen ? pruef("0." + "0".repeat(f.stellen)) : 1;
    return 0;
  };
  const fmtListe = [];
  function pruef(code) { let i = fmtListe.indexOf(code); if (i < 0) { fmtListe.push(code); i = fmtListe.length - 1; } return 164 + i; }
  const stilVon = (f) => {
    if (!f) return 0;
    const font = '<font>' + (f.b ? "<b/>" : "") + (f.i ? "<i/>" : "") + (f.u ? '<u/>' : "") + (f.s ? "<strike/>" : "") + '<sz val="' + (f.groesse || 11) + '"/>' + (hex6(f.farbe) ? '<color rgb="FF' + hex6(f.farbe) + '"/>' : "") + '<name val="Calibri"/></font>';
    let fi = schriften.indexOf(font); if (fi < 0) { schriften.push(font); fi = schriften.length - 1; }
    let fl = 0;
    if (hex6(f.bg)) { const fill = '<fill><patternFill patternType="solid"><fgColor rgb="FF' + hex6(f.bg) + '"/><bgColor indexed="64"/></patternFill></fill>'; fl = fuellungen.indexOf(fill); if (fl < 0) { fuellungen.push(fill); fl = fuellungen.length - 1; } }
    const nf = numFmtId(f), ausr = { l: "left", c: "center", r: "right" }[f.ausr];
    const xf = '<xf numFmtId="' + nf + '" fontId="' + fi + '" fillId="' + fl + '" borderId="' + (f.rahmen ? 1 : 0) + '" xfId="0"' + (nf ? ' applyNumberFormat="1"' : "") + (fi ? ' applyFont="1"' : "") + (fl ? ' applyFill="1"' : "") + (f.rahmen ? ' applyBorder="1"' : "") +
      (ausr || f.umbruch ? ' applyAlignment="1"><alignment' + (ausr ? ' horizontal="' + ausr + '"' : "") + (f.umbruch ? ' wrapText="1"' : "") + '/></xf>' : "/>");
    if (!xfIndex.has(xf)) { xfs.push(xf); xfIndex.set(xf, xfs.length - 1); }
    return xfIndex.get(xf);
  };

  const blaetter = mappe.blaetter.map((b, bi) => {
    const zeilen = new Map();
    for (const [name, c] of Object.entries(b.zellen)) {
      const p = F.zelleLesen(name); if (!p || !c) continue;
      if ((c.v === "" || c.v == null) && !c.f) continue;
      if (!zeilen.has(p.z)) zeilen.set(p.z, []);
      zeilen.get(p.z).push({ p, name, c });
    }
    let xml = "";
    for (const z of [...zeilen.keys()].sort((a, c) => a - c)) {
      const h = b.zeilen && b.zeilen[z + 1];
      xml += '<row r="' + (z + 1) + '"' + (h ? ' ht="' + (h * 0.75).toFixed(1) + '" customHeight="1"' : "") + ">";
      for (const { p, name, c } of zeilen.get(z).sort((a, d) => a.p.s - d.p.s)) {
        const s = stilVon(c.f), st = s ? ' s="' + s + '"' : "";
        const roh = c.v;
        if (typeof roh === "string" && roh[0] === "=" && roh.length > 1) {
          const w = rechnung.wert(b.name, name);
          const fx = "<f>" + x(F.nachExcel(roh)) + "</f>";
          if (F.istFehler(w)) xml += '<c r="' + name + '"' + st + ' t="e">' + fx + "<v>" + x(w.code === "#DIV/0!" ? "#DIV/0!" : w.code === "#NAME?" ? "#NAME?" : "#VALUE!") + "</v></c>";
          else if (typeof w === "number") xml += '<c r="' + name + '"' + st + ">" + fx + "<v>" + w + "</v></c>";
          else if (typeof w === "boolean") xml += '<c r="' + name + '"' + st + ' t="b">' + fx + "<v>" + (w ? 1 : 0) + "</v></c>";
          else xml += '<c r="' + name + '"' + st + ' t="str">' + fx + "<v>" + x(w) + "</v></c>";
          continue;
        }
        const e = F.eingabeLesen(roh);
        if (typeof e.wert === "number") xml += '<c r="' + name + '"' + (e.format && !(c.f && c.f.format) ? ' s="' + stilVon(Object.assign({}, c.f, { format: e.format })) + '"' : st) + "><v>" + e.wert + "</v></c>";
        else if (typeof e.wert === "boolean") xml += '<c r="' + name + '"' + st + ' t="b"><v>' + (e.wert ? 1 : 0) + "</v></c>";
        else if (e.wert === "") xml += '<c r="' + name + '"' + st + "/>";
        else xml += '<c r="' + name + '"' + st + ' t="inlineStr"><is><t xml:space="preserve">' + x(e.wert) + "</t></is></c>";
      }
      xml += "</row>";
    }
    const spalten = Object.entries(b.spalten || {}).map(([sp, px]) => { const i = F.spalteNr(sp) + 1; return '<col min="' + i + '" max="' + i + '" width="' + Math.max(2, px / 7).toFixed(2) + '" customWidth="1"/>'; }).join("");
    const fix = b.fix && (b.fix.z || b.fix.s) ? '<sheetViews><sheetView workbookViewId="0"' + (bi === 0 ? ' tabSelected="1"' : "") + '><pane' + (b.fix.s ? ' xSplit="' + b.fix.s + '"' : "") + (b.fix.z ? ' ySplit="' + b.fix.z + '"' : "") + ' topLeftCell="' + F.zelleName(b.fix.z || 0, b.fix.s || 0) + '" activePane="' + (b.fix.z && b.fix.s ? "bottomRight" : b.fix.z ? "bottomLeft" : "topRight") + '" state="frozen"/></sheetView></sheetViews>' : "";
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      fix + '<sheetFormatPr defaultRowHeight="15"/>' + (spalten ? "<cols>" + spalten + "</cols>" : "") + "<sheetData>" + xml + "</sheetData></worksheet>";
  });

  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    (fmtListe.length ? '<numFmts count="' + fmtListe.length + '">' + fmtListe.map((c, i) => '<numFmt numFmtId="' + (164 + i) + '" formatCode="' + x(c) + '"/>').join("") + "</numFmts>" : "") +
    '<fonts count="' + schriften.length + '">' + schriften.join("") + "</fonts>" +
    '<fills count="' + fuellungen.length + '">' + fuellungen.join("") + "</fills>" +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border>' + ["left", "right", "top", "bottom"].map(s => "<" + s + ' style="thin"><color rgb="FF999999"/></' + s + ">").join("") + "<diagonal/></border></borders>" +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="' + xfs.length + '">' + xfs.join("") + "</cellXfs>" +
    '<cellStyles count="1"><cellStyle name="Standard" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  const namen = mappe.blaetter.map((b, i) => x(String(b.name || "Blatt" + (i + 1)).replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Blatt" + (i + 1)));
  const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>' +
    namen.map((n, i) => '<sheet name="' + n + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join("") + '</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>';
  const wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    namen.map((n, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join("") +
    '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  const u = fflate.strToU8;
  const dateien = {
    "[Content_Types].xml": u('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      namen.map((n, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("") + "</Types>"),
    "_rels/.rels": u('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    "xl/workbook.xml": u(workbook),
    "xl/_rels/workbook.xml.rels": u(wbRels),
    "xl/styles.xml": u(styles)
  };
  blaetter.forEach((b, i) => { dateien["xl/worksheets/sheet" + (i + 1) + ".xml"] = u(b); });
  return fflate.zipSync(dateien, { level: 6 });
}

/* ---------- Lesen ---------- */

// Ohne DOMParser (geht auch in node): einfache XML-Helfer
const attr = (tag, n) => { const m = new RegExp("\\b" + n + '="([^"]*)"').exec(tag); return m ? m[1] : null; };
const ent = (s) => String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16))).replace(/&amp;/g, "&");
const texte = (xml) => { let s = ""; xml.replace(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, (m, t) => { s += ent(t); }); return s; };

export function lesen(daten, fflate) {
  const z = fflate.unzipSync(daten instanceof Uint8Array ? daten : new Uint8Array(daten));
  const txt = (n) => z[n] ? fflate.strFromU8(z[n]) : "";
  const wb = txt("xl/workbook.xml"), rels = txt("xl/_rels/workbook.xml.rels");
  if (!wb) throw new Error("keine-xlsx");
  const ziel = {}; rels.replace(/<Relationship\b[^>]*>/g, (t) => { ziel[attr(t, "Id")] = attr(t, "Target"); });
  const geteilt = []; txt("xl/sharedStrings.xml").replace(/<si>([\s\S]*?)<\/si>/g, (m, inh) => { geteilt.push(texte(inh)); });
  // Zahlformate der Stile (für Prozent/Datum/Euro)
  const st = txt("xl/styles.xml"), eigene = {};
  st.replace(/<numFmt\b[^>]*>/g, (t) => { eigene[attr(t, "numFmtId")] = ent(attr(t, "formatCode") || ""); });
  const xfs = []; const cx = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(st); if (cx) cx[1].replace(/<xf\b[^>]*>/g, (t) => { xfs.push(Number(attr(t, "numFmtId") || 0)); });
  const fonts = []; const fx = /<fonts[^>]*>([\s\S]*?)<\/fonts>/.exec(st); if (fx) fx[1].replace(/<font>([\s\S]*?)<\/font>|<font\/>/g, (m, inh) => { fonts.push({ b: /<b\/>/.test(inh || ""), i: /<i\/>/.test(inh || "") }); });
  const xfFont = []; if (cx) cx[1].replace(/<xf\b[^>]*>/g, (t) => { xfFont.push(Number(attr(t, "fontId") || 0)); });
  const formatVon = (s) => {
    const id = xfs[s]; if (id == null) return null;
    if (id === 9 || id === 10) return "proz";
    if ((id >= 14 && id <= 17) || id === 22) return "datum";
    const code = eigene[id] || "";
    if (/€|\[\$€/.test(code)) return "eur";
    if (/%/.test(code)) return "proz";
    if (/[dy]/i.test(code.replace(/"[^"]*"/g, "")) && !/0/.test(code)) return "datum";
    return null;
  };
  const blaetter = [];
  wb.replace(/<sheet\b[^>]*>/g, (t) => {
    const name = ent(attr(t, "name") || "Blatt"), rid = attr(t, "r:id");
    let pfad = ziel[rid] || ""; pfad = pfad.replace(/^\/?xl\//, ""); pfad = "xl/" + pfad.replace(/^\//, "");
    const xml = txt(pfad), zellen = {}, spalten = {};
    xml.replace(/<col\b[^>]*>/g, (c) => { const a = Number(attr(c, "min")), b = Number(attr(c, "max")), w = Number(attr(c, "width")); if (a && w && b - a < 30) for (let i = a; i <= b; i++) spalten[F.spalteName(i - 1)] = Math.round(w * 7); });
    xml.replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (m, kopf, inh = "") => {
      const r = attr(kopf, "r"); if (!r) return;
      const typ = attr(kopf, "t"), s = attr(kopf, "s"), f = /<f\b[^>]*>([\s\S]*?)<\/f>/.exec(inh), v = /<v>([\s\S]*?)<\/v>/.exec(inh);
      const zelle = {};
      if (f && f[1]) zelle.v = F.vonExcel(ent(f[1]));
      else if (typ === "s") zelle.v = geteilt[Number(v && v[1])] || "";
      else if (typ === "inlineStr") zelle.v = texte(inh);
      else if (typ === "b") zelle.v = v && v[1] === "1" ? "WAHR" : "FALSCH";
      else if (typ === "str" || typ === "e") zelle.v = v ? ent(v[1]) : "";
      else if (v) zelle.v = Number(v[1]);
      else return;
      const fmt = s != null ? formatVon(Number(s)) : null, font = s != null ? fonts[xfFont[Number(s)]] : null;
      if (fmt || (font && (font.b || font.i))) zelle.f = Object.assign({}, fmt ? { format: fmt } : {}, font && font.b ? { b: 1 } : {}, font && font.i ? { i: 1 } : {});
      if (typeof zelle.v === "number") zelle.v = zelle.f && zelle.f.format === "datum" ? F.anzeigen(zelle.v, "datum") : String(zelle.v).replace(".", ",");
      zellen[r.replace(/\$/g, "")] = zelle;
    });
    const pane = /<pane\b[^>]*state="frozen"[^>]*>/.exec(xml);
    blaetter.push({ name, zellen, spalten, fix: pane ? { z: Number(attr(pane[0], "ySplit") || 0), s: Number(attr(pane[0], "xSplit") || 0) } : { z: 0, s: 0 } });
  });
  return { blaetter };
}

/* ---------- CSV ---------- */

export function csvSchreiben(blatt, mappe) {
  const r = F.alleRechnen(mappe);
  let maxZ = -1, maxS = -1;
  for (const n of Object.keys(blatt.zellen)) { const p = F.zelleLesen(n); if (p && blatt.zellen[n].v !== "") { maxZ = Math.max(maxZ, p.z); maxS = Math.max(maxS, p.s); } }
  const zeilen = [];
  for (let z = 0; z <= maxZ; z++) {
    const reihe = [];
    for (let s = 0; s <= maxS; s++) {
      const n = F.zelleName(z, s), c = blatt.zellen[n];
      const w = c ? r.wert(blatt.name, n) : "";
      let t = F.anzeigen(w, F.formatVon(c), c && c.f && c.f.stellen);
      if (/[;"\n]/.test(t)) t = '"' + t.replace(/"/g, '""') + '"';
      reihe.push(t);
    }
    zeilen.push(reihe.join(";"));
  }
  return "﻿" + zeilen.join("\r\n");
}

export function csvLesen(text) {
  text = String(text).replace(/^﻿/, "");
  const erste = text.split(/\r?\n/)[0] || "";
  const trenner = [";", "\t", ","].sort((a, b) => erste.split(b).length - erste.split(a).length)[0];
  const zellen = {}; let z = 0, s = 0, feld = "", inQ = false;
  const ablegen = () => { if (feld !== "") zellen[F.zelleName(z, s)] = { v: feld }; feld = ""; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"' && text[i + 1] === '"') { feld += '"'; i++; } else if (c === '"') inQ = false; else feld += c; continue; }
    if (c === '"') { inQ = true; continue; }
    if (c === trenner) { ablegen(); s++; continue; }
    if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; ablegen(); z++; s = 0; continue; }
    feld += c;
  }
  ablegen();
  // Englische Zahlen (1.5) bei Komma-Trenner in deutsche umwandeln
  if (trenner === ",") for (const c of Object.values(zellen)) if (/^-?\d+\.\d+$/.test(c.v)) c.v = c.v.replace(".", ",");
  return { name: "Blatt1", zellen, spalten: {}, fix: { z: 0, s: 0 } };
}
