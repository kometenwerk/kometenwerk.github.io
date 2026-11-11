// Kometenwerk Code · NWT-Projekt: Versionen, Messwerte, Unterrichts-Modus, Eigenleistungs-Nachweis,
// Zeichnungen, Protokoll-Checkliste und Abgabe-Paket. Alles bleibt auf diesem Computer.
// Fair: Das Programm schreibt keinen Code, wertet keine Messwerte aus und schreibt kein Protokoll.
import * as U from "./unterricht.js";
import * as Zei from "./zeichnen.js";
import { zip, base64 } from "./zip.js";

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const laden = (k, v) => { try { const x = localStorage.getItem(k); return x == null ? v : JSON.parse(x); } catch (e) { return v; } };
const datumZeit = (t) => new Date(t).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const dateiTeil = (t) => (String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "") || "x").slice(0, 40);

export const CHECKLISTE = [
  ["titel", "Titelseite"], ["inhalt", "Inhaltsübersicht"], ["einleitung", "Einleitung (Aufgabe und Ziel)"],
  ["bau", "Entwurf und Bau (Teile, Aufbau)"], ["zeichnung", "Technische Zeichnung der Deckplatte", "z:bauplan"],
  ["schaltplan", "Schaltplan", "z:schaltplan"], ["fluss", "Flussdiagramm", "z:fluss"],
  ["code", "Programm-Versionen digital abgegeben", "p:versionen"], ["test", "Testergebnisse (Messwerte)", "p:messwerte"],
  ["auswertung", "Auswertung (selbst gerechnet / gezeichnet)"], ["fazit", "Fazit"]
];

