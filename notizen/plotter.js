// FIDELIA Notizen · Funktionen zeichnen (wie ein Grafikrechner)
// f(x) eintippen → Graph im Koordinatensystem, mit Nullstellen. Ergebnis als Bild fürs Heft oder die Folie.

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const FARBEN = ["#2f6fdb", "#c93a3a", "#1a8f4c", "#6d3fd6", "#ff8a3c"];

/* ---------- Term lesen ---------- */

const FUNK = { sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, sqrt: Math.sqrt, wurzel: Math.sqrt, abs: Math.abs, betrag: Math.abs, ln: Math.log, log: Math.log10, lg: Math.log10, exp: Math.exp, sinh: Math.sinh, cosh: Math.cosh };

export function lesen(term) {
  const t = String(term).toLowerCase().replace(/\s+/g, "").replace(/^(f|g|h|y)\(?x?\)?=/, "").replace(/π/g, "pi").replace(/√/g, "sqrt").replace(/·|×/g, "*").replace(/÷|:/g, "/").replace(/²/g, "^2").replace(/³/g, "^3").replace(/−/g, "-");
  let p = 0;
  const z = [];
  while (p < t.length) {
    const r = t.slice(p);
    let m = /^\d+(?:[.,]\d+)?/.exec(r); if (m) { z.push({ a: "zahl", v: Number(m[0].replace(",", ".")) }); p += m[0].length; continue; }
    m = /^(asin|acos|atan|sinh|cosh|sin|cos|tan|sqrt|wurzel|abs|betrag|ln|log|lg|exp)/.exec(r); if (m && r[m[0].length] === "(") { z.push({ a: "fn", v: m[0] }); p += m[0].length; continue; }
    if (r.startsWith("pi")) { z.push({ a: "zahl", v: Math.PI }); p += 2; continue; }
    if (r[0] === "e" && !/^exp/.test(r)) { z.push({ a: "zahl", v: Math.E }); p++; continue; }
    if (r[0] === "x") { z.push({ a: "x" }); p++; continue; }
    if ("+-*/^()".includes(r[0])) { z.push({ a: r[0] }); p++; continue; }
    if (r[0] === "|") { z.push({ a: "|" }); p++; continue; }
    throw new Error("Unbekanntes Zeichen: " + r[0]);
  }
  // Mal-Zeichen ergänzen: 2x, 2(x), x(x), )(…), 3sin(x), x pi
  const t2 = [];
  z.forEach((k, i) => {
    const vor = t2[t2.length - 1];
    if (vor && (vor.a === "zahl" || vor.a === "x" || vor.a === ")") && (k.a === "zahl" || k.a === "x" || k.a === "(" || k.a === "fn")) t2.push({ a: "*" });
    t2.push(k);
  });
  let i = 0;
  const sieh = () => t2[i], nimm = () => t2[i++];
  function summe() { let l = produkt(); while (sieh() && (sieh().a === "+" || sieh().a === "-")) { const o = nimm().a, r = produkt(), a = l; l = o === "+" ? (x) => a(x) + r(x) : (x) => a(x) - r(x); } return l; }
  function produkt() { let l = vorz(); while (sieh() && (sieh().a === "*" || sieh().a === "/")) { const o = nimm().a, r = vorz(), a = l; l = o === "*" ? (x) => a(x) * r(x) : (x) => a(x) / r(x); } return l; }
  function vorz() { if (sieh() && sieh().a === "-") { nimm(); const v = vorz(); return (x) => -v(x); } if (sieh() && sieh().a === "+") { nimm(); return vorz(); } return potenz(); }
  function potenz() { const b = einfach(); if (sieh() && sieh().a === "^") { nimm(); const e = vorz(); return (x) => Math.pow(b(x), e(x)); } return b; }
  function einfach() {
    const k = nimm(); if (!k) throw new Error("Term ist unvollständig");
    if (k.a === "zahl") return () => k.v;
    if (k.a === "x") return (x) => x;
    if (k.a === "(") { const v = summe(); if (!sieh() || nimm().a !== ")") throw new Error("Klammer fehlt"); return v; }
    if (k.a === "|") { const v = summe(); if (!sieh() || nimm().a !== "|") throw new Error("Betragsstrich fehlt"); return (x) => Math.abs(v(x)); }
    if (k.a === "fn") { if (nimm().a !== "(") throw new Error("Klammer fehlt"); const v = summe(); if (!sieh() || nimm().a !== ")") throw new Error("Klammer fehlt"); const f = FUNK[k.v]; return (x) => f(v(x)); }
    throw new Error("Da stimmt etwas nicht");
  }
  const f = summe();
  if (i < t2.length) throw new Error("Da stimmt etwas nicht");
  return f;
}

