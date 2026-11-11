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

  const dxfs = [];
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
    const mitDia = (b.diagramme || []).some(d => d.bereich);
    // bedingte Formatierung und Auswahllisten
    let cf = "", prio = 1;
    for (const r of b.regeln || []) {
      const ber = String(r.bereich || "").toUpperCase(); if (!/^[A-Z]+\d+(:[A-Z]+\d+)?$/.test(ber)) continue;
      const erste = ber.split(":")[0], num = (v) => { const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? String(n) : '"' + x(String(v)).replace(/"/g, "") + '"'; };
      if (r.art === "skala") { cf += '<conditionalFormatting sqref="' + ber + '"><cfRule type="colorScale" priority="' + (prio++) + '"><colorScale><cfvo type="min"/><cfvo type="percentile" val="50"/><cfvo type="max"/><color rgb="FF' + (r.umkehren ? "63BE7B" : "F8696B") + '"/><color rgb="FFFFEB84"/><color rgb="FF' + (r.umkehren ? "F8696B" : "63BE7B") + '"/></colorScale></cfRule></conditionalFormatting>'; continue; }
      if (r.art === "balken") { cf += '<conditionalFormatting sqref="' + ber + '"><cfRule type="dataBar" priority="' + (prio++) + '"><dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="FF' + (hex6(r.farbe) || "9CC3FF") + '"/></dataBar></cfRule></conditionalFormatting>'; continue; }
      const dxf = dxfs.push('<dxf>' + (r.schrift ? '<font>' + (r.fett ? "<b/>" : "") + '<color rgb="FF' + hex6(r.schrift) + '"/></font>' : "") + (r.farbe ? '<fill><patternFill patternType="solid"><fgColor rgb="FF' + hex6(r.farbe) + '"/><bgColor rgb="FF' + hex6(r.farbe) + '"/></patternFill></fill>' : "") + "</dxf>") - 1;
      if (r.art === "enthaelt") cf += '<conditionalFormatting sqref="' + ber + '"><cfRule type="containsText" dxfId="' + dxf + '" priority="' + (prio++) + '" operator="containsText" text="' + x(r.wert) + '"><formula>NOT(ISERROR(SEARCH("' + x(String(r.wert).replace(/"/g, "")) + '",' + erste + ')))</formula></cfRule></conditionalFormatting>';
      else { const op = { groesser: "greaterThan", kleiner: "lessThan", zwischen: "between", gleich: "equal" }[r.art]; if (!op) continue; cf += '<conditionalFormatting sqref="' + ber + '"><cfRule type="cellIs" dxfId="' + dxf + '" priority="' + (prio++) + '" operator="' + op + '"><formula>' + num(r.wert) + "</formula>" + (r.art === "zwischen" ? "<formula>" + num(r.wert2) + "</formula>" : "") + "</cfRule></conditionalFormatting>"; }
    }
    const dv = (b.auswahl || []).filter(a => /^[A-Z]+\d+(:[A-Z]+\d+)?$/.test(a.bereich) && a.werte.length);
    const dvXml = dv.length ? '<dataValidations count="' + dv.length + '">' + dv.map(a => '<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="' + a.bereich + '"><formula1>"' + x(a.werte.map(w => String(w).replace(/[",]/g, " ")).join(",")).slice(0, 250) + '"</formula1></dataValidation>').join("") + "</dataValidations>" : "";
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      fix + '<sheetFormatPr defaultRowHeight="15"/>' + (spalten ? "<cols>" + spalten + "</cols>" : "") + "<sheetData>" + xml + "</sheetData>" + cf + dvXml + (mitDia ? '<drawing r:id="rIdD1"/>' : "") + "</worksheet>";
  });
  // Diagramme: pro Blatt eine Zeichnung, darin die Diagramme (Daten bleiben mit den Zellen verknüpft)
  const diaDateien = {}, diaTypen = []; let chartNr = 0;
  mappe.blaetter.forEach((b, bi) => {
    const liste = (b.diagramme || []).filter(d => d.bereich); if (!liste.length) return;
    const blattName = String(b.name || "Blatt" + (bi + 1)).replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Blatt" + (bi + 1);
    let anker = "", drels = "";
    liste.forEach((d, k) => {
      const c = chartXml(d, blattName, b.name, rechnung); if (!c) return;
      chartNr++; diaDateien["xl/charts/chart" + chartNr + ".xml"] = c; diaTypen.push('<Override PartName="/xl/charts/chart' + chartNr + '.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>');
      const spalte = maxSpalte(b) + 2, zeile = k * 20 + 1;
      anker += '<xdr:twoCellAnchor><xdr:from><xdr:col>' + spalte + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + zeile + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>' + (spalte + 8) + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + (zeile + 18) + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>' +
        '<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="' + (k + 2) + '" name="Diagramm ' + (k + 1) + '"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rIdC' + (k + 1) + '"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>';
      drels += '<Relationship Id="rIdC' + (k + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart' + chartNr + '.xml"/>';
    });
    if (!anker) return;
    diaDateien["xl/drawings/drawing" + (bi + 1) + ".xml"] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' + anker + "</xdr:wsDr>";
    diaDateien["xl/drawings/_rels/drawing" + (bi + 1) + ".xml.rels"] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + drels + "</Relationships>";
    diaDateien["xl/worksheets/_rels/sheet" + (bi + 1) + ".xml.rels"] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdD1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing' + (bi + 1) + '.xml"/></Relationships>';
    diaTypen.push('<Override PartName="/xl/drawings/drawing' + (bi + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>');
  });
  // Blätter ohne gültiges Diagramm dürfen kein <drawing> haben
  blaetter.forEach((xmlB, i) => { if (!diaDateien["xl/drawings/drawing" + (i + 1) + ".xml"]) blaetter[i] = xmlB.replace('<drawing r:id="rIdD1"/>', ""); });

  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    (fmtListe.length ? '<numFmts count="' + fmtListe.length + '">' + fmtListe.map((c, i) => '<numFmt numFmtId="' + (164 + i) + '" formatCode="' + x(c) + '"/>').join("") + "</numFmts>" : "") +
    '<fonts count="' + schriften.length + '">' + schriften.join("") + "</fonts>" +
    '<fills count="' + fuellungen.length + '">' + fuellungen.join("") + "</fills>" +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border>' + ["left", "right", "top", "bottom"].map(s => "<" + s + ' style="thin"><color rgb="FF999999"/></' + s + ">").join("") + "<diagonal/></border></borders>" +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="' + xfs.length + '">' + xfs.join("") + "</cellXfs>" +
    '<cellStyles count="1"><cellStyle name="Standard" xfId="0" builtinId="0"/></cellStyles>' + (dxfs.length ? '<dxfs count="' + dxfs.length + '">' + dxfs.join("") + "</dxfs>" : "") + "</styleSheet>";
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
      namen.map((n, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("") + diaTypen.join("") + "</Types>"),
    "_rels/.rels": u('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    "xl/workbook.xml": u(workbook),
    "xl/_rels/workbook.xml.rels": u(wbRels),
    "xl/styles.xml": u(styles)
  };
  blaetter.forEach((b, i) => { dateien["xl/worksheets/sheet" + (i + 1) + ".xml"] = u(b); });
  for (const [k, v] of Object.entries(diaDateien)) dateien[k] = u(v);
  return fflate.zipSync(dateien, { level: 6 });
}

/* ---------- Diagramme für Excel ---------- */
const DIA_FARBEN = ["2F6FDB", "FF8A3C", "1A8F4C", "C93A3A", "6D3FD6", "0F766E", "B8235A", "A36B00"];
function maxSpalte(b) { let m = 0; for (const n of Object.keys(b.zellen || {})) { const p = F.zelleLesen(n); if (p && p.s > m) m = p.s; } return m; }
// gleiche Regeln wie diagramm.js: erste Zeile = Namen (wenn Text), erste Spalte = Beschriftungen (Text oder steigende Zahlen)
export function diagrammBereich(rechnung, blatt, bereich) {
  const [a, b] = String(bereich).split(":"), p = F.zelleLesen(a), q = F.zelleLesen(b || a);
  if (!p || !q) return null;
  const z0 = Math.min(p.z, q.z), z1 = Math.max(p.z, q.z), s0 = Math.min(p.s, q.s), s1 = Math.max(p.s, q.s), w = (z, s) => rechnung.wert(blatt, F.zelleName(z, s));
  const kopf = s1 > s0 || z1 > z0 ? Array.from({ length: s1 - s0 + 1 }, (_, i) => w(z0, s0 + i)).slice(1).some(v => typeof v === "string" && v !== "") : false;
  const erste = Array.from({ length: z1 - z0 + 1 }, (_, i) => w(z0 + i, s0)).slice(kopf ? 1 : 0);
  const steigend = erste.length > 1 && erste.every((v, i) => typeof v === "number" && (i === 0 || v > erste[i - 1]));
  const links = s1 > s0 && (erste.some(v => typeof v === "string" && v !== "") || steigend);
  return { z0, z1, s0, s1, kopf, links, zs: kopf ? z0 + 1 : z0, ss: links ? s0 + 1 : s0, w };
}
function chartXml(d, blattName, blattIntern, rechnung) {
  const g = diagrammBereich(rechnung, blattIntern, d.bereich); if (!g || g.ss > g.s1 || g.zs > g.z1) return null;
  const ref = (s, za, zb) => "'" + blattName.replace(/'/g, "''") + "'!$" + F.spalteName(s) + "$" + (za + 1) + (zb != null && zb !== za ? ":$" + F.spalteName(s) + "$" + (zb + 1) : "");
  const n = g.z1 - g.zs + 1;
  const zahlen = (s) => '<c:numRef><c:f>' + x(ref(s, g.zs, g.z1)) + '</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="' + n + '"/>' + Array.from({ length: n }, (_, i) => { const v = g.w(g.zs + i, s); return typeof v === "number" ? '<c:pt idx="' + i + '"><c:v>' + v + "</c:v></c:pt>" : ""; }).join("") + "</c:numCache></c:numRef>";
  const texte = (s) => '<c:strRef><c:f>' + x(ref(s, g.zs, g.z1)) + '</c:f><c:strCache><c:ptCount val="' + n + '"/>' + Array.from({ length: n }, (_, i) => '<c:pt idx="' + i + '"><c:v>' + x(F.anzeigen(g.w(g.zs + i, s))) + "</c:v></c:pt>").join("") + "</c:strCache></c:strRef>";
  const art = d.art || "saeule", punkt = art === "punkt", kreis = art === "kreis";
  let reihen = "";
  for (let s = g.ss, i = 0; s <= g.s1; s++, i++) {
    const farbe = DIA_FARBEN[i % DIA_FARBEN.length];
    const name = g.kopf ? '<c:tx><c:strRef><c:f>' + x(ref(s, g.z0)) + '</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>' + x(F.anzeigen(g.w(g.z0, s))) + "</c:v></c:pt></c:strCache></c:strRef></c:tx>" : "";
    const sp = punkt ? '<c:spPr><a:ln w="28575"><a:noFill/></a:ln></c:spPr>' : art === "linie" ? '<c:spPr><a:ln w="28575"><a:solidFill><a:srgbClr val="' + farbe + '"/></a:solidFill></a:ln></c:spPr>' : kreis ? "" : '<c:spPr><a:solidFill><a:srgbClr val="' + farbe + '"/></a:solidFill></c:spPr>';
    const kreisFarben = kreis ? Array.from({ length: n }, (_, k) => '<c:dPt><c:idx val="' + k + '"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="' + DIA_FARBEN[k % DIA_FARBEN.length] + '"/></a:solidFill></c:spPr></c:dPt>').join("") : "";
    const trend = punkt && d.trend !== false ? '<c:trendline><c:spPr><a:ln w="19050"><a:solidFill><a:srgbClr val="' + farbe + '"/></a:solidFill><a:prstDash val="dash"/></a:ln></c:spPr><c:trendlineType val="linear"/><c:dispRSqr val="0"/><c:dispEq val="1"/></c:trendline>' : "";
    reihen += '<c:ser><c:idx val="' + i + '"/><c:order val="' + i + '"/>' + name + sp + (punkt ? '<c:marker><c:symbol val="circle"/><c:size val="6"/><c:spPr><a:solidFill><a:srgbClr val="' + farbe + '"/></a:solidFill></c:spPr></c:marker>' : art === "linie" ? '<c:marker><c:symbol val="none"/></c:marker>' : "") + kreisFarben + trend +
      (punkt ? (g.links ? "<c:xVal>" + zahlen(g.s0) + "</c:xVal>" : "") + "<c:yVal>" + zahlen(s) + "</c:yVal>" + '<c:smooth val="0"/>' : (g.links ? "<c:cat>" + texte(g.s0) + "</c:cat>" : "") + "<c:val>" + zahlen(s) + "</c:val>" + (art === "linie" ? '<c:smooth val="0"/>' : "")) + "</c:ser>";
    if (kreis) break;
  }
  const achsen = '<c:axId val="111"/><c:axId val="222"/>';
  const achsXml = punkt ? '<c:valAx><c:axId val="111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:numFmt formatCode="General" sourceLinked="1"/><c:tickLblPos val="nextTo"/><c:crossAx val="222"/><c:crosses val="autoZero"/></c:valAx>' +
      '<c:valAx><c:axId val="222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="General" sourceLinked="1"/><c:tickLblPos val="nextTo"/><c:crossAx val="111"/><c:crosses val="autoZero"/></c:valAx>'
    : '<c:catAx><c:axId val="111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="' + (art === "balken" ? "l" : "b") + '"/><c:tickLblPos val="nextTo"/><c:crossAx val="222"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx>' +
      '<c:valAx><c:axId val="222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="' + (art === "balken" ? "b" : "l") + '"/><c:majorGridlines/><c:numFmt formatCode="General" sourceLinked="1"/><c:tickLblPos val="nextTo"/><c:crossAx val="111"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>';
  const plot = kreis ? '<c:pieChart><c:varyColors val="1"/>' + reihen + '<c:firstSliceAng val="0"/></c:pieChart>'
    : punkt ? '<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>' + reihen + achsen + "</c:scatterChart>" + achsXml
    : art === "linie" ? '<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>' + reihen + '<c:marker val="1"/>' + achsen + "</c:lineChart>" + achsXml
    : '<c:barChart><c:barDir val="' + (art === "balken" ? "bar" : "col") + '"/><c:grouping val="clustered"/><c:varyColors val="0"/>' + reihen + '<c:gapWidth val="80"/>' + achsen + "</c:barChart>" + achsXml;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:roundedCorners val="0"/><c:chart>' +
    (d.titel ? '<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>' + x(d.titel) + '</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>' : "") +
    '<c:autoTitleDeleted val="' + (d.titel ? 0 : 1) + '"/><c:plotArea><c:layout/>' + plot + '</c:plotArea><c:legend><c:legendPos val="' + (kreis ? "r" : "b") + '"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/></c:chart></c:chartSpace>';
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
