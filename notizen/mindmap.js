// FIDELIA Notizen · Mindmaps
// Ein Thema in der Mitte, Äste und Unteräste drumherum. Tippen = auswählen, ziehen = verschieben,
// doppelt tippen = Text ändern. Ergebnis als Bild (im Heft und auf Folien wieder bearbeitbar).

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const FARBEN = ["#2f6fdb", "#ff8a3c", "#1a8f4c", "#c93a3a", "#6d3fd6", "#0f766e", "#b8235a", "#a36b00"];
const id = () => Math.random().toString(36).slice(2, 9);

export function neu(thema = "Thema") { return { knoten: [{ id: "wurzel", text: thema, x: 0, y: 0, eltern: null }] }; }

const breite = (k, tiefe) => Math.max(tiefe === 0 ? 120 : 70, Math.min(260, k.text.length * (tiefe === 0 ? 11 : tiefe === 1 ? 9 : 8) + 30));
const hoehe = (tiefe) => tiefe === 0 ? 56 : tiefe === 1 ? 40 : 32;
function tiefe(m, k) { let t = 0, a = k; while (a.eltern) { a = m.knoten.find(x => x.id === a.eltern); t++; if (!a) break; } return t; }
function farbe(m, k) {
  if (k.farbe) return k.farbe;
  let a = k; while (a.eltern && a.eltern !== "wurzel") a = m.knoten.find(x => x.id === a.eltern) || { eltern: null };
  if (!a.eltern) return "#14213d";
  const aeste = m.knoten.filter(x => x.eltern === "wurzel");
  return a.farbe || FARBEN[Math.max(0, aeste.indexOf(a)) % FARBEN.length];
}

// Platz für ein neues Kind: weg von der Mitte, verteilt
export function kindDazu(m, elternId, text = "Neuer Ast") {
  const e = m.knoten.find(x => x.id === elternId); if (!e) return null;
  const kinder = m.knoten.filter(x => x.eltern === elternId);
  let x, y;
  if (elternId === "wurzel") { const n = kinder.length, w = -Math.PI / 2 + n * (Math.PI * 2 / 6) + (n >= 6 ? Math.PI / 6 : 0), r = 230 + Math.floor(n / 6) * 70; x = Math.cos(w) * r * 1.25; y = Math.sin(w) * r * 0.8; }
  else { const ew = Math.atan2(e.y, e.x), n = kinder.length, w = ew + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 0.42; x = e.x + Math.cos(w) * 190; y = e.y + Math.sin(w) * 110; }
  const k = { id: id(), text, x: Math.round(x), y: Math.round(y), eltern: elternId };
  m.knoten.push(k);
  return k;
}

export function rahmen(m) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  m.knoten.forEach(k => { const t = tiefe(m, k), w = breite(k, t), h = hoehe(t); a = Math.min(a, k.x - w / 2); c = Math.max(c, k.x + w / 2); b = Math.min(b, k.y - h / 2); d = Math.max(d, k.y + h / 2); });
  return { x: a - 30, y: b - 30, w: c - a + 60, h: d - b + 60 };
}

