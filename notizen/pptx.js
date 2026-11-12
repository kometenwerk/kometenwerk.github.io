// FIDELIA Notizen · PowerPoint (.pptx) bauen – komplett im Browser, ohne fremde Server
// Folien sind 960 × 540 Punkte; 1 Punkt = 12700 EMU → genau das 16:9-Format von PowerPoint.

import * as K from "./folien-kern.js";

const FFLATE = "../shared/vendor/fflate-0.8.3/fflate.mjs";
const E = 12700;
const x = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const KOPF = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function hex(f) {
  if (!f) return null;
  let m = /^#([0-9a-f]{6})$/i.exec(f); if (m) return m[1].toUpperCase();
  m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(f); if (m) return (m[1] + m[1] + m[2] + m[2] + m[3] + m[3]).toUpperCase();
  m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(f); if (m && (m[4] === undefined || Number(m[4]) > 0)) return [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
  return null;
}
const fill = (f) => { const h = hex(f); return h ? '<a:solidFill><a:srgbClr val="' + h + '"/></a:solidFill>' : "<a:noFill/>"; };
const xfrm = (e, tag = "a:xfrm") => "<" + tag + (e.dreh ? ' rot="' + Math.round(e.dreh * 60000) + '"' : "") + '><a:off x="' + Math.round(e.x * E) + '" y="' + Math.round(e.y * E) + '"/><a:ext cx="' + Math.max(1, Math.round(e.w * E)) + '" cy="' + Math.max(0, Math.round(e.h * E)) + '"/></' + tag + ">";

/* ---------- Text (HTML → Absätze) ---------- */

function absaetze(html, basis) {
  const d = document.createElement("div"); d.innerHTML = html || "";
  const out = [];
  let akt = null;
  const neu = (opt) => { akt = Object.assign({ runs: [] }, opt); out.push(akt); };
  const lauf = (n, fmt, liste) => {
    n.childNodes.forEach(k => {
      if (k.nodeType === 3) { const t = k.textContent.replace(/\s+/g, " "); if (t.trim() || (akt && akt.runs.length)) { if (!akt) neu({ liste }); akt.runs.push({ t, f: fmt }); } return; }
      if (k.nodeType !== 1) return;
      const tag = k.tagName, st = k.style || {}, f = Object.assign({}, fmt);
      if (tag === "BR") { neu({ liste: akt ? akt.liste : liste, ausr: akt && akt.ausr }); return; }
      if (/^(P|DIV|H[1-6]|BLOCKQUOTE)$/.test(tag)) { neu({ liste, ausr: st.textAlign }); if (/^H/.test(tag)) f.b = true; lauf(k, f, liste); akt = null; return; }
      if (tag === "UL" || tag === "OL") { k.querySelectorAll(":scope > li").forEach((li, i) => { neu({ liste: tag === "UL" ? "punkt" : "zahl", ausr: li.style.textAlign }); lauf(li, f, tag === "UL" ? "punkt" : "zahl"); akt = null; }); return; }
      if (tag === "B" || tag === "STRONG" || /bold|[6-9]00/.test(st.fontWeight || "")) f.b = true;
      if (tag === "I" || tag === "EM" || st.fontStyle === "italic") f.i = true;
      if (tag === "U" || /underline/.test(st.textDecoration || st.textDecorationLine || "")) f.u = true;
      if (tag === "S" || tag === "STRIKE" || /line-through/.test(st.textDecoration || "")) f.s = true;
      if (tag === "SUB") f.sub = true; if (tag === "SUP") f.sup = true;
      if (st.color) f.farbe = hex(st.color) || f.farbe;
      if (tag === "FONT" && k.getAttribute("color")) f.farbe = hex(k.getAttribute("color")) || f.farbe;
      if (st.backgroundColor) f.marker = hex(st.backgroundColor) || f.marker;
      if (st.fontSize && /em$/.test(st.fontSize)) f.pt = (fmt.pt || basis) * parseFloat(st.fontSize);
      else if (st.fontSize && /px$/.test(st.fontSize)) f.pt = parseFloat(st.fontSize);
      if (k.classList && k.classList.contains("formel")) { if (!akt) neu({ liste }); akt.runs.push({ t: k.dataset.tex || k.textContent, f: Object.assign({}, f, { i: true, font: "Cambria Math" }) }); return; }
      lauf(k, f, liste);
    });
  };
  lauf(d, {}, null);
  return out.length ? out : [{ runs: [] }];
}
function rPr(f, basis, farbe, schrift) {
  const pt = f.pt || basis;
  return '<a:rPr lang="de-DE" sz="' + Math.round(pt * 100) + '"' + (f.b ? ' b="1"' : "") + (f.i ? ' i="1"' : "") + (f.u ? ' u="sng"' : "") + (f.s ? ' strike="sngStrike"' : "") + (f.sub ? ' baseline="-25000"' : f.sup ? ' baseline="30000"' : "") + ' dirty="0">' +
    '<a:solidFill><a:srgbClr val="' + (f.farbe || farbe) + '"/></a:solidFill>' + (f.marker ? '<a:highlight><a:srgbClr val="' + f.marker + '"/></a:highlight>' : "") +
    '<a:latin typeface="' + x(f.font || schrift) + '"/><a:cs typeface="' + x(f.font || schrift) + '"/></a:rPr>';
}
function textKoerper(html, { basis, farbe, schrift, ausr, anker = "t", akzent, rand = 0 }) {
  const ps = absaetze(html, basis);
  const algn = (a) => ({ center: "ctr", right: "r", justify: "just", c: "ctr", r: "r" })[a] || null;
  return '<p:txBody><a:bodyPr wrap="square" lIns="' + rand + '" tIns="' + rand + '" rIns="' + rand + '" bIns="' + rand + '" anchor="' + anker + '" rtlCol="0"><a:normAutofit/></a:bodyPr><a:lstStyle/>' +
    ps.map(p => {
      const al = algn(p.ausr) || algn(ausr);
      const bu = p.liste === "punkt" ? '<a:buClr><a:srgbClr val="' + akzent + '"/></a:buClr><a:buFont typeface="Arial"/><a:buChar char="•"/>' : p.liste === "zahl" ? '<a:buClr><a:srgbClr val="' + akzent + '"/></a:buClr><a:buFont typeface="+mj-lt"/><a:buAutoNum type="arabicPeriod"/>' : "<a:buNone/>";
      const ppr = '<a:pPr' + (p.liste ? ' marL="' + Math.round(basis * 1.1 * E) + '" indent="-' + Math.round(basis * 1.1 * E) + '"' : ' marL="0" indent="0"') + (al ? ' algn="' + al + '"' : "") + '><a:spcBef><a:spcPts val="' + (p.liste ? Math.round(basis * 25) : 0) + '"/></a:spcBef>' + bu + "</a:pPr>";
      const runs = p.runs.filter(r => r.t !== "").map(r => "<a:r>" + rPr(r.f, basis, farbe, schrift) + "<a:t>" + x(r.t) + "</a:t></a:r>").join("");
      return "<a:p>" + ppr + runs + '<a:endParaRPr lang="de-DE" sz="' + Math.round(basis * 100) + '" dirty="0"/></a:p>';
    }).join("") + "</p:txBody>";
}

/* ---------- Formen ---------- */

const PRST = { rechteck: "rect", rund: "roundRect", kreis: "ellipse", dreieck: "triangle", pfeil: "rightArrow", linie: "line", stern: "star5", blase: "wedgeRoundRectCallout" };

/* ---------- Eine Folie ---------- */

async function folieXml(folie, d, bilder, nr) {
  let id = 2, sp = "";
  const name = (n) => '<p:cNvPr id="' + (id++) + '" name="' + x(n) + " " + id + '"/>';
  const schrift = d.schrift === "Space Grotesk" ? "Arial" : d.schrift, schriftT = d.schriftT === "Space Grotesk" ? "Arial" : d.schriftT;
  const akzent = hex(d.akzent);
  const rels = [];
  // Hintergrund
  const bg = folie.hg ? fill(folie.hg) : '<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:srgbClr val="' + hex(d.hg) + '"/></a:gs><a:gs pos="55000"><a:srgbClr val="' + hex(d.hg) + '"/></a:gs><a:gs pos="100000"><a:srgbClr val="' + hex(d.hg2) + '"/></a:gs></a:gsLst><a:lin ang="3000000" scaled="0"/></a:gradFill>';
  // Etwas Deko vom Design (einfach gehalten)
  if (!folie.hg && d.deko === "balken") sp += '<p:sp><p:nvSpPr>' + name("Deko") + '<p:cNvSpPr/><p:nvPr userDrawn="1"/></p:nvSpPr><p:spPr>' + xfrm({ x: 0, y: 0, w: 14, h: 540 }) + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' + fill(d.akzent) + '<a:ln><a:noFill/></a:ln></p:spPr></p:sp>';
  if (!folie.hg && d.deko === "linie") sp += '<p:sp><p:nvSpPr>' + name("Deko") + '<p:cNvSpPr/><p:nvPr userDrawn="1"/></p:nvSpPr><p:spPr>' + xfrm({ x: 60, y: 503, w: 840, h: 2 }) + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' + fill(d.akzent) + '<a:ln><a:noFill/></a:ln></p:spPr></p:sp>';
  if (!folie.hg && d.deko === "rahmen") sp += '<p:sp><p:nvSpPr>' + name("Deko") + '<p:cNvSpPr/><p:nvPr userDrawn="1"/></p:nvSpPr><p:spPr>' + xfrm({ x: 16, y: 16, w: 928, h: 508 }) + '<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 2000"/></a:avLst></a:prstGeom><a:noFill/><a:ln w="38100">' + fill(d.akzent) + "</a:ln></p:spPr></p:sp>";

  // Folienmaster: Fußzeile und Foliennummer
  if ((d.fuss || d.nummer) && !folie.ohneFuss) {
    const fussText = (t, pos, ausr) => "<p:sp><p:nvSpPr>" + name("Fußzeile") + '<p:cNvSpPr txBox="1"/><p:nvPr userDrawn="1"/></p:nvSpPr><p:spPr>' + xfrm(pos) + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>' + textKoerper("<p>" + x(t) + "</p>", { basis: 14, farbe: hex(d.text), schrift, ausr, anker: "b", akzent, rand: 0 }) + "</p:sp>";
    if (d.fuss) sp += fussText(d.fuss, { x: 60, y: 506, w: 700, h: 26 }, "");
    if (d.nummer) sp += fussText(String(nr), { x: 800, y: 506, w: 100, h: 26 }, "r");
  }
  const anims = [];
  for (const e of folie.el || []) {
    if (e.aus) continue;
    if (e.anim && (e.typ !== "bild" || e.src) && (e.typ !== "tabelle" || (e.zeilen || []).length)) anims.push({ spid: id, schritt: e.anim });
    if (e.typ === "text") {
      const basis = e.groesse || K.GROESSE[e.rolle] || K.GROESSE.frei, titel = e.rolle === "titel" || e.rolle === "untertitel";
      const farbe = hex(e.farbe) || hex(e.rolle === "titel" ? d.titel : d.text);
      const html = e.rolle === "titel" ? "<b>" + (e.html || "") + "</b>" : e.html;
      sp += "<p:sp><p:nvSpPr>" + name(e.rolle === "titel" ? "Titel" : "Text") + '<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>' + xfrm(e) + '<a:prstGeom prst="' + (e.fuell ? "roundRect" : "rect") + '"><a:avLst/></a:prstGeom>' + fill(e.fuell) + "</p:spPr>" +
        textKoerper(e.rolle === "titel" ? (e.html || "").replace(/<(p|li)([^>]*)>/g, "<$1$2><b>").replace(/<\/(p|li)>/g, "</b></$1>") : html, { basis, farbe, schrift: titel ? schriftT : schrift, ausr: e.ausr, anker: titel ? "ctr" : "t", akzent, rand: e.fuell ? 127000 : 0 }) + "</p:sp>";
    } else if (e.typ === "form") {
      const prst = PRST[e.art] || "rect";
      if (e.art === "linie") {
        sp += "<p:cxnSp><p:nvCxnSpPr>" + name("Linie") + "<p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr>" + xfrm({ x: e.x, y: e.y + e.h / 2, w: e.w, h: 0, dreh: e.dreh }) + '<a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="' + Math.round(Math.max(2, e.randBreite || 3) * E) + '" cap="rnd">' + fill(e.rand || d.text) + "</a:ln></p:spPr></p:cxnSp>";
        continue;
      }
      sp += "<p:sp><p:nvSpPr>" + name("Form") + "<p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>" + xfrm(e) + '<a:prstGeom prst="' + prst + '"><a:avLst/></a:prstGeom>' + fill(e.fuell) +
        (e.rand && e.rand !== "none" && e.randBreite ? '<a:ln w="' + Math.round(e.randBreite * E) + '">' + fill(e.rand) + "</a:ln>" : "<a:ln><a:noFill/></a:ln>") + "</p:spPr>" +
        textKoerper(e.html || "", { basis: e.groesse || 22, farbe: hex(e.farbe) || "FFFFFF", schrift, ausr: e.ausr || "c", anker: "ctr", akzent, rand: 91440 }) + "</p:sp>";
    } else if (e.typ === "bild" && e.src) {
      const m = /^data:image\/(png|jpe?g);base64,(.+)$/.exec(e.src); if (!m) continue;
      const nrB = bilder.length + 1, endung = m[1] === "png" ? "png" : "jpg";
      bilder.push({ name: "bild" + nrB + "." + endung, daten: m[2] });
      rels.push('<Relationship Id="rIdB' + nrB + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/bild' + nrB + "." + endung + '"/>');
      // Wie im Editor: Bild passend in den Rahmen (nicht verzerrt)
      const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = e.src; });
      let b = { x: e.x, y: e.y, w: e.w, h: e.h };
      if (img && img.width && !e.zuschnitt) { const v = img.width / img.height; if (e.w / e.h > v) { const w = e.h * v; b = { x: e.x + (e.w - w) / 2, y: e.y, w, h: e.h }; } else { const h = e.w / v; b = { x: e.x, y: e.y + (e.h - h) / 2, w: e.w, h }; } }
      b.dreh = e.dreh;
      sp += "<p:pic><p:nvPicPr>" + name("Bild") + '<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rIdB' + nrB + '"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>' + xfrm(b) + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>';
    } else if (e.typ === "tabelle" && (e.zeilen || []).length) {
      const sp0 = e.zeilen[0].length, cw = Math.round(e.w * E / sp0), rh = Math.round(e.h * E / e.zeilen.length), g = e.groesse || 18;
      const linie = (t) => "<a:" + t + ' w="12700"><a:solidFill><a:srgbClr val="' + (["0B111C", "0B3A5B", "20382C"].includes(hex(d.hg)) ? "8A94A6" : "9AA7BD") + '"/></a:solidFill></a:' + t + ">";
      sp += "<p:graphicFrame><p:nvGraphicFramePr>" + name("Tabelle") + '<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>' + xfrm(e, "p:xfrm") +
        '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr' + (e.kopf !== false ? ' firstRow="1"' : "") + ' bandRow="0"/><a:tblGrid>' + Array.from({ length: sp0 }, () => '<a:gridCol w="' + cw + '"/>').join("") + "</a:tblGrid>" +
        e.zeilen.map((r, i) => '<a:tr h="' + rh + '">' + r.map(c => { const kopf = i === 0 && e.kopf !== false; return '<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r>' + rPr({ b: kopf, farbe: kopf ? "FFFFFF" : null }, g, hex(d.text), schrift) + "<a:t>" + x(c) + '</a:t></a:r></a:p></a:txBody><a:tcPr marL="76200" marR="76200" marT="38100" marB="38100">' + linie("lnL") + linie("lnR") + linie("lnT") + linie("lnB") + (kopf ? fill(d.akzent) : "<a:noFill/>") + "</a:tcPr></a:tc>"; }).join("") + "</a:tr>").join("") +
        "</a:tbl></a:graphicData></a:graphic></p:graphicFrame>";
    } else if (e.typ === "formel") {
      sp += "<p:sp><p:nvSpPr>" + name("Formel") + '<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>' + xfrm(e) + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>' +
        textKoerper('<p><span class="formel" data-tex="' + x(e.tex) + '"></span></p>', { basis: e.groesse || 32, farbe: hex(e.farbe) || hex(d.text), schrift, ausr: e.ausr || "c", anker: "ctr", akzent }) + "</p:sp>";
    }
  }
  const ueber = { blende: "<p:fade/>", schieben: '<p:push dir="l"/>', zoom: "<p:zoom/>", wuerfel: '<p:wipe dir="r"/>' }[folie.ueber];
  const xml = KOPF + "<p:sld " + NS + "><p:cSld><p:bg><p:bgPr>" + bg + "<a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id=\"1\" name=\"\"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"0\" cy=\"0\"/><a:chOff x=\"0\" y=\"0\"/><a:chExt cx=\"0\" cy=\"0\"/></a:xfrm></p:grpSpPr>" + sp +
    "</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>" + (ueber ? '<p:transition spd="med">' + ueber + "</p:transition>" : "") + zeitplan(anims) + "</p:sld>";
  if (folie.notiz && folie.notiz.trim()) rels.push('<Relationship Id="rIdN" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide' + nr + '.xml"/>');
  const relXml = KOPF + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>' + rels.join("") + "</Relationships>";
  return { xml, relXml };
}

