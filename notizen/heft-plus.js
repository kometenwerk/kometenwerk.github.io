// FIDELIA Notizen · Heft-Extras wie in Word: Suchen & Ersetzen, Zeilenabstand, Spalten, Seitenumbruch,
// Kommentare, Bilder drehen und zuschneiden

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function startHtml() {
  return '<select data-w="abstand" aria-label="Zeilenabstand" title="Zeilenabstand"><option value="">↕ Abstand</option><option value="1">1,0</option><option value="1.15">1,15</option><option value="1.5">1,5</option><option value="2">2,0</option></select>' +
    '<select data-w="spalten" aria-label="Spalten" title="Text in Spalten"><option value="">▥ Spalten</option><option value="1">1 Spalte</option><option value="2">2 Spalten</option><option value="3">3 Spalten</option></select>';
}
export function einfuegenHtml() {
  return '<span class="trenn"></span><button type="button" data-x="umbruch" title="Seitenumbruch (Strg+Enter)" aria-label="Seitenumbruch einfügen">⤓ Seitenumbruch</button>' +
    '<button type="button" data-x="kommentar" title="Kommentar zur Markierung" aria-label="Kommentar einfügen">💬 Kommentar</button>';
}
export function werkzeugeHtml() {
  return '<button type="button" data-x="suchen" title="Suchen und Ersetzen (Strg+F / Strg+H)" aria-label="Suchen und Ersetzen">🔎 Suchen</button>';
}

/* ---------- Absätze unter der Markierung ---------- */
const BLOCK = "P,H1,H2,H3,H4,LI,BLOCKQUOTE,DIV";
function bloecke(rich) {
  const s = getSelection(); if (!s.rangeCount) return [];
  const r = s.getRangeAt(0); if (!rich.contains(r.commonAncestorContainer)) return [];
  const zuBlock = (n) => { let e = n.nodeType === 1 ? n : n.parentElement; while (e && e !== rich && !(BLOCK.includes(e.tagName) && e.parentElement && (e.parentElement === rich || /^(UL|OL|DIV|BLOCKQUOTE|TD|TH)$/.test(e.parentElement.tagName)))) e = e.parentElement; return e && e !== rich ? e : null; };
  const a = zuBlock(r.startContainer), b = zuBlock(r.endContainer);
  if (!a) return [];
  const aus = [a]; if (a === b || !b) return aus;
  const w = document.createTreeWalker(rich, NodeFilter.SHOW_ELEMENT); w.currentNode = a; let n;
  while ((n = w.nextNode())) { if (BLOCK.includes(n.tagName) && zuBlock(n) === n && !n.classList.contains("spalten")) aus.push(n); if (n === b) break; }
  return aus;
}