/* ---------- Zeichnen ---------- */

function schritt(spanne) { const roh = spanne / 10, p = Math.pow(10, Math.floor(Math.log10(roh))), n = roh / p; return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p; }
const zahl = (v) => Number(v.toPrecision(6)).toLocaleString("de-DE");

export function nullstellen(f, a, b) {
  const out = [], n = 800;
  let x0 = a, y0 = f(a);
  for (let k = 1; k <= n; k++) {
    const x1 = a + (b - a) * k / n, y1 = f(x1);
    if (isFinite(y0) && isFinite(y1)) {
      if (y0 === 0) out.push(x0);
      else if (y0 * y1 < 0 && Math.abs(y1 - y0) < (b - a)) { let l = x0, r = x1; for (let j = 0; j < 50; j++) { const m = (l + r) / 2; if (f(l) * f(m) <= 0) r = m; else l = m; } out.push((l + r) / 2); }
    }
    x0 = x1; y0 = y1;
  }
  return out.filter((v, i) => i === 0 || Math.abs(v - out[i - 1]) > (b - a) / 400).slice(0, 12);
}

export function svg(d, W = 720, H = 480) {
  const { xmin, xmax, ymin, ymax } = d;
  const X = (x) => (x - xmin) / (xmax - xmin) * W, Y = (y) => H - (y - ymin) / (ymax - ymin) * H;
  let o = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" font-family="Space Grotesk, Arial, sans-serif"><rect width="' + W + '" height="' + H + '" fill="#fff"/>';
  const sx = schritt(xmax - xmin), sy = schritt(ymax - ymin);
  if (d.gitter !== false) {
    for (let v = Math.ceil(xmin / sx) * sx; v <= xmax; v += sx) o += '<line x1="' + X(v).toFixed(1) + '" y1="0" x2="' + X(v).toFixed(1) + '" y2="' + H + '" stroke="#e4e9f1"/>';
    for (let v = Math.ceil(ymin / sy) * sy; v <= ymax; v += sy) o += '<line x1="0" y1="' + Y(v).toFixed(1) + '" x2="' + W + '" y2="' + Y(v).toFixed(1) + '" stroke="#e4e9f1"/>';
  }
  // Achsen mit Pfeilen und Zahlen
  const ax = Math.min(Math.max(Y(0), 0), H), ay = Math.min(Math.max(X(0), 0), W);
  o += '<line x1="0" y1="' + ax + '" x2="' + W + '" y2="' + ax + '" stroke="#101826" stroke-width="1.5"/><polygon points="' + W + "," + ax + " " + (W - 10) + "," + (ax - 5) + " " + (W - 10) + "," + (ax + 5) + '" fill="#101826"/>';
  o += '<line x1="' + ay + '" y1="0" x2="' + ay + '" y2="' + H + '" stroke="#101826" stroke-width="1.5"/><polygon points="' + ay + ",0 " + (ay - 5) + ",10 " + (ay + 5) + ',10" fill="#101826"/>';
  o += '<text x="' + (W - 14) + '" y="' + (ax - 8) + '" font-size="14" font-style="italic" text-anchor="end">x</text><text x="' + (ay + 8) + '" y="16" font-size="14" font-style="italic">y</text>';
  for (let v = Math.ceil(xmin / sx) * sx; v <= xmax - sx / 2; v += sx) if (Math.abs(v) > sx / 10) o += '<line x1="' + X(v).toFixed(1) + '" y1="' + (ax - 4) + '" x2="' + X(v).toFixed(1) + '" y2="' + (ax + 4) + '" stroke="#101826"/><text x="' + X(v).toFixed(1) + '" y="' + Math.min(H - 4, ax + 18) + '" font-size="12" text-anchor="middle" fill="#5b6578">' + zahl(v) + "</text>";
  for (let v = Math.ceil(ymin / sy) * sy; v <= ymax - sy / 2; v += sy) if (Math.abs(v) > sy / 10) o += '<line x1="' + (ay - 4) + '" y1="' + Y(v).toFixed(1) + '" x2="' + (ay + 4) + '" y2="' + Y(v).toFixed(1) + '" stroke="#101826"/><text x="' + Math.max(4, ay - 8) + '" y="' + (Y(v) + 4).toFixed(1) + '" font-size="12" text-anchor="' + (ay - 8 < 20 ? "start" : "end") + '" fill="#5b6578">' + zahl(v) + "</text>";
  // Graphen
  const legende = [];
  d.funktionen.forEach((fu, k) => {
    if (!fu.term.trim()) return;
    let f; try { f = lesen(fu.term); } catch (e) { return; }
    const farbe = fu.farbe || FARBEN[k % FARBEN.length];
    let pfad = "", vorher = null; const n = 900;
    for (let i = 0; i <= n; i++) {
      const xx = xmin + (xmax - xmin) * i / n, yy = f(xx);
      if (!isFinite(yy) || Math.abs(yy) > 1e6) { vorher = null; continue; }
      const py = Y(yy);
      if (vorher !== null && Math.abs(py - vorher) > H * 1.5) { vorher = null; }
      pfad += (vorher === null ? "M" : "L") + X(xx).toFixed(1) + " " + Math.max(-H, Math.min(2 * H, py)).toFixed(1);
      vorher = py;
    }
    o += '<path d="' + pfad + '" fill="none" stroke="' + farbe + '" stroke-width="2.6" stroke-linejoin="round"/>';
    if (d.nullstellen) nullstellen(f, xmin, xmax).forEach(z => { o += '<circle cx="' + X(z).toFixed(1) + '" cy="' + Y(0).toFixed(1) + '" r="4.5" fill="#fff" stroke="' + farbe + '" stroke-width="2.5"/><text x="' + X(z).toFixed(1) + '" y="' + (Y(0) - 10).toFixed(1) + '" font-size="11" text-anchor="middle" fill="' + farbe + '">' + zahl(Math.round(z * 1000) / 1000) + "</text>"; });
    legende.push([(["f", "g", "h", "k", "p"][k] || "f") + "(x) = " + fu.term.replace(/^(f|g|h|y)\(?x?\)?\s*=\s*/i, ""), farbe]);
  });
  legende.forEach((l, i) => { o += '<rect x="10" y="' + (10 + i * 24) + '" width="' + (l[0].length * 7.4 + 22) + '" height="20" rx="5" fill="#fff" opacity=".88"/><rect x="16" y="' + (19 + i * 24) + '" width="12" height="3" fill="' + l[1] + '"/><text x="32" y="' + (25 + i * 24) + '" font-size="13" fill="#101826">' + esc(l[0]) + "</text>"; });
  return o + "</svg>";
}