/* ---------- Animationen (beim Klicken einblenden) und Sprechernotizen ---------- */

export function zeitplan(anims) {
  if (!anims.length) return "";
  let n = 3;
  const schritte = anims.slice().sort((a, b) => a.schritt - b.schritt).map(a => {
    const c = n; n += 5;
    return '<p:par><p:cTn id="' + c + '" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="' + (c + 1) + '" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>' +
      '<p:par><p:cTn id="' + (c + 2) + '" presetID="10" presetClass="entr" presetSubtype="0" fill="hold" nodeType="clickEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>' +
      '<p:set><p:cBhvr><p:cTn id="' + (c + 3) + '" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="' + a.spid + '"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>' +
      '<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="' + (c + 4) + '" dur="500"/><p:tgtEl><p:spTgt spid="' + a.spid + '"/></p:tgtEl></p:cBhvr></p:animEffect>' +
      "</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>";
  }).join("");
  return '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>' + schritte +
    '</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>';
}
function notizXml(text) {
  const absaetze = String(text).split("\n").map(z => '<a:p><a:r><a:rPr lang="de-DE" dirty="0"/><a:t>' + x(z) + "</a:t></a:r></a:p>").join("");
  return KOPF + "<p:notes " + NS + '><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' +
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Folienbild"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>' +
    '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notizen"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>' + absaetze + "</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>";
}