export function starten(A) {
  // A: { ed, Z, KC, toast, ausgabeStart, reiter, panelZeigen, untenAuf }
  const P = Object.assign({ name: "Reaktionstester", versionen: [], messwerte: { probanden: [], werte: [], aktiv: 0, filter: "" }, zeichnungen: {}, unterricht: { an: false, extra: [] }, eigen: { an: false, sitzungen: [] }, checkliste: {} }, laden("kc-projekt", {}));
  const sichern = () => { try { localStorage.setItem("kc-projekt", JSON.stringify(P)); } catch (e) { A.toast("Speicher voll – lösch alte Versionen oder exportiere die Messwerte."); } };
  let erlaubt = U.erlaubteListe(P.unterricht.extra), intern = false, aufnahme = false;

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
      '<label class="z-feld breit"><span>Was hast du geändert? (optional)</span><textarea id="vNotiz" rows="3"></textarea></label>' +
      '<div class="dialog-fuss"><button type="button" class="pill hell" data-x>ABBRECHEN</button><button type="button" class="pill" data-ok>SPEICHERN</button></div>');
    d.querySelector("#vName").focus();
    const ok = await new Promise(r => { d.querySelector("[data-ok]").onclick = () => r(true); d.querySelector("[data-x]").onclick = () => r(false); d.onclose = () => r(false); d.querySelector("#vName").onkeydown = (e) => { if (e.key === "Enter") r(true); }; });
    const titel = d.querySelector("#vName").value.trim() || "Version " + nr, notiz = d.querySelector("#vNotiz").value.trim(); d.close(); d.remove();
    if (!ok) return;
    const v = { nr, titel, notiz, zeit: Date.now(), code, sketch: A.Z.name };
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
    const d = dialog("<h2>V" + v.nr + " · " + esc(v.titel) + '</h2><p class="leise">' + datumZeit(v.zeit) + (v.sketch ? " · Sketch „" + esc(v.sketch) + "“" : "") + "</p>" + (v.notiz ? "<p>" + esc(v.notiz) + "</p>" : "") +
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
  function wertDazu(wert, zeile) {
    if (!M.aktiv || !proband(M.aktiv)) probandNeu();
    M.werte.push({ p: M.aktiv, wert, version: aktuelleVersion(), zeit: Date.now(), zeile: zeile ? String(zeile).slice(0, 80) : "" });
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
      '<button type="button" class="pill hell klein" id="mCsv">EXCEL (CSV)</button><button type="button" class="pill hell klein" id="mKopie" title="Zum Einfügen in Excel oder FIDELIA Tabellen">KOPIEREN</button><button type="button" class="pill hell klein" id="mLeer">ALLE LÖSCHEN</button></div>' +
      '<p class="leise mess-info">' + (aufnahme ? "Nimmt aus dem Seriellen Monitor die erste Zahl jeder Zeile auf – für <b>" + esc((proband(M.aktiv) || {}).name || "") + "</b>. Version: " + esc(aktuelleVersion()) + "." : "Starte den Seriellen Monitor und dann die Aufnahme. Jeder Wert bekommt den Probanden und die Code-Version. Auswerten (Mittelwert, Diagramm) machst du selbst.") + "</p>" +
      (tab ? '<table class="mess-tab"><thead><tr><th>Nr.</th><th>Wert</th><th>Version</th><th>Uhrzeit</th><th></th></tr></thead><tbody>' + tab + "</tbody></table>" : '<p class="leise">Noch keine Messwerte.</p>');
    r.querySelector("#mAuf").onclick = async () => { aufnahme = !aufnahme; if (aufnahme) { if (!M.probanden.length) probandNeu(); await A.monitorAn(); } messZeigen(); A.reiterMarke(aufnahme); };
    r.querySelector("#mP").onchange = (e) => { M.aktiv = Number(e.target.value); sichern(); messZeigen(); };
    r.querySelector("#mNeu").onclick = probandNeu;
    r.querySelector("#mFilter").onchange = (e) => { M.filter = e.target.value.trim(); sichern(); };
    r.querySelector("#mHand").onkeydown = (e) => { if (e.key !== "Enter") return; const v = Number(e.target.value.replace(",", ".")); if (e.target.value.trim() === "" || isNaN(v)) { A.toast("Bitte eine Zahl eingeben."); return; } wertDazu(v, "von Hand"); setTimeout(() => $("#mHand") && $("#mHand").focus(), 0); };
    r.querySelector("#mCsv").onclick = async () => { if (!M.werte.length) { A.toast("Noch keine Messwerte."); return; } if (!A.KC) return; const z = await A.KC.exportSpeichern({ name: dateiTeil(P.name) + "_Messwerte.csv", art: "csv", text: csv() }); if (z) A.toast("Gespeichert: " + z); };
    r.querySelector("#mKopie").onclick = async () => { try { await navigator.clipboard.writeText(tabelle("\t")); A.toast("Kopiert – in Excel oder FIDELIA Tabellen einfügen (Strg+V)."); } catch (e) { A.toast("Kopieren ging nicht."); } };
    r.querySelector("#mLeer").onclick = () => { if (!M.werte.length || !confirm("Alle " + M.werte.length + " Messwerte löschen? Exportier sie vorher, wenn du sie noch brauchst.")) return; M.werte = []; sichern(); messZeigen(); zeigen(); };
    r.querySelectorAll("[data-weg]").forEach(b => b.onclick = () => { M.werte.splice(Number(b.dataset.weg), 1); sichern(); messZeigen(); zeigen(); });
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

  /* ---------- Abgabe-Paket ---------- */
  async function abgabe() {
    if (!A.KC) { A.toast("Das Abgabe-Paket geht nur im PC-Programm."); return; }
    const wurzel = dateiTeil(P.name) + "/", dateien = [], liste = [];
    const sk = dateiTeil(A.Z.name || "sketch");
    dateien.push({ name: wurzel + "Code/aktuell_" + sk + "/aktuell_" + sk + ".ino", inhalt: A.ed.wert });
    for (const v of P.versionen) { const n = "V" + v.nr + "_" + dateiTeil(v.titel); dateien.push({ name: wurzel + "Code/" + n + "/" + n + ".ino", inhalt: v.code }); liste.push("V" + v.nr + "  " + datumZeit(v.zeit) + "  " + v.titel + (v.notiz ? "\n     " + v.notiz.replace(/\n/g, "\n     ") : "")); }
    dateien.push({ name: wurzel + "Code/Versionen.txt", inhalt: "Programm-Versionen – " + P.name + "\n\n" + (liste.join("\n") || "(keine Versionen gespeichert)") + "\n" });
    if (M.werte.length) dateien.push({ name: wurzel + "Messwerte/Messwerte.csv", inhalt: csv() });
    for (const [modus, titel] of [["schaltplan", "Schaltplan"], ["fluss", "Flussdiagramm"], ["bauplan", "Technische_Zeichnung"]]) {
      const z = P.zeichnungen[modus]; if (!z || !z.el || !z.el.length) continue;
      const svg = Zei.svgText(modus, z); dateien.push({ name: wurzel + "Zeichnungen/" + titel + ".svg", inhalt: svg });
      try { const b = atob(await Zei.pngAusSvg(svg, modus === "bauplan" ? 3508 : 2400)); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); dateien.push({ name: wurzel + "Zeichnungen/" + titel + ".png", inhalt: u }); } catch (e) {}
    }
    if (E.sitzungen.length) dateien.push({ name: wurzel + "Eigenleistung.txt", inhalt: eigenBericht() });
    dateien.push({ name: wurzel + "Checkliste.txt", inhalt: "Protokoll-Checkliste – " + P.name + "\n\n" + CHECKLISTE.map(([k, t]) => (P.checkliste[k] ? "[x] " : "[ ] ") + t).join("\n") + "\n\nDas Protokoll selbst ist handschriftlich.\n" });
    const ziel = await A.KC.exportSpeichern({ name: dateiTeil(P.name) + "_Abgabe_" + new Date().toISOString().slice(0, 10) + ".zip", art: "zip", base64: base64(zip(dateien)) });
    if (ziel) A.toast("Abgabe-Paket gespeichert (" + dateien.length + " Dateien): " + ziel, 8000);
  }

  /* ---------- Seitenleiste „NWT-Projekt“ ---------- */
  function zeigen() {
    const s = $("#projektInhalt"); if (!s) return;
    const V = P.versionen, Z = P.zeichnungen, teile = (m) => (Z[m] && Z[m].el && Z[m].el.length) || 0, fertig = CHECKLISTE.filter(([k]) => P.checkliste[k]).length;
    s.innerHTML = '<input class="suchfeld" id="pName" value="' + esc(P.name) + '" aria-label="Projektname" title="Projektname">' +
      '<h3>VERSIONEN <small class="leise">· jetzt: ' + esc(aktuelleVersion()) + "</small></h3>" +
      '<ul class="liste">' + (V.length ? V.slice().reverse().slice(0, 30).map((v, j) => '<li><button type="button" data-v="' + (V.length - 1 - j) + '"><b>V' + v.nr + "</b> " + esc(v.titel) + '<small class="leise"> · ' + new Date(v.zeit).toLocaleDateString("de-DE") + "</small></button></li>").join("") : '<li class="leise">Noch keine Version.</li>') + "</ul>" +
      '<div class="such-knoepfe"><button type="button" class="pill klein" id="pVers">VERSION SPEICHERN</button>' + (V.length ? '<button type="button" class="pill hell klein" id="pVgl">VERGLEICHEN</button>' : "") + "</div>" +
      '<h3>MESSWERTE</h3><p class="p-zeile">' + (M.werte.length ? M.werte.length + " Werte · " + M.probanden.length + " Proband" + (M.probanden.length === 1 ? "" : "en") : '<span class="leise">noch keine</span>') + ' <button type="button" class="pill hell klein" id="pMess">ÖFFNEN</button></p>' +
      "<h3>ZEICHNEN</h3>" + [["schaltplan", "🔌 Schaltplan"], ["fluss", "🔀 Flussdiagramm"], ["bauplan", "📐 Technische Zeichnung"]].map(([m, t]) => '<button type="button" class="p-knopf" data-z="' + m + '">' + t + '<small class="leise">' + (teile(m) ? teile(m) + " Teile" : "leer") + "</small></button>").join("") +
      '<h3>FAIR ARBEITEN</h3><button type="button" class="p-knopf" id="pUnt">🏫 Unterrichts-Modus<small class="' + (P.unterricht.an ? "ok-z" : "leise") + '">' + (P.unterricht.an ? "an" : "aus") + '</small></button><button type="button" class="p-knopf" id="pEig">✍️ Eigenleistungs-Nachweis<small class="' + (E.an ? "ok-z" : "leise") + '">' + (E.an ? "an" : "aus") + "</small></button>" +
      '<h3>PROTOKOLL <small class="leise">· ' + fertig + "/" + CHECKLISTE.length + '</small></h3><div class="p-check">' + CHECKLISTE.map(([k, t, ak]) => '<label><input type="checkbox" data-c="' + k + '"' + (P.checkliste[k] ? " checked" : "") + "><span>" + esc(t) + "</span>" + (ak ? '<button type="button" class="symbol klein" data-ak="' + ak + '" title="Öffnen" aria-label="' + esc(t) + ' öffnen">↗</button>' : "") + "</label>").join("") + '</div><p class="leise">Das Protokoll schreibst du von Hand – das Programm hakt nur ab.</p>' +
      '<div class="panel-fuss"><button type="button" class="pill" id="pZip">ABGABE-PAKET (ZIP)</button></div>';
    s.querySelector("#pName").onchange = (e) => { P.name = e.target.value.trim() || "Projekt"; sichern(); };
    s.querySelectorAll("[data-v]").forEach(b => b.onclick = () => versionMenue(Number(b.dataset.v)));
    s.querySelector("#pVers").onclick = versionSpeichern;
    const vg = s.querySelector("#pVgl"); if (vg) vg.onclick = () => vergleichen(V.length - 1, -1);
    s.querySelector("#pMess").onclick = () => A.messwerteAuf();
    s.querySelectorAll("[data-z]").forEach(b => b.onclick = () => zeichnen(b.dataset.z));
    s.querySelector("#pUnt").onclick = unterrichtDialog; s.querySelector("#pEig").onclick = eigenDialog;
    s.querySelectorAll("[data-c]").forEach(c => c.onchange = () => { P.checkliste[c.dataset.c] = c.checked; sichern(); zeigen(); });
    s.querySelectorAll("[data-ak]").forEach(b => b.onclick = (e) => { e.preventDefault(); AKTIONEN[b.dataset.ak](); });
    s.querySelector("#pZip").onclick = abgabe;
  }
  function dialog(html, gross) { const d = document.createElement("dialog"); d.className = "dialog" + (gross ? " gross" : ""); d.innerHTML = html; document.body.appendChild(d); d.showModal(); d.addEventListener("close", () => setTimeout(() => d.remove(), 0)); return d; }

  const AKTIONEN = {
    versionNeu: versionSpeichern, "p:versionen": () => { A.panelAuf("projekt"); if (P.versionen.length) vergleichen(P.versionen.length - 1, -1); },
    "p:messwerte": () => A.messwerteAuf(), "z:schaltplan": () => zeichnen("schaltplan"), "z:fluss": () => zeichnen("fluss"), "z:bauplan": () => zeichnen("bauplan"),
    "p:unterricht": unterrichtDialog, "p:eigen": eigenDialog, "p:checkliste": () => A.panelAuf("projekt"), abgabe
  };
  unterrichtSetzen(P.unterricht.an);
  zeigen(); messZeigen();
  return { AKTIONEN, zusatz, filter, beiEingabe, still, monZeile, zeigen, messZeigen, aktuelleVersion, diff, get P() { return P; } };
}