export function binden(wurzel, rich, geaendert, schnappschuss) {
  const x = (id) => wurzel.querySelector('[data-x="' + id + '"]') || { set onclick(f) {} };
  const w = (id) => wurzel.querySelector('[data-w="' + id + '"]');

  // Zeilenabstand
  const ab = w("abstand");
  if (ab) ab.onchange = () => { const v = ab.value; ab.value = ""; if (!v) return; const bl = bloecke(rich); if (!bl.length) { KW.toast("Erst in einen Absatz klicken."); return; } schnappschuss(true); bl.forEach(b => { b.style.lineHeight = v === "1.15" ? "1.15" : v; }); geaendert(); };
  // Spalten
  const sp = w("spalten");
  if (sp) sp.onchange = () => {
    const v = Number(sp.value); sp.value = ""; if (!v) return;
    const bl = bloecke(rich); if (!bl.length) { KW.toast("Erst Text markieren, der in Spalten soll."); return; }
    schnappschuss(true);
    const schon = bl[0].closest(".spalten");
    if (schon) { if (v === 1) { schon.replaceWith(...schon.childNodes); } else schon.className = "spalten spalten-" + v; geaendert(); return; }
    if (v === 1) return;
    const oben = bl.map(b => { let e = b; while (e.parentElement !== rich) e = e.parentElement; return e; }).filter((e, i, a) => a.indexOf(e) === i);
    const d = document.createElement("div"); d.className = "spalten spalten-" + v; oben[0].before(d); oben.forEach(e => d.appendChild(e));
    if (!d.nextElementSibling) d.after(Object.assign(document.createElement("p"), { innerHTML: "<br>" }));
    geaendert();
  };
  // Seitenumbruch
  const umbruch = () => {
    schnappschuss(true);
    const bl = bloecke(rich), hr = document.createElement("hr"); hr.className = "seitenumbruch";
    let oben = bl[0] || rich.lastElementChild; while (oben && oben.parentElement !== rich) oben = oben.parentElement;
    if (oben) oben.after(hr); else rich.appendChild(hr);
    const p = document.createElement("p"); p.innerHTML = "<br>"; hr.after(p);
    const r = document.createRange(); r.setStart(p, 0); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    geaendert();
  };
  x("umbruch").onclick = umbruch;
  rich.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); umbruch(); } });

  /* ---------- Kommentare ---------- */
  x("kommentar").onclick = async () => {
    const s = getSelection();
    if (!s.rangeCount || s.isCollapsed || !rich.contains(s.anchorNode)) { KW.toast("Erst das Wort oder den Satz markieren, zu dem der Kommentar gehört."); return; }
    const r = s.getRangeAt(0).cloneRange();
    const text = await eingabe("💬 Kommentar", "z. B. „Quelle nachschauen“ oder „Lehrer fragen“");
    if (!text) return;
    schnappschuss(true);
    const sp2 = document.createElement("span"); sp2.className = "kommentar"; sp2.dataset.k = text; sp2.dataset.zeit = new Date().toLocaleDateString("de-DE"); sp2.title = "💬 " + text;
    try { r.surroundContents(sp2); } catch (e2) { sp2.appendChild(r.extractContents()); r.insertNode(sp2); }
    geaendert(); kommentarListe();
  };
  rich.addEventListener("click", (e) => { const k = e.target.closest(".kommentar"); if (k && rich.contains(k)) kommentarBlase(k); });
  function kommentarBlase(k) {
    document.querySelectorAll(".kommentar-blase").forEach(b => b.remove());
    const b = document.createElement("div"); b.className = "kommentar-blase card";
    b.innerHTML = '<div class="klein muted">💬 Kommentar' + (k.dataset.zeit ? " · " + esc(k.dataset.zeit) : "") + "</div><p>" + esc(k.dataset.k) + '</p><div class="zeile"><button type="button" class="btn small" data-a="aendern">✎ Ändern</button><button type="button" class="btn small" data-a="erledigt">✓ Erledigt</button></div>';
    const r = k.getBoundingClientRect(); b.style.left = Math.max(8, Math.min(innerWidth - 280, r.left)) + "px"; b.style.top = (r.bottom + 6) + "px";
    document.body.appendChild(b);
    b.querySelector('[data-a="aendern"]').onclick = async () => { const t = await eingabe("💬 Kommentar ändern", "", k.dataset.k); if (t == null) return; schnappschuss(true); k.dataset.k = t; k.title = "💬 " + t; b.remove(); geaendert(); kommentarListe(); };
    b.querySelector('[data-a="erledigt"]').onclick = () => { schnappschuss(true); k.replaceWith(...k.childNodes); b.remove(); geaendert(); kommentarListe(); };
    setTimeout(() => document.addEventListener("pointerdown", function zu(ev) { if (!b.contains(ev.target) && ev.target !== k) { b.remove(); document.removeEventListener("pointerdown", zu); } }), 0);
  }
  // kleine Zahl am Knopf: wie viele Kommentare offen sind
  function kommentarListe() { const n = rich.querySelectorAll(".kommentar").length, k = wurzel.querySelector('[data-x="kommentar"]'); if (k) k.textContent = "💬 Kommentar" + (n ? " (" + n + ")" : ""); }
  kommentarListe();

  /* ---------- Suchen und Ersetzen ---------- */
  let leiste = null;
  const treffer = [];
  const markieren = () => {
    treffer.length = 0;
    const q = leiste.querySelector("#sq").value, gross = leiste.querySelector("#sg").checked;
    if (CSS.highlights) CSS.highlights.delete("kw-suche");
    if (!q) { leiste.querySelector("#sz").textContent = ""; return; }
    const tw = document.createTreeWalker(rich, NodeFilter.SHOW_TEXT); let n;
    const qq = gross ? q : q.toLowerCase();
    while ((n = tw.nextNode())) { const t = gross ? n.textContent : n.textContent.toLowerCase(); let i = t.indexOf(qq); while (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + q.length); treffer.push(r); i = t.indexOf(qq, i + q.length); } }
    if (CSS.highlights && treffer.length) CSS.highlights.set("kw-suche", new Highlight(...treffer));
    leiste.querySelector("#sz").textContent = treffer.length ? treffer.length + " Treffer" : "Nichts gefunden";
  };
  let pos = -1;
  const springen = (d) => { markieren(); if (!treffer.length) return; pos = (pos + d + treffer.length) % treffer.length; const r = treffer[pos], s = getSelection(); s.removeAllRanges(); s.addRange(r); const el = r.startContainer.parentElement; if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); leiste.querySelector("#sz").textContent = (pos + 1) + " von " + treffer.length; };
  const ersetzenEins = () => {
    const s = getSelection(), q = leiste.querySelector("#sq").value, neu = leiste.querySelector("#se").value;
    const gross = leiste.querySelector("#sg").checked, gleich = s.rangeCount && rich.contains(s.anchorNode) && (gross ? s.toString() === q : s.toString().toLowerCase() === q.toLowerCase());
    if (!gleich) { springen(1); return; }
    schnappschuss(true); const r = s.getRangeAt(0); r.deleteContents(); r.insertNode(document.createTextNode(neu)); geaendert(); pos--; springen(1);
  };
  const alleErsetzen = () => { markieren(); if (!treffer.length) return; schnappschuss(true); const neu = leiste.querySelector("#se").value, n = treffer.length; for (const r of treffer.slice().reverse()) { r.deleteContents(); r.insertNode(document.createTextNode(neu)); } rich.normalize(); geaendert(); markieren(); KW.toast(n + "× ersetzt."); };
  function suchenAuf(ersetzen) {
    if (!leiste) {
      leiste = document.createElement("div"); leiste.className = "such-leiste card";
      leiste.innerHTML = '<input class="inp" id="sq" placeholder="Suchen" aria-label="Suchen"><span class="klein muted" id="sz"></span><button type="button" class="btn small" data-s="zur" aria-label="Vorheriger Treffer">▲</button><button type="button" class="btn small" data-s="vor" aria-label="Nächster Treffer">▼</button>' +
        '<label class="klein"><input type="checkbox" id="sg"> Aa</label><input class="inp" id="se" placeholder="Ersetzen durch" aria-label="Ersetzen durch"><button type="button" class="btn small" data-s="eins">Ersetzen</button><button type="button" class="btn small" data-s="alle">Alle</button><button type="button" class="btn small" data-s="zu" aria-label="Schließen">✕</button>';
      wurzel.after(leiste);
      leiste.querySelector("#sq").oninput = () => { pos = -1; markieren(); };
      leiste.querySelector("#sg").onchange = markieren;
      leiste.querySelector("#sq").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); springen(e.shiftKey ? -1 : 1); } if (e.key === "Escape") zu(); };
      leiste.querySelector("#se").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); ersetzenEins(); } if (e.key === "Escape") zu(); };
      leiste.onclick = (e) => { const b = e.target.closest("[data-s]"); if (!b) return; ({ zur: () => springen(-1), vor: () => springen(1), eins: ersetzenEins, alle: alleErsetzen, zu })[b.dataset.s](); };
    }
    leiste.hidden = false; leiste.classList.toggle("mit-ersetzen", true);
    const s = getSelection(); if (s.rangeCount && !s.isCollapsed && rich.contains(s.anchorNode) && s.toString().length < 60) leiste.querySelector("#sq").value = s.toString();
    markieren(); (ersetzen ? leiste.querySelector("#se") : leiste.querySelector("#sq")).focus();
  }
  function zu() { if (!leiste) return; leiste.hidden = true; if (CSS.highlights) CSS.highlights.delete("kw-suche"); rich.focus(); }
  x("suchen").onclick = () => suchenAuf(false);
  rich.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "h")) { e.preventDefault(); suchenAuf(e.key === "h"); } });
}

