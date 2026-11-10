// FIDELIA Notizen · Seiten verknüpfen: [[Seitenlinks]], #Tags und „Verweise hierher“
// Tipp „[[“ im Heft → Liste deiner Seiten → Link. #Wörter werden zu Tags, nach denen du im Heft suchen kannst.

/* ---------- Reine Teile ---------- */

// #Tags aus Text: mindestens 2 Zeichen, nicht nur Zahlen (#1, #3b sind Aufgaben-Nummern)
export function tagsAusText(text) {
  const out = new Set();
  for (const m of String(text || "").matchAll(/(?:^|[\s(,;])#([\p{L}][\p{L}\p{N}_-]{1,29})/gu)) out.add(m[1].toLowerCase());
  return [...out];
}
// Welche Seiten verlinken auf id?
export const verweiseAuf = (seiten, id) => seiten.filter(s => s.id !== id && !s.papierkorb && String(s.html || "").includes('data-seite="' + id + '"'));
// Seiten für die [[-Auswahl: erst Titel-Anfang, dann Titel enthält, dann Text enthält
export function seitenVorschlaege(seiten, q, ohne) {
  const t = String(q || "").trim().toLowerCase(), kandidaten = seiten.filter(s => s.id !== ohne && !s.papierkorb);
  if (!t) return kandidaten.slice().sort((a, b) => String(b.geaendert).localeCompare(String(a.geaendert))).slice(0, 8);
  const titel = (s) => String(s.titel || "").toLowerCase();
  const a = kandidaten.filter(s => titel(s).startsWith(t)), b = kandidaten.filter(s => !titel(s).startsWith(t) && titel(s).includes(t));
  const c = kandidaten.filter(s => !titel(s).includes(t) && String(s.text || "").toLowerCase().includes(t));
  return a.concat(b, c).slice(0, 8);
}
const escH = (t) => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const linkHtml = (s) => '<a class="seitenlink" contenteditable="false" data-seite="' + escH(s.id) + '" href="#seite/' + escH(s.id) + '">' + escH(s.titel || "Ohne Titel") + '</a>';

/* ---------- Im Browser ---------- */

// HTML an einer Stelle einsetzen (ohne execCommand – das schiebt Inline-Blöcke sonst aus dem Absatz) und Cursor dahinter
export function einsetzen(r, html) {
  r.deleteContents();
  const t = document.createElement("template"); t.innerHTML = html;
  const luft = document.createTextNode("\u00a0"), frag = t.content; frag.appendChild(luft);
  r.insertNode(frag);
  const sel = getSelection(), c = document.createRange(); c.setStart(luft, 1); c.collapse(true); sel.removeAllRanges(); sel.addRange(c);
}

// Im Heft-Editor: „[[“ → Auswahl, Klick auf einen Link → hinspringen
export function editorAnbinden(A, rich, s, geaendert) {
  const KW = window.KW, esc = KW.esc;
  let pop = null, treffer = [], aktiv = 0;
  const zu = () => { if (pop) { pop.remove(); pop = null; } };
  function vorDemCursor() {
    const sel = getSelection(); if (!sel.rangeCount || !sel.isCollapsed) return null;
    const r = sel.getRangeAt(0), n = r.startContainer;
    if (n.nodeType !== 3 || !rich.contains(n)) return null;
    const vor = n.textContent.slice(0, r.startOffset), m = /\[\[([^\[\]\n]{0,40})$/.exec(vor);
    return m ? { knoten: n, start: r.startOffset - m[0].length, ende: r.startOffset, q: m[1] } : null;
  }
  function zeigen(info) {
    treffer = seitenVorschlaege(A.aktiv("*"), info.q, s.id);
    if (!pop) { pop = document.createElement("div"); pop.className = "link-pop"; pop.setAttribute("role", "listbox"); pop.setAttribute("aria-label", "Seite verlinken"); document.body.appendChild(pop); }
    aktiv = Math.min(aktiv, Math.max(0, treffer.length - 1));
    pop.innerHTML = '<div class="link-kopf">🔗 Seite verlinken' + (info.q ? ': „' + esc(info.q) + '“' : "") + '</div>' + (treffer.length ? treffer.map((t, i) => '<button type="button" role="option" aria-selected="' + (i === aktiv) + '" data-i="' + i + '"><span class="punkt" style="background:' + esc(A.fachFarbe(t.fach)) + '"></span>' + (t.art === "tabelle" ? "📊 " : t.art === "folien" ? "🖥️ " : "") + esc(t.titel || "Ohne Titel") + '<small>' + esc(t.fach || "") + '</small></button>').join("") : '<p class="muted klein">Keine Seite gefunden.</p>');
    const r = document.createRange(); r.setStart(info.knoten, info.start); r.setEnd(info.knoten, info.ende);
    const b = r.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(window.innerWidth - 300, b.left)) + "px";
    pop.style.top = (b.bottom + 6 + 260 > window.innerHeight ? Math.max(8, b.top - 266) : b.bottom + 6) + "px";
    pop.querySelectorAll("[data-i]").forEach(x => { x.onmousedown = (e) => e.preventDefault(); x.onclick = () => waehlen(treffer[x.dataset.i]); });
  }
  function waehlen(ziel) {
    const info = vorDemCursor(); if (!info || !ziel) { zu(); return; }
    const r = document.createRange(); r.setStart(info.knoten, info.start); r.setEnd(info.knoten, info.ende);
    einsetzen(r, linkHtml(ziel));
    zu(); geaendert && geaendert();
  }
  rich.addEventListener("input", () => { const info = vorDemCursor(); if (info) zeigen(info); else zu(); });
  rich.addEventListener("keydown", (e) => {
    if (!pop) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); aktiv = (aktiv + (e.key === "ArrowDown" ? 1 : -1) + treffer.length) % Math.max(1, treffer.length); const info = vorDemCursor(); info && zeigen(info); }
    else if (e.key === "Enter" || e.key === "Tab") { if (treffer[aktiv]) { e.preventDefault(); waehlen(treffer[aktiv]); } }
    else if (e.key === "Escape") { e.preventDefault(); zu(); }
  }, true);
  rich.addEventListener("blur", () => setTimeout(zu, 150));
  rich.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a.seitenlink"); if (!a) return;
    e.preventDefault();
    const z = A.seite(a.dataset.seite);
    if (!z || z.papierkorb) { KW.toast("Diese Seite gibt es nicht mehr."); return; }
    A.gehe(A.link(z));
  });
  return zu;
}

// „Verweise hierher“ + Tags unter der Seite
export function fussHtml(A, s) {
  const esc = window.KW.esc, v = verweiseAuf(A.seiten, s.id), tags = s.tags || [];
  if (!v.length && !tags.length) return "";
  return '<div class="card verweise">' +
    (tags.length ? '<div class="tag-reihe">' + tags.map(t => '<a class="tag" href="#heft" data-tag="' + esc(t) + '">#' + esc(t) + '</a>').join("") + '</div>' : "") +
    (v.length ? '<div><b>🔗 Verweise hierher</b><ul>' + v.map(x => '<li><a href="#' + A.link(x) + '">' + esc(x.titel || "Ohne Titel") + '</a> <small class="muted">' + esc(x.fach || "") + '</small></li>').join("") + '</ul></div>' : "") + '</div>';
}
