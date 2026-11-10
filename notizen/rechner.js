// FIDELIA Notizen · Taschenrechner (Tasten wie ein Schul-Taschenrechner, eigenes FIDELIA-Aussehen)
// 2nd-Zweitfunktionen · mode · math · data · table · sto→ · Bruch-Anzeige · Verlauf · Tastatur · → einfügen

import * as R from "./rechner-kern.js";

const KW = window.KW, esc = KW.esc;
const SPEICHER = "kw-rechner";

// Tasten: [Hauptbeschriftung, Aktion, Zweitbeschriftung, Zweitaktion, Art]
// Aktion: "t:…" = Text einfügen, sonst ein Befehl
const TASTEN = [
  ["2nd", "zweit", "", "", "zweit"], ["mode", "mode", "quit", "quit", "fn"], ["delete", "del", "Verlauf ✕", "verlaufWeg", "fn"], ["◀", "links", "", "", "pfeil"], ["▶", "rechts", "", "", "pfeil"],
  ["math", "math", "", "", "fn"], ["data", "data", "stat", "data", "fn"], ["table", "table", "", "", "fn"], ["▲", "hoch", "", "", "pfeil"], ["▼", "runter", "", "", "pfeil"],
  ["ln", "t:ln(", "eˣ", "t:ℯ^(", "fn"], ["log", "t:log(", "10ˣ", "t:10^(", "fn"], ["EE", "t:E", "%", "t:%", "fn"], ["nCr", "t:nCr", "nPr", "t:nPr", "fn"], ["clear", "clear", "", "", "rot"],
  ["π", "t:π", "ℯ", "t:ℯ", "fn"], ["sin", "t:sin(", "sin⁻¹", "t:sin⁻¹(", "fn"], ["cos", "t:cos(", "cos⁻¹", "t:cos⁻¹(", "fn"], ["tan", "t:tan(", "tan⁻¹", "t:tan⁻¹(", "fn"], ["÷", "t:÷", "", "", "op"],
  ["xⁿ", "t:^(", "ⁿ√", "t:ⁿ√(", "fn"], ["n⁄d", "t:⁄", "U n⁄d", "gemischt", "fn"], ["(", "t:(", "", "", "fn"], [")", "t:)", "", "", "fn"], ["×", "t:×", "", "", "op"],
  ["x²", "t:²", "√", "t:√(", "fn"], ["7", "t:7", "", "", "zahl"], ["8", "t:8", "", "", "zahl"], ["9", "t:9", "", "", "zahl"], ["−", "t:-", "", "", "op"],
  ["x⁻¹", "t:⁻¹", "!", "t:!", "fn"], ["4", "t:4", "", "", "zahl"], ["5", "t:5", "", "", "zahl"], ["6", "t:6", "", "", "zahl"], ["+", "t:+", "", "", "op"],
  ["sto→", "sto", "rcl", "rcl", "fn"], ["1", "t:1", "", "", "zahl"], ["2", "t:2", "", "", "zahl"], ["3", "t:3", "", "", "zahl"], ["◂▸", "umschalten", "", "", "fn"],
  ["x", "t:x", "abc", "var", "fn"], ["0", "t:0", "", "", "zahl"], [",", "t:,", "", "", "zahl"], ["(−)", "t:-", "ans", "t:ans", "zahl"], ["enter", "enter", "", "", "enter"]
];
// Diese Zeichen brauchen etwas davor – bei leerer Zeile rechnet man mit dem letzten Ergebnis weiter (wie beim echten Rechner)
const BRAUCHT_ETWAS = /^(\+|×|÷|\^|⁄|²|⁻¹|!|%|nCr|nPr|E)/;
// Diese Stücke löscht „delete“ am Stück
const STUECKE = ["sin⁻¹(", "cos⁻¹(", "tan⁻¹(", "sin(", "cos(", "tan(", "ln(", "log(", "ⁿ√(", "√(", "abs(", "round(", "ggT(", "kgV(", "int(", "ℯ^(", "10^(", "^(", "nCr", "nPr", "ans", "⁻¹"];

