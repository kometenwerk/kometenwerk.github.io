// FIDELIA Notizen · Präsentationen: Designs, Layouts, Folien als HTML, Gliederung aus einer Heftseite
// Eine Folie ist 960 × 540 Punkte groß (16:9). Alles wird in diesen Einheiten gespeichert.

export const W = 960, H = 540;
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- Designs ---------- */

export const DESIGNS = {
  klar:    { name: "Klar",     hg: "#ffffff", hg2: "#f4f6fa", titel: "#14213d", text: "#2b3445", akzent: "#2f6fdb", schriftT: "Space Grotesk", schrift: "Space Grotesk", deko: "balken" },
  nacht:   { name: "Nacht",    hg: "#0b111c", hg2: "#172133", titel: "#ffffff", text: "#d6deeb", akzent: "#ff8a3c", schriftT: "Space Grotesk", schrift: "Space Grotesk", deko: "punkt" },
  fidelia: { name: "FIDELIA",  hg: "#fffaf0", hg2: "#f6e7c8", titel: "#5c3b00", text: "#3d2c10", akzent: "#a36b00", schriftT: "Georgia", schrift: "Georgia", deko: "linie" },
  natur:   { name: "Natur",    hg: "#f2f8f1", hg2: "#d8ecd5", titel: "#1d4d2b", text: "#24392a", akzent: "#3a8f4f", schriftT: "Georgia", schrift: "Arial", deko: "welle" },
  ozean:   { name: "Ozean",    hg: "#0b3a5b", hg2: "#14629a", titel: "#ffffff", text: "#e3f2ff", akzent: "#5fd3f3", schriftT: "Arial", schrift: "Arial", deko: "welle" },
  kreide:  { name: "Tafel",    hg: "#20382c", hg2: "#2b4a3a", titel: "#fdfbe8", text: "#eef3e2", akzent: "#ffd166", schriftT: "Comic Sans MS", schrift: "Comic Sans MS", deko: "rahmen" },
  bunt:    { name: "Bunt",     hg: "#fff4f8", hg2: "#ffe0ec", titel: "#6d3fd6", text: "#33244d", akzent: "#ff4f8b", schriftT: "Verdana", schrift: "Verdana", deko: "kreise" },
  minimal: { name: "Minimal",  hg: "#fafafa", hg2: "#fafafa", titel: "#111111", text: "#333333", akzent: "#111111", schriftT: "Arial", schrift: "Arial", deko: "" }
};
// Ein Design ist eine Kennung ("nacht") oder ein eigener Folienmaster: { basis: "nacht", akzent: "#…", fuss: "…", nummer: true }
export const design = (id) => id && typeof id === "object" ? Object.assign({}, DESIGNS[id.basis] || DESIGNS.klar, ...Object.entries(id).filter(([, v]) => v !== "" && v != null).map(([k, v]) => ({ [k]: v }))) : DESIGNS[id] || DESIGNS.klar;
export const designBasis = (id) => id && typeof id === "object" ? id.basis || "klar" : id || "klar";
const fam = (f) => f === "Space Grotesk" ? "'Space Grotesk', Arial, sans-serif" : f === "Georgia" ? "Georgia, 'Times New Roman', serif" : f === "Comic Sans MS" ? "'Comic Sans MS', 'Comic Neue', cursive" : f + ", Arial, sans-serif";

/* ---------- Layouts ---------- */

