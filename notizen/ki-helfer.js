// FIDELIA Notizen · KI-Helfer
// Text markieren → ✨ verbessern, Rechtschreibung, kürzer, einfacher, übersetzen, Synonyme.
// Aufgaben-Helfer (Tipps Schritt für Schritt, ohne gleich die Lösung zu verraten), Lernzettel für ein ganzes Fach,
// Formel-Hilfe in Tabellen. Alles läuft mit der KI auf deinem Gerät (Ollama oder Browser-KI).
// Die reinen Teile oben werden mit node getestet.

import * as F from "./formel.js";

/* ---------- Reine Teile ---------- */

export const SPRACHEN = [["en", "Englisch"], ["fr", "Französisch"], ["es", "Spanisch"], ["la", "Latein"], ["de", "Deutsch"]];

export const AUFTRAG = {
  verbessern: { name: "Besser formulieren", icon: "✍️", system: "Du verbesserst einen kurzen Text eines Schülers: klarer, flüssiger, richtige Rechtschreibung und Zeichensetzung. Inhalt und Sinn bleiben genau gleich, nichts dazuerfinden, ungefähr gleich lang. Antworte NUR mit dem verbesserten Text, ohne Erklärung, ohne Anführungszeichen." },
  rechtschreibung: { name: "Rechtschreibung", icon: "🔤", system: "Korrigiere NUR Rechtschreibung, Grammatik und Zeichensetzung im Text. Ändere sonst kein Wort. Antworte NUR mit dem korrigierten Text, ohne Erklärung, ohne Anführungszeichen." },
  kuerzer: { name: "Kürzer", icon: "✂️", system: "Kürze den Text auf etwa die Hälfte. Die wichtigsten Aussagen bleiben, nichts dazuerfinden. Antworte NUR mit dem gekürzten Text, ohne Erklärung." },
  einfacher: { name: "Einfacher erklären", icon: "🧒", system: "Erkläre den Text so, dass ihn ein Schüler der 6. Klasse versteht: kurze Sätze, einfache Wörter, Fachwörter kurz erklärt. Nichts Falsches dazuerfinden. Antworte NUR mit der Erklärung, höchstens 6 Sätze." },
  uebersetzen: { name: "Übersetzen", icon: "🌍", system: (sprache) => "Übersetze den Text ins " + sprache + ". Antworte NUR mit der Übersetzung, ohne Erklärung, ohne Anführungszeichen." },
  synonyme: { name: "Andere Wörter", icon: "🔁", system: "Nenne 6 Wörter oder kurze Ausdrücke, die dasselbe bedeuten wie das gegebene Wort und im Satzzusammenhang passen. Antworte NUR mit JSON: {\"woerter\": [\"...\"]}" }
};
export const TUTOR = {
  tipp: "Du bist ein geduldiger Nachhilfe-Lehrer. Der Schüler zeigt dir eine Aufgabe. Verrate NICHT die Lösung. Gib genau EINEN kleinen nächsten Tipp (1–3 Sätze), der ihm hilft, selbst weiterzukommen. " +
    "Wenn schon Tipps gegeben wurden, mach den nächsten Schritt etwas konkreter. Schreib auf Deutsch, freundlich, in Du-Form, ohne Markdown.",
  pruefen: "Du bist ein geduldiger Nachhilfe-Lehrer. Prüfe die Antwort des Schülers zur Aufgabe. Sag zuerst klar „Richtig“, „Fast richtig“ oder „Noch nicht richtig“. " +
    "Dann erkläre in 2–4 Sätzen, warum, und – wenn es falsch ist – wo der Fehler liegt, ohne gleich die ganze Lösung hinzuschreiben. Schreib auf Deutsch, in Du-Form, ohne Markdown.",
  loesung: "Du bist ein geduldiger Nachhilfe-Lehrer. Rechne bzw. löse die Aufgabe Schritt für Schritt vor. Nummeriere die Schritte, erkläre jeden kurz, am Ende „Ergebnis: …“. Schreib auf Deutsch, ohne Markdown-Sternchen."
};
export const LERNZETTEL = (fach) => "Du machst aus Heft-Einträgen eines Schülers einen Lernzettel für " + (fach || "die Klassenarbeit") + ". Benutze NUR, was im Text steht. " +
  "Aufbau: Überschrift, dann die wichtigsten Begriffe mit je einem Satz Erklärung als Stichpunkte („- Begriff: Erklärung“), dann „Merke:“ mit 3 Kernsätzen. Höchstens eine Seite. Schreib auf Deutsch, ohne Markdown-Sternchen.";