export function aufbauen(box, { einfuegen }) {
  const daten = Object.assign({ verlauf: [], speicher: {}, einst: Object.assign({}, R.STANDARD) }, KW.load(SPEICHER, {}));
  let eingabe = "", cursor = 0, zweit = false, auswahl = -1, menue = null;

  box.innerHTML = '<div class="re" tabindex="0" aria-label="Taschenrechner – du kannst auch mit der Tastatur tippen">' +
    '<div class="re-display"><div class="re-status" id="reStatus"></div><div class="re-verlauf" id="reVerlauf" aria-live="polite"></div><div class="re-zeile" id="reZeile"></div><div class="re-fehler" id="reFehler" role="alert"></div></div>' +
    '<div class="re-einfuegen"><button type="button" class="btn small" data-ein="ergebnis" title="Ergebnis dort einfügen, wo dein Cursor war">→ Ergebnis einfügen</button><button type="button" class="btn small" data-ein="rechnung" title="Rechnung = Ergebnis einfügen">→ Rechnung einfügen</button></div>' +
    '<div class="re-tasten" id="reTasten">' + TASTEN.map((k, i) => '<button type="button" class="re-taste re-' + k[4] + (k[2] ? " hat2" : "") + '" data-i="' + i + '" aria-label="' + esc(k[0]) + (k[2] ? " (2nd: " + esc(k[2]) + ")" : "") + '">' + (k[2] ? '<small>' + esc(k[2]) + "</small>" : "<small>&nbsp;</small>") + "<span>" + esc(k[0]) + "</span></button>").join("") + "</div>" +
    '<div class="re-menue" id="reMenue" hidden></div>' +
    '<p class="muted klein re-hinweis">In Klassenarbeiten brauchst du deinen echten Taschenrechner.</p></div>';
  const wurzel = box.querySelector(".re"), zeile = box.querySelector("#reZeile"), verlaufEl = box.querySelector("#reVerlauf"), fehler = box.querySelector("#reFehler"), menueEl = box.querySelector("#reMenue");

  const speichern = () => KW.save(SPEICHER, { verlauf: daten.verlauf.slice(-60), speicher: daten.speicher, einst: daten.einst });
  const art = (v) => v.art || (daten.einst.bruch === "komma" ? "komma" : "bruch");

  function zeigen() {
    const e = daten.einst;
    box.querySelector("#reStatus").innerHTML = (zweit ? '<b class="an">2nd</b>' : "<b>&nbsp;&nbsp;&nbsp;</b>") + "<span>" + (e.winkel === "deg" ? "DEG" : "RAD") + "</span><span>" + (e.anzeige === "sci" ? "SCI" : "NORM") + "</span><span>" + (e.fix === null ? "FLOAT" : "FIX " + e.fix) + "</span><span>" + (e.bruch === "komma" ? "0,5" : "½") + "</span>";
    verlaufEl.innerHTML = daten.verlauf.map((v, i) => '<div class="re-eintrag' + (i === auswahl ? " gewaehlt" : "") + '" data-v="' + i + '"><div class="re-ein">' + R.schoen(v.ein) + '</div><div class="re-aus">' + R.schoen(R.formatieren(v.wert, e, art(v))) + "</div></div>").join("");
    verlaufEl.scrollTop = auswahl >= 0 ? (verlaufEl.children[auswahl] || {}).offsetTop - 20 : verlaufEl.scrollHeight;
    zeile.innerHTML = esc(eingabe.slice(0, cursor)) + '<span class="re-cursor"></span>' + esc(eingabe.slice(cursor));
    wurzel.classList.toggle("zweit", zweit);
    verlaufEl.querySelectorAll("[data-v]").forEach(d => d.onclick = () => { auswahl = Number(d.dataset.v); zeigen(); });
  }
  const tippen = (t) => {
    fehler.textContent = "";
    if (auswahl >= 0) auswahl = -1;
    if (!eingabe && BRAUCHT_ETWAS.test(t) && daten.speicher.ans) { eingabe = "ans"; cursor = 3; }
    eingabe = eingabe.slice(0, cursor) + t + eingabe.slice(cursor); cursor += t.length;
  };
  function loeschen() {
    if (!cursor) { if (eingabe) eingabe = eingabe.slice(1); return; }
    const vor = eingabe.slice(0, cursor), st = STUECKE.find(s => vor.endsWith(s));
    const n = st ? st.length : 1;
    eingabe = vor.slice(0, -n) + eingabe.slice(cursor); cursor -= n;
  }
  function ausrechnen() {
    if (auswahl >= 0 && !eingabe) { const v = daten.verlauf[auswahl]; eingabe = v.ein; cursor = eingabe.length; auswahl = -1; return; }
    if (auswahl >= 0) { const v = daten.verlauf[auswahl]; tippen(R.formatieren(v.wert, daten.einst, "komma")); auswahl = -1; return; }
    if (!eingabe.trim()) return;
    try {
      const wert = R.rechnen(eingabe, daten.speicher, daten.einst);
      // offene Klammern für die Anzeige schließen: √(2 → √(2)
      const offen = (eingabe.match(/\(/g) || []).length - (eingabe.match(/\)/g) || []).length;
      daten.verlauf.push({ ein: eingabe + ")".repeat(Math.max(0, offen)), wert });
      daten.speicher.ans = wert;
      eingabe = ""; cursor = 0; fehler.textContent = "";
      speichern();
    } catch (e) { fehler.textContent = "⚠️ " + (e.message || "Fehler"); }
  }
  const letztes = () => daten.verlauf[daten.verlauf.length - 1];

  function befehl(a) {
    if (a.startsWith("t:")) { tippen(a.slice(2)); zeigen(); return; }
    switch (a) {
      case "zweit": zweit = !zweit; return zeigen();
      case "del": loeschen(); break;
      case "verlaufWeg": if (!daten.verlauf.length) KW.toast("Der Verlauf ist schon leer."); else { daten.verlauf = []; auswahl = -1; speichern(); KW.toast("Verlauf gelöscht."); } break;
      case "links": cursor = Math.max(0, cursor - 1); break;
      case "rechts": cursor = Math.min(eingabe.length, cursor + 1); break;
      case "hoch": auswahl = auswahl < 0 ? daten.verlauf.length - 1 : Math.max(0, auswahl - 1); break;
      case "runter": auswahl = auswahl < 0 ? -1 : auswahl + 1 >= daten.verlauf.length ? -1 : auswahl + 1; break;
      case "clear": if (eingabe) { eingabe = ""; cursor = 0; } else if (auswahl >= 0) auswahl = -1; fehler.textContent = ""; break;
      case "enter": ausrechnen(); break;
      case "umschalten": { const v = letztes(); if (v) { const a2 = art(v); v.art = a2 === "bruch" ? "gemischt" : a2 === "gemischt" ? "komma" : "bruch"; if (v.art === "gemischt" && !(R.istBruch(v.wert) && Math.abs(v.wert.n) > v.wert.d)) v.art = "komma"; speichern(); } break; }
      case "gemischt": { const v = letztes(); if (!v) KW.toast("Erst etwas ausrechnen – dann zeigt U n⁄d das Ergebnis als gemischte Zahl."); if (v) { v.art = art(v) === "gemischt" ? "bruch" : "gemischt"; speichern(); } break; }
      case "mode": case "quit": if (a === "quit" && !menue) { zeigen(); return; } return a === "quit" ? menueZu() : menueMode();
      case "math": return menueMath();
      case "data": return menueData();
      case "table": return menueTabelle();
      case "sto": return menueVar("Ergebnis speichern in …", (n) => { const v = letztes(); if (!v) { KW.toast("Erst etwas ausrechnen."); return; } daten.speicher[n] = v.wert; speichern(); KW.toast("✓ " + R.formatieren(v.wert, daten.einst, "komma") + " → " + n); });
      case "rcl": case "var": return menueVar(a === "rcl" ? "Gespeicherten Wert holen" : "Variable einfügen", (n) => { tippen(n); zeigen(); });
    }
    zeigen();
  }

  /* --- Menüs (wie beim echten Rechner, aber zum Antippen) --- */
  function menueZeigen(titel, html, binden) {
    menue = true; menueEl.hidden = false;
    menueEl.innerHTML = '<div class="re-menue-kopf"><b>' + titel + '</b><button type="button" class="btn small" data-zu aria-label="Schließen">✕</button></div>' + html;
    menueEl.querySelector("[data-zu]").onclick = menueZu;
    binden && binden(menueEl);
  }
  function menueZu() { menue = null; menueEl.hidden = true; wurzel.focus({ preventScroll: true }); zeigen(); }
  function menueMode() {
    const e = daten.einst, zeile2 = (name, key, werte) => '<div class="re-mode"><span>' + name + "</span>" + werte.map(w => '<button type="button" class="' + (String(e[key]) === String(w[0]) ? "an" : "") + '" data-k="' + key + '" data-w="' + w[0] + '">' + w[1] + "</button>").join("") + "</div>";
    menueZeigen("mode", zeile2("Winkel", "winkel", [["deg", "DEG (Grad)"], ["rad", "RAD"]]) + zeile2("Anzeige", "anzeige", [["normal", "Normal"], ["sci", "Wissensch. ×10ⁿ"]]) +
      zeile2("Nachkommastellen", "fix", [["null", "Frei"], [0, "0"], [1, "1"], [2, "2"], [3, "3"], [4, "4"], [6, "6"]]) + zeile2("Ergebnis", "bruch", [["auto", "Bruch ¾"], ["komma", "Komma 0,75"]]),
      (m) => m.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { const w = b.dataset.w; daten.einst[b.dataset.k] = w === "null" ? null : /^\d$/.test(w) ? Number(w) : w; speichern(); menueMode(); zeigen(); }));
  }
  function menueMath() {
    const L = [["abs(", "abs( – Betrag"], ["round(", "round( ; ) – runden"], ["int(", "int( – ganze Zahl"], ["ggT(", "ggT( ; ) – größter gemeinsamer Teiler"], ["kgV(", "kgV( ; ) – kleinstes gemeinsames Vielfaches"], ["ⁿ√(", "ⁿ√(n ; x) – n-te Wurzel"], ["³", "³ – hoch 3"], ["!", "! – Fakultät"], [";", "; – trennt zwei Werte"]];
    menueZeigen("math", '<div class="re-liste">' + L.map(l => '<button type="button" data-t="' + esc(l[0]) + '">' + esc(l[1]) + "</button>").join("") + "</div>", (m) => m.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { tippen(b.dataset.t); menueZu(); }));
  }
  function menueVar(titel, f) {
    const namen = ["x", "y", "z", "t", "a", "b", "c", "ans"];
    menueZeigen(titel, '<div class="re-liste">' + namen.map(n => '<button type="button" data-n="' + n + '"><b>' + n + "</b> = " + (daten.speicher[n] ? esc(R.formatieren(daten.speicher[n], daten.einst, "komma")) : "0") + "</button>").join("") + "</div>", (m) => m.querySelectorAll("[data-n]").forEach(b => b.onclick = () => { menueZu(); f(b.dataset.n); }));
  }
  function menueTabelle() {
    const alt = daten.tabelle || { f: "x²", start: -3, schritt: 1 };
    menueZeigen("table – Wertetabelle", '<label class="feld"><span>f(x) =</span><input class="inp" id="tF" value="' + esc(alt.f) + '" spellcheck="false"></label><div class="re-zwei"><label class="feld"><span>Start</span><input class="inp" id="tS" type="number" step="any" value="' + alt.start + '"></label><label class="feld"><span>Schritt</span><input class="inp" id="tD" type="number" step="any" value="' + alt.schritt + '"></label></div><div id="tAus"></div>', (m) => {
      const neu = () => {
        daten.tabelle = { f: m.querySelector("#tF").value, start: Number(m.querySelector("#tS").value) || 0, schritt: Number(m.querySelector("#tD").value) || 1 }; speichern();
        const t = R.tabelle(daten.tabelle.f, daten.tabelle.start, daten.tabelle.schritt, 12, daten.einst);
        m.querySelector("#tAus").innerHTML = '<table class="re-tab"><tr><th>x</th><th>f(x)</th></tr>' + t.map(r => "<tr><td>" + esc(r[0]) + "</td><td>" + esc(r[1]) + "</td></tr>").join("") + "</table>" +
          '<button type="button" class="btn small" id="tEin">→ Tabelle einfügen</button>';
        m.querySelector("#tEin").onclick = () => einfuegen(t.map(r => r.join("\t")).join("\n"), { tabelle: [["x", "f(x) = " + daten.tabelle.f], ...t] });
      };
      m.querySelectorAll("input").forEach(i => i.oninput = neu); neu();
    });
  }
  function menueData() {
    menueZeigen("data – Statistik", '<label class="feld"><span>Zahlen (mit Leerzeichen, ; oder neuer Zeile trennen)</span><textarea class="inp" id="dL" rows="3" spellcheck="false">' + esc(daten.liste || "") + '</textarea></label><div id="dAus"></div>', (m) => {
      const neu = () => {
        daten.liste = m.querySelector("#dL").value; speichern();
        const werte = daten.liste.split(/[\s;]+/).map(s => Number(s.replace(",", "."))).filter(v => s2(v));
        function s2(v) { return isFinite(v); }
        const s = R.statistik(werte), z = (v) => R.formatieren(R.ausKomma(Number(v.toPrecision(10))), daten.einst, "komma");
        m.querySelector("#dAus").innerHTML = s ? '<table class="re-tab">' + [["Anzahl n", s.n], ["Summe Σx", z(s.summe)], ["Mittelwert x̄", z(s.mittel)], ["Median", z(s.median)], ["Kleinster", z(s.min)], ["Größter", z(s.max)], ["Spannweite", z(s.max - s.min)], ["Standardabw. sx", z(s.sx)], ["σx", z(s.sigma)]].map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td><button type="button" class="btn small" data-ein="' + esc(String(r[1])) + '" aria-label="einfügen">→</button></td></tr>').join("") + "</table>" : '<p class="muted klein">Noch keine Zahlen.</p>';
        m.querySelectorAll("[data-ein]").forEach(b => b.onclick = () => einfuegen(b.dataset.ein));
      };
      m.querySelector("#dL").oninput = neu; neu();
    });
  }

  /* --- Tasten antippen --- */
  box.querySelector("#reTasten").addEventListener("click", (e) => {
    const b = e.target.closest(".re-taste"); if (!b) return;
    const k = TASTEN[b.dataset.i];
    const a = zweit && k[3] ? k[3] : k[1];
    if (k[1] !== "zweit") zweit = false;
    if (navigator.vibrate) navigator.vibrate(5);
    befehl(a);
  });
  // Einfügen ins Heft / in die Tabelle / auf die Folie
  box.querySelectorAll("[data-ein]").forEach(b => b.onclick = () => {
    const v = letztes(); if (!v) { KW.toast("Erst etwas ausrechnen."); return; }
    const erg = R.formatieren(v.wert, daten.einst, art(v) === "gemischt" ? "bruch" : art(v));
    einfuegen(b.dataset.ein === "ergebnis" ? erg : (v.ein.replace(/\*/g, "×").replace(/-/g, "−").replace(/\./g, ",") + " = " + erg));
  });

  /* --- Tastatur --- */
  wurzel.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key, map = { "*": "×", "/": "÷", ".": ",", "-": "-", "+": "+", "^": "^(", "(": "(", ")": ")", "!": "!", "%": "%", ",": "," };
    let ok = true;
    if (/^[0-9]$/.test(k)) tippen(k);
    else if (map[k]) tippen(map[k]);
    else if (k === "Enter" || k === "=") ausrechnen();
    else if (k === "Backspace") loeschen();
    else if (k === "Delete") { eingabe = ""; cursor = 0; }
    else if (k === "ArrowLeft") cursor = Math.max(0, cursor - 1);
    else if (k === "ArrowRight") cursor = Math.min(eingabe.length, cursor + 1);
    else if (k === "ArrowUp") befehl("hoch");
    else if (k === "ArrowDown") befehl("runter");
    else if (k === "Escape" && menue) menueZu();
    else if (/^[a-zπ]$/i.test(k)) tippen(k.toLowerCase());
    else ok = false;
    if (ok) { e.preventDefault(); if (!["ArrowUp", "ArrowDown"].includes(k)) zeigen(); }
  });

  zeigen();
  return { fokus: () => wurzel.focus({ preventScroll: true }) };
}