const t = (rolle, x, y, w, h, html, extra = {}) => Object.assign({ id: neueId(), typ: "text", rolle, x, y, w, h, html }, extra);
export const LAYOUTS = {
  titel:   { name: "Titelfolie", el: () => [t("titel", 80, 170, 800, 110, "<p>Titel der Präsentation</p>", { ausr: "c" }), t("untertitel", 160, 300, 640, 60, "<p>Dein Name · Klasse · Datum</p>", { ausr: "c" })] },
  inhalt:  { name: "Titel und Text", el: () => [t("titel", 60, 36, 840, 80, "<p>Überschrift</p>"), t("text", 60, 130, 840, 370, "<ul><li>Erster Punkt</li><li>Zweiter Punkt</li><li>Dritter Punkt</li></ul>")] },
  zwei:    { name: "Zwei Spalten", el: () => [t("titel", 60, 36, 840, 80, "<p>Überschrift</p>"), t("text", 60, 130, 405, 370, "<ul><li>Links</li></ul>"), t("text", 495, 130, 405, 370, "<ul><li>Rechts</li></ul>")] },
  bildText:{ name: "Bild und Text", el: () => [t("titel", 60, 36, 840, 80, "<p>Überschrift</p>"), { id: neueId(), typ: "bild", x: 60, y: 130, w: 420, h: 370, src: null }, t("text", 510, 130, 390, 370, "<ul><li>Was man sieht</li></ul>")] },
  bildGross:{ name: "Großes Bild", el: () => [t("titel", 60, 30, 840, 70, "<p>Überschrift</p>"), { id: neueId(), typ: "bild", x: 60, y: 110, w: 840, h: 400, src: null }] },
  abschnitt:{ name: "Abschnitt", el: () => [t("titel", 80, 200, 800, 100, "<p>Neues Kapitel</p>", { ausr: "c" }), t("untertitel", 160, 310, 640, 50, "<p>Worum es jetzt geht</p>", { ausr: "c" })] },
  nurTitel:{ name: "Nur Titel", el: () => [t("titel", 60, 36, 840, 80, "<p>Überschrift</p>")] },
  leer:    { name: "Leer", el: () => [] }
};
export function neueFolie(layout = "inhalt") { return { id: neueId(), layout, el: (LAYOUTS[layout] || LAYOUTS.inhalt).el(), notiz: "", ueber: "" }; }

// Schriftgröße je Rolle (Punkte auf der 960er-Folie)
export const GROESSE = { titel: 40, untertitel: 24, text: 24, frei: 22 };

/* ---------- Formen ---------- */

export const FORMEN = [["rechteck", "▭ Rechteck"], ["rund", "▢ Abgerundet"], ["kreis", "◯ Kreis"], ["dreieck", "△ Dreieck"], ["pfeil", "➜ Pfeil"], ["linie", "─ Linie"], ["stern", "☆ Stern"], ["blase", "💬 Sprechblase"]];
export function formSvg(el) {
  const w = el.w, h = el.h, f = el.fuell || "none", r = el.rand || "none", rb = el.randBreite == null ? 3 : el.randBreite;
  const st = ' fill="' + esc(f) + '" stroke="' + esc(r) + '" stroke-width="' + rb + '" vector-effect="non-scaling-stroke"';
  let inner = "";
  const i = rb / 2;
  switch (el.art) {
    case "rund": inner = '<rect x="' + i + '" y="' + i + '" width="' + (w - rb) + '" height="' + (h - rb) + '" rx="' + Math.min(w, h) * 0.18 + '"' + st + "/>"; break;
    case "kreis": inner = '<ellipse cx="' + w / 2 + '" cy="' + h / 2 + '" rx="' + (w / 2 - i) + '" ry="' + (h / 2 - i) + '"' + st + "/>"; break;
    case "dreieck": inner = '<polygon points="' + w / 2 + "," + i + " " + (w - i) + "," + (h - i) + " " + i + "," + (h - i) + '"' + st + "/>"; break;
    case "pfeil": { const k = h * 0.3, sp = Math.min(w * 0.4, h * 0.9); inner = '<polygon points="' + i + "," + k + " " + (w - sp) + "," + k + " " + (w - sp) + "," + i + " " + (w - i) + "," + h / 2 + " " + (w - sp) + "," + (h - i) + " " + (w - sp) + "," + (h - k) + " " + i + "," + (h - k) + '"' + st + "/>"; break; }
    case "linie": inner = '<line x1="0" y1="' + h / 2 + '" x2="' + w + '" y2="' + h / 2 + '" stroke="' + esc(r === "none" ? "#2b3445" : r) + '" stroke-width="' + Math.max(2, rb) + '" stroke-linecap="round"/>'; break;
    case "stern": { const p = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 0.4 : 1; p.push((w / 2 + Math.cos(a) * (w / 2 - i) * rr).toFixed(1) + "," + (h / 2 + 0.05 * h + Math.sin(a) * (h / 2 - i) * rr).toFixed(1)); } inner = '<polygon points="' + p.join(" ") + '"' + st + "/>"; break; }
    case "blase": inner = '<path d="M' + (w * 0.12) + " " + i + "H" + (w * 0.88) + "Q" + (w - i) + " " + i + " " + (w - i) + " " + (h * 0.14) + "V" + (h * 0.6) + "Q" + (w - i) + " " + (h * 0.75) + " " + (w * 0.88) + " " + (h * 0.75) + "H" + (w * 0.35) + "L" + (w * 0.18) + " " + (h - i) + "L" + (w * 0.22) + " " + (h * 0.75) + "H" + (w * 0.12) + "Q" + i + " " + (h * 0.75) + " " + i + " " + (h * 0.6) + "V" + (h * 0.14) + "Q" + i + " " + i + " " + (w * 0.12) + " " + i + 'Z"' + st + "/>"; break;
    default: inner = '<rect x="' + i + '" y="' + i + '" width="' + (w - rb) + '" height="' + (h - rb) + '"' + st + "/>";
  }
  return '<svg class="form-svg" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" width="100%" height="100%">' + inner + "</svg>";
}

