// FIDELIA Notizen · Unendliche Tafel
// Eine Fläche ohne Rand: malen, Zettel kleben, verschieben (✋ oder zwei Finger), zoomen (Strg+Mausrad oder Finger).
// Gespeichert als Seite mit art: "tafel" – { striche, zettel, ansicht: { ox, oy, z }, grund }

import { zeichneStrich } from "./heft.js";

/* ---------- Reine Teile ---------- */

export const GRUENDE = [["punkte", "· Punkte"], ["karo", "▦ Karo"], ["leer", "□ Leer"], ["tafel", "🟩 Tafel"]];
export const FARBEN = { hell: ["#101826", "#1f4fd1", "#c93a3a", "#1a8f4c", "#a36b00", "#7a3fd6"], tafel: ["#f4f6fa", "#ffe14d", "#7fd3ff", "#ff9a9a", "#a6f0a0", "#ffb86b"] };
export const ZETTEL_FARBEN = ["#fff3a3", "#ffd1dc", "#cdeaff", "#d6f5c9", "#ffe0b8"];

// Rahmen um alles (Striche + Zettel) → { x, y, w, h } oder null
export function grenzen(striche, zettel) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of striche || []) for (const p of s.p || []) { const r = (s.b || 2) / 2; x0 = Math.min(x0, p[0] - r); y0 = Math.min(y0, p[1] - r); x1 = Math.max(x1, p[0] + r); y1 = Math.max(y1, p[1] + r); }
  for (const z of zettel || []) { x0 = Math.min(x0, z.x); y0 = Math.min(y0, z.y); x1 = Math.max(x1, z.x + (z.w || 200)); y1 = Math.max(y1, z.y + (z.h || 140)); }
  return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
// Ansicht so wählen, dass der Rahmen in w×h passt (mit Rand)
export function ansichtFuer(box, w, h, rand = 40) {
  if (!box) return { ox: w / 2, oy: h / 2, z: 1 };
  const z = Math.max(0.1, Math.min(1.5, Math.min((w - 2 * rand) / Math.max(1, box.w), (h - 2 * rand) / Math.max(1, box.h))));
  return { ox: w / 2 - (box.x + box.w / 2) * z, oy: h / 2 - (box.y + box.h / 2) * z, z };
}
// Zoomen um einen Bildschirmpunkt (bleibt unter dem Finger/der Maus)
export function zoomUm(a, sx, sy, faktor) {
  const z = Math.max(0.1, Math.min(6, a.z * faktor)), f = z / a.z;
  return { ox: sx - (sx - a.ox) * f, oy: sy - (sy - a.oy) * f, z };
}
// Striche, die der Radierer bei (x, y) mit Radius r trifft
export function getroffen(striche, x, y, r) {
  const out = [];
  striche.forEach((s, i) => { if ((s.p || []).some((p, j) => { if (Math.hypot(p[0] - x, p[1] - y) < r + (s.b || 2) / 2) return true; const q = s.p[j + 1]; if (!q) return false; const dx = q[0] - p[0], dy = q[1] - p[1], l = dx * dx + dy * dy; if (!l) return false; const t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / l)); return Math.hypot(p[0] + t * dx - x, p[1] + t * dy - y) < r + (s.b || 2) / 2; })) out.push(i); });
  return out;
}

/* ---------- Vorschau (Heft-Liste) ---------- */
export function vorschau(canvas, s) {
  const g = canvas.getContext("2d"), box = grenzen(s.striche, s.zettel);
  g.fillStyle = s.grund === "tafel" ? "#1f3b2d" : "#ffffff"; g.fillRect(0, 0, canvas.width, canvas.height);
  if (!box) return;
  const a = ansichtFuer(box, canvas.width, canvas.height, 12);
  g.setTransform(a.z, 0, 0, a.z, a.ox, a.oy);
  for (const z of s.zettel || []) { g.fillStyle = z.farbe || ZETTEL_FARBEN[0]; g.fillRect(z.x, z.y, z.w || 200, z.h || 140); }
  for (const st of s.striche || []) zeichneStrich(g, st, 1);
}

