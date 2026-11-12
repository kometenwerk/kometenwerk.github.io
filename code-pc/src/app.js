// Kometenwerk Code · Oberfläche (Aufbau wie eine Arduino-Umgebung)
import * as C from "./code-kern.js";
import * as U from "./uebersetzer.js";
import { editor } from "./editor.js";
import { starten as nwtStarten } from "./nwt.js";

const KC = window.KC || null;      // Brücke zum Hauptprozess (fehlt nur beim Testen im Browser)
const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const laden = (k, v) => { try { const x = localStorage.getItem(k); return x == null ? v : JSON.parse(x); } catch (e) { return v; } };
const sichern = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
function toast(t, dauer = 4500) { const d = document.createElement("div"); d.textContent = t; $("#toasts").appendChild(d); setTimeout(() => d.remove(), dauer); while ($("#toasts").children.length > 3) $("#toasts").firstChild.remove(); }
const boardName = (fqbn) => (U.BOARDS.find(b => b[0] === fqbn) || [, fqbn])[1];

/* ---------- Zustand ---------- */
const Z = Object.assign({ name: "sketch", pfad: null, board: "", port: "", schrift: 14, baud: "9600", panel: "sketchbook" }, laden("kc-zustand", {}));
let gespeichert = true, beschaeftigt = false, monitorAn = false, avrBereit = true, ports = [];
const zustandMerken = () => sichern("kc-zustand", { name: Z.name, pfad: Z.pfad, board: Z.board, port: Z.port, schrift: Z.schrift, baud: Z.baud, panel: Z.panel });

let N = null;      // NWT-Projekt (wird gleich unten gestartet)
const ed = editor($("#ed"), {
  wert: laden("kc-entwurf", C.LEER), schrift: Z.schrift,
  zusatz: (c) => N ? N.zusatz(c) : [], filter: (n) => N ? N.filter(n) : true, beiEingabe: (e) => N && N.beiEingabe(e),
  beiAenderung: (code) => { sichern("kc-entwurf", code); geaendertSetzen(false); },
  beiCursor: ({ z, sp, erklaerung, meldungen }) => {
    $("#status").textContent = "Zeile " + z + ", Spalte " + sp;
    $("#hilfe").innerHTML = meldungen.length ? meldungen.map(m => '<span class="' + m.art + '">' + (m.art === "fehler" ? "✖ " : "⚠ ") + esc(m.text) + (m.tipp ? " <small>" + esc(m.tipp) + "</small>" : "") + "</span>").join(" · ")
      : erklaerung ? "<code>" + esc(erklaerung.aufbau) + "</code> – " + esc(erklaerung.info) : "";
  }
});
function geaendertSetzen(ok) { gespeichert = ok; $("#geaendert").hidden = ok; $("#dateiName").textContent = Z.name + ".ino"; document.title = Z.name + " | Kometenwerk Code"; }
geaendertSetzen(!!Z.pfad || ed.wert === C.LEER);

/* ---------- Seitenleiste ---------- */
function panelZeigen(name) {
  const gleich = Z.panel === name && !$("#panel").hidden;
  Z.panel = gleich ? "" : name; zustandMerken();
  $("#panel").hidden = !Z.panel;
  document.querySelectorAll("[data-panel]").forEach(b => b.classList.toggle("an", b.dataset.panel === Z.panel));
  document.querySelectorAll("[data-inhalt]").forEach(s => { s.hidden = s.dataset.inhalt !== Z.panel; });
  if (Z.panel === "sketchbook") sketcheZeigen();
  if (Z.panel === "bibliotheken") setTimeout(() => $("#bibQ").focus(), 30);
  if (Z.panel === "suchen") setTimeout(() => $("#suchQ").focus(), 30);
  if (Z.panel === "projekt" && N) N.zeigen();
}
document.querySelectorAll("[data-panel]").forEach(b => b.onclick = () => panelZeigen(b.dataset.panel));
{ const p = Z.panel; Z.panel = ""; if (p) panelZeigen(p); else $("#panel").hidden = true; }