/* ---------- Folie als HTML ---------- */

function dekoHtml(d) {
  const a = d.akzent;
  switch (d.deko) {
    case "balken": return '<div class="deko" style="left:0;top:0;width:14px;height:540px;background:' + a + '"></div>';
    case "punkt": return '<div class="deko" style="right:-80px;top:-80px;width:260px;height:260px;border-radius:50%;background:' + a + ';opacity:.18"></div><div class="deko" style="right:40px;bottom:30px;width:70px;height:6px;border-radius:3px;background:' + a + '"></div>';
    case "linie": return '<div class="deko" style="left:60px;right:60px;bottom:36px;height:2px;background:' + a + ';opacity:.6"></div>';
    case "welle": return '<svg class="deko" style="left:0;bottom:0" width="960" height="90" viewBox="0 0 960 90"><path d="M0 60 Q240 10 480 50 T960 40 V90 H0Z" fill="' + a + '" opacity=".22"/><path d="M0 75 Q260 40 520 70 T960 60 V90 H0Z" fill="' + a + '" opacity=".35"/></svg>';
    case "rahmen": return '<div class="deko" style="left:16px;top:16px;right:16px;bottom:16px;border:3px solid ' + a + ';border-radius:6px;opacity:.55"></div>';
    case "kreise": return '<div class="deko" style="left:-60px;bottom:-60px;width:200px;height:200px;border-radius:50%;background:' + a + ';opacity:.2"></div><div class="deko" style="right:-40px;top:-40px;width:150px;height:150px;border-radius:50%;background:#6d3fd6;opacity:.15"></div>';
  }
  return "";
}