/* ---------- Dialog ---------- */

export function dialog(alt) {
  const d0 = alt || { funktionen: [{ term: "x^2 - 2" }, { term: "" }, { term: "" }], xmin: -5, xmax: 5, ymin: -4, ymax: 6, gitter: true, nullstellen: true };
  const daten = JSON.parse(JSON.stringify(d0));
  while (daten.funktionen.length < 3) daten.funktionen.push({ term: "" });
  return new Promise(fertig => {
    const d = document.createElement("dialog"); d.className = "sheet breit";
    d.innerHTML = '<div class="sheet-in"><h2>📈 Funktion zeichnen</h2><div class="plot-raster"><div class="plot-eingabe">' +
      daten.funktionen.map((f, i) => '<label class="plot-term"><span style="color:' + FARBEN[i] + '">' + ["f", "g", "h"][i] + '(x) =</span><input class="inp" data-i="' + i + '" value="' + esc(f.term) + '" placeholder="' + ["z. B. 2x + 1", "z. B. x^2 - 3", "z. B. sin(x)"][i] + '" autocomplete="off" spellcheck="false"></label>').join("") +
      '<div class="plot-bereich"><label>x von <input class="inp" type="number" step="any" id="xmin" value="' + daten.xmin + '"></label><label>bis <input class="inp" type="number" step="any" id="xmax" value="' + daten.xmax + '"></label>' +
      '<label>y von <input class="inp" type="number" step="any" id="ymin" value="' + daten.ymin + '"></label><label>bis <input class="inp" type="number" step="any" id="ymax" value="' + daten.ymax + '"></label></div>' +
      '<label class="wahl-zeile"><input type="checkbox" id="nst"' + (daten.nullstellen ? " checked" : "") + '> <span>Nullstellen markieren</span></label>' +
      '<label class="wahl-zeile"><input type="checkbox" id="git"' + (daten.gitter !== false ? " checked" : "") + '> <span>Kästchen-Gitter</span></label>' +
      '<p class="muted klein">Erlaubt: + − * / ^, Klammern, 2x, sin, cos, tan, sqrt (Wurzel), abs, ln, log, exp, pi. Komma geht auch (0,5x).</p><p class="fehler-text" id="pf"></p></div>' +
      '<div class="plot-bild" id="pb"></div></div>' +
      '<div class="sheet-foot"><button type="button" class="btn" id="ab">Abbrechen</button><span class="sp"></span><button type="button" class="btn primary" id="ok">Einfügen</button></div></div>';
    document.body.appendChild(d);
    const neu = () => {
      daten.funktionen.forEach((f, i) => f.term = d.querySelector('[data-i="' + i + '"]').value);
      ["xmin", "xmax", "ymin", "ymax"].forEach(k => { const v = parseFloat(d.querySelector("#" + k).value); if (isFinite(v)) daten[k] = v; });
      if (daten.xmax <= daten.xmin) daten.xmax = daten.xmin + 1; if (daten.ymax <= daten.ymin) daten.ymax = daten.ymin + 1;
      daten.nullstellen = d.querySelector("#nst").checked; daten.gitter = d.querySelector("#git").checked;
      const fehler = []; daten.funktionen.forEach((f, i) => { if (f.term.trim()) try { lesen(f.term); } catch (e) { fehler.push(["f", "g", "h"][i] + ": " + e.message); } });
      d.querySelector("#pf").textContent = fehler.join(" · ");
      d.querySelector("#pb").innerHTML = svg(daten);
    };
    d.querySelectorAll("input").forEach(i => i.addEventListener("input", neu));
    neu();
    let ergebnis = null;
    d.querySelector("#ab").onclick = () => d.close();
    d.querySelector("#ok").onclick = async () => {
      if (!daten.funktionen.some(f => f.term.trim())) { d.querySelector("#pf").textContent = "Gib mindestens eine Funktion ein."; return; }
      const W = 720, H = 480, s = svg(daten, W, H);
      const png = await new Promise(ok => { const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); c.width = W * 2; c.height = H * 2; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); ok(c.toDataURL("image/png")); }; img.onerror = () => ok(null); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s); });
      ergebnis = png ? { png, w: W, h: H, daten: { ...daten, funktionen: daten.funktionen.filter(f => f.term.trim()) } } : null;
      d.close();
    };
    d.addEventListener("close", () => { d.remove(); fertig(ergebnis); });
    d.showModal();
    setTimeout(() => d.querySelector('[data-i="0"]').focus(), 50);
  });
}