/* ---------- Board und Port ---------- */
function boardAnzeigen() {
  const p = ports.find(x => x.adresse === Z.port);
  $("#boardText").textContent = Z.board ? boardName(Z.board) + (Z.port ? "  ·  " + Z.port : "") : Z.port ? (p && p.board ? p.board : "Unbekannt") + "  ·  " + Z.port : "Board auswählen";
  $("#boardUsb").hidden = !Z.port;
  const keinArduino = Z.port && ports.length && p && !p.board;
  $("#statusBoard").textContent = Z.board ? boardName(Z.board) + (Z.port ? " an " + Z.port + (keinArduino ? " (dort ist kein Arduino erkannt)" : "") : " [nicht verbunden]") : "Kein Board ausgewählt";
}
// Name eines Ports für die Liste: nur „Arduino …“, wenn dort wirklich einer erkannt wurde
const geraetName = (p) => p.geraet && p.geraet !== p.adresse ? p.geraet.replace(/\s*\(COM\d+\)/, "") : "";
const portName = (p) => p.board ? p.board : geraetName(p) || "Kein Arduino erkannt";
async function portsSuchen(still) {
  if (!KC) return {};
  const r = await KC.ports(); ports = r.liste || [];
  if (ports.length && !ports.some(p => p.adresse === Z.port)) Z.port = ports[0].adresse;
  // Ist am gewählten Port kein Arduino, aber an einem anderen schon? Dann den nehmen.
  const jetzt = ports.find(p => p.adresse === Z.port), arduinos = ports.filter(p => p.board);
  if (jetzt && !jetzt.board && arduinos.length === 1) { Z.port = arduinos[0].adresse; if (!still) toast("Arduino gefunden an " + Z.port); }
  if (!ports.length) Z.port = "";
  const erkannt = ports.find(p => p.adresse === Z.port && p.fqbn);
  if (erkannt && U.BOARDS.some(b => b[0] === erkannt.fqbn) && erkannt.fqbn !== Z.board) { Z.board = erkannt.fqbn; if (!still) toast("Erkannt: " + erkannt.board + " an " + erkannt.adresse); }
  zustandMerken(); boardAnzeigen();
  if (!ports.length && !still) hilfeKeinArduino(r);
  return r;
}
// kleines Menü unter „Board auswählen“
$("#bBoard").onclick = async () => {
  const l = $("#boardListe");
  if (!l.hidden) { l.hidden = true; return; }
  await portsSuchen(true);
  const mit = ports.filter(p => p.board), ohne = ports.filter(p => !p.board);
  const knopf = (p) => '<button type="button" data-port="' + esc(p.adresse) + '" class="' + (p.adresse === Z.port ? "an " : "") + (p.board ? "" : "fremd") + '"><span>' + (p.board ? "✔ " : "") + esc(portName(p)) + "</span><small>" + esc(p.adresse) + (p.board && geraetName(p) ? " · " + esc(geraetName(p)) : "") + "</small></button>";
  l.innerHTML = (mit.length ? mit.map(knopf).join("") : '<button type="button" disabled><span>Kein Arduino gefunden</span><small>Steck den Arduino per USB an und warte kurz.</small></button>') +
    (ohne.length ? '<div class="liste-titel">Andere Anschlüsse (kein Arduino)</div>' + ohne.map(knopf).join("") : "") +
    '<hr><button type="button" data-anderes="1"><span>Anderes Board und Port wählen …</span></button>';
  l.hidden = false; $("#bBoard").setAttribute("aria-expanded", "true");
  l.querySelectorAll("[data-port]").forEach(b => b.onclick = () => { Z.port = b.dataset.port; const p = ports.find(x => x.adresse === Z.port); if (p && p.fqbn) Z.board = p.fqbn; l.hidden = true; if (!Z.board) { boardDialog(); return; } zustandMerken(); boardAnzeigen(); });
  l.querySelector("[data-anderes]").onclick = () => { l.hidden = true; boardDialog(); };
};
document.addEventListener("pointerdown", (e) => {
  if (!e.target.closest("#boardListe, #bBoard")) { $("#boardListe").hidden = true; $("#bBoard").setAttribute("aria-expanded", "false"); }
  if (!e.target.closest("#tabMenue, #bTabMenue")) $("#tabMenue").hidden = true;
});
function boardDialog() {
  const d = $("#dBoard"); let wahlB = Z.board || "arduino:avr:uno", wahlP = Z.port;
  const zeichnen = () => {
    const q = $("#dBoardQ").value.toLowerCase();
    $("#dBoards").innerHTML = U.BOARDS.filter(b => b[1].toLowerCase().includes(q)).map(b => '<li><button type="button" data-b="' + b[0] + '" class="' + (b[0] === wahlB ? "an" : "") + '">' + esc(b[1]) + "</button></li>").join("");
    $("#dPorts").innerHTML = ports.length ? ports.map(p => '<li><button type="button" data-p="' + esc(p.adresse) + '" class="' + (p.adresse === wahlP ? "an" : "") + '">' + esc(p.adresse) + " · " + (p.board ? "✔ " : "") + esc(portName(p)) + "</button></li>").join("") : '<li class="leise">Kein Port gefunden. Arduino per USB anstecken und „Neu suchen“.</li>';
    $("#dBoards").querySelectorAll("[data-b]").forEach(b => b.onclick = () => { wahlB = b.dataset.b; zeichnen(); });
    $("#dPorts").querySelectorAll("[data-p]").forEach(b => b.onclick = () => { wahlP = b.dataset.p; zeichnen(); });
  };
  $("#dBoardQ").value = ""; $("#dBoardQ").oninput = zeichnen;
  $("#dNeu").onclick = async () => { await portsSuchen(true); if (!wahlP && ports[0]) wahlP = ports[0].adresse; zeichnen(); };
  $("#dAbbr").onclick = () => d.close();
  $("#dOk").onclick = () => { Z.board = wahlB; Z.port = wahlP || ""; zustandMerken(); boardAnzeigen(); d.close(); };
  zeichnen(); d.showModal();
}