// opt: { bearbeiten: true } zeigt leere Bild-Plätze; { schritt: n } blendet Animationen > n aus; { katex: fn } rendert Formeln
export function folieHtml(folie, designId, opt = {}) {
  const d = design(designId), hg = folie.hg || d.hg;
  let h = '<div class="folie" style="width:' + W + "px;height:" + H + "px;background:" + (folie.hg ? hg : "linear-gradient(160deg," + d.hg + " 55%," + d.hg2 + ")") + ";color:" + d.text + ";font-family:" + fam(d.schrift) + '">' + (folie.hg ? "" : dekoHtml(d));
  const reihenfolge = (folie.el || []).filter(e => e.anim).sort((a, b) => a.anim - b.anim);
  for (const e of folie.el || []) {
    if (e.aus) continue; // ausgeblendet (Ebenen)
    const schritt = e.anim ? reihenfolge.indexOf(e) + 1 : 0;
    const versteckt = opt.schritt != null && schritt > opt.schritt;
    let st = "left:" + e.x + "px;top:" + e.y + "px;width:" + e.w + "px;height:" + e.h + "px;" + (e.dreh ? "transform:rotate(" + e.dreh + "deg);" : "");
    const kl = "el el-" + e.typ + (e.rolle ? " rolle-" + e.rolle : "") + (opt.bearbeiten && e.fest ? " fest" : "") + (versteckt ? " versteckt" : "") + (opt.schritt != null && schritt === opt.schritt && opt.neu ? " anim-" + (e.animArt || "einblenden") : "");
    const attr = ' data-id="' + e.id + '"' + (opt.bearbeiten && e.anim ? ' data-anim="' + schritt + '"' : "");
    if (e.typ === "text") {
      const g = e.groesse || GROESSE[e.rolle] || GROESSE.frei;
      st += "font-size:" + g + "px;text-align:" + ({ l: "left", c: "center", r: "right" }[e.ausr] || "left") + ";" + (e.rolle === "titel" || e.rolle === "untertitel" ? "font-family:" + fam(d.schriftT) + ";" : "") + "color:" + (e.farbe || (e.rolle === "titel" ? d.titel : d.text)) + ";" + (e.rolle === "titel" ? "font-weight:700;" : "") + (e.fuell ? "background:" + e.fuell + ";padding:10px 14px;border-radius:8px;" : "");
      h += '<div class="' + kl + '" style="' + st + '"' + attr + '><div class="el-inhalt" style="--akzent:' + d.akzent + '">' + (e.html || "") + "</div></div>";
    } else if (e.typ === "bild") {
      h += '<div class="' + kl + '" style="' + st + '"' + attr + ">" + (e.src ? '<img src="' + esc(e.src) + '" alt="" style="object-fit:' + (e.zuschnitt ? "cover" : "contain") + '">' : opt.bearbeiten ? '<button type="button" class="bild-platz" data-bild-platz="' + e.id + '">🖼️ Bild einfügen</button>' : "") + "</div>";
    } else if (e.typ === "form") {
      const g = e.groesse || 22;
      h += '<div class="' + kl + '" style="' + st + "color:" + (e.farbe || "#ffffff") + ";font-size:" + g + 'px"' + attr + ">" + formSvg(e) + (e.art !== "linie" ? '<div class="el-inhalt form-text">' + (e.html || "") + "</div>" : "") + "</div>";
    } else if (e.typ === "tabelle") {
      const g = e.groesse || 18;
      h += '<div class="' + kl + '" style="' + st + "font-size:" + g + 'px"' + attr + '><table class="fol-tab' + (e.kopf !== false ? " mit-kopf" : "") + '" style="--akzent:' + d.akzent + ";--rand:" + (d.hg === "#0b111c" || d.hg === "#0b3a5b" || d.hg === "#20382c" ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.25)") + '">' +
        (e.zeilen || []).map(r => "<tr>" + r.map(c => "<td>" + esc(c) + "</td>").join("") + "</tr>").join("") + "</table></div>";
    } else if (e.typ === "formel") {
      const g = e.groesse || 32;
      h += '<div class="' + kl + '" style="' + st + "font-size:" + g + "px;color:" + (e.farbe || d.text) + '"' + attr + '><div class="el-inhalt formel-platz" data-tex="' + esc(e.tex) + '">' + (opt.katex ? opt.katex(e.tex) : esc(e.tex)) + "</div></div>";
    }
  }
  // Folienmaster: Fußzeile und Foliennummer auf jeder Folie
  if ((d.fuss || (d.nummer && opt.nr)) && !folie.ohneFuss) h += '<div class="folie-fuss" style="position:absolute;left:60px;right:60px;bottom:14px;display:flex;justify-content:space-between;font-size:14px;opacity:.7;color:' + d.text + '"><span>' + esc(d.fuss || "") + "</span><span>" + (d.nummer && opt.nr ? opt.nr : "") + "</span></div>";
  return h + "</div>";
}

/* ---------- Gliederung aus einer Heftseite (ohne KI) ---------- */