export function svg(m, { gewaehlt = null, fest = null } = {}) {
  const r = fest || rahmen(m);
  let o = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + r.x + " " + r.y + " " + r.w + " " + r.h + '" width="' + r.w + '" height="' + r.h + '" font-family="Space Grotesk, Arial, sans-serif"><rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '" fill="#fff"/>';
  // Äste zuerst (hinter den Kästchen)
  m.knoten.forEach(k => {
    if (!k.eltern) return;
    const e = m.knoten.find(x => x.id === k.eltern); if (!e) return;
    const t = tiefe(m, k), f = farbe(m, k), mx = (e.x + k.x) / 2;
    o += '<path d="M' + e.x + " " + e.y + " C" + mx + " " + e.y + " " + mx + " " + k.y + " " + k.x + " " + k.y + '" fill="none" stroke="' + f + '" stroke-width="' + (t === 1 ? 6 : 3.5) + '" stroke-linecap="round" opacity=".85"/>';
  });
  m.knoten.forEach(k => {
    const t = tiefe(m, k), w = breite(k, t), h = hoehe(t), f = farbe(m, k);
    const zeilen = k.text.length > 28 ? [k.text.slice(0, k.text.lastIndexOf(" ", 28) > 8 ? k.text.lastIndexOf(" ", 28) : 28), k.text.slice(k.text.lastIndexOf(" ", 28) > 8 ? k.text.lastIndexOf(" ", 28) + 1 : 28)] : [k.text];
    const hh = h + (zeilen.length - 1) * 16;
    o += '<g data-k="' + k.id + '" style="cursor:pointer">';
    if (t === 0) o += '<rect x="' + (k.x - w / 2) + '" y="' + (k.y - hh / 2) + '" width="' + w + '" height="' + hh + '" rx="' + hh / 2 + '" fill="#14213d"/>';
    else if (t === 1) o += '<rect x="' + (k.x - w / 2) + '" y="' + (k.y - hh / 2) + '" width="' + w + '" height="' + hh + '" rx="12" fill="' + f + '"/>';
    else o += '<rect x="' + (k.x - w / 2) + '" y="' + (k.y - hh / 2) + '" width="' + w + '" height="' + hh + '" rx="10" fill="#fff" stroke="' + f + '" stroke-width="2.5"/>';
    if (gewaehlt === k.id) o += '<rect x="' + (k.x - w / 2 - 5) + '" y="' + (k.y - hh / 2 - 5) + '" width="' + (w + 10) + '" height="' + (hh + 10) + '" rx="14" fill="none" stroke="#ff8a3c" stroke-width="3" stroke-dasharray="6 4"/>';
    zeilen.forEach((z, i) => { o += '<text x="' + k.x + '" y="' + (k.y + 5 + (i - (zeilen.length - 1) / 2) * 17) + '" text-anchor="middle" font-size="' + (t === 0 ? 20 : t === 1 ? 16 : 14) + '" font-weight="' + (t < 2 ? 600 : 400) + '" fill="' + (t < 2 ? "#fff" : "#101826") + '">' + esc(z) + "</text>"; });
    o += "</g>";
  });
  return o + "</svg>";
}

export async function alsPng(m) {
  const r = rahmen(m), s = svg(m, { fest: r }), f = Math.min(2, 2400 / Math.max(r.w, r.h));
  return new Promise(ok => { const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); c.width = Math.round(r.w * f); c.height = Math.round(r.h * f); const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); ok({ png: c.toDataURL("image/png"), w: r.w, h: r.h }); }; img.onerror = () => ok(null); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s); });
}