/* ---------- Ausgabe ---------- */
function ausgabeZeigen(code, roh, art) {
  const r = U.lesen(roh, "", code);
  const eigene = C.pruefen(code).filter(m => (art === "eigene" || m.art === "hinweis") && !r.meldungen.some(x => x.z === m.z));
  const unt = N ? N.zusatz(code).filter(m => ![...r.meldungen, ...eigene].some(x => x.z === m.z && x.text === m.text)) : [];
  const alle = [...r.meldungen, ...(r.meldungen.some(m => m.art === "fehler") ? [] : eigene), ...unt].sort((a, b) => a.z - b.z);
  ed.meldungenSetzen(alle.filter(m => !unt.includes(m)));
  const fehler = alle.filter(m => m.art === "fehler").length;
  let h = "";
  if (art === "ok-pruef" || art === "ok-hoch") {
    h += '<div class="ok">' + (art === "ok-hoch" ? "✔ Hochladen abgeschlossen. Dein Programm läuft jetzt auf dem Arduino." : "✔ Kompilieren abgeschlossen. Keine Fehler.") + "</div>";
    if (r.groesse) { const p = Math.round(r.groesse.flash / r.groesse.flashMax * 100), q = r.groesse.ramMax ? Math.round(r.groesse.ram / r.groesse.ramMax * 100) : 0; h += '<div class="groesse"><span>Programmspeicher</span><div class="balken"><i style="width:' + p + '%"></i></div><small>' + r.groesse.flash + " von " + r.groesse.flashMax + " Bytes (" + p + ' %)</small><span>Arbeitsspeicher</span><div class="balken"><i class="' + (q > 75 ? "warn" : "") + '" style="width:' + q + '%"></i></div><small>' + r.groesse.ram + " von " + r.groesse.ramMax + " Bytes (" + q + " %)" + (q > 75 ? " – fast voll, das kann Probleme machen" : "") + "</small></div>"; }
  } else if (!fehler) {
    const f = U.hochladenFehler(roh) || (art === "fehler-hoch" ? ["Hochladen hat nicht geklappt.", "Schau in die Ausgabe darunter."] : null);
    if (f) h += '<div class="meld fehler gross"><span>⚠</span><span><b>' + esc(f[0]) + "</b><small>" + esc(f[1]) + "</small></span></div>";
  }
  if (alle.length) h += '<div class="zaehler">' + (fehler ? fehler + " Fehler" : "") + (fehler && alle.length > fehler ? " · " : "") + (alle.length > fehler ? (alle.length - fehler) + " Hinweis" + (alle.length - fehler > 1 ? "e" : "") : "") + " – klick drauf, um zur Zeile zu springen:</div>" +
    alle.map(m => '<button type="button" class="meld ' + m.art + '" data-z="' + m.z + '" data-sp="' + (m.sp || "") + '"><span class="mz">Zeile ' + m.z + "</span><span><b>" + esc(m.text) + "</b>" + (m.tipp ? "<small>" + esc(m.tipp) + "</small>" : "") + "</span></button>").join("");
  if (r.bibliothek) h += '<div class="bib-fehlt">📚 Die Bibliothek <b>' + esc(r.bibliothek) + '</b> fehlt. <button type="button" class="pill klein" data-bib="' + esc(r.bibliothek) + '">INSTALLIEREN</button></div>';
  $("#meldungen").innerHTML = h;
  $("#meldungen").querySelectorAll("[data-z]").forEach(b => b.onclick = () => ed.zuZeile(Number(b.dataset.z), Number(b.dataset.sp) || 0));
  $("#meldungen").querySelectorAll("[data-bib]").forEach(b => b.onclick = () => bibInstallieren(b.dataset.bib));
  reiter("ausgabe");
  // die deutschen Meldungen nach oben ins Bild holen
  requestAnimationFrame(() => { const m = $("#meldungen"); $("#rAusgabe").scrollTop = m.offsetTop - $("#rAusgabe").offsetTop - 4; });
}
function knopfZustand(an, welcher) { beschaeftigt = an; $("#bPruef").disabled = an; $("#bHoch").disabled = an; $(welcher === "hoch" ? "#bHoch" : "#bPruef").classList.toggle("laeuft", an); }
function ausgabeStart(text) { $("#meldungen").innerHTML = ""; $("#roh").textContent = text ? text + "\n" : ""; reiter("ausgabe"); $("#unten").classList.remove("zu"); }
async function pruefen() {
  if (beschaeftigt) return;
  const code = ed.wert;
  if (!KC || !avrBereit) { ausgabeStart(""); ausgabeZeigen(code, "", C.pruefen(code).some(m => m.art === "fehler") ? "eigene" : "ok-pruef"); if (!avrBereit) toast("Für den echten Übersetzer fehlen noch die Arduino AVR Boards (Boardverwalter → Installieren)."); return; }
  if (!Z.board) Z.board = "arduino:avr:uno";
  knopfZustand(true, "pruef"); ausgabeStart("Sketch wird kompiliert …");
  const r = await KC.pruefen({ name: Z.name, code, fqbn: Z.board });
  knopfZustand(false, "pruef");
  ausgabeZeigen(code, r.aus, r.ok ? "ok-pruef" : "fehler");
}
async function hochladen() {
  if (beschaeftigt || !KC) return;
  if (!avrBereit) { einrichtenZeigen(); return; }
  if (!Z.port) { await portsSuchen(false); if (!Z.port) return; }
  if (!Z.board) { boardDialog(); return; }
  const code = ed.wert;
  knopfZustand(true, "hoch"); ausgabeStart("Sketch wird kompiliert und hochgeladen …");
  const r = await KC.hochladen({ name: Z.name, code, fqbn: Z.board, port: Z.port });
  knopfZustand(false, "hoch");
  ausgabeZeigen(code, r.aus, r.ok ? "ok-hoch" : /error:/.test(r.aus) ? "fehler" : "fehler-hoch");
  if (r.ok) toast("Hochladen abgeschlossen.");
  if (r.ok && r.warMonitor) setTimeout(() => monitorStarten(), 1200);
}
$("#bPruef").onclick = pruefen; $("#bHoch").onclick = hochladen;
if (KC) KC.beiAusgabe((t) => { const p = $("#roh"); p.textContent += t.replace(/\x1b\[[0-9;]*m/g, ""); $("#rAusgabe").scrollTop = 1e9; });
function hilfeKeinArduino(r = {}) {
  ausgabeStart("");
  $("#meldungen").innerHTML = '<div class="hilfe-karte"><h3>Kein Arduino gefunden – so findest du den Fehler</h3><ol>' +
    (r.hinweis === "einrichten" || !avrBereit ? '<li><b>Arduino AVR Boards installieren.</b> Ohne sie kann das Programm Boards schlechter erkennen. <button type="button" class="pill klein" id="hEin">INSTALLIEREN</button></li>' : "") +
    "<li><b>Anderes USB-Kabel probieren.</b> Viele Kabel (z. B. von Powerbanks) können nur laden, aber keine Daten.</li>" +
    '<li><b>Ist es ein Nachbau?</b> Günstige Arduinos (Chip „CH340“) brauchen unter Windows einen Treiber. Schau im Geräte-Manager (Windows-Taste → „Geräte-Manager“): Steht unter „Andere Geräte“ ein <i>USB2.0-Serial</i> mit gelbem Dreieck, fehlt der Treiber. <a href="https://www.wch-ic.com/downloads/CH341SER_EXE.html" target="_blank">CH340-Treiber vom Hersteller</a></li>' +
    "<li><b>Arduino IDE schließen</b>, falls sie offen ist – sonst ist der Anschluss besetzt.</li>" +
    "<li>Arduino <b>ab- und wieder anstecken</b> (direkt am PC, nicht am USB-Hub). Die grüne „ON“-LED muss leuchten.</li></ol>" +
    '<p class="leise">Windows sieht gerade ' + (r.systemZahl || 0) + " serielle Geräte. Sobald einer auftaucht, erkennt das Programm ihn von selbst.</p></div>";
  const h = $("#hEin"); if (h) h.onclick = einrichtenZeigen;
}

/* ---------- Dateien ---------- */
async function speichern(unter) {
  if (!KC) { toast("Speichern geht nur im PC-Programm."); return false; }
  const r = await KC.speichern({ pfad: Z.pfad, name: Z.name, code: ed.wert, unter });
  if (!r) return false;
  Z.pfad = r.pfad; Z.name = r.name; zustandMerken(); geaendertSetzen(true); toast("Gespeichert: " + r.name + ".ino"); sketcheZeigen(); return true;
}
async function fragenOhneSpeichern() {
  if (gespeichert || ed.wert.trim() === C.LEER.trim()) return true;
  return confirm("„" + Z.name + "“ ist nicht gespeichert. Trotzdem weiter? (Abbrechen = erst speichern)") || (await speichern(false));
}
function sketchLaden(x) {
  Z.name = x.name || "sketch"; Z.pfad = x.pfad || null; ed.setzen(String(x.code || "").replace(/\r\n/g, "\n")); sichern("kc-entwurf", ed.wert);
  zustandMerken(); geaendertSetzen(!!x.pfad); $("#meldungen").innerHTML = ""; $("#roh").textContent = ""; ed.fokus(); sketcheZeigen();
}
async function neuerSketch() {
  if (!(await fragenOhneSpeichern())) return;
  const d = new Date(), name = "sketch_" + ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "dez"][d.getMonth()] + d.getDate() + "a";
  sketchLaden({ name, code: C.LEER }); geaendertSetzen(false);
}
async function oeffnen() { if (!KC || !(await fragenOhneSpeichern())) return; const x = await KC.oeffnen(); if (x) sketchLaden(x); }
$("#bNeuSketch").onclick = neuerSketch;
async function sketcheZeigen() {
  const ul = $("#sketche");
  const liste = KC ? await KC.sketchbook() : [];
  ul.innerHTML = (Z.pfad ? "" : '<li><button type="button" class="an">' + esc(Z.name) + "</button></li>") + liste.slice(0, 50).map(s => '<li><button type="button" data-pfad="' + esc(s.pfad) + '"' + (s.pfad === Z.pfad ? ' class="an"' : "") + ">" + esc(s.name) + "</button></li>").join("");
  ul.querySelectorAll("[data-pfad]").forEach(b => b.onclick = async () => { if (b.dataset.pfad === Z.pfad || !(await fragenOhneSpeichern())) return; sketchLaden(await KC.lesen(b.dataset.pfad)); });
}
$("#vorlagen").innerHTML = C.BEISPIELE.map((b, i) => '<li><button type="button" data-v="' + i + '">' + esc(b[0]) + "</button></li>").join("");
$("#vorlagen").querySelectorAll("[data-v]").forEach(b => b.onclick = () => { if (ed.wert.trim() !== C.LEER.trim() && !confirm("Den Code durch die Vorlage ersetzen? (Strg+Z holt ihn zurück)")) return; N.still(() => ed.ersetzen(C.BEISPIELE[b.dataset.v][1])); });
if (KC) KC.beiOeffnen(async (x) => { if (!(await fragenOhneSpeichern())) return; sketchLaden(x); if (x.ausNotizen) { geaendertSetzen(false); toast("Aus FIDELIA Notizen übernommen – jetzt ➜ Hochladen."); } });

