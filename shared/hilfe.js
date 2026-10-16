/* Kometenwerk – 🙋 Hilfe & Kontakt als Fenster für alle Seiten.
   Einbinden: <script src="…/shared/hilfe.js" defer></script>
   Öffnen: jeder Link/Knopf mit data-hilfe (optional data-hilfe="melden|termin|neu") oder #hilfe in der Adresse.
   Lädt erst etwas aus dem Netz, wenn das Fenster geöffnet wird. */
(function(){
  "use strict";
  var me = document.currentScript;
  var BASE = new URL("../", (me && me.src) || location.href).href;
  var $ = function(s){ return document.querySelector(s); };
  var esc = function(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); };
  var norm = function(s){ return String(s || "").toLowerCase().replace(/ß/g,"ss").normalize("NFD").replace(/[\u0300-\u036f]/g,""); };

  var st = document.createElement("style");
  st.textContent = "dialog.hdlg{--h-soft:#f4f6fa;border:1px solid var(--line);border-radius:20px;background:var(--card);color:var(--ink);font-family:'Space Grotesk','Helvetica Neue',Arial,sans-serif;line-height:1.5}\n@media (prefers-color-scheme:dark){dialog.hdlg{--h-soft:#101826}}\ndialog.hdlg::backdrop{background:rgba(10,16,27,.6)}\ndialog.hdlg h2{margin:0 0 8px;font-size:1.25rem}\ndialog.hdlg h3{margin:14px 0 2px;font-size:1rem}\ndialog.hdlg p{margin:0;color:var(--muted);font-size:.94rem}\ndialog.hdlg .btn{min-height:44px;padding:10px 14px;border-radius:12px;border:1px solid var(--line);background:var(--h-soft);cursor:pointer;font-size:.95rem}\ndialog.hdlg{width:min(560px,calc(100vw - 24px));max-width:none;max-height:calc(100dvh - 24px);overflow:auto;padding:18px 18px 14px}\n.h-kopf{display:flex;align-items:center;justify-content:space-between;gap:8px}\n.h-kopf h2{margin:0}\n.h-x{width:40px;height:40px;border-radius:50%;border:0;background:var(--h-soft);cursor:pointer;font-size:1rem}\n.h-status{margin:10px 0 0;padding:9px 12px;border-radius:12px;background:var(--h-soft);font-size:.9rem;color:var(--ink)}\n.h-status.warn{background:#fff4d6;color:#5c3d00}\n@media (prefers-color-scheme:dark){.h-status.warn{background:#3d2e05;color:#ffe3a3}}\n.h-tabs{display:flex;gap:2px;margin:12px 0 10px;border-bottom:1px solid var(--line);overflow-x:auto;scrollbar-width:none}\n.h-tabs button{border:0;background:transparent;padding:9px 10px;font-size:.9rem;color:var(--muted);cursor:pointer;border-bottom:3px solid transparent;white-space:nowrap}\n.h-tabs button[aria-selected=\"true\"]{color:var(--ink);border-bottom-color:var(--accent);font-weight:600}\n.h-p[hidden]{display:none}\n@media (max-width:420px){.h-tabs button{padding:9px 6px;font-size:.84rem}dialog.hdlg{padding:14px 12px 12px}}\n.h-p>p{margin:0 0 10px}\n.h-log{display:flex;flex-direction:column;gap:8px;max-height:260px;min-height:70px;overflow:auto;padding:4px 2px}\n.h-msg{max-width:85%;padding:9px 12px;border-radius:14px;font-size:.94rem;line-height:1.4;background:var(--h-soft);align-self:flex-start;white-space:pre-wrap}\n.h-msg.du{align-self:flex-end;background:var(--accent);color:#101826}\n.h-msg .btn{margin-top:8px}\n.h-eingabe{display:flex;gap:6px;margin-top:8px}\n.h-eingabe input{flex:1;min-width:0;font:inherit;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px}\n.h-eingabe input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}\n.h-mic{width:44px;flex:none;border:1px solid var(--line);background:var(--h-soft);border-radius:12px;cursor:pointer;font-size:1.1rem}\n.h-mic.an{background:#dc2626;color:#fff;border-color:#dc2626}\n.h-senden{padding:10px 14px}\n.h-primaer{background:var(--accent);border-color:var(--accent);color:#101826;font-weight:600}\n.h-klein{font-size:.82rem !important;color:var(--muted)}\ndialog .h-klein{margin:6px 0}\n.h-link{border:0;background:none;padding:0;color:var(--link);font:inherit;text-decoration:underline;cursor:pointer}\n.h-faq{border-bottom:1px solid var(--line);padding:2px 0}\n.h-faq summary{cursor:pointer;padding:8px 0;font-weight:500;font-size:.94rem}\n.h-faq p{margin:0 0 10px}\n.h-art{display:flex;gap:16px;flex-wrap:wrap;margin:4px 0 10px}\n.h-art label{display:flex;gap:6px;align-items:center}\n.h-feld{display:flex;flex-direction:column;gap:4px;margin:0 0 10px;font-size:.88rem;color:var(--muted)}\n.h-feld select,.h-feld textarea{font:inherit;font-size:.95rem;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px}\n.h-feld textarea{resize:vertical}\n.h-fehler{color:#b42318 !important;font-size:.88rem !important;margin:0 0 8px !important}\n@media (prefers-color-scheme:dark){.h-fehler{color:#ff9b8f !important}}\n.h-danke{margin-top:10px;padding:10px 12px;border-radius:12px;background:#e7f6ec;color:#14532d}\n@media (prefers-color-scheme:dark){.h-danke{background:#0f2e1b;color:#b7f0c8}}\n.h-bald{padding:10px 12px;border-radius:12px;background:var(--h-soft);color:var(--ink) !important}\n.h-slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px;margin:6px 0}\n.h-slot{display:flex;flex-direction:column;align-items:center;padding:9px 6px;border:1px solid var(--line);border-radius:12px;text-decoration:none;font-size:.85rem;color:var(--muted)}\n.h-slot b{color:var(--ink);font-size:1.05rem}\n.h-slot:hover,.h-slot:focus-visible{border-color:var(--accent);outline:none}\n.h-neu{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:8px;font-size:.94rem}\n.h-ds{margin-top:14px;font-size:.85rem;color:var(--muted)}\n.h-ds summary{cursor:pointer}\n.h-ds p{font-size:.82rem;margin:6px 0}";
  document.head.appendChild(st);
  var box = document.createElement("div");
  box.innerHTML = "<dialog id=\"hilfe\" class=\"hdlg\" aria-labelledby=\"hTitel\">\n  <div class=\"h-kopf\"><h2 id=\"hTitel\">🙋 Hilfe &amp; Kontakt</h2><button type=\"button\" class=\"h-x\" id=\"hZu\" aria-label=\"Hilfe schließen\">✕</button></div>\n  <div class=\"h-status\" id=\"hStatus\" role=\"status\">🔄 Status wird geladen …</div>\n  <div class=\"h-tabs\" role=\"tablist\" aria-label=\"Bereiche\">\n    <button type=\"button\" role=\"tab\" data-h=\"fragen\" aria-selected=\"true\">🤖 Fragen</button>\n    <button type=\"button\" role=\"tab\" data-h=\"melden\" aria-selected=\"false\">📣 Melden</button>\n    <button type=\"button\" role=\"tab\" data-h=\"termin\" aria-selected=\"false\">📅 Termin</button>\n    <button type=\"button\" role=\"tab\" data-h=\"neu\" aria-selected=\"false\">✨ Neu</button>\n  </div>\n\n  <section class=\"h-p\" data-p=\"fragen\" role=\"tabpanel\" aria-label=\"Fragen\">\n    <div class=\"h-log\" id=\"hLog\" aria-live=\"polite\"></div>\n    <div class=\"h-eingabe\" id=\"hForm\">\n      <label class=\"vh\" for=\"hText\">Deine Frage</label>\n      <input id=\"hText\" type=\"text\" maxlength=\"200\" autocomplete=\"off\" enterkeyhint=\"send\" placeholder=\"Deine Frage …\">\n      <button type=\"button\" class=\"h-mic\" id=\"hMic\" aria-label=\"Frage sprechen\" aria-pressed=\"false\">🎙️</button>\n      <button type=\"button\" class=\"btn h-senden\" id=\"hSenden\">Fragen</button>\n    </div>\n    <p class=\"h-klein\" id=\"hMicInfo\">🎙️ Du kannst auch sprechen – die Spracherkennung läuft nur auf deinem Gerät.</p>\n    <h3>Häufige Fragen</h3>\n    <div id=\"hFaq\"></div>\n    <p class=\"h-klein\">📞 Eine Telefonnummer haben wir nicht – so bleibt alles sicher. Vereine und Betriebe können aber einen <button type=\"button\" class=\"h-link\" data-geh=\"termin\">Telefontermin anfragen</button>.</p>\n  </section>\n\n  <section class=\"h-p\" data-p=\"melden\" role=\"tabpanel\" aria-label=\"Melden\" hidden>\n    <p>Etwas klappt nicht oder du hast eine Idee? Schreib es uns. Wir lesen jede Meldung – antworten können wir aber nicht, denn bei uns gibt es keinen Chat mit Fremden.</p>\n    <div class=\"h-art\" role=\"radiogroup\" aria-label=\"Was möchtest du melden?\">\n      <label><input type=\"radio\" name=\"hArt\" value=\"fehler\" checked> 🐞 Ein Fehler</label>\n      <label><input type=\"radio\" name=\"hArt\" value=\"idee\"> 💡 Eine Idee</label>\n    </div>\n    <label class=\"h-feld\"><span>Welche App?</span>\n      <select id=\"hApp\">\n        <option>Startseite</option><option>Krawallzoo</option><option>Nachrichten-Heft</option><option>Kometen-Planer</option><option>Kometen-Notizen</option><option>Kometen-Quiz</option><option>Kometen-Werkstatt</option><option>Kometen-KI</option><option>Kometen-Beats</option><option>Kometen-Fokus</option><option>Kometen-Taschengeld</option><option>Für Kunden</option><option>Etwas anderes</option>\n      </select></label>\n    <label class=\"h-feld\"><span>Was ist passiert? / Deine Idee</span><textarea id=\"hMeldung\" rows=\"4\" maxlength=\"500\" placeholder=\"z. B. Im Quiz springt die Karte nach dem Umdrehen zurück.\"></textarea></label>\n    <p class=\"h-klein\">🔒 Bitte keine Namen, E-Mail-Adressen, Telefonnummern oder Links hineinschreiben.</p>\n    <p class=\"h-fehler\" id=\"hMeldFehler\" hidden></p>\n    <button type=\"button\" class=\"btn h-primaer\" id=\"hMeldenBtn\">Abschicken</button>\n    <div class=\"h-danke\" id=\"hDanke\" hidden>✅ <b>Danke!</b> Deine Meldung ist bei uns angekommen.</div>\n  </section>\n\n  <section class=\"h-p\" data-p=\"termin\" role=\"tabpanel\" aria-label=\"Termin\" hidden>\n    <p><b>Für Vereine und Betriebe:</b> Wir bauen Webseiten und kleine Apps. Such dir eine Zeit aus – wir sprechen dann per Videoanruf oder Telefon.</p>\n    <div id=\"hTermine\" aria-live=\"polite\"><p class=\"h-klein\">Freie Zeiten werden geladen …</p></div>\n    <p><a class=\"btn\" href=\"__BASE__kunden/\">Alles über unsere Angebote ›</a></p>\n  </section>\n\n  <section class=\"h-p\" data-p=\"neu\" role=\"tabpanel\" aria-label=\"Neu und repariert\" hidden>\n    <div id=\"hNeu\"><p class=\"h-klein\">Wird geladen …</p></div>\n  </section>\n\n  <details class=\"h-ds\"><summary>Datenschutz im Hilfe-Fenster</summary>\n    <p>Wenn du dieses Fenster öffnest, holt dein Browser den aktuellen Status, die Neuigkeiten und die freien Termine aus unserer Datenbank bei Google Firebase (Google Ireland Ltd.). Dabei wird technisch deine IP-Adresse übertragen. Wir speichern dabei nichts über dich.</p>\n    <p>Wenn du etwas meldest, speichern wir nur deinen Text, die App, die Uhrzeit und eine zufällige Kennung ohne Namen (damit niemand die Meldungen zuspammt). Wir löschen Meldungen, sobald sie erledigt sind.</p>\n    <p>Der Hilfe-Bot läuft in deinem Browser. Die Spracheingabe auch: Das Sprachmodell wird einmal geladen und hört dann nur auf deinem Gerät zu – deine Stimme wird nirgends hingeschickt.</p>\n  </details>\n</dialog>".replace(/__BASE__/g, BASE);
  document.body.appendChild(box.firstChild);

  /* ---------- 🙋 Hilfe & Kontakt (Kundendienst) ----------
     Lädt erst etwas, wenn das Fenster geöffnet wird. Firebase (Melden) erst beim Abschicken. */
  var DB = "https://krawallzoo-default-rtdb.europe-west1.firebasedatabase.app";
  var FB_CFG = { apiKey: "AIzaSyBaCkktmwGDgr6v_8p85aa2Fl6NsjODFMQ", authDomain: "krawallzoo.firebaseapp.com", databaseURL: DB, projectId: "krawallzoo", storageBucket: "krawallzoo.firebasestorage.app", messagingSenderId: "780974811882", appId: "1:780974811882:web:5f6fb526a931ae3715c593" };
  var FB_JS = "https://cdn.jsdelivr.net/npm/firebase@10.12.2/";
  var FAQ = [
    { f: "Was ist Kometenwerk?", a: "Kometenwerk ist ein junges Studio aus Deutschland. Wir bauen Spiele, Apps und Technik – kostenlos und ohne Werbung.", k: ["kometenwerk", "wer seid", "wer bist", "was ist das", "firma", "studio", "dahinter", "uber euch"] },
    { f: "Kostet das etwas?", a: "Nein. Alle Apps und Spiele von Kometenwerk sind kostenlos. Es gibt keine Werbung und nichts zu kaufen.", k: ["kostet", "kosten", "preis", "bezahlen", "geld", "gratis", "kostenlos", "abo", "kaufen"] },
    { f: "Wo sind meine Daten gespeichert?", a: "Deine Notizen, Hausaufgaben, Lernkarten und Beats bleiben nur auf deinem Gerät, im Speicher deines Browsers. Wir bekommen sie nicht zu sehen.", k: ["daten", "gespeichert", "speichert", "datenschutz", "privat", "sicher gespeichert", "wo sind"] },
    { f: "Meine Sachen sind weg – was jetzt?", a: "Deine Sachen liegen im Browser. Wenn du die Browserdaten löschst oder ein anderes Gerät nimmst, sind sie dort nicht. Tipp: Unten in jeder App gibt es „Sicherung speichern“. Mit „Sicherung laden“ holst du sie zurück – auch auf ein neues Gerät.", k: ["weg", "verloren", "geloscht", "verschwunden", "sicherung", "backup", "neues gerat", "handy gewechselt", "wiederherstellen", "zuruck holen"] },
    { f: "Wie installiere ich eine App?", a: "Öffne die App und tipp oben auf „Als App installieren“. Auf dem iPhone: unten auf „Teilen“ und dann „Zum Home-Bildschirm“. Danach startet sie wie eine normale App und geht auch offline.", k: ["installieren", "install", "home bildschirm", "homebildschirm", "herunterladen", "download", "app store", "iphone", "android", "offline"] },
    { f: "Eine App lädt nicht oder ist veraltet", a: "Lade die Seite neu (am PC: F5). Wenn du noch die alte Version siehst, schließ die App ganz und öffne sie nochmal – die neue Version wird im Hintergrund geladen. Klappt es dann immer noch nicht, melde den Fehler.", k: ["ladt nicht", "geht nicht", "funktioniert nicht", "kaputt", "hangt", "weiss", "leer", "alte version", "veraltet", "update", "fehler", "bug", "absturz", "sturzt"] },
    { f: "Wie spiele ich Krawallzoo?", a: "Krawallzoo läuft direkt im Browser unter kometenwerk.github.io/Krawallzoo/ – ohne Anmeldung mit E-Mail. Wenn ein Online-Spiel hängt, lade die Seite neu. Fehler kannst du hier unter „Melden“ schicken.", k: ["krawallzoo", "spiel", "spielen", "zoo", "tiere", "arena", "zocken", "game"] },
    { f: "Wie funktioniert die Suche?", a: "Die Kometen-Suche läuft in deinem Browser und durchsucht alle unsere Apps und auf Wunsch das Lexikon Wikipedia. Für das ganze Internet gibt es einen Link zu DuckDuckGo mit Jugendschutz. Deine Suchen speichern wir nicht.", k: ["suche", "suchen", "wikipedia", "duckduckgo", "google", "internet"] },
    { f: "Ist Kometenwerk sicher für Kinder?", a: "Ja, darauf achten wir: Es gibt keinen Chat mit Fremden, keine Werbung und wir sammeln keine Daten über dich.", k: ["kinder", "sicher", "jugendschutz", "fremde", "chat", "eltern", "werbung", "gefahrlich"] },
    { f: "Wie melde ich einen Fehler oder eine Idee?", a: "Tipp oben auf „📣 Melden“, wähl die App und schreib kurz, was passiert ist. Wir lesen jede Meldung.", k: ["melden", "meldung", "idee", "vorschlag", "wunsch", "feedback", "verbesserung"], geh: "melden" },
    { f: "Kann ich euch anrufen oder schreiben?", a: "Eine Telefonnummer und einen Chat haben wir nicht – so bleibt alles sicher. Fehler und Ideen schickst du über „Melden“. Vereine und Betriebe können über „Termin“ ein Gespräch per Telefon oder Video anfragen.", k: ["anrufen", "telefon", "telefonieren", "nummer", "kontakt", "e mail", "email", "schreiben", "erreichen", "sprechen", "mitarbeiter", "mensch"], geh: "termin" },
    { f: "Baut ihr auch Webseiten für Vereine?", a: "Ja! Wir bauen Webseiten und kleine Apps für Vereine und Betriebe. Unter „Termin“ siehst du freie Zeiten, auf der Kunden-Seite alle Angebote.", k: ["webseite", "website", "homepage", "verein", "betrieb", "firma", "auftrag", "angebot", "kunde", "termin", "beratung"], geh: "termin" }
  ];
  function wortGleich(t, k) { return (" " + t + " ").indexOf(" " + k) >= 0; }
  function faqFinden(text) {
    var t = norm(text).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim(), best = null;
    FAQ.forEach(function (x) {
      var s = 0; x.k.forEach(function (k) { if (wortGleich(t, k)) s += k.indexOf(" ") > 0 ? 3 : 2; });
      if (norm(x.f).replace(/[^a-z0-9 ]+/g, " ").trim() === t) s += 10;
      if (s && (!best || s > best.s)) best = { x: x, s: s };
    });
    return best && best.x;
  }
  var hLog = [], hSprechen = false;
  function botAntwort(text) {
    var t = norm(text);
    if (/^(hallo|hi|hey|moin|servus|guten (morgen|tag|abend))\b/.test(t) && t.length < 25) return { a: "Hallo! 👋 Ich bin der Hilfe-Bot von Kometenwerk. Frag mich zum Beispiel, wo deine Daten gespeichert sind oder wie du eine App installierst." };
    if (/^(danke|dankeschoen|super|cool|ok|okay)\b/.test(t)) return { a: "Gern geschehen! 😊" };
    var x = faqFinden(text);
    if (x) return { a: x.a, geh: x.geh };
    return { a: "Das weiß ich leider nicht. 🤔 Schau unten bei den häufigen Fragen – oder schick uns deine Frage als Idee über „Melden“. Wir lesen alles.", geh: "melden" };
  }
  var GEH_TEXT = { melden: "📣 Zum Melden", termin: "📅 Zu den Terminen" };
  function hLogZeigen() {
    var el = $("#hLog");
    el.innerHTML = hLog.length ? hLog.map(function (m) {
      return '<div class="h-msg ' + m.wer + '">' + esc(m.text) + (m.geh ? '<br><button type="button" class="h-link" data-geh="' + m.geh + '">' + GEH_TEXT[m.geh] + ' ›</button>' : "") + (m.laden ? '<br><button type="button" class="btn h-primaer" id="hAsrJa">Ja, Spracheingabe laden</button>' : "") + '</div>';
    }).join("") : '<div class="h-msg bot">Hallo! 👋 Ich bin der Hilfe-Bot. Was möchtest du wissen?</div>';
    el.scrollTop = el.scrollHeight;
  }
  function fragen(text) {
    text = String(text || "").trim(); if (!text) return;
    hLog.push({ wer: "du", text: text });
    var r = botAntwort(text); hLog.push({ wer: "bot", text: r.a, geh: r.geh }); hLog = hLog.slice(-20); hLogZeigen();
    if (hSprechen) vorlesen(r.a);
    hSprechen = false;
  }
  function vorlesen(t) {
    if (!("speechSynthesis" in window)) return;
    try {
      // Nur Stimmen, die auf dem Gerät laufen (sonst ginge der Text an einen Online-Dienst)
      var st = speechSynthesis.getVoices().filter(function (v) { return /^de/i.test(v.lang) && v.localService; });
      if (!st.length) return;
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(String(t).replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, " ").replace(/\s+/g, " ").trim());
      u.lang = "de-DE"; u.voice = st[0]; speechSynthesis.speak(u);
    } catch (e) {}
  }
  $("#hFaq").innerHTML = FAQ.map(function (x) { return '<details class="h-faq"><summary>' + esc(x.f) + '</summary><p>' + esc(x.a) + '</p></details>'; }).join("");
  $("#hSenden").addEventListener("click", function () { var i = $("#hText"); fragen(i.value); i.value = ""; i.focus(); });
  $("#hText").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); $("#hSenden").click(); } });

  /* Spracheingabe: Whisper läuft im Browser (dasselbe Modell wie bei Sofie im Team-Chat) */
  var TRANS = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6", ASR = null, asrLaden = null;
  function asrOk() { try { return localStorage.getItem("kw-hilfe-asr") === "ja"; } catch (e) { return false; } }
  function micInfo(t) { $("#hMicInfo").textContent = t || "🎙️ Du kannst auch sprechen – die Spracherkennung läuft nur auf deinem Gerät."; }
  function asrHolen() {
    if (ASR) return Promise.resolve(ASR);
    if (asrLaden) return asrLaden;
    var gpu = "gpu" in navigator ? navigator.gpu.requestAdapter().then(function (a) { return !!a; }).catch(function () { return false; }) : Promise.resolve(false);
    asrLaden = gpu.then(function (g) {
      return import(TRANS).then(function (tf) {
        tf.env.allowLocalModels = false;
        var dateien = {}, opts = g ? { device: "webgpu", dtype: { encoder_model: "fp32", decoder_model_merged: "q4" } } : { dtype: "q8" };
        opts.progress_callback = function (p) {
          if (p && p.status === "progress" && p.total) { dateien[p.file] = [p.loaded, p.total]; var a = 0, b = 0; for (var k in dateien) { a += dateien[k][0]; b += dateien[k][1]; } micInfo("🎙️ Spracheingabe lädt (nur beim ersten Mal) … " + Math.round(a / b * 100) + " %"); }
        };
        return tf.pipeline("automatic-speech-recognition", "onnx-community/whisper-base", opts);
      });
    }).then(function (p) { ASR = p; micInfo(); return p; }).catch(function (e) { asrLaden = null; micInfo("😕 Die Spracheingabe ging gerade nicht. Du kannst die Frage auch eintippen."); throw e; });
    return asrLaden;
  }
  var rec = null, recTeile = [], recStart = 0, recStream = null, recTimer = null;
  function micZeigen(an) { var b = $("#hMic"); b.classList.toggle("an", an); b.setAttribute("aria-pressed", an ? "true" : "false"); b.textContent = an ? "⏺" : "🎙️"; if (an) micInfo("● Ich höre zu … tipp nochmal aufs Mikrofon, wenn du fertig bist."); else if (ASR) micInfo(); }
  function aufnahme() {
    if (rec) { stopp(); return; }
    if (!asrOk()) { hLog.push({ wer: "bot", text: "Für die Spracheingabe lädt dein Browser einmal ein Sprachmodell (etwa 80 MB, am besten im WLAN). Danach hört es nur auf deinem Gerät zu – deine Stimme wird nirgends hingeschickt.", laden: true }); hLogZeigen(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { micInfo("Dieser Browser kann leider nicht aufnehmen. Tipp die Frage einfach ein."); return; }
    navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }).then(function (s) {
      recStream = s; asrHolen().catch(function () {});
      if ("speechSynthesis" in window) speechSynthesis.cancel();
      recTeile = []; rec = new MediaRecorder(s);
      rec.ondataavailable = function (e) { if (e.data && e.data.size) recTeile.push(e.data); };
      rec.onstop = fertig; rec.start(); recStart = Date.now(); micZeigen(true);
      recTimer = setTimeout(stopp, 12000);
    }).catch(function () { micInfo("Ich darf das Mikrofon nicht benutzen. Erlaube es oben in der Adressleiste – oder tipp die Frage ein."); });
  }
  function stopp() { if (!rec || rec.state === "inactive") return; clearTimeout(recTimer); rec.stop(); if (recStream) recStream.getTracks().forEach(function (t) { t.stop(); }); micZeigen(false); }
  function fertig() {
    var typ = rec && rec.mimeType, blob = new Blob(recTeile, typ ? { type: typ } : {}); rec = null;
    if (Date.now() - recStart < 600 || !blob.size) { micInfo(); return; }
    micInfo("🎙️ Ich höre genau hin …");
    blob.arrayBuffer().then(function (buf) {
      var ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      return ctx.decodeAudioData(buf).then(function (a) { try { ctx.close(); } catch (e) {} return a.getChannelData(0); });
    }).then(function (daten) { return asrHolen().then(function (asr) { micInfo("🎙️ Ich höre genau hin …"); return asr(daten, { language: "german", task: "transcribe" }); }); })
      .then(function (out) {
        micInfo();
        var t = String((out && out.text) || "").replace(/^\s*[\[(].*?[\])]\s*$/, "").trim();
        if (!t) { hLog.push({ wer: "bot", text: "Ich habe nichts verstanden. Versuch es nochmal etwas lauter." }); hLogZeigen(); return; }
        hSprechen = true; fragen(t);
      }).catch(function () { micInfo("😕 Das hat gerade nicht geklappt. Tipp die Frage einfach ein."); });
  }
  $("#hMic").addEventListener("click", aufnahme);
  $("#hLog").addEventListener("click", function (e) {
    if (e.target.id === "hAsrJa") { try { localStorage.setItem("kw-hilfe-asr", "ja"); } catch (x) {} e.target.remove(); asrHolen().then(function () { hLog.push({ wer: "bot", text: "Fertig! 🎙️ Tipp jetzt aufs Mikrofon und stell deine Frage." }); hLogZeigen(); }).catch(function () {}); }
  });

  /* Status, Neuigkeiten und freie Zeiten: nur lesen, ohne Firebase-Bibliothek */
  var pub = null;
  function holeJson(url, ms) {
    var ctrl = "AbortController" in window ? new AbortController() : null, t = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms || 6000);
    return fetch(url, ctrl ? { cache: "no-cache", signal: ctrl.signal } : { cache: "no-cache" }).then(function (r) { clearTimeout(t); if (!r.ok) throw 0; return r.json(); }, function (e) { clearTimeout(t); throw e; });
  }
  function pubHolen() {
    if (pub) return Promise.resolve(pub);
    return holeJson(DB + "/public.json").then(function (d) { pub = d || {}; return pub; }).catch(function () { return null; });
  }
  function wannText(ts) { var d = new Date(ts); return isNaN(d) ? "" : d.toLocaleDateString("de-DE", { day: "numeric", month: "long" }); }
  function statusZeigen(p) {
    var el = $("#hStatus");
    if (!p) { el.className = "h-status"; el.textContent = "Der Status ist gerade nicht abrufbar. Die Hilfe unten funktioniert trotzdem."; return; }
    var s = p.status || { art: "ok", text: "" };
    el.className = "h-status " + (s.art === "warn" ? "warn" : "ok");
    el.textContent = (s.art === "warn" ? "🟡 " : "🟢 ") + (s.text || (s.art === "warn" ? "Bei einer App gibt es gerade ein Problem. Wir arbeiten dran." : "Alle Apps laufen."));
  }
  function neuZeigen(p) {
    var el = $("#hNeu");
    if (!p) { el.innerHTML = '<p class="h-klein">Gerade nicht abrufbar.</p>'; return; }
    var n = p.neu || {}, k = Object.keys(n).filter(function (x) { return n[x] && n[x].text; }).sort(function (a, b) { return (n[b].t || 0) - (n[a].t || 0); });
    el.innerHTML = k.length ? '<ul class="h-neu">' + k.slice(0, 20).map(function (x) { return '<li><span class="h-klein">' + esc(wannText(n[x].t)) + '</span><br>' + esc(n[x].text) + '</li>'; }).join("") + '</ul>' : '<p class="h-klein">Hier stehen bald Neuigkeiten und reparierte Fehler.</p>';
  }
  var WD = ["so", "mo", "di", "mi", "do", "fr", "sa"];
  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function freieZeiten(C, zu, max) {
    var out = [], T = +C.terminMinuten || 30, grenze = Date.now() + (+C.vorlaufStunden || 24) * 3600000, gesp = C.gesperrt || [], bel = C.belegt || [];
    for (var i = 0; i <= (+C.wochen || 3) * 7 && out.length < max; i++) {
      var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i);
      var tag = ymd(d); if (gesp.indexOf(tag) >= 0 || zu[tag]) continue;
      ((C.sprechzeiten || {})[WD[d.getDay()]] || []).forEach(function (r) {
        var p = String(r).split("-"); if (p.length !== 2) return;
        var a = p[0].split(":"), b = p[1].split(":"), m0 = +a[0] * 60 + +a[1], m1 = +b[0] * 60 + +b[1];
        for (var m = m0; m + T <= m1 && out.length < max; m += T) {
          var zeit = String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"), ts = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(m / 60), m % 60).getTime();
          if (ts < grenze || bel.indexOf(tag + " " + zeit) >= 0 || zu[tag + " " + zeit]) continue;
          out.push({ tag: tag, zeit: zeit, d: d });
        }
      });
    }
    return out;
  }
  var termineGeladen = false;
  function termineZeigen() {
    if (termineGeladen) return; termineGeladen = true;
    Promise.all([holeJson(BASE + "kunden/einstellungen.json").catch(function () { return null; }), pubHolen()]).then(function (r) {
      var C = r[0], el = $("#hTermine");
      if (!C) { el.innerHTML = '<p class="h-klein">Die Termine konnten gerade nicht geladen werden. Schau auf der Kunden-Seite nach.</p>'; termineGeladen = false; return; }
      var bald = !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(C.email || "") || /example\.(com|org|net)$/i.test(C.email || "");
      if (bald) { el.innerHTML = '<p class="h-bald">⏳ <b>Termin-Anfragen sind bald freigeschaltet.</b> Schau gern bald wieder vorbei!</p>'; return; }
      var zu = {}; ((r[1] && r[1].verfuegbar && r[1].verfuegbar.zu) || "").split(",").forEach(function (k) { if (k) zu[k.trim()] = true; });
      var f = freieZeiten(C, zu, 6);
      el.innerHTML = f.length ? '<p class="h-klein">Die nächsten freien Zeiten (' + (+C.terminMinuten || 30) + ' Minuten):</p><div class="h-slots">' + f.map(function (x) {
        var lang = x.d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" });
        return '<a class="h-slot" href="' + BASE + 'kunden/?slot=' + encodeURIComponent(x.tag + " " + x.zeit) + '" aria-label="Termin am ' + esc(x.d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })) + ' um ' + x.zeit + ' Uhr anfragen">' + esc(lang) + '<b>' + x.zeit + '</b></a>';
      }).join("") + '</div><p class="h-klein">Tipp auf eine Zeit – auf der nächsten Seite wählst du Telefon oder Video und schickst die Anfrage per E-Mail.</p>'
        : '<p class="h-klein">Gerade sind alle Zeiten vergeben. Auf der Kunden-Seite kannst du auch ohne festen Termin anfragen.</p>';
    });
  }

  /* Melden: Firebase wird erst jetzt geladen (anonym, ohne Konto) */
  function skript(src) { return new Promise(function (ok, nein) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = nein; document.head.appendChild(s); }); }
  var fbBereit = null;
  function fbHolen() {
    if (fbBereit) return fbBereit;
    fbBereit = (window.firebase ? Promise.resolve() : skript(FB_JS + "firebase-app-compat.js").then(function () { return skript(FB_JS + "firebase-auth-compat.js"); }).then(function () { return skript(FB_JS + "firebase-database-compat.js"); }))
      .then(function () {
        if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(FB_CFG);
        var auth = firebase.auth();
        // Nichts auf dem Gerät merken: neue zufällige Kennung pro Besuch
        var p = auth.setPersistence && firebase.auth.Auth ? auth.setPersistence(firebase.auth.Auth.Persistence.NONE) : Promise.resolve();
        return p.then(function () { return auth.currentUser || auth.signInAnonymously(); }).then(function () { return firebase.database(); });
      }).catch(function (e) { fbBereit = null; throw e; });
    return fbBereit;
  }
  var letzteMeldung = 0;
  function meldFehler(t) { var el = $("#hMeldFehler"); el.textContent = t || ""; el.hidden = !t; }
  $("#hMeldenBtn").addEventListener("click", function () {
    var text = $("#hMeldung").value.replace(/\s+\n/g, "\n").trim(), art = (document.querySelector('input[name="hArt"]:checked') || {}).value || "fehler", app = $("#hApp").value;
    if (text.length < 3) { meldFehler("Schreib bitte kurz, was los ist (mindestens ein paar Wörter)."); return; }
    if (/(https?:|www\.)/i.test(text)) { meldFehler("Bitte ohne Links."); return; }
    if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(text) || /(\+?\d[\d \/\-()]{6,}\d)/.test(text)) { meldFehler("🔒 Bitte keine E-Mail-Adressen oder Telefonnummern – zu deiner Sicherheit."); return; }
    if (Date.now() - letzteMeldung < 60000) { meldFehler("Danke! Bitte warte eine Minute bis zur nächsten Meldung."); return; }
    meldFehler(""); var b = $("#hMeldenBtn"); b.disabled = true; b.textContent = "Wird geschickt …";
    fbHolen().then(function (db) {
      var u = {}, uid = firebase.auth().currentUser.uid, k = db.ref("feedback").push().key, TS = firebase.database.ServerValue.TIMESTAMP;
      u["feedback/" + k] = { app: app, art: art, text: text.slice(0, 500), t: TS, uid: uid };
      u["feedbackZeit/" + uid] = TS;
      return db.ref().update(u);
    }).then(function () {
      letzteMeldung = Date.now(); $("#hMeldung").value = ""; $("#hDanke").hidden = false;
      setTimeout(function () { $("#hDanke").hidden = true; }, 8000);
    }).catch(function (e) {
      meldFehler(/permission/i.test(String(e && (e.code || e.message))) ? "Das ging gerade nicht. Warte bitte eine Minute und versuch es nochmal." : "Keine Verbindung. Versuch es gleich nochmal.");
    }).then(function () { b.disabled = false; b.textContent = "Abschicken"; });
  });

  /* Fenster und Reiter */
  function reiter(w) {
    document.querySelectorAll("#hilfe [data-h]").forEach(function (b) { b.setAttribute("aria-selected", b.dataset.h === w ? "true" : "false"); });
    document.querySelectorAll("#hilfe .h-p").forEach(function (p) { p.hidden = p.dataset.p !== w; });
    if (w === "termin") termineZeigen();
    if (w === "melden") setTimeout(function () { $("#hMeldung").focus(); }, 30);
  }
  function hilfeAuf(w) {
    var d = $("#hilfe"); if (!d.open) d.showModal();
    reiter(w || "fragen"); hLogZeigen();
    pubHolen().then(function (p) { statusZeigen(p); neuZeigen(p); });
  }
  $("#hilfe").addEventListener("click", function (e) {
    var t = e.target.closest("[data-h]"); if (t) { reiter(t.dataset.h); return; }
    var g = e.target.closest("[data-geh]"); if (g) { reiter(g.dataset.geh); return; }
  });
  $("#hZu").addEventListener("click", function () { $("#hilfe").close(); });
  $("#hilfe").addEventListener("close", function () { stopp(); if ("speechSynthesis" in window) speechSynthesis.cancel(); if (/^#hilfe/.test(location.hash)) history.replaceState(null, "", location.pathname + location.search); });
  document.querySelectorAll("[data-hilfe]").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); hilfeAuf(a.dataset.hilfe || "fragen"); }); });
  function hashPruefen() { var m = location.hash.match(/^#hilfe(?:-(fragen|melden|termin|neu))?$/); if (m) hilfeAuf(m[1]); }
  window.addEventListener("hashchange", hashPruefen);
  hashPruefen();
  window.KWHilfe = { auf: hilfeAuf };
})();
