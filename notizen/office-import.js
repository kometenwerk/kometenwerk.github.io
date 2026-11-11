// FIDELIA Notizen · Word (.docx) und PowerPoint (.pptx) öffnen – komplett im Browser, nichts geht ins Internet
// Word → Heftseite (Überschriften, fett/kursiv/unterstrichen, Farben, Listen, Tabellen, Bilder, Links)
// PowerPoint → Präsentation (Textfelder an ihrer Stelle, Bilder, Formen, Tabellen, Sprechernotizen)

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NS_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", bmp: "image/bmp", webp: "image/webp", svg: "image/svg+xml" };

function xml(dateien, pfad) { const d = dateien[pfad]; return d ? new DOMParser().parseFromString(new TextDecoder().decode(d), "application/xml") : null; }
const kinder = (el, ns, name) => el ? Array.from(el.childNodes).filter(n => n.nodeType === 1 && n.localName === name && (!ns || n.namespaceURI === ns)) : [];
const kind = (el, ns, name) => kinder(el, ns, name)[0] || null;
const alle = (el, ns, name) => el ? Array.from(el.getElementsByTagNameNS(ns, name)) : [];
const wAttr = (el, name) => el ? (el.getAttributeNS(NS_W, name) || el.getAttribute("w:" + name)) : null;
function beziehungen(dateien, pfad) {
  const teile = pfad.split("/"), datei = teile.pop(), doc = xml(dateien, [...teile, "_rels", datei + ".rels"].join("/")), r = {};
  if (!doc) return r;
  for (const b of Array.from(doc.getElementsByTagName("Relationship"))) {
    const ziel = b.getAttribute("Target"), extern = b.getAttribute("TargetMode") === "External";
    r[b.getAttribute("Id")] = { typ: (b.getAttribute("Type") || "").split("/").pop(), ziel: extern ? ziel : aufloesen(teile.join("/"), ziel), extern };
  }
  return r;
}
function aufloesen(ordner, ziel) {
  if (ziel.startsWith("/")) return ziel.slice(1);
  const st = ordner ? ordner.split("/") : [];
  for (const t of ziel.split("/")) { if (t === "..") st.pop(); else if (t !== ".") st.push(t); }
  return st.join("/");
}
function bildUrl(dateien, pfad) {
  const d = dateien[pfad]; if (!d) return null;
  const end = (pfad.split(".").pop() || "").toLowerCase(), typ = MIME[end]; if (!typ) return null;
  let s = ""; for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000));
  return "data:" + typ + ";base64," + btoa(s);
}

/* ================= Word ================= */