export function dialog(alt) {
  const m = alt ? JSON.parse(JSON.stringify(alt)) : neu(prompt("Worum geht es? (Thema in der Mitte)", "") || "Thema");
  if (!alt && m.knoten.length === 1) ["Ast 1", "Ast 2", "Ast 3"].forEach(t => kindDazu(m, "wurzel", t));
  let gewaehlt = "wurzel";
  return new Promise(fertig => {
    const d = document.createElement("dialog"); d.className = "sheet breit mindmap-dlg";
    d.innerHTML = '<div class="sheet-in"><h2>🧠 Mindmap</h2>' +
      '<div class="teilen-knoepfe"><button type="button" class="btn small primary" data-m="kind">＋ Ast</button><button type="button" class="btn small" data-m="text">✎ Text</button><button type="button" class="btn small" data-m="weg">🗑 Löschen</button>' +
      '<span class="mm-farben">' + FARBEN.map(f => '<button type="button" class="mm-farbe" data-f="' + f + '" style="background:' + f + '" aria-label="Farbe"></button>').join("") + '</span><button type="button" class="btn small" data-m="ordnen" title="Äste gleichmäßig verteilen">✨ Ordnen</button></div>' +
      '<div class="mm-flaeche" id="mf"></div><p class="muted klein">Tippen = auswählen · ziehen = verschieben · doppelt tippen = Text ändern · Enter = neuer Ast · Entf = löschen</p>' +
      '<div class="sheet-foot"><button type="button" class="btn" id="ab">Abbrechen</button><span class="sp"></span><button type="button" class="btn primary" id="ok">Einfügen</button></div></div>';
    document.body.appendChild(d);
    const flaeche = d.querySelector("#mf");
    let ansicht = null;
    const zeichnen = () => { const r = rahmen(m); ansicht = { x: Math.min(r.x, -420), y: Math.min(r.y, -260), w: 0, h: 0 }; ansicht.w = Math.max(r.x + r.w, 420) - ansicht.x; ansicht.h = Math.max(r.y + r.h, 260) - ansicht.y; flaeche.innerHTML = svg(m, { gewaehlt, fest: ansicht }); const s = flaeche.querySelector("svg"); s.removeAttribute("width"); s.removeAttribute("height"); };
    const knoten = () => m.knoten.find(k => k.id === gewaehlt);
    const textAendern = () => { const k = knoten(); if (!k) return; const t = prompt("Text:", k.text); if (t !== null && t.trim()) { k.text = t.trim().slice(0, 60); zeichnen(); } };
    const loeschen = () => { if (gewaehlt === "wurzel") return; const weg = new Set([gewaehlt]); let mehr = true; while (mehr) { mehr = false; m.knoten.forEach(k => { if (k.eltern && weg.has(k.eltern) && !weg.has(k.id)) { weg.add(k.id); mehr = true; } }); } const e = knoten().eltern; m.knoten = m.knoten.filter(k => !weg.has(k.id)); gewaehlt = e; zeichnen(); };
    d.querySelector('[data-m="kind"]').onclick = () => { const k = kindDazu(m, gewaehlt, "Neu"); gewaehlt = k.id; zeichnen(); textAendern(); };
    d.querySelector('[data-m="text"]').onclick = textAendern;
    d.querySelector('[data-m="weg"]').onclick = loeschen;
    d.querySelector('[data-m="ordnen"]').onclick = () => { const alle = m.knoten.slice(); m.knoten = [alle.find(k => k.id === "wurzel")]; const rein = (eltern) => alle.filter(k => k.eltern === eltern).forEach(k => { const neuK = kindDazu(m, eltern, k.text); m.knoten = m.knoten.filter(x => x !== neuK); m.knoten.push(Object.assign(k, { x: neuK.x, y: neuK.y })); rein(k.id); }); rein("wurzel"); zeichnen(); };
    d.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { const k = knoten(); if (k && k.id !== "wurzel") { k.farbe = b.dataset.f; zeichnen(); } });
    // Ziehen und Tippen
    let zieh = null, letzterTipp = 0;
    const punkt = (e) => { const s = flaeche.querySelector("svg"), r = s.getBoundingClientRect(); return { x: ansicht.x + (e.clientX - r.left) / r.width * ansicht.w, y: ansicht.y + (e.clientY - r.top) / r.height * ansicht.h }; };
    flaeche.addEventListener("pointerdown", (e) => {
      const g = e.target.closest("[data-k]"); if (!g) return;
      e.preventDefault();
      const jetzt = Date.now();
      if (gewaehlt === g.dataset.k && jetzt - letzterTipp < 400) { textAendern(); return; }
      letzterTipp = jetzt; gewaehlt = g.dataset.k;
      const k = knoten(), p = punkt(e); zieh = { k, dx: k.x - p.x, dy: k.y - p.y, fest: { ...ansicht } };
      flaeche.setPointerCapture(e.pointerId); zeichnen();
    });
    flaeche.addEventListener("pointermove", (e) => {
      if (!zieh) return; const p = punkt(e);
      // Unteräste wandern mit
      const nx = Math.round(p.x + zieh.dx), ny = Math.round(p.y + zieh.dy), dx = nx - zieh.k.x, dy = ny - zieh.k.y;
      const mit = new Set([zieh.k.id]); let mehr = true; while (mehr) { mehr = false; m.knoten.forEach(k => { if (k.eltern && mit.has(k.eltern) && !mit.has(k.id)) { mit.add(k.id); mehr = true; } }); }
      m.knoten.forEach(k => { if (mit.has(k.id)) { k.x += dx; k.y += dy; } });
      flaeche.innerHTML = svg(m, { gewaehlt, fest: ansicht }); const s = flaeche.querySelector("svg"); s.removeAttribute("width"); s.removeAttribute("height");
    });
    flaeche.addEventListener("pointerup", () => { if (zieh) { zieh = null; zeichnen(); } });
    d.addEventListener("keydown", (e) => { if (e.target.tagName === "INPUT") return; if (e.key === "Enter") { e.preventDefault(); d.querySelector('[data-m="kind"]').click(); } if (e.key === "Delete") { e.preventDefault(); loeschen(); } if (e.key === "F2") { e.preventDefault(); textAendern(); } });
    let ergebnis = null;
    d.querySelector("#ab").onclick = () => d.close();
    d.querySelector("#ok").onclick = async () => { const r = await alsPng(m); ergebnis = r ? { ...r, daten: m } : null; d.close(); };
    d.addEventListener("close", () => { d.remove(); fertig(ergebnis); });
    zeichnen(); d.showModal();
  });
}