// html einer Heftseite → [{ titel, punkte: [] }]
export function gliederungAusHtml(html, seitenTitel, parse) {
  const wurzel = parse(html || "");
  const folien = [{ titel: seitenTitel || "Präsentation", punkte: [], titelfolie: true }];
  let akt = null;
  const neu = (t) => { akt = { titel: t.slice(0, 80), punkte: [] }; folien.push(akt); };
  const punkt = (text) => {
    text = text.replace(/\s+/g, " ").trim(); if (!text) return;
    if (!akt) neu(seitenTitel || "Überblick");
    // lange Absätze in Sätze teilen, maximal 6 Punkte pro Folie
    const saetze = text.length > 140 ? text.match(/[^.!?]+[.!?]*/g).map(x => x.trim()).filter(Boolean) : [text];
    for (const s of saetze) {
      if (akt.punkte.length >= 6) { const basis = akt.basis || akt.titel; neu(basis + " (Fortsetzung)"); akt.basis = basis; }
      akt.punkte.push(s.length > 160 ? s.slice(0, 157) + "…" : s);
    }
  };
  const gehe = (n) => {
    for (const k of n.children) {
      const tag = k.tagName;
      if (/^H[1-3]$/.test(tag)) { if (tag === "H1" && folien.length === 1 && !folien[0].punkte.length && k.textContent.trim() === folien[0].titel) continue; neu(k.textContent.trim()); }
      else if (tag === "UL" || tag === "OL") k.querySelectorAll(":scope > li").forEach(li => punkt(li.textContent));
      else if (tag === "TABLE") k.querySelectorAll("tr").forEach(tr => punkt(Array.from(tr.cells).map(c => c.textContent.trim()).join(" – ")));
      else if (tag === "DIV" && k.children.length && !k.classList.contains("toc")) gehe(k);
      else if (!k.classList || !k.classList.contains("toc")) punkt(k.textContent);
    }
  };
  gehe(wurzel);
  return folien.filter((f, i) => i === 0 || f.punkte.length || folien.length <= 2);
}

// KI-Antwort prüfen: { folien: [{ titel, punkte }] }
export function gliederungPruefen(obj) {
  const liste = obj && (Array.isArray(obj.folien) ? obj.folien : Array.isArray(obj) ? obj : null);
  if (!liste) return null;
  const out = liste.map(f => ({ titel: String(f.titel || f.title || "").slice(0, 90).trim(), punkte: (Array.isArray(f.punkte || f.bullets || f.points) ? (f.punkte || f.bullets || f.points) : []).map(p => String(p).trim().slice(0, 180)).filter(Boolean).slice(0, 7) })).filter(f => f.titel || f.punkte.length);
  return out.length ? out.slice(0, 20) : null;
}

export function folienAusGliederung(gl) {
  return gl.map((g, i) => {
    if (i === 0 && (g.titelfolie || g.punkte.length <= 1)) { const f = neueFolie("titel"); f.el[0].html = "<p>" + esc(g.titel) + "</p>"; f.el[1].html = "<p>" + esc(g.punkte[0] || new Date().toLocaleDateString("de-DE")) + "</p>"; return f; }
    const f = neueFolie("inhalt");
    f.el[0].html = "<p>" + esc(g.titel) + "</p>";
    f.el[1].html = g.punkte.length ? "<ul>" + g.punkte.map(p => "<li>" + esc(p) + "</li>").join("") + "</ul>" : "<p></p>";
    if (g.punkte.length > 4) f.el[1].groesse = 20;
    return f;
  });
}

export const KI_ANWEISUNG = "Du machst aus Schul-Notizen eine kurze Präsentation für eine Schülerin oder einen Schüler. " +
  "Antworte NUR mit JSON: {\"folien\":[{\"titel\":\"…\",\"punkte\":[\"…\"]}]}. Erste Folie = Titelfolie (punkte: [\"Untertitel\"]). " +
  "4 bis 10 Folien, pro Folie höchstens 5 kurze Stichpunkte (je höchstens 12 Wörter), auf Deutsch, nichts erfinden, was nicht im Text steht.";

