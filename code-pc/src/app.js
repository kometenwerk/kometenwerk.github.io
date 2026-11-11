// Kometenwerk Code · Oberfläche
import * as C from "./code-kern.js";
import * as U from "./uebersetzer.js";
import { editor } from "./editor.js";

const KC = window.KC || null;      // Brücke zum Hauptprozess (fehlt nur beim Testen im Browser)
const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const laden = (k, v) => { try { const x = localStorage.getItem(k); return x == null ? v : JSON.parse(x); } catch (e) { return v; } };
const sichern = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
let toastTimer;
function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3800); }

/* ---------- Zustand ---------- */
const Z = Object.assign({ name: "sketch", pfad: null, board: "arduino:avr:uno", port: "", schrift: 15, baud: "9600" }, laden("kc-zustand", {}));
let gespeichert = true, beschaeftigt = false, monitorAn = false, avrBereit = true;
const zustandMerken = () => sichern("kc-zustand", { name: Z.name, pfad: Z.pfad, board: Z.board, port: Z.port, schrift: Z.schrift, baud: Z.baud });

const ed = editor($("#ed"), {
  wert: laden("kc-entwurf", C.LEER), schrift: Z.schrift,
  beiAenderung: (code) => { sichern("kc-entwurf", code); geaendertSetzen(false); },
  beiCursor: ({ z, sp, erklaerung, meldungen }) => {
    $("#status").textContent = "Zeile " + z + ", Spalte " + sp;
    $("#hilfe").innerHTML = meldungen.length ? meldungen.map(m => '<span class="' + m.art + '">' + (m.art === "fehler" ? "❌ " : "💡 ") + esc(m.text) + (m.tipp ? " <small>" + esc(m.tipp) + "</small>" : "") + "</span>").join("<br>")
      : erklaerung ? "<code>" + esc(erklaerung.aufbau) + "</code> – " + esc(erklaerung.info) : '<span class="leise">Fahr mit dem Cursor auf einen Befehl – hier steht, was er macht.</span>';
  }
});
function geaendertSetzen(ok) { gespeichert = ok; $("#geaendert").hidden = ok; $("#dateiName").textContent = Z.name + ".ino"; document.title = (ok ? "" : "● ") + Z.name + " – Kometenwerk Code"; }
geaendertSetzen(!!Z.pfad || ed.wert === C.LEER);

/* ---------- Boards und Ports ---------- */
$("#board").innerHTML = U.BOARDS.map(b => '<option value="' + b[0] + '"' + (b[0] === Z.board ? " selected" : "") + ">" + b[1] + "</option>").join("");
$("#board").onchange = (e) => { Z.board = e.target.value; zustandMerken(); };
async function portsSuchen(still) {
  if (!KC) return;
  const liste = await KC.ports();
  const sel = $("#port");
  sel.innerHTML = liste.length ? liste.map(p => '<option value="' + esc(p.adresse) + '"' + (p.adresse === Z.port ? " selected" : "") + ">" + esc(p.adresse + (p.board ? " · " + p.board : "")) + "</option>").join("") : '<option value="">Kein Arduino gefunden – USB anstecken</option>';
  if (liste.length && !liste.some(p => p.adresse === Z.port)) { Z.port = liste[0].adresse; sel.value = Z.port; }
  const erkannt = liste.find(p => p.adresse === Z.port && p.fqbn);
  if (erkannt && U.BOARDS.some(b => b[0] === erkannt.fqbn) && erkannt.fqbn !== Z.board) { Z.board = erkannt.fqbn; $("#board").value = Z.board; if (!still) toast("Erkannt: " + erkannt.board); }
  zustandMerken();
  if (!still && !liste.length) toast("Kein Arduino gefunden. Steck ihn per USB an und tipp auf ⟳.");
}
$("#port").onchange = (e) => { Z.port = e.target.value; zustandMerken(); };
$("#bPorts").onclick = () => portsSuchen(false);