/* ---------- Bibliotheken ---------- */
async function bibInstallieren(name) {
  if (!KC) return;
  toast("Bibliothek „" + name + "“ wird installiert …"); ausgabeStart("Installiere „" + name + "“ …");
  const r = await KC.bibliothekInstallieren(name);
  toast(r.ok ? "„" + name + "“ ist installiert. Überprüf den Sketch nochmal." : "Installieren hat nicht geklappt. Ist das Internet an?");
}
$("#bibQ").onkeydown = async (e) => {
  if (e.key !== "Enter" || !KC) return;
  const w = $("#bibQ").value.trim(); if (!w) return;
  $("#bibListe").innerHTML = '<li class="leise">Suche …</li>';
  const l = await KC.bibliothekSuchen(w);
  $("#bibListe").innerHTML = l.length ? l.map(x => "<li><b>" + esc(x.name) + "</b><small>" + esc(x.text) + '</small><button type="button" class="pill klein" data-bib="' + esc(x.name) + '">INSTALLIEREN</button></li>').join("") : '<li class="leise">Nichts gefunden.</li>';
  $("#bibListe").querySelectorAll("[data-bib]").forEach(b => b.onclick = () => bibInstallieren(b.dataset.bib));
};

/* ---------- Suchen und Ersetzen ---------- */
function suchen() {
  const q = $("#suchQ").value, ul = $("#suchListe");
  if (!q) { ul.innerHTML = ""; return; }
  const treffer = []; ed.wert.split("\n").forEach((z, i) => { let p = z.indexOf(q); while (p >= 0) { treffer.push({ z: i + 1, sp: p + 1, text: z.trim() }); p = z.indexOf(q, p + 1); } });
  ul.innerHTML = treffer.length ? treffer.slice(0, 200).map(t => '<li><button type="button" data-z="' + t.z + '" data-sp="' + t.sp + '"><small class="leise">' + t.z + ":</small> " + esc(t.text.slice(0, 60)) + "</button></li>").join("") : '<li class="leise">Keine Treffer.</li>';
  ul.querySelectorAll("[data-z]").forEach(b => b.onclick = () => ed.zuZeile(Number(b.dataset.z), Number(b.dataset.sp)));
}
$("#suchQ").oninput = suchen;
$("#bErsetzen").onclick = () => { const q = $("#suchQ").value; if (!q) return; const i = ed.wert.indexOf(q); if (i < 0) return; N.still(() => ed.ersetzen(ed.wert.slice(0, i) + $("#ersetzQ").value + ed.wert.slice(i + q.length))); suchen(); };
$("#bAlle").onclick = () => { const q = $("#suchQ").value; if (!q) return; const n = ed.wert.split(q).length - 1; if (!n) return; N.still(() => ed.ersetzen(ed.wert.split(q).join($("#ersetzQ").value))); toast(n + "× ersetzt."); suchen(); };

