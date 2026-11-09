// FIDELIA Notizen · Speichern als Word (.docx) und Drucken / PDF
// Die Word-Datei wird komplett im Browser gebaut (Office-Open-XML, gepackt mit fflate) – nichts geht ins Internet.

import * as Papier from "./papier.js";
import { zeichneStrich } from "./heft.js";

const KW = window.KW;
const FFLATE = "../shared/vendor/fflate-0.8.3/fflate.mjs";
const x = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const EMU_MM = 36000;

/* ---------- Striche als Bild ---------- */

export function stricheAlsPng(s, pxProMm = 6) {
  const B = s.quer ? 297 : 210, Hm = s.hoehe || (s.quer ? 210 : 297);
  const c = document.createElement("canvas"); c.width = Math.round(B * pxProMm); c.height = Math.round(Hm * pxProMm);
  const g = c.getContext("2d");
  (s.striche || []).forEach(st => zeichneStrich(g, st, pxProMm));
  return c;
}

/* ---------- HTML → Word-XML ---------- */

function farbeHex(f) {
  if (!f) return "";
  if (/^#[0-9a-f]{6}$/i.test(f)) return f.slice(1).toUpperCase();
  const m = f.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
  if (!m || (m[4] !== undefined && Number(m[4]) === 0)) return "";
  return [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function wordBauen(rich, bilder) {
  let body = "";
  const runs = (knoten, fmt) => {
    let out = "";
    knoten.childNodes.forEach(n => {
      if (n.nodeType === 3) {
        if (n.parentElement && n.parentElement.classList.contains("tabz")) { out += "<w:r><w:tab/></w:r>"; return; }
        const t = n.textContent.replace(/\u200b/g, "").replace(/\s+/g, " ");
        if (!t) return;
        out += "<w:r>" + rPr(fmt) + '<w:t xml:space="preserve">' + x(t) + "</w:t></w:r>";
        return;
      }
      if (n.nodeType !== 1) return;
      const tag = n.tagName, f = Object.assign({}, fmt), st = n.style || {};
      if (tag === "BR") { out += "<w:r><w:br/></w:r>"; return; }
      if (n.classList.contains("formel")) { out += "<w:r>" + rPr(Object.assign({}, fmt, { i: true, font: "Cambria Math" })) + '<w:t xml:space="preserve">' + x(n.dataset.tex) + "</w:t></w:r>"; return; }
      if (tag === "IMG") { out += bildRun(n); return; }
      if (tag === "B" || tag === "STRONG" || /bold|[6-9]00/.test(st.fontWeight || "")) f.b = true;
      if (tag === "I" || tag === "EM" || st.fontStyle === "italic") f.i = true;
      if (tag === "U" || /underline/.test(st.textDecoration || st.textDecorationLine || "")) f.u = true;
      if (tag === "S" || tag === "STRIKE" || /line-through/.test(st.textDecoration || st.textDecorationLine || "")) f.s = true;
      if (tag === "SUB") f.sub = true;
      if (tag === "SUP") f.sup = true;
      if (st.color) f.farbe = farbeHex(st.color) || f.farbe;
      if (st.backgroundColor) f.marker = farbeHex(st.backgroundColor) || f.marker;
      if (st.fontFamily) f.font = st.fontFamily.split(",")[0].replace(/['"]/g, "").trim();
      if (st.fontSize && /em$/.test(st.fontSize)) f.pt = (fmt.pt || 11) * parseFloat(st.fontSize);
      if (tag === "FONT" && n.getAttribute("color")) f.farbe = farbeHex(n.getAttribute("color"));
      out += runs(n, f);
    });
    return out;
  };
  const rPr = (f) => {
    let r = "";
    if (f.font) r += '<w:rFonts w:ascii="' + x(f.font) + '" w:hAnsi="' + x(f.font) + '"/>';
    if (f.b) r += "<w:b/>"; if (f.i) r += "<w:i/>"; if (f.s) r += "<w:strike/>";
    if (f.farbe) r += '<w:color w:val="' + f.farbe + '"/>';
    if (f.pt) r += '<w:sz w:val="' + Math.round(f.pt * 2) + '"/>';
    if (f.marker) r += '<w:shd w:val="clear" w:color="auto" w:fill="' + f.marker + '"/>';
    if (f.u) r += '<w:u w:val="single"/>';
    if (f.sub) r += '<w:vertAlign w:val="subscript"/>'; if (f.sup) r += '<w:vertAlign w:val="superscript"/>';
    return r ? "<w:rPr>" + r + "</w:rPr>" : "";
  };
  const bildRun = (img) => {
    const src = img.getAttribute("src") || "";
    const m = src.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
    if (!m) return "";
    const nr = bilder.length + 1, typ = m[1] === "png" ? "png" : "jpeg";
    bilder.push({ name: "bild" + nr + "." + (typ === "png" ? "png" : "jpg"), daten: m[2], typ });
    const breiteProzent = parseFloat(img.style.width) || 100;
    const brMm = Math.min(170, 170 * breiteProzent / 100), verh = (img.naturalHeight || 3) / (img.naturalWidth || 4);
    return zeichnung(nr, brMm * EMU_MM, brMm * verh * EMU_MM);
  };
  const absatz = (n, extra = "") => {
    const st = n.style || {}, jc = { center: "center", right: "right", justify: "both" }[st.textAlign];
    const ppr = extra + (jc ? '<w:jc w:val="' + jc + '"/>' : "");
    body += "<w:p>" + (ppr ? "<w:pPr>" + ppr + "</w:pPr>" : "") + runs(n, {}) + "</w:p>";
  };
  const block = (n, ebene = 0) => {
    if (n.nodeType === 3) { if (n.textContent.trim()) body += "<w:p>" + runs({ childNodes: [n] }, {}) + "</w:p>"; return; }
    if (n.nodeType !== 1) return;
    const tag = n.tagName;
    if (/^H[1-3]$/.test(tag)) return absatz(n, '<w:pStyle w:val="Heading' + tag[1] + '"/>');
    if (tag === "BLOCKQUOTE") return absatz(n, '<w:pStyle w:val="Quote"/>');
    if (tag === "HR") { body += '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="9AA7BD"/></w:pBdr></w:pPr></w:p>'; return; }
    if (tag === "UL" || tag === "OL") {
      n.childNodes.forEach(li => {
        if (li.nodeType !== 1) return;
        if (li.tagName === "UL" || li.tagName === "OL") return block(li, ebene + 1);
        const unter = Array.from(li.children).filter(c => c.tagName === "UL" || c.tagName === "OL");
        unter.forEach(u => u.remove());
        absatz(li, '<w:numPr><w:ilvl w:val="' + ebene + '"/><w:numId w:val="' + (tag === "UL" ? 1 : 2) + '"/></w:numPr>');
        unter.forEach(u => block(u, ebene + 1));
      });
      return;
    }
    if (tag === "TABLE") {
      body += '<w:tbl><w:tblPr><w:tblStyle w:val="Tabelle"/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>' +
        ["top", "left", "bottom", "right", "insideH", "insideV"].map(s => '<w:' + s + ' w:val="single" w:sz="4" w:space="0" w:color="999999"/>').join("") + "</w:tblBorders></w:tblPr>";
      Array.from(n.rows).forEach(tr => {
        body += "<w:tr>" + Array.from(tr.cells).map(td => {
          const vorher = body; body = ""; absatz(td); const p = body; body = vorher;
          return "<w:tc><w:tcPr><w:tcW w:w=\"0\" w:type=\"auto\"/></w:tcPr>" + p + "</w:tc>";
        }).join("") + "</w:tr>";
      });
      body += "</w:tbl><w:p/>";
      return;
    }
    if (n.classList && n.classList.contains("toc")) {
      body += '<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Inhaltsverzeichnis</w:t></w:r></w:p>';
      n.querySelectorAll("li").forEach((li, i) => { body += '<w:p><w:pPr><w:ind w:left="' + (li.className === "toc-h3" ? 720 : li.className === "toc-h2" ? 360 : 0) + '"/></w:pPr><w:r><w:t xml:space="preserve">' + x(li.textContent) + "</w:t></w:r></w:p>"; });
      return;
    }
    if (tag === "DIV" && n.querySelector("p,h1,h2,h3,ul,ol,table,div")) { n.childNodes.forEach(c => block(c, ebene)); return; }
    absatz(n);
  };
  rich.childNodes.forEach(n => block(n));
  return body;
}

function zeichnung(nr, cx, cy) {
  cx = Math.round(cx); cy = Math.round(cy);
  return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + nr + '" name="Bild ' + nr + '"/>' +
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="' + nr + '" name="bild' + nr + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
    '<pic:blipFill><a:blip r:embed="rIdBild' + nr + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
    '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
}

const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:lang w:val="de-DE"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
  [[1, 36, "1F3864"], [2, 28, "2F5496"], [3, 24, "2F5496"]].map(([n, sz, c]) => '<w:style w:type="paragraph" w:styleId="Heading' + n + '"><w:name w:val="heading ' + n + '"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="' + (n - 1) + '"/></w:pPr><w:rPr><w:b/><w:color w:val="' + c + '"/><w:sz w:val="' + sz + '"/></w:rPr></w:style>').join("") +
  '<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/></w:pPr><w:rPr><w:i/><w:color w:val="555555"/></w:rPr></w:style>' +
  '<w:style w:type="table" w:styleId="Tabelle"><w:name w:val="Tabelle"/></w:style></w:styles>';

const NUMBERING = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:abstractNum w:abstractNumId="0">' + [0, 1, 2, 3].map(l => '<w:lvl w:ilvl="' + l + '"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="' + ["•", "◦", "▪", "•"][l] + '"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="' + (720 + l * 360) + '" w:hanging="360"/></w:pPr></w:lvl>').join("") + '</w:abstractNum>' +
  '<w:abstractNum w:abstractNumId="1">' + [0, 1, 2, 3].map(l => '<w:lvl w:ilvl="' + l + '"><w:start w:val="1"/><w:numFmt w:val="' + ["decimal", "lowerLetter", "lowerRoman", "decimal"][l] + '"/><w:lvlText w:val="%' + (l + 1) + '."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="' + (720 + l * 360) + '" w:hanging="360"/></w:pPr></w:lvl>').join("") + '</w:abstractNum>' +
  '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>';

function b64ZuBytes(b64) { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }

export async function alsWord(A, s) {
  KW.toast("Word-Datei wird gebaut …");
  let fflate;
  try { fflate = await import(FFLATE); } catch (e) { KW.toast("Beim ersten Mal braucht der Word-Export Internet."); return; }
  const rich = document.createElement("div");
  rich.innerHTML = s.html || "";
  // Bilder brauchen ihre echte Größe für das richtige Seitenverhältnis
  await Promise.all(Array.from(rich.querySelectorAll("img")).map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
  const bilder = [];
  const ersteUeberschrift = rich.querySelector("h1");
  let body = ersteUeberschrift && ersteUeberschrift.textContent.trim() === String(s.titel || "").trim() ? "" : '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t xml:space="preserve">' + x(s.titel || "Seite") + "</w:t></w:r></w:p>";
  // Scan ohne Nachbau → das Foto als ganze Seite
  if (s.bild && (!s.html || s.ansicht === "foto")) {
    const blob = await A.bildHolen(s.bild);
    if (blob) {
      const b64 = await new Promise(r => { const f = new FileReader(); f.onload = () => r(String(f.result).split(",")[1]); f.readAsDataURL(blob); });
      bilder.push({ name: "bild1.jpg", daten: b64, typ: "jpeg" });
      const B = s.quer ? 297 : 210, Hm = s.hoehe || 297, br = 170;
      body += "<w:p>" + zeichnung(1, br * EMU_MM, br * Hm / B * EMU_MM) + "</w:p>";
    }
  } else body += wordBauen(rich, bilder);
  // Gemaltes mit dem Stift als Bild dazu
  if ((s.striche || []).length) {
    const c = stricheAlsPng(s, 5), b64 = c.toDataURL("image/png").split(",")[1];
    bilder.push({ name: "bild" + (bilder.length + 1) + ".png", daten: b64, typ: "png" });
    const B = s.quer ? 297 : 210, Hm = s.hoehe || 297;
    body += '<w:p><w:r><w:rPr><w:i/><w:color w:val="777777"/></w:rPr><w:t>Gezeichnet:</w:t></w:r></w:p><w:p>' + zeichnung(bilder.length, 170 * EMU_MM, 170 * Hm / B * EMU_MM) + "</w:p>";
  }
  const quer = !!s.quer;
  const doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>' + body +
    '<w:sectPr><w:pgSz w:w="' + (quer ? 16838 : 11906) + '" w:h="' + (quer ? 11906 : 16838) + '"' + (quer ? ' w:orient="landscape"' : "") + '/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>';
  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '<Relationship Id="rIdNum" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' +
    bilder.map((b, i) => '<Relationship Id="rIdBild' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + b.name + '"/>').join("") + "</Relationships>";
  const dateien = {
    "[Content_Types].xml": fflate.strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>'),
    "_rels/.rels": fflate.strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    "word/document.xml": fflate.strToU8(doc),
    "word/styles.xml": fflate.strToU8(STYLES),
    "word/numbering.xml": fflate.strToU8(NUMBERING),
    "word/_rels/document.xml.rels": fflate.strToU8(rels)
  };
  bilder.forEach(b => { dateien["word/media/" + b.name] = b64ZuBytes(b.daten); });
  const zip = fflate.zipSync(dateien, { level: 6 });
  herunterladen(new Blob([zip], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), (s.titel || "Seite").replace(/[\\/:*?"<>|]/g, "").slice(0, 60) + ".docx");
  KW.toast("✓ Word-Datei gespeichert.");
}

function herunterladen(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

/* ---------- Drucken / PDF ---------- */

// Baut die Seiten in echter Größe (mm) und öffnet den Druckdialog („Als PDF speichern“ geht auch)
export async function drucken(A, seiten) {
  const alt = document.getElementById("druck"); if (alt) alt.remove();
  const box = document.createElement("div"); box.id = "druck";
  const urls = [];
  for (const s of seiten) {
    const B = s.quer ? 297 : 210, kachel = s.quer ? 210 : 297, Hm = s.hoehe || kachel;
    // Lange Seiten auf mehrere Blätter verteilen
    for (let oben = 0; oben < Hm - 1; oben += kachel) {
      const blatt = document.createElement("div");
      blatt.className = "druck-seite" + (s.quer ? " quer" : "");
      blatt.style.cssText = "--u:1mm;width:" + B + "mm;height:" + kachel + "mm";
      const innen = document.createElement("div");
      innen.className = "druck-innen";
      innen.style.cssText = "position:absolute;left:0;top:" + (-oben) + "mm;width:" + B + "mm;height:" + Hm + "mm;background-image:" + Papier.hintergrund(s.raster, s.quer) + ";background-size:100% " + kachel + "mm";
      const foto = s.bild && (!s.html || s.ansicht === "foto");
      if (s.bild && foto) {
        const b = await A.bildHolen(s.bild);
        if (b) { const u = URL.createObjectURL(b); urls.push(u); innen.innerHTML += '<img src="' + u + '" style="position:absolute;inset:0;width:100%;height:100%">'; innen.style.backgroundImage = "none"; }
      }
      if (!foto) {
        const r = document.createElement("div");
        r.className = "rich druck-rich";
        A.richStil(r, s);
        r.innerHTML = s.html || "";
        innen.appendChild(r);
      }
      if ((s.striche || []).length) { const c = stricheAlsPng(s, 8); c.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%"; innen.appendChild(c); }
      blatt.appendChild(innen);
      box.appendChild(blatt);
    }
  }
  document.body.appendChild(box);
  document.body.classList.add("druckt");
  await new Promise(r => setTimeout(r, 300));
  const fertig = () => { document.body.classList.remove("druckt"); box.remove(); urls.forEach(u => URL.revokeObjectURL(u)); window.removeEventListener("afterprint", fertig); };
  window.addEventListener("afterprint", fertig);
  window.print();
}