/* ---------- Prüfen und Hochladen ---------- */
function ausgabeZeigen(code, roh, art) {
  const datei = (Z.name || "sketch").replace(/[^\w]/g, "_") + ".ino";
  const r = U.lesen(roh, "", code);
  const eigene = C.pruefen(code).filter(m => m.art === "hinweis" && !r.meldungen.some(x => x.z === m.z));
  const alle = [...r.meldungen, ...(r.meldungen.some(m => m.art === "fehler") ? [] : eigene)].sort((a, b) => a.z - b.z);
  ed.meldungenSetzen(alle);
  $("#roh").textContent = roh;
  const fehler = alle.filter(m => m.art === "fehler").length;
  let h = "";
  if (art === "ok-pruef" || art === "ok-hoch") {
    h += '<div class="ok">✅ ' + (art === "ok-hoch" ? "<b>Hochgeladen!</b> Dein Programm läuft jetzt auf dem Arduino." : "<b>Alles richtig.</b> Der Übersetzer hat keine Fehler gefunden.") + "</div>";
    if (r.groesse) { const p = Math.round(r.groesse.flash / r.groesse.flashMax * 100), q = r.groesse.ramMax ? Math.round(r.groesse.ram / r.groesse.ramMax * 100) : 0; h += '<div class="groesse"><span>Speicher fürs Programm</span><div class="balken"><i style="width:' + p + '%"></i></div><small>' + r.groesse.flash + " von " + r.groesse.flashMax + " Bytes (" + p + ' %)</small><span>Arbeitsspeicher</span><div class="balken"><i class="' + (q > 75 ? "warn" : "") + '" style="width:' + q + '%"></i></div><small>' + r.groesse.ram + " von " + r.groesse.ramMax + " Bytes (" + q + " %)" + (q > 75 ? " – fast voll, das kann Probleme machen" : "") + "</small></div>"; }
  } else if (art === "fehler-hoch" && !fehler) {
    const f = U.hochladenFehler(roh) || ["Hochladen hat nicht geklappt.", "Schau in die Original-Ausgabe unten."];
    h += '<div class="meld fehler gross"><span>⚠️</span><span><b>' + esc(f[0]) + "</b><small>" + esc(f[1]) + "</small></span></div>";
  } else if (!fehler && !alle.length) {
    const f = U.hochladenFehler(roh);
    h += '<div class="meld fehler gross"><span>⚠️</span><span><b>' + esc(f ? f[0] : "Etwas ist schiefgegangen.") + "</b><small>" + esc(f ? f[1] : "Schau in die Original-Ausgabe unten.") + "</small></span></div>";
  }
  if (alle.length) h += '<div class="zaehler">' + (fehler ? "❌ " + fehler + " Fehler" : "") + (fehler && alle.length > fehler ? " · " : "") + (alle.length > fehler ? "💡 " + (alle.length - fehler) + " Hinweis" + (alle.length - fehler > 1 ? "e" : "") : "") + "</div>" +
    alle.map(m => '<button type="button" class="meld ' + m.art + '" data-z="' + m.z + '" data-sp="' + (m.sp || "") + '"><span class="mz">Zeile ' + m.z + "</span><span><b>" + esc(m.text) + "</b>" + (m.tipp ? "<small>" + esc(m.tipp) + "</small>" : "") + "</span></button>").join("");
  if (r.bibliothek) h += '<div class="bib-fehlt">📚 Die Bibliothek <b>' + esc(r.bibliothek) + '</b> fehlt. <button type="button" class="haupt-k klein" data-bib="' + esc(r.bibliothek) + '">Jetzt installieren</button></div>';
  $("#meldungen").innerHTML = h;
  $("#meldungen").querySelectorAll("[data-z]").forEach(b => b.onclick = () => ed.zuZeile(Number(b.dataset.z), Number(b.dataset.sp) || 0));
  $("#meldungen").querySelectorAll("[data-bib]").forEach(b => b.onclick = () => bibInstallieren(b.dataset.bib));
  reiter("ausgabe");
}
function knopfZustand(an, welcher) {
  beschaeftigt = an;
  $("#bPruef").disabled = an; $("#bHoch").disabled = an;
  $(welcher === "hoch" ? "#bHoch" : "#bPruef").classList.toggle("laeuft", an);
}
async function pruefen() {
  if (beschaeftigt) return;
  const code = ed.wert;
  // erst die schnelle eigene Prüfung – grobe Fehler gleich zeigen
  const schnell = C.pruefen(code).filter(m => m.art === "fehler");
  if (!KC || !avrBereit) { ed.meldungenSetzen(C.pruefen(code)); ausgabeZeigen(code, "", schnell.length ? "eigene" : "ok-pruef"); if (!avrBereit) toast("Für den echten Übersetzer fehlen noch die Arduino-Werkzeuge (Einrichten)."); return; }
  knopfZustand(true, "pruef"); $("#meldungen").innerHTML = '<p class="leise">⏳ Wird übersetzt … (das erste Mal dauert es länger)</p>'; $("#roh").textContent = "";
  const r = await KC.pruefen({ name: Z.name, code, fqbn: Z.board });
  knopfZustand(false, "pruef");
  ausgabeZeigen(code, r.aus, r.ok ? "ok-pruef" : "fehler");
}
async function hochladen() {
  if (beschaeftigt || !KC) return;
  if (!avrBereit) { einrichtenZeigen(); return; }
  if (!Z.port) { await portsSuchen(true); if (!Z.port) { toast("Kein Arduino gefunden. Steck ihn per USB an und tipp auf ⟳."); return; } }
  const code = ed.wert;
  knopfZustand(true, "hoch"); $("#meldungen").innerHTML = '<p class="leise">⏳ Übersetzen und hochladen … Die Lichter am Arduino blinken gleich.</p>'; $("#roh").textContent = "";
  const r = await KC.hochladen({ name: Z.name, code, fqbn: Z.board, port: Z.port });
  knopfZustand(false, "hoch");
  const kompiliert = !/error:/.test(r.aus);
  ausgabeZeigen(code, r.aus, r.ok ? "ok-hoch" : kompiliert ? "fehler-hoch" : "fehler");
  if (r.ok) toast("✅ Hochgeladen!");
  if (r.ok && r.warMonitor) setTimeout(() => monitorUmschalten(true), 1200);
}
$("#bPruef").onclick = pruefen; $("#bHoch").onclick = hochladen;
if (KC) KC.beiAusgabe((t) => { const p = $("#roh"); p.textContent += t; });