/* ---------- Feste Teile (Master, Layout, Theme) ---------- */

function theme(d) {
  const f = (n) => n === "Space Grotesk" ? "Arial" : n;
  return KOPF + '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="FIDELIA"><a:themeElements>' +
    '<a:clrScheme name="FIDELIA"><a:dk1><a:srgbClr val="' + hex(d.text) + '"/></a:dk1><a:lt1><a:srgbClr val="' + hex(d.hg) + '"/></a:lt1><a:dk2><a:srgbClr val="' + hex(d.titel) + '"/></a:dk2><a:lt2><a:srgbClr val="' + hex(d.hg2) + '"/></a:lt2>' +
    '<a:accent1><a:srgbClr val="' + hex(d.akzent) + '"/></a:accent1><a:accent2><a:srgbClr val="FF8A3C"/></a:accent2><a:accent3><a:srgbClr val="1A8F4C"/></a:accent3><a:accent4><a:srgbClr val="C93A3A"/></a:accent4><a:accent5><a:srgbClr val="6D3FD6"/></a:accent5><a:accent6><a:srgbClr val="0F766E"/></a:accent6>' +
    '<a:hlink><a:srgbClr val="2F6FDB"/></a:hlink><a:folHlink><a:srgbClr val="6D3FD6"/></a:folHlink></a:clrScheme>' +
    '<a:fontScheme name="FIDELIA"><a:majorFont><a:latin typeface="' + x(f(d.schriftT)) + '"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="' + x(f(d.schrift)) + '"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>' +
    '<a:fmtScheme name="FIDELIA"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>' +
    '<a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="25400"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="38100"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>' +
    "<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>" +
    '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>' +
    "</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>";
}
const LEERER_BAUM = '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree>';
const MASTER = KOPF + "<p:sldMaster " + NS + '><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>' + LEERER_BAUM + '</p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="4000"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="2400"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>';
const LAYOUT = KOPF + "<p:sldLayout " + NS + ' type="blank" preserve="1"><p:cSld name="Leer">' + LEERER_BAUM + "</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>";
const REL = (id, typ, ziel) => '<Relationship Id="' + id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/' + typ + '" Target="' + ziel + '"/>';

