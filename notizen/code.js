// FIDELIA Notizen · 💻 Code-Seiten (Arduino)
// Selbst programmieren: Editor mit Farben, Vorschlägen und Erklärungen, eigene Prüfung auf Deutsch,
// Serieller Monitor (Chrome/Edge per USB) und „Im PC-Programm öffnen“ zum echten Hochladen.
// Gespeichert als Seite mit art: "code" – { code, board }

import * as C from "./code-kern.js";

const KW = window.KW, esc = KW.esc;
export const BOARDS = [["uno", "Arduino Uno"], ["nano", "Arduino Nano"], ["mega", "Arduino Mega 2560"], ["leonardo", "Arduino Leonardo"]];

export async function neu(A, fach = "") {
  const s = await A.seiteNeu({ art: "code", titel: "Neuer Sketch", fach, raster: "leer", code: C.LEER, board: KW.load("kw-code-board", "uno") });
  A.gehe("code/" + s.id);
  return s;
}
// Kleine Vorschau für die Ordner-Ansicht
export const vorschauHtml = (s) => '<pre class="code-mini">' + C.faerben(String(s.code || "").split("\n").slice(0, 14).join("\n")) + "</pre>";

export function seite(A, el, id) {
  const s = A.seite(id);
  if (!s || s.art !== "code") { el.innerHTML = '<div class="empty"><b>Sketch nicht gefunden</b><a class="btn" href="#heft">Zum Heft</a></div>'; return; }
  if (s.code == null) s.code = C.LEER;
  let timer = null, meldungen = [], vorschlag = null, vAktiv = 0, port = null, leser = null;
  el.innerHTML =
    '<div class="code-kopf"><a class="btn small" href="#heft' + (s.fach ? "/" + encodeURIComponent(s.fach) : "") + '" aria-label="Zurück">←</a>' +
    '<input class="inp code-titel" id="cTitel" value="' + esc(s.titel || "") + '" aria-label="Name des Sketches" placeholder="Name">' +
    '<select class="inp" id="cFach" aria-label="Fach"><option value="">📥 Unsortiert</option>' + A.einst.faecher.map(f => '<option' + (f.name === s.fach ? " selected" : "") + '>' + esc(f.name) + '</option>').join("") + '</select></div>' +
    '<div class="code-leiste" role="toolbar" aria-label="Code-Werkzeuge">' +
      '<button type="button" class="code-k pruef" id="cPruef" title="Prüfen (Strg+R)"><span>✓</span> Prüfen</button>' +
      '<button type="button" class="code-k hoch" id="cPc" title="Im PC-Programm öffnen und auf den Arduino hochladen"><span>➜</span> Hochladen</button>' +
      '<select class="inp" id="cBoard" aria-label="Board">' + BOARDS.map(b => '<option value="' + b[0] + '"' + (s.board === b[0] ? " selected" : "") + '>' + b[1] + '</option>').join("") + '</select>' +
      '<span class="sp"></span>' +
      '<button type="button" class="btn small" id="cMonitor" title="Serieller Monitor (USB, Chrome/Edge)">🔌 Monitor</button>' +
      '<button type="button" class="btn small" id="cMehr" aria-haspopup="true" aria-expanded="false">⋯</button>' +
      '<div class="menue card" id="cMenue" hidden>' +
        '<button type="button" data-m="ino">⬇ Als .ino speichern</button><button type="button" data-m="kopie">📋 Code kopieren</button>' +
        '<label class="menue-datei">📥 .ino-Datei öffnen<input type="file" id="cDatei" accept=".ino,.cpp,.c,.h,.txt" hidden></label>' +
        '<hr>' + C.BEISPIELE.map((b, i) => '<button type="button" data-b="' + i + '">📄 Vorlage: ' + esc(b[0]) + '</button>').join("") +
        '<hr><button type="button" data-m="schrift+">A+ Größere Schrift</button><button type="button" data-m="schrift-">A− Kleinere Schrift</button>' +
      '</div></div>' +
    '<div class="code-rahmen" id="cRahmen"><div class="code-nummern" id="cNr" aria-hidden="true"></div>' +
      '<div class="code-feld"><pre class="code-farbe" id="cFarbe" aria-hidden="true"></pre><textarea id="cText" class="code-text" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-label="Arduino-Code"></textarea></div>' +
      '<div class="code-vorschlag" id="cVor" role="listbox" hidden></div></div>' +
    '<div class="code-hilfe" id="cHilfe" aria-live="polite"><span class="muted">Tipp: Fahr mit dem Cursor auf einen Befehl – hier steht dann, was er macht.</span></div>' +
    '<div class="code-ausgabe" id="cAus"><div class="code-aus-kopf"><b>Ausgabe</b><span class="sp"></span><small class="muted" id="cZeile"></small></div><div id="cMeld" class="code-meld"><span class="muted">Klick auf ✓ Prüfen, um deinen Code zu checken.</span></div></div>' +
    '<div class="code-monitor card" id="cMon" hidden><div class="code-aus-kopf"><b>🔌 Serieller Monitor</b><select class="inp" id="cBaud" aria-label="Baud">' + [9600, 19200, 38400, 57600, 115200].map(b => '<option' + (b === 9600 ? " selected" : "") + '>' + b + '</option>').join("") + '</select><button type="button" class="btn small" id="cVerb">Verbinden</button><button type="button" class="btn small" id="cLeeren">Leeren</button><button type="button" class="btn small" id="cMonZu" aria-label="Monitor schließen">✕</button></div>' +
      '<pre class="code-mon-text" id="cMonText" aria-live="polite"></pre><div class="row"><input class="inp" id="cSende" placeholder="Etwas an den Arduino schicken …" aria-label="An den Arduino senden"><button type="button" class="btn small" id="cSendK">Senden</button></div></div>';
  const q = (x) => el.querySelector(x);
  const ta = q("#cText"), farbe = q("#cFarbe"), nr = q("#cNr"), vor = q("#cVor"), hilfe = q("#cHilfe");
  let schrift = KW.load("kw-code-schrift", 15);
  const schriftSetzen = () => { q("#cRahmen").style.setProperty("--code-schrift", schrift + "px"); };
  schriftSetzen();
  ta.value = s.code;

  function speichern() { clearTimeout(timer); timer = setTimeout(() => { s.code = ta.value; s.text = ta.value.slice(0, 4000); A.seiteSpeichern(s); }, 500); }
  function malen() {
    farbe.innerHTML = C.faerben(ta.value) + "\n";
    const n = ta.value.split("\n").length, fz = new Map(meldungen.map(m => [m.z, m.art]));
    let h = ""; for (let i = 1; i <= n; i++) h += '<div class="' + (fz.get(i) === "fehler" ? "f" : fz.get(i) ? "h" : "") + '" data-z="' + i + '">' + i + "</div>";
    nr.innerHTML = h;
    scrollen();
  }
  function scrollen() { farbe.scrollTop = ta.scrollTop; farbe.scrollLeft = ta.scrollLeft; nr.scrollTop = ta.scrollTop; }
  ta.addEventListener("scroll", scrollen);
  const zeileSpalte = () => { const v = ta.value.slice(0, ta.selectionStart).split("\n"); return { z: v.length, sp: v[v.length - 1].length + 1 }; };
  function wortAmCursor() {
    const v = ta.value, i = ta.selectionStart;
    let a = i; while (a > 0 && /[\w.]/.test(v[a - 1])) a--;
    let b = i; while (b < v.length && /\w/.test(v[b])) b++;
    return { a, b, wort: v.slice(a, b), vorher: v.slice(a, i) };
  }
  function hilfeZeigen() {
    const { z, sp } = zeileSpalte(); q("#cZeile").textContent = "Zeile " + z + ", Spalte " + sp;
    let w = wortAmCursor().wort; if (!C.WISSEN[w] && w.includes(".")) w = w;
    const e = C.erklaeren(w) || C.erklaeren(w.split(".").pop());
    const m = meldungen.filter(x => x.z === z);
    hilfe.innerHTML = m.length ? m.map(x => '<span class="' + x.art + '">' + (x.art === "fehler" ? "❌ " : "💡 ") + esc(x.text) + (x.tipp ? " <small>" + esc(x.tipp) + "</small>" : "") + "</span>").join("<br>")
      : e ? '<code>' + esc(e.aufbau) + '</code> – ' + esc(e.info) : '<span class="muted">Tipp: Fahr mit dem Cursor auf einen Befehl – hier steht dann, was er macht.</span>';
  }

  /* --- Vorschläge beim Tippen --- */
  function vorschlagZeigen() {
    const { vorher } = wortAmCursor(); const p = vorher.split(".").pop();
    const liste = vorher.includes(".") ? (vorher.startsWith("Serial.") ? Object.keys(C.WISSEN).filter(n => n.startsWith("Serial." )&& n.slice(7).toLowerCase().startsWith(p.toLowerCase()) && n.slice(7) !== p).map(n => ({ name: n.slice(7), aufbau: C.WISSEN[n][0], info: C.WISSEN[n][1] })) : []) : C.vorschlaege(p, ta.value);
    if (!liste.length || p.length < (vorher.includes(".") ? 0 : 2)) { vor.hidden = true; vorschlag = null; return; }
    vorschlag = { liste, p }; vAktiv = Math.min(vAktiv, liste.length - 1);
    vor.innerHTML = liste.map((v, i) => '<button type="button" role="option" aria-selected="' + (i === vAktiv) + '" data-i="' + i + '"><b>' + esc(v.name) + '</b>' + (v.aufbau ? '<code>' + esc(v.aufbau) + '</code>' : "") + (v.info ? '<small>' + esc(v.info) + '</small>' : "") + '</button>').join("");
    // Position unter dem Cursor
    const { z, sp } = zeileSpalte(), lh = parseFloat(getComputedStyle(ta).lineHeight) || 22, cw = schrift * 0.6;
    vor.style.left = Math.min(q("#cRahmen").clientWidth - 330, 46 + sp * cw - ta.scrollLeft) + "px";
    vor.style.top = (z * lh - ta.scrollTop + 10) + "px";
    vor.hidden = false;
    vor.querySelectorAll("[data-i]").forEach(b => { b.onmousedown = (e) => e.preventDefault(); b.onclick = () => uebernehmen(liste[b.dataset.i]); });
  }
  function einsetzen(text, auswahlVon, auswahlBis) {
    ta.focus();
    document.execCommand("insertText", false, text);   // so geht Strg+Z weiter
    if (auswahlVon != null) ta.setSelectionRange(auswahlVon, auswahlBis);
  }
  function uebernehmen(v) {
    const { a, b, vorher } = wortAmCursor(), start = vorher.includes(".") ? a + vorher.lastIndexOf(".") + 1 : a;
    ta.setSelectionRange(start, b);
    const istFn = C.WISSEN[v.name] || C.WISSEN["Serial." + v.name];
    if (istFn && ta.value[b] !== "(") {
      einsetzen(v.name + "()" + (/^(pinMode|digitalWrite|delay|tone|noTone|analogWrite|randomSeed)$/.test(v.name) || /^(begin|print|println|write)$/.test(v.name) ? ";" : ""));
      const pos = ta.selectionStart - (ta.value[ta.selectionStart - 1] === ";" ? 2 : 1);
      ta.setSelectionRange(pos, pos);
    } else einsetzen(v.name);
    vor.hidden = true; vorschlag = null; nachEingabe(false);
  }

  /* --- Tasten: Einrücken, Klammern, Vorschläge --- */
  ta.addEventListener("keydown", (e) => {
    if (vorschlag && !vor.hidden) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); vAktiv = (vAktiv + (e.key === "ArrowDown" ? 1 : -1) + vorschlag.liste.length) % vorschlag.liste.length; vorschlagZeigen(); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); uebernehmen(vorschlag.liste[vAktiv]); return; }
      if (e.key === "Escape") { e.preventDefault(); vor.hidden = true; vorschlag = null; return; }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") { e.preventDefault(); pruefen(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); s.code = ta.value; A.seiteSpeichern(s); KW.toast("Gespeichert."); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === "/") {        // Zeilen ein-/auskommentieren
      e.preventDefault();
      const v = ta.value, a = v.lastIndexOf("\n", ta.selectionStart - 1) + 1, bEnde = v.indexOf("\n", ta.selectionEnd); const b = bEnde < 0 ? v.length : bEnde;
      const block = v.slice(a, b), zeilen = block.split("\n"), alle = zeilen.every(z => /^\s*\/\//.test(z) || !z.trim());
      const neuB = zeilen.map(z => !z.trim() ? z : alle ? z.replace(/^(\s*)\/\/ ?/, "$1") : z.replace(/^(\s*)/, "$1// ")).join("\n");
      ta.setSelectionRange(a, b); einsetzen(neuB, a, a + neuB.length); return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      if (ta.selectionStart !== ta.selectionEnd) {
        const v = ta.value, a = v.lastIndexOf("\n", ta.selectionStart - 1) + 1, b = ta.selectionEnd;
        const block = v.slice(a, b), neuB = e.shiftKey ? block.replace(/^ {1,2}/gm, "") : block.replace(/^/gm, "  ");
        ta.setSelectionRange(a, b); einsetzen(neuB, a, a + neuB.length);
      } else einsetzen("  ");
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const v = ta.value, i = ta.selectionStart, zeile = v.slice(v.lastIndexOf("\n", i - 1) + 1, i), einzug = (/^\s*/.exec(zeile) || [""])[0];
      const auf = /\{\s*$/.test(zeile), zu = v[i] === "}";
      if (auf && zu) { einsetzen("\n" + einzug + "  \n" + einzug); const p = i + 1 + einzug.length + 2; ta.setSelectionRange(p, p); }
      else einsetzen("\n" + einzug + (auf ? "  " : ""));
      return;
    }
    if (e.key === "}") {                                       // beim Tippen von } ausrücken
      const v = ta.value, i = ta.selectionStart, a = v.lastIndexOf("\n", i - 1) + 1, vorText = v.slice(a, i);
      if (/^\s+$/.test(vorText) && vorText.length >= 2) { e.preventDefault(); ta.setSelectionRange(i - 2, i); einsetzen("}"); return; }
    }
    const paare = { "(": ")", "[": "]", '"': '"', "{": "}" };
    if (paare[e.key] && ta.selectionStart === ta.selectionEnd && !e.ctrlKey) {
      const n = ta.value[ta.selectionStart] || "";
      if (e.key === '"' && n === '"') { e.preventDefault(); ta.setSelectionRange(ta.selectionStart + 1, ta.selectionStart + 1); return; }
      if (!n || /[\s);,\]}]/.test(n)) { e.preventDefault(); const p = ta.selectionStart; einsetzen(e.key + paare[e.key]); ta.setSelectionRange(p + 1, p + 1); nachEingabe(); return; }
    }
    if ((e.key === ")" || e.key === "]") && ta.value[ta.selectionStart] === e.key) { e.preventDefault(); ta.setSelectionRange(ta.selectionStart + 1, ta.selectionStart + 1); }
  });
  function nachEingabe(mitVorschlag = true) {
    malen(); speichern();
    if (meldungen.length) { meldungen = C.pruefen(ta.value); malen(); meldungZeigen(true); }
    if (mitVorschlag) vorschlagZeigen();
    hilfeZeigen();
  }
  ta.addEventListener("input", () => nachEingabe(true));
  ta.addEventListener("click", () => { vor.hidden = true; hilfeZeigen(); });
  ta.addEventListener("keyup", (e) => { if (/^Arrow|Home|End|Page/.test(e.key)) hilfeZeigen(); });
  ta.addEventListener("blur", () => setTimeout(() => { vor.hidden = true; }, 150));

  /* --- Prüfen --- */
  function meldungZeigen(still) {
    const f = meldungen.filter(m => m.art === "fehler").length, h = meldungen.length - f;
    q("#cMeld").innerHTML = !meldungen.length ? '<div class="ok">✅ Keine Fehler gefunden. ' + (still ? "" : "Jetzt kannst du hochladen.") + '<br><small class="muted">Das ist die FIDELIA-Prüfung für typische Fehler – den letzten Check macht der echte Übersetzer im PC-Programm.</small></div>'
      : '<div class="zaehler">' + (f ? "❌ " + f + " Fehler" : "") + (f && h ? " · " : "") + (h ? "💡 " + h + " Hinweis" + (h > 1 ? "e" : "") : "") + '</div>' +
        meldungen.map((m, i) => '<button type="button" class="meld ' + m.art + '" data-z="' + m.z + '"><span class="mz">Zeile ' + m.z + '</span><span><b>' + esc(m.text) + '</b>' + (m.tipp ? '<small>' + esc(m.tipp) + '</small>' : "") + '</span></button>').join("");
    q("#cMeld").querySelectorAll("[data-z]").forEach(b => b.onclick = () => zuZeile(Number(b.dataset.z)));
  }
  function zuZeile(z) {
    const v = ta.value.split("\n"); let p = 0; for (let i = 0; i < z - 1 && i < v.length; i++) p += v[i].length + 1;
    ta.focus(); ta.setSelectionRange(p + (/^\s*/.exec(v[z - 1] || "")[0].length), p + (v[z - 1] || "").length);
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 22; ta.scrollTop = Math.max(0, (z - 4) * lh); hilfeZeigen();
  }
  function pruefen() {
    meldungen = C.pruefen(ta.value); malen(); meldungZeigen(false);
    q("#cPruef").classList.remove("gut", "schlecht"); void q("#cPruef").offsetWidth;
    q("#cPruef").classList.add(meldungen.some(m => m.art === "fehler") ? "schlecht" : "gut");
    hilfeZeigen();
  }
  q("#cPruef").onclick = pruefen;
  nr.addEventListener("click", (e) => { const d = e.target.closest("[data-z]"); if (d) zuZeile(Number(d.dataset.z)); });

  /* --- Hochladen über das PC-Programm --- */
  q("#cPc").onclick = () => {
    meldungen = C.pruefen(ta.value); malen(); meldungZeigen(false);
    if (meldungen.some(m => m.art === "fehler") && !confirm("Die Prüfung hat noch Fehler gefunden. Trotzdem ans PC-Programm schicken?")) return;
    const link = C.pcLink(C.dateiName(s.titel), ta.value);
    const d = document.createElement("dialog"); d.className = "sheet";
    d.innerHTML = '<div class="sheet-in"><h2>➜ Auf den Arduino hochladen</h2><p>Zum echten Übersetzen und Hochladen braucht es das <b>Kometenwerk-PC-Programm</b> (Windows) – der Browser kann das nicht.</p>' +
      '<ol class="code-schritte"><li>Arduino per USB anstecken.</li><li>Auf <b>„Im PC-Programm öffnen“</b> klicken – dein Code springt hinüber.</li><li>Dort auf <b>➜ Hochladen</b>.</li></ol>' +
      '<p class="muted klein">Noch nicht installiert? Du kannst den Code auch als .ino speichern und in der Arduino IDE öffnen.</p>' +
      '<div class="sheet-foot"><button type="button" class="btn" data-x="ino">⬇ .ino speichern</button><span class="sp"></span><button type="button" class="btn" data-x="zu">Abbrechen</button><a class="btn primary" href="' + esc(link) + '" data-x="pc">Im PC-Programm öffnen</a></div></div>';
    document.body.appendChild(d);
    d.querySelector('[data-x="zu"]').onclick = () => d.close();
    d.querySelector('[data-x="ino"]').onclick = () => { inoSpeichern(); d.close(); };
    d.querySelector('[data-x="pc"]').onclick = () => setTimeout(() => d.close(), 400);
    d.addEventListener("close", () => d.remove()); d.showModal();
  };
  q("#cBoard").onchange = (e) => { s.board = e.target.value; KW.save("kw-code-board", s.board); speichern(); };

  /* --- Menü --- */
  const menue = q("#cMenue");
  q("#cMehr").onclick = () => { menue.hidden = !menue.hidden; q("#cMehr").setAttribute("aria-expanded", String(!menue.hidden)); };
  document.addEventListener("click", zuKlick, true);
  function zuKlick(e) { if (!menue.hidden && !e.target.closest("#cMenue, #cMehr")) menue.hidden = true; }
  function inoSpeichern() {
    const name = C.dateiName(s.titel) + ".ino", b = new Blob([ta.value], { type: "text/plain" }), u = URL.createObjectURL(b), l = document.createElement("a");
    l.href = u; l.download = name; l.click(); setTimeout(() => URL.revokeObjectURL(u), 2000); KW.toast("⬇ " + name + " gespeichert. Tipp: In der Arduino IDE muss die Datei in einem Ordner mit gleichem Namen liegen.");
  }
  menue.querySelectorAll("[data-m]").forEach(b => b.onclick = () => {
    const m = b.dataset.m; menue.hidden = true;
    if (m === "ino") inoSpeichern();
    else if (m === "kopie") { try { navigator.clipboard.writeText(ta.value); KW.toast("📋 Kopiert."); } catch (e) {} }
    else if (m === "schrift+" || m === "schrift-") { schrift = Math.max(11, Math.min(26, schrift + (m === "schrift+" ? 1 : -1))); KW.save("kw-code-schrift", schrift); schriftSetzen(); malen(); }
  });
  menue.querySelectorAll("[data-b]").forEach(b => b.onclick = () => {
    menue.hidden = true;
    if (ta.value.trim() && ta.value !== C.LEER && !confirm("Deinen Code durch die Vorlage ersetzen? (Strg+Z holt ihn zurück)")) return;
    ta.focus(); ta.select(); einsetzen(C.BEISPIELE[b.dataset.b][1]); nachEingabe(false);
  });
  q("#cDatei").onchange = async (e) => {
    const d = e.target.files[0]; if (!d) return; menue.hidden = true;
    const text = await d.text();
    if (ta.value.trim() && ta.value !== C.LEER && !confirm("Deinen Code durch „" + d.name + "“ ersetzen?")) return;
    ta.focus(); ta.select(); einsetzen(text.replace(/\r\n/g, "\n"));
    if (!s.titel || s.titel === "Neuer Sketch") { s.titel = d.name.replace(/\.\w+$/, ""); q("#cTitel").value = s.titel; }
    nachEingabe(false);
  };

  /* --- Serieller Monitor (Web Serial) --- */
  const mon = q("#cMon"), monText = q("#cMonText");
  q("#cMonitor").onclick = () => { mon.hidden = !mon.hidden; if (!mon.hidden && !("serial" in navigator)) monText.textContent = "Dein Browser kann nicht per USB verbinden.\nDas geht in Chrome oder Edge am Laptop/PC – oder im Kometenwerk-PC-Programm."; };
  q("#cMonZu").onclick = () => { mon.hidden = true; };
  q("#cLeeren").onclick = () => { monText.textContent = ""; };
  async function trennen() { try { if (leser) { await leser.cancel(); leser = null; } if (port) { await port.close(); port = null; } } catch (e) {} q("#cVerb").textContent = "Verbinden"; }
  q("#cVerb").onclick = async () => {
    if (!("serial" in navigator)) { KW.toast("Das geht nur in Chrome oder Edge."); return; }
    if (port) { await trennen(); return; }
    try {
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: Number(q("#cBaud").value) });
      q("#cVerb").textContent = "Trennen"; monText.textContent += "— verbunden —\n";
      const dec = new TextDecoderStream(); port.readable.pipeTo(dec.writable).catch(() => {});
      leser = dec.readable.getReader();
      (async () => { try { while (leser) { const { value, done } = await leser.read(); if (done) break; monText.textContent += value; if (monText.textContent.length > 20000) monText.textContent = monText.textContent.slice(-15000); monText.scrollTop = monText.scrollHeight; } } catch (e) {} })();
    } catch (e) { port = null; if (e && e.name !== "NotFoundError") KW.toast("Verbinden hat nicht geklappt. Ist der Monitor in der Arduino IDE noch offen?"); }
  };
  const senden = async () => {
    const t = q("#cSende").value; if (!port || !port.writable) { KW.toast("Erst verbinden."); return; }
    const w = port.writable.getWriter(); await w.write(new TextEncoder().encode(t + "\n")); w.releaseLock(); q("#cSende").value = "";
  };
  q("#cSendK").onclick = senden; q("#cSende").onkeydown = (e) => { if (e.key === "Enter") senden(); };

  q("#cTitel").oninput = (e) => { s.titel = e.target.value; speichern(); };
  q("#cFach").onchange = (e) => { s.fach = e.target.value; speichern(); };
  malen(); hilfeZeigen();
  setTimeout(() => ta.focus(), 50);
  return () => { document.removeEventListener("click", zuKlick, true); trennen(); if (timer) { clearTimeout(timer); s.code = ta.value; A.seiteSpeichern(s); } };
}