/* ---------- Dateien ---------- */
async function speichern(unter) {
  if (!KC) { toast("Speichern geht nur im PC-Programm."); return false; }
  const r = await KC.speichern({ pfad: Z.pfad, name: Z.name, code: ed.wert, unter });
  if (!r) return false;
  Z.pfad = r.pfad; Z.name = r.name; zustandMerken(); geaendertSetzen(true); toast("💾 Gespeichert."); sketcheZeigen(); return true;
}
async function fragenOhneSpeichern() {
  if (gespeichert || ed.wert.trim() === C.LEER.trim()) return true;
  return confirm("Dein Sketch „" + Z.name + "“ ist nicht gespeichert. Trotzdem weiter? (Abbrechen = erst speichern)") || (await speichern(false));
}
function laden2(x) {
  Z.name = x.name || "sketch"; Z.pfad = x.pfad || null; ed.setzen(String(x.code || "").replace(/\r\n/g, "\n")); sichern("kc-entwurf", ed.wert);
  zustandMerken(); geaendertSetzen(!!x.pfad); $("#meldungen").innerHTML = '<p class="leise">Klick auf ✓ zum Prüfen oder ➜ zum Hochladen.</p>'; ed.fokus();
}
$("#bNeu").onclick = async () => { if (!(await fragenOhneSpeichern())) return; const n = prompt("Wie soll dein Sketch heißen?", "mein_sketch"); if (n == null) return; laden2({ name: n.replace(/[^\wäöüÄÖÜß]/g, "_") || "sketch", code: C.LEER }); geaendertSetzen(false); };
$("#bOeffnen").onclick = async () => { if (!KC || !(await fragenOhneSpeichern())) return; const x = await KC.oeffnen(); if (x) laden2(x); };
$("#bSpeichern").onclick = () => speichern(false);
$("#bOrdner").onclick = () => KC && KC.ordnerZeigen(Z.pfad);
async function sketcheZeigen() {
  const ul = $("#sketche");
  const liste = KC ? await KC.sketchbook() : [];
  ul.innerHTML = liste.length ? liste.slice(0, 40).map(s => '<li><button type="button" data-pfad="' + esc(s.pfad) + '"' + (s.pfad === Z.pfad ? ' class="an"' : "") + ">📄 " + esc(s.name) + "</button></li>").join("") : '<li class="leise">Noch keine gespeicherten Sketche.</li>';
  ul.querySelectorAll("[data-pfad]").forEach(b => b.onclick = async () => { if (!(await fragenOhneSpeichern())) return; laden2(await KC.lesen(b.dataset.pfad)); sketcheZeigen(); });
}
$("#vorlagen").innerHTML = C.BEISPIELE.map((b, i) => '<li><button type="button" data-v="' + i + '">📋 ' + esc(b[0]) + "</button></li>").join("");
$("#vorlagen").querySelectorAll("[data-v]").forEach(b => b.onclick = () => { if (ed.wert.trim() !== C.LEER.trim() && !confirm("Den Code durch die Vorlage ersetzen? (Strg+Z holt ihn zurück)")) return; ed.ersetzen(C.BEISPIELE[b.dataset.v][1]); });
if (KC) KC.beiOeffnen(async (x) => { if (!(await fragenOhneSpeichern())) return; laden2(x); if (x.ausNotizen) { geaendertSetzen(false); toast("📥 Aus FIDELIA Notizen übernommen – jetzt ➜ Hochladen."); } });