/* ---------- Unten: Ausgabe, Monitor, Plotter ---------- */
function reiter(r) {
  document.querySelectorAll("[data-r]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.r === r)));
  $("#rAusgabe").hidden = r !== "ausgabe"; $("#rMonitor").hidden = r !== "monitor"; $("#rPlotter").hidden = r !== "plotter"; $("#rMesswerte").hidden = r !== "messwerte";
  if (r === "plotter") plotGroesse();
}
document.querySelectorAll("[data-r]").forEach(b => b.onclick = (e) => { if (e.target.dataset.zu) { schliessen(e.target.dataset.zu); return; } reiter(b.dataset.r); });
$("#bUntenZu").onclick = () => { $("#unten").classList.toggle("zu"); $("#bUntenZu").textContent = $("#unten").classList.contains("zu") ? "▴" : "▾"; };
$("#bLeeren").onclick = () => { if (!$("#rMesswerte").hidden) return; if (!$("#rMonitor").hidden) $("#monText").textContent = ""; else if (!$("#rPlotter").hidden) { plotDaten = []; plotMalen(); } else { $("#roh").textContent = ""; $("#meldungen").innerHTML = ""; } };
$("#baud").value = Z.baud;
$("#baud").onchange = (e) => { Z.baud = e.target.value; zustandMerken(); if (monitorAn) monitorStarten(); };
async function monitorStarten() {
  if (!KC) return false;
  if (!Z.port) { await portsSuchen(false); if (!Z.port) return false; }
  const r = await KC.monitorStart({ port: Z.port, baud: Z.baud });
  monitorAn = r.ok; $("#bMonitor").classList.toggle("an", r.ok);
  if (r.ok) monText("[Verbunden mit " + Z.port + " · " + Z.baud + " Baud]\n");
  return r.ok;
}
async function monitorOeffnen() { $("#tabMonitor").hidden = false; $("#unten").classList.remove("zu"); reiter("monitor"); if (!monitorAn) await monitorStarten(); $("#monEin").focus(); }
async function plotterOeffnen() { $("#tabPlotter").hidden = false; $("#unten").classList.remove("zu"); reiter("plotter"); $("#bPlotter").classList.add("an"); if (!monitorAn) await monitorStarten(); }
async function schliessen(was) {
  if (was === "messwerte") { $("#tabMesswerte").hidden = true; reiter("ausgabe"); return; }
  if (was === "monitor") $("#tabMonitor").hidden = true; else { $("#tabPlotter").hidden = true; $("#bPlotter").classList.remove("an"); }
  if ($("#tabMonitor").hidden && $("#tabPlotter").hidden && KC) { await KC.monitorStopp(); monitorAn = false; $("#bMonitor").classList.remove("an"); }
  reiter("ausgabe");
}
$("#bMonitor").onclick = monitorOeffnen; $("#bPlotter").onclick = plotterOeffnen;
let restZeile = "", plotDaten = [], plotNeu = false;
function monText(t) {
  const p = $("#monText"); p.textContent += t; if (p.textContent.length > 80000) p.textContent = p.textContent.slice(-50000); if ($("#autoScroll").checked) $("#rMonitor").scrollTop = 1e9;
  // Zahlen für den Plotter: jede Zeile, Werte durch Komma/Leerzeichen/Tab getrennt, optional „Name:Wert“
  const teile = (restZeile + t).split(/\r?\n/); restZeile = teile.pop();
  for (const z of teile) {
    if (N) N.monZeile(z);
    if (/^\[.*\]$/.test(z.trim())) continue;
    const werte = []; for (const s of z.split(/[,\t; ]+/)) { const m = /^(?:([A-Za-zÄÖÜäöüß_]\w*):)?(-?\d+(?:\.\d+)?)$/.exec(s.trim()); if (m) werte.push({ name: m[1] || "", wert: Number(m[2]) }); }
    if (werte.length) { plotDaten.push(werte); if (plotDaten.length > 500) plotDaten.shift(); plotNeu = true; }
  }
}
const ENDE = { nl: "\n", "": "", crnl: "\r\n" };
const senden = async () => { const t = $("#monEin").value; if (!monitorAn && !(await monitorStarten())) return; await KC.monitorSenden(t + ENDE[$("#zeilenende").value]); $("#monEin").value = ""; };
$("#monEin").onkeydown = (e) => { if (e.key === "Enter") senden(); };
if (KC) { KC.beiMonitor(monText); KC.beiMonitorFehler((t) => monText("[" + t.trim() + "]\n")); KC.beiMonitorZu(() => { if (monitorAn) { monitorAn = false; $("#bMonitor").classList.remove("an"); monText("[Verbindung getrennt]\n"); } }); }

// Serieller Plotter
const FARBEN = ["#00c7d1", "#ff8a3c", "#a6e22e", "#e05aa0", "#ffd166", "#8fa8ff"];
const plot = $("#plot"), pg = plot.getContext("2d");
function plotGroesse() { const r = plot.getBoundingClientRect(); plot.width = Math.max(100, r.width * devicePixelRatio); plot.height = Math.max(60, r.height * devicePixelRatio); plotMalen(); }
function plotMalen() {
  const W = plot.width, H = plot.height, d = devicePixelRatio; pg.clearRect(0, 0, W, H);
  const n = Math.max(0, ...plotDaten.map(x => x.length));
  let min = Infinity, max = -Infinity; for (const r of plotDaten) for (const v of r) { min = Math.min(min, v.wert); max = Math.max(max, v.wert); }
  if (min === Infinity) { pg.fillStyle = "#8d9ea3"; pg.font = 13 * d + "px sans-serif"; pg.fillText("Schick Zahlen mit Serial.println(wert); – mehrere Werte mit Komma getrennt.", 12 * d, 24 * d); $("#plotLegende").innerHTML = ""; return; }
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.08; min -= pad; max += pad;
  const links = 48 * d, y = (v) => H - 8 * d - (v - min) / (max - min) * (H - 16 * d), x = (i) => links + i / 499 * (W - links - 8 * d);
  pg.strokeStyle = "#2c393d"; pg.fillStyle = "#8d9ea3"; pg.font = 11 * d + "px sans-serif"; pg.lineWidth = 1;
  for (let k = 0; k <= 4; k++) { const v = min + (max - min) * k / 4, yy = y(v); pg.beginPath(); pg.moveTo(links, yy); pg.lineTo(W, yy); pg.stroke(); pg.fillText(String(Math.round(v * 100) / 100), 4 * d, yy + 4 * d); }
  const start = 500 - plotDaten.length;
  for (let s = 0; s < n; s++) {
    pg.strokeStyle = FARBEN[s % FARBEN.length]; pg.lineWidth = 2 * d; pg.beginPath(); let an = false;
    plotDaten.forEach((r, i) => { if (!r[s]) { an = false; return; } const xx = x(start + i), yy = y(r[s].wert); if (!an) { pg.moveTo(xx, yy); an = true; } else pg.lineTo(xx, yy); });
    pg.stroke();
  }
  const letzte = plotDaten[plotDaten.length - 1] || [];
  $("#plotLegende").innerHTML = Array.from({ length: n }, (_, s) => '<span><i style="background:' + FARBEN[s % FARBEN.length] + '"></i>' + esc((letzte[s] && letzte[s].name) || "Wert " + (s + 1)) + (letzte[s] ? ": " + letzte[s].wert : "") + "</span>").join("");
}
setInterval(() => { if (plotNeu && !$("#rPlotter").hidden) { plotNeu = false; plotMalen(); } }, 80);
addEventListener("resize", () => { if (!$("#rPlotter").hidden) plotGroesse(); });

/* ---------- Schrift, Menüs ---------- */
function schrift(d) { Z.schrift = Math.max(10, Math.min(28, Z.schrift + d)); ed.schrift(Z.schrift); zustandMerken(); }
$("#bTabMenue").onclick = () => { $("#tabMenue").hidden = !$("#tabMenue").hidden; };
$("#tabMenue").querySelectorAll("[data-tm]").forEach(b => b.onclick = () => { $("#tabMenue").hidden = true; schrift(b.dataset.tm === "schrift+" ? 1 : -1); });
const panelAuf = (p) => () => { Z.panel = ""; panelZeigen(p); };
const AKTION = {
  neu: neuerSketch, oeffnen, speichern: () => speichern(false), speichernUnter: () => speichern(true), sketchbook: panelAuf("sketchbook"),
  pruefen, hochladen, monitor: monitorOeffnen, plotter: plotterOeffnen, board: boardDialog, boards: panelAuf("boards"), bibliotheken: panelAuf("bibliotheken"),
  suchen: panelAuf("suchen"), ordner: () => KC && KC.ordnerZeigen(Z.pfad), "schrift+": () => schrift(1), "schrift-": () => schrift(-1),
  kommentar: () => { const t = document.querySelector(".ed-text"); t.focus(); t.dispatchEvent(new KeyboardEvent("keydown", { key: "/", ctrlKey: true, bubbles: true })); },
  hilfe: () => { ausgabeStart(""); $("#meldungen").innerHTML = '<div class="hilfe-karte"><h3>Erste Schritte</h3><ol><li>Arduino per USB anstecken – oben bei „Board auswählen“ erscheint er.</li><li>Code schreiben. Unten in der Statusleiste steht, was der Befehl unter dem Cursor macht.</li><li><b>✓ Überprüfen</b> – Fehler stehen hier unten auf Deutsch, ein Klick springt zur Zeile.</li><li><b>➜ Hochladen</b> – fertig! Mit dem Seriellen Monitor (rechts oben) siehst du, was der Arduino mit Serial.println schickt.</li></ol></div>'; },
  hilfePort: () => portsSuchen(true).then(r => hilfeKeinArduino(r || {})),
  ueber: panelAuf("konto")
};
function messwerteAuf() { $("#tabMesswerte").hidden = false; $("#unten").classList.remove("zu"); reiter("messwerte"); N.messZeigen(); }
N = nwtStarten({ ed, Z, KC, toast, panelAuf: (p) => panelAuf(p)(), messwerteAuf, monitorAn: async () => { $("#tabMonitor").hidden = false; if (!monitorAn) await monitorStarten(); }, reiterMarke: (an) => { $("#aufPunkt").hidden = !an; } });
Object.assign(AKTION, N.AKTIONEN);
if (KC) KC.beiMenue((id) => AKTION[id] && AKTION[id]());
else document.addEventListener("keydown", (e) => { const strg = e.ctrlKey || e.metaKey, k = e.key.toLowerCase(); if (strg && k === "r") { e.preventDefault(); pruefen(); } });

/* ---------- Einrichten ---------- */
function einrichtenZeigen() { if (!$("#dEinrichten").open) $("#dEinrichten").showModal(); }
$("#einSpaeter").onclick = () => $("#dEinrichten").close();
$("#bAvr").onclick = einrichtenZeigen;
$("#einLos").onclick = async () => {
  $("#einLos").disabled = true; $("#einLos").textContent = "WIRD INSTALLIERT …"; $("#einLog").textContent = "";
  let n = 0;
  const ab = KC.beiEinrichten((t) => { $("#einLog").textContent += t; $("#einLog").scrollTop = 1e9; n++; $("#einFort").style.width = Math.min(95, 4 + n * 1.2) + "%"; });
  const r = await KC.einrichten(); ab();
  $("#einFort").style.width = r.ok ? "100%" : "0";
  if (r.ok) { avrBereit = true; avrStatus(); $("#einLos").textContent = "FERTIG"; setTimeout(() => $("#dEinrichten").close(), 900); toast("Arduino AVR Boards installiert – jetzt kannst du überprüfen und hochladen."); portsSuchen(true); }
  else { $("#einLos").disabled = false; $("#einLos").textContent = "NOCHMAL VERSUCHEN"; toast("Das hat nicht geklappt. Ist das Internet an?"); }
};
function avrStatus() { $("#avrStatus").textContent = avrBereit ? "✔ installiert" : "noch nicht installiert"; $("#bAvr").hidden = avrBereit; }

/* ---------- Start ---------- */
(async () => {
  boardAnzeigen(); sketcheZeigen();
  if (!KC) return;
  KC.version().then(v => { $("#version").textContent = "Version " + v; });
  const st = await KC.einrichtenStatus();
  if (!st.cli) { avrBereit = false; ausgabeStart("arduino-cli fehlt – bitte Kometenwerk Code neu installieren."); }
  else if (!st.avr) { avrBereit = false; einrichtenZeigen(); }
  avrStatus();
  portsSuchen(true);
  setInterval(() => { if (!beschaeftigt && !monitorAn && document.visibilityState === "visible") portsSuchen(true); }, 4000);
  const start = await KC.startDatei(); if (start) sketchLaden(start);
})();
ed.fokus();