/* ---------- Alles zusammen ---------- */

export async function alsPptx(A, s) {
  const fflate = await import(FFLATE), u = fflate.strToU8;
  const d = K.design(s.design), bilder = [], dateien = {};
  const folien = s.folien || [];
  for (let i = 0; i < folien.length; i++) {
    const { xml, relXml } = await folieXml(folien[i], d, bilder, i + 1);
    dateien["ppt/slides/slide" + (i + 1) + ".xml"] = u(xml);
    dateien["ppt/slides/_rels/slide" + (i + 1) + ".xml.rels"] = u(relXml);
    if (folien[i].notiz && folien[i].notiz.trim()) {
      dateien["ppt/notesSlides/notesSlide" + (i + 1) + ".xml"] = u(notizXml(folien[i].notiz));
      dateien["ppt/notesSlides/_rels/notesSlide" + (i + 1) + ".xml.rels"] = u(KOPF + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + REL("rId1", "notesMaster", "../notesMasters/notesMaster1.xml") + REL("rId2", "slide", "../slides/slide" + (i + 1) + ".xml") + "</Relationships>");
    }
  }
  const mitNotizen = folien.some(f => f.notiz && f.notiz.trim());
  bilder.forEach(b => { const s2 = atob(b.daten), a = new Uint8Array(s2.length); for (let i = 0; i < s2.length; i++) a[i] = s2.charCodeAt(i); dateien["ppt/media/" + b.name] = a; });
  dateien["[Content_Types].xml"] = u(KOPF + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/>' +
    '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
    '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    folien.map((f, i) => '<Override PartName="/ppt/slides/slide' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>' + (f.notiz && f.notiz.trim() ? '<Override PartName="/ppt/notesSlides/notesSlide' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>' : "")).join("") +
    (mitNotizen ? '<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/><Override PartName="/ppt/theme/theme2.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' : "") + "</Types>");
  dateien["_rels/.rels"] = u(KOPF + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + REL("rId1", "officeDocument", "ppt/presentation.xml") + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
  dateien["docProps/core.xml"] = u(KOPF + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + x(s.titel || "Präsentation") + '</dc:title><dc:creator>FIDELIA Notizen</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + new Date().toISOString().slice(0, 19) + "Z</dcterms:created></cp:coreProperties>");
  dateien["ppt/presentation.xml"] = u(KOPF + "<p:presentation " + NS + ' saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' + (mitNotizen ? '<p:notesMasterIdLst><p:notesMasterId r:id="rId3"/></p:notesMasterIdLst>' : "") + '<p:sldIdLst>' +
    folien.map((f, i) => '<p:sldId id="' + (256 + i) + '" r:id="rId' + (i + 10) + '"/>').join("") + '</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>');
  dateien["ppt/_rels/presentation.xml.rels"] = u(KOPF + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + REL("rId1", "slideMaster", "slideMasters/slideMaster1.xml") + REL("rId2", "theme", "theme/theme1.xml") + (mitNotizen ? REL("rId3", "notesMaster", "notesMasters/notesMaster1.xml") : "") +
    folien.map((f, i) => REL("rId" + (i + 10), "slide", "slides/slide" + (i + 1) + ".xml")).join("") + "</Relationships>");
  dateien["ppt/slideMasters/slideMaster1.xml"] = u(MASTER);
  dateien["ppt/slideMasters/_rels/slideMaster1.xml.rels"] = u(KOPF + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + REL("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml") + REL("rId2", "theme", "../theme/theme1.xml") + "</Relationships>");
  dateien["ppt/slideLayouts/slideLayout1.xml"] = u(LAYOUT);
  dateien["ppt/slideLayouts/_rels/slideLayout1.xml.rels"] = u(KOPF + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + REL("rId1", "slideMaster", "../slideMasters/slideMaster1.xml") + "</Relationships>");
  dateien["ppt/theme/theme1.xml"] = u(theme(d));
  if (mitNotizen) {
    dateien["ppt/theme/theme2.xml"] = u(theme(K.design("klar")));
    dateien["ppt/notesMasters/notesMaster1.xml"] = u(KOPF + "<p:notesMaster " + NS + '><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>' + LEERER_BAUM + '</p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:notesStyle><a:lvl1pPr><a:defRPr sz="1200"/></a:lvl1pPr></p:notesStyle></p:notesMaster>');
    dateien["ppt/notesMasters/_rels/notesMaster1.xml.rels"] = u(KOPF + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + REL("rId1", "theme", "../theme/theme2.xml") + "</Relationships>");
  }
  return new Blob([fflate.zipSync(dateien, { level: 6 })], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}