/* ---------- Kleines Eingabefenster ---------- */
export function eingabe(titel, platzhalter, wert = "") {
  return new Promise((ok) => {
    const d = document.createElement("dialog"); d.className = "dialog";
    d.innerHTML = "<h3>" + esc(titel) + '</h3><textarea class="inp" rows="3" style="width:100%" placeholder="' + esc(platzhalter) + '">' + esc(wert) + '</textarea><div class="zeile" style="justify-content:flex-end;margin-top:10px"><button type="button" class="btn" data-a="nein">Abbrechen</button><button type="button" class="btn primary" data-a="ja">OK</button></div>';
    document.body.appendChild(d); d.showModal();
    const t = d.querySelector("textarea"); t.focus();
    let fertig = false; const ende = (v) => { if (fertig) return; fertig = true; d.close(); d.remove(); ok(v); };
    d.querySelector('[data-a="ja"]').onclick = () => ende(t.value.trim() || null);
    d.querySelector('[data-a="nein"]').onclick = () => ende(null);
    t.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ende(t.value.trim() || null); } };
    d.addEventListener("cancel", () => ende(null));
  });
}

/* ---------- Bilder drehen und zuschneiden ---------- */
function laden(src) { return new Promise((ok, nein) => { const i = new Image(); i.onload = () => ok(i); i.onerror = nein; i.src = src; }); }
const ausgabe = (c, src) => /^data:image\/png/.test(src) ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.92);
export async function bildDrehen(img, grad) {
  const i = await laden(img.src), c = document.createElement("canvas"), quer = Math.abs(grad) % 180 === 90;
  c.width = quer ? i.naturalHeight : i.naturalWidth; c.height = quer ? i.naturalWidth : i.naturalHeight;
  const g = c.getContext("2d"); g.translate(c.width / 2, c.height / 2); g.rotate(grad * Math.PI / 180); g.drawImage(i, -i.naturalWidth / 2, -i.naturalHeight / 2);
  img.src = ausgabe(c, img.src);
}
export function bildZuschneiden(img) {
  return new Promise(async (fertig) => {
    const i = await laden(img.src), d = document.createElement("dialog"); d.className = "dialog zuschnitt-dialog";
    d.innerHTML = '<h3>✂ Zuschneiden</h3><p class="klein muted">Zieh die Ecken oder den Rahmen.</p><div class="zs-box"><img alt="" src="' + img.src + '"><div class="zs-rahmen"><i data-g="nw"></i><i data-g="ne"></i><i data-g="sw"></i><i data-g="se"></i></div></div>' +
      '<div class="zeile" style="justify-content:flex-end;margin-top:10px"><button type="button" class="btn" data-a="nein">Abbrechen</button><button type="button" class="btn primary" data-a="ja">Zuschneiden</button></div>';
    document.body.appendChild(d); d.showModal();
    const box = d.querySelector(".zs-box"), rahmen = d.querySelector(".zs-rahmen"), bild = box.querySelector("img");
    await new Promise(r => bild.complete ? r() : (bild.onload = r));
    let R = { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };
    const malen = () => Object.assign(rahmen.style, { left: R.x * 100 + "%", top: R.y * 100 + "%", width: R.w * 100 + "%", height: R.h * 100 + "%" });
    malen();
    let zieh = null;
    rahmen.addEventListener("pointerdown", (e) => { e.preventDefault(); const b = box.getBoundingClientRect(); zieh = { g: e.target.dataset.g || "mitte", x: e.clientX, y: e.clientY, R: Object.assign({}, R), bw: b.width, bh: b.height }; rahmen.setPointerCapture(e.pointerId); });
    rahmen.addEventListener("pointermove", (e) => {
      if (!zieh) return; const dx = (e.clientX - zieh.x) / zieh.bw, dy = (e.clientY - zieh.y) / zieh.bh, o = zieh.R, min = 0.05;
      let { x, y, w, h } = o;
      if (zieh.g === "mitte") { x = Math.min(1 - w, Math.max(0, o.x + dx)); y = Math.min(1 - h, Math.max(0, o.y + dy)); }
      else { if (zieh.g.includes("w")) { x = Math.min(o.x + o.w - min, Math.max(0, o.x + dx)); w = o.x + o.w - x; } if (zieh.g.includes("e")) w = Math.min(1 - o.x, Math.max(min, o.w + dx)); if (zieh.g.includes("n")) { y = Math.min(o.y + o.h - min, Math.max(0, o.y + dy)); h = o.y + o.h - y; } if (zieh.g.includes("s")) h = Math.min(1 - o.y, Math.max(min, o.h + dy)); }
      R = { x, y, w, h }; malen();
    });
    rahmen.addEventListener("pointerup", () => { zieh = null; });
    const ende = (ok) => {
      if (ok) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(R.w * i.naturalWidth)); c.height = Math.max(1, Math.round(R.h * i.naturalHeight)); c.getContext("2d").drawImage(i, R.x * i.naturalWidth, R.y * i.naturalHeight, c.width, c.height, 0, 0, c.width, c.height); img.src = ausgabe(c, img.src); }
      d.close(); d.remove(); fertig(ok);
    };
    d.querySelector('[data-a="ja"]').onclick = () => ende(true);
    d.querySelector('[data-a="nein"]').onclick = () => ende(false);
    d.addEventListener("cancel", () => ende(false));
  });
}