/* ---------- Die Tafel ---------- */
export function seite(A, el, id) {
  const KW = window.KW, esc = KW.esc;
  const s = A.seite(id);
  if (!s || s.art !== "tafel") { el.innerHTML = '<div class="empty"><b>Tafel nicht gefunden</b><a class="btn" href="#heft">Zum Heft</a></div>'; return; }
  s.striche = s.striche || []; s.zettel = s.zettel || []; s.grund = s.grund || "punkte";
  const T = KW.load("kw-tafel-stift", { werkzeug: "stift", farbe: 0, dicke: 3 });
  el.innerHTML = '<div class="tafel-kopf"><a class="btn small" href="#heft" aria-label="Zurück zum Heft">←</a><input class="inp tafel-titel" id="tTitel" value="' + esc(s.titel || "") + '" placeholder="Tafel" aria-label="Titel"><select class="inp" id="tFach" aria-label="Fach"><option value="">📥 Unsortiert</option>' + A.einst.faecher.map(f => '<option' + (f.name === s.fach ? " selected" : "") + '>' + esc(f.name) + '</option>').join("") + '</select></div>' +
    '<div class="tafel-rahmen" id="tRahmen"><canvas id="tC" aria-label="Unendliche Tafel zum Malen"></canvas><div class="tafel-zettel" id="tZ"></div>' +
    '<div class="tafel-leiste" role="toolbar" aria-label="Tafel-Werkzeuge" id="tL"></div>' +
    '<div class="tafel-zoom"><button type="button" class="btn small" data-z="-" aria-label="Kleiner">−</button><button type="button" class="btn small" id="tProzent" title="Alles zeigen">100 %</button><button type="button" class="btn small" data-z="+" aria-label="Größer">+</button></div></div>';
  const rahmen = el.querySelector("#tRahmen"), c = el.querySelector("#tC"), g = c.getContext("2d"), zl = el.querySelector("#tZ"), leiste = el.querySelector("#tL");
  let a = s.ansicht || null, dpr = 1, W = 0, H = 0, rueck = [], vor = [], strich = null, finger = new Map(), pinch = null, pan = null, leertaste = false, timer = null;

  const speichern = () => { clearTimeout(timer); timer = setTimeout(() => { s.ansicht = a; s.text = s.zettel.map(z => z.text || "").join("\n"); A.seiteSpeichern(s); }, 500); };
  const sichern = () => { rueck.push(JSON.stringify({ st: s.striche, ze: s.zettel })); if (rueck.length > 60) rueck.shift(); vor = []; };
  const farben = () => FARBEN[s.grund === "tafel" ? "tafel" : "hell"];
  function groesse() {
    dpr = window.devicePixelRatio || 1; W = rahmen.clientWidth; H = rahmen.clientHeight;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); c.style.width = W + "px"; c.style.height = H + "px";
    if (!a) a = ansichtFuer(grenzen(s.striche, s.zettel), W, H);
    malen();
  }
  function grundMalen() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = s.grund === "tafel" ? "#1f3b2d" : getComputedStyle(rahmen).getPropertyValue("--tafel-papier") || "#fff"; g.fillRect(0, 0, W, H);
    if (s.grund === "leer") return;
    let schritt = 25 * a.z; while (schritt < 12) schritt *= 2;
    const x0 = ((a.ox % schritt) + schritt) % schritt, y0 = ((a.oy % schritt) + schritt) % schritt;
    g.fillStyle = g.strokeStyle = s.grund === "tafel" ? "rgba(255,255,255,.08)" : "rgba(91,101,120,.28)";
    if (s.grund === "karo" || s.grund === "tafel") { g.lineWidth = 1; g.beginPath(); for (let x = x0; x < W; x += schritt) { g.moveTo(Math.round(x) + .5, 0); g.lineTo(Math.round(x) + .5, H); } for (let y = y0; y < H; y += schritt) { g.moveTo(0, Math.round(y) + .5); g.lineTo(W, Math.round(y) + .5); } g.stroke(); }
    else for (let x = x0; x < W; x += schritt) for (let y = y0; y < H; y += schritt) { g.beginPath(); g.arc(x, y, 1.2, 0, 7); g.fill(); }
  }
  let rafAn = false;
  function malen() {
    if (rafAn) return; rafAn = true;
    requestAnimationFrame(() => {
      rafAn = false; grundMalen();
      g.setTransform(dpr * a.z, 0, 0, dpr * a.z, dpr * a.ox, dpr * a.oy);
      for (const st of s.striche) zeichneStrich(g, st, 1);
      if (strich) zeichneStrich(g, strich, 1);
      zettelLage();
      el.querySelector("#tProzent").textContent = Math.round(a.z * 100) + " %";
    });
  }
  const welt = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left - a.ox) / a.z, (e.clientY - r.top - a.oy) / a.z]; };
  const schirm = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  /* --- Werkzeug-Leiste --- */
  function leisteZeigen() {
    const f = farben();
    leiste.innerHTML = [["hand", "✋", "Verschieben"], ["stift", "✏️", "Stift"], ["marker", "🖍️", "Marker"], ["radierer", "🧽", "Radierer"], ["zettel", "🗒️", "Zettel"]].map(w => '<button type="button" data-w="' + w[0] + '" class="' + (T.werkzeug === w[0] ? "an" : "") + '" title="' + w[2] + '" aria-label="' + w[2] + '" aria-pressed="' + (T.werkzeug === w[0]) + '">' + w[1] + '</button>').join("") +
      '<span class="trenn"></span>' + f.map((x, i) => '<button type="button" class="farbe' + (T.farbe === i ? " an" : "") + '" data-f="' + i + '" style="background:' + x + '" aria-label="Farbe ' + (i + 1) + '"></button>').join("") +
      '<select id="tDicke" aria-label="Strichstärke">' + [[1.5, "fein"], [3, "mittel"], [6, "dick"], [12, "sehr dick"]].map(d => '<option value="' + d[0] + '"' + (T.dicke === d[0] ? " selected" : "") + '>' + d[1] + '</option>').join("") + '</select>' +
      '<span class="trenn"></span><button type="button" id="tRueck" aria-label="Rückgängig" title="Rückgängig (Strg+Z)">↶</button><button type="button" id="tVor" aria-label="Wiederholen" title="Wiederholen">↷</button>' +
      '<select id="tGrund" aria-label="Hintergrund">' + GRUENDE.map(x => '<option value="' + x[0] + '"' + (s.grund === x[0] ? " selected" : "") + '>' + x[1] + '</option>').join("") + '</select>' +
      '<button type="button" id="tBild" title="Als Bild speichern" aria-label="Als Bild speichern">⬇</button>';
    leiste.querySelectorAll("[data-w]").forEach(b => b.onclick = () => { T.werkzeug = b.dataset.w; KW.save("kw-tafel-stift", T); leisteZeigen(); rahmen.dataset.werkzeug = T.werkzeug; });
    leiste.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { T.farbe = Number(b.dataset.f); if (T.werkzeug === "hand" || T.werkzeug === "radierer") T.werkzeug = "stift"; KW.save("kw-tafel-stift", T); leisteZeigen(); rahmen.dataset.werkzeug = T.werkzeug; });
    leiste.querySelector("#tDicke").onchange = (e) => { T.dicke = Number(e.target.value); KW.save("kw-tafel-stift", T); };
    leiste.querySelector("#tRueck").onclick = rueckgaengig; leiste.querySelector("#tVor").onclick = wiederholen;
    leiste.querySelector("#tGrund").onchange = (e) => {
      const warGruen = s.grund === "tafel", wirdGruen = e.target.value === "tafel";
      if (warGruen !== wirdGruen) { sichern(); const von = FARBEN[warGruen ? "tafel" : "hell"], nach = FARBEN[wirdGruen ? "tafel" : "hell"]; for (const st of s.striche) { const i = von.indexOf(st.farbe); if (i >= 0) st.farbe = nach[i]; } }
      s.grund = e.target.value; rahmen.classList.toggle("gruen", s.grund === "tafel"); leisteZeigen(); malen(); speichern(); };
    leiste.querySelector("#tBild").onclick = bildSpeichern;
  }
  function rueckgaengig() { if (!rueck.length) return; vor.push(JSON.stringify({ st: s.striche, ze: s.zettel })); const z = JSON.parse(rueck.pop()); s.striche = z.st; s.zettel = z.ze; zettelBauen(); malen(); speichern(); }
  function wiederholen() { if (!vor.length) return; rueck.push(JSON.stringify({ st: s.striche, ze: s.zettel })); const z = JSON.parse(vor.pop()); s.striche = z.st; s.zettel = z.ze; zettelBauen(); malen(); speichern(); }

  /* --- Zettel --- */
  function zettelBauen() {
    zl.innerHTML = s.zettel.map(z => '<div class="t-zettel" data-id="' + esc(z.id) + '" style="background:' + esc(z.farbe) + '"><div class="t-z-kopf"><span class="t-z-griff" title="Ziehen zum Verschieben">⠿</span>' +
      ZETTEL_FARBEN.map(f => '<button type="button" class="t-z-farbe" data-zf="' + f + '" style="background:' + f + '" aria-label="Zettelfarbe"></button>').join("") + '<button type="button" class="t-z-weg" aria-label="Zettel löschen">✕</button></div>' +
      '<div class="t-z-text" contenteditable="true" spellcheck="true" lang="de" aria-label="Zettel-Text">' + esc(z.text || "").replace(/\n/g, "<br>") + '</div></div>').join("");
    zl.querySelectorAll(".t-zettel").forEach(div => {
      const z = s.zettel.find(x => x.id === div.dataset.id), txt = div.querySelector(".t-z-text");
      txt.oninput = () => { z.text = txt.innerText; speichern(); };
      txt.onfocus = () => sichern();
      div.querySelector(".t-z-weg").onclick = () => { sichern(); s.zettel = s.zettel.filter(x => x !== z); zettelBauen(); malen(); speichern(); };
      div.querySelectorAll("[data-zf]").forEach(b => b.onclick = () => { z.farbe = b.dataset.zf; div.style.background = z.farbe; speichern(); });
      const griff = div.querySelector(".t-z-kopf");
      griff.addEventListener("pointerdown", (e) => {
        if (e.target.closest("button")) return;
        e.preventDefault(); griff.setPointerCapture(e.pointerId); sichern();
        const st = { x: e.clientX, y: e.clientY, zx: z.x, zy: z.y };
        griff.onpointermove = (ev) => { z.x = st.zx + (ev.clientX - st.x) / a.z; z.y = st.zy + (ev.clientY - st.y) / a.z; zettelLage(); };
        griff.onpointerup = griff.onpointercancel = () => { griff.onpointermove = null; speichern(); };
      });
    });
    zettelLage();
  }
  function zettelLage() {
    zl.querySelectorAll(".t-zettel").forEach(div => {
      const z = s.zettel.find(x => x.id === div.dataset.id); if (!z) return;
      div.style.width = (z.w || 200) + "px"; div.style.minHeight = (z.h || 140) + "px";
      div.style.transform = "translate(" + (a.ox + z.x * a.z) + "px," + (a.oy + z.y * a.z) + "px) scale(" + a.z + ")";
    });
  }

  /* --- Malen, Verschieben, Zoomen --- */
  c.addEventListener("pointerdown", (e) => {
    c.setPointerCapture(e.pointerId);
    finger.set(e.pointerId, schirm(e));
    if (finger.size === 2) { // zwei Finger: verschieben + zoomen, angefangenen Strich verwerfen
      if (strich) { strich = null; rueck.pop(); }
      const [p, q] = [...finger.values()]; pinch = { d: Math.hypot(q[0] - p[0], q[1] - p[1]), m: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], a: { ...a } }; pan = null; malen(); return;
    }
    const w = e.button === 1 || leertaste ? "hand" : T.werkzeug;
    if (w === "hand") { pan = { x: e.clientX, y: e.clientY, a: { ...a } }; rahmen.classList.add("zieht"); return; }
    const [x, y] = welt(e);
    if (w === "zettel") { sichern(); const z = { id: KW.id(), x: x - 20, y: y - 20, w: 200, h: 140, text: "", farbe: ZETTEL_FARBEN[s.zettel.length % ZETTEL_FARBEN.length] }; s.zettel.push(z); zettelBauen(); speichern(); setTimeout(() => { const t = zl.querySelector('[data-id="' + z.id + '"] .t-z-text'); t && t.focus(); }, 20); T.werkzeug = "stift"; leisteZeigen(); rahmen.dataset.werkzeug = "stift"; return; }
    sichern();
    if (w === "radierer") { strich = { radierer: true }; radieren(x, y); return; }
    const druck = e.pointerType === "pen" ? (e.pressure || 0.5) : 0.5;
    strich = w === "marker" ? { art: "marker", farbe: farben()[T.farbe] || farben()[0], b: T.dicke * 5, p: [[x, y, druck]] } : { art: "kuli", farbe: farben()[T.farbe] || farben()[0], b: T.dicke, p: [[x, y, druck]] };
    malen();
  });
  function radieren(x, y) { const weg = getroffen(s.striche, x, y, 8 / a.z); if (weg.length) { s.striche = s.striche.filter((_, i) => !weg.includes(i)); malen(); } }
  c.addEventListener("pointermove", (e) => {
    if (!finger.has(e.pointerId)) return;
    finger.set(e.pointerId, schirm(e));
    if (pinch && finger.size === 2) {
      const [p, q] = [...finger.values()], d = Math.hypot(q[0] - p[0], q[1] - p[1]), m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const z = zoomUm(pinch.a, pinch.m[0], pinch.m[1], d / pinch.d);
      a = { ox: z.ox + m[0] - pinch.m[0], oy: z.oy + m[1] - pinch.m[1], z: z.z }; malen(); return;
    }
    if (pan) { a = { ox: pan.a.ox + e.clientX - pan.x, oy: pan.a.oy + e.clientY - pan.y, z: pan.a.z }; malen(); return; }
    if (!strich) return;
    const ereignisse = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of ereignisse) {
      const [x, y] = welt(ev);
      if (strich.radierer) { radieren(x, y); continue; }
      const l = strich.p[strich.p.length - 1]; if (Math.hypot(x - l[0], y - l[1]) < 0.8 / a.z) continue;
      strich.p.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10, ev.pointerType === "pen" ? (ev.pressure || 0.5) : 0.5]);
    }
    malen();
  });
  const los = (e) => {
    finger.delete(e.pointerId);
    if (finger.size < 2) pinch = null;
    if (pan && !finger.size) { pan = null; rahmen.classList.remove("zieht"); speichern(); }
    if (strich && !finger.size) { if (!strich.radierer) s.striche.push(strich); else if (rueck.length && rueck[rueck.length - 1] === JSON.stringify({ st: s.striche, ze: s.zettel })) rueck.pop(); strich = null; malen(); speichern(); }
    if (!finger.size && !pan) speichern();
  };
  c.addEventListener("pointerup", los); c.addEventListener("pointercancel", los);
  c.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) { const [sx, sy] = schirm(e); a = zoomUm(a, sx, sy, Math.exp(-e.deltaY * 0.0025)); }
    else a = { ox: a.ox - e.deltaX, oy: a.oy - e.deltaY, z: a.z };
    malen(); speichern();
  }, { passive: false });
  el.querySelectorAll("[data-z]").forEach(b => b.onclick = () => { a = zoomUm(a, W / 2, H / 2, b.dataset.z === "+" ? 1.25 : 0.8); malen(); speichern(); });
  el.querySelector("#tProzent").onclick = () => { a = ansichtFuer(grenzen(s.striche, s.zettel), W, H); malen(); speichern(); };
  function tasten(e) {
    if (e.target.closest && e.target.closest("[contenteditable=true], input, textarea, select")) return;
    if (e.code === "Space") { leertaste = e.type === "keydown"; rahmen.classList.toggle("hand", leertaste); e.preventDefault(); return; }
    if (e.type !== "keydown") return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? wiederholen() : rueckgaengig(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); wiederholen(); }
  }
  document.addEventListener("keydown", tasten); document.addEventListener("keyup", tasten);

  /* --- Als Bild --- */
  function bildSpeichern() {
    const box = grenzen(s.striche, s.zettel); if (!box) { KW.toast("Die Tafel ist noch leer."); return; }
    const rand = 30, f = Math.min(2, 4000 / Math.max(box.w + 2 * rand, box.h + 2 * rand));
    const cv = document.createElement("canvas"); cv.width = Math.round((box.w + 2 * rand) * f); cv.height = Math.round((box.h + 2 * rand) * f);
    const gg = cv.getContext("2d"); gg.fillStyle = s.grund === "tafel" ? "#1f3b2d" : "#ffffff"; gg.fillRect(0, 0, cv.width, cv.height);
    gg.setTransform(f, 0, 0, f, (rand - box.x) * f, (rand - box.y) * f);
    for (const z of s.zettel) { gg.fillStyle = z.farbe; gg.fillRect(z.x, z.y, z.w || 200, z.h || 140); gg.fillStyle = "#101826"; gg.font = "15px 'Space Grotesk', sans-serif"; String(z.text || "").split("\n").forEach((zeile, i) => gg.fillText(zeile.slice(0, 40), z.x + 10, z.y + 48 + i * 20)); }
    for (const st of s.striche) zeichneStrich(gg, st, 1);
    cv.toBlob(b => { const u = URL.createObjectURL(b), l = document.createElement("a"); l.href = u; l.download = (s.titel || "Tafel").replace(/[^\wäöüÄÖÜß -]/g, "") + ".png"; l.click(); setTimeout(() => URL.revokeObjectURL(u), 2000); KW.toast("Bild gespeichert."); }, "image/png");
  }

  el.querySelector("#tTitel").oninput = (e) => { s.titel = e.target.value; speichern(); };
  el.querySelector("#tFach").onchange = (e) => { s.fach = e.target.value; speichern(); };
  rahmen.classList.toggle("gruen", s.grund === "tafel"); rahmen.dataset.werkzeug = T.werkzeug;
  leisteZeigen(); zettelBauen();
  const ro = new ResizeObserver(groesse); ro.observe(rahmen);
  document.body.classList.add("auf-tafel");
  return () => { document.body.classList.remove("auf-tafel"); ro.disconnect(); document.removeEventListener("keydown", tasten); document.removeEventListener("keyup", tasten); if (timer) { clearTimeout(timer); s.ansicht = a; s.text = s.zettel.map(z => z.text || "").join("\n"); A.seiteSpeichern(s); } };
}
