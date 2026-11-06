// FIDELIA Form – erklärt Briefe in einfacher Sprache.
// Foto → Texterkennung auf dem Gerät → Schnell-Check (Fristen, Beträge, Zeichen) → KI-Erklärung auf dem Gerät.
// Nichts davon geht ins Internet. Nur eine Hilfe, keine Rechts- oder Geldberatung.
import { geraetPruefen, empfehlung, starten, MODELLE, ohneDenken } from "../ki/motor.js";

const KW = window.KW, esc = KW.esc, $ = id => document.getElementById(id);
const KEY = "kw-form";
let D = KW.load(KEY, null) || { gemerkt: [] };
const speichern = () => KW.save(KEY, D);
let text = "", ki = null, kiLaedt = null, abbruch = null, erklaerung = "";

/* ---------- Schritt 1: Brief einlesen ---------- */
function startSeite() {
  $("ansicht").innerHTML = `
    <div class="hallo"><div class="gross" aria-hidden="true">📝</div><h2>Ein Brief, den keiner versteht?</h2>
    <p>Fotografier ihn – FIDELIA Form erklärt dir in einfacher Sprache, worum es geht und was du tun musst.</p></div>
    <div class="card hinweis">🔒 <b>Alles bleibt auf deinem Gerät.</b> Das Foto und der Text gehen nicht ins Internet – auch die KI läuft direkt auf deinem Handy oder PC.</div>
    <div class="knoepfe">
      <label class="btn primary gross"><input type="file" accept="image/*" capture="environment" id="foto" hidden multiple>📷 Brief fotografieren</label>
      <label class="btn"><input type="file" accept="image/*" id="bild" hidden multiple>🖼️ Foto aus der Galerie</label>
      <button class="btn" type="button" id="tippen">⌨️ Text einfügen</button>
    </div>
    ${D.gemerkt.length ? `<h2 class="sec">Gemerkt</h2><div class="liste">${D.gemerkt.map((g, i) => `<button class="eintrag" type="button" data-g="${i}"><span class="i">📄</span><span class="mitte"><b>${esc(g.titel)}</b><small>${esc(new Date(g.zeit).toLocaleDateString("de-DE"))}</small></span></button>`).join("")}</div>` : ""}
    <p class="muted klein" style="margin-top:18px">⚠️ FIDELIA Form ist eine Hilfe zum Verstehen – keine Rechts- oder Geldberatung. Bei Fristen, Geld oder wichtigen Entscheidungen: frag einen Erwachsenen oder direkt bei der Stelle nach, die den Brief geschickt hat.</p>`;
  $("foto").onchange = $("bild").onchange = e => { const f = [...(e.target.files || [])]; if (f.length) lesen(f); };
  $("tippen").onclick = () => pruefSeite("");
}
async function lesen(dateien) {
  $("ansicht").innerHTML = `<div class="card arbeitet"><div class="dreh" aria-hidden="true"></div><b id="lStatus">Texterkennung wird geladen …</b><div class="balken"><span id="lBalken"></span></div><p class="muted klein">Das erste Mal dauert es etwas länger.</p></div>`;
  try {
    if (!window.KWOCR) await new Promise((ok, nein) => { const s = document.createElement("script"); s.src = "../shared/ocr/kw-ocr.js"; s.onload = ok; s.onerror = nein; document.head.appendChild(s); });
    const teile = [];
    for (let i = 0; i < dateien.length; i++) {
      teile.push(await window.KWOCR.erkenne(dateien[i], "deu", (p, t) => { $("lStatus").textContent = (dateien.length > 1 ? `Seite ${i + 1} von ${dateien.length}: ` : "") + t; $("lBalken").style.width = p + "%"; }));
    }
    pruefSeite(teile.join("\n\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim());
  } catch (e) { KW.toast("Die Texterkennung hat nicht geklappt. Versuch ein schärferes Foto oder füg den Text ein."); startSeite(); }
}

/* ---------- Schritt 2: Text prüfen + Schnell-Check ---------- */
function pruefSeite(t) {
  $("ansicht").innerHTML = `
    <button class="btn small" type="button" id="zurueck">← Neuer Brief</button>
    <h2 class="titel">Stimmt der Text?</h2>
    <p class="muted klein">Die Texterkennung macht manchmal Fehler. Verbessere wichtige Stellen (Daten, Beträge), bevor du auf „Erklären“ tippst.</p>
    <textarea class="inp brief" id="brief" placeholder="Hier den Text vom Brief einfügen …">${esc(t)}</textarea>
    <div class="row" style="margin-top:10px"><button class="btn primary" type="button" id="erklaer">✨ Erklär mir den Brief</button><button class="btn" type="button" id="check">🔎 Nur Schnell-Check</button></div>`;
  $("zurueck").onclick = startSeite;
  $("check").onclick = () => { text = $("brief").value.trim(); if (text.length < 20) return KW.toast("Da ist noch zu wenig Text."); ergebnisSeite(false); };
  $("erklaer").onclick = () => { text = $("brief").value.trim(); if (text.length < 20) return KW.toast("Da ist noch zu wenig Text."); ergebnisSeite(true); };
}

// Schnell-Check ohne KI: findet Daten, Fristen, Beträge, Aktenzeichen und Absender
const MONATE = { januar: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12 };
export function schnellCheck(t) {
  const satz = t.replace(/\s+/g, " ");
  const daten = [], gesehen = {};
  const neu = (d, m, j, idx) => {
    j = +j < 100 ? 2000 + +j : +j; if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12 && j > 1990 && j < 2100)) return;
    const iso = j + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0"); if (gesehen[iso]) return; gesehen[iso] = 1;
    const umfeld = satz.slice(Math.max(0, idx - 90), idx + 30).toLowerCase();
    const frist = /(bis (zum|spätestens)?|spätestens|frist|fällig|innerhalb|einreichen|zahlen bis|zurück ?senden|vorlegen|termin)/.test(umfeld);
    daten.push({ iso, frist, text: satz.slice(Math.max(0, idx - 70), idx + 25).trim() });
  };
  let m; const r1 = /\b(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{2,4})\b/g;
  while ((m = r1.exec(satz))) neu(+m[1], +m[2], m[3], m.index);
  const r2 = /\b(\d{1,2})\.\s?(januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)\s(\d{4})\b/gi;
  while ((m = r2.exec(satz))) neu(+m[1], MONATE[m[2].toLowerCase()], m[3], m.index);
  const betraege = [...new Set((satz.match(/\b\d{1,3}(?:\.\d{3})*(?:,\d{2})?\s?(?:€|EUR|Euro)\b|€\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?/gi) || []))].slice(0, 6);
  const zeichen = [...new Set((satz.match(/\b(?:Aktenzeichen|Az\.?|Kassenzeichen|Kundennummer|Vertragsnummer|Rechnungsnummer|Steuernummer|Mitgliedsnummer|Zeichen)\s*:?\s*[A-Z0-9][A-Z0-9\/\-. ]{3,24}/gi) || []).map(x => x.trim()))].slice(0, 4);
  const zeilen = t.split("\n").map(z => z.trim()).filter(Boolean);
  const absender = zeilen.slice(0, 3).join(" · ").slice(0, 120);
  const heute = new Date().toISOString().slice(0, 10);
  daten.sort((a, b) => (b.frist - a.frist) || (a.iso < b.iso ? -1 : 1));
  return { daten: daten.slice(0, 8), betraege, zeichen, absender, heute };
}
function checkHtml(c) {
  const tageBis = iso => Math.round((new Date(iso) - new Date(c.heute)) / 864e5);
  const fmt = iso => iso.split("-").reverse().join(".");
  return `<div class="card check"><h3>🔎 Schnell-Check</h3>
    ${c.absender ? `<p><small>Absender (vermutlich)</small><br>${esc(c.absender)}</p>` : ""}
    ${c.daten.length ? `<p><small>Daten im Brief</small></p><div class="liste">${c.daten.map(d => { const t = tageBis(d.iso); return `<div class="eintrag statisch${d.frist ? " frist" : ""}"><span class="i">${d.frist ? "⏰" : "📅"}</span><span class="mitte"><b>${fmt(d.iso)}${d.frist ? " – sieht nach einer Frist aus" : ""}</b><small>„…${esc(d.text)}…“</small></span><span class="rechts">${t >= 0 ? `<small>${t === 0 ? "heute" : "in " + t + " Tagen"}</small>` : `<small>vorbei</small>`}${d.frist && t >= 0 ? `<button class="btn small" type="button" data-ics="${d.iso}">📅 Erinnern</button>` : ""}</span></div>`; }).join("")}</div>` : "<p>Keine Daten gefunden.</p>"}
    ${c.betraege.length ? `<p><small>Beträge</small><br>${c.betraege.map(b => `<span class="chip">💶 ${esc(b)}</span>`).join(" ")}</p>` : ""}
    ${c.zeichen.length ? `<p><small>Nummern zum Angeben (wenn du antwortest oder anrufst)</small><br>${c.zeichen.map(z => `<span class="chip">${esc(z)}</span>`).join(" ")}</p>` : ""}
  </div>`;
}