export function docxLesen(bytes, fflate) {
  const dateien = fflate.unzipSync(bytes), haupt = "word/document.xml", doc = xml(dateien, haupt);
  if (!doc) throw new Error("kein Word-Dokument");
  const rels = beziehungen(dateien, haupt), num = nummerierung(xml(dateien, "word/numbering.xml")), stile = stilNamen(xml(dateien, "word/styles.xml"));
  const body = alle(doc, NS_W, "body")[0];
  let html = "", liste = null, titel = "";
  const listeZu = () => { if (liste) { html += liste.stapel.map(t => "</li></" + t + ">").reverse().join(""); liste = null; } };
  for (const el of Array.from(body.childNodes)) {
    if (el.nodeType !== 1) continue;
    if (el.localName === "p") {
      const p = absatz(el, rels, dateien, stile);
      const stilId = wAttr(alle(el, NS_W, "pStyle")[0], "val") || "", stilName = stile[stilId] || "";
      let np = alle(el, NS_W, "numPr")[0] || stile["#" + stilId] || null;
      if (!np && /list (bullet|number)|aufzählung|listenabsatz/.test(stilName)) np = { stil: /number/.test(stilName) ? "ol" : "ul" };
      if (np && p.inhalt.trim() !== "") {
        const id = np.stil ? "" : wAttr(kind(np, NS_W, "numId"), "val"), ebene = np.stil ? 0 : Number(wAttr(kind(np, NS_W, "ilvl"), "val") || 0), tag = np.stil || num[id + ":" + ebene] || num[id + ":0"] || "ul";
        if (liste && liste.stapel.length === ebene + 1 && liste.stapel[ebene] !== tag) { html += "</li></" + liste.stapel.pop() + ">"; }
        if (!liste) liste = { stapel: [] };
        while (liste.stapel.length > ebene + 1) html += "</li></" + liste.stapel.pop() + ">";
        if (liste.stapel.length === ebene + 1) html += "</li>";
        while (liste.stapel.length < ebene + 1) { html += "<" + tag + ">"; liste.stapel.push(tag); }
        html += "<li>" + p.inhalt;
        continue;
      }
      listeZu();
      if (!titel && /^h[12]$/.test(p.tag) && p.text.trim()) titel = p.text.trim();
      html += "<" + p.tag + (p.stil ? ' style="' + p.stil + '"' : "") + ">" + (p.inhalt || "<br>") + "</" + p.tag + ">";
      if (p.umbruch) html += '<hr class="seitenumbruch">';
    } else if (el.localName === "tbl") {
      listeZu();
      html += '<table class="tab"><tbody>' + kinder(el, NS_W, "tr").map(tr => "<tr>" + kinder(tr, NS_W, "tc").map(tc => {
        const pr = kind(tc, NS_W, "tcPr"), span = Number(wAttr(kind(pr, NS_W, "gridSpan"), "val") || 1);
        return "<td" + (span > 1 ? ' colspan="' + span + '"' : "") + ">" + kinder(tc, NS_W, "p").map(p => absatz(p, rels, dateien, stile).inhalt).filter(Boolean).join("<br>") + "</td>";
      }).join("") + "</tr>").join("") + "</tbody></table><p><br></p>";
    }
  }
  listeZu();
  if (!titel) { const t = new DOMParser().parseFromString("<div>" + html + "</div>", "text/html").body.textContent.trim(); titel = t.split(/\n|\. /)[0].slice(0, 60); }
  return { titel, html };
}
function stilNamen(doc) {
  const r = {}; if (!doc) return r;
  for (const s of alle(doc, NS_W, "style")) { const n = kind(s, NS_W, "name"), np = alle(s, NS_W, "numPr")[0]; r[wAttr(s, "styleId")] = (wAttr(n, "val") || "").toLowerCase(); if (np) r["#" + wAttr(s, "styleId")] = np; }
  return r;
}
function nummerierung(doc) {
  const r = {}; if (!doc) return r;
  const abstrakt = {};
  for (const a of alle(doc, NS_W, "abstractNum")) { const id = wAttr(a, "abstractNumId"); abstrakt[id] = {}; for (const l of kinder(a, NS_W, "lvl")) abstrakt[id][wAttr(l, "ilvl")] = wAttr(kind(l, NS_W, "numFmt"), "val") === "bullet" ? "ul" : "ol"; }
  for (const n of alle(doc, NS_W, "num")) { const a = abstrakt[wAttr(kind(n, NS_W, "abstractNumId"), "val")] || {}; for (const [l, t] of Object.entries(a)) r[wAttr(n, "numId") + ":" + l] = t; }
  return r;
}
function absatz(p, rels, dateien, stile) {
  const pr = kind(p, NS_W, "pPr"), stilId = wAttr(kind(pr, NS_W, "pStyle"), "val") || "", name = (stile[stilId] || stilId).toLowerCase();
  let tag = "p";
  const m = /(?:heading|überschrift|berschrift)\s*(\d)/.exec(name) || /^(?:heading|berschrift)(\d)$/i.exec(stilId);
  if (m) tag = "h" + Math.min(4, Number(m[1]) + 0); else if (name === "title" || name === "titel") tag = "h1"; else if (/quote|zitat/.test(name)) tag = "blockquote";
  const jc = wAttr(kind(pr, NS_W, "jc"), "val");
  const stil = jc === "center" ? "text-align:center" : jc === "right" || jc === "end" ? "text-align:right" : jc === "both" ? "text-align:justify" : "";
  let inhalt = "", text = "", umbruch = false;
  const lauf = (r, link) => {
    const rp = kind(r, NS_W, "rPr"); let t = "";
    for (const k of Array.from(r.childNodes)) {
      if (k.nodeType !== 1) continue;
      if (k.localName === "t") { t += esc(k.textContent); text += k.textContent; }
      else if (k.localName === "tab") t += "&emsp;";
      else if (k.localName === "br") { if (wAttr(k, "type") === "page") umbruch = true; else t += "<br>"; }
      else if (k.localName === "drawing" || k.localName === "pict") {
        const blip = alle(k, NS_A, "blip")[0], rid = blip ? blip.getAttributeNS(NS_R, "embed") : (k.getElementsByTagName("v:imagedata")[0] || { getAttribute: () => null }).getAttribute("r:id");
        const ext = alle(k, "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing", "extent")[0];
        const url = rid && rels[rid] ? bildUrl(dateien, rels[rid].ziel) : null;
        if (url) { const breite = ext ? Math.min(100, Math.round(Number(ext.getAttribute("cx")) / 360000 / 17 * 100)) : 60; t += '<img class="bild" src="' + url + '" alt="" style="width:' + Math.max(15, breite) + '%">'; }
      }
    }
    if (!t) return "";
    const an = (n) => { const e = kind(rp, NS_W, n); return e && wAttr(e, "val") !== "0" && wAttr(e, "val") !== "false" && wAttr(e, "val") !== "none"; };
    if (an("b")) t = "<b>" + t + "</b>"; if (an("i")) t = "<i>" + t + "</i>"; if (an("u")) t = "<u>" + t + "</u>"; if (an("strike")) t = "<s>" + t + "</s>";
    const va = wAttr(kind(rp, NS_W, "vertAlign"), "val"); if (va === "superscript") t = "<sup>" + t + "</sup>"; if (va === "subscript") t = "<sub>" + t + "</sub>";
    const farbe = wAttr(kind(rp, NS_W, "color"), "val"), mark = wAttr(kind(rp, NS_W, "highlight"), "val");
    const css = (farbe && /^[0-9a-f]{6}$/i.test(farbe) && farbe.toLowerCase() !== "000000" ? "color:#" + farbe + ";" : "") + (mark && mark !== "none" ? "background:" + ({ yellow: "#fff176", green: "#b9f6ca", cyan: "#b3e5fc", magenta: "#f8bbd0", red: "#ffcdd2", blue: "#bbdefb", lightGray: "#e0e0e0" }[mark] || "#fff176") + ";" : "");
    if (css) t = '<span style="' + css + '">' + t + "</span>";
    if (link) t = '<a href="' + esc(link) + '" target="_blank" rel="noopener">' + t + "</a>";
    return t;
  };
  for (const k of Array.from(p.childNodes)) {
    if (k.nodeType !== 1) continue;
    if (k.localName === "r") inhalt += lauf(k);
    else if (k.localName === "hyperlink") { const rid = k.getAttributeNS(NS_R, "id"), ziel = rid && rels[rid] && rels[rid].extern ? rels[rid].ziel : ""; const safe = /^(https?:|mailto:)/i.test(ziel) ? ziel : ""; inhalt += kinder(k, NS_W, "r").map(r => lauf(r, safe)).join(""); }
    else if (k.localName === "ins" || k.localName === "smartTag" || k.localName === "sdt") inhalt += alle(k, NS_W, "r").map(r => lauf(r)).join("");
  }
  return { tag, stil, inhalt, text, umbruch };
}

