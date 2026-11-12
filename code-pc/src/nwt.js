// Kometenwerk Code · NWT-Projekt: Versionen, Messwerte, Unterrichts-Modus, Eigenleistungs-Nachweis,
// Zeichnungen, Protokoll-Checkliste und Abgabe-Paket. Alles bleibt auf diesem Computer.
// Fair: Das Programm schreibt keinen Code, wertet keine Messwerte aus und schreibt kein Protokoll.
import * as U from "./unterricht.js";
import * as Zei from "./zeichnen.js";
import { zip, base64 } from "./zip.js";
import * as C from "./code-kern.js";

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const laden = (k, v) => { try { const x = localStorage.getItem(k); return x == null ? v : JSON.parse(x); } catch (e) { return v; } };
const datumZeit = (t) => new Date(t).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const dateiTeil = (t) => (String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "") || "x").slice(0, 40);

export const CHECKLISTE = [
  ["titel", "Titelseite"], ["inhalt", "Inhaltsübersicht"], ["einleitung", "Einleitung (Aufgabe und Ziel)"],
  ["bau", "Entwurf und Bau (Teile, Aufbau)", "p:teile"], ["zeichnung", "Technische Zeichnung der Deckplatte", "z:bauplan"],
  ["schaltplan", "Schaltplan", "z:schaltplan"], ["fluss", "Flussdiagramm", "z:fluss"],
  ["code", "Programm-Versionen digital abgegeben", "p:versionen"], ["test", "Testergebnisse (Messwerte)", "p:messwerte"],
  ["auswertung", "Auswertung (selbst gerechnet / gezeichnet)"], ["fazit", "Fazit"]
];