/* ---------- Bibliotheken ---------- */
async function bibInstallieren(name) {
  if (!KC) return;
  toast("📚 „" + name + "“ wird installiert …"); $("#roh").textContent = "";
  const r = await KC.bibliothekInstallieren(name);
  toast(r.ok ? "✅ „" + name + "“ ist installiert. Prüf nochmal." : "Installieren hat nicht geklappt. Ist das Internet an?");
}
$("#bibLos").onclick = async () => {
  const w = $("#bibQ").value.trim(); if (!w || !KC) return;
  $("#bibListe").innerHTML = '<li class="leise">Suche …</li>';
  const l = await KC.bibliothekSuchen(w);
  $("#bibListe").innerHTML = l.length ? l.map(x => '<li><button type="button" data-bib="' + esc(x.name) + '" title="' + esc(x.text) + '">⬇ ' + esc(x.name) + "</button></li>").join("") : '<li class="leise">Nichts gefunden.</li>';
  $("#bibListe").querySelectorAll("[data-bib]").forEach(b => b.onclick = () => bibInstallieren(b.dataset.bib));
};
$("#bibQ").onkeydown = (e) => { if (e.key === "Enter") $("#bibLos").click(); };

/* ---------- Serieller Monitor ---------- */
function reiter(r) {
  document.querySelectorAll("[data-r]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.r === r)));
  $("#rAusgabe").hidden = r !== "ausgabe"; $("#rMonitor").hidden = r !== "monitor";
}
document.querySelectorAll("[data-r]").forEach(b => b.onclick = () => reiter(b.dataset.r));
$("#baud").value = Z.baud;
$("#baud").onchange = (e) => { Z.baud = e.target.value; zustandMerken(); if (monitorAn) monitorUmschalten(true); };
async function monitorUmschalten(an) {
  if (!KC) return;
  if (!an) { await KC.monitorStopp(); monitorAn = false; $("#bVerbinden").textContent = "Verbinden"; $("#bMonitor").classList.remove("an"); return; }
  if (!Z.port) { await portsSuchen(true); if (!Z.port) { toast("Kein Arduino gefunden."); return; } }
  const r = await KC.monitorStart({ port: Z.port, baud: Z.baud });
  monitorAn = r.ok; $("#bVerbinden").textContent = r.ok ? "Trennen" : "Verbinden"; $("#bMonitor").classList.toggle("an", r.ok);
  if (r.ok) { reiter("monitor"); monText("— verbunden mit " + Z.port + " (" + Z.baud + " Baud) —\n"); $("#monEin").focus(); }
}
function monText(t) { const p = $("#monText"); p.textContent += t; if (p.textContent.length > 60000) p.textContent = p.textContent.slice(-40000); if ($("#autoScroll").checked) p.scrollTop = p.scrollHeight; }
$("#bVerbinden").onclick = () => monitorUmschalten(!monitorAn);
$("#bMonitor").onclick = () => { if (!monitorAn) monitorUmschalten(true); else reiter("monitor"); };
$("#bLeeren").onclick = () => { $("#monText").textContent = ""; };
const senden = async () => { const t = $("#monEin").value; if (!monitorAn) { toast("Erst verbinden."); return; } await KC.monitorSenden(t); monText("» " + t + "\n"); $("#monEin").value = ""; };
$("#bSenden").onclick = senden; $("#monEin").onkeydown = (e) => { if (e.key === "Enter") senden(); };
if (KC) { KC.beiMonitor(monText); KC.beiMonitorFehler((t) => monText("⚠️ " + t)); KC.beiMonitorZu(() => { if (monitorAn) { monitorAn = false; $("#bVerbinden").textContent = "Verbinden"; $("#bMonitor").classList.remove("an"); monText("— getrennt —\n"); } }); }

/* ---------- Schrift, Tasten ---------- */
document.querySelectorAll("[data-schrift]").forEach(b => b.onclick = () => { Z.schrift = Math.max(11, Math.min(28, Z.schrift + Number(b.dataset.schrift))); ed.schrift(Z.schrift); zustandMerken(); });
document.addEventListener("keydown", (e) => {
  const strg = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (strg && k === "r") { e.preventDefault(); pruefen(); }
  else if (strg && k === "u") { e.preventDefault(); hochladen(); }
  else if (strg && k === "s") { e.preventDefault(); speichern(e.shiftKey); }
  else if (strg && k === "o") { e.preventDefault(); $("#bOeffnen").click(); }
  else if (strg && k === "n") { e.preventDefault(); $("#bNeu").click(); }
  else if (strg && e.shiftKey && k === "m") { e.preventDefault(); monitorUmschalten(!monitorAn); }
  else if (strg && (k === "+" || k === "=")) { e.preventDefault(); document.querySelector('[data-schrift="1"]').click(); }
  else if (strg && k === "-") { e.preventDefault(); document.querySelector('[data-schrift="-1"]').click(); }
});
window.addEventListener("beforeunload", (e) => { if (!gespeichert && ed.wert.trim() !== C.LEER.trim()) { /* Entwurf liegt sicher in localStorage */ } });

/* ---------- Einrichten (beim ersten Start) ---------- */
function einrichtenZeigen() { $("#einrichten").hidden = false; }
$("#einSpaeter").onclick = () => { $("#einrichten").hidden = true; };
$("#einLos").onclick = async () => {
  $("#einLos").disabled = true; $("#einLos").textContent = "⏳ Läuft …"; $("#einLog").textContent = "";
  let schritte = 0;
  const ab = KC.beiEinrichten((t) => { $("#einLog").textContent += t; $("#einLog").scrollTop = 1e9; schritte++; $("#einFort").style.width = Math.min(95, 5 + schritte * 1.2) + "%"; });
  const r = await KC.einrichten(); ab();
  $("#einFort").style.width = r.ok ? "100%" : "0";
  if (r.ok) { avrBereit = true; $("#einLos").textContent = "✅ Fertig!"; setTimeout(() => { $("#einrichten").hidden = true; }, 900); toast("✅ Eingerichtet – jetzt kannst du prüfen und hochladen."); portsSuchen(true); }
  else { $("#einLos").disabled = false; $("#einLos").textContent = "Nochmal versuchen"; toast("Das hat nicht geklappt. Ist das Internet an?"); }
};

/* ---------- Start ---------- */
(async () => {
  sketcheZeigen();
  if (!KC) return;
  const st = await KC.einrichtenStatus();
  if (!st.cli) { $("#meldungen").innerHTML = '<div class="meld fehler gross"><span>⚠️</span><span><b>arduino-cli fehlt.</b><small>Das Programm wurde ohne die Arduino-Werkzeuge gebaut. Bitte neu installieren.</small></span></div>'; avrBereit = false; }
  else if (!st.avr) { avrBereit = false; einrichtenZeigen(); }
  else portsSuchen(true);
  const start = await KC.startDatei(); if (start) laden2(start);
})();
ed.fokus();