/* ---------- Designideen: dieselben Inhalte, anders angeordnet ---------- */
export function designIdeen(folie) {
  const el = (folie.el || []).filter(e => !e.aus), titel = el.find(e => e.rolle === "titel"), texte = el.filter(e => e.typ === "text" && e !== titel), bilder = el.filter(e => e.typ === "bild" && e.src), rest = el.filter(e => e !== titel && !texte.includes(e) && !bilder.includes(e));
  const kopie = (x, pos) => Object.assign(JSON.parse(JSON.stringify(x)), pos);
  const ideen = [];
  const mit = (name, teile) => ideen.push({ name, folie: Object.assign(JSON.parse(JSON.stringify(folie)), { el: [...teile.filter(Boolean), ...rest.map(r => kopie(r, {}))] }) });
  const T = (pos, extra) => titel && kopie(titel, Object.assign(pos, extra || {}));
  const textZus = texte.length ? texte : [];
  if (bilder.length) {
    const b = bilder[0];
    mit("Bild rechts", [T({ x: 60, y: 36, w: 840, h: 80, ausr: "" }), ...textZus.map((t, i) => kopie(t, { x: 60, y: 130 + i * (370 / textZus.length), w: 420, h: 370 / textZus.length - 10 })), kopie(b, { x: 510, y: 130, w: 390, h: 370 })]);
    mit("Bild links", [T({ x: 60, y: 36, w: 840, h: 80, ausr: "" }), kopie(b, { x: 60, y: 130, w: 390, h: 370 }), ...textZus.map((t, i) => kopie(t, { x: 480, y: 130 + i * (370 / textZus.length), w: 420, h: 370 / textZus.length - 10 }))]);
    mit("Bild als Hintergrund", [kopie(b, { x: 0, y: 0, w: 960, h: 540, zuschnitt: true }), T({ x: 60, y: 300, w: 840, h: 80, fuell: "rgba(0,0,0,.55)", farbe: "#ffffff", ausr: "" }), ...textZus.slice(0, 1).map(t => kopie(t, { x: 60, y: 390, w: 840, h: 110, fuell: "rgba(0,0,0,.45)", farbe: "#ffffff" }))]);
    mit("Bild oben", [kopie(b, { x: 60, y: 30, w: 840, h: 280 }), T({ x: 60, y: 320, w: 840, h: 70, ausr: "c" }), ...textZus.slice(0, 1).map(t => kopie(t, { x: 120, y: 395, w: 720, h: 120, ausr: "c" }))]);
  } else {
    mit("Titel in der Mitte", [T({ x: 80, y: textZus.length ? 120 : 200, w: 800, h: 100, ausr: "c" }), ...textZus.map((t, i) => kopie(t, { x: 140, y: 240 + i * (240 / textZus.length), w: 680, h: 240 / textZus.length - 10, ausr: "c" }))]);
    mit("Titel links als Band", [T({ x: 0, y: 0, w: 320, h: 540, fuell: "rgba(0,0,0,.07)", ausr: "" }), ...textZus.map((t, i) => kopie(t, { x: 360, y: 60 + i * (420 / textZus.length), w: 540, h: 420 / textZus.length - 10 }))]);
    const liste = textZus.length === 1 && /<li/.test(textZus[0].html || "") ? (textZus[0].html.match(/<li[\s\S]*?<\/li>/g) || []) : [];
    if (liste.length >= 4) { const h = Math.ceil(liste.length / 2); mit("Zwei Spalten", [T({ x: 60, y: 36, w: 840, h: 80, ausr: "" }), kopie(textZus[0], { x: 60, y: 130, w: 405, h: 370, html: "<ul>" + liste.slice(0, h).join("") + "</ul>" }), Object.assign(kopie(textZus[0], { x: 495, y: 130, w: 405, h: 370, html: "<ul>" + liste.slice(h).join("") + "</ul>" }), { id: neueId() })]); }
    mit("Großer Titel oben", [T({ x: 60, y: 40, w: 840, h: 130, ausr: "", groesse: 54 }), ...textZus.map((t, i) => kopie(t, { x: 60, y: 190 + i * (310 / textZus.length), w: 840, h: 310 / textZus.length - 10 }))]);
  }
  return ideen.filter(i => i.folie.el.length);
}
