// FIDELIA Notizen · Ältere Versionen, An Mitschüler schicken, FIDELIA-Dateien öffnen

import * as S from "./speicher.js";

const KW = window.KW, esc = KW.esc;
const MAX_VERSIONEN = 30;

/* ---------- Ältere Versionen ---------- */

// Welche Teile einer Seite zur „Version“ gehören (je nach Art)
function inhalt(s) {
  if (s.art === "tabelle") return { titel: s.titel, mappe: s.mappe };
  if (s.art === "folien") return { titel: s.titel, design: s.design, folien: s.folien };
  return { titel: s.titel, html: s.html, striche: s.striche, raster: s.raster, quer: s.quer, hoehe: s.hoehe };
}
function kurzText(s, daten) {
  if (s.art === "tabelle") return (daten.mappe && daten.mappe.blaetter || []).map(b => Object.keys(b.zellen || {}).length + " Zellen").join(", ");
  if (s.art === "folien") return (daten.folien || []).length + " Folien";
  const d = document.createElement("div"); d.innerHTML = daten.html || "";
  return (d.textContent.trim().slice(0, 80) || "(kein Text)") + ((daten.striche || []).length ? " · " + daten.striche.length + " Striche" : "");
}
async function liste(id) {
  try { return (await S.alle("versionen")).filter(v => v.seite === id).sort((a, b) => b.zeit.localeCompare(a.zeit)); } catch (e) { return []; }
}

// Aufrufen beim Öffnen und Verlassen: merkt sich den Stand, wenn er sich geändert hat
export async function versionMerken(A, s) {
  try {
    const daten = JSON.stringify(inhalt(s));
    const alle = await liste(s.id);
    if (alle[0] && alle[0].daten === daten) return;
    const leer = !s.html && !(s.striche || []).length && !s.mappe && !(s.folien || []).length;
    if (leer && !alle.length) return;
    const zeit = new Date().toISOString();
    await S.lege("versionen", { id: s.id + "|" + zeit, seite: s.id, zeit, daten });
    for (const alt of alle.slice(MAX_VERSIONEN - 1)) await S.weg("versionen", alt.id);
  } catch (e) { /* Versionen sind ein Extra – nie den Rest stören */ }
}

export async function versionen(A, s, neuZeigen) {
  const alle = await liste(s.id);
  const d = document.createElement("dialog"); d.className = "sheet";
  const zeit = (iso) => new Date(iso).toLocaleString("de-DE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  d.innerHTML = '<div class="sheet-in"><h2>🕘 Ältere Versionen</h2>' +
    (alle.length ? '<p class="muted klein">Beim Öffnen und Verlassen merkt sich die App den Stand (die letzten ' + MAX_VERSIONEN + '). Die Versionen bleiben nur auf diesem Gerät.</p><ul class="versionen">' +
      alle.map(v => { let daten = {}; try { daten = JSON.parse(v.daten); } catch (e) {} return '<li class="card"><span><b>' + esc(zeit(v.zeit)) + "</b><small>" + esc(kurzText(s, daten)) + '</small></span><button type="button" class="btn small" data-v="' + esc(v.id) + '">Zurückholen</button></li>'; }).join("") + "</ul>"
      : '<div class="empty"><b>Noch keine älteren Versionen</b>Sobald du etwas änderst und die Seite verlässt, taucht hier der alte Stand auf.</div>') +
    '<div class="sheet-foot"><button type="button" class="btn" id="vZu">Schließen</button></div></div>';
  document.body.appendChild(d);
  d.querySelector("#vZu").onclick = () => d.close();
  d.querySelectorAll("[data-v]").forEach(b => b.onclick = async () => {
    if (!confirm("Diesen Stand zurückholen? Der jetzige Stand wird vorher als Version gesichert.")) return;
    const v = alle.find(x => x.id === b.dataset.v);
    await versionMerken(A, s);
    Object.assign(s, JSON.parse(v.daten));
    if (s.art !== "tabelle" && s.art !== "folien") { const t = document.createElement("div"); t.innerHTML = s.html || ""; s.text = t.textContent; }
    await A.seiteSpeichern(s);
    d.close(); KW.toast("✓ Älterer Stand ist zurück."); neuZeigen && neuZeigen();
  });
  d.addEventListener("close", () => d.remove());
  d.showModal();
}

/* ---------- FIDELIA-Datei (zum Weiterbearbeiten bei Mitschülern) ---------- */

const alsDataUrl = (blob) => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });

export async function fideliaDatei(A, s) {
  const bilder = {};
  for (const id of [s.bild, s.original]) if (id) { const b = await A.bildHolen(id); if (b) bilder[id] = await alsDataUrl(b); }
  const kopie = JSON.parse(JSON.stringify(s));
  ["papierkorb", "vorschlag", "pin"].forEach(k => delete kopie[k]);
  return new Blob([JSON.stringify({ fidelia: "notizen", version: 1, seite: kopie, bilder })], { type: "application/json" });
}

export async function importieren(A, datei) {
  const n = datei.name || "";
  if (/\.(docx|pptx)$/i.test(n)) return officeOeffnen(A, datei);
  if (/\.(xlsx|csv)$/i.test(n)) { const T = await import("./tabellen.js"); return T.oeffnen(A, datei); }
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(n)) {
    const url = await new Promise((ok, nein) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = nein; r.readAsDataURL(datei); });
    const titel = n.replace(/\.[^.]+$/, "");
    const s = await A.seiteNeu({ titel, raster: "leer", html: "<h2>" + KW.esc(titel) + '</h2><p><img class="bild" src="' + url + '" alt="" style="width:100%"></p><p><br></p>', text: titel });
    KW.save("kw-notizen-stift-modus", "tippen"); KW.toast("✓ Bild „" + titel + "“ als Heftseite eingefügt."); A.gehe("seite/" + s.id); return s;
  }
  let d;
  try { d = JSON.parse(await datei.text()); } catch (e) { KW.toast("Diese Datei kann ich nicht lesen."); return null; }
  if (!d || d.fidelia !== "notizen" || !d.seite) { KW.toast("Das ist keine FIDELIA-Datei."); return null; }
  const neu = Object.assign({}, d.seite); delete neu.id;
  const ids = {};
  for (const [alt, url] of Object.entries(d.bilder || {})) { if (!/^data:image\//.test(url)) continue; ids[alt] = await A.bildSpeichern(await (await fetch(url)).blob()); }
  if (neu.bild) neu.bild = ids[neu.bild] || null;
  if (neu.original) neu.original = ids[neu.original] || null;
  // Fach übernehmen, wenn es das bei mir auch gibt
  if (neu.fach && !A.einst.faecher.some(f => f.name === neu.fach)) neu.fach = "";
  neu.titel = (neu.titel || "Seite") + " (bekommen)";
  const s = await A.seiteNeu(neu);
  KW.toast("✓ „" + s.titel + "“ ist jetzt bei dir.");
  A.gehe((s.art === "tabelle" ? "tabelle/" : s.art === "folien" ? "folien/" : "seite/") + s.id);
  return s;
}

// Word → Heftseite, PowerPoint → Präsentation
async function officeOeffnen(A, datei) {
  let fflate, I;
  try { fflate = await import("../shared/vendor/fflate-0.8.3/fflate.mjs"); I = await import("./office-import.js"); } catch (e) { KW.toast("Beim ersten Mal braucht das Öffnen Internet."); return null; }
  const name = datei.name.replace(/\.[^.]+$/, "");
  try {
    const bytes = new Uint8Array(await datei.arrayBuffer());
    if (/\.docx$/i.test(datei.name)) {
      const r = I.docxLesen(bytes, fflate), E = await import("./editor.js");
      const s = await A.seiteNeu({ titel: name || r.titel, raster: "leer", html: r.html, text: E.htmlZuText ? E.htmlZuText(r.html) : "" });
      KW.save("kw-notizen-stift-modus", "tippen"); KW.toast("✓ Word-Datei „" + name + "“ geöffnet."); A.gehe("seite/" + s.id); return s;
    }
    const r = I.pptxLesen(bytes, fflate);
    if (!r.folien.length) { KW.toast("In der Datei sind keine Folien."); return null; }
    const s = await A.seiteNeu({ art: "folien", titel: name || r.titel, raster: "leer", design: "minimal", folien: r.folien });
    KW.toast("✓ PowerPoint „" + name + "“ geöffnet (" + r.folien.length + " Folien)."); A.gehe("folien/" + s.id); return s;
  } catch (e) { console.error(e); KW.toast("Diese Datei konnte ich nicht lesen."); return null; }
}

/* ---------- An Mitschüler schicken ---------- */

// Übergabe an FIDELIA Chat: eine kleine Ablage, die beide Apps kennen (gleiche Website)
function ablage() {
  return new Promise((ok, nein) => {
    const r = indexedDB.open("kw-teilen", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("post");
    r.onsuccess = () => ok(r.result); r.onerror = () => nein(r.error);
  });
}
async function inAblage(name, blob) {
  const db = await ablage();
  await new Promise((ok, nein) => { const t = db.transaction("post", "readwrite"); t.objectStore("post").put({ name, blob, zeit: Date.now() }, "datei"); t.oncomplete = ok; t.onerror = () => nein(t.error); });
}

const ART = { tabelle: { office: "Excel (.xlsx)", endung: ".xlsx" }, folien: { office: "PowerPoint (.pptx)", endung: ".pptx" }, heft: { office: "Word (.docx)", endung: ".docx" } };

export function teilen(A, s) {
  const art = ART[s.art] || ART.heft;
  const d = document.createElement("dialog"); d.className = "sheet";
  d.innerHTML = '<div class="sheet-in"><h2>📤 An Mitschüler schicken</h2>' +
    '<p class="muted">„' + esc(s.titel || "Ohne Titel") + '“</p>' +
    '<fieldset class="wahl-feld"><legend>Als was?</legend>' +
      '<label class="wahl-zeile"><input type="radio" name="fmt" value="fidelia" checked> <span><b>FIDELIA-Datei</b><small>Mitschüler mit FIDELIA Notizen können sie öffnen und weiterbearbeiten.</small></span></label>' +
      '<label class="wahl-zeile"><input type="radio" name="fmt" value="office"> <span><b>' + art.office + "</b><small>Geht auch ohne FIDELIA, z. B. mit Microsoft Office.</small></span></label>" +
    "</fieldset>" +
    '<div class="teilen-knoepfe"><button type="button" class="btn primary" data-w="chat">💬 Über FIDELIA Chat</button>' +
    (navigator.canShare ? '<button type="button" class="btn" data-w="system">📲 Andere App …</button>' : "") +
    '<button type="button" class="btn" data-w="speichern">💾 Nur speichern</button></div>' +
    '<p class="muted klein">FIDELIA Chat verschickt Ende-zu-Ende-verschlüsselt. Dateien bis 2 MB.</p>' +
    '<div class="sheet-foot"><button type="button" class="btn" id="tZu">Abbrechen</button></div></div>';
  document.body.appendChild(d);
  d.querySelector("#tZu").onclick = () => d.close();
  d.querySelectorAll("[data-w]").forEach(b => b.onclick = async () => {
    const fmt = d.querySelector('[name="fmt"]:checked').value, name = (s.titel || "Seite").replace(/[\\/:*?"<>|]/g, "").slice(0, 60);
    b.disabled = true; const alt = b.textContent; b.textContent = "Einen Moment …";
    try {
      let blob, datei;
      if (fmt === "fidelia") { blob = await fideliaDatei(A, s); datei = name + ".fidelia"; }
      else if (s.art === "tabelle") { const fflate = await import("../shared/vendor/fflate-0.8.3/fflate.mjs"), X = await import("./xlsx.js"); blob = new Blob([X.schreiben(s.mappe, fflate)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }); datei = name + ".xlsx"; }
      else if (s.art === "folien") { const P = await import("./pptx.js"); blob = await P.alsPptx(A, s); datei = name + ".pptx"; }
      else { const E = await import("./export.js"); blob = await E.alsWord(A, s, { nurBlob: true }); datei = name + ".docx"; }
      if (!blob) throw new Error("leer");
      const w = b.dataset.w;
      if (w === "chat") {
        if (blob.size > 2 * 1048576) { KW.toast("Die Datei ist größer als 2 MB – zu groß für den Chat. Probier „Nur speichern“."); return; }
        await inAblage(datei, blob);
        d.close(); location.href = "../chat/#teilen";
      } else if (w === "system") {
        const f = new File([blob], datei, { type: blob.type });
        if (navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: s.titel || "Seite" });
        else { (await import("./export.js")).herunterladen(blob, datei); }
        d.close();
      } else { (await import("./export.js")).herunterladen(blob, datei); d.close(); KW.toast("✓ Gespeichert."); }
    } catch (e) { if (e && e.name !== "AbortError") KW.toast("Das hat nicht geklappt."); }
    finally { b.disabled = false; b.textContent = alt; }
  });
  d.addEventListener("close", () => d.remove());
  d.showModal();
}