export const FORMEL = (kontext) => "Du hilfst in einer deutschen Tabellen-App (wie Excel auf Deutsch). Schreib EINE Formel, die macht, was der Schüler beschreibt. " +
  "Benutze deutsche Funktionsnamen (SUMME, MITTELWERT, WENN, ZÄHLENWENN, SUMMEWENN, SVERWEIS, RUNDEN, MAX, MIN, ANZAHL …) und „;“ zwischen den Teilen. " +
  (kontext ? "Infos zur Tabelle: " + kontext + " " : "") + "Antworte NUR mit JSON: {\"formel\": \"=...\", \"erklaerung\": \"ein kurzer Satz\"}";

// KI-Antworten aufräumen: Markdown, Anführungszeichen, „Hier ist …“-Einleitungen weg
export function antwortSaeubern(t) {
  let s = String(t || "").replace(/```[a-z]*\n?|```/g, "").replace(/\*\*(.*?)\*\*/g, "$1").replace(/^#+\s*/gm, "").trim();
  s = s.replace(/^(?:hier ist|hier sind|klar[,!]?|gerne[,!]?|natürlich[,!]?|sure[,!]?|here is)[^\n:]*:\s*\n?/i, "").trim();
  if (/^["„“»«'].*["“”»«']$/s.test(s) && !/\n/.test(s)) s = s.slice(1, -1).trim();
  return s;
}

// Synonyme: JSON {woerter:[…]} oder einfach eine Liste mit Kommas/Zeilen
export function synonymeLesen(t, wort = "") {
  let liste = null;
  const m = /\{[\s\S]*\}/.exec(String(t || ""));
  if (m) { try { const j = JSON.parse(m[0]); liste = j.woerter || j.synonyme || j.words; } catch (e) {} }
  if (!Array.isArray(liste)) liste = String(t || "").split(/[\n,;]+/);
  const gesehen = new Set([wort.toLowerCase()]), out = [];
  for (let w of liste) {
    w = String(w).replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/["„“”]/g, "").trim();
    if (!w || w.length > 40 || /[{}:]/.test(w) || gesehen.has(w.toLowerCase())) continue;
    gesehen.add(w.toLowerCase()); out.push(w);
  }
  return out.slice(0, 8);
}

// Formel aus einer KI-Antwort holen und prüfen, ob unsere Tabelle sie versteht. → "=…" oder null
export function formelAusAntwort(t) {
  let roh = null, erkl = "";
  const m = /\{[\s\S]*\}/.exec(String(t || ""));
  if (m) { try { const j = JSON.parse(m[0]); roh = j.formel || j.formula; erkl = j.erklaerung || j.erklärung || ""; } catch (e) {} }
  if (!roh) {
    const code = /`(=[^`]+)`/.exec(String(t || ""));
    if (code) roh = code[1];
    else { // vom „=“ an bis die Klammern zu sind
      const txt = String(t || ""), i = txt.indexOf("="); if (i < 0) return null;
      let tiefe = 0, inText = false, j = i + 1, auf = false;
      for (; j < txt.length; j++) {
        const c = txt[j];
        if (c === '"') inText = !inText;
        else if (!inText && c === "(") { tiefe++; auf = true; }
        else if (!inText && c === ")") { tiefe--; if (tiefe === 0 && auf) { j++; break; } }
        else if (!inText && tiefe === 0 && /\s/.test(c)) break;
      }
      roh = txt.slice(i, j);
    }
  }
  if (!roh) return null;
  roh = String(roh).trim().replace(/[.。]+$/, "");
  if (roh[0] !== "=") roh = "=" + roh;
  const bekannt = (f) => { const namen = [...f.matchAll(/([A-ZÄÖÜa-zäöü][A-ZÄÖÜa-zäöü0-9.]*)\s*\(/g)].map(x => x[1].toUpperCase()); return namen.every(n => F.FUNKTIONEN.includes(n)); };
  const geht = (f) => { try { F.lesen(f.slice(1)); return bekannt(f); } catch (e) { return false; } };
  let f = roh.replace(/(\w)\s*\(/g, (a, b) => b + "(");
  f = f.replace(/^=([^"]*)$/, (a, b) => "=" + b.replace(/[a-zäöü]+(?=\()/g, x => x.toUpperCase()));
  // Englische Formel (AVERAGE, „,“ als Trenner)? → auf Deutsch umschreiben
  const namen = (x) => [...x.matchAll(/([A-ZÄÖÜ][A-ZÄÖÜ0-9.]*)\(/g)].map(m => m[1]).join();
  const e = F.vonExcel(f.slice(1));
  if ((!geht(f) || namen(e) !== namen(f)) && geht(e)) f = e;
  return geht(f) ? { formel: f, erklaerung: antwortSaeubern(erkl) } : null;
}

/* ---------- Im Browser ---------- */

const KWb = () => window.KW;
async function frag(A, system, text, json = false) {
  const KI = await import("./ki.js");
  return KI.fragen(A.einst.ki, { system, text, json }, (p, t) => { if (t) KWb().toast(t); });
}
export function kiFehlerText(e) {
  const m = e && e.message;
  return m === "keine-ki" ? "Dafür braucht es die KI. Schalte sie unter ⚙️ Einstellungen → KI ein." : m === "ollama-fehler" ? "Ollama hat einen Fehler gemeldet. Läuft das Modell noch?" : "Die KI hat gerade nicht geklappt. Versuch es nochmal.";
}

/* --- ✨-Blase beim Markieren von Text (Heft, Folien-Textfelder) --- */
export function textBlaseStarten(A) {
  if (document.getElementById("kiBlase")) return;
  const KW = KWb(), esc = KW.esc;
  const blase = document.createElement("div");
  blase.id = "kiBlase"; blase.className = "ki-blase"; blase.hidden = true; blase.setAttribute("role", "toolbar"); blase.setAttribute("aria-label", "KI-Helfer für den markierten Text");
  blase.innerHTML = '<button type="button" class="ki-auf" aria-haspopup="true" aria-expanded="false">✨ KI</button><div class="ki-menue" hidden>' +
    ["verbessern", "rechtschreibung", "kuerzer", "einfacher"].map(k => '<button type="button" data-k="' + k + '">' + AUFTRAG[k].icon + " " + AUFTRAG[k].name + '</button>').join("") +
    '<button type="button" data-k="synonyme">' + AUFTRAG.synonyme.icon + ' Andere Wörter</button>' +
    '<div class="ki-sprachen"><span>🌍</span>' + SPRACHEN.map(s => '<button type="button" data-k="uebersetzen" data-sp="' + s[1] + '">' + s[1] + '</button>').join("") + '</div></div>' +
    '<div class="ki-ergebnis" hidden aria-live="polite"></div>';
  document.body.appendChild(blase);
  const menue = blase.querySelector(".ki-menue"), erg = blase.querySelector(".ki-ergebnis"), aufK = blase.querySelector(".ki-auf");
  let bereich = null, feld = null, laeuft = 0;
  const zu = () => { blase.hidden = true; menue.hidden = true; erg.hidden = true; aufK.setAttribute("aria-expanded", "false"); laeuft++; };
  function platzieren() {
    const r = bereich.getBoundingClientRect();
    const x = Math.min(window.innerWidth - 12 - blase.offsetWidth, Math.max(12, r.left + r.width / 2 - blase.offsetWidth / 2));
    let y = r.top - blase.offsetHeight - 8; if (y < 70) y = r.bottom + 8;
    blase.style.left = x + "px"; blase.style.top = Math.min(window.innerHeight - blase.offsetHeight - 8, y) + "px";
  }
  function pruefen() {
    if (!A.einst.ki || A.einst.ki.art === "aus") return;
    const s = getSelection();
    if (!s.rangeCount || s.isCollapsed) { if (!blase.contains(document.activeElement)) zu(); return; }
    const n = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
    const ed = n && n.closest && n.closest("#ansicht [contenteditable=true]");
    const text = s.toString().trim();
    if (!ed || text.length < 2 || text.length > 4000) { zu(); return; }
    bereich = s.getRangeAt(0).cloneRange(); feld = ed;
    if (blase.hidden) { blase.hidden = false; menue.hidden = true; erg.hidden = true; }
    platzieren();
  }
  ["mouseup", "keyup", "touchend"].forEach(t => document.addEventListener(t, (e) => { if (!blase.contains(e.target)) setTimeout(pruefen, 10); }));
  document.addEventListener("mousedown", (e) => { if (!blase.contains(e.target)) zu(); });
  window.addEventListener("hashchange", zu);
  document.addEventListener("scroll", () => { if (!blase.hidden && bereich) platzieren(); }, true);
  blase.addEventListener("mousedown", (e) => { if (e.target.closest("button")) e.preventDefault(); });
  aufK.onclick = () => { menue.hidden = !menue.hidden; erg.hidden = true; aufK.setAttribute("aria-expanded", String(!menue.hidden)); platzieren(); };

  function ersetzen(neu, darunter) {
    if (!feld || !document.body.contains(feld)) return;
    feld.focus({ preventScroll: true });
    const s = getSelection(); s.removeAllRanges(); s.addRange(bereich);
    if (darunter) { s.collapseToEnd(); document.execCommand("insertText", false, "\n" + neu); }
    else document.execCommand("insertText", false, neu);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    zu(); KW.toast("✓ Übernommen. (Strg+Z macht es rückgängig)");
  }
  blase.querySelectorAll("[data-k]").forEach(b => b.onclick = async () => {
    const k = b.dataset.k, text = bereich.toString().trim(), meinLauf = ++laeuft;
    menue.hidden = true; erg.hidden = false; erg.innerHTML = '<p class="muted">✨ Die KI denkt nach …</p>'; platzieren();
    try {
      if (k === "synonyme") {
        const satz = (feld.textContent || "").slice(0, 400);
        const w = synonymeLesen(await frag(A, AUFTRAG.synonyme.system, "Wort: " + text + "\nSatz: " + satz, true), text);
        if (meinLauf !== laeuft) return;
        erg.innerHTML = w.length ? '<div class="ki-woerter">' + w.map(x => '<button type="button" class="btn small" data-w="' + esc(x) + '">' + esc(x) + '</button>').join("") + '</div>' : '<p class="muted">Keine passenden Wörter gefunden.</p>';
        erg.querySelectorAll("[data-w]").forEach(x => x.onclick = () => ersetzen(x.dataset.w));
      } else {
        const sys = k === "uebersetzen" ? AUFTRAG.uebersetzen.system(b.dataset.sp) : AUFTRAG[k].system;
        const neu = antwortSaeubern(await frag(A, sys, text));
        if (meinLauf !== laeuft) return;
        if (!neu) throw new Error("leer");
        erg.innerHTML = '<div class="ki-text">' + esc(neu).replace(/\n/g, "<br>") + '</div><div class="ki-knoepfe">' +
          (k === "einfacher" ? '<button type="button" class="btn small primary" data-t="unter">⬇ Darunter einfügen</button>' : '<button type="button" class="btn small primary" data-t="ersetzen">✓ Ersetzen</button><button type="button" class="btn small" data-t="unter">⬇ Darunter</button>') +
          '<button type="button" class="btn small" data-t="kopie">📋</button><button type="button" class="btn small" data-t="zu" aria-label="Schließen">✕</button></div>' +
          '<p class="muted klein">KI kann sich irren – lies kurz drüber.</p>';
        erg.querySelector('[data-t="kopie"]').onclick = () => { try { navigator.clipboard.writeText(neu); KW.toast("Kopiert."); } catch (e) {} };
        erg.querySelector('[data-t="zu"]').onclick = zu;
        erg.querySelector('[data-t="unter"]').onclick = () => ersetzen(neu, true);
        const er = erg.querySelector('[data-t="ersetzen"]'); if (er) er.onclick = () => ersetzen(neu);
      }
      platzieren();
    } catch (e) { if (meinLauf === laeuft) { erg.innerHTML = '<p>' + esc(kiFehlerText(e)) + '</p>'; platzieren(); } }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !blase.hidden) zu(); });
}

/* --- Aufgaben-Helfer (Reiter in der Werkzeug-Leiste) --- */
export function aufgabenHelferAufbauen(box, A, { auswahlText }) {
  const KW = KWb(), esc = KW.esc;
  let verlauf = []; // { art: "tipp"|"pruefen"|"loesung", text }
  box.innerHTML = '<div class="ah">' +
    '<label class="field"><span>Deine Aufgabe</span><textarea class="inp" id="ahAufgabe" rows="4" placeholder="z. B. Löse 3x + 5 = 20"></textarea></label>' +
    '<div class="row ah-reihe"><button type="button" class="btn small" id="ahHolen" title="Markierten Text aus dem Heft übernehmen">⬇ Markierten Text</button><button type="button" class="btn small" id="ahNeu">Neu</button></div>' +
    '<div class="ah-verlauf" id="ahVerlauf" aria-live="polite"></div>' +
    '<div class="row ah-reihe"><button type="button" class="btn primary" id="ahTipp">💡 Tipp</button><button type="button" class="btn" id="ahLsg" title="Erst probieren!">📖 Lösungsweg</button></div>' +
    '<label class="field"><span>Deine Lösung prüfen lassen</span><textarea class="inp" id="ahMeine" rows="2" placeholder="Was hast du raus? Gern mit Rechenweg."></textarea></label>' +
    '<button type="button" class="btn" id="ahPruef">✔️ Prüfen</button>' +
    '<p class="muted klein">Der Helfer gibt dir erst kleine Tipps – so lernst du am meisten. KI kann sich verrechnen, prüf das Ergebnis.</p></div>';
  const q = (s) => box.querySelector(s);
  const zeichnen = () => { q("#ahVerlauf").innerHTML = verlauf.map((v, i) => '<div class="ah-blase ' + v.art + '"><b>' + (v.art === "tipp" ? "💡 Tipp " + (verlauf.slice(0, i + 1).filter(x => x.art === "tipp").length) : v.art === "pruefen" ? "✔️ Prüfung" : v.art === "warte" ? "✨" : "📖 Lösungsweg") + '</b><p>' + esc(v.text).replace(/\n/g, "<br>") + '</p></div>').join(""); };
  q("#ahHolen").onclick = () => { const t = auswahlText(); if (t) { q("#ahAufgabe").value = t; verlauf = []; zeichnen(); } else KW.toast("Markier erst die Aufgabe im Heft."); };
  q("#ahNeu").onclick = () => { q("#ahAufgabe").value = ""; q("#ahMeine").value = ""; verlauf = []; zeichnen(); q("#ahAufgabe").focus(); };
  async function los(art) {
    const aufgabe = q("#ahAufgabe").value.trim();
    if (!aufgabe) { KW.toast("Schreib erst die Aufgabe rein."); q("#ahAufgabe").focus(); return; }
    if (art === "loesung" && verlauf.filter(v => v.art === "tipp").length < 1 && !confirm("Willst du nicht erst einen Tipp probieren? Mit „OK“ kommt gleich der ganze Lösungsweg.")) return;
    const meine = q("#ahMeine").value.trim();
    if (art === "pruefen" && !meine) { KW.toast("Schreib erst deine Lösung rein."); q("#ahMeine").focus(); return; }
    const bisher = verlauf.filter(v => v.art === "tipp").map((v, i) => "Tipp " + (i + 1) + ": " + v.text).join("\n");
    const text = "Aufgabe: " + aufgabe + (bisher ? "\nBisherige Tipps:\n" + bisher : "") + (art === "pruefen" ? "\nAntwort des Schülers: " + meine : "");
    verlauf.push({ art: "warte", text: "Denkt nach …" }); zeichnen();
    try { const t = antwortSaeubern(await frag(A, TUTOR[art], text)); verlauf.pop(); verlauf.push({ art, text: t || "Mir fällt gerade nichts ein – formulier die Aufgabe etwas genauer." }); }
    catch (e) { verlauf.pop(); KW.toast(kiFehlerText(e)); }
    zeichnen(); const v = q("#ahVerlauf"); v.lastElementChild && v.lastElementChild.scrollIntoView({ block: "nearest" });
  }
  q("#ahTipp").onclick = () => los("tipp"); q("#ahLsg").onclick = () => los("loesung"); q("#ahPruef").onclick = () => los("pruefen");
  return { fokus: () => q("#ahAufgabe").focus(), setzen: (t) => { q("#ahAufgabe").value = t; verlauf = []; zeichnen(); } };
}

/* --- Lernzettel für ein ganzes Fach → neue Heftseite --- */
export async function lernzettel(A, fach) {
  const KW = KWb();
  const seiten = A.aktiv().filter(s => s.fach === fach && !/^Lernzettel /.test(s.titel || "")).sort((a, b) => String(a.erstellt).localeCompare(String(b.erstellt)));
  const text = seiten.map(s => "## " + (s.titel || "Seite") + "\n" + A.seitenText(s).trim()).filter(t => t.length > 20).join("\n\n");
  if (text.replace(/\s/g, "").length < 60) { KW.toast("In „" + fach + "“ steht noch zu wenig Text. Tipp etwas ein oder scanne Blätter."); return null; }
  KW.toast("✨ Lernzettel wird geschrieben … (kann eine Minute dauern)");
  const KI = await import("./ki.js");
  const teile = KI.stuecke(text, 6000), out = [];
  for (let i = 0; i < Math.min(teile.length, 4); i++) out.push(antwortSaeubern(await frag(A, LERNZETTEL(fach), teile[i])));
  const zeilen = out.join("\n").split("\n").map(z => z.trim()).filter(Boolean);
  const esc = KW.esc;
  let html = "<h1>Lernzettel " + esc(fach) + "</h1>", liste = false;
  for (const z of zeilen) {
    if (/^Lernzettel/i.test(z) && html.length < 60) continue;
    const punkt = /^[-•*]\s*(.+)$/.exec(z);
    if (punkt) { if (!liste) { html += "<ul>"; liste = true; } const m = /^([^:]{1,40}):\s*(.+)$/.exec(punkt[1]); html += "<li>" + (m ? "<b>" + esc(m[1]) + ":</b> " + esc(m[2]) : esc(punkt[1])) + "</li>"; continue; }
    if (liste) { html += "</ul>"; liste = false; }
    if (/^merke:?$/i.test(z)) html += "<h2>Merke</h2>";
    else if (/^merke:/i.test(z)) html += '<p class="merke"><b>Merke:</b> ' + esc(z.replace(/^merke:\s*/i, "")) + "</p>";
    else if (z.length < 60 && !/[.!?]$/.test(z)) html += "<h2>" + esc(z) + "</h2>";
    else html += "<p>" + esc(z) + "</p>";
  }
  if (liste) html += "</ul>";
  html += '<p class="muted"><small>Aus ' + seiten.length + " Heftseiten mit KI erstellt – prüf, ob alles stimmt.</small></p>";
  const s = await A.seiteNeu({ fach, titel: "Lernzettel " + fach, html, text: "", quelle: "heft" });
  return s;
}

/* --- Formel-Hilfe für Tabellen --- */
export async function formelVorschlag(A, wunsch, kontext) {
  const r = formelAusAntwort(await frag(A, FORMEL(kontext), wunsch, true));
  if (!r) throw new Error("keine-formel");
  return r;
}
