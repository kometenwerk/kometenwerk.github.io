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
    bauen: { name: "🏗️ Horizonte – Thorsten baut eine Stadt", titel: "THORSTEN BAUT", spiel: "Horizonte", marke: "FLARESSA", url: "spiele/inselstadt/?zuschauer=1&art=bauen" }
  };
  function ein() { var e = A.lade("omni-studio", { spiel: "krawallzoo", format: "breit", laenge: 180, modus: "ffa", stimme: true, spielton: true, hoeren: true }); if (!SPIELE[e.spiel]) e.spiel = "krawallzoo"; return e; }
  function hz() { return Z && Z.spiel !== "krawallzoo"; }

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
      '<div class="st-bild" id="stBild"><iframe id="stSpiel" title="Spiel im Zuschauer-Modus" tabindex="-1" aria-hidden="true"></iframe><canvas id="stLeinwand"></canvas>' +
      '<div class="st-leer" id="stLeer"><div class="gross">🎬</div><b>Noch nichts zu sehen</b><span>Tipp auf „Vorschau“, um zu testen, oder direkt auf „Aufnahme starten“.</span></div></div>' +
      '<div class="st-leiste"><span class="st-rec" id="stRec" hidden>● REC</span><span id="stZeit">–</span><span id="stInfo" class="st-info"></span></div>' +
      '<form class="st-einst" id="stForm">' +
      '<div class="feld st-voll"><label for="stSpielWahl">Was macht Thorsten?</label><select id="stSpielWahl">' + Object.keys(SPIELE).map(function (k) { return '<option value="' + k + '"' + (e.spiel === k ? " selected" : "") + ">" + SPIELE[k].name + "</option>"; }).join("") + "</select></div>" +
      '<div class="feld"><label for="stFormat">Format</label><select id="stFormat">' + Object.keys(FORMATE).map(function (k) { return '<option value="' + k + '"' + (e.format === k ? " selected" : "") + ">" + FORMATE[k].name + "</option>"; }).join("") + "</select></div>" +
      '<div class="feld"><label for="stLaenge">Länge</label><select id="stLaenge">' + laengen.map(function (l) { return '<option value="' + l[0] + '"' + (+e.laenge === l[0] ? " selected" : "") + ">" + l[1] + "</option>"; }).join("") + "</select></div>" +
      '<div class="feld" id="stModusFeld"><label for="stModus">Spielmodus</label><select id="stModus">' + MODI.map(function (m) { return '<option value="' + m[0] + '"' + (e.modus === m[0] ? " selected" : "") + ">" + m[1] + "</option>"; }).join("") + "</select></div>" +
      '<div class="st-haken"><label><input type="checkbox" id="stStimme"' + (e.stimme ? " checked" : "") + "> Thorsten spricht</label>" +
      '<label><input type="checkbox" id="stSpielton"' + (e.spielton ? " checked" : "") + "> Spielsound im Video</label>" +
      '<label><input type="checkbox" id="stHoeren"' + (e.hoeren ? " checked" : "") + "> Ich höre mit</label></div>" +
      "</form>" +
      '<div class="reihe st-knoepfe"><button class="knopf" type="button" id="stVorschau">▶ Vorschau</button><button class="knopf haupt" type="button" id="stAufnahme">⏺ Aufnahme starten</button><button class="knopf gefahr" type="button" id="stStopp" hidden>■ Stopp</button></div>' +
      '<p class="hinweis" id="stTonHinweis" hidden></p>' +
      '<div id="stErgebnis"></div>' +
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
    if (ergebnis) ergebnisZeigen();
  }
  function spielAnzeige() {
    var k = $("stSpielWahl").value;
    $("stModusFeld").hidden = k !== "krawallzoo";
    $("stErklaer").innerHTML = {
      krawallzoo: "🎮 <b>Thorsten zockt Krawallzoo.</b> Die Tiere spielen als Bots, eins davon ist Thorstens Tier. Thorsten kommentiert, was passiert.",
      zeigen: "🏙️ <b>Thorsten zeigt seine Stadt.</b> Kameraflug durch Horizonte: Häuser, Bahnhof, Hafen, Verkehr und Nacht. Hast du auf diesem Gerät einen Horizonte-Spielstand, zeigt er <b>deine</b> Stadt.",
      bauen: "🏗️ <b>Thorsten baut eine Stadt.</b> Auf leerem Land: Straßen, Strom, Wasser, Zonen – dann wächst die Stadt im Zeitraffer. Jedes Mal etwas anders."
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
    A.merke("omni-studio", { spiel: $("stSpielWahl").value, format: $("stFormat").value, laenge: +$("stLaenge").value, modus: $("stModus").value, stimme: $("stStimme").checked, spielton: $("stSpielton").checked, hoeren: $("stHoeren").checked });
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
  function starten(aufnahme) {
    if (Z) stoppen(false);
    merken();
    var e = ein(), F = FORMATE[e.format] || FORMATE.breit;
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

    Z = { aufnahme: aufnahme, spiel: e.spiel, S: SPIELE[e.spiel], format: e.format, F: F, dauer: aufnahme ? +e.laenge : 1e9, modus: e.modus, stimme: e.stimme, ctx: ctx, ziel: ziel, spielGain: spielGain, spielGainZiel: spielGain.gain.value,
      stimmeGain: stimmeGain, analyser: analyser, mithoeren: mithoeren, lw: lw, g: lw.getContext("2d"), start: 0, t: 0, bereit: false,
      spricht: null, letzterSatz: -99, benutzt: {}, warteschlange: [], untertitel: null, outro: false,
      stats: { runden: 0, siege: 0, kos: 0, raus: 0, tiere: [], highlight: null, letzterSieger: null, einwohner: 0, momente: [], probleme: [], geloest: [], serie: 0, wechsel: 0 }, tier: "", modusName: "", vorschauBild: null, vorschauGrund: 0,
      blink: 0, staunen: 0 };
    ctx.resume().catch(function () {});
    // Spiel laden
    var fr = $("stSpiel");
    fr.src = wurzel + Z.S.url + (e.spiel === "krawallzoo" ? encodeURIComponent(e.modus) : "&dauer=" + (aufnahme ? +e.laenge : 180)) + "&v=" + Date.now();
    knoepfe();
    info(aufnahme ? "Spiel wird geladen …" : "Vorschau – es wird nichts aufgenommen.");
    $("stZeit").textContent = aufnahme ? "0:00 / " + zeitText(Z.dauer) : "Vorschau";
    addEventListener("message", nachricht);
    Z.ladeTimer = setTimeout(function () { if (Z && !Z.bereit) { A.toast(Z.S.spiel + " lädt nicht. Bist du online? (Horizonte braucht einen Browser mit 3D.)"); stoppen(false); } }, 30000);
    Z.raf = requestAnimationFrame(zeichnen);
    if (A.seiteNeu) A.seiteNeu();
  }
  function bereit() {
    if (!Z || Z.bereit) return;
    var w = $("stSpiel").contentWindow, kz = w && w.KZ_ZU;
    if (!kz) return;
    clearTimeout(Z.ladeTimer);
    Z.bereit = true; Z.kz = kz; Z.start = performance.now();
    // Spielton abgreifen
    try {
      var st = kz.ton();
      if (st) { Z.spielQuelle = Z.ctx.createMediaStreamSource(st); Z.spielQuelle.connect(Z.spielGain); }
      kz.lautsprecher(!!$("stHoeren").checked);
    } catch (err) { console.warn("Spielton", err); }
    if (Z.aufnahme) aufnahmeStarten();
    info(Z.aufnahme ? "Aufnahme läuft …" : "Vorschau läuft.");
    // Begrüßung
    setTimeout(function () { if (!Z) return; sag(Z.spiel === "krawallzoo" ? (Z.format === "hoch" ? "short_intro" : "intro") : (Z.format === "hoch" ? "hz_short_intro" : "hz_intro_" + Z.spiel), 9); }, 600);
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
    cancelAnimationFrame(Z.raf); clearTimeout(Z.ladeTimer);
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
    $("stVorschau").hidden = an; $("stAufnahme").hidden = an; $("stStopp").hidden = !an;
    $("stStopp").textContent = Z && Z.aufnahme ? "■ Aufnahme beenden" : "■ Vorschau beenden";
    ["stSpielWahl", "stFormat", "stLaenge", "stModus", "stStimme", "stSpielton", "stWuerfel"].forEach(function (id) { $(id).disabled = an; });
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
        s.probleme.push(d.art); Z.staunen = 1; Z.problemSeit = Z.t;
        if (!sag("hz_problem_" + d.art, 9)) sag("hz_problem", 9);
        merkeMoment(3.5, { brand: "ES BRENNT!", stau: "STAU!", strom: "STROMAUSFALL!", wasser: "KEIN WASSER!", wegzug: "SIE ZIEHEN WEG!" }[d.art] || "OH NEIN!");
      } else if (d.type === "loesung") {
        if (d.ok) s.geloest.push(d.art);
        sag(d.ok ? "hz_loesung_" + d.art : "hz_loesung_nicht", 9) || (d.ok && sag("hz_loesung", 9));
      } else if (d.type === "einwohner") { s.einwohner = Math.max(s.einwohner || 0, d.zahl); Z.einwText = d.zahl; sag("hz_einwohner", 4); merkeMoment(2, d.zahl + " EINWOHNER!"); }
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
      case "nebel_ich": sag("kz_nebel_ich", 5); break;
      case "knapp": Z.staunen = 1; sag("kz_knapp", 6); break;
      case "ko":
        if (d.thorstenTrifft) { s.kos++; Z.staunen = 1; merkeMoment(3, "K.O.!"); sag("ko_treffer", 6); }
        else if (d.thorstenRaus) { s.raus++; Z.staunen = 1; if (Z.rundeStart != null && Z.t - Z.rundeStart < 7) sag("kz_frueh_raus", 8); else sag("ko_raus", 7); }
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
        if (d.gewonnen) { if (s.serie >= 2) { s.siege++; s.serie = 0; Z.staunen = 1; merkeMoment(5, "ENDLICH!"); sag("kz_endlich", 9); s.highlight = s.highlight || ("Sieg nach Pechsträhne"); break; } s.serie = 0; s.siege++; Z.staunen = 1; merkeMoment(5, "SIEG!"); sag("sieg", 8); s.highlight = s.highlight || ("Sieg mit dem " + d.tier); }
        else if (d.modus === "ffa" && d.platz && d.platz <= 3) sag("platz", 8);
        else { s.serie++; sag(s.serie >= 2 ? "kz_pech" : "niederlage", 8); }
        s.letzterSieger = d.sieger;
        break;
    }
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
    if (!Z || wert < Z.vorschauGrund || Z.t < 3) return;
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
    if (Z.bereit) Z.t = (jetzt - Z.start) / 1000;
    var t = Z.t;
    g.fillStyle = "#07090f"; g.fillRect(0, 0, W, H);
    var spiel = Z.kz && Z.kz.canvas;
    if (Z.format === "hoch") zeichneHoch(g, W, H, spiel); else if (spiel) g.drawImage(spiel, 0, 0, W, H);
    // Avatar + Untertitel
    var pegel = 0;
    if (Z.spricht && Z.spricht.quelle) { var d = new Uint8Array(Z.analyser.fftSize); Z.analyser.getByteTimeDomainData(d); var m = 0; for (var i = 0; i < d.length; i += 4) m = Math.max(m, Math.abs(d[i] - 128)); pegel = Math.min(1, m / 50); }
    Z.mund = (Z.mund || 0) + (pegel - (Z.mund || 0)) * 0.5;
    Z.staunen = Math.max(0, Z.staunen - 1 / 60);
    var gross = Z.format === "hoch" ? 230 : 150;
    var ax = Z.format === "hoch" ? 60 : 24, ay = Z.format === "hoch" ? 1290 : H - gross - 24;
    avatar(g, ax, ay, gross, Z.mund, t, Z.staunen > 0.3);
    namensSchild(g, ax + gross + 14, ay + gross * 0.35, Z.format === "hoch" ? 1.5 : 1);
    if (Z.untertitel && t < Z.untertitel.bis) untertitel(g, W, H, Z.untertitel.text);
    // Titel-Einblendung nach der ersten Action (Leitfaden: erst Ergebnis, dann kurz das Intro)
    if (t > 2.2 && t < 6.2 && Z.bereit) titelKarte(g, W, H, t - 2.2);
    // Füllsätze, wenn es zu ruhig ist
    if (Z.bereit && !Z.spricht && !Z.outro && Z.format !== "hoch" && t - Z.letzterSatz > 15 && t > 10) sag(hz() ? "hz_fuell" : "fuell", 1);
    // Schluss
    if (Z.aufnahme && Z.bereit) {
      var rest = Z.dauer - t;
      var schluss = Z.format === "hoch" ? 3 : 7;
      if (rest < schluss + 0.6 && !Z.outro) { Z.outro = true; if (Z.spricht) { try { Z.spricht.quelle.stop(); } catch (e) { /* egal */ } } Z.spricht = null; Z.letzterSatz = -99; sag(hz() ? (Z.format === "hoch" ? "hz_short_outro" : "hz_outro") : (Z.format === "hoch" ? "short_outro" : "outro"), 10); }
      if (rest < schluss) schlussKarte(g, W, H, 1 - rest / schluss, Z.mund, t);
      var el = $("stZeit"); if (el) el.textContent = zeitText(t) + " / " + zeitText(Z.dauer);
      if (rest <= 0) { stoppen(true); return; }
    } else if (Z.bereit) { var el2 = $("stZeit"); if (el2) el2.textContent = "Vorschau · " + zeitText(t); }
    // Einblenden am Anfang
    if (t < 0.6) { g.fillStyle = "rgba(7,9,15," + (1 - t / 0.6) + ")"; g.fillRect(0, 0, W, H); }
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

  /* ---------- Bausteine ---------- */
  function rund(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function schrift(g, text, x, y, farbe, rand) { g.lineJoin = "round"; g.lineWidth = rand; g.strokeStyle = "rgba(0,0,0,.85)"; g.strokeText(text, x, y); g.fillStyle = farbe; g.fillText(text, x, y); }
  // Thorsten: freundlicher Roboter mit Kometen-Antenne (eigene Figur)
  function avatar(g, x, y, s, mund, t, staunen) {
    var k = s / 100;
    g.save(); g.translate(x, y); g.scale(k, k);
    // Hintergrund-Plakette
    g.fillStyle = "rgba(10,12,22,.82)"; rund(g, 0, 0, 100, 100, 22); g.fill();
    g.strokeStyle = "#ff8a3c"; g.lineWidth = 3; rund(g, 1.5, 1.5, 97, 97, 21); g.stroke();
    var wipp = Math.sin(t * 3.2) * 1.5 + (mund * 2);
    g.translate(0, wipp);
    // Antenne mit Komet
    g.strokeStyle = "#9aa7bd"; g.lineWidth = 3; g.beginPath(); g.moveTo(50, 28); g.lineTo(58, 12); g.stroke();
    g.strokeStyle = "rgba(255,138,60,.6)"; g.lineWidth = 3; g.beginPath(); g.moveTo(60, 10); g.lineTo(70, 16); g.stroke();
    g.fillStyle = "#ff8a3c"; g.beginPath(); g.arc(59, 10, 5.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(57.5, 8.5, 1.6, 0, Math.PI * 2); g.fill();
    // Ohren-Bolzen
    g.fillStyle = "#3b4a7a"; rund(g, 12, 46, 8, 18, 3); g.fill(); rund(g, 80, 46, 8, 18, 3); g.fill();
    // Kopf
    var grad = g.createLinearGradient(0, 28, 0, 90); grad.addColorStop(0, "#2b3a66"); grad.addColorStop(1, "#1a2344");
    g.fillStyle = grad; rund(g, 18, 28, 64, 58, 16); g.fill();
    g.strokeStyle = "#4f62a0"; g.lineWidth = 2; rund(g, 18, 28, 64, 58, 16); g.stroke();
    // Visier
    g.fillStyle = "#0a0f1e"; rund(g, 25, 38, 50, 38, 11); g.fill();
    // Augen (blinzeln ab und zu)
    var zu = (t % 4.3) < 0.12, aH = staunen ? 13 : zu ? 1.5 : 10;
    g.fillStyle = "#3ef2ff"; g.shadowColor = "#3ef2ff"; g.shadowBlur = 8;
    rund(g, 33, 49 - aH / 2, 10, aH, Math.min(4, aH / 2)); g.fill(); rund(g, 57, 49 - aH / 2, 10, aH, Math.min(4, aH / 2)); g.fill();
    // Mund
    var mh = staunen ? 9 : 2.5 + mund * 9, mw = staunen ? 10 : 20 - mund * 4;
    rund(g, 50 - mw / 2, 65 - mh / 2, mw, mh, Math.min(4, mh / 2)); g.fill();
    g.shadowBlur = 0;
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
    var y0 = hoch ? 1640 : H - 70 - (zeilen.length - 1) * lh, x = hoch ? W / 2 : W / 2 + 150;
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
    avatar(g, cx - s / 2, hoch ? 520 : 90, s, mund, t, false);
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
    if (z.spiel !== "krawallzoo") {
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
        titel: titel, beschreibung: beschreibung, tags: tags, kurz: kurz, dauer: z.dauer };
      aufraeumen();
      ergebnisZeigen();
      A.toast("🎬 Video fertig!");
    });
  }
  function vorschaubild(z) {
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

  window.OMNI_STUDIO = { zeigen: zeigen, verlassen: verlassen, laeuft: laeuft };
})();