export function starten(A) {
  // A: { ed, Z, KC, toast, ausgabeStart, reiter, panelZeigen, untenAuf }
  const P = Object.assign({ name: "Reaktionstester", versionen: [], messwerte: { probanden: [], werte: [], aktiv: 0, filter: "" }, zeichnungen: {}, unterricht: { an: false, extra: [] }, eigen: { an: false, sitzungen: [] }, checkliste: {}, tagebuch: [], teile: [], gruppe: [], fehler: [] }, laden("kc-projekt", {}));
  if (!Array.isArray(P.gruppe)) P.gruppe = []; if (!Array.isArray(P.fehler)) P.fehler = [];
  if (!Array.isArray(P.tagebuch)) P.tagebuch = []; if (!Array.isArray(P.teile)) P.teile = [];
  const sichern = () => { try { localStorage.setItem("kc-projekt", JSON.stringify(P)); } catch (e) { A.toast("Speicher voll – lösch alte Versionen oder exportiere die Messwerte."); } };
  let erlaubt = U.erlaubteListe(P.unterricht.extra), intern = false, aufnahme = false;

  /* ---------- Befehls-Lexikon (zum Nachschlagen, wie in der Bauanleitung) ---------- */
  const SPRACHE = { void: "Funktion ohne Rückgabewert, z. B. setup und loop", int: "ganze Zahl (−32768 bis 32767)", long: "große ganze Zahl (für Zeiten in ms)", float: "Kommazahl", if: "wenn … dann: Bedingung in ( ), Anweisungen in { }", else: "sonst – gehört zu if", for: "Schleife mit Zähler: for (Start; Bedingung; Schritt)", while: "Schleife, solange die Bedingung stimmt", setup: "läuft einmal beim Start", loop: "läuft immer wieder" };
  function lexikon() {
    const eintraege = [];
    for (const [n, w] of Object.entries(C.WISSEN)) eintraege.push({ n, aufbau: w[0] || w.aufbau, info: w[1] || w.info });
    for (const [n, i] of Object.entries(C.KONSTANTEN)) eintraege.push({ n, aufbau: n, info: i });
    for (const [n, i] of Object.entries(SPRACHE)) if (!eintraege.some(e => e.n === n)) eintraege.push({ n, aufbau: n, info: i });
    const d = dialog('<h2>📚 Befehls-Lexikon</h2><div class="v-wahl"><input id="lxQ" class="lx-such" placeholder="Befehl suchen, z. B. tone"><label class="check"><input type="checkbox" id="lxNur"' + (P.unterricht.an ? " checked" : "") + '> nur aus dem Unterricht</label></div><div class="lx-liste"></div><div class="dialog-fuss"><button type="button" class="pill" data-a="zu">SCHLIESSEN</button></div>', "gross");
    const malen = () => {
      const q = d.querySelector("#lxQ").value.trim().toLowerCase(), nur = d.querySelector("#lxNur").checked;
      const l = eintraege.filter(e => (!nur || !U.istFremd(e.n, erlaubt)) && (!q || e.n.toLowerCase().includes(q) || String(e.info).toLowerCase().includes(q))).sort((a, b) => (U.istFremd(a.n, erlaubt) - U.istFremd(b.n, erlaubt)) || a.n.localeCompare(b.n));
      d.querySelector(".lx-liste").innerHTML = l.map(e => '<div class="lx"><code>' + esc(e.aufbau) + "</code>" + (U.istFremd(e.n, erlaubt) ? '<span class="lx-fremd">nicht im Unterricht</span>' : "") + "<p>" + esc(e.info) + "</p></div>").join("") || '<p class="leise">Nichts gefunden.</p>';
    };
    d.querySelector("#lxQ").oninput = malen; d.querySelector("#lxNur").onchange = malen; d.querySelector('[data-a="zu"]').onclick = () => d.close();
    malen(); d.querySelector("#lxQ").focus();
  }

  /* ---------- Fehler-Sammlung: deine Fehler und wie du sie gelöst hast ---------- */
  function fehlerMerken(liste) {
    let neu = false;
    for (const m of liste) {
      if (m.art !== "fehler") continue;
      const schl = String(m.text).replace(/„[^“]*“|"[^"]*"|'[^']*'/g, "…").slice(0, 120);
      const da = P.fehler.find(f => f.schl === schl);
      if (da) { da.anzahl++; da.zuletzt = Date.now(); } else { P.fehler.push({ schl, text: m.text, tipp: m.tipp || "", zeit: Date.now(), zuletzt: Date.now(), anzahl: 1, notiz: "" }); neu = true; }
    }
    if (P.fehler.length > 60) P.fehler = P.fehler.sort((a, b) => b.zuletzt - a.zuletzt).slice(0, 60);
    sichern(); if (neu) zeigen();
  }
  function fehlerDialog() {
    const d = dialog('<h2>🐞 Fehler-Sammlung</h2><p class="leise">Jeder Fehler, den der Übersetzer gefunden hat. Schreib dazu, wie du ihn gelöst hast – das hilft dir beim nächsten Mal (und im Protokoll bei „Probleme und Lösungen“).</p>' +
      (P.fehler.length ? '<div class="fs-liste">' + P.fehler.slice().sort((a, b) => b.zuletzt - a.zuletzt).map(f => '<div class="fs"><b>' + esc(f.text) + '</b> <small class="leise">' + f.anzahl + "× · zuletzt " + new Date(f.zuletzt).toLocaleDateString("de-DE") + "</small>" + (f.tipp ? '<p class="leise">' + esc(f.tipp) + "</p>" : "") + '<textarea data-fs="' + esc(f.schl) + '" rows="2" placeholder="So habe ich es gelöst …">' + esc(f.notiz) + "</textarea></div>").join("") + "</div>" : '<p class="leise">Noch keine Fehler gesammelt – klick auf ✓ Prüfen, dann landen sie hier.</p>') +
      '<div class="dialog-fuss links"><button type="button" class="pill hell klein" data-a="txt">ALS TEXT SPEICHERN</button><span class="sp"></span><button type="button" class="pill" data-a="zu">FERTIG</button></div>', "gross");
    d.querySelectorAll("[data-fs]").forEach(t => t.oninput = () => { const f = P.fehler.find(x => x.schl === t.dataset.fs); if (f) { f.notiz = t.value; sichern(); } });
    d.querySelector('[data-a="zu"]').onclick = () => d.close();
    d.querySelector('[data-a="txt"]').onclick = async () => { const z = await A.KC.exportSpeichern({ name: dateiTeil(P.name) + "_Fehler.txt", art: "txt", text: fehlerText() }); if (z) A.toast("Gespeichert: " + z); };
  }
  const fehlerText = () => "Fehler-Sammlung – " + P.name + "\n\n" + P.fehler.map(f => "• " + f.text + " (" + f.anzahl + "×)\n  Gelöst: " + (f.notiz || "–")).join("\n\n") + "\n";

  /* ---------- Gruppe: wer hat was gemacht ---------- */
  function werWahl() {
    if (!P.gruppe.length) return '<p class="leise klein">Tipp: Trag im Projekt-Bereich unter „Gruppe“ eure Namen ein, dann kannst du hier ankreuzen, wer mitgemacht hat.</p>';
    return '<div class="wer-wahl"><span class="leise">Wer hat mitgemacht?</span>' + P.gruppe.map((n, i) => '<label class="check"><input type="checkbox" data-wer="' + i + '"' + (P.ich === n ? " checked" : "") + "> " + esc(n) + "</label>").join("") + "</div>";
  }
  function werLesen(d) { return [...d.querySelectorAll("[data-wer]:checked")].map(c => P.gruppe[Number(c.dataset.wer)]).filter(Boolean); }
  function gruppeDialog() {
    const d = dialog('<h2>👥 Gruppe</h2><label class="z-feld breit"><span>Namen der Gruppenmitglieder (durch Komma getrennt)</span><input id="gNamen" value="' + esc(P.gruppe.join(", ")) + '" placeholder="z. B. Max, Lena, Tim"></label><label class="z-feld breit"><span>Wer bin ich an diesem PC?</span><select id="gIch"><option value="">–</option>' + P.gruppe.map(n => "<option" + (P.ich === n ? " selected" : "") + ">" + esc(n) + "</option>").join("") + '</select></label><p class="leise">Nur Vornamen reichen. Sie stehen bei Versionen und im Tagebuch.</p><div class="dialog-fuss"><button type="button" class="pill" data-ok>OK</button></div>');
    d.querySelector("#gNamen").oninput = () => { const n = d.querySelector("#gNamen").value.split(",").map(x => x.trim()).filter(Boolean); d.querySelector("#gIch").innerHTML = '<option value="">–</option>' + n.map(x => "<option>" + esc(x) + "</option>").join(""); };
    d.querySelector("[data-ok]").onclick = () => { P.gruppe = [...new Set(d.querySelector("#gNamen").value.split(",").map(x => x.trim()).filter(Boolean))].slice(0, 8); P.ich = d.querySelector("#gIch").value || ""; sichern(); zeigen(); d.close(); };
  }

  /* ---------- Projekt mit der Gruppe teilen ---------- */
  async function projektTeilen() {
    const inhalt = JSON.stringify({ art: "kometenwerk-code-projekt", version: 1, zeit: new Date().toISOString(), von: P.ich || "", projekt: P, code: A.ed.wert, sketch: A.Z.name });
    const z = await A.KC.exportSpeichern({ name: dateiTeil(P.name) + (P.ich ? "_" + dateiTeil(P.ich) : "") + ".kcprojekt", art: "kcprojekt", text: inhalt });
    if (z) A.toast("Gespeichert: " + z + " – schick die Datei deiner Gruppe (z. B. über die Schul-Cloud).", 8000);
  }
  async function projektZusammenfuehren() {
    const t = await A.KC.projektOeffnen(); if (!t) return;
    let j; try { j = JSON.parse(t); } catch (e) { A.toast("Das ist keine Projekt-Datei."); return; }
    if (!j.projekt || !/kometenwerk-code-(projekt|sicherung)/.test(j.art || "")) { A.toast("Das ist keine Kometenwerk-Code-Projekt-Datei."); return; }
    const Q = j.projekt, von = j.von || "Gruppe";
    if (!confirm("Projekt von " + von + " (" + datumZeit(j.zeit) + ") zu deinem dazunehmen? Deine eigenen Sachen bleiben erhalten.")) return;
    await sicherungJetzt(true);
    let neuV = 0, neuW = 0, neuT = 0;
    // Versionen: gleiche (gleicher Code) überspringen, sonst hinten anhängen und neu nummerieren
    for (const v of (Q.versionen || []).slice().sort((a, b) => a.zeit - b.zeit)) {
      if (P.versionen.some(x => x.code === v.code && x.titel === v.titel)) continue;
      P.versionen.push(Object.assign({}, v, { nr: (P.versionen.length ? P.versionen[P.versionen.length - 1].nr : 0) + 1, titel: v.titel + (v.nr ? " (" + von + " V" + v.nr + ")" : ""), wer: v.wer && v.wer.length ? v.wer : [von] })); neuV++;
    }
    P.versionen.sort((a, b) => a.zeit - b.zeit).forEach((v, i) => { v.nr = i + 1; });
    // Messwerte: Probanden bekommen neue Nummern, gleiche Werte (gleiche Zeit) werden nicht doppelt genommen
    const QM = Q.messwerte || { probanden: [], werte: [] }, umb = {};
    for (const p of QM.probanden || []) { const nr = Math.max(0, ...M.probanden.map(x => x.nr)) + 1; umb[p.nr] = nr; M.probanden.push({ nr, name: "Proband " + nr + (von ? " (" + von + ")" : "") }); }
    for (const w of QM.werte || []) { if (M.werte.some(x => x.zeit === w.zeit && x.wert === w.wert)) continue; M.werte.push(Object.assign({}, w, { p: umb[w.p] || w.p })); neuW++; }
    M.probanden = M.probanden.filter(p => M.werte.some(w => w.p === p.nr) || !Object.values(umb).includes(p.nr));
    // Tagebuch und Teile
    for (const e of Q.tagebuch || []) if (!P.tagebuch.some(x => x.zeit === e.zeit && x.text === e.text)) { P.tagebuch.push(e); neuT++; }
    P.tagebuch.sort((a, b) => a.zeit - b.zeit);
    for (const t2 of Q.teile || []) if (!P.teile.some(x => String(x.name).toLowerCase() === String(t2.name).toLowerCase())) P.teile.push(t2);
    for (const n of Q.gruppe || []) if (!P.gruppe.includes(n)) P.gruppe.push(n);
    // Zeichnungen: nur wenn du selbst noch keine hast – sonst fragen
    for (const [m, titel] of [["schaltplan", "Schaltplan"], ["fluss", "Flussdiagramm"], ["bauplan", "Technische Zeichnung"]]) {
      const q = Q.zeichnungen && Q.zeichnungen[m]; if (!q || !q.el || !q.el.length) continue;
      const eig = P.zeichnungen[m]; if (!eig || !eig.el || !eig.el.length || confirm(titel + ": Deine Zeichnung durch die von " + von + " ersetzen? (Abbrechen = deine behalten)")) P.zeichnungen[m] = q;
    }
    for (const [k, v] of Object.entries(Q.checkliste || {})) if (v) P.checkliste[k] = true;
    sichern(); zeigen(); messZeigen();
    A.toast("Zusammengeführt: " + neuV + " Versionen, " + neuW + " Messwerte, " + neuT + " Tagebuch-Einträge.", 7000);
  }

  /* ---------- Automatische Sicherung (Dokumente/Kometenwerk Code/Sicherung) ---------- */
  let letzteSicherung = "";
  async function sicherungJetzt(laut) {
    if (!A.KC || !A.KC.sicherungSchreiben) return;
    const inhalt = JSON.stringify({ art: "kometenwerk-code-sicherung", version: 1, zeit: new Date().toISOString(), projekt: P, entwurf: A.ed.wert, sketch: A.Z.name });
    const ohneZeit = inhalt.replace(/"zeit":"[^"]*",/, "");
    if (!laut && ohneZeit === letzteSicherung) return;
    const r = await A.KC.sicherungSchreiben(inhalt);
    if (r && r.ok) { letzteSicherung = ohneZeit; if (laut) A.toast("✔ Gesichert in " + r.ordner); }
  }
  setInterval(() => sicherungJetzt(false), 5 * 60 * 1000);
  setTimeout(() => sicherungJetzt(false), 20000);
  async function sicherungLaden() {
    const t = await A.KC.sicherungLaden(); if (!t) return;
    let j; try { j = JSON.parse(t); } catch (e) { A.toast("Das ist keine Sicherung."); return; }
    if (j.art !== "kometenwerk-code-sicherung" || !j.projekt) { A.toast("Das ist keine Kometenwerk-Code-Sicherung."); return; }
    if (!confirm("Sicherung vom " + datumZeit(j.zeit) + " laden? Dein jetziges Projekt (Versionen, Messwerte, Zeichnungen …) wird dadurch ersetzt.")) return;
    await sicherungJetzt(true);
    try { localStorage.setItem("kc-projekt", JSON.stringify(j.projekt)); if (j.entwurf) localStorage.setItem("kc-entwurf", JSON.stringify(j.entwurf)); } catch (e) {}
    location.reload();
  }

  /* ---------- Tagebuch (du schreibst, das Programm merkt Datum und Version) ---------- */
  async function tagebuchNeu() {
    const d = dialog('<h2>📒 Tagebuch-Eintrag</h2><p class="leise">Was habt ihr heute gemacht? Was hat geklappt, was nicht? Das hilft dir später beim Protokoll.</p><label class="z-feld breit"><span>Eintrag (' + new Date().toLocaleDateString("de-DE") + " · " + esc(aktuelleVersion()) + ')</span><textarea id="tbText" rows="5"></textarea></label>' + werWahl() + '<div class="dialog-fuss"><button type="button" class="pill hell" data-x>ABBRECHEN</button><button type="button" class="pill" data-ok>SPEICHERN</button></div>');
    d.querySelector("#tbText").focus();
    const ok = await new Promise(r => { d.querySelector("[data-ok]").onclick = () => r(true); d.querySelector("[data-x]").onclick = () => r(false); d.onclose = () => r(false); });
    const t = d.querySelector("#tbText").value.trim(), wer = werLesen(d); d.close();
    if (!ok || !t) return;
    P.tagebuch.push({ zeit: Date.now(), text: t, version: aktuelleVersion(), wer }); sichern(); zeigen();
  }
  function tagebuchText() { return "Projekt-Tagebuch – " + P.name + (P.gruppe.length ? "\nGruppe: " + P.gruppe.join(", ") : "") + "\n\n" + (P.tagebuch.map(e => datumZeit(e.zeit) + "  (" + e.version + ")" + (e.wer && e.wer.length ? "  · " + e.wer.join(", ") : "") + "\n" + e.text + "\n").join("\n") || "(noch keine Einträge)\n"); }
  function tagebuchDialog() {
    const d = dialog("<h2>📒 Tagebuch</h2>" + (P.tagebuch.length ? '<ul class="tb-liste">' + P.tagebuch.map((e, i) => "<li><small>" + datumZeit(e.zeit) + " · " + esc(e.version) + (e.wer && e.wer.length ? " · " + esc(e.wer.join(", ")) : "") + '</small> <button type="button" class="symbol klein" data-weg="' + i + '" aria-label="Eintrag löschen">×</button><div>' + esc(e.text).replace(/\n/g, "<br>") + "</div></li>").reverse().join("") + "</ul>" : '<p class="leise">Noch keine Einträge.</p>') +
      '<div class="dialog-fuss links"><button type="button" class="pill hell klein" data-a="neu">+ EINTRAG</button><button type="button" class="pill hell klein" data-a="txt">ALS TEXT SPEICHERN</button><span class="sp"></span><button type="button" class="pill klein" data-a="zu">SCHLIESSEN</button></div>', "gross");
    d.querySelector('[data-a="zu"]').onclick = () => d.close();
    d.querySelector('[data-a="neu"]').onclick = async () => { d.close(); await tagebuchNeu(); tagebuchDialog(); };
    d.querySelector('[data-a="txt"]').onclick = async () => { const z = await A.KC.exportSpeichern({ name: dateiTeil(P.name) + "_Tagebuch.txt", art: "txt", text: tagebuchText() }); if (z) A.toast("Gespeichert: " + z); };
    d.querySelectorAll("[data-weg]").forEach(b => b.onclick = () => { if (!confirm("Eintrag löschen?")) return; P.tagebuch.splice(Number(b.dataset.weg), 1); sichern(); zeigen(); d.close(); tagebuchDialog(); });
  }

  /* ---------- Teileliste ---------- */
  function teileDialog() {
    const zeile = (t, i) => '<tr><td><input data-t="' + i + '" data-k="name" value="' + esc(t.name) + '" placeholder="z. B. Taster" aria-label="Teil"></td><td class="anz"><input data-t="' + i + '" data-k="anzahl" value="' + esc(t.anzahl) + '" inputmode="numeric" aria-label="Anzahl"></td><td><input data-t="' + i + '" data-k="wofuer" value="' + esc(t.wofuer) + '" placeholder="wofür?" aria-label="Wofür"></td><td><button type="button" class="symbol klein" data-weg="' + i + '" aria-label="Zeile löschen">×</button></td></tr>';
    const d = dialog('<h2>🧩 Teileliste</h2><p class="leise">Welche Bauteile braucht ihr? Die Liste kommt ins Abgabe-Paket und lässt sich in Excel öffnen.</p><table class="teile-tab"><thead><tr><th>Teil</th><th>Anzahl</th><th>Wofür?</th><th></th></tr></thead><tbody></tbody></table>' +
      '<div class="dialog-fuss links"><button type="button" class="pill hell klein" data-a="neu">+ ZEILE</button><button type="button" class="pill hell klein" data-a="csv">EXCEL (CSV)</button><span class="sp"></span><button type="button" class="pill klein" data-a="zu">FERTIG</button></div>', "gross");
    const tb = d.querySelector("tbody");
    const malen = () => { tb.innerHTML = P.teile.map(zeile).join("");
      tb.querySelectorAll("input").forEach(i => i.oninput = () => { P.teile[i.dataset.t][i.dataset.k] = i.value; sichern(); });
      tb.querySelectorAll("[data-weg]").forEach(b => b.onclick = () => { P.teile.splice(Number(b.dataset.weg), 1); sichern(); malen(); }); };
    if (!P.teile.length) P.teile.push({ name: "Arduino Uno", anzahl: "1", wofuer: "" });
    malen();
    d.querySelector('[data-a="neu"]').onclick = () => { P.teile.push({ name: "", anzahl: "1", wofuer: "" }); malen(); tb.querySelector("tr:last-child input").focus(); };
    d.querySelector('[data-a="csv"]').onclick = async () => { const z = await A.KC.exportSpeichern({ name: dateiTeil(P.name) + "_Teileliste.csv", art: "csv", text: teileCsv() }); if (z) A.toast("Gespeichert: " + z); };
    d.querySelector('[data-a="zu"]').onclick = () => { P.teile = P.teile.filter(t => String(t.name).trim()); sichern(); zeigen(); d.close(); };
  }
  const teileCsv = () => "\ufeffTeil;Anzahl;Wofür\r\n" + P.teile.filter(t => String(t.name).trim()).map(t => [t.name, t.anzahl, t.wofuer].map(x => /[";\n]/.test(String(x)) ? '"' + String(x).replace(/"/g, '""') + '"' : x).join(";")).join("\r\n") + "\r\n";

  /* ---------- Versionen ---------- */
  function aktuelleVersion() {
    const v = P.versionen; if (!v.length) return "ohne Version";
    const gleich = [...v].reverse().find(x => x.code === A.ed.wert);
    return gleich ? "V" + gleich.nr : "V" + v[v.length - 1].nr + " + Änderungen";
  }
  async function versionSpeichern() {
    const code = A.ed.wert, letzte = P.versionen[P.versionen.length - 1];
    if (letzte && letzte.code === code) { A.toast("Diese Version ist schon gespeichert (V" + letzte.nr + ")."); return; }
    const nr = (letzte ? letzte.nr : 0) + 1;
    const d = dialog("<h2>Version " + nr + " speichern</h2><p class=\"leise\">Gib der Version einen kurzen Namen und schreib auf, was du geändert hast. So siehst du später (und deine Lehrkraft), wie dein Programm gewachsen ist.</p>" +
      '<label class="z-feld breit"><span>Name</span><input id="vName" placeholder="z. B. LED leuchtet nach Zufallszeit" maxlength="60"></label>' +
      '<label class="z-feld breit"><span>Was hast du geändert? (optional)</span><textarea id="vNotiz" rows="3"></textarea></label>' + werWahl() +
      '<div class="dialog-fuss"><button type="button" class="pill hell" data-x>ABBRECHEN</button><button type="button" class="pill" data-ok>SPEICHERN</button></div>');
    d.querySelector("#vName").focus();
    const ok = await new Promise(r => { d.querySelector("[data-ok]").onclick = () => r(true); d.querySelector("[data-x]").onclick = () => r(false); d.onclose = () => r(false); d.querySelector("#vName").onkeydown = (e) => { if (e.key === "Enter") r(true); }; });
    const titel = d.querySelector("#vName").value.trim() || "Version " + nr, notiz = d.querySelector("#vNotiz").value.trim(), wer = werLesen(d); d.close(); d.remove();
    if (!ok) return;
    const v = { nr, titel, notiz, zeit: Date.now(), code, sketch: A.Z.name, wer };
    P.versionen.push(v); sichern(); zeigen();
    let wo = "";
    if (A.KC && A.Z.pfad) { const z = await A.KC.versionAblegen({ pfad: A.Z.pfad, datei: "V" + nr + "_" + dateiTeil(titel) + ".ino", code }); if (z) wo = " – auch im Sketch-Ordner unter „Versionen“"; }
    A.toast("V" + nr + " „" + titel + "“ gespeichert" + wo + ".");
  }
  function diff(a, b) {        // zeilenweise (LCS)
    const x = a.split("\n"), y = b.split("\n"), n = x.length, m = y.length;
    if (n * m > 4e6) return [...x.map(t => ["-", t]), ...y.map(t => ["+", t])];
    const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const aus = []; let i = 0, j = 0;
    while (i < n && j < m) { if (x[i] === y[j]) { aus.push(["=", x[i], i + 1, j + 1]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) { aus.push(["-", x[i], i + 1, null]); i++; } else { aus.push(["+", y[j], null, j + 1]); j++; } }
    while (i < n) { aus.push(["-", x[i], i + 1, null]); i++; } while (j < m) { aus.push(["+", y[j], null, j + 1]); j++; }
    return aus;
  }
  function vergleichen(altIdx, neuIdx) {
    const V = P.versionen, nameVon = (i) => i === -1 ? "Aktueller Code" : "V" + V[i].nr + " „" + V[i].titel + "“", codeVon = (i) => i === -1 ? A.ed.wert : V[i].code;
    const opts = (sel) => V.map((v, i) => '<option value="' + i + '"' + (i === sel ? " selected" : "") + ">V" + v.nr + " – " + esc(v.titel) + "</option>").join("") + '<option value="-1"' + (sel === -1 ? " selected" : "") + ">Aktueller Code</option>";
    const d = dialog('<h2>Versionen vergleichen</h2><div class="v-wahl"><select id="vA">' + opts(altIdx) + '</select><span>→</span><select id="vB">' + opts(neuIdx) + '</select><label class="check"><input type="checkbox" id="vNur" checked> nur Änderungen</label></div><div class="v-info leise" id="vInfo"></div><div class="v-diff" id="vDiff"></div><div class="dialog-fuss"><button type="button" class="pill" data-x>SCHLIESSEN</button></div>', "gross");
    const malen = () => {
      const a = Number(d.querySelector("#vA").value), b = Number(d.querySelector("#vB").value), nur = d.querySelector("#vNur").checked, D = diff(codeVon(a), codeVon(b));
      const plus = D.filter(x => x[0] === "+").length, minus = D.filter(x => x[0] === "-").length;
      d.querySelector("#vInfo").textContent = nameVon(a) + " → " + nameVon(b) + ":  " + plus + " Zeilen neu, " + minus + " Zeilen weg" + (b >= 0 && V[b].notiz ? "  ·  Notiz: " + V[b].notiz : "");
      const zeigen = D.map((x, i) => !nur || x[0] !== "=" || D.slice(Math.max(0, i - 2), i + 3).some(y => y[0] !== "="));
      let h = "", luecke = false;
      D.forEach((x, i) => { if (!zeigen[i]) { if (!luecke) h += '<div class="v-z luecke">⋯</div>'; luecke = true; return; } luecke = false; h += '<div class="v-z ' + (x[0] === "+" ? "neu" : x[0] === "-" ? "weg" : "") + '"><span class="v-n">' + (x[2] || "") + '</span><span class="v-n">' + (x[3] || "") + '</span><span class="v-m">' + (x[0] === "=" ? " " : x[0]) + "</span><code>" + esc(x[1]) + "</code></div>"; });
      d.querySelector("#vDiff").innerHTML = plus + minus ? h : '<p class="leise">Kein Unterschied.</p>';
    };
    d.querySelectorAll("select, input").forEach(e => e.onchange = malen);
    d.querySelector("[data-x]").onclick = () => { d.close(); d.remove(); };
    malen();
  }
  function versionMenue(i) {
    const v = P.versionen[i];
    const d = dialog("<h2>V" + v.nr + " · " + esc(v.titel) + '</h2><p class="leise">' + datumZeit(v.zeit) + (v.wer && v.wer.length ? " · von " + esc(v.wer.join(", ")) : "") + (v.sketch ? " · Sketch „" + esc(v.sketch) + "“" : "") + "</p>" + (v.notiz ? "<p>" + esc(v.notiz) + "</p>" : "") +
      '<pre class="v-code">' + esc(v.code) + '</pre><div class="dialog-fuss links"><button type="button" class="pill hell klein" data-a="vgl">MIT AKTUELLEM VERGLEICHEN</button>' + (i > 0 ? '<button type="button" class="pill hell klein" data-a="vor">MIT V' + P.versionen[i - 1].nr + " VERGLEICHEN</button>" : "") +
      '<button type="button" class="pill hell klein" data-a="ino">ALS .INO SPEICHERN</button><button type="button" class="pill hell klein" data-a="laden">IN DEN EDITOR LADEN</button><span class="sp"></span><button type="button" class="pill hell klein rot" data-a="weg">LÖSCHEN</button><button type="button" class="pill klein" data-a="zu">SCHLIESSEN</button></div>', "gross");
    const zu = () => { d.close(); d.remove(); };
    d.querySelector('[data-a="zu"]').onclick = zu;
    d.querySelector('[data-a="vgl"]').onclick = () => { zu(); vergleichen(i, -1); };
    const vor = d.querySelector('[data-a="vor"]'); if (vor) vor.onclick = () => { zu(); vergleichen(i - 1, i); };
    d.querySelector('[data-a="ino"]').onclick = async () => { if (!A.KC) return; const z = await A.KC.exportSpeichern({ name: "V" + v.nr + "_" + dateiTeil(v.titel) + ".ino", art: "ino", text: v.code }); if (z) A.toast("Gespeichert: " + z); };
    d.querySelector('[data-a="laden"]').onclick = () => { if (!confirm("Den Code im Editor durch V" + v.nr + " ersetzen? (Strg+Z holt ihn zurück)")) return; still(() => A.ed.ersetzen(v.code)); zu(); A.toast("V" + v.nr + " geladen."); };
    d.querySelector('[data-a="weg"]').onclick = () => { if (!confirm("V" + v.nr + " wirklich löschen? Für die Abgabe sollen alle Versionen dabei sein.")) return; P.versionen.splice(i, 1); sichern(); zeigen(); zu(); };
  }

  /* ---------- Messwerte ---------- */
  const M = P.messwerte;
  function proband(nr) { return M.probanden.find(p => p.nr === nr); }
  function probandNeu() { const nr = Math.max(0, ...M.probanden.map(p => p.nr)) + 1; M.probanden.push({ nr, name: "Proband " + nr }); M.aktiv = nr; sichern(); messZeigen(); }
  function wertDazu(wert, zeile, version) {
    if (!M.aktiv || !proband(M.aktiv)) probandNeu();
    M.werte.push({ p: M.aktiv, wert, version: version || aktuelleVersion(), zeit: Date.now(), zeile: zeile ? String(zeile).slice(0, 80) : "" });
    sichern(); messZeigen(); zeigen();
  }
  function monZeile(z) {
    if (!aufnahme) return;
    const t = String(z).trim(); if (!t || /^\[.*\]$/.test(t)) return;
    if (M.filter && !t.toLowerCase().includes(M.filter.toLowerCase())) return;
    const m = /-?\d+(?:[.,]\d+)?/.exec(t); if (!m) return;
    wertDazu(Number(m[0].replace(",", ".")), t);
  }
  const zahlDe = (v) => String(v).replace(".", ",");
  function messZeigen() {
    const r = $("#rMesswerte"); if (!r) return;
    const wahl = M.probanden.map(p => '<option value="' + p.nr + '"' + (p.nr === M.aktiv ? " selected" : "") + ">" + esc(p.name) + "</option>").join("");
    const nachP = new Map(); M.werte.forEach((w, i) => { if (!nachP.has(w.p)) nachP.set(w.p, []); nachP.get(w.p).push([w, i]); });
    let tab = "";
    for (const p of M.probanden) { const l = nachP.get(p.nr) || []; if (!l.length) continue; tab += '<tr class="mp"><td colspan="5"><b>' + esc(p.name) + "</b> <small class=\"leise\">" + l.length + " Werte</small></td></tr>" + l.map(([w, i], k) => '<tr><td class="leise">' + (k + 1) + "</td><td><b>" + esc(zahlDe(w.wert)) + '</b></td><td class="leise">' + esc(w.version) + '</td><td class="leise">' + new Date(w.zeit).toLocaleTimeString("de-DE") + '</td><td><button type="button" class="symbol klein" data-weg="' + i + '" title="Wert löschen" aria-label="Wert löschen">×</button></td></tr>').join(""); }
    r.innerHTML = '<div class="mess-zeile"><button type="button" class="pill klein ' + (aufnahme ? "rot" : "") + '" id="mAuf">' + (aufnahme ? "■ AUFNAHME STOPPEN" : "● AUFNAHME STARTEN") + "</button>" +
      '<select id="mP" aria-label="Proband">' + (wahl || "<option>– noch kein Proband –</option>") + '</select><button type="button" class="pill hell klein" id="mNeu">+ PROBAND</button>' +
      '<input id="mFilter" placeholder="nur Zeilen mit … (z. B. Zeit)" value="' + esc(M.filter) + '" title="Nur Zeilen aufnehmen, in denen dieses Wort vorkommt">' +
      '<input id="mHand" placeholder="Wert von Hand" inputmode="decimal" style="width:110px"><span class="sp"></span>' +
      '<button type="button" class="pill hell klein" id="mSpiel" title="Reaktionstest am PC – zum Vergleich mit eurem Arduino-Tester">🎮 PC-TEST</button><button type="button" class="pill hell klein" id="mCount" title="Großer Countdown für den Probanden">⏱ COUNTDOWN</button>' +
      '<button type="button" class="pill hell klein" id="mCsv">EXCEL (CSV)</button><button type="button" class="pill hell klein" id="mKopie" title="Zum Einfügen in Excel oder FIDELIA Tabellen">KOPIEREN</button><button type="button" class="pill hell klein" id="mLeer">ALLE LÖSCHEN</button></div>' +
      '<p class="leise mess-info">' + (aufnahme ? "Nimmt aus dem Seriellen Monitor die erste Zahl jeder Zeile auf – für <b>" + esc((proband(M.aktiv) || {}).name || "") + "</b>. Version: " + esc(aktuelleVersion()) + "." : "Starte den Seriellen Monitor und dann die Aufnahme. Jeder Wert bekommt den Probanden und die Code-Version. Auswerten (Mittelwert, Diagramm) machst du selbst.") + "</p>" +
      (tab ? '<div class="mess-teile"><table class="mess-tab"><thead><tr><th>Nr.</th><th>Wert</th><th>Version</th><th>Uhrzeit</th><th></th></tr></thead><tbody>' + tab + '</tbody></table><div class="mess-dia" aria-label="Messwerte als Punkte">' + punkteBild() + "</div></div>" : '<p class="leise">Noch keine Messwerte.</p>');
    r.querySelector("#mAuf").onclick = async () => { aufnahme = !aufnahme; if (aufnahme) { if (!M.probanden.length) probandNeu(); await A.monitorAn(); } messZeigen(); A.reiterMarke(aufnahme); };
    r.querySelector("#mP").onchange = (e) => { M.aktiv = Number(e.target.value); sichern(); messZeigen(); };
    r.querySelector("#mNeu").onclick = probandNeu;
    r.querySelector("#mFilter").onchange = (e) => { M.filter = e.target.value.trim(); sichern(); };
    r.querySelector("#mHand").onkeydown = (e) => { if (e.key !== "Enter") return; const v = Number(e.target.value.replace(",", ".")); if (e.target.value.trim() === "" || isNaN(v)) { A.toast("Bitte eine Zahl eingeben."); return; } wertDazu(v, "von Hand"); setTimeout(() => $("#mHand") && $("#mHand").focus(), 0); };
    r.querySelector("#mSpiel").onclick = pcTest;
    r.querySelector("#mCount").onclick = () => countdown(null);
    r.querySelector("#mCsv").onclick = async () => { if (!M.werte.length) { A.toast("Noch keine Messwerte."); return; } if (!A.KC) return; const z = await A.KC.exportSpeichern({ name: dateiTeil(P.name) + "_Messwerte.csv", art: "csv", text: csv() }); if (z) A.toast("Gespeichert: " + z); };
    r.querySelector("#mKopie").onclick = async () => { try { await navigator.clipboard.writeText(tabelle("\t")); A.toast("Kopiert – in Excel oder FIDELIA Tabellen einfügen (Strg+V)."); } catch (e) { A.toast("Kopieren ging nicht."); } };
    r.querySelector("#mLeer").onclick = () => { if (!M.werte.length || !confirm("Alle " + M.werte.length + " Messwerte löschen? Exportier sie vorher, wenn du sie noch brauchst.")) return; M.werte = []; sichern(); messZeigen(); zeigen(); };
    r.querySelectorAll("[data-weg]").forEach(b => b.onclick = () => { M.werte.splice(Number(b.dataset.weg), 1); sichern(); messZeigen(); zeigen(); });
  }
  // Nur zum Anschauen: jeder Wert ein Punkt (x = Versuch, y = Wert), eine Farbe pro Proband. Kein Mittelwert, keine Auswertung.
  const FARBEN = ["#00a4ad", "#ff8a3c", "#a77bff", "#5fd35f", "#ff6b8b", "#e6b340", "#4ea1ff", "#c0c0c0"];
  function punkteBild() {
    const W = 360, H = 200, l = 44, o = 12, u = 26, rr = 10, nachP = new Map();
    M.werte.forEach(w => { if (!nachP.has(w.p)) nachP.set(w.p, []); nachP.get(w.p).push(w.wert); });
    const alle = M.werte.map(w => w.wert), max = Math.max(...alle, 1), min = Math.min(0, ...alle), n = Math.max(...[...nachP.values()].map(a => a.length), 1);
    const px = (i) => l + (n === 1 ? (W - l - rr) / 2 : i / (n - 1) * (W - l - rr)), py = (v) => o + (1 - (v - min) / (max - min || 1)) * (H - o - u);
    let h = '<svg viewBox="0 0 ' + W + " " + H + '" class="mess-svg"><line x1="' + l + '" y1="' + o + '" x2="' + l + '" y2="' + (H - u) + '" class="achse"/><line x1="' + l + '" y1="' + (H - u) + '" x2="' + (W - rr) + '" y2="' + (H - u) + '" class="achse"/>' +
      '<text x="' + (l - 4) + '" y="' + (o + 4) + '" text-anchor="end">' + zahlDe(Math.round(max)) + '</text><text x="' + (l - 4) + '" y="' + (H - u) + '" text-anchor="end">' + zahlDe(Math.round(min)) + '</text><text x="' + ((W + l) / 2) + '" y="' + (H - 6) + '" text-anchor="middle">Versuch</text>';
    let k = 0;
    for (const [p, werte] of nachP) { const f = FARBEN[k++ % FARBEN.length]; werte.forEach((v, i) => { h += '<circle cx="' + px(i).toFixed(1) + '" cy="' + py(v).toFixed(1) + '" r="4" fill="' + f + '"><title>' + esc((proband(p) || {}).name || "") + ": " + zahlDe(v) + "</title></circle>"; }); }
    h += "</svg>";
    k = 0; h += '<div class="mess-legende">' + [...nachP.keys()].map(p => '<span><i style="background:' + FARBEN[k++ % FARBEN.length] + '"></i>' + esc((proband(p) || {}).name || "") + "</span>").join("") + "</div>";
    return h + '<p class="leise klein">Nur zum Anschauen (z. B. Ausreißer finden). Auswerten machst du selbst.</p>';
  }
  // Großer Countdown für den Probanden (Vollbild)
  function countdown(danach) {
    const v = document.createElement("div"); v.className = "vollbild-count"; v.setAttribute("role", "dialog");
    const name = (proband(M.aktiv) || {}).name || "Proband";
    v.innerHTML = '<div class="vc-name">' + esc(name) + '</div><div class="vc-zahl">bereit?</div><div class="vc-hilfe">Leertaste oder Klick = Start · Esc = abbrechen</div>';
    document.body.appendChild(v);
    let laeuft = false;
    const zu = () => { v.remove(); document.removeEventListener("keydown", taste, true); };
    const start = () => { if (laeuft) return; laeuft = true; let n = 3; const z = v.querySelector(".vc-zahl"); z.textContent = n; const t = setInterval(() => { n--; if (n > 0) z.textContent = n; else { clearInterval(t); z.textContent = "LOS!"; setTimeout(() => { zu(); if (danach) danach(); }, 700); } }, 800); };
    const taste = (e) => { if (e.key === "Escape") { e.preventDefault(); zu(); } else if (e.key === " " || e.key === "Enter") { e.preventDefault(); start(); } };
    v.onclick = start; document.addEventListener("keydown", taste, true);
  }
  // Reaktionstest am PC: rot = warten, grün = so schnell wie möglich klicken / Leertaste
  function pcTest() {
    if (!M.probanden.length) probandNeu();
    const runden = 5; let runde = 0, gruenAb = 0, timer = null;
    const v = document.createElement("div"); v.className = "vollbild-count pc-test"; v.setAttribute("role", "dialog");
    v.innerHTML = '<div class="vc-name">PC-Test · ' + esc((proband(M.aktiv) || {}).name || "") + '</div><div class="vc-zahl">Klick zum Starten</div><div class="vc-hilfe">Wenn es grün wird: sofort klicken oder Leertaste. ' + runden + " Runden · Esc = beenden</div>";
    document.body.appendChild(v);
    const zahl = v.querySelector(".vc-zahl");
    const zu = () => { clearTimeout(timer); v.remove(); document.removeEventListener("keydown", taste, true); messZeigen(); zeigen(); };
    const warten = () => { v.className = "vollbild-count pc-test rot"; zahl.textContent = "warten …"; gruenAb = 0; timer = setTimeout(() => { v.className = "vollbild-count pc-test gruen"; zahl.textContent = "JETZT!"; gruenAb = performance.now(); }, 1500 + Math.random() * 3000); };
    const druck = () => {
      if (v.classList.contains("rot")) { clearTimeout(timer); zahl.textContent = "Zu früh! Nochmal …"; v.className = "vollbild-count pc-test"; setTimeout(warten, 1200); return; }
      if (gruenAb) { const ms = Math.round(performance.now() - gruenAb); gruenAb = 0; runde++; wertDazu(ms, "PC-Test", "PC-Test"); v.className = "vollbild-count pc-test"; zahl.textContent = ms + " ms"; if (runde >= runden) { setTimeout(() => { zahl.textContent = "Fertig – " + runden + " Werte gespeichert"; setTimeout(zu, 1400); }, 900); } else setTimeout(warten, 1200); return; }
      if (!v.classList.contains("rot") && !v.classList.contains("gruen") && runde === 0 && zahl.textContent === "Klick zum Starten") warten();
    };
    const taste = (e) => { if (e.key === "Escape") { e.preventDefault(); zu(); } else if (e.key === " " || e.key === "Enter") { e.preventDefault(); druck(); } };
    v.addEventListener("pointerdown", druck); document.addEventListener("keydown", taste, true);
  }
  function tabelle(trenn) {
    const nummer = new Map(); const zeilen = [["Proband", "Versuch", "Wert", "Code-Version", "Datum", "Uhrzeit"]];
    for (const w of M.werte) { const n = (nummer.get(w.p) || 0) + 1; nummer.set(w.p, n); const d = new Date(w.zeit); zeilen.push([(proband(w.p) || {}).name || "Proband " + w.p, n, zahlDe(w.wert), w.version, d.toLocaleDateString("de-DE"), d.toLocaleTimeString("de-DE")]); }
    return zeilen.map(z => z.map(x => /[";\t\n]/.test(String(x)) ? '"' + String(x).replace(/"/g, '""') + '"' : x).join(trenn)).join("\r\n");
  }
  const csv = () => "﻿" + tabelle(";") + "\r\n";

  /* ---------- Unterrichts-Modus ---------- */
  function unterrichtSetzen(an) {
    P.unterricht.an = an; sichern();
    document.body.classList.toggle("unterricht", an);
    $("#vorlagenBox").hidden = an;
    $("#statusUnterricht").hidden = !an;
    A.ed.neuPruefen(); zeigen();
  }
  const zusatz = (code) => P.unterricht.an ? U.pruefen(code, erlaubt) : [];
  const filter = (name) => !P.unterricht.an || !U.istFremd(name, erlaubt);
  function unterrichtDialog() {
    const ue = U.uebersicht(A.ed.wert, erlaubt), fremd = ue.filter(x => !x.ok);
    const d = dialog('<h2>Unterrichts-Modus</h2><p>Wenn er an ist, schlägt der Editor nur Befehle aus dem Unterricht vor, markiert alle anderen gelb und blendet die fertigen Vorlagen aus. Erklärungen zu Fehlern sagen nur, <i>was</i> falsch ist – geschrieben wird nichts für dich.</p>' +
      '<label class="check gross"><input type="checkbox" id="uAn"' + (P.unterricht.an ? " checked" : "") + "> Unterrichts-Modus an</label>" +
      '<h3>Erlaubt (aus der Bauanleitung „Arduino 1“)</h3><div class="u-liste">' + U.GRUNDLISTE.map(n => "<code>" + esc(n) + "</code>").join(" ") + "</div>" +
      '<h3>Von der Lehrkraft zusätzlich erlaubt</h3><p class="leise">Ein Befehl pro Zeile, z. B. <code>millis</code> – nur eintragen, wenn es wirklich erlaubt wurde.</p><textarea id="uExtra" rows="3" class="u-extra">' + esc(P.unterricht.extra.join("\n")) + "</textarea>" +
      "<h3>Dein Code gerade</h3>" + (ue.length ? '<div class="u-liste">' + ue.map(x => '<code class="' + (x.ok ? "" : "fremd") + '">' + esc(x.name) + " ×" + x.anzahl + "</code>").join(" ") + "</div>" + (fremd.length ? '<p class="nein-z">' + fremd.length + " Befehl" + (fremd.length > 1 ? "e" : "") + " nicht auf der Liste.</p>" : '<p class="ok-z">✔ Alles aus der Liste.</p>') : '<p class="leise">Noch keine Befehle.</p>') +
      '<div class="dialog-fuss"><button type="button" class="pill" data-ok>OK</button></div>');
    d.querySelector("[data-ok]").onclick = () => {
      P.unterricht.extra = d.querySelector("#uExtra").value.split(/[\n,;]+/).map(s => s.trim()).filter(s => /^[A-Za-z_][\w.]*$/.test(s));
      erlaubt = U.erlaubteListe(P.unterricht.extra); unterrichtSetzen(d.querySelector("#uAn").checked); d.close(); d.remove();
    };
  }

  /* ---------- Eigenleistungs-Nachweis ---------- */
  const E = P.eigen; let letzteAktion = 0, sitzung = null;
  function sitzungHolen() {
    const jetzt = Date.now();
    if (!sitzung || jetzt - letzteAktion > 10 * 60000) { sitzung = { start: jetzt, ende: jetzt, getippt: 0, geloescht: 0, minuten: 0, eingefuegt: [] }; E.sitzungen.push(sitzung); if (E.sitzungen.length > 300) E.sitzungen.shift(); }
    if (Math.floor(jetzt / 60000) !== Math.floor(letzteAktion / 60000)) sitzung.minuten++;
    letzteAktion = jetzt; sitzung.ende = jetzt; return sitzung;
  }
  let sichernSpaeter = null;
  function beiEingabe(e) {
    if (!E.an || intern) return;
    const s = sitzungHolen(), t = e.inputType || "";
    if (t === "paste" || t === "insertFromDrop") { if (e.text && e.text.length) s.eingefuegt.push({ zeit: Date.now(), laenge: e.text.length, zeilen: e.text.split("\n").length, anfang: e.text.slice(0, 50) }); }
    else if (t === "insertFromPaste") { /* schon beim Einfügen gezählt */ }
    else if (t.startsWith("insert")) s.getippt += (e.data || "").length || 1;
    else if (t.startsWith("delete")) s.geloescht++;
    clearTimeout(sichernSpaeter); sichernSpaeter = setTimeout(sichern, 1500);
  }
  function still(f) { intern = true; try { f(); } finally { intern = false; } }
  function eigenBericht() {
    const S = E.sitzungen, sum = (k) => S.reduce((a, s) => a + (typeof s[k] === "number" ? s[k] : s[k].length), 0), ein = S.flatMap(s => s.eingefuegt);
    let t = "Eigenleistungs-Nachweis – " + P.name + "\nAufgezeichnet von Kometenwerk Code (nur auf diesem Computer)\n\n";
    t += "Arbeitssitzungen: " + S.length + "\nAktive Minuten am Code: " + sum("minuten") + "\nGetippte Zeichen: " + sum("getippt") + "\nLöschvorgänge: " + sum("geloescht") + "\nEingefügte Stellen (Strg+V): " + ein.length + " (" + ein.reduce((a, x) => a + x.laenge, 0) + " Zeichen)\n\n";
    t += "Sitzungen:\n" + S.map(s => "- " + datumZeit(s.start) + " bis " + new Date(s.ende).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + ": " + s.minuten + " min aktiv, " + s.getippt + " Zeichen getippt" + (s.eingefuegt.length ? ", " + s.eingefuegt.length + "× eingefügt" : "")).join("\n") + "\n";
    if (ein.length) t += "\nEingefügt:\n" + ein.map(x => "- " + datumZeit(x.zeit) + ": " + x.laenge + " Zeichen, " + x.zeilen + " Zeile(n), beginnt mit „" + x.anfang.replace(/\s+/g, " ") + "“").join("\n") + "\n";
    t += "\nHinweis: Das ist ein Protokoll der Eingaben, kein Beweis. Kopieren aus der eigenen älteren Version wird auch als „eingefügt“ gezählt.\n";
    return t;
  }
  function eigenDialog() {
    const d = dialog('<h2>Eigenleistungs-Nachweis</h2><p>Wenn du ihn einschaltest, merkt sich das Programm <b>nur auf diesem Computer</b>, wann du am Code gearbeitet hast, wie viel du selbst getippt hast und wann etwas eingefügt wurde (Strg+V). So kannst du zeigen, dass du dein Programm selbst geschrieben hast. Nichts wird verschickt.</p>' +
      '<label class="check gross"><input type="checkbox" id="eAn"' + (E.an ? " checked" : "") + "> Eigenleistungs-Nachweis an</label>" +
      '<pre class="v-code">' + esc(E.sitzungen.length ? eigenBericht() : "Noch nichts aufgezeichnet.") + "</pre>" +
      '<div class="dialog-fuss links"><button type="button" class="pill hell klein" data-a="txt">ALS TEXT SPEICHERN</button><button type="button" class="pill hell klein rot" data-a="leer">AUFZEICHNUNG LÖSCHEN</button><span class="sp"></span><button type="button" class="pill" data-a="ok">OK</button></div>', "gross");
    d.querySelector('[data-a="ok"]').onclick = () => { E.an = d.querySelector("#eAn").checked; sichern(); zeigen(); d.close(); d.remove(); };
    d.querySelector('[data-a="txt"]').onclick = async () => { if (!A.KC) return; const z = await A.KC.exportSpeichern({ name: dateiTeil(P.name) + "_Eigenleistung.txt", art: "txt", text: eigenBericht() }); if (z) A.toast("Gespeichert: " + z); };
    d.querySelector('[data-a="leer"]').onclick = () => { if (!confirm("Die ganze Aufzeichnung löschen?")) return; E.sitzungen = []; sitzung = null; sichern(); d.close(); d.remove(); eigenDialog(); };
  }

  /* ---------- Zeichnungen ---------- */
  function zeichnen(modus) {
    Zei.oeffnen(modus, P.zeichnungen[modus], { name: P.name, KC: A.KC, toast: A.toast, code: () => A.ed.wert, speichern: (z) => { P.zeichnungen[modus] = z; sichern(); zeigen(); } });
  }

  /* ---------- Folien für die Präsentation in FIDELIA Notizen ---------- */
  // Bringt nur Bausteine rüber (Zeichnungen und die Messwert-Tabelle). Den Text der Präsentation schreibst du selbst.
  async function folienNachNotizen() {
    if (!A.KC || !A.KC.anNotizen) { A.toast("Geht erst mit der neuesten Version."); return; }
    const bilder = [];
    for (const [m, titel] of [["schaltplan", "Schaltplan"], ["fluss", "Flussdiagramm"], ["bauplan", "Technische Zeichnung"]]) {
      const z = P.zeichnungen[m]; if (!z || !z.el || !z.el.length) continue;
      try { bilder.push({ titel, bild: "data:image/png;base64," + await Zei.pngAusSvg(Zei.svgText(m, z), 1800) }); } catch (e) {}
    }
    let tabelle = null;
    if (M.werte.length) {
      const pr = M.probanden.filter(p => M.werte.some(w => w.p === p.nr)), spalten = pr.map(p => M.werte.filter(w => w.p === p.nr).map(w => zahlDe(w.wert)));
      const n = Math.max(...spalten.map(c => c.length));
      tabelle = [["Versuch", ...pr.map(p => p.name)], ...Array.from({ length: n }, (_, i) => [String(i + 1), ...spalten.map(c => c[i] || "")])];
    }
    if (!bilder.length && !tabelle) { A.toast("Es gibt noch keine Zeichnungen oder Messwerte."); return; }
    const r = await A.KC.anNotizen({ art: "folien", name: P.name, gruppe: P.gruppe.join(", "), bilder, tabelle, fach: "NWT" });
    if (r && r.ok) A.toast("FIDELIA Notizen öffnet sich und legt eine Präsentation mit " + bilder.length + " Zeichnung(en)" + (tabelle ? " und der Messwert-Tabelle" : "") + " an. Den Text schreibst du selbst.", 9000);
  }

  /* ---------- Abgabe-Paket ---------- */
  async function abgabe() {
    if (!A.KC) { A.toast("Das Abgabe-Paket geht nur im PC-Programm."); return; }
    const wurzel = dateiTeil(P.name) + "/", dateien = [], liste = [];
    const sk = dateiTeil(A.Z.name || "sketch");
    dateien.push({ name: wurzel + "Code/aktuell_" + sk + "/aktuell_" + sk + ".ino", inhalt: A.ed.wert });
    for (const v of P.versionen) { const n = "V" + v.nr + "_" + dateiTeil(v.titel); dateien.push({ name: wurzel + "Code/" + n + "/" + n + ".ino", inhalt: v.code }); liste.push("V" + v.nr + "  " + datumZeit(v.zeit) + "  " + v.titel + (v.wer && v.wer.length ? "  [" + v.wer.join(", ") + "]" : "") + (v.notiz ? "\n     " + v.notiz.replace(/\n/g, "\n     ") : "")); }
    dateien.push({ name: wurzel + "Code/Versionen.txt", inhalt: "Programm-Versionen – " + P.name + "\n\n" + (liste.join("\n") || "(keine Versionen gespeichert)") + "\n" });
    if (M.werte.length) dateien.push({ name: wurzel + "Messwerte/Messwerte.csv", inhalt: csv() });
    for (const [modus, titel] of [["schaltplan", "Schaltplan"], ["fluss", "Flussdiagramm"], ["bauplan", "Technische_Zeichnung"]]) {
      const z = P.zeichnungen[modus]; if (!z || !z.el || !z.el.length) continue;
      const svg = Zei.svgText(modus, z); dateien.push({ name: wurzel + "Zeichnungen/" + titel + ".svg", inhalt: svg });
      try { const b = atob(await Zei.pngAusSvg(svg, modus === "bauplan" ? 3508 : 2400)); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); dateien.push({ name: wurzel + "Zeichnungen/" + titel + ".png", inhalt: u }); } catch (e) {}
    }
    if (E.sitzungen.length) dateien.push({ name: wurzel + "Eigenleistung.txt", inhalt: eigenBericht() });
    if (P.tagebuch.length) dateien.push({ name: wurzel + "Tagebuch.txt", inhalt: tagebuchText() });
    if (P.fehler.some(f => f.notiz)) dateien.push({ name: wurzel + "Fehler-Sammlung.txt", inhalt: fehlerText() });
    if (P.teile.some(t => String(t.name).trim())) dateien.push({ name: wurzel + "Teileliste.csv", inhalt: teileCsv() });
    dateien.push({ name: wurzel + "Checkliste.txt", inhalt: "Protokoll-Checkliste – " + P.name + "\n\n" + CHECKLISTE.map(([k, t]) => (P.checkliste[k] ? "[x] " : "[ ] ") + t).join("\n") + "\n\nDas Protokoll selbst ist handschriftlich.\n" });
    const ziel = await A.KC.exportSpeichern({ name: dateiTeil(P.name) + "_Abgabe_" + new Date().toISOString().slice(0, 10) + ".zip", art: "zip", base64: base64(zip(dateien)) });
    if (ziel) A.toast("Abgabe-Paket gespeichert (" + dateien.length + " Dateien): " + ziel, 8000);
  }

  /* ---------- Seitenleiste „NWT-Projekt“ ---------- */
  function zeigen() {
    const s = $("#projektInhalt"); if (!s) return;
    const V = P.versionen, Z = P.zeichnungen, teile = (m) => (Z[m] && Z[m].el && Z[m].el.length) || 0, fertig = CHECKLISTE.filter(([k]) => P.checkliste[k]).length;
    s.innerHTML = '<input class="suchfeld" id="pName" value="' + esc(P.name) + '" aria-label="Projektname" title="Projektname">' +
      '<h3>GRUPPE</h3><button type="button" class="p-knopf" id="pGruppe">👥 ' + (P.gruppe.length ? esc(P.gruppe.join(", ")) : "Namen eintragen") + '<small class="leise">' + (P.ich ? "ich: " + esc(P.ich) : "") + '</small></button><div class="such-knoepfe"><button type="button" class="pill hell klein" id="pTeilen" title="Alles in eine Datei für die Gruppe">PROJEKT TEILEN</button><button type="button" class="pill hell klein" id="pHolen" title="Datei von der Gruppe dazunehmen">VON GRUPPE LADEN</button></div>' +
      '<h3>GRUPPE</h3><button type="button" class="p-knopf" id="pGruppe">👥 ' + (P.gruppe.length ? esc(P.gruppe.join(", ")) : "Namen eintragen") + '<small class="leise">' + (P.ich ? "ich: " + esc(P.ich) : "") + '</small></button><div class="such-knoepfe"><button type="button" class="pill hell klein" id="pTeilen" title="Alles in eine Datei für die Gruppe">PROJEKT TEILEN</button><button type="button" class="pill hell klein" id="pHolen" title="Datei von der Gruppe dazunehmen">VON GRUPPE LADEN</button></div>' +
      '<h3>VERSIONEN <small class="leise">· jetzt: ' + esc(aktuelleVersion()) + "</small></h3>" +
      '<ul class="liste">' + (V.length ? V.slice().reverse().slice(0, 30).map((v, j) => '<li><button type="button" data-v="' + (V.length - 1 - j) + '"><b>V' + v.nr + "</b> " + esc(v.titel) + '<small class="leise"> · ' + new Date(v.zeit).toLocaleDateString("de-DE") + "</small></button></li>").join("") : '<li class="leise">Noch keine Version.</li>') + "</ul>" +
      '<div class="such-knoepfe"><button type="button" class="pill klein" id="pVers">VERSION SPEICHERN</button>' + (V.length ? '<button type="button" class="pill hell klein" id="pVgl">VERGLEICHEN</button>' : "") + "</div>" +
      '<h3>MESSWERTE</h3><p class="p-zeile">' + (M.werte.length ? M.werte.length + " Werte · " + M.probanden.length + " Proband" + (M.probanden.length === 1 ? "" : "en") : '<span class="leise">noch keine</span>') + ' <button type="button" class="pill hell klein" id="pMess">ÖFFNEN</button></p>' +
      '<h3>TAGEBUCH UND TEILE</h3><button type="button" class="p-knopf" id="pTb">📒 Tagebuch<small class="leise">' + (P.tagebuch.length ? P.tagebuch.length + " Einträge" : "leer") + '</small></button><button type="button" class="p-knopf" id="pTeile">🧩 Teileliste<small class="leise">' + (P.teile.length ? P.teile.length + " Teile" : "leer") + "</small></button>" +
      '<h3>LERNEN</h3><button type="button" class="p-knopf" id="pLex">📚 Befehls-Lexikon<small class="leise"></small></button><button type="button" class="p-knopf" id="pFehler">🐞 Fehler-Sammlung<small class="leise">' + (P.fehler.length || "leer") + "</small></button>" +
      "<h3>ZEICHNEN</h3>" + [["schaltplan", "🔌 Schaltplan"], ["fluss", "🔀 Flussdiagramm"], ["bauplan", "📐 Technische Zeichnung"]].map(([m, t]) => '<button type="button" class="p-knopf" data-z="' + m + '">' + t + '<small class="leise">' + (teile(m) ? teile(m) + " Teile" : "leer") + "</small></button>").join("") +
      '<h3>FAIR ARBEITEN</h3><button type="button" class="p-knopf" id="pUnt">🏫 Unterrichts-Modus<small class="' + (P.unterricht.an ? "ok-z" : "leise") + '">' + (P.unterricht.an ? "an" : "aus") + '</small></button><button type="button" class="p-knopf" id="pEig">✍️ Eigenleistungs-Nachweis<small class="' + (E.an ? "ok-z" : "leise") + '">' + (E.an ? "an" : "aus") + "</small></button>" +
      '<h3>PROTOKOLL <small class="leise">· ' + fertig + "/" + CHECKLISTE.length + '</small></h3><div class="p-check">' + CHECKLISTE.map(([k, t, ak]) => '<label><input type="checkbox" data-c="' + k + '"' + (P.checkliste[k] ? " checked" : "") + "><span>" + esc(t) + "</span>" + (ak ? '<button type="button" class="symbol klein" data-ak="' + ak + '" title="Öffnen" aria-label="' + esc(t) + ' öffnen">↗</button>' : "") + "</label>").join("") + '</div><p class="leise">Das Protokoll schreibst du von Hand – das Programm hakt nur ab.</p>' +
      '<div class="panel-fuss"><button type="button" class="pill" id="pZip">ABGABE-PAKET (ZIP)</button><button type="button" class="pill hell" id="pFolien" title="Zeichnungen und Messwert-Tabelle als Folien in FIDELIA Notizen">🎤 FOLIEN IN NOTIZEN</button></div>' +
      '<h3>SICHERUNG</h3><p class="leise">Alle 5 Minuten automatisch in Dokumente › Kometenwerk Code › Sicherung.</p><div class="such-knoepfe"><button type="button" class="pill hell klein" id="pSichJetzt">JETZT SICHERN</button><button type="button" class="pill hell klein" id="pSichLaden">LADEN …</button><button type="button" class="pill hell klein" id="pSichOrdner">ORDNER</button></div>';
    s.querySelector("#pName").onchange = (e) => { P.name = e.target.value.trim() || "Projekt"; sichern(); };
    s.querySelectorAll("[data-v]").forEach(b => b.onclick = () => versionMenue(Number(b.dataset.v)));
    s.querySelector("#pVers").onclick = versionSpeichern;
    const vg = s.querySelector("#pVgl"); if (vg) vg.onclick = () => vergleichen(V.length - 1, -1);
    s.querySelector("#pMess").onclick = () => A.messwerteAuf();
    s.querySelectorAll("[data-z]").forEach(b => b.onclick = () => zeichnen(b.dataset.z));
    s.querySelector("#pUnt").onclick = unterrichtDialog; s.querySelector("#pEig").onclick = eigenDialog;
    s.querySelectorAll("[data-c]").forEach(c => c.onchange = () => { P.checkliste[c.dataset.c] = c.checked; sichern(); zeigen(); });
    s.querySelectorAll("[data-ak]").forEach(b => b.onclick = (e) => { e.preventDefault(); AKTIONEN[b.dataset.ak](); });
    s.querySelector("#pZip").onclick = abgabe; s.querySelector("#pFolien").onclick = folienNachNotizen;
    s.querySelector("#pGruppe").onclick = gruppeDialog; s.querySelector("#pTeilen").onclick = projektTeilen; s.querySelector("#pHolen").onclick = projektZusammenfuehren;
    s.querySelector("#pTb").onclick = tagebuchDialog;
    s.querySelector("#pLex").onclick = lexikon; s.querySelector("#pFehler").onclick = fehlerDialog; s.querySelector("#pTeile").onclick = teileDialog;
    s.querySelector("#pSichJetzt").onclick = () => sicherungJetzt(true); s.querySelector("#pSichLaden").onclick = sicherungLaden; s.querySelector("#pSichOrdner").onclick = () => A.KC.sicherungZeigen();
  }
  function dialog(html, gross) { const d = document.createElement("dialog"); d.className = "dialog" + (gross ? " gross" : ""); d.innerHTML = html; document.body.appendChild(d); d.showModal(); d.addEventListener("close", () => setTimeout(() => d.remove(), 0)); return d; }

  const AKTIONEN = {
    versionNeu: versionSpeichern, "p:versionen": () => { A.panelAuf("projekt"); if (P.versionen.length) vergleichen(P.versionen.length - 1, -1); },
    "p:messwerte": () => A.messwerteAuf(), "z:schaltplan": () => zeichnen("schaltplan"), "z:fluss": () => zeichnen("fluss"), "z:bauplan": () => zeichnen("bauplan"),
    "p:unterricht": unterrichtDialog, "p:lexikon": lexikon, "p:fehler": fehlerDialog, "p:teilen": projektTeilen, "p:holen": projektZusammenfuehren, "p:tagebuch": tagebuchNeu, "p:teile": teileDialog, "p:eigen": eigenDialog, "p:checkliste": () => A.panelAuf("projekt"), abgabe
  };
  unterrichtSetzen(P.unterricht.an);
  zeigen(); messZeigen();
  return { AKTIONEN, fehlerMerken, zusatz, filter, beiEingabe, still, monZeile, zeigen, messZeigen, aktuelleVersion, diff, get P() { return P; } };
}