/* ---------- Schritt 3: Ergebnis mit KI-Erklärung ---------- */
async function ergebnisSeite(mitKi) {
  const c = schnellCheck(text);
  erklaerung = "";
  $("ansicht").innerHTML = `<button class="btn small" type="button" id="zurueck">← Text bearbeiten</button>
    <div class="card warnung">⚠️ <b>Nur eine Hilfe</b> – keine Rechts- oder Geldberatung. Die KI kann sich irren. Bei Fristen, Geld oder wenn du unsicher bist: frag einen Erwachsenen oder direkt bei der Stelle nach.</div>
    <div id="kiTeil"></div>${checkHtml(c)}
    <div class="row" style="margin-top:12px"><button class="btn" type="button" id="merken">⭐ Merken</button><button class="btn" type="button" id="neu">📷 Neuer Brief</button></div>`;
  $("zurueck").onclick = () => pruefSeite(text);
  $("neu").onclick = () => { if (abbruch) abbruch.abort(); startSeite(); };
  $("merken").onclick = () => { const titel = (erklaerung.match(/Worum geht es\?\s*\n+([^\n]{5,80})/) || [])[1] || c.absender || "Brief"; D.gemerkt.unshift({ titel: titel.replace(/[#*]/g, "").slice(0, 70), text, erklaerung, zeit: Date.now() }); D.gemerkt = D.gemerkt.slice(0, 15); speichern(); KW.toast("Gemerkt – nur auf diesem Gerät."); };
  if (mitKi) kiErklaeren(); else $("kiTeil").innerHTML = `<div class="card ki"><p>Möchtest du eine Erklärung in einfacher Sprache?</p><button class="btn primary" type="button" id="kiJetzt">✨ Mit KI erklären</button></div>`, $("kiJetzt").onclick = kiErklaeren;
}
async function kiLaden(status) {
  if (ki) return ki;
  if (kiLaedt) return kiLaedt;
  kiLaedt = (async () => {
    const g = await geraetPruefen(), id = D.modell && MODELLE.find(m => m.id === D.modell) ? D.modell : empfehlung(g);
    if (!id) throw new Error("kein-geraet");
    ki = await starten(id, g, (p, t) => status(p, t));
    D.modell = id; speichern(); return ki;
  })();
  try { return await kiLaedt; } finally { kiLaedt = null; }
}
async function kiErklaeren() {
  const el = $("kiTeil");
  if (!ki && !D.kiOk) {
    el.innerHTML = `<div class="card ki"><h3>✨ KI auf deinem Gerät</h3><p>Damit nichts ins Internet geht, lädt FIDELIA Form beim ersten Mal eine KI auf dein Gerät herunter (rund 0,5 bis 1,5 GB – am besten im WLAN). Danach geht es auch offline. Wenn du die AORIS KI schon benutzt, ist sie meist schon da.</p><button class="btn primary" type="button" id="kiLos">KI laden und erklären</button></div>`;
    $("kiLos").onclick = () => { D.kiOk = true; speichern(); kiErklaeren(); };
    return;
  }
  el.innerHTML = `<div class="card ki"><h3>✨ Erklärung</h3><div id="kiStatus" class="muted klein">KI wird vorbereitet …</div><div class="balken"><span id="kiBalken"></span></div><div class="antwort" id="kiText"></div></div>`;
  let motor;
  try { motor = await kiLaden((p, t) => { $("kiStatus") && ($("kiStatus").textContent = "KI wird geladen … " + Math.round((p || 0) * 100) + " % (nur beim ersten Mal)"); $("kiBalken") && ($("kiBalken").style.width = Math.round((p || 0) * 100) + "%"); }); }
  catch (e) { el.innerHTML = `<div class="card ki"><p>${String(e.message) === "kein-geraet" ? "😕 Dein Gerät kann leider keine KI im Browser ausführen (es fehlt WebGPU). Der Schnell-Check unten funktioniert trotzdem. Tipp: Probier es am PC mit Chrome." : "Die KI konnte nicht geladen werden. Prüf deine Verbindung und versuch es nochmal."}</p></div>`; return; }
  $("kiStatus").textContent = "Die KI liest den Brief …"; $("kiBalken").parentNode.hidden = true;
  const nachrichten = [
    { role: "system", content: "Du bist FIDELIA Form, ein freundlicher Helfer. Du erklärst Briefe (von Ämtern, Schulen, Vereinen, Firmen, Krankenkassen) in sehr einfacher Sprache, so dass auch Jugendliche sie verstehen. Antworte auf Deutsch und benutze genau diese Überschriften:\n## Worum geht es?\n(2–3 kurze Sätze)\n## Was musst du tun?\n(Liste mit - , oder „Nichts, der Brief ist nur zur Info.“)\n## Bis wann?\n(Fristen mit Datum, oder „Im Brief steht keine Frist.“)\n## Schwierige Wörter\n(- Wort: einfache Erklärung, höchstens 5)\n## Tipp\n(ein Satz, z. B. wen man fragen kann)\nErfinde nichts. Wenn etwas nicht im Brief steht, schreib „steht nicht im Brief“. Gib keine Rechtsberatung und sag bei Geld oder Fristen, dass man einen Erwachsenen oder die Stelle fragen soll." },
    { role: "user", content: "Erklär mir diesen Brief:\n\n" + text.slice(0, 3500) }
  ];
  abbruch = new AbortController();
  try {
    await motor.neu();
    for await (const stueck of motor.antworte(nachrichten, { signal: abbruch.signal })) { erklaerung += stueck; $("kiText") && ($("kiText").innerHTML = md(ohneDenken(erklaerung))); }
    erklaerung = ohneDenken(erklaerung);
    $("kiStatus").textContent = "Erklärt von " + motor.name + " – direkt auf deinem Gerät. Prüf wichtige Stellen im Original.";
  } catch (e) { if (!abbruch.signal.aborted) $("kiStatus").textContent = "Die KI ist hängen geblieben. Versuch es nochmal."; }
}
function md(t) {
  return esc(t).replace(/^##\s*(.+)$/gm, "<h4>$1</h4>").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/^\s*[-•]\s+(.+)$/gm, "<li>$1</li>").replace(/(<li>.*<\/li>\n?)+/g, m => "<ul>" + m + "</ul>").replace(/\n{2,}/g, "<br>");
}

/* ---------- Kalender-Erinnerung für eine Frist ---------- */
document.addEventListener("click", e => {
  const b = e.target.closest("[data-ics]");
  if (b) {
    const d = b.dataset.ics, vor = new Date(new Date(d).getTime() - 3 * 864e5).toISOString().slice(0, 10).replace(/-/g, "");
    const z = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OMNIVIA//FIDELIA Form//DE", "BEGIN:VEVENT", "UID:frist-" + d + "-" + Math.random().toString(36).slice(2) + "@fidelia-form", "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z", "DTSTART;VALUE=DATE:" + vor, "DTEND;VALUE=DATE:" + vor, "SUMMARY:⏰ Frist am " + d.split("-").reverse().join(".") + " (Brief)", "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Frist aus einem Brief", "TRIGGER:PT9H", "END:VALARM", "END:VEVENT", "END:VCALENDAR"];
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([z.join("\r\n")], { type: "text/calendar" })); a.download = "Frist-" + d + ".ics"; document.body.appendChild(a); a.click(); a.remove();
    KW.toast("Erinnerung 3 Tage vorher – öffne die Datei, um sie in deinen Kalender zu übernehmen.");
    return;
  }
  const g = e.target.closest("[data-g]");
  if (g) {
    const x = D.gemerkt[+g.dataset.g]; if (!x) return;
    text = x.text; erklaerung = x.erklaerung;
    $("ansicht").innerHTML = `<button class="btn small" type="button" id="zurueck">← Zurück</button><div class="card ki"><h3>📄 ${esc(x.titel)}</h3><div class="antwort">${x.erklaerung ? md(x.erklaerung) : "<p class='muted'>Ohne KI-Erklärung gemerkt.</p>"}</div></div>${checkHtml(schnellCheck(x.text))}<button class="btn danger" type="button" id="vergessen" style="margin-top:12px">🗑️ Vergessen</button>`;
    $("zurueck").onclick = startSeite;
    $("vergessen").onclick = () => { D.gemerkt.splice(+g.dataset.g, 1); speichern(); startSeite(); };
  }
});

startSeite();