/* ================= PowerPoint ================= */

let idz = 0; const nid = () => Date.now().toString(36) + (idz++).toString(36) + Math.random().toString(36).slice(2, 5);

export function pptxLesen(bytes, fflate) {
  const dateien = fflate.unzipSync(bytes), pres = xml(dateien, "ppt/presentation.xml");
  if (!pres) throw new Error("keine PowerPoint-Datei");
  const rels = beziehungen(dateien, "ppt/presentation.xml"), sz = alle(pres, NS_P, "sldSz")[0];
  const cx = Number(sz ? sz.getAttribute("cx") : 12192000), cy = Number(sz ? sz.getAttribute("cy") : 6858000);
  // Folien in 960 × 540 einpassen (4:3-Folien bekommen Ränder links/rechts)
  const f = Math.min(960 / cx, 540 / cy), ox = (960 - cx * f) / 2, oy = (540 - cy * f) / 2, ptF = f * 12700;
  const folien = [];
  for (const sid of alle(pres, NS_P, "sldId")) {
    const r = rels[sid.getAttributeNS(NS_R, "id")]; if (!r) continue;
    folien.push(folieLesen(dateien, r.ziel, { f, ox, oy, ptF }));
  }
  const kern = xml(dateien, "docProps/core.xml"), t = kern && kern.getElementsByTagName("dc:title")[0];
  const titel = (t && t.textContent.trim()) || (folien[0] && folien[0].titelText) || "Präsentation";
  folien.forEach(x => delete x.titelText);
  return { titel, folien };
}
function folieLesen(dateien, pfad, m) {
  const doc = xml(dateien, pfad), rels = beziehungen(dateien, pfad), el = [];
  let titelText = "", notiz = "";
  // Platzhalter-Positionen aus Layout und Master (wenn die Folie selbst keine hat)
  const layoutRel = Object.values(rels).find(r => r.typ === "slideLayout"), layout = layoutRel ? xml(dateien, layoutRel.ziel) : null;
  const masterRel = layoutRel ? Object.values(beziehungen(dateien, layoutRel.ziel)).find(r => r.typ === "slideMaster") : null, master = masterRel ? xml(dateien, masterRel.ziel) : null;
  const platzhalter = (ph) => {
    if (!ph) return null; const typ = ph.getAttribute("type") || "body", idx = ph.getAttribute("idx");
    for (const d of [layout, master]) { if (!d) continue; for (const sp of alle(d, NS_P, "sp")) { const p2 = alle(sp, NS_P, "ph")[0]; if (!p2) continue; if ((idx && p2.getAttribute("idx") === idx) || (p2.getAttribute("type") || "body") === typ) { const x = alle(sp, NS_A, "xfrm")[0]; if (x) return x; } } }
    return null;
  };
  const box = (xf) => { const off = kind(xf, NS_A, "off"), ext = kind(xf, NS_A, "ext"); if (!off || !ext) return null; return { x: Math.round(Number(off.getAttribute("x")) * m.f + m.ox), y: Math.round(Number(off.getAttribute("y")) * m.f + m.oy), w: Math.max(10, Math.round(Number(ext.getAttribute("cx")) * m.f)), h: Math.max(10, Math.round(Number(ext.getAttribute("cy")) * m.f)), dreh: xf.getAttribute("rot") ? Math.round(Number(xf.getAttribute("rot")) / 60000) : undefined }; };
  const farbe = (sp) => { const s = sp && kind(sp, NS_A, "solidFill"), c = s && kind(s, NS_A, "srgbClr"); return c ? "#" + c.getAttribute("val").toLowerCase() : null; };
  const baum = doc ? alle(doc, NS_P, "spTree")[0] : null;
  const durchgehen = (knoten) => {
    for (const k of Array.from(knoten.childNodes)) {
      if (k.nodeType !== 1) continue;
      if (k.localName === "grpSp") { durchgehen(k); continue; }
      if (k.localName === "sp") {
        const ph = alle(k, NS_P, "ph")[0], phTyp = ph ? (ph.getAttribute("type") || "body") : "";
        if (/^(dt|ftr|sldNum)$/.test(phTyp)) continue;
        const spPr = kind(k, NS_P, "spPr"), xf = kind(spPr, NS_A, "xfrm") || platzhalter(ph);
        let b = xf ? box(xf) : null;
        if (!b) b = phTyp === "title" || phTyp === "ctrTitle" ? { x: 60, y: 36, w: 840, h: 80 } : { x: 60, y: 130, w: 840, h: 370 };
        const tx = kind(k, NS_P, "txBody"), { html, text, groesse, ausr } = textLesen(tx, m, phTyp);
        const geo = kind(spPr, NS_A, "prstGeom"), prst = geo ? geo.getAttribute("prst") : "rect", fuell = farbe(spPr);
        if (text.trim()) {
          const rolle = phTyp === "title" || phTyp === "ctrTitle" ? "titel" : phTyp === "subTitle" ? "untertitel" : ph ? "text" : "frei";
          if (rolle === "titel" && !titelText) titelText = text.trim();
          if (prst !== "rect" && FORM[prst] && fuell) el.push(Object.assign({ id: nid(), typ: "form", art: FORM[prst], fuell, html }, b, groesse ? { groesse } : {}));
          else el.push(Object.assign({ id: nid(), typ: "text", rolle, html }, b, groesse ? { groesse } : {}, ausr ? { ausr } : {}, fuell ? { fuell } : {}));
        } else if (FORM[prst] && (fuell || alle(spPr, NS_A, "ln").length)) {
          const ln = kind(spPr, NS_A, "ln"); el.push(Object.assign({ id: nid(), typ: "form", art: FORM[prst], fuell: fuell || "none", rand: farbe(ln) || (fuell ? "none" : "#2b3445"), randBreite: ln && ln.getAttribute("w") ? Math.max(1, Math.round(Number(ln.getAttribute("w")) / 12700)) : 3 }, b));
        }
      } else if (k.localName === "pic") {
        const blip = alle(k, NS_A, "blip")[0], rid = blip && blip.getAttributeNS(NS_R, "embed"), xf = alle(k, NS_A, "xfrm")[0], b = xf && box(xf);
        const url = rid && rels[rid] ? bildUrl(dateien, rels[rid].ziel) : null;
        if (url && b) el.push(Object.assign({ id: nid(), typ: "bild", src: url }, b));
      } else if (k.localName === "cxnSp") {
        const xf = alle(k, NS_A, "xfrm")[0], b = xf && box(xf), ln = alle(k, NS_A, "ln")[0];
        if (b) el.push(Object.assign({ id: nid(), typ: "form", art: "linie", rand: farbe(ln) || "#2b3445", randBreite: 3 }, b, { y: b.y + b.h / 2 - 5, h: 10 }));
      } else if (k.localName === "graphicFrame") {
        const tbl = alle(k, NS_A, "tbl")[0], xf = kind(k, NS_P, "xfrm"), b = xf && box(xf);
        if (tbl && b) el.push(Object.assign({ id: nid(), typ: "tabelle", zeilen: kinder(tbl, NS_A, "tr").map(tr => kinder(tr, NS_A, "tc").map(tc => alle(tc, NS_A, "t").map(t => t.textContent).join(""))), groesse: 16 }, b));
      }
    }
  };
  if (baum) durchgehen(baum);
  // Sprechernotizen
  const nRel = Object.values(rels).find(r => r.typ === "notesSlide");
  if (nRel) { const nd = xml(dateien, nRel.ziel); if (nd) for (const sp of alle(nd, NS_P, "sp")) { const ph = alle(sp, NS_P, "ph")[0]; if (ph && (ph.getAttribute("type") || "body") === "body") notiz += alle(sp, NS_A, "p").map(p => alle(p, NS_A, "t").map(t => t.textContent).join("")).join("\n"); } }
  // Übergang
  const tr = doc && alle(doc, NS_P, "transition")[0], tk = tr && Array.from(tr.childNodes).find(n => n.nodeType === 1);
  const ueber = tk ? ({ fade: "blende", push: "schieben", zoom: "zoom", wipe: "wuerfel" }[tk.localName] || "blende") : "";
  return { id: nid(), layout: "leer", el, notiz: notiz.trim(), ueber, titelText };
}
const FORM = { rect: "rechteck", roundRect: "rund", ellipse: "kreis", triangle: "dreieck", rightArrow: "pfeil", star5: "stern", wedgeRoundRectCallout: "blase", wedgeRectCallout: "blase", line: "linie" };
function textLesen(tx, m, phTyp) {
  if (!tx) return { html: "", text: "" };
  let html = "", text = "", liste = false, groesse = 0, ausr = "";
  for (const p of kinder(tx, NS_A, "p")) {
    const pPr = kind(p, NS_A, "pPr"), alg = pPr && pPr.getAttribute("algn");
    if (alg && !ausr) ausr = alg === "ctr" ? "c" : alg === "r" ? "r" : "";
    const punkt = pPr && (kind(pPr, NS_A, "buChar") || kind(pPr, NS_A, "buAutoNum")) && !kind(pPr, NS_A, "buNone");
    const istListe = punkt || (phTyp === "body" && !(pPr && kind(pPr, NS_A, "buNone")));
    let inhalt = "";
    for (const r of Array.from(p.childNodes)) {
      if (r.nodeType !== 1) continue;
      if (r.localName === "br") { inhalt += "<br>"; continue; }
      if (r.localName !== "r" && r.localName !== "fld") continue;
      const t = kind(r, NS_A, "t"); if (!t) continue;
      let s = esc(t.textContent); text += t.textContent + " ";
      const rp = kind(r, NS_A, "rPr");
      if (rp) {
        if (rp.getAttribute("sz") && !groesse) groesse = Math.round(Number(rp.getAttribute("sz")) / 100 * m.ptF * 10) / 10 || 0;
        if (rp.getAttribute("b") === "1") s = "<b>" + s + "</b>"; if (rp.getAttribute("i") === "1") s = "<i>" + s + "</i>"; if (rp.getAttribute("u") && rp.getAttribute("u") !== "none") s = "<u>" + s + "</u>";
        const sf = kind(rp, NS_A, "solidFill"), c = sf && kind(sf, NS_A, "srgbClr"); if (c) s = '<span style="color:#' + c.getAttribute("val") + '">' + s + "</span>";
      }
      inhalt += s;
    }
    if (!inhalt) { if (liste) { html += "</ul>"; liste = false; } continue; }
    if (istListe) { if (!liste) { html += "<ul>"; liste = true; } html += "<li>" + inhalt + "</li>"; }
    else { if (liste) { html += "</ul>"; liste = false; } html += "<p>" + inhalt + "</p>"; }
  }
  if (liste) html += "</ul>";
  return { html, text, groesse: groesse >= 8 && groesse <= 120 ? groesse : 0, ausr };
}
