/* OMNIVIA Video-Studio – „Thorsten zockt“
   Wird vom Team-Chat erst bei Bedarf geladen (team.js → OMNI_STUDIO.zeigen).
   Ablauf: Krawallzoo läuft im Zuschauer-Modus (alle Tiere sind Bots, eins spielt Thorsten).
   Das Studio zeichnet das Spiel ab, legt Thorstens Avatar, Untertitel, Intro und Schlusskarte darüber
   und mischt Spielton + Thorstens Stimme (shared/thorsten). Ergebnis: WebM-Video + Vorschaubild.
   Alles passiert im Browser – nichts wird hochgeladen, bis du selbst auf „YouTube“ tippst. */
(function () {
  "use strict";
  var A = null, wurzel = "../../";
  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- Einstellungen ---------------- */
  var MODI = [["ffa", "Zoo-Chaos (alle gegen alle)"], ["duel", "Krawall-Duell (1 gegen 1)"], ["gem", "Futterjagd (3 gegen 3)"], ["ball", "Zoo-Ball (3 gegen 3)"], ["steal", "Waffenklau (3 gegen 3)"], ["heist", "Gehege knacken (3 gegen 3)"]];
  var LAENGEN = { breit: [[60, "1 Minute"], [180, "3 Minuten"], [300, "5 Minuten"], [600, "10 Minuten"]], hoch: [[30, "30 Sekunden"], [45, "45 Sekunden"], [58, "58 Sekunden"]] };
  var FORMATE = { breit: { w: 1280, h: 720, name: "YouTube-Video (16:9)" }, hoch: { w: 1080, h: 1920, name: "Short (hochkant)" } };
  var SPIELE = {
    krawallzoo: { name: "🎮 Krawallzoo – Thorsten zockt", titel: "THORSTEN ZOCKT", spiel: "Krawallzoo", marke: "FLARESSA", url: "Krawallzoo/?zuschauer=1&modus=" },
    zeigen: { name: "🏙️ Horizonte – Thorsten zeigt seine Stadt", titel: "THORSTEN ZEIGT", spiel: "Horizonte", marke: "FLARESSA", url: "spiele/inselstadt/?zuschauer=1&art=zeigen" },
    bauen: { name: "🏗️ Horizonte – Thorsten baut eine Stadt", titel: "THORSTEN BAUT", spiel: "Horizonte", marke: "FLARESSA", url: "spiele/inselstadt/?zuschauer=1&art=bauen" },
    werbung: { name: "📣 Werbe-Short – Thorsten stellt eine App vor", titel: "THORSTEN STELLT VOR", spiel: "OMNIVIA", marke: "OMNIVIA", url: null }
  };
  var APPS = null, appsLaden = null;
  function appsVorladen() {
    if (!appsLaden) appsLaden = fetch(wurzel + "shared/thorsten/apps.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (j) { APPS = j.apps || []; return APPS; }).catch(function () { appsLaden = null; APPS = []; return APPS; });
    return appsLaden;
  }
  // Welche App ist heute dran? Jeden Tag eine andere, ab und zu eine, die bald kommt
  function appWaehlen() {
    var alle = (APPS || []).filter(function (a) { return a.status === "bald" || (a.bilder && a.bilder.length); });
    if (!alle.length) return null;
    var zuletzt = A.lade("omni-studio-apps", []), bald = alle.filter(function (a) { return a.status === "bald"; }), fertig = alle.filter(function (a) { return a.status !== "bald"; });
    var topf = bald.length && Math.random() < 0.3 ? bald : fertig.length ? fertig : bald;
    var frei = topf.filter(function (a) { return zuletzt.indexOf(a.id) < 0; });
    if (!frei.length) { frei = topf; zuletzt = []; }
    var a = frei[Math.floor(Math.random() * frei.length)];
    zuletzt.push(a.id); A.merke("omni-studio-apps", zuletzt.slice(-Math.max(1, alle.length - 1)));
    return a;
  }
  function ein() { var e = A.lade("omni-studio", { spiel: "krawallzoo", format: "breit", laenge: 180, modus: "ffa", stimme: true, spielton: true, hoeren: true }); if (!SPIELE[e.spiel]) e.spiel = "krawallzoo"; return e; }
  function hz() { return Z && (Z.spiel === "zeigen" || Z.spiel === "bauen"); }
  function wb() { return Z && Z.spiel === "werbung"; }

  /* ---------------- Zustand ---------------- */
  var Z = null; // läuft gerade: { aufnahme, start, dauer, ... }
  var ergebnis = null; // { blob, url, vorschau, vorschauUrl, titel, beschreibung, tags, format }
  var ton = null; // Thorstens Sätze { gruppe: [ {id,text,datei,dauer} ] }
  var tonLaden = null;

  function laeuft() { return !!(Z && Z.aufnahme); }

  /* ================================================================
     Oberfläche
     ================================================================ */
  function zeigen(box, api) {
    A = api; wurzel = api.wurzel || "../../";
    var e = ein(), esc = A.esc;
    var laengen = LAENGEN[e.format] || LAENGEN.breit;
    box.innerHTML =
      '<div class="studio">' +
      '<p class="hinweis" id="stErklaer"></p>' +
      '<div class="st-entscheidet"><button class="knopf" type="button" id="stWuerfel">🎲 Thorsten, was machen wir heute?</button><p class="hinweis" id="stWahl" hidden></p></div>' +
      '<div class="st-bild" id="stBild"><iframe id="stSpiel" title="Spiel im Zuschauer-Modus" tabindex="-1" aria-hidden="true" allow="autoplay"></iframe><canvas id="stLeinwand"></canvas>' +
      '<div class="st-leer" id="stLeer"><div class="gross">🎬</div><b>Noch nichts zu sehen</b><span>Tipp auf „Vorschau“, um zu testen, oder direkt auf „Aufnahme starten“.</span></div></div>' +
      '<div class="st-leiste"><span class="st-rec" id="stRec" hidden>● REC</span><span id="stZeit">–</span><span id="stInfo" class="st-info"></span></div>' +
      '<form class="st-einst" id="stForm">' +
      '<div class="feld st-voll"><label for="stSpielWahl">Was macht Thorsten?</label><select id="stSpielWahl">' + Object.keys(SPIELE).map(function (k) { return '<option value="' + k + '"' + (e.spiel === k ? " selected" : "") + ">" + SPIELE[k].name + "</option>"; }).join("") + "</select></div>" +
      '<div class="feld"><label for="stFormat">Format</label><select id="stFormat">' + Object.keys(FORMATE).map(function (k) { return '<option value="' + k + '"' + (e.format === k ? " selected" : "") + ">" + FORMATE[k].name + "</option>"; }).join("") + "</select></div>" +
      '<div class="feld"><label for="stLaenge">Länge</label><select id="stLaenge">' + laengen.map(function (l) { return '<option value="' + l[0] + '"' + (+e.laenge === l[0] ? " selected" : "") + ">" + l[1] + "</option>"; }).join("") + "</select></div>" +
      '<div class="feld" id="stAppFeld" hidden><label for="stApp">Welche App?</label><select id="stApp"><option value="">🎲 Thorsten sucht aus</option></select></div>' +
      '<div class="feld" id="stModusFeld"><label for="stModus">Spielmodus</label><select id="stModus">' + MODI.map(function (m) { return '<option value="' + m[0] + '"' + (e.modus === m[0] ? " selected" : "") + ">" + m[1] + "</option>"; }).join("") + "</select></div>" +
      '<div class="st-haken"><label><input type="checkbox" id="stStimme"' + (e.stimme ? " checked" : "") + "> Thorsten spricht</label>" +
      '<label><input type="checkbox" id="stSpielton"' + (e.spielton ? " checked" : "") + "> Spielsound im Video</label>" +
      '<label><input type="checkbox" id="stHoeren"' + (e.hoeren ? " checked" : "") + "> Ich höre mit</label></div>" +
      "</form>" +
      '<div class="reihe st-knoepfe"><button class="knopf" type="button" id="stVorschau">▶ Vorschau</button><button class="knopf haupt" type="button" id="stAufnahme">⏺ Aufnahme starten</button><button class="knopf gefahr" type="button" id="stStopp" hidden>■ Stopp</button></div>' +
      '<p class="hinweis" id="stTonHinweis" hidden></p>' +
      '<div id="stErgebnis"></div>' +
      '<div class="st-auto"><label class="st-schalter"><input type="checkbox" id="stAuto"' + (A.lade("omni-studio-auto", false) ? " checked" : "") + '> <b>🤖 Thorsten arbeitet allein</b></label><p class="hinweis" id="stAutoInfo"></p>' +
      '<p class="hinweis">Jeden Tag 3 Videos, sobald der PC an und der Team-Chat offen ist: 🎮 Krawallzoo, 🏙️ Horizonte und ein 📣 Werbe-Short. Das Fenster darf nicht minimiert sein. Nichts geht von allein auf YouTube – du gibst jedes Video unten frei.</p></div>' +
      '<div id="stFreigabe" class="st-freigabe"></div>' +
      '<p class="hinweis">💡 Die Aufnahme dauert so lange wie das Video. Lass diesen Tab <b>vorne und offen</b> (am besten am PC) – sonst ruckelt das Video. Thorsten ist eine KI-Figur: Im Video steht immer „KI-Stimme“, und in der Beschreibung steht, dass es Computer-Gegner sind.</p>' +
      "</div>";
    $("stFormat").onchange = function () {
      var f = this.value, s = $("stLaenge"), l = LAENGEN[f];
      s.innerHTML = l.map(function (x, i) { return '<option value="' + x[0] + '"' + (i === (f === "hoch" ? 2 : 1) ? " selected" : "") + ">" + x[1] + "</option>"; }).join("");
      merken();
    };
    ["stLaenge", "stModus", "stStimme", "stSpielton", "stHoeren"].forEach(function (id) { $(id).onchange = merken; });
    $("stSpielWahl").onchange = function () { merken(); spielAnzeige(); };
    $("stWuerfel").onclick = entscheiden;
    spielAnzeige();
    $("stHoeren").addEventListener("change", function () { if (Z) hoeren(this.checked); });
    var bild = $("stBild"), passen = function () { bild.style.setProperty("--sk", (bild.clientWidth / 1280).toFixed(4)); };
    if (window.ResizeObserver) new ResizeObserver(passen).observe(bild); passen();
    $("stVorschau").onclick = function () { starten(false); };
    $("stAufnahme").onclick = function () { starten(true); };
    $("stStopp").onclick = function () { stoppen(true); };
    tonVorladen();
    appsVorladen().then(function (l) { var sel = $("stApp"); if (!sel) return; sel.innerHTML = '<option value="">🎲 Thorsten sucht aus</option>' + l.map(function (a) { return '<option value="' + A.esc(a.id) + '"' + (ein().app === a.id ? " selected" : "") + ">" + A.esc(a.name) + (a.status === "bald" ? " (bald)" : "") + "</option>"; }).join(""); sel.onchange = merken; });
    if (ergebnis) ergebnisZeigen();
    $("stAuto").onchange = function () { A.merke("omni-studio-auto", this.checked); if (this.checked) { autoStarten(A); A.toast("🤖 Automatik an – Thorsten legt los, sobald er Zeit hat."); } autoAnzeigen(); };
    autoAnzeigen(); freigabeZeigen();
    if (autoAn()) autoStarten(A);
  }
  function spielAnzeige() {
    var k = $("stSpielWahl").value;
    $("stModusFeld").hidden = k !== "krawallzoo";
    $("stAppFeld").hidden = k !== "werbung";
    if (k === "werbung" && $("stFormat").value !== "hoch") { $("stFormat").value = "hoch"; $("stFormat").onchange(); }
    $("stFormat").disabled = k === "werbung" || !!Z;
    $("stErklaer").innerHTML = {
      krawallzoo: "🎮 <b>Thorsten zockt Krawallzoo.</b> Die Tiere spielen als Bots, eins davon ist Thorstens Tier. Thorsten kommentiert, was passiert.",
      zeigen: "🏙️ <b>Thorsten zeigt seine Stadt.</b> Kameraflug durch Horizonte: Häuser, Bahnhof, Hafen, Verkehr und Nacht. Hast du auf diesem Gerät einen Horizonte-Spielstand, zeigt er <b>deine</b> Stadt.",
      bauen: "🏗️ <b>Thorsten baut eine Stadt.</b> Er denkt sich jedes Mal eine eigene Idee aus (Stadtform, Schwerpunkt, vorsichtig oder chaotisch), baut im Zeitraffer und repariert, was schiefgeht.",
      werbung: "📣 <b>Thorsten stellt eine App vor.</b> Ein Short (hochkant) mit echten Bildern aus der App – oder ein Teaser für eine App, die bald kommt. Thorsten sucht sich die App selbst aus."
    }[k] + " Du schaust zu – am Ende bekommst du das fertige Video.";
  }
  // „Thorsten entscheidet“: Abwechslung nach einem kleinen Wochenplan
  function entscheiden() {
    var verlauf = A.lade("omni-studio-verlauf", []), letzte = verlauf.slice(-3), tag = new Date().getDay();
    var plan = { 0: ["zeigen", "breit"], 1: ["krawallzoo", "hoch"], 2: ["bauen", "hoch"], 3: ["krawallzoo", "breit"], 4: ["zeigen", "hoch"], 5: ["krawallzoo", "hoch"], 6: ["bauen", "breit"] }[tag];
    var spiel = plan[0], format = plan[1], grund = [];
    var zaehle = function (sp) { return letzte.filter(function (v) { return v.spiel === sp; }).length; };
    if (zaehle(spiel) >= 2) { var andere = Object.keys(SPIELE).filter(function (k) { return k !== spiel; }).sort(function (a, b) { return zaehle(a) - zaehle(b); }); spiel = andere[0]; grund.push("die letzten Videos waren oft dasselbe – Abwechslung muss sein"); }
    else grund.push(["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"][tag] + " ist bei mir " + (spiel === "krawallzoo" ? "Krawall-Tag" : spiel === "bauen" ? "Bau-Tag" : "Stadtrundflug-Tag"));
    var letzt = verlauf[verlauf.length - 1];
    if (letzt && letzt.format === format && Math.random() < 0.5) { format = format === "hoch" ? "breit" : "hoch"; grund.push("zur Abwechslung mal " + (format === "hoch" ? "ein Short" : "ein längeres Video")); }
    var laenge = format === "hoch" ? (spiel === "bauen" ? 58 : [45, 58][Math.floor(Math.random() * 2)]) : spiel === "krawallzoo" ? [180, 300][Math.floor(Math.random() * 2)] : spiel === "bauen" ? 180 : 120;
    var modi = MODI.map(function (m) { return m[0]; }).filter(function (m) { return !letzte.some(function (v) { return v.modus === m; }); });
    var modus = modi[Math.floor(Math.random() * modi.length)] || "ffa";
    $("stSpielWahl").value = spiel; $("stFormat").value = format; $("stFormat").onchange();
    if (![].some.call($("stLaenge").options, function (o) { return +o.value === laenge; })) $("stLaenge").innerHTML += '<option value="' + laenge + '">' + zeitText(laenge) + " Minuten</option>";
    $("stLaenge").value = String(laenge); $("stModus").value = modus;
    merken(); spielAnzeige();
    var w = $("stWahl"); w.hidden = false;
    w.innerHTML = "🤖 <b>Thorsten:</b> „Heute mache ich " + (format === "hoch" ? "ein Short" : "ein Video") + ": <b>" + SPIELE[spiel].name.replace(/^\S+\s/, "") + "</b>" + (spiel === "krawallzoo" ? " im Modus " + MODI.filter(function (m) { return m[0] === modus; })[0][1] : "") + ", " + zeitText(laenge) + " lang. Warum? " + grund.join(", ") + ".“ <br><small>Passt es? Dann tipp auf „Aufnahme starten“ – oder stell selbst etwas anderes ein.</small>";
  }
  function merken() {
    A.merke("omni-studio", { spiel: $("stSpielWahl").value, format: $("stFormat").value, laenge: +$("stLaenge").value, modus: $("stModus").value, stimme: $("stStimme").checked, spielton: $("stSpielton").checked, hoeren: $("stHoeren").checked, app: $("stApp") ? $("stApp").value : "" });
  }
  function verlassen() { if (Z && !Z.aufnahme) stoppen(false); }
  function info(t) { var el = $("stInfo"); if (el) el.textContent = t || ""; }
  function zeitText(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }

  /* ================================================================
     Thorstens Stimme
     ================================================================ */
  function tonVorladen() {
    if (tonLaden) return tonLaden;
    tonLaden = fetch(wurzel + "shared/thorsten/index.json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error("fehlt"); return r.json(); })
      .then(function (j) {
        ton = {};
        (j.saetze || []).forEach(function (s) { (ton[s.gruppe] = ton[s.gruppe] || []).push(s); });
        return ton;
      }).catch(function () {
        ton = null; tonLaden = null;
        var h = $("stTonHinweis");
        if (h) { h.hidden = false; h.textContent = "🎙️ Thorstens Stimme ist noch nicht fertig eingesprochen (das macht GitHub automatisch, dauert ein paar Minuten nach dem Hochladen). Bis dahin gibt es nur Untertitel."; }
        return null;
      });
    return tonLaden;
  }
  var puffer = {}; // id -> AudioBuffer
  function satzPuffer(ctx, s) {
    var k = s.id + "|" + (s.hash || ""); if (puffer[k]) return Promise.resolve(puffer[k]);
    return fetch(wurzel + "shared/thorsten/" + s.datei + "?v=" + encodeURIComponent(s.hash || ""), { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(function (b) { return ctx.decodeAudioData(b); }).then(function (ab) { puffer[k] = ab; return ab; });
  }

  /* ================================================================
     Start / Stopp
     ================================================================ */
  function starten(aufnahme, vorgabe) {
    if (Z) stoppen(false);
    if (!vorgabe) merken();
    var e = vorgabe || ein();
    if (e.spiel === "werbung") e.format = "hoch";
    var F = FORMATE[e.format] || FORMATE.breit;
    if (aufnahme && typeof MediaRecorder === "undefined") { A.toast("Dieser Browser kann keine Videos aufnehmen. Nimm Chrome oder Edge am PC."); return; }
    var lw = $("stLeinwand"); lw.width = F.w; lw.height = F.h;
    $("stBild").classList.toggle("hoch", e.format === "hoch");
    $("stLeer").hidden = true;
    // Ton vorbereiten (muss direkt im Klick passieren)
    var AC = window.AudioContext || window.webkitAudioContext, ctx = new AC();
    var ziel = ctx.createMediaStreamDestination();
    var spielGain = ctx.createGain(); spielGain.gain.value = e.spielton ? 0.75 : 0;
    var stimmeGain = ctx.createGain(); stimmeGain.gain.value = 1;
    var analyser = ctx.createAnalyser(); analyser.fftSize = 512;
    stimmeGain.connect(analyser); analyser.connect(ziel); spielGain.connect(ziel);
    var mithoeren = ctx.createGain(); mithoeren.gain.value = e.hoeren ? 1 : 0; analyser.connect(mithoeren); mithoeren.connect(ctx.destination);
    var musikGain = ctx.createGain(); musikGain.gain.value = 0.3; musikGain.connect(spielGain); musikGain.connect(mithoeren);
    var sfxGain = ctx.createGain(); sfxGain.gain.value = 0.55; sfxGain.connect(ziel); sfxGain.connect(mithoeren);

    Z = { auto: !!(vorgabe && vorgabe.auto), musikGain: musikGain, intro: e.format === "hoch" ? 1.6 : 3.4, aufnahme: aufnahme, spiel: e.spiel, S: SPIELE[e.spiel], format: e.format, F: F, dauer: aufnahme ? +e.laenge : 1e9, modus: e.modus, stimme: e.stimme, ctx: ctx, ziel: ziel, spielGain: spielGain, spielGainZiel: spielGain.gain.value,
      stimmeGain: stimmeGain, analyser: analyser, mithoeren: mithoeren, lw: lw, g: lw.getContext("2d"), start: 0, t: 0, bereit: false,
      spricht: null, letzterSatz: -99, benutzt: {}, warteschlange: [], untertitel: null, outro: false,
      stats: { runden: 0, siege: 0, kos: 0, raus: 0, tiere: [], highlight: null, letzterSieger: null, einwohner: 0, momente: [], probleme: [], geloest: [], serie: 0, wechsel: 0 }, tier: "", modusName: "", vorschauBild: null, vorschauGrund: 0,
      blink: 0, staunen: 0, sfxGain: sfxGain, gefuehl: null, laune: 0, launeSatz: -99, teilchen: [], wackeln: 0, blitz: null };
    ctx.resume().catch(function () {});
    // Spiel laden
    var fr = $("stSpiel");
    if (e.spiel === "werbung") { fr.src = "about:blank"; Z.app = e.app || null; werbungVorbereiten(); }
    else fr.src = wurzel + Z.S.url + (e.spiel === "krawallzoo" ? encodeURIComponent(e.modus) : "&dauer=" + (aufnahme ? +e.laenge : 180)) + "&v=" + Date.now();
    knoepfe();
    info(aufnahme ? "Spiel wird geladen …" : "Vorschau – es wird nichts aufgenommen.");
    $("stZeit").textContent = aufnahme ? "0:00 / " + zeitText(Z.dauer) : "Vorschau";
    addEventListener("message", nachricht);
    Z.ladeTimer = setTimeout(function () { if (Z && !Z.bereit) { A.toast(Z.S.spiel + " lädt nicht. Bist du online? (Horizonte braucht einen Browser mit 3D.)"); stoppen(false); } }, 30000);
    Z.raf = requestAnimationFrame(zeichnen);
    if (A.seiteNeu) A.seiteNeu();
  }
  function bereit(ohneSpiel) {
    if (!Z || Z.bereit) return;
    var w = $("stSpiel").contentWindow, kz = ohneSpiel ? null : w && w.KZ_ZU;
    if (!kz && !ohneSpiel) return;
    clearTimeout(Z.ladeTimer);
    Z.bereit = true; Z.kz = kz; Z.start = performance.now();
    if (Z.ctx.state !== "running") Z.ctx.resume().catch(function () {});
    introTon();
    // Spielton abgreifen
    if (kz) try {
      var st = kz.ton();
      if (st) { Z.spielQuelle = Z.ctx.createMediaStreamSource(st); Z.spielQuelle.connect(Z.spielGain); }
      kz.lautsprecher(!!($("stHoeren") ? $("stHoeren").checked : true));
    } catch (err) { console.warn("Spielton", err); }
    if (Z.aufnahme) aufnahmeStarten();
    info(Z.aufnahme ? "Aufnahme läuft …" : "Vorschau läuft.");
    // Begrüßung – nach dem Kanal-Intro
    var z = Z;
    if (Z.format !== "hoch") setTimeout(function () { if (Z === z) sag("kanal_intro", 10); }, 1300);
    if (!wb()) setTimeout(function () { if (Z !== z) return; z.letzterSatz = -99; sag(Z.spiel === "krawallzoo" ? (Z.format === "hoch" ? "short_intro" : "intro") : (Z.format === "hoch" ? "hz_short_intro" : "hz_intro_" + Z.spiel), 9);
      if (Z.spiel === "bauen") { var warte = function () { if (Z !== z) return; if (z.spricht) return setTimeout(warte, 300); ideeSagen(); }; setTimeout(warte, 800); } }, Z.intro * 1000 + 300);
  }
  function aufnahmeStarten() {
    var spur = Z.lw.captureStream(30);
    var strom = new MediaStream(spur.getVideoTracks().concat(Z.ziel.stream.getAudioTracks()));
    var typen = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
    var typ = typen.filter(function (t) { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t); })[0] || "";
    var rate = Z.format === "hoch" ? 6e6 : (Z.dauer > 180 ? 3.5e6 : 5e6);
    try { Z.rec = new MediaRecorder(strom, typ ? { mimeType: typ, videoBitsPerSecond: rate, audioBitsPerSecond: 128000 } : {}); }
    catch (err) { A.toast("Aufnahme nicht möglich: " + err.message); stoppen(false); return; }
    Z.teile = []; Z.typ = Z.rec.mimeType || typ || "video/webm";
    Z.rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) Z.teile.push(ev.data); };
    Z.rec.onstop = fertigstellen;
    Z.rec.start(1000);
    var r = $("stRec"); if (r) r.hidden = false;
  }
  function stoppen(fertig) {
    if (!Z || Z.endet) return;
    var z = Z;
    if (z.rec && z.rec.state !== "inactive" && fertig) {
      z.endet = true;
      // fertigstellen läuft im onstop – Z wird dort aufgeräumt
      try { z.kz && z.kz.stopp(); } catch (e) { /* egal */ }
      if (z.musik) clearInterval(z.musik);
      info("Video wird fertiggestellt …");
      z.rec.stop();
      return;
    }
    if (z.rec && z.rec.state !== "inactive") { z.rec.onstop = null; try { z.rec.stop(); } catch (e) { /* egal */ } }
    aufraeumen();
  }
  function aufraeumen() {
    if (!Z) return;
    removeEventListener("message", nachricht);
    cancelAnimationFrame(Z.raf); clearTimeout(Z.ladeTimer); if (Z.musik) clearInterval(Z.musik);
    try { if (Z.spricht) Z.spricht.quelle.stop(); } catch (e) { /* egal */ }
    try { Z.ctx.close(); } catch (e) { /* egal */ }
    var fr = $("stSpiel"); if (fr) fr.src = "about:blank";
    Z = null;
    var r = $("stRec"); if (r) r.hidden = true;
    if ($("stLeer") && !ergebnis) $("stLeer").hidden = false;
    knoepfe(); info("");
    if ($("stZeit")) $("stZeit").textContent = "–";
    if (A && A.seiteNeu) A.seiteNeu();
  }
  function knoepfe() {
    var an = !!Z;
    if (!$("stAufnahme")) return;
    if ($("stAutoInfo")) autoAnzeigen();
    $("stVorschau").hidden = an; $("stAufnahme").hidden = an; $("stStopp").hidden = !an;
    $("stStopp").textContent = Z && Z.aufnahme ? "■ Aufnahme beenden" : "■ Vorschau beenden";
    ["stSpielWahl", "stFormat", "stLaenge", "stModus", "stStimme", "stSpielton", "stWuerfel"].forEach(function (id) { if ($(id)) $(id).disabled = an || (id === "stFormat" && $("stSpielWahl").value === "werbung"); });
  }

  /* ================================================================
     Ereignisse aus dem Spiel → Thorsten reagiert
     ================================================================ */
  function nachricht(ev) {
    if (!Z || ev.origin !== location.origin || !ev.data || ev.data.kz !== "zu") return;
    var d = ev.data;
    if (ev.source !== ($("stSpiel") || {}).contentWindow) return;
    if (d.type === "bereit") { bereit(); return; }
    if (!Z.bereit) bereit();
    var s = Z.stats;
    if (hz()) {
      if (d.type === "start") { Z.tier = d.name || ""; Z.modusName = d.name || ""; Z.hzQuelle = d.quelle; s.einwohner = d.einwohner || 0; }
      else if (d.type === "shot" || d.type === "bau") {
        var g = "hz_" + d.was;
        if (d.einwohner) s.einwohner = Math.max(s.einwohner || 0, d.einwohner);
        if (ton && ton[g]) sag(g, d.was === "nacht" ? 6 : 5);
        if (/nacht|hochhaus|wachsen2|flughafen|hafen/.test(d.was)) setTimeout(function () { merkeMoment(d.was === "nacht" ? 4 : 3, { nacht: "BEI NACHT!", hochhaus: "HOCH HINAUS!", wachsen2: "SIE WÄCHST!", flughafen: "ABHEBEN!", hafen: "AHOI!" }[d.was]); }, 3500);
        if (s.momente.indexOf(d.was) < 0) s.momente.push(d.was);
      } else if (d.type === "problem") {
        s.probleme.push(d.art); Z.staunen = 1; Z.problemSeit = Z.t; laune(-0.7);
        fuehlen("schock", d.art === "brand" ? 1.2 : 0.8, d.art === "brand" ? ["🔥", "🚒", "😱"] : null);
        if (!(d.art === "brand" && Math.random() < 0.6 && sag("hz_emo_brand", 9)) && !sag("hz_problem_" + d.art, 9)) sag("hz_problem", 9);
        merkeMoment(3.5, { brand: "ES BRENNT!", stau: "STAU!", strom: "STROMAUSFALL!", wasser: "KEIN WASSER!", wegzug: "SIE ZIEHEN WEG!" }[d.art] || "OH NEIN!");
      } else if (d.type === "loesung") {
        if (d.ok) { s.geloest.push(d.art); laune(0.8); fuehlen("frech", 0.8, ["✨", "🔧", "😎"]); }
        else { laune(-0.8); fuehlen("trauer", 0.9); }
        if (!(d.ok && Math.random() < 0.3 && sag("hz_emo_geschafft", 9))) sag(d.ok ? "hz_loesung_" + d.art : "hz_loesung_nicht", 9) || (d.ok && sag("hz_loesung", 9));
      } else if (d.type === "idee") {
        Z.idee = d; s.idee = d;
        if (Z.t > Z.intro + 6) ideeSagen();
      } else if (d.type === "bedarf") { sag("hz_bedarf_" + d.art, 7); }
      else if (d.type === "extra") { Z.staunen = 1; fuehlen("jubel", 0.5); sag("hz_extra_" + d.art, 7); merkeMoment(3, { riesenrad: "RIESENRAD!", schwimmbad: "PLATSCH!", hafen: "AHOI!", park: "SO GRÜN!", sport: "TOOOR!" }[d.art] || "WOW!"); }
      else if (d.type === "einwohner") {
        s.einwohner = Math.max(s.einwohner || 0, d.zahl); Z.einwText = d.zahl;
        if (d.zahl >= 1000 && !Z.tausend) { Z.tausend = true; laune(1.5); fuehlen("jubel", 1.4, ["🎉", "🏙️", "🥳"]); merkeMoment(4, d.zahl + " EINWOHNER!"); sag("hz_emo_1000", 9) || sag("hz_einwohner", 6); }
        else { if (d.zahl >= 500) fuehlen("jubel", 0.5); sag("hz_einwohner", 4); merkeMoment(2, d.zahl + " EINWOHNER!"); }
      }
      return;
    }
    switch (d.type) {
      case "start":
        Z.tier = d.tier; Z.modusName = d.modusName; s.runden++; if (s.tiere.indexOf(d.tier) < 0) s.tiere.push(d.tier);
        Z.kzWechsel = d.gewechselt; Z.kzBleib = !d.gewechselt && s.runden > 1;
        break;
      case "los":
        Z.rundeStart = Z.t;
        if (Z.kzWechsel) { s.wechsel++; Z.kzWechsel = false; sag("kz_wechsel", 7); }
        else if (Z.kzBleib) { Z.kzBleib = false; sag("kz_bleib", 5); }
        else if (Z.t > 4) sag("los", 3);
        break;
      case "nebel_ich": fuehlen("schock", 0.5); sag("kz_nebel_ich", 5); break;
      case "knapp": Z.staunen = 1; fuehlen("schock", 0.6); sag("kz_knapp", 6); break;
      case "tor":
        if (d.fuerMich) {
          laune(1); fuehlen("jubel", 1); merkeMoment(4, d.selbst ? "THORSTEN TRIFFT!" : "TOOOR!");
          if (!(d.selbst && sag("tor_selbst", 9))) sag(d.ausgleich ? "tor_ausgleich" : "tor_eigen", 9);
        } else {
          laune(-1); fuehlen(d.ausgleich ? "schock" : "wut", 1); merkeMoment(3, "GEGENTOR!");
          sag(d.ausgleich ? "tor_ausgleich_gegen" : !d.fuehrung && d.stand === "0:1" ? (Math.random() < 0.5 ? "tor_rueckstand" : "tor_gegen") : "tor_gegen", 9);
        }
        launeSagen();
        break;
      case "fuehrung":
        if (d.fuerMich) { fuehlen("jubel", 0.6); sag("kz_fuehrung_ich", 7); } else { fuehlen("schock", 0.7); sag("kz_fuehrung_gegen", 7); }
        break;
      case "ko":
        if (d.thorstenTrifft) { s.kos++; laune(0.4); fuehlen("frech", 0.5); merkeMoment(3, "K.O.!"); sag("ko_treffer", 6); }
        else if (d.thorstenRaus) {
          s.raus++; laune(-1); fuehlen("wut", 1); merkeMoment(3, "ERWISCHT!");
          if (Z.rundeStart != null && Z.t - Z.rundeStart < 7) sag("kz_frueh_raus", 8); else if (Math.random() < 0.6) sag("emo_gekillt", 8) || sag("ko_raus", 7); else sag("ko_raus", 7);
          launeSagen();
        }
        else { if (Math.random() < 0.55) sag("ko_andere", 2); merkeMoment(1, "K.O.!"); }
        break;
      case "super":
        if (d.thorsten) { sag("super_ich", 5); merkeMoment(2, d.attacke.toUpperCase() + "!"); }
        else if (Math.random() < 0.35) sag("super_andere", 2);
        break;
      case "item": if (d.thorsten) sag("item_" + d.art, 3); break;
      case "nebel": sag("nebel", 4); break;
      case "runde": sag(d.entscheidung ? "entscheidung" : "runde", 6); break;
      case "ende":
        if (d.gewonnen) { laune(1.5); fuehlen("jubel", 1.4); if (s.serie >= 2) { s.siege++; s.serie = 0; merkeMoment(5, "ENDLICH!"); sag("kz_endlich", 9); s.highlight = s.highlight || ("Sieg nach Pechsträhne"); break; } s.serie = 0; s.siege++; merkeMoment(5, "SIEG!"); sag("sieg", 8); s.highlight = s.highlight || ("Sieg mit dem " + d.tier); launeSagen(true); }
        else if (d.modus === "ffa" && d.platz && d.platz <= 3) { fuehlen("frech", 0.6); sag("platz", 8); }
        else { s.serie++; laune(-1.5); if (s.serie >= 2 || Z.laune <= -3) { fuehlen("wut", 1.3); sag("kz_pech", 8); } else { fuehlen("trauer", 1.2); sag(Math.random() < 0.4 ? "emo_traurig" : "niederlage", 8) || sag("niederlage", 8); } launeSagen(true); }
        s.letzterSieger = d.sieger;
        break;
    }
  }
  /* ---------- Gefühle ---------- */
  var EMO = {
    wut: { regen: ["💢", "😤", "😡"], blitz: "255,40,40", ton: "buh", wackeln: 1 },
    trauer: { regen: ["😭", "💧", "💔"], blitz: "40,90,200", ton: "wahwah", wackeln: 0 },
    schock: { regen: ["😱", "❗", "⚠️"], blitz: "255,255,255", ton: "schock", wackeln: 0.6 },
    jubel: { regen: ["🎉", "⭐", "🥳", "⚽"], blitz: "255,207,51", ton: "jubel", wackeln: 0.3 },
    frech: { regen: null, blitz: null, ton: "pling", wackeln: 0 }
  };
  // staerke: 0.5 = nur Gesicht, ab 1 = mit Effekten, Zoom und Geräusch
  function fuehlen(art, staerke, regen) {
    if (!Z || Z.outro || wb() || !EMO[art]) return;
    var e = EMO[art], jetzt = Z.t, gross = staerke >= 1;
    // ein stärkeres Gefühl wird nicht von einem schwachen überschrieben
    if (Z.gefuehl && jetzt < Z.gefuehl.bis - 1 && Z.gefuehl.staerke > staerke + 0.3) return;
    Z.gefuehl = { art: art, ab: jetzt, bis: jetzt + 2.2 + staerke * 1.6, staerke: staerke, zoom: gross };
    if (gross) {
      Z.wackeln = Math.max(Z.wackeln, e.wackeln * Math.min(1.4, staerke));
      if (e.blitz) Z.blitz = { farbe: e.blitz, ab: jetzt, st: art === "wut" ? 0.42 : 0.3 };
      var r = regen || e.regen;
      if (r) regnen(r, Math.round(14 + staerke * 10));
      geraeusch(e.ton);
    } else if (art === "frech" || staerke >= 0.8) { if (regen) regnen(regen, 8); geraeusch(art === "frech" ? "pling" : "zisch"); }
  }
  function laune(n) { if (Z) Z.laune = Math.max(-4, Math.min(4, Z.laune + n)); }
  // bei sehr schlechter oder sehr guter Laune ein Extra-Satz hinterher
  function launeSagen(sofort) {
    if (!Z || Z.t - Z.launeSatz < 50) return;
    var g = Z.laune <= -3 ? "laune_genervt" : Z.laune >= 3 ? "laune_super" : null;
    if (!g || !(ton && ton[g])) return;
    Z.launeSatz = Z.t;
    if (Z.spricht || !sofort) Z.warteschlange.push({ g: g, p: 7 }); else sag(g, 7);
  }
  function regnen(liste, n) {
    var W = Z.F.w, H = Z.F.h, k = Z.format === "hoch" ? 1.6 : 1;
    for (var i = 0; i < n; i++) Z.teilchen.push({ e: liste[i % liste.length], x: Math.random() * W, y: -40 - Math.random() * H * 0.5, vx: (Math.random() - 0.5) * 60, vy: (220 + Math.random() * 260) * k, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 4, gr: (34 + Math.random() * 30) * k, ab: Z.t });
    if (Z.teilchen.length > 90) Z.teilchen.splice(0, Z.teilchen.length - 90);
  }
  function zeichneTeilchen(g, dt) {
    var H = Z.F.h;
    g.textAlign = "center"; g.textBaseline = "middle";
    Z.teilchen = Z.teilchen.filter(function (p) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.y > H + 60) return false;
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot * 0.3); g.font = Math.round(p.gr) + "px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif"; g.fillText(p.e, 0, 0); g.restore();
      return true;
    });
  }
  // Selbst erzeugte Geräusche (keine fremden Dateien)
  function geraeusch(art) {
    if (!Z || !Z.ctx) return;
    var c = Z.ctx, t0 = c.currentTime + 0.02, aus = Z.sfxGain;
    function rauschen(dauer) { var b = c.createBuffer(1, Math.ceil(c.sampleRate * dauer), c.sampleRate), d = b.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; var q = c.createBufferSource(); q.buffer = b; return q; }
    function ton(typ, f1, f2, ab, dauer, laut, ziel) {
      var o = c.createOscillator(), gg = c.createGain(); o.type = typ;
      o.frequency.setValueAtTime(f1, ab); if (f2) o.frequency.exponentialRampToValueAtTime(f2, ab + dauer);
      gg.gain.setValueAtTime(0.0001, ab); gg.gain.exponentialRampToValueAtTime(laut, ab + 0.03); gg.gain.setValueAtTime(laut, ab + dauer * 0.7); gg.gain.exponentialRampToValueAtTime(0.0001, ab + dauer);
      o.connect(gg); gg.connect(ziel || aus); o.start(ab); o.stop(ab + dauer + 0.05); return o;
    }
    function menge(ab, dauer, lo, hi, laut) { // Publikum: gefiltertes Rauschen
      var q = rauschen(dauer), bp = c.createBiquadFilter(), gg = c.createGain(); bp.type = "bandpass"; bp.frequency.setValueAtTime(lo, ab); bp.frequency.linearRampToValueAtTime(hi, ab + dauer * 0.5); bp.Q.value = 1.4;
      gg.gain.setValueAtTime(0.0001, ab); gg.gain.exponentialRampToValueAtTime(laut, ab + dauer * 0.25); gg.gain.exponentialRampToValueAtTime(0.0001, ab + dauer);
      q.connect(bp); bp.connect(gg); gg.connect(aus); q.start(ab); q.stop(ab + dauer);
    }
    try {
      if (art === "buh") {
        var lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 700; lp.connect(aus);
        [0, 0.07, 0.15].forEach(function (v, i) { ton("sawtooth", 190 + i * 23, 120 + i * 15, t0 + v, 1.3, 0.12, lp); });
        menge(t0, 1.4, 300, 450, 0.25);
      } else if (art === "jubel") {
        menge(t0, 1.8, 900, 2600, 0.45);
        [523, 659, 784, 1047].forEach(function (f, i) { ton("square", f, 0, t0 + i * 0.09, 0.22, 0.05); });
        ton("sawtooth", 233, 0, t0 + 0.45, 0.6, 0.07); ton("sawtooth", 311, 0, t0 + 0.45, 0.6, 0.06);
      } else if (art === "wahwah") {
        var lp2 = c.createBiquadFilter(); lp2.type = "lowpass"; lp2.frequency.value = 900; lp2.connect(aus);
        [[294, 0], [277, 0.42], [262, 0.84]].forEach(function (n) { ton("sawtooth", n[0], n[0] * 0.98, t0 + n[1], 0.38, 0.13, lp2); });
        var o = ton("sawtooth", 247, 233, t0 + 1.26, 1.1, 0.13, lp2), lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.5; lg.gain.value = 9; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t0 + 1.26); lfo.stop(t0 + 2.4);
      } else if (art === "schock") {
        ton("sine", 110, 70, t0, 0.5, 0.35); ton("sine", 104, 55, t0 + 0.55, 0.9, 0.38); menge(t0, 0.25, 2000, 3000, 0.2);
      } else if (art === "pling") {
        ton("triangle", 1319, 0, t0, 0.15, 0.1); ton("triangle", 1760, 0, t0 + 0.08, 0.25, 0.1);
      } else if (art === "zisch") {
        var q = rauschen(0.5), hp = c.createBiquadFilter(), gz = c.createGain(); hp.type = "highpass"; hp.frequency.value = 3000; gz.gain.setValueAtTime(0.15, t0); gz.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5); q.connect(hp); hp.connect(gz); gz.connect(aus); q.start(t0); q.stop(t0 + 0.5);
      }
    } catch (e) { /* egal */ }
  }
  // Welches Gesicht macht Thorsten gerade?
  function gesichtJetzt() {
    if (!Z) return "normal";
    if (Z.gefuehl && Z.t < Z.gefuehl.bis) return Z.gefuehl.art;
    if (Z.staunen > 0.3) return "schock";
    if (Z.laune <= -2.5) return "grummel";
    if (Z.laune >= 2.5) return "froh";
    return "normal";
  }

  // Thorsten verrät seine Bau-Idee: Form, Schwerpunkt, Mut – nacheinander
  function ideeSagen() {
    var d = Z && Z.idee; if (!d || Z.ideeGesagt) return; Z.ideeGesagt = true;
    var folge = [{ g: "hz_fokus_" + d.fokus, p: 8 }, { g: "hz_mut_" + d.mut, p: 8 }];
    var f = function () { if (!Z) return; var n = folge.shift(); if (n) Z.warteschlange.push(n); };
    Z.letzterSatz = -99; Z.spricht = null; sag("hz_idee_" + d.form, 9); Z.warteschlange = []; f(); f();
  }
  // Satz aus einer Gruppe sprechen – mit Vorrang, damit Thorsten sich nicht selbst unterbricht
  function sag(gruppe, prio) {
    if (!Z || Z.outro && !/outro$/.test(gruppe)) return false;
    if (!(ton && ton[gruppe] && ton[gruppe].length) && ton) return false;
    var jetzt = Z.t;
    if (Z.spricht) {
      if (prio >= 7 && prio > Z.spricht.prio) { Z.warteschlange = [{ g: gruppe, p: prio }]; }
      return true;
    }
    if (jetzt - Z.letzterSatz < (prio >= 6 ? 0.4 : 1.6)) return true;
    var liste = ton && ton[gruppe];
    if (!liste || !liste.length) { untertitelOhneTon(gruppe, prio); return false; }
    var frei = liste.filter(function (s) { return !Z.benutzt[s.id] || jetzt - Z.benutzt[s.id] > 90; });
    var s = (frei.length ? frei : liste)[Math.floor(Math.random() * (frei.length || liste.length))];
    if (gruppe === "hz_einwohner" && Z.einwText) { var passend = liste.filter(function (x) { return x.zahl === Z.einwText; })[0]; if (passend) s = passend; }
    return sprich(s, prio);
  }
  function sprich(s, prio) {
    var jetzt = Z.t;
    Z.benutzt[s.id] = jetzt;
    if (!Z.stimme) { Z.untertitel = { text: s.text, bis: jetzt + Math.max(1.6, s.dauer || 2) }; Z.letzterSatz = jetzt + (s.dauer || 2); return true; }
    var z = Z;
    Z.spricht = { prio: prio, text: s.text, quelle: null };
    satzPuffer(z.ctx, s).then(function (ab) {
      if (Z !== z) return;
      var q = z.ctx.createBufferSource(); q.buffer = ab; q.connect(z.stimmeGain);
      z.spricht.quelle = q;
      z.untertitel = { text: s.text, bis: z.t + ab.duration + 0.4 };
      ducken(true);
      q.onended = function () {
        if (Z !== z) return;
        z.spricht = null; z.letzterSatz = z.t; ducken(false);
        var n = z.warteschlange.shift(); if (n) setTimeout(function () { sag(n.g, n.p); }, 250);
      };
      q.start();
    }).catch(function () { if (Z === z) { z.spricht = null; z.untertitel = { text: s.text, bis: z.t + 2.2 }; } });
    return true;
  }
  function untertitelOhneTon(gruppe, prio) {
    var T = { intro: "Hey Leute, Thorsten hier – eure Lieblings-KI! Ab in den Krawallzoo!", short_intro: "Thorsten hier – schaut euch das an!", sieg: "Gewonnen! 🎉", niederlage: "Verloren – Revanche!", outro: "Bleibt krawallig! Tschüss! 👋", short_outro: "Bleibt krawallig!", ko_treffer: "Erwischt!", ko_raus: "Neeein, raus!" };
    if (T[gruppe] && prio >= 5) { Z.untertitel = { text: T[gruppe], bis: Z.t + 2.6 }; Z.letzterSatz = Z.t + 2; }
  }
  function ducken(an) {
    if (!Z) return;
    var g = Z.spielGain.gain, t = Z.ctx.currentTime;
    g.cancelScheduledValues(t); g.setTargetAtTime(an ? Z.spielGainZiel * 0.4 : Z.spielGainZiel, t, 0.08);
  }
  function hoeren(an) {
    if (!Z) return;
    Z.mithoeren.gain.value = an ? 1 : 0;
    try { Z.kz && Z.kz.lautsprecher(an); } catch (e) { /* egal */ }
  }
  // Bester Moment fürs Vorschaubild
  function merkeMoment(wert, text) {
    if (!Z || !Z.kz || wert < Z.vorschauGrund || Z.t < Z.intro + 2) return;
    setTimeout(function () {
      if (!Z) return;
      var c = document.createElement("canvas"); c.width = 1280; c.height = 720;
      try { c.getContext("2d").drawImage(Z.kz.canvas, 0, 0, 1280, 720); } catch (e) { return; }
      Z.vorschauBild = c; Z.vorschauGrund = wert; Z.vorschauText = text;
    }, 250);
  }

  /* ================================================================
     Zeichnen (jedes Bild des Videos)
     ================================================================ */
  function zeichnen(jetzt) {
    if (!Z) return;
    Z.raf = requestAnimationFrame(zeichnen);
    var g = Z.g, W = Z.F.w, H = Z.F.h;
    var tAlt = Z.t;
    if (Z.bereit) Z.t = (jetzt - Z.start) / 1000;
    var t = Z.t, dt = Math.max(0, Math.min(0.1, t - tAlt));
    g.fillStyle = "#07090f"; g.fillRect(0, 0, W, H);
    // Bildschirm wackelt bei großen Gefühlen
    Z.wackeln = Math.max(0, Z.wackeln - dt * 1.6);
    var wa = Z.wackeln > 0.01 ? Math.min(1, Z.wackeln) * (Z.format === "hoch" ? 26 : 16) : 0;
    g.save();
    if (wa) { g.translate(W / 2 + Math.sin(t * 61) * wa, H / 2 + Math.cos(t * 47) * wa * 0.7); g.scale(1.04, 1.04); g.translate(-W / 2, -H / 2); }
    var spiel = Z.kz && Z.kz.canvas;
    if (wb()) zeichneWerbung(g, W, H, t);
    else if (Z.format === "hoch") zeichneHoch(g, W, H, spiel); else if (spiel) g.drawImage(spiel, 0, 0, W, H);
    // Avatar + Untertitel
    var pegel = 0;
    if (Z.spricht && Z.spricht.quelle) { var d = new Uint8Array(Z.analyser.fftSize); Z.analyser.getByteTimeDomainData(d); var m = 0; for (var i = 0; i < d.length; i += 4) m = Math.max(m, Math.abs(d[i] - 128)); pegel = Math.min(1, m / 50); }
    Z.mund = (Z.mund || 0) + (pegel - (Z.mund || 0)) * 0.5;
    Z.staunen = Math.max(0, Z.staunen - 1 / 60);
    Z.laune *= Math.pow(0.996, dt * 10); // die Laune beruhigt sich ganz langsam
    g.restore();
    // farbiger Blitz
    if (Z.blitz) { var ba = Z.blitz.st * (1 - (t - Z.blitz.ab) / 0.6); if (ba > 0) { g.fillStyle = "rgba(" + Z.blitz.farbe + "," + ba.toFixed(3) + ")"; g.fillRect(0, 0, W, H); } else Z.blitz = null; }
    if (Z.teilchen.length) zeichneTeilchen(g, dt);
    var gross = Z.format === "hoch" ? 230 : 150, gesicht = gesichtJetzt();
    // Zoom auf Thorsten: kurz groß in der Ecke
    var gf = Z.gefuehl, zoom = 0;
    if (gf && gf.zoom && t < gf.bis) { var lt = t - gf.ab, dauerZ = gf.bis - gf.ab; zoom = Math.min(easeOut(Math.min(1, lt / 0.25)), Math.min(1, (dauerZ - lt) / 0.5)); }
    var sz = gross * (1 + 0.75 * zoom);
    var ax = Z.format === "hoch" ? 60 : 24, ay = (Z.format === "hoch" ? 1290 + gross : H - 24) - sz;
    if (wb()) { if (Z.seg && t >= Z.seg[1].ab && t < Z.seg[Z.seg.length - 1].ab) avatar(g, 40, 40, 150, Z.mund, t, Z.staunen > 0.3); }
    else { avatar(g, ax, ay, sz, Z.mund, t, gesicht, gf && t < gf.bis ? t - gf.ab : 9); if (zoom < 0.5) namensSchild(g, ax + gross + 14, (Z.format === "hoch" ? 1290 : H - gross - 24) + gross * 0.35, Z.format === "hoch" ? 1.5 : 1); }
    if (Z.untertitel && t < Z.untertitel.bis) untertitel(g, W, H, Z.untertitel.text);
    // Titel-Einblendung nach der ersten Action (Leitfaden: erst Ergebnis, dann kurz das Intro)
    if (!wb() && t > Z.intro + 1.2 && t < Z.intro + 5.2 && Z.bereit) titelKarte(g, W, H, t - Z.intro - 1.2);
    // Füllsätze, wenn es zu ruhig ist
    if (Z.bereit && !wb() && !Z.spricht && !Z.outro && Z.format !== "hoch" && t - Z.letzterSatz > 15 && t > 10 + Z.intro) sag(hz() ? "hz_fuell" : "fuell", 1);
    // Schluss
    if (Z.aufnahme && Z.bereit) {
      var rest = Z.dauer - t;
      var schluss = Z.format === "hoch" ? 3 : 7;
      if (wb()) schluss = -1;
      if (rest < schluss + 0.6 && !Z.outro) { Z.outro = true; if (Z.spricht) { try { Z.spricht.quelle.stop(); } catch (e) { /* egal */ } } Z.spricht = null; Z.letzterSatz = -99; sag(hz() ? (Z.format === "hoch" ? "hz_short_outro" : "hz_outro") : (Z.format === "hoch" ? "short_outro" : "outro"), 10); }
      if (rest < schluss) schlussKarte(g, W, H, 1 - rest / schluss, Z.mund, t);
      var el = $("stZeit"); if (el) el.textContent = zeitText(t) + " / " + zeitText(Z.dauer);
      if (rest <= 0) { stoppen(true); return; }
    } else if (Z.bereit) { var el2 = $("stZeit"); if (el2) el2.textContent = "Vorschau · " + zeitText(t); }
    // Kanal-Intro ganz am Anfang
    if (!Z.bereit) { g.fillStyle = "#07090f"; g.fillRect(0, 0, W, H); }
    else if (t < Z.intro) kanalIntro(g, W, H, t, Z.intro);
  }
  function zeichneHoch(g, W, H, spiel) {
    // Hintergrund: Spiel stark vergrößert und unscharf
    if (spiel) {
      g.save(); g.filter = "blur(28px) brightness(.45)"; var bh = H, bw = bh * 16 / 9; g.drawImage(spiel, (W - bw) / 2, 0, bw, bh); g.restore();
      // Vordergrund: Spielausschnitt, leicht hineingezoomt (mittlere 75 %)
      var gh = 900, gy = 300, sw = spiel.width * 0.72, sh = spiel.height, sx = (spiel.width - sw) / 2;
      g.save(); rund(g, 30, gy, W - 60, gh, 34); g.clip(); g.drawImage(spiel, sx, 0, sw, sh, 30, gy, W - 60, gh); g.restore();
      g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = 4; rund(g, 30, gy, W - 60, gh, 34); g.stroke();
    }
    // Titel oben
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "800 92px 'Space Grotesk', Arial, sans-serif"; schrift(g, Z.S.titel, W / 2, 140, "#ffcf33", 12);
    g.font = "600 52px 'Space Grotesk', Arial, sans-serif"; schrift(g, Z.S.spiel + (Z.tier ? " · " + Z.tier : ""), W / 2, 228, "#ffffff", 9);
  }

  /* ================================================================
     Kanal-Intro: Thorsten fliegt als Komet ins Bild
     ================================================================ */
  function introTon() {
    var c = Z.ctx, t0 = c.currentTime + 0.05, ziel = Z.stimmeGain;
    try {
      // Whoosh: Rauschen, das hochzieht
      var n = c.createBuffer(1, c.sampleRate * 1.2, c.sampleRate), d = n.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      var q = c.createBufferSource(); q.buffer = n; var f = c.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.4; f.frequency.setValueAtTime(300, t0); f.frequency.exponentialRampToValueAtTime(3200, t0 + 0.9);
      var g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
      q.connect(f); f.connect(g); g.connect(ziel); q.start(t0); q.stop(t0 + 1.2);
      // Landung: kleiner Akkord
      [523.25, 659.25, 783.99, 1046.5].forEach(function (fr, k) {
        var o = c.createOscillator(), og = c.createGain(), t = t0 + 0.95 + k * 0.06; o.type = "triangle"; o.frequency.value = fr;
        og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.16, t + 0.02); og.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
        o.connect(og); og.connect(ziel); o.start(t); o.stop(t + 1.2);
      });
    } catch (e) { /* egal */ }
  }
  function kanalIntro(g, W, H, t, dauer) {
    var hoch = Z.format === "hoch", k = hoch ? W / 1280 * 1.35 : W / 1280, cx = W / 2, cy = H * (hoch ? 0.42 : 0.44);
    var raus = t > dauer - 0.45 ? (t - (dauer - 0.45)) / 0.45 : 0;
    g.save(); g.globalAlpha = 1 - raus;
    var bg = g.createRadialGradient(cx, cy, 10, cx, cy, Math.max(W, H) * 0.7); bg.addColorStop(0, "#1b1440"); bg.addColorStop(1, "#05060b");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // Sterne
    for (var i = 0; i < 70; i++) { var sx = (i * 137.5 % 100) / 100 * W, sy = (i * 61.3 % 100) / 100 * H, tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i)); g.fillStyle = "rgba(255,255,255," + (0.25 + 0.5 * tw) + ")"; g.fillRect(sx - (t * 40 * k) % W * 0 , sy, 2 * k + (i % 3 === 0 ? 1.5 : 0), 2 * k); }
    // Flug: von oben rechts zur Mitte
    var fl = Math.min(1, t / (hoch ? 0.7 : 1.0)), e = easeOut(fl), sx0 = W * 1.15, sy0 = -H * 0.15;
    var x = sx0 + (cx - sx0) * e, y = sy0 + (cy - sy0) * e, gr = (hoch ? 300 : 200) * k * (0.35 + 0.65 * e);
    // Schweif
    for (var j = 0; j < 3; j++) {
      var len = (1 - e * 0.6) * 520 * k + 60 * k, wid = [26, 12, 6][j] * k * (1.1 - e * 0.4), col = ["rgba(255,255,255,.75)", "rgba(255,138,60,.9)", "rgba(154,167,189,.7)"][j];
      g.strokeStyle = col; g.lineWidth = wid; g.lineCap = "round"; g.beginPath(); var ox = (j - 1) * 14 * k; g.moveTo(x + ox, y - ox); g.lineTo(x + len * 0.75 + ox, y - len * 0.75 * 0.62 - ox); g.stroke();
    }
    // Funken beim Landen
    if (fl >= 1) { var p = Math.min(1, (t - (hoch ? 0.7 : 1.0)) / 0.6); for (var m = 0; m < 14; m++) { var w = m / 14 * Math.PI * 2, r = (40 + 160 * p) * k; g.fillStyle = "rgba(255,207,51," + (1 - p) + ")"; g.beginPath(); g.arc(cx + Math.cos(w) * r, cy + Math.sin(w) * r, 5 * k, 0, 7); g.fill(); } }
    avatar(g, x - gr / 2, y - gr / 2, gr, 0.3, t, fl < 1);
    // Schrift
    if (fl >= 1) {
      var tt = t - (hoch ? 0.7 : 1.0), name = "THORSTEN";
      g.textAlign = "center"; g.textBaseline = "middle";
      g.font = "800 " + Math.round((hoch ? 150 : 96) * k / (hoch ? 1.35 : 1)) + "px 'Space Grotesk', Arial, sans-serif";
      var ges = g.measureText(name).width, bx = cx - ges / 2, ty = cy + gr * 0.5 + (hoch ? 140 : 90) * k / (hoch ? 1.35 : 1);
      for (var b = 0; b < name.length; b++) {
        var bt = Math.max(0, Math.min(1, (tt - b * 0.05) / 0.25)); if (!bt) continue;
        var vor = g.measureText(name.slice(0, b)).width, cw = g.measureText(name[b]).width;
        g.save(); g.globalAlpha = (1 - raus) * bt; g.translate(bx + vor + cw / 2, ty + (1 - easeOut(bt)) * 30 * k); schrift(g, name[b], 0, 0, "#ffffff", 10 * k); g.restore();
      }
      var st = Math.max(0, Math.min(1, (tt - 0.5) / 0.4));
      if (st) { g.globalAlpha = (1 - raus) * st; g.font = "600 " + Math.round((hoch ? 46 : 30) * k / (hoch ? 1.35 : 1)) + "px 'Space Grotesk', Arial, sans-serif"; g.fillStyle = "#ff8a3c"; g.fillText("KI-YOUTUBER · OMNIVIA", cx, ty + (hoch ? 110 : 70) * k / (hoch ? 1.35 : 1)); }
    }
    g.restore();
  }

  /* ================================================================
     Werbe-Short: Thorsten stellt eine App vor
     ================================================================ */
  function satzVon(gruppe, nr) { var l = ton && ton[gruppe]; if (!l || !l.length) return null; if (nr) { var x = l.filter(function (s) { return s.nr === nr; })[0]; if (x) return x; } return l[Math.floor(Math.random() * l.length)]; }
  function bildLaden(url) { return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = wurzel + url; }); }
  function werbungVorbereiten() {
    var z = Z;
    Promise.all([appsVorladen(), tonVorladen()]).then(function () {
      if (Z !== z) return;
      var app = z.app ? (APPS || []).filter(function (a) { return a.id === z.app; })[0] : null;
      app = app || appWaehlen();
      if (!app) { A.toast("Keine App für das Werbevideo gefunden."); stoppen(false); return; }
      z.appDaten = app; z.tier = app.name; z.modusName = app.name;
      var bald = app.status === "bald";
      return Promise.all([Promise.all((app.bilder || []).slice(0, 3).map(bildLaden)), bildLaden("shared/marken/" + app.marke + "-zeichen.webp")]).then(function (r) {
        if (Z !== z) return;
        z.bilder = r[0].filter(Boolean); z.logo = r[1];
        // Ablauf: Aufhänger – Name – Bilder mit Merkmalen – Schluss
        var seg = [], dauer = function (s, min) { return Math.max(min || 3, (s ? s.dauer : 2.2) + 0.5); };
        var s0 = satzVon(bald ? "app_start_bald" : "app_start"), s1 = satzVon("app_" + app.id, 1), s2 = satzVon("app_" + app.id, 2), s3 = satzVon("app_" + app.id, 3), s4 = satzVon(bald ? "app_ende_bald" : "app_ende");
        seg.push({ art: "hook", satz: s0, d: dauer(s0, 2.6) });
        seg.push({ art: "name", satz: s1, d: dauer(s1, 3.2) });
        var punkte = app.punkte || [];
        if (z.bilder.length && !bald) {
          seg.push({ art: "bild", bild: 0, punkt: punkte[0], satz: s2, d: dauer(s2, 4) });
          seg.push({ art: "bild", bild: 1 % z.bilder.length, punkt: punkte[1], satz: s3, d: dauer(s3, 4) });
          if (z.bilder.length > 2) seg.push({ art: "bild", bild: 2, punkt: punkte[2], satz: null, d: 3.2 });
        } else {
          seg.push({ art: "punkte", satz: s2, d: dauer(s2, 4) });
          seg.push({ art: "punkte2", satz: s3, d: dauer(s3, 3.6) });
        }
        seg.push({ art: "ende", satz: s4, d: dauer(s4, 4.2) + 0.8 });
        var t = z.intro; seg.forEach(function (x) { x.ab = t; t += x.d; });
        z.seg = seg; z.dauer = z.aufnahme ? Math.min(58, t) : 1e9; z.segEnde = t;
        musikStarten(z);
        bereit(true);
      });
    }).catch(function (e) { console.warn(e); if (Z === z) { A.toast("Werbevideo konnte nicht vorbereitet werden."); stoppen(false); } });
  }
  // Leichte, eigene Hintergrundmusik (synthetisch erzeugt – keine fremde Musik)
  function musikStarten(z) {
    var c = z.ctx, ziel = z.musikGain, bpm = 112, takt = 60 / bpm / 2, naechste = c.currentTime + 0.1, schritt = 0;
    var akk = [[220, 277.18, 329.63], [196, 246.94, 293.66], [174.61, 220, 261.63], [196, 246.94, 293.66]];
    var noise = c.createBuffer(1, c.sampleRate * 0.1, c.sampleRate), nd = noise.getChannelData(0); for (var i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    var ton1 = function (f, t, d, typ, v) { var o = c.createOscillator(), g = c.createGain(); o.type = typ; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(ziel); o.start(t); o.stop(t + d + 0.05); };
    z.musik = setInterval(function () {
      if (Z !== z) return;
      while (naechste < c.currentTime + 0.25) {
        var t = naechste, a = akk[Math.floor(schritt / 8) % 4];
        if (schritt % 4 === 0) { var o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.15); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); o.connect(g); g.connect(ziel); o.start(t); o.stop(t + 0.25); }
        if (schritt % 2 === 1) { var q = c.createBufferSource(); q.buffer = noise; var hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7000; var hg = c.createGain(); hg.gain.value = 0.16; q.connect(hp); hp.connect(hg); hg.connect(ziel); q.start(t); }
        if (schritt % 8 === 0) a.forEach(function (f) { ton1(f, t, takt * 7, "triangle", 0.07); });
        if (schritt % 2 === 0) ton1(a[0] / 2, t, takt * 0.9, "sine", 0.22);
        if (schritt % 4 === 2) ton1(a[(schritt / 2) % 3] * 2, t, takt * 0.8, "square", 0.025);
        naechste += takt; schritt++;
      }
    }, 80);
  }
  function zeichneWerbung(g, W, H, t) {
    var z = Z, app = z.appDaten; if (!app || !z.seg) return;
    var farbe = app.farbe || "#4338ca", bald = app.status === "bald";
    // Hintergrund mit langsam wandernden Farbflecken
    var bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#0a0b12"); bg.addColorStop(1, "#141026"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (var i = 0; i < 3; i++) { var bx = W * (0.5 + 0.4 * Math.sin(t * 0.3 + i * 2.1)), by = H * (0.3 + 0.25 * i + 0.08 * Math.cos(t * 0.4 + i)), rg = g.createRadialGradient(bx, by, 0, bx, by, 520); rg.addColorStop(0, i === 1 ? "rgba(255,138,60,.22)" : hexA(farbe, 0.42)); rg.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = rg; g.fillRect(0, 0, W, H); }
    // aktueller Abschnitt
    var seg = null; for (var j = 0; j < z.seg.length; j++) if (t >= z.seg[j].ab) seg = z.seg[j];
    if (seg && !seg.gesagt && t >= seg.ab) { seg.gesagt = true; if (seg.satz) { z.spricht = null; z.letzterSatz = -99; sprich(seg.satz, 9); } }
    if (!seg) return;
    var lt = t - seg.ab, rein = easeOut(Math.min(1, lt / 0.45));
    // Kopfzeile: Marke + App-Name
    g.textAlign = "center"; g.textBaseline = "middle";
    if (seg.art !== "hook") {
      if (z.logo) { var lh = 90, lw = z.logo.width / z.logo.height * lh; g.drawImage(z.logo, W / 2 - lw / 2, 90, lw, lh); }
      g.font = "800 76px 'Space Grotesk', Arial, sans-serif"; schrift(g, app.name, W / 2, 250, "#ffffff", 10);
      if (bald) { g.font = "800 40px 'Space Grotesk', Arial, sans-serif"; var bw = g.measureText("BALD VERFÜGBAR").width + 60; g.fillStyle = "#ff8a3c"; rund(g, W / 2 - bw / 2, 300, bw, 64, 20); g.fill(); g.fillStyle = "#1a0d02"; g.fillText("BALD VERFÜGBAR", W / 2, 334); }
    }
    if (seg.art === "hook") {
      var s = 420 * (0.7 + 0.3 * rein); avatar(g, W / 2 - s / 2, 520 - (1 - rein) * 200, s, z.mund || 0, t, true);
      g.font = "900 110px 'Space Grotesk', Arial, sans-serif"; g.save(); g.translate(W / 2, 1140); g.rotate(-0.05); g.scale(rein, rein); schrift(g, bald ? "PSST! 🤫" : "NEU? 👀", 0, 0, "#ffcf33", 16); g.restore();
      g.font = "700 56px 'Space Grotesk', Arial, sans-serif"; g.globalAlpha = rein; schrift(g, bald ? "Bald bei OMNIVIA:" : "Kennst du schon …", W / 2, 1270, "#ffffff", 8); g.globalAlpha = 1;
    } else if (seg.art === "name") {
      var sk = 0.6 + 0.4 * rein;
      g.save(); g.translate(W / 2, 760); g.scale(sk, sk);
      g.fillStyle = farbe; rund(g, -300, -300, 600, 600, 140); g.fill();
      g.strokeStyle = "rgba(255,255,255,.3)"; g.lineWidth = 8; rund(g, -300, -300, 600, 600, 140); g.stroke();
      if (z.logo) { var l2 = 360, lw2 = z.logo.width / z.logo.height * l2; g.drawImage(z.logo, -lw2 / 2, -l2 / 2, lw2, l2); } else { g.font = "900 220px 'Space Grotesk', Arial, sans-serif"; g.fillStyle = "#fff"; g.fillText(app.name.charAt(0), 0, 10); }
      g.restore();
      var p = app.punkte || []; g.font = "700 54px 'Space Grotesk', Arial, sans-serif";
      p.slice(0, 3).forEach(function (x, i) { var a = Math.max(0, Math.min(1, (lt - 0.4 - i * 0.35) / 0.3)); g.globalAlpha = a; schrift(g, "✓ " + x, W / 2, 1180 + i * 86, "#ffffff", 8); }); g.globalAlpha = 1;
    } else if (seg.art === "bild") {
      var img = z.bilder[seg.bild]; var pw = 560, ph = 1120, px = W / 2 - pw / 2 + (1 - rein) * W, py = 460;
      var zoom = 1 + lt * 0.015;
      g.save(); g.shadowColor = "rgba(0,0,0,.6)"; g.shadowBlur = 60; g.fillStyle = "#000"; rund(g, px - 18, py - 18, pw + 36, ph + 36, 70); g.fill(); g.restore();
      g.save(); rund(g, px, py, pw, ph, 54); g.clip();
      if (img) { var iw = pw * zoom, ih = img.height / img.width * iw; g.drawImage(img, px + (pw - iw) / 2, py + (ph - Math.min(ih, ph * zoom)) / 2 - lt * 6, iw, ih); }
      g.restore();
      g.strokeStyle = "rgba(255,255,255,.25)"; g.lineWidth = 4; rund(g, px, py, pw, ph, 54); g.stroke();
      if (seg.punkt) { var pa = Math.max(0, Math.min(1, (lt - 0.3) / 0.3)); g.globalAlpha = pa; g.font = "800 58px 'Space Grotesk', Arial, sans-serif"; var tw = g.measureText(seg.punkt).width + 70; g.fillStyle = farbe; rund(g, W / 2 - tw / 2, 330, tw, 96, 30); g.fill(); g.fillStyle = "#fff"; g.fillText(seg.punkt, W / 2, 380); g.globalAlpha = 1; }
    } else if (seg.art === "punkte" || seg.art === "punkte2") {
      var pp = app.punkte || [], idx = seg.art === "punkte" ? [0, 1] : [2];
      idx.forEach(function (n, i) { if (!pp[n]) return; var a = Math.max(0, Math.min(1, (lt - i * 0.5) / 0.4)), y = 760 + i * 300; g.globalAlpha = a;
        g.fillStyle = "rgba(255,255,255,.08)"; rund(g, 110, y - 120 + (1 - a) * 40, W - 220, 240, 50); g.fill(); g.strokeStyle = hexA(farbe, 0.9); g.lineWidth = 5; rund(g, 110, y - 120 + (1 - a) * 40, W - 220, 240, 50); g.stroke();
        g.font = "800 70px 'Space Grotesk', Arial, sans-serif"; schrift(g, pp[n], W / 2, y + (1 - a) * 40, "#ffffff", 8); g.globalAlpha = 1; });
      g.font = "600 40px 'Space Grotesk', Arial, sans-serif"; g.fillStyle = "#9aa7bd"; g.fillText("In Entwicklung – noch keine Bilder", W / 2, 1460);
    } else if (seg.art === "ende") {
      var s2 = 300; avatar(g, W / 2 - s2 / 2, 470, s2, z.mund || 0, t, false);
      g.font = "900 " + (bald ? 96 : 104) + "px 'Space Grotesk', Arial, sans-serif"; g.save(); g.translate(W / 2, 960); g.scale(0.7 + 0.3 * rein, 0.7 + 0.3 * rein); schrift(g, bald ? "Bald da! 🚀" : "Kostenlos! ✨", 0, 0, "#ffcf33", 14); g.restore();
      g.font = "700 52px 'Space Grotesk', Arial, sans-serif"; schrift(g, bald ? "Abonnieren & nichts verpassen" : "Ohne Werbung · ohne Konto", W / 2, 1090, "#ffffff", 8);
      g.fillStyle = "rgba(255,255,255,.1)"; rund(g, 90, 1180, W - 180, 130, 40); g.fill();
      g.font = "800 50px 'Space Grotesk', Arial, sans-serif"; g.fillStyle = "#fff"; g.fillText("kometenwerk.github.io", W / 2, 1246);
      g.font = "500 32px 'Space Grotesk', Arial, sans-serif"; g.fillStyle = "#9aa7bd"; g.fillText("Werbung in eigener Sache · Thorsten ist eine KI-Figur", W / 2, 1380);
    }
  }
  function hexA(hex, a) { var h = String(hex).replace("#", ""); if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join(""); var n = parseInt(h, 16); return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")"; }

  /* ---------- Bausteine ---------- */
  function rund(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function schrift(g, text, x, y, farbe, rand) { g.lineJoin = "round"; g.lineWidth = rand; g.strokeStyle = "rgba(0,0,0,.85)"; g.strokeText(text, x, y); g.fillStyle = farbe; g.fillText(text, x, y); }
  // Thorsten: freundlicher Roboter mit Kometen-Antenne (eigene Figur)
  // gesicht: normal | staunen | schock | wut | trauer | jubel | frech | grummel | froh  (true = staunen)
  // seit: Sekunden seit Beginn des Gefühls (für Sprung, Kopfschütteln …)
  function avatar(g, x, y, s, mund, t, gesicht, seit) {
    var f = gesicht === true ? "staunen" : gesicht || "normal", L = seit == null ? 9 : seit;
    var k = s / 100, PI2 = Math.PI * 2;
    g.save(); g.translate(x, y); g.scale(k, k);
    // Hintergrund-Plakette – färbt sich mit dem Gefühl
    var rahmen = { wut: "#ff3b3b", trauer: "#5b8cff", schock: "#ffffff", jubel: "#ffcf33", frech: "#3ef2a0" }[f] || "#ff8a3c";
    g.fillStyle = f === "wut" ? "rgba(48,8,12,.88)" : f === "trauer" ? "rgba(8,14,40,.88)" : "rgba(10,12,22,.82)"; rund(g, 0, 0, 100, 100, 22); g.fill();
    g.strokeStyle = rahmen; g.lineWidth = 3; rund(g, 1.5, 1.5, 97, 97, 21); g.stroke();
    g.save(); rund(g, 0, 0, 100, 100, 22); g.clip();
    // Bewegung je nach Gefühl
    var dx = 0, dy = Math.sin(t * 3.2) * 1.5 + mund * 2, kipp = 0;
    if (f === "wut") { var sch = Math.max(0, 1 - L / 1.6); dx = Math.sin(t * 38) * 3.5 * sch + Math.sin(t * 9) * 0.8; }
    else if (f === "trauer") { dy += 5 + Math.min(1, L / 0.6) * 3; kipp = -0.06; }
    else if (f === "schock") { dy -= Math.max(0, Math.sin(Math.min(1, L / 0.35) * Math.PI)) * 14; }
    else if (f === "jubel") { dy -= Math.abs(Math.sin(t * 9)) * 9; kipp = Math.sin(t * 9) * 0.05; }
    else if (f === "frech") { kipp = 0.08; }
    g.translate(50 + dx, 57 + dy); g.rotate(kipp); g.translate(-50, -57);
    // Antenne mit Komet (bei Wut glüht sie rot, bei Trauer hängt sie)
    var spitzeX = f === "trauer" ? 66 : 58, spitzeY = f === "trauer" ? 18 : 12;
    var kom = f === "wut" ? "#ff3b3b" : f === "trauer" ? "#6b7aa8" : f === "jubel" ? "#ffcf33" : "#ff8a3c";
    g.strokeStyle = "#9aa7bd"; g.lineWidth = 3; g.beginPath(); g.moveTo(50, 28); g.lineTo(spitzeX, spitzeY); g.stroke();
    g.strokeStyle = "rgba(255,138,60,.6)"; g.lineWidth = 3; g.beginPath(); g.moveTo(spitzeX + 2, spitzeY - 2); g.lineTo(spitzeX + 12, spitzeY + 4); g.stroke();
    g.fillStyle = kom; if (f === "wut" || f === "jubel") { g.shadowColor = kom; g.shadowBlur = 10; }
    g.beginPath(); g.arc(spitzeX + 1, spitzeY - 2, 5.5, 0, PI2); g.fill(); g.shadowBlur = 0;
    g.fillStyle = "#fff"; g.beginPath(); g.arc(spitzeX - 0.5, spitzeY - 3.5, 1.6, 0, PI2); g.fill();
    // Ohren-Bolzen
    g.fillStyle = "#3b4a7a"; rund(g, 12, 46, 8, 18, 3); g.fill(); rund(g, 80, 46, 8, 18, 3); g.fill();
    // Dampf aus den Ohren bei Wut
    if (f === "wut") {
      for (var i = 0; i < 3; i++) { var ph = (t * 1.6 + i / 3) % 1; g.fillStyle = "rgba(230,230,240," + (0.6 * (1 - ph)).toFixed(2) + ")";
        g.beginPath(); g.arc(10 - ph * 8, 50 - ph * 22, 3 + ph * 5, 0, PI2); g.fill(); g.beginPath(); g.arc(90 + ph * 8, 50 - ph * 22, 3 + ph * 5, 0, PI2); g.fill(); }
    }
    // Kopf
    var grad = g.createLinearGradient(0, 28, 0, 90);
    if (f === "wut") { grad.addColorStop(0, "#6a2433"); grad.addColorStop(1, "#3a1424"); }
    else { grad.addColorStop(0, "#2b3a66"); grad.addColorStop(1, "#1a2344"); }
    g.fillStyle = grad; rund(g, 18, 28, 64, 58, 16); g.fill();
    g.strokeStyle = f === "wut" ? "#c0475a" : "#4f62a0"; g.lineWidth = 2; rund(g, 18, 28, 64, 58, 16); g.stroke();
    // Visier
    g.fillStyle = "#0a0f1e"; rund(g, 25, 38, 50, 38, 11); g.fill();
    // Augen
    var farbe = { wut: "#ff4040", trauer: "#7fb0ff", jubel: "#ffd84a", grummel: "#ffb03e" }[f] || "#3ef2ff";
    g.fillStyle = farbe; g.strokeStyle = farbe; g.shadowColor = farbe; g.shadowBlur = 8; g.lineCap = "round";
    var zu = (t % 4.3) < 0.12;
    function auge(cx, links) {
      if (f === "wut") { // schräg nach innen
        g.beginPath(); if (links) { g.moveTo(cx - 6, 44); g.lineTo(cx + 6, 48); g.lineTo(cx + 5, 54); g.lineTo(cx - 5, 53); }
        else { g.moveTo(cx + 6, 44); g.lineTo(cx - 6, 48); g.lineTo(cx - 5, 54); g.lineTo(cx + 5, 53); } g.closePath(); g.fill();
      } else if (f === "trauer") { // hängend, nach außen abfallend
        g.beginPath(); if (links) { g.moveTo(cx - 6, 50); g.lineTo(cx + 5, 46); g.lineTo(cx + 5, 52); g.lineTo(cx - 5, 54); }
        else { g.moveTo(cx + 6, 50); g.lineTo(cx - 5, 46); g.lineTo(cx - 5, 52); g.lineTo(cx + 5, 54); } g.closePath(); g.fill();
      } else if (f === "schock" || f === "staunen") {
        var r = f === "schock" ? 7.5 : 6; g.beginPath(); g.arc(cx, 49, r, 0, PI2); g.fill();
        g.shadowBlur = 0; g.fillStyle = "#0a0f1e"; g.beginPath(); g.arc(cx, 49, r * 0.38, 0, PI2); g.fill(); g.fillStyle = farbe; g.shadowBlur = 8;
      } else if (f === "jubel") { // Sterne
        g.beginPath(); for (var j = 0; j < 10; j++) { var w = j * Math.PI / 5 - Math.PI / 2 + t * 2, rr = j % 2 ? 3 : 7.5; g.lineTo(cx + Math.cos(w) * rr, 49 + Math.sin(w) * rr); } g.closePath(); g.fill();
      } else if (f === "frech" && !links) { // Zwinkern
        g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 5, 50); g.quadraticCurveTo(cx, 45, cx + 5, 50); g.stroke();
      } else if (f === "froh") { // lachende Bögen
        g.lineWidth = 3.4; g.beginPath(); g.moveTo(cx - 5, 51); g.quadraticCurveTo(cx, 43, cx + 5, 51); g.stroke();
      } else if (f === "grummel") { // halb geschlossen
        rund(g, cx - 5, 49, 10, 5, 2); g.fill(); g.fillRect(cx - 6, 47.5, 12, 1.5);
      } else { var aH = zu ? 1.5 : 10; rund(g, cx - 5, 49 - aH / 2, 10, aH, Math.min(4, aH / 2)); g.fill(); }
    }
    auge(38, true); auge(62, false);
    // Mund
    g.lineWidth = 3;
    if (f === "wut") { var mw1 = 18 + mund * 4, mh1 = 4 + mund * 7; rund(g, 50 - mw1 / 2, 66 - mh1 / 2, mw1, mh1, 2); g.fill();
      g.shadowBlur = 0; g.strokeStyle = "#0a0f1e"; g.lineWidth = 1.2; for (var z = -1; z <= 1; z++) { g.beginPath(); g.moveTo(50 + z * 5, 66 - mh1 / 2); g.lineTo(50 + z * 5, 66 + mh1 / 2); g.stroke(); } }
    else if (f === "trauer" || f === "grummel") { g.beginPath(); g.moveTo(40, 70); g.quadraticCurveTo(50, 62 - mund * 4, 60, 70); g.stroke(); }
    else if (f === "schock") { g.beginPath(); g.ellipse(50, 66, 6 + mund * 2, 7 + mund * 3, 0, 0, PI2); g.fill(); }
    else if (f === "staunen") { rund(g, 45, 61.5, 10, 9, 4); g.fill(); }
    else if (f === "jubel" || f === "froh") { g.beginPath(); g.moveTo(37, 62); g.quadraticCurveTo(50, 78 + mund * 4, 63, 62); g.closePath(); g.fill(); }
    else if (f === "frech") { g.beginPath(); g.moveTo(40, 66); g.quadraticCurveTo(52, 71 + mund * 4, 61, 61); g.stroke(); }
    else { var mh = 2.5 + mund * 9, mw = 20 - mund * 4; rund(g, 50 - mw / 2, 65 - mh / 2, mw, mh, Math.min(4, mh / 2)); g.fill(); }
    g.shadowBlur = 0;
    // Tränen
    if (f === "trauer") {
      for (var n = 0; n < 2; n++) { var tp = (t * 0.9 + n * 0.5) % 1; g.fillStyle = "rgba(127,176,255," + (1 - tp).toFixed(2) + ")";
        [36, 64].forEach(function (tx) { g.beginPath(); g.ellipse(tx, 56 + tp * 30, 2.2, 3.2, 0, 0, PI2); g.fill(); }); }
    }
    // Wut-Ader
    if (f === "wut") { g.strokeStyle = "#ff4040"; g.lineWidth = 2.4; var vx = 72, vy = 33; g.beginPath(); g.moveTo(vx - 4, vy - 1); g.lineTo(vx - 1, vy - 1); g.lineTo(vx - 1, vy - 4); g.moveTo(vx + 1, vy - 4); g.lineTo(vx + 1, vy - 1); g.lineTo(vx + 4, vy - 1); g.moveTo(vx + 4, vy + 1); g.lineTo(vx + 1, vy + 1); g.lineTo(vx + 1, vy + 4); g.moveTo(vx - 1, vy + 4); g.lineTo(vx - 1, vy + 1); g.lineTo(vx - 4, vy + 1); g.stroke(); }
    // Schweißtropfen beim Schock
    if (f === "schock") { g.fillStyle = "#9fdcff"; g.beginPath(); g.moveTo(80, 30); g.quadraticCurveTo(85, 38, 80, 41); g.quadraticCurveTo(75, 38, 80, 30); g.fill(); }
    g.restore();
    g.restore();
  }
  function namensSchild(g, x, y, k) {
    g.save(); g.translate(x, y); g.scale(k, k);
    g.font = "700 22px 'Space Grotesk', Arial, sans-serif"; g.textAlign = "left"; g.textBaseline = "middle";
    var w = g.measureText("THORSTEN").width;
    g.font = "700 13px 'Space Grotesk', Arial, sans-serif"; var kw = g.measureText("KI-STIMME").width + 14;
    g.fillStyle = "rgba(10,12,22,.82)"; rund(g, 0, -18, w + kw + 34, 36, 12); g.fill();
    g.font = "700 22px 'Space Grotesk', Arial, sans-serif"; g.fillStyle = "#fff"; g.fillText("THORSTEN", 12, 1);
    g.fillStyle = "#ff8a3c"; rund(g, w + 22, -11, kw, 22, 7); g.fill();
    g.fillStyle = "#1a0d02"; g.font = "700 13px 'Space Grotesk', Arial, sans-serif"; g.fillText("KI-STIMME", w + 29, 1);
    var zeile2 = Z && Z.tier ? (hz() ? "🏙️ " : "spielt: ") + Z.tier : "";
    if (zeile2) { g.fillStyle = "rgba(10,12,22,.7)"; g.font = "500 16px 'Space Grotesk', Arial, sans-serif"; var tw = g.measureText(zeile2).width; rund(g, 0, 24, tw + 24, 28, 9); g.fill(); g.fillStyle = "#cfd6e6"; g.fillText(zeile2, 12, 38); }
    g.restore();
  }
  function untertitel(g, W, H, text) {
    var hoch = Z.format === "hoch", gr = hoch ? 54 : 30, maxB = hoch ? W - 120 : W * 0.56;
    g.font = "700 " + gr + "px 'Space Grotesk', Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    var zeilen = umbruch(g, text, maxB).slice(0, 3), lh = gr * 1.25;
    var y0 = hoch ? (wb() ? 1740 - (zeilen.length - 1) * lh : 1640) : H - 70 - (zeilen.length - 1) * lh, x = hoch ? W / 2 : W / 2 + 150;
    zeilen.forEach(function (z, i) {
      var w = g.measureText(z).width + gr;
      g.fillStyle = "rgba(0,0,0,.72)"; rund(g, x - w / 2, y0 + i * lh - lh / 2, w, lh, 10); g.fill();
      g.fillStyle = "#fff"; g.fillText(z, x, y0 + i * lh + 2);
    });
  }
  function umbruch(g, text, max) {
    var w = String(text).split(/\s+/), zs = [], z = "";
    w.forEach(function (x) { var n = z ? z + " " + x : x; if (g.measureText(n).width > max && z) { zs.push(z); z = x; } else z = n; });
    if (z) zs.push(z); return zs;
  }
  function titelKarte(g, W, H, t) {
    var rein = Math.min(1, t / 0.35), raus = t > 3.4 ? Math.max(0, 1 - (t - 3.4) / 0.4) : 1, a = Math.min(rein, raus);
    if (a <= 0 || Z.format === "hoch") return;
    var x = -420 * (1 - easeOut(rein)) + 24, y = 24;
    g.save(); g.globalAlpha = a;
    g.fillStyle = "rgba(10,12,22,.86)"; rund(g, x, y, 410, 92, 18); g.fill();
    g.fillStyle = "#ff8a3c"; rund(g, x, y, 10, 92, 5); g.fill();
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.font = "800 36px 'Space Grotesk', Arial, sans-serif"; g.fillStyle = "#ffcf33"; g.fillText(Z.S.titel, x + 28, y + 46);
    g.font = "500 20px 'Space Grotesk', Arial, sans-serif"; g.fillStyle = "#e6eaf3"; g.fillText(Z.S.spiel + (Z.modusName ? " · " + Z.modusName : "") + " · FLARESSA", x + 28, y + 76);
    g.restore();
  }
  function schlussKarte(g, W, H, p, mund, t) {
    var a = Math.min(1, p * 3);
    g.save(); g.globalAlpha = a;
    var gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "rgba(10,11,16,.92)"); gr.addColorStop(1, "rgba(28,14,48,.96)");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    var hoch = Z.format === "hoch", s = hoch ? 330 : 210, cx = W / 2;
    avatar(g, cx - s / 2, hoch ? 520 : 90, s, mund, t, Z.laune <= -1.5 ? "grummel" : "froh");
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "800 " + (hoch ? 96 : 64) + "px 'Space Grotesk', Arial, sans-serif"; schrift(g, hz() ? "Bis zum nächsten Mal! 👋" : "Bleibt krawallig! 👋", cx, hoch ? 1020 : 380, "#ffcf33", 10);
    g.font = "500 " + (hoch ? 46 : 30) + "px 'Space Grotesk', Arial, sans-serif"; g.fillStyle = "#e6eaf3"; g.fillText(Z.S.spiel + " kostenlos spielen:", cx, hoch ? 1150 : 460);
    g.font = "700 " + (hoch ? 58 : 40) + "px 'Space Grotesk', Arial, sans-serif"; g.fillStyle = "#fff"; g.fillText("kometenwerk.github.io", cx, hoch ? 1230 : 512);
    g.font = "500 " + (hoch ? 32 : 20) + "px 'Space Grotesk', Arial, sans-serif"; g.fillStyle = "#9aa7bd"; g.fillText("FLARESSA Gaming · OMNIVIA Group · Thorsten ist eine KI-Figur", cx, hoch ? 1340 : 580);
    g.restore();
  }
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }

  /* ================================================================
     Fertig: Video, Vorschaubild, Titel und Beschreibung
     ================================================================ */
  function fertigstellen() {
    if (!Z) return;
    var z = Z, blob = new Blob(z.teile, { type: z.typ.split(";")[0] || "video/webm" });
    var endung = /mp4/.test(z.typ) ? "mp4" : "webm";
    var st = z.stats, kurz = z.format === "hoch";
    var datum = new Date().toISOString().slice(0, 10);
    var tier = st.tiere[0] || "Zufallstier";
    var titel, beschreibung, tags, dateiName = "thorsten-zockt-";
    if (z.spiel === "werbung") {
      var ap = z.appDaten || { name: "OMNIVIA", pfad: "", punkte: [] }, bald = ap.status === "bald", link = "https://kometenwerk.github.io/" + (ap.pfad || "");
      dateiName = "thorsten-werbung-" + (ap.id || "app") + "-";
      titel = bald ? ap.name + " – bald verfügbar! 🚀 #Shorts" : ap.name + ": kostenlos & ohne Werbung ✨ #Shorts";
      beschreibung = (bald ? "Vorschau: " + ap.name + " ist bei OMNIVIA in Entwicklung. Noch gibt es keine fertige App – im Video siehst du nur die Idee, keine echten Spielszenen.\n" : "Thorsten stellt " + ap.name + " vor – kostenlos, ohne Werbung, direkt im Browser.\n") +
        (ap.punkte && ap.punkte.length ? "• " + ap.punkte.join("\n• ") + "\n" : "") +
        "\n" + (bald ? "🌐 Mehr von OMNIVIA: https://kometenwerk.github.io" : "👉 Ausprobieren: " + link + "\n🌐 Mehr von OMNIVIA: https://kometenwerk.github.io") + "\n\n" +
        "ℹ️ Werbung in eigener Sache: " + ap.name + " ist ein Projekt der OMNIVIA Group. Thorsten ist eine KI-Figur, seine Stimme eine Computerstimme (Piper „Thorsten“, CC0). Musik selbst erzeugt.";
      tags = ap.name + ", OMNIVIA, App, kostenlos, werbefrei, Thorsten, KI, Shorts";
    } else if (z.spiel !== "krawallzoo") {
      var stadt = z.tier || "Horizonte", ew = st.einwohner || 0, bau = z.spiel === "bauen";
      dateiName = bau ? "thorsten-baut-" : "thorsten-zeigt-";
      titel = kurz
        ? (bau ? "Eine Stadt in " + Math.round(z.dauer) + " Sekunden bauen 🏗️ #Shorts" : st.momente.indexOf("nacht") >= 0 ? "Meine Stadt bei Nacht 🌃 #Shorts" : "Rundflug über meine Stadt 🏙️ #Shorts")
        : st.probleme.indexOf("brand") >= 0 && bau ? "Thorsten baut eine Stadt – und dann brennt es! 🔥 (Horizonte, KI-Städtebau)"
        : st.probleme.indexOf("stau") >= 0 && bau ? "Thorsten baut eine Stadt – und versinkt im Stau! 🚗 (Horizonte, KI-Städtebau)"
        : bau ? "Thorsten baut eine Stadt in Horizonte – von leerem Land" + (ew ? " zu " + ew + " Einwohnern" : " zur Stadt") + "! (KI-Städtebau)"
          : "Thorsten zeigt seine Stadt in Horizonte – " + (st.momente.indexOf("nacht") >= 0 ? "Rundflug bei Tag und Nacht" : "der große Rundflug") + " (KI-Städtebau)";
      beschreibung = "Thorsten – der KI-YouTuber von OMNIVIA – " + (bau ? "baut eine Stadt in Horizonte, von leerem Land bis zur lebendigen Stadt im Zeitraffer" : "zeigt seine Stadt „" + stadt + "“ in Horizonte") + ".\n" +
        (ew ? "Einwohner am Ende: " + ew + ".\n" : "") +
        (st.probleme.length ? "Unterwegs ging auch was schief (" + st.probleme.map(function (x) { return { brand: "Feuer", stau: "Stau", strom: "Stromausfall", wasser: "Wassermangel", abwasser: "Abwasser", muell: "Müll", wegzug: "Wegzug", krimi: "Kriminalität", krank: "Kranke" }[x] || x; }).join(", ") + ") – " + (st.geloest.length ? "Thorsten hat " + st.geloest.length + " davon selbst repariert." : "ganz retten konnte Thorsten es nicht.") + "\n" : "") +
        "\n🏙️ Horizonte kostenlos im Browser spielen: https://kometenwerk.github.io/spiele/horizonte/\n🌐 Mehr von OMNIVIA: https://kometenwerk.github.io\n\n" +
        "ℹ️ Thorsten ist eine KI-Figur, kein echter Mensch. Seine Stimme ist eine Computerstimme (Piper-Sprachmodell „Thorsten“ von Thorsten-Voice, CC0). " +
        (bau ? "Gebaut wird nach einem automatischen Bauplan. " : "") + "Horizonte ist ein Spiel von FLARESSA Gaming (OMNIVIA Group).";
      tags = "Horizonte, Städtebau, City Builder, Thorsten, KI, Browserspiel, OMNIVIA, FLARESSA" + (kurz ? ", Shorts" : "");
    } else {
    titel = kurz
      ? (st.siege ? "Thorsten gewinnt mit dem " + tier + "! 🏆 #Shorts" : st.kos ? "Erwischt! Thorstens " + tier + " räumt auf 😂 #Shorts" : "Krawallzoo-Chaos in " + Math.round(z.dauer) + " Sekunden 😂 #Shorts")
      : "Thorsten zockt Krawallzoo – " + (z.modusName || "Zoo-Chaos") + (st.siege ? ", " + st.siege + (st.siege === 1 ? " Sieg" : " Siege") + "!" : " mit dem " + tier + "!") + " (KI-Let's-Play)";
    beschreibung =
      "Thorsten – der KI-YouTuber von OMNIVIA – zockt " + (z.modusName || "Krawallzoo") + " in Krawallzoo.\n" +
      (st.runden ? "In diesem Video: " + st.runden + (st.runden === 1 ? " Runde" : " Runden") + ", " + st.siege + (st.siege === 1 ? " Sieg" : " Siege") + " und " + st.kos + " K.O.s von Thorstens " + (st.tiere.length > 1 ? "Tieren (" + st.tiere.join(", ") + ")" : tier) + ".\n" : "") +
      "\n🎮 Krawallzoo kostenlos im Browser spielen: https://kometenwerk.github.io/Krawallzoo/\n🌐 Mehr von OMNIVIA: https://kometenwerk.github.io\n\n" +
      "ℹ️ Thorsten ist eine KI-Figur, kein echter Mensch. Seine Stimme ist eine Computerstimme (Piper-Sprachmodell „Thorsten“ von Thorsten-Voice, CC0). " +
      "Alle Tiere werden von Computer-Gegnern (Bots) gesteuert. Krawallzoo ist ein Spiel von FLARESSA Gaming (OMNIVIA Group).";
    tags = "Krawallzoo, Lets Play, Thorsten, KI, Browserspiel, Tiere, OMNIVIA, FLARESSA" + (kurz ? ", Shorts" : "");
    }
    vorschaubild(z).then(function (bild) {
      if (ergebnis) { URL.revokeObjectURL(ergebnis.url); if (ergebnis.vorschauUrl) URL.revokeObjectURL(ergebnis.vorschauUrl); }
      ergebnis = { blob: blob, url: URL.createObjectURL(blob), name: dateiName + datum + "." + endung, vorschau: bild, vorschauUrl: bild ? URL.createObjectURL(bild) : null,
        titel: titel, beschreibung: beschreibung, tags: tags, kurz: kurz, dauer: z.dauer, spiel: z.spiel };
      var verlauf = A.lade("omni-studio-verlauf", []); verlauf.push({ spiel: z.spiel, format: z.format, modus: z.modus, t: Date.now() }); A.merke("omni-studio-verlauf", verlauf.slice(-12));
      var auto = z.auto, job = z.job;
      aufraeumen();
      if (auto) {
        freigabeSpeichern(ergebnis).then(function () { autoErledigt(job, true); A.toast("🤖 Thorsten hat ein neues Video gemacht – es wartet in „Zur Freigabe“."); freigabeZeigen(); }).catch(function (e) { console.warn(e); autoErledigt(job, true); ergebnisZeigen(); });
      } else { ergebnisZeigen(); A.toast("🎬 Video fertig!"); }
    });
  }
  function vorschaubild(z) {
    if (z.spiel === "werbung") return Promise.resolve(null);
    var c = document.createElement("canvas"); c.width = 1280; c.height = 720; var g = c.getContext("2d");
    var quelle = z.vorschauBild;
    if (quelle) g.drawImage(quelle, 0, 0); else { try { g.drawImage(z.kz.canvas, 0, 0, 1280, 720); } catch (e) { g.fillStyle = "#14321b"; g.fillRect(0, 0, 1280, 720); } }
    // Abdunkeln rechts, großer Text links, Thorsten rechts
    var gr = g.createLinearGradient(0, 0, 1280, 0); gr.addColorStop(0, "rgba(0,0,0,.55)"); gr.addColorStop(.55, "rgba(0,0,0,.1)"); gr.addColorStop(1, "rgba(0,0,0,.45)");
    g.fillStyle = gr; g.fillRect(0, 0, 1280, 720);
    avatar(g, 860, 250, 380, 0.9, 0.5, true);
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.save(); g.translate(60, 300); g.rotate(-0.06);
    g.font = "900 150px 'Space Grotesk', Arial, sans-serif"; schrift(g, z.vorschauText || (z.spiel === "krawallzoo" ? "KRAWALL!" : z.spiel === "bauen" ? "NEUE STADT!" : "MEINE STADT!"), 0, 0, "#ffcf33", 22);
    g.restore();
    g.font = "800 70px 'Space Grotesk', Arial, sans-serif"; schrift(g, "THORSTEN", 70, 470, "#ffffff", 14);
    g.font = "800 70px 'Space Grotesk', Arial, sans-serif"; schrift(g, z.S.titel.replace("THORSTEN ", ""), 70, 550, "#ff8a3c", 14);
    g.font = "800 26px 'Space Grotesk', Arial, sans-serif"; var etikett = z.spiel === "krawallzoo" ? "KI-LET'S-PLAY" : "KI-STÄDTEBAU", bw = g.measureText(etikett).width + 28;
    g.fillStyle = "#ff8a3c"; rund(g, 70, 600, bw, 46, 12); g.fill(); g.fillStyle = "#1a0d02"; g.fillText(etikett, 84, 632);
    return new Promise(function (ok) { c.toBlob(function (b) { ok(b); }, "image/png"); });
  }
  function ergebnisZeigen() {
    var box = $("stErgebnis"); if (!box || !ergebnis) return;
    var e = ergebnis, esc = A.esc;
    box.innerHTML = '<div class="st-ergebnis"><h3>🎬 Dein Video ist fertig</h3>' +
      '<video src="' + e.url + '" controls playsinline class="' + (e.kurz ? "hoch" : "") + '"></video>' +
      (e.vorschauUrl ? '<div class="st-vorschau"><img src="' + e.vorschauUrl + '" alt="Vorschaubild für YouTube"><span>Vorschaubild</span></div>' : "") +
      '<p class="hinweis"><b>' + esc(e.titel) + "</b><br>" + (e.blob.size / 1048576).toFixed(1) + " MB · " + zeitText(e.dauer) + "</p>" +
      '<div class="reihe"><a class="knopf" href="' + e.url + '" download="' + esc(e.name) + '">⬇ Video speichern</a>' +
      (e.vorschauUrl ? '<a class="knopf" href="' + e.vorschauUrl + '" download="' + esc(e.name.replace(/\.\w+$/, "")) + '-vorschau.png">🖼 Vorschaubild</a>' : "") +
      '<span style="flex:1"></span><button class="knopf haupt" type="button" id="stYT">📺 Auf YouTube hochladen</button></div>' +
      '<p class="hinweis">Schau dir das Video zuerst an. Auf YouTube landet es immer erst <b>privat</b> – öffentlich stellst du es selbst.</p></div>';
    $("stYT").onclick = function () {
      var datei = new File([e.blob], e.name, { type: e.blob.type || "video/webm" });
      A.YT.oeffnen(null, { titel: e.titel, beschreibung: e.beschreibung, tags: e.tags, datei: datei, vorschau: e.kurz ? null : e.vorschau });
    };
    if ($("stLeer")) $("stLeer").hidden = true;
  }

  /* ================================================================
     Automatik: Thorsten macht jeden Tag 3 Videos, sobald der PC an ist
     (Krawallzoo, Horizonte, Werbe-Short) – fertige Videos warten auf deine Freigabe
     ================================================================ */
  var JOBS = ["krawallzoo", "horizonte", "werbung"], autoTimer = null, autoPause = 0, aktivHinweis = false;
  function heute() { var d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function autoStand() { var s = A.lade("omni-studio-auto-tag", null); if (!s || s.datum !== heute()) s = { datum: heute(), fertig: [], versuche: {} }; return s; }
  function autoAn() { return !!A.lade("omni-studio-auto", false); }
  function autoErledigt(job, ok) { if (!job) return; var s = autoStand(); if (ok) { if (s.fertig.indexOf(job) < 0) s.fertig.push(job); } else s.versuche[job] = (s.versuche[job] || 0) + 1; A.merke("omni-studio-auto-tag", s); autoPause = Date.now(); autoAnzeigen(); }
  function autoVorgabe(job) {
    var r = Math.random, e = ein(), vl = A.lade("omni-studio-verlauf", []), letzt = vl.filter(function (v) { return v.spiel === job || (job === "horizonte" && (v.spiel === "zeigen" || v.spiel === "bauen")); }).pop();
    var v = { auto: true, job: job, stimme: true, spielton: true, hoeren: e.hoeren, modus: "ffa" };
    if (job === "werbung") { v.spiel = "werbung"; v.format = "hoch"; v.laenge = 58; return v; }
    v.format = letzt && letzt.format === "hoch" ? (r() < 0.7 ? "breit" : "hoch") : (r() < 0.55 ? "hoch" : "breit");
    if (job === "krawallzoo") {
      v.spiel = "krawallzoo";
      var modi = MODI.map(function (m) { return m[0]; }).filter(function (m) { return !letzt || m !== letzt.modus; }); v.modus = modi[Math.floor(r() * modi.length)];
      v.laenge = v.format === "hoch" ? [45, 58][Math.floor(r() * 2)] : [180, 240, 300][Math.floor(r() * 3)];
    } else {
      v.spiel = letzt && letzt.spiel === "bauen" ? (r() < 0.6 ? "zeigen" : "bauen") : (r() < 0.65 ? "bauen" : "zeigen");
      v.laenge = v.format === "hoch" ? 58 : v.spiel === "bauen" ? [180, 240][Math.floor(r() * 2)] : 120;
    }
    return v;
  }
  function autoNaechster() { var s = autoStand(); return JOBS.filter(function (j) { return s.fertig.indexOf(j) < 0 && (s.versuche[j] || 0) < 2; })[0] || null; }
  function autoTakt() {
    if (!A || !autoAn() || Z) return;
    var job = autoNaechster(); if (!job) { autoAnzeigen(); return; }
    if (Date.now() - autoPause < 60000) return;
    if (document.visibilityState !== "visible") return;
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
      if (!aktivHinweis) { aktivHinweis = true; A.toast("🤖 Thorsten will Videos machen – tipp einmal irgendwo auf die Seite, damit der Ton erlaubt ist."); }
      return;
    }
    if (typeof MediaRecorder === "undefined") return;
    // Ins Studio wechseln und loslegen
    if (!$("stAufnahme")) { if (A.studioOeffnen) A.studioOeffnen(); setTimeout(autoTakt, 1500); return; }
    var v = autoVorgabe(job);
    A.toast("🤖 Thorsten startet: " + (job === "werbung" ? "Werbe-Short" : SPIELE[v.spiel].name.replace(/^\S+\s/, "")) + " (" + (v.format === "hoch" ? "Short" : zeitText(v.laenge)) + ")");
    starten(true, v);
    if (Z) { Z.job = job; var z = Z; setTimeout(function () { if (Z === z && !Z.bereit) { stoppen(false); autoErledigt(job, false); } else if (Z === z && Z.ctx.state !== "running") { stoppen(false); autoErledigt(job, false); A.toast("🤖 Ton war blockiert – Thorsten versucht es gleich nochmal."); } }, 40000); }
  }
  function autoStarten(api) {
    A = api; wurzel = api.wurzel || "../../";
    if (autoTimer) return;
    tonVorladen(); appsVorladen();
    autoTimer = setInterval(autoTakt, 20000); setTimeout(autoTakt, 4000);
  }
  function autoAnzeigen() {
    var el = $("stAutoInfo"); if (!el) return;
    var s = autoStand(), an = autoAn();
    var name = { krawallzoo: "🎮 Krawallzoo", horizonte: "🏙️ Horizonte", werbung: "📣 Werbe-Short" };
    el.innerHTML = an ? "Heute: " + JOBS.map(function (j) { return name[j] + " " + (s.fertig.indexOf(j) >= 0 ? "✅" : (s.versuche[j] || 0) >= 2 ? "⚠️" : Z && Z.job === j ? "⏺" : "⏳"); }).join(" · ") : "Aus – Thorsten macht nur Videos, wenn du auf „Aufnahme starten“ tippst.";
  }

  /* ---------- Zur Freigabe: fertige Videos im Browser-Speicher (IndexedDB) ---------- */
  var dbP = null;
  function db() {
    if (!dbP) dbP = new Promise(function (ok, nein) { var r = indexedDB.open("omni-studio", 1); r.onupgradeneeded = function () { r.result.createObjectStore("videos", { keyPath: "id" }); }; r.onsuccess = function () { ok(r.result); }; r.onerror = function () { nein(r.error); }; });
    return dbP;
  }
  function tx(modus, fn) { return db().then(function (d) { return new Promise(function (ok, nein) { var t = d.transaction("videos", modus), st = t.objectStore("videos"), res = fn(st); t.oncomplete = function () { ok(res && res.result !== undefined ? res.result : res); }; t.onerror = function () { nein(t.error); }; }); }); }
  function freigabeSpeichern(e) {
    var v = { id: "v" + Date.now(), erstellt: Date.now(), spiel: e.spiel, name: e.name, titel: e.titel, beschreibung: e.beschreibung, tags: e.tags, kurz: e.kurz, dauer: e.dauer, blob: e.blob, vorschau: e.vorschau || null, status: "neu" };
    return tx("readwrite", function (st) { return st.put(v); });
  }
  function freigabeListe() { return tx("readonly", function (st) { return st.getAll(); }).then(function (l) { return (l || []).sort(function (a, b) { return b.erstellt - a.erstellt; }); }); }
  function freigabeWeg(id) { return tx("readwrite", function (st) { return st.delete(id); }); }
  function freigabeStatus(id, status) { return tx("readwrite", function (st) { var r = st.get(id); r.onsuccess = function () { if (r.result) { r.result.status = status; st.put(r.result); } }; return r; }); }
  var freigabeUrls = [];
  function freigabeZeigen() {
    var box = $("stFreigabe"); if (!box || !window.indexedDB) return;
    freigabeListe().then(function (l) {
      // Alte Videos nach 14 Tagen aufräumen
      var alt = l.filter(function (v) { return Date.now() - v.erstellt > 14 * 864e5; }); alt.forEach(function (v) { freigabeWeg(v.id); });
      l = l.filter(function (v) { return alt.indexOf(v) < 0; });
      freigabeUrls.forEach(URL.revokeObjectURL); freigabeUrls = [];
      var esc = A.esc, neu = l.filter(function (v) { return v.status === "neu"; }).length;
      var h = '<h3>📺 Zur Freigabe' + (neu ? ' <span class="st-zahl">' + neu + "</span>" : "") + "</h3>";
      if (!l.length) h += '<p class="hinweis">Noch keine Videos. Schalt oben die Automatik an – dann legt Thorsten hier seine Videos ab.</p>';
      l.forEach(function (v) {
        var u = URL.createObjectURL(v.blob); freigabeUrls.push(u);
        h += '<div class="st-fg' + (v.status !== "neu" ? " fertig" : "") + '"><video src="' + u + '" controls preload="metadata" playsinline class="' + (v.kurz ? "hoch" : "") + '"></video><div class="st-fg-text"><b>' + esc(v.titel) + "</b><small>" + new Date(v.erstellt).toLocaleString("de-DE", { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) + " · " + zeitText(v.dauer) + " · " + (v.blob.size / 1048576).toFixed(1) + " MB" + (v.status === "hochgeladen" ? " · ✅ auf YouTube (privat)" : "") + "</small>" +
          '<div class="reihe"><button class="knopf klein haupt" type="button" data-fgyt="' + v.id + '">📺 YouTube</button><a class="knopf klein" href="' + u + '" download="' + esc(v.name) + '">⬇ Speichern</a><button class="knopf klein gefahr" type="button" data-fgweg="' + v.id + '">🗑 Löschen</button></div></div></div>';
      });
      box.innerHTML = h;
      box.onclick = function (ev) {
        var b = ev.target.closest("button"); if (!b) return;
        var v = l.filter(function (x) { return x.id === (b.dataset.fgyt || b.dataset.fgweg); })[0]; if (!v) return;
        if (b.dataset.fgweg) { if (b.dataset.sicher !== "1") { b.dataset.sicher = "1"; b.textContent = "Wirklich löschen?"; return; } freigabeWeg(v.id).then(freigabeZeigen); }
        else A.YT.oeffnen(null, { titel: v.titel, beschreibung: v.beschreibung, tags: v.tags, datei: new File([v.blob], v.name, { type: v.blob.type || "video/webm" }), vorschau: v.kurz ? null : v.vorschau, fertig: function () { freigabeStatus(v.id, "hochgeladen").then(freigabeZeigen); } });
      };
    }).catch(function () { box.innerHTML = '<p class="hinweis">Der Browser-Speicher ist hier nicht verfügbar.</p>'; });
  }

  window.OMNI_STUDIO = { zeigen: zeigen, verlassen: verlassen, laeuft: laeuft, autoStarten: autoStarten };
})();
